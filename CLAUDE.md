# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

Yishan (移山通用管理系统) is a pnpm monorepo for a generic admin baseline used at zerocmf.com:

- `apps/yishan-admin` — React 19 + Ant Design Pro 6 + UmiJS 4 (`@umijs/max`) admin frontend
- `apps/yishan-api` — Fastify 5 + Drizzle + TypeBox + JWT backend
- `apps/yishan-app` — WeChat mini-program (Taro/uni-app style, see `apps/yishan-app/`)
- `apps/yishan-docs` — Docusaurus 3 docs site
- `apps/yishan-components/yishan-tiptap` — shared TipTap 3 React component library (Rollup, CJS/ESM/types/css)

Toolchain pinned in `.tool-versions` / root `package.json#packageManager`: Node 22.22.1, pnpm 8.15.9. Use asdf / mise / fnm to honor `.tool-versions` automatically.

## Common commands

All commands run from the repo root unless noted.

```bash
# Install
pnpm install

# Full build (order matters: tiptap → admin → docs)
pnpm build
# Equivalent to:
#   pnpm --filter yishan-tiptap build
#   pnpm --filter yishan-admin build
#   pnpm --filter yishan-docs build

# Per-app dev (run in separate terminals)
pnpm --filter yishan-tiptap build         # admin depends on built tiptap
pnpm --filter yishan-admin dev            # Umi dev server (port 8000 by default for preview)
pnpm --filter yishan-api dev              # TypeScript watch + Fastify auto-reload
pnpm --filter yishan-docs start           # Docusaurus dev

# Quality gate (matches CI)
pnpm lint      # admin (Biome + tsc) + docs (typecheck) + app + check-module-naming
pnpm test      # admin (Jest) + api (Vitest)

# Backend DB (Drizzle)
pnpm --filter yishan-api db:generate      # generate migrations from schema
pnpm --filter yishan-api db:migrate       # apply migrations
pnpm --filter yishan-api db:seed          # run seed scripts (builds TS first)
pnpm --filter yishan-api db:reset         # rebuild DB
```

### Admin-specific scripts (cd into `apps/yishan-admin`)
```bash
pnpm start              # alias for start:dev (UMI_ENV=dev, MOCK=none)
pnpm openapi            # regenerate API client from backend OpenAPI
pnpm test               # Jest
pnpm test:update        # update snapshots
pnpm test:coverage      # with coverage
pnpm analyze            # production build with bundle analyzer
pnpm preview            # build + serve on :8000
```
The `lint` script runs `max setup` (via `prelint`) then Biome + `tsc --noEmit`. Jest needs `.umi/` artifacts — `max setup` must run first; CI does this explicitly.

### API-specific scripts (cd into `apps/yishan-api`)
```bash
pnpm dev                # TS watch + fastify-cli start with watch
pnpm test               # vitest run
pnpm test:watch         # vitest watch
pnpm test:integration   # vitest run test/integration
pnpm build:ts           # build: gen-tsconfig + tsc + tsc-alias
```

### Running a single test
```bash
# API — vitest (from apps/yishan-api)
pnpm --filter yishan-api test -- -t "test name pattern"
pnpm --filter yishan-api test -- path/to/test/file.test.ts

# Admin — Jest (from apps/yishan-admin)
pnpm --filter yishan-admin test -- -t "test name pattern"
pnpm --filter yishan-admin test -- path/to/test/file.test.ts
```

## Architecture: the module system

The most distinctive thing in this repo is the business-module plugin system in `apps/yishan-api`. Read `apps/yishan-api/src/core/module-loader/module-loader.ts` and `apps/yishan-api/src/app.ts` for the full picture; `docs/module-onboarding.md` is the developer onboarding guide.

### Layout
- Each business capability lives at `apps/yishan-api/src/modules/<id>/`
- A module owns: `module.ts` (entry), `db/schema.ts` (Drizzle tables), `drizzle.config.ts`, `drizzle/0000_init.sql` + `drizzle/meta/{_journal,0000_snapshot}.json`, `repositories/`, `services/`, `schemas/`, `routes/`, `tests/`, `config/system-menu.json`, `permissions.ts`, optional `seed.ts`
- `module.ts` exports `meta = { id, enabled? }` and a default `fastify-plugin` async function
- Current modules: `demo` (1 table, reference), `crm` (5 entities: hospitals/customers/dispatches/members + dashboard)

