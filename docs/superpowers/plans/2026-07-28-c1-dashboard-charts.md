# Phase C.1 医院数据看板图表（Dashboard Charts）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Phase B 已落地的 HospitalDashboard 上集成 antd Charts 折线/饼图。

**Architecture:** 后端 1 个新 SQL 聚合接口 `getTrend` 返回 30 天每日派单数 + 已查看/未查看；前端 HospitalDashboard 页面用 antd Charts 的 `Line` + `Pie` 渲染，与现有 7 张数字卡共存。

**Tech Stack:** Fastify 5 + Drizzle 0.44 + TypeBox (api) + React 19 + Antd Design Pro 6 + @ant-design/charts 2.6.7 (admin) + Vitest (api) + Jest (admin)。

**Spec:** `docs/superpowers/specs/2026-07-28-c1-dashboard-charts-design.md`

---

## Global Constraints

- 不动 Phase B 既有数据（HospitalDashboardService.getStats / HospitalDashboardRepository.getStats / 7 张 Card 页面）
- 不引入新依赖（@ant-design/charts 2.6.7 已装）
- 不引入 WebSocket
- Asia/Shanghai 时区沿用
- 角色门禁：仅 `ROLE_IDS.HOSPITAL_ACCOUNT` 访问 `/api/crm/v1/hospital/dashboard/trend`
- 权限码：复用 `crm:hospital-dashboard:view`（已在 T3 注册）
- vitest 用项目已有 mock setup；admin tsc 必须 0 errors
- 跑命令前 `unset http_proxy https_proxy all_proxy`
- pnpm filter 加 `--config.confirmModulesPurge=false` 防卡 confirm
- admin 端用 SSH remote（`~/.gitconfig` 已配 insteadOf）

---

## File Structure Overview

| 文件 | 类型 | Task |
| --- | --- | --- |
| `apps/yishan-api/src/modules/crm/repositories/hospital-dashboard.repository.ts` | 修改 | T1 |
| `apps/yishan-api/src/modules/crm/tests/hospital-dashboard-trend.test.ts` | 新增 | T1 |
| `apps/yishan-api/src/modules/crm/services/hospital-dashboard.service.ts` | 修改 | T2 |
| `apps/yishan-api/src/modules/crm/schemas/hospital-dashboard.schema.ts` | 修改 | T2 |
| `apps/yishan-api/src/modules/crm/routes/v1/hospital-dashboard/index.ts` | 修改 | T3 |
| `apps/yishan-admin/src/modules/crm/api/index.ts` | 修改 | T4 |
| `apps/yishan-admin/src/modules/crm/pages/hospital-dashboard/index.tsx` | 修改 | T4 |
| `apps/yishan-admin/src/services/generated/crm.ts` + `typings.d.ts` | 自动 | T5 |
| `apps/yishan-api/openapi.json` | 自动 | T5 |
| `docs/superpowers/handoffs/2026-07-28-phase-c1.md` | 新增 | T6 |
| (T0 / final review) | — | quality gate |

---

## Task 1: HospitalDashboardRepository.getTrend + 测试

**Files:**
- Modify: `apps/yishan-api/src/modules/crm/repositories/hospital-dashboard.repository.ts`（追加 getTrend 方法 + import gte）
- Test: `apps/yishan-api/src/modules/crm/tests/hospital-dashboard-trend.test.ts`

### Step 1.1：写失败测试

```ts
// apps/yishan-api/src/modules/crm/tests/hospital-dashboard-trend.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { drizzleDb } from '@/db'
import { HospitalDashboardRepository } from '../repositories/hospital-dashboard.repository.js'

describe('HospitalDashboardRepository.getTrend', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
  })
  afterEach(() => vi.restoreAllMocks())

  it('返回 30 个日期点, 缺失日补 0', async () => {
    const result = await HospitalDashboardRepository.getTrend(5, 30)
    expect(result.daily).toHaveLength(30)
    expect(result.daily[0].count).toBe(0)  // 最早天 0
  })

  it('返回 statusBreakdown 含 viewed/unviewed', async () => {
    const result = await HospitalDashboardRepository.getTrend(5, 30)
    expect(result.statusBreakdown).toHaveProperty('viewed')
    expect(result.statusBreakdown).toHaveProperty('unviewed')
  })

  it('SQL 调用了 DATE(createdAt) groupBy', async () => {
    await HospitalDashboardRepository.getTrend(5, 30)
    expect(drizzleDb.select).toHaveBeenCalled()
  })
})
```

