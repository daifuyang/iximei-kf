/**
 * 用最新行政区划数据 (modood/Administrative-divisions-of-China) 替换 sys_region,
 * 然后将 crm_hospital / crm_customer 的旧 region 代码对齐到新代码。
 *
 * 用法: pnpm build:ts && node dist/scripts/update-regions.js
 * 上线后删除.
 */
import 'dotenv/config'
import { drizzleDb, pool as drizzlePool } from '@/db'
import { sysRegion } from '@/db/schema'
import { crmHospital, crmCustomer } from '@/modules/crm/db/schema'
import { eq, isNotNull, or } from 'drizzle-orm'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { dateUtils } from '../utils/date.js'

// ---- 最新区划数据路径 (clone 自 modood/Administrative-divisions-of-China) ----
const DIST_DIR = process.env.REGION_DIST_DIR ?? '/tmp/Administrative-divisions-of-China/dist'

type NewRegion = { code: string; name: string; provinceCode?: string; cityCode?: string }
type RegionRow = { code: number; name: string; level: number; parentCode: number }

function loadJson(path: string) {
  return JSON.parse(readFileSync(join(DIST_DIR, path), 'utf-8')) as NewRegion[]
}

/**
 * 标准化为 6 位 int: province "13"→130000, city "1301"→130100, district "130102"→130102
 */
function normalCode(raw: string, level: number): number {
  const s = raw.padEnd(6, '0')
  return parseInt(s, 10)
}

