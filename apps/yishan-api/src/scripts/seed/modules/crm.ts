import { and, eq, isNull } from 'drizzle-orm';
import type { SeedDb } from '../context.js';
import {
  sysRegion,
  iximeiCrmCustomer,
  iximeiCrmCustomerStatus,
  iximeiCrmDispatch,
  iximeiCrmDispatchReply,
  iximeiCrmDispatchStatus,
  iximeiCrmHospital,
  iximeiCrmMemberCustomer,
  iximeiCrmMemberRemark,
} from '@/db/schema';

const customerStatuses = ['未派单', '已派单', '重单', '已成交'];
const dispatchStatuses = ['待回复', '已联系', '已到院', '已成交', '未成交', '重单'];

const regions = [
  { code: 310000, name: '上海市', level: 1, parentCode: 0 },
  { code: 310100, name: '上海市', level: 2, parentCode: 310000 },
  { code: 310115, name: '浦东新区', level: 3, parentCode: 310100 },
  { code: 320000, name: '江苏省', level: 1, parentCode: 0 },
  { code: 320100, name: '南京市', level: 2, parentCode: 320000 },
  { code: 320102, name: '玄武区', level: 3, parentCode: 320100 },
];

export async function seedCrm(db: SeedDb, adminUserId: number) {
  for (const [index, name] of customerStatuses.entries()) {
    const id = index + 1;
    await db.insert(iximeiCrmCustomerStatus).values({ id, name, sortOrder: id, status: 1 }).onDuplicateKeyUpdate({ set: { name, sortOrder: id, status: 1 } });
  }
  for (const [index, name] of dispatchStatuses.entries()) {
    const id = index + 1;
    await db.insert(iximeiCrmDispatchStatus).values({ id, name, sortOrder: id, status: 1 }).onDuplicateKeyUpdate({ set: { name, sortOrder: id, status: 1 } });
  }
  for (const [index, region] of regions.entries()) {
    await db.insert(sysRegion).values({ ...region, sortOrder: index + 1, status: 1 }).onDuplicateKeyUpdate({ set: { name: region.name, level: region.level, parentCode: region.parentCode, sortOrder: index + 1, status: 1 } });
  }

  const hospitalSeed = {
    provinceId: 310000, cityId: 310100, districtId: 310115, hospitalAddress: '上海市浦东新区示范路 88 号', hospitalPhone: '021-60000000',
    hospitalSelling: '眼鼻整形、皮肤管理、微整注射', hospitalWebsite: 'https://crm.iximei.cn', hospitalNature: 1, doctorName: '张医生', doctorPhone: '13800000001',
    receptionName: '李接待', receptionPhone: '13800000002', busStation: '示范路站', busAddress: '公交 88 路、99 路可达', subwayStation: '示范站', subwayAddress: '地铁 2 号线 1 号口出',
    taxiFare: '约 35 元', vipDiscount: '到院凭 VIP 编号享专属咨询权益', returnPoint: '10%', hospitalIntroduction: '用于伊喜美CRM管理迁移验证的示范医院。', contractPhotos: [], status: 1, updaterId: adminUserId,
  };
  await db.insert(iximeiCrmHospital).values({ hospitalName: '伊喜美示范医院', ...hospitalSeed, creatorId: adminUserId }).onDuplicateKeyUpdate({ set: hospitalSeed });
  const [hospital] = await db.select({ id: iximeiCrmHospital.id }).from(iximeiCrmHospital).where(eq(iximeiCrmHospital.hospitalName, '伊喜美示范医院')).limit(1);
  if (!hospital) throw new Error('CRM 示例医院初始化失败');

  const customerSeed = { name: '王女士', gender: 2, mobile: '13900000001', wechat: 'iximei-demo-1', provinceId: 310000, cityId: 310100, districtId: 310115, address: '上海市浦东新区', plastic: '双眼皮咨询', statusId: 2, remark: '迁移验证客户：已派单至示范医院。', ownerUserId: adminUserId, updaterId: adminUserId };
  await db.insert(iximeiCrmCustomer).values({ numberId: 'VIP000000000001', ...customerSeed, creatorId: adminUserId }).onDuplicateKeyUpdate({ set: customerSeed });
  const [customer] = await db.select({ id: iximeiCrmCustomer.id }).from(iximeiCrmCustomer).where(eq(iximeiCrmCustomer.numberId, 'VIP000000000001')).limit(1);
  if (!customer) throw new Error('CRM 示例客户初始化失败');

  const memberSeed = { name: '赵女士', gender: 2, mobile: '13900000002', address: '江苏省南京市玄武区', project: '皮肤管理复购', ownerUserId: adminUserId, updaterId: adminUserId };
  await db.insert(iximeiCrmMemberCustomer).values({ numberId: 'VIP000000000002', ...memberSeed, creatorId: adminUserId }).onDuplicateKeyUpdate({ set: memberSeed });
  const [member] = await db.select({ id: iximeiCrmMemberCustomer.id }).from(iximeiCrmMemberCustomer).where(eq(iximeiCrmMemberCustomer.numberId, 'VIP000000000002')).limit(1);
  if (!member) throw new Error('CRM 示例会员初始化失败');

  let [dispatch] = await db.select({ id: iximeiCrmDispatch.id }).from(iximeiCrmDispatch).where(and(eq(iximeiCrmDispatch.customerId, customer.id), eq(iximeiCrmDispatch.hospitalId, hospital.id), isNull(iximeiCrmDispatch.deletedAt))).limit(1);
  if (!dispatch) {
    const inserted = await db.insert(iximeiCrmDispatch).values({ customerId: customer.id, hospitalId: hospital.id, statusId: 1, receiveQq: '2880000001', receiveWechat: 'hospital-demo', creatorId: adminUserId, updaterId: adminUserId });
    dispatch = { id: Number(inserted[0].insertId) };
  }
  const replyContent = '系统初始化派单，用于迁移验证。';
  const [reply] = await db.select({ id: iximeiCrmDispatchReply.id }).from(iximeiCrmDispatchReply).where(and(eq(iximeiCrmDispatchReply.dispatchId, dispatch.id), eq(iximeiCrmDispatchReply.content, replyContent))).limit(1);
  if (!reply) await db.insert(iximeiCrmDispatchReply).values({ dispatchId: dispatch.id, userId: adminUserId, content: replyContent });
  const remarkContent = '系统初始化会员备注，用于迁移验证。';
  const [remark] = await db.select({ id: iximeiCrmMemberRemark.id }).from(iximeiCrmMemberRemark).where(and(eq(iximeiCrmMemberRemark.memberId, member.id), eq(iximeiCrmMemberRemark.content, remarkContent))).limit(1);
  if (!remark) await db.insert(iximeiCrmMemberRemark).values({ memberId: member.id, userId: adminUserId, content: remarkContent });
}
