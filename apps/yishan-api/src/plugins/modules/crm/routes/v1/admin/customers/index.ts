import { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { Type } from '@sinclair/typebox'
import { ResponseUtil } from '../../../../../../../utils/response.js'
import { CrmService, PageQuery } from '../../../../services/crm.service.js'

const customers: FastifyPluginAsync = async (fastify) => {
  fastify.get('/statuses', { schema: { summary: '客户状态', tags: ['crmCustomers'] } }, async (_, reply) => {
    return ResponseUtil.success(reply, await CrmService.listCustomerStatuses())
  })

  fastify.get('/', { schema: { summary: '客户列表', tags: ['crmCustomers'], querystring: Type.Intersect([Type.Ref('crmPageQuery'), Type.Object({ statusId: Type.Optional(Type.Integer()) })]) } }, async (request: FastifyRequest<{ Querystring: PageQuery & { statusId?: number } }>, reply) => {
    const result = await CrmService.listCustomers(request.query, request.currentUser.id)
    return ResponseUtil.paginated(reply, result.list, result.page, result.pageSize, result.total)
  })

  fastify.get('/:id', { schema: { summary: '客户详情', tags: ['crmCustomers'], params: Type.Object({ id: Type.Integer() }) } }, async (request: FastifyRequest<{ Params: { id: number } }>, reply) => {
    const data = await CrmService.getCustomer(request.params.id, request.currentUser.id)
    if (!data) return ResponseUtil.error(reply, 20001, '客户不存在或无权访问')
    return ResponseUtil.success(reply, data)
  })

  fastify.post('/', { schema: { summary: '创建客户', tags: ['crmCustomers'], body: { $ref: 'crmCustomerReq#' } } }, async (request: FastifyRequest<{ Body: any }>, reply) => {
    const data = await CrmService.saveCustomer(request.body, request.currentUser.id)
    return ResponseUtil.success(reply, data, '创建成功')
  })

  fastify.put('/:id', { schema: { summary: '更新客户', tags: ['crmCustomers'], params: Type.Object({ id: Type.Integer() }), body: { $ref: 'crmCustomerUpdateReq#' } } }, async (request: FastifyRequest<{ Params: { id: number }; Body: any }>, reply) => {
    const data = await CrmService.saveCustomer(request.body, request.currentUser.id, request.params.id)
    return ResponseUtil.success(reply, data, '更新成功')
  })

  fastify.post('/:id/dispatch', { schema: { summary: '客户派单', tags: ['crmCustomers'], params: Type.Object({ id: Type.Integer() }), body: Type.Object({ hospitalIds: Type.Array(Type.Integer()), reply: Type.Optional(Type.String()), statusId: Type.Optional(Type.Integer()) }) } }, async (request: FastifyRequest<{ Params: { id: number }; Body: any }>, reply) => {
    const data = await CrmService.dispatchCustomer(request.params.id, request.body, request.currentUser.id)
    return ResponseUtil.success(reply, data, '派单成功')
  })
}

export default customers
