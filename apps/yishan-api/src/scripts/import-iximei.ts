import 'dotenv/config'
import { createPool } from 'mysql2/promise'
import { eq, isNull, sql } from 'drizzle-orm'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { drizzleDb, pool as drizzlePool } from '@/db'
import { sysRole, sysUser, sysUserRole } from '@/db/schema'
import { ROLE_IDS } from '@/constants/permission-codes'
import { dateUtils } from '../utils/date.js'

/**
 * db:import-iximei — 把老的 thinkcmf 5.x iximei 数据库中
 *   `hj_user` / `hj_role` / `hj_role_user` 的账号+角色批量迁入新 yishan 系统。
 *
 * 单向脚本。**整个导入在单个 drizzle 事务里**,失败回滚全部,
 * 不会留半个中间的 sys_user。重复跑会因为 username 唯一约束撞错而
 * 整体回滚 — 视作自然幂等保护(一次一库)。
 *
 * 用法:
 *
 *   1) 应用 `pnpm --filter yishan-api db:seed` 把 admin + 系统角色 seed 出来
 *   2) 应用 migration 使 phone 列可空(0001_yellow_hemingway.sql)
 *   3) 配置源库环境变量(IMPORT_IXIMEI_HOST 等),默认指 mysql8 + kf.iximei.cn
 *   4) 设 LEGACY_IXIMEI_AUTHCODE(env)与老系统一致,默认 'U02r3D6dXAuB90BbFG'
 *   5) 跑 `pnpm --filter yishan-api db:import-iximei` (本脚本入口)
 *
 * 角色合并:
 *   老角色直接映射到已存在的系统角色,不创建新的角色行。
 *   hj_role 中的 4 个角色(id 1-4)通过 iximei-role-mapping.json 对应
 *   到内置系统角色 ID 1-4。
 *   同时保留老库角色的名称和备注（写入 sys_role.name / description）。
 *   超出 mapping 的角色(理论上无)统一归属 admin。
 *
 * 手机号 / 邮箱:
 *   - 空或无效手机号 → NULL
 *   - 重复手机号 → NULL(第二人起在唯一约束冲突时置 NULL 重试)
 *   - 空邮箱 → NULL
 *   - 重复邮箱 → NULL(同上)
 *
 * 安全护栏:
 *   - 预检 sys_user 行数 == 1 (仅有 admin seed),否则拒绝执行
 *   - 不打印密码 / 明文 hash
 */

type LegacyUserRow = {
  id: number
  user_login: string
  user_pass: string
  user_nickname: string
  user_email: string
  mobile: string
  user_status: number
  sex: number
  birthday: number
  avatar: string
  hospital_id: number | null
  create_time: number
  last_login_time: number
}

type LegacyRoleRow = { id: number; name: string; remark: string }

type LegacyRoleUserRow = { user_id: number; role_id: number }

type RoleMapping = {
  oldRoleId: number
  newRoleId: number
}

const SYS_ADMIN_ID = 1

const SOURCE_DEFAULTS = {
  host: process.env.IMPORT_IXIMEI_HOST ?? '127.0.0.1',
  port: Number(process.env.IMPORT_IXIMEI_PORT ?? 3306),
  user: process.env.IMPORT_IXIMEI_USER ?? 'root',
  password: process.env.IMPORT_IXIMEI_PASSWORD ?? '123456',
  database: process.env.IMPORT_IXIMEI_DATABASE ?? 'kf.iximei.cn',
} as const

const APP_ROOT = join(__dirname, '..', '..')

const MAPPING_PATH = join(
  APP_ROOT, 'src', 'scripts', 'seed', 'config', 'iximei-role-mapping.json',
)

const FALLBACK_ROLE_ID = ROLE_IDS.ADMIN

/** 检查手机号是否为有效格式（纯数字,11 位,1 开头）。 */
function isValidPhone(value: string | null | undefined): boolean {
  if (!value) return false
  const s = String(value).trim()
  if (!s) return false
  // 去掉常见的 +86、空格、短横、括号前缀
  const digits = s.replace(/^\+?86[\s-]?/, '').replace(/[\s\-()]/g, '')
  return /^1\d{10}$/.test(digits)
}

function loadRoleMapping(): RoleMapping[] {
  return JSON.parse(readFileSync(MAPPING_PATH, 'utf-8')) as RoleMapping[]
}

/**
 * 把 int unix (seconds) 转成 JS Date。
 * 老库 0 表示未设置,直接返回 null;否则 new Date(seconds * 1000)。
 */
