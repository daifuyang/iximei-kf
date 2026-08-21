# Phase C.3 医院业绩排行（Hospital Ranking）设计

> 日期：2026-07-28
> 范围：Phase C 三个子项目中的第三个 —— 把后端 ranking 聚合接口补全，让现有 `HospitalRankingCard` 显示真实数据
> 依赖：Phase A + B + C.1 + C.2A 全部已落地
> 不在本 spec：C.3.1 跨医院对比实时推送（另立 ticket）；C.3.2 排行筛选维度（按品类 / 区域）

## 0. 背景与动机

Phase B 已落地 admin 总后台 `/crm/dashboard` 的「医院效率榜」UI（`HospitalRankingCard` + 表格 + 奖牌），但后端 `buildHospitalRankings` 返回空数组（注释：「后端暂未提供按医院聚合的指标数据，排行榜返回空数组」）。

C.3 目标：**让 ranking 显示真实数据** —— 按医院聚合派单/查看/回复等关键指标，按某指标降序排前 N。

## 1. In-scope / Out-of-scope

### In-scope
- **后端**：新增 1 个 SQL 聚合接口 `GET /api/crm/v1/dashboard/hospital-rankings`
  - 默认按 `dispatchCount DESC` 排前 10
  - 返回字段：hospitalId / hospitalName / dispatchCount / viewedRate / replyCount / firstViewedAt
- **service**：Drizzle 聚合 SQL（group by hospital_id + LEFT JOIN view_log + LEFT JOIN reply）
- **route**：admin 视角的 `getCrmDashboardHospitalRankings` operationId
- **schema**：CrmHospitalRankingsResp（数组 + meta）
- **前端**：用 Phase B 已有的 `HospitalRankingCard`（不动）；只更新 `buildHospitalRankings` 真实填数据
- **数据范围**：admin / super_admin 全部医院；其它角色不访问

### Out-of-scope
- 跨医院对比实时推送（需 SSE/WebSocket；FC 不支持）
- 排行筛选维度（按品类 / 区域 / 时间段）— 后续 ticket
- 历史快照（昨天/上周/上月排行）— 后续 ticket
- 导出 CSV — 后续 ticket
- 钻取（点排行进医院详情）— `HospitalRankingCard` 已 history.push 现状，不动

## 2. 关键约束

- 路由前缀 `/api/crm/v1/...` 不变；前缀不变
- 新增 operationId `getCrmDashboardHospitalRankings`（CLAUDE.md 命名约定）
- 权限码复用 `crm:dashboard:view`（总后台 dashboard 权限）
- **不引新依赖**（Drizzle aggregate 已够）
- 兼容 FC 部署（in-memory 即可，无 Redis 缓存）
- 不动 `crm_dispatch` / `crm_dispatch_view_log` / `crm_hospital` schema
- 不动 admin 端 `HospitalRankingCard` 组件（Phase B 已完善）；只更新 `buildHospitalRankings` 1 个 utility
- 不动 OpenAPI 同步（T3 任务约束需要，**明记** plan §2）

## 3. 数据模型

无新表。纯 SQL aggregate。

## 4. 后端

### 4.1 SQL 聚合

```sql
SELECT
  h.id            AS hospital_id,
  h.hospital_name AS hospital_name,
  COUNT(d.id)     AS dispatch_count,
  -- viewed_rate = 有 view_log 的派单数 / 派单总数
  SUM(CASE WHEN v.id IS NOT NULL THEN 1 ELSE 0 END) AS viewed_count,
  COUNT(d.id) - SUM(CASE WHEN v.id IS NOT NULL THEN 1 ELSE 0 END) AS unviewed_count,
  -- reply_count = 该医院的所有派单回复数
  (SELECT COUNT(*) FROM crm_dispatch_reply r WHERE r.dispatch_id IN (SELECT id FROM crm_dispatch WHERE hospital_id = h.id)) AS reply_count,
  -- 首次查看时间
  MIN(v.created_at) AS first_viewed_at
FROM crm_hospital h
LEFT JOIN crm_dispatch d ON d.hospital_id = h.id AND d.deleted_at IS NULL
LEFT JOIN crm_dispatch_view_log v ON v.hospital_id = h.id
WHERE h.deleted_at IS NULL
GROUP BY h.id, h.hospital_name
ORDER BY dispatch_count DESC
LIMIT 10;
```

