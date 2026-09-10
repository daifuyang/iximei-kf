# 医院后台 8 项修复 — 线上验收测试计划

日期：2026-09-09
CD run：`34306957723` success（10 commits 已 push origin/main `4cb6833..30da283`）
auto-seed 已生效：角色权限已重新绑定到生产 DB

---

## 角色定义

| role_id | role_code | 范围 |
|---------|-----------|------|
| 1 | `super_admin` | 全局 |
| 2 | `admin` | 普通管理员（CRM 无业务权限） |
| 3 | `hospital_account` | 本院派单 |
| 4 | `customer_service` | 自己 customer + 派单 |

参考：`apps/yishan-api/src/constants/permission-codes.ts#ROLE_IDS`

## 本次任务清单（验收目标）

| # | 修复点 | 期望行为 |
|---|--------|---------|
| 1 | 医院 ID 对 hospital_account 隐藏 | `/crm/hospitals` 列表不显示 ID 列 |
| 2 | 医院状态启用/停用对 hospital_account 隐藏 | 编辑表单 + 账号管理 Select + 启停按钮全部消失/禁用 |
| 3 | 派单 ID 对 hospital_account 隐藏 | `/crm/dispatches` 列表不显示 ID 列 |
| 4 | hospital_account 顾客订单 403 修复 | 进 `/crm/dispatches` 看到列表，点详情可进（不再「权限不足」） |
| 5 | 派单详情「医院查看状态」段移除 | super_admin 派单详情不再有「医院查看状态」表格，保留「手机号查看日志」 |
| 6 | 「我最近查看的派单」卡片 | hospital_account 进 `/crm/hospital-dashboard` 看到新卡片 |
| 7 | 修改密码 tab 对 hospital_account 隐藏 | `/account/center` 只有一个 tab「个人资料」 |
| 8 | unviewedCount 排除已完成 | 当前 6 个状态无「已完成」，**本次种子下是 no-op**，测试预期不变 |
| 9 | 医院分布看板 | super_admin 进 `/crm/dashboard` 看到「医院分布看板」组件。**待运维 db:migrate 应用 0003 后才有真实数据** |

---

## 测试分层

### Layer 1：API Smoke（curl 拉每个 operationId，验证 200/403/404）

#### 1.1 准备 token

```bash
# super_admin token
SUPER_TOKEN=$(curl -s -X POST https://crm.iximei.cn/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<your-password>"}' | jq -r .data.token)

# 找一个 hospital_account 账号 + customer_service 账号：
# - admin 后台 → 用户管理 → 列表 → 查 hospital_account 角色用户
# - 也可直接 DB 查 SELECT u.id, u.username FROM sys_user u JOIN sys_user_role ur ON ur.user_id=u.id WHERE ur.role_id=3 LIMIT 1
HOSPITAL_TOKEN=$(curl -s -X POST https://crm.iximei.cn/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"<hospital_username>","password":"<password>"}' | jq -r .data.token)

# customer_service 同理
CS_TOKEN=$(curl -s -X POST https://crm.iximei.cn/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"<cs_username>","password":"<password>"}' | jq -r .data.token)
```

#### 1.2 全部 operationId 矩阵

**Hospitals（10 个 ops）**

| operationId | super_admin | admin | hospital_account | customer_service | 验收点 |
|---|---|---|---|---|---|
| `listCrmHospitals` | 200 | 403 | 200 | 403 | hospital_account 看到列表但 ID 不展示（API 不变） |
| `searchCrmHospitals` | 200 | 403 | 200 | 403 | |
| `getCrmHospital` | 200 | 403 | 200 | 403 | |
| `createCrmHospital` | 200 | 403 | 403 | 403 | |
| `updateCrmHospital` | 200 | 403 | 200（自己医院） | 403 | |
| `deleteCrmHospital` | 200 | 403 | 403 | 403 | |
| `renameCrmHospital` | 200 | 403 | 403 | 403 | |
| `getCrmHospitalAccount` | 200 | 403 | 200（自己） | 403 | |
| `updateCrmHospitalAccount` | 200 | 403 | 403 | 403 | |
| `resetCrmHospitalAccountPassword` | 200 | 403 | 403 | 403 | |

**Customers（8 个 ops）**

| operationId | super_admin | admin | hospital_account | customer_service |
|---|---|---|---|---|
| `listCrmCustomerStatuses` | 200 | 403 | 403 | 200 |
| `listCrmCustomers` | 200 | 403 | 403 | 200（仅 owner） |
| `getCrmCustomer` | 200 | 403 | 403 | 200（仅 owner） |
| `createCrmCustomer` | 200 | 403 | 403 | 200 |
| `updateCrmCustomer` | 200 | 403 | 403 | 200 |
| `dispatchCrmCustomer` | 200 | 403 | 403 | 200 |
| `createCrmCustomerRemark` | 200 | 403 | 403 | 200 |
| `deleteCrmCustomer` | 200 | 403 | 403 | 200 |

