/**
 * CRM admin 端 API 适配层。
 *
 * - 生成的 API 客户端在 `@/services/generated/crm`，函数名由后端 operationId 决定
 *   （命名规范：`<action><Domain><Resource>`，如 `listCrmCustomers`）。
 * - 本文件提供语义层 wrapper（`getCustomers` / `createCustomer` / ...），
 *   让业务页面与 HTTP 协议脱钩。
 * - 系统基础数据（区域 / 用户）来自 core，由 systemRegions / sysUsers 提供。
 */

import { request } from '@umijs/max';
import {
  createCrmCustomer,
  createCrmCustomerRemark,
  createCrmDispatchLog,
  createCrmDispatchReply,
  createCrmHospital,
  createCrmMemberRemark,
  deleteCrmHospital,
  dispatchCrmCustomer,
  getCrmDashboardStats,
  getCrmDispatch,
  getCrmHospital,
  getCrmMember,
  listCrmCustomerStatuses,
  listCrmCustomers,
  listCrmDispatchMobileViewLogs,
  listCrmDispatches,
  listCrmDispatchStatuses,
  listCrmHospitals,
  listCrmMembers,
  searchCrmHospitals,
  updateCrmCustomer,
  updateCrmDispatch,
  updateCrmHospital,
  updateCrmMember,
  viewCrmDispatchMobile,
} from '@/services/generated/crm';

import { getSystemRegionTree } from '@/services/generated/systemRegions';
import { getUserList } from '@/services/generated/sysUsers';

/* ---------- 系统基础数据 ---------- */

export const getRegionTree = (params: object) =>
  getSystemRegionTree(params as never);
export const getUsers = (params: object) => getUserList(params as never);

/** 「归属客服」下拉专用：只取 customer_service 角色、启用状态的用户。
 *  避免医院账号误选到客户/会员的归属客服。 */
export const getCustomerServiceUsers = (params: { keyword?: string; pageSize?: number } = {}) =>
  getUserList({
    pageSize: params.pageSize ?? 100,
    status: '1',
    roleId: 4,
    ...(params.keyword ? { keyword: params.keyword } : {}),
  } as never);

/* ---------- 客户 ---------- */

export const getCustomerStatuses = listCrmCustomerStatuses;
export const getCustomers = (params: object) =>
  listCrmCustomers(params as never);
export const createCustomer = (body: object) =>
  createCrmCustomer(body as never);
export const updateCustomer = (id: number, body: object) =>
  updateCrmCustomer({ id }, body as never);
export const dispatchCustomer = (id: number, body: object) =>
  dispatchCrmCustomer({ id }, body as never);
export const addCustomerRemark = (id: number, body: object) =>
  createCrmCustomerRemark({ id }, body as never);

/* ---------- 派单 ---------- */

export const getDispatchStatuses = listCrmDispatchStatuses;
export const getDispatches = (params: object) =>
  listCrmDispatches(params as never);
export const getDispatch = (id: number) => getCrmDispatch({ id });
export const updateDispatch = (id: number, body: object) =>
  updateCrmDispatch({ id }, body as never);
export const addDispatchReply = (id: number, body: object) =>
  createCrmDispatchReply({ id }, body as never);
export const addDispatchLog = (id: number, body: object) =>
  createCrmDispatchLog({ id }, body as never);

/** 医院账号点眼睛 → 后端记日志 + 返回明文（operationId: viewCrmDispatchMobile） */
export const viewDispatchMobile = (id: number) =>
  viewCrmDispatchMobile({ id });

/** super_admin：拉取某派单的手机号查看日志（operationId: listCrmDispatchMobileViewLogs） */
export const getDispatchMobileViewLogs = (id: number) =>
  listCrmDispatchMobileViewLogs({ id });

/** super_admin / admin：拉取某派单的全部医院查看日志
 *  手写 wrapper：T5 落了路由 + schema，但 OpenAPI 尚未重生（生成的 services/crm.ts 里没有 listCrmDispatchHospitalViewLogs），
 *  走 request 直接命中后端契约。等下次 `pnpm --filter yishan-admin openapi` 之后可替换为生成的函数。 */
export const getDispatchHospitalViewLogs = (id: number) =>
  request<any>(`/api/crm/v1/dispatches/${id}/hospital-view-logs`);

/* ---------- 医院 ---------- */

export const getHospitals = (params: object) =>
  listCrmHospitals(params as never);
export const searchHospitals = (params: object) =>
  searchCrmHospitals(params as never);
export const getHospital = (id: number) => getCrmHospital({ id });
export const createHospital = (body: object) =>
  createCrmHospital(body as never);
export const updateHospital = (id: number, body: object) =>
  updateCrmHospital({ id }, body as never);
export const deleteHospital = (id: number) => deleteCrmHospital({ id });

export const getHospitalAccount = (id: number) =>
  request<any>(`/api/crm/v1/hospitals/${id}/account`);
export const updateHospitalAccount = (id: number, body: object) =>
  request<any>(`/api/crm/v1/hospitals/${id}/account`, {
    method: 'PATCH',
    data: body,
  });
export const resetHospitalAccountPassword = (id: number, newPassword: string) =>
  request<any>(`/api/crm/v1/hospitals/${id}/account/reset-password`, {
    method: 'POST',
    data: { newPassword },
  });
