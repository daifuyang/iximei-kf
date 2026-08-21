# Phase C.3 医院业绩排行（Hospital Ranking）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Phase B 留的「后端 ranking 聚合 TODO」落地，让总后台 `/crm/dashboard` 的 HospitalRankingCard 显示真实数据。

**Architecture:** 后端把 `/api/crm/v1/dashboard/stats` 响应扩一个 `hospitalRankings` 字段（不再新增路由），Drizzle 1 条 SQL 聚合 + 前端 `buildHospitalRankings` utility 填实数据。

**Tech Stack:** Fastify 5 + Drizzle 0.44 + TypeBox (api) + React 19 + Antd Design Pro 6 + Vitest (api) + Jest (admin)。

**Spec:** `docs/superpowers/specs/2026-07-28-c3-hospital-ranking-design.md`

---

## Global Constraints

- **不引新依赖**（Drizzle aggregate 已够）
- **不新增路由**（修改现有 `getCrmDashboardStats` 响应加字段；前端无感）
- **不新增 operationId**（同 operationId，响应 body 加字段，**不是 breaking change** —— 前端不读 ranking 字段就忽略）
- **T1 任务约束**（明记，避免 C.1 T5 教训）：同步更新 `apps/yishan-api/openapi.json` 手工 patch（加 `hospitalRankings` 字段到 stats response schema）
- admin 端 `HospitalRankingCard` 不动（Phase B 完善）
- 跑命令前 `unset http_proxy https_proxy all_proxy`
- pnpm filter 加 `--config.confirmModulesPurge=false`
- 已有 brief self-check 约定：**如果发现 brief 与代码不一致，主动 ping，不要照搬**

---

## File Structure Overview

| 文件 | 类型 | Task |
| --- | --- | --- |
| `apps/yishan-api/src/modules/crm/repositories/dashboard.repository.ts` | 新增 | T1 |
| `apps/yishan-api/src/modules/crm/services/dashboard.service.ts` | 修改 | T1 |
| `apps/yishan-api/src/modules/crm/schemas/dashboard.schema.ts` | 修改 | T1 |
| `apps/yishan-api/src/modules/crm/routes/v1/dashboard/index.ts` | 修改 | T1 |
| `apps/yishan-api/src/modules/crm/tests/dashboard-rankings.test.ts` | 新增 | T1 |
| `apps/yishan-api/openapi.json` | 修改（手工 patch） | T1 |
| `apps/yishan-admin/src/modules/crm/pages/dashboard/utils.ts` | 修改 | T2 |
| `apps/yishan-admin/src/modules/crm/pages/dashboard/index.tsx` | 修改 | T2 |
| `apps/yishan-admin/src/services/generated/crm.ts` + `typings.d.ts` | 自动 | T3 |
| `docs/superpowers/handoffs/2026-07-28-phase-c3.md` | 新增 | T4 |
| (T5) | — | quality gate |

---

## Task 1: 后端聚合 + schema + route + openapi.json 同步

**Files:**
- Create: `apps/yishan-api/src/modules/crm/repositories/dashboard.repository.ts`
- Modify: `apps/yishan-api/src/modules/crm/services/dashboard.service.ts`
- Modify: `apps/yishan-api/src/modules/crm/schemas/dashboard.schema.ts`
- Modify: `apps/yishan-api/src/modules/crm/routes/v1/dashboard/index.ts`
- Create: `apps/yishan-api/src/modules/crm/tests/dashboard-rankings.test.ts`
- Modify: `apps/yishan-api/openapi.json`（手工 patch）

### Step 1.1：先 grep 现有 dashboard 文件

派发前**先 read**：
- `apps/yishan-api/src/modules/crm/routes/v1/dashboard/index.ts`
- `apps/yishan-api/src/modules/crm/services/dashboard.service.ts`（如存在）
- `apps/yishan-api/src/modules/crm/schemas/dashboard.schema.ts`
- `apps/yishan-admin/src/modules/crm/pages/dashboard/utils.ts`（前端预期 `buildHospitalRankings(stats)` 接 ranking 数组）

确认现有 `getCrmDashboardStats` 响应 schema 字段、加 ranking 字段后 schema 兼容。如发现不一致 → **主动 escalate**。

### Step 1.2：写失败测试

