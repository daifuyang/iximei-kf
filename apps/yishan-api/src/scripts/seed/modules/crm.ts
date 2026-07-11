import type { PrismaClient } from '../../../generated/prisma/client.js';

const customerStatuses = [
  { id: 1, name: '未派单', sortOrder: 1 },
  { id: 2, name: '已派单', sortOrder: 2 },
  { id: 3, name: '重单', sortOrder: 3 },
  { id: 4, name: '已成交', sortOrder: 4 },
];

const dispatchStatuses = [
  { id: 1, name: '待回复', sortOrder: 1 },
  { id: 2, name: '已联系', sortOrder: 2 },
  { id: 3, name: '已到院', sortOrder: 3 },
  { id: 4, name: '已成交', sortOrder: 4 },
  { id: 5, name: '未成交', sortOrder: 5 },
  { id: 6, name: '重单', sortOrder: 6 },
];

const regions = [
  { areaId: 310000, areaName: '上海市', parentId: 0 },
  { areaId: 310100, areaName: '上海市', parentId: 310000 },
  { areaId: 310115, areaName: '浦东新区', parentId: 310100 },
  { areaId: 320000, areaName: '江苏省', parentId: 0 },
  { areaId: 320100, areaName: '南京市', parentId: 320000 },
  { areaId: 320102, areaName: '玄武区', parentId: 320100 },
];

export async function seedCrm(prisma: PrismaClient, adminUserId: number) {
  for (const item of customerStatuses) {
    await prisma.crmCustomerStatus.upsert({
      where: { id: item.id },
      update: { name: item.name, sortOrder: item.sortOrder, status: 1 },
      create: { id: item.id, name: item.name, sortOrder: item.sortOrder, status: 1 },
    });
  }

  for (const item of dispatchStatuses) {
    await prisma.crmDispatchStatus.upsert({
      where: { id: item.id },
      update: { name: item.name, sortOrder: item.sortOrder, status: 1 },
      create: { id: item.id, name: item.name, sortOrder: item.sortOrder, status: 1 },
    });
  }

  for (const item of regions) {
    await prisma.crmRegion.upsert({
      where: { areaId: item.areaId },
      update: { areaName: item.areaName, parentId: item.parentId },
      create: item,
    });
  }

  const hospital = await prisma.crmHospital.upsert({
    where: { hospitalName: '伊喜美示范医院' },
    update: {
      provinceId: 310000,
      cityId: 310100,
      districtId: 310115,
      hospitalAddress: '上海市浦东新区示范路 88 号',
      hospitalPhone: '021-60000000',
      hospitalSelling: '眼鼻整形、皮肤管理、微整注射',
      hospitalWebsite: 'https://crm.iximei.cn',
      hospitalNature: 1,
      doctorName: '张医生',
      doctorPhone: '13800000001',
      receptionName: '李接待',
      receptionPhone: '13800000002',
      busStation: '示范路站',
      busAddress: '公交 88 路、99 路可达',
      subwayStation: '示范站',
      subwayAddress: '地铁 2 号线 1 号口出',
      taxiFare: '约 35 元',
      vipDiscount: '到院凭 VIP 编号享专属咨询权益',
      returnPoint: '10%',
      hospitalIntroduction: '用于伊喜美CRM管理迁移验证的示范医院。',
      contractPhotos: [],
      status: 1,
      updaterId: adminUserId,
    },
    create: {
      hospitalName: '伊喜美示范医院',
      provinceId: 310000,
      cityId: 310100,
      districtId: 310115,
      hospitalAddress: '上海市浦东新区示范路 88 号',
      hospitalPhone: '021-60000000',
      hospitalSelling: '眼鼻整形、皮肤管理、微整注射',
      hospitalWebsite: 'https://crm.iximei.cn',
      hospitalNature: 1,
      doctorName: '张医生',
      doctorPhone: '13800000001',
      receptionName: '李接待',
      receptionPhone: '13800000002',
      busStation: '示范路站',
      busAddress: '公交 88 路、99 路可达',
      subwayStation: '示范站',
      subwayAddress: '地铁 2 号线 1 号口出',
      taxiFare: '约 35 元',
      vipDiscount: '到院凭 VIP 编号享专属咨询权益',
      returnPoint: '10%',
      hospitalIntroduction: '用于伊喜美CRM管理迁移验证的示范医院。',
      contractPhotos: [],
      status: 1,
      creatorId: adminUserId,
      updaterId: adminUserId,
    },
  });

  const customer = await prisma.crmCustomer.upsert({
    where: { numberId: 'VIP000000000001' },
    update: {
      name: '王女士',
      gender: 2,
      mobile: '13900000001',
      wechat: 'iximei-demo-1',
      provinceId: 310000,
      cityId: 310100,
      districtId: 310115,
      address: '上海市浦东新区',
      plastic: '双眼皮咨询',
      statusId: 2,
      remark: '迁移验证客户：已派单至示范医院。',
      ownerUserId: adminUserId,
      updaterId: adminUserId,
    },
    create: {
      numberId: 'VIP000000000001',
      name: '王女士',
      gender: 2,
      mobile: '13900000001',
      wechat: 'iximei-demo-1',
      provinceId: 310000,
      cityId: 310100,
      districtId: 310115,
      address: '上海市浦东新区',
      plastic: '双眼皮咨询',
      statusId: 2,
      remark: '迁移验证客户：已派单至示范医院。',
      ownerUserId: adminUserId,
      creatorId: adminUserId,
      updaterId: adminUserId,
    },
  });

  const member = await prisma.crmMemberCustomer.upsert({
    where: { numberId: 'VIP000000000002' },
    update: {
      name: '赵女士',
      gender: 2,
      mobile: '13900000002',
      address: '江苏省南京市玄武区',
      project: '皮肤管理复购',
      ownerUserId: adminUserId,
      updaterId: adminUserId,
    },
    create: {
      numberId: 'VIP000000000002',
      name: '赵女士',
      gender: 2,
      mobile: '13900000002',
      address: '江苏省南京市玄武区',
      project: '皮肤管理复购',
      ownerUserId: adminUserId,
      creatorId: adminUserId,
      updaterId: adminUserId,
    },
  });

  const existingDispatch = await prisma.crmDispatch.findFirst({
    where: {
      customerId: customer.id,
      hospitalId: hospital.id,
      deletedAt: null,
    },
  });

  const dispatch =
    existingDispatch ??
    (await prisma.crmDispatch.create({
      data: {
        customerId: customer.id,
        hospitalId: hospital.id,
        statusId: 1,
        receiveQq: '2880000001',
        receiveWechat: 'hospital-demo',
        creatorId: adminUserId,
        updaterId: adminUserId,
      },
    }));

  const replyExists = await prisma.crmDispatchReply.findFirst({
    where: { dispatchId: dispatch.id, content: '系统初始化派单，用于迁移验证。' },
  });
  if (!replyExists) {
    await prisma.crmDispatchReply.create({
      data: {
        dispatchId: dispatch.id,
        userId: adminUserId,
        content: '系统初始化派单，用于迁移验证。',
      },
    });
  }

  const memberRemarkExists = await prisma.crmMemberRemark.findFirst({
    where: { memberId: member.id, content: '系统初始化会员备注，用于迁移验证。' },
  });
  if (!memberRemarkExists) {
    await prisma.crmMemberRemark.create({
      data: {
        memberId: member.id,
        userId: adminUserId,
        content: '系统初始化会员备注，用于迁移验证。',
      },
    });
  }

  console.log('伊喜美CRM管理种子数据创建完成');
}
