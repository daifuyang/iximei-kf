# CRM 医院查看顾客记录 + 数据看板 + 未查看提醒（Phase B）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现医院账号对派单的「首次查看自动留痕 + 列表未查看徽章 + 本院数据看板 + 总后台查看日志」完整业务闭环。

**Architecture:** 新增 1 张表 `crm_dispatch_view_log`（UNIQUE 约束保证幂等）；在派单 `getById` service 路径中嵌入「医院账号首次访问自动落 view_log」；新增 4 个路由（2 个总后台 view log + 1 个医院数据看板 + 1 个未查看 count）；新增 1 个页面 `/crm/hospital-dashboard` + 菜单 Badge 轮询。

**Tech Stack:** Fastify 5 + Drizzle 0.44 + TypeBox + JWT (RBAC)；React 19 + Antd Design Pro 6 + UmiJS 4 + dayjs (admin)；Vitest (api) + Jest (admin)。

**Spec:** `docs/superpowers/specs/2026-07-28-crm-view-tracking-design.md`

---

## Global Constraints

- Node 22.22.1 / pnpm 8.15.9 (Node 24 实测可用)
- Drizzle 0.44 (mysql2) + TypeBox
- 模块名 `crm`；表名前缀 `crm_`；路由前缀 `/api/crm/v1/...`
- 所有路由 `operationId` 用 lowerCamelCase（CLAUDE.md 约束）
- 不动 Drizzle 核心迁移；新表用 `drizzle-kit generate` 生成 SQL
- 不引入 WebSocket / Redis Pub/Sub
- Hospital scope 由 `crm_hospital.account_user_id = currentUser.id` 定位
- Conventional Commits
- 跑命令前 `unset http_proxy https_proxy all_proxy`
- pnpm filter 加 `--config.confirmModulesPurge=false` 防卡 confirm
- admin 端用 SSH remote `git@github.com:daifuyang/iximei-kf.git`（`~/.gitconfig` 已配 insteadOf）

---

## File Structure Overview

| 文件 | 类型 | 任务 |
| --- | --- | --- |
| `apps/yishan-api/src/modules/crm/db/schema.ts` | 修改 | T1 |
| `apps/yishan-api/src/modules/crm/db/drizzle/0004_xxx.sql` | 新增 | T1（drizzle-kit generate 产物） |
| `apps/yishan-api/src/modules/crm/repositories/dispatches.repository.ts` | 修改 | T1+T2 |
| `apps/yishan-api/src/modules/crm/tests/dispatches.view-log.test.ts` | 新增 | T2 |
| `apps/yishan-api/src/modules/crm/services/dispatches.service.ts` | 修改 | T3 |
| `apps/yishan-api/src/modules/crm/services/hospital-dashboard.service.ts` | 新增 | T5 |
| `apps/yishan-api/src/modules/crm/repositories/hospital-dashboard.repository.ts` | 新增 | T5 |
| `apps/yishan-api/src/modules/crm/permissions.ts` | 修改 | T3+T5 |
| `apps/yishan-api/src/modules/crm/routes/v1/dispatches/index.ts` | 修改 | T4 |
| `apps/yishan-api/src/modules/crm/routes/v1/hospital-dashboard/index.ts` | 新增 | T5 |
| `apps/yishan-api/src/modules/crm/schemas/dispatches.schema.ts` | 修改 | T4 |
| `apps/yishan-api/src/modules/crm/schemas/hospital-dashboard.schema.ts` | 新增 | T5 |
| `apps/yishan-admin/src/modules/crm/pages/dispatches/index.tsx` | 修改 | T6 |
| `apps/yishan-admin/src/modules/crm/pages/hospital-dashboard/index.tsx` | 新增 | T7 |
| `apps/yishan-admin/src/modules/crm/api/index.ts` | 修改 | T6+T7 |
| `apps/yishan-admin/src/services/generated/crm.ts` + `typings.d.ts` | 自动 | T8（OpenAPI 重生） |
| `apps/yishan-api/openapi.json` | 自动 | T8 |
| `apps/yishan-admin/src/modules/crm/config/system-menu.json` 或 seed | 修改 | T9（菜单配置） |
| `apps/yishan-admin/src/layouts/...` 或 Badge 组件 | 修改 | T10（菜单 Badge 轮询） |

---

## Task 1: Drizzle schema + 迁移

**Files:**
- Modify: `apps/yishan-api/src/modules/crm/db/schema.ts`（追加 crmDispatchViewLog 表 + import）
- Create: `apps/yishan-api/src/modules/crm/db/drizzle/0004_xxx.sql`（drizzle-kit generate 产物）
- Create: `apps/yishan-api/src/modules/crm/db/drizzle/meta/0004_snapshot.json` + `_journal` 更新
- Test: 无（schema 改动由 T2 测试覆盖）