### Lifecycle
1. **Boot scan** — `app.ts` calls `moduleLoader.scanDiskModules()`, reading `dist/modules/<id>/module.js` (always from dist, not src)
2. **DB sync** — `syncModulesFromDisk` upserts each module into `sys_module` (`name`, `table_prefix`, `version`, `updated_at`). **`enabled` is never overwritten** — first sync uses `meta.enabled` (default `true`), subsequent runs preserve the runtime toggle.
3. **Mount** — `mountAllOnDisk` registers every on-disk module under prefix `/api/<id>` via `@fastify/autoload` on the module's `routes/` dir. This happens unconditionally — fastify's plugin tree is immutable after boot.
4. **Gate** — An `onRequest` hook on the root instance (registered before module routes) checks `sys_module.enabled` (with Redis cache + 5s in-process memo) and returns 404 for disabled modules. **This is how runtime enable/disable works — no hot-mount.**

### Hard invariants (enforced by `scripts/check-module-naming.mjs` + review)
- `meta.id` is globally unique; lower-case + digits + underscores; ≤ 24 chars. Duplicates fail-fast at boot.
- Route prefix is hardcoded to `/api/${id}` — modules don't declare it.
- Module **table names must start with `<id>_`** (e.g. `demo_documents`). Cross-module duplicate table names also fail lint.
- **Core never imports module source. Modules never import each other.** Modules join across their own tables only; cross-module reads go through HTTP or Core extensions.
- **Routes never import drizzle tables or write SQL directly.** Only `repositories/` may import the Drizzle schema and execute queries. Services orchestrate; routes validate and shape.
- Don't create `sys_*` tables in modules; don't modify existing `sys_*` Core tables.
- Frontend menu paths use `/<id>/...` at root — **no `/modules/` prefix** in URLs (the `/modules/` segment is only a source directory convention).
- Module enable/disable is the operator's decision; the `enabled` field is the source of truth, not `meta.enabled` after first sync.

### Module enable/disable UX
Dev-only routes under `core/routes/_dev/` (mounted only when `NODE_ENV !== 'production'`) drive the runtime toggle and invalidate Redis cache + in-process memo. Production hides these routes and they ship without devDeps (`deploy/fc3/scripts/build-runtime-layer.sh` strips them).

### Per-module Drizzle migrations
Each module ships its own `drizzle.config.ts` + `drizzle/0000_init.sql` + `drizzle/meta/{_journal,0000_snapshot}.json`. To regenerate migrations after schema changes, run from the **module directory**:
```bash
cd apps/yishan-api/src/modules/<id>
npx drizzle-kit generate --config=./drizzle.config.ts
npx drizzle-kit migrate --config=./drizzle.config.ts
```
Migrations are not auto-applied at boot — operators run them via `pnpm --filter yishan-api db:migrate`.

### Configuring a module's seed data
The `seed.ts` file in a module directory is imported by `apps/yishan-api/src/scripts/seed/index.ts`. Seed scripts run via `pnpm --filter yishan-api db:seed` (which does `build:ts` first, then runs from dist). Seeds must be idempotent — use `INSERT ... ON DUPLICATE KEY UPDATE`.

### Auto-seed in fullstack CD
`yishan-fullstack-cd-fc.yml` deploys the layered function, then auto-runs `db:seed` to keep `sys_role_menu` + `sys_role_permission` in sync with the latest `crm/seed.ts` + `permissions.ts`. Three env flags keep it DDL-free (production `iximei_crm_app` is DML + `CREATE/ALTER/INDEX/REFERENCES` only):
- `SEED_MINIMAL=true` — skip dept/post/dict/option/region demo data
- `SEED_SKIP_MIGRATE=true` — skip core `drizzle-kit migrate`
- `SEED_SKIP_MODULE_MIGRATE=true` — skip `onboard-modules.ts` per-module `drizzle-kit migrate`

Schema migrations still go through `yishan-fc-migrate.yml` (root account on the dedicated `MIGRATION_RUNNER_NAME` function); never via the auto-seed step. If the auto-seed step fails, the deploy has already succeeded — re-run `pnpm --filter yishan-api db:seed` with the same flags from a privileged environment.

## Architecture: admin route system

The admin routing is split into two layers, with the backend `sys_menu` table as the single source of truth for business pages.

### Layer 1: Framework routes (`config/routes.ts`)
Declares only non-business routes: login, change-password, 404, index container, and the redirect from `/account/api-tokens` → `/account/center`. These exist regardless of user or role.

