# 会员顾客创建 400 根因（仅代码静态分析）

> 任务：Phase A · Task 4（静态阅读根因报告）
> 范围：会员顾客创建接口
> - `POST /api/crm/v1/members/from-customer`
> - `POST /api/crm/v1/members/direct`
> 关联代码：
> - 后端：`apps/yishan-api/src/modules/crm/schemas/members.schema.ts`、`apps/yishan-api/src/modules/crm/routes/v1/members/index.ts`、`apps/yishan-api/src/modules/crm/services/members.service.ts`、`apps/yishan-api/src/modules/crm/repositories/members.repository.ts`
> - 前端：`apps/yishan-admin/src/modules/crm/pages/members/index.tsx`、`apps/yishan-admin/src/modules/crm/api/index.ts`
> 上游设计文档：`docs/superpowers/specs/2026-07-28-crm-bugfixes-design.md`（已识别的 R1~R4）

---

## 1. 结论（TL;DR）

最可能的 400 来源：`expectedDate` / `birthday` 被前端序列化为完整 ISO 字符串（`"2026-08-20T07:00:00.000Z"`），而后端 TypeBox schema 期望 `YYYY-MM-DD`（`format: 'date'`），Fastify schema 校验阶段直接拒为 `400 Bad Request`，错误文案落到前端 catch 的 `e.message`，运营看到的是 `Request failed with status code 400`。

但是，仅盯 R1 是片面的，运营实际看到的「直接展示 400」是 R1 + R3 的复合产物：R1 让请求被拒，R3 让拒绝后无法展示出真正业务文案。次要风险还包括 R2（枚举边界）和 R4（时区）。

| 风险 | 类别 | 真实 400 来源 | 前端可见表现 |
| --- | --- | --- | --- |
| **R1** | payload 序列化 | `expectedDate` / `birthday` 是 ISO 而非 `YYYY-MM-DD` | 直接 `Request failed with status code 400`（无业务文案） |
| **R2** | payload 取值 | `gender` / `preferredHospitalId` / `ownerUserId` 越界或缺失 | 同上（schema 校验阶段直接拒） |
| **R3** | 错误展示 | 后端 `BusinessError` 抛的 4xx + 信封 `message` 无法进入 `message.error` | 业务文案（`该手机号已被使用` 等）丢失，被 `Request failed with status code 400` 覆盖 |
| **R4** | 时区 | `nextFollowUpAt` 被 `toIso` 转 UTC，本地与 UTC 不一致 | 多半不被 400 拒，但跨时区下展示可能错位 |

> 设计文档原话（`2026-07-28-crm-bugfixes-design.md:139`）：「`ProFormDatePicker` 经 `name` 提交的实际值是 `dayjs`，被 `JSON.stringify` 后序列化为 `"2026-08-20T07:00:00.000Z"` 之类的 ISO 字符串，不是 YYYY-MM-DD，被后端 TypeBox `format: 'date'` 拒 400。」

---

## 2. 关键代码位置（精确行号）

### 2.1 后端 TypeBox schema（`apps/yishan-api/src/modules/crm/schemas/members.schema.ts`）

```
17:    nextFollowUpStart: Type.Optional(Type.String({ format: 'date-time' })),
18:    nextFollowUpEnd:   Type.Optional(Type.String({ format: 'date-time' })),
19:    createdStart:      Type.Optional(Type.String({ format: 'date-time' })),
20:    createdEnd:        Type.Optional(Type.String({ format: 'date-time' })),
...
37:  expectedDate:     Type.Optional(Type.String({ format: 'date' })),   // from-customer
46:  nextFollowUpAt:   Type.Optional(Type.String({ format: 'date-time' })),
...
60:  birthday:         Type.Optional(Type.String({ format: 'date' })),   // direct
72:  expectedDate:     Type.Optional(Type.String({ format: 'date' })),   // direct
81:  nextFollowUpAt:   Type.Optional(Type.String({ format: 'date-time' })),
...
95:  birthday:         Type.Optional(Type.String({ format: 'date' })),   // update
106: expectedDate:     Type.Optional(Type.String({ format: 'date' })),   // update
114: nextFollowUpAt:   Type.Optional(Type.String({ format: 'date-time' })),
128: nextFollowUpAt:   Type.Optional(Type.String({ format: 'date-time' })), // follow-up
```

**结论**：四类时间字段被严格区分：
- `expectedDate` / `birthday` 期望 `YYYY-MM-DD`（schema `format: 'date'`）。
- `nextFollowUpAt` / `nextFollowUpStart` / `nextFollowUpEnd` / `createdStart` / `createdEnd` / `generatedAt` 期望 ISO 字符串（schema `format: 'date-time'`）。