/** 仅系统管理员（持有 crm:hospitals:rename 权限）可调用 */
export const renameHospital = (id: number, newHospitalName: string) =>
  request<any>(`/api/crm/v1/hospitals/${id}/rename`, {
    method: 'POST',
    data: { newHospitalName },
  });

/* ---------- 会员 ---------- */

export const getMembers = (params: object) => listCrmMembers(params as never);
export const getMember = (id: number) => getCrmMember({ id });
export const getMemberBrief = (id: number) =>
  request<any>(`/api/crm/v1/members/${id}/brief`);
// 会员创建分两条：转客户 / 直接新增；见下方 createMemberFromCustomer / createMemberDirect。
export const updateMember = (id: number, body: object) =>
  updateCrmMember({ id }, body as never);
export const addMemberRemark = (id: number, body: object) =>
  createCrmMemberRemark({ id }, body as never);

/** 从客户转会员 */
export const createMemberFromCustomer = (body: object) =>
  request<any>('/api/crm/v1/members/from-customer', {
    method: 'POST',
    data: body,
  });

/** 直接新增会员 */
export const createMemberDirect = (body: object) =>
  request<any>('/api/crm/v1/members/direct', { method: 'POST', data: body });

/** 添加跟进记录 */
export const addMemberFollowUp = (id: number, body: object) =>
  request<any>(`/api/crm/v1/members/${id}/follow-ups`, {
    method: 'POST',
    data: body,
  });

/** 跟进记录列表 */
export const getMemberFollowUps = (id: number) =>
  request<any>(`/api/crm/v1/members/${id}/follow-ups`);

/** 创建派单 */
export const createMemberDispatch = (id: number, body: object) =>
  request<any>(`/api/crm/v1/members/${id}/dispatches`, {
    method: 'POST',
    data: body,
  });

/** 批量分配 */
export const batchAssignMembers = (body: object) =>
  request<any>('/api/crm/v1/members/batch-assign', {
    method: 'POST',
    data: body,
  });

/** 批量打标签 */
export const batchTagMembers = (body: object) =>
  request<any>('/api/crm/v1/members/batch-tags', {
    method: 'POST',
    data: body,
  });

/** 批量作废 */
export const batchInvalidateMembers = (body: object) =>
  request<any>('/api/crm/v1/members/batch-invalidate', {
    method: 'POST',
    data: body,
  });

/** 单条作废 */
export const invalidateMember = (id: number) =>
  request<any>(`/api/crm/v1/members/${id}/invalidate`, { method: 'POST' });

/** 恢复会员 */
export const restoreMember = (id: number, body?: object) =>
  request<any>(`/api/crm/v1/members/${id}/restore`, {
    method: 'POST',
    data: body || {},
  });

/** 标签列表 */
export const getMemberTags = () => request<any>('/api/crm/v1/member-tags');

/** 创建标签 */
export const createMemberTag = (body: object) =>
  request<any>('/api/crm/v1/member-tags', { method: 'POST', data: body });

/** 删除标签 */
export const deleteMemberTag = (id: number) =>
  request<any>(`/api/crm/v1/member-tags/${id}`, { method: 'DELETE' });

/** 会员概览统计 */
export const getMemberOverview = () =>
  request<any>('/api/crm/v1/members/overview');

/** 可转会员的客户列表 */
// 路由在 crm members 模块下（prefix /api/crm/v1/members），不是 customers 模块。
// 历史原因：曾短暂挂在 /api/crm/v1/customers/selectable，已迁回 members 模块；
// 前端如果继续打旧路径会被 module-loader 的 onRequest 404 gate 直接拒掉（code 40400）。
// members 模块的 listSelectableCustomers 已经实现了 (a) 11位手机号精确匹配
// (b) notExists 排除已有活跃会员关联的客户；保持 README/期望行为一致。
export const getSelectableCustomers = (params: object) =>
  request<any>('/api/crm/v1/members/customers/selectable', { params });

/* ---------- 数据看板 ---------- */

export const getDashboardStats = (params?: {
  startDate?: string;
  endDate?: string;
  hospitalId?: number;
}) => getCrmDashboardStats(params || {});

/**
 * 医院数据看板。
 *
 * - hospital_account：不传 hospitalId，固定看本院。
 * - super_admin：不传 hospitalId = 全院汇总；传 = 单院。
 * - startDate/endDate 可选 (YYYY-MM-DD，闭区间)；不给则统计累计数据。
 * operationId 暂未生成，走 request 直接命中后端契约。
 */
export const getHospitalDashboardStats = (params?: {
  hospitalId?: number;
  startDate?: string;
  endDate?: string;
}) => request<any>('/api/crm/v1/hospital/dashboard/stats', { params });

/** 医院账号未查看派单数（顶栏红点）。super_admin 传 hospitalId=单院，不传=全院。 */
export const getHospitalUnviewedCount = (params?: { hospitalId?: number }) =>
  request<any>('/api/crm/v1/hospital/dispatches/unviewed-count', { params });

/** 医院派单趋势 + 查看状态分布（折线/饼图用，operationId 暂未生成） */
export const getHospitalDashboardTrend = (params?: {
  hospitalId?: number;
  startDate?: string;
  endDate?: string;
}) => request<any>('/api/crm/v1/hospital/dashboard/trend', { params });
