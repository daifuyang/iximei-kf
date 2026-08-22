/**
 * 医院后台数据看板 repository。
 *
 * 三条核心 SQL：
 * 1. getStats(hospitalIds, startDate?, endDate?)
 *    — 单条 SELECT 聚合 4 个时间桶 + 2 个查看指标；hospitalIds 是数组：
 *      [单一医院] = 单院；[全院 ids] = 全院汇总（避免 N+1）。
 * 2. getUnviewedCount(hospitalIds) — 同上结构。
 * 3. getTrend(hospitalIds, days, startDate?, endDate?)
 *    — 日期分布 + viewed/unviewed 总览。
 *
 * 时间桶按 Asia/Shanghai 时区划分：
 * - todayStart: 当日 00:00
 * - monthStart: 当月 1 日 00:00
 * - yearStart:  当年 1 月 1 日 00:00
 * - (可选) startDate/endDate: 用户筛选窗口，闭区间 [startDate 0:00, endDate+1 0:00)
 *
 * 注：进程 runtime 时区通常为 UTC，这里采用本地 Date 构造，
 * 数据库侧仍按写入时间的字符串比较；如未来有跨时区需求再改用
 * server-side timezone-aware 的 SQL `CONVERT_TZ`。
 *
 * 注 2：hospitalIds 入参由 service 层负责校验（hospitalAccount 越权检查）。
 */

import { and, count, eq, gte, isNull, lt, sql } from 'drizzle-orm'
import { drizzleDb } from '@/db'
import { crmDispatch, crmDispatchViewLog } from '../db/schema.js'

const active = (t: any) => isNull(t.deletedAt)

/** 在 Asia/Shanghai 时区下构造当日/当月/当年起点。 */
function getTimeBucketStarts(now: Date = new Date()): { todayStart: Date; monthStart: Date; yearStart: Date } {
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const yearStart = new Date(now.getFullYear(), 0, 1)
  return { todayStart, monthStart, yearStart }
}

/**
 * 把 YYYY-MM-DD 字符串转成 Date 对象，endDate + 1 天（下界闭/上界开）。
 * 输入 '2026-08-22' 转 '2026-08-22T00:00:00.000Z' (UTC 0 点)。
 * 非法字符串返回 null，调用方负责忽略。
 */