### Layer 2: Business routes (dynamic, backend-driven)
The full flow:
1. **Build time** — `plugin.ts` scans `src/pages/` + `src/modules/<id>/pages/` and generates `.umi/module-components.ts`, producing `moduleComponentsMap`: key = virtual path like `./modules/demo/todos`, value = lazy `import()` factory.
2. **Render time** — `app.tsx:render()` calls `GET /api/v1/admin/menus/tree/authorized`, which returns the menu tree filtered by the user's role. Each non-directory, non-external-link node carries a `component` field (e.g. `./modules/demo/todos`).
3. **Route injection** — `app.tsx:patchClientRoutes()` converts the menu tree into umi routes via `menuTreeToRoutes()` from `src/utils/menuRoutes.ts`. The resolver (`src/utils/moduleComponents.ts`) maps virtual paths to lazy React elements. Dynamic routes are merged into `rootRoute.children`, deduped by path.
4. **Access control** — `src/access.ts` uses `currentUser.accessPath` (from `GET /auth/me`) for route-level access; each page also has its own permission guard.

**Key consequence**: adding a new business page only requires inserting a row in `sys_menu` with the right `component` field — zero frontend code changes.

### Key files
| File | Role |
| --- | --- |
| `apps/yishan-admin/plugin.ts` | Build-time scanner: generates `moduleComponentsMap` |
| `apps/yishan-admin/config/routes.ts` | Framework routes only |
| `apps/yishan-admin/src/app.tsx` | `patchClientRoutes` + `render` (menu fetch + dynamic route injection) |
| `apps/yishan-admin/src/utils/menuRoutes.ts` | Menu tree → umi route converter |
| `apps/yishan-admin/src/utils/moduleComponents.ts` | Resolves virtual component paths to lazy elements |
| `apps/yishan-admin/src/access.ts` | Route-level access via `currentUser.accessPath` |

## Architecture: RBAC and permissions

### Permission codes
Permissions use the naming convention `<resource>:<entity>:<action>` (e.g. `system:user:list`, `crm:hospital:create`). Core permissions are declared in `apps/yishan-api/src/constants/permission-codes.ts`. Module permissions are declared in each module's `permissions.ts` and registered via `registerPermissions()` from `@/core/permissions/catalog.js`.

### Role codes
Built-in roles defined in `permission-codes.ts`:
- `super_admin` — full permissions, full data scope (ALL)
- `admin` — normal admin (subset of permissions)
- `normal_user` — basic user
- `hospital_account` — hospital-scoped: sees only their affiliated hospital's data
- `customer_service` — customer-scoped: sees only their own customers (`owner_user_id = current user`)

### How permissions are enforced
1. **Route registration** — `registerPermissions(...)` in module `permissions.ts` adds codes to the global catalog at import time.
2. **Route preHandler** — routes call `fastify.requirePermission(PERMS.SOME_ACTION)` which returns a preHandler that checks the JWT/PAT identity holds the required permission code.
3. **super_admin bypass** — `permission.service.ts` injects `__super_admin__` sentinel when the user holds the `super_admin` role; `PermissionService.has()` short-circuits.
4. **Data scope** — `PermissionService.getDataScope(roles)` returns the most permissive scope for the current user. Services/repositories use this to filter queries (e.g. CRM dashboard filters hospitals/customers by scope).

### API Token auth model (post July 2026 refactor)
API Tokens are **identity credentials only** — they authenticate the user but do NOT carry their own permissions or scopes. The user's current RBAC roles determine all permissions and data scopes, regardless of whether the request uses JWT, PAT, or session cookie. Token `scopes` field is deprecated and ignored at runtime (pending physical column removal in a future migration).

## Architecture: admin / api / shared

