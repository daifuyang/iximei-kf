# 2026-09-10 线上回归验收报告 — 美可普口腔（fzmkp9890）6项修复

## 部署

| 阶段 | 状态 |
|------|------|
| 7 commits push origin/main (`4769c40` → `7f08569`) | ✓ |
| CD run 1 (`34492678245`) 一次过 success | ✓ |
| CD run 2 (`34498051444`) ER_LOCK_DEADLOCK 重试 → run 3 success | ✓ |
| `/api/build` 线上 commitSha | `7f085695e079` |
| 截图 | `screenshots/2026-09-10-round2/` |

**线上回归过程还**发现两个隐性 bug**，本次一并 hotfix**：
- `apps/yishan-admin/src/modules/crm/pages/hospitals/index.tsx` 用 `useIsHospitalAccount()` 判定角色
- `apps/yishan-admin/src/pages/account/center/index.tsx` 同样用 `useIsHospitalAccount()`
- 但 `/auth/me` **不返回** `roleIds` 字段（前端 CurrentUser 类型只有 roleIds + permissions），hook 永远返回 false
- 结果：医院账号登录后 ID 列、医院状态编辑、停用按钮、Security tab、注册时间全部未真正隐藏

→ commit `16a5b74`（hospitals）+ commit `7f08569`（account/center）改用 perm + accessPath 启发式（与 dispatches 一致）兜底。

---

## 6 项修复验收

### #1 — 派单详情医院账号权限报错 ✅

| 验证项 | 结果 |
|--------|------|
| **医院账号登录** | `fzmkp9890` (id=792) → `username=福州美可普口腔` (已 reset密码)  ✓ |
| **派单详情 API 调用** | `GET /api/crm/v1/dispatches/21386` → 200（详情正常加载）|
| | **无** `GET /dispatches/21386/hospital-view-logs` 调用 ✓（修复前必报 403）|
| | **无** `GET /dispatches/21386/mobile-view-logs` 调用（admin-only 不显示）|
| **Console errors** | **0 errors, 0 warnings** ✓ |
| **后端 gate 验证** | 直接 curl `hospital-view-logs` 用 hospital token → `{"code":22002,"message":"当前用户没有权限访问要求 crm:dispatches:view-hospital-log 的接口"}` （后端 perm gate 正确） |

### #2 — 医院查看状态单独菜单 ✅

| 验证项 | 结果 |
|--------|------|
| **菜单渲染** | admin 视角左侧菜单：派单查看日志（含 icon `eye`）✓ |
| **路由** | `/admin/crm/admin/dispatch-view-logs` 直接访问 ✓ |
| **页面标题** | `派单查看日志 - 熙爱美客户管理系统` |
| **菜单项 perm** | `crm:dispatches:view-hospital-log`（hospital_account seed 黑名单）|
| **派单详情 modal** | admin 视角仍可见「医院查看状态」段（hasAdminRole gate）|
| | hospital_account 视角 modal **无**该段 ✓（已修复 hasAdminRole 包裹）|
| **截图** | `screenshots/2026-09-10-round2/admin-dispatch-view-logs-admin.png` |

### #3 — 客户状态 inline 切换 ✅

| 验证项 | 结果 |
|--------|------|
| **admin 视角** | 客户状态列变成内嵌 Select（20 行 × 1 select = 20 个 inline Select）|
| **headers** | `["ID","客户编号","客户姓名","手机","整形项目","客户状态","所属客服","创建时间","操作"]` |
| **5 个状态字典** | 资料录入 / 待跟进 / 重单 / 已手术 / 无效用户（GET /customers/statuses）|
| **截图** | `screenshots/2026-09-10-round2/customer-inline-select-admin.png` |
| **行为预期** | onChange → PATCH /customers/:id {statusId} → 乐观更新 + reload；失败回滚 |
| **无 perm 角色** | 保留只读 Tag（保持向后兼容）|

### #4 — 医院管理 ID/状态 隐藏 ✅（**hotfix 后**）

