/**
 * 医院后台数据看板 + 未查看派单数 路由。
 *
 * 端点：
 *   - GET /hospital/dashboard/stats
 *       permission: HOSPITAL_DASHBOARD_VIEW
 *       返回该医院的 6 项看板指标（4 个时间桶 + viewed/unviewed）。
 *   - GET /hospital/dispatches/unviewed-count
 *       permission: DISPATCH_LIST
 *       返回该医院未查看派单数（菜单 Badge 实时拉取）。
 *
 * 路由层只做：身份 / 权限前置校验 + 调用 service + 响应封装。
 * 角色门禁（HOSPITAL_ACCOUNT 专属）在 service 里 throw BusinessError。
 *
 * 注：与 `/dispatches` 列表一样用 DISPATCH_LIST 权限（业务动作都是"读派单"）；
 * HOSPITAL_DASHBOARD_VIEW 是新权限点，专门用于看板页入口。
 */

import type { FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import { createRouteRegistrar } from '@/core/routes/route-registrar.js'
import { ResponseUtil } from '@/utils/response.js'
import { PERMS } from '../../../permissions.js'
import { HospitalDashboardService } from '../../../services/hospital-dashboard.service.js'
import { ROUTE_TAG } from '../../../schemas/routes.schema.js'
import {
  CrmHospitalDashboardRespSchema,
  CrmHospitalUnviewedCountRespSchema,
} from '../../../schemas/hospital-dashboard.schema.js'

const hospitalDashboard: FastifyPluginAsync = async (app) => {
  const route = createRouteRegistrar(app)

  // Register once so $ref can resolve via $id in OpenAPI generation.
  app.addSchema(CrmHospitalDashboardRespSchema)
  app.addSchema(CrmHospitalUnviewedCountRespSchema)

  const uid = (req: any) => req.currentUser.id
  const roleIds = (req: any): number[] => req.currentUser?.roleIds ?? []

  route.get(
    '/hospital/dashboard/stats',
    {
      access: { permission: PERMS.HOSPITAL_DASHBOARD_VIEW },
      schema: {
        tags: [ROUTE_TAG],
        summary: '医院后台数据看板',
        operationId: 'getCrmHospitalDashboardStats',
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            code: Type.Integer(),
            message: Type.String(),
            data: CrmHospitalDashboardRespSchema,
          }),
        },
      },
    },
    async (req: any, reply: any) => {
      const result = await HospitalDashboardService.getStats(uid(req), roleIds(req))
      return ResponseUtil.success(reply, result)
    },
  )

  route.get(
    '/hospital/dispatches/unviewed-count',
    {
      access: { permission: PERMS.DISPATCH_LIST },
      schema: {
        tags: [ROUTE_TAG],
        summary: '医院账号未查看派单数量（菜单 Badge 用）',
        operationId: 'getCrmHospitalUnviewedDispatchCount',
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            code: Type.Integer(),
            message: Type.String(),
            data: CrmHospitalUnviewedCountRespSchema,
          }),
        },
      },
    },
    async (req: any, reply: any) => {
      const result = await HospitalDashboardService.getUnviewedCount(uid(req), roleIds(req))
      return ResponseUtil.success(reply, result)
    },
  )
}

export default hospitalDashboard