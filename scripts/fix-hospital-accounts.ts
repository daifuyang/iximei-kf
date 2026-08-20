/**
 * scripts/fix-hospital-accounts.ts
 *
 * 修复 crm_hospital 关联 sys_user 的常见数据异常：
 *   1) account_user_id IS NULL（孤儿医院）        — 自动新建 sys_user + 绑定 hospital_account 角色 + 回写 crm_hospital
 *   2) 账号 status=0 / deleted 但医院仍 active   — 自动启用账号 (status=1, deleted_at=NULL)
 *   3) passwordHash 非本项目支持的格式            — **只打印，待 DBA 处理**
 *
 * 默认 DRY-RUN：所有写入都跳过，只打印"将做什么"。
 * 加 `--apply` 才真正写入。两者都要求 `--default-password <pw>` 才能修孤儿医院
 * （不能凭空建密码；脚本不会用空字符串占位）。
 *
 * 用法：
 *   # 0. 先跑诊断 SQL 看全貌
 *   mysql ... < scripts/diagnose-hospital-accounts.sql
 *
 *   # 1. dry-run（强烈建议）
 *   pnpm --filter yishan-api exec tsx ../../scripts/fix-hospital-accounts.ts \
 *        --default-password 'Temp@12345'
 *
 *   # 2. 真正执行
 *   pnpm --filter yishan-api exec tsx ../../scripts/fix-hospital-accounts.ts \
 *        --default-password 'Temp@12345' --apply
 *
 * 设计要点：
 *   - 用 mysql2/promise 原生连接，**不 import 后端 drizzle schema**，
 *     避免 @/core/... 路径别名失败。修复脚本与后端是独立进程。
 *   - 密码 hash 用 Node.js 内置 crypto.scrypt，**参数与后端一致**
 *     （$scrypt$v=1$ln=16,r=8,p=2$...），见 apps/yishan-api/src/utils/password.ts。
 *   - DATABASE_URL 从环境变量读取（与后端共用），可被 .env 文件或父进程注入。
 *   - **不重置密码**：bad-hash 列表只打印，由 DBA 走系统管理工具或单独脚本处理。
 *
 * 注意：
 *   - 本脚本当前只关心医院账号异常，不会批量改权限菜单。
 *   - 角色 ID = 3 (HOSPITAL_ACCOUNT)，对齐 apps/yishan-api/src/constants/permission-codes.ts。
 *     如角色 ID 在你的环境里不同，请用 --hospital-role-id 覆盖。
 */

import { createConnection } from 'mysql2/promise'
import { randomBytes, scrypt } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options?: { cost?: number; blockSize?: number; parallelization?: number; maxmem?: number },
) => Promise<Buffer>

// ──────────────────────── CLI 解析 ────────────────────────
const argv = process.argv.slice(2)

const APPLY = argv.includes('--apply')

function argValue(flag: string): string | null {
  const i = argv.indexOf(flag)
  if (i < 0 || i + 1 >= argv.length) return null
  return argv[i + 1]
}

const defaultPassword = argValue('--default-password')
const hospitalRoleIdRaw = argValue('--hospital-role-id')
const HOSPITAL_ROLE_ID = hospitalRoleIdRaw ? Number(hospitalRoleIdRaw) : 3 // permission-codes.ts::ROLE_IDS.HOSPITAL_ACCOUNT

if (APPLY) {
  console.log('== APPLY MODE ==')
  console.log('!! 即将写入数据库；按 Ctrl-C 在 3 秒内可中止（无内置延迟，给操作员反应时间）')
} else {
  console.log('== DRY-RUN ==')
  console.log('不会修改任何数据。加 --apply 才会真正写入。')
}

if (!defaultPassword) {
  console.warn(
    '[warn] 未传 --default-password <pw>：脚本将不会自动新建孤儿医院对应的 sys_user，仅打印。',
  )
}

// ──────────────────────── scrypt 哈希（与后端对齐） ────────────────────────
// 来自 apps/yishan-api/src/utils/password.ts 的常量
const SCRYPT_KEY_LENGTH = 32
const SCRYPT_SALT_LENGTH = 16
const SCRYPT_COST = 2 ** 16
const SCRYPT_BLOCK_SIZE = 8
const SCRYPT_PARALLELIZATION = 2
const SCRYPT_LOG_N = 16
const SCRYPT_MAX_MEMORY = 128 * SCRYPT_COST * SCRYPT_BLOCK_SIZE * 2

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SCRYPT_SALT_LENGTH)
  const key = await scryptAsync(password, salt, SCRYPT_KEY_LENGTH, {
    cost: SCRYPT_COST,
    blockSize: SCRYPT_BLOCK_SIZE,
    parallelization: SCRYPT_PARALLELIZATION,
    maxmem: SCRYPT_MAX_MEMORY,
  })
  return (
    `$scrypt$v=1$ln=${SCRYPT_LOG_N},r=${SCRYPT_BLOCK_SIZE},p=${SCRYPT_PARALLELIZATION}` +
    `$${salt.toString('base64url')}$${key.toString('base64url')}`
  )
}

