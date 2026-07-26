# API Token 继承 RBAC 权限实施方案

## 1. 目标与结论

将 API Token 定位为**用户身份凭证**，不再承载或二次裁剪业务权限。无论用户使用 Web 会话、JWT 或 API Token，访问同一接口时都必须依据该用户**当前生效的 RBAC 角色、权限与数据范围**做出相同的授权决定。

目标行为：

```text
API Token
  -> 校验 Token 本身（哈希、状态、过期）
  -> 解析所属用户
  -> 实时读取用户当前角色
  -> 计算当前 RBAC 权限与数据范围
  -> 接口权限校验 / 数据范围校验
```

Token 不再具有 `scopes`、`*`、`__super_admin__` 等权限语义。修改用户角色、禁用用户、撤销 Token 后，无需修改其他 Token 数据即可立即影响授权结果。

## 2. 现状与问题

当前实现已经具备“Token 找到用户，再进入 RBAC”的基础链路，但在中间引入了 Token scope 的二次授权：

1. `jwt-auth` 在 PAT 校验成功后把 `sys_api_token.scopes` 写入 `request.tokenScope`。
2. `rbac` 插件将用户角色权限与 `tokenScope` 交给 `computeEffectivePerms` 求交集。
3. Token 创建接口允许指定 `scopes`，并通过“可用权限列表”接口让调用方选择。

这造成同一个用户出现两套权限来源，且 Token 签发时的 scope 会覆盖之后的角色调整。典型表现是：账号本身已是超级管理员，但某个 PAT 仍然被拒绝访问 `crm:dashboard:view`。

此外，系统中有两种容易混淆的名称：

| 名称 | 含义 | 处理原则 |
| --- | --- | --- |
| 用户名 `admin` | 默认管理员账号 | 必须绑定 `super_admin` 角色 |
| 角色编码 `admin` | 普通管理员角色 | 保留，不能误当成超级管理员 |
| 角色编码 `super_admin` | 超级管理员角色 | 拥有完整权限与全量数据范围 |

默认种子脚本已意图将默认 `admin` 用户绑定到 `super_admin`；生产环境仍需检查 `sys_user_role` 中实际关联，不能仅凭用户名推断权限。

## 3. 范围

本方案覆盖：

- API Token 的认证、授权、接口契约与数据模型；
- 默认 `admin` 用户的角色关联修复与持续校验；
- 后台 API Token 管理界面；
- 自动化测试、OpenAPI 与上线验收；
- CRM Dashboard 的 PAT 实测验证。

本方案不改变现有角色、权限码、数据范围模型，也不改变 API Token 的创建、撤销、过期和最后使用时间等生命周期能力。

## 4. 目标设计

### 4.1 认证与授权职责分离

| 层 | 责任 | 不应承担的责任 |
| --- | --- | --- |
| API Token | 证明请求来自哪个用户；校验撤销、有效期、用户禁用状态 | 定义接口权限、数据范围、角色 |
| 用户 / 角色 | 维护角色绑定 | 保存某一枚 Token 的权限副本 |
| RBAC | 依据当前角色计算权限码与数据范围，并校验接口 | 与 Token scope 求交集 |
| 业务服务 | 依据 RBAC 数据范围过滤医院、客户等数据 | 自行识别 Token 类型绕过授权 |

授权伪代码：

```ts
const token = await ApiTokenRepository.findByRawToken(rawToken)
assert(token && token.status === 'active' && !token.expiresAtPassed)

const user = await UserService.getById(token.userId)
assert(user && user.status === 'active')

request.currentUser = user
// 不写入 request.tokenScope

const roles = await PermissionService.getRolesForUser(user.id)
const effectivePermissions = PermissionService.getRolePermissions(roles)
const effectiveDataScope = PermissionService.getDataScope(roles)
```

同一 `userId` 使用 JWT 和 PAT 请求时，`effectivePermissions`、`effectiveDataScope` 必须一致。

### 4.2 动态生效规则

