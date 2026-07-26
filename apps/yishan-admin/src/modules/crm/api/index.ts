/**
 * CRM admin 端 API 适配层。
 *
 * - 生成的 API 客户端在 `@/services/generated/crm`，函数名由后端 operationId 决定
 *   （命名规范：`<action><Domain><Resource>`，如 `listCrmCustomers`）。
 * - 本文件提供语义层 wrapper（`getCustomers` / `createCustomer` / ...），
 *   让业务页面与 HTTP 协议脱钩。
 * - 系统基础数据（区域 / 用户）来自 core，由 systemRegions / sysUsers 提供。
 */

import {
  listCrmCustomerStatuses,
  listCrmCustomers,
  createCrmCustomer,
  updateCrmCustomer,
  dispatchCrmCustomer,
  createCrmCustomerRemark,
} from '@/services/generated/crm'

import {
  listCrmDispatchStatuses,
  listCrmDispatches,
  getCrmDispatch,
  updateCrmDispatch,
  createCrmDispatchReply,
  createCrmDispatchLog,
} from '@/services/generated/crm'

import {
  listCrmHospitals,
  searchCrmHospitals,
  getCrmHospital,
  createCrmHospital,
  updateCrmHospital,
  deleteCrmHospital,
  listCrmHospitalAccounts,
  createCrmHospitalAccount,
  assignCrmHospitalAccount,
  updateCrmHospitalAccount,
  deleteCrmHospitalAccount,
} from '@/services/generated/crm'

import {
  listCrmMembers,
  getCrmMember,
  createCrmMember,
  updateCrmMember,
  createCrmMemberRemark,
} from '@/services/generated/crm'

import { getCrmDashboardStats } from '@/services/generated/crm'

import { getSystemRegionTree } from '@/services/generated/systemRegions'
import { getUserList } from '@/services/generated/sysUsers'

/* ---------- 系统基础数据 ---------- */

export const getRegionTree = (params: object) => getSystemRegionTree(params as never)
export const getUsers = (params: object) => getUserList(params as never)

/* ---------- 客户 ---------- */

export const getCustomerStatuses = listCrmCustomerStatuses
export const getCustomers = (params: object) => listCrmCustomers(params as never)
export const createCustomer = (body: object) => createCrmCustomer(body as never)
export const updateCustomer = (id: number, body: object) =>
  updateCrmCustomer({ id }, body as never)
export const dispatchCustomer = (id: number, body: object) =>
  dispatchCrmCustomer({ id }, body as never)
export const addCustomerRemark = (id: number, body: object) =>
  createCrmCustomerRemark({ id }, body as never)

/* ---------- 派单 ---------- */

export const getDispatchStatuses = listCrmDispatchStatuses
export const getDispatches = (params: object) => listCrmDispatches(params as never)
export const getDispatch = (id: number) => getCrmDispatch({ id })
export const updateDispatch = (id: number, body: object) =>
  updateCrmDispatch({ id }, body as never)
export const addDispatchReply = (id: number, body: object) =>
  createCrmDispatchReply({ id }, body as never)
export const addDispatchLog = (id: number, body: object) =>
  createCrmDispatchLog({ id }, body as never)

/* ---------- 医院 ---------- */

export const getHospitals = (params: object) => listCrmHospitals(params as never)
export const searchHospitals = (params: object) => searchCrmHospitals(params as never)
export const getHospital = (id: number) => getCrmHospital({ id })
export const createHospital = (body: object) => createCrmHospital(body as never)
export const updateHospital = (id: number, body: object) =>
  updateCrmHospital({ id }, body as never)
export const deleteHospital = (id: number) => deleteCrmHospital({ id })

export const getHospitalAccounts = (id: number) => listCrmHospitalAccounts({ id })
export const createHospitalAccount = (id: number, body: object) =>
  createCrmHospitalAccount({ id }, body as never)
export const updateHospitalAccount = (id: number, userId: number, body: object) =>
  updateCrmHospitalAccount({ id, userId }, body as never)
export const deleteHospitalAccount = (id: number, userId: number) =>
  deleteCrmHospitalAccount({ id, userId })
export const assignHospitalAccount = (id: number, body: object) =>
  assignCrmHospitalAccount({ id }, body as never)

/* ---------- 会员 ---------- */

import { request } from '@umijs/max'

export const getMembers = (params: object) => listCrmMembers(params as never)
export const getMember = (id: number) => getCrmMember({ id })
export const getMemberBrief = (id: number) => request<any>(`/api/crm/v1/members/${id}/brief`)
export const createMember = (body: object) => createCrmMember(body as never)
export const updateMember = (id: number, body: object) =>
  updateCrmMember({ id }, body as never)
export const addMemberRemark = (id: number, body: object) =>
  createCrmMemberRemark({ id }, body as never)

/** 从客户转会员 */
export const createMemberFromCustomer = (body: object) =>
  request<any>('/api/crm/v1/members/from-customer', { method: 'POST', data: body })

/** 直接新增会员 */
export const createMemberDirect = (body: object) =>
  request<any>('/api/crm/v1/members/direct', { method: 'POST', data: body })

/** 添加跟进记录 */
export const addMemberFollowUp = (id: number, body: object) =>
  request<any>(`/api/crm/v1/members/${id}/follow-ups`, { method: 'POST', data: body })

/** 跟进记录列表 */
export const getMemberFollowUps = (id: number) =>
  request<any>(`/api/crm/v1/members/${id}/follow-ups`)

/** 创建派单 */
export const createMemberDispatch = (id: number, body: object) =>
  request<any>(`/api/crm/v1/members/${id}/dispatches`, { method: 'POST', data: body })

/** 批量分配 */
export const batchAssignMembers = (body: object) =>
  request<any>('/api/crm/v1/members/batch-assign', { method: 'POST', data: body })

/** 批量打标签 */
export const batchTagMembers = (body: object) =>
  request<any>('/api/crm/v1/members/batch-tags', { method: 'POST', data: body })

/** 批量作废 */
export const batchInvalidateMembers = (body: object) =>
  request<any>('/api/crm/v1/members/batch-invalidate', { method: 'POST', data: body })

/** 单条作废 */
export const invalidateMember = (id: number) =>
  request<any>(`/api/crm/v1/members/${id}/invalidate`, { method: 'POST' })

/** 恢复会员 */
export const restoreMember = (id: number, body?: object) =>
  request<any>(`/api/crm/v1/members/${id}/restore`, { method: 'POST', data: body || {} })

/** 标签列表 */
export const getMemberTags = () =>
  request<any>('/api/crm/v1/member-tags')

/** 创建标签 */
export const createMemberTag = (body: object) =>
  request<any>('/api/crm/v1/member-tags', { method: 'POST', data: body })

/** 删除标签 */
export const deleteMemberTag = (id: number) =>
  request<any>(`/api/crm/v1/member-tags/${id}`, { method: 'DELETE' })

/** 会员概览统计 */
export const getMemberOverview = () =>
  request<any>('/api/crm/v1/members/overview')

/** 可转会员的客户列表 */
export const getSelectableCustomers = (params: object) =>
  request<any>('/api/crm/v1/customers/selectable', { params })

/* ---------- 数据看板 ---------- */

export const getDashboardStats = (params?: {
  startDate?: string;
  endDate?: string;
  hospitalId?: number;
}) => getCrmDashboardStats(params || {})
