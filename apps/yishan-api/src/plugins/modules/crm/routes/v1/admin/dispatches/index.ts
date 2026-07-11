import { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { Type } from '@sinclair/typebox'
import { ResponseUtil } from '../../../../../../../utils/response.js'
import { CrmService, PageQuery } from '../../../../services/crm.service.js'

const dispatches: FastifyPluginAsync = async (fastify) => {
  fastify.get('/statuses', { schema: { summary: '派单状态', tags: ['crmDispatches'] } }, async (_, reply) => {
    return ResponseUtil.success(reply, await CrmService.listDispatchStatuses())
  })

  fastify.get('/', { schema: { summary: '派单列表', tags: ['crmDispatches'], querystring: Type.Intersect([Type.Ref('crmPageQuery'), Type.Object({ statusId: Type.Optional(Type.Integer()) })]) } }, async (request: FastifyRequest<{ Querystring: PageQuery & { statusId?: number } }>, reply) => {
    const result = await CrmService.listDispatches(request.query, request.currentUser.id)
    return ResponseUtil.paginated(reply, result.list, result.page, result.pageSize, result.total)
  })

  fastify.get('/export', { schema: { summary: '导出派单', tags: ['crmDispatches'], querystring: { $ref: 'crmPageQuery#' } } }, async (request: FastifyRequest<{ Querystring: PageQuery }>, reply) => {
    const query = request.query as PageQuery
    const result = await CrmService.listDispatches({ ...query, pageSize: 0 }, request.currentUser.id)
    const header = ['会员编号', '派单医院', '客户名称', '性别', '客户电话', '客户手机', '详细地址', '整形项目', '派单时间', '派单客服', '当前状态']
    const rows = result.list.map((item: any) => [
      item.customer?.numberId,
      item.hospital?.hospitalName,
      item.customer?.name,
      item.customer?.gender === 1 ? '女' : '男',
      item.customer?.telphone,
      item.customer?.mobile,
      item.customer?.address,
      item.customer?.plastic,
      item.createdAt?.toISOString?.() || item.createdAt,
      item.customer?.owner?.username || item.customer?.owner?.realName,
      item.status?.name,
    ])
    const csv = [header, ...rows].map((row) => row.map((cell: unknown) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    return reply.header('content-type', 'text/csv; charset=utf-8').header('content-disposition', 'attachment; filename="dispatches.csv"').send(`\ufeff${csv}`)
  })

  fastify.get('/:id', { schema: { summary: '派单详情', tags: ['crmDispatches'], params: Type.Object({ id: Type.Integer() }) } }, async (request: FastifyRequest<{ Params: { id: number } }>, reply) => {
    const data = await CrmService.getDispatch(request.params.id, request.currentUser.id)
    if (!data) return ResponseUtil.error(reply, 20001, '派单不存在或无权访问')
    return ResponseUtil.success(reply, data)
  })

  fastify.put('/:id', { schema: { summary: '更新派单', tags: ['crmDispatches'], params: Type.Object({ id: Type.Integer() }), body: { $ref: 'crmDispatchReq#' } } }, async (request: FastifyRequest<{ Params: { id: number }; Body: any }>, reply) => {
    const data = await CrmService.updateDispatch(request.params.id, request.body, request.currentUser.id)
    return ResponseUtil.success(reply, data, '更新成功')
  })

  fastify.post('/:id/replies', { schema: { summary: '派单回复', tags: ['crmDispatches'], params: Type.Object({ id: Type.Integer() }), body: Type.Object({ content: Type.Optional(Type.String()), receiveQq: Type.Optional(Type.String()), receiveWechat: Type.Optional(Type.String()), image: Type.Optional(Type.String()), statusId: Type.Optional(Type.Integer()) }) } }, async (request: FastifyRequest<{ Params: { id: number }; Body: any }>, reply) => {
    const data = await CrmService.addDispatchReply(request.params.id, request.body, request.currentUser.id)
    return ResponseUtil.success(reply, data, '回复成功')
  })

  fastify.post('/:id/logs', { schema: { summary: '添加跟进日志', tags: ['crmDispatches'], params: Type.Object({ id: Type.Integer() }), body: Type.Object({ content: Type.String({ minLength: 1 }) }) } }, async (request: FastifyRequest<{ Params: { id: number }; Body: { content: string } }>, reply) => {
    const data = await CrmService.addDispatchLog(request.params.id, request.body.content, request.currentUser.id)
    return ResponseUtil.success(reply, data, '添加成功')
  })
}

export default dispatches