async function main() {
  console.log('[update-regions] start')

  // 1) 加载最新区划
  const provinces = loadJson('provinces.json')
  const cities = loadJson('cities.json')
  const areas = loadJson('areas.json')
  console.log(`[update-regions] loaded: provinces=${provinces.length} cities=${cities.length} areas=${areas.length}`)

  // 2) 构建新 region 行 + normalized code 集合 (按层级顺序,用于去重直管市)
  const rows: RegionRow[] = []
  const newCodeSet = new Set<number>()
  const now = dateUtils.now()

  for (const p of provinces) {
    const code = normalCode(p.code, 1)
    rows.push({ code, name: p.name, level: 1, parentCode: 0 })
    newCodeSet.add(code)
  }
  for (const c of cities) {
    const code = normalCode(c.code, 2)
    const parentCode = normalCode(c.provinceCode!, 1)
    rows.push({ code, name: c.name, level: 2, parentCode })
    newCodeSet.add(code)
  }
  for (const a of areas) {
    const code = normalCode(a.code, 3)
    // 跳过与 city 层级代码重复的直管市(东莞/中山/儋州),城市优先
    if (newCodeSet.has(code)) continue
    const parentCode = normalCode(a.cityCode!, 2)
    rows.push({ code, name: a.name, level: 3, parentCode })
    newCodeSet.add(code)
  }
  console.log(`[update-regions] normalized rows: ${rows.length}`)

  // 3) 构建 old→new code 映射
  // 老库 hj_region 的 area_type 字段不可靠(530100 标成 1=province 实际是 city)
  // 改用 code 结构推断层级:
  //   code % 10000 == 0     → province (XX0000)
  //   code % 100 == 0       → city (XXXX00)
  //   else                  → district (XXXXXX)
  const oldRegions = await drizzleDb.query.sysRegion.findMany({
    columns: { code: true, name: true },
  })

  function inferLevel(code: number): number {
    if (code % 10000 === 0) return 1
    if (code % 100 === 0) return 2
    return 3
  }

  const old2new = new Map<number, number>()
  let directMatch = 0, nameMatch = 0, unmapped = 0

  for (const old of oldRegions) {
    const inferredLevel = inferLevel(old.code)
    // 直接 code 匹配 (level 不一致时用推断值)
    if (newCodeSet.has(old.code)) {
      old2new.set(old.code, old.code)
      directMatch++
      continue
    }
    // 名称+推断层级匹配
    const match = rows.find(r => r.level === inferredLevel && r.name === old.name)
    if (match) {
      old2new.set(old.code, match.code)
      nameMatch++
      continue
    }
    unmapped++
    if (unmapped <= 20) console.warn(`[update-regions] unmapped: code=${old.code} name=${old.name} inferredLevel=${inferredLevel}`)
  }
  console.log(`[update-regions] mapping: direct=${directMatch} name=${nameMatch} unmapped=${unmapped}`)

  // 4) 替换 sys_region (先清空,分批插入)
  await drizzleDb.delete(sysRegion)
  console.log('[update-regions] old regions deleted')
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100).map(r => ({
      code: r.code, name: r.name, level: r.level,
      parentCode: r.parentCode, sortOrder: 0, status: 1,
      createdAt: now, updatedAt: now,
    }))
    await drizzleDb.insert(sysRegion).values(batch)
    if (i % 1000 === 0) console.log(`[update-regions] regions inserted: ${i}/${rows.length}`)
  }
  console.log(`[update-regions] sys_region replaced: ${rows.length} rows`)

  // 5) 更新 crm_hospital + crm_customer 的 region 引用
  let hospUpdated = 0, hospNulled = 0
  let custUpdated = 0, custNulled = 0

  const allHospitals = await drizzleDb
    .select({ id: crmHospital.id, provinceId: crmHospital.provinceId, cityId: crmHospital.cityId, districtId: crmHospital.districtId })
    .from(crmHospital)
    .where(or(
      isNotNull(crmHospital.provinceId),
      isNotNull(crmHospital.cityId),
      isNotNull(crmHospital.districtId),
    ))

  for (const h of allHospitals) {
    const updates: Record<string, number | null> = {}
    if (h.provinceId) {
      updates.provinceId = old2new.get(h.provinceId) ?? null
      if (!updates.provinceId) hospNulled++
    }
    if (h.cityId) {
      updates.cityId = old2new.get(h.cityId) ?? null
      if (!updates.cityId) hospNulled++
    }
    if (h.districtId) {
      updates.districtId = old2new.get(h.districtId) ?? null
      if (!updates.districtId) hospNulled++
    }
    if (Object.keys(updates).length) {
      await drizzleDb.update(crmHospital).set(updates).where(eq(crmHospital.id, h.id))
      hospUpdated++
    }
  }
  console.log(`[update-regions] hospitals: updated=${hospUpdated} fields-nulled=${hospNulled}`)

  const allCustomers = await drizzleDb
    .select({ id: crmCustomer.id, provinceId: crmCustomer.provinceId, cityId: crmCustomer.cityId, districtId: crmCustomer.districtId })
    .from(crmCustomer)
    .where(or(
      isNotNull(crmCustomer.provinceId),
      isNotNull(crmCustomer.cityId),
      isNotNull(crmCustomer.districtId),
    ))

  for (const c of allCustomers) {
    const updates: Record<string, number | null> = {}
    if (c.provinceId) {
      updates.provinceId = old2new.get(c.provinceId) ?? null
      if (!updates.provinceId) custNulled++
    }
    if (c.cityId) {
      updates.cityId = old2new.get(c.cityId) ?? null
      if (!updates.cityId) custNulled++
    }
    if (c.districtId) {
      updates.districtId = old2new.get(c.districtId) ?? null
      if (!updates.districtId) custNulled++
    }
    if (Object.keys(updates).length) {
      await drizzleDb.update(crmCustomer).set(updates).where(eq(crmCustomer.id, c.id))
      custUpdated++
    }
  }
  console.log(`[update-regions] customers: updated=${custUpdated} fields-nulled=${custNulled}`)

  await drizzlePool.end().catch(() => {})
  console.log('\n================ update-regions summary ================')
  console.log(`sys_region    : ${rows.length} rows (latest GB/T 2260)`)
  console.log(`old→new map   : ${old2new.size} entries (${unmapped} unmapped)`)
  console.log(`hospitals     : ${hospUpdated} updated, ${hospNulled} nulled`)
  console.log(`customers     : ${custUpdated} updated, ${custNulled} nulled`)
  console.log('========================================================')
}

if (require.main === module) {
  main().catch(e => { console.error('[update-regions] failed:', e); process.exit(1) })
}
