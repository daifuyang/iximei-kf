import { and, count, desc, eq, isNull, like, or } from 'drizzle-orm'
import { drizzleDb, type AppQueryDb } from '@/db'
import { crmMemberBrowse, crmMemberCustomer, crmMemberRemark } from '../db/schema.js'
const active=(t:any)=>isNull(t.deletedAt); const page=(q:any,p:any)=>p.pageSize===0?q:q.limit(p.pageSize).offset((p.page-1)*p.pageSize)
export class MembersRepository {
 static async list(q:any){const c:any[]=[active(crmMemberCustomer)];if(q.ownerUserId)c.push(eq(crmMemberCustomer.ownerUserId,q.ownerUserId));if(q.keyword)c.push(or(like(crmMemberCustomer.mobile,`%${q.keyword}%`),like(crmMemberCustomer.name,`%${q.keyword}%`),like(crmMemberCustomer.numberId,`%${q.keyword}%`))!);const where=and(...c);const [items,totals]=await Promise.all([page(drizzleDb.select().from(crmMemberCustomer).where(where).orderBy(desc(crmMemberCustomer.createdAt)),q),drizzleDb.select({total:count()}).from(crmMemberCustomer).where(where)]);return {list:items,total:Number(totals[0]?.total??0)}}
 static findById(id:number){return drizzleDb.select().from(crmMemberCustomer).where(and(eq(crmMemberCustomer.id,id),active(crmMemberCustomer))).limit(1).then(async rows=>rows[0]??null)}
 static async create(input:any,db:AppQueryDb=drizzleDb){const r=await db.insert(crmMemberCustomer).values(input);return this.findById(Number(r[0].insertId))}
 static async update(id:number,input:any){await drizzleDb.update(crmMemberCustomer).set(input).where(eq(crmMemberCustomer.id,id));return this.findById(id)}
 static async nextNumber(){const [r]=await drizzleDb.select({id:crmMemberCustomer.id}).from(crmMemberCustomer).orderBy(desc(crmMemberCustomer.id)).limit(1);return `VIP${String((r?.id??0)+1).padStart(12,'0')}`}
 static addRemark(memberId:number,userId:number,content:string){return drizzleDb.insert(crmMemberRemark).values({memberId,userId,content})}
 static recordBrowse(memberId:number,userId:number){return drizzleDb.insert(crmMemberBrowse).values({memberId,userId,action:'view'})}
}
export { active }
