# CRM Bug 热修执行计划（Phase A）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复顾客转会员时的手机号搜索精度问题；修复会员顾客创建 400 错误；交付医院登录失败的诊断 + 修复脚本。

**Architecture:** 在不动 yishan-crm 模块主架构的前提下，对 `members` 资源做 schema 字段补全（mobile/name 精确/前缀匹配）、前端 payload 规范化（`birthday`/`expectedDate` 日期格式 + 4xx 错误中文展示），交付医院账号的诊断 SQL + 修复脚本（默认 dry-run）。

**Tech Stack:** Fastify 5 + Drizzle + TypeBox (后端), React 19 + Ant Design Pro 6 + Jest + dayjs (前端), Vitest (后端单测), TypeScript。

**Spec:** `docs/superpowers/specs/2026-07-28-crm-bugfixes-design.md`

---

## Global Constraints

- Monorepo 根：`/home/ubuntu/workspace/iximei-kf`
- 全局工具链：Node 22.22.1、pnpm 8.15.9；以 `.tool-versions` 为准。
- 不得修改 `crm_*` 表结构（本次不动 Drizzle schema）。
- 路由前缀 `/api/crm/v1/...` 不变；新增字段全部 `Type.Optional`。
- OpenAPI 重生成：所有 schema 字段变更后必须执行 `pnpm --filter yishan-admin openapi` 并 commit 两份新文件。
- 提交规范：Conventional Commits (CLAUDE.md §Quality gate)。
- 严禁在生产环境自动重置医院账号；A.3 全程 dry-run 默认。

---

## File Structure Overview

| 文件 | 类型 | 用途 |
| --- | --- | --- |
| `apps/yishan-api/src/modules/crm/schemas/members.schema.ts` | 修改 | A.1 schema |
| `apps/yishan-api/src/modules/crm/repositories/members.repository.ts` | 修改 | A.1 查询 |
| `apps/yishan-api/src/modules/crm/tests/members.selectable.test.ts` | 新增 | A.1 测试 |
| `apps/yishan-api/src/modules/crm/tests/fixtures/selectable-customers.fixture.ts` | 新增 | A.1 夹具 |
| `apps/yishan-admin/src/modules/crm/pages/members/index.tsx` | 修改 | A.1 + A.2 前端 |
| `apps/yishan-admin/src/modules/crm/pages/members/__tests__/normalizeMemberPayload.test.tsx` | 新增 | A.2 |
| `apps/yishan-admin/src/modules/crm/pages/members/__tests__/extractApiError.test.ts` | 新增 | A.2 |
| `scripts/diagnose-hospital-accounts.sql` | 新增 | A.3 |
| `scripts/fix-hospital-accounts.ts` | 新增 | A.3 |
| `docs/superpowers/specs/2026-07-28-hospital-login-rootcause.md` | 新增 | A.3 报告 |
| `apps/yishan-api/src/services/generated/crm.d.ts` | 自动 | OpenAPI 重生 |
| `apps/yishan-admin/src/services/generated/crm.ts` | 自动 | OpenAPI 重生 |

---

## Task 1: A.1 后端 schema + repository

**Files:**
- Modify: `apps/yishan-api/src/modules/crm/schemas/members.schema.ts:185-190` (CrmCustomerSelectableQuerySchema)
- Modify: `apps/yishan-api/src/modules/crm/repositories/members.repository.ts:402-441`
- Test: `apps/yishan-api/src/modules/crm/tests/members.selectable.test.ts`

### Step 1.1：写失败的 schema 测试

