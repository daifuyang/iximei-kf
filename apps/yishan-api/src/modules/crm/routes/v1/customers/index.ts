/**
 * 客户资源路由。
 *
 * 单一职责：客户档案 + 客户状态字典 + 派单 + 备注（占位）。
 */

import type { FastifyPluginAsync } from 'fastify'
import { createRouteRegistrar } from '@/core/routes/route-registrar.js'
import { PERMS } from '../../../permissions.js'
import { CustomersService } from '../../../services/customers.service.js'
import { ROUTE_TAG } from '../../../schemas/routes.schema.js'
import {
  CrmCustomerDispatchReqSchema,
  CrmCustomerListQuerySchema,
  CrmCustomerRemarkReqSchema,
  CrmCustomerReqSchema,
  CrmCustomerUpdateReqSchema,
} from '../../../schemas/customers.schema.js'
import { CrmIdParamsSchema } from '../../../schemas/shared.schema.js'

const customers: FastifyPluginAsync = async (app) => {
  const route = createRouteRegistrar(app)
  const uid = (req: any) => req.currentUser.id
  const id = (req: any) => Number(req.params.id)
  void CustomersService

  route.get(
    '/customers/statuses',
    {
      access: { permission: PERMS.CUSTOMER_LIST },
      schema: {
        tags: [ROUTE_TAG],
        summary: '客户状态字典',
        operationId: 'crmV1ListCustomerStatuses',
      },
    },
    async () => CustomersService.listStatuses(),
  )

  route.get(
    '/customers',
    {
      access: { permission: PERMS.CUSTOMER_LIST },
      schema: {
        tags: [ROUTE_TAG],
        summary: '客户列表',
        operationId: 'crmV1ListCustomers',
        querystring: CrmCustomerListQuerySchema,
      },
    },
    async (req: any) => CustomersService.list(req.query, uid(req)),
  )

  route.get(
    '/customers/:id',
    {
      access: { permission: PERMS.CUSTOMER_LIST },
      schema: {
        tags: [ROUTE_TAG],
        summary: '客户详情',
        operationId: 'crmV1GetCustomer',
        params: CrmIdParamsSchema,
      },
    },
    async (req: any) => CustomersService.getById(id(req), uid(req)),
  )

  route.post(
    '/customers',
    {
      access: { permission: PERMS.CUSTOMER_CREATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '新建客户',
        operationId: 'crmV1CreateCustomer',
        body: CrmCustomerReqSchema,
      },
    },
    async (req: any) => CustomersService.save(req.body, uid(req)),
  )

  route.patch(
    '/customers/:id',
    {
      access: { permission: PERMS.CUSTOMER_UPDATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '更新客户',
        operationId: 'crmV1UpdateCustomer',
        params: CrmIdParamsSchema,
        body: CrmCustomerUpdateReqSchema,
      },
    },
    async (req: any) => CustomersService.save(req.body, uid(req), id(req)),
  )

  route.post(
    '/customers/:id/dispatch',
    {
      access: { permission: PERMS.CUSTOMER_DISPATCH },
      schema: {
        tags: [ROUTE_TAG],
        summary: '客户派单',
        operationId: 'crmV1DispatchCustomer',
        params: CrmIdParamsSchema,
        body: CrmCustomerDispatchReqSchema,
      },
    },
    async (req: any) => CustomersService.dispatch(id(req), req.body, uid(req)),
  )

  route.post(
    '/customers/:id/remarks',
    {
      access: { permission: PERMS.CUSTOMER_UPDATE },
      schema: {
        tags: [ROUTE_TAG],
        summary: '客户备注（占位）',
        operationId: 'crmV1AddCustomerRemark',
        params: CrmIdParamsSchema,
        body: CrmCustomerRemarkReqSchema,
      },
    },
    async () => ({ ok: true }),
  )
}

export default customers