// ──────────────────────── DB 连接 ────────────────────────
// 与 apps/yishan-api/src/config/index.ts::DATABASE_CONFIG.url 对齐
const DATABASE_URL = process.env.DATABASE_URL || 'mysql://root:root@localhost:3306/yishan'

function parseMysqlUrl(url: string) {
  const u = new URL(url)
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 3306,
    user: u.username || 'root',
    password: decodeURIComponent(u.password || ''),
    database: u.pathname.replace(/^\//, '') || undefined,
    multipleStatements: false,
    charset: 'utf8mb4',
  }
}

// ──────────────────────── SQL ────────────────────────
const SQL = {
  selectOrphanHospitals: `
    SELECT h.id, h.hospital_name, h.status, h.account_user_id
    FROM crm_hospital h
    WHERE h.account_user_id IS NULL
    ORDER BY h.id ASC
  `,

  selectDisabledAccounts: `
    SELECT h.id AS hospital_id, h.hospital_name, h.status AS hospital_status,
           u.id AS user_id, u.username, u.status AS user_status, u.deleted_at AS user_deleted_at
    FROM crm_hospital h
    LEFT JOIN sys_user u ON u.id = h.account_user_id
    WHERE h.status = 1
      AND (u.status IS NULL OR u.status <> 1 OR u.deleted_at IS NOT NULL)
    ORDER BY h.id ASC
  `,

  selectBadHashAccounts: `
    SELECT u.id, u.username, u.password_format,
           LEFT(u.password_hash, 16) AS hash_prefix,
           CHAR_LENGTH(u.password_hash) AS hash_len
    FROM sys_user u
    WHERE u.password_hash IS NULL
       OR u.password_hash = ''
       OR (
         u.password_hash NOT LIKE '$scrypt$v=1$%'
         AND u.password_hash NOT LIKE '###%'
       )
    ORDER BY u.id ASC
  `,

  // 同一 sys_user.username 已存在的判断（防孤儿医院名与老账号冲突）
  selectUsernameExists: `
    SELECT id FROM sys_user WHERE username = ? LIMIT 1
  `,

  insertSysUser: `
    INSERT INTO sys_user
      (username, password_hash, password_format, password_change_recommended,
       real_name, email, phone, status, login_count,
       creator_id, updater_id, created_at, updated_at, deleted_at, version)
    VALUES (?, ?, 1, 1,
            NULL, NULL, NULL, 1, 0,
            ?, ?, CURRENT_TIMESTAMP(0), CURRENT_TIMESTAMP(0), NULL, 1)
  `,

  bindHospitalAccountRole: `
    INSERT INTO sys_user_role (user_id, role_id, created_at, updated_at, deleted_at)
    VALUES (?, ?, CURRENT_TIMESTAMP(0), CURRENT_TIMESTAMP(0), NULL)
    ON DUPLICATE KEY UPDATE deleted_at = NULL
  `,

  updateCrmHospitalAccountUser: `
    UPDATE crm_hospital SET account_user_id = ? WHERE id = ?
  `,

  enableSysUser: `
    UPDATE sys_user
    SET status = 1, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP(0), version = version + 1
    WHERE id = ?
  `,
}

// ──────────────────────── 主流程 ────────────────────────
async function main() {
  const conn = await createConnection(parseMysqlUrl(DATABASE_URL))
  try {
    await runDiagnostics(conn)

    if (!APPLY) {
      console.log('\n[dry-run 完成] 加上 --apply 才会真正写入。')
      return
    }

    if (!defaultPassword) {
      console.error(
        '[abort] APPLY 模式必须传 --default-password <pw>（脚本不会用空字符串或弱默认值建账号）。',
      )
      process.exit(2)
    }

    console.log('\n[apply] 开始修复……')
    await fixOrphanHospitals(conn)
    await fixDisabledAccounts(conn)
    console.log('[apply] 全部完成。')
  } finally {
    await conn.end()
  }
}