### Step 1.1：写失败的回归测试（确认 schema 未存在）

```ts
// apps/yishan-api/src/modules/crm/tests/dispatches.view-log.schema.test.ts
import { describe, it, expect } from 'vitest'
import * as schema from '../db/schema.js'

describe('crmDispatchViewLog schema', () => {
  it('表已定义', () => {
    expect((schema as any).crmDispatchViewLog).toBeDefined()
  })
})
```

### Step 1.2：跑测试，期望 FAIL（表未定义）

```bash
cd apps/yishan-api && pnpm test -- -t "crmDispatchViewLog"
```

期望：`schema.crmDispatchViewLog` undefined。

### Step 1.3：追加 schema

在 `apps/yishan-api/src/modules/crm/db/schema.ts` 末尾（crmDispatchMobileViewLog 之后）追加：

```ts
/**
 * 派单「医院查看」留痕日志。
 *
 * 设计目标：医院账号首次打开派单详情时自动写一条。
 * UNIQUE (dispatch_id, hospital_id, viewer_user_id) 兜底幂等。
 * hospital_id 冗余避免派单改派后失去归属链。
 */
export const crmDispatchViewLog = mysqlTable('crm_dispatch_view_log', {
  id: int().primaryKey().autoincrement().notNull(),
  dispatchId: int('dispatch_id').notNull(),
  hospitalId: int('hospital_id').notNull(),
  viewerUserId: int('viewer_user_id').notNull(),
  viewerUsername: varchar('viewer_username', { length: 100 }).notNull(),
  viewerHospitalName: varchar('viewer_hospital_name', { length: 100 }),
  ipAddress: varchar('ip_address', { length: 64 }),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
}, (t) => [
  uniqueIndex('uniq_crm_dispatch_view_log_dispatch_hospital_user')
    .on(t.dispatchId, t.hospitalId, t.viewerUserId),
  index('idx_crm_dispatch_view_log_dispatch').on(t.dispatchId),
  index('idx_crm_dispatch_view_log_hospital').on(t.hospitalId),
  index('idx_crm_dispatch_view_log_created').on(t.createdAt),
])
```

### Step 1.4：生成 SQL 迁移

```bash
cd apps/yishan-api/src/modules/crm
npx drizzle-kit generate --config=./drizzle.config.ts
npx drizzle-kit migrate --config=./drizzle.config.ts
```

期望：生成 `drizzle/0004_*.sql` 含 `CREATE TABLE crm_dispatch_view_log ...`；meta 0004 snapshot 生成。

### Step 1.5：跑测试，期望 PASS

```bash
cd apps/yishan-api && pnpm test -- -t "crmDispatchViewLog"
```

期望：1 passed。

### Step 1.6：commit

```bash
git add apps/yishan-api/src/modules/crm/db
git commit -m "feat(crm): crm_dispatch_view_log schema + migration"
```

---

## Task 2: Repository — recordView + listViewLogs

**Files:**
- Modify: `apps/yishan-api/src/modules/crm/repositories/dispatches.repository.ts`
- Test: `apps/yishan-api/src/modules/crm/tests/dispatches.view-log.test.ts`

### Step 2.1：写失败的测试

```ts
// apps/yishan-api/src/modules/crm/tests/dispatches.view-log.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { drizzleDb } from '@/db'
import { DispatchesRepository } from '../repositories/dispatches.repository.js'

describe('DispatchesRepository.viewLog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(drizzleDb, 'insert').mockImplementation(() => {
      const chain: any = {
        values: vi.fn(() => chain),
        onDuplicateKeyUpdate: vi.fn(() => chain),
        then: (res: any, rej: any) => Promise.resolve([{ insertId: 1 }]).then(res, rej),
      }
      return chain
    })
  })
  afterEach(() => vi.restoreAllMocks())

  it('recordView 调用 drizzle insert + onDuplicateKeyUpdate', async () => {
    await DispatchesRepository.recordView({
      dispatchId: 100,
      hospitalId: 5,
      viewerUserId: 7,
      viewerUsername: 'hospital_a',
      viewerHospitalName: 'A 医院',
      ipAddress: '127.0.0.1',
    } as any)
    expect(drizzleDb.insert).toHaveBeenCalled()
  })

  it('listViewLogs 返回某派单的全部记录', async () => {
    vi.spyOn(drizzleDb, 'select').mockImplementation(() => {
      const chain: any = {
        from: vi.fn(() => chain),
        where: vi.fn(() => chain),
        orderBy: vi.fn(() => chain),
        limit: vi.fn(() => chain),
        then: (res: any, rej: any) => Promise.resolve([]).then(res, rej),
      }
      return chain
    })
    const result = await DispatchesRepository.listViewLogs(100)
    expect(result).toEqual([])
  })
})
```

