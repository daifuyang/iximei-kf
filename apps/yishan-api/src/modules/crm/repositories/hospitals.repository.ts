import { and, count, desc, eq, isNull, like, or, ne } from 'drizzle-orm'
import { drizzleDb, type AppQueryDb } from '@/db'
import { crmHospital, crmHospitalAccount } from '../db/schema.js'
import { sysRole, sysUser, sysUserRole } from '@/db/schema'

const HOSPITAL_ACCOUNT_ROLE_CODE = 'hospital_account'
const active = (t: any) => isNull(t.deletedAt)
const page = (q: any, p: any) => p.pageSize === 0 ? q : q.limit(p.pageSize).offset((p.page - 1) * p.pageSize)
export class HospitalsRepository {
 static async list(query:any, db:AppQueryDb=drizzleDb) { const c:any[]=[active(crmHospital)]; if(query.status!==undefined)c.push(eq(crmHospital.status,Number(query.status))); if(query.keyword)c.push(or(like(crmHospital.hospitalName,`%${query.keyword}%`),like(crmHospital.hospitalPhone,`%${query.keyword}%`),like(crmHospital.hospitalSelling,`%${query.keyword}%`))!); const where=and(...c); const [items,totals]=await Promise.all([page(db.select().from(crmHospital).where(where).orderBy(desc(crmHospital.createdAt)),query),db.select({total:count()}).from(crmHospital).where(where)]); return {list:items,total:Number(totals[0]?.total??0)} }
 static async findById(id:number,db:AppQueryDb=drizzleDb){const [r]=await db.select().from(crmHospital).where(and(eq(crmHospital.id,id),active(crmHospital))).limit(1); return r??null}
 static async create(input:any,db:AppQueryDb=drizzleDb){const r=await db.insert(crmHospital).values(input);return this.findById(Number(r[0].insertId),db)}
 static async update(id:number,input:any,db:AppQueryDb=drizzleDb){await db.update(crmHospital).set(input).where(eq(crmHospital.id,id));return this.findById(id,db)}
 static bindWechatOpenid(id:number,openid:string){return this.update(id,{wechatOpenid:openid})}
 static async findAccount(hospitalId:number,userId:number){return drizzleDb.select().from(crmHospitalAccount).where(and(eq(crmHospitalAccount.hospitalId,hospitalId),eq(crmHospitalAccount.userId,userId),active(crmHospitalAccount))).limit(1)}
 static async listAccounts(hospitalId:number){return drizzleDb.select({id:crmHospitalAccount.id,hospitalId:crmHospitalAccount.hospitalId,userId:crmHospitalAccount.userId,role:crmHospitalAccount.role,status:crmHospitalAccount.status,remark:crmHospitalAccount.remark,createdAt:crmHospitalAccount.createdAt,user:{id:sysUser.id,username:sysUser.username,realName:sysUser.realName,phone:sysUser.phone,email:sysUser.email,status:sysUser.status}}).from(crmHospitalAccount).innerJoin(sysUser,eq(crmHospitalAccount.userId,sysUser.id)).where(and(eq(crmHospitalAccount.hospitalId,hospitalId),active(crmHospitalAccount))).orderBy(desc(crmHospitalAccount.createdAt))}
 static async createAccount(hospitalId:number,user:any,account:any){return drizzleDb.transaction(async tx=>{const r=await tx.insert(sysUser).values(user);const userId=Number(r[0].insertId);await this.bindRole(userId,tx);await tx.insert(crmHospitalAccount).values({...account,hospitalId,userId});return (await this.findAccount(hospitalId,userId))[0]})}
 static async bindRole(userId:number,db:any){const [role]=await db.select({id:sysRole.id}).from(sysRole).where(and(eq(sysRole.code,HOSPITAL_ACCOUNT_ROLE_CODE),active(sysRole))).limit(1);if(!role)throw new Error('医院账号全局角色未配置');await db.insert(sysUserRole).values({userId,roleId:role.id}).onDuplicateKeyUpdate({set:{deletedAt:null}})}
 static async assignAccount(input:any){return drizzleDb.transaction(async tx=>{const r=await tx.insert(crmHospitalAccount).values(input);await this.bindRole(input.userId,tx);const [row]=await tx.select().from(crmHospitalAccount).where(eq(crmHospitalAccount.id,Number(r[0].insertId))).limit(1);return row})}
 static async updateAccount(id:number,input:any){await drizzleDb.update(crmHospitalAccount).set(input).where(eq(crmHospitalAccount.id,id));const [r]=await drizzleDb.select().from(crmHospitalAccount).where(eq(crmHospitalAccount.id,id)).limit(1);return r}
 static accessibleHospitalIds(userId:number){return drizzleDb.select({hospitalId:crmHospitalAccount.hospitalId}).from(crmHospitalAccount).innerJoin(crmHospital,eq(crmHospitalAccount.hospitalId,crmHospital.id)).where(and(eq(crmHospitalAccount.userId,userId),eq(crmHospitalAccount.status,1),active(crmHospitalAccount),active(crmHospital),eq(crmHospital.status,1)))}
 static findUser(id:number){return drizzleDb.select().from(sysUser).where(and(eq(sysUser.id,id),active(sysUser))).limit(1)}
 static findOtherUserByUsername(username:string,userId:number){return drizzleDb.select({id:sysUser.id}).from(sysUser).where(and(eq(sysUser.username,username),active(sysUser),ne(sysUser.id,userId))).limit(1)}
 static countOwners(hospitalId:number){return drizzleDb.select({total:count()}).from(crmHospitalAccount).where(and(eq(crmHospitalAccount.hospitalId,hospitalId),eq(crmHospitalAccount.role,'owner'),active(crmHospitalAccount)))}
 static updateUser(id:number,input:any){return drizzleDb.update(sysUser).set(input).where(eq(sysUser.id,id))}
}
export { HOSPITAL_ACCOUNT_ROLE_CODE }
