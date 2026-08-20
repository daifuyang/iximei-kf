# A 阶段 Bug 热修设计文档

> 日期：2026-07-28
> 范围：本仓库 Yishan CRM 模块 `apps/yishan-api/src/modules/crm/` + `apps/yishan-admin/src/modules/crm/pages/members/`
> 关联计划：本文档产生两个 Plan：A.bugs-mobile-search / A.bugs-creation-validation
> 不在本阶段：医院账号登录失败问题（拆为 A.hospital-login-spike 单独交付）

## 0. 背景与目标

收到运营反馈三条 Bug：

1. 「顾客 → 转为会员顾客」时输入完整手机号，应只匹配该手机号对应的顾客，但当前会把全部顾客查询出来。
2. 「已有顾客转会员」「直接新增会员」均返回 400 且带代码/错误信息，前端捕获不到原因并直接呈现 400 给运营。
3. 总后台创建/重置医院账号密码后，「医院后台」登录失败（仅个别早期测试医院可登录）。

本阶段（Phase A）目标：
- 修掉 #1、#2 的代码缺陷；
- 对 #3 输出一份"诊断 + 修复脚本"交付，由人工或 DBA 执行，**不在线上数据库上自动改写**。

Phase B（不在本文档范围）：医院查看顾客记录 + 医院数据看板 + 未查看订单提醒 = 完整业务闭环。

---

## 1. 范围与非范围

### In-scope
- A.1：可转会员客户查询接口 `GET /api/crm/v1/customers/selectable` 支持手机号精确查询。
- A.2：`POST /api/crm/v1/members/from-customer` 与 `POST /api/crm/v1/members/direct` 的 400 根因排查 + 最小修复 + 前端错误展示。
- A.3：医院账号登录失败的根因报告 + 仅 DB 修复脚本（不自动执行）。

### Out-of-scope
- 不修改 `HOSPITAL-SINGLE-ACCOUNT-STRICT-SPEC.md` 已确定的"一院一账号"语义。
- 不引入新表或迁移。
- 不重构 `customers`/`members` 的数据权限策略。
- 不改前端整体风格或重设计 dialog。
- 不在本文档中解决 Phase B（医院查看记录等）的需求。

---

## 2. 关键约束

- 不破坏 `crm` 模块公共契约（路由 operationId、表名 prefix）。
- 改动需向后兼容：传入旧 `keyword` 时行为不变。
- TypeBox schema 与 Drizzle schema 字段必须保持一致；新增 schema 字段后必须重生成 OpenAPI（参见 CLAUDE.md）。
- 新增字段默认 `Type.Optional(...)`，避免对已有调用方造成任何破坏。
- 状态码沿用 `{ success, code, message, data }` 信封，由 `BusinessError` 抛出（参见 `BusinessError` / `ValidationErrorCode`）。

---

## 3. A.1 — 会员顾客手机号精确查询

### 3.1 根因

`MembersRepository.listSelectableCustomers` 当前用 LIKE 子串匹配：

```ts
if (q.keyword) {
  c.push(or(
    like(crmCustomer.name, `%${q.keyword}%`),
    like(crmCustomer.mobile, `%${q.keyword}%`),
    like(crmCustomer.numberId, `%${q.keyword}%`),
  )!)
}
```

当 `keyword = "13800138000"`（11 位手机号）时，会匹配所有含此子串的字段——尽管生产上 11 位完整子串重复概率不高，但**业务语义**与"按手机号唯一查找"相悖。当前查询是「全字段模糊匹配」，与原意不符。前端 `apps/yishan-admin/src/modules/crm/pages/members/index.tsx:925` 在「直接新增会员」分支为手机号做去抖反查时也走这同一个接口，所以同一个接口语义对两个分支都很关键。

### 3.2 修复设计