// ──────────────── 只读诊断（dry-run 与 apply 都跑一遍） ────────────────
async function runDiagnostics(conn: Awaited<ReturnType<typeof createConnection>>) {
  console.log('\n—— 诊断 ——')

  const [orphans] = await conn.query<any[]>(SQL.selectOrphanHospitals)
  console.log(`orphan hospital count = ${orphans.length}`)
  if (orphans.length) {
    console.table(
      orphans.map((r: any) => ({
        id: r.id,
        hospital_name: r.hospital_name,
        status: r.status,
        account_user_id: r.account_user_id,
      })),
    )
  }

  const [disabled] = await conn.query<any[]>(SQL.selectDisabledAccounts)
  console.log(`disabled-but-hospital-active count = ${disabled.length}`)
  if (disabled.length) {
    console.table(
      disabled.map((r: any) => ({
        hospital_id: r.hospital_id,
        hospital_name: r.hospital_name,
        hospital_status: r.hospital_status,
        user_id: r.user_id,
        username: r.username,
        user_status: r.user_status,
        user_deleted_at: r.user_deleted_at,
      })),
    )
  }

  const [badHashes] = await conn.query<any[]>(SQL.selectBadHashAccounts)
  console.log(`non-conforming password hash count = ${badHashes.length}`)
  if (badHashes.length) {
    console.log('（以下账号 hash 既非 $scrypt$v=1$ 也非 ### 老格式，请 DBA 重置密码。）')
    console.table(
      badHashes.map((r: any) => ({
        id: r.id,
        username: r.username,
        password_format: r.password_format,
        hash_prefix: r.hash_prefix,
        hash_len: r.hash_len,
      })),
    )
  }
}

// ──────────────── 孤儿医院：建账号 + 绑定角色 + 回写 account_user_id ────────────────
async function fixOrphanHospitals(conn: Awaited<ReturnType<typeof createConnection>>) {
  const [orphans] = (await conn.query(SQL.selectOrphanHospitals)) as any

  if (!orphans.length) {
    console.log('[orphan] 无需处理')
    return
  }

  const hash = await hashPassword(defaultPassword!)
  let created = 0
  let skipped = 0

  for (const h of orphans) {
    // 防御：hospital_name 与已存在的 sys_user.username 冲突就跳过
    const [dup] = await conn.query<any[]>(SQL.selectUsernameExists, [h.hospital_name])
    if (dup.length) {
      console.log(
        `[orphan] skip hospital#${h.id} "${h.hospital_name}": username 已被 sys_user#${dup[0].id} 占用`,
      )
      skipped++
      continue
    }

    console.log(
      `[orphan] ${APPLY ? 'create+bind' : 'would create+bind'} user for hospital#${h.id} "${h.hospital_name}"`,
    )

    if (!APPLY) continue

    await conn.beginTransaction()
    try {
      const [res] = (await conn.query(SQL.insertSysUser, [
        h.hospital_name,
        hash,
        1, // creator_id = super_admin 占位
        1, // updater_id = super_admin 占位
      ])) as any
      const newUserId = Number(res.insertId)
      await conn.query(SQL.bindHospitalAccountRole, [newUserId, HOSPITAL_ROLE_ID])
      await conn.query(SQL.updateCrmHospitalAccountUser, [newUserId, h.id])
      await conn.commit()
      console.log(`  -> sys_user#${newUserId} 已建并绑定 hospital_account 角色 (role_id=${HOSPITAL_ROLE_ID})`)
      created++
    } catch (e) {
      await conn.rollback()
      console.error(`  [error] hospital#${h.id} 处理失败，已回滚：`, e)
    }
  }

  console.log(`[orphan] 处理完毕：created=${created}, skipped=${skipped}, total=${orphans.length}`)
}

// ──────────────── 禁用账号：恢复 status=1 + 清 deleted_at ────────────────
async function fixDisabledAccounts(conn: Awaited<ReturnType<typeof createConnection>>) {
  const [rows] = (await conn.query(SQL.selectDisabledAccounts)) as any
  if (!rows.length) {
    console.log('[disabled] 无需处理')
    return
  }

  let updated = 0
  for (const r of rows) {
    if (r.user_id == null) {
      console.log(`[disabled] skip hospital#${r.hospital_id} "${r.hospital_name}": 无对应 sys_user`)
      continue
    }
    console.log(
      `[disabled] ${APPLY ? 'enable' : 'would enable'} sys_user#${r.user_id} (${r.username}); hospital#${r.hospital_id} "${r.hospital_name}" is active`,
    )
    if (!APPLY) continue
    await conn.query(SQL.enableSysUser, [r.user_id])
    updated++
  }
  console.log(`[disabled] 处理完毕：updated=${updated}, total=${rows.length}`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})