### Step 2.2：跑测试，期望 FAIL

```bash
cd apps/yishan-api && pnpm test -- -t "viewLog"
```

期望：`recordView is not a function`。

### Step 2.3：实现

在 `apps/yishan-api/src/modules/crm/repositories/dispatches.repository.ts` 追加（与 recordMobileView 同风格）：

```ts
// ── 派单「医院查看」留痕 ──

static recordView(input: {
  dispatchId: number
  hospitalId: number
  viewerUserId: number
  viewerUsername: string
  viewerHospitalName?: string | null
  ipAddress?: string | null
}) {
  return drizzleDb
    .insert(crmDispatchViewLog)
    .values({
      dispatchId: input.dispatchId,
      hospitalId: input.hospitalId,
      viewerUserId: input.viewerUserId,
      viewerUsername: input.viewerUsername,
      viewerHospitalName: input.viewerHospitalName ?? null,
      ipAddress: input.ipAddress ?? null,
    })
    .onDuplicateKeyUpdate({
      // 不更新任何字段；保留首次查看时间。
      set: { viewerUsername: input.viewerUsername },
    })
}

static listViewLogs(dispatchId: number) {
  return drizzleDb
    .select()
    .from(crmDispatchViewLog)
    .where(eq(crmDispatchViewLog.dispatchId, dispatchId))
    .orderBy(desc(crmDispatchViewLog.createdAt))
}

static listViewLogsByDispatchAndHospital(dispatchId: number, hospitalId: number) {
  return drizzleDb
    .select()
    .from(crmDispatchViewLog)
    .where(
      and(
        eq(crmDispatchViewLog.dispatchId, dispatchId),
        eq(crmDispatchViewLog.hospitalId, hospitalId),
      ),
    )
    .orderBy(asc(crmDispatchViewLog.createdAt))
}
```

并在 import 头加 `crmDispatchViewLog`：

```ts
import { crmCustomer, crmDispatch, crmDispatchFollowLog, crmDispatchMobileViewLog, crmDispatchReply, crmDispatchStatus, crmDispatchViewLog, crmHospital } from '../db/schema.js'
```

### Step 2.4：跑测试，期望 PASS

```bash
cd apps/yishan-api && pnpm test -- -t "viewLog"
```

期望：2 passed。

### Step 2.5：commit

```bash
git add apps/yishan-api/src/modules/crm/repositories/dispatches.repository.ts \
        apps/yishan-api/src/modules/crm/tests/dispatches.view-log.test.ts
git commit -m "feat(crm): dispatch view log repository + tests"
```

---

## Task 3: Service — getById 嵌入 view_log + Hospital scope

**Files:**
- Modify: `apps/yishan-api/src/modules/crm/services/dispatches.service.ts`
- Modify: `apps/yishan-api/src/modules/crm/permissions.ts`

### Step 3.1：追加权限

在 `apps/yishan-api/src/modules/crm/permissions.ts` `PERMS` 对象内追加：

```ts
DISPATCH_VIEW_HOSPITAL_LOG: { code: 'crm:dispatches:view-hospital-log', label: 'CRM-派单-查看医院查看日志', group: 'crm' },
HOSPITAL_DASHBOARD_VIEW: { code: 'crm:hospital-dashboard:view', label: 'CRM-医院后台-数据看板', group: 'crm' },
```

### Step 3.2：修改 service getById

在 `apps/yishan-api/src/modules/crm/services/dispatches.service.ts` 的 `getById` 末尾（return 之前），插入医院账号首次访问自动落日志：

```ts
// 医院账号首次访问自动写 view_log
if (roleIds.includes(ROLE_IDS.HOSPITAL_ACCOUNT) && d) {
  const ip = (req as any)?.ip ?? null
  const user = (req as any)?.currentUser
  DispatchesRepository.recordView({
    dispatchId: d.id,
    hospitalId: d.hospitalId,
    viewerUserId: userId,
    viewerUsername: user?.username ?? '',
    viewerHospitalName: user?.hospitalName ?? null,
    ipAddress: ip,
  }).catch(() => {})  // 写日志失败不阻塞详情
}
```

**但当前 service.getById 签名是 `(id, userId, roleIds, scope)`，没有 req**。需要把 req 也传进去。修改 service + route 同步：