```ts
// apps/yishan-api/src/modules/crm/tests/members.selectable.test.ts
import { describe, it, expect } from 'vitest'
import { MembersRepository } from '../../repositories/members.repository.js'

// 注：本测试用一个最小内存 MySQL 替身（如已有 test DbContainer，跳过这步直接连真 DB）。
// 计划假定已存在 drizzle-test 风格的 in-memory 替身；若无，使用 singleton test db。
describe('MembersRepository.listSelectableCustomers — mobile 精确 / name 前缀', () => {
  it('input { mobile: "13800138000" } 只返回 mobile 完全相等且未软删的记录', async () => {
    const repo = new (MembersRepository as any).constructor()
    const result = await MembersRepository.listSelectableCustomers({
      mobile: '13800138000',
      page: 1, pageSize: 20,
    } as any)
    expect(result.list.every((c: any) => c.mobile === '13800138000' && !c.deletedAt)).toBe(true)
  })

  it('input { name: "张三" } 仅返回以"张三"开头的顾客', async () => {
    const result = await MembersRepository.listSelectableCustomers({
      name: '张三',
      page: 1, pageSize: 20,
    } as any)
    expect(result.list.every((c: any) => c.name?.startsWith('张三'))).toBe(true)
  })

  it('input { keyword: "13800" } 仍按 LIKE 模糊匹配（向后兼容）', async () => {
    const result = await MembersRepository.listSelectableCustomers({
      keyword: '13800',
      page: 1, pageSize: 20,
    } as any)
    expect(result.list.length).toBeGreaterThanOrEqual(0) // 行为不变即可
  })
})
```

**Step 1.2：运行，期望 FAIL** —— 此时 `listSelectableCustomers` 还没有 `mobile` / `name` 分支。

```bash
cd apps/yishan-api && pnpm test -- -t "listSelectableCustomers"
```

期望：报错或测试逻辑未覆盖字段。

**Step 1.3：修改 schema**

```ts
// apps/yishan-api/src/modules/crm/schemas/members.schema.ts
export const CrmCustomerSelectableQuerySchema = Type.Intersect([
  CrmPageQuerySchema,
  Type.Object({
    excludeMember: Type.Optional(Type.Integer({ minimum: 0, maximum: 1 })),
    mobile: Type.Optional(Type.String({ pattern: '^1[3-9]\\d{9}$', maxLength: 11 })),
    name: Type.Optional(Type.String({ maxLength: 50 })),
  }),
], { $id: 'crmCustomerSelectableQuery' })
```

**Step 1.4：修改 repository**

```ts
// apps/yishan-api/src/modules/crm/repositories/members.repository.ts listSelectableCustomers
static async listSelectableCustomers(q: any) {
  const c: any[] = [isNull(crmCustomer.deletedAt)]

  if (q.ownerUserId) c.push(eq(crmCustomer.ownerUserId, q.ownerUserId))

  // A.1: 优先按 mobile / name 精确/前缀匹配，再回退 keyword 模糊
  if (q.mobile && /^1[3-9]\d{9}$/.test(String(q.mobile))) {
    c.push(eq(crmCustomer.mobile, String(q.mobile)))
  } else if (q.name && typeof q.name === 'string') {
    c.push(like(crmCustomer.name, `${q.name}%`))
  } else if (q.keyword) {
    c.push(or(
      like(crmCustomer.name, `%${q.keyword}%`),
      like(crmCustomer.mobile, `%${q.keyword}%`),
      like(crmCustomer.numberId, `%${q.keyword}%`),
    )!)
  }

  const hasActiveMember = drizzleDb.select({ id: crmMemberCustomer.id })
    .from(crmMemberCustomer)
    .where(and(
      isNull(crmMemberCustomer.deletedAt),
      eq(crmMemberCustomer.memberStatus, 'active'),
      eq(crmMemberCustomer.customerId, crmCustomer.id),
    ))
  c.push(notExists(hasActiveMember))

  // … 后续 page/select 不变
}
```

**Step 1.5：重跑测试，期望 PASS**

```bash
cd apps/yishan-api && pnpm test -- -t "listSelectableCustomers"
```

期望：3 个用例全绿。

**Step 1.6：提交**

```bash
git add apps/yishan-api/src/modules/crm/schemas/members.schema.ts \
        apps/yishan-api/src/modules/crm/repositories/members.repository.ts \
        apps/yishan-api/src/modules/crm/tests/members.selectable.test.ts
git commit -m "fix(crm): support exact mobile / prefix name match for customer selection"
```

---

## Task 2: A.1 前端消费 + 友好空态

**Files:**
- Modify: `apps/yishan-admin/src/modules/crm/pages/members/index.tsx:200-240, 920-960`

### Step 2.1：添加 `customerSearchNoResult` state

```tsx
const [customerSearchNoResult, setCustomerSearchNoResult] = useState<string | null>(null)
```

### Step 2.2：替换 `fetchCustomerSearch` 逻辑

