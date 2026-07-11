import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { Type } from '@sinclair/typebox'
import { ResponseUtil } from '../../../../../../../utils/response.js'
import { CrmService, PageQuery } from '../../../../services/crm.service.js'

const hospitals: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { schema: { summary: '医院列表', tags: ['crmHospitals'], querystring: { $ref: 'crmPageQuery#' } } }, async (request: FastifyRequest<{ Querystring: PageQuery & { status?: string } }>, reply: FastifyReply) => {
    const result = await CrmService.listHospitals(request.query)
    return ResponseUtil.paginated(reply, result.list, result.page, result.pageSize, result.total, '获取成功')
  })

  fastify.get('/:id', { schema: { summary: '医院详情', tags: ['crmHospitals'], params: Type.Object({ id: Type.Integer() }) } }, async (request: FastifyRequest<{ Params: { id: number } }>, reply) => {
    const data = await CrmService.getHospital(request.params.id)
    if (!data) return ResponseUtil.error(reply, 20001, '医院不存在')
    return ResponseUtil.success(reply, data)
  })

  fastify.post('/', { schema: { summary: '创建医院', tags: ['crmHospitals'], body: { $ref: 'crmHospitalReq#' } } }, async (request: FastifyRequest<{ Body: any }>, reply) => {
    const data = await CrmService.saveHospital(request.body, request.currentUser.id)
    return ResponseUtil.success(reply, data, '创建成功')
  })

  fastify.put('/:id', { schema: { summary: '更新医院', tags: ['crmHospitals'], params: Type.Object({ id: Type.Integer() }), body: { $ref: 'crmHospitalUpdateReq#' } } }, async (request: FastifyRequest<{ Params: { id: number }; Body: any }>, reply) => {
    const data = await CrmService.saveHospital(request.body, request.currentUser.id, request.params.id)
    return ResponseUtil.success(reply, data, '更新成功')
  })

  fastify.delete('/:id', { schema: { summary: '删除医院', tags: ['crmHospitals'], params: Type.Object({ id: Type.Integer() }) } }, async (request: FastifyRequest<{ Params: { id: number } }>, reply) => {
    await CrmService.deleteHospital(request.params.id, request.currentUser.id)
    return ResponseUtil.success(reply, { id: request.params.id }, '删除成功')
  })

  fastify.get('/search/options', { schema: { summary: '医院搜索', tags: ['crmHospitals'], querystring: Type.Object({ keyword: Type.Optional(Type.String()), provinceId: Type.Optional(Type.Integer()), cityId: Type.Optional(Type.Integer()), districtId: Type.Optional(Type.Integer()) }) } }, async (request: FastifyRequest<{ Querystring: any }>, reply) => {
    const query = request.query as any
    const result = await CrmService.listHospitals({ pageSize: 50, keyword: query.keyword })
    return ResponseUtil.success(reply, result.list)
  })
}

export default hospitals