```ts
// services/dispatches.service.ts
static async getById(
  id: number,
  userId: number,
  roleIds: ReadonlyArray<number>,
  scope: DataScopeCode,
  req?: any,  // 新增
) {
  // ... 原逻辑
  const d = await DispatchesRepository.findById(id)
  if (!d) return null
  // ... 数据范围校验
  if (roleIds.includes(ROLE_IDS.HOSPITAL_ACCOUNT)) {
    const ids = (await HospitalsRepository.accessibleHospitalIds(userId)).map((x: any) => x.hospitalId)
    if (!ids.includes(d.hospitalId)) return null
    // 写 view_log
    await DispatchesRepository.recordView({
      dispatchId: d.id,
      hospitalId: d.hospitalId,
      viewerUserId: userId,
      viewerUsername: req?.currentUser?.username ?? '',
      viewerHospitalName: req?.currentUser?.hospitalName ?? null,
      ipAddress: req?.ip ?? null,
    }).catch(() => {})
  }
  return d
}
```

```ts
// routes/v1/dispatches/index.ts
route.get(
  '/dispatches/:id',
  {
    access: { permission: PERMS.DISPATCH_LIST },
    schema: { ... },
  },
  async (req: any, reply: any) => {
    const d = await DispatchesService.getById(id(req), uid(req), roleIds(req), scope(req), req)
    if (!d) return ResponseUtil.error(reply, 40401, '派单不存在或无权访问')
    return ResponseUtil.success(reply, d)
  },
)
```

### Step 3.3：commit

```bash
git add apps/yishan-api/src/modules/crm/services/dispatches.service.ts \
        apps/yishan-api/src/modules/crm/routes/v1/dispatches/index.ts \
        apps/yishan-api/src/modules/crm/permissions.ts
git commit -m "feat(crm): auto-record dispatch view on hospital account access"
```

---

## Task 4: 新增 listCrmDispatchHospitalViewLogs 路由

**Files:**
- Modify: `apps/yishan-api/src/modules/crm/routes/v1/dispatches/index.ts`
- Modify: `apps/yishan-api/src/modules/crm/schemas/dispatches.schema.ts`（新增 CrmDispatchViewLogRespSchema）

### Step 4.1：新增 schema

在 `apps/yishan-api/src/modules/crm/schemas/dispatches.schema.ts` 末尾追加：

```ts
export const CrmDispatchViewLogRespSchema = Type.Object({
  id: Type.Number(),
  dispatchId: Type.Number(),
  hospitalId: Type.Number(),
  hospitalName: Type.Union([Type.String(), Type.Null()]),
  viewerUserId: Type.Number(),
  viewerUsername: Type.String(),
  ipAddress: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String({ format: 'date-time' }),
}, { $id: 'crmDispatchViewLogResp' })

export type CrmDispatchViewLogResp = import('@sinclair/typebox').Static<typeof CrmDispatchViewLogRespSchema>
```

### Step 4.2：新增路由

在 `apps/yishan-api/src/modules/crm/routes/v1/dispatches/index.ts` 末尾（mobile-view-logs 之后）追加：

```ts
route.get(
  '/dispatches/:id/hospital-view-logs',
  {
    access: { permission: PERMS.DISPATCH_VIEW_HOSPITAL_LOG },
    schema: {
      tags: [ROUTE_TAG],
      summary: '派单医院查看日志（仅 super_admin / admin）',
      operationId: 'listCrmDispatchHospitalViewLogs',
      params: CrmIdParamsSchema,
    },
  },
  async (req: any, reply: any) => {
    const result = await DispatchesService.listDispatchHospitalViewLogs(
      id(req),
      uid(req),
      roleIds(req),
      scope(req),
    )
    return ResponseUtil.success(reply, result)
  },
)
```

### Step 4.3：在 service 加 listDispatchHospitalViewLogs

在 `apps/yishan-api/src/modules/crm/services/dispatches.service.ts` 末尾（listDispatchMobileViews 之后）追加：

```ts
static async listDispatchHospitalViewLogs(
  id: number,
  userId: number,
  roleIds: ReadonlyArray<number>,
  scope: DataScopeCode,
) {
  if (!roleIds.includes(ROLE_IDS.SUPER_ADMIN) && !roleIds.includes(ROLE_IDS.ADMIN)) {
    throw new BusinessError(AuthErrorCode.FORBIDDEN, '仅系统管理员可查看医院查看日志')
  }
  const d = await DispatchesRepository.findById(id)
  if (!d) throw new BusinessError(ResourceErrorCode.NOT_FOUND, '派单不存在')
  const logs = await DispatchesRepository.listViewLogs(id)
  return logs
}
```

