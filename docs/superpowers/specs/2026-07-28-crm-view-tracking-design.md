# Phase B 设计文档：医院查看顾客状态全流程

> 日期：2026-07-28
> 范围：用户原话 6 项中第 4-6 项 = 完整业务闭环
> 依赖：Phase A 已落地（医院账号一院一账号 + dry-run 修复脚本 + OpenAPI 同步）
> 不在本 spec：医院账号的其它功能（账号启停 / 重置密码 / 改名）— 已有 HOSPITAL_ACCOUNT_MANAGE 权限

## 0. 业务闭环

```
总后台派单（customService.dispatch）
    ↓
crm_dispatch 创建（status='未查看'）
    ↓
医院后台看到新派单（hospital_account 登录后）
    ↓
默认显示「未查看订单数量」徽章（菜单 Badge + 概览卡片）
    ↓
医院点击派单 / 小眼睛查看详情
    ↓
第一次打开详情 → 自动写 crm_dispatch_view_log
    ↓
医院后台「未查看数量 -1」
    ↓
总后台同步展示（派单详情中显示该医院的查看状态）
    ↓
总后台可以查看该派单的医院查看日志（医院名称 / 状态 / 首次时间 / 账号）
```

## 1. In-scope / Out-of-scope

### In-scope
- 新增实体 `crm_dispatch_view_log`（派单 × 医院 × 查看状态 × 时间 × 账号）
- 派单路由增强：GET /dispatches/:id 在 hospital_account 角色下首次进入时自动落日志
- 派单列表增强：返回 `viewedAt` / `viewedBy` 字段（已软删过滤）
- 派单详情 / 列表响应嵌入「该医院是否已查看」标志
- 总后台派单详情：嵌套展示「各医院的查看状态」表
- 医院后台数据看板：`/crm/hospital-dashboard`（今日/本月/本年度/累计派单 + 已查看 / 未查看 / 查看率）
- 医院后台菜单 Badge：派单菜单 Badge 显示「未查看订单数量」
- 权限分离：
  - `crm:dispatches:view` — 派单-查看（已有，扩展语义）
  - `crm:dispatches:view-hospital-log` — 总后台-查看派单医院查看日志
  - `crm:hospital-dashboard:view` — 医院后台-查看本院数据看板

### Out-of-scope
- 医院账号对其它医院的访问（明确禁止，HOSPITAL scope 硬约束）
- 实时推送（用 GET 轮询，不引入 WebSocket）
- 移动端
- 数据看板图表（Phase C+）
- 跟进 / 成交 / 复购等业务指标（spec §5.2 列了 follow-up）

## 2. 关键约束

- `crm_dispatch_view_log` 表名前缀 `crm_`（module naming 硬约束）
- 表结构须与模块内 `crmCustomerBrowse` / `crmDispatchMobileViewLog` 风格一致
- 不动 Drizzle 模块 schema 的核心迁移；新表可走 `drizzle-kit generate` 生成 SQL
- 路由前缀 `/api/crm/v1/...` 不变
- 现有路由 operationId 不变（避免 breaking change）；新增路由用 `listCrmDispatchViewLogs` / `getCrmHospitalDashboard` / `getCrmDispatchHospitalViewSummary` 等命名
- 不得跨模块读 / 写 sys_user / sys_role 表
- 不引入 WebSocket / Redis Pub/Sub
- Hospital scope 在 repository 层强约束：service 透传 `scope` 参数，repository 接受 `DataScopeCode`（HOSPITAL）并自动 WHERE `hospital_id = currentUserAccessibleHospitalIds[0]`
- 不创建新 sys_user / sys_role 关系
- 仪表板查询走 SQL aggregate，不用 OR/Mongo 一类复杂 join

## 3. 数据模型

### 3.1 新表 `crm_dispatch_view_log`

