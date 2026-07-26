import { datetime, date, int, json, mysqlTable, text, varchar, uniqueIndex, index } from 'drizzle-orm/mysql-core'
import { sql } from 'drizzle-orm'

const timestamps = {
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
}

export const crmHospital = mysqlTable('crm_hospital', {
  id: int().primaryKey().autoincrement().notNull(), accountUserId: int('account_user_id'), hospitalName: varchar('hospital_name', { length: 100 }).notNull(), provinceId: int('province_id'), cityId: int('city_id'), districtId: int('district_id'), hospitalAddress: varchar('hospital_address', { length: 255 }), hospitalPhone: varchar('hospital_phone', { length: 50 }), hospitalSelling: varchar('hospital_selling', { length: 255 }), hospitalWebsite: varchar('hospital_website', { length: 255 }), hospitalNature: int('hospital_nature').notNull().default(-1), doctorName: varchar('doctor_name', { length: 50 }), doctorPhone: varchar('doctor_phone', { length: 50 }), doctorQq: varchar('doctor_qq', { length: 50 }), receptionName: varchar('reception_name', { length: 50 }), receptionPhone: varchar('reception_phone', { length: 50 }), receptionQq: varchar('reception_qq', { length: 50 }), busStation: varchar('bus_station', { length: 100 }), busAddress: varchar('bus_address', { length: 255 }), subwayStation: varchar('subway_station', { length: 100 }), subwayAddress: varchar('subway_address', { length: 255 }), taxiFare: varchar('taxi_fare', { length: 50 }), vipDiscount: varchar('vip_discount', { length: 255 }), returnPoint: varchar('return_point', { length: 50 }), hospitalIntroduction: text('hospital_introduction'), contractPhotos: json('contract_photos'), wechatOpenid: varchar('wechat_openid', { length: 64 }), status: int().notNull().default(1), creatorId: int('creator_id').notNull(), ...timestamps, updaterId: int('updater_id').notNull(), deletedAt: datetime('deleted_at', { mode: 'date' }), version: int().notNull().default(1),
}, (t) => [uniqueIndex('uniq_crm_hospital_account_user').on(t.accountUserId), uniqueIndex('uniq_crm_hospital_name').on(t.hospitalName), index('idx_crm_hospital_region').on(t.provinceId,t.cityId,t.districtId), index('idx_crm_hospital_status').on(t.status), index('idx_crm_hospital_deleted_at').on(t.deletedAt)])

