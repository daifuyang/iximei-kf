import type { FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import { createRouteRegistrar } from '@/core/routes/route-registrar.js'
import { ResponseUtil } from '@/utils/response.js'
import { PERMS } from '../../../permissions.js'
import { ROUTE_TAG } from '../../../schemas/routes.schema.js'
import { DashboardService } from '../../../services/dashboard.service.js'
import { DashboardStatsSchema } from '../../../schemas/dashboard.schema.js'
import {
  CrmHospitalRankingsItemSchema,
  CrmHospitalRankingsRespSchema,
} from '../../../schemas/dashboard.schema.js'
import { ROLE_IDS } from '@/constants/permission-codes.js'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

const dashboard: FastifyPluginAsync = async (app) => {
  const route = createRouteRegistrar(app)

  // Register schema once so $ref can resolve via $id
  app.addSchema(DashboardStatsSchema)
  app.addSchema(CrmHospitalRankingsRespSchema)
  app.addSchema(CrmHospitalRankingsItemSchema)

  route.get(
    '/dashboard/stats',
    {
      access: { permission: PERMS.DASHBOARD_VIEW },
      schema: {
        tags: [ROUTE_TAG],
        summary: 'CRM 数据看板统计',
        operationId: 'getCrmDashboardStats',
        querystring: Type.Object({
          startDate: Type.Optional(Type.String()),
          endDate: Type.Optional(Type.String()),
          hospitalId: Type.Optional(Type.Integer({ minimum: 1 })),
        }),
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            code: Type.Integer(),
            message: Type.String(),
            data: DashboardStatsSchema,
          }),
        },
      },
    },
    async (req: any, reply: any) => {
      const { startDate, endDate, hospitalId } = req.query as { startDate?: string; endDate?: string; hospitalId?: number }

      // 参数校验：startDate/endDate 必须同时传递或同时省略
      if ((startDate && !endDate) || (!startDate && endDate)) {
        return reply.status(400).send({
          success: false,
          message: 'startDate 和 endDate 必须同时传递或同时省略',
        })
      }

      // 参数校验：日期格式必须为 YYYY-MM-DD
      if (startDate && endDate) {
        if (!DATE_REGEX.test(startDate) || !DATE_REGEX.test(endDate)) {
          return reply.status(400).send({
            success: false,
            message: '日期格式无效，必须为 YYYY-MM-DD',
          })
        }

        // 校验 startDate <= endDate
        if (startDate > endDate) {
          return reply.status(400).send({
            success: false,
            message: 'startDate 不能晚于 endDate',
          })
        }
      }

      // 客服角色不接收 hospitalId 参数
      const roleIds: number[] = req.currentUser?.roleIds ?? []
      const finalQuery = roleIds.includes(ROLE_IDS.CUSTOMER_SERVICE)
        ? { startDate, endDate }
        : { startDate, endDate, hospitalId }

      const data = await DashboardService.getStats(
        req.currentUser.id,
        roleIds,
        req.currentUser.dataScope ?? 'ALL',
        finalQuery,
      )
      return ResponseUtil.success(reply, data)
    },
  )
}

export default dashboard
