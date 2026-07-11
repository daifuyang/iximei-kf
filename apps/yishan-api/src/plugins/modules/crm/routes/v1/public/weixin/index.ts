import { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { Type } from '@sinclair/typebox'
import { ResponseUtil } from '../../../../../../../utils/response.js'
import { CrmService } from '../../../../services/crm.service.js'

const weixin: FastifyPluginAsync = async (fastify) => {
  fastify.get('/bind', { schema: { summary: '医院微信绑定', tags: ['crmWeixin'], querystring: Type.Object({ id: Type.Integer(), hospital_id: Type.String(), openid: Type.String() }) } }, async (request: FastifyRequest<{ Querystring: { id: number; hospital_id: string; openid: string } }>, reply) => {
    const data = await CrmService.bindWechatOpenid(request.query.id, request.query.hospital_id, request.query.openid)
    return ResponseUtil.success(reply, data, '绑定成功')
  })
}

export default weixin