```ts
// apps/yishan-api/src/modules/crm/db/schema.ts 追加
export const crmDispatchViewLog = mysqlTable('crm_dispatch_view_log', {
  id: int().primaryKey().autoincrement().notNull(),
  dispatchId: int('dispatch_id').notNull(),
  hospitalId: int('hospital_id').notNull(),  // 冗余：避免 dispatch 删/换医院时丢失归属
  viewerUserId: int('viewer_user_id').notNull(),
  viewerUsername: varchar('viewer_username', { length: 100 }).notNull(),
  viewerHospitalName: varchar('viewer_hospital_name', { length: 100 }),
  ipAddress: varchar('ip_address', { length: 64 }),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
}, (t) => [
  uniqueIndex('uniq_crm_dispatch_view_log_dispatch_hospital_user')
    .on(t.dispatchId, t.hospitalId, t.viewerUserId),  // 每家医院每账号每个派单只能"首次"记录
  index('idx_crm_dispatch_view_log_dispatch').on(t.dispatchId),
  index('idx_crm_dispatch_view_log_hospital').on(t.hospitalId),
  index('idx_crm_dispatch_view_log_created').on(t.createdAt),
])
```

**关键设计点**：
- UNIQUE `(dispatch_id, hospital_id, viewer_user_id)`：第一次打开派单详情时 INSERT ON DUPLICATE KEY DO NOTHING 即可保证幂等
- `hospital_id` 冗余：避免派单因医院改名/转移账号时丢失审计链
- 删派单时不动 view_log（审计留存）；如果未来需要 GDPR 删除再加 `deleted_at`

### 3.2 不动 crm_dispatch 表

派单已有 `statusId`（状态机可表达「未查看」），但状态机当前不区分「未查看 vs 已查看」（业务上仍是同一阶段「待处理」）。**不引入新状态**。已查看状态用 `crm_dispatch_view_log` 表达，避免状态机复杂度。

## 4. 路由设计

### 4.1 新增路由

```ts
// GET /api/crm/v1/dispatches/:id/hospital-view-status
// 角色：super_admin / admin
// 权限：crm:dispatches:view-hospital-log
// 返回：{ hospitalId, hospitalName, viewed: bool, firstViewedAt, firstViewedBy }

// GET /api/crm/v1/dispatches/:id/hospital-view-logs
// 角色：super_admin / admin
// 权限：crm:dispatches:view-hospital-log
// 返回：Array<{ hospitalId, hospitalName, viewed, firstViewedAt, firstViewedBy, viewerUserId, viewerUsername, ip }>
// 用途：派单详情嵌入「医院查看状态」表格

// GET /api/crm/v1/hospital/dashboard/stats
// 角色：hospital_account
// 权限：crm:hospital-dashboard:view
// 范围：HOSPITAL scope（自动 WHERE hospital_id = currentUser.hospital_id）
// 返回：{ todayDispatches, monthDispatches, yearDispatches, totalDispatches, viewedCount, unviewedCount, viewRate, followedCount, closedCount }

// GET /api/crm/v1/hospital/dispatches/unviewed-count
// 角色：hospital_account
// 权限：crm:dispatches:list
// 范围：HOSPITAL scope
// 返回：{ count: number }
// 用途：菜单 Badge 轮询（建议 60s 间隔）
```

### 4.2 增强现有路由

```ts
// GET /api/crm/v1/dispatches/:id
// 行为变更：hospital_account 角色首次访问时，INSERT crm_dispatch_view_log（同事务）
// 响应体增强：所有角色多带一个 `viewedByCurrentUser: bool` 字段

// GET /api/crm/v1/dispatches
// 列表响应增强：每行多带 `viewedByCurrentUser: bool` + `viewedAt: ISO | null`（HOSPITAL scope 时表示本院是否已查看）
// super_admin / admin 列表响应多带 `hospitalViewStatuses: [{ hospitalId, hospitalName, viewed, firstViewedAt, firstViewedBy }]`
```

### 4.3 operationId 命名

- `listCrmDispatchHospitalViewLogs` / `getCrmDispatchHospitalViewStatus` — 派单 × 医院查看
- `getCrmHospitalDashboardStats` — 医院后台数据看板
- `getCrmHospitalUnviewedDispatchCount` — 未查看徽章

