import { and, asc, count, desc, eq, gte, inArray, isNull, like, lte, or } from 'drizzle-orm'
import { drizzleDb } from '@/db'
import { crmCustomer, crmDispatch, crmDispatchFollowLog, crmDispatchReply, crmDispatchStatus, crmHospital } from '../db/schema.js'

const active = (t: any) => isNull(t.deletedAt)
const page = (q: any, p: any) =>
  p.pageSize === 0 ? q : q.limit(p.pageSize).offset((p.page - 1) * p.pageSize)

export class DispatchesRepository {
  /**
   * q 支持的字段:
   *   statusId, hospitalIds, customerOwnerUserIds, startTime, endTime, keyword,
   *   page, pageSize（分页）,
   *
   * - customerOwnerUserIds: 在 WHERE 上注入 `customer_id IN (...customerId where owner = ?)`，
   *   用于客服 SELF 隔离（只看到自己添加的客户的派单）。
   */
  static async list(q: any) {
    const c: any[] = [active(crmDispatch)]

    if (q.statusId) c.push(eq(crmDispatch.statusId, q.statusId))
    if (q.hospitalIds?.length) c.push(inArray(crmDispatch.hospitalId, q.hospitalIds))
    if (q.customerOwnerUserIds?.length) {
      // 先取这些 owner 创建的 customerId,再把 dispatch 限定到这些 customer
      const customerIds = await drizzleDb
        .select({ id: crmCustomer.id })
        .from(crmCustomer)
        .where(and(active(crmCustomer), inArray(crmCustomer.ownerUserId, q.customerOwnerUserIds)))
      const ids = customerIds.map((x) => x.id)
      c.push(ids.length ? inArray(crmDispatch.customerId, ids) : eq(crmDispatch.id, -1))
    }
    if (q.startTime) c.push(gte(crmDispatch.createdAt, new Date(q.startTime)))
    if (q.endTime) c.push(lte(crmDispatch.createdAt, new Date(q.endTime)))
    if (q.keyword) {
      const cs = await drizzleDb
        .select({ id: crmCustomer.id })
        .from(crmCustomer)
        .where(
          or(
            like(crmCustomer.mobile, `%${q.keyword}%`),
            like(crmCustomer.name, `%${q.keyword}%`),
            like(crmCustomer.numberId, `%${q.keyword}%`),
          )!,
        )
      const hs = await drizzleDb
        .select({ id: crmHospital.id })
        .from(crmHospital)
        .where(like(crmHospital.hospitalName, `%${q.keyword}%`))
      c.push(
        or(
          inArray(crmDispatch.customerId, cs.length ? cs.map((x) => x.id) : [-1]),
          inArray(crmDispatch.hospitalId, hs.length ? hs.map((x) => x.id) : [-1]),
        )!,
      )
    }

    const where = and(...c)
    const [items, totals] = await Promise.all([
      page(drizzleDb.select().from(crmDispatch).where(where).orderBy(desc(crmDispatch.createdAt)), q),
      drizzleDb.select({ total: count() }).from(crmDispatch).where(where),
    ])
    return {
      list: await Promise.all(items.map((x) => this.findById(x.id))),
      total: Number(totals[0]?.total ?? 0),
    }
  }

  static async findById(id: number) {
    const [d] = await drizzleDb
      .select()
      .from(crmDispatch)
      .where(and(eq(crmDispatch.id, id), active(crmDispatch)))
      .limit(1)
    if (!d) return null
    const [customer] = await drizzleDb
      .select()
      .from(crmCustomer)
      .where(eq(crmCustomer.id, d.customerId))
      .limit(1)
    const [hospital] = await drizzleDb
      .select()
      .from(crmHospital)
      .where(eq(crmHospital.id, d.hospitalId))
      .limit(1)
    const [status] = await drizzleDb
      .select()
      .from(crmDispatchStatus)
      .where(eq(crmDispatchStatus.id, d.statusId))
      .limit(1)
    const replies = await drizzleDb
      .select()
      .from(crmDispatchReply)
      .where(eq(crmDispatchReply.dispatchId, id))
      .orderBy(asc(crmDispatchReply.createdAt))
    const logs = await drizzleDb
      .select()
      .from(crmDispatchFollowLog)
      .where(eq(crmDispatchFollowLog.dispatchId, id))
      .orderBy(asc(crmDispatchFollowLog.createdAt))
    return { ...d, customer: customer ?? null, hospital: hospital ?? null, status: status ?? null, replies, logs }
  }

  static listStatuses() {
    return drizzleDb
      .select()
      .from(crmDispatchStatus)
      .where(eq(crmDispatchStatus.status, 1))
      .orderBy(asc(crmDispatchStatus.sortOrder))
  }

  static async update(id: number, input: any) {
    await drizzleDb.update(crmDispatch).set(input).where(eq(crmDispatch.id, id))
    return this.findById(id)
  }

  static async reply(id: number, input: any, userId: number, content?: string) {
    return drizzleDb.transaction(async (tx) => {
      if (Object.keys(input).length)
        await tx.update(crmDispatch).set(input).where(eq(crmDispatch.id, id))
      if (content)
        return tx.insert(crmDispatchReply).values({ dispatchId: id, userId, content })
      const [row] = await tx.select().from(crmDispatch).where(eq(crmDispatch.id, id)).limit(1)
      return row
    })
  }

  static addLog(id: number, userId: number, content: string) {
    return drizzleDb.insert(crmDispatchFollowLog).values({ dispatchId: id, userId, content })
  }
}
export { active }
