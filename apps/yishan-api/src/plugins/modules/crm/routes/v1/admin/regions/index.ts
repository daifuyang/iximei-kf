import { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { Type } from '@sinclair/typebox'
import { ResponseUtil } from '../../../../../../../utils/response.js'
import { CrmService } from '../../../../services/crm.service.js'

const regions: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { schema: { summary: '地区列表', tags: ['crmRegions'], querystring: Type.Object({ parentId: Type.Optional(Type.Integer({ default: 0 })) }) } }, async (request: FastifyRequest<{ Querystring: { parentId?: number } }>, reply) => {
    return ResponseUtil.success(reply, await CrmService.listRegions(request.query.parentId || 0))
  })
}

export default regions