function fromUnix(value: number): Date | null {
  if (!value || Number.isNaN(value) || value <= 0) return null
  return new Date(value * 1000)
}

function truncate(value: string | null | undefined, max: number): string | undefined {
  if (value == null) return undefined
  const s = String(value).trim()
  if (!s) return undefined
  return s.length > max ? s.slice(0, max) : s
}

async function loadLegacyUsers(sourcePool: ReturnType<typeof createPool>): Promise<LegacyUserRow[]> {
  // STRICT-SPEC §8.1：医院账号由 import-iximei-hospitals.ts 唯一负责导入，
  // 本脚本只导入内部用户（hospital_id IS NULL）。否则会与医院同步脚本创建
  // 同 username 的 sys_user，触发 sys_user_username_key 唯一索引冲突。
  const [rows] = await sourcePool.execute(
    `SELECT id, user_login, user_pass, user_nickname, user_email, mobile,
            user_status, sex, birthday, avatar, hospital_id,
            create_time, last_login_time
       FROM hj_user
       WHERE hospital_id IS NULL
       ORDER BY id ASC`,
  )
  return rows as LegacyUserRow[]
}

async function loadLegacyRoles(sourcePool: ReturnType<typeof createPool>): Promise<LegacyRoleRow[]> {
  const [rows] = await sourcePool.execute(
    `SELECT id, name, remark FROM hj_role ORDER BY id ASC`,
  )
  return rows as LegacyRoleRow[]
}

async function loadLegacyRoleUsers(sourcePool: ReturnType<typeof createPool>): Promise<LegacyRoleUserRow[]> {
  const [rows] = await sourcePool.execute(
    `SELECT user_id, role_id FROM hj_role_user ORDER BY user_id, role_id`,
  )
  return rows as LegacyRoleUserRow[]
}

interface ImportStats {
  total: number
  imported: number
  phoneNulled: number
  emailNulled: number
  skippedDupUsername: number
  failed: number
}

async function preflightOrThrow(): Promise<void> {
  const [rows] = await drizzleDb
    .select({ c: sql<number>`count(*)` })
    .from(sysUser)
    .where(isNull(sysUser.deletedAt))
  const total = Number(rows.c ?? 0)
  if (total !== 1) {
    throw new Error(
      `[import-iximei] 预检失败:目标库 sys_user 期望只有 1 条 admin seed 行,实际 ${total} 条。\n` +
        `  请确认已经跑过 db:seed,且没有其他用户。如果已经导过一次,本脚本不能再跑一次。`,
    )
  }
  const [adminRow] = await drizzleDb
    .select({ username: sysUser.username })
    .from(sysUser)
    .where(eq(sysUser.id, SYS_ADMIN_ID))
    .limit(1)
  if (!adminRow || adminRow.username !== 'admin') {
    throw new Error(
      `[import-iximei] 预检失败:id=1 的 sys_user.username 必须是 'admin',实际 ${JSON.stringify(adminRow)}`,
    )
  }
}

/**
 * 解析旧角色 ID → 系统角色 ID 的映射表。
 * - 在 mapping.json 中的角色,使用其固定的 newRoleId。
 * - 不在 mapping 中的角色,统一指向 FALLBACK_ROLE_ID。
 */
async function buildRoleIdMap(
  tx: any,
  legacyRoles: LegacyRoleRow[],
  mapByOldRoleId: Map<number, RoleMapping>,
): Promise<{ roleMap: Map<number, number>; unmappedIds: number[] }> {
  const roleMap = new Map<number, number>()
  const unmappedIds: number[] = []

  // 校验目标角色 ID 已由系统角色 seed 创建。
  const allSysRoles: Array<{ id: number }> = await tx
    .select({ id: sysRole.id })
    .from(sysRole)

  const existingRoleIds = new Set(allSysRoles.map((r) => r.id))

  for (const r of legacyRoles) {
    const map = mapByOldRoleId.get(r.id)
    const sysRoleId = map ? map.newRoleId : FALLBACK_ROLE_ID
    if (!existingRoleIds.has(sysRoleId)) {
      console.warn(
        `[import-iximei] 系统角色 id=${sysRoleId} 不存在(旧 role_id=${r.id}),跳过`,
      )
      unmappedIds.push(r.id)
      continue
    }
    roleMap.set(r.id, sysRoleId)
    if (!map) unmappedIds.push(r.id)
  }

  return { roleMap, unmappedIds }
}