### Step 4.4：commit

```bash
git add apps/yishan-api/src/modules/crm/routes/v1/dispatches/index.ts \
        apps/yishan-api/src/modules/crm/schemas/dispatches.schema.ts \
        apps/yishan-api/src/modules/crm/services/dispatches.service.ts
git commit -m "feat(crm): dispatch hospital view logs API"
```

---

## Task 5: 医院数据看板 + unviewed count

**Files:**
- Create: `apps/yishan-api/src/modules/crm/repositories/hospital-dashboard.repository.ts`
- Create: `apps/yishan-api/src/modules/crm/services/hospital-dashboard.service.ts`
- Create: `apps/yishan-api/src/modules/crm/schemas/hospital-dashboard.schema.ts`
- Create: `apps/yishan-api/src/modules/crm/routes/v1/hospital-dashboard/index.ts`
- Create: `apps/yishan-api/src/modules/crm/tests/hospital-dashboard.test.ts`

### Step 5.1：写失败测试

```ts
// apps/yishan-api/src/modules/crm/tests/hospital-dashboard.test.ts
import { describe, it, expect, vi } from 'vitest'
import { drizzleDb } from '@/db'
import { HospitalDashboardRepository } from '../repositories/hospital-dashboard.repository.js'

describe('HospitalDashboardRepository', () => {
  it('getStats 返回 4 个时间桶 + 5 个指标', async () => {
    vi.spyOn(drizzleDb, 'select').mockImplementation(() => {
      const chain: any = {
        from: vi.fn(() => chain),
        where: vi.fn(() => chain),
        leftJoin: vi.fn(() => chain),
        then: (res: any, rej: any) => Promise.resolve([{
          todayCount: 0, monthCount: 0, yearCount: 0, totalCount: 0,
          viewedCount: 0, unviewedCount: 0,
        }]).then(res, rej),
      }
      return chain
    })
    const stats = await HospitalDashboardRepository.getStats(5)
    expect(stats).toHaveProperty('todayCount')
    expect(stats).toHaveProperty('viewedCount')
  })
})
```

### Step 5.2：跑测试 FAIL

```bash
cd apps/yishan-api && pnpm test -- -t "HospitalDashboard"
```

### Step 5.3：实现 repository

```ts
// apps/yishan-api/src/modules/crm/repositories/hospital-dashboard.repository.ts
import { and, count, eq, gte, isNull, sql } from 'drizzle-orm'
import { drizzleDb } from '@/db'
import { crmDispatch, crmDispatchViewLog } from '../db/schema.js'

const active = (t: any) => isNull(t.deletedAt)

export class HospitalDashboardRepository {
  /**
   * 单条 SQL 聚合 4 个时间桶 + 2 个查看状态指标。
   * 用 subquery + COUNT CASE WHEN 避免 N+1。
   */
  static async getStats(hospitalId: number) {
    const now = new Date()
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const yearStart = new Date(now.getFullYear(), 0, 1)

    const [row] = await drizzleDb
      .select({
        todayCount: sql<number>`SUM(CASE WHEN ${crmDispatch.createdAt} >= ${todayStart} THEN 1 ELSE 0 END)`,
        monthCount: sql<number>`SUM(CASE WHEN ${crmDispatch.createdAt} >= ${monthStart} THEN 1 ELSE 0 END)`,
        yearCount: sql<number>`SUM(CASE WHEN ${crmDispatch.createdAt} >= ${yearStart} THEN 1 ELSE 0 END)`,
        totalCount: count(),
        viewedCount: sql<number>`SUM(CASE WHEN ${crmDispatchViewLog.id} IS NOT NULL THEN 1 ELSE 0 END)`,
        unviewedCount: sql<number>`SUM(CASE WHEN ${crmDispatchViewLog.id} IS NULL THEN 1 ELSE 0 END)`,
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
      todayCount: Number(row?.todayCount ?? 0),
      monthCount: Number(row?.monthCount ?? 0),
      yearCount: Number(row?.yearCount ?? 0),
      totalCount: Number(row?.totalCount ?? 0),
      viewedCount: Number(row?.viewedCount ?? 0),
      unviewedCount: Number(row?.unviewedCount ?? 0),
    }
  }

  static async getUnviewedCount(hospitalId: number) {
    const [row] = await drizzleDb
      .select({ count: count() })
      .from(crmDispatch)
      .leftJoin(
        crmDispatchViewLog,
        and(
          eq(crmDispatchViewLog.dispatchId, crmDispatch.id),
          eq(crmDispatchViewLog.hospitalId, hospitalId),
        ),
      )
      .where(
        and(
          eq(crmDispatch.hospitalId, hospitalId),
          active(crmDispatch),
          sql`${crmDispatchViewLog.id} IS NULL`,
        ),
      )
    return Number(row?.count ?? 0)
  }
}
```

