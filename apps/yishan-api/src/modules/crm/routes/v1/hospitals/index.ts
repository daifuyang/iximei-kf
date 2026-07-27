/**
 * 医院资源路由 — 一院一账号版本。
 *
 * 单一职责：医院档案 + 唯一医院账号的只读 / 联系方式更新 / 重置密码。
 * 路由 prefix 由 module-loader 推导为 `/api/crm/v1`，本文件只声明子路径。
 */

import type { FastifyPluginAsync } from 'fastify'
import { createRouteRegistrar } from '@/core/routes/route-registrar.js'
import { ResponseUtil } from '@/utils/response.js'
import { BusinessError } from '@/exceptions/business-error.js'
import { AuthErrorCode } from '@/constants/business-codes/auth.js'
import { PERMS } from '../../../permissions.js'
import { HospitalsService } from '../../../services/hospitals.service.js'
import { HospitalsRepository } from '../../../repositories/hospitals.repository.js'
import { ROUTE_TAG } from '../../../schemas/routes.schema.js'
import {
  CrmHospitalAccountResetPasswordReqSchema,
  CrmHospitalAccountUpdateReqSchema,
  CrmHospitalRenameReqSchema,
  CrmHospitalReqSchema,
  CrmHospitalSearchQuerySchema,
  CrmHospitalUpdateReqSchema,
} from '../../../schemas/hospitals.schema.js'
import {
  CrmIdParamsSchema,
  CrmPageQuerySchema,
} from '../../../schemas/shared.schema.js'