#### 3.2.1 后端 Schema
- `apps/yishan-api/src/modules/crm/schemas/members.schema.ts`
- `CrmCustomerSelectableQuerySchema` 在 `Type.Object({...})` 内新增可选字段：
  - `mobile: Type.Optional(Type.String({ pattern: '^1[3-9]\\d{9}$', maxLength: 11 }))`
  - `name: Type.Optional(Type.String({ maxLength: 50 }))`
  - 保留 `keyword` 不变（向后兼容）。

字段顺序按 schema 文件已建立的"先 pageQuery 后业务字段"惯例。Pattern 串遵循同 schema 中 mobile 校验习惯（参考 `CrmMemberDirectReqSchema.name=mobile`）。

#### 3.2.2 后端 Repository
`apps/yishan-api/src/modules/crm/repositories/members.repository.ts` 的 `listSelectableCustomers(q)`：
- 当 `q.mobile` 合法时：替换 `keyword` 分支为 `eq(crmCustomer.mobile, q.mobile)` 精确匹配。
- 当 `q.name` 存在时：`like(crmCustomer.name, ...)` 改为前缀匹配 `like(name, '${q.name}%')`，保留 LIKE 但语义化为"按姓名精确/前缀匹配"。
- `q.keyword` 仍走原 LIKE 模糊匹配（向后兼容）。

新增测试：
- `apps/yishan-api/src/modules/crm/tests/members.selectable.test.ts`
  - 输入 `mobile=13800138000`：仅返回 mobile 字段完全相等的客户。
  - 输入 `name=张三`：返回 `name LIKE '张三%'` 的客户（不会返回"张三丰123"以外的模糊）。
  - 输入 `keyword=138`：仍按原 LIKE 模糊匹配（向后兼容）。
  - 输入 `mobile=...` 但格式错（10 位）：忽略 mobile，落到 keyword/默认。

#### 3.2.3 前端
- `apps/yishan-admin/src/modules/crm/api/index.ts`：`getSelectableCustomers` 增加 `mobile` / `name` 形参，但函数签名仍 `(params: object)` 已够用，保持兼容。
- `pages/members/index.tsx` 中：
  - 「顾客搜索框」（line ~180-240）：把 `keyword` 替换为：
    - 若用户输入严格匹配 `^1[3-9]\d{9}$`，把参数改为 `{ mobile: value }`，并在 `res.data.length === 0` 时显示「未找到对应顾客」提示（清空结果 `customerSearchResult`，保留搜索词）。
    - 否则仍保留 `{ keyword: value, page, pageSize }`。
  - 「直接新增 → 手机号去抖反查」(line 923-925)：改为 `{ mobile: value, pageSize: 5 }`，命中即按既有逻辑弹窗，未命中清空 conflict 状态。
- 在 `customerSearchResult === 0 && customerSearchKeyword` 时，给一个友好空态文案，避免出现"输入完整手机号后什么都不显示让用户以为 bug"。

#### 3.2.4 测试覆盖（vitest）
新增 mock DB 文件：`apps/yishan-api/src/modules/crm/tests/fixtures/selectable-customers.fixture.ts`
- 准备 3 条顾客数据：
  - 1：`mobile=13800138000`（查询目标）
  - 2：`mobile=13800138001`
  - 3：`mobile=13800138000` 但 `deletedAt` 已设置（软删）。

期望：`{ mobile: '13800138000' }` 只返回 id=1；`{ keyword: '13800' }` 仍返回 id=1、id=2；`{ mobile: '13800138000' }` 不返回 id=3。

### 3.3 验收
- 输入完整 11 位手机号，仅返回该手机号对应的未软删顾客。
- 输入不存在的手机号，显示「未找到对应顾客」空态。
- 输入完整手机号作为模糊关键词时仍按原行为兼容（保留 keyword 兜底）。

---

## 4. A.2 — 会员顾客创建返回 400 根因排查与最小修复

### 4.1 排查范围（仅阅读代码，不动修复）