- 给用户新增角色：该用户全部未撤销 PAT 在下一个请求立即获得新增权限。
- 移除用户角色：该用户全部 PAT 在下一个请求立即失去相应权限。
- 禁用用户：该用户的 JWT 与 PAT 均不可用。
- 撤销或过期 PAT：仅该 PAT 不可用，不影响用户的其他登录方式。
- 超级管理员：由当前 `super_admin` 角色判定；不得通过 Token scope 或特殊字符串授予。

权限缓存若存在，角色、权限、用户状态变更流程必须同步失效对应用户的权限缓存。不得以“重新签发 Token”作为角色变更生效条件。

## 5. 代码实施清单

### 5.1 后端认证与 RBAC

修改以下文件：

- `apps/yishan-api/src/core/plugins/external/jwt-auth.ts`
- `apps/yishan-api/src/core/plugins/external/rbac.ts`
- `apps/yishan-api/src/core/services/permission.service.ts`

实施要求：

1. PAT 的 `authenticate` 和 `softAuthenticate` 分支均只设置当前用户，不得设置 `request.tokenScope`。
2. 删除 `tokenScope` 的请求扩展类型、日志字段及其所有读取位置。
3. `rbac` 只从用户的当前角色计算有效权限和数据范围。
4. 删除 `computeEffectivePerms(rolePerms, tokenScope, permissionCodes)` 中的 scope 求交逻辑；若该方法没有其他调用方，改为清晰的角色权限计算方法或删除。
5. 删除 `PAT_WILDCARD`、`__super_admin__` 等仅为 Token scope 服务的常量和分支。
6. 保留 Token 哈希查询、状态/过期校验、所属用户禁用校验、异步 `touch(lastUsedAt)`；不得记录原始 Token。

### 5.2 Token 管理 API 与 OpenAPI

涉及文件：

- `apps/yishan-api/src/core/schemas/api-token.ts`
- `apps/yishan-api/src/core/routes/api/v1/me/api-tokens/index.ts`
- `apps/yishan-api/src/core/services/api-token.service.ts`
- 对应 OpenAPI 生成产物及客户端类型。

新契约：

```json
POST /api/v1/me/api-tokens
{
  "name": "报表自动化",
  "expiresAt": "2026-12-31T15:59:59.000Z"
}
```

- 请求体和返回体删除 `scopes`。
- 删除 `GET /api/v1/me/api-tokens/available-scopes` 路由、服务方法与菜单入口。
- Token 列表和详情不再显示“权限范围”。可展示所属用户、名称、状态、到期时间、最近使用时间和创建时间。
- 对携带 `scopes` 的新建请求返回明确的 4xx 参数错误，例如“`scopes` 已废弃，Token 权限继承所属用户当前 RBAC 角色”。不要静默忽略，避免调用方误以为限制仍生效。
- 更新 OpenAPI 后，使用生成的类型，不保留前端手写的旧 `scopes` 类型兼容层。

### 5.3 数据模型与两阶段迁移

当前 `sys_api_token.scopes` 为 JSON 字段。不要在首个发布版本同时删除物理列和读取逻辑，按两阶段迁移降低回滚风险。

#### 发布 A：行为切换

1. 所有运行时代码停止读取、写入和返回 `scopes`。
2. 数据库列暂时保留，标记为 deprecated，仅用于审计和快速回滚，不参与任何授权。
3. 发布前导出 Token 清单：Token ID、用户 ID、名称、状态、到期时间、旧 scopes、当前角色与当前有效权限摘要。
4. 识别非空旧 scopes：这些 Token 切换后可能因其所属用户角色而拥有更多权限。由安全负责人确认是否需要提前撤销并要求重签发。

#### 发布 B：物理清理

在发布 A 稳定至少一个完整业务周期、确认没有旧客户端提交 `scopes` 后：

1. 从 Drizzle 表定义 `apps/yishan-api/src/db/schema/tables.ts` 删除 `scopes`。
2. 生成并审阅 migration，执行 `ALTER TABLE sys_api_token DROP COLUMN scopes`。
3. 删除 repository 中 `scopes` 的类型、JSON 规范化与 insert/update 字段。
4. 删除旧 scope 相关测试和文档。

