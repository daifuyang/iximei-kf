# DataScope 数据权限规范

> 客服小李只能看到自己添加的客户。超管不配:全看。医院账号只接派单回。
> 这些隔离规则靠谁来保证、在哪写、怎么测 —— 本文档讲清楚。

## 一句话总览

```
sys_role.data_scope                    ← 角色表里一个数字 1-5
   ↓ (login 后 rbac preHandler 加载)
req.currentUser.dataScope              ← 业务 service 直接读
req.currentUser.roleCodes              ← 数组,含 super_admin / admin / hospital_account / customer_service

业务 service 在 route handler 里读这两个字段,内联判断 + 加 WHERE。
```

**两个判断维度**:
1. `roleCodes.includes('super_admin')` → 无条件看全部 (安全侧门,与 data_scope 值无关)
2. `dataScope === 1/4/5` → 决定走哪条 WHERE 路径
3. **不读 dataScope === 1 (ALL)** 之外也不死板 — 真实逻辑按 roleCodes 组合 dataScope 决定

> 不引入通用 `withDataScope(qb, scope)` 抽象 — CRM 用 owner_user_id,医院账号用 crm_hospital_account JOIN,系统 user 用 dept_id,语义不一样,硬抽象会变 callback。

## `sys_role.data_scope` 五档

| 值 | 名称 | 含义 | 当前用到的角色 |
| --- | --- | --- | --- |
| 1 | ALL | 看全部,无 WHERE 过滤 | 显式 `super_admin` (因 code lift) 与 `admin` (虽然 admin 当前没有 crm 权限但角色字段保留) |
| 2 | DEPT | 本部门数据 | 暂未用 |
| 3 | DEPT_AND_CHILDREN | 本部门 + 子部门 | 暂未用 |
| 4 | SELF | 仅本人数据 | `customer_service`、`admin` |
| 5 | CUSTOM | 模块自定义(业务自己定义语义) | `hospital_account` (需要在 crm_hospital_account 模块接 JOIN) |

表字段已存在:`sys_role.data_scope tinyint NOT NULL DEFAULT 1` (`apps/yishan-api/src/db/schema/tables.ts`)。
默认 1 = 看全部,所以 admin role 即使没刻意接 SELF 过滤,只要 service 没读 dataScope,他看的就是全部。

## 当前 fork 角色矩阵(已 commit 7dedf14)

| 角色 code | menu 可见 | 按键权限 | data_scope | service 看到的请求数据范围 |
| --- | --- | --- | --- | --- |
| `super_admin` | 全部菜单 | 所有 crm:*/system:* | 1 | **ALL (lift)** |
| `admin` | 仅 account | 仅 `auth:login` | 4 | 默认 SELF (没 crm 权限,403 在 rbac 层拦截) |
| `hospital_account` | /crm/dispatches + account | `crm:dispatches:list/update/reply` + `system:region:list` | 5 | CUSTOM — `crm_dispatch.hospital_id IN (own hospitals)` |
| `customer_service` | /crm/customers/dispatches/members + account | 客户 CRUD+dispatch / 派单全 / 会员 CRUD+remark | 4 | SELF — owner_user_id = self |

> "客服"是 `customer_service` 角色 (fork 沿用历史命名,即商务账号);
> "医院管理 / 医院账号"是 `hospital_account` 角色;
> "管理员"是 `admin` 角色 (本 fork 不配置 CRM 权限)。

## 数据流 (用户 GET /crm/v1/customers 时)

```
1. JWT 解码,得到 currentUser.id + currentUser.roleCodes: ['customer_service']
2. rbac preHandler (apps/yishan-api/src/core/plugins/external/rbac.ts)
   - loadForRoleIds(roleIds) 缓存 30s
   - 返回 { perms, roleCodes, effectiveDataScope }
   - super_admin 旁路 `__super_admin__` 加入 perms
   - 写 req.currentUser.dataScope = effectiveDataScope (本场景: 4)
   - 也带出 roleCodes 让 service 用
3. route handler (apps/yishan-api/src/modules/crm/routes/v1/customers/index.ts)
   const roleCodes = (req) => req.currentUser?.roleCodes ?? []
   const scope     = (req) => req.currentUser?.dataScope ?? 1
   async (req) => CustomersService.list(req.query, uid(req), roleCodes(req), scope(req))
4. service (apps/yishan-api/src/modules/crm/services/customers.service.ts)
   function ownerScopeFor(roleCodes, userId, scope) {
     if (roleCodes.includes('super_admin')) return undefined  // ALL
     if (scope === DATA_SCOPE.SELF) return userId              // SELF
     return undefined                                          // 其它按 ALL (包括 DEPT/DEPT_AND_CHILDREN/CUSTOM 待接)
   }
5. repository (apps/yishan-api/src/modules/crm/repositories/customers.repository.ts)
   if (q.ownerUserId) where(..., eq(crmCustomer.ownerUserId, ownerUserId))
6. SQL:
   WHERE deleted_at IS NULL
     AND owner_user_id = 4     ← 仅 customer_service 触发;super_admin 不加这一行
```