**Dispatches（11 个 ops）** ★ 重点验证

| operationId | super_admin | admin | hospital_account | customer_service | 验收点 |
|---|---|---|---|---|---|
| `listCrmDispatchStatuses` | 200 | 403 | 200 ✓ | 200 | 任务 4 验证：hospital_account 不再 403 |
| `listCrmDispatches` | 200 | 403 | **200** ✓ | 200（仅自己 customer） | **任务 4 核心修复** |
| `getCrmDispatch` | 200 | 403 | **200** ✓（本院） | 200（仅自己 customer） | |
| `updateCrmDispatch` | 200 | 403 | 200 | 403 | |
| `createCrmDispatchReply` | 200 | 403 | **200** ✓ | 403 | |
| `createCrmDispatchLog` | 200 | 403 | **200** ✓ | 403 | **任务 4 修复点：之前漏配此 perm** |
| `deleteCrmDispatch` | 200 | 403 | 403 | 403 | |
| `exportCrmDispatches` | 200 | 403 | 200 | 403 | |
| `viewCrmDispatchMobile` | 200（noop） | 403 | 200 | 403 | 医院账号触发手机号明文 + 写审计 |
| `listCrmDispatchMobileViewLogs` | 200 | 403 | 403 | 403 | 仅 super_admin |
| `listCrmDispatchHospitalViewLogs` | 200 | 200 | 403 | 403 | 任务 5：API 仍存在，前端不再展示 |

**Hospital Dashboard（4 个 ops）**

| operationId | super_admin | admin | hospital_account | customer_service |
|---|---|---|---|---|
| `getCrmHospitalDashboardStats` | 200 | 403 | 200（本院） | 403 |
| `getCrmHospitalUnviewedDispatchCount` | 200 | 403 | 200（本院） | 403 |
| `getCrmHospitalDashboardTrend` | 200 | 403 | 200（本院） | 403 |
| `listCrmHospitalDashboardMyRecentViews` | 200 | 403 | 200（本院） | 403 | 任务 6 新增 |

**Dashboard（1 个 ops）**

| operationId | super_admin | admin | hospital_account | customer_service |
|---|---|---|---|---|
| `getCrmDashboardStats` | 200（带 hospitalDistribution） | 200（带 hospitalDistribution） | 200（hospitalDistribution.items=[]） | 200（hospitalDistribution.items=[]） | 任务 9 |

**Members（17 个 ops）** — 本次未改，但顺便回归

| operationId | super_admin | admin | hospital_account | customer_service |
|---|---|---|---|---|
| 全部 17 个 | 200 | 403 | 403 | 200 |

#### 1.3 自动化脚本（建议）

```bash
# /tmp/api-smoke.sh
#!/usr/bin/env bash
set -e

BASE=https://crm.iximei.cn/api/v1
declare -A ROLES=(
  [super]=$SUPER_TOKEN
  [admin]=$ADMIN_TOKEN
  [hospital]=$HOSPITAL_TOKEN
  [cs]=$CS_TOKEN
)
declare -A EXPECT=(
  ["listCrmHospitals|super"]="200" ["listCrmHospitals|hospital"]="200" ["listCrmHospitals|admin"]="403" ["listCrmHospitals|cs"]="403"
  ["listCrmDispatches|hospital"]="200"   # 任务 4 修复
  ["createCrmDispatchLog|hospital"]="200" # 任务 4 修复
  # ... 全 60+ 行
)

PASS=0
FAIL=0
for key in "${!EXPECT[@]}"; do
  op="${key%|*}"
  role="${key#*|}"
  op_method=$(...)
  actual=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE/crm/$op" \
    -H "Authorization: Bearer ${ROLES[$role]}")
  expected="${EXPECT[$key]}"
  if [ "$actual" = "$expected" ]; then
    PASS=$((PASS+1))
  else
    FAIL=$((FAIL+1))
    echo "FAIL: $op as $role → $actual (expected $expected)"
  fi
done
echo "PASS=$PASS FAIL=$FAIL"
```

**实施建议**：把脚本放到 `scripts/smoke-crm.sh`，PR 时跑回归。

---

### Layer 2：Vitest 单元/集成（已有 + 缺口）

#### 2.1 已覆盖（本会话产出）

