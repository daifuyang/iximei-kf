/**
 * CRM admin 端 API 适配层（fork 历史的 crm pages 用的 wrapper 形状）。
 *
 * - 旧 fork 的 `pnpm openapi` 拆成 crmCustomers/crmDispatches/... 多个文件，命名用
 *   `crmListXxx` 这种 camelCase。前端 pages 用 `getXxx/createXxx/...` 这种语义层
 *   wrapper 调用，保持业务调用与 HTTP 协议脱钩。
 *
 * - 当前 upstream 的 `pnpm openapi` 把整模块合成 `crm.ts`，函数名按 operationId
 *   推成 `crmV1ListXxx`。这里把函数映射到历史 wrapper 形状，让 page 不变。
 *
 * - 系统基础数据（区域 / 用户）来自 core，仍由 systemRegions / sysUsers 提供。
 */

import {
  crmV1ListCustomerStatuses,
  crmV1ListCustomers,
  crmV1CreateCustomer,
  crmV1UpdateCustomer,
  crmV1DispatchCustomer,
  crmV1AddCustomerRemark,
} from '@/services/generated/crm'

import {
  crmV1ListDispatchStatuses,
  crmV1ListDispatches,
  crmV1GetDispatch,
  crmV1UpdateDispatch,
  crmV1AddDispatchReply,
  crmV1AddDispatchLog,
} from '@/services/generated/crm'

import {
  crmV1ListHospitals,
  crmV1SearchHospitals,
  crmV1GetHospital,
  crmV1CreateHospital,
  crmV1UpdateHospital,
  crmV1DeleteHospital,
  crmV1ListHospitalAccounts,
  crmV1CreateHospitalAccount,
  crmV1AssignHospitalAccount,
  crmV1UpdateHospitalAccount,
  crmV1DeleteHospitalAccount,
} from '@/services/generated/crm'

import {
  crmV1ListMembers,
  crmV1GetMember,
  crmV1CreateMember,
  crmV1UpdateMember,
  crmV1AddMemberRemark,
} from '@/services/generated/crm'

import { getSystemRegionTree } from '@/services/generated/systemRegions'
import { getUserList } from '@/services/generated/sysUsers'

/* ---------- 系统基础数据 ---------- */

export const getRegionTree = (params: object) => getSystemRegionTree(params as never)
export const getUsers = (params: object) => getUserList(params as never)

/* ---------- 客户 ---------- */

export const getCustomerStatuses = crmV1ListCustomerStatuses
export const getCustomers = (params: object) => crmV1ListCustomers(params as never)
export const createCustomer = (body: object) => crmV1CreateCustomer(body as never)
export const updateCustomer = (id: number, body: object) =>
  crmV1UpdateCustomer({ id }, body as never)
export const dispatchCustomer = (id: number, body: object) =>
  crmV1DispatchCustomer({ id }, body as never)
export const addCustomerRemark = (id: number, body: object) =>
  crmV1AddCustomerRemark({ id }, body as never)

/* ---------- 派单 ---------- */

export const getDispatchStatuses = crmV1ListDispatchStatuses
export const getDispatches = (params: object) => crmV1ListDispatches(params as never)
export const getDispatch = (id: number) => crmV1GetDispatch({ id })
export const updateDispatch = (id: number, body: object) =>
  crmV1UpdateDispatch({ id }, body as never)
export const addDispatchReply = (id: number, body: object) =>
  crmV1AddDispatchReply({ id }, body as never)
export const addDispatchLog = (id: number, body: object) =>
  crmV1AddDispatchLog({ id }, body as never)

/* ---------- 医院 ---------- */

export const getHospitals = (params: object) => crmV1ListHospitals(params as never)
export const searchHospitals = (params: object) => crmV1SearchHospitals(params as never)
export const getHospital = (id: number) => crmV1GetHospital({ id })
export const createHospital = (body: object) => crmV1CreateHospital(body as never)
export const updateHospital = (id: number, body: object) =>
  crmV1UpdateHospital({ id }, body as never)
export const deleteHospital = (id: number) => crmV1DeleteHospital({ id })

export const getHospitalAccounts = (id: number) => crmV1ListHospitalAccounts({ id })
export const createHospitalAccount = (id: number, body: object) =>
  crmV1CreateHospitalAccount({ id }, body as never)
export const updateHospitalAccount = (id: number, userId: number, body: object) =>
  crmV1UpdateHospitalAccount({ id, userId }, body as never)
export const deleteHospitalAccount = (id: number, userId: number) =>
  crmV1DeleteHospitalAccount({ id, userId })
export const assignHospitalAccount = (id: number, body: object) =>
  crmV1AssignHospitalAccount({ id }, body as never)

/* ---------- 会员 ---------- */

export const getMembers = (params: object) => crmV1ListMembers(params as never)
export const getMember = (id: number) => crmV1GetMember({ id })
export const createMember = (body: object) => crmV1CreateMember(body as never)
export const updateMember = (id: number, body: object) =>
  crmV1UpdateMember({ id }, body as never)
export const addMemberRemark = (id: number, body: object) =>
  crmV1AddMemberRemark({ id }, body as never)
