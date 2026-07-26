import { Type } from '@sinclair/typebox'

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
  },
  { $id: 'crmDashboardStats' },
)
