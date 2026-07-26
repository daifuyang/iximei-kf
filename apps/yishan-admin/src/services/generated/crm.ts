// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 客户列表 GET /api/crm/v1/customers */
export async function listCrmCustomers(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.listCrmCustomersParams,
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
export async function createCrmCustomer(
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
export async function getCrmCustomer(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getCrmCustomerParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/customers/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 删除客户 DELETE /api/crm/v1/customers/${param0} */
export async function deleteCrmCustomer(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteCrmCustomerParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/customers/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新客户 PATCH /api/crm/v1/customers/${param0} */
export async function updateCrmCustomer(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updateCrmCustomerParams,
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
export async function dispatchCrmCustomer(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.dispatchCrmCustomerParams,
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
export async function createCrmCustomerRemark(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.createCrmCustomerRemarkParams,
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
export async function listCrmCustomers2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.listCrmCustomersParams,
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
export async function createCrmCustomer2(
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
export async function getCrmCustomer2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getCrmCustomerParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/customers/customers/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 删除客户 DELETE /api/crm/v1/customers/customers/${param0} */
export async function deleteCrmCustomer2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteCrmCustomerParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/customers/customers/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新客户 PATCH /api/crm/v1/customers/customers/${param0} */
export async function updateCrmCustomer2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updateCrmCustomerParams,
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
export async function dispatchCrmCustomer2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.dispatchCrmCustomerParams,
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
export async function createCrmCustomerRemark2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.createCrmCustomerRemarkParams,
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
export async function listCrmCustomerStatuses2(options?: {
  [key: string]: any;
}) {
  return request<any>("/api/crm/v1/customers/customers/statuses", {
    method: "GET",
    ...(options || {}),
  });
}

/** 客户状态字典 GET /api/crm/v1/customers/statuses */
export async function listCrmCustomerStatuses(options?: {
  [key: string]: any;
}) {
  return request<any>("/api/crm/v1/customers/statuses", {
    method: "GET",
    ...(options || {}),
  });
}

/** CRM 数据看板统计 GET /api/crm/v1/dashboard/dashboard/stats */
export async function getCrmDashboardStats2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getCrmDashboardStatsParams,
  options?: { [key: string]: any }
) {
  return request<{
    success: boolean;
    code: number;
    message: string;
    data: {
      generatedAt: string;
      hospitals: {
        total: number;
        periodNew: number;
        activeCount: number;
        monthNew: number;
        weekNew: number;
      };
      customers: {
        total: number;
        periodNew: number;
        monthNew: number;
        weekNew: number;
        dayNew: number;
      };
      dispatches: {
        total: number;
        periodNew: number;
        periodCompleted: number;
        monthNew: number;
        weekNew: number;
        monthCompleted: number;
      };
      customerByStatus: { name: string; count: number }[];
      dispatchByStatus: { name: string; count: number }[];
      monthlyTrend: {
        customers: { month: string; count: number }[];
        dispatches: { month: string; count: number }[];
      };
    };
  }>("/api/crm/v1/dashboard/dashboard/stats", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** CRM 数据看板统计 GET /api/crm/v1/dashboard/stats */
export async function getCrmDashboardStats(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getCrmDashboardStatsParams,
  options?: { [key: string]: any }
) {
  return request<{
    success: boolean;
    code: number;
    message: string;
    data: {
      generatedAt: string;
      hospitals: {
        total: number;
        periodNew: number;
        activeCount: number;
        monthNew: number;
        weekNew: number;
      };
      customers: {
        total: number;
        periodNew: number;
        monthNew: number;
        weekNew: number;
        dayNew: number;
      };
      dispatches: {
        total: number;
        periodNew: number;
        periodCompleted: number;
        monthNew: number;
        weekNew: number;
        monthCompleted: number;
      };
      customerByStatus: { name: string; count: number }[];
      dispatchByStatus: { name: string; count: number }[];
      monthlyTrend: {
        customers: { month: string; count: number }[];
        dispatches: { month: string; count: number }[];
      };
    };
  }>("/api/crm/v1/dashboard/stats", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 派单列表 GET /api/crm/v1/dispatches */
export async function listCrmDispatches(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.listCrmDispatchesParams,
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
export async function getCrmDispatch(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getCrmDispatchParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/dispatches/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 删除派单 DELETE /api/crm/v1/dispatches/${param0} */
export async function deleteCrmDispatch(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteCrmDispatchParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/dispatches/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新派单 PATCH /api/crm/v1/dispatches/${param0} */
export async function updateCrmDispatch(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updateCrmDispatchParams,
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
export async function createCrmDispatchLog(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.createCrmDispatchLogParams,
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
export async function createCrmDispatchReply(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.createCrmDispatchReplyParams,
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
export async function listCrmDispatches2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.listCrmDispatchesParams,
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
export async function getCrmDispatch2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getCrmDispatchParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/dispatches/dispatches/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 删除派单 DELETE /api/crm/v1/dispatches/dispatches/${param0} */
export async function deleteCrmDispatch2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteCrmDispatchParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/dispatches/dispatches/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新派单 PATCH /api/crm/v1/dispatches/dispatches/${param0} */
export async function updateCrmDispatch2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updateCrmDispatchParams,
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
export async function createCrmDispatchLog2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.createCrmDispatchLogParams,
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
export async function createCrmDispatchReply2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.createCrmDispatchReplyParams,
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
export async function listCrmDispatchStatuses2(options?: {
  [key: string]: any;
}) {
  return request<any>("/api/crm/v1/dispatches/dispatches/statuses", {
    method: "GET",
    ...(options || {}),
  });
}

/** 派单状态字典 GET /api/crm/v1/dispatches/statuses */
export async function listCrmDispatchStatuses(options?: {
  [key: string]: any;
}) {
  return request<any>("/api/crm/v1/dispatches/statuses", {
    method: "GET",
    ...(options || {}),
  });
}

/** 医院列表 GET /api/crm/v1/hospitals */
export async function listCrmHospitals(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.listCrmHospitalsParams,
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
export async function createCrmHospital(
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
export async function getCrmHospital(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getCrmHospitalParams,
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
export async function deleteCrmHospital(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteCrmHospitalParams,
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
export async function updateCrmHospital(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updateCrmHospitalParams,
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
export async function listCrmHospitalAccounts(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.listCrmHospitalAccountsParams,
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
export async function createCrmHospitalAccount(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.createCrmHospitalAccountParams,
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
export async function deleteCrmHospitalAccount(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteCrmHospitalAccountParams,
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
export async function updateCrmHospitalAccount(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updateCrmHospitalAccountParams,
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
export async function assignCrmHospitalAccount(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.assignCrmHospitalAccountParams,
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
export async function listCrmHospitals2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.listCrmHospitalsParams,
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
export async function createCrmHospital2(
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
export async function getCrmHospital2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getCrmHospitalParams,
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
export async function deleteCrmHospital2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteCrmHospitalParams,
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
export async function updateCrmHospital2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updateCrmHospitalParams,
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
export async function listCrmHospitalAccounts2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.listCrmHospitalAccountsParams,
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
export async function createCrmHospitalAccount2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.createCrmHospitalAccountParams,
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
export async function deleteCrmHospitalAccount2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteCrmHospitalAccountParams,
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
export async function updateCrmHospitalAccount2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updateCrmHospitalAccountParams,
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
export async function assignCrmHospitalAccount2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.assignCrmHospitalAccountParams,
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
export async function searchCrmHospitals2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.searchCrmHospitalsParams,
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
export async function searchCrmHospitals(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.searchCrmHospitalsParams,
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
export async function listCrmMembers(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.listCrmMembersParams,
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
export async function createCrmMember(
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
export async function getCrmMember(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getCrmMemberParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/members/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 删除会员 DELETE /api/crm/v1/members/${param0} */
export async function deleteCrmMember(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteCrmMemberParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/members/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新会员 PATCH /api/crm/v1/members/${param0} */
export async function updateCrmMember(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updateCrmMemberParams,
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
export async function createCrmMemberRemark(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.createCrmMemberRemarkParams,
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
export async function listCrmMembers2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.listCrmMembersParams,
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
export async function createCrmMember2(
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
export async function getCrmMember2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getCrmMemberParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/members/members/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 删除会员 DELETE /api/crm/v1/members/members/${param0} */
export async function deleteCrmMember2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteCrmMemberParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/members/members/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新会员 PATCH /api/crm/v1/members/members/${param0} */
export async function updateCrmMember2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updateCrmMemberParams,
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
export async function createCrmMemberRemark2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.createCrmMemberRemarkParams,
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
export async function bindCrmWeixinHospital(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.bindCrmWeixinHospitalParams,
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
export async function bindCrmWeixinHospital2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.bindCrmWeixinHospitalParams,
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
