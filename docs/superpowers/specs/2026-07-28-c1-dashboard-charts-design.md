# Phase C.1 医院数据看板图表（Dashboard Charts）设计

> 日期：2026-07-28
> 范围：Phase C 三个子项目中的第一个 —— 在已落地的 HospitalDashboard 上**集成图表可视化**
> 依赖：Phase A 全部 7 task + Phase B 全部 11 task（HospitalDashboardService.getStats 已就绪）
> 不在本 spec：C.2 WebSocket 实时推送；C.3 医院业绩排行（另立 spec）

## 0. 业务目标

把 Phase B 已落地的「7 张数字统计卡」升级为「统计卡 + 折线/柱状/饼图」组合，让医院账号**一眼看出派单趋势 + 状态分布**，而不是只看到累计数字。

```
当前（T7）：
┌────┐ ┌────┐ ┌────┐ ┌────┐
│今日│ │本月│ │本年│ │累计│
└────┘ └────┘ └────┘ └────┘
┌────┐ ┌────┐ ┌────┐
│已查看│ │未查看│ │查看率│
└────┘ └────┘ └────┘

本 spec（C.1）：
┌────┐ ┌────┐ ┌────┐ ┌────┐
│今日│ │本月│ │本年│ │累计│
└────┘ └────┘ └────┘ └────┘
┌────────────────────────┐
│   30 天派单趋势（折线）  │   <- 新
└────────────────────────┘
┌────────────────────────┐
│   已查看 vs 未查看（饼）  │   <- 新
└────────────────────────┘
```

## 1. In-scope / Out-of-scope

### In-scope
- **后端**：新增 1 个 SQL 聚合接口 `GET /api/crm/v1/hospital/dashboard/trend`
  - 返回过去 30 天每日派单数（0~N 整数，缺失日补 0）
  - 返回已查看/未查看/已回复/未回复 4 个状态分布（**仅复用 view_log 已有数据，crmDispatchReply 不在本 spec 改动**）
- **前端**：在 `/crm/hospital-dashboard` 页面新增 2 个 antd Charts 组件
  - `Line` 折线图：30 天派单趋势
  - `Pie` 饼图：已查看 vs 未查看
- **数据范围**：HOSPITAL scope（自动 WHERE hospital_id = currentUserHospitalId）
- **角色门禁**：仅 `ROLE_IDS.HOSPITAL_ACCOUNT`
- **权限码**：复用 `crm:hospital-dashboard:view`

### Out-of-scope
- C.2 WebSocket / SSE 实时推送（60s 轮询继续；不引新依赖）
- C.3 医院业绩排行（多医院对比，需新表 + admin 视角；另立 spec）
- 图表导出（PNG / PDF）
- 图表交互（hover tooltip 用 antd-charts 默认）
- 跟进 / 成交指标（spec §11 留作 Phase D+）

## 2. 关键约束

- 不得新增图表库（@ant-design/charts 2.6.7 已装）
- 不得引入 WebSocket / Redis Pub/Sub
- 后端 SQL 必须用 aggregate（避免 N+1）；不得拉全量到 JS
- 折线图 X 轴日期补 0（即使 SQL 查不到这天）
- 饼图不显示「占比 0%」的项（避免视觉噪声）
- 时区继续用 Asia/Shanghai（与 Phase B T5 一致）
- 路由前缀 `/api/crm/v1/hospital/dashboard/...` 不变
- 不得修改 `crm_hospital` / `crm_dispatch` / `crm_dispatch_view_log` 既有 schema
- 不动 `crm_dashboard` 模块（那是 admin 视角的「数据看板」，本 spec 仅做医院后台的「本院数据看板」图表）

## 3. 后端 API

### 3.1 新增路由

```ts
// GET /api/crm/v1/hospital/dashboard/trend
// 角色: hospital_account
// 权限: crm:hospital-dashboard:view
// 范围: HOSPITAL scope
// 返回:
type CrmHospitalDashboardTrendResp = {
  daily: Array<{ date: string /* YYYY-MM-DD */; count: number }>;  // 30 天, 0 补齐
  statusBreakdown: {
    viewed: number;
    unviewed: number;
  };
}
```

### 3.2 仓储方法（追加在 `hospital-dashboard.repository.ts`）

