# 医院后台问题修复与看板新增 — 实施计划

日期：2026-09-01
范围：iximei-kf CRM 模块（apps/yishan-admin / apps/yishan-api/src/modules/crm/）

## 总览

8 项问题分两类：

| # | 类型 | 文件 | 说明 |
|---|------|------|------|
| 1 | 角色感知渲染 | `apps/yishan-admin/src/modules/crm/pages/hospitals/index.tsx` | hospital_account 隐藏 ID 列、状态切换、详情头部 |
| 2 | 角色感知渲染 | `apps/yishan-admin/src/modules/crm/pages/dispatches/index.tsx` | hospital_account 隐藏派单 ID 列 |
| 3 | 数据权限 | `apps/yishan-api/src/modules/crm/services/customers.service.ts` | hospital_account 顾客订单查询 scope 修复 |
| 4 | UI 迁移 | `apps/yishan-admin/src/modules/crm/pages/dispatches/index.tsx` + `hospital-dashboard/index.tsx` | 把"医院查看状态"从派单详情移到医院后台首页 |
| 5 | 角色感知渲染 | `apps/yishan-admin/src/pages/account/center/index.tsx` | hospital_account 隐藏"安全设置/修改密码"Tab |
| 6 | 业务逻辑 | `apps/yishan-api/src/modules/crm/repositories/hospital-dashboard.repository.ts` | unviewedCount 排除已处理派单 |
| 7 | 新功能 | 后端 schema/repo/service/route + 前端组件 | 总后台 dashboard 新增"医院分布看板"（按城市） |
| 8 | DB 迁移 | `apps/yishan-api/src/modules/crm/db/schema.ts` + drizzle 迁移 | 新增 `crm_hospital.category` 字段（oral/plastic/both/null） |

### 角色识别

```ts
// 共享 helper：apps/yishan-admin/src/utils/role.ts (新建)
import { useModel } from '@umijs/max';
export const ROLE_CODES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  HOSPITAL_ACCOUNT: 'hospital_account',
  CUSTOMER_SERVICE: 'customer_service',
} as const;
export function useCurrentRoleCodes(): string[] {
  const { initialState } = useModel('@@initialState');
  return initialState?.currentUser?.roleCodes ?? [];
}
export function useIsHospitalAccount(): boolean {
  return useCurrentRoleCodes().includes(ROLE_CODES.HOSPITAL_ACCOUNT);
}
```

> 后端权限码与前端 `currentUser.roleCodes` 同步，源在 `apps/yishan-api/src/core/plugins/external/rbac.ts`（已在响应里写入 roleIds / roleCodes）。

---

## 任务 1：医院管理列表/详情对 hospital_account 隐藏 ID 与状态切换

**文件**：`apps/yishan-admin/src/modules/crm/pages/hospitals/index.tsx`

### 改动

1. 在文件顶部 import `useIsHospitalAccount`：
   ```ts
   import { useIsHospitalAccount } from '@/utils/role';
   ```

2. 在组件内：
   ```ts
   const isHospitalAccount = useIsHospitalAccount();
   ```

3. **列表表格 ID 列**（line 209 附近）：
   - 当前：`{ title: 'ID', dataIndex: 'id', search: false, width: 72 }`
   - 改为条件渲染：`...(isHospitalAccount ? [] : [{ title: 'ID', dataIndex: 'id', search: false, width: 72 }])`

4. **编辑表单医院状态字段**（line 446 附近）：
   - 当前：`<Form.Item name="status" label="医院状态">`
   - 改为：用 `<>{!isHospitalAccount && <Form.Item ... />}</>` 包裹

5. **详情 Descriptions 头部 ID**（如有 hospital ID 显示）：
   - 查找页面内的 Descriptions / Descriptions.Item 中含 `id` 或 `编号` 的项
   - 改为按角色条件渲染

6. **账号列表 status 列**（line 686 附近，`value={account.status === 1 ? '启用' : '停用'}`）：
   - 如果 hospital_account 进入账号列表：保留 read-only 显示即可，不要给状态切换按钮
   - 检查 line 725 附近 `<Select>` 是否启用，hospital_account 下禁用 `disabled`

### 验证

- `pnpm --filter yishan-admin lint` 通过
- 浏览器手动登录 hospital_account 账号进 `/crm/hospitals`，确认 ID 列、状态 Select 不出现
- super_admin 账号保留所有功能

---

## 任务 2：派单管理列表对 hospital_account 隐藏 ID