| 视角 | ID 列 | 编辑表单医院状态 | 账号侧栏停用按钮 |
|------|------|---------------|---------|
| admin（super_admin）| ✓ 可见 | ✓ 可见 | ✓ 可见 |
| hospital_account | ✗ 隐藏（hotfix后）| ✗ 隐藏（hotfix后）| ✗ 隐藏（hotfix后）|

**hotfix commit `16a5b74`**：替换 `useIsHospitalAccount()` → perm + accessPath 启发式（/auth/me 不返回 roleIds 导致 hook 永远 false）。

### #5 — 我最近查看的派单移到 admin ✅

| 验证项 | 结果 |
|--------|------|
| **admin 新菜单** | `/admin/crm/admin/dispatch-view-logs` 顶部「我最近查看的派单」卡片 + 「仅管理员可见」Tag ✓ |
| **hospital-dashboard** | 不再含「我最近查看的派单」卡片 ✓（`document.body.textContent.includes('我最近查看的派单')` → false）|
| **截图** | `screenshots/2026-09-10-round2/admin-dispatch-view-logs-admin.png` |

### #6 — 个人中心隐藏安全设置 + 注册时间 ✅（**hotfix 后**）

| 视角 | Profile | Security | API Token | 注册时间 |
|------|---------|----------|-----------|---------|
| admin | ✓ | ✓ | ✓ | ✓ |
| hospital_account | ✓ | ✗ 隐藏（hotfix后）| ✓（持有 perm）| ✗ 隐藏（hotfix后）|

**hotfix commit `7f08569`**：account/center 同款修复，用页内 perm + accessPath 启发式。

---

## 截图清单

```
screenshots/2026-09-10-round2/
├── admin-dispatch-view-logs.png         # 新 admin 菜单（hospital_account 视角，无权限不可访问）
├── admin-dispatch-view-logs-admin.png   # admin 视角新菜单页含「我最近查看的派单」卡片
├── customer-inline-select-admin.png     # admin 视角客户列表 — 客户状态为 inline Select
├── customer-status-inline.png           # 旧截图（修复前 inline 已生效但本字段无权限角色看 Tag）
└── dispatch-detail-admin.png            # admin 视角派单详情 — 仍含「医院查看状态」段
```

## 修复 commits

```
7f08569 fix(crm-admin): account/center 角色判定同样 roleIds 永远空 → 用启发式兜底
16a5b74 fix(crm-admin): hospitals page 角色判定用 perm+accessPath 兜底（roleIds 永远空）
4769c40 docs: memory_remember tool failure diagnosis 2026-09-10
d403077 docs: add 2026-09-09 round-2 hospital admin bug fix implementation log
67254f8 fix(crm-admin): hide registration time from hospital_account in profile
634d1c6 refactor(crm-admin): move recent-viewed-dispatches from hospital to admin dashboard
8b70f6a feat(crm-admin): inline customer status switcher with optimistic update
de69718 feat(crm-admin): add admin-only dispatch view-logs menu page
e977489 fix(crm-admin): hide hospital-view-status from hospital_account in dispatch modal
```

## 关键 lesson（已并入 memory `0mt4fp0jz`）

**`/auth/me` 不返回 `roleIds` 字段，但前端多个 `useIsHospitalAccount()` hook 依赖此字段 → 永远 false**。
- 表现：医院账号登录后所有「医院账号隐藏」逻辑全部失效
- 根因：`CurrentUser` 类型声明含 `roleIds`，但 `/auth/me` 路由实际未在响应中写入
- 解决：用 perm + accessPath 启发式（与 dispatches 页一致）兜底
- 下次：所有 role-aware UI 必须双轨实现——既要 hook 也要启发式，或后端补全 `/auth/me` 返回 roleIds

## 待办（可选）

- [ ] 后端 `/auth/me` 响应补 `roleIds` 字段——一次性根治 useIsHospitalAccount 永远 false
- [ ] CD 自动重试 ER_LOCK_DEADLOCK（run 2 死锁已重试一次成功，跑通对策）