```ts
// apps/yishan-api/src/modules/crm/tests/dashboard-rankings.test.ts
import { describe, it, expect, vi } from 'vitest'
import { drizzleDb } from '@/db'
import { DashboardRepository } from '../repositories/dashboard.repository.js'

describe('DashboardRepository.getHospitalRankings', () => {
  it('按 dispatchCount DESC 排前 N', async () => {
    vi.spyOn(drizzleDb, 'select').mockImplementation(() => {
      const chain: any = {
        from: vi.fn(() => chain),
        leftJoin: vi.fn(() => chain),
        where: vi.fn(() => chain),
        groupBy: vi.fn(() => chain),
        orderBy: vi.fn(() => chain),
        limit: vi.fn(() => chain),
        then: (res: any, rej: any) => Promise.resolve([
          { hospitalId: 1, hospitalName: 'A 医院', dispatchCount: 50, viewedCount: 30, replyCount: 12, firstViewedAt: new Date('2026-08-01') },
          { hospitalId: 2, hospitalName: 'B 医院', dispatchCount: 30, viewedCount: 25, replyCount: 8, firstViewedAt: null },
        ]).then(res, rej),
      }
      return chain
    })
    const result = await DashboardRepository.getHospitalRankings(10)
    expect(result).toHaveLength(2)
    expect(result[0].hospitalName).toBe('A 医院')
    expect(result[0].viewedRate).toBe(60)  // 30/50 = 60%
  })
})
```

### Step 1.3：跑测试，期望 FAIL

```bash
cd apps/yishan-api && pnpm test -- -t "DashboardRepository.getHospitalRankings"
```

期望：`getHospitalRankings is not a function`。

### Step 1.4：实现 repo

```ts
// apps/yishan-api/src/modules/crm/repositories/dashboard.repository.ts
import { and, count, desc, eq, isNull, sql } from 'drizzle-orm'
import { drizzleDb } from '@/db'
import { crmDispatch, crmDispatchReply, crmDispatchViewLog, crmHospital } from '../db/schema.js'

const active = (t: any) => isNull(t.deletedAt)

export class DashboardRepository {
  static async getHospitalRankings(limit = 10) {
    const rows = await drizzleDb
      .select({
        hospitalId: crmHospital.id,
        hospitalName: crmHospital.hospitalName,
        dispatchCount: count(crmDispatch.id),
        viewedCount: sql<number>`SUM(CASE WHEN ${crmDispatchViewLog.id} IS NOT NULL THEN 1 ELSE 0 END)`,
        replyCount: sql<number>`(SELECT COUNT(*) FROM crm_dispatch_reply r WHERE r.dispatch_id IN (SELECT id FROM crm_dispatch WHERE hospital_id = ${crmHospital.id} AND deleted_at IS NULL))`,
        firstViewedAt: sql<Date | null>`MIN(${crmDispatchViewLog.createdAt})`,
      })
      .from(crmHospital)
      .leftJoin(crmDispatch, and(
        eq(crmDispatch.hospitalId, crmHospital.id),
        active(crmDispatch),
      ))
      .leftJoin(crmDispatchViewLog, and(
        eq(crmDispatchViewLog.hospitalId, crmHospital.id),
      ))
      .where(active(crmHospital))
      .groupBy(crmHospital.id, crmHospital.hospitalName)
      .orderBy(desc(count(crmDispatch.id)))
      .limit(limit)

    return rows.map((r: any) => {
      const dispatchCount = Number(r.dispatchCount ?? 0)
      const viewedCount = Number(r.viewedCount ?? 0)
      return {
        hospitalId: Number(r.hospitalId),
        hospitalName: r.hospitalName,
        dispatchCount,
        viewedCount,
        unviewedCount: Math.max(0, dispatchCount - viewedCount),
        replyCount: Number(r.replyCount ?? 0),
        firstViewedAt: r.firstViewedAt instanceof Date ? r.firstViewedAt.toISOString() : null,
        viewedRate: dispatchCount > 0
          ? Number(((viewedCount / dispatchCount) * 100).toFixed(1))
          : 0,
      }
    })
  }
}
```

### Step 1.5：service + schema + route

```ts
// services/dashboard.service.ts - 在 getStats 末尾追加 hospitalRankings
static async getStats(...) {
  // 既有逻辑 ...
  return {
    ...existingStats,
    hospitalRankings: {
      items: await DashboardRepository.getHospitalRankings(10),
      generatedAt: new Date().toISOString(),
    },
  }
}
```

```ts
// schemas/dashboard.schema.ts 追加
export const CrmHospitalRankingsItemSchema = Type.Object({
  hospitalId: Type.Number(),
  hospitalName: Type.String(),
  dispatchCount: Type.Number(),
  viewedCount: Type.Number(),
  unviewedCount: Type.Number(),
  viewedRate: Type.Number(),
  replyCount: Type.Number(),
  firstViewedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
}, { $id: 'crmHospitalRankingsItem' })

export const CrmHospitalRankingsRespSchema = Type.Object({
  items: Type.Array(CrmHospitalRankingsItemSchema),
  generatedAt: Type.String({ format: 'date-time' }),
}, { $id: 'crmHospitalRankingsResp' })

// 在既有 CrmDashboardStatsRespSchema 加 hospitalRankings 字段：
// hospitalRankings: Type.Optional(CrmHospitalRankingsRespSchema)
```

```ts
// routes/v1/dashboard/index.ts - 不动 operationId，response schema 引用追加
// 不新增路由
```

### Step 1.6：tsc 0 errors

```bash
cd apps/yishan-api && pnpm exec tsc --noEmit
```

