import { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { Type } from '@sinclair/typebox'
import { ResponseUtil } from '../../../../../../../utils/response.js'
import { CrmService, PageQuery } from '../../../../services/crm.service.js'

export default (async (fastify) => {
  fastify.get('/', { schema: { summary: '会员列表', tags: ['crmMembers'], querystring: { $ref: 'crmPageQuery#' } } }, async (request: FastifyRequest<{ Querystring: PageQuery }>, reply) => {
    const result = await CrmService.listMembers(request.query, request.currentUser.id)
    return ResponseUtil.paginated(reply, result.list, result.page, result.pageSize, result.total)
  })

  fastify.get('/:id', { schema: { summary: '会员详情', tags: ['crmMembers'], params: Type.Object({ id: Type.Integer() }) } }, async (request: FastifyRequest<{ Params: { id: number } }>, reply) => {
    const data = await CrmService.getMember(request.params.id, request.currentUser.id, true)
    if (!data) return ResponseUtil.error(reply, 20001, '会员不存在或无权访问')
    return ResponseUtil.success(reply, data)
  })

  fastify.post('/', { schema: { summary: '创建会员', tags: ['crmMembers'], body: { $ref: 'crmMemberReq#' } } }, async (request: FastifyRequest<{ Body: any }>, reply) => {
    const data = await CrmService.saveMember(request.body, request.currentUser.id)
    return ResponseUtil.success(reply, data, '创建成功')
  })

  fastify.put('/:id', { schema: { summary: '更新会员', tags: ['crmMembers'], params: Type.Object({ id: Type.Integer() }), body: { $ref: 'crmMemberUpdateReq#' } } }, async (request: FastifyRequest<{ Params: { id: number }; Body: any }>, reply) => {
    const data = await CrmService.saveMember(request.body, request.currentUser.id, request.params.id)
    return ResponseUtil.success(reply, data, '更新成功')
  })

  fastify.post('/:id/remarks', { schema: { summary: '添加会员备注', tags: ['crmMembers'], params: Type.Object({ id: Type.Integer() }), body: Type.Object({ content: Type.String({ minLength: 1 }) }) } }, async (request: FastifyRequest<{ Params: { id: number }; Body: { content: string } }>, reply) => {
    const data = await CrmService.addMemberRemark(request.params.id, request.body.content, request.currentUser.id)
    return ResponseUtil.success(reply, data, '添加成功')
  })
}) satisfies FastifyPluginAsync
