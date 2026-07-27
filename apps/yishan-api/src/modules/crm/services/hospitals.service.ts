import { BusinessError } from '@/exceptions/business-error.js'
import { AuthErrorCode } from '@/constants/business-codes/auth.js'
import { UserTokenRepository } from '@/core/repositories/user-token.repository.js'
import { HospitalsRepository } from '../repositories/hospitals.repository.js'
import { compact, normalizeContractPhotos } from './_shared.js'
import { hashPassword } from '@/utils/password.js'
import type { FastifyRequest } from 'fastify'

const HOSPITAL_ACCOUNT_CODE = 'hospital_account'

/**
 * 医院 Service — 一院一账号版本。
 *
 * 不变量：
 *   - 每家医院恰好一个 sys_user 账号，由 crm_hospital.account_user_id 唯一指向；
 *   - username 始终等于 hospital_name；
 *   - hospital_account 角色的可见医院集由 accessibleHospitalIds 提供；
 *   - 0 结果 → BusinessError(403)，禁止回退为全量数据。
 */
export class HospitalsService {
  static getById(id: number) {
    return HospitalsRepository.findById(id)
  }

  static async list(q: any) {
    const p = { ...q, ...requirePage(q) }
    return { ...(await HospitalsRepository.list(p)), ...p }
  }

  static async searchOptions(q: any) {
    return this.list({ ...q, page: 1, pageSize: 50 })
  }

  /**
   * 创建医院：原子地创建 sys_user + 绑定 hospital_account 角色 + 写入 crm_hospital.account_user_id。
   * username 固定取 hospitalName；任一步失败回滚。
   */
  static async createWithAccount(input: any, creatorId: number) {
    const hospitalName = String(input.hospitalName ?? '').trim()
    if (hospitalName.length < 1 || hospitalName.length > 50) {
      throw new Error('医院名称必须为 1–50 字')
    }
    if (await HospitalsRepository.findOtherUserByUsername(hospitalName, 0)) {
      throw new Error('医院名称已被其他账号占用')
    }
    const hospitalInput = compact({
      hospitalName,
      provinceId: input.provinceId,
      cityId: input.cityId,
      districtId: input.districtId,
      hospitalAddress: input.hospitalAddress,
      hospitalPhone: input.hospitalPhone,
      hospitalSelling: input.hospitalSelling,
      hospitalWebsite: input.hospitalWebsite,
      hospitalNature: input.hospitalNature,
      doctorName: input.doctorName,
      doctorPhone: input.doctorPhone,
      doctorQq: input.doctorQq,
      receptionName: input.receptionName,
      receptionPhone: input.receptionPhone,
      receptionQq: input.receptionQq,
      busStation: input.busStation,
      busAddress: input.busAddress,
      subwayStation: input.subwayStation,
      subwayAddress: input.subwayAddress,
      taxiFare: input.taxiFare,
      vipDiscount: input.vipDiscount,
      returnPoint: input.returnPoint,
      hospitalIntroduction: input.hospitalIntroduction,
      contractPhotos: normalizeContractPhotos(input.contractPhotos),
      wechatOpenid: input.wechatOpenid,
      status: input.status ?? 1,
      updaterId: creatorId,
    })
    return HospitalsRepository.createWithAccount(
      hospitalInput,
      {
        username: hospitalName,
        passwordHash: await hashPassword(input.accountPassword),
        email: input.accountEmail ?? null,
        phone: input.accountPhone ?? null,
        // 医院新建时若为停用状态，账号也必须同步停用。
        status: hospitalInput.status,
      },
      creatorId,
    )
  }

  /**
   * 更新医院档案（不含 hospitalName）。
   * 医院改名走独立 POST /hospitals/:id/rename（要求 crm:hospitals:rename 权限），
   * 此处不再处理 hospitalName 字段，调用方传入也会被忽略。
   */
  static async update(input: any, actorId: number, id: number) {
    const data = compact({
      provinceId: input.provinceId,
      cityId: input.cityId,
      districtId: input.districtId,
      hospitalAddress: input.hospitalAddress,
      hospitalPhone: input.hospitalPhone,
      hospitalSelling: input.hospitalSelling,
      hospitalWebsite: input.hospitalWebsite,
      hospitalNature: input.hospitalNature,
      doctorName: input.doctorName,
      doctorPhone: input.doctorPhone,
      doctorQq: input.doctorQq,
      receptionName: input.receptionName,
      receptionPhone: input.receptionPhone,
      receptionQq: input.receptionQq,
      busStation: input.busStation,
      busAddress: input.busAddress,
      subwayStation: input.subwayStation,
      subwayAddress: input.subwayAddress,
      taxiFare: input.taxiFare,
      vipDiscount: input.vipDiscount,
      returnPoint: input.returnPoint,
      hospitalIntroduction: input.hospitalIntroduction,
      contractPhotos: normalizeContractPhotos(input.contractPhotos),
      wechatOpenid: input.wechatOpenid,
      status: input.status,
      updaterId: actorId,
    })
    const existing = await HospitalsRepository.findById(id)
    if (!existing) throw new Error('医院不存在')
    if (data.status === 0) {
      const account = await HospitalsRepository.getAccountByHospitalId(id)
      if (!account) throw new Error('医院账号不存在')
      const result = await HospitalsRepository.deactivateHospitalAndAccount(
        id,
        account.userId,
        data,
      )
      await UserTokenRepository.revokeAllByUserId(account.userId)
      return result
    }
    // 医院恢复启用时不自动恢复账号；账号需由管理员单独启用。
    return HospitalsRepository.update(id, data)
  }