### Step 1.2：跑测试，期望 FAIL

```bash
cd apps/yishan-api && pnpm test -- -t "getTrend"
```

期望：`getTrend is not a function`。

### Step 1.3：实现

在 `apps/yishan-api/src/modules/crm/repositories/hospital-dashboard.repository.ts`：

- import 头加 `gte`
- 类末尾追加 `getTrend(hospitalId, days = 30)` 方法：

```ts
static async getTrend(hospitalId: number, days = 30): Promise<{
  daily: Array<{ date: string; count: number }>
  statusBreakdown: { viewed: number; unviewed: number }
}> {
  // 1) 生成 days 个日期（YYYY-MM-DD）
  const dates: string[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    dates.push(d.toISOString().slice(0, 10))
  }
  const startDate = dates[0]

  // 2) 一次 SQL 聚合：按 DATE(createdAt) 分组
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

  // 3) 缺失日补 0
  const dailyMap = new Map(rawDaily.map((r) => [String(r.date), Number(r.count)]))
  const daily = dates.map((d) => ({ date: d, count: dailyMap.get(d) ?? 0 }))

  // 4) statusBreakdown 复用 LEFT JOIN view_log 模式
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

### Step 1.4：跑测试，期望 PASS

```bash
cd apps/yishan-api && pnpm test -- -t "getTrend"
```

期望：3 passed。

### Step 1.5：commit

```bash
git add apps/yishan-api/src/modules/crm/repositories/hospital-dashboard.repository.ts \
        apps/yishan-api/src/modules/crm/tests/hospital-dashboard-trend.test.ts
git commit -m "feat(crm): hospital dashboard trend repository + tests"
```

---

## Task 2: Service + Schema

**Files:**
- Modify: `apps/yishan-api/src/modules/crm/services/hospital-dashboard.service.ts`
- Modify: `apps/yishan-api/src/modules/crm/schemas/hospital-dashboard.schema.ts`

### Step 2.1：Service 加 getTrend

在 `apps/yishan-api/src/modules/crm/services/hospital-dashboard.service.ts` 末尾追加：

```ts
static async getTrend(userId: number, roleIds: ReadonlyArray<number>, days = 30) {
  assertHospitalAccount(userId, roleIds)
  const ids = (await HospitalsRepository.accessibleHospitalIds(userId)).map((x: any) => x.hospitalId)
  if (!ids.length) {
    return { daily: emptyDaily(days), statusBreakdown: { viewed: 0, unviewed: 0 } }
  }
  return HospitalDashboardRepository.getTrend(ids[0], days)
}

function emptyDaily(days: number) {
  const out: Array<{ date: string; count: number }> = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    out.push({ date: d.toISOString().slice(0, 10), count: 0 })
  }
  return out
}
```

> 注：`assertHospitalAccount` 是 T5 已实现的私有 helper，**先 grep 确认它的存在**。如果不存在，**T1 implementer 应主动 escalate**（不要机械复制本 plan 代码）—— 此时由 fix round 决策。

### Step 2.2：Schema 加 CrmHospitalDashboardTrendRespSchema

在 `apps/yishan-api/src/modules/crm/schemas/hospital-dashboard.schema.ts` 末尾追加：

```ts
export const CrmHospitalDashboardTrendRespSchema = Type.Object({
  daily: Type.Array(Type.Object({
    date: Type.String({ format: 'date' }),
    count: Type.Number(),
  })),
  statusBreakdown: Type.Object({
    viewed: Type.Number(),
    unviewed: Type.Number(),
  }),
}, { $id: 'crmHospitalDashboardTrendResp' })