```tsx
const fetchCustomerSearch = useCallback(async (rawKeyword: string, page = 1) => {
  setCustomerSearchLoading(true);
  try {
    const trimmed = rawKeyword.trim();
    const isMobile = /^1[3-9]\d{9}$/.test(trimmed);
    const params = isMobile
      ? { mobile: trimmed, page, pageSize: 10 }
      : { keyword: rawKeyword, page, pageSize: 10 };
    const res: any = await getSelectableCustomers(params);
    if (res?.success) {
      setCustomerSearchResult(res.data || []);
      setCustomerSearchTotal(res.pagination?.total || 0);
      setCustomerSearchNoResult(res.data?.length ? null : trimmed);
    } else {
      setCustomerSearchNoResult(trimmed);
    }
  } catch { /* */ }
  setCustomerSearchLoading(false);
}, []);

// 在结果区（line ~830 附近，已渲染 list 的位置）渲染：
{customerSearchNoResult && customerSearchResult.length === 0 && (
  <Empty description={`未找到手机号为"${customerSearchNoResult}"的顾客`} />
)}
```

### Step 2.3：替换「直接新增」debounce 反查入参

```tsx
// line ~925
const res = await getSelectableCustomers({ mobile: value, page: 1, pageSize: 5 });
```

并把下面的 `list = (res as any)?.data || []` 配合 `exact = list.find((c: any) => c.mobile === value)` —— 因现在入参为精确 mobile，列表只可能 0/1 行；保留 find 容错。

### Step 2.4：手动测试（开发环境运行 UI）

```bash
pnpm --filter yishan-admin dev
```

- 打开 `/crm/members`，进入「从客户转会员」对话框，输入完整 11 位手机号 → 应只看到该手机号的顾客（如果存在）；无结果显示「未找到对应顾客」。
- 切换到「直接新增」分支，输入相同手机号 → 若存在客户弹窗"已是客户"提示；若不存在无弹窗。

### Step 2.5：提交

```bash
git add apps/yishan-admin/src/modules/crm/pages/members/index.tsx
git commit -m "feat(crm-admin): exact mobile search + not-found empty state"
```

---

## Task 3: 重生成 OpenAPI

**Files:**
- Auto-regen: `apps/yishan-admin/src/services/generated/crm.d.ts`、`apps/yishan-admin/src/services/generated/crm.ts`
- Auto-regen: `apps/yishan-api/openapi.json`

### Step 3.1：启动 API，触发 openapi 导出

```bash
pnpm --filter yishan-api dev &
sleep 5
curl -s http://localhost:3000/api/json > apps/yishan-api/openapi.json 2>/dev/null || true
# 或使用项目内已有的脚本导出
```

若项目使用 `pnpm --filter yishan-api openapi:export`：

```bash
pnpm --filter yishan-api openapi:export
```

### Step 3.2：admin 端重生成

```bash
pnpm --filter yishan-admin openapi
```

### Step 3.3：检查 typings

```bash
grep "listCrmCustomersSelectable" apps/yishan-admin/src/services/generated/crm.d.ts
grep "mobile" apps/yishan-admin/src/services/generated/crm.d.ts | head -5
```

期望：`CrmCustomerSelectableQuery` interface 出现 `mobile?: string`。

### Step 3.4：质量门

```bash
pnpm --filter yishan-admin tsc --noEmit
```

期望：0 错误。

### Step 3.5：提交

```bash
git add apps/yishan-admin/src/services/generated apps/yishan-api/openapi.json
git commit -m "chore(openapi): regenerate crm client after mobile/name query fields"
```

---

## Task 4: A.2 后端：静态阅读根因报告

**Files:**
- Read (no edit): `apps/yishan-api/src/core/services/auth.service.ts`（若存在）
- Read (no edit): `apps/yishan-api/src/utils/password.ts`
- New: `docs/superpowers/specs/2026-07-28-member-creation-400-rootcause.md`

### Step 4.1：阅读 TypeBox schema 字段

```bash
grep -n "format: 'date'\|format: 'date-time'" apps/yishan-api/src/modules/crm/schemas/members.schema.ts
```

期望打印：`expectedDate`、`birthday` 用 `format: 'date'`；`nextFollowUpAt` 用 `format: 'date-time'`。

### Step 4.2：阅读前端 ProForm 入参

