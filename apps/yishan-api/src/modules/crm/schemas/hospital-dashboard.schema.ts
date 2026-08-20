/**
 * 医院后台数据看板 / unviewed count 响应 schema。
 *
 * `$id` 用于 OpenAPI `$ref` —— 由 `app.addSchema(...)` 在路由文件里注册一次，
 * 生成的 OpenAPI 文档会用 `$ref: "#/components/schemas/<id>"` 引用。
 *
 * 当前 route 层直接 inline 写 response 字段而未走 $ref，这是为和
 * `apps/yishan-api/src/modules/crm/routes/v1/dashboard/index.ts` 风格一致；
 * 若未来 schema 复杂化，再回填 $ref + addSchema 调用。
 */
import { Type } from '@sinclair/typebox'

/** 看板统计响应。 */
export const CrmHospitalDashboardRespSchema = Type.Object(
  {
    todayCount: Type.Number(),
    monthCount: Type.Number(),
    yearCount: Type.Number(),
    totalCount: Type.Number(),
    viewedCount: Type.Number(),
    unviewedCount: Type.Number(),
  },
  { $id: 'crmHospitalDashboardResp' },
)

/** 未查看派单数响应。 */
export const CrmHospitalUnviewedCountRespSchema = Type.Object(
  {
    count: Type.Number(),
  },
  { $id: 'crmHospitalUnviewedCountResp' },
)