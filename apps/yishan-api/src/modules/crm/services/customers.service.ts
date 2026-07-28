import { BusinessError } from '@/exceptions/business-error.js'
import { ValidationErrorCode } from '@/constants/business-codes/validation.js'
import { ResourceErrorCode } from '@/constants/business-codes/resource.js'
import { withDbErrorMapping } from '@/core/plugins/external/db-error.js'
import { CustomersRepository } from '../repositories/customers.repository.js'
import { DispatchesRepository } from '../repositories/dispatches.repository.js'
import { compact, pageArgs } from './_shared.js'
import { DATA_SCOPE, type DataScopeCode } from '@/core/repositories/permission.repository.js'
import {
  requireString,
  optionalString,
  optionalPhone,
  optionalQq,
  optionalWechat,
  trimOrNull,
  parseDateOrThrow,
} from '../_validation.js'

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

  /**
   * 创建/更新客户。
   * - 校验：name 必填（trim 1-50），mobile/qq/wechat/telphone 可选但提供时必须合法，
   *   birthday 可选但必须 YYYY-MM-DD，address/plastic/remark 静默 trim。
   * - 任何校验失败抛 BusinessError（前端会被 requestErrorConfig 弹 message.error）。
   * - DB 层的 1062/1406/1366 错误码由本 service 翻译为业务码。
   */
  static async save(input: any, userId: number, scope: DataScopeCode = DATA_SCOPE.ALL, id?: number) {
    await CustomersRepository.ensureDefaultStatuses()
    // 公共字段：先 trim / 校验，再交给 compact
    const name = id ? undefined : requireString(input.name, { field: '客户姓名', min: 1, max: 50 })
    const numberId = optionalString(input.numberId, { field: '客户编号', max: 20 })
    const telphone = optionalString(input.telphone, { field: '固定电话', max: 20 })
    const mobile = optionalPhone(input.mobile, '手机号')
    const qq = optionalQq(input.qq, 'QQ 号')
    const wechat = optionalWechat(input.wechat, '微信号')
    const address = trimOrNull(input.address) ?? undefined
    const plastic = trimOrNull(input.plastic) ?? undefined
    const remark = trimOrNull(input.remark) ?? undefined
    const birthday = parseDateOrThrow(input.birthday, '生日')

    const data = compact({
      // PATCH 时 numberId/name 也允许"提供才更新"；为避免把空值写回去，name 仅 create 必填。
      ...(id ? {} : { name }),
      ...(numberId !== null ? { numberId } : {}),
      gender: input.gender === undefined ? undefined : Number(input.gender),
      birthday,
      telphone,
      mobile,
      qq,
      wechat,
      provinceId: input.provinceId === undefined ? undefined : Number(input.provinceId),
      cityId: input.cityId === undefined ? undefined : Number(input.cityId),
      districtId: input.districtId === undefined ? undefined : Number(input.districtId),
      address,
      plastic,
      statusId: input.statusId === undefined ? undefined : Number(input.statusId),
      remark,
      ownerUserId: input.ownerUserId === undefined ? undefined : Number(input.ownerUserId),
      updaterId: userId,
    })

    if (id) {
      // PATCH 路径：若用户传了 name（包含纯空白），依旧校验。空字符串/纯空白表示不动该字段。
      if (input.name !== undefined) {
        const trimmed = requireString(input.name, { field: '客户姓名', min: 1, max: 50 })
        data.name = trimmed
      }
      const existing = await this.getById(id, userId, scope)
      if (!existing) {
        throw new BusinessError(ResourceErrorCode.NOT_FOUND, '客户不存在或无权访问')
      }
      return withDbErrorMapping(() => CustomersRepository.update(id, data))
    }

    return withDbErrorMapping(async () => CustomersRepository.create({
      ...data,
      numberId: numberId || (await CustomersRepository.nextNumber()),
      statusId: input.statusId ?? 1,
      ownerUserId: input.ownerUserId ? Number(input.ownerUserId) : userId,
      creatorId: userId,
      updaterId: userId,
    }))
  }

  static async dispatch(id: number, input: any, userId: number, scope: DataScopeCode = DATA_SCOPE.ALL) {
    const existing = await this.getById(id, userId, scope)
    if (!existing) throw new BusinessError(ResourceErrorCode.NOT_FOUND, '客户不存在或无权访问')
    const hs: number[] = Array.from(
      new Set<number>((input.hospitalIds ?? []).map(Number).filter(Boolean)),
    )
    if (!hs.length) throw new BusinessError(ValidationErrorCode.MISSING_PARAMETER, '请选择派单医院')
    return withDbErrorMapping(() => CustomersRepository.dispatchCustomer(
      id,
      hs,
      input.statusId ?? 1,
      userId,
      input.reply ?? '此客户是贵医院潜在客户，请跟进',
    ))
  }

  static async addRemark(
    id: number,
    content: string,
    userId: number,
    scope: DataScopeCode = DATA_SCOPE.ALL,
  ) {
    const existing = await this.getById(id, userId, scope)
    if (!existing) throw new BusinessError(ResourceErrorCode.NOT_FOUND, '客户不存在或无权访问')
    const trimmed = (typeof content === 'string' ? content : '').trim()
    if (!trimmed) throw new BusinessError(ValidationErrorCode.MISSING_PARAMETER, '备注内容不能为空')
    return withDbErrorMapping(() => CustomersRepository.addRemark(id, userId, trimmed))
  }

  static async delete(id: number, userId: number, scope: DataScopeCode = DATA_SCOPE.ALL) {
    const existing = await this.getById(id, userId, scope)
    if (!existing) throw new BusinessError(ResourceErrorCode.NOT_FOUND, '客户不存在或无权访问')
    return withDbErrorMapping(() => CustomersRepository.update(id, { deletedAt: new Date(), updaterId: userId }))
  }
}
void DispatchesRepository
