#!/usr/bin/env node
// =====================================================================
// iximei-kf 案例演示数据生成器（脱敏，本地专用）
// 输出: scripts/demo-seed-extended.sql (可与 scripts/demo-seed.sql 拼接跑)
// 约束: 仅写本地 docker mysql appdb; 不操作 .env.local 库; 不走 drizzle migrate;
//       0 schema 变更, 0 新依赖（除 faker）; 全部数据以 _is_demo=1 标记隔离.
// 幂等: 每次先 DELETE 演示行, 再 INSERT 固定 id 段, 可无限重跑.
// =====================================================================

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { Faker, zh_CN } from '@faker-js/faker';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------
// 1. 固定常量（id 段避开 AUTO_INCREMENT 与现有数据）
//    crm_customer   max=15       -> 演示段 [200, 400)
//    crm_dispatch   max=105      -> 演示段 [500, 1100)
//    crm_member     max=13       -> 演示段 [200, 260)
//    sys_user       max=6        -> 新增演示客服 id=[10, 18)
//    crm_hospital   max=3        -> 新增演示医院 id=[10, 20)
// ---------------------------------------------------------------------

const HOSPITAL_ID_START = 10;
const HOSPITAL_COUNT = 7;             // 扩展到 3+7=10 家医院
const KEFU_ID_START = 10;
const KEFU_COUNT = 8;                  // 8 个客服账号 (kefu.demo01..08)
const CUSTOMER_ID_START = 200;
const CUSTOMER_COUNT = 200;
const DISPATCH_ID_START = 500;
const DISPATCH_COUNT = 500;
const MEMBER_ID_START = 200;
const MEMBER_COUNT = 50;

// 演示账号密码统一 admin123, 仅本地库; 真实环境永远不会被触发
const DEMO_PASSWORD_HASH = '';        // 沿用现有空 hash（与现有 demo 账号一致）
const DEMO_PASSWORD_FORMAT = 1;

// ---------------------------------------------------------------------
// 2. 字典与边界（基于现有 crm_dispatch_status / crm_customer_status）
//    dispatch_status: 1 待回复 / 2 已联系 / 3 已到院 / 4 已成交 / 5 未成交 / 6 重单
//    customer_status: 1 资料录入 / 2 待跟进 / 3 重单 / 4 已手术 / 5 无效用户
// ---------------------------------------------------------------------

// 状态权重（看起来真实：待跟进 + 待回复占比最高，成交次之）
const DISPATCH_STATUS_WEIGHTS = [
  { id: 1, w: 30 }, // 待回复
  { id: 2, w: 20 }, // 已联系
  { id: 3, w: 15 }, // 已到院
  { id: 4, w: 18 }, // 已成交
  { id: 5, w: 12 }, // 未成交
  { id: 6, w: 5 },  // 重单
];
const CUSTOMER_STATUS_WEIGHTS = [
  { id: 1, w: 15 }, // 资料录入
  { id: 2, w: 35 }, // 待跟进
  { id: 3, w: 10 }, // 重单
  { id: 4, w: 25 }, // 已手术
  { id: 5, w: 15 }, // 无效用户
];

// 医美行业项目库（脱敏品牌 + 项目名）
const MEDICAL_CATEGORIES = [
  { category: '医美', projects: ['双眼皮修复', '鼻综合', '脂肪填充', '下颌角整形', '假体隆胸', '面部提升', '吸脂塑形'] },
  { category: '皮肤美容', projects: ['光子嫩肤', '水光针', '皮秒激光', '热玛吉', '射频紧肤', '果酸换肤'] },
  { category: '微整注射', projects: ['玻尿酸填充', '肉毒素瘦脸', '童颜针', '少女针', '胶原蛋白填充'] },
  { category: '口腔', projects: ['种植牙', '隐形正畸', '全瓷冠', '冷光美白', '瓷贴面'] },
  { category: '毛发', projects: ['发际线种植', '眉毛种植', '疤痕植发'] },
  { category: '中医养生', projects: ['艾灸调理', '推拿按摩', '穴位埋线'] },
];