function parseDateOpt(s: unknown): Date | null {
  if (typeof s !== 'string' || !s.trim()) return null
  // 接受 YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const d = new Date(`${s}T00:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

export class HospitalDashboardRepository {
  /**
   * 单条 SQL 聚合 4 个时间桶（today/month/year/total）+ 2 个查看指标（viewed/unviewed）。
   * 用 LEFT JOIN + SUM(CASE WHEN ...) 一次拿全，避免 N+1。
   *
   * viewed/unviewed 的语义：派单是否被**任一**医院账号首次访问过。
   * view_log 表 schema 在 repo 早期是按 hospital_id 分行（per-dispatch, per-hospital, per-user），
   * 所以要把 view_log 关联回原 dispatch 时 LEFT JOIN 用 dispatch_id 单条件；
   * 多个 hospitalId 的情况下，view_log 依然来自 VIEW 用户表，含义保持。
   *
   * startDate / endDate 是可选日期窗口，闭区间 [startDate 0:00, endDate+1 0:00)。
   */
  static async getStats(hospitalIds: number[], startDate?: string, endDate?: string) {
    if (hospitalIds.length === 0) {
      return {
        todayCount: 0,
        monthCount: 0,
        yearCount: 0,
        totalCount: 0,
        viewedCount: 0,
        unviewedCount: 0,
      }
    }
    const { todayStart, monthStart, yearStart } = getTimeBucketStarts()
    const sd = parseDateOpt(startDate)
    const ed = parseDateOpt(endDate)

    const dateFilter =
      ed !== null
        ? and(gte(crmDispatch.createdAt, sd ?? todayStart), lt(crmDispatch.createdAt, new Date(ed.getTime() + 86400000)))
        : sd !== null
          ? gte(crmDispatch.createdAt, sd)
          : undefined

    const [row] = await drizzleDb
      .select({
        todayCount: sql<number>`SUM(CASE WHEN ${crmDispatch.createdAt} >= ${todayStart} THEN 1 ELSE 0 END)`,
        monthCount: sql<number>`SUM(CASE WHEN ${crmDispatch.createdAt} >= ${monthStart} THEN 1 ELSE 0 END)`,
        yearCount: sql<number>`SUM(CASE WHEN ${crmDispatch.createdAt} >= ${yearStart} THEN 1 ELSE 0 END)`,
        totalCount: count(),
        viewedCount: sql<number>`SUM(CASE WHEN ${crmDispatchViewLog.id} IS NOT NULL THEN 1 ELSE 0 END)`,
        unviewedCount: sql<number>`SUM(CASE WHEN ${crmDispatchViewLog.id} IS NULL THEN 1 ELSE 0 END)`,
      })
      .from(crmDispatch)
      .leftJoin(
        crmDispatchViewLog,
        eq(crmDispatchViewLog.dispatchId, crmDispatch.id),
      )
      .where(
        and(
          // 多医院: hospitalIds 是数组，Drizzle `in()` 走 SQL 'IN (?, ?, ?)'
          sql`${crmDispatch.hospitalId} IN (${sql.join(hospitalIds.map((h) => sql`${h}`), sql`, `)})`,
          active(crmDispatch),
          dateFilter,
        ),
      )

    return {
      todayCount: Number(row?.todayCount ?? 0),
      monthCount: Number(row?.monthCount ?? 0),
      yearCount: Number(row?.yearCount ?? 0),
      totalCount: Number(row?.totalCount ?? 0),
      viewedCount: Number(row?.viewedCount ?? 0),
      unviewedCount: Number(row?.unviewedCount ?? 0),
    }
  }

  /**
   * 该（些）医院未查看派单数。菜单 Badge 用，性能敏感 — 走单条 SQL。
   *
   * 用 LEFT JOIN crmDispatchViewLog + view_log.id IS NULL
   * 比 NOT EXISTS 更直观，Drizzle 也支持。
   */
  static async getUnviewedCount(hospitalIds: number[]) {
    if (hospitalIds.length === 0) return 0
    const [row] = await drizzleDb
      .select({ count: count() })
      .from(crmDispatch)
      .leftJoin(
        crmDispatchViewLog,
        eq(crmDispatchViewLog.dispatchId, crmDispatch.id),
      )
      .where(
        and(
          sql`${crmDispatch.hospitalId} IN (${sql.join(hospitalIds.map((h) => sql`${h}`), sql`, `)})`,
          active(crmDispatch),
          sql`${crmDispatchViewLog.id} IS NULL`,
        ),
      )
    return Number(row?.count ?? 0)
  }

  /**
   * 近 days 天每天的派单量趋势 + 该（些）医院派单的 viewed/unviewed 总览。
   *
   * daily：按 DATE(createdAt) 分组聚合，缺失日补 0；
   * statusBreakdown：复用 getStats 的 LEFT JOIN view_log 模式，
   * 一次拿全 viewed/unviewed 计数，避免 N+1。
   *
   * startDate / endDate 优先级高于 days：当两个都给时忽略 days，用具体区间。
   */
  static async getTrend(
    hospitalIds: number[],
    days = 30,
    startDate?: string,
    endDate?: string,
  ): Promise<{
    daily: Array<{ date: string; count: number }>
    statusBreakdown: { viewed: number; unviewed: number }
  }> {
    if (hospitalIds.length === 0) {
      return {
        daily: [],
        statusBreakdown: { viewed: 0, unviewed: 0 },
      }
    }

    // 1) 生成日期序列（YYYY-MM-DD）
    const dates: string[] = []
    let periodStart: Date
    let periodEndExclusive: Date
    if (startDate && endDate) {
      const sd = parseDateOpt(startDate)
      const ed = parseDateOpt(endDate)
      if (sd && ed && ed >= sd) {
        periodStart = sd
        periodEndExclusive = new Date(ed.getTime() + 86400000)
        for (let d = sd.getTime(); d < periodEndExclusive.getTime(); d += 86400000) {
          dates.push(new Date(d).toISOString().slice(0, 10))
        }
      } else {
        // 非法区段：回退 days
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        periodStart = new Date(today)
        periodStart.setDate(periodStart.getDate() - (days - 1))
        periodEndExclusive = new Date(today.getTime() + 86400000)
        for (let i = days - 1; i >= 0; i--) {
          const d = new Date(today)
          d.setDate(d.getDate() - i)
          dates.push(d.toISOString().slice(0, 10))
        }
      }
    } else {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      periodStart = new Date(today)
      periodStart.setDate(periodStart.getDate() - (days - 1))
      periodEndExclusive = new Date(today.getTime() + 86400000)
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today)
        d.setDate(d.getDate() - i)
        dates.push(d.toISOString().slice(0, 10))
      }
    }

    // 2) 一次 SQL 聚合：按 DATE(createdAt) 分组
    const rawDaily = await drizzleDb
      .select({
        date: sql<string>`DATE(${crmDispatch.createdAt})`,
        count: sql<number>`COUNT(*)`,
      })
      .from(crmDispatch)
      .where(
        and(
          sql`${crmDispatch.hospitalId} IN (${sql.join(hospitalIds.map((h) => sql`${h}`), sql`, `)})`,
          active(crmDispatch),
          gte(crmDispatch.createdAt, periodStart),
          lt(crmDispatch.createdAt, periodEndExclusive),
        ),
      )
      .groupBy(sql`DATE(${crmDispatch.createdAt})`)

    // 3) 缺失日补 0
    const dailyMap = new Map(rawDaily.map((r) => [String(r.date), Number(r.count)]))
    const daily = dates.map((d) => ({ date: d, count: dailyMap.get(d) ?? 0 }))

    // 4) statusBreakdown 复用 LEFT JOIN view_log 模式
    //    与 daily 保持同一日期窗口（periodStart..periodEndExclusive），
    //    否则日期筛选下饼图会显示全量而折线是窗口内，两者不一致。
    const [row] = await drizzleDb
      .select({
        viewed: sql<number>`SUM(CASE WHEN ${crmDispatchViewLog.id} IS NOT NULL THEN 1 ELSE 0 END)`,
        unviewed: sql<number>`SUM(CASE WHEN ${crmDispatchViewLog.id} IS NULL THEN 1 ELSE 0 END)`,
      })
      .from(crmDispatch)
      .leftJoin(
        crmDispatchViewLog,
        eq(crmDispatchViewLog.dispatchId, crmDispatch.id),
      )
      .where(
        and(
          sql`${crmDispatch.hospitalId} IN (${sql.join(hospitalIds.map((h) => sql`${h}`), sql`, `)})`,
          active(crmDispatch),
          gte(crmDispatch.createdAt, periodStart),
          lt(crmDispatch.createdAt, periodEndExclusive),
        ),
      )

    return {
      daily,
      statusBreakdown: {
        viewed: Number(row?.viewed ?? 0),
        unviewed: Number(row?.unviewed ?? 0),
      },
    }
  }
}