调用栈：
1. 前端 `pages/members/index.tsx:457 handleCreate` → `normalizeFollowUpPayload` → `createMemberFromCustomer(payload)` / `createMemberDirect(payload)`
2. API 路由 `apps/yishan-api/src/modules/crm/routes/v1/members/index.ts:122 from-customer`、`:140 direct`
3. `MembersService.createFromCustomer` / `createDirect`（line 167、248）
4. `MembersRepository.create` → Drizzle insert

TypeBox schema：
- `CrmMemberFromCustomerReqSchema` / `CrmMemberDirectReqSchema` 字段类型已枚举在 `members.schema.ts:30-83`。
- 时间类字段：
  - `expectedDate: Type.String({ format: 'date' })` → 必须是 `YYYY-MM-DD`。
  - `birthday: Type.String({ format: 'date' })` → 必须是 `YYYY-MM-DD`。
  - `nextFollowUpAt: Type.String({ format: 'date-time' })` → 必须是 ISO 字符串。
- 数字字段：`preferredHospitalId`、`ownerUserId` 用 `Type.Integer({ minimum: 1 })`。

### 4.2 已知风险点（最可能的 400 来源）

经排查，最可能的根因有两条：

**R1：`birthday` / `expectedDate` 校验失败**

前端 `pages/members/index.tsx`：
- `ProFormDatePicker name="birthday"` 默认返回 `dayjs` 对象；
- `ProFormDatePicker name="expectedDate"` 默认返回 `dayjs` 对象；
- `normalizeFollowUpPayload` 仅转换 `nextFollowUpAt`，**没有覆盖 `birthday` / `expectedDate`**。

`ProFormDatePicker` 经 `name` 提交的实际值是 `dayjs`，被 `JSON.stringify` 后序列化为 `"2026-08-20T07:00:00.000Z"` 之类的 ISO 字符串，**不是 YYYY-MM-DD**，被后端 TypeBox `format: 'date'` 拒 400。

修复方向（最小）：
- 在 `normalizeFollowUpPayload` 中加入：
  ```js
  const toDate = (v) => {
    if (v === undefined || v === null || v === '') return v;
    if (typeof v === 'string') return v;
    if (v && typeof v === 'object' && typeof v.toDate === 'function') return v.toDate();
    return v;
  };
  // expectedDate / birthday 期望 YYYY-MM-DD
  function toDateOnly(v) {
    const d = toDate(v);
    if (!d) return v;
    const dd = (d instanceof Date) ? d : (typeof d.toDate === 'function' ? d.toDate() : d);
    if (dd instanceof Date && !Number.isNaN(dd.getTime())) {
      const y = dd.getFullYear(); const m = String(dd.getMonth() + 1).padStart(2, '0'); const day = String(dd.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
    return v;
  }
  ```
  将 `expectedDate`、`birthday` 都规整为 YYYY-MM-DD。
- 测试：在 `pages/members/index.tsx` 添加 `__tests__/normalize.test.ts`：覆盖 dayjs、Date、字符串三种输入。

**R2：医院、性别/枚举值超界**

`CrmMemberDirectReqSchema.gender: Type.Integer({ minimum: 0, maximum: 2 })`。
- 但 `'0'`、`'1'`、`'2'` 数字字符串通过 `Number(v)` 后仍是 0/1/2，正常 OK。
- 反例：`null` / `undefined` / 缺失时前端 `valueEnum` 的 `initialValue=0`，正常。

确认无 R2 类问题。仅作为后续 QA 时关注点。

**R3：`BusinessError` 抛 4xx 时前端展示**

当前 `apps/yishan-admin/src/modules/crm/api/index.ts` 的 `request` 包装（来自 ant-design-pro 全局 request）会把 4xx body 的 `success=false` 给到 `.then`，而 5xx 或网络失败走 `.catch`。`pages/members/index.tsx:478-483`：

```tsx
if (res?.success) {
  ...
} else {
  message.error(res?.message || '创建失败');
}
catch (e: any) {
  message.error(e?.message || '创建失败');
}
```