## 5. 权限模型

### 5.1 新增权限（追加到 `apps/yishan-api/src/modules/crm/permissions.ts`）

```ts
DISPATCH_HOSPITAL_VIEW_LOG: { code: 'crm:dispatches:view-hospital-log', label: 'CRM-派单-查看医院查看日志', group: 'crm' },
HOSPITAL_DASHBOARD_VIEW: { code: 'crm:hospital-dashboard:view', label: 'CRM-医院后台-数据看板', group: 'crm' },
HOSPITAL_UNVIEWED_BADGE: { code: 'crm:dispatches:list', label: 'CRM-医院后台-未查看徽章', group: 'crm' },  // 复用 DISPATCH_LIST
```

### 5.2 数据作用域

- `super_admin` / `admin`（dataScope=ALL）：看全部派单 + 全部医院的查看状态
- `hospital_account`（dataScope=HOSPITAL）：仅看 `crm_hospital.account_user_id = currentUser.id` 那家医院的派单
- 不支持 `OWN` 范围（医院的 customer_service 不涉及派单查看）

### 5.3 路由 preHandler 显式权限检查

`/hospital/*` 子路由前缀使用 `crm:hospital-dashboard:view` 权限；其它派单路由对 hospital_account 角色做特殊 scope 注入（在 service 层）。

## 6. Repository / Service 设计

### 6.1 `DispatchesService.getById(id, scope, userId)`

- 如果 `scope === HOSPITAL`：自动 WHERE `hospital_id = currentUserHospitalId`
- 如果 hospital_account 首次访问（`crm_dispatch_view_log` 中无当前 user 对当前 dispatch 的记录）：INSERT ON DUPLICATE KEY DO NOTHING + 写 ipAddress from req.ip
- 响应体增加 `viewedByCurrentUser: bool`

### 6.2 `DispatchesService.list(query, scope, userId)`

- 列表 SQL 加 LEFT JOIN `crm_dispatch_view_log`（按 hospital_id 过滤）
- super_admin / admin 路径额外 LEFT JOIN 出每个派单的多家医院查看状态

### 6.3 `HospitalDashboardService.getStats(userId, scope)`

- aggregate 4 个时间桶：今日 / 本月 / 本年度 / 累计
- 4 个统计指标：viewed / unviewed / viewRate / followed / closed
- 全部用 SQL aggregate（GROUP BY / COUNT / SUM），不拉全量到 JS

### 6.4 `DispatchesService.getUnviewedCount(userId, scope)`

- 1 行 SQL：SELECT COUNT(*) FROM crm_dispatch d LEFT JOIN crm_dispatch_view_log v ON v.dispatch_id = d.id AND v.hospital_id = ? AND v.viewer_user_id = ? WHERE d.hospital_id = ? AND d.deleted_at IS NULL AND v.id IS NULL
- 用途：Badge 轮询，60s 间隔

## 7. 前端

### 7.1 新增 / 增强页面

| 路径 | 角色 | 改动 |
| --- | --- | --- |
| `/crm/dispatches` (列表) | 全部 | 每行多展示「本院已查看 / 未查看」Tag（hospital_account 视角） + 总后台多展示「医院查看状态」列 |
| `/crm/dispatches/:id` (详情) | 全部 | 嵌入「医院查看状态表格」组件（总后台视角） |
| `/crm/hospital-dashboard` (新增) | hospital_account | 4 张指标卡 + 4 个时间桶；访问受限 403 |
| `/crm/members` (派单相关) | 全部 | 不变 |

### 7.2 菜单 Badge

- `sys_menu` 配「派单管理」节点 `badge_key=crm_dispatches_unviewed_count`
- 前端 Layout 组件轮询 `/api/crm/v1/hospital/dispatches/unviewed-count`（60s 间隔）
- 当 `currentUser.roles` 含 `hospital_account` 时启用轮询；其它角色不轮询

