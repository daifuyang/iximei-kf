# Phase C.2A 图标提醒增强（Icon Enhancement）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Phase B T10 60s 轮询基础上，给医院账号 badge 加 5 项前端体验增强（无需后端改动）。

**Architecture:** 1 个 React 组件 (`HospitalUnviewedBadge`) 内部加 4 个 hook（document.title / Notification API / visibilitychange / 99+ 截断），不改后端、不动 schema、不增依赖。

**Tech Stack:** React 19 + Antd Design Pro 6 + 浏览器原生 Notification / visibilitychange / document.title API（无新依赖）。

**Spec:** `docs/superpowers/specs/2026-07-28-c2-icon-enhancement-design.md`

---

## Global Constraints

- 不引新 npm 依赖
- 不改后端任何文件
- 1 个文件改动：`apps/yishan-admin/src/components/HospitalUnviewedBadge/index.tsx`
- 浏览器原生 API（Notification / visibilitychange / document.title）— 不引 polyfill
- role 门禁用 `ROLE_IDS.HOSPITAL_ACCOUNT` enum 引用（Phase B T10 fix 后的约定）
- 跑命令前 `unset http_proxy https_proxy all_proxy`
- pnpm filter 加 `--config.confirmModulesPurge=false`
- admin tsc 必须 0 errors
- 已有 brief self-check 约定：**如果发现 brief 与代码不一致，主动 ping，不要照搬**

---

## File Structure Overview

| 文件 | 类型 | Task |
| --- | --- | --- |
| `apps/yishan-admin/src/components/HospitalUnviewedBadge/index.tsx` | 修改 | T1 |
| `docs/superpowers/handoffs/2026-07-28-phase-c2a.md` | 新增 | T2 |
| (T3) | — | quality gate |

---

## Task 1: HospitalUnviewedBadge 升级

**Files:**
- Modify: `apps/yishan-admin/src/components/HospitalUnviewedBadge/index.tsx`

### Step 1.1：先 read 现有组件

派发前**先 read** `apps/yishan-admin/src/components/HospitalUnviewedBadge/index.tsx` 完整内容，确认：
- 当前轮询逻辑
- 当前 role gate
- 当前 useState / useEffect 结构

如发现与 plan 假设不一致，**主动 escalate**。

### Step 1.2：升级实现

按 spec §4.2 完整代码加 4 个 hook：

```tsx
// 4 个新 hook 抽到文件顶部
function useDocumentTitle(count: number) { ... }
function useNotificationPermission() { ... }
function useBrowserNotification(count: number, lastCount: number) { ... }
function useVisibilityRefresh(fetcher: () => void) { ... }

// 组件内部
export default function HospitalUnviewedBadge() {
  // 沿用现有 role gate / 轮询逻辑
  // 在 4 处 return 前调用 4 个 hook
}
```

**关键行为**：
- 99+ 截断：`count > 99 ? '99+' : count`
- dot 闪烁：loading 时用 antd Badge `dot` prop
- 标题前缀：`document.title = (🔔 ${count}) ${ORIGIN_TITLE}`
- 通知：count > lastCountRef.current 且 Notification.permission === 'granted'

### Step 1.3：tsc 0 errors

```bash
cd apps/yishan-admin && npx max setup && npx tsc --noEmit
```

期望：exit 0。

### Step 1.4：commit

```bash
git add apps/yishan-admin/src/components/HospitalUnviewedBadge/
git commit -m "feat(crm-admin): hospital badge icon enhancement (title/notification/visibility/99+)"
```

---

## Task 2: Handoff 文档 + push

**Files:**
- Create: `docs/superpowers/handoffs/2026-07-28-phase-c2a.md`

### Step 2.1：写 handoff

按 C.1 模板覆盖：
- 用户原话 ⑧ 通知增强（A 部分）
- 1 commit 清单
- 4 个 hook 行为
- Quality gate 预期（T3 补）
- C.2B 邮件推送 follow-up

### Step 2.2：commit + push

```bash
git add docs/superpowers/handoffs/2026-07-28-phase-c2a.md
git commit -m "docs(crm): phase C.2A delivery handoff summary"
git push origin main
```

---

## Task 3: 质量门

### Step 3.1：lint + test + admin build

```bash
unset http_proxy https_proxy all_proxy
cd /home/ubuntu/workspace/iximei-kf
pnpm lint 2>&1 | tail -30
pnpm --filter yishan-admin test 2>&1 | tail -10
pnpm --filter yishan-api test 2>&1 | tail -10
pnpm --filter yishan-admin build 2>&1 | tail -30
```

### Step 3.2：commit（如有 diff）

---

## Self-Review

- **Spec coverage**：
  - §4.1-4.2 5 个增强（document.title / Notification / visibilitychange / 99+ / 数字动画） → T1
  - 验收 §5 → T3 质量门
  - handoff → T2
- **No Placeholder**：无 TBD
- **Type consistency**：1 个文件，4 个 hook 命名统一
- **Scope**：1 spec / 1 plan / 3 task，Phase C.2A 闭环
- **避免 brief 复制陷阱**：Step 1.1 显式要求先 read + 不一致就 escalate
