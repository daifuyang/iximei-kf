import { prisma } from '../../../../utils/prisma.js'

export type PageQuery = {
  page?: number
  pageSize?: number
  keyword?: string
  startTime?: string
  endTime?: string
}

type PrismaClientLike = typeof prisma

const DEFAULT_PAGE = 1
const DEFAULT_PAGE_SIZE = 10
const SUPER_ADMIN_ID = 1
const DUPLICATE_CUSTOMER_STATUS_ID = 3

function pageArgs(query: PageQuery) {
  const page = Number(query.page || DEFAULT_PAGE)
  const pageSize = Number(query.pageSize || DEFAULT_PAGE_SIZE)
  return {
    page,
    pageSize,
    skip: pageSize === 0 ? undefined : (page - 1) * pageSize,
    take: pageSize === 0 ? undefined : pageSize,
  }
}

function dateRange(query: PageQuery) {
  const where: Record<string, unknown> = {}
  if (query.startTime) where.gte = new Date(query.startTime)
  if (query.endTime) where.lte = new Date(query.endTime)
  return Object.keys(where).length > 0 ? where : undefined
}

function compact<T extends Record<string, any>>(input: T): T {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as T
}

function asDate(value: unknown) {
  if (!value) return undefined
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? undefined : date
}

function normalizeContractPhotos(value: unknown) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return [{ url: value, name: '' }]
    }
  }
  return value
}

function isSuperAdmin(userId: number) {
  return userId === SUPER_ADMIN_ID
}

async function getHospitalForUser(client: PrismaClientLike, userId: number) {
  return await (client as any).crmHospital.findFirst({
    where: { accountUserId: userId, deletedAt: null },
    select: { id: true },
  })
}

async function generateVipNumber(client: any, modelName: 'crmCustomer' | 'crmMemberCustomer') {
  const latest = await client[modelName].findFirst({
    orderBy: { id: 'desc' },
    select: { id: true },
  })
  return `VIP${String((latest?.id || 0) + 1).padStart(12, '0')}`
}

async function ensureDefaultStatuses(client: any) {
  const customerDefaults = [
    [1, '未派单'],
    [2, '已派单'],
    [3, '重单'],
    [4, '已成交'],
  ]
  const dispatchDefaults = [
    [1, '待回复'],
    [2, '已联系'],
    [3, '已到院'],
    [4, '已成交'],
    [5, '未成交'],
    [6, '重单'],
  ]

  for (const [id, name] of customerDefaults) {
    await client.crmCustomerStatus.upsert({
      where: { id },
      update: {},
      create: { id, name, sortOrder: id },
    })
  }
  for (const [id, name] of dispatchDefaults) {
    await client.crmDispatchStatus.upsert({
      where: { id },
      update: {},
      create: { id, name, sortOrder: id },
    })
  }
}