**文件**：`apps/yishan-admin/src/modules/crm/pages/dispatches/index.tsx`

### 改动

1. 顶部 import `useIsHospitalAccount`

2. 找到 ID 列定义（搜索 `dataIndex: 'id'`）

3. 条件渲染：`...(isHospitalAccount ? [] : [{ title: 'ID', ... }])`

### 验证

- 浏览器：hospital_account 进 `/crm/dispatches`，列表无 ID 列
- super_admin 保留

---

## 任务 3：hospital_account 顾客订单权限修复

**根因**：截图显示 hospital_account 进顾客订单页面（实际是 `/crm/dispatches`）提示"权限不足"。这是浏览器全局 25005 handler 触发。

**可能原因**：
- 路由 `/crm/dispatches` 在菜单里存在（`system-role-menu.ts:72` 已包含 `/crm/dispatches`），但 hospital_account 缺少 `crm:dispatches:list` 权限码
- 或者 `hospital-dashboard` 的 `getUnviewedCount` 在菜单 Badge 渲染时拦截（menu request 加 `HOSPITAL_DASHBOARD_VIEW` perm 检查）

**文件**：
- `apps/yishan-api/src/scripts/seed/modules/system-role-permission.ts`（角色权限种子）
- `apps/yishan-api/src/modules/crm/services/customers.service.ts`（如果范围确实在 customers）

### 调查步骤

1. 读 `system-role-permission.ts` 完整内容，看 hospitalAccount 的 perm 白名单是否含 `crm:dispatches:list` / `crm:hospital-dashboard:view` / `crm:hospitals:list`
2. 用 `getRolePermissions(ROLE_IDS.HOSPITAL_ACCOUNT)` 在 admin 后端脚本查实际权限码
3. 复现：hospital_account 登录后访问 `/crm/dispatches` 看具体 25005 / 25001 错误码
4. 在 permission.ts 种子文件 `hospitalAccountCodes` 加上缺失的 perm，重新 seed

### 修复方案

如果是权限缺失：

```ts
// apps/yishan-api/src/scripts/seed/modules/system-role-permission.ts
// 找到 hospitalAccountCodes 过滤逻辑，添加缺失 perm
const hospitalAccountCodes = allCodes.filter((code) =>
  code.startsWith('crm:dispatches:') ||
  code.startsWith('crm:hospital-dashboard:') ||
  code.startsWith('crm:hospitals:list') ||
  // 现有白名单
)
```

如果是 customers service 范围问题（如果 dispatch 详情里调 customer 详情）：

`apps/yishan-api/src/modules/crm/services/customers.service.ts` 增加 hospital scope：

```ts
// 在 getById / list 中按 roleIds 区分
function hospitalScopeFor(roleIds: number[], userId: number): number[] | undefined {
  if (!roleIds.includes(ROLE_IDS.HOSPITAL_ACCOUNT)) return undefined
  // 通过 accessibleHospitalIds 找出关联医院涉及的所有 customerId
  // 用 dispatchedCustomerIds(hospitalIds) 返回数组
  return await dispatchedCustomerIds(hospitalIds)
}
```

### 验证

- 在 api 端 vitest：构造 hospital_account token 调 `/api/crm/dispatches`，期望 200 而非 403
- 浏览器：hospital_account 进 `/crm/dispatches` 看到列表（手机号脱敏），点击详情可进

---

## 任务 4："医院查看状态" UI 迁移到医院后台首页

**当前位置**：`apps/yishan-admin/src/modules/crm/pages/dispatches/index.tsx` line 488-529（派单详情内）

**目标位置**：`apps/yishan-admin/src/modules/crm/pages/hospital-dashboard/index.tsx` 新增"我的查看记录"卡片

### 改动

1. **后端**（如果需要）：现有 `/dispatches/:id/hospital-view-logs` 是单派单的；新增 `/hospital-dashboard/my-viewed-dispatches` 返回该医院账号最近查看的 N 条派单 + 时间
   - 文件：`apps/yishan-api/src/modules/crm/routes/v1/hospital-dashboard/index.ts`
   - service：在 `hospital-dashboard.service.ts` 加 `getMyRecentViews(userId, roleIds, limit)`
   - repository：在 `hospital-dashboard.repository.ts` 加 `getRecentViews(hospitalIds, viewerUserId, limit)`，按 `crm_dispatch_view_log.createdAt DESC LIMIT N`
   - schema：在 `hospital-dashboard.schema.ts` 加 `CrmRecentViewItem` TypeBox