### 2.2 后端 routes（`apps/yishan-api/src/modules/crm/routes/v1/members/index.ts`）

```
121:  route.post('/members/from-customer', { body: CrmMemberFromCustomerReqSchema, ... })
140:  route.post('/members/direct',          { body: CrmMemberDirectReqSchema, ... })
```

两条创建路由都用 `route.post` + `schema.body = ...CrmReqSchema`，Fastify 在 preHandler 之前会跑 `@fastify/type-provider-typebox` 校验，**任何字段不合规直接抛 400**，不进 service。

### 2.3 前端表单（`apps/yishan-admin/src/modules/crm/pages/members/index.tsx`）

```
451-461: toIso()                      // 把 dayjs/Date 转 ISO 字符串
464-467: normalizeFollowUpPayload()   // 只覆盖 nextFollowUpAt，不覆盖 expectedDate/birthday
471-498: handleCreate()                // catch 里直接 message.error(e?.message)
500-514: handleUpdate()                // 同上
516-549: handleFollowUp()              // 同上
...
909:  <ProFormDatePicker    name="expectedDate"     label="期望时间" />
918:  <ProFormDateTimePicker name="nextFollowUpAt"   label="下次跟进时间" />
990:  <ProFormDatePicker    name="birthday"         label="出生日期" />
999:  <ProFormDatePicker    name="expectedDate"     label="期望时间" />
1009: <ProFormDateTimePicker name="nextFollowUpAt"   label="下次跟进时间" />
1043: <ProFormDatePicker    name="birthday"         label="出生日期" />  // 编辑抽屉
1051: <ProFormDatePicker    name="expectedDate"     label="期望时间" />  // 编辑抽屉
1060: <ProFormDateTimePicker name="nextFollowUpAt"   label="下次跟进时间" /> // 编辑抽屉
1186: <ProFormDateTimePicker name="nextFollowUpAt"   label="下次跟进时间" /> // 添加跟进
```

### 2.4 前端 API 适配层（`apps/yishan-admin/src/modules/crm/api/index.ts`）

```
138-147: createMemberFromCustomer / createMemberDirect  // 直接走 request() POST
```

两条 wrapper 都是裸 `request(...)`，**没有 catch 转换**。也就是说后端 4xx 抛出的 `BusinessError` 会被 `umi-request` 识别为非 2xx，扔到 `.catch`，错误文案无法进入 `.then(res.message)` 路径。

---

## 3. 调用栈（从点击「创建会员」到 400）

```
[用户操作] 新增会员 Drawer 提交
   │
   ▼
[前端] pages/members/index.tsx:471 handleCreate(values)
   │    └─ normalizeFollowUpPayload(values)   // line 464
   │        └─ 仅 toIso(nextFollowUpAt)
   │           // ⚠️ R1: expectedDate / birthday 仍是 dayjs 对象
   ▼
[前端] createMemberFromCustomer({customerId, ...payload}) / createMemberDirect(payload)
   │    └─ apps/yishan-admin/src/modules/crm/api/index.ts:139 / 147
   │       └─ request<any>('POST /api/crm/v1/members/direct', { data: payload })
   │          └─ JSON.stringify → expectedDate = "2026-08-20T07:00:00.000Z" ⚠️
   ▼
[后端] apps/yishan-api/src/modules/crm/routes/v1/members/index.ts:140
   │    └─ Fastify 路由 preHandler 之前，@fastify/type-provider-typebox 校验 body
   │       └─ CrmMemberDirectReqSchema.expectedDate = format:'date'  ❌
   │          └─ 400 Bad Request, { code: 40001, message: "..." }
   ▼
[前端] umi-request 看到非 2xx → throw new Error('Request failed with status code 400')
   │    └─ catch (e: any) { message.error(e?.message || '创建失败') }  // ⚠️ R3
   ▼
[用户] 看到 "Request failed with status code 400"
```

---

## 4. 已知 400 来源（来自 design 文档 R1~R4，逐条展开）

### 4.1 R1（主因）：`birthday` / `expectedDate` 校验失败

**位置**：
- schema：`apps/yishan-api/src/modules/crm/schemas/members.schema.ts:37, 60, 95, 106`（4 处 `format: 'date'`）
- 表单：`apps/yishan-admin/src/modules/crm/pages/members/index.tsx:909, 990, 999, 1043, 1051`（5 处 `ProFormDatePicker name="birthday|expectedDate"`）
- normalize：`apps/yishan-admin/src/modules/crm/pages/members/index.tsx:464-467`（**只覆盖 `nextFollowUpAt`**）

