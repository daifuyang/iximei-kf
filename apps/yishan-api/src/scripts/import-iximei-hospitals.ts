import 'dotenv/config'
import { createPool } from 'mysql2/promise'
import { drizzleDb, pool as drizzlePool } from '@/db'
import { sysRegion } from '@/db/schema'
import { crmHospital, crmHospitalAccount, crmCustomer, crmDispatch } from '@/modules/crm/db/schema'
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
type OldUserRef = { oldId: number; userLogin: string; hospitalId: number | null }
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
  let skipped = 0, failed = 0

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
      q<OldUserRef>(src, 'SELECT id oldId,user_login userLogin,hospital_id hospitalId FROM hj_user'),
      q<OldCustom>(src, `SELECT id,number_id,name,birthday,customer_userid,plastic,gender,
        province,city,district,address,telphone,mobile,qq,wechat,create_time,update_time,status
        FROM hj_custom ORDER BY id`),
      q<OldDispatch>(src, `SELECT id,custom_id,hospital_id,receive_qq,receive_wechat,
        create_time,finsh_time,status,image FROM hj_dispatch ORDER BY id`),
    ])
    console.log(`[import-business] loaded: regions=${regions.length} hosps=${hospitals.length} users=${userRefs.length} customs=${customs.length} dispatches=${dispatches.length}`)

    // ---- old→new user mapping (via username) ---------------------------------
    const targetUsers = await drizzleDb.query.sysUser.findMany({
      columns: { id: true, username: true },
      where: (f, { isNull }) => isNull(f.deletedAt),
    })
    const uname2id = new Map(targetUsers.map(u => [u.username!, u.id]))
    const oldUid2new = new Map<number, number>()
    for (const r of userRefs) { const nid = uname2id.get(r.userLogin); if (nid) oldUid2new.set(r.oldId, nid) }
    console.log(`[import-business] user mapping: ${oldUid2new.size}`)

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

    // ---- 2) hospitals + accounts ---------------------------------------------
    const oldHosp2new = new Map<number, number>()
    await drizzleDb.transaction(async tx => {
      const now = dateUtils.now()
      for (const h of hospitals) {
        let acctUid: number | null = null
        for (const r of userRefs) { if (r.hospitalId === h.id) { const nu = oldUid2new.get(r.oldId); if (nu) acctUid = nu; break } }
        const ct = fromUnix(h.create_time) ?? now; const ut = fromUnix(h.update_time) ?? now
        try {
          const [r] = await tx.insert(crmHospital).values({
            accountUserId: acctUid, hospitalName: h.hospital_name,
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
          oldHosp2new.set(h.id, Number(r.insertId)); hospitalCnt++
          if (acctUid) {
            try {
              await tx.insert(crmHospitalAccount).values({
                hospitalId: Number(r.insertId), userId: acctUid, role: 'member', status: 1,
                creatorId: SYS_ADMIN_ID, updaterId: SYS_ADMIN_ID,
                createdAt: now, updatedAt: now, deletedAt: null,
              })
              hospitalAcctCnt++
            } catch (e: any) { if (!String(e?.message ?? '').includes('Duplicate')) failed++ }
          }
        } catch (e: any) {
          const m = String(e?.message ?? '') + String(e?.cause?.message ?? '')
          if (m.includes('Duplicate')) skipped++
          else { console.error(`hospital ${h.hospital_name} fail:`, e?.message); failed++ }
        }
      }
    })
    console.log(`[import-business] hospitals: ${hospitalCnt} accounts: ${hospitalAcctCnt}`)

    // ---- 3) customers (status_id = old status id, CRM 名称一一对应) ----------
    const oldCust2new = new Map<number, number>()
    await drizzleDb.transaction(async tx => {
      for (const c of customs) {
        const ownerId = oldUid2new.get(c.customer_userid) ?? SYS_ADMIN_ID
        const bday = fromUnix(c.birthday); const ct = fromUnix(c.create_time) ?? dateUtils.now()
        const ut = fromUnix(c.update_time) ?? ct
        try {
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
        } catch (e: any) {
          const m = String(e?.message ?? '') + String(e?.cause?.message ?? '')
          if (m.includes('Duplicate')) skipped++
          else { console.error(`customer ${c.id} fail:`, e?.message); failed++ }
        }
      }
    })
    console.log(`[import-business] customers: ${customerCnt}`)

    // ---- 4) dispatches -------------------------------------------------------
    let dispSkipped = 0
    await drizzleDb.transaction(async tx => {
      for (const d of dispatches) {
        const custId = oldCust2new.get(d.custom_id); const hospId = oldHosp2new.get(d.hospital_id)
        if (!custId || !hospId) { dispSkipped++; continue }
        const statusId = DISPATCH_STATUS_MAP[d.status] ?? 1
        const ct = fromUnix(d.create_time) ?? dateUtils.now(); const ft = d.finsh_time ? fromUnix(d.finsh_time) : null
        try {
          await tx.insert(crmDispatch).values({
            customerId: custId, hospitalId: hospId, statusId,
            image: ns(d.image), receiveQq: d.receive_qq ? String(d.receive_qq) : null,
            receiveWechat: ns(d.receive_wechat), finishedAt: ft,
            creatorId: SYS_ADMIN_ID, updaterId: SYS_ADMIN_ID,
            createdAt: ct, updatedAt: ct, deletedAt: null, version: 1,
          })
          dispatchCnt++
        } catch (e: any) {
          if (String(e?.message ?? '').includes('Duplicate')) dispSkipped++
          else { console.error(`dispatch ${d.id} fail:`, e?.message); failed++ }
        }
      }
    })
    console.log(`[import-business] dispatches: ${dispatchCnt} skippedMissingRef: ${dispSkipped}`)
  } finally {
    await src.end().catch(() => {})
    await drizzlePool.end().catch(() => {})
  }

  console.log('\n================ import-business summary ================')
  console.log(`regions    : ${regionCnt}`)
  console.log(`hospitals  : ${hospitalCnt}  accounts: ${hospitalAcctCnt}`)
  console.log(`customers  : ${customerCnt}`)
  console.log(`dispatches : ${dispatchCnt}`)
  console.log(`skipped/failed: ${skipped}/${failed}`)
  console.log('========================================================')
}

if (require.main === module) {
  main().catch(e => { console.error('[import-business] failed:', e); process.exit(1) })
}