- ✅ `system-role-permission.test.ts` — **23 tests**，覆盖 hospitalAccountCodes 前缀匹配 + 黑名单
- ✅ `hospital-dashboard.repository.test.ts` — **9 tests**，覆盖 unviewedCount 排除已完成
- ✅ `hospital-dashboard.service.test.ts` — **8 tests**，覆盖访问矩阵（super_admin/hospital_account/customer_service）
- ✅ `hospital-dashboard.test.ts` — **4 tests**
- ✅ `hospital-dashboard-trend.test.ts` — **3 tests**
- ✅ `dispatches.view-log.test.ts` — **2 tests**
- ✅ `dispatches.view-log.schema.test.ts` — **1 test**
- ✅ `dashboard-rankings.test.ts` — **3 tests**
- ✅ `members.selectable.test.ts` — N tests

#### 2.2 缺口（建议补）

| 缺口 | 建议位置 | 验收点 |
|------|---------|--------|
| `getMyRecentViews`（任务 6 后端新增） | `hospital-dashboard.service.test.ts` | super_admin 全院 / hospital_account 本院 / LIMIT N / ORDER BY DESC |
| `getHospitalDistributionByCity`（任务 9 后端新增） | 新建 `dashboard.repository.distribution.test.ts` | 按 city 分组聚合 + LEFT JOIN sys_region + ORDER BY total DESC |
| `system-role-menu.test.ts` | 新建 | hospitalAccount menu 不含 `/crm/customers`；包含 `/crm/dispatches` |
| role-aware 前端行为（utils/role.ts） | 新建（前端 Jest） | useIsHospitalAccount 返回值与角色对应 |
| 前端 ID 列隐藏条件渲染 | 新建（前端 Jest） | useIsHospitalAccount=true 时 columns 不含 id |

#### 2.3 集成测试（需 YISHAN_RUN_INTEGRATION=1）

```bash
cd apps/yishan-api
YISHAN_RUN_INTEGRATION=1 pnpm test -- src/modules/crm/tests/integration
```

建议新建 `apps/yishan-api/src/modules/crm/tests/integration/online-acceptance.test.ts`：
- 真实 DB
- 4 个角色登录各 token
- 跑完整 operationId 矩阵
- 用 `app.inject()` 替代 curl

---

### Layer 3：前端角色感知渲染（手工 + 组件测试）

#### 3.1 4 角色浏览器手工巡检

| 页面 | super_admin | admin | hospital_account | customer_service |
|------|-----------|-------|------------------|------------------|
| `/crm/hospitals` 列表 | 显示 ID 列 + 启停按钮 | 403 | **不显示 ID 列 + 不显示启停按钮** | 403 |
| `/crm/hospitals` 编辑医院 | 显示状态字段 | 403 | **不显示状态字段** | 403 |
| `/crm/hospitals` 账号管理 | status Select 可改 | 403 | **status Select disabled** | 403 |
| `/crm/dispatches` 列表 | 显示 ID 列 | 403 | **不显示 ID 列** | 显示 ID 列 |
| `/crm/dispatches` 详情 | 派单详情 + 手机号查看日志 + ~~医院查看状态~~ | 403 | 派单详情（手机号脱敏，emoji 按钮） | 派单详情（仅自己 customer 的） |
| `/crm/hospital-dashboard` | 4+3 统计卡 + 折线 + 饼图 + 医院/日期筛选 + **我最近查看的派单卡片** | 403 | 4+3 统计卡 + 折线 + 饼图（无筛选）+ **我最近查看的派单卡片** | 403 |
| `/crm/dashboard` | 4 MetricCards + 9 业务卡 + **医院分布看板** + 医院排行 | 200 + hospitalDistribution.items 有数据 | 200 + hospitalDistribution.items=[]（看板上 Empty 占位） | 200 + hospitalDistribution.items=[] |
| `/account/center` | 个人资料 + 安全设置 + API Token | 同上（除 API Token 看 perm） | **只有「个人资料」** | 个人资料 + 安全设置（看 perm） |

#### 3.2 浏览器自动化（可选，建议 Playwright）

```ts
// e2e/hospital-admin-acceptance.spec.ts
import { test, expect } from '@playwright/test'

const ROLES = {
  super_admin: { token: '...', username: 'admin' },
  hospital_account: { token: '...', username: 'hospital1' },
  // ...
}

for (const [role, info] of Object.entries(ROLES)) {
  test(`${role}: hospitals list does not show ID column`, async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[name=username]', info.username)
    await page.fill('input[name=password]', '...')
    await page.click('button[type=submit]')
    await page.goto('/crm/hospitals')

    const idHeader = await page.locator('th:has-text("ID")').count()
    if (role === 'hospital_account') {
      expect(idHeader).toBe(0)
    } else if (role === 'super_admin') {
      expect(idHeader).toBeGreaterThan(0)
    }
  })
}
```

