import { Type } from '@sinclair/typebox'
import { CrmPageQuerySchema } from './shared.schema.js'
export const CrmCustomerListQuerySchema = Type.Intersect([CrmPageQuerySchema, Type.Object({ statusId: Type.Optional(Type.Integer({ minimum: 1 })), ownerUserId: Type.Optional(Type.Integer({ minimum: 1 })) })], { $id: 'crmCustomerListQuery' })
export const CrmCustomerReqSchema = Type.Object({ numberId: Type.Optional(Type.String({ maxLength: 20 })), name: Type.String({ minLength: 1, maxLength: 50 }), gender: Type.Optional(Type.Integer({ minimum: 0, maximum: 2 })), birthday: Type.Optional(Type.String({ format: 'date' })), telphone: Type.Optional(Type.String({ maxLength: 20 })), mobile: Type.Optional(Type.String({ maxLength: 20 })), qq: Type.Optional(Type.String({ maxLength: 50 })), wechat: Type.Optional(Type.String({ maxLength: 100 })), provinceId: Type.Optional(Type.Integer()), cityId: Type.Optional(Type.Integer()), districtId: Type.Optional(Type.Integer()), address: Type.Optional(Type.String({ maxLength: 255 })), plastic: Type.Optional(Type.String({ maxLength: 255 })), statusId: Type.Optional(Type.Integer({ minimum: 1 })), remark: Type.Optional(Type.String({ maxLength: 5000 })), ownerUserId: Type.Optional(Type.Integer({ minimum: 1 })) }, { $id: 'crmCustomerReq' })
export const CrmCustomerUpdateReqSchema = Type.Partial(CrmCustomerReqSchema, { $id: 'crmCustomerUpdateReq', minProperties: 1 })
export const CrmCustomerDispatchReqSchema = Type.Object({ hospitalIds: Type.Array(Type.Integer({ minimum: 1 }), { minItems: 1, maxItems: 50 }), reply: Type.Optional(Type.String({ maxLength: 2000 })), statusId: Type.Optional(Type.Integer({ minimum: 1 })) }, { $id: 'crmCustomerDispatchReq' })
export const CrmCustomerRemarkReqSchema = Type.Object({ content: Type.String({ minLength: 1, maxLength: 2000 }) }, { $id: 'crmCustomerRemarkReq' })
export type CrmCustomerReq = import('@sinclair/typebox').Static<typeof CrmCustomerReqSchema>
export type CrmCustomerUpdateReq = import('@sinclair/typebox').Static<typeof CrmCustomerUpdateReqSchema>
export type CrmCustomerListQuery = import('@sinclair/typebox').Static<typeof CrmCustomerListQuerySchema>
export type CrmCustomerDispatchReq = import('@sinclair/typebox').Static<typeof CrmCustomerDispatchReqSchema>
export type CrmCustomerRemarkReq = import('@sinclair/typebox').Static<typeof CrmCustomerRemarkReqSchema>
