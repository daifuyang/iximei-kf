/**
 * 派单资源路由。
 *
 * 单一职责:派单列表/详情/状态字典 + 回复 + 跟进。
 *
 * 数据权限(apps/yishan-api/docs/data-scope.md):
 *   - SUPER_ADMIN (lift ALL) → 看全部派单
 *   - HOSPITAL_ACCOUNT (dataScope=4/5 SELF) → 关联自己医院的派单
 *   - 客服/默认 SELF → 自己添加的客户的派单
 *   - rbac preHandler 已写 effectiveDataScope 到 req.currentUser.dataScope
 */

import type { FastifyPluginAsync } from 'fastify'
import { createRouteRegistrar } from '@/core/routes/route-registrar.js'
import { PERMS } from '../../../permissions.js'
import { DispatchesService } from '../../../services/dispatches.service.js'
import { ROUTE_TAG } from '../../../schemas/routes.schema.js'
import {
  CrmDispatchListQuerySchema,
  CrmDispatchLogReqSchema,
  CrmDispatchReplyReqSchema,
  CrmDispatchUpdateSchema,
} from '../../../schemas/dispatches.schema.js'
import { CrmIdParamsSchema } from '../../../schemas/shared.schema.js'
import type { DataScopeCode } from '@/core/repositories/permission.repository.js'

const dispatches: FastifyPluginAsync = async (app) => {
  const route = createRouteRegistrar(app)
  const uid = (req: any) => req.currentUser.id
  const id = (req: any) => Number(req.params.id)
  const roleCodes = (req: any): string[] => req.currentUser?.roleCodes ?? []
  const scope = (req: any): DataScopeCode => req.currentUser?.dataScope ?? 1

  route.get(
    '/dispatches/statuses',
    {
      access: { permission: PERMS.DISPATCH_LIST },
      schema: {
        tags: [ROUTE_TAG],
        summary: '派单状态字典',
        operationId: 'crmV1ListDispatchStatuses',
      },
    },
    async () => DispatchesService.listStatuses(),
  )

  route.get(
    '/dispatches',
    {
      access: { permission: PERMS.DISPATCH_LIST },
      schema: {
        tags: [ROUTE_TAG],
        summary: '派单列表',
        operationId: 'crmV1ListDispatches',
        querystring: CrmDispatchListQuerySchema,
      },
    },
    async (req: any) => DispatchesService.list(req.query, uid(req), roleCodes(req), scope(req)),
  )

  route.get(
    '/dispatches/:id',
    {
      access: { permission: PERMS.DISPATCH_LIST },
      schema: {
        tags: [ROUTE_TAG],
        summary: '派单详情',
        operationId: 'crmV1GetDispatch',
        params: CrmIdParamsSchema,
      },
    },
    async (req: any) => DispatchesService.getById(id(req), uid(req), roleCodes(req), scope(req)),
  )

  route.patch(
    '/dispatches/:id',
    {
      access: { permission: PERMS.DISPATCH_UPDATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '更新派单',
        operationId: 'crmV1UpdateDispatch',
        params: CrmIdParamsSchema,
        body: CrmDispatchUpdateSchema,
      },
    },
    async (req: any) => DispatchesService.update(id(req), req.body, uid(req), roleCodes(req), scope(req)),
  )

  route.post(
    '/dispatches/:id/reply',
    {
      access: { permission: PERMS.DISPATCH_REPLY },
      schema: {
        tags: [ROUTE_TAG],
        summary: '派单回复',
        operationId: 'crmV1AddDispatchReply',
        params: CrmIdParamsSchema,
        body: CrmDispatchReplyReqSchema,
      },
    },
    async (req: any) => DispatchesService.addReply(id(req), req.body, uid(req), roleCodes(req), scope(req)),
  )

  route.post(
    '/dispatches/:id/logs',
    {
      access: { permission: PERMS.DISPATCH_LOG },
      schema: {
        tags: [ROUTE_TAG],
        summary: '派单跟进',
        operationId: 'crmV1AddDispatchLog',
        params: CrmIdParamsSchema,
        body: CrmDispatchLogReqSchema,
      },
    },
    async (req: any) =>
      DispatchesService.addLog(id(req), req.body.content, uid(req), roleCodes(req), scope(req)),
  )

  route.delete(
    '/dispatches/:id',
    {
      access: { permission: PERMS.DISPATCH_DELETE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '删除派单',
        operationId: 'crmV1DeleteDispatch',
        params: CrmIdParamsSchema,
      },
    },
    async (req: any) => DispatchesService.delete(id(req), uid(req), roleCodes(req), scope(req)),
  )
}

export default dispatches
