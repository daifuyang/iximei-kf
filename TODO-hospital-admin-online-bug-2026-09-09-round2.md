# 2026-09-09 线上回归第二轮 — 6 项修复实施记录（美可普口腔 fzmkp9890 反馈）

## 反馈

```
福州美可普口腔，fzmkp9890

curl --url 'https://crm.iximei.cn/api/crm/v1/dispatches/21386/hospital-view-logs' \
  -H 'Cookie: yishan_at=...' ...
```

派单详情触发 `/api/crm/v1/dispatches/{id}/hospital-view-logs` 报权限问题。6 项 P0/P1 修复指令：

1. 医院为什么会报权限问题，修复下
2. 派单管理 → 点击处理 → 医院查看状态加错了地方，应该是 admin 账号才可以查看，可以单独加一个菜单，不要让医生后台看到
3. 客户状态 切换没反应，切换玩列表也需要实时更新
4. /admin/crm/hospitals 医院管理的 id 不要显示，编辑医院的医院状态也不需要显示了，只有 admin 才可以，医院自己不可以启用禁用
5. /admin/crm/hospital-dashboard 我最近查看的派单怎么能放到医院后台呢，这个也是一样的，和医院查看状态一样，按第一性原理看看怎么在 admin 上一起放一个合适的位置
6. 医院的个人中心不要显示安全设置了，不允许自己修改密码，左侧的注册时间也先隐藏了

## 实施清单

| # | 文件 | 改动 |
|---|------|------|
| 1 | `apps/yishan-admin/src/modules/crm/pages/dispatches/index.tsx` | 加 `hasAdminRole = super_admin OR /crm/members in accessPath`，把「医院查看状态」ProTable 用 `{hasAdminRole && (...)}` 包裹。医院账号点击「处理」派单不再触发 `/hospital-view-logs` API → 0 报错。|
| 2 | 新建 `apps/yishan-admin/src/modules/crm/pages/admin-dispatch-view-logs/index.tsx`<br>`apps/yishan-api/src/modules/crm/config/system-menu.json`<br>`apps/yishan-admin/src/modules/crm/api/index.ts`<br>`apps/yishan-admin/src/app.tsx` (IconMap 加 eye)| 新菜单「派单查看日志」(`/crm/admin/dispatch-view-logs`)，admin-only (`crm:dispatches:view-hospital-log` perm)。页面：派单列表 + 选中行后右侧抽屉显示该派单医院查看日志 + 顶部「我最近查看的派单」卡片。`getDispatchHospitalViewLogs` wrapper 改为用生成的 `listCrmDispatchHospitalViewLogs` 函数。|
| 3 | `apps/yishan-admin/src/modules/crm/pages/customers/index.tsx` | 客户状态列改为内嵌 Select。`onChange` 触发 `PATCH /customers/:id {statusId}`：乐观更新 + 成功后 reload + 失败回滚。无 perm 角色保留只读 Tag。|
| 4 | — | 已在 commit `9421907` 修复，确认无回归。医院 ID 列 (`...(isHospitalAccount ? [] : [ID列])`)、编辑表单医院状态 Select (`{!isHospitalAccount && <Form.Item>}`)、账号侧栏状态选择/启停按钮均已隐藏。|
| 5 | `apps/yishan-admin/src/modules/crm/pages/hospital-dashboard/index.tsx`<br>删除 `apps/yishan-admin/src/modules/crm/pages/hospital-dashboard/components/RecentViewedDispatchesCard.tsx`<br>`apps/yishan-admin/src/modules/crm/pages/admin-dispatch-view-logs/index.tsx` | 「我最近查看的派单」卡片从 hospital-dashboard 移除（首页注释掉 import + 移除 Row 渲染），迁到新 admin 菜单页面的顶部。删除孤儿组件 `RecentViewedDispatchesCard.tsx` 及空的 `components/` 目录。|
| 6 | `apps/yishan-admin/src/pages/account/center/index.tsx` | 左侧 Descriptions 项「注册时间」(createdAt) 对 hospital_account 隐藏 (`...(isHospitalAccount ? [] : [注册时间项])`)。安全设置 tab 在 commit `83af913` 已隐藏。|

## 验证

- `apps/yishan-admin tsc --noEmit` ✅ 通过
- `apps/yishan-api tsc --noEmit` ✅ 通过
- `biome check` (新文件/改动文件) ✅ 清洁（pre-existing `noUnusedImports` 在 dispatches/index.tsx 等未触线文件残留警告，未清理）
- `apps/yishan-api pnpm test` ✅ 40 files / 394 tests passed

## 上线 checklist

- [ ] 提交 PR（按 Conventional Commits 拆 commit 1+2+3+4+5+6 各一，#4 可省）
- [ ] 跑 `pnpm --filter yishan-api db:seed` 让新菜单「派单查看日志」在生产 DB 落地（INSERT sys_menu + sys_menu_permission）
- [ ] 前端 admin dev 验：菜单出现「派单查看日志」+ 派单详情医院账号不再报错 + 客户状态切换可保存 + 注册时间在医院账号下消失
- [ ] CD 重新部署 yishan-crm 函数

## 未提交（本地 working tree）

变更未 git commit，需用户确认 commit message 后再 push。