**机制**：`ProFormDatePicker` 经 Form 提交的实际值是 `dayjs` 实例（`name` 字段 + 内部 `fieldProps.value`），`umi-request` 用 `JSON.stringify` 序列化时调用 `dayjs.toJSON()`，结果为 `"2026-08-20T07:00:00.000Z"`。后端 schema `format: 'date'` 要求严格 `YYYY-MM-DD`，被拒 400。

**最小修复**：扩展 `normalizeFollowUpPayload` 为 `normalizeMemberPayload`，新增 `toDateOnly()` 把 dayjs/Date 规整为 `YYYY-MM-DD`。这是 Task 5 的主要工作。

### 4.2 R2（次要）：医院/性别/枚举值超界

**位置**：
- `apps/yishan-api/src/modules/crm/schemas/members.schema.ts:59`：`gender: Type.Integer({ minimum: 0, maximum: 2 })`
- `apps/yishan-api/src/modules/crm/schemas/members.schema.ts:73, 107`：`preferredHospitalId: Type.Integer({ minimum: 1 })`
- `apps/yishan-api/src/modules/crm/schemas/members.schema.ts:74, 108`：`ownerUserId: Type.Integer({ minimum: 1 })`

**触发场景**：
- 「直接新增会员」模式下，前端 `ProFormRadio.Group gender` 已 `initialValue={0}`，不会缺失。
- 但 `preferredHospitalId` 字段在表单中**完全不存在**（只有 ownerUserId），所以它是「schema 声明但前端 UI 永远不传」的孤儿字段——一旦后端补上「会员必须有偏好医院」业务规则，就会触发 400。**当前不是 400 来源**，列入 watch list。
- `ownerUserId` 已 `rules={[{ required: true }]}`（line 910, 1000, 1052），不会缺失。

**结论**：当前代码路径下 R2 不会触发 400，但需要警惕「未来后端补 `preferredHospitalId` 必填」时的连带影响。

### 4.3 R3（次要，但用户感知上与 R1 等同）：业务错误文案丢失

**位置**：
- `apps/yishan-admin/src/modules/crm/pages/members/index.tsx:495-497`（handleCreate catch）
- `apps/yishan-admin/src/modules/crm/pages/members/index.tsx:511-513`（handleUpdate catch）
- `apps/yishan-admin/src/modules/crm/pages/members/index.tsx:546-548`（handleFollowUp catch）
- `apps/yishan-admin/src/modules/crm/pages/members/index.tsx:561-563`（handleInvalidate catch）
- `apps/yishan-admin/src/modules/crm/pages/members/index.tsx:574-576`（handleRestore catch）
- `apps/yishan-admin/src/modules/crm/pages/members/index.tsx:589-591`（handleBatchAssign catch）
- `apps/yishan-admin/src/modules/crm/pages/members/index.tsx:604-606`（handleBatchTag catch）

**机制**：运营手动反馈的「直接展示 400」有两层来源：

1. **真 400**（schema 校验失败，如 R1）：Fastify 默认 400 envelope `{ code: 40001, message: "body must match schema" }` 不带业务上下文。`umi-request` 把它识别为非 2xx 抛 `Error`，catch 里 `e.message = "Request failed with status code 400"`，**业务文案被丢弃**。
2. **假 400**（业务错误，如「手机号已存在」）：`apps/yishan-api/src/modules/crm/services/members.service.ts` 用 `throw new BusinessError(code, msg)` 抛出，理论上 `{ success: false, code, message }` 会进 `.then`，前端 `message.error(res?.message)` 能看到。但若后端未来改了路由/handler 顺序、或 Fastify 默认错误处理介入，也会走到 catch 显示 `Request failed with status code 400`。

**最小修复**：新增 `extractApiError(e)`：
- 优先 `e.response.data.message`（umi-request 4xx/5xx 的 body）
- 次之 `e.data.message`（某些 wrapper 路径）
- 再次 `e.message`，但跳过纯数字（"400"、"500"）
- 否则 `null`，由调用方兜底"创建失败，请稍后再试"

替换上述 7 处 catch 的 `message.error(e?.message || '...')` 为 `message.error(extractApiError(e) || '...')`。

### 4.4 R4（次要）：`nextFollowUpAt` 时区

**位置**：
- normalize：`apps/yishan-admin/src/modules/crm/pages/members/index.tsx:455-461`（`toIso` 用 `v.toDate().toISOString()`）
- schema：`apps/yishan-api/src/modules/crm/schemas/members.schema.ts:46, 81, 114, 128`（`format: 'date-time'` 接受任意 ISO）

