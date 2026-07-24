// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 客户列表 GET /api/crm/v1/customers */
export async function crmV1ListCustomers(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmV1ListCustomersParams,
  options?: { [key: string]: any }
) {
  return request<any>("/api/crm/v1/customers", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      // pageSize has a default value: 10
      pageSize: "10",

      ...params,
    },
    ...(options || {}),
  });
}

/** 新建客户 POST /api/crm/v1/customers */
export async function crmV1CreateCustomer(
  body: {
    numberId?: string;
    name: string;
    gender?: number;
    birthday?: string;
    telphone?: string;
    mobile?: string;
    qq?: string;
    wechat?: string;
    provinceId?: number;
    cityId?: number;
    districtId?: number;
    address?: string;
    plastic?: string;
    statusId?: number;
    remark?: string;
    ownerUserId?: number;
  },
  options?: { [key: string]: any }
) {
  return request<any>("/api/crm/v1/customers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 客户详情 GET /api/crm/v1/customers/${param0} */
export async function crmV1GetCustomer(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmV1GetCustomerParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/customers/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新客户 PATCH /api/crm/v1/customers/${param0} */
export async function crmV1UpdateCustomer(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmV1UpdateCustomerParams,
  body: {
    numberId?: string;
    name?: string;
    gender?: number;
    birthday?: string;
    telphone?: string;
    mobile?: string;
    qq?: string;
    wechat?: string;
    provinceId?: number;
    cityId?: number;
    districtId?: number;
    address?: string;
    plastic?: string;
    statusId?: number;
    remark?: string;
    ownerUserId?: number;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/customers/${param0}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 客户派单 POST /api/crm/v1/customers/${param0}/dispatch */
export async function crmV1DispatchCustomer(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmV1DispatchCustomerParams,
  body: {
    hospitalIds: number[];
    reply?: string;
    statusId?: number;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/customers/${param0}/dispatch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 客户备注（占位） POST /api/crm/v1/customers/${param0}/remarks */
export async function crmV1AddCustomerRemark(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmV1AddCustomerRemarkParams,
  body: {
    content: string;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/customers/${param0}/remarks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 客户列表 GET /api/crm/v1/customers/customers */
export async function crmV1ListCustomers2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmV1ListCustomersParams,
  options?: { [key: string]: any }
) {
  return request<any>("/api/crm/v1/customers/customers", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      // pageSize has a default value: 10
      pageSize: "10",

      ...params,
    },
    ...(options || {}),
  });
}

/** 新建客户 POST /api/crm/v1/customers/customers */
export async function crmV1CreateCustomer2(
  body: {
    numberId?: string;
    name: string;
    gender?: number;
    birthday?: string;
    telphone?: string;
    mobile?: string;
    qq?: string;
    wechat?: string;
    provinceId?: number;
    cityId?: number;
    districtId?: number;
    address?: string;
    plastic?: string;
    statusId?: number;
    remark?: string;
    ownerUserId?: number;
  },
  options?: { [key: string]: any }
) {
  return request<any>("/api/crm/v1/customers/customers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 客户详情 GET /api/crm/v1/customers/customers/${param0} */
export async function crmV1GetCustomer2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmV1GetCustomerParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/customers/customers/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新客户 PATCH /api/crm/v1/customers/customers/${param0} */
export async function crmV1UpdateCustomer2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmV1UpdateCustomerParams,
  body: {
    numberId?: string;
    name?: string;
    gender?: number;
    birthday?: string;
    telphone?: string;
    mobile?: string;
    qq?: string;
    wechat?: string;
    provinceId?: number;
    cityId?: number;
    districtId?: number;
    address?: string;
    plastic?: string;
    statusId?: number;
    remark?: string;
    ownerUserId?: number;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/customers/customers/${param0}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 客户派单 POST /api/crm/v1/customers/customers/${param0}/dispatch */
export async function crmV1DispatchCustomer2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmV1DispatchCustomerParams,
  body: {
    hospitalIds: number[];
    reply?: string;
    statusId?: number;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/customers/customers/${param0}/dispatch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 客户备注（占位） POST /api/crm/v1/customers/customers/${param0}/remarks */
export async function crmV1AddCustomerRemark2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmV1AddCustomerRemarkParams,
  body: {
    content: string;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/customers/customers/${param0}/remarks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 客户状态字典 GET /api/crm/v1/customers/customers/statuses */
export async function crmV1ListCustomerStatuses2(options?: {
  [key: string]: any;
}) {
  return request<any>("/api/crm/v1/customers/customers/statuses", {
    method: "GET",
    ...(options || {}),
  });
}

/** 客户状态字典 GET /api/crm/v1/customers/statuses */
export async function crmV1ListCustomerStatuses(options?: {
  [key: string]: any;
}) {
  return request<any>("/api/crm/v1/customers/statuses", {
    method: "GET",
    ...(options || {}),
  });
}

/** 派单列表 GET /api/crm/v1/dispatches */
export async function crmV1ListDispatches(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmV1ListDispatchesParams,
  options?: { [key: string]: any }
) {
  return request<any>("/api/crm/v1/dispatches", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      // pageSize has a default value: 10
      pageSize: "10",

      ...params,
    },
    ...(options || {}),
  });
}

/** 派单详情 GET /api/crm/v1/dispatches/${param0} */
export async function crmV1GetDispatch(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmV1GetDispatchParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/dispatches/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新派单 PATCH /api/crm/v1/dispatches/${param0} */
export async function crmV1UpdateDispatch(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmV1UpdateDispatchParams,
  body: {
    hospitalId?: number;
    statusId?: number;
    image?: string;
    receiveQq?: string;
    receiveWechat?: string;
    finishedAt?: string;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/dispatches/${param0}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 派单跟进 POST /api/crm/v1/dispatches/${param0}/logs */
export async function crmV1AddDispatchLog(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmV1AddDispatchLogParams,
  body: {
    content: string;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/dispatches/${param0}/logs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 派单回复 POST /api/crm/v1/dispatches/${param0}/reply */
export async function crmV1AddDispatchReply(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmV1AddDispatchReplyParams,
  body: {
    content?: string;
    receiveQq?: string;
    receiveWechat?: string;
    image?: string;
    statusId?: number;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/dispatches/${param0}/reply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 派单列表 GET /api/crm/v1/dispatches/dispatches */
export async function crmV1ListDispatches2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmV1ListDispatchesParams,
  options?: { [key: string]: any }
) {
  return request<any>("/api/crm/v1/dispatches/dispatches", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      // pageSize has a default value: 10
      pageSize: "10",

      ...params,
    },
    ...(options || {}),
  });
}

/** 派单详情 GET /api/crm/v1/dispatches/dispatches/${param0} */
export async function crmV1GetDispatch2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmV1GetDispatchParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/dispatches/dispatches/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新派单 PATCH /api/crm/v1/dispatches/dispatches/${param0} */
export async function crmV1UpdateDispatch2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmV1UpdateDispatchParams,
  body: {
    hospitalId?: number;
    statusId?: number;
    image?: string;
    receiveQq?: string;
    receiveWechat?: string;
    finishedAt?: string;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/dispatches/dispatches/${param0}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 派单跟进 POST /api/crm/v1/dispatches/dispatches/${param0}/logs */
export async function crmV1AddDispatchLog2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmV1AddDispatchLogParams,
  body: {
    content: string;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/dispatches/dispatches/${param0}/logs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 派单回复 POST /api/crm/v1/dispatches/dispatches/${param0}/reply */
export async function crmV1AddDispatchReply2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmV1AddDispatchReplyParams,
  body: {
    content?: string;
    receiveQq?: string;
    receiveWechat?: string;
    image?: string;
    statusId?: number;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/dispatches/dispatches/${param0}/reply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 派单状态字典 GET /api/crm/v1/dispatches/dispatches/statuses */
export async function crmV1ListDispatchStatuses2(options?: {
  [key: string]: any;
}) {
  return request<any>("/api/crm/v1/dispatches/dispatches/statuses", {
    method: "GET",
    ...(options || {}),
  });
}

/** 派单状态字典 GET /api/crm/v1/dispatches/statuses */
export async function crmV1ListDispatchStatuses(options?: {
  [key: string]: any;
}) {
  return request<any>("/api/crm/v1/dispatches/statuses", {
    method: "GET",
    ...(options || {}),
  });
}

/** 医院列表 GET /api/crm/v1/hospitals */
export async function crmV1ListHospitals(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmV1ListHospitalsParams,
  options?: { [key: string]: any }
) {
  return request<any>("/api/crm/v1/hospitals", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      // pageSize has a default value: 10
      pageSize: "10",

      ...params,
    },
    ...(options || {}),
  });
}

/** 创建医院 POST /api/crm/v1/hospitals */
export async function crmV1CreateHospital(
  body: {
    accountUserId?: number | null;
    hospitalName: string;
    provinceId?: number;
    cityId?: number;
    districtId?: number;
    hospitalAddress?: string;
    hospitalPhone?: string;
    hospitalSelling?: string;
    hospitalWebsite?: string;
    hospitalNature?: number;
    doctorName?: string;
    doctorPhone?: string;
    doctorQq?: string;
    receptionName?: string;
    receptionPhone?: string;
    receptionQq?: string;
    busStation?: string;
    busAddress?: string;
    subwayStation?: string;
    subwayAddress?: string;
    taxiFare?: string;
    vipDiscount?: string;
    returnPoint?: string;
    hospitalIntroduction?: string;
    contractPhotos?: string[];
    wechatOpenid?: string;
    status?: number;
  },
  options?: { [key: string]: any }
) {
  return request<any>("/api/crm/v1/hospitals", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 医院详情 GET /api/crm/v1/hospitals/${param0} */
export async function crmV1GetHospital(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmV1GetHospitalParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/hospitals/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 删除医院 DELETE /api/crm/v1/hospitals/${param0} */
export async function crmV1DeleteHospital(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmV1DeleteHospitalParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/hospitals/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新医院 PATCH /api/crm/v1/hospitals/${param0} */
export async function crmV1UpdateHospital(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmV1UpdateHospitalParams,
  body: {
    accountUserId?: number | null;
    hospitalName?: string;
    provinceId?: number;
    cityId?: number;
    districtId?: number;
    hospitalAddress?: string;
    hospitalPhone?: string;
    hospitalSelling?: string;
    hospitalWebsite?: string;
    hospitalNature?: number;
    doctorName?: string;
    doctorPhone?: string;
    doctorQq?: string;
    receptionName?: string;
    receptionPhone?: string;
    receptionQq?: string;
    busStation?: string;
    busAddress?: string;
    subwayStation?: string;
    subwayAddress?: string;
    taxiFare?: string;
    vipDiscount?: string;
    returnPoint?: string;
    hospitalIntroduction?: string;
    contractPhotos?: string[];
    wechatOpenid?: string;
    status?: number;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/hospitals/${param0}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 医院账号列表 GET /api/crm/v1/hospitals/${param0}/accounts */
export async function crmV1ListHospitalAccounts(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmV1ListHospitalAccountsParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/hospitals/${param0}/accounts`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 新建并分配医院账号 POST /api/crm/v1/hospitals/${param0}/accounts */
export async function crmV1CreateHospitalAccount(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmV1CreateHospitalAccountParams,
  body: {
    username: string;
    phone: string;
    realName?: string;
    email?: string;
    password: string;
    role?: string;
    remark?: string;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/hospitals/${param0}/accounts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 解除医院账号 DELETE /api/crm/v1/hospitals/${param0}/accounts/${param1} */
export async function crmV1DeleteHospitalAccount(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmV1DeleteHospitalAccountParams,
  options?: { [key: string]: any }
) {
  const { id: param0, userId: param1, ...queryParams } = params;
  return request<any>(`/api/crm/v1/hospitals/${param0}/accounts/${param1}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新医院账号 PATCH /api/crm/v1/hospitals/${param0}/accounts/${param1} */
export async function crmV1UpdateHospitalAccount(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmV1UpdateHospitalAccountParams,
  body: {
    role?: string;
    status?: number;
    remark?: string;
    username?: string;
    realName?: string;
    phone?: string;
    email?: string;
    password?: string;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, userId: param1, ...queryParams } = params;
  return request<any>(`/api/crm/v1/hospitals/${param0}/accounts/${param1}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 分配已有用户到医院 POST /api/crm/v1/hospitals/${param0}/accounts/assign */
export async function crmV1AssignHospitalAccount(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmV1AssignHospitalAccountParams,
  body: {
    userId: number;
    role?: string;
    remark?: string;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/hospitals/${param0}/accounts/assign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 医院列表 GET /api/crm/v1/hospitals/hospitals */
export async function crmV1ListHospitals2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmV1ListHospitalsParams,
  options?: { [key: string]: any }
) {
  return request<any>("/api/crm/v1/hospitals/hospitals", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      // pageSize has a default value: 10
      pageSize: "10",

      ...params,
    },
    ...(options || {}),
  });
}

/** 创建医院 POST /api/crm/v1/hospitals/hospitals */
export async function crmV1CreateHospital2(
  body: {
    accountUserId?: number | null;
    hospitalName: string;
    provinceId?: number;
    cityId?: number;
    districtId?: number;
    hospitalAddress?: string;
    hospitalPhone?: string;
    hospitalSelling?: string;
    hospitalWebsite?: string;
    hospitalNature?: number;
    doctorName?: string;
    doctorPhone?: string;
    doctorQq?: string;
    receptionName?: string;
    receptionPhone?: string;
    receptionQq?: string;
    busStation?: string;
    busAddress?: string;
    subwayStation?: string;
    subwayAddress?: string;
    taxiFare?: string;
    vipDiscount?: string;
    returnPoint?: string;
    hospitalIntroduction?: string;
    contractPhotos?: string[];
    wechatOpenid?: string;
    status?: number;
  },
  options?: { [key: string]: any }
) {
  return request<any>("/api/crm/v1/hospitals/hospitals", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 医院详情 GET /api/crm/v1/hospitals/hospitals/${param0} */
export async function crmV1GetHospital2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmV1GetHospitalParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/hospitals/hospitals/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 删除医院 DELETE /api/crm/v1/hospitals/hospitals/${param0} */
export async function crmV1DeleteHospital2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmV1DeleteHospitalParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/hospitals/hospitals/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新医院 PATCH /api/crm/v1/hospitals/hospitals/${param0} */
export async function crmV1UpdateHospital2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmV1UpdateHospitalParams,
  body: {
    accountUserId?: number | null;
    hospitalName?: string;
    provinceId?: number;
    cityId?: number;
    districtId?: number;
    hospitalAddress?: string;
    hospitalPhone?: string;
    hospitalSelling?: string;
    hospitalWebsite?: string;
    hospitalNature?: number;
    doctorName?: string;
    doctorPhone?: string;
    doctorQq?: string;
    receptionName?: string;
    receptionPhone?: string;
    receptionQq?: string;
    busStation?: string;
    busAddress?: string;
    subwayStation?: string;
    subwayAddress?: string;
    taxiFare?: string;
    vipDiscount?: string;
    returnPoint?: string;
    hospitalIntroduction?: string;
    contractPhotos?: string[];
    wechatOpenid?: string;
    status?: number;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/hospitals/hospitals/${param0}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 医院账号列表 GET /api/crm/v1/hospitals/hospitals/${param0}/accounts */
export async function crmV1ListHospitalAccounts2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmV1ListHospitalAccountsParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/hospitals/hospitals/${param0}/accounts`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 新建并分配医院账号 POST /api/crm/v1/hospitals/hospitals/${param0}/accounts */
export async function crmV1CreateHospitalAccount2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmV1CreateHospitalAccountParams,
  body: {
    username: string;
    phone: string;
    realName?: string;
    email?: string;
    password: string;
    role?: string;
    remark?: string;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/hospitals/hospitals/${param0}/accounts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 解除医院账号 DELETE /api/crm/v1/hospitals/hospitals/${param0}/accounts/${param1} */
export async function crmV1DeleteHospitalAccount2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmV1DeleteHospitalAccountParams,
  options?: { [key: string]: any }
) {
  const { id: param0, userId: param1, ...queryParams } = params;
  return request<any>(
    `/api/crm/v1/hospitals/hospitals/${param0}/accounts/${param1}`,
    {
      method: "DELETE",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 更新医院账号 PATCH /api/crm/v1/hospitals/hospitals/${param0}/accounts/${param1} */
export async function crmV1UpdateHospitalAccount2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmV1UpdateHospitalAccountParams,
  body: {
    role?: string;
    status?: number;
    remark?: string;
    username?: string;
    realName?: string;
    phone?: string;
    email?: string;
    password?: string;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, userId: param1, ...queryParams } = params;
  return request<any>(
    `/api/crm/v1/hospitals/hospitals/${param0}/accounts/${param1}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}

/** 分配已有用户到医院 POST /api/crm/v1/hospitals/hospitals/${param0}/accounts/assign */
export async function crmV1AssignHospitalAccount2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmV1AssignHospitalAccountParams,
  body: {
    userId: number;
    role?: string;
    remark?: string;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(
    `/api/crm/v1/hospitals/hospitals/${param0}/accounts/assign`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}

/** 医院搜索（前端下拉） GET /api/crm/v1/hospitals/hospitals/search/options */
export async function crmV1SearchHospitals2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmV1SearchHospitalsParams,
  options?: { [key: string]: any }
) {
  return request<any>("/api/crm/v1/hospitals/hospitals/search/options", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 医院搜索（前端下拉） GET /api/crm/v1/hospitals/search/options */
export async function crmV1SearchHospitals(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmV1SearchHospitalsParams,
  options?: { [key: string]: any }
) {
  return request<any>("/api/crm/v1/hospitals/search/options", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 会员顾客列表 GET /api/crm/v1/members */
export async function crmV1ListMembers(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmV1ListMembersParams,
  options?: { [key: string]: any }
) {
  return request<any>("/api/crm/v1/members", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      // pageSize has a default value: 10
      pageSize: "10",

      ...params,
    },
    ...(options || {}),
  });
}

/** 新建会员 POST /api/crm/v1/members */
export async function crmV1CreateMember(
  body: {
    numberId?: string;
    name: string;
    gender?: number;
    birthday?: string;
    address?: string;
    mobile?: string;
    project?: string;
    ownerUserId?: number;
  },
  options?: { [key: string]: any }
) {
  return request<any>("/api/crm/v1/members", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 会员详情 GET /api/crm/v1/members/${param0} */
export async function crmV1GetMember(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmV1GetMemberParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/members/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新会员 PATCH /api/crm/v1/members/${param0} */
export async function crmV1UpdateMember(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmV1UpdateMemberParams,
  body: {
    numberId?: string;
    name?: string;
    gender?: number;
    birthday?: string;
    address?: string;
    mobile?: string;
    project?: string;
    ownerUserId?: number;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/members/${param0}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 会员备注 POST /api/crm/v1/members/${param0}/remarks */
export async function crmV1AddMemberRemark(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmV1AddMemberRemarkParams,
  body: {
    content: string;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/members/${param0}/remarks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 会员顾客列表 GET /api/crm/v1/members/members */
export async function crmV1ListMembers2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmV1ListMembersParams,
  options?: { [key: string]: any }
) {
  return request<any>("/api/crm/v1/members/members", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      // pageSize has a default value: 10
      pageSize: "10",

      ...params,
    },
    ...(options || {}),
  });
}

/** 新建会员 POST /api/crm/v1/members/members */
export async function crmV1CreateMember2(
  body: {
    numberId?: string;
    name: string;
    gender?: number;
    birthday?: string;
    address?: string;
    mobile?: string;
    project?: string;
    ownerUserId?: number;
  },
  options?: { [key: string]: any }
) {
  return request<any>("/api/crm/v1/members/members", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 会员详情 GET /api/crm/v1/members/members/${param0} */
export async function crmV1GetMember2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmV1GetMemberParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/members/members/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新会员 PATCH /api/crm/v1/members/members/${param0} */
export async function crmV1UpdateMember2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmV1UpdateMemberParams,
  body: {
    numberId?: string;
    name?: string;
    gender?: number;
    birthday?: string;
    address?: string;
    mobile?: string;
    project?: string;
    ownerUserId?: number;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/members/members/${param0}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 会员备注 POST /api/crm/v1/members/members/${param0}/remarks */
export async function crmV1AddMemberRemark2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmV1AddMemberRemarkParams,
  body: {
    content: string;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/members/members/${param0}/remarks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 微信绑定医院（小程序端签名校验） 签名校验：md5("hospital_bind" + hospital_id)。当前 PERM 是占位，业务侧会再做签名校验。 GET /api/crm/v1/public/weixin/hospital-bind */
export async function crmV1PublicWeixinHospitalBind(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmV1PublicWeixinHospitalBindParams,
  options?: { [key: string]: any }
) {
  return request<any>("/api/crm/v1/public/weixin/hospital-bind", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 微信绑定医院（小程序端签名校验） 签名校验：md5("hospital_bind" + hospital_id)。当前 PERM 是占位，业务侧会再做签名校验。 GET /api/crm/v1/public/weixin/public/weixin/hospital-bind */
export async function crmV1PublicWeixinHospitalBind2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.crmV1PublicWeixinHospitalBindParams,
  options?: { [key: string]: any }
) {
  return request<any>("/api/crm/v1/public/weixin/public/weixin/hospital-bind", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}