const hospitals: FastifyPluginAsync = async (app) => {
  const route = createRouteRegistrar(app)
  const uid = (req: any) => req.currentUser.id
  const id = (req: any) => Number(req.params.id)

  /** hospital_account 角色收敛可见医院；其余角色无限制。
   * 0 结果由 HospitalsService.requireAccessibleHospitalIds 抛 403，不回退为全量。 */
  async function resolveHospitalIds(req: any): Promise<number[] | undefined> {
    const roleCodes: string[] = req.currentUser?.roleCodes ?? []
    if (!roleCodes.includes('hospital_account')) return undefined
    const ids = await HospitalsService.requireAccessibleHospitalIds(req.currentUser.id, roleCodes)
    return ids
  }

  /**
   * STRICT-SPEC §4.3 / §9.2.3：医院账号访问 :id 路由必须满足
   *   requestedHospitalId === currentUser's only accessible hospitalId
   * 不满足直接返回 403；不返回 404 / 空列表 / 其他医院信息。
   *
   * 作为 preHandler 挂载：req.params.id 是路由解析出的目标 id；
   * 非 hospital_account 角色直接放行。
   */
  async function assertHospitalAccountOwnership(req: any, _reply: any) {
    const roleCodes: string[] = req.currentUser?.roleCodes ?? []
    if (!roleCodes.includes('hospital_account')) return
    const targetId = Number(req.params?.id)
    if (!Number.isFinite(targetId)) return
    const accessible = await HospitalsRepository.accessibleHospitalIds(req.currentUser.id)
    const ownIds = accessible.map((r: any) => Number(r.hospitalId))
    if (ownIds.length === 0 || !ownIds.includes(targetId)) {
      throw new BusinessError(AuthErrorCode.FORBIDDEN, '医院账号无权访问其他医院资源')
    }
  }

  /* ---------- 医院档案 ---------- */

  route.get(
    '/hospitals',
    {
      access: { permission: PERMS.HOSPITAL_LIST },
      schema: {
        tags: [ROUTE_TAG],
        summary: '医院列表',
        operationId: 'listCrmHospitals',
        querystring: CrmPageQuerySchema,
      },
    },
    async (req: any, reply: any) => {
      // STRICT-SPEC §4.3 / §7.5：医院账号角色必须收敛到自身医院；不允许列出其他医院。
      // 非 hospital_account 角色不限制；resolveHospitalIds() 内部已做权限分流。
      const hospitalIds = await resolveHospitalIds(req)
      const query = hospitalIds ? { ...req.query, hospitalIds } : req.query
      const result = await HospitalsService.list(query)
      return ResponseUtil.paginated(reply, result.list, result.page, result.pageSize, result.total)
    },
  )

  route.get(
    '/hospitals/search/options',
    {
      access: { permission: PERMS.HOSPITAL_LIST },
      schema: {
        tags: [ROUTE_TAG],
        summary: '医院搜索（前端下拉）',
        operationId: 'searchCrmHospitals',
        querystring: CrmHospitalSearchQuerySchema,
      },
    },
    async (req: any, reply: any) => {
      const hospitalIds = await resolveHospitalIds(req)
      const query = hospitalIds ? { ...req.query, hospitalIds } : req.query
      const result = await HospitalsService.searchOptions(query)
      return ResponseUtil.success(reply, result.list)
    },
  )

  route.get(
    '/hospitals/:id',
    {
      access: { permission: PERMS.HOSPITAL_LIST },
      schema: {
        tags: [ROUTE_TAG],
        summary: '医院详情',
        operationId: 'getCrmHospital',
        params: CrmIdParamsSchema,
      },
      preHandler: [assertHospitalAccountOwnership],
    },
    async (req: any, reply: any) => {
      const data = await HospitalsService.getById(id(req))
      if (!data) throw new Error('医院不存在')
      return ResponseUtil.success(reply, data)
    },
  )

  route.post(
    '/hospitals',
    {
      access: { permission: PERMS.HOSPITAL_CREATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '创建医院（含唯一账号）',
        operationId: 'createCrmHospital',
        body: CrmHospitalReqSchema,
      },
    },
    async (req: any, reply: any) => {
      const result = await HospitalsService.createWithAccount(req.body, uid(req))
      return ResponseUtil.success(reply, result)
    },
  )

  route.patch(
    '/hospitals/:id',
    {
      access: { permission: PERMS.HOSPITAL_UPDATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '更新医院（改名会同步账号用户名）',
        operationId: 'updateCrmHospital',
        params: CrmIdParamsSchema,
        body: CrmHospitalUpdateReqSchema,
      },
      preHandler: [assertHospitalAccountOwnership],
    },
    async (req: any, reply: any) => {
      const result = await HospitalsService.update(req.body, uid(req), id(req))
      return ResponseUtil.success(reply, result)
    },
  )

  route.delete(
    '/hospitals/:id',
    {
      access: { permission: PERMS.HOSPITAL_DELETE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '删除医院（软删 + 禁用账号 + 撤销 Token）',
        operationId: 'deleteCrmHospital',
        params: CrmIdParamsSchema,
      },
      preHandler: [assertHospitalAccountOwnership],
    },
    async (req: any, reply: any) => {
      const result = await HospitalsService.delete(id(req), uid(req))
      return ResponseUtil.success(reply, result)
    },
  )

  route.post(
    '/hospitals/:id/rename',
    {
      // 仅系统管理员（持有 crm:hospitals:rename 权限）可调用
      access: { permission: PERMS.HOSPITAL_RENAME },
      schema: {
        tags: [ROUTE_TAG],
        summary: '医院改名（仅系统管理员；同步 username + 撤销 Token + 审计）',
        operationId: 'renameCrmHospital',
        params: CrmIdParamsSchema,
        body: CrmHospitalRenameReqSchema,
      },
      preHandler: [assertHospitalAccountOwnership],
    },
    async (req: any, reply: any) => {
      const result = await HospitalsService.renameHospital(
        id(req),
        req.body.newHospitalName,
        uid(req),
        req,
      )
      return ResponseUtil.success(reply, result)
    },
  )

  /* ---------- 唯一账号 ---------- */

  route.get(
    '/hospitals/:id/account',
    {
      access: { permission: PERMS.HOSPITAL_LIST },
      schema: {
        tags: [ROUTE_TAG],
        summary: '医院唯一账号',
        operationId: 'getCrmHospitalAccount',
        params: CrmIdParamsSchema,
        // STRICT-SPEC §5.3：不声明 raw response schema，由 ResponseUtil.success() 信封自行序列化
      },
      preHandler: [assertHospitalAccountOwnership],
    },
    async (req: any, reply: any) => {
      const account = await HospitalsService.getAccount(id(req))
      if (!account) throw new Error('医院账号不存在')
      return ResponseUtil.success(reply, account)
    },
  )

  route.patch(
    '/hospitals/:id/account',
    {
      access: { permission: PERMS.HOSPITAL_UPDATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '更新医院账号联系方式 / 启停',
        operationId: 'updateCrmHospitalAccount',
        params: CrmIdParamsSchema,
        body: CrmHospitalAccountUpdateReqSchema,
      },
      preHandler: [assertHospitalAccountOwnership],
    },
    async (req: any, reply: any) => {
      const account = await HospitalsService.updateAccountContact(id(req), req.body)
      return ResponseUtil.success(reply, account)
    },
  )

  route.post(
    '/hospitals/:id/account/reset-password',
    {
      access: { permission: PERMS.HOSPITAL_UPDATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '重置医院账号密码',
        operationId: 'resetCrmHospitalAccountPassword',
        params: CrmIdParamsSchema,
        body: CrmHospitalAccountResetPasswordReqSchema,
      },
      preHandler: [assertHospitalAccountOwnership],
    },
    async (req: any, reply: any) => {
      await HospitalsService.resetAccountPassword(id(req), req.body.newPassword)
      return ResponseUtil.success(reply, { ok: true })
    },
  )
}

export default hospitals