**机制**：`ProFormDateTimePicker` 默认本地时区（浏览器/CN 部署 → UTC+8），`dayjs.toDate()` 转 `Date`，`toISOString()` 永远输出 UTC（`Z` 后缀）。schema 接受 ISO 是 OK 的，业务逻辑（比较时统一按 UTC）也 OK。**不会被 400 拒**。

**保留风险**：
- 用户在表单里看到「2026-08-20 15:00」，提交后到服务端存为「2026-08-20T07:00:00Z」，列表渲染时再 `dayjs.format('YYYY-MM-DD HH:mm')` 用本地时区，又回到「2026-08-20 15:00」。目前一致。
- 但「快捷筛选预设 → 今日待跟进」按钮（line 698）拼的是 `${YYYY-MM-DDTHH:mm:ss}Z`，**没有 toISOString 的毫秒**，schema 也接受，但与其它路径格式不一致（`YYYY-MM-DDTHH:mm:ssZ` vs `YYYY-MM-DDTHH:mm:ss.sssZ`）。这是潜在的不一致，建议 Task 5 顺手统一。

**结论**：R4 不会被 400 拒，但格式不一致是隐患。

---

## 5. Task 5 actionable findings

### 5.1 必须修改的字段（payload normalize 范围）

| 字段 | schema format | 当前行为 | 期望 |
| --- | --- | --- | --- |
| `expectedDate` | `date` | dayjs 对象 → ISO 字符串（被 400 拒） | `YYYY-MM-DD` |
| `birthday` | `date` | dayjs 对象 → ISO 字符串（被 400 拒） | `YYYY-MM-DD` |
| `nextFollowUpAt` | `date-time` | toIso 已 OK | ISO 字符串（保持） |

**结论**：扩展 `normalizeFollowUpPayload` 为 `normalizeMemberPayload`，覆盖前 2 个字段，第 3 个保留。

### 5.2 必须新增的工具函数

```ts
// 1. 把任意时间输入规整为 YYYY-MM-DD（不依赖 toIso 的 .toISOString() 输出）
function toDateOnly(v: any) { ... }

// 2. 把任意时间输入规整为 ISO 字符串（保持现有行为）
function toIso(v: any) { ... }

// 3. 主入口，覆盖 3 个时间字段
function normalizeMemberPayload<T extends Record<string, any>>(v: T): T {
  return {
    ...v,
    expectedDate: toDateOnly((v as any).expectedDate),
    birthday: toDateOnly((v as any).birthday),
    nextFollowUpAt: toIso((v as any).nextFollowUpAt),
  };
}

// 4. 错误文案提取（见 R3）
function extractApiError(e: any): string | null { ... }
```

设计文档已在 line 148-168 给出 `toDateOnly` 参考实现；Task 5 brief 在 Step 5.2 给出完整 `normalizeMemberPayload` + `extractApiError` 实现。两个来源一致，直接采用 Task 5 brief 的实现即可。

### 5.3 必须修改的 catch 调用点

`pages/members/index.tsx` 中所有 `catch (e: any) { message.error(e?.message || '...') }` 改为 `message.error(extractApiError(e) || '...')`：

| 行号 | 函数 | 当前文案 |
| --- | --- | --- |
| 496 | handleCreate | '创建失败' |
| 512 | handleUpdate | '修改失败' |
| 547 | handleFollowUp | '保存失败' |
| 562 | handleInvalidate | '操作失败' |
| 575 | handleRestore | '恢复失败' |
| 590 | handleBatchAssign | '分配失败' |
| 605 | handleBatchTag | '打标签失败' |

### 5.4 必须新增的测试

Task 5 brief Step 5.1 已给出 2 个测试文件，覆盖：
- `normalizeMemberPayload.test.tsx`：dayjs、ISO 字符串、ISO with time 三种输入 → 正确输出
- `extractApiError.test.ts`：response.data.message / data.message / 纯数字 message / 通用 message 四种 case

直接采用 Task 5 brief 的实现，无需新增测试用例。

### 5.5 顺手改进建议（不进 R1~R4，仅 QA 阶段关注）

