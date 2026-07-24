/**
 * 会员顾客资源路由。
 *
 * 单一职责：会员顾客 + 备注。
 *
 * 数据权限：
 *   - SUPER_ADMIN / ADMIN (dataScope=1) → 看全部
 *   - 其他 (dataScope=4 SELF 等) → 只看自己 owner 的（ownerUserId === currentUser.id）
 *   - rbac preHandler 已把 effectiveDataScope 写到 req.currentUser.dataScope
 */

import type { FastifyPluginAsync } from 'fastify'
import { createRouteRegistrar } from '@/core/routes/route-registrar.js'
import { PERMS } from '../../../permissions.js'
import { MembersService } from '../../../services/members.service.js'
import { ROUTE_TAG } from '../../../schemas/routes.schema.js'
import {
  CrmMemberListQuerySchema,
  CrmMemberRemarkReqSchema,
  CrmMemberReqSchema,
  CrmMemberUpdateReqSchema,
} from '../../../schemas/members.schema.js'
import { CrmIdParamsSchema } from '../../../schemas/shared.schema.js'
import type { DataScopeCode } from '@/core/repositories/permission.repository.js'

const members: FastifyPluginAsync = async (app) => {
  const route = createRouteRegistrar(app)
  const uid = (req: any) => req.currentUser.id
  const id = (req: any) => Number(req.params.id)
  const scope = (req: any): DataScopeCode => req.currentUser?.dataScope ?? 1

  route.get(
    '/members',
    {
      access: { permission: PERMS.MEMBER_LIST },
      schema: {
        tags: [ROUTE_TAG],
        summary: '会员顾客列表',
        operationId: 'crmV1ListMembers',
        querystring: CrmMemberListQuerySchema,
      },
    },
    async (req: any) => MembersService.list(req.query, uid(req), scope(req)),
  )

  route.get(
    '/members/:id',
    {
      access: { permission: PERMS.MEMBER_LIST },
      schema: {
        tags: [ROUTE_TAG],
        summary: '会员详情',
        operationId: 'crmV1GetMember',
        params: CrmIdParamsSchema,
      },
    },
    async (req: any) => MembersService.getById(id(req), uid(req), scope(req), true),
  )

  route.post(
    '/members',
    {
      access: { permission: PERMS.MEMBER_CREATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '新建会员',
        operationId: 'crmV1CreateMember',
        body: CrmMemberReqSchema,
      },
    },
    async (req: any) => MembersService.save(req.body, uid(req), scope(req)),
  )

  route.patch(
    '/members/:id',
    {
      access: { permission: PERMS.MEMBER_UPDATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '更新会员',
        operationId: 'crmV1UpdateMember',
        params: CrmIdParamsSchema,
        body: CrmMemberUpdateReqSchema,
      },
    },
    async (req: any) => MembersService.save(req.body, uid(req), scope(req), id(req)),
  )

  route.post(
    '/members/:id/remarks',
    {
      access: { permission: PERMS.MEMBER_REMARK },
      schema: {
        tags: [ROUTE_TAG],
        summary: '会员备注',
        operationId: 'crmV1AddMemberRemark',
        params: CrmIdParamsSchema,
        body: CrmMemberRemarkReqSchema,
      },
    },
    async (req: any) => MembersService.addRemark(id(req), req.body.content, uid(req), scope(req)),
  )

  route.delete(
    '/members/:id',
    {
      access: { permission: PERMS.MEMBER_DELETE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '删除会员',
        operationId: 'crmV1DeleteMember',
        params: CrmIdParamsSchema,
      },
    },
    async (req: any) => MembersService.delete(id(req), uid(req), scope(req)),
  )
}

export default members