所以业务错误（`code=20xxx` 之类）会走到 `else` —— **但若后端用 Fastify 默认 400 而非我们的 `{success:false}` 信封时，request 会扔出**，catch 里 `e.message` 通常是 `"Request failed with status code 400"`，**这正是用户看到的「直接展示 400」现象**。

修复方向（最小）：
- 在 `pages/members/index.tsx:481 message.error(e?.message || '创建失败')` 替换为：
  ```tsx
  message.error(extractApiError(e) || '创建失败，请稍后再试');
  ```
  并在文件顶部 import `extractApiError`：
  ```tsx
  function extractApiError(e: any): string | null {
    if (!e) return null;
    if (e?.response?.data?.message) return e.response.data.message;
    if (e?.data?.message) return e.data.message;
    if (e?.message && /^\d+$/.test(String(e.message))) return null; // 纯 400 / 500 不友好
    return e?.message || null;
  }
  ```
- 同样的兜底在 `handleUpdate`/`handleFollowUp` 等处复用。

**R4（次要）：`nextFollowUpAt` 时区**

`normalizeFollowUpPayload.toIso` 用 `v.toDate().toISOString()`。后端 `date-time` 格式接受 ISO，是 OK 的。但前端 ProFormDateTimePicker 默认本地时区，UTC 输出。这里不修（业务上 UTC 一致即可，无歧义）。

### 4.3 修复落地

#### 后端
- **不动 schema**：让现有的 `format: 'date'` / `'date-time'` 保持原样。
- 服务层不变。

#### 前端
- `pages/members/index.tsx`：
  - 新增 `toDateOnly`、`extractApiError` 两个工具；
  - `normalizeFollowUpPayload` 扩展为 `normalizeMemberPayload`，覆盖 `expectedDate`、`birthday`；
  - `handleCreate`、`handleUpdate`、`handleDispatch` 三处 catch 用 `extractApiError`。

#### 测试
- `pages/members/__tests__/normalize.test.ts`：jest 单测覆盖 `dayjs` / Date / 字符串输入。
- `pages/members/__tests__/handleCreate.error.test.ts`（最小）：模拟后端返回 `{ success: false, message: '...' }` 与 `throw new Error('Request failed with status code 400')`，断言 `message.error` 收到正确的中文。

### 4.4 验收
- 通过 UI 直接新增会员填生日 / 预计到院日期，能创建成功。
- 后端主动 400 时，UI 不再展示"Request failed with status code 400"，而是后端 `message` 文案；后端无 message 时显示"创建失败，请稍后再试"。

---

## 5. A.3 — 医院账号登录失败（Spike + 修复脚本）

### 5.1 根因排查（仅阅读代码 + 提供诊断脚本）

按 `HOSPITAL-SINGLE-ACCOUNT-STRICT-SPEC.md`，账号创建由 `HospitalsService.createWithAccount` → `HospitalsRepository.createWithAccount` 一事务完成。

登录校验链路（待静态确认）：
- `apps/yishan-api/src/core/routes/...` 下的 admin/app 登录入口
- `apps/yishan-api/src/core/services/auth.service.ts` 或类似文件
- `verifyPassword(plain, sysUser.passwordHash)` 使用 `apps/yishan-api/src/utils/password.ts` 的 `hashPassword` / `verifyPassword`

需要确认的：
1. `hashPassword` 是否使用与登录校验同样的算法（bcrypt / scrypt / argon2 / 自定义 pbkdf2）。
2. `sys_user` 是否可能有 `passwordHash` 为空、状态 `status=0`、`deletedAt IS NOT NULL` 的医院账号。
3. `crm_hospital.account_user_id` 是否唯一指向活跃 sys_user；是否存在 `account_user_id IS NULL` 的孤儿医院。
4. 登录返回的 JWT 角色集是否包含 `hospital_account`。

具体排查流程见 Plan `A.hospital-login-spike.md`。

### 5.2 交付物