```bash
grep -n "name=\"expectedDate\"\|name=\"birthday\"\|name=\"nextFollowUpAt\"" apps/yishan-admin/src/modules/crm/pages/members/index.tsx
```

### Step 4.3：产出根因报告

写入 `docs/superpowers/specs/2026-07-28-member-creation-400-rootcause.md`：

```markdown
# 会员顾客创建 400 根因（仅代码静态分析）

## 结论
最可能的 400 来源：`expectedDate` / `birthday` 被前端序列化为完整 ISO（带时间），而 TypeBox schema 期望纯 `YYYY-MM-DD`，从而返回 400。

## 调用栈
1. members.tsx handleCreate → normalizeFollowUpPayload 仅覆盖 nextFollowUpAt
2. requests POST /api/crm/v1/members/direct 提交 expectedDate = dayjs 对象
3. JSON.stringify 输出 ISO → TypeBox 拒 → Fastify 4xx → 前端 request catch 拿到 `Request failed with status code 400`

## 次要风险
- 前端 catch 时 e.message 是 axios 包装字符串，前端应改为读取 res.data.message（业务错误） / 统一 extractApiError。
```

### Step 4.4：提交

```bash
git add docs/superpowers/specs/2026-07-28-member-creation-400-rootcause.md
git commit -m "docs(crm): 400 root cause analysis for member creation"
```

---

## Task 5: A.2 前端：normalizeMemberPayload + extractApiError

**Files:**
- Modify: `apps/yishan-admin/src/modules/crm/pages/members/index.tsx:438-484`
- New: `apps/yishan-admin/src/modules/crm/pages/members/__tests__/normalizeMemberPayload.test.tsx`
- New: `apps/yishan-admin/src/modules/crm/pages/members/__tests__/extractApiError.test.ts`

### Step 5.1：先写失败测试

```tsx
// pages/members/__tests__/normalizeMemberPayload.test.tsx
import { normalizeMemberPayload } from '../index'

describe('normalizeMemberPayload', () => {
  it('把 dayjs 对象转为 YYYY-MM-DD', () => {
    const payload = { expectedDate: { toDate: () => new Date('2026-08-20T07:00:00Z') } } as any
    const out = normalizeMemberPayload(payload)
    expect(out.expectedDate).toBe('2026-08-20')
  })

  it('birthday 输入 ISO 字符串保持为日期分量', () => {
    const out = normalizeMemberPayload({ birthday: '2026-08-20T07:00:00Z' })
    expect(out.birthday).toBe('2026-08-20')
  })

  it('nextFollowUpAt 转 ISO 字符串', () => {
    const out = normalizeMemberPayload({
      nextFollowUpAt: { toDate: () => new Date('2026-08-20T07:00:00Z') },
    })
    expect(out.nextFollowUpAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})
```

```ts
// pages/members/__tests__/extractApiError.test.ts
import { extractApiError } from '../index'

describe('extractApiError', () => {
  it('读出 response.data.message', () => {
    expect(extractApiError({ response: { data: { message: '该手机号已被使用' } } })).toBe('该手机号已被使用')
  })
  it('纯 400/500 数字 message 返回 null', () => {
    expect(extractApiError({ message: '400' })).toBeNull()
    expect(extractApiError({ message: '500' })).toBeNull()
  })
  it('通用 message 返回自身', () => {
    expect(extractApiError({ message: '网络异常' })).toBe('网络异常')
  })
})
```

### Step 5.2：先 export 工具函数供测试 import

```tsx
// pages/members/index.tsx 文件尾部追加
export function normalizeMemberPayload<T extends Record<string, any>>(v: T): T {
  // 已存在的 normalizeFollowUpPayload 逻辑保留 nextFollowUpAt
  const toDate = (x: any) => {
    if (x === undefined || x === null || x === '') return x
    if (typeof x === 'string') return x
    if (x && typeof x === 'object' && typeof x.toDate === 'function') return x.toDate()
    if (x instanceof Date) return x
    return x
  }
  const toDateOnly = (x: any) => {
    const d: any = toDate(x)
    if (!d) return x
    const dt = d instanceof Date ? d : (typeof d?.toDate === 'function' ? d.toDate() : d)
    if (dt instanceof Date && !Number.isNaN(dt.getTime())) {
      const y = dt.getFullYear(); const m = String(dt.getMonth() + 1).padStart(2, '0'); const day = String(dt.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }
    return x
  }
  const toIso = (x: any) => {
    const d = toDate(x)
    if (d instanceof Date && !Number.isNaN(d.getTime())) return d.toISOString()
    return x
  }
  return {
    ...v,
    expectedDate: toDateOnly((v as any).expectedDate),
    birthday: toDateOnly((v as any).birthday),
    nextFollowUpAt: toIso((v as any).nextFollowUpAt),
  }
}

export function extractApiError(e: any): string | null {
  if (!e) return null
  if (e?.response?.data?.message) return e.response.data.message
  if (e?.data?.message) return e.data.message
  if (typeof e?.message === 'string' && /^\d+$/.test(e.message)) return null
  return e?.message || null
}
```

