# 医院“一院一账号”Breaking Change 执行方案

## 0. 对齐与验收状态

### 已完成方案验收（2026-07-27）

- [x] 一家医院必须且只能拥有一个医院登录账号；一个医院账号必须且只能归属一家医院。
- [x] 医院登录用户名固定等于医院名称，医院名称与用户名统一限制为 1–50 字。
- [x] 创建医院必须在同一事务中创建账号，初始密码为必填项；不允许存在无账号医院。
- [x] 医院账号仅能访问和维护自己的医院资料与派单，不能创建、删除、查看或操作其他医院。
- [x] 医院账号不能修改医院名称。
- [x] 医院名称修改使用独立 RBAC 权限控制；医院账号没有该按钮和接口权限，超管拥有该按钮和接口权限。改名同步更新用户名、撤销会话/Token、记录审计日志。
- [x] 当前新系统不保留医院/账号历史数据；上线时从老系统重新同步，不做当前库历史数据修复迁移。

> 上述为**方案验收**，不代表代码已验收或已上线。代码、同步脚本、权限测试和发布验证仍须按下文完成。

## 1. 决策与目标

客户确认的规则：

1. 每家医院**必须且只能**拥有一个医院登录账号；
2. 每个医院登录账号**必须且只能**归属一家医院；
3. 登录时输入的用户名等于该医院当前的医院名称；
4. 医院账号只能访问其所属医院的数据；
5. 医院账号不再有 `owner/member` 等医院内角色，也不允许“分配已有用户”“新增第二账号”或“解除账号”。

本次以 `crm_hospital.account_user_id -> sys_user.id` 为唯一关系来源。现有 `crm_hospital_account` 多对多关系表停止承载权限并最终删除。

> 这是 breaking change：现有医院账号管理 API、前端账号抽屉、创建医院流程和医院名称修改语义都会改变。

## 2. 已确认的现状与问题

| 项目 | 当前实现 | 目标实现 |
| --- | --- | --- |
| 医院—账号关系 | 同时有 `crm_hospital.account_user_id` 和 `crm_hospital_account` 两套来源 | 仅保留 `account_user_id` |
| 医院账号数量 | 关系表可为一家医院创建多账号 | 恰好一个 |
| 账号归属医院数量 | 同一用户可绑定多院 | 恰好一家 |
| 数据权限 | 从 `crm_hospital_account` 汇总可访问医院 | 由 `crm_hospital.account_user_id` 唯一定位 |
| 用户名 | 全局唯一、最大 50 字 | 等于医院名称、全局唯一、最大 50 字 |
| 医院改名 | 当前可改，但不影响账号名 | 独立 RBAC 权限；医院账号无权，超管可改并同步用户名 |

旧系统也是“一院一用户”：创建医院时新建用户并写入 `user.hospital_id`。但旧系统的 `user_login` 和 `hospital_name` 是两个字段；本次按客户确认的规则，将其进一步收敛为用户名等于医院名称。

## 3. 目标数据模型与不变量

```text
sys_user
  id                内部身份主键
  username          = crm_hospital.hospital_name（医院账号）
  status            账号启停

crm_hospital
  id
  hospital_name     医院名称、登录用户名
  account_user_id   NOT NULL、UNIQUE -> sys_user.id
  status            医院启停
```

必须始终满足：

```text
每条未删除 crm_hospital：account_user_id 非空，且指向一个未删除 sys_user
每个 account_user_id：最多出现在一条 crm_hospital 中
医院账号 sys_user.username：严格等于该医院 hospital_name
医院账号数据范围：仅该医院 id
```

`crm_hospital_account` 不再存在，也不再参与任何查询、权限或导入。

## 4. 对外 API 变更

### 删除的接口

以下接口删除，不再维护多账号能力：

- `GET /api/crm/v1/hospitals/:id/accounts`
- `POST /api/crm/v1/hospitals/:id/accounts`
- `POST /api/crm/v1/hospitals/:id/accounts/assign`
- `PATCH /api/crm/v1/hospitals/:id/accounts/:userId`
- `DELETE /api/crm/v1/hospitals/:id/accounts/:userId`

如需短暂兼容，最多保留一个发布窗口并统一返回 `410 Gone` 和迁移提示；不能继续执行旧写操作。

### 新增/调整的接口

1. `POST /hospitals`
   - 请求体新增必填 `accountPassword`；可选 `accountEmail`、`accountPhone`。
   - 服务端忽略任何由客户端传来的 `username` 或 `accountUserId`。
   - 在同一事务中创建医院、创建系统用户、绑定 `hospital_account` 角色，并写回 `account_user_id`。
   - 用户名固定取 `hospitalName`。

2. `PATCH /hospitals/:id`
   - 仅更新普通医院资料，**不接受** `hospitalName`。
   - 医院账号联系方式可通过独立字段更新，不能修改用户名。

