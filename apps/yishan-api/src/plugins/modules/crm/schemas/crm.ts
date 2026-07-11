import { FastifyInstance } from 'fastify'
import { Type } from '@sinclair/typebox'

const CrmPageQuery = Type.Object(
  {
    page: Type.Optional(Type.Integer({ default: 1, minimum: 1 })),
    pageSize: Type.Optional(Type.Integer({ default: 10, minimum: 0 })),
    keyword: Type.Optional(Type.String()),
    startTime: Type.Optional(Type.String({ format: 'date-time' })),
    endTime: Type.Optional(Type.String({ format: 'date-time' })),
  },
  { $id: 'crmPageQuery' }
)

const CrmIdResp = Type.Object({ id: Type.Number() }, { $id: 'crmIdResp' })

const CrmHospitalReq = Type.Object(
  {
    accountUserId: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
    hospitalName: Type.String({ minLength: 1, maxLength: 100 }),
    provinceId: Type.Optional(Type.Integer()),
    cityId: Type.Optional(Type.Integer()),
    districtId: Type.Optional(Type.Integer()),
    hospitalAddress: Type.Optional(Type.String()),
    hospitalPhone: Type.Optional(Type.String()),
    hospitalSelling: Type.Optional(Type.String()),
    hospitalWebsite: Type.Optional(Type.String()),
    hospitalNature: Type.Optional(Type.Integer()),
    doctorName: Type.Optional(Type.String()),
    doctorPhone: Type.Optional(Type.String()),
    doctorQq: Type.Optional(Type.String()),
    receptionName: Type.Optional(Type.String()),
    receptionPhone: Type.Optional(Type.String()),
    receptionQq: Type.Optional(Type.String()),
    busStation: Type.Optional(Type.String()),
    busAddress: Type.Optional(Type.String()),
    subwayStation: Type.Optional(Type.String()),
    subwayAddress: Type.Optional(Type.String()),
    taxiFare: Type.Optional(Type.String()),
    vipDiscount: Type.Optional(Type.String()),
    returnPoint: Type.Optional(Type.String()),
    hospitalIntroduction: Type.Optional(Type.String()),
    contractPhotos: Type.Optional(Type.Any()),
    wechatOpenid: Type.Optional(Type.String()),
    status: Type.Optional(Type.Integer()),
  },
  { $id: 'crmHospitalReq' }
)
const CrmHospitalUpdateReq = Type.Partial(Type.Omit(CrmHospitalReq, []), { $id: 'crmHospitalUpdateReq' })

const CrmCustomerReq = Type.Object(
  {
    numberId: Type.Optional(Type.String()),
    name: Type.String({ minLength: 1 }),
    gender: Type.Optional(Type.Integer()),
    birthday: Type.Optional(Type.String()),
    telphone: Type.Optional(Type.String()),
    mobile: Type.Optional(Type.String()),
    qq: Type.Optional(Type.String()),
    wechat: Type.Optional(Type.String()),
    provinceId: Type.Optional(Type.Integer()),
    cityId: Type.Optional(Type.Integer()),
    districtId: Type.Optional(Type.Integer()),
    address: Type.Optional(Type.String()),
    plastic: Type.Optional(Type.String()),
    statusId: Type.Optional(Type.Integer()),
    remark: Type.Optional(Type.String()),
    ownerUserId: Type.Optional(Type.Integer()),
  },
  { $id: 'crmCustomerReq' }
)
const CrmCustomerUpdateReq = Type.Partial(Type.Omit(CrmCustomerReq, []), { $id: 'crmCustomerUpdateReq' })

const CrmMemberReq = Type.Object(
  {
    numberId: Type.Optional(Type.String()),
    name: Type.String({ minLength: 1 }),
    gender: Type.Optional(Type.Integer()),
    birthday: Type.Optional(Type.String()),
    address: Type.Optional(Type.String()),
    mobile: Type.Optional(Type.String()),
    project: Type.Optional(Type.String()),
    ownerUserId: Type.Optional(Type.Integer()),
  },
  { $id: 'crmMemberReq' }
)
const CrmMemberUpdateReq = Type.Partial(Type.Omit(CrmMemberReq, []), { $id: 'crmMemberUpdateReq' })

const CrmDispatchReq = Type.Object(
  {
    hospitalId: Type.Optional(Type.Integer()),
    statusId: Type.Optional(Type.Integer()),
    image: Type.Optional(Type.String()),
    receiveQq: Type.Optional(Type.String()),
    receiveWechat: Type.Optional(Type.String()),
    finishedAt: Type.Optional(Type.String()),
    createdAt: Type.Optional(Type.String()),
  },
  { $id: 'crmDispatchReq' }
)

const CrmHospitalAccountCreateReq = Type.Object(
  {
    username: Type.String({ minLength: 1, maxLength: 50 }),
    phone: Type.String({ minLength: 1, maxLength: 20 }),
    realName: Type.Optional(Type.String()),
    email: Type.Optional(Type.String()),
    password: Type.String({ minLength: 1 }),
    role: Type.Optional(Type.String({ default: 'member' })),
    remark: Type.Optional(Type.String()),
  },
  { $id: 'crmHospitalAccountCreateReq' }
)

const CrmHospitalAccountAssignReq = Type.Object(
  {
    userId: Type.Integer(),
    role: Type.Optional(Type.String({ default: 'member' })),
    remark: Type.Optional(Type.String()),
  },
  { $id: 'crmHospitalAccountAssignReq' }
)

const CrmHospitalAccountUpdateReq = Type.Object(
  {
    role: Type.Optional(Type.String()),
    status: Type.Optional(Type.Integer()),
    remark: Type.Optional(Type.String()),
    // 可选同步修改 sys_user 字段,避免前端需要在两个接口之间协调
    username: Type.Optional(Type.String({ minLength: 1, maxLength: 50 })),
    realName: Type.Optional(Type.String()),
    phone: Type.Optional(Type.String({ minLength: 1, maxLength: 20 })),
    email: Type.Optional(Type.String()),
    // 留空表示不修改密码,非空则哈希后更新 sys_user.passwordHash
    password: Type.Optional(Type.String({ minLength: 1 })),
  },
  { $id: 'crmHospitalAccountUpdateReq' }
)

export default function registerCrmSchemas(fastify: FastifyInstance) {
  fastify.addSchema(CrmPageQuery)
  fastify.addSchema(CrmIdResp)
  fastify.addSchema(CrmHospitalReq)
  fastify.addSchema(CrmHospitalUpdateReq)
  fastify.addSchema(CrmCustomerReq)
  fastify.addSchema(CrmCustomerUpdateReq)
  fastify.addSchema(CrmMemberReq)
  fastify.addSchema(CrmMemberUpdateReq)
  fastify.addSchema(CrmDispatchReq)
  fastify.addSchema(CrmHospitalAccountCreateReq)
  fastify.addSchema(CrmHospitalAccountAssignReq)
  fastify.addSchema(CrmHospitalAccountUpdateReq)
}
