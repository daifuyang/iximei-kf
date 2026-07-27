# 医院一院一账号：强制约束与实施规范

## 1. 定位与原则

本规范是医院账号模型的唯一实施依据，**不考虑向后兼容**。

- 不保留一院多账号、一账号多院能力。
- 不保留旧医院账号管理 API、页面入口、关系表或数据读路径。
- 不为旧接口提供 410、转发、双写或降级逻辑。
- 不从当前新系统迁移医院/医院账号数据；上线前清空该范围数据，以老系统为唯一源重新同步。
- 任意约束不满足时，操作必须失败并回滚；不得“跳过后继续”“取第一条”“仅打印警告”。

## 2. 不可变业务规则

```text
一条有效医院记录  <=>  一条有效医院系统账号
医院名称             =   医院账号 username
医院账号             =>  仅可访问该医院的数据
```

具体约束：

1. 每个有效医院必须有且仅有一个账号。
2. 每个医院账号必须有且仅能归属一个医院。
3. `hospital_name` 和医院账号 `username` 均为去首尾空格后的 1–50 字符，且严格相等。
4. 创建医院必须提供初始密码；医院与账号必须在一个数据库事务内创建。
5. 普通医院资料更新不允许修改医院名称。
6. 医院改名仅允许持有专用 RBAC 权限的用户执行。
7. 医院账号没有跨院读取、跨院写入、跨院账号管理能力。

## 3. 数据库作为最终约束

### 3.1 唯一关系来源

只保留：

```text
crm_hospital.account_user_id  NOT NULL UNIQUE
  REFERENCES sys_user.id
```

必须执行以下物理变更：

1. `crm_hospital.account_user_id` 改为 `NOT NULL`。
2. 保留该列唯一索引，保证一个用户不能归属多个医院。
3. 增加到 `sys_user(id)` 的外键，使用 `ON DELETE RESTRICT`。
4. `crm_hospital.hospital_name` 改为 `VARCHAR(50) NOT NULL UNIQUE`。
5. `sys_user.username` 改为 `VARCHAR(50) NOT NULL UNIQUE`。
6. 删除 `crm_hospital_account` 表、Drizzle 定义、所有索引和所有引用。

不允许依赖“服务层约定”替代 `NOT NULL`、唯一索引或外键。

### 3.2 允许的删除语义

- 医院删除：软删医院、禁用关联账号、撤销该账号全部 Token；不物理删除 `sys_user`。
- 系统用户删除：若被 `crm_hospital.account_user_id` 引用，数据库外键必须拒绝。
- 医院停用：同步禁用关联账号并撤销 Token。
- 医院恢复：不自动恢复账号；账号必须由有权限的管理员单独启用。

## 4. RBAC 强制规则

### 4.1 权限码

新增且只用于改名：

```text
crm:hospitals:rename
```

该权限同时控制：

- `POST /api/crm/v1/hospitals/:id/rename`；
- 管理端“医院改名”按钮；
- 改名确认弹窗与提交动作。

前端隐藏按钮不构成安全控制；后端接口权限校验是唯一授权依据。

### 4.2 角色矩阵

| 能力 | super_admin | hospital_account |
| --- | --- | --- |
| 新建/删除医院 | 允许 | 拒绝 |
| 修改任意医院资料 | 允许 | 拒绝 |
| 改医院名称 | `crm:hospitals:rename` | 拒绝 |
| 查询所有医院 | 允许 | 拒绝 |
| 查询自身医院 | 允许 | 仅允许自身 |
| 查询/改账号资料 | 允许 | 仅允许自身；若产品不提供自助维护，则全部拒绝 |
| 重置医院账号密码 | 允许 | 仅允许自身；若产品不提供自助维护，则全部拒绝 |
| 派单数据 | 全部 | 仅所属医院 |

医院角色权限必须用**显式白名单**配置，禁止使用：

```ts
code.startsWith('crm:hospitals:')
```

任何新增医院权限默认不属于医院角色，必须经过显式审批后才可授予。

### 4.3 自身资源校验