3. `POST /hospitals/:id/rename`
   - 使用新增权限 `crm:hospitals:rename`；仅为超管绑定该权限，医院账号不绑定。
   - 接收新的医院名称；服务端校验 1–50 字及全局唯一性。
   - 在同一事务中更新 `hospital_name` 与关联用户的 `username`。
   - 成功后撤销该医院账号全部会话/Token，并写审计日志。

4. `GET /hospitals/:id/account`
   - 返回唯一账号的只读信息：`userId`、`username`、`email`、`phone`、`status`、`lastLoginTime`。

5. `PATCH /hospitals/:id/account`
   - 仅允许更新 `email`、`phone`、`status`。

6. `POST /hospitals/:id/account/reset-password`
   - 接收新密码，服务端哈希后更新；记录审计日志。

所有 OpenAPI operationId、生成的 Admin service、权限声明、接口测试必须同步更新。

## 5. 后端实施步骤

### 5.1 Schema 与迁移

1. 保持 `sys_user.username` 的现有 50 字容量不变；将 `crm_hospital.hospital_name` 的数据库字段、请求校验和管理端输入统一收紧为 1–50 字。
2. 保留并确认以下约束：
   - `crm_hospital.hospital_name` 全局唯一；
   - `crm_hospital.account_user_id` 唯一；
   - `crm_hospital.account_user_id` 非空（数据清理完成后执行）。
3. 为 `account_user_id` 建立到 `sys_user.id` 的外键（`ON DELETE RESTRICT`）；若当前生产库不采用外键，至少在迁移前检查并在服务层事务内强制校验。
4. 删除 `crm_hospital_account` 表及相关索引，只能在代码切换且核验通过后执行。
5. 修改 Drizzle schema 并生成新的迁移文件；不手写覆盖历史迁移。

### 5.2 Repository / Service

1. 删除 `HospitalsRepository` 中所有 `crmHospitalAccount` 的读写方法：`findAccount`、`listAccounts`、`createAccount`、`assignAccount`、`updateAccount`、`countOwners`。
2. 改写 `accessibleHospitalIds(userId)`：从 `crm_hospital` 查询 `account_user_id = userId`，并同时过滤医院启用、医院未删除、用户未删除且用户启用。
3. 新增医院创建事务：
   - 校验医院名称 1–50 字；
   - 校验用户名未被占用；
   - 新建 `sys_user(username=hospitalName, passwordHash, email, phone)`；
   - 绑定 `hospital_account` 系统角色；
   - 新建医院并写入 `accountUserId`；
   - 任一步失败均回滚。
4. 新增受 `crm:hospitals:rename` 保护的医院改名事务：锁定医院及其账号，校验新名称未占用，同时更新 `hospital_name` 与 `sys_user.username`，撤销该账号会话/Token 并写审计日志。普通医院资料更新不允许传入 `hospitalName`。
5. 删除医院账号角色 `owner/member` 的校验与字段；医院账号固定为系统角色 `hospital_account`。
6. 删除医院账号时不再存在；医院停用时同步禁用关联账号。恢复医院时是否同步启用账号需按“账号状态独立”原则处理：默认不自动启用，要求管理员显式启用。
7. 医院删除改为软删除医院、禁用账号、撤销该用户的有效会话/Token，并写审计日志；禁止物理删除关联系统用户。

### 5.3 权限与作用域

1. 将 dispatch、dashboard、医院列表/详情/账号管理等所有 `hospital_account` 分支统一改用新的 `accessibleHospitalIds`；所有按 `:id` 操作先校验目标医院属于当前账号。
2. 对医院账号，结果必须恰好为一个医院 ID；结果为 0 时拒绝访问并记录异常，而非回退为全量数据。
3. 新增权限 `crm:hospitals:rename`，后端改名接口和前端改名按钮均使用该权限；仅超管绑定。注意医院角色当前按 `crm:hospitals:*` 批量授权，必须改为显式权限白名单或在批量规则中排除 `crm:hospitals:rename`，否则医院账号会意外获得改名权限。
4. `hospital_account` 角色移除医院新建、删除、跨院编辑、跨院账号管理权限；内部系统管理员保留跨院管理权限。内部客服/管理员的跨院权限仍使用 RBAC 和数据范围；不得通过绑定医院账号取得跨院权限。

### 5.4 导入脚本

1. 上线时清空新系统待同步的医院/账号业务数据，从老系统全量重新同步；不处理当前新系统历史数据。
2. `import-iximei-hospitals.ts` 不再写 `crm_hospital_account`，并直接按“老医院 + 唯一关联老用户”创建新医院和新账号。
3. 导入时仅接受每个旧 `hospital_id` 恰好匹配一个用户；0 个或多于 1 个都输出阻断报告并终止，而不是任意取第一条。
4. 新账号的用户名一律写入医院名称（不沿用老系统 `user_login`）；密码哈希按既有老密码兼容方案导入，确保用户使用“医院名称 + 原密码”登录。

## 6. 管理端实施步骤