**性能**：crm_dispatch ~ 几千~几万行；crm_dispatch_view_log ~ 同量级；3 个 LEFT JOIN + GROUP BY + LIMIT 10 —— 毫秒级。

### 4.2 仓储方法

新增 `apps/yishan-api/src/modules/crm/repositories/dashboard.repository.ts`（可能已存在）：

```ts
import { and, count, desc, eq, isNull, sql } from 'drizzle-orm'
import { drizzleDb } from '@/db'
import { crmDispatch, crmDispatchReply, crmDispatchViewLog, crmHospital } from '../db/schema.js'

const active = (t: any) => isNull(t.deletedAt)

export class DashboardRepository {
  static async getHospitalRankings(limit = 10) {
    // 单条 SQL 聚合（沿用 Phase C.1 getStats 的 SUM(CASE WHEN...) 模式）
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

    return rows.map((r) => ({
      hospitalId: Number(r.hospitalId),
      hospitalName: r.hospitalName,
      dispatchCount: Number(r.dispatchCount ?? 0),
      viewedCount: Number(r.viewedCount ?? 0),
      unviewedCount: Number(r.dispatchCount ?? 0) - Number(r.viewedCount ?? 0),
      replyCount: Number(r.replyCount ?? 0),
      firstViewedAt: r.firstViewedAt?.toISOString() ?? null,
      viewedRate: r.dispatchCount > 0
        ? Number((Number(r.viewedCount) / Number(r.dispatchCount) * 100).toFixed(1))
        : 0,
    }))
  }
}
```

### 4.3 Service

新增或追加到 `apps/yishan-api/src/modules/crm/services/dashboard.service.ts`：

```ts
static async getHospitalRankings(limit = 10) {
  // 权限检查已在 route preHandler 完成（crm:dashboard:view）
  return DashboardRepository.getHospitalRankings(limit)
}
```

### 4.4 Schema

新增 `apps/yishan-api/src/modules/crm/schemas/dashboard.schema.ts`：

```ts
export const CrmHospitalRankingsItemSchema = Type.Object({
  hospitalId: Type.Number(),
  hospitalName: Type.String(),
  dispatchCount: Type.Number(),
  viewedCount: Type.Number(),
  unviewedCount: Type.Number(),
  viewedRate: Type.Number(),  // 0-100
  replyCount: Type.Number(),
  firstViewedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
}, { $id: 'crmHospitalRankingsItem' })

export const CrmHospitalRankingsRespSchema = Type.Object({
  items: Type.Array(CrmHospitalRankingsItemSchema),
  generatedAt: Type.String({ format: 'date-time' }),
}, { $id: 'crmHospitalRankingsResp' })
```

### 4.5 Route

在 `apps/yishan-api/src/modules/crm/routes/v1/dashboard/index.ts`（已存在）追加：

```ts
route.get(
  '/dashboard/hospital-rankings',
  {
    access: { permission: PERMS.DASHBOARD_VIEW },
    schema: {
      tags: [ROUTE_TAG],
      summary: '总后台 - 医院效率榜（按派单数）',
      operationId: 'getCrmDashboardHospitalRankings',
    },
  },
  async (req: any, reply: any) => {
    const result = await DashboardService.getHospitalRankings(10)
    return ResponseUtil.success(reply, result)
  },
)
```

### 4.6 同步 OpenAPI

按 Phase C.1 T5 教训（流程 follow-up），**T3 路由 + openapi.json 同步脱节**是治理缺口。本次**T2 任务约束**应明确要求 implementer 在 T2 commit 同步更新 `apps/yishan-api/openapi.json`（手工 patch，max openapi 走读）。

## 5. 前端

### 5.1 更新 `buildHospitalRankings`

修改 `apps/yishan-admin/src/modules/crm/pages/dashboard/utils.ts`：

```ts
// 之前：返回 []
export function buildHospitalRankings(
  stats: DashboardStats,  // 既有入参
): HospitalRankingItem[] {
  return (stats as any).hospitalRankings ?? []  // 后端响应会塞到 stats 里
}
```

### 5.2 API wrapper

在 `apps/yishan-admin/src/modules/crm/api/index.ts` 追加：