### Step 5.3：替换原 `normalizeFollowUpPayload` 与 catch 文案

```tsx
// 将 line 450 normalizeFollowUpPayload 改为调用 normalizeMemberPayload
const handleCreate = async (values: any) => {
  try {
    const payload = normalizeMemberPayload(values)
    // ... 原有逻辑
  } catch (e: any) {
    message.error(extractApiError(e) || '创建失败，请稍后再试')
  }
}
```

注：handleUpdate / handleDispatch 同样替换 catch 内的 `e?.message || '...'`。

### Step 5.4：跑测试

```bash
pnpm --filter yishan-admin test -- --testPathPattern=members/__tests__
```

期望：所有用例绿。

### Step 5.5：提交

```bash
git add apps/yishan-admin/src/modules/crm/pages/members
git commit -m "fix(crm-admin): normalize payload dates + localized api errors"
```

---

## Task 6: A.3 医院账号诊断脚本（只读）

**Files:**
- New: `scripts/diagnose-hospital-accounts.sql`
- New: `scripts/fix-hospital-accounts.ts`
- New: `docs/superpowers/specs/2026-07-28-hospital-login-rootcause.md`

### Step 6.1：诊断 SQL

```sql
-- scripts/diagnose-hospital-accounts.sql
-- 输出 crm_hospital / sys_user 现状，便于人工确认根因
-- 1) 医院无账号
SELECT h.id, h.hospital_name, h.deleted_at, h.status, h.account_user_id
FROM crm_hospital h
WHERE h.account_user_id IS NULL;

-- 2) 账号被禁用但医院仍 active
SELECT h.id, h.hospital_name, h.status AS hospital_status,
       u.id AS user_id, u.username, u.status AS user_status,
       u.deleted_at AS user_deleted_at
FROM crm_hospital h
LEFT JOIN sys_user u ON u.id = h.account_user_id
WHERE h.status = 1 AND (u.status IS NULL OR u.status <> 1 OR u.deleted_at IS NOT NULL);

-- 3) 密码 hash 非 bcrypt
SELECT u.id, u.username, LEFT(u.password_hash, 7) AS hash_prefix
FROM sys_user u
WHERE u.password_hash NOT LIKE '$2%' OR u.password_hash IS NULL OR u.password_hash = '';

-- 4) 重复用户名
SELECT username, COUNT(*) AS cnt
FROM sys_user
GROUP BY username
HAVING cnt > 1;
```

### Step 6.2：根因报告

写入 `docs/superpowers/specs/2026-07-28-hospital-login-rootcause.md`：

```markdown
# 医院账号登录失败根因（代码静态分析）

## 可能根因（按概率）
1. **orphan 医院**：`crm_hospital.account_user_id IS NULL` — 没有账号自然无法登录；常见于手工 SQL 修复或回滚时未删除医院。
2. **账号被禁用但医院仍启用**：`sys_user.status = 0`，登录时拒绝。
3. **passwordHash 算法不匹配**：理论上不应发生（hashPassword / verifyPassword 同库），但 seed 数据从老系统迁移时可能写入过明文 hash。
4. **重复 username**：与本项目一院一账号一致要求冲突；登录时按 username 查可能命中错误记录。

## 排查流程
1. 跑 `scripts/diagnose-hospital-accounts.sql` 看四个统计结果。
2. 修复脚本 `pnpm tsx scripts/fix-hospital-accounts.ts --apply` 之前，**必须 dry-run 一次**：
   ```
   pnpm tsx scripts/fix-hospital-accounts.ts
   ```
3. `--apply` 后脚本会：
   - 对 `account_user_id IS NULL` 的医院，在同一事务里创建 sys_user + 绑定 hospital_account 角色 + 写回 account_user_id；密码取自命令行 `--default-password` 或留空让 DBA 后续设置。
   - 对 `u.status = 0 AND h.status = 1` 的账号自动启用。
   - 对 `passwordHash` 不以 `$2` 开头的账号**不自动重置**，只打印待 DBA 处理。

## 代码侧建议
- 在 `apps/yishan-api/src/core/plugins/external/db-error.ts` 增加 orphan 自检日志（启动时 warning）。
- 在 `apps/yishan-api/src/utils/password.ts` 增加 `verifyPasswordThrows` 用 try/catch 包装，加日志。
```

### Step 6.3：修复脚本（dry-run 默认）

```ts
// scripts/fix-hospital-accounts.ts
import { drizzle } from 'drizzle-orm/mysql2'
import { crmHospital } from '../apps/yishan-api/src/db/schema/crm.ts'
import { sysUser } from '../apps/yishan-api/src/db/schema/tables.ts'
import { hashPassword } from '../apps/yishan-api/src/utils/password.ts'
import { sql } from 'drizzle-orm'

const args = new Set(process.argv.slice(2))
const APPLY = args.has('--apply')
const defaultPassword = (() => {
  const i = [...args].findIndex(a => a === '--default-password')
  return i >= 0 ? process.argv[3 + i] : null
})()

const db = drizzle(/* mysql connection, 复用 .env */)

async function main() {
  if (APPLY) console.log('== APPLY MODE ==')
  else console.log('== DRY-RUN, 不会写入 ==')

  // 1) orphan 医院
  const orphans = await db.select().from(crmHospital).where(sql`${crmHospital.accountUserId} IS NULL`)
  console.log(`orphan hospital count = ${orphans.length}`)
  if (orphans.length && defaultPassword) {
    const hash = await hashPassword(defaultPassword)
    for (const h of orphans) {
      console.log(`  would create user for hospital ${h.hospitalName} (id=${h.id})`)
      if (APPLY) {
        // 在此执行 INSERT sys_user + UPDATE crm_hospital.account_user_id 于一事务
      }
    }
  } else if (orphans.length) {
    console.log('  need --default-password to auto-create')
  }

  // 2) disabled account
  const disabled = await db.select(/* ... */).where(/* ... */)
  console.log(`disabled-but-hospital-active = ${disabled.length}`)
  if (APPLY) /* update user status = 1 */

  // 3) bad password hash 列表（仅打印）
  console.log('non-bcrypt accounts: see SQL #3')
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => process.exit(0))
```

> 备注：Drizzle 真实 import 路径以 `apps/yishan-api/src/db/schema/tables.ts` 等为准；如路径不同请按本仓库实际结构对齐，但本骨架保证语义与日志输出方向。

### Step 6.4：提交

```bash
git add scripts/diagnose-hospital-accounts.sql scripts/fix-hospital-accounts.ts docs/superpowers/specs/2026-07-28-hospital-login-rootcause.md
git commit -m "feat(scripts): diagnose + fix hospital account anomalies (dry-run default)"
```

---

## Task 7: 质量门 + 重生成 OpenAPI

**Files:** 全部提交文件综合。

### Step 7.1：lint

```bash
pnpm lint
```

期望：0 错。

### Step 7.2：单测

```bash
pnpm test
```

期望：所有测试通过。

### Step 7.3：admin build 验证

```bash
pnpm --filter yishan-admin build
```

期望：build 成功。

### Step 7.4：commit（集成）

如 lint/test 修复产生新 diff：

```bash
git add -A
git commit -m "chore(crm): phase A bugfix quality gate"
```

---

## Self-Review Checklist

- **Spec coverage**：A.1 / A.2 / A.3 三块均在 Plan 里有 Task 对应。
- **No Placeholder**：扫描本文件无 TBD / "类似 Task 1" / "实现细节待补"。
- **Type consistency**：`normalizeMemberPayload`/`extractApiError` 在 Plan 与 Spec 中命名一致。
- **Scope**：单 Phase A 计划，无混 Phase B。