> 模板见 `apps/yishan-api/src/modules/crm/services/customers.service.ts` + `routes/v1/customers/index.ts`

## 编码模板

### 简单场景:`owner_user_id` SELF 隔离 (CRM customer/member)

**`apps/yishan-api/src/modules/crm/services/customers.service.ts`** (简化):

```ts
import { DATA_SCOPE, type DataScopeCode } from '@/core/repositories/permission.repository.js'

const SUPER_ADMIN_CODE = 'super_admin'

function ownerScopeFor(roleCodes: ReadonlyArray<string>, scope: DataScopeCode, userId: number): number | undefined {
  if (roleCodes.includes(SUPER_ADMIN_CODE)) return undefined  // ALL
  if (scope === DATA_SCOPE.SELF) return userId                  // SELF
  return undefined                                                // 其它档位按 ALL (除非自行实现)
}

export class CustomersService {
  static async list(q: any, userId: number, roleCodes: ReadonlyArray<string>, scope: DataScopeCode) {
    const ownerUserId = ownerScopeFor(roleCodes, scope, userId)
    return CustomersRepository.list({ ...q, ownerUserId })
  }

  static async getById(id: number, userId: number, roleCodes, scope) {
    const c: any = await CustomersRepository.findById(id)
    if (!c) return null
    if (roleCodes.includes(SUPER_ADMIN_CODE)) return c
    // SELF:不是 owner 就当不存在
    if (ownerScopeFor(roleCodes, scope, userId) === userId && c.ownerUserId !== userId) return null
    return c
  }
  // save / delete / dispatch 同理
}
```

**`apps/yishan-api/src/modules/crm/routes/v1/customers/index.ts`**:

```ts
const roleCodes = (req) => req.currentUser?.roleCodes ?? []
const scope     = (req) => req.currentUser?.dataScope ?? 1
async (req) => CustomersService.list(req.query, uid(req), roleCodes(req), scope(req))
```

> `?? 1` 兜底防御 — dataScope 字段缺失时按 ALL 走,不会误限。

### 复杂场景:CUSTOM (hospital_account 派单过滤)

`apps/yishan-api/src/modules/crm/services/dispatches.service.ts` — 派单是核心要按代码分支的:

```ts
async function dispatchFilters(roleCodes, userId): Promise<{ hospitalIds?, customerOwnerUserIds? }> {
  if (roleCodes.includes('super_admin')) return {}  // 空 = 不过滤
  if (roleCodes.includes('hospital_account')) {
    const ids = await HospitalsRepository.accessibleHospitalIds(userId)
    return { hospitalIds: ids.map(x => x.hospitalId) }
  }
  // 客服、admin:派单 -> 客户 -> owner = self
  return { customerOwnerUserIds: [userId] }
}
```

底层走 `crm_hospital_account.hospital_id IN (own)` / `crm_customer.owner_user_id = self`。

> **不要试图把这抽象成 `withCUSTOM(qb, roleCodes)`** — 每个 CUSTOM 的实现都不一样。

## 框架底层(只读、不必改)

| 文件 | 行为 |
| --- | --- |
| `src/core/repositories/permission.repository.ts` | 读 `sys_role.dataScope`,聚合 → `effectiveDataScope` |
| `src/core/services/permission.service.ts` | 透传,30s 进程内缓存 |
| `src/core/plugins/external/rbac.ts` | rbac preHandler 写 `req.currentUser.dataScope` |
| `src/db/schema/tables.ts` L296 | `sys_role.data_scope tinyint NOT NULL DEFAULT 1` |
| `src/core/permissions/catalog.ts` (`__super_admin__`) | super_admin 旁路 sentinel |

> 这些是已有 — **不要去碰**. 业务侧自己读 `req.currentUser.dataScope` 与 `roleCodes`。

## 不做的事(重要)

1. **不要尝试通用 `withDataScope(qb, scope)`** —— 每个 entity 的隔离字段都不一样
2. **不要让 default data_scope = 1 偷偷生效** —— 服务初始化时一定要把所有角色 dataScope 显式写全
3. **不要在 service 之外加权限拦截层** —— rbac preHandler 已经做了 perm 校验;数据过滤放 service 内
4. **不要忘记 super_admin lift** —— 即便 role.data_scope 配置错误,只要 code === 'super_admin',一切放行
5. **不要漏掉 cache invalidation** —— 改了 `sys_role.data_scope` 后要等 30s 或调 `PermissionService.invalidate()` 才能生效

## 何时接 vs 不接

| 接 dataScope | 不接 (默认 ALL) |
| --- | --- |
| 客服 / 业务操作员应该只看自己的 | 后台 admin 看全部 |
| 业务已经有 owner_user_id / dept_id / hospital_id 等隔离字段 | 业务还没规范化 |
| 角色 data_scope 已经明确配 | 系统初始化时 role 还没建 |

