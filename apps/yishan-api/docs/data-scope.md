# DataScope:角色数据权限接入规范

> 当我们说"客服小李只能看到自己添加的会员顾客" —— 谁负责?怎么配?在哪写?

## 三个层面

```
sys_role.dataScope (1-5)        ← 框架:每个角色一个"档位数字"
   ↓
PermissionService.effectiveDataScope  ← 框架:rbac 时算出来,写到 req
   ↓
service / repository             ← 业务:自己决定每个档位对应什么 WHERE
```

**框架只负责前两层(传一个数字出来)。第三层"这个数字等于几时具体怎么过滤",由每个 entity 自己写。**

## sys_role.dataScope 五档

| 值 | 名称 | 含义 | 当前用到的角色 |
| --- | --- | --- | --- |
| 1 | ALL | 全部数据,无过滤 | `super_admin`、`admin` |
| 2 | DEPT | 本部门数据 | (crm 暂未接) |
| 3 | DEPT_AND_CHILDREN | 本部门 + 子部门 | (crm 暂未接) |
| 4 | SELF | 仅本人数据 | `customer_service` 客服 |
| 5 | CUSTOM | 自定义,业务自己定义语义 | `hospital_account` 医院管理 |

> 表 `sys_role.dataScope tinyint NOT NULL DEFAULT 1`(早就在 schema 里,但本 fork 前没人接下游)。

## 数据流(用户点开 `/crm/v1/members` 时)

```
1. JWT 解码
   ↓
2. rbac preHandler (apps/yishan-api/src/core/plugins/external/rbac.ts)
   ↓ loadForRoleIds(roleIds) 一次 DB 查全部
   ↓   → perms, roleCodes, dataScopes, effectiveDataScope
   ↓ effectiveDataScope 写到 req.currentUser.dataScope
   ↓
3. 路由 handler (apps/yishan-api/src/modules/crm/routes/v1/members/index.ts)
   ↓ 从 req.currentUser.dataScope 取值(默认 1 ALL)
   ↓ 传给 MembersService.list(q, userId, scope)
   ↓
4. service (apps/yishan-api/src/modules/crm/services/members.service.ts)
   ↓ ownerScopeFor(scope, userId) → number | undefined
   ↓   = SELF 时返回 userId,否则返回 undefined
   ↓ 传给 MembersRepository.list({..., ownerUserId})
   ↓
5. repository (apps/yishan-api/src/modules/crm/repositories/members.repository.ts)
   ↓ Drizzle where 注入 ownerUserId 条件
   ↓
6. SQL:
   WHERE deleted_at IS NULL
     AND owner_user_id = 100    ← 仅在 SELF 时出现
```

## 在哪写?业务模块的 4 处模板

下面用 `crm:member` 模块作为参考。**4 个文件,每个都该有一段 scope 相关代码**:

### 1. service 入口 — 翻译 scope → owner scope

`apps/yishan-api/src/modules/crm/services/members.service.ts`:

```ts
import { DATA_SCOPE, type DataScopeCode } from '@/core/repositories/permission.repository.js'

function ownerScopeFor(scope: DataScopeCode, userId: number): number | undefined {
  if (scope === DATA_SCOPE.SELF) return userId
  return undefined  // 其它档位当前都按"看全部"处理
}

static async list(q: any, userId: number, scope: DataScopeCode = DATA_SCOPE.ALL) {
  const ownerUserId = ownerScopeFor(scope, userId)
  return MembersRepository.list({ ...q, ownerUserId })
}
```

> 关键: `ownerScopeFor` 是**模块的私有函数**,不强求名字统一。CRM 用 ownerUserId,系统 user 可能用 deptId,各自写。

### 2. service 详情 / 更新操作 — 写入检查

```ts
static async getById(id, userId, scope, browse) {
  const m = await MembersRepository.findById(id)
  if (!m) return null
  // scope = SELF 时,不是自己加的就当不存在
  if (ownerScopeFor(scope, userId) === userId && m.ownerUserId !== userId) return null
  return m
}
```

> 这种"查询得到但拦截返回"的模式,是 dataScope 在 detail/save/delete 上的常见做法。

### 3. route handler — 从 req 拿 scope

`apps/yishan-api/src/modules/crm/routes/v1/members/index.ts`:

```ts
const scope = (req: any): DataScopeCode => req.currentUser?.dataScope ?? 1

route.get('/members', {
  access: { permission: PERMS.MEMBER_LIST },
  ...
}, async (req) => MembersService.list(req.query, uid(req), scope(req)))
```

> `?? 1` 是默认值,防御性兜底。即便是缺失,默认按 ALL 走,不会误限。

### 4. 角色种子 — 给角色写 dataScope