不在线上数据库自动修复。提供：
1. 一份 `scripts/diagnose-hospital-accounts.sql` **只读**诊断 SQL（输出 report 不写库）。
2. 一份 `scripts/fix-hospital-accounts.ts` **修复脚本**：
   - 列出 `crm_hospital.account_user_id IS NULL` 的医院 → 可选重新创建账号；
   - 列出 `sys_user.status != 1` 且关联 crm_hospital 的账号 → 可选重新启用；
   - 列出 `passwordHash` 为空或非 bcrypt 开头（`$2`）的账号 → 可选重置密码；
   - 执行前要求人工 `--apply` 才落库；默认 dry-run 只打结果。
3. 一份 `apps/yishan-api/.../seed.ts` 的补丁，把"重新 seed"作为基线，方便在干净环境复现。
4. 一份根因报告 `docs/superpowers/specs/2026-07-28-hospital-login-rootcause.md`：基于代码静态分析给出"哪些情况会导致登录失败"清单。

### 5.3 验收
- 在干净 DB 上 seed 并遵循现有 `createWithAccount` 流程，新建的医院能用其医院名称 + 密码登录。
- 旧的"用户名或密码错误"问题在诊断 SQL 输出后由 DBA 决定是否执行 `fix-hospital-accounts.ts --apply`。

---

## 6. 文件改动清单（Phase A 总览）

| 文件 | 类型 | 用途 |
| --- | --- | --- |
| `apps/yishan-api/src/modules/crm/schemas/members.schema.ts` | 修改 | A.1 新增 mobile/name schema |
| `apps/yishan-api/src/modules/crm/repositories/members.repository.ts` | 修改 | A.1 精确/前缀匹配 |
| `apps/yishan-api/src/modules/crm/tests/members.selectable.test.ts` | 新增 | A.1 vitest |
| `apps/yishan-admin/src/modules/crm/pages/members/index.tsx` | 修改 | A.1 防抖参数 + A.2 normalizePayload + extractApiError |
| `apps/yishan-admin/src/modules/crm/pages/members/__tests__/normalize.test.ts` | 新增 | A.2 jest |
| `apps/yishan-admin/src/modules/crm/pages/members/__tests__/extractApiError.test.ts` | 新增 | A.2 jest |
| `scripts/diagnose-hospital-accounts.sql` | 新增 | A.3 只读 |
| `scripts/fix-hospital-accounts.ts` | 新增 | A.3 dry-run 默认 |
| `docs/superpowers/specs/2026-07-28-hospital-login-rootcause.md` | 新增 | A.3 |

---

## 7. 自审（Spec Self-Review）

- Placeholder 扫描：无 TBD / TODO / "类似 Task N" / "实现细节待补"。
- 内部一致性：A.1 的"前端传 `{ mobile }`"与后端 schema 新增字段对齐；A.2 的 `normalizeMemberPayload` 与 `extractApiError` 都定义在同一文件内，避免分散。
- 范围：A.1+A.2+A.3 在单个 Plan 周期可完成；不混 Phase B 任务。
- 歧义：第 3.2.1 节明确"新增 mobile 后 keyword 仍保留"——向后兼容语义无歧义。

---

## 8. 风险与回退

- A.1：若精确匹配新增索引缺失，11 位 mobile 大表会变慢；但 `crm_customer.mobile` 已有 `idx_crm_customer_mobile`，精确匹配查询性能好。
- A.2：`extractApiError` 对真正的网络错误（断网）仍会展示 "Network Error"，需要用户接受。
- A.3：seed 重置会覆盖本地现有医院数据；只应在测试/DBA 隔离环境执行。

## 9. 不在 Phase A 内的 TODO（移交 Phase B）

- 医院查看顾客记录 + 医院数据看板 + 未查看订单提醒：见 `2026-07-28-crm-view-tracking-design.md`（Phase B 设计文档）。
- 「医院后台」UI 入口：见 Phase B 路由注入方案。