判断标准:**业务上有没有"做这件事的人不该看到别人的同类对象"诉求?** 有就接。

## 端到端冒烟 (cache 30s 后)

前置: DB seed 已 run。kefu1 用户绑定 customer_service role,admin 用户绑定 super_admin role。

```bash
login() { curl -sS http://localhost:3100/api/v1/auth/login -X POST \
  -H "Content-Type: application/json" -d "{\"username\":\"$1\",\"password\":\"admin123\"}" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).data?.token||''))"; }
SUPER=$(login admin)   # 超管
KEFU=$(login kefu1)    # 客服

# 1. super_admin 看全部 (lift)
curl -sS localhost:3100/api/crm/v1/customers -H "Authorization: Bearer $SUPER" \
  | jq '.data.total'    # 应等于 DB 全部记录数

# 2. kefu1 只看自己加的 (owner_user_id=2)
curl -sS localhost:3100/api/crm/v1/customers -H "Authorization: Bearer $KEFU" \
  | jq '.data.total'    # 应等于自己加的条数

# 3. kefu1 试图拿 admin 加的 → 应 null (被 SELF 过滤)
curl -sS localhost:3100/api/crm/v1/customers/<admin加的id> -H "Authorization: Bearer $KEFU" \
  | jq '.data'          # 应 null

# 4. 按钮权限层 (data scope 完全不参与)
# kefu1 没 crm:hospitals:list 权限 → 直接 403 (rbac preHandler 拦截)
curl -sS -o /dev/null -w "%{http_code}\n" \
  localhost:3100/api/crm/v1/hospitals -H "Authorization: Bearer $KEFU"  # 应 403

# 5. 角色矩阵速查 (DB 直查)
docker exec mysql8 mysql -uroot -p123456 iximei-crm -e "
  SELECT r.code, COUNT(rp.id) perms,
    SUM(rp.permission_code LIKE 'crm:hospitals:%') has_hosp
  FROM sys_role r
  LEFT JOIN sys_role_permission rp ON r.id=rp.role_id AND rp.deleted_at IS NULL
  WHERE r.deleted_at IS NULL
  GROUP BY r.code;"
```

期望输出:

| 角色 | perms | has_hosp |
| --- | --- | --- |
| super_admin | ~20 | ~4 |
| admin | 1 (auth:login) | 0 |
| hospital_account | ~5 | 0 |
| customer_service | ~13 | 0 |

## 接新 entity 的最小步骤 (checklist)

新加一个 `crm:something` 时,参考 customer/member 的实现:

- [ ] 1. 在 `routes/<resource>/index.ts` 加 `roleCodes(req)` + `scope(req)` helper,每个 handler 末尾传 `(req.query, uid(req), roleCodes(req), scope(req))`
- [ ] 2. service 接 `(userId, roleCodes, scope)` 形参
- [ ] 3. service 内部用 `roleCodes.includes('super_admin')` 短路 ALL
- [ ] 4. service 内部按 `scope === DATA_SCOPE.SELF` 加 `ownerUserId` 过滤
- [ ] 5. detail / save / delete 也要走同样的 owner check (`getById` 验证、save 前置校验)
- [ ] 6. repository 的 `list(q)` 加 `q.ownerUserId` 等可过滤入参
- [ ] 7. 不动 framework 层 (`permission.repository.ts` / `permission.service.ts` / `rbac.ts`)

总计 ~80 行 service + ~15 行 route 改动。

## 关键文件索引

| 文件 | 用途 |
| --- | --- |
| `apps/yishan-api/src/db/schema/tables.ts` (L296) | `sys_role.data_scope` 字段定义 |
| `apps/yishan-api/src/core/repositories/permission.repository.ts` | 5 档枚举 + lift + 多角色聚合 |
| `apps/yishan-api/src/core/services/permission.service.ts` | 透传、缓存 |
| `apps/yishan-api/src/core/plugins/external/rbac.ts` | preHandler 写 `req.currentUser.dataScope` |
| `apps/yishan-api/src/modules/crm/services/customers.service.ts` | **业务侧 SELF 模板 — 跟 customer/member 同模式** |
| `apps/yishan-api/src/modules/crm/services/dispatches.service.ts` | **业务侧 CUSTOM 模板 — 多角色分支** |
| `apps/yishan-api/src/modules/crm/services/members.service.ts` | SELF 模板 (customer 的孪生) |
| `apps/yishan-api/src/scripts/seed/config/roles.json` | 角色 metadata + dataScope |
| `apps/yishan-api/src/scripts/seed/modules/system-role.ts` | `ensureSystemRoles` 写 `dataScope` 入 `sys_role` |
| `apps/yishan-api/src/scripts/seed/modules/system-role-permission.ts` | 按钮权限矩阵 |
| `apps/yishan-api/src/scripts/seed/modules/system-role-menu.ts` | 菜单矩阵 |
