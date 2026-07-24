import { Type } from '@sinclair/typebox'
import { CrmPageQuerySchema } from './shared.schema.js'
export const CrmMemberListQuerySchema = CrmPageQuerySchema
export const CrmMemberReqSchema = Type.Object({ numberId: Type.Optional(Type.String({ maxLength: 20 })), name: Type.String({ minLength: 1, maxLength: 50 }), gender: Type.Optional(Type.Integer({ minimum: 0, maximum: 2 })), birthday: Type.Optional(Type.String({ format: 'date' })), address: Type.Optional(Type.String({ maxLength: 255 })), mobile: Type.Optional(Type.String({ maxLength: 20 })), project: Type.Optional(Type.String({ maxLength: 255 })), ownerUserId: Type.Optional(Type.Integer({ minimum: 1 })) }, { $id: 'crmMemberReq' })
export const CrmMemberUpdateReqSchema = Type.Partial(CrmMemberReqSchema, { $id: 'crmMemberUpdateReq', minProperties: 1 })
export const CrmMemberRemarkReqSchema = Type.Object({ content: Type.String({ minLength: 1, maxLength: 2000 }) }, { $id: 'crmMemberRemarkReq' })
export type CrmMemberReq = import('@sinclair/typebox').Static<typeof CrmMemberReqSchema>
export type CrmMemberUpdateReq = import('@sinclair/typebox').Static<typeof CrmMemberUpdateReqSchema>
export type CrmMemberListQuery = import('@sinclair/typebox').Static<typeof CrmMemberListQuerySchema>
export type CrmMemberRemarkReq = import('@sinclair/typebox').Static<typeof CrmMemberRemarkReqSchema>
