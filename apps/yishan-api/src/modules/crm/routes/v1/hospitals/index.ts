/**
 * 医院资源路由。
 *
 * 单一职责：医院档案 + 医院账号管理的所有 endpoint。
 * 路由 prefix 由 module-loader 推导为 `/api/crm/v1`，本文件只声明子路径。
 */

import type { FastifyPluginAsync } from 'fastify'
import { createRouteRegistrar } from '@/core/routes/route-registrar.js'
import { ResponseUtil } from '@/utils/response.js'
import { PERMS } from '../../../permissions.js'
import { HospitalsService } from '../../../services/hospitals.service.js'
import { HospitalsRepository } from '../../../repositories/hospitals.repository.js'
import { ROUTE_TAG } from '../../../schemas/routes.schema.js'
import {
  CrmHospitalAccountAssignReqSchema,
  CrmHospitalAccountCreateReqSchema,
  CrmHospitalAccountUpdateReqSchema,
  CrmHospitalReqSchema,
  CrmHospitalSearchQuerySchema,
  CrmHospitalUpdateReqSchema,
} from '../../../schemas/hospitals.schema.js'
import {
  CrmHospitalAccountParamsSchema,
  CrmIdParamsSchema,
  CrmPageQuerySchema,
} from '../../../schemas/shared.schema.js'

const SUPER_ADMIN_CODE = 'super_admin'
const HOSPITAL_ACCOUNT_CODE = 'hospital_account'

const hospitals: FastifyPluginAsync = async (app) => {
  const route = createRouteRegistrar(app)
  const uid = (req: any) => req.currentUser.id
  const id = (req: any) => Number(req.params.id)
  const userId = (req: any) => Number(req.params.userId)
  void HospitalsService // 当前 handler 通过静态方法访问，保留 import 用于将来的实例化迁移

  /** 为 hospital_account 角色注入可访问医院 ID 列表；客服角色不提供医院搜索 */
  async function resolveHospitalIds(req: any): Promise<number[] | undefined> {
    const roleCodes: string[] = req.currentUser?.roleCodes ?? []
    if (roleCodes.includes(SUPER_ADMIN_CODE)) return undefined // 无限制
    if (roleCodes.includes(HOSPITAL_ACCOUNT_CODE)) {
      const ids = await HospitalsRepository.accessibleHospitalIds(req.currentUser.id)
      return ids.map((x: any) => x.hospitalId)
    }
    // 客服等角色不提供医院搜索，返回无结果 ID
    return [-1]
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
    async (_req: any, reply: any) => {
      const result = await HospitalsService.list(_req.query)
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
        summary: '创建医院',
        operationId: 'createCrmHospital',
        body: CrmHospitalReqSchema,
      },
    },
    async (req: any, reply: any) => {
      const result = await HospitalsService.save(req.body, uid(req))
      return ResponseUtil.success(reply, result)
    },
  )

  route.patch(
    '/hospitals/:id',
    {
      access: { permission: PERMS.HOSPITAL_UPDATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '更新医院',
        operationId: 'updateCrmHospital',
        params: CrmIdParamsSchema,
        body: CrmHospitalUpdateReqSchema,
      },
    },
    async (req: any, reply: any) => {
      const result = await HospitalsService.save(req.body, uid(req), id(req))
      return ResponseUtil.success(reply, result)
    },
  )

  route.delete(
    '/hospitals/:id',
    {
      access: { permission: PERMS.HOSPITAL_DELETE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '删除医院',
        operationId: 'deleteCrmHospital',
        params: CrmIdParamsSchema,
      },
    },
    async (req: any, reply: any) => {
      const result = await HospitalsService.delete(id(req), uid(req))
      return ResponseUtil.success(reply, result)
    },
  )

  /* ---------- 医院账号 ---------- */

  route.get(
    '/hospitals/:id/accounts',
    {
      access: { permission: PERMS.HOSPITAL_LIST },
      schema: {
        tags: [ROUTE_TAG],
        summary: '医院账号列表',
        operationId: 'listCrmHospitalAccounts',
        params: CrmIdParamsSchema,
      },
    },
    async (req: any, reply: any) => {
      const result = await HospitalsService.listAccounts(id(req))
      return ResponseUtil.success(reply, result)
    },
  )

  route.post(
    '/hospitals/:id/accounts',
    {
      access: { permission: PERMS.HOSPITAL_UPDATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '新建并分配医院账号',
        operationId: 'createCrmHospitalAccount',
        params: CrmIdParamsSchema,
        body: CrmHospitalAccountCreateReqSchema,
      },
    },
    async (req: any, reply: any) => {
      const result = await HospitalsService.createAccount(id(req), req.body, uid(req))
      return ResponseUtil.success(reply, result)
    },
  )

  route.post(
    '/hospitals/:id/accounts/assign',
    {
      access: { permission: PERMS.HOSPITAL_UPDATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '分配已有用户到医院',
        operationId: 'assignCrmHospitalAccount',
        params: CrmIdParamsSchema,
        body: CrmHospitalAccountAssignReqSchema,
      },
    },
    async (req: any, reply: any) => {
      const result = await HospitalsService.assignAccount(id(req), req.body, uid(req))
      return ResponseUtil.success(reply, result)
    },
  )

  route.patch(
    '/hospitals/:id/accounts/:userId',
    {
      access: { permission: PERMS.HOSPITAL_UPDATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '更新医院账号',
        operationId: 'updateCrmHospitalAccount',
        params: CrmHospitalAccountParamsSchema,
        body: CrmHospitalAccountUpdateReqSchema,
      },
    },
    async (req: any, reply: any) => {
      const result = await HospitalsService.updateAccount(id(req), userId(req), req.body, uid(req))
      return ResponseUtil.success(reply, result)
    },
  )

  route.delete(
    '/hospitals/:id/accounts/:userId',
    {
      access: { permission: PERMS.HOSPITAL_UPDATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '解除医院账号',
        operationId: 'deleteCrmHospitalAccount',
        params: CrmHospitalAccountParamsSchema,
      },
    },
    async (req: any, reply: any) => {
      const result = await HospitalsService.deleteAccount(id(req), userId(req), uid(req))
      return ResponseUtil.success(reply, result)
    },
  )
}

export default hospitals