export type CrmHospitalDashboardTrendResp = import('@sinclair/typebox').Static<typeof CrmHospitalDashboardTrendRespSchema>
```

### Step 2.3：tsc 0 errors

```bash
cd apps/yishan-api && pnpm exec tsc --noEmit
```

期望：exit 0。

### Step 2.4：commit

```bash
git add apps/yishan-api/src/modules/crm/services/hospital-dashboard.service.ts \
        apps/yishan-api/src/modules/crm/schemas/hospital-dashboard.schema.ts
git commit -m "feat(crm): hospital dashboard trend service + schema"
```

---

## Task 3: 路由 + 路由挂载

**Files:**
- Modify: `apps/yishan-api/src/modules/crm/routes/v1/hospital-dashboard/index.ts`

### Step 3.1：追加路由

在 `apps/yishan-api/src/modules/crm/routes/v1/hospital-dashboard/index.ts` 末尾（`/unviewed-count` 之后）追加：

```ts
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

### Step 3.2：tsc 0 errors

```bash
cd apps/yishan-api && pnpm exec tsc --noEmit
```

### Step 3.3：commit

```bash
git add apps/yishan-api/src/modules/crm/routes/v1/hospital-dashboard/index.ts
git commit -m "feat(crm): hospital dashboard trend API"
```

---

## Task 4: 前端 api wrapper + 页面集成 antd Charts

**Files:**
- Modify: `apps/yishan-admin/src/modules/crm/api/index.ts`
- Modify: `apps/yishan-admin/src/modules/crm/pages/hospital-dashboard/index.tsx`

### Step 4.1：api wrapper

在 `apps/yishan-admin/src/modules/crm/api/index.ts` 末尾追加：

```ts
export const getHospitalDashboardTrend = () =>
  request<any>('/api/crm/v1/hospital/dashboard/trend')
```

### Step 4.2：页面 import + 新 state

在 `apps/yishan-admin/src/modules/crm/pages/hospital-dashboard/index.tsx`：

- 头部 import 加 `import { Line, Pie } from '@ant-design/charts';`
- import `getHospitalDashboardTrend` 替代为 `getHospitalDashboardStats, getHospitalDashboardTrend`
- 内部 useState 改：

```tsx
const [stats, setStats] = useState<any>(null)
const [trend, setTrend] = useState<any>(null)
const [loading, setLoading] = useState(false)
const [trendError, setTrendError] = useState(false)
```

- 内部 useEffect 改：

```tsx
useEffect(() => {
  setLoading(true)
  // 顶部数字卡（已有）
  getHospitalDashboardStats()
    .then((res: any) => { if (res?.success) setStats(res.data) })
    .catch(() => {})
    .finally(() => setLoading(false))
  // 新增趋势图（独立加载 + 失败降级）
  getHospitalDashboardTrend()
    .then((res: any) => { if (res?.success) setTrend(res.data) })
    .catch(() => setTrendError(true))
}, [])
```

- 在 7 张数字卡 + 3 张查看率卡片**之后**（整个 PageContainer 末尾），新增 1 个 Row：

```tsx
{trend && (
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
          xAxis={{ title: { text: '日期' }, tickInterval: 2 }}
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
          ].filter((d) => d.value > 0)}
          angleField="value"
          colorField="type"
          radius={0.8}
          innerRadius={0.5}
          height={280}
          label={{ type: 'inner', content: '{percentage}', style: { fontSize: 14 } }}
          legend={{ position: 'bottom' }}
        />
      </Card>
    </Col>
  </Row>
)}
{trendError && !trend && (
  <Row gutter={16} style={{ marginTop: 16 }}>
    <Col span={24}>
      <Card>
        <Text type="secondary">趋势数据加载失败，请<Button type="link" onClick={() => { setTrendError(false); /* re-fetch via re-render */ }}>重试</Button></Text>
      </Card>
    </Col>
  </Row>
)}
```