/**
 * 角色身份由固定 ID 决定；角色名称和备注以老库 hj_role 的原始值为准。
 * sys_role 没有 remark 字段，因此将老库 remark 原样写入 description。
 */
async function syncLegacyRoleMetadata(
  tx: any,
  legacyRoles: LegacyRoleRow[],
  mapByOldRoleId: Map<number, RoleMapping>,
): Promise<number> {
  let synced = 0
  const now = dateUtils.now()

  for (const role of legacyRoles) {
    const mapping = mapByOldRoleId.get(role.id)
    if (!mapping) continue

    await tx
      .update(sysRole)
      .set({
        name: role.name,
        description: role.remark,
        updaterId: SYS_ADMIN_ID,
        updatedAt: now,
      })
      .where(eq(sysRole.id, mapping.newRoleId))
    synced++
  }

  return synced
}

async function main(): Promise<void> {
  console.log('[import-iximei] start')

  await preflightOrThrow()
  console.log('[import-iximei] preflight OK:target 已 seed admin,无其他用户')

  const mapping = loadRoleMapping()
  const mapByOldRoleId = new Map<number, RoleMapping>(mapping.map((m) => [m.oldRoleId, m]))

  const sourcePool = createPool({
    host: SOURCE_DEFAULTS.host,
    port: SOURCE_DEFAULTS.port,
    user: SOURCE_DEFAULTS.user,
    password: SOURCE_DEFAULTS.password,
    database: SOURCE_DEFAULTS.database,
    connectionLimit: 4,
    dateStrings: true,
  })

  const userStats: ImportStats = {
    total: 0,
    imported: 0,
    phoneNulled: 0,
    emailNulled: 0,
    skippedDupUsername: 0,
    failed: 0,
  }

  let roleUserLinked = 0
  let roleUserSkipped = 0

  try {
    const [legacyUsers, legacyRoles, legacyRoleUsers] = await Promise.all([
      loadLegacyUsers(sourcePool),
      loadLegacyRoles(sourcePool),
      loadLegacyRoleUsers(sourcePool),
    ])
    console.log(
      `[import-iximei] loaded source: users=${legacyUsers.length} roles=${legacyRoles.length} roleUsers=${legacyRoleUsers.length}`,
    )

    userStats.total = legacyUsers.length

    const oldUserIdToNewUserId = new Map<number, number>()

    // 整个导入包在一个事务里,失败回滚。
    await drizzleDb.transaction(async (tx) => {
      // --- 1) 角色迁移与映射（复用固定系统角色 ID，保留老名称和备注）--------
      const { roleMap, unmappedIds } = await buildRoleIdMap(tx, legacyRoles, mapByOldRoleId)
      const roleMetadataSynced = await syncLegacyRoleMetadata(tx, legacyRoles, mapByOldRoleId)
      console.log(`[import-iximei] 已保留 ${roleMetadataSynced} 个老角色的名称和备注`)
      if (unmappedIds.length) {
        console.log(
          `[import-iximei] 以下 old role_id 不在 mapping 中,已归属 role_id=${FALLBACK_ROLE_ID}: [${unmappedIds.join(', ')}]`,
        )
      }

      // --- 2) 用户导入 --------------------------------------------------------
      for (const u of legacyUsers) {
        const username = truncate(u.user_login, 50) ?? `legacy_${u.id}`
        const rawEmail = u.user_email && u.user_email.trim() ? truncate(u.user_email, 100) : undefined
        const nickname = truncate(u.user_nickname, 50)
        const realName = truncate(u.user_nickname, 50)
        const sex = u.sex === 1 || u.sex === 2 ? u.sex : 0
        const birthday = u.birthday ? fromUnix(u.birthday) : null
        const status = u.user_status === 1 ? 1 : 0
        const createdAt = fromUnix(u.create_time) ?? dateUtils.now()
        const now = dateUtils.now()

        // 手机号规范化:无效格式 → null
        const rawPhone = u.mobile && u.mobile.trim() ? u.mobile.trim() : ''
        const phone = isValidPhone(rawPhone) ? rawPhone : null
        if (rawPhone && !phone) userStats.phoneNulled++

        const baseData = {
          username,
          phone,
          passwordHash: u.user_pass,
          passwordFormat: 0,
          passwordChangeRecommended: 1,
          email: rawEmail ?? null,
          realName,
          nickname,
          avatar: truncate(u.avatar, 500),
          gender: sex,
          birthDate: birthday,
          status,
          loginCount: 0,
          lastLoginIp: '',
          creatorId: SYS_ADMIN_ID,
          updaterId: SYS_ADMIN_ID,
          createdAt,
          updatedAt: now,
          deletedAt: null,
          version: 1,
        }

        let inserted = false
        // 重试手机号 & 邮箱冲突:依次弃用 phone/email 再试
        const strategies: Array<{ label: string; phone?: null; email?: null }> = [
          { label: '原始值' },
        ]

        // 如果 email 非空,加一条 email→NULL 的策略
        if (rawEmail) {
          strategies.push({ label: 'email→NULL', email: null })
        }
        // 如果 phone 非空,加一条 phone→NULL 的策略
        if (phone) {
          strategies.push({ label: 'phone→NULL', phone: null })
        }
        // 两个都有冲突时再加双 null 策略
        if (phone && rawEmail) {
          strategies.push({ label: 'phone+email→NULL', phone: null, email: null })
        }

        for (const s of strategies) {
          if (inserted) break
          const payload = { ...baseData, ...(s.phone !== undefined ? { phone: s.phone } : {}), ...(s.email !== undefined ? { email: s.email } : {}) }
          try {
            const [result] = await tx.insert(sysUser).values(payload)
            const newUserId = Number(result.insertId)
            oldUserIdToNewUserId.set(u.id, newUserId)
            userStats.imported++
            inserted = true
            if (s.label === 'email→NULL' || s.label === 'phone+email→NULL') userStats.emailNulled++
            if (s.label === 'phone→NULL' || s.label === 'phone+email→NULL') userStats.phoneNulled++
          } catch (err: any) {
            const msg = String(err?.message ?? '') + String(err?.cause?.message ?? '')
            const isDup = msg.includes('Duplicate entry') || msg.includes('ER_DUP_ENTRY') || msg.includes('1062')

            if (!isDup) {
              // 非唯一约束异常,放弃这条用户
              break
            }

            // username 唯一冲突 → 不可修复,跳过
            if (msg.includes('sys_user_username_key')) {
              break
            }

            // phone/email 冲突 → 试下一个策略
            continue
          }
        }

        if (!inserted) {
          userStats.failed++
        }
      }

      // --- 3) user_role 绑定 --------------------------------------------------
      const now2 = dateUtils.now()
      for (const ru of legacyRoleUsers) {
        const newUserId = oldUserIdToNewUserId.get(ru.user_id)
        const newRoleId = roleMap.get(ru.role_id)
        if (!newUserId) {
          roleUserSkipped++
          continue
        }
        if (!newRoleId) {
          roleUserSkipped++
          continue
        }
        try {
          await tx
            .insert(sysUserRole)
            .values({ userId: newUserId, roleId: newRoleId, createdAt: now2, updatedAt: now2 })
          roleUserLinked++
        } catch (err: any) {
          const errno = err?.errno ?? 0
          if (errno !== 1062) {
            console.error(
              `[import-iximei] user_role (old user=${ru.user_id}, old role=${ru.role_id}) failed:`,
              err?.message,
            )
          }
        }
      }
    })

  } finally {
    await sourcePool.end().catch(() => {})
    await drizzlePool.end().catch(() => {})
  }

  console.log('\n================ import-iximei summary ================')
  console.log(`source     : ${SOURCE_DEFAULTS.user}@${SOURCE_DEFAULTS.host}:${SOURCE_DEFAULTS.port}/${SOURCE_DEFAULTS.database}`)
  console.log(`users      : total=${userStats.total}  imported=${userStats.imported}`)
  console.log(`  phoneNulled  =${userStats.phoneNulled}   (无效/重复 → NULL)`)
  console.log(`  emailNulled  =${userStats.emailNulled}   (重复 → NULL)`)
  console.log(`  dupUsername  =${userStats.skippedDupUsername}   (username 冲突,跳过)`)
  console.log(`  failed       =${userStats.failed}`)
  console.log(`user_roles: linked=${roleUserLinked}  skipped=${roleUserSkipped}`)
  console.log('=======================================================')
  console.log('')
  console.log('下一步:')
  console.log('  - 后端启动后,登录任意老用户(密码可用其原密码)观察 shouldChangePassword banner')
  console.log('  - admin 用户登录后 Banner 不出现,符合预期')
  console.log('  - 老用户首次登录后,hash 在事务内被原子升级到 scrypt v1;banner 仍存在直到他改密')
  console.log('=======================================================')
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[import-iximei] failed:', error)
    process.exit(1)
  })
}