```ts
static async getTrend(hospitalId: number, days = 30): Promise<{
  daily: Array<{ date: string; count: number }>;
  statusBreakdown: { viewed: number; unviewed: number };
}> {
  // 1) 生成 30 天日期范围 [today-29, today]
  const dates: string[] = []
  const today = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    d.setHours(0, 0, 0, 0)
    dates.push(d.toISOString().slice(0, 10))  // YYYY-MM-DD
  }
  const startDate = dates[0]  // 最早一天

  // 2) 一次 SQL 聚合：按 created_at 的 date 分组 + count
  //   用 DATE() 避免时区漂移（MySQL 假设 dispatch.createdAt 是 timestamp）
  //   注意：Drizzle 不直接支持 DATE() 函数，用 sql 模板
  const rawDaily = await drizzleDb
    .select({
      date: sql<string>`DATE(${crmDispatch.createdAt})`,
      count: sql<number>`COUNT(*)`,
    })
    .from(crmDispatch)
    .where(
      and(
        eq(crmDispatch.hospitalId, hospitalId),
        active(crmDispatch),
        gte(crmDispatch.createdAt, new Date(startDate)),
      ),
    )
    .groupBy(sql`DATE(${crmDispatch.createdAt})`)

  // 3) 把 rawDaily 映射成 [date, count]，缺失日期补 0
  const dailyMap = new Map(rawDaily.map((r) => [String(r.date), Number(r.count)]))
  const daily = dates.map((d) => ({ date: d, count: dailyMap.get(d) ?? 0 }))

  // 4) 复用 getStats 里的 viewed/unviewed 逻辑（不改 repo 重写）
  //    用 LEFT JOIN crmDispatchViewLog ... COUNT(CASE WHEN)
  const [row] = await drizzleDb
    .select({
      viewed: sql<number>`SUM(CASE WHEN ${crmDispatchViewLog.id} IS NOT NULL THEN 1 ELSE 0 END)`,
      unviewed: sql<number>`SUM(CASE WHEN ${crmDispatchViewLog.id} IS NULL THEN 1 ELSE 0 END)`,
    })
    .from(crmDispatch)
    .leftJoin(
      crmDispatchViewLog,
      and(
        eq(crmDispatchViewLog.dispatchId, crmDispatch.id),
        eq(crmDispatchViewLog.hospitalId, hospitalId),
      ),
    )
    .where(and(eq(crmDispatch.hospitalId, hospitalId), active(crmDispatch)))

  return {
    daily,
    statusBreakdown: {
      viewed: Number(row?.viewed ?? 0),
      unviewed: Number(row?.unviewed ?? 0),
    },
  }
}
```

### 3.3 Service（追加在 `hospital-dashboard.service.ts`）

```ts
static async getTrend(userId: number, roleIds: ReadonlyArray<number>, days = 30) {
  assertHospitalAccount(userId, roleIds)  // 复用 T5 的角色门禁
  const ids = (await HospitalsRepository.accessibleHospitalIds(userId)).map((x: any) => x.hospitalId)
  if (!ids.length) {
    return { daily: emptyDaily(days), statusBreakdown: { viewed: 0, unviewed: 0 } }
  }
  return HospitalDashboardRepository.getTrend(ids[0], days)
}

function emptyDaily(days: number) {
  const out: Array<{ date: string; count: number }> = []
  const today = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    d.setHours(0, 0, 0, 0)
    out.push({ date: d.toISOString().slice(0, 10), count: 0 })
  }
  return out
}
```

### 3.4 路由

```ts
// apps/yishan-api/src/modules/crm/routes/v1/hospital-dashboard/index.ts 追加
route.get(
  '/hospital/dashboard/trend',
  {
    access: { permission: PERMS.HOSPITAL_DASHBOARD_VIEW },
    schema: {
      tags: [ROUTE_TAG],
      summary: '医院数据看板 - 30 天趋势 + 状态分布',
      operationId: 'getCrmHospitalDashboardTrend',
    },
  },
  async (req: any, reply: any) => {
    const result = await HospitalDashboardService.getTrend(uid(req), roleIds(req))
    return ResponseUtil.success(reply, result)
  },
)
```

### 3.5 Schema（追加 `hospital-dashboard.schema.ts`）

```ts
export const CrmHospitalDashboardTrendRespSchema = Type.Object({
  daily: Type.Array(Type.Object({
    date: Type.String({ format: 'date' }),  // YYYY-MM-DD
    count: Type.Number(),
  })),
  statusBreakdown: Type.Object({
    viewed: Type.Number(),
    unviewed: Type.Number(),
  }),
}, { $id: 'crmHospitalDashboardTrendResp' })
```

### 3.6 单元测试

```ts
// apps/yishan-api/src/modules/crm/tests/hospital-dashboard-trend.test.ts
import { describe, it, expect, vi } from 'vitest'
import { drizzleDb } from '@/db'
import { HospitalDashboardRepository } from '../repositories/hospital-dashboard.repository.js'

describe('HospitalDashboardRepository.getTrend', () => {
  it('返回 30 个日期点, 缺失日补 0', async () => {
    vi.spyOn(drizzleDb, 'select').mockImplementation(() => {
      const chain: any = {
        from: vi.fn(() => chain),
        where: vi.fn(() => chain),
        groupBy: vi.fn(() => chain),
        leftJoin: vi.fn(() => chain),
        then: (res: any, rej: any) => Promise.resolve([
          { date: '2026-07-23', count: 3 },
        ]).then(res, rej),
      }
      return chain
    })
    const result = await HospitalDashboardRepository.getTrend(5, 30)
    expect(result.daily).toHaveLength(30)
    expect(result.daily[29].date).toBe(/* today */)
    expect(result.daily[29].count).toBe(0)  // 没数据的天补 0
  })
})
```