```ts
// 直接用 generated listCrmDashboardHospitalRankings 或 request<any> wrapper
export const getDashboardHospitalRankings = () =>
  request<any>('/api/crm/v1/dashboard/hospital-rankings')
```

### 5.3 Dashboard page 集成

在 `apps/yishan-admin/src/modules/crm/pages/dashboard/index.tsx` 找到 stats fetch 路径，加 hospitalRankings 字段填充（与 stats 一起返回）。**关键决策**：让后端 `/api/crm/v1/dashboard/stats` 响应**直接含 hospitalRankings 字段**（不另开路由）；如果复杂度高可拆 2 个接口。

**Ruling（按你偏好）**：选**合并方案** —— 后端 stats 接口加 `hospitalRankings: { items: [...], generatedAt: ISO }` 字段。前端无感。

→ 改为：spec §4.5 改成**修改** `/api/crm/v1/dashboard/stats` 响应（追加字段），不新增路由。
→ 路由 operationId 不变（仍是 `getCrmDashboardStats`）；无新 operationId 同步。
→ 单元测试只测新聚合 SQL，不需路由测试。

## 6. 验收

- 总后台 `/crm/dashboard` 加载时 `HospitalRankingCard` 显示真实数据
- 默认按派单数降序排前 10
- 每行展示：医院名、派单数、查看率%、回复数
- 点医院名跳转医院详情（已有逻辑，不动）
- 派单数为 0 的医院**不**显示（被 LIMIT 10 + ORDER BY 排除）
- 已有 view_log 的医院有 firstViewedAt；纯派单未查看为 null
- admin 端 tsc 0 errors；api test 全部 0 回归

## 7. 文件清单

| 文件 | 类型 | Task |
| --- | --- | --- |
| `apps/yishan-api/src/modules/crm/repositories/dashboard.repository.ts` | 新增/修改 | T1 |
| `apps/yishan-api/src/modules/crm/services/dashboard.service.ts` | 修改 | T1 |
| `apps/yishan-api/src/modules/crm/schemas/dashboard.schema.ts` | 修改 | T1 |
| `apps/yishan-api/src/modules/crm/routes/v1/dashboard/index.ts` | 修改 | T1 |
| `apps/yishan-api/src/modules/crm/tests/dashboard-rankings.test.ts` | 新增 | T1 |
| `apps/yishan-admin/src/modules/crm/pages/dashboard/utils.ts` | 修改 | T2 |
| `apps/yishan-admin/src/modules/crm/pages/dashboard/index.tsx` | 修改 | T2 |
| `apps/yishan-api/openapi.json` | 修改（手工 patch） | T1（T1 任务约束**必须**同步） |
| `apps/yishan-admin/src/services/generated/crm.ts` + `typings.d.ts` | 自动 | T3 |
| `docs/superpowers/handoffs/2026-07-28-phase-c3.md` | 新增 | T4 |
| (T5) | — | quality gate |

## 8. Spec 自审

- **Placeholder 扫描**：无 TBD
- **内部一致性**：
  - 字段名 `dispatchCount` / `viewedCount` / `replyCount` / `firstViewedAt` 与 schema / service / repo 对齐
  - 复用 Phase C.1 的 SUM(CASE WHEN ...) + LEFT JOIN 模式
  - admin 端不动 `HospitalRankingCard`（Phase B 完善）
- **范围**：1 spec / 1 plan / 5 task，Phase C.3 闭环
- **歧义**：「viewedRate = 0-100 数字」；firstViewedAt 为 null 表示从未查看

## 9. 不在 C.3 内的 TODO

- **C.3.1 排行筛选维度**：按品类 / 区域 / 时间段；另立 ticket
- **C.3.2 跨医院对比实时推送**：FC 不支持 WebSocket；不实现
- **C.3.3 排行历史快照**：昨天/上周排行；另立 ticket

## 10. 风险与回退

- **风险 1**：单条 SQL 含 subquery（reply_count）性能差
  - **回退**：拆 2 条 SQL 拿 dispatch + reply；前端合并
- **风险 2**：Drizzle 0.44 跨 MySQL 8.0 的 `IN (SELECT ...)` subquery 兼容
  - **回退**：用 LEFT JOIN + GROUP BY 替换 subquery

---

**Spec 结束。** 等待 user review。