---

### Layer 4：数据一致性（直接 SQL 查生产）

```sql
-- 4.1 角色权限：hospital_account 应包含 :log
SELECT r.code, p.code
FROM sys_role r
JOIN sys_role_permission rp ON rp.role_id = r.id
JOIN sys_permission p ON p.id = rp.permission_id
WHERE r.code = 'hospital_account'
  AND p.code LIKE 'crm:dispatches:%'
ORDER BY p.code;
-- 预期：list / reply / log / view-mobile 都有；update / delete / view-mobile-logs / view-hospital-log 不应有

-- 4.2 角色菜单：hospital_account 应包含 dispatches 但不含 customers
SELECT m.path
FROM sys_role r
JOIN sys_role_menu rm ON rm.role_id = r.id
JOIN sys_menu m ON m.id = rm.menu_id
WHERE r.code = 'hospital_account'
  AND m.deleted_at IS NULL
  AND m.path LIKE '/crm/%'
ORDER BY m.path;
-- 预期：含 /crm/dispatches, /crm/hospital-dashboard, /crm/hospitals
--      不含 /crm/customers, /crm/dashboard, /crm/members

-- 4.3 医院 category 字段（待 db:migrate 后）
SELECT category, COUNT(*) FROM crm_hospital WHERE deleted_at IS NULL GROUP BY category;
-- 预期：oral / plastic / null 三种状态都有分布（取决于历史数据）
-- 迁移前查询会报 Unknown column 'category'
```

---

### Layer 5：性能与稳定性

| 测试 | 方法 | 验收 |
|------|------|------|
| `listCrmHospitalDashboardMyRecentViews` 大数据 | 插入 10000 条 view_log，测响应 < 200ms | OK |
| `getHospitalDistributionByCity` 全量 | 765 家医院 + 3400 区域 LEFT JOIN | < 500ms |
| 派单列表分页 50 条 | 触发普通查询路径 | < 300ms |
| unviewedCount 缓存命中 | 60s 内重复调应走缓存 | 第二次 < 10ms |

---

## 验收清单（go/no-go）

### P0（必过，否则回滚）

- [ ] Layer 1.2 Dispatches 矩阵：hospital_account 调 `listCrmDispatches`/`getCrmDispatch`/`createCrmDispatchReply`/`createCrmDispatchLog` 全 200
- [ ] Layer 3.1 `/crm/dispatches` 详情无「医院查看状态」段（super_admin 视角）
- [ ] Layer 3.1 `/crm/hospital-dashboard` 有「我最近查看的派单」卡片
- [ ] Layer 3.1 `/account/center` hospital_account 看不到安全设置 tab
- [ ] Layer 4.1 SQL 验证 hospital_account 含 `:log` perm
- [ ] Layer 4.2 SQL 验证 hospital_account 含 `/crm/dispatches` menu

### P1（应过，但低优先级）

- [ ] Layer 1.2 全 60+ operationId 矩阵通过
- [ ] Layer 3.1 4 角色 8 页面巡检全部对齐预期
- [ ] Layer 5 性能测试 4 项达标

### P2（运维侧，待执行）

- [ ] `pnpm --filter yishan-api db:migrate` 应用 0003
- [ ] Layer 4.3 SQL 验证 category 字段 + 历史回填成功
- [ ] Layer 1.2 dashboard API 返回 `hospitalDistribution.items.length > 0`（验证分类回填正确）

---

## 自动化建议（下一步 ticket）

1. 把 Layer 1 矩阵脚本落到 `scripts/smoke-crm.sh`，PR 时跑
2. 把 Layer 2 缺口测试补齐（`getMyRecentViews` / `getHospitalDistributionByCity` / `system-role-menu`）
3. 引入 Playwright（已有 `apps/yishan-admin/playwright.config.ts` 的话直接用）跑 Layer 3 浏览器巡检
4. CD 加一步 `pnpm --filter yishan-api db:migrate`（按 `yishan-fc-migrate.yml` 模式走专用迁移函数）—— 这样下次新功能上线不需要再手动 migrate

## 不在本期范围

- C.2B 邮件推送
- 派单详情图片上传改造
- 派单详情按客户姓名搜索

## 相关记忆

- `0mt4fp0j` iximei-kf CD auto-seed SSH 隧道稳态验证（本次第三次成功）
- `0mt5hjr3e` 线上 sys_menu 改名走 ecs-deployer token（已修）
- `0mt4d4pjw` (stale) 医院看板 follow-up 已完成
- `0mt1veprf` dump-openapi.mjs 已实现自动导出