> `Text` / `Button` 从 antd import。如果数据全为 0（viewed + unviewed = 0），Pie data 数组被 filter 清空 → 整张图不显示。**这是合理降级**（避免全 0 饼图）。

### Step 4.3：tsc 0 errors

```bash
cd apps/yishan-admin && npx max setup && npx tsc --noEmit
```

### Step 4.4：commit

```bash
git add apps/yishan-admin/src/modules/crm/api/index.ts \
        apps/yishan-admin/src/modules/crm/pages/hospital-dashboard/index.tsx
git commit -m "feat(crm-admin): hospital dashboard trend + pie charts"
```

---

## Task 5: 重生成 OpenAPI

**Files:**
- Auto: `apps/yishan-admin/src/services/generated/crm.ts` + `typings.d.ts`
- Auto: `apps/yishan-api/openapi.json`

### Step 5.1：跑 max openapi

```bash
cd apps/yishan-admin && pnpm openapi
```

### Step 5.2：检查

```bash
grep "getCrmHospitalDashboardTrend" apps/yishan-admin/src/services/generated/crm.d.ts
```

期望：1 命中。

### Step 5.3：tsc

```bash
cd apps/yishan-admin && npx tsc --noEmit
```

### Step 5.4：commit

```bash
git add apps/yishan-admin/src/services/generated apps/yishan-api/openapi.json
git commit -m "chore(openapi): regenerate crm client after trend API"
```

---

## Task 6: Handoff 文档 + push

**Files:**
- Create: `docs/superpowers/handoffs/2026-07-28-phase-c1.md`

### Step 6.1：写 handoff

参考 Phase A / B 模板（覆盖范围、commit 清单、4 个 Task + fix round 状态、Quality gate、6 minor follow-up、验收清单、环境备忘）。`docs/superpowers/handoffs/2026-07-28-phase-c1.md` 详写。

### Step 6.2：commit

```bash
git add docs/superpowers/handoffs/2026-07-28-phase-c1.md
git commit -m "docs(crm): phase C.1 delivery handoff summary"
```

### Step 6.3：push

```bash
git push origin main
```

---

## Task 7: 质量门 (Quality Gate)

### Step 7.1：lint

```bash
cd /home/ubuntu/workspace/iximei-kf
unset http_proxy https_proxy all_proxy
pnpm lint 2>&1 | tail -30
```

### Step 7.2：test

```bash
pnpm --filter yishan-admin test 2>&1 | tail -10
pnpm --filter yishan-api test 2>&1 | tail -10
```

### Step 7.3：admin build

```bash
pnpm --filter yishan-admin build 2>&1 | tail -30
```

### Step 7.4：commit（仅在产生 diff 时）

```bash
git add -A
git commit -m "chore(crm): phase C.1 quality gate"
```

---

## Self-Review

- **Spec coverage**：
  - 后端 §3.2 repo getTrend → T1
  - 后端 §3.3 service getTrend → T2
  - 后端 §3.5 schema → T2
  - 后端 §3.4 路由 → T3
  - 前端 §4.1 wrapper → T4
  - 前端 §4.2-4.4 页面 → T4
  - 验收 §5 → T7 质量门
  - handoff → T6
- **No Placeholder**：无 TBD
- **Type consistency**：
  - `getCrmHospitalDashboardTrend` 命名贯穿 T2 schema / T3 route / T5 generated / T4 wrapper
  - `CrmHospitalDashboardTrendRespSchema.daily[].date` 是 YYYY-MM-DD 字符串，与 repo 返回的 `toISOString().slice(0, 10)` 对齐
- **Scope**：1 个 spec / 1 个 plan / 7 个 task，Phase C.1 闭环
- **避免 brief 复制陷阱**：T2 注脚明确「assertHospitalAccount 不存在要 escalate」，避免 Phase B 那种「brief 错就照搬」fix round
