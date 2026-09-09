# 线上回归测试发现 P0 故障（2026-09-09）

## 现象

CD run `34306957723`（commit `30da283`，build sha `30da2830213f`）部署上线后回归测试发现：

| 接口 | 状态码 | 备注 |
|------|--------|------|
| `/api/health` | 200 OK | 核心模块正常 |
| `/api/build` | 200 OK | 新版本已上线 |
| `/api/v1/auth/login` | 200 | admin/admin123 登录成功 |
| `/api/crm/v1/dashboard/stats` | **500** | 内部错误 code 20001 |
| `/api/crm/v1/dashboard/stats`（无日期） | **500** | |
| `/api/crm/v1/dispatches` | **500** | |
| `/api/crm/v1/hospitals` | **500** | |
| `/api/crm/v1/hospital-dashboard/stats` | **404** | 路径不对（应是 `/hospital/dashboard/stats`） |
| `/api/crm/v1/customers` | 200 OK | 不受影响 |
| `/api/crm/v1/customers/statuses` | 200 OK | 不受影响 |
| `/api/crm/v1/dispatches/statuses` | 200 OK | 不受影响 |
| `/api/crm/v1/members` | 200 OK | 不受影响 |

**关键观察**：
- `/customers`、`/members` 这些走 crmCustomer / crmMember 表的接口都 200
- `/dashboard/stats`、`/dispatches`、`/hospitals` 都 500
- 后 3 个都涉及 `crmHospital` 表查询

## 怀疑根因

新引入 `apps/yishan-api/src/modules/crm/repositories/dashboard.repository.ts#getHospitalDistributionByCity()` 在 `getStats` 流程里强制调用，而 SQL 引用了 `crmHospital.category` 字段（commit `ddc36a4`）：

```sql
SUM(CASE WHEN ${crmHospital.category} = 'oral' THEN 1 ELSE 0 END)
```

生产 DB `crm_hospital` 表尚未应用 drizzle 0003 迁移（运维未跑 `pnpm db:migrate`），所以查询时报 `Unknown column 'category' in 'field list'` 错误。

**但奇怪的是**：500 的 3 个接口（dashboard / dispatches / hospitals）都不是「医院分布看板」相关的直接路径。这意味着：
- 要么 service 层某个共享模块被这行 SQL 拖垮
- 要么 Drizzle 在启动时校验 schema 时报错导致整个 module 加载失败

需要排查：
1. FC invoke 日志看实际 stack trace（找 `0mt4d4pjw` 提到的 ECS 日志查询方式）
2. 在本地复现（dev server + production DB 数据集）
3. 确认 Drizzle 是否在启动时 eager-eval SQL 模板（应该不会，但保险起见查一下）

## 替代假设

1. **重复 $id schema 注册**（参考 `0mt2pbux1` 案例）：本会话 dashboard.schema.ts 新加了 `$id: 'crmHospitalDistributionItem'` 和 `$id: 'crmHospitalDistributionResp'`，但 routes/v1/dashboard/index.ts 只 addSchema 了 `DashboardStatsSchema`，**不像是这个问题**。
2. **Drizzle column 引用 broken**：`crmHospital.category` 在 schema.ts 里加了字段，但生产 DB schema 没补，Drizzle 在运行时尝试 query 时报错。这种 500 通常来自 DB 而非启动。
3. **hospital-dashboard.repository.ts 的 unviewedCount / getMyRecentViews SQL 引用了已改 column**：commit `9776140` 加了 `getCompletedStatusIds`，SQL 引用 `crmDispatchStatus`，该字段存在；commit `d4e4fa4` 加了 `getMyRecentViews` 用 `crmDispatchViewLog`、`crmDispatch`、`crmCustomer`、`crmHospital`，全部存在。

## 待执行排查步骤

```bash
# 1. 看 FC 函数 invoke 日志
# 走 aliyun FC 控制台 / s cli 找 yishan-crm 函数的最近 500 stack

# 2. 在本地复现（如果有 production DB 镜像）
cd apps/yishan-api
DATABASE_URL='mysql://...' npx tsx -e "
import { DashboardService } from './src/modules/crm/services/dashboard.service.js'
import { ROLE_IDS } from './src/constants/permission-codes.js'
DashboardService.getStats(1, [ROLE_IDS.SUPER_ADMIN], 1, {})
  .then(d => console.log('OK', d.hospitalDistribution?.items?.length))
  .catch(e => console.error('FAIL', e))
"

# 3. 临时修复（两种方案）
# 方案 A：在 service 层 guard，crmHospital.category 不存在时回退到 no-op
# 方案 B：紧急回滚到上一个 commit 4cb6833（保留 8 项修复但跳过 hospitalDistribution）
```

## 临时回滚决策

如果 FC 日志确认是 category 字段缺失导致 500，**回滚到 4cb6833** 是最快止血方案——保留 9 项修复中 7 项，回退的只是 hospitalDistribution 看板（任务 9）+ hospital.category 迁移（任务 8）。可在运维 db:migrate 后再补回这 2 项。

## 影响范围

- 总后台 dashboard 看板不可用（P0）
- 派单管理列表不可用（P0，影响客服日常操作）
- 医院管理列表不可用（P0，影响总后台运营）
- 派单详情、派单跟进（任务 4 修复）等所有 dispatches 路由都受影响

**业务影响**：客服 + 总后台用户的日常工作被阻塞。