医院账号如保留医院资料或账号自助查询，必须使用专用自身接口：

```text
GET   /api/crm/v1/hospitals/me
GET   /api/crm/v1/hospitals/me/account
PATCH /api/crm/v1/hospitals/me/account       （仅产品允许的字段）
POST  /api/crm/v1/hospitals/me/account/reset-password
```

医院账号不得访问管理端的 `:id` 资源接口。所有 `/hospitals/:id...` 管理接口仅供具备医院管理权限的后台角色使用。

若选择继续复用 `:id` 接口，则每个路由在读取或写入前必须校验：

```text
requestedHospitalId === currentUser 的唯一可访问 hospitalId
```

不满足时返回 403；不得返回空列表、404 或其他医院信息。

## 5. API 规范

### 5.1 保留接口

| 接口 | 权限 | 规则 |
| --- | --- | --- |
| `POST /hospitals` | `crm:hospitals:create` | 医院与唯一账号原子创建；`accountPassword` 必填 |
| `PATCH /hospitals/:id` | `crm:hospitals:update` | 不允许传 `hospitalName` |
| `POST /hospitals/:id/rename` | `crm:hospitals:rename` | 原子改医院名称与用户名，撤销 Token，写审计 |
| `GET /hospitals/:id/account` | 后台医院查看权限 | 返回唯一账号 |
| `PATCH /hospitals/:id/account` | 后台医院编辑权限 | 只允许联系方式、状态 |
| `POST /hospitals/:id/account/reset-password` | 后台医院编辑权限 | 重置唯一账号密码 |

### 5.2 删除接口

以下接口必须从路由、OpenAPI、生成客户端、Admin adapter 和页面中删除：

```text
GET    /hospitals/:id/accounts
POST   /hospitals/:id/accounts
POST   /hospitals/:id/accounts/assign
PATCH  /hospitals/:id/accounts/:userId
DELETE /hospitals/:id/accounts/:userId
```

### 5.3 响应 Schema

项目使用统一响应信封：

```json
{ "success": true, "code": 0, "message": "操作成功", "data": {} }
```

路由的 `response[200]` 必须声明该信封结构；不得用“账号原始对象”Schema 去校验 `ResponseUtil.success()` 的完整响应。若暂未定义统一信封 Schema，则不得为该路由声明会触发 Fastify 序列化的 raw response schema。

## 6. 服务层与事务规范

### 6.1 创建医院

单个事务必须按以下顺序完成：

1. 规范化医院名称（`trim`）并校验 1–50 字。
2. 检查 `sys_user.username` 不存在同名记录；数据库唯一索引仍为最终并发保护。
3. 创建 `sys_user`，`username = hospitalName`，密码由 `accountPassword` 哈希得到。
4. 绑定 `hospital_account` 系统角色。
5. 创建 `crm_hospital(account_user_id = 新用户 ID)`。
6. 提交事务。

任一步失败必须回滚，结果中不得留下孤儿用户、无账号医院或未绑定角色账号。

### 6.2 普通更新与改名

- 普通更新 DTO 和 Service 白名单中都不包含 `hospitalName`；不能仅靠前端删除字段。
- 改名接口单独接收 `newHospitalName`。
- 改名事务必须锁定医院及关联用户，更新两张表后提交。
- 改名成功后撤销关联用户所有 JWT/PAT/会话，并写入可查询审计日志。
- 改名失败时医院名称、用户名、Token 状态均不得部分改变。

### 6.3 启停与密码重置

- 禁用账号时立即撤销 Token。
- 重置密码后立即撤销旧 Token。
- 修改账号联系方式、状态、密码前，必须先确认该医院存在且账号关联完整。

## 7. 管理端强制规则

1. 新建表单提交时必须保留 `accountPassword`、`accountEmail`、`accountPhone`；只有编辑模式才能删除创建专用字段。
2. 新建表单的确认密码仅用于前端比对，提交前删除 `confirmPassword`。
3. 不得通过 `window.g_initialState` 等未定义全局变量判断权限；使用项目现有权限/Access Hook。
4. 改名按钮由 `crm:hospitals:rename` 权限控制，不得仅按 `super_admin` 角色字符串控制。
5. 医院账号页面不得加载或展示其他医院列表、详情、账号邮箱、手机号、最近登录时间。
6. OpenAPI 改动后重新生成客户端；禁止长期手写 `request<any>` 绕过类型与接口契约。