`apps/yishan-api/src/scripts/seed/config/roles.json`:

```json
{
  "superAdmin":      { "code": "super_admin",      "dataScope": 1 },
  "admin":           { "code": "admin",            "dataScope": 1 },
  "hospitalAccount": { "code": "hospital_account", "dataScope": 5 },
  "customerService": { "code": "customer_service", "dataScope": 4 }
}
```

`apps/yishan-api/src/scripts/seed/modules/system-role.ts`:

```ts
await db.insert(sysRole).values({
  ...,
  dataScope: roleSeed.dataScope,  // 写字段
})
```

## 不做的事

1. **不要给框架加通用 `withDataScope(scope, queryBuilder)`** —— 每个 entity 的"自己加的"字段不一样,硬抽象会变成 callback hell。
2. **不要在 service 之外额外搞权限拦截层** —— rbac preHandler 已经写了 req.currentUser.dataScope,service 用就行。
3. **不要让 sys_role.dataScope 默认值 1 偷偷生效** —— seed 阶段必须显式写覆盖,避免客服误开。

## 何时接 vs 不接

| 接入 | 不接入(暂时保留 ALL) |
| --- | --- |
| 客服/业务操作员只该看到自己的 | 后台 admin 全看 |
| 业务用 owner_user_id 字段作为隔离 | 业务还没规范化隔离字段 |
| 角色 已经明确有 dataScope 取值 | 系统初始化时 role 还没建 |

判断标准:**业务上有没有"做这件事的人不该看到别人的同类对象"的诉求?** 有就接。

## 当前 fork 各角色 / dataScope 对照

| role.code | name | dataScope | 接了哪些模块 |
| --- | --- | --- | --- |
| super_admin | 超级管理员 | 1 | 全部 |
| admin | 普通管理员 | 1 | 全部 |
| hospital_account | 医院管理 | 5 | (CUSTOM —— 待接 crm_hospital_account) |
| customer_service | 客服管理 | 4 | crm:member 已接,其余待接 |
| normal_user | (未建) | 4 SELF | — |

下游推进顺序:
1. **crm:customers** —— 客服只看到自己派的客户(customer.owner_user_id = 自己)
2. **crm:dispatches** —— 客服只看到关联自己客户的派单(本质上是 customers 的连带)
3. **crm:hospitals** —— 医院账号只看到自己医院的派单(crm_hospital_account 表 JOIN)
4. **系统 user/dept/post** —— DEPT / DEPT_AND_CHILDREN 规则(sync 需要 dept 表对齐)

每个 entity 一节大约 30 行代码(改 service + route)。

## 验证脚本

```bash
# 一个完整的端到端验证路径
# 前置: seed 完了 + 创建了 kefu1 用户和测试数据

TOKEN_ADMIN=$(curl -sX POST localhost:3100/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<your-admin-pwd>"}' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).data.token))")

TOKEN_KEFU=$(... 用 kefu1 登录 ...)

# admin: 应该看到全部 6 个
curl -sX GET localhost:3100/api/crm/v1/members -H "Authorization: Bearer $TOKEN_ADMIN" \
  | jq '.data.total'   # → 6

# kefu1 (dataScope=4 SELF): 应该只看到 3 个
curl -sX GET localhost:3100/api/crm/v1/members -H "Authorization: Bearer $TOKEN_KEFU" \
  | jq '.data.total'   # → 3

# kefu1 想看 admin 加的: 应该 null
curl -sX GET localhost:3100/api/crm/v1/members/18 -H "Authorization: Bearer $TOKEN_KEFU" \
  | jq '.data'        # → null
```

期望输出一致即视为 dataScope 已正确生效。

## 关键文件索引

| 文件 | 角色 |
| --- | --- |
| `apps/yishan-api/src/db/schema/tables.ts` (L296) | `sys_role.dataScope` tinyint 字段定义 |
| `apps/yishan-api/src/core/repositories/permission.repository.ts` | 读 dataScope + 多角色聚合 |
| `apps/yishan-api/src/core/services/permission.service.ts` | 透传 + 缓存 |
| `apps/yishan-api/src/core/plugins/external/rbac.ts` | 写 `req.currentUser.dataScope` |
| `apps/yishan-api/src/core/repositories/permission.repository.ts` (DATA_SCOPE enum) | 5 档常量 |
| `apps/yishan-api/src/modules/crm/services/members.service.ts` | CRM 业务侧示范 |
| `apps/yishan-api/src/modules/crm/routes/v1/members/index.ts` | CRM 路由侧示范 |
| `apps/yishan-api/src/scripts/seed/config/roles.json` | 角色 seed 含 dataScope |
| `apps/yishan-api/src/scripts/seed/modules/system-role.ts` | 角色写入 dataScope |
