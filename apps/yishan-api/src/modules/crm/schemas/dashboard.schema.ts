import { Type } from '@sinclair/typebox'

/** 单个医院的效率排行项。 */
export const CrmHospitalRankingsItemSchema = Type.Object(
  {
    hospitalId: Type.Number(),
    hospitalName: Type.String(),
    dispatchCount: Type.Number(),
    viewedCount: Type.Number(),
    unviewedCount: Type.Number(),
    viewedRate: Type.Number(),
    replyCount: Type.Number(),
    firstViewedAt: Type.Union([
      Type.String({ format: 'date-time' }),
      Type.Null(),
    ]),
  },
  { $id: 'crmHospitalRankingsItem' },
)

/** 医院效率榜响应：items + 生成时间戳。 */
export const CrmHospitalRankingsRespSchema = Type.Object(
  {
    items: Type.Array(CrmHospitalRankingsItemSchema),
    generatedAt: Type.String({ format: 'date-time' }),
  },
  { $id: 'crmHospitalRankingsResp' },
)

export const DashboardStatsSchema = Type.Object(
  {
    generatedAt: Type.Optional(Type.String()),
    hospitals: Type.Object({
      total: Type.Integer(),
      periodNew: Type.Integer(),
      activeCount: Type.Integer(),
      monthNew: Type.Integer(),
      weekNew: Type.Integer(),
    }),
    customers: Type.Object({
      total: Type.Integer(),
      periodNew: Type.Integer(),
      monthNew: Type.Integer(),
      weekNew: Type.Integer(),
      dayNew: Type.Integer(),
    }),
    dispatches: Type.Object({
      total: Type.Integer(),
      periodNew: Type.Integer(),
      periodCompleted: Type.Integer(),
      monthNew: Type.Integer(),
      weekNew: Type.Integer(),
      monthCompleted: Type.Integer(),
    }),
    customerByStatus: Type.Array(
      Type.Object({
        name: Type.String(),
        count: Type.Integer(),
      }),
    ),
    dispatchByStatus: Type.Array(
      Type.Object({
        name: Type.String(),
        count: Type.Integer(),
      }),
    ),
    monthlyTrend: Type.Object({
      customers: Type.Array(
        Type.Object({ month: Type.String(), count: Type.Integer() }),
      ),
      dispatches: Type.Array(
        Type.Object({ month: Type.String(), count: Type.Integer() }),
      ),
    }),
    // 医院效率榜（按医院聚合派单/查看/回复指标）。可选保留，便于未来下线时向后兼容。
    hospitalRankings: Type.Optional(CrmHospitalRankingsRespSchema),
  },
  { $id: 'crmDashboardStats' },
)