数据库变更必须通过项目既有 Drizzle migration 流程生成和执行，不在应用启动时执行 DDL。迁移前备份 `sys_api_token`，迁移后执行一次 schema diff 校验。

### 5.4 Repository 与服务层

涉及文件：

- `apps/yishan-api/src/core/repositories/api-token.repository.ts`
- `apps/yishan-api/src/core/services/api-token.service.ts`

发布 A 中 repository 可暂保留数据库列的读取兼容，但禁止将它暴露到领域对象/API 响应，也禁止参与权限计算。服务层移除：

- scope 格式校验；
- “所选 scope 必须属于当前角色”的校验；
- `getAvailableScopesForUser`；
- scope 默认值、通配符与超级管理员特殊处理。

Token 创建仍必须校验名称、数量上限、有效期、当前用户身份与管理权限；这些是 Token 生命周期规则，不是授权 scope。

### 5.5 管理端

涉及 API Token 管理页面及其请求类型：

- 删除 scope 多选框、权限树、`*` 选项和“可用权限”加载请求；
- 创建弹窗增加固定说明："此 Token 自动继承当前账号的角色权限；账号角色变化会立即生效。"；
- 详情页显示“权限来源：当前账号 RBAC”，可跳转到用户角色管理（须有权限时）；
- 删除前提示保留“撤销后不可恢复”，不混入权限范围文案；
- 处理后端对旧 `scopes` 参数返回的 4xx，提示升级调用脚本而非重试。

## 6. 默认 admin 用户修复

### 6.1 原则

`admin` 是默认用户名，不是权限判断条件。权限仅来自 `sys_user_role` 与角色编码 `super_admin`。

### 6.2 上线前检查

对目标环境执行只读核查，确认：

1. 用户名为 `admin` 的账号存在且处于启用状态；
2. 该用户在用户-角色关联表中关联到启用的 `super_admin` 角色；
3. `super_admin` 拥有系统配置中所有当前有效权限码和全量数据范围；
4. 不将角色编码 `admin` 误视为超级管理员。

### 6.3 修复方式

将默认账号角色绑定写成可重复执行的管理修复/种子校验：发现缺少关联时补齐 `admin user -> super_admin role`，已有正确关联时不重复插入。该步骤必须记录审计日志，并在生产执行前取得变更审批。

不得通过以下方式“修复”：

- 给某枚 Token 写入 `*` scope；
- 在路由中对用户名 `admin` 特判放行；
- 给普通 `admin` 角色直接复制超级管理员权限。

## 7. 测试计划

### 7.1 单元测试

更新或替换以下测试：

- `apps/yishan-api/test/api-token.service.test.ts`
- `apps/yishan-api/test/pat.lifecycle.test.ts`
- `apps/yishan-api/test/rbac.pat.test.ts`
- `apps/yishan-api/test/me.api-tokens.routes.test.ts`

最低覆盖：

| 场景 | 预期 |
| --- | --- |
| 普通用户 JWT 与 PAT 请求同一受保护接口 | 状态码和权限结论一致 |
| 超级管理员 JWT 与 PAT 请求 CRM Dashboard | 均成功 |
| 客服角色 PAT 请求仅客服允许接口 | 成功；越权接口拒绝 |
| 医院账号 PAT 请求跨医院数据 | 依据当前数据范围拒绝 |
| 给持 Token 用户新增/移除角色 | 下一个请求立即变化，无需重签发 |
| 禁用用户 | JWT 和 PAT 均拒绝 |
| 撤销/过期 Token | 仅该 PAT 拒绝 |
| POST Token 带 `scopes` | 明确 4xx；不静默接受 |
| Token 响应与 OpenAPI | 均不含 `scopes` |

删除以 scope 求交、通配符、超级管理员 scope 哨兵为行为前提的断言，改为验证角色权限继承。

### 7.2 集成测试：三类角色

补充端到端/集成测试，使用三名真实测试用户和分别签发的 PAT：

1. `super_admin`：访问 Dashboard、医院筛选、全局统计；
2. 客服：只访问被分配且具备权限的 CRM 数据；
3. 医院账号：只能读取本医院数据，传入其他 `hospitalId` 必须无权或被服务端约束。

测试应同时覆盖会话/JWT 与 PAT，断言两种身份方式的响应状态和数据范围相同。现有 `test-all-routes.sh` 中的 Token 创建 payload 要移除 `scopes: ["*"]`。

### 7.3 CRM Dashboard 回归

在具备 `crm:dashboard:view` 的超级管理员账号下，分别使用浏览器会话和 PAT 请求：

```text
GET /api/crm/v1/dashboard/stats
GET /api/crm/v1/dashboard/stats?hospitalId=<有效医院ID>
GET /api/crm/v1/dashboard/stats?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
```

验收：

- 不带筛选和带筛选的统计值按数据变化；
- PAT 与会话获得一致的权限结论；
- 无 CRM 权限的用户得到标准 403/业务权限错误，而非数据泄漏；
- 日期范围采用半开区间 `[startOfDay, nextDay(endDate))`，避免结束日 00:00 后的数据被排除；
- `hospitalId` 必须为正整数，且所有 customer/hospital/dispatch 查询都应用同一个医院范围，避免“局部指标变化、其他指标全局不变”。

后两项为 Dashboard 当前筛选可信度的必要修复，应与本次权限验收一并纳入回归。

## 8. 发布步骤与回滚

### 8.1 发布前

1. 完成代码审查、单元测试、三角色集成测试和 OpenAPI 校验。
2. 导出活跃 Token 及其旧 scope 审计清单，评估权限扩大风险。
3. 核查并修复默认 `admin -> super_admin` 关联。
4. 通知 API 调用方：创建 Token 请求将不再接受 `scopes`；Token 权限随账号 RBAC 实时变化。
5. 准备可观测指标：PAT 认证成功/失败、RBAC 拒绝、禁用用户拒绝、撤销 Token 拒绝，标签中不含原始 Token。

### 8.2 发布 A

1. 先发布后端认证/RBAC 和 API 契约变更。
2. 立即运行自动化冒烟：超级管理员、客服、医院账号各用 JWT 与 PAT 调用受保护接口。
3. 发布管理端，移除 scope UI。
4. 重点观察权限拒绝率、Dashboard 403 比例和 Token 创建参数错误率。

### 8.3 回滚

发布 A 不删除数据库列，因此可回滚应用代码。回滚前必须评估：已创建的新 Token 没有 scope 数据，回滚到旧“scope 求交”代码会导致其权限为空或异常。若必须紧急回滚，应优先回滚为“忽略 scope、只认 RBAC”的兼容版本，而不是恢复旧授权语义。

发布 B 删除列后，恢复旧版本将不受支持；因此发布 B 前必须确认发布 A 已稳定并完成旧客户端清理。

## 9. 验收清单

- [ ] API Token 不再存储、返回或参与计算 `scopes`。
- [ ] PAT、JWT、会话对同一用户和接口得到相同的有效权限与数据范围。
- [ ] 用户角色变更无需重签发 PAT 即生效。
- [ ] 用户禁用、Token 撤销和 Token 过期均按预期生效。
- [ ] 默认用户名 `admin` 已实际绑定 `super_admin`，普通 `admin` 角色未被错误提权。
- [ ] OpenAPI、管理端和自动化脚本均移除 `scopes`。
- [ ] 三类角色的集成测试通过。
- [ ] Dashboard 的 PAT 验证通过，医院和日期筛选对全部相关指标一致生效。
- [ ] 发布 A 稳定后再执行 `scopes` 列的物理删除。

## 10. 不采用的方案

- **给 Token 分配更大 scope**：仍然保留第二套权限系统，无法解决角色变更滞后和排障复杂度。
- **Token scope 与角色取并集**：会让 Token 成为提权入口，违反最小授权和可审计原则。
- **对用户名 `admin` 绕过 RBAC**：将身份名称与权限绑定，无法适用于其他管理员，也会留下安全后门。
- **前端隐藏 scope 但后端继续执行**：表面简化、实际行为不透明，问题会继续存在。

本方案的唯一授权事实来源是用户当前 RBAC；API Token 只是一把可撤销、可过期、可审计的登录钥匙。
