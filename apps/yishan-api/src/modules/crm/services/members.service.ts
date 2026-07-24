import { MembersRepository } from '../repositories/members.repository.js'
import { compact, asDate, pageArgs } from './_shared.js'
import { DATA_SCOPE, type DataScopeCode } from '@/core/repositories/permission.repository.js'

/**
 * 按 dataScope + userId 算出 crm_member_customer 的 ownerUserId 过滤值。
 *
 * - ALL(1): undefined  → 不加 owner 过滤,看全部
 * - SELF(4): userId → 只看自己 owner 的
 * - 其他(CUSTOM 5、DEPT 2/3): undefined → 当前 CRM 用不上,简化按 ALL 处理
 */
function ownerScopeFor(scope: DataScopeCode, userId: number): number | undefined {
  if (scope === DATA_SCOPE.SELF) return userId
  return undefined
}

export class MembersService {
  static async list(q: any, userId: number, scope: DataScopeCode = DATA_SCOPE.ALL) {
    const p = pageArgs(q)
    const ownerUserId = ownerScopeFor(scope, userId)
    return { ...(await MembersRepository.list({ ...q, ...p, ownerUserId })), ...p }
  }

  static async getById(
    id: number,
    userId: number,
    scope: DataScopeCode = DATA_SCOPE.ALL,
    browse = false,
  ) {
    const m: any = await MembersRepository.findById(id)
    if (!m) return null
    if (ownerScopeFor(scope, userId) === userId && m.ownerUserId !== userId) return null
    if (browse) await MembersRepository.recordBrowse(id, userId)
    return m
  }

  static async save(
    input: any,
    userId: number,
    scope: DataScopeCode = DATA_SCOPE.ALL,
    id?: number,
  ) {
    const data = compact({
      numberId: input.numberId,
      name: input.name,
      gender: input.gender === undefined ? undefined : Number(input.gender),
      birthday: asDate(input.birthday),
      address: input.address,
      mobile: input.mobile,
      project: input.project,
      ownerUserId: input.ownerUserId,
      updaterId: userId,
    })
    if (id) {
      if (!(await this.getById(id, userId, scope))) {
        throw new Error('会员不存在或无权访问')
      }
      return MembersRepository.update(id, data)
    }
    return MembersRepository.create({
      ...data,
      numberId: input.numberId || (await MembersRepository.nextNumber()),
      ownerUserId: input.ownerUserId ?? userId,
      creatorId: userId,
      updaterId: userId,
    })
  }

  static async addRemark(
    id: number,
    content: string,
    userId: number,
    scope: DataScopeCode = DATA_SCOPE.ALL,
  ) {
    if (!(await this.getById(id, userId, scope))) {
      throw new Error('会员不存在或无权访问')
    }
    if (!content) throw new Error('备注内容不能为空')
    return MembersRepository.addRemark(id, userId, content)
  }

  static async delete(id: number, userId: number, scope: DataScopeCode = DATA_SCOPE.ALL) {
    if (!(await this.getById(id, userId, scope))) {
      throw new Error('会员不存在或无权访问')
    }
    return MembersRepository.update(id, { deletedAt: new Date(), updaterId: userId })
  }
}
