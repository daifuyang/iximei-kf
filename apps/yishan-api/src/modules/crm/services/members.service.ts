import { MembersRepository } from '../repositories/members.repository.js'
import { compact, asDate, isSuperAdmin, pageArgs } from './_shared.js'
export class MembersService {
 static async list(q:any,userId:number){const p=pageArgs(q);return {...await MembersRepository.list({...q,...p,ownerUserId:isSuperAdmin(userId)?undefined:userId}),...p}}
 static async getById(id:number,userId:number,browse=false){const m=await MembersRepository.findById(id);if(!m||(!isSuperAdmin(userId)&&m.ownerUserId!==userId))return null;if(browse)await MembersRepository.recordBrowse(id,userId);return m}
 static async save(input:any,userId:number,id?:number){const data=compact({numberId:input.numberId,name:input.name,gender:input.gender,birthday:asDate(input.birthday),address:input.address,mobile:input.mobile,project:input.project,ownerUserId:input.ownerUserId,updaterId:userId});if(id){if(!await this.getById(id,userId))throw new Error('会员不存在或无权访问');return MembersRepository.update(id,data)}return MembersRepository.create({...data,numberId:input.numberId||await MembersRepository.nextNumber(),ownerUserId:input.ownerUserId??userId,creatorId:userId,updaterId:userId})}
 static async addRemark(id:number,content:string,userId:number){if(!await this.getById(id,userId))throw new Error('会员不存在或无权访问');if(!content)throw new Error('备注内容不能为空');return MembersRepository.addRemark(id,userId,content)}
 static async delete(id:number,userId:number){if(!await this.getById(id,userId))throw new Error('会员不存在或无权访问');return MembersRepository.update(id,{deletedAt:new Date(),updaterId:userId})}
}