2. **派单详情**：`apps/yishan-admin/src/modules/crm/pages/dispatches/index.tsx`
   - 删除 line 488-529（"医院查看状态"段）
   - 删除 line 231 `hospitalViewLogs` state
   - 删除 line 500 的 `getDispatchHospitalViewLogs` 调用

3. **医院后台首页**：`apps/yishan-admin/src/modules/crm/pages/hospital-dashboard/index.tsx`
   - 新增组件 `RecentViewedDispatchesCard`，拉新接口 `/hospital-dashboard/my-viewed-dispatches`
   - 表格列：客户姓名 | 派单编号 | 首次查看时间 | 操作（查看详情）
   - 用 `useIsHospitalAccount` 控制：只有 hospital_account 显示，super_admin 默认不显示（或作为"全部医院查看总览"）
   - 添加到 dashboard layout（参考 `HospitalRankingCard` 模式）

### 验证

- 浏览器：hospital_account 进 `/crm/hospital-dashboard`，看到"我最近查看的派单"
- 派单详情不再有"医院查看状态"段
- super_admin 仍可在派单详情看到（保留 `getDispatchHospitalViewLogs` 路由，仅前端移除显示）

---

## 任务 5：个人中心 hospital_account 隐藏修改密码

**文件**：`apps/yishan-admin/src/pages/account/center/index.tsx`

### 改动

1. 顶部 import `useIsHospitalAccount`

2. `tabList` useMemo 增加条件（line 753-782）：
   ```ts
   const isHospitalAccount = useIsHospitalAccount();
   // ...
   const tabList = useMemo(() => [
     { value: 'profile', label: '...' },
     // 安全设置 tab 仅非医院账号可见
     ...(isHospitalAccount ? [] : [{ value: 'security', label: '...' }]),
     // API Token tab 仅 super_admin / 管理员可见（已有 canManageApiTokens）
   ], [canManageApiTokens, isHospitalAccount, intl])
   ```

3. `Center` 组件渲染分支（line 887）：
   ```ts
   {tab === 'security' && !isHospitalAccount ? (
     <SecurityPanel intl={intl} />
   ) : canManageApiTokens ? (
     <ApiTokenPanel intl={intl} />
   ) : null}
   ```

4. 防止 deep link：`/account/center` 默认 tab 在 hospital_account 下强制设为 `'profile'`：
   ```ts
   const [tab, setTab] = useState<TabKey>('profile');
   useEffect(() => {
     if (isHospitalAccount && tab === 'security') setTab('profile');
   }, [isHospitalAccount, tab]);
   ```

### 验证

- 浏览器：hospital_account 进 `/account/center`，tab 只有"个人资料"
- super_admin / admin 仍有"安全设置"+"API Token"

---

## 任务 6：未查看派单数排除已处理

**根因**：`HospitalDashboardRepository.getUnviewedCount` / `getStats.unviewedCount` 仅检查 `crm_dispatch_view_log.id IS NULL`，没考虑派单本身 status。

**业务定义**：派单 status_id 对应 `crm_dispatch_status` 表里的"已处理/已完成"状态 = 派单流程完结，无需再提醒医院。

### 调查

1. 读 `apps/yishan-api/src/modules/crm/drizzle/0000_init.sql` 看 `crm_dispatch_status` 种子状态
2. 读 `apps/yishan-api/src/modules/crm/repositories/dispatches.repository.ts` 看 `ensureDefaultStatuses` 写了哪些 status
3. 找"已处理/已完成"对应的 `status.id`（推测：name 含"完成"或"已回复"，可能是 id=2 或 id=3）

### 修复

**文件**：`apps/yishan-api/src/modules/crm/repositories/hospital-dashboard.repository.ts`

1. 引入 `crmDispatchStatus`：
   ```ts
   import { crmDispatch, crmDispatchStatus, crmDispatchViewLog } from '../db/schema.js'
   ```

2. 新增 helper：查"已处理"状态 ID 列表
   ```ts
   async function getCompletedStatusIds(): Promise<number[]> {
     const rows = await drizzleDb
       .select({ id: crmDispatchStatus.id })
       .from(crmDispatchStatus)
       .where(sql`${crmDispatchStatus.name} IN ('已完成', '已处理', '完成')`)
     return rows.map(r => r.id)
   }
   ```
   > 缓存到 module-scope Map，因为状态字典变动不频繁。

