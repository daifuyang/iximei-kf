# CRM modules/ 迁移待办（2026-07-24 同步）

这一轮把 `iximei/crm` 旧插件迁移到 upstream 的 `apps/yishan-api/src/modules/crm/` 结构 + `apps/yishan-admin/src/modules/crm/pages/`。代码主体已完成，编译期剩下的几个集成步骤需要跑对应脚本：

## 必须跑（集成）

1. **API 端 drizzle 链路**
   ```bash
   pnpm --filter yishan-api db:generate
   ```
   跑完会产出 `apps/yishan-api/src/modules/crm/drizzle/meta/0000_snapshot.json`（目前用占位符）。
   此时 SQL 与 db/schema.ts 已自洽；`pnpm --filter yishan-api db:migrate` 把 `drizzle/0000_init.sql` 真正落到 MySQL。

2. **重新生成 OpenAPI 与 admin 客户端**
   - 启动 API（带新 CRM module）：`pnpm --filter yishan-api dev`
   - 在 admin 侧重新生成：
     ```bash
     pnpm --filter yishan-admin openapi
     ```
   这会把 `apps/yishan-api/openapi.json` 中的 `crm*` endpoints 编译到 `apps/yishan-admin/src/services/generated/{crmHospitals,crmCustomers,crmDispatches,crmMembers}.ts`，让 admin pages 当前 `import { crmListXxx } from '@/services/generated/crmXxx'` 的引用解决。

3. **Admin 端 plugin.ts 重新生成 module-components map**
   ```bash
   pnpm --filter yishan-admin build
   ```
   或启动 dev server。`plugin.ts` 会扫描 `src/modules/<id>/pages/<page>/index.tsx`，生成 `src/.umi/module-components.ts`，把 `./modules/crm/{hospitals,customers,dispatches,members}` 这四个虚拟路径接上。

## 已经通过

- `tsc --noEmit` 在 api 端干净，无 error。
- `scripts/check-module-naming.mjs` ok（14 表 / 2 modules：demo + crm）。
- `git reset --hard upstream/main` 后工作区已 `git restore` 还原，tracked 1000 文件。

## 已知遗留 / 后续

| 项 | 说明 |
|---|---|
| `drizzle/meta/0000_snapshot.json` | 当前是占位（用 1784622315878 这类参考时间戳），跑 `db:generate` 后会被真实快照覆盖。 |
| Admin `crm/api/index.ts` 引用的 `crmHospitals/Customers/Dispatches/Members` 不存在 | 必须先跑 `pnpm openapi`。否则 pages/`index.tsx` 编译失败。 |
| `src/modules/crm/routes/v1/index.ts` 仅返回 `SuccessRespSchema`/`PaginatedRespSchema`，没有 per-route resp schema | OpenAPI 文档元信息可以从 schema body 体推；运行时返回的是 service result，保持简单。如需严格生成 OpenAPI $ref 给前端，需要再为每个 handler 写 `response: { 200: <specific schema> }`。 |
| 表前缀 `iximei_crm_*` → `crm_*` 是 break change | 已部署的 crm DB 需要数据迁移（导出 + 改名 + 重导）。当前 fork 的生产库若是 iximei_crm_* 没迁移过来，前端会报 404。 |
| CRM 路由被 `m.crm` | 路由 prefix 自动为 `/api/crm/v1/*`，旧的 `/api/crm/v1/*`（如果产品已挂）字段都一样，所以 OpenAPI regen 即可。 |
| admin `apps/yishan-admin/src/services/generated/crmWeixin.ts` 没生成 | 公共 weixin 路由已加上，但 admin 没有对应页面（旧版也没有），可忽略。 |
| `apps/yishan-api/src/scripts/seed/modules/system-menu.ts` 没集成 crm 菜单 | CRM 菜单通过 `crm/config/system-menu.json` + 启动时 first-sync → 由 module-loader 启动时把 menu 灌入 `sys_menu`。若旧 DB 已经有的话，仅在 first sync 写入；后续 SYS_MENU 自动维护。 |
