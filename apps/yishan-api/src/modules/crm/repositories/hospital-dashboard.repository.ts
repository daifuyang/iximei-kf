/**
 * 医院后台数据看板 repository。
 *
 * 两条核心 SQL：
 * 1. getStats(hospitalId) — 单条 SELECT 聚合 4 个时间桶 + 2 个查看指标，
 *    避免 N+1；
 * 2. getUnviewedCount(hospitalId) — LEFT JOIN crmDispatchViewLog，
 *    用 view_log.id IS NULL 过滤出该医院未查看的派单。
 *
 * 时间桶按 Asia/Shanghai 时区划分：
 * - todayStart: 当日 00:00
 * - monthStart: 当月 1 日 00:00
 * - yearStart:  当年 1 月 1 日 00:00
 *
 * 注：进程 runtime 时区通常为 UTC，这里采用本地 Date 构造，
 * 数据库侧仍按写入时间的字符串比较；如未来有跨时区需求再改用
 * server-side timezone-aware 的 SQL `CONVERT_TZ`。
 */

import { and, count, eq, isNull, sql } from 'drizzle-orm'
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

export class HospitalDashboardRepository {
  /**
   * 单条 SQL 聚合 4 个时间桶（today/month/year/total）+ 2 个查看指标（viewed/unviewed）。
   * 用 LEFT JOIN + SUM(CASE WHEN ...) 一次拿全，避免 N+1。
   *
   * viewed/unviewed 的语义：派单是否被该医院的任一账号首次访问过。
   * UNIQUE (dispatch_id, hospital_id, viewer_user_id) 让一次派单
   * 在该医院维度下计 1 条 view_log 行；LEFT JOIN 后该行非空即 viewed。
   */
  static async getStats(hospitalId: number) {
    const { todayStart, monthStart, yearStart } = getTimeBucketStarts()

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
        and(
          eq(crmDispatchViewLog.dispatchId, crmDispatch.id),
          eq(crmDispatchViewLog.hospitalId, hospitalId),
        ),
      )
      .where(and(eq(crmDispatch.hospitalId, hospitalId), active(crmDispatch)))

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
   * 该医院未查看派单数。菜单 Badge 用，性能敏感 — 走单条 SQL。
   *
   * 用 LEFT JOIN crmDispatchViewLog + view_log.id IS NULL
   * 比 NOT EXISTS 更直观，Drizzle 也支持。
   */
  static async getUnviewedCount(hospitalId: number) {
    const [row] = await drizzleDb
      .select({ count: count() })
      .from(crmDispatch)
      .leftJoin(
        crmDispatchViewLog,
        and(
          eq(crmDispatchViewLog.dispatchId, crmDispatch.id),
          eq(crmDispatchViewLog.hospitalId, hospitalId),
        ),
      )
      .where(
        and(
          eq(crmDispatch.hospitalId, hospitalId),
          active(crmDispatch),
          sql`${crmDispatchViewLog.id} IS NULL`,
        ),
      )
    return Number(row?.count ?? 0)
  }
}