### Step 1.7：同步 openapi.json（关键！避免 C.1 T5 教训）

手工 patch `apps/yishan-api/openapi.json`：
- 找到 `getCrmDashboardStats` 的 response 200 schema
- 加 `hospitalRankings` 字段（嵌套对象：items[] + generatedAt）
- 字段位置：放在响应 schema 最外层（与既有字段并列）

### Step 1.8：跑测试，期望 PASS

```bash
cd apps/yishan-api && pnpm test -- -t "DashboardRepository.getHospitalRankings"
```

期望：1 passed。

### Step 1.9：commit

```bash
git add apps/yishan-api/src/modules/crm/ apps/yishan-api/openapi.json
git commit -m "feat(crm): dashboard hospital rankings aggregate + openapi.json patch"
```

---

## Task 2: 前端 buildHospitalRankings 真实填数据

**Files:**
- Modify: `apps/yishan-admin/src/modules/crm/pages/dashboard/utils.ts`
- Modify: `apps/yishan-admin/src/modules/crm/pages/dashboard/index.tsx`（仅当 stats 字段映射需要时）

### Step 2.1：先 grep `buildHospitalRankings` 现有代码

派发前**先 read** `apps/yishan-admin/src/modules/crm/pages/dashboard/utils.ts` line 395 附近的 `buildHospitalRankings`，确认 `HospitalRankingItem` 类型（`apps/yishan-admin/src/modules/crm/pages/dashboard/types.ts`）。

如发现 `HospitalRankingItem` 字段与后端响应字段不一致 → **主动 escalate**。

### Step 2.2：实现

```ts
// utils.ts
export function buildHospitalRankings(stats: DashboardStats): HospitalRankingItem[] {
  // Phase C.3: 后端响应会塞 stats.hospitalRankings.items
  return (stats as any)?.hospitalRankings?.items ?? []
}
```

### Step 2.3：tsc 0 errors

```bash
cd apps/yishan-admin && npx max setup && npx tsc --noEmit
```

### Step 2.4：commit

```bash
git add apps/yishan-admin/src/modules/crm/pages/dashboard/
git commit -m "feat(crm-admin): buildHospitalRankings returns real backend data"
```

---

## Task 3: 重生成 OpenAPI

**Files:**
- Auto: `apps/yishan-admin/src/services/generated/crm.ts` + `typings.d.ts`
- Auto: `apps/yishan-api/openapi.json`（保险再 regen 一次确认）

### Step 3.1：跑

```bash
cd apps/yishan-admin && pnpm openapi
```

### Step 3.2：检查

```bash
grep "hospitalRankings" apps/yishan-admin/src/services/generated/typings.d.ts
```

期望：1 命中（响应 schema 含 hospitalRankings 字段）。

### Step 3.3：tsc

```bash
cd apps/yishan-admin && npx tsc --noEmit
```

### Step 3.4：commit

```bash
git add apps/yishan-admin/src/services/generated apps/yishan-api/openapi.json
git commit -m "chore(openapi): regenerate crm client after hospital rankings"
```

---

## Task 4: Handoff 文档 + push

**Files:**
- Create: `docs/superpowers/handoffs/2026-07-28-phase-c3.md`

### Step 4.1：写 handoff

按 C.1/C.2A 模板覆盖：
- 用户原话 ⑨ 医院业绩排行
- 5 commit 清单
- Phase B ranking TODO 填实情况
- Quality gate 预期（T5 补）
- C.3 follow-up（筛选维度 / 历史快照）

### Step 4.2：commit + push

```bash
git add docs/superpowers/handoffs/2026-07-28-phase-c3.md
git commit -m "docs(crm): phase C.3 delivery handoff summary"
git push origin main
```

---

## Task 5: 质量门

### Step 5.1：lint + test + admin build

```bash
unset http_proxy https_proxy all_proxy
cd /home/ubuntu/workspace/iximei-kf
pnpm lint 2>&1 | tail -30
pnpm --filter yishan-admin test 2>&1 | tail -10
pnpm --filter yishan-api test 2>&1 | tail -10
pnpm --filter yishan-admin build 2>&1 | tail -30
```

### Step 5.2：commit（如有 diff）

---

## Self-Review

- **Spec coverage**：
  - §4.1-4.5 后端聚合 + schema + route → T1
  - §4.6 同步 openapi.json → T1 Step 1.7
  - §5.1-5.3 前端 + API wrapper → T2
  - 验收 §6 → T5 质量门
  - handoff → T4
- **No Placeholder**：无 TBD；T1 Step 1.7 显式要求同步 openapi.json（避免 C.1 T5 教训）
- **Type consistency**：`CrmHospitalRankingsItemSchema` 字段名与 repo / service / 前端 wrapper 一致
- **Scope**：1 spec / 1 plan / 5 task，Phase C.3 闭环
- **避免 brief 复制陷阱**：每步都写「先 read + 不一致就 escalate」约定