  /**
   * 改名（仅系统管理员，crm:hospitals:rename 权限）。
   * 同一事务内更新 crm_hospital.hospital_name 与 sys_user.username，
   * 撤销该账号的活跃 Token，并写审计日志。
   * 新名称长度 1–50 字，且不能与其他 sys_user.username 冲突。
   */
  static async renameHospital(
    hospitalId: number,
    newHospitalName: string,
    actorId: number,
    request?: FastifyRequest,
  ) {
    const trimmed = String(newHospitalName ?? '').trim()
    if (trimmed.length < 1 || trimmed.length > 50) {
      throw new Error('医院名称必须为 1–50 字')
    }
    const existing = await HospitalsRepository.findById(hospitalId)
    if (!existing) throw new Error('医院不存在')
    if (trimmed === existing.hospitalName) return existing

    const account = await HospitalsRepository.getAccountByHospitalId(hospitalId)
    if (!account) throw new Error('医院账号缺失，无法同步改名')

    const updated = await HospitalsRepository.renameHospitalAndAccount(
      hospitalId,
      account.userId,
      trimmed,
      actorId,
    )

    // 撤销该账号的活跃 Token（plan §5.2.4）
    await UserTokenRepository.revokeAllByUserId(account.userId)

    // 写审计日志（plan §4.3）
    if (request) {
      ;(request as any).auditEvent = {
        type: 'crm.hospital.renamed',
        payload: {
          hospitalId,
          oldName: existing.hospitalName,
          newName: trimmed,
          accountUserId: account.userId,
          actorId,
        },
      }
    }

    return updated
  }

  /**
   * 软删除医院：同时禁用关联 sys_user.status、撤销其活跃 token，写审计日志。
   * 禁止物理删除 sys_user。
   */
  static async delete(id: number, actorId: number) {
    const account = await HospitalsRepository.getAccountByHospitalId(id)
    await HospitalsRepository.update(id, {
      deletedAt: new Date(),
      updaterId: actorId,
      status: 0,
    } as any)
    if (account) {
      await HospitalsRepository.disableAccount(account.userId)
      await UserTokenRepository.revokeAllByUserId(account.userId)
    }
    return { id, deleted: true, accountDisabled: Boolean(account) }
  }

  /* -------------------- 账号侧接口 -------------------- */

  static getAccount(hospitalId: number) {
    return HospitalsRepository.getAccountByHospitalId(hospitalId)
  }

  static async updateAccountContact(hospitalId: number, input: any) {
    const acc = await HospitalsRepository.getAccountByHospitalId(hospitalId)
    if (!acc) throw new Error('医院账号不存在')
    const updated = await HospitalsRepository.updateAccountContact(acc.userId, compact(input))
    // STRICT-SPEC §6.3：禁用账号时立即撤销该用户所有活跃 Token
    if (input.status === 0) {
      await UserTokenRepository.revokeAllByUserId(acc.userId)
    }
    return updated
  }

  static async resetAccountPassword(hospitalId: number, newPassword: string) {
    const acc = await HospitalsRepository.getAccountByHospitalId(hospitalId)
    if (!acc) throw new Error('医院账号不存在')
    await HospitalsRepository.resetAccountPassword(acc.userId, await hashPassword(newPassword))
    // STRICT-SPEC §6.3：重置密码后立即撤销旧 Token
    await UserTokenRepository.revokeAllByUserId(acc.userId)
  }

  /* -------------------- 数据范围 -------------------- */

  /**
   * 为 hospital_account 角色提供可见医院 ID 列表；其余角色不限制。
   * 0 结果 → 抛 BusinessError(403) + 审计，由调用方捕获（routes 层）。
   */
  static async requireAccessibleHospitalIds(userId: number, roleCodes: string[]): Promise<number[]> {
    if (!roleCodes.includes(HOSPITAL_ACCOUNT_CODE)) return []
    const rows = await HospitalsRepository.accessibleHospitalIds(userId)
    const ids = rows.map((r) => Number((r as any).hospitalId))
    if (ids.length === 0) {
      throw new BusinessError(AuthErrorCode.FORBIDDEN, '当前账号未关联有效医院')
    }
    return ids
  }

  static bindWechatOpenid(id: number, signature: string, openid: string) {
    const crypto = require('node:crypto')
    if (crypto.createHash('md5').update(`hospital_bind${id}`).digest('hex') !== signature) {
      throw new Error('微信绑定签名无效')
    }
    return HospitalsRepository.bindWechatOpenid(id, openid)
  }
}

function requirePage(q: any) {
  return {
    page: Math.max(1, Number(q.page ?? 1)),
    pageSize: Math.max(0, Number(q.pageSize ?? 10)),
  }
}