// 医美医院品牌（脱敏，明示虚构）
const DEMO_HOSPITALS = [
  { name: '示例美莱医疗美容医院',     city: '上海市长宁区',     doctor: '林医生', specialty: '鼻综合、眼综合、面部提升' },
  { name: '示例艺星医疗美容门诊',     city: '北京市朝阳区',     doctor: '苏医生', specialty: '脂肪填充、吸脂塑形' },
  { name: '示例鹏爱医疗美容医院',     city: '广州市天河区',     doctor: '高医生', specialty: '双眼皮修复、隆胸' },
  { name: '示例华美整形美容医院',     city: '深圳市福田区',     doctor: '卢医生', specialty: '皮肤美容、抗衰' },
  { name: '示例美立方医疗美容',       city: '杭州市西湖区',     doctor: '邱医生', specialty: '微整注射、光电项目' },
  { name: '示例伊美尔医疗美容门诊',   city: '成都市锦江区',     doctor: '邵医生', specialty: '毛发种植、疤痕修复' },
  { name: '示例丽都整形美容医院',     city: '南京市鼓楼区',     doctor: '余医生', specialty: '口腔美容、种植牙' },
];

// 客户备注模板（覆盖真实业务话术）
const REMARK_TEMPLATES = [
  '线上咨询 {project}，预算 {budget}，关心恢复期与术后效果。',
  '{project}意向客户，已发送案例对比图，等待反馈。',
  '朋友推荐来院，主诉 {project}，首次到院面诊。',
  '咨询 {project} 多次，关心分期付款方案。',
  '已成交 {project}，进入术后回访周期，无异常。',
  '初次留资，尚未首次联系。',
  '电话多次未接，已发送短信。',
  '到院面诊完成，方案 {project}，报价 {budget}，待客户确认。',
  '对价格敏感，建议关注近期的活动方案。',
  '异地客户，已安排线上视频面诊。',
];

const BUDGETS = ['5k-1w', '1w-2w', '2w-3w', '3w-5w', '5w-10w', '10w+'];

// 跟进记录话术
const FOLLOWUP_TEMPLATES = [
  { method: 'wechat', content: '微信沟通 {project} 方案，发送案例对比图。', result: 'positive' },
  { method: 'phone',  content: '电话回访，{project} 术后恢复良好，无异常。', result: 'done' },
  { method: 'wechat', content: '客户对比两家方案，强调我方医生资质。', result: 'neutral' },
  { method: 'phone',  content: '电话邀约到院面诊，已确认时间。', result: 'positive' },
  { method: 'wechat', content: '推送本月活动方案，客户表示考虑。', result: 'neutral' },
  { method: 'phone',  content: '术后第 3 天回访，恢复正常。', result: 'done' },
  { method: 'wechat', content: '客户主动咨询分期方案，已发详情。', result: 'positive' },
  { method: 'phone',  content: '客户暂未确定，标记下次跟进。', result: 'neutral' },
];

// 派单回复话术
const REPLY_TEMPLATES = [
  '客户已到院面诊，方案 {project}，报价 {budget}。',
  '已确认到院，按约定登记返点。',
  '客户手术完成，进入术后回访周期。',
  '客户暂未到院，已多次电话提醒。',
  '客户已成交，{project} 方案实施顺利。',
  '客户取消预约，标记为未成交。',
];

// 跟进日志话术
const FOLLOWLOG_TEMPLATES = [
  '术后第 3 天电话回访，恢复正常。',
  '术后 1 周回访，无异常，预约拆线。',
  '术后 1 月复诊，效果满意。',
  '客户主动反馈手术效果，推荐了朋友。',
  '客户对效果有疑问，已安排医生二次沟通。',
];

// 跟进阶段
const MEMBER_STAGES = ['new', 'intending', 'negotiating', 'won'];
const INTENTION_LEVELS = ['unset', 'c', 'b', 'a'];
const BUDGET_RANGES = ['5k-1w', '1w-2w', '2w-3w', '3w-5w', '5w-10w', '10w+'];