export class CrmService {
  static async listHospitals(query: PageQuery & { status?: string }) {
    const { skip, take, page, pageSize } = pageArgs(query)
    const where: any = { deletedAt: null }
    if (query.keyword) {
      where.OR = [
        { hospitalName: { contains: query.keyword } },
        { hospitalPhone: { contains: query.keyword } },
        { hospitalSelling: { contains: query.keyword } },
      ]
    }
    if (query.status !== undefined) where.status = Number(query.status)
    const [list, total] = await Promise.all([
      (prisma as any).crmHospital.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { account: { select: { id: true, username: true, email: true, status: true } } },
      }),
      (prisma as any).crmHospital.count({ where }),
    ])
    return { list, total, page, pageSize }
  }

  static async getHospital(id: number) {
    return await (prisma as any).crmHospital.findFirst({
      where: { id, deletedAt: null },
      include: { account: { select: { id: true, username: true, email: true, status: true } } },
    })
  }

  static async saveHospital(input: any, currentUserId: number, id?: number) {
    const data = compact({
      accountUserId: input.accountUserId === null ? null : input.accountUserId === undefined ? undefined : Number(input.accountUserId),
      hospitalName: input.hospitalName,
      provinceId: input.provinceId === undefined ? undefined : Number(input.provinceId),
      cityId: input.cityId === undefined ? undefined : Number(input.cityId),
      districtId: input.districtId === undefined ? undefined : Number(input.districtId),
      hospitalAddress: input.hospitalAddress,
      hospitalPhone: input.hospitalPhone,
      hospitalSelling: input.hospitalSelling,
      hospitalWebsite: input.hospitalWebsite,
      hospitalNature: input.hospitalNature === undefined ? undefined : Number(input.hospitalNature),
      doctorName: input.doctorName,
      doctorPhone: input.doctorPhone,
      doctorQq: input.doctorQq,
      receptionName: input.receptionName,
      receptionPhone: input.receptionPhone,
      receptionQq: input.receptionQq,
      busStation: input.busStation,
      busAddress: input.busAddress,
      subwayStation: input.subwayStation,
      subwayAddress: input.subwayAddress,
      taxiFare: input.taxiFare,
      vipDiscount: input.vipDiscount,
      returnPoint: input.returnPoint,
      hospitalIntroduction: input.hospitalIntroduction,
      contractPhotos: normalizeContractPhotos(input.contractPhotos),
      wechatOpenid: input.wechatOpenid,
      status: input.status === undefined ? undefined : Number(input.status),
      updaterId: currentUserId,
    })
    if (id) {
      return await (prisma as any).crmHospital.update({ where: { id }, data: { ...data, version: { increment: 1 } } })
    }
    return await (prisma as any).crmHospital.create({
      data: {
        ...data,
        hospitalName: input.hospitalName,
        creatorId: currentUserId,
        updaterId: currentUserId,
      },
    })
  }

  static async deleteHospital(id: number, currentUserId: number) {
    return await (prisma as any).crmHospital.update({
      where: { id },
      data: { deletedAt: new Date(), updaterId: currentUserId, version: { increment: 1 } },
    })
  }

  static async listCustomerStatuses() {
    await ensureDefaultStatuses(prisma as any)
    return await (prisma as any).crmCustomerStatus.findMany({ where: { status: 1 }, orderBy: { sortOrder: 'asc' } })
  }

  static async listDispatchStatuses() {
    await ensureDefaultStatuses(prisma as any)
    return await (prisma as any).crmDispatchStatus.findMany({ where: { status: 1 }, orderBy: { sortOrder: 'asc' } })
  }

  static async listCustomers(query: PageQuery & { statusId?: number }, currentUserId: number) {
    const { skip, take, page, pageSize } = pageArgs(query)
    const where: any = { deletedAt: null }
    if (!isSuperAdmin(currentUserId)) where.ownerUserId = currentUserId
    if (query.statusId) where.statusId = Number(query.statusId)
    const createdAt = dateRange(query)
    if (createdAt) where.createdAt = createdAt
    if (query.keyword) {
      where.OR = [
        { mobile: { contains: query.keyword } },
        { name: { contains: query.keyword } },
        { numberId: { contains: query.keyword } },
      ]
    }
    const [list, total] = await Promise.all([
      (prisma as any).crmCustomer.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          status: true,
          owner: { select: { id: true, username: true, realName: true } },
        },
      }),
      (prisma as any).crmCustomer.count({ where }),
    ])
    return { list, total, page, pageSize }
  }

  static async getCustomer(id: number, currentUserId: number) {
    const customer = await (prisma as any).crmCustomer.findFirst({
      where: { id, deletedAt: null },
      include: {
        status: true,
        owner: { select: { id: true, username: true, realName: true } },
        dispatches: { include: { hospital: true, status: true }, orderBy: { createdAt: 'desc' } },
      },
    })
    if (!customer || (!isSuperAdmin(currentUserId) && customer.ownerUserId !== currentUserId)) return null
    return customer
  }

  static async saveCustomer(input: any, currentUserId: number, id?: number) {
    await ensureDefaultStatuses(prisma as any)
    const statusId = input.statusId === undefined ? undefined : Number(input.statusId)
    if (statusId === DUPLICATE_CUSTOMER_STATUS_ID && !input.remark) {
      throw new Error('重单客户必须填写重单理由')
    }
    const data = compact({
      numberId: input.numberId,
      name: input.name,
      gender: input.gender === undefined ? undefined : Number(input.gender),
      birthday: asDate(input.birthday),
      telphone: input.telphone,
      mobile: input.mobile,
      qq: input.qq,
      wechat: input.wechat,
      provinceId: input.provinceId === undefined ? undefined : Number(input.provinceId),
      cityId: input.cityId === undefined ? undefined : Number(input.cityId),
      districtId: input.districtId === undefined ? undefined : Number(input.districtId),
      address: input.address,
      plastic: input.plastic,
      statusId,
      remark: input.remark,
      ownerUserId: input.ownerUserId === undefined ? undefined : Number(input.ownerUserId),
      updaterId: currentUserId,
    })
    if (id) {
      const existed = await this.getCustomer(id, currentUserId)
      if (!existed) throw new Error('客户不存在或无权访问')
      return await (prisma as any).crmCustomer.update({ where: { id }, data: { ...data, version: { increment: 1 } } })
    }
    return await (prisma as any).crmCustomer.create({
      data: {
        ...data,
        numberId: input.numberId || (await generateVipNumber(prisma as any, 'crmCustomer')),
        name: input.name,
        statusId: statusId || 1,
        ownerUserId: input.ownerUserId ? Number(input.ownerUserId) : currentUserId,
        creatorId: currentUserId,
        updaterId: currentUserId,
      },
    })
  }

  static async dispatchCustomer(customerId: number, input: any, currentUserId: number) {
    await ensureDefaultStatuses(prisma as any)
    const customer = await this.getCustomer(customerId, currentUserId)
    if (!customer) throw new Error('客户不存在或无权访问')
    const hospitalIds = Array.from(new Set((input.hospitalIds || []).map((item: unknown) => Number(item)).filter(Boolean)))
    if (hospitalIds.length === 0) throw new Error('请选择派单医院')
    const replyContent = input.reply || '此客户是贵医院潜在客户，请跟进'
    return await (prisma as any).$transaction(async (tx: any) => {
      const rows = []
      for (const hospitalId of hospitalIds) {
        const dispatch = await tx.crmDispatch.create({
          data: {
            customerId,
            hospitalId,
            statusId: input.statusId ? Number(input.statusId) : 1,
            finishedAt: new Date(),
            creatorId: currentUserId,
            updaterId: currentUserId,
            replies: { create: { userId: currentUserId, content: replyContent } },
          },
          include: { hospital: true, replies: true, status: true },
        })
        rows.push(dispatch)
      }
      await tx.crmCustomer.update({ where: { id: customerId }, data: { statusId: 2, updaterId: currentUserId } })
      return rows
    })
  }

  static async listMembers(query: PageQuery, currentUserId: number) {
    const { skip, take, page, pageSize } = pageArgs(query)
    const where: any = { deletedAt: null }
    if (!isSuperAdmin(currentUserId)) where.ownerUserId = currentUserId
    if (query.keyword) {
      where.OR = [
        { mobile: { contains: query.keyword } },
        { name: { contains: query.keyword } },
        { numberId: { contains: query.keyword } },
      ]
    }
    const [list, total] = await Promise.all([
      (prisma as any).crmMemberCustomer.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          owner: { select: { id: true, username: true, realName: true } },
          _count: { select: { remarks: true, browses: true } },
        },
      }),
      (prisma as any).crmMemberCustomer.count({ where }),
    ])
    return { list, total, page, pageSize }
  }

  static async getMember(id: number, currentUserId: number, recordBrowse = false) {
    const member = await (prisma as any).crmMemberCustomer.findFirst({
      where: { id, deletedAt: null },
      include: {
        owner: { select: { id: true, username: true, realName: true } },
        remarks: { include: { user: { select: { id: true, username: true, realName: true } } }, orderBy: { createdAt: 'desc' } },
        browses: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { remarks: true, browses: true } },
      },
    })
    if (!member || (!isSuperAdmin(currentUserId) && member.ownerUserId !== currentUserId)) return null
    if (recordBrowse) {
      await (prisma as any).crmMemberBrowse.create({ data: { memberId: id, userId: currentUserId, action: 'view' } })
    }
    return member
  }

  static async saveMember(input: any, currentUserId: number, id?: number) {
    const data = compact({
      numberId: input.numberId,
      name: input.name,
      gender: input.gender === undefined ? undefined : Number(input.gender),
      birthday: asDate(input.birthday),
      address: input.address,
      mobile: input.mobile,
      project: input.project,
      ownerUserId: input.ownerUserId === undefined ? undefined : Number(input.ownerUserId),
      updaterId: currentUserId,
    })
    if (id) {
      const existed = await this.getMember(id, currentUserId)
      if (!existed) throw new Error('会员不存在或无权访问')
      return await (prisma as any).crmMemberCustomer.update({ where: { id }, data: { ...data, version: { increment: 1 } } })
    }
    return await (prisma as any).crmMemberCustomer.create({
      data: {
        ...data,
        numberId: input.numberId || (await generateVipNumber(prisma as any, 'crmMemberCustomer')),
        name: input.name,
        ownerUserId: input.ownerUserId ? Number(input.ownerUserId) : currentUserId,
        creatorId: currentUserId,
        updaterId: currentUserId,
      },
    })
  }

  static async addMemberRemark(memberId: number, content: string, currentUserId: number) {
    const member = await this.getMember(memberId, currentUserId)
    if (!member) throw new Error('会员不存在或无权访问')
    if (!content) throw new Error('备注内容不能为空')
    return await (prisma as any).crmMemberRemark.create({ data: { memberId, userId: currentUserId, content } })
  }

  static async listDispatches(query: PageQuery & { statusId?: number }, currentUserId: number) {
    const { skip, take, page, pageSize } = pageArgs(query)
    const where: any = { deletedAt: null }
    if (query.statusId) where.statusId = Number(query.statusId)
    const createdAt = dateRange(query)
    if (createdAt) where.createdAt = createdAt
    if (query.keyword) {
      where.OR = [
        { customer: { mobile: { contains: query.keyword } } },
        { customer: { name: { contains: query.keyword } } },
        { customer: { numberId: { contains: query.keyword } } },
        { hospital: { hospitalName: { contains: query.keyword } } },
      ]
    }
    if (!isSuperAdmin(currentUserId)) {
      const hospital = await getHospitalForUser(prisma, currentUserId)
      if (hospital) {
        where.hospitalId = hospital.id
      }
    }
    const [list, total] = await Promise.all([
      (prisma as any).crmDispatch.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { include: { owner: { select: { id: true, username: true, realName: true } } } },
          hospital: true,
          status: true,
        },
      }),
      (prisma as any).crmDispatch.count({ where }),
    ])
    return { list, total, page, pageSize }
  }

  static async getDispatch(id: number, currentUserId: number) {
    const dispatch = await (prisma as any).crmDispatch.findFirst({
      where: { id, deletedAt: null },
      include: {
        customer: { include: { owner: { select: { id: true, username: true, realName: true } } } },
        hospital: true,
        status: true,
        replies: { include: { user: { select: { id: true, username: true, realName: true } } }, orderBy: { createdAt: 'asc' } },
        logs: { include: { user: { select: { id: true, username: true, realName: true } } }, orderBy: { createdAt: 'asc' } },
      },
    })
    if (!dispatch) return null
    if (!isSuperAdmin(currentUserId)) {
      const hospital = await getHospitalForUser(prisma, currentUserId)
      if (hospital && dispatch.hospitalId !== hospital.id) return null
    }
    return dispatch
  }

  static async updateDispatch(id: number, input: any, currentUserId: number) {
    const dispatch = await this.getDispatch(id, currentUserId)
    if (!dispatch) throw new Error('派单不存在或无权访问')
    const data = compact({
      hospitalId: input.hospitalId === undefined ? undefined : Number(input.hospitalId),
      statusId: input.statusId === undefined ? undefined : Number(input.statusId),
      image: input.image,
      receiveQq: input.receiveQq,
      receiveWechat: input.receiveWechat,
      finishedAt: asDate(input.finishedAt),
      createdAt: asDate(input.createdAt),
      updaterId: currentUserId,
    })
    return await (prisma as any).crmDispatch.update({ where: { id }, data: { ...data, version: { increment: 1 } } })
  }

  static async addDispatchReply(dispatchId: number, input: any, currentUserId: number) {
    const dispatch = await this.getDispatch(dispatchId, currentUserId)
    if (!dispatch) throw new Error('派单不存在或无权访问')
    const update = compact({
      receiveQq: input.receiveQq,
      receiveWechat: input.receiveWechat,
      image: input.image,
      statusId: input.statusId === undefined ? undefined : Number(input.statusId),
      updaterId: currentUserId,
    })
    return await (prisma as any).$transaction(async (tx: any) => {
      if (Object.keys(update).length > 1) {
        await tx.crmDispatch.update({ where: { id: dispatchId }, data: update })
      }
      if (input.content) {
        return await tx.crmDispatchReply.create({ data: { dispatchId, userId: currentUserId, content: input.content } })
      }
      return await tx.crmDispatch.findUnique({ where: { id: dispatchId } })
    })
  }

  static async addDispatchLog(dispatchId: number, content: string, currentUserId: number) {
    const dispatch = await this.getDispatch(dispatchId, currentUserId)
    if (!dispatch) throw new Error('派单不存在或无权访问')
    if (!content) throw new Error('跟进内容不能为空')
    return await (prisma as any).crmDispatchFollowLog.create({ data: { dispatchId, userId: currentUserId, content } })
  }

  static async listRegions(parentId = 0) {
    return await (prisma as any).crmRegion.findMany({ where: { parentId: Number(parentId) }, orderBy: { areaId: 'asc' } })
  }

  static async bindWechatOpenid(hospitalId: number, signature: string, openid: string) {
    // The caller must generate the same signature. This preserves the legacy bind contract.
    const crypto = await import('node:crypto')
    const expected = crypto.createHash('md5').update(`hospital_bind${hospitalId}`).digest('hex')
    if (expected !== signature) throw new Error('微信绑定签名无效')
    return await (prisma as any).crmHospital.update({ where: { id: hospitalId }, data: { wechatOpenid: openid } })
  }
}