3. `getUnviewedCount` 增加 `NOT IN (completedStatusIds)` 过滤：
   ```ts
   .where(and(
     sql`${crmDispatch.hospitalId} IN (...)`,
     active(crmDispatch),
     sql`${crmDispatchViewLog.id} IS NULL`,
     completedIds.length > 0 ? sql`${crmDispatch.statusId} NOT IN (${sql.join(completedIds.map(id => sql`${id}`), sql`, `)})` : undefined,
   ))
   ```

4. 同样改 `getStats` / `getTrend` 的 `unviewedCount` / `statusBreakdown.unviewed`：
   - `viewedCount` 语义：派单已被任一医院账号查看过
   - `unviewedCount` 语义：派单既未被查看 AND 未处于已处理状态
   - 在 `getTrend.statusBreakdown` 同样应用

5. 写测试：`apps/yishan-api/src/modules/crm/tests/hospital-dashboard.repository.test.ts`
   - mock 一个 completed 状态的派单 + 一个未完成的派单 + 一个 view_log
   - 验证 unviewedCount 只算未完成的

### 验证

- 浏览器：hospital_account 进 dashboard，已处理的派单不再计入"未查看"
- vitest：`pnpm --filter yishan-api test hospital-dashboard`

---

## 任务 7：医院分布看板（按城市）

**目标**：总后台 dashboard `/crm/dashboard` 增加"医院分布看板"组件，按城市分组显示「口腔医院数 / 整形医院数」。

### 7.1 DB 迁移

**文件**：
- `apps/yishan-api/src/modules/crm/db/schema.ts`
- 新建 `apps/yishan-api/src/modules/crm/drizzle/0003_hospital_category.sql`
- 更新 `apps/yishan-api/src/modules/crm/drizzle/meta/_journal.json` + `0003_snapshot.json`

**新增字段**：
```ts
// 在 crmHospital 表增加
category: varchar('category', { length: 20 }), // 'oral' | 'plastic' | 'both' | null
```

**SQL 迁移**：
```sql
ALTER TABLE crm_hospital ADD COLUMN category VARCHAR(20) DEFAULT NULL;
-- 历史数据回填（可选）：根据 customer.plastic 推断
UPDATE crm_hospital h
SET category = CASE
  WHEN EXISTS (
    SELECT 1 FROM crm_customer c
    JOIN crm_dispatch d ON d.customer_id = c.id
    WHERE d.hospital_id = h.id AND c.plastic LIKE '%种植牙%'
  ) THEN 'oral'
  ELSE 'plastic'
END;
```

### 7.2 后端

**文件**：
- `apps/yishan-api/src/modules/crm/schemas/dashboard.schema.ts`：新增 `CrmHospitalDistributionRespSchema`
- `apps/yishan-api/src/modules/crm/repositories/dashboard.repository.ts`：新增 `getHospitalDistributionByCity()`
- `apps/yishan-api/src/modules/crm/services/dashboard.service.ts`：在 `getStats` 返回加 `hospitalDistribution: { items: [...], generatedAt }`
- `apps/yishan-api/src/modules/crm/routes/v1/dashboard/index.ts`：无需新增 route，复用 `getStats`

**Repository SQL**（按 city 分组聚合）：
```sql
SELECT
  province.code AS province_code, province.name AS province_name,
  city.code AS city_code, city.name AS city_name,
  SUM(CASE WHEN h.category = 'oral' THEN 1 ELSE 0 END) AS oral_count,
  SUM(CASE WHEN h.category = 'plastic' THEN 1 ELSE 0 END) AS plastic_count,
  COUNT(*) AS total
FROM crm_hospital h
LEFT JOIN sys_region city ON h.city_id = city.code
LEFT JOIN sys_region province ON h.province_id = province.code
WHERE h.deleted_at IS NULL
GROUP BY city.code, city.name, province.code, province.name
ORDER BY total DESC
```

**Schema**（TypeBox）：
```ts
export const CrmHospitalDistributionItem = Type.Object({
  provinceCode: Type.Integer(),
  provinceName: Type.String(),
  cityCode: Type.Integer(),
  cityName: Type.String(),
  oralCount: Type.Integer(),
  plasticCount: Type.Integer(),
  total: Type.Integer(),
})
export const CrmHospitalDistributionRespSchema = Type.Object({
  generatedAt: Type.String(),
  items: Type.Array(CrmHospitalDistributionItem),
})
```