// 跟进结果枚举
const FOLLOWUP_RESULTS = ['positive', 'neutral', 'negative', 'done'];

// ---------------------------------------------------------------------
// 3. 工具函数
// ---------------------------------------------------------------------

const faker = new Faker({ locale: [zh_CN] });
faker.seed(20260825); // 固定种子，确保每次生成结果一致（可重复）

function weightedPick(weights) {
  const total = weights.reduce((s, x) => s + x.w, 0);
  let r = faker.number.int({ min: 0, max: total - 1 });
  for (const item of weights) {
    if (r < item.w) return item.id;
    r -= item.w;
  }
  return weights[weights.length - 1].id;
}

function pick(arr) { return arr[faker.number.int({ min: 0, max: arr.length - 1 })]; }

function pickProject() {
  const cat = pick(MEDICAL_CATEGORIES);
  return { category: cat.category, project: pick(cat.projects) };
}

// 11 位手机号：13x/17x/18x 头 + 9 位随机
function fakeMobile() {
  const prefix = pick(['13', '15', '17', '18']);
  let suffix = '';
  for (let i = 0; i < 9; i++) suffix += faker.number.int({ min: 0, max: 9 });
  return prefix + suffix;
}

function fakeWechat() {
  const len = faker.number.int({ min: 6, max: 10 });
  let s = '';
  for (let i = 0; i < len; i++) {
    s += pick([...Array.from({ length: 10 }, (_, i) => String(i)), 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'p', 'q', 'r', 's', 't', 'w', 'x', 'y', 'z']);
  }
  return s;
}

function fakeQQ() {
  const len = faker.number.int({ min: 5, max: 10 });
  let s = '';
  for (let i = 0; i < len; i++) s += faker.number.int({ min: 0, max: 9 });
  return s;
}

