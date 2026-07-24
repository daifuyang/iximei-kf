import { CustomersRepository } from '../repositories/customers.repository.js'
import { DispatchesRepository } from '../repositories/dispatches.repository.js'
import { compact, asDate, isSuperAdmin, pageArgs } from './_shared.js'
export class CustomersService {
 static async listStatuses(){await CustomersRepository.ensureDefaultStatuses();return CustomersRepository.listStatuses()}
 static async list(q:any,userId:number){const p=pageArgs(q);return {...await CustomersRepository.list({...q,...p,ownerUserId:isSuperAdmin(userId)?undefined:userId}),...p}}
 static async getById(id:number,userId:number){const r=await CustomersRepository.findById(id,true);return !r||(!isSuperAdmin(userId)&&r.ownerUserId!==userId)?null:r}
 static async save(input:any,userId:number,id?:number){await CustomersRepository.ensureDefaultStatuses();const data=compact({numberId:input.numberId,name:input.name,gender:input.gender,birthday:asDate(input.birthday),telphone:input.telphone,mobile:input.mobile,qq:input.qq,wechat:input.wechat,provinceId:input.provinceId,cityId:input.cityId,districtId:input.districtId,address:input.address,plastic:input.plastic,statusId:input.statusId,remark:input.remark,ownerUserId:input.ownerUserId,updaterId:userId});if(id){if(!await this.getById(id,userId))throw new Error('客户不存在或无权访问');return CustomersRepository.update(id,data)}return CustomersRepository.create({...data,numberId:input.numberId||await CustomersRepository.nextNumber(),statusId:input.statusId??1,ownerUserId:input.ownerUserId??userId,creatorId:userId,updaterId:userId})}
 static async dispatch(id:number,input:any,userId:number){if(!await this.getById(id,userId))throw new Error('客户不存在或无权访问');const hs:number[]=Array.from(new Set<number>((input.hospitalIds??[]).map(Number).filter(Boolean)));if(!hs.length)throw new Error('请选择派单医院');return CustomersRepository.dispatchCustomer(id,hs,input.statusId??1,userId,input.reply??'此客户是贵医院潜在客户，请跟进')}
 static async addRemark(id:number,content:string,userId:number){if(!await this.getById(id,userId))throw new Error('客户不存在或无权访问');if(!content)throw new Error('备注内容不能为空');return CustomersRepository.addRemark(id,userId,content)}
 static async delete(id:number,userId:number){if(!await this.getById(id,userId))throw new Error('客户不存在或无权访问');return CustomersRepository.update(id,{deletedAt:new Date(),updaterId:userId})}
}
void DispatchesRepository
