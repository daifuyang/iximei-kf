import { and, count, desc, eq, gte, isNull, lt, sql } from 'drizzle-orm'
import { drizzleDb, type AppQueryDb } from '@/db'
import {
  crmDispatch,
  crmDispatchViewLog,
  crmHospital,
} from '../db/schema.js'

const active = (t: any) => isNull(t.deletedAt)

function monthStart(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function weekStart(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function dayStart(date = new Date()) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export interface DateRange {
  startDate: Date
  endDate: Date
}

type WhereExtra = (table: any) => any[]

export class DashboardRepository {
  /** 总数（不含软删除）。始终返回全量总数，不受 dateRange 影响。 */
  static async total(
    table: any,
    whereExtra?: WhereExtra,
    _dateRange?: DateRange,
    db: AppQueryDb = drizzleDb,
  ) {
    const c: any[] = [active(table)]
    if (whereExtra) c.push(...whereExtra(table))
    const [r] = await db
      .select({ total: count() })
      .from(table)
      .where(and(...c))
    return Number(r?.total ?? 0)
  }

  /**
   * 统计周期内新增。
   * 半开区间 [startDate, endDate+1day)：包含结束日全天记录。
   */
  static async periodNew(
    table: any,
    whereExtra?: WhereExtra,
    dateRange?: DateRange,
    db: AppQueryDb = drizzleDb,
  ) {
    const start = dateRange?.startDate ?? monthStart()
    const end = dateRange?.endDate ?? new Date()
    // 半开区间：< endDate 次日 00:00:00
    const endUpper = new Date(end.getTime() + 86400000)
    endUpper.setHours(0, 0, 0, 0)
    const c: any[] = [
      active(table),
      gte(table.createdAt, start),
      lt(table.createdAt, endUpper),
    ]
    if (whereExtra) c.push(...whereExtra(table))
    const [r] = await db
      .select({ total: count() })
      .from(table)
      .where(and(...c))
    return Number(r?.total ?? 0)
  }

  /** @deprecated 使用 periodNew 替代 */
  static async monthNew(
    table: any,
    whereExtra?: WhereExtra,
    dateRange?: DateRange,
    db: AppQueryDb = drizzleDb,
  ) {
    return DashboardRepository.periodNew(table, whereExtra, dateRange, db)
  }

  /** @deprecated 使用 periodNew 替代 */
  static async weekNew(
    table: any,
    whereExtra?: WhereExtra,
    dateRange?: DateRange,
    db: AppQueryDb = drizzleDb,
  ) {
    if (dateRange) return DashboardRepository.periodNew(table, whereExtra, dateRange, db)
    const c: any[] = [active(table), gte(table.createdAt, weekStart())]
    if (whereExtra) c.push(...whereExtra(table))
    const [r] = await db
      .select({ total: count() })
      .from(table)
      .where(and(...c))
    return Number(r?.total ?? 0)
  }

  /** @deprecated 使用 periodNew 替代 */
  static async dayNew(
    table: any,
    whereExtra?: WhereExtra,
    dateRange?: DateRange,
    db: AppQueryDb = drizzleDb,
  ) {
    if (dateRange) return DashboardRepository.periodNew(table, whereExtra, dateRange, db)
    const c: any[] = [active(table), gte(table.createdAt, dayStart())]
    if (whereExtra) c.push(...whereExtra(table))
    const [r] = await db
      .select({ total: count() })
      .from(table)
      .where(and(...c))
    return Number(r?.total ?? 0)
  }

  /**
   * 统计周期内完成数（派单专用：finishedAt 在范围内）。
   * 半开区间 [startDate, endDate+1day)：包含结束日全天完成记录。
   */
  static async periodCompleted(
    table: any,
    whereExtra?: WhereExtra,
    dateRange?: DateRange,
    db: AppQueryDb = drizzleDb,
  ) {
    const start = dateRange?.startDate ?? monthStart()
    const end = dateRange?.endDate ?? new Date()
    const endUpper = new Date(end.getTime() + 86400000)
    endUpper.setHours(0, 0, 0, 0)
    const c: any[] = [
      active(table),
      gte(table.finishedAt, start),
      lt(table.finishedAt, endUpper),
    ]
    if (whereExtra) c.push(...whereExtra(table))
    const [r] = await db
      .select({ total: count() })
      .from(table)
      .where(and(...c))
    return Number(r?.total ?? 0)
  }

  /** @deprecated 使用 periodCompleted 替代 */
  static async monthCompleted(
    table: any,
    whereExtra?: WhereExtra,
    dateRange?: DateRange,
    db: AppQueryDb = drizzleDb,
  ) {
    return DashboardRepository.periodCompleted(table, whereExtra, dateRange, db)
  }

  /**
   * 按类型统计（状态分布）。
   * 若提供 dateRange 则仅统计该时间范围内创建的记录（半开区间）。
   */
  static async byStatus(
    table: any,
    statusTable: any,
    statusNameField: any,
    fkColumn: any,
    whereExtra?: WhereExtra,
    dateRange?: DateRange,
    db: AppQueryDb = drizzleDb,
  ) {
    const c: any[] = [active(table)]
    if (dateRange) {
      const endUpper = new Date(dateRange.endDate.getTime() + 86400000)
      endUpper.setHours(0, 0, 0, 0)
      c.push(gte(table.createdAt, dateRange.startDate))
      c.push(lt(table.createdAt, endUpper))
    }
    if (whereExtra) c.push(...whereExtra(table))
    const rows = await db
      .select({
        name: statusNameField,
        count: count(),
      })
      .from(table)
      .innerJoin(statusTable, eq(fkColumn, statusTable.id))
      .where(and(...c))
      .groupBy(statusTable.id)
      .orderBy(statusTable.sortOrder)
    return rows.map((r) => ({
      name: r.name,
      count: Number(r.count),
    }))
  }

  /** 月度趋势。若提供 dateRange，按自然月拆分该范围；否则回退到近 N 个月。半开区间 upper bound。 */
  static async monthlyTrend(
    table: any,
    months = 12,
    whereExtra?: WhereExtra,
    dateRange?: DateRange,
    db: AppQueryDb = drizzleDb,
  ) {
    const now = new Date()
    const rangeStart = dateRange?.startDate
      ?? new Date(now.getFullYear(), now.getMonth() - months + 1, 1)
    const rangeEnd = dateRange?.endDate ?? now
    const endUpper = new Date(rangeEnd.getTime() + 86400000)
    endUpper.setHours(0, 0, 0, 0)

    const c: any[] = [active(table), gte(table.createdAt, rangeStart), lt(table.createdAt, endUpper)]
    if (whereExtra) c.push(...whereExtra(table))

    const rows = await db
      .select({
        year: sql`YEAR(${table.createdAt})`,
        month: sql`MONTH(${table.createdAt})`,
        count: count(),
      })
      .from(table)
      .where(and(...c))
      .groupBy(sql`YEAR(${table.createdAt})`, sql`MONTH(${table.createdAt})`)
      .orderBy(sql`YEAR(${table.createdAt}) ASC, MONTH(${table.createdAt}) ASC`)

    // 填充空白月份
    const map = new Map<string, number>()
    for (const r of rows) {
      const key = `${String(r.year).padStart(4, '0')}-${String(r.month).padStart(2, '0')}`
      map.set(key, Number(r.count))
    }

    // 计算需要生成的月份数
    const trendMonths = dateRange
      ? (rangeEnd.getFullYear() - rangeStart.getFullYear()) * 12 +
        (rangeEnd.getMonth() - rangeStart.getMonth()) + 1
      : months

    const result: { month: string; count: number }[] = []
    for (let i = trendMonths - 1; i >= 0; i--) {
      const d = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      result.push({
        month: key,
        count: map.get(key) ?? 0,
      })
    }
    return result
  }

  /** 客户启用数量（status=1）。若提供 dateRange 则仅统计该时间范围内创建的记录（半开区间）。 */
  static async activeHospitals(
    whereExtra?: WhereExtra,
    dateRange?: DateRange,
    db: AppQueryDb = drizzleDb,
  ) {
    const c: any[] = [active(crmHospital), eq(crmHospital.status, 1)]
    if (dateRange) {
      const endUpper = new Date(dateRange.endDate.getTime() + 86400000)
      endUpper.setHours(0, 0, 0, 0)
      c.push(gte(crmHospital.createdAt, dateRange.startDate))
      c.push(lt(crmHospital.createdAt, endUpper))
    }
    if (whereExtra) c.push(...whereExtra(crmHospital))
    const [r] = await db
      .select({ total: count() })
      .from(crmHospital)
      .where(and(...c))
    return Number(r?.total ?? 0)
  }

  /**
   * 医院效率榜。
   *
   * 按医院聚合：
   * - dispatchCount：未软删除派单数
   * - viewedCount：crm_dispatch_view_log 中该医院被查看过的派单数（distinct dispatch）
   *   用 SUM(CASE WHEN view_log.id IS NOT NULL) 在 LEFT JOIN 后统计
   * - replyCount：该医院所有派单对应的回复数（子查询）
   * - firstViewedAt：该医院最早一次查看时间（MIN）
   *
   * 派生字段：
   * - unviewedCount = max(0, dispatchCount - viewedCount)
   * - viewedRate = (viewedCount / dispatchCount) * 100，保留 1 位小数
   *
   * 排序：dispatchCount DESC；limit 默认 10。
   *
   * 注：本方法不应用角色数据范围过滤 —— 排行榜数据维度由调用方（service 层）
   * 决定如何约束访问范围。当前任务（T1）仅实现基础聚合。
   */
  static async getHospitalRankings(limit = 10) {
    const rows = await drizzleDb
      .select({
        hospitalId: crmHospital.id,
        hospitalName: crmHospital.hospitalName,
        dispatchCount: count(crmDispatch.id),
        viewedCount: sql<number>`SUM(CASE WHEN ${crmDispatchViewLog.id} IS NOT NULL THEN 1 ELSE 0 END)`,
        replyCount: sql<number>`(SELECT COUNT(*) FROM crm_dispatch_reply r WHERE r.dispatch_id IN (SELECT id FROM crm_dispatch WHERE hospital_id = ${crmHospital.id} AND deleted_at IS NULL))`,
        firstViewedAt: sql<Date | null>`MIN(${crmDispatchViewLog.createdAt})`,
      })
      .from(crmHospital)
      .leftJoin(
        crmDispatch,
        and(eq(crmDispatch.hospitalId, crmHospital.id), active(crmDispatch)),
      )
      .leftJoin(crmDispatchViewLog, eq(crmDispatchViewLog.hospitalId, crmHospital.id))
      .where(active(crmHospital))
      .groupBy(crmHospital.id, crmHospital.hospitalName)
      .orderBy(desc(count(crmDispatch.id)))
      .limit(limit)

    return rows.map((r: any) => {
      const dispatchCount = Number(r.dispatchCount ?? 0)
      const viewedCount = Number(r.viewedCount ?? 0)
      return {
        hospitalId: Number(r.hospitalId),
        hospitalName: r.hospitalName,
        dispatchCount,
        viewedCount,
        unviewedCount: Math.max(0, dispatchCount - viewedCount),
        replyCount: Number(r.replyCount ?? 0),
        firstViewedAt:
          r.firstViewedAt instanceof Date ? r.firstViewedAt.toISOString() : null,
        viewedRate:
          dispatchCount > 0
            ? Number(((viewedCount / dispatchCount) * 100).toFixed(1))
            : 0,
      }
    })
  }

  /**
   * 按城市分组的医院分类分布（口腔 / 整形）。
   *
   * 聚合维度：province.code / province.name / city.code / city.name。
   * - oralCount   = category = 'oral' 的医院数
   * - plasticCount = category = 'plastic' 的医院数
   * - total       = 该城市所有未软删除医院数（含 category = NULL 的"未分类"医院）
   *
   * 排序：total DESC。
   *
   * sys_region 是 Core 表。用 `sql` 模板拼 cross-table join
   * （drizzle-orm/mysql-core 的跨 schema join 较繁琐），并对 city/province
   * 别名做字段重投影，保持调用方类型稳定。
   */
  static async getHospitalDistributionByCity() {
    const rows: any = await drizzleDb
      .select({
        provinceCode: sql<number>`province.code`,
        provinceName: sql<string>`province.name`,
        cityCode: sql<number>`city.code`,
        cityName: sql<string>`city.name`,
        oralCount: sql<number>`SUM(CASE WHEN ${crmHospital.category} = 'oral' THEN 1 ELSE 0 END)`,
        plasticCount: sql<number>`SUM(CASE WHEN ${crmHospital.category} = 'plastic' THEN 1 ELSE 0 END)`,
        total: sql<number>`COUNT(*)`,
      })
      .from(crmHospital)
      .leftJoin(sql`sys_region city`, sql`city.code = ${crmHospital.cityId}`)
      .leftJoin(sql`sys_region province`, sql`province.code = ${crmHospital.provinceId}`)
      .where(isNull(crmHospital.deletedAt))
      .groupBy(sql`city.code`, sql`city.name`, sql`province.code`, sql`province.name`)
      .orderBy(sql`COUNT(*) DESC`)

    return rows.map((r: any) => ({
      provinceCode: Number(r.provinceCode ?? 0),
      provinceName: String(r.provinceName ?? ''),
      cityCode: Number(r.cityCode ?? 0),
      cityName: String(r.cityName ?? ''),
      oralCount: Number(r.oralCount ?? 0),
      plasticCount: Number(r.plasticCount ?? 0),
      total: Number(r.total ?? 0),
    }))
  }
}
