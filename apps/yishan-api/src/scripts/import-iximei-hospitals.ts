import 'dotenv/config'
import { createPool } from 'mysql2/promise'
import { and, eq, isNull } from 'drizzle-orm'
import { drizzleDb, pool as drizzlePool } from '@/db'
import { sysRegion, sysRole, sysUser, sysUserRole } from '@/db/schema'
import { crmHospital, crmCustomer, crmDispatch } from '@/modules/crm/db/schema'
import { dateUtils } from '../utils/date.js'

/**
 * 业务数据一次性导入: 区域 → 医院 → 客户 → 派单.
 *
 * 状态表(crm_customer_status / crm_dispatch_status)不导入 — CRM migration 自带 seed.
 * 客户状态老 ID 与 CRM ID 一一对应(名称完全一致),派单状态用硬编码映射表.
 *
 * 前提: 1) db:import-iximei 已跑完  2) CRM migration 已执行(含 seed 状态)
 * 用法: pnpm build:ts && node dist/scripts/import-iximei-hospitals.js
 * 上线后删除.
 */

// ---- 老派单状态 → CRM 派单状态 映射 ------------------------------------------
// CRM:  1待回复 2已联系 3已到院 4已成交 5未成交 6重单
// 老:   1面诊   2以手术 3未手术 4以消费 5未消费 6以联系上 7未联系上
const DISPATCH_STATUS_MAP: Record<number, number> = {
  1: 1,  // 面诊     → 待回复
  2: 3,  // 以手术   → 已到院
  3: 1,  // 未手术   → 待回复
  4: 4,  // 以消费   → 已成交
  5: 5,  // 未消费   → 未成交
  6: 2,  // 以联系上 → 已联系
  7: 1,  // 未联系上 → 待回复
}

// ---- source types ------------------------------------------------------------
type OldRegion = { area_id: number; area_name: string; area_type: number; parent_id: number }
type OldHospital = {
  id: number; hospital_name: string; hospital_introduction: string | null
  province: number | null; city: number | null; district: number | null
  hospital_address: string | null; hospital_phone: string | null
  hospital_selling: string | null; hospital_website: string | null; hospital_nature: number | null
  doctor_name: string | null; doctor_phone: string | null; doctor_qq: string | null
  reception_name: string | null; reception_phone: string | null; reception_qq: string | null
  bus_station: string | null; bus_address: string | null
  subway_station: string | null; subway_address: string | null
  taxi_fare: string | null; vip_discount: string | null; return_point: string | null
  create_time: number; update_time: number; openid: string | null; status: number | null
}
type OldUserRef = { oldId: number; userLogin: string; userPass: string; hospitalId: number | null }
type OldCustom = {
  id: number; number_id: string; name: string; birthday: number
  customer_userid: number; plastic: string | null; gender: number
  province: number; city: number; district: number
  address: string; telphone: string; mobile: string
  qq: number | null; wechat: string
  create_time: number; update_time: number; status: number; remark: string | null
}
type OldDispatch = {
  id: number; custom_id: number; hospital_id: number
  receive_qq: number | null; receive_wechat: string | null
  create_time: number; finsh_time: number | null; status: number; image: string | null
}

// ---- helpers -----------------------------------------------------------------
const SYS_ADMIN_ID = 1
const SOURCE = {
  host: process.env.IMPORT_IXIMEI_HOST ?? '127.0.0.1',
  port: Number(process.env.IMPORT_IXIMEI_PORT ?? 3306),
  user: process.env.IMPORT_IXIMEI_USER ?? 'root',
  password: process.env.IMPORT_IXIMEI_PASSWORD ?? '123456',
  database: process.env.IMPORT_IXIMEI_DATABASE ?? 'kf.iximei.cn',
} as const

function fromUnix(v: number): Date | null {
  if (!v || Number.isNaN(v) || v <= 0) return null
  return new Date(v * 1000)
}
function ns(v: string | null | undefined): string | null {
  if (v == null) return null; const s = String(v).trim(); return s || null
}
function nz(v: number | null | undefined): number | null {
  if (v == null || v === 0) return null; return v
}