export const crmCustomerStatus = mysqlTable('crm_customer_status', { id: int().primaryKey().autoincrement().notNull(), name: varchar({ length: 50 }).notNull(), sortOrder: int('sort_order').notNull().default(0), status: int().notNull().default(1), ...timestamps }, (t) => [uniqueIndex('uniq_crm_customer_status_name').on(t.name), index('idx_crm_customer_status').on(t.status,t.sortOrder)])
export const crmCustomer = mysqlTable('crm_customer', { id: int().primaryKey().autoincrement().notNull(), numberId: varchar('number_id', { length: 20 }).notNull(), name: varchar({ length: 50 }).notNull(), gender: int().notNull().default(0), birthday: date('birthday', { mode: 'date' }), telphone: varchar({ length: 20 }), mobile: varchar({ length: 20 }), qq: varchar({ length: 20 }), wechat: varchar({ length: 50 }), provinceId: int('province_id'), cityId: int('city_id'), districtId: int('district_id'), address: varchar({ length: 255 }), plastic: varchar({ length: 255 }), statusId: int('status_id').notNull(), remark: text(), ownerUserId: int('owner_user_id').notNull(), creatorId: int('creator_id').notNull(), ...timestamps, updaterId: int('updater_id').notNull(), deletedAt: datetime('deleted_at', { mode: 'date' }), version: int().notNull().default(1) }, (t) => [uniqueIndex('uniq_crm_customer_number_id').on(t.numberId), index('idx_crm_customer_owner').on(t.ownerUserId), index('idx_crm_customer_status').on(t.statusId), index('idx_crm_customer_mobile').on(t.mobile), index('idx_crm_customer_created').on(t.createdAt), index('idx_crm_customer_deleted_at').on(t.deletedAt)])
export const crmCustomerRemark = mysqlTable('crm_customer_remark', { id: int().primaryKey().autoincrement().notNull(), customerId: int('customer_id').notNull(), userId: int('user_id').notNull(), content: text().notNull(), createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`) }, (t) => [index('idx_crm_customer_remark_customer').on(t.customerId), index('idx_crm_customer_remark_user').on(t.userId)])
export const crmCustomerBrowse = mysqlTable('crm_customer_browse', { id: int().primaryKey().autoincrement().notNull(), customerId: int('customer_id').notNull(), userId: int('user_id').notNull(), action: varchar({ length: 20 }).notNull().default('view'), createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`) }, (t) => [index('idx_crm_customer_browse_customer').on(t.customerId), index('idx_crm_customer_browse_user').on(t.userId)])
export const crmDispatchStatus = mysqlTable('crm_dispatch_status', { id: int().primaryKey().autoincrement().notNull(), name: varchar({ length: 50 }).notNull(), sortOrder: int('sort_order').notNull().default(0), status: int().notNull().default(1), ...timestamps }, (t) => [uniqueIndex('uniq_crm_dispatch_status_name').on(t.name), index('idx_crm_dispatch_status').on(t.status,t.sortOrder)])
export const crmDispatch = mysqlTable('crm_dispatch', { id: int().primaryKey().autoincrement().notNull(), customerId: int('customer_id').notNull(), hospitalId: int('hospital_id').notNull(), statusId: int('status_id').notNull(), image: varchar({ length: 500 }), receiveQq: varchar('receive_qq', { length: 50 }), receiveWechat: varchar('receive_wechat', { length: 50 }), finishedAt: datetime('finished_at', { mode: 'date' }), creatorId: int('creator_id').notNull(), ...timestamps, updaterId: int('updater_id').notNull(), deletedAt: datetime('deleted_at', { mode: 'date' }), version: int().notNull().default(1) }, (t) => [index('idx_crm_dispatch_customer').on(t.customerId), index('idx_crm_dispatch_hospital').on(t.hospitalId), index('idx_crm_dispatch_status').on(t.statusId), index('idx_crm_dispatch_created').on(t.createdAt), index('idx_crm_dispatch_deleted_at').on(t.deletedAt)])
export const crmDispatchReply = mysqlTable('crm_dispatch_reply', { id: int().primaryKey().autoincrement().notNull(), dispatchId: int('dispatch_id').notNull(), userId: int('user_id').notNull(), content: text().notNull(), createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`) }, (t) => [index('idx_crm_dispatch_reply_dispatch').on(t.dispatchId), index('idx_crm_dispatch_reply_user').on(t.userId)])
export const crmDispatchFollowLog = mysqlTable('crm_dispatch_follow_log', { id: int().primaryKey().autoincrement().notNull(), dispatchId: int('dispatch_id').notNull(), userId: int('user_id').notNull(), content: text().notNull(), createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`) }, (t) => [index('idx_crm_dispatch_log_dispatch').on(t.dispatchId), index('idx_crm_dispatch_log_user').on(t.userId)])

// ──────────────────────────────────────────────
// 会员顾客模块 (enhanced)
// ──────────────────────────────────────────────

/** 会员主表 — 关联 crm_customer(customerId) 或直接新增 */
export const crmMemberCustomer = mysqlTable('crm_member_customer', {
  id: int().primaryKey().autoincrement().notNull(),
  numberId: varchar('number_id', { length: 20 }).notNull(),
  customerId: int('customer_id'),
  // 基本资料（当 customerId 不为空时从 crm_customer 同步；直接新增时独立存储）
  name: varchar({ length: 50 }).notNull(),
  gender: int().notNull().default(0),
  birthday: date('birthday', { mode: 'date' }),
  mobile: varchar({ length: 20 }),
  wechat: varchar({ length: 50 }),
  qq: varchar({ length: 20 }),
  address: varchar({ length: 255 }),
  provinceId: int('province_id'),
  cityId: int('city_id'),
  districtId: int('district_id'),
  // 来源: 'from_customer' | 'direct'
  source: varchar({ length: 20 }).notNull().default('from_customer'),
  // 会员业务信息
  businessCategory: varchar('business_category', { length: 50 }),
  intentionProject: varchar('intention_project', { length: 255 }),
  memberStage: varchar('member_stage', { length: 30 }).notNull().default('new'),
  intentionLevel: varchar('intention_level', { length: 20 }).notNull().default('unset'),
  budgetRange: varchar('budget_range', { length: 50 }),
  expectedDate: date('expected_date', { mode: 'date' }),
  preferredHospitalId: int('preferred_hospital_id'),
  // 状态控制
  memberStatus: varchar('member_status', { length: 20 }).notNull().default('active'), // 'active' | 'invalid'
  joinedAt: datetime('joined_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  invalidAt: datetime('invalid_at', { mode: 'date' }),
  invalidBy: int('invalid_by'),
  previousStage: varchar('previous_stage', { length: 30 }),
  // 跟进相关
  lastFollowUpAt: datetime('last_follow_up_at', { mode: 'date' }),
  nextFollowUpAt: datetime('next_follow_up_at', { mode: 'date' }),
  // 归属
  ownerUserId: int('owner_user_id').notNull(),
  // 备注
  remark: text(),
  // 审计
  creatorId: int('creator_id').notNull(),
  ...timestamps,
  updaterId: int('updater_id').notNull(),
  deletedAt: datetime('deleted_at', { mode: 'date' }),
  version: int().notNull().default(1),
}, (t) => [
  uniqueIndex('uniq_crm_member_number_id').on(t.numberId),
  uniqueIndex('uniq_crm_member_customer_id').on(t.customerId),
  index('idx_crm_member_owner').on(t.ownerUserId),
  index('idx_crm_member_mobile').on(t.mobile),
  index('idx_crm_member_stage').on(t.memberStage),
  index('idx_crm_member_status').on(t.memberStatus),
  index('idx_crm_member_created').on(t.createdAt),
  index('idx_crm_member_deleted_at').on(t.deletedAt),
])

export const crmMemberRemark = mysqlTable('crm_member_remark', { id: int().primaryKey().autoincrement().notNull(), memberId: int('member_id').notNull(), userId: int('user_id').notNull(), content: text().notNull(), createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`) }, (t) => [index('idx_crm_member_remark_member').on(t.memberId), index('idx_crm_member_remark_user').on(t.userId)])
export const crmMemberBrowse = mysqlTable('crm_member_browse', { id: int().primaryKey().autoincrement().notNull(), memberId: int('member_id').notNull(), userId: int('user_id').notNull(), action: varchar({ length: 20 }).notNull().default('view'), createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`) }, (t) => [index('idx_crm_member_browse_member').on(t.memberId), index('idx_crm_member_browse_user').on(t.userId)])