### 7.3 路由注入

新页面 `/crm/hospital-dashboard` 走 Layer 2 动态路由（CLAUDE.md 架构 §架构：admin 路由系统）：
- `plugin.ts` 自动扫描 `src/modules/crm/pages/hospital-dashboard/index.tsx`，生成 `moduleComponentsMap` key `./modules/crm/hospital-dashboard`
- `sys_menu` 加一行：`{ path: '/crm/hospital-dashboard', component: './modules/crm/hospital-dashboard', permission: 'crm:hospital-dashboard:view' }`
- 不需要改 `config/routes.ts`

## 8. 数据迁移

### 8.1 Drizzle 迁移

```bash
cd apps/yishan-api/src/modules/crm
npx drizzle-kit generate --config=./drizzle.config.ts  # 生成 0004_xxx.sql
npx drizzle-kit migrate --config=./drizzle.config.ts
```

新 SQL 大致：
```sql
CREATE TABLE crm_dispatch_view_log (
  id INT PRIMARY KEY AUTO_INCREMENT NOT NULL,
  dispatch_id INT NOT NULL,
  hospital_id INT NOT NULL,
  viewer_user_id INT NOT NULL,
  viewer_username VARCHAR(100) NOT NULL,
  viewer_hospital_name VARCHAR(100),
  ip_address VARCHAR(64),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_crm_dispatch_view_log_dispatch_hospital_user (dispatch_id, hospital_id, viewer_user_id),
  INDEX idx_crm_dispatch_view_log_dispatch (dispatch_id),
  INDEX idx_crm_dispatch_view_log_hospital (hospital_id),
  INDEX idx_crm_dispatch_view_log_created (created_at)
);
```

### 8.2 旧数据回填

无（Phase B 是新功能，view_log 不需要历史回填）

### 8.3 权限种子

`apps/yishan-api/src/modules/crm/seed.ts` 追加 `crm:dispatches:view-hospital-log` 给 `super_admin`；`crm:hospital-dashboard:view` 给 `hospital_account` 角色。

## 9. 验收

- 总后台派单 → 医院账号看到新派单 → 菜单 Badge 显示「12」 → 点开详情 → Badge 减 1 → 总后台派单详情显示「A 医院 已查看 08-20 10:32」
- A 医院只看到自己的派单，看不到 B / C 医院的派单
- 同一医院账号重复打开同一派单，不重复写日志（UNIQUE 约束兜底）
- 数据看板 4 张卡全部能正确反映「本院」数据，切换到 B 医院账号后数字不同
- 总后台可以查看派单的医院查看日志（医院名 + 时间 + 账号）

## 10. Spec 自审

- **Placeholder 扫描**：无 TBD / TODO / 模糊词
- **内部一致性**：
  - 权限 §5 与路由 §4 路由前缀对齐（`/hospital/*` / `/dispatches/*`）
  - Repository §6 与路由 §4 响应体增强对齐（`viewedByCurrentUser` / `hospitalViewStatuses`）
- **范围**：单 Phase B 计划可执行（schema + repo + service + route + 前端 + 权限种子 + 迁移 SQL），1 个 spec
- **歧义**：「未查看」=「该医院未在该派单详情中留痕」，明确

## 11. 不在 Phase B 内的 TODO（移交 Phase C）

- 跟进 / 成交 / 复购等业务指标（spec §6.3 留了 followedCount / closedCount 但本 spec 只做 viewed/unviewed/viewRate 三个）
- 图表组件（图表库选型）
- 实时推送（WebSocket / SSE）
- 总后台「医院业绩排行」
- 数据看板筛选维度（按品类 / 区域）

## 12. 风险与回退

- 路由增强（GET /dispatches/:id 自动写日志）— 如果出问题，移除 INSERT 调用即可
- 数据看板 aggregate SQL — 体量小时性能可接受
- UNIQUE 约束不删除已有 view_log — 即使未来需要重新处理也是 INSERT 新的记录

---

**Spec 结束。** 等待 user review。