1. `pages/members/index.tsx:909` 直接新增抽屉的 `expectedDate` 字段未声明 `rules={[{ required: true }]}`，与 from-customer 分支一致；但 `from-customer` 分支 line 909 同样未声明。表单层无必填校验，仅依赖后端 Optional。当前是「Optional」语义，不修。
2. `pages/members/index.tsx:633, 645, 698, 717-718` 的快捷筛选预设拼字符串用 `${YYYY-MM-DDTHH:mm:ss}Z`（无毫秒），与 `toIso` 的 `${YYYY-MM-DDTHH:mm:ss.sss}Z`（有毫秒）格式不一致。建议把快捷预设也走 `dayjs().toISOString()`。**当前不会被 400 拒**，但若未来后端收紧到正则验证时间格式，会裂。
3. `apps/yishan-admin/src/modules/crm/api/index.ts:139-147, 150-154, 161-165, 168-172, 175-179, 182-186, 189-190, 193-197, 200, 203-204, 207-208, 211-212, 215-216`：所有 wrapper 都没显式声明 response 类型，统一 `request<any>`。OpenAPI 生成器能给出更精确的类型，但当前 wrapper 形态能跑通。不在 R1~R4 范围。

---

## 6. Task 5 不应触碰的边界（避免 scope creep）

| 不应触碰 | 理由 |
| --- | --- |
| 后端 `members.schema.ts` 的 `format: 'date'` / `'date-time'` | design §4.3 明确「不动 schema」；保持契约 |
| 后端 service / repository 任何逻辑 | Task 1 已修；本阶段后端零改动 |
| 后端 `BusinessError` 抛错语义 | 设计已确定 |
| 新增 `preferredHospitalId` 必填 | Phase B 范围 |
| 重构 `umi-request` 全局 error handler | 影响面大，应另立 ticket |

---

## 7. 验收标准（与 design §4.4 对齐）

1. 通过 UI「直接新增会员」填写生日（dayjs）+ 期望时间（dayjs）能成功创建，不再 400。
2. 后端 schema 校验失败时，UI 不再展示「Request failed with status code 400」，而是后端真实 message；后端无 message 时显示「创建失败，请稍后再试」。
3. `pnpm --filter yishan-admin test -- --testPathPattern=members/__tests__` 全绿（normalizeMemberPayload 3 个用例 + extractApiError 3 个用例 = 至少 6 个）。
4. `cd apps/yishan-admin && npx tsc --noEmit` 0 errors。

---

## 8. 附录：完整调用栈（前端一行一栈）

```
用户输入 (UI)
  └─ ProFormDatePicker[name="expectedDate"]   → dayjs
  └─ ProFormDatePicker[name="birthday"]       → dayjs
  └─ ProFormDateTimePicker[name="nextFollowUpAt"] → dayjs

点击「创建会员」按钮
  └─ DrawerForm.onFinish → handleCreate(values)            [index.tsx:471]
      └─ normalizeFollowUpPayload(values)                   [index.tsx:464]
          └─ 仅 toIso(nextFollowUpAt)                       [index.tsx:455]
      └─ createMode === 'direct'
          └─ createMemberDirect(payload)                    [index.tsx:485]
              └─ request POST /api/crm/v1/members/direct    [api/index.ts:146]
                  └─ JSON.stringify(payload)
                      └─ expectedDate = "2026-08-20T07:00:00.000Z"   ⚠️ R1
                      └─ birthday     = "1990-05-01T16:00:00.000Z"   ⚠️ R1
                      └─ nextFollowUpAt = "2026-08-22T..."   OK

后端收到
  └─ Fastify 路由 preHandler 之前
      └─ @fastify/type-provider-typebox 校验
          └─ CrmMemberDirectReqSchema.expectedDate = format:'date'
              └─ 期望 "YYYY-MM-DD"，收到 ISO → 抛 400                  ⚠️ R1

umi-request
  └─ 看到非 2xx → throw new Error('Request failed with status code 400')

catch (e: any)
  └─ message.error(e?.message || '创建失败')                              ⚠️ R3
      └─ 业务文案（如果有）被丢弃
      └─ 用户看到 "Request failed with status code 400"
```

---

## 9. 引用

- 设计文档（Phase A 根因总览）：`docs/superpowers/specs/2026-07-28-crm-bugfixes-design.md:115-237`
- Task 4 brief：`.superpowers/sdd/2026-07-28-crm-bugfixes/task-4-brief.md`
- Task 5 brief（normalize + extractApiError 实现）：`.superpowers/sdd/2026-07-28-crm-bugfixes/task-5-brief.md`
- Task 1 commit（已落地的 schema 改动）：`bacdd716cb1358ff7fccebe7c3d45732e1646da1`
- Task 2 commit（前端消费）：`fca54b3`
- Task 3 commit（OpenAPI 重生）：`7bfe229`

---

> 本报告只读代码，未修改任何源文件。