## 8. 老系统全量同步规范

### 8.1 唯一导入入口

医院账号同步只能由一个脚本负责。该脚本直接读取老系统：

```text
hj_hospital + hj_user(hospital_id, user_pass)
```

禁止先运行通用用户导入再运行医院同步。否则医院用户会被创建两次，且当老用户名等于医院名称时必然触发 `sys_user.username` 唯一索引冲突。

### 8.2 源数据硬校验

同步开始前必须完成，任一不满足即退出且不写目标库：

1. 每个老医院恰好关联一个 `hj_user.hospital_id`。
2. 每个被同步的医院名称长度为 1–50。
3. 医院名称在老系统范围内唯一。
4. 医院用户密码哈希非空且格式可按 `passwordFormat = 0` 验证。
5. `hospital_account` 系统角色存在。

### 8.3 原子性与错误处理

- 全量同步在写入目标库前先完成全部源数据审计。
- 医院账号与医院档案同一事务写入。
- 任何唯一冲突、角色缺失、字段校验失败必须使同步失败；不得捕获后记为 `skipped` 并继续。
- 同步完成后执行断言：每个医院都有唯一账号，且 `username === hospital_name`。
- 派单、客户等后续数据仅能引用已成功同步的医院；不允许因医院同步失败而静默丢弃。

## 9. 验收门禁

以下任意一项不通过，禁止发布：

### 9.1 静态门禁

- `pnpm --filter yishan-api build:ts` 通过。
- `pnpm --filter yishan-admin build` 通过。
- `git diff --check` 通过。
- Drizzle schema、SQL migration、OpenAPI、生成客户端一致。

### 9.2 自动化门禁

1. 新建医院携带密码成功；去掉密码时返回 400，且不产生用户或医院记录。
2. 两个并发同名医院创建请求最多成功一个，失败请求不产生孤儿数据。
3. 医院账号请求其他医院的列表、详情、账号资料、改名、重置密码、停用账号均返回 403。
4. 医院账号没有 `crm:hospitals:rename`，超管拥有该权限；前端按钮和接口结果一致。
5. 普通医院更新传 `hospitalName` 被拒绝或被 Schema 拒绝，不能静默忽略。
6. 改名后新名称可登录、旧名称不可登录、旧 Token 不可用、审计记录可查询。
7. 禁用和重置密码后旧 Token 不可用。
8. 同步脚本遇到一院无账号、一院多账号、超长名称、重复名称或重复导入用户时整体失败且目标库不产生部分数据。
9. 同步成功后全量断言医院数、账号数、医院账号角色数一致，且每条关系一对一。

### 9.3 本轮已知问题映射

| 问题 | 强制修复方式 |
| --- | --- |
| 同步脚本向 `sys_user_role` 写不存在字段，导致 TypeScript 构建失败 | 严格按表 Schema 写入字段；编译通过是发布门禁 |
| 新建表单删除 `accountPassword` | 仅编辑模式删除创建专用字段；新建模式必须提交密码 |
| 医院账号可读取其他医院 | 使用 `/me` 自身接口，或对全部 `:id` 接口做强制归属校验 |
| `hospital_account` 权限通配误授权 | 使用显式白名单，新增权限默认不授予 |
| 医院同步与通用用户同步重复建号 | 删除医院用户的通用导入路径，医院同步成为唯一入口 |
| 导入错误后继续并跳过记录 | 任何错误整体失败、事务回滚，禁止 `skipped` 成功返回 |
| raw response schema 与响应信封不一致 | 使用统一响应信封 Schema 或删除 raw response schema |
| 改名测试仍断言普通更新逻辑 | 测试改为独立 RBAC 改名接口的权限、事务、Token 与审计断言 |