// 生日 1965-2005 之间随机
function fakeBirthday() {
  const year = faker.number.int({ min: 1965, max: 2005 });
  const month = faker.number.int({ min: 1, max: 12 });
  const day = faker.number.int({ min: 1, max: 28 });
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// 创建时间 60 天窗口内（近期业务感）
function fakeCreatedAt(daysAgo) {
  const base = new Date('2026-08-25T10:00:00Z');
  base.setUTCDate(base.getUTCDate() - daysAgo);
  base.setUTCHours(faker.number.int({ min: 8, max: 21 }));
  base.setUTCMinutes(faker.number.int({ min: 0, max: 59 }));
  base.setUTCSeconds(faker.number.int({ min: 0, max: 59 }));
  // 转 +08:00
  const cn = new Date(base.getTime() + 8 * 60 * 60 * 1000);
  return cn.toISOString().replace('T', ' ').substring(0, 19);
}

// 客户编号
function customerNumberId(i) { return `KH-DEMO${String(i).padStart(5, '0')}`; }
function memberNumberId(i)   { return `HY-DEMO${String(i).padStart(5, '0')}`; }

// 转义 SQL 字符串
function sqlStr(s) {
  if (s === null || s === undefined) return 'NULL';
  return `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}
function sqlNum(n) { return n === null || n === undefined ? 'NULL' : String(n); }

// ---------------------------------------------------------------------
// 4. 生成
// ---------------------------------------------------------------------

const lines = [];
const push = (s) => lines.push(s);

push('-- =====================================================================');
push('-- iximei-kf 案例演示数据扩展段（脱敏，仅供本地截图）');
push('-- 由 scripts/demo-seed-generate.mjs 自动生成，请勿手编');
push('-- 数据标识: 演示医院 id ∈ [10, 20); 演示客户 id ∈ [200, 400);');
push('--           演示派单 id ∈ [500, 1100); 演示会员 id ∈ [200, 260);');
push('-- 幂等: 先 DELETE 演示行再 INSERT，可无限重跑');
push('-- =====================================================================');
push('SET NAMES utf8mb4;');
push('');

// 4.1 演示客服账号 (id 10..17)
push('-- ---------- 演示客服账号 (id 10..17) ----------');
for (let i = 0; i < KEFU_COUNT; i++) {
  const uid = KEFU_ID_START + i;
  const uname = `kefu.demo${String(i + 1).padStart(2, '0')}`;
  const realname = faker.person.lastName() + faker.person.firstName();
  const email = `${uname}@example.com`;
  push(`INSERT INTO sys_user (id, username, email, password_hash, password_format, real_name, nickname, gender, status, creator_id, updater_id)`);
  push(` VALUES (${uid}, '${uname}', '${email}', '', ${DEMO_PASSWORD_FORMAT}, '${realname}', '${realname}·客服演示组', ${faker.number.int({ min: 1, max: 2 })}, 1, 1, 1)`);
  push(` ON DUPLICATE KEY UPDATE nickname = VALUES(nickname), real_name = VALUES(real_name), status = 1, deleted_at = NULL;`);
}
push('');

// 4.2 演示医院 (id 10..16)
push('-- ---------- 演示医院 (id 10..16) ----------');
DEMO_HOSPITALS.forEach((h, i) => {
  const hid = HOSPITAL_ID_START + i;
  const accUserId = KEFU_ID_START + (i % KEFU_COUNT);
  const doctorMobile = fakeMobile();
  const receptionMobile = fakeMobile();
  push(`INSERT INTO crm_hospital (id, account_user_id, hospital_name, hospital_address, hospital_phone, hospital_selling, hospital_website, hospital_nature, doctor_name, doctor_phone, doctor_qq, reception_name, reception_phone, reception_qq, hospital_introduction, status, creator_id, updater_id)`);
  push(` VALUES (${hid}, ${accUserId}, '${h.name}', '${h.city}示例路 ${faker.number.int({ min: 10, max: 999 })} 号', '400-8666${faker.number.int({ min: 1000, max: 9999 })}', '${h.specialty}', NULL, ${faker.number.int({ min: 1, max: 3 })}, '${h.doctor}', '${doctorMobile}', '${fakeQQ()}', '前台小${faker.person.lastName().substring(0, 1)}', '${receptionMobile}', '${fakeQQ()}', '演示用医美机构，仅用于案例展示。', 1, 1, 1)`);
  push(` ON DUPLICATE KEY UPDATE hospital_name = VALUES(hospital_name), account_user_id = VALUES(account_user_id), hospital_website = VALUES(hospital_website), status = 1, deleted_at = NULL;`);
});
push('');

// 4.3 先清演示数据（幂等）
push('-- ---------- 清演示数据（幂等） ----------');
push(`DELETE FROM crm_dispatch_follow_log WHERE dispatch_id >= ${DISPATCH_ID_START} AND dispatch_id < ${DISPATCH_ID_START + DISPATCH_COUNT};`);
push(`DELETE FROM crm_dispatch_reply WHERE dispatch_id >= ${DISPATCH_ID_START} AND dispatch_id < ${DISPATCH_ID_START + DISPATCH_COUNT};`);
push(`DELETE FROM crm_dispatch WHERE id >= ${DISPATCH_ID_START} AND id < ${DISPATCH_ID_START + DISPATCH_COUNT};`);
push(`DELETE FROM crm_follow_up_record WHERE member_id >= ${MEMBER_ID_START} AND member_id < ${MEMBER_ID_START + MEMBER_COUNT};`);
push(`DELETE FROM crm_member_customer WHERE id >= ${MEMBER_ID_START} AND id < ${MEMBER_ID_START + MEMBER_COUNT};`);
push(`DELETE FROM crm_customer WHERE id >= ${CUSTOMER_ID_START} AND id < ${CUSTOMER_ID_START + CUSTOMER_COUNT};`);
push('');

// 4.4 演示客户 (id 200..399) - 分批 INSERT，每批 50 行
push('-- ---------- 演示客户 (id 200..399) ----------');
const customerBatch = [];
for (let i = 0; i < CUSTOMER_COUNT; i++) {
  const cid = CUSTOMER_ID_START + i;
  const { project, category } = pickProject();
  const statusId = weightedPick(CUSTOMER_STATUS_WEIGHTS);
  const ownerId = KEFU_ID_START + faker.number.int({ min: 0, max: KEFU_COUNT - 1 });
  const remarkTpl = pick(REMARK_TEMPLATES);
  const remark = remarkTpl.replace('{project}', project).replace('{budget}', pick(BUDGETS));
  const gender = faker.number.int({ min: 1, max: 2 });
  customerBatch.push(
    `(${cid}, '${customerNumberId(i + 1)}', '${faker.person.lastName()}${gender === 2 ? '女士' : '先生'}', ${gender}, '${fakeBirthday()}', NULL, '${fakeMobile()}', ${faker.datatype.boolean() ? `'${fakeQQ()}'` : 'NULL'}, ${faker.datatype.boolean() ? `'${fakeWechat()}'` : 'NULL'}, NULL, NULL, NULL, '${faker.location.city()}', '${project}', ${statusId}, '${remark}', ${ownerId}, ${ownerId}, ${ownerId})`
  );
}
// 拆批，每 50 行一个 INSERT
for (let i = 0; i < customerBatch.length; i += 50) {
  const chunk = customerBatch.slice(i, i + 50);
  push(`INSERT INTO crm_customer (id, number_id, name, gender, birthday, telphone, mobile, qq, wechat, province_id, city_id, district_id, address, plastic, status_id, remark, owner_user_id, creator_id, updater_id) VALUES`);
  push(' ' + chunk.join(',\n ') + ';');
}
push('');

// 4.5 演示派单 (id 500..999) - 每个客户 1-3 条派单，跨医院分配
push('-- ---------- 演示派单 (id 500..999) ----------');
const dispatchBatch = [];
const dispatchMeta = []; // [ { id, customerId, hospitalId, statusId, createdAt } ] 供后续 reply/log 用
let dispatchId = DISPATCH_ID_START;
for (let i = 0; i < CUSTOMER_COUNT; i++) {
  const customerId = CUSTOMER_ID_START + i;
  // 每个客户 2-3 条派单，总共 ~500 条
  const dispatchCount = faker.number.int({ min: 2, max: 3 });
  for (let j = 0; j < dispatchCount && dispatchId < DISPATCH_ID_START + DISPATCH_COUNT; j++) {
    const hospitalId = HOSPITAL_ID_START + faker.number.int({ min: 0, max: HOSPITAL_COUNT - 1 });
    const statusId = weightedPick(DISPATCH_STATUS_WEIGHTS);
    const ownerId = KEFU_ID_START + faker.number.int({ min: 0, max: KEFU_COUNT - 1 });
    const daysAgo = faker.number.int({ min: 0, max: 60 });
    const createdAt = fakeCreatedAt(daysAgo);
    const finishedAt = (statusId === 4 || statusId === 3) ? fakeCreatedAt(Math.max(0, daysAgo - faker.number.int({ min: 1, max: 5 }))) : null;
    const receiveQq = (statusId >= 2) ? `'${fakeQQ()}'` : 'NULL';
    const receiveWechat = (statusId >= 2) ? `'${fakeWechat()}'` : 'NULL';
    dispatchBatch.push(
      `(${dispatchId}, ${customerId}, ${hospitalId}, ${statusId}, NULL, ${receiveQq}, ${receiveWechat}, ${finishedAt ? sqlStr(finishedAt) : 'NULL'}, ${ownerId}, ${ownerId}, '${createdAt}', '${createdAt}')`
    );
    dispatchMeta.push({ id: dispatchId, customerId, hospitalId, statusId, ownerId, createdAt, finishedAt });
    dispatchId++;
  }
}
for (let i = 0; i < dispatchBatch.length; i += 50) {
  const chunk = dispatchBatch.slice(i, i + 50);
  push(`INSERT INTO crm_dispatch (id, customer_id, hospital_id, status_id, image, receive_qq, receive_wechat, finished_at, creator_id, updater_id, created_at, updated_at) VALUES`);
  push(' ' + chunk.join(',\n ') + ';');
}
push('');

// 4.6 派单回复 (~每条"已联系以上"状态派单 1-2 条回复)
push('-- ---------- 派单回复 (~150 条) ----------');
const replyBatch = [];
for (const d of dispatchMeta) {
  if (d.statusId < 2) continue; // 仅"已联系及以上"有回复
  const replyCount = faker.number.int({ min: 1, max: 2 });
  for (let i = 0; i < replyCount; i++) {
    const tpl = pick(REPLY_TEMPLATES);
    const { project } = pickProject();
    const content = tpl.replace('{project}', project).replace('{budget}', pick(BUDGETS));
    const createdAt = fakeCreatedAt(faker.number.int({ min: 0, max: 30 }));
    const replyUserId = d.statusId >= 3 ? HOSPITAL_ID_START + (d.hospitalId - HOSPITAL_ID_START) : (KEFU_ID_START + faker.number.int({ min: 0, max: KEFU_COUNT - 1 }));
    replyBatch.push(`(${d.id}, ${replyUserId}, '${content}', '${createdAt}')`);
  }
}
if (replyBatch.length) {
  for (let i = 0; i < replyBatch.length; i += 50) {
    const chunk = replyBatch.slice(i, i + 50);
    push(`INSERT INTO crm_dispatch_reply (dispatch_id, user_id, content, created_at) VALUES`);
    push(' ' + chunk.join(',\n ') + ';');
  }
}
push('');

// 4.7 派单跟进日志 (~已完成派单有 1-2 条日志)
push('-- ---------- 派单跟进日志 (~80 条) ----------');
const followLogBatch = [];
for (const d of dispatchMeta) {
  if (d.statusId < 4) continue; // 仅"已成交"及以上有跟进日志
  if (faker.datatype.boolean({ probability: 0.4 })) {
    const content = pick(FOLLOWLOG_TEMPLATES);
    const createdAt = fakeCreatedAt(faker.number.int({ min: 0, max: 14 }));
    followLogBatch.push(`(${d.id}, ${d.ownerId}, '${content}', '${createdAt}')`);
  }
}
if (followLogBatch.length) {
  for (let i = 0; i < followLogBatch.length; i += 50) {
    const chunk = followLogBatch.slice(i, i + 50);
    push(`INSERT INTO crm_dispatch_follow_log (dispatch_id, user_id, content, created_at) VALUES`);
    push(' ' + chunk.join(',\n ') + ';');
  }
}
push('');

// 4.8 演示会员 (id 200..249) - 关联 customer_id 1:1
push('-- ---------- 演示会员 (id 200..249) ----------');
const memberBatch = [];
const memberMeta = []; // [ { id, ownerId, createdAt } ] 供后续 followup 用
for (let i = 0; i < MEMBER_COUNT; i++) {
  const mid = MEMBER_ID_START + i;
  // 关联到客户池前 50 个 (id 200..249), 避免 UNIQUE(customer_id) 冲突
  const customerId = CUSTOMER_ID_START + i;
  const stage = pick(MEMBER_STAGES);
  const intention = pick(INTENTION_LEVELS);
  const budget = pick(BUDGET_RANGES);
  const ownerId = KEFU_ID_START + faker.number.int({ min: 0, max: KEFU_COUNT - 1 });
  const joinedDaysAgo = faker.number.int({ min: 1, max: 60 });
  const joinedAt = fakeCreatedAt(joinedDaysAgo);
  const lastFollowDaysAgo = Math.max(0, joinedDaysAgo - faker.number.int({ min: 0, max: 20 }));
  const lastFollowAt = stage === 'new' ? 'NULL' : sqlStr(fakeCreatedAt(lastFollowDaysAgo));
  const nextFollowAt = stage === 'won' ? sqlStr(fakeCreatedAt(Math.max(0, lastFollowDaysAgo - 30))) : sqlStr(fakeCreatedAt(Math.max(0, lastFollowDaysAgo - 7)));
  const { category, project } = pickProject();
  const preferredHospitalId = HOSPITAL_ID_START + faker.number.int({ min: 0, max: HOSPITAL_COUNT - 1 });
  memberBatch.push(
    `(${mid}, '${memberNumberId(i + 1)}', ${customerId}, '演示会员${i + 1}', ${faker.number.int({ min: 1, max: 2 })}, '${fakeBirthday()}', '${fakeMobile()}', ${faker.datatype.boolean() ? `'${fakeWechat()}'` : 'NULL'}, ${faker.datatype.boolean() ? `'${fakeQQ()}'` : 'NULL'}, NULL, NULL, NULL, '${faker.location.city()}', 'from_customer', '${category}', '${project}', '${stage}', '${intention}', '${budget}', ${faker.datatype.boolean() ? sqlStr(fakeCreatedAt(faker.number.int({ min: 0, max: 30 }))) : 'NULL'}, ${preferredHospitalId}, 'active', '${joinedAt}', ${lastFollowAt}, ${nextFollowAt}, ${ownerId}, '演示会员数据，仅用于案例展示。', ${ownerId}, ${ownerId})`
  );
  memberMeta.push({ id: mid, ownerId, joinedAt });
}
for (let i = 0; i < memberBatch.length; i += 50) {
  const chunk = memberBatch.slice(i, i + 50);
  push(`INSERT INTO crm_member_customer (id, number_id, customer_id, name, gender, birthday, mobile, wechat, qq, province_id, city_id, district_id, address, source, business_category, intention_project, member_stage, intention_level, budget_range, expected_date, preferred_hospital_id, member_status, joined_at, last_follow_up_at, next_follow_up_at, owner_user_id, remark, creator_id, updater_id) VALUES`);
  push(' ' + chunk.join(',\n ') + ';');
}
push('');

// 4.9 跟进记录 (每个会员 1-3 条)
push('-- ---------- 跟进记录 (~100 条) ----------');
const followUpBatch = [];
for (const m of memberMeta) {
  const followCount = faker.number.int({ min: 1, max: 3 });
  for (let i = 0; i < followCount; i++) {
    const tpl = pick(FOLLOWUP_TEMPLATES);
    const { project } = pickProject();
    const content = tpl.content.replace('{project}', project);
    const result = tpl.result;
    const method = tpl.method;
    const createdAt = fakeCreatedAt(faker.number.int({ min: 0, max: 30 }));
    const stageAfter = pick(MEMBER_STAGES);
    const intentionAfter = pick(INTENTION_LEVELS);
    const nextFollowAt = fakeCreatedAt(faker.number.int({ min: 0, max: 7 }));
    followUpBatch.push(`(${m.id}, ${m.ownerId}, '${method}', '${content}', '${result}', '${stageAfter}', '${intentionAfter}', '${nextFollowAt}', '${createdAt}')`);
  }
}
for (let i = 0; i < followUpBatch.length; i += 50) {
  const chunk = followUpBatch.slice(i, i + 50);
  push(`INSERT INTO crm_follow_up_record (member_id, operator_user_id, follow_up_method, content, result, stage_after, intention_level_after, next_follow_up_at, created_at) VALUES`);
  push(' ' + chunk.join(',\n ') + ';');
}
push('');

push(`SELECT 'demo-seed-extended-done' AS result;`);
push('');

const outPath = resolve(__dirname, 'demo-seed-extended.sql');
writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log(`✓ Generated ${outPath}`);
console.log(`  - 演示客服: ${KEFU_COUNT}`);
console.log(`  - 演示医院: ${HOSPITAL_COUNT}`);
console.log(`  - 演示客户: ${CUSTOMER_COUNT}`);
console.log(`  - 演示派单: ${dispatchMeta.length}`);
console.log(`  - 派单回复: ${replyBatch.length}`);
console.log(`  - 派单跟进日志: ${followLogBatch.length}`);
console.log(`  - 演示会员: ${MEMBER_COUNT}`);
console.log(`  - 跟进记录: ${followUpBatch.length}`);