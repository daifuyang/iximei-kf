// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 导出派单 CSV GET /api/crm/v1/admin/dispatches/export */
export async function exportCrmDispatches(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.exportCrmDispatchesParams,
  options?: { [key: string]: any }
) {
  return request<any>("/api/crm/v1/admin/dispatches/export", {
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

/** 客户备注 POST /api/crm/v1/customers/${param0}/remarks */
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

/** 客户备注 POST /api/crm/v1/customers/customers/${param0}/remarks */
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

/** 可转会员的客户列表 GET /api/crm/v1/customers/selectable */
export async function listCrmCustomersSelectable(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.listCrmCustomersSelectableParams,
  options?: { [key: string]: any }
) {
  return request<any>("/api/crm/v1/customers/selectable", {
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

/** 导出派单 CSV GET /api/crm/v1/dispatches/admin/dispatches/export */
export async function exportCrmDispatches2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.exportCrmDispatchesParams,
  options?: { [key: string]: any }
) {
  return request<any>("/api/crm/v1/dispatches/admin/dispatches/export", {
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

/** 创建医院（含唯一账号） POST /api/crm/v1/hospitals */
export async function createCrmHospital(
  body: {
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
    accountPassword: string;
    accountEmail?: string;
    accountPhone?: string;
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

/** 删除医院（软删 + 禁用账号 + 撤销 Token） DELETE /api/crm/v1/hospitals/${param0} */
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

/** 更新医院（改名会同步账号用户名） PATCH /api/crm/v1/hospitals/${param0} */
export async function updateCrmHospital(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updateCrmHospitalParams,
  body: {
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

/** 医院唯一账号 GET /api/crm/v1/hospitals/${param0}/account */
export async function getCrmHospitalAccount(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getCrmHospitalAccountParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/hospitals/${param0}/account`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新医院账号联系方式 / 启停 PATCH /api/crm/v1/hospitals/${param0}/account */
export async function updateCrmHospitalAccount(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updateCrmHospitalAccountParams,
  body: {
    email?: string | null;
    phone?: string | null;
    status?: number;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/hospitals/${param0}/account`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 重置医院账号密码 POST /api/crm/v1/hospitals/${param0}/account/reset-password */
export async function resetCrmHospitalAccountPassword(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.resetCrmHospitalAccountPasswordParams,
  body: {
    newPassword: string;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(
    `/api/crm/v1/hospitals/${param0}/account/reset-password`,
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

/** 医院改名（仅系统管理员；同步 username + 撤销 Token + 审计） POST /api/crm/v1/hospitals/${param0}/rename */
export async function renameCrmHospital(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.renameCrmHospitalParams,
  body: {
    newHospitalName: string;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/hospitals/${param0}/rename`, {
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

/** 创建医院（含唯一账号） POST /api/crm/v1/hospitals/hospitals */
export async function createCrmHospital2(
  body: {
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
    accountPassword: string;
    accountEmail?: string;
    accountPhone?: string;
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

/** 删除医院（软删 + 禁用账号 + 撤销 Token） DELETE /api/crm/v1/hospitals/hospitals/${param0} */
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

/** 更新医院（改名会同步账号用户名） PATCH /api/crm/v1/hospitals/hospitals/${param0} */
export async function updateCrmHospital2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updateCrmHospitalParams,
  body: {
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

/** 医院唯一账号 GET /api/crm/v1/hospitals/hospitals/${param0}/account */
export async function getCrmHospitalAccount2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getCrmHospitalAccountParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/hospitals/hospitals/${param0}/account`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新医院账号联系方式 / 启停 PATCH /api/crm/v1/hospitals/hospitals/${param0}/account */
export async function updateCrmHospitalAccount2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.updateCrmHospitalAccountParams,
  body: {
    email?: string | null;
    phone?: string | null;
    status?: number;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/hospitals/hospitals/${param0}/account`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 重置医院账号密码 POST /api/crm/v1/hospitals/hospitals/${param0}/account/reset-password */
export async function resetCrmHospitalAccountPassword2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.resetCrmHospitalAccountPasswordParams,
  body: {
    newPassword: string;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(
    `/api/crm/v1/hospitals/hospitals/${param0}/account/reset-password`,
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

/** 医院改名（仅系统管理员；同步 username + 撤销 Token + 审计） POST /api/crm/v1/hospitals/hospitals/${param0}/rename */
export async function renameCrmHospital2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.renameCrmHospitalParams,
  body: {
    newHospitalName: string;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/hospitals/hospitals/${param0}/rename`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
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

/** 会员标签列表 GET /api/crm/v1/member-tags */
export async function listCrmMemberTags(options?: { [key: string]: any }) {
  return request<any>("/api/crm/v1/member-tags", {
    method: "GET",
    ...(options || {}),
  });
}

/** 创建会员标签 POST /api/crm/v1/member-tags */
export async function createCrmMemberTag(
  body: {
    name: string;
    color?: string;
  },
  options?: { [key: string]: any }
) {
  return request<any>("/api/crm/v1/member-tags", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 删除会员标签 DELETE /api/crm/v1/member-tags/${param0} */
export async function deleteCrmMemberTag(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteCrmMemberTagParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/member-tags/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
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
    name?: string;
    mobile?: string;
    wechat?: string;
    qq?: string;
    gender?: number;
    birthday?: string;
    provinceId?: number;
    cityId?: number;
    districtId?: number;
    address?: string;
    sourceChannel?: string;
    businessCategory?: string;
    intentionProject?: string;
    memberStage?: string;
    intentionLevel?: string;
    budgetRange?: string;
    expectedDate?: string;
    preferredHospitalId?: number;
    ownerUserId?: number;
    tagIds?: number[];
    nextFollowUpAt?: string;
    remark?: string;
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

/** 会员简要信息 GET /api/crm/v1/members/${param0}/brief */
export async function getCrmMemberBrief(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getCrmMemberBriefParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/members/${param0}/brief`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 会员创建派单 POST /api/crm/v1/members/${param0}/dispatches */
export async function createCrmMemberDispatch(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.createCrmMemberDispatchParams,
  body: {
    hospitalId: number;
    statusId?: number;
    content?: string;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/members/${param0}/dispatches`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 跟进记录列表 GET /api/crm/v1/members/${param0}/follow-ups */
export async function listCrmMemberFollowUps(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.listCrmMemberFollowUpsParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/members/${param0}/follow-ups`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 添加跟进记录 POST /api/crm/v1/members/${param0}/follow-ups */
export async function createCrmMemberFollowUp(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.createCrmMemberFollowUpParams,
  body: {
    followUpMethod?: string;
    content: string;
    result?: string;
    memberStage?: string;
    intentionLevel?: string;
    nextFollowUpAt?: string;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/members/${param0}/follow-ups`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 作废会员 POST /api/crm/v1/members/${param0}/invalidate */
export async function invalidateCrmMember(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.invalidateCrmMemberParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/members/${param0}/invalidate`, {
    method: "POST",
    params: { ...queryParams },
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

/** 恢复会员 POST /api/crm/v1/members/${param0}/restore */
export async function restoreCrmMember(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.restoreCrmMemberParams,
  body: {
    memberStage?: string;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/members/${param0}/restore`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 批量分配客服 POST /api/crm/v1/members/batch-assign */
export async function batchAssignCrmMembers(
  body: {
    memberIds: number[];
    toUserId: number;
    reason?: string;
  },
  options?: { [key: string]: any }
) {
  return request<any>("/api/crm/v1/members/batch-assign", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 批量作废会员 POST /api/crm/v1/members/batch-invalidate */
export async function batchInvalidateCrmMembers(
  body: {
    memberIds: number[];
  },
  options?: { [key: string]: any }
) {
  return request<any>("/api/crm/v1/members/batch-invalidate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 批量打标签 POST /api/crm/v1/members/batch-tags */
export async function batchTagCrmMembers(
  body: {
    memberIds: number[];
    tagIds: number[];
  },
  options?: { [key: string]: any }
) {
  return request<any>("/api/crm/v1/members/batch-tags", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 可转会员的客户列表 GET /api/crm/v1/members/customers/selectable */
export async function listCrmCustomersSelectable2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.listCrmCustomersSelectableParams,
  options?: { [key: string]: any }
) {
  return request<any>("/api/crm/v1/members/customers/selectable", {
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

/** 直接新增会员 POST /api/crm/v1/members/direct */
export async function createCrmMemberDirect(
  body: {
    name: string;
    mobile?: string;
    wechat?: string;
    qq?: string;
    gender?: number;
    birthday?: string;
    provinceId?: number;
    cityId?: number;
    districtId?: number;
    address?: string;
    sourceChannel?: string;
    businessCategory?: string;
    intentionProject?: string;
    memberStage?: string;
    intentionLevel?: string;
    budgetRange?: string;
    expectedDate?: string;
    preferredHospitalId?: number;
    ownerUserId?: number;
    tagIds?: number[];
    firstContactRecord?: string;
    nextFollowUpAt?: string;
    remark?: string;
  },
  options?: { [key: string]: any }
) {
  return request<any>("/api/crm/v1/members/direct", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 从客户转会员 POST /api/crm/v1/members/from-customer */
export async function createCrmMemberFromCustomer(
  body: {
    customerId: number;
    businessCategory?: string;
    intentionProject?: string;
    memberStage?: string;
    intentionLevel?: string;
    budgetRange?: string;
    expectedDate?: string;
    preferredHospitalId?: number;
    ownerUserId?: number;
    tagIds?: number[];
    firstContactRecord?: string;
    nextFollowUpAt?: string;
    remark?: string;
  },
  options?: { [key: string]: any }
) {
  return request<any>("/api/crm/v1/members/from-customer", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 会员标签列表 GET /api/crm/v1/members/member-tags */
export async function listCrmMemberTags2(options?: { [key: string]: any }) {
  return request<any>("/api/crm/v1/members/member-tags", {
    method: "GET",
    ...(options || {}),
  });
}

/** 创建会员标签 POST /api/crm/v1/members/member-tags */
export async function createCrmMemberTag2(
  body: {
    name: string;
    color?: string;
  },
  options?: { [key: string]: any }
) {
  return request<any>("/api/crm/v1/members/member-tags", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 删除会员标签 DELETE /api/crm/v1/members/member-tags/${param0} */
export async function deleteCrmMemberTag2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteCrmMemberTagParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/members/member-tags/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
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
    name?: string;
    mobile?: string;
    wechat?: string;
    qq?: string;
    gender?: number;
    birthday?: string;
    provinceId?: number;
    cityId?: number;
    districtId?: number;
    address?: string;
    sourceChannel?: string;
    businessCategory?: string;
    intentionProject?: string;
    memberStage?: string;
    intentionLevel?: string;
    budgetRange?: string;
    expectedDate?: string;
    preferredHospitalId?: number;
    ownerUserId?: number;
    tagIds?: number[];
    nextFollowUpAt?: string;
    remark?: string;
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

/** 会员简要信息 GET /api/crm/v1/members/members/${param0}/brief */
export async function getCrmMemberBrief2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getCrmMemberBriefParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/members/members/${param0}/brief`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 会员创建派单 POST /api/crm/v1/members/members/${param0}/dispatches */
export async function createCrmMemberDispatch2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.createCrmMemberDispatchParams,
  body: {
    hospitalId: number;
    statusId?: number;
    content?: string;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/members/members/${param0}/dispatches`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 跟进记录列表 GET /api/crm/v1/members/members/${param0}/follow-ups */
export async function listCrmMemberFollowUps2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.listCrmMemberFollowUpsParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/members/members/${param0}/follow-ups`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 添加跟进记录 POST /api/crm/v1/members/members/${param0}/follow-ups */
export async function createCrmMemberFollowUp2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.createCrmMemberFollowUpParams,
  body: {
    followUpMethod?: string;
    content: string;
    result?: string;
    memberStage?: string;
    intentionLevel?: string;
    nextFollowUpAt?: string;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/members/members/${param0}/follow-ups`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 作废会员 POST /api/crm/v1/members/members/${param0}/invalidate */
export async function invalidateCrmMember2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.invalidateCrmMemberParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/members/members/${param0}/invalidate`, {
    method: "POST",
    params: { ...queryParams },
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

/** 恢复会员 POST /api/crm/v1/members/members/${param0}/restore */
export async function restoreCrmMember2(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.restoreCrmMemberParams,
  body: {
    memberStage?: string;
  },
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/crm/v1/members/members/${param0}/restore`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 批量分配客服 POST /api/crm/v1/members/members/batch-assign */
export async function batchAssignCrmMembers2(
  body: {
    memberIds: number[];
    toUserId: number;
    reason?: string;
  },
  options?: { [key: string]: any }
) {
  return request<any>("/api/crm/v1/members/members/batch-assign", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 批量作废会员 POST /api/crm/v1/members/members/batch-invalidate */
export async function batchInvalidateCrmMembers2(
  body: {
    memberIds: number[];
  },
  options?: { [key: string]: any }
) {
  return request<any>("/api/crm/v1/members/members/batch-invalidate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 批量打标签 POST /api/crm/v1/members/members/batch-tags */
export async function batchTagCrmMembers2(
  body: {
    memberIds: number[];
    tagIds: number[];
  },
  options?: { [key: string]: any }
) {
  return request<any>("/api/crm/v1/members/members/batch-tags", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 直接新增会员 POST /api/crm/v1/members/members/direct */
export async function createCrmMemberDirect2(
  body: {
    name: string;
    mobile?: string;
    wechat?: string;
    qq?: string;
    gender?: number;
    birthday?: string;
    provinceId?: number;
    cityId?: number;
    districtId?: number;
    address?: string;
    sourceChannel?: string;
    businessCategory?: string;
    intentionProject?: string;
    memberStage?: string;
    intentionLevel?: string;
    budgetRange?: string;
    expectedDate?: string;
    preferredHospitalId?: number;
    ownerUserId?: number;
    tagIds?: number[];
    firstContactRecord?: string;
    nextFollowUpAt?: string;
    remark?: string;
  },
  options?: { [key: string]: any }
) {
  return request<any>("/api/crm/v1/members/members/direct", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 从客户转会员 POST /api/crm/v1/members/members/from-customer */
export async function createCrmMemberFromCustomer2(
  body: {
    customerId: number;
    businessCategory?: string;
    intentionProject?: string;
    memberStage?: string;
    intentionLevel?: string;
    budgetRange?: string;
    expectedDate?: string;
    preferredHospitalId?: number;
    ownerUserId?: number;
    tagIds?: number[];
    firstContactRecord?: string;
    nextFollowUpAt?: string;
    remark?: string;
  },
  options?: { [key: string]: any }
) {
  return request<any>("/api/crm/v1/members/members/from-customer", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 会员概览统计 GET /api/crm/v1/members/members/overview */
export async function getCrmMemberOverview2(options?: { [key: string]: any }) {
  return request<any>("/api/crm/v1/members/members/overview", {
    method: "GET",
    ...(options || {}),
  });
}

/** 会员概览统计 GET /api/crm/v1/members/overview */
export async function getCrmMemberOverview(options?: { [key: string]: any }) {
  return request<any>("/api/crm/v1/members/overview", {
    method: "GET",
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