- **Admin** uses Umi Max's `plugin.ts` to register Ant Design Pro blocks. `apps/yishan-admin/config/routes.ts` is intentionally lean — menu structure is **driven by backend `sys_menu.component`** (post July 2026 refactor; see root `TODO.md`).
- **Admin module pages** live under `apps/yishan-admin/src/modules/<id>/pages/<page>/index.tsx`. `plugin.ts` scans this directory at build time and generates `moduleComponentsMap` (key `./modules/<id>/<page>` → `@/modules/<id>/pages/<page>`). The `component` field in menu JSON must use this exact `./modules/<id>/<page>` form.
- **OpenAPI sync**: `pnpm --filter yishan-admin openapi` regenerates `src/services/generated/<module>.ts` from `apps/yishan-api/openapi.json`. The generated `typings.d.ts` (committed) provides the `API.*Params` ambient namespace. **Both files must be committed together** for fresh checkouts to compile. The backend also serves Swagger UI live at `/api/docs`.
- **CRITICAL — generated services are read-only**: Never hand-write API client functions in `src/services/generated/`. Every route MUST declare `operationId` and, if the generator skips the endpoint, fix the backend so it gets included (ensure the route has a `response` schema with a proper TypeBox type — the generator needs a response schema to emit the client function). Hand-written wrappers/adapters go in `src/modules/<id>/api/index.ts`, importing from the generated service. The generated `typings.d.ts` must never be manually edited either — type definitions come from backend schemas.
- **`operationId` is frontend API**: Umi OpenAPI emits it directly as a TypeScript service export. Use stable `lowerCamelCase` in the form `<action><Domain><Resource>[<Qualifier>]`, e.g. `listCrmCustomers`, `getCrmCustomer`, `createCrmCustomerRemark`, `getSystemTokenStats`. Start with a precise verb (`list`, `get`, `create`, `update`, `delete`, `search`, or the real business action such as `dispatch`/`assign`); include the domain to prevent cross-module collisions; use plural resources for collections and singular resources for a single item. Do not use dots, hyphens, URL versions (`V1`), UI words (`Detail`, `Manage`), or vague verbs (`handle`). Renaming an existing `operationId` is a breaking change to generated clients and Restish; update generated services and the module adapter together, or introduce a versioned API migration.
- **JWT secret gate**: production refuses to boot with a default/weak `JWT_SECRET` (see `core/plugins/external/jwt-secret-validator.ts`). Dev/CI only warn.
- **Auth bypass codes**: `BYPASS_CODES` in admin allows local testing of specific routes; `auth:logout` was removed (bugfix in July 2026) — don't add it back.
- **TipTap**: builds to `dist/` with both CJS and ESM; admin imports it as `workspace:^` and **must rebuild tiptap after tipTap source changes** before re-running admin.
- **API response envelope**: all endpoints return `{ success, code, message, data, timestamp }`. The global not-found handler uses `code: 25005` (distinct from the module-disabled gate's `code: 40400`).

## Module reference: CRM (data-scoped CRUD)

The `crm` module (`apps/yishan-api/src/modules/crm/`) is the most complete module and the reference for data-scoped CRUD. It manages 5 entities across 3 role types:

| Entity | Repository | Service | Routes | Schema |
| --- | --- | --- | --- | --- |
| hospitals | `repositories/hospitals.repository.ts` | `services/hospitals.service.ts` | `routes/v1/hospitals/` | `schemas/hospitals.schema.ts` |
| customers | `repositories/customers.repository.ts` | `services/customers.service.ts` | `routes/v1/customers/` | `schemas/customers.schema.ts` |
| dispatches | `repositories/dispatches.repository.ts` | `services/dispatches.service.ts` | `routes/v1/dispatches/` | `schemas/dispatches.schema.ts` |
| members | `repositories/members.repository.ts` | `services/members.service.ts` | `routes/v1/members/` | `schemas/members.schema.ts` |
| dashboard | `repositories/dashboard.repository.ts` | `services/dashboard.service.ts` | `routes/v1/dashboard/` | `schemas/dashboard.schema.ts` |

### Data scope patterns
- **Soft deletes**: all entities use `deletedAt IS NULL` for active records (see `crmHospital`, `crmCustomer`, etc. in `db/schema.ts`)
- **Role-based filtering**: repositories accept a `scope` parameter (`ALL` / `HOSPITAL` / `OWN`) and build WHERE clauses accordingly. `hospital_account` sees only their hospital; `customer_service` sees only owned customers; `super_admin` sees everything.
- **Cross-entity convergence**: when filtering by hospital, all related entities (dispatches, customers) are scoped to that hospital. The dashboard service enforces this consistently across all metric queries.

### CRM permissions
Declared in `permissions.ts`: `crm:hospitals:{list,create,update,delete}`, `crm:customers:{list,create,update,delete,dispatch}`, `crm:dispatches:{list,update,delete,reply,log}`, `crm:members:{list,create,update,delete,remark}`, `crm:dashboard:view`.

## Quality gate before commit

Per `CONTRIBUTING.md` and CI (`.github/workflows/yishan-fullstack-ci.yml`):

1. Run the lint/test/build for the apps you touched (root `pnpm lint`, `pnpm test`, `pnpm build`).
2. Follow Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`. Husky + lint-staged are wired in `yishan-admin`.
3. Architecture-affecting changes must update root docs (TODO files, README, this file).
4. Don't stage scratch/plan docs in `tmp/` — they're gitignored.

## Frontend page conventions (admin / Ant Design Pro 6)

These rules were hardened while iterating the `demo` module pages (`/demo/quickstart`, `/demo/health`, `/demo/todos`). New module pages should follow them by default.

### `PageContainer` header
- **Don't pass `header.breadcrumb: {}`**. `PageContainer` generates the route breadcrumb automatically; passing an empty object explicitly disables it and the page loses its breadcrumb. `system/user` is the reference — it omits `breadcrumb` entirely.
- **Avoid `header.subTitle`** unless the page genuinely needs a subtitle under the title (e.g. a doc-style landing page). For typical list/detail pages the title alone is enough; over-explaining in the header eats vertical space.
- Prefer placing action buttons in `ProTable.toolBarRender` (right side, consistent with `system/user`) rather than `PageContainer.extra`. Reserve `extra` for page-level actions outside any table.

### `ProTable` usage
- **Don't wrap `ProTable` in `ProCard`** when the page is fundamentally a table — `ProTable` already provides its own card chrome, header bar, search form, and toolbar. Wrapping it hides the layered structure (`headerTitle` + `search` + `toolbar` + `table`) and breaks visual parity with `system/user`.
- Set `headerTitle` to give the table a title (e.g. `"用户列表"` / `"Todo 列表"`).
- For status columns, prefer `valueEnum` (or `valueType: 'select'` + `fieldProps.options`) and let ProTable render the badge — don't hand-write `render: (_, r) => <Tag>...`. Hand-written renders add vertical padding and look out of place next to the system table.
- For date/time columns use `valueType: 'dateTime'`. If a non-default format is genuinely needed, keep `width` aligned with neighbouring date columns and see "Time formatting" below.
- Operation column: `dataIndex: 'option'`, `valueType: 'option'`, `fixed: 'right'`, `width: 160`, and wrap the action links in `<Space size={16}>` using `<a>` (not `<Button type="link">`). Match the `system/user` reference exactly.

### Time formatting
- Use `dayjs` (already in `apps/yishan-admin/package.json` dependencies, used by `system/user` and `account/center`). It's the project-standard formatter.
- For CN-locale pages, format with `dayjs(value).format('YYYY-MM-DD HH:mm:ss')`. dayjs defaults to the runtime's local timezone, which matches the user's expectation in CN deployments. Avoid `toLocaleString()` (browser default) and the raw `Intl.DateTimeFormat` boilerplate.
- `valueType: 'dateTime'` columns don't need any of the above — let ProTable render.

## Tracking ongoing work

- `TODO.md` is the index of `TODO-*.md` files at the repo root for known follow-ups (e.g. `TODO-admin-routes-factory.md`, `TODO-attachment-select-split.md`, `TODO-architecture-doc-sync.md`).
- `TODO-architecture-doc-sync.md` tracks that `README.md` and `CONTRIBUTING.md` reference `AGENTS.md` / `ARCHITECTURE.md` that don't yet exist — content has been folded into `docs/module-onboarding.md` and this file. Treat those doc references as pointing here.
- `profiles/*.yaml` are module-catalog configs; consumed tooling emits to `artifacts/` (gitignored).

## Other things worth knowing

- **Profiles & release artifacts**: `profiles/core.yaml` / `official.yaml` / `template.yaml` drive a release pipeline that emits to `artifacts/` (gitignored). Don't commit outputs.
- **Module naming lint**: `scripts/check-module-naming.mjs` parses each module's `db/schema.ts` with regex; runs as part of `pnpm lint`. Add new tables here and the linter will catch missing `<id>_` prefixes.
- **FC deploy**: `.github/workflows/yishan-fc-migrate.yml` and `yishan-fullstack-cd-fc.yml` deploy to Alibaba Function Compute. `apps/yishan-api/deploy/` and `apps/yishan-api/dockerfile` cover the prod image build (which excludes devDeps).
- **Cert rotation**: `yishan-cert-rotate-fc.yml` rotates FC certs.
- **No real credentials in repo**: demo creds intentionally not committed; per README, request from the maintainer.
- **sys_region seed data**: 省市区三级（~3400 条）由 `sys_region` 表承载，数据源是 modood/Administrative-divisions-of-China 的 `pca-code.json`，嵌在 `apps/yishan-api/src/scripts/seed/config/`。`pnpm --filter yishan-api db:seed` 自动跑 `system-region.ts` 把数据灌进 MySQL（INSERT ... ON DUPLICATE KEY UPDATE，幂等）。前端复用 `<ProFormRegionCascader name="area" />` 即可拿到三段级联选择器，无需另写 service。
