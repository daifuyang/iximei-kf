import { Type } from '@sinclair/typebox'
import { CrmPageQuerySchema } from './shared.schema.js'
export const CrmDispatchListQuerySchema = Type.Intersect([CrmPageQuerySchema, Type.Object({ statusId: Type.Optional(Type.Integer({ minimum: 1 })) })], { $id: 'crmDispatchListQuery' })
export const CrmDispatchUpdateSchema = Type.Object({ hospitalId: Type.Optional(Type.Integer({ minimum: 1 })), statusId: Type.Optional(Type.Integer({ minimum: 1 })), image: Type.Optional(Type.String({ maxLength: 500 })), receiveQq: Type.Optional(Type.String({ maxLength: 50 })), receiveWechat: Type.Optional(Type.String({ maxLength: 100 })), finishedAt: Type.Optional(Type.String({ format: 'date-time' })) }, { $id: 'crmDispatchUpdate', minProperties: 1 })
export const CrmDispatchReplyReqSchema = Type.Object({ content: Type.Optional(Type.String({ maxLength: 2000 })), receiveQq: Type.Optional(Type.String({ maxLength: 50 })), receiveWechat: Type.Optional(Type.String({ maxLength: 100 })), image: Type.Optional(Type.String({ maxLength: 500 })), statusId: Type.Optional(Type.Integer({ minimum: 1 })) }, { $id: 'crmDispatchReplyReq' })
export const CrmDispatchLogReqSchema = Type.Object({ content: Type.String({ minLength: 1, maxLength: 2000 }) }, { $id: 'crmDispatchLogReq' })
export type CrmDispatchListQuery = import('@sinclair/typebox').Static<typeof CrmDispatchListQuerySchema>
export type CrmDispatchUpdate = import('@sinclair/typebox').Static<typeof CrmDispatchUpdateSchema>
export type CrmDispatchReplyReq = import('@sinclair/typebox').Static<typeof CrmDispatchReplyReqSchema>
export type CrmDispatchLogReq = import('@sinclair/typebox').Static<typeof CrmDispatchLogReqSchema>
