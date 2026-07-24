import { DispatchesRepository } from '../repositories/dispatches.repository.js'
import { HospitalsRepository } from '../repositories/hospitals.repository.js'
import { CustomersRepository } from '../repositories/customers.repository.js'
import { compact, asDate, sanitizeReplyContent, hasReplyContent, sanitizeDispatchReplies, pageArgs } from './_shared.js'
import { DATA_SCOPE, type DataScopeCode } from '@/core/repositories/permission.repository.js'

const SUPER_ADMIN_CODE = 'super_admin'
const HOSPITAL_ACCOUNT_CODE = 'hospital_account'

/**
 * 三种角色的派单数据范围:
 * - super_admin: 看全部 (lift)
 * - hospital_account: 关联自己医院的派单 (crm_hospital_account.hospital_id in own)
 * - customer_service / 默认 SELF: 自己添加的客户的派单 (crm_customer.owner_user_id = self)
 * - admin / 其它: 走 dataScope 字段（默认 SELF）
 */
async function dispatchFilters(
  roleCodes: ReadonlyArray<string>,
  userId: number,
): Promise<{ hospitalIds?: number[]; customerOwnerUserIds?: number[] }> {
  if (roleCodes.includes(SUPER_ADMIN_CODE)) return {}
  if (roleCodes.includes(HOSPITAL_ACCOUNT_CODE)) {
    const ids = await HospitalsRepository.accessibleHospitalIds(userId)
    return { hospitalIds: ids.map((x: any) => x.hospitalId) }
  }
  return { customerOwnerUserIds: [userId] }
}

export class DispatchesService {
  static async listStatuses() {
    await CustomersRepository.ensureDefaultStatuses()
    return DispatchesRepository.listStatuses()
  }

  static async list(
    q: any,
    userId: number,
    roleCodes: ReadonlyArray<string>,
    scope: DataScopeCode,
  ) {
    const p = pageArgs(q)
    const extra = await dispatchFilters(roleCodes, userId)
    return { ...(await DispatchesRepository.list({ ...q, ...p, ...extra })), ...p }
  }

  static async getById(
    id: number,
    userId: number,
    roleCodes: ReadonlyArray<string>,
    scope: DataScopeCode,
  ) {
    const d: any = await DispatchesRepository.findById(id)
    if (!d) return null
    if (roleCodes.includes(SUPER_ADMIN_CODE)) return sanitizeDispatchReplies(d)
    if (roleCodes.includes(HOSPITAL_ACCOUNT_CODE)) {
      const ids = (await HospitalsRepository.accessibleHospitalIds(userId)).map((x: any) => x.hospitalId)
      if (!ids.includes(d.hospitalId)) return null
    } else {
      // 客服/默认 SELF:检查派单对应的客户 owner 是不是自己
      const customer: any = await CustomersRepository.findById(d.customerId, false)
      const ownerOfCustomer = customer?.ownerUserId
      if (ownerOfCustomer !== userId && scope === DATA_SCOPE.SELF) return null
    }
    return sanitizeDispatchReplies(d)
  }

  static async update(
    id: number,
    input: any,
    userId: number,
    roleCodes: ReadonlyArray<string>,
    scope: DataScopeCode,
  ) {
    if (!(await this.getById(id, userId, roleCodes, scope))) {
      throw new Error('派单不存在或无权访问')
    }
    return DispatchesRepository.update(
      id,
      compact({
        hospitalId: input.hospitalId,
        statusId: input.statusId,
        image: input.image,
        receiveQq: input.receiveQq,
        receiveWechat: input.receiveWechat,
        finishedAt: asDate(input.finishedAt),
        updaterId: userId,
      }),
    )
  }

  static async addReply(
    id: number,
    input: any,
    userId: number,
    roleCodes: ReadonlyArray<string>,
    scope: DataScopeCode,
  ) {
    if (!(await this.getById(id, userId, roleCodes, scope))) {
      throw new Error('派单不存在或无权访问')
    }
    const content = input.content === undefined ? undefined : sanitizeReplyContent(input.content)
    if (content !== undefined && !hasReplyContent(content)) {
      throw new Error('留言不能为空')
    }
    return DispatchesRepository.reply(
      id,
      compact({
        receiveQq: input.receiveQq,
        receiveWechat: input.receiveWechat,
        image: input.image,
        statusId: input.statusId,
        updaterId: userId,
      }),
      userId,
      content,
    )
  }

  static async addLog(
    id: number,
    content: string,
    userId: number,
    roleCodes: ReadonlyArray<string>,
    scope: DataScopeCode,
  ) {
    if (!(await this.getById(id, userId, roleCodes, scope))) {
      throw new Error('派单不存在或无权访问')
    }
    if (!content) throw new Error('跟进内容不能为空')
    return DispatchesRepository.addLog(id, userId, content)
  }

  static async delete(
    id: number,
    userId: number,
    roleCodes: ReadonlyArray<string>,
    scope: DataScopeCode,
  ) {
    if (!(await this.getById(id, userId, roleCodes, scope))) {
      throw new Error('派单不存在或无权访问')
    }
    return DispatchesRepository.update(id, { deletedAt: new Date(), updaterId: userId })
  }
}
void compact