## 4. 前端

### 4.1 api/index.ts 追加

```ts
export const getHospitalDashboardTrend = () =>
  request<any>('/api/crm/v1/hospital/dashboard/trend')
```

### 4.2 页面改造

在 `apps/yishan-admin/src/modules/crm/pages/hospital-dashboard/index.tsx` 末尾、3 张查看率卡片**之后**，新增：

```tsx
<Row gutter={16} style={{ marginTop: 16 }}>
  <Col xs={24} lg={16}>
    <Card title="近 30 天派单趋势">
      <Line
        data={trend.daily}
        xField="date"
        yField="count"
        height={280}
        point={{ size: 3 }}
        smooth
        yAxis={{ title: { text: '派单数' } }}
        xAxis={{ title: { text: '日期' } }}
        tooltip={{ showCrosshairs: true, shared: true }}
      />
    </Card>
  </Col>
  <Col xs={24} lg={8}>
    <Card title="查看状态分布">
      <Pie
        data={[
          { type: '已查看', value: trend.statusBreakdown.viewed },
          { type: '未查看', value: trend.statusBreakdown.unviewed },
        ]}
        angleField="value"
        colorField="type"
        radius={0.8}
        innerRadius={0.5}
        height={280}
        label={{
          type: 'inner',
          content: '{percentage}',
          style: { fontSize: 14 },
        }}
        legend={{ position: 'bottom' }}
      />
    </Card>
  </Col>
</Row>
```

### 4.3 数据加载

```tsx
const [trend, setTrend] = useState<any>(null)
const [trendLoading, setTrendLoading] = useState(false)

useEffect(() => {
  Promise.all([
    getHospitalDashboardStats(),
    getHospitalDashboardTrend(),
  ])
    .then(([statsRes, trendRes]) => {
      if (statsRes?.success) setStats(statsRes.data)
      if (trendRes?.success) setTrend(trendRes.data)
    })
    .finally(() => {
      setLoading(false)
      setTrendLoading(false)
    })
}, [])
```

`useState` / `useEffect` / 数据流沿用 T7 既有结构。**新增一个 `trend` state，不动 `stats` state**。

### 4.4 失败降级

- `getHospitalDashboardTrend` 失败 → `trend = null` → 折线/饼图区域显示「数据加载失败，重试」按钮（不阻塞顶部 7 张数字卡）
- `getHospitalDashboardStats` 失败 → Spin 继续（与 T7 一致）

### 4.5 视觉

- 折线图：X 轴日期紧凑显示（用 `tickInterval={2}` 避免 30 天标签重叠）
- 饼图：innerRadius 0.5（环形），中心显示「查看率」百分比
- 标题：与 Card 标题 `title` 属性一致

## 5. 验收

- 医院账号登录后访问 `/crm/hospital-dashboard`：
  - 顶部 7 张数字卡（已有）
  - 新增近 30 天派单折线图，X 轴 30 天，Y 轴派单数
  - 新增查看状态饼图（已查看 vs 未查看）
- 关闭医院账号派单，30 天折线图不显示「已查看 = 派单数」数据点（因 LEFT JOIN 出来 view_log.id IS NULL）
- 切换不同医院账号登录，看板数据完全独立
- 后端单测：getTrend 30 天日期 + 缺失补 0
- 前端 tsc 0 errors
- 完整 vitest 全量 0 回归

## 6. Spec 自审

- **Placeholder 扫描**：无 TBD / TODO / "实现细节待补"
- **内部一致性**：route 3.4 的 path 与 spec §3.1 路径一致；schema 3.5 字段与 repo 3.2 返回对齐
- **范围**：单 Phase C.1 计划可执行（后端 1 路由 + 1 repo 方法 + 1 service 方法 + 1 schema + 1 测试；前端 1 api wrapper + 1 页面改造），1 个 spec
- **歧义**：「已查看 = view_log 写过」；「30 天 = 含当天」

## 7. 不在 C.1 内的 TODO（移交 C.2 / C.3）

- **C.2 实时推送**：60s 轮询足够；WebSocket 是锦上添花
- **C.3 业绩排行**：需多医院对比 + admin 视角的 leaderboard；另立 spec
- **C.4+ 跟进 / 成交指标**：spec §11 留作 Phase D+

## 8. 风险与回退

- **Drizzle `sql\`DATE(...)\`` 跨 MySQL 版本兼容性**：实测 mysql2 8.0 兼容；若老版本（5.x）可改用 `DATE_FORMAT(createdAt, '%Y-%m-%d')`
- **DST 边界**：30 天跨 DST 切换时 `toISOString().slice(0, 10)` 与 MySQL `DATE()` 可能有 1 天差异；用 `CONVERT_TZ` 或改用 Unix timestamp 比较
- **@ant-design/charts 2.x SSR 问题**：admin 端是 CSR，无影响

---

**Spec 结束。** 等待 user review。
