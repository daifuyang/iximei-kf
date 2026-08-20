/**
 * 医院后台数据看板 service。
 *
 * 角色门禁：本看板与 unviewed count 只服务于 HOSPITAL_ACCOUNT 角色。
 * 其他角色（含 super_admin）调用直接 throw BusinessError(FORBIDDEN)。
 *
 * 这是有意的产品边界：super_admin 有全院 CRM 数据看板（`/api/crm/dashboard/stats`）
 * 可看汇总，**不需要**这个以单家医院视角聚合的看板；
 * 客服（CUSTOMER_SERVICE）有自己的数据范围，访问本接口是越权。
 *
 * hospitalId 解析：通过 HospitalsRepository.accessibleHospitalIds(userId)
 * 反查登录账号所绑定的医院（一院一账号 → 一行）。
 */

import { BusinessError } from '@/exceptions/business-error.js'
import { AuthErrorCode } from '@/constants/business-codes/auth.js'
import { ROLE_IDS } from '@/constants/permission-codes.js'
import { HospitalDashboardRepository } from '../repositories/hospital-dashboard.repository.js'
import { HospitalsRepository } from '../repositories/hospitals.repository.js'

/** 全空响应：用户没绑定医院时返回，避免 SQL 报错。 */
const EMPTY_STATS = {
  todayCount: 0,
  monthCount: 0,
  yearCount: 0,
  totalCount: 0,
  viewedCount: 0,
  unviewedCount: 0,
}

function assertHospitalAccount(roleIds: ReadonlyArray<number>, action: string) {
  if (!roleIds.includes(ROLE_IDS.HOSPITAL_ACCOUNT)) {
    const msg =
      action === 'stats'
        ? '访问本院数据看板'
        : action === 'unviewed-count'
          ? '查看本院未查看派单数量'
          : action === 'trend'
            ? '查看本院数据趋势'
            : '访问本院数据'
    throw new BusinessError(AuthErrorCode.FORBIDDEN, `仅医院账号可${msg}`)
  }
}

export class HospitalDashboardService {
  /**
   * 当前登录医院账号的看板统计。
   *
   * @throws BusinessError(AuthErrorCode.FORBIDDEN) 当非 HOSPITAL_ACCOUNT 角色调用时。
   */
  static async getStats(userId: number, roleIds: ReadonlyArray<number>) {
    assertHospitalAccount(roleIds, 'stats')
    const rows = await HospitalsRepository.accessibleHospitalIds(userId)
    const ids: number[] = rows.map((x: any) => x.hospitalId)
    if (!ids.length) return { ...EMPTY_STATS }
    // 一院一账号：医院账号只关联一家医院，取第一个。
    return HospitalDashboardRepository.getStats(ids[0])
  }

  /**
   * 当前登录医院账号的未查看派单数（菜单 Badge 用）。
   *
   * @throws BusinessError(AuthErrorCode.FORBIDDEN) 当非 HOSPITAL_ACCOUNT 角色调用时。
   */
  static async getUnviewedCount(userId: number, roleIds: ReadonlyArray<number>) {
    assertHospitalAccount(roleIds, 'unviewed-count')
    const rows = await HospitalsRepository.accessibleHospitalIds(userId)
    const ids: number[] = rows.map((x: any) => x.hospitalId)
    if (!ids.length) return { count: 0 }
    return { count: await HospitalDashboardRepository.getUnviewedCount(ids[0]) }
  }

  /**
   * 当前登录医院账号的派单趋势（近 days 天每日新增 + viewed/unviewed 总览）。
   *
   * @throws BusinessError(AuthErrorCode.FORBIDDEN) 当非 HOSPITAL_ACCOUNT 角色调用时。
   */
  static async getTrend(userId: number, roleIds: ReadonlyArray<number>, days = 30) {
    assertHospitalAccount(roleIds, 'trend')
    const ids = (await HospitalsRepository.accessibleHospitalIds(userId)).map((x: any) => x.hospitalId)
    if (!ids.length) {
      return { daily: emptyDaily(days), statusBreakdown: { viewed: 0, unviewed: 0 } }
    }
    return HospitalDashboardRepository.getTrend(ids[0], days)
  }
}

/** 用户没绑定医院时返回的占位 daily：days 个全 0 的日期序列（从最早到今天）。 */
function emptyDaily(days: number) {
  const out: Array<{ date: string; count: number }> = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    out.push({ date: d.toISOString().slice(0, 10), count: 0 })
  }
  return out
}