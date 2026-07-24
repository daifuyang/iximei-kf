import { DispatchesRepository } from '../repositories/dispatches.repository.js'
import { isSuperAdmin, pageArgs, compact, asDate, sanitizeReplyContent, hasReplyContent, sanitizeDispatchReplies } from './_shared.js'
import { CustomersRepository } from '../repositories/customers.repository.js'
export class DispatchesService {
 static async listStatuses(){await CustomersRepository.ensureDefaultStatuses();return DispatchesRepository.listStatuses()}
 static async list(q:any,userId:number){const p=pageArgs(q);const ids=isSuperAdmin(userId)?null:(await import('../repositories/hospitals.repository.js')).HospitalsRepository.accessibleHospitalIds(userId);const allowed=ids? (await ids).map(x=>x.hospitalId):undefined;if(allowed?.length===0)return {list:[],total:0,...p};return {...await DispatchesRepository.list({...q,...p,hospitalIds:allowed}),...p}}
 static async getById(id:number,userId:number){const d=await DispatchesRepository.findById(id);if(!d)return null;if(!isSuperAdmin(userId)){const ids=(await (await import('../repositories/hospitals.repository.js')).HospitalsRepository.accessibleHospitalIds(userId)).map(x=>x.hospitalId);if(!ids.includes(d.hospitalId))return null}return sanitizeDispatchReplies(d)}
 static async update(id:number,input:any,userId:number){if(!await this.getById(id,userId))throw new Error('派单不存在或无权访问');return DispatchesRepository.update(id,compact({hospitalId:input.hospitalId,statusId:input.statusId,image:input.image,receiveQq:input.receiveQq,receiveWechat:input.receiveWechat,finishedAt:asDate(input.finishedAt),updaterId:userId}))}
 static async addReply(id:number,input:any,userId:number){if(!await this.getById(id,userId))throw new Error('派单不存在或无权访问');const content=input.content===undefined?undefined:sanitizeReplyContent(input.content);if(content!==undefined&&!hasReplyContent(content))throw new Error('留言不能为空');return DispatchesRepository.reply(id,compact({receiveQq:input.receiveQq,receiveWechat:input.receiveWechat,image:input.image,statusId:input.statusId,updaterId:userId}),userId,content)}
 static async addLog(id:number,content:string,userId:number){if(!await this.getById(id,userId))throw new Error('派单不存在或无权访问');if(!content)throw new Error('跟进内容不能为空');return DispatchesRepository.addLog(id,userId,content)}
}
void compact