/** 会员标签定义 */
export const crmMemberTag = mysqlTable('crm_member_tag', {
  id: int().primaryKey().autoincrement().notNull(),
  name: varchar({ length: 50 }).notNull(),
  color: varchar({ length: 20 }),
  status: int().notNull().default(1),
  creatorId: int('creator_id').notNull(),
  ...timestamps,
  deletedAt: datetime('deleted_at', { mode: 'date' }),
}, (t) => [uniqueIndex('uniq_crm_member_tag_name').on(t.name)])

/** 会员-标签 N:M 关系 */
export const crmMemberTagRelation = mysqlTable('crm_member_tag_relation', {
  id: int().primaryKey().autoincrement().notNull(),
  memberId: int('member_id').notNull(),
  tagId: int('tag_id').notNull(),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
}, (t) => [
  uniqueIndex('uniq_crm_member_tag_rel').on(t.memberId, t.tagId),
  index('idx_crm_member_tag_rel_member').on(t.memberId),
  index('idx_crm_member_tag_rel_tag').on(t.tagId),
])

/** 跟进记录 */
export const crmFollowUpRecord = mysqlTable('crm_follow_up_record', {
  id: int().primaryKey().autoincrement().notNull(),
  memberId: int('member_id').notNull(),
  operatorUserId: int('operator_user_id').notNull(),
  followUpMethod: varchar('follow_up_method', { length: 20 }),
  content: text().notNull(),
  result: varchar({ length: 30 }),
  stageAfter: varchar('stage_after', { length: 30 }),
  intentionLevelAfter: varchar('intention_level_after', { length: 20 }),
  nextFollowUpAt: datetime('next_follow_up_at', { mode: 'date' }),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
}, (t) => [
  index('idx_crm_follow_up_member').on(t.memberId),
  index('idx_crm_follow_up_created').on(t.createdAt),
])

/** 会员转交历史 */
export const crmMemberAssignmentHistory = mysqlTable('crm_member_assignment_history', {
  id: int().primaryKey().autoincrement().notNull(),
  memberId: int('member_id').notNull(),
  fromUserId: int('from_user_id'),
  toUserId: int('to_user_id').notNull(),
  operatorUserId: int('operator_user_id').notNull(),
  reason: varchar({ length: 255 }),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
}, (t) => [
  index('idx_crm_member_assign_member').on(t.memberId),
  index('idx_crm_member_assign_created').on(t.createdAt),
])

export const crmHospitalAccount = mysqlTable('crm_hospital_account', { id: int().primaryKey().autoincrement().notNull(), hospitalId: int('hospital_id').notNull(), userId: int('user_id').notNull(), role: varchar({ length: 20 }).notNull().default('member'), status: int().notNull().default(1), remark: varchar({ length: 255 }), creatorId: int('creator_id').notNull(), ...timestamps, updaterId: int('updater_id').notNull(), deletedAt: datetime('deleted_at', { mode: 'date' }) }, (t) => [uniqueIndex('uniq_crm_hospital_account').on(t.hospitalId,t.userId), index('idx_crm_hospital_account_hospital').on(t.hospitalId), index('idx_crm_hospital_account_user').on(t.userId), index('idx_crm_hospital_account_status').on(t.status), index('idx_crm_hospital_account_deleted_at').on(t.deletedAt)])