1. 移除医院列表的“账号数 / 账号管理”抽屉和所有多账号 API 调用。
2. 医院列表改为展示：`医院名称（即登录用户名）`、账号状态、最近登录时间、账号联系方式。
3. 新建医院表单增加“初始密码、确认密码、账号邮箱、账号手机号”；不提供用户名输入框，实时提示“登录用户名将使用医院名称”。
4. 编辑医院时：
   - 医院名称对无 `crm:hospitals:rename` 权限的用户不可编辑；超管显示独立“医院改名”按钮，并明确提示“登录用户名会同步变更，现有会话会失效”；
   - 联系方式可编辑；
   - 密码放在独立“重置密码”操作；
   - 账号启停放在独立操作；
   - 不提供新增/分配/解绑账号操作。
5. 登录页把提示文案由“用户名”调整为“医院名称或后台用户名”；不改变管理员/客服的正常用户名登录。
6. 从 OpenAPI 重新生成 `services/generated`，删除旧的 `*CrmHospitalAccount*` 类型与调用。

## 7. 数据迁移与发布 Runbook

### 7.1 同步前源系统审计（必须全部为 0 才能执行同步）

```sql
-- A. 老系统一院必须恰好一账号
SELECT hospital_id, COUNT(*) AS cnt
FROM hj_user
WHERE hospital_id IS NOT NULL
GROUP BY hospital_id
HAVING COUNT(*) <> 1;

-- B. 老系统同一用户不能归属多院
SELECT id, COUNT(DISTINCT hospital_id) AS cnt
FROM hj_user
WHERE hospital_id IS NOT NULL
GROUP BY id
HAVING COUNT(DISTINCT hospital_id) <> 1;

-- C. 老医院名称必须符合新登录名限制
SELECT id, hospital_name, CHAR_LENGTH(hospital_name) AS name_length
FROM hj_hospital
WHERE CHAR_LENGTH(hospital_name) > 50;
```

任何查询返回记录都必须人工处置并留档；严禁在迁移脚本中“取第一条”或静默删除账号。

### 7.2 数据处置原则

| 异常 | 处置 |
| --- | --- |
| 医院无账号 | 修正老系统关系后重新执行同步；不得在新系统临时补建 |
| 一院多账号 | 业务在老系统指定唯一保留账号后重新同步；不得随机取第一条 |
| 一账号多院 | 修正老系统归属；如实际是内部人员，不将其作为医院账号同步 |
| 医院名超过 50 字 | 先人工规范名称；不得截断后直接作为用户名 |

### 7.3 发布顺序

1. 做生产库备份并记录恢复点；清空待同步的新系统医院/账号业务数据并冻结写操作。
2. 运行老系统源数据审计，修正全部异常并由业务签字确认。
3. 部署新读路径、独立改名接口与 Admin 新界面；删除旧多账号接口。
4. 执行数据库 contract migration：`account_user_id NOT NULL`、`hospital_name` 收紧为 50 字、外键（若启用）、删除 `crm_hospital_account`。
5. 从老系统执行全量同步；同步脚本遇到一院多账号、无账号或超长医院名必须失败。
6. 运行医院账号、客服、系统管理员的登录与全量权限回归；解除写入冻结。

### 7.4 回滚边界

在删除 `crm_hospital_account` 前，可回滚应用到旧版本。删除该表并完成全量同步后，不能通过应用版本回滚恢复多账号功能，只能从发布前数据库备份恢复。因此删除表和清空待同步数据必须单独审批。

## 8. 验收与自动化测试

必须新增或更新以下测试：

1. 新建医院时原子创建唯一账号，用户名严格等于医院名称。
2. 同名医院或同名系统用户名存在时，新建医院整体失败且不留下用户孤儿数据。
3. 任意医院账号只能查询到一个医院；无法读取、修改、回复其他医院派单。
4. 医院账号调用普通医院更新接口传入 `hospitalName` 被拒绝；医院账号调用改名接口返回 403 且不显示改名按钮；超管调用独立改名接口后，旧用户名登录失败、新医院名称登录成功、已有会话失效并生成审计记录。
5. 改名目标与其他系统用户名冲突时，医院名称和用户名均不变。
6. 医院停用后账号无法登录；医院恢复后账号仍须显式启用。
7. 后台管理员、客服等非医院账号仍可按原用户名/邮箱登录，不受影响。
8. 旧五个多账号 API 返回删除后的预期（404 或约定的 410），且 OpenAPI 中不再出现。
9. 同步脚本对 0/多条老医院账号关系、医院名称超过 50 字给出阻断报告；成功同步后每条医院均有唯一账号且 `username === hospitalName`。
10. 使用迁移后的历史数据做权限回归：医院账号、客服、管理员各自数据范围正确。

## 9. 实施完成定义

以下条件全部满足才可关闭本变更：

- 数据库和服务层均无法形成一院多账号或一账号多院；
- 所有医院账号的用户名等于医院名称；
- 数据权限不再读取 `crm_hospital_account`；
- 管理端不再提供多账号入口；
- OpenAPI、生成客户端、单元/集成测试均已更新；
- 生产审计、备份、迁移记录和回归结果已归档。