### Step 5.4：实现 service

```ts
// apps/yishan-api/src/modules/crm/services/hospital-dashboard.service.ts
import { BusinessError } from '@/exceptions/business-error.js'
import { AuthErrorCode } from '@/constants/business-codes/auth.js'
import { ROLE_IDS } from '@/constants/permission-codes.js'
import { HospitalDashboardRepository } from '../repositories/hospital-dashboard.repository.js'
import { HospitalsRepository } from '../repositories/hospitals.repository.js'

export class HospitalDashboardService {
  static async getStats(userId: number, roleIds: ReadonlyArray<number>) {
    if (!roleIds.includes(ROLE_IDS.HOSPITAL_ACCOUNT)) {
      throw new BusinessError(AuthErrorCode.FORBIDDEN, '仅医院账号可访问本院数据看板')
    }
    const ids = (await HospitalsRepository.accessibleHospitalIds(userId)).map((x: any) => x.hospitalId)
    if (!ids.length) {
      return { todayCount: 0, monthCount: 0, yearCount: 0, totalCount: 0, viewedCount: 0, unviewedCount: 0 }
    }
    // 医院账号只关联一家医院，取第一个
    return HospitalDashboardRepository.getStats(ids[0])
  }

  static async getUnviewedCount(userId: number, roleIds: ReadonlyArray<number>) {
    if (!roleIds.includes(ROLE_IDS.HOSPITAL_ACCOUNT)) {
      throw new BusinessError(AuthErrorCode.FORBIDDEN, '仅医院账号可查看')
    }
    const ids = (await HospitalsRepository.accessibleHospitalIds(userId)).map((x: any) => x.hospitalId)
    if (!ids.length) return { count: 0 }
    return { count: await HospitalDashboardRepository.getUnviewedCount(ids[0]) }
  }
}
```

### Step 5.5：实现 schema + 路由

```ts
// apps/yishan-api/src/modules/crm/schemas/hospital-dashboard.schema.ts
import { Type } from '@sinclair/typebox'

export const CrmHospitalDashboardRespSchema = Type.Object({
  todayCount: Type.Number(),
  monthCount: Type.Number(),
  yearCount: Type.Number(),
  totalCount: Type.Number(),
  viewedCount: Type.Number(),
  unviewedCount: Type.Number(),
}, { $id: 'crmHospitalDashboardResp' })

export const CrmHospitalUnviewedCountRespSchema = Type.Object({
  count: Type.Number(),
}, { $id: 'crmHospitalUnviewedCountResp' })
```

```ts
// apps/yishan-api/src/modules/crm/routes/v1/hospital-dashboard/index.ts
import type { FastifyPluginAsync } from 'fastify'
import { createRouteRegistrar } from '@/core/routes/route-registrar.js'
import { ResponseUtil } from '@/utils/response.js'
import { PERMS } from '../../../permissions.js'
import { HospitalDashboardService } from '../../../services/hospital-dashboard.service.js'
import { ROUTE_TAG } from '../../../schemas/routes.schema.js'

const hospitalDashboard: FastifyPluginAsync = async (app) => {
  const route = createRouteRegistrar(app)
  const uid = (req: any) => req.currentUser.id
  const roleIds = (req: any): number[] => req.currentUser?.roleIds ?? []

  route.get(
    '/hospital/dashboard/stats',
    {
      access: { permission: PERMS.HOSPITAL_DASHBOARD_VIEW },
      schema: {
        tags: [ROUTE_TAG],
        summary: '医院后台数据看板',
        operationId: 'getCrmHospitalDashboardStats',
      },
    },
    async (req: any, reply: any) => {
      const result = await HospitalDashboardService.getStats(uid(req), roleIds(req))
      return ResponseUtil.success(reply, result)
    },
  )

  route.get(
    '/hospital/dispatches/unviewed-count',
    {
      access: { permission: PERMS.DISPATCH_LIST },
      schema: {
        tags: [ROUTE_TAG],
        summary: '医院账号未查看派单数量（菜单 Badge 用）',
        operationId: 'getCrmHospitalUnviewedDispatchCount',
      },
    },
    async (req: any, reply: any) => {
      const result = await HospitalDashboardService.getUnviewedCount(uid(req), roleIds(req))
      return ResponseUtil.success(reply, result)
    },
  )
}

export default hospitalDashboard
```

并在 `apps/yishan-api/src/modules/crm/routes/v1/index.ts` 挂载（确认现有 index 怎么 mount，看一眼代码后追加）：

