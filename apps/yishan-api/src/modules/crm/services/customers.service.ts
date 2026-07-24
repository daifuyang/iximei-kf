import { CustomersRepository } from '../repositories/customers.repository.js'
import { DispatchesRepository } from '../repositories/dispatches.repository.js'
import { compact, asDate, pageArgs } from './_shared.js'
import { DATA_SCOPE, type DataScopeCode } from '@/core/repositories/permission.repository.js'

/** owner 字段过滤：SELF 限定,其它档位(ALL)保留全量。CRM 各 entity 用 ownerUserId 做隔离。 */
function ownerScopeFor(scope: DataScopeCode, userId: number): number | undefined {
  if (scope === DATA_SCOPE.SELF) return userId
  return undefined
}

export class CustomersService {
  static async listStatuses() {
    await CustomersRepository.ensureDefaultStatuses()
    return CustomersRepository.listStatuses()
  }

  static async list(q: any, userId: number, scope: DataScopeCode = DATA_SCOPE.ALL) {
    const p = pageArgs(q)
    const ownerUserId = ownerScopeFor(scope, userId)
    return { ...(await CustomersRepository.list({ ...q, ...p, ownerUserId })), ...p }
  }

  static async getById(id: number, userId: number, scope: DataScopeCode = DATA_SCOPE.ALL, includeDispatches = true) {
    const r: any = await CustomersRepository.findById(id, includeDispatches)
    if (!r) return null
    if (ownerScopeFor(scope, userId) === userId && r.ownerUserId !== userId) return null
    return r
  }

  static async save(input: any, userId: number, scope: DataScopeCode = DATA_SCOPE.ALL, id?: number) {
    await CustomersRepository.ensureDefaultStatuses()
    const data = compact({
      numberId: input.numberId,
      name: input.name,
      gender: input.gender === undefined ? undefined : Number(input.gender),
      birthday: asDate(input.birthday),
      telphone: input.telphone,
      mobile: input.mobile,
      qq: input.qq,
      wechat: input.wechat,
      provinceId: input.provinceId === undefined ? undefined : Number(input.provinceId),
      cityId: input.cityId === undefined ? undefined : Number(input.cityId),
      districtId: input.districtId === undefined ? undefined : Number(input.districtId),
      address: input.address,
      plastic: input.plastic,
      statusId: input.statusId === undefined ? undefined : Number(input.statusId),
      remark: input.remark,
      ownerUserId: input.ownerUserId === undefined ? undefined : Number(input.ownerUserId),
      updaterId: userId,
    })
    if (id) {
      const existing = await this.getById(id, userId, scope)
      if (!existing) throw new Error('客户不存在或无权访问')
      return CustomersRepository.update(id, data)
    }
    return CustomersRepository.create({
      ...data,
      numberId: input.numberId || (await CustomersRepository.nextNumber()),
      statusId: input.statusId ?? 1,
      ownerUserId: input.ownerUserId ? Number(input.ownerUserId) : userId,
      creatorId: userId,
      updaterId: userId,
    })
  }

  static async dispatch(id: number, input: any, userId: number, scope: DataScopeCode = DATA_SCOPE.ALL) {
    const existing = await this.getById(id, userId, scope)
    if (!existing) throw new Error('客户不存在或无权访问')
    const hs: number[] = Array.from(
      new Set<number>((input.hospitalIds ?? []).map(Number).filter(Boolean)),
    )
    if (!hs.length) throw new Error('请选择派单医院')
    return CustomersRepository.dispatchCustomer(
      id,
      hs,
      input.statusId ?? 1,
      userId,
      input.reply ?? '此客户是贵医院潜在客户，请跟进',
    )
  }

  static async addRemark(
    id: number,
    content: string,
    userId: number,
    scope: DataScopeCode = DATA_SCOPE.ALL,
  ) {
    const existing = await this.getById(id, userId, scope)
    if (!existing) throw new Error('客户不存在或无权访问')
    if (!content) throw new Error('备注内容不能为空')
    return CustomersRepository.addRemark(id, userId, content)
  }

  static async delete(id: number, userId: number, scope: DataScopeCode = DATA_SCOPE.ALL) {
    const existing = await this.getById(id, userId, scope)
    if (!existing) throw new Error('客户不存在或无权访问')
    return CustomersRepository.update(id, { deletedAt: new Date(), updaterId: userId })
  }
}
void DispatchesRepository