### 7.3 前端

**新建文件**：`apps/yishan-admin/src/modules/crm/pages/dashboard/components/HospitalDistributionCard.tsx`

**Props**：
```ts
interface Props {
  data: HospitalDistributionItem[];
  loading?: boolean;
}
```

**UI**：
- ProCard 标题"医院分布看板"
- 双 Tab：「柱状图」/「明细表」
- 柱状图：横轴 = 城市（top 20），纵轴 = 双 series（口腔医院 / 整形医院），用 antd Charts Bar
- 明细表：列 = 省份 | 城市 | 口腔医院数 | 整形医院数 | 总数，按 total DESC
- 数据为空：Empty "暂无医院数据"

**集成**：在 `dashboard/index.tsx` 加新组件位置（在 `HospitalRankingCard` 下方），使用 `useModel` + `initialState.currentUser` 判断 `isSuperAdmin`：
- super_admin 显示全部
- 其他角色降级为占位卡片

**类型扩展**：`apps/yishan-admin/src/modules/crm/pages/dashboard/types.ts` 新增 `HospitalDistributionItem`

**OpenAPI 重新生成**：
```bash
cd apps/yishan-admin && pnpm openapi
```
确保新 schema 生成到 `services/generated/crm.ts`。

### 7.4 验证

- DB 迁移成功，category 字段已添加
- `pnpm --filter yishan-api db:migrate`
- `pnpm --filter yishan-api test` 通过
- `pnpm --filter yishan-admin lint` 通过
- 浏览器：super_admin 进 `/crm/dashboard`，看到"医院分布看板"组件，按城市展示数据

---

## 任务 8：前端账户组件更新

`apps/yishan-admin/src/modules/crm/pages/hospitals/index.tsx` 已包含大部分修改。补充：

### 8.1 启用/停用按钮（hospitals 行操作）

如果存在 inline 切换按钮（line 308 附近），按角色禁用：
```tsx
<a 
  onClick={...} 
  style={{ pointerEvents: isHospitalAccount ? 'none' : undefined, color: isHospitalAccount ? '#999' : undefined }}
>启用/停用</a>
```

### 8.2 账号管理 status 编辑（line 725 附近）

`<Select>` 加 `disabled={isHospitalAccount}`

### 8.3 详情头部（如果显示了 hospital id）

`Descriptions` 中 hospital.id 项条件渲染。

---

## 测试与质量门

- `pnpm --filter yishan-api test` 通过（含新 hospital-dashboard repository test）
- `pnpm --filter yishan-admin lint` 通过
- `pnpm --filter yishan-admin test` 通过（如有更新 snapshot）
- 浏览器手动验证 4 个角色：super_admin / admin / hospital_account / customer_service
- OpenAPI 重生成提交：`apps/yishan-admin/src/services/generated/crm.ts` + `typings.d.ts`

## 风险与回滚

| 风险 | 影响 | 缓解 |
|------|------|------|
| DB 迁移失败 | 总后台看板无法显示 | 0003 迁移可独立 rollback，Drizzle 自动生成 down |
| OpenAPI 重生成破坏现有引用 | 前端构建失败 | 后端先发版，前端跟随；commit `services/generated/*` 一并 review |
| 角色判断遗漏某处 UI | 医院账号看到不该看的 | 全角色浏览器巡检 + unit test 验证 useIsHospitalAccount |
| 派单详情的"医院查看状态"被医院账号反复要求 | 体验问题 | super_admin 派单详情保留 view-log（不删 route），仅前端不渲染 |

## 不在本期范围

- 派单详情回复的图片上传改造（已有 yishan-tiptap）
- 派单列表筛选城市
- 医院账号登录后跳转首页定制（保持现有 dashboard）
- 邮件 / 短信通知（Phase C.2B）

## 提交规范

按 Conventional Commits 分多个 commit（每任务 1 个 commit），便于 review / revert：

```
feat(crm-admin): hide hospital ID and status toggle from hospital_account
feat(crm-admin): hide dispatch ID from hospital_account list
fix(crm-api): grant hospital_account dispatches/hospital-dashboard permissions
refactor(crm-admin): move "医院查看状态" from dispatch detail to hospital dashboard
feat(crm-admin): hide change-password tab from hospital_account
fix(crm-api): exclude completed dispatches from unviewed count
feat(crm-admin): add hospital distribution card to super-admin dashboard
feat(crm-api): add hospital category field + dashboard distribution endpoint
```