```ts
// append
import hospitalDashboard from './hospital-dashboard/index.js'
// 在 registeredRoutes 加 await app.register(hospitalDashboard)
```

### Step 5.6：跑测试 PASS

```bash
cd apps/yishan-api && pnpm test -- -t "HospitalDashboard"
```

### Step 5.7：commit

```bash
git add apps/yishan-api/src/modules/crm
git commit -m "feat(crm): hospital backend dashboard + unviewed badge APIs"
```

---

## Task 6: 前端派单列表/详情嵌入查看状态

**Files:**
- Modify: `apps/yishan-admin/src/modules/crm/pages/dispatches/index.tsx`
- Modify: `apps/yishan-admin/src/modules/crm/api/index.ts`

### Step 6.1：api/index.ts 追加 wrapper

```ts
export const getDispatchHospitalViewLogs = (id: number) =>
  request<any>(`/api/crm/v1/dispatches/${id}/hospital-view-logs`)
```

### Step 6.2：派单详情抽屉新增「医院查看状态」区块

在 `apps/yishan-admin/src/modules/crm/pages/dispatches/index.tsx` 详情区（ProDescriptions）下方追加一个 Descriptions 区块：

```tsx
<Divider>医院查看状态</Divider>
<ProDescriptions
  column={1}
  dataSource={hospitalViewLogs}
  request={async () => {
    const res: any = await getDispatchHospitalViewLogs(currentDispatch.id)
    if (res?.success) {
      return { success: true, data: res.data }
    }
    return { success: false, data: [] }
  }}
  columns={[
    { title: '医院名称', dataIndex: 'hospitalName' },
    { title: '查看状态', dataIndex: 'id', valueEnum: {
      '': { text: '未查看', status: 'Default' },
      viewed: { text: '已查看', status: 'Success' },
    }},
    { title: '首次查看时间', dataIndex: 'createdAt', valueType: 'dateTime' },
    { title: '查看账号', dataIndex: 'viewerUsername' },
    { title: 'IP', dataIndex: 'ipAddress' },
  ]}
/>
```

### Step 6.3：跑 tsc 验证

```bash
cd apps/yishan-admin && npx max setup && npx tsc --noEmit
```

期望：0 errors。

### Step 6.4：commit

```bash
git add apps/yishan-admin/src/modules/crm/pages/dispatches/index.tsx \
        apps/yishan-admin/src/modules/crm/api/index.ts
git commit -m "feat(crm-admin): dispatch detail shows hospital view status"
```

---

## Task 7: 前端医院数据看板页面

**Files:**
- Create: `apps/yishan-admin/src/modules/crm/pages/hospital-dashboard/index.tsx`
- Modify: `apps/yishan-admin/src/modules/crm/api/index.ts`

### Step 7.1：api/index.ts 追加

```ts
export const getHospitalDashboardStats = () =>
  request<any>('/api/crm/v1/hospital/dashboard/stats')
export const getHospitalUnviewedCount = () =>
  request<any>('/api/crm/v1/hospital/dispatches/unviewed-count')
```

### Step 7.2：创建页面

```tsx
// apps/yishan-admin/src/modules/crm/pages/hospital-dashboard/index.tsx
import React, { useEffect, useState } from 'react'
import { PageContainer } from '@ant-design/pro-components'
import { Card, Col, Row, Statistic, Spin } from 'antd'
import { getHospitalDashboardStats } from '@/modules/crm/api'

export default function HospitalDashboard() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    getHospitalDashboardStats()
      .then((res: any) => res?.success && setStats(res.data))
      .finally(() => setLoading(false))
  }, [])

  if (loading || !stats) return <Spin />

  const viewRate = stats.totalCount > 0
    ? ((stats.viewedCount / stats.totalCount) * 100).toFixed(1)
    : '0.0'

  return (
    <PageContainer header={{ title: '本院数据看板' }}>
      <Row gutter={16}>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="今日派单" value={stats.todayCount} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="本月派单" value={stats.monthCount} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="本年派单" value={stats.yearCount} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="累计派单" value={stats.totalCount} /></Card>
        </Col>
      </Row>
      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col xs={24} sm={8}>
          <Card><Statistic title="已查看" value={stats.viewedCount} valueStyle={{ color: '#3f8600' }} /></Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card><Statistic title="未查看" value={stats.unviewedCount} valueStyle={{ color: '#cf1322' }} /></Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card><Statistic title="查看率" value={viewRate} suffix="%" /></Card>
        </Col>
      </Row>
    </PageContainer>
  )
}
```

### Step 7.3：tsc