async function q<T>(pool: ReturnType<typeof createPool>, sql: string): Promise<T[]> {
  const [rows] = await pool.execute(sql); return rows as T[]
}

// ---- main --------------------------------------------------------------------
async function main() {
  console.log('[import-business] start')

  let regionCnt = 0, hospitalCnt = 0, hospitalAcctCnt = 0
  let customerCnt = 0, dispatchCnt = 0
  let failed = 0
  let dispMissingRef = 0
  /** 一院一账号阻断报告：每个不通过的 hospital_id → 原因 */
  const blockingIssues: Array<{ hospitalId: number; hospitalName: string; reason: string }> = []
  /** 导入后用户名与医院名不一致的清单（需业务确认后同步改名） */
  const usernameMismatch: Array<{ newHospitalId: number; oldHospitalId: number; hospitalName: string; currentUsername: string }> = []

  const src = createPool({ ...SOURCE, connectionLimit: 4, dateStrings: true })

  try {
    // ---- load source ---------------------------------------------------------
    const [regions, hospitals, userRefs, customs, dispatches] = await Promise.all([
      q<OldRegion>(src, 'SELECT area_id,area_name,area_type,parent_id FROM hj_region ORDER BY area_id'),
      q<OldHospital>(src, `SELECT id,hospital_name,hospital_introduction,province,city,district,
        hospital_address,hospital_phone,hospital_selling,hospital_website,hospital_nature,
        doctor_name,doctor_phone,doctor_qq,reception_name,reception_phone,reception_qq,
        bus_station,bus_address,subway_station,subway_address,taxi_fare,vip_discount,
        return_point,create_time,update_time,openid,status FROM hj_hospital ORDER BY id`),
      q<OldUserRef>(src, 'SELECT id oldId,user_login userLogin,user_pass userPass,hospital_id hospitalId FROM hj_user'),
      q<OldCustom>(src, `SELECT id,number_id,name,birthday,customer_userid,plastic,gender,
        province,city,district,address,telphone,mobile,qq,wechat,create_time,update_time,status
        FROM hj_custom ORDER BY id`),
      q<OldDispatch>(src, `SELECT id,custom_id,hospital_id,receive_qq,receive_wechat,
        create_time,finsh_time,status,image FROM hj_dispatch ORDER BY id`),
    ])
    console.log(`[import-business] loaded: regions=${regions.length} hosps=${hospitals.length} users=${userRefs.length} customs=${customs.length} dispatches=${dispatches.length}`)

    // ---- old → new user 映射（仅 hospital_id IS NULL 的内部用户）-------------
    // 医院账号在本脚本内新建（username = hospital_name，不沿用 user_login）；
    // 内部用户（admin / customer_service 等）由 import-iximei.ts 预先创建，
    // 这里按 user_login 回查它们的 sys_user.id，供 customer.ownerUserId 使用。
    const targetUsers = await drizzleDb.query.sysUser.findMany({
      columns: { id: true, username: true },
      where: (f, { isNull }) => isNull(f.deletedAt),
    })
    const uname2id = new Map(targetUsers.map(u => [u.username!, u.id]))
    const oldUid2new = new Map<number, number>()
    for (const r of userRefs) {
      if (r.hospitalId != null) continue // 医院账号由本脚本新建，不通过 user_login 查找
      const nid = uname2id.get(r.userLogin)
      if (nid) oldUid2new.set(r.oldId, nid)
    }

    // ---- 1) regions ----------------------------------------------------------
    await drizzleDb.transaction(async tx => {
      const now = dateUtils.now()
      for (const r of regions) {
        try {
          await tx.insert(sysRegion).values({
            code: r.area_id, name: r.area_name, level: r.area_type,
            parentCode: r.parent_id, sortOrder: 0, status: 1, createdAt: now, updatedAt: now,
          }).onDuplicateKeyUpdate({ set: { name: r.area_name, level: r.area_type, parentCode: r.parent_id } })
          regionCnt++
        } catch (e: any) { console.error(`region ${r.area_id} fail:`, e?.message); failed++ }
      }
    })
    console.log(`[import-business] regions: ${regionCnt}`)

    // ---- 2) hospitals + 唯一账号（一院一账号） -------------------------------
    // 按 plan §5.4 (新口径)：
    //   - 每个老 hospital_id 必须恰好匹配一个老 user（plan §7.1.A）；
    //   - 每个老 user 不能归属多个医院（§7.1.B）；
    //   - 老 hospital_name 长度不能超过 50（§7.1.C）；
    //   - 0 / 多于 1 都输出阻断报告并**终止导入**，不取第一条；
    //   - 不再写 crm_hospital_account 表；
    //   - 不再依赖 import-iximei.ts 创立的 sys_user：直接为每家医院新建 sys_user，
    //     username = hospital_name（不沿用老 user_login），passwordHash = 老 user_pass，
    //     passwordFormat = 0（保持老 iximei `###md5` 兼容方案），同时绑定 hospital_account 角色。
    const oldHosp2new = new Map<number, number>()

    // 预聚合：每个 hospitalId 关联的 userRefs（仅考虑 hospitalId 非空的）
    const userRefsByHospital = new Map<number, typeof userRefs>()
    for (const r of userRefs) {
      if (r.hospitalId == null) continue
      const list = userRefsByHospital.get(r.hospitalId) ?? []
      list.push(r)
      userRefsByHospital.set(r.hospitalId, list)
    }
    // 预聚合：每个 userId 关联的 hospital 数（应全为 1，违反则阻断）
    const userHospitalCount = new Map<number, Set<number>>()
    for (const r of userRefs) {
      if (r.hospitalId == null) continue
      const set = userHospitalCount.get(r.oldId) ?? new Set<number>()
      set.add(r.hospitalId)
      userHospitalCount.set(r.oldId, set)
    }
    for (const [uid, set] of userHospitalCount) {
      if (set.size > 1) {
        blockingIssues.push({
          hospitalId: -1,
          hospitalName: `<user#${uid} 跨 ${set.size} 院>`,
          reason: '同一老用户绑定多家医院，违反 plan §7.1.B',
        })
      }
    }

    // 计算每个医院应绑定的"唯一老 user"，并把违规医院记入阻断报告
    const hospitalToOldUser = new Map<number, OldUserRef>()
    // 预聚合：老系统范围内的 hospital_name 重复（STRICT-SPEC §8.2.③）
    const nameCount = new Map<string, number>()
    for (const h of hospitals) {
      const n = h.hospital_name ?? ''
      nameCount.set(n, (nameCount.get(n) ?? 0) + 1)
    }
    for (const h of hospitals) {
      const refs = userRefsByHospital.get(h.id) ?? []
      const name = (h.hospital_name ?? '').trim()
      const nameLen = name.length
      const ref0 = refs[0]

      if (refs.length === 0) {
        blockingIssues.push({
          hospitalId: h.id,
          hospitalName: h.hospital_name,
          reason: '无老用户关联（违反 §8.2.①）',
        })
        continue
      }
      if (refs.length > 1) {
        blockingIssues.push({
          hospitalId: h.id,
          hospitalName: h.hospital_name,
          reason: `一院多账号（${refs.length} 个匹配），需业务指定唯一保留账号（§7.2）`,
        })
        continue
      }
      if (nameLen < 1 || nameLen > 50) {
        blockingIssues.push({
          hospitalId: h.id,
          hospitalName: h.hospital_name,
          reason: `医院名称 ${nameLen} 字不在 1–50 范围（§8.2.② / §7.2）`,
        })
        continue
      }
      if ((nameCount.get(name) ?? 0) > 1) {
        blockingIssues.push({
          hospitalId: h.id,
          hospitalName: h.hospital_name,
          reason: `老系统内医院名称重复（§8.2.③，count=${nameCount.get(name)}）`,
        })
        continue
      }
      // STRICT-SPEC §8.2.④：密码哈希非空且 passwordFormat=0 可验证（`###md5` 格式）。
      // 老 iximei 的密码哈希形如 `###xxxx`（`###` + 64 字符 hex）。
      if (!ref0.userPass || !ref0.userPass.startsWith('###') || ref0.userPass.length < 4) {
        blockingIssues.push({
          hospitalId: h.id,
          hospitalName: h.hospital_name,
          reason: `医院用户密码哈希缺失或不符合 passwordFormat=0 格式（§8.2.④）`,
        })
        continue
      }
      hospitalToOldUser.set(h.id, ref0)
    }

    // 一旦存在阻断项，直接终止（满足 §5.4.3 "输出阻断报告并终止"）
    if (blockingIssues.length > 0) {
      console.error('[import-business] BLOCKED by 一院一账号 invariant:')
      for (const b of blockingIssues) {
        console.error(`  hospital#${b.hospitalId} "${b.hospitalName}": ${b.reason}`)
      }
      console.error('[import-business] fix source data per plan §7.2, then re-run.')
      throw new Error(`import blocked: ${blockingIssues.length} violation(s)`)
    }

    // 预解析 hospital_account 系统角色 id
    const [hospitalAccountRole] = await drizzleDb
      .select({ id: sysRole.id })
      .from(sysRole)
      .where(and(eq(sysRole.code, 'hospital_account'), isNull(sysRole.deletedAt)))
      .limit(1)
    if (!hospitalAccountRole) throw new Error('hospital_account 系统角色未配置，请先运行 db:seed')

    await drizzleDb.transaction(async tx => {
      const now = dateUtils.now()
      // STRICT-SPEC §8.3：医院与账号同步写入，任一失败必须整体回滚；不再 try/catch 吞错。
      for (const h of hospitals) {
        const oldUser = hospitalToOldUser.get(h.id)
        // §8.2.① 在前置校验已保证每家医院都对应 1 个老用户；
        // 这里再断言一次，避免后续代码把 null 写到 NOT NULL 列。
        if (!oldUser) {
          throw new Error(
            `hospital#${h.id} "${h.hospital_name}" missing associated old user ` +
              `(前置校验应已阻断；这是断言性保护)`,
          )
        }
        const ct = fromUnix(h.create_time) ?? now; const ut = fromUnix(h.update_time) ?? now
        // 新建 sys_user：username = hospital_name，passwordHash = 老 user_pass，passwordFormat = 0
        const [ur] = await tx.insert(sysUser).values({
          username: h.hospital_name,
          passwordHash: oldUser.userPass,
          passwordFormat: 0,
          passwordChangeRecommended: 1,
          realName: null,
          email: null,
          phone: null,
          status: 1,
          loginCount: 0,
          creatorId: SYS_ADMIN_ID,
          updaterId: SYS_ADMIN_ID,
          createdAt: ct,
          updatedAt: now,
          deletedAt: null,
          version: 1,
        })
        const newUserId: number = Number(ur.insertId)
        // 绑定 hospital_account 角色
        await tx
          .insert(sysUserRole)
          .values({ userId: newUserId, roleId: hospitalAccountRole.id })
          .onDuplicateKeyUpdate({ set: { deletedAt: null } })
        hospitalAcctCnt++

        const [r] = await tx.insert(crmHospital).values({
          accountUserId: newUserId, hospitalName: h.hospital_name,
          provinceId: nz(h.province), cityId: nz(h.city), districtId: nz(h.district),
          hospitalAddress: ns(h.hospital_address), hospitalPhone: ns(h.hospital_phone),
          hospitalSelling: ns(h.hospital_selling), hospitalWebsite: ns(h.hospital_website),
          hospitalNature: h.hospital_nature ?? -1,
          doctorName: ns(h.doctor_name), doctorPhone: ns(h.doctor_phone), doctorQq: ns(h.doctor_qq),
          receptionName: ns(h.reception_name), receptionPhone: ns(h.reception_phone), receptionQq: ns(h.reception_qq),
          busStation: ns(h.bus_station), busAddress: ns(h.bus_address),
          subwayStation: ns(h.subway_station), subwayAddress: ns(h.subway_address),
          taxiFare: ns(h.taxi_fare), vipDiscount: ns(h.vip_discount), returnPoint: ns(h.return_point),
          hospitalIntroduction: ns(h.hospital_introduction), wechatOpenid: ns(h.openid),
          status: 1, creatorId: SYS_ADMIN_ID, updaterId: SYS_ADMIN_ID,
          createdAt: ct, updatedAt: ut, deletedAt: null, version: 1,
        })
        oldHosp2new.set(h.id, Number(r.insertId))
        hospitalCnt++
      }
    })

    // ---- 2.5) 一院一账号 post-import 全量断言（STRICT-SPEC §8.3 / §9.2.8）-----
    if (oldHosp2new.size > 0) {
      const valid = await drizzleDb
        .select({
          newHospitalId: crmHospital.id,
          hospitalName: crmHospital.hospitalName,
          accountUserId: crmHospital.accountUserId,
          username: sysUser.username,
        })
        .from(crmHospital)
        .leftJoin(sysUser, eq(sysUser.id, crmHospital.accountUserId))
      // 全量断言：医院数 = 账号数 = hospital_account 角色绑定数 = 1:1:1
      const distinctAccounts = new Set<number>()
      for (const r of valid) {
        if (!r.accountUserId) {
          usernameMismatch.push({
            newHospitalId: r.newHospitalId,
            oldHospitalId: -1,
            hospitalName: r.hospitalName,
            currentUsername: '<null>',
          })
          continue
        }
        distinctAccounts.add(r.accountUserId)
        if (r.username !== r.hospitalName) {
          let oldId = -1
          for (const [k, v] of oldHosp2new.entries()) if (v === r.newHospitalId) oldId = k
          usernameMismatch.push({
            newHospitalId: r.newHospitalId,
            oldHospitalId: oldId,
            hospitalName: r.hospitalName,
            currentUsername: r.username ?? '<null>',
          })
        }
      }
      if (distinctAccounts.size !== valid.length) {
        throw new Error(
          `一账号多院断言失败: ${distinctAccounts.size} unique accounts for ${valid.length} hospitals`,
        )
      }
      // 验证 hospital_account 角色绑定数量与医院数一致
      const [hospitalAccountRole] = await drizzleDb
        .select({ id: sysRole.id })
        .from(sysRole)
        .where(and(eq(sysRole.code, 'hospital_account'), isNull(sysRole.deletedAt)))
        .limit(1)
      if (hospitalAccountRole) {
        const roleBindings = await drizzleDb
          .select({ userId: sysUserRole.userId })
          .from(sysUserRole)
          .where(and(eq(sysUserRole.roleId, hospitalAccountRole.id), isNull(sysUserRole.deletedAt)))
        if (roleBindings.length !== valid.length) {
          throw new Error(
            `hospital_account 角色绑定数 ${roleBindings.length} 与医院数 ${valid.length} 不一致`,
          )
        }
      }
    }
    console.log(`[import-business] hospitals: ${hospitalCnt} accounts: ${hospitalAcctCnt}`)

    // ---- 3) customers (status_id = old status id, CRM 名称一一对应) ----------
    const oldCust2new = new Map<number, number>()
    await drizzleDb.transaction(async tx => {
      // STRICT-SPEC §8.3：客户同步失败整体回滚，禁止 skipped。
      for (const c of customs) {
        const ownerId = oldUid2new.get(c.customer_userid) ?? SYS_ADMIN_ID
        const bday = fromUnix(c.birthday); const ct = fromUnix(c.create_time) ?? dateUtils.now()
        const ut = fromUnix(c.update_time) ?? ct
        const [r] = await tx.insert(crmCustomer).values({
          numberId: c.number_id, name: c.name, gender: c.gender, birthday: bday,
          telphone: c.telphone || null, mobile: c.mobile || null,
          qq: c.qq ? String(c.qq) : null, wechat: ns(c.wechat),
          provinceId: nz(c.province), cityId: nz(c.city), districtId: nz(c.district),
          address: ns(c.address), plastic: ns(c.plastic),
          statusId: c.status, // 老 status ID 与 CRM seed ID 一一对应
          remark: ns(c.remark), ownerUserId: ownerId,
          creatorId: SYS_ADMIN_ID, updaterId: SYS_ADMIN_ID,
          createdAt: ct, updatedAt: ut, deletedAt: null, version: 1,
        })
        oldCust2new.set(c.id, Number(r.insertId)); customerCnt++
      }
    })
    console.log(`[import-business] customers: ${customerCnt}`)

    // ---- 4) dispatches -------------------------------------------------------
    await drizzleDb.transaction(async tx => {
      // 孤儿派单（custSynced=false 或 hospSynced=false）跳过不导入，
      // 由 dispMissingRef 统计并打印。这些是源库 FK 约束缺失导致的孤儿（老
      // thinkcmf 删客户/医院未级联删派单），不影响主体数据完整性。
      for (const d of dispatches) {
        const custId = oldCust2new.get(d.custom_id); const hospId = oldHosp2new.get(d.hospital_id)
        if (!custId || !hospId) {
          dispMissingRef++
          continue
        }
        const statusId = DISPATCH_STATUS_MAP[d.status] ?? 1
        const ct = fromUnix(d.create_time) ?? dateUtils.now(); const ft = d.finsh_time ? fromUnix(d.finsh_time) : null
        await tx.insert(crmDispatch).values({
          customerId: custId, hospitalId: hospId, statusId,
          image: ns(d.image), receiveQq: d.receive_qq ? String(d.receive_qq) : null,
          receiveWechat: ns(d.receive_wechat), finishedAt: ft,
          creatorId: SYS_ADMIN_ID, updaterId: SYS_ADMIN_ID,
          createdAt: ct, updatedAt: ct, deletedAt: null, version: 1,
        })
        dispatchCnt++
      }
    })
    console.log(`[import-business] dispatches: ${dispatchCnt} (orphan skipped: ${dispMissingRef})`)
  } finally {
    await src.end().catch(() => {})
    await drizzlePool.end().catch(() => {})
  }

  console.log('\n================ import-business summary ================')
  console.log(`regions    : ${regionCnt}`)
  console.log(`hospitals  : ${hospitalCnt}  accounts: ${hospitalAcctCnt}`)
  console.log(`customers  : ${customerCnt}`)
  console.log(`dispatches : ${dispatchCnt}  orphanSkipped: ${dispMissingRef}`)
  console.log(`failed: ${failed}`)
  if (blockingIssues.length > 0) {
    console.log(`\n[BLOCKED] ${blockingIssues.length} hospital(s) violate 一院一账号:`)
    for (const b of blockingIssues) {
      console.log(`  - hospital#${b.hospitalId} "${b.hospitalName}": ${b.reason}`)
    }
  }
  if (usernameMismatch.length > 0) {
    console.log(`\n[NEEDS-REVIEW] ${usernameMismatch.length} hospital(s) where sys_user.username !== hospital_name:`)
    for (const m of usernameMismatch) {
      console.log(`  - new#${m.newHospitalId} (old#${m.oldHospitalId}) "${m.hospitalName}": username="${m.currentUsername}"`)
    }
  }
  console.log('========================================================')
}

if (require.main === module) {
  main().catch(e => { console.error('[import-business] failed:', e); process.exit(1) })
}