```bash
cd apps/yishan-admin && npx tsc --noEmit
```

### Step 7.4：commit

```bash
git add apps/yishan-admin/src/modules/crm/pages/hospital-dashboard/index.tsx \
        apps/yishan-admin/src/modules/crm/api/index.ts
git commit -m "feat(crm-admin): hospital backend dashboard page"
```

---

## Task 8: 重生成 OpenAPI

**Files:**
- Auto: `apps/yishan-admin/src/services/generated/crm.ts` + `typings.d.ts`
- Auto: `apps/yishan-api/openapi.json`

### Step 8.1：跑

```bash
cd apps/yishan-admin && pnpm openapi
```

### Step 8.2：检查 typings 含新 operationId

```bash
grep -E "listCrmDispatchHospitalViewLogs|getCrmHospitalDashboardStats|getCrmHospitalUnviewedDispatchCount" \
     apps/yishan-admin/src/services/generated/crm.d.ts
```

期望：3 个新名字都出现。

### Step 8.3：tsc

```bash
cd apps/yishan-admin && npx tsc --noEmit
```

### Step 8.4：commit

```bash
git add apps/yishan-admin/src/services/generated apps/yishan-api/openapi.json
git commit -m "chore(openapi): regenerate crm client after view-tracking"
```

---

## Task 9: 菜单配置（sys_menu + 角色权限种子）

**Files:**
- Modify: `apps/yishan-api/src/modules/crm/seed.ts` 或 `apps/yishan-api/src/modules/crm/config/system-menu.json`（按仓库实际结构）
- Test: 无（seed 跳过测试）

### Step 9.1：看 seed.ts 当前结构

```bash
ls apps/yishan-api/src/modules/crm/seed.ts apps/yishan-api/src/modules/crm/config/ 2>&1
```

### Step 9.2：追加 sys_menu 行

按现有模式（`path: '/crm/hospital-dashboard'`, `component: './modules/crm/hospital-dashboard'`, `permission: 'crm:hospital-dashboard:view'`）。

### Step 9.3：追加权限种子

在 `seed.ts` 给 `hospital_account` 角色加 `crm:hospital-dashboard:view` 权限；给 `super_admin` 角色加 `crm:dispatches:view-hospital-log`。

### Step 9.4：跑 seed 验证（dev DB）

```bash
pnpm --filter yishan-api db:seed
```

期望：seed 不报错；新 sys_menu 行 + sys_role_permission 关系存在。

### Step 9.5：commit

```bash
git add apps/yishan-api/src/modules/crm
git commit -m "feat(crm): seed hospital-dashboard menu + view-log permissions"
```

---

## Task 10: 菜单 Badge 轮询

**Files:**
- Find & modify: 现有 Layout 文件（`apps/yishan-admin/src/layouts/...` 或 `apps/yishan-admin/src/app.tsx` 或 menu component）

### Step 10.1：找菜单组件

```bash
grep -rn "badgeKey\|menuData\|siderMenu" apps/yishan-admin/src/layouts apps/yishan-admin/src/app.tsx 2>/dev/null | head -10
```

### Step 10.2：注入未查看 count 轮询

在菜单组件（通常在 Layout / sider）中，对 `hospital_account` 角色调用 `getHospitalUnviewedCount()` 60s 一次，把结果绑定到 `/crm/dispatches` 菜单项的 badge。

具体代码需看实际 menu 数据结构（Plan Step 10.1 探测后补完）。

### Step 10.3：tsc + commit

```bash
cd apps/yishan-admin && npx tsc --noEmit
git commit -m "feat(crm-admin): hospital menu badge shows unviewed dispatch count"
```

---

## Task 11: 质量门

### Step 11.1：lint

```bash
pnpm lint
```

### Step 11.2：test

```bash
pnpm --filter yishan-admin test
pnpm --filter yishan-api test
```

### Step 11.3：admin build

```bash
pnpm --filter yishan-admin build
```

### Step 11.4：commit（如果产生 diff）

---

## Self-Review

- **Spec coverage**：①view_log 自动留痕 (T1+T2+T3)、②总后台查看日志 (T4)、③医院数据看板 (T5+T7)、④未查看 Badge (T5+T10)、⑤菜单配置 (T9)
- **No Placeholder**：无 TBD；Task 10 Step 10.2 需先探测 menu 实际结构再补
- **Type consistency**：所有 crmHospitalDashboardRespSchema / crmDispatchViewLogRespSchema / crmHospitalUnviewedCountRespSchema 命名在 T4/T5 内一致
- **Scope**：单 plan，11 个 task 可在一次 subagent-driven-development 周期完成
