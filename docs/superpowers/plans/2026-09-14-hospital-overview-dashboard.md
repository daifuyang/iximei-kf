# Hospital Overview Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the CRM hospital distribution dashboard into a filterable, drill-down hospital resource and business overview.

**Architecture:** Add one server-side aggregate endpoint that owns all filter and metric semantics, then render the response in the existing CRM dashboard with linked filters, KPI cards, ranked distribution, and a drill-down drawer. Reuse existing hospital pagination and category fields; do not introduce a map or a new data warehouse in this iteration.

**Tech Stack:** Fastify, Drizzle ORM, TypeBox, React, Ant Design, `@ant-design/charts`, Jest/Vitest as configured by each package.

**Spec:** `docs/superpowers/specs/2026-09-14-hospital-overview-dashboard-design.md`

## Global Constraints

- Hospital counts exclude soft-deleted rows and deduplicate by hospital id.
- `oral` means 口腔, `plastic` means 整形, null/unknown means 未分类.
- All aggregate modules use the same filter context and `generatedAt`.
- Hospital accounts cannot access the backend-wide overview endpoint.
- Aggregate endpoints must not return the full hospital dataset.

---

### Task 1: Server Aggregate Contract and Queries

**Files:**
- Modify: `apps/yishan-api/src/modules/crm/repositories/dashboard.repository.ts`
- Modify: `apps/yishan-api/src/modules/crm/services/dashboard.service.ts`
- Modify: `apps/yishan-api/src/modules/crm/routes/v1/dashboard/index.ts`
- Modify: `apps/yishan-api/src/modules/crm/schemas/dashboard.schema.ts`
- Test: `apps/yishan-api/src/modules/crm/tests/dashboard-rankings.test.ts`
- Create: `apps/yishan-api/src/modules/crm/tests/hospital-overview.test.ts`

**Interfaces:**
- Produce `GET /api/crm/v1/dashboard/hospital-overview` with query `startDate`, `endDate`, `category`, `provinceCode`, `cityCode`, `status`.
- Return `{ generatedAt, summary, byCategory, byProvince, byCity, businessByCategory }`.
- Keep role/data-scope checks in `DashboardService`; repository receives validated filters and performs grouped SQL.

- [ ] **Step 1: Write failing repository/service tests** for oral/plastic/unknown mapping, soft delete exclusion, date boundaries, zero denominators, and unauthorized hospital-account access.
- [ ] **Step 2: Run the focused API tests** and confirm they fail because the aggregate contract is absent.
- [ ] **Step 3: Add TypeBox schemas and route registration** using the existing dashboard route conventions.
- [ ] **Step 4: Implement grouped repository queries** for summary/category/province/city and business-by-category, applying one shared filter builder and returning numeric zeros for empty groups.
- [ ] **Step 5: Implement service authorization and response assembly** with `generatedAt` and stable arrays.
- [ ] **Step 6: Run focused API tests and typecheck**; verify all aggregate totals reconcile.
- [ ] **Step 7: Commit** with `feat(crm): add hospital overview aggregate API`.

### Task 2: Linked Dashboard Interaction

**Files:**
- Modify: `apps/yishan-admin/src/modules/crm/pages/dashboard/index.tsx`
- Modify: `apps/yishan-admin/src/modules/crm/pages/dashboard/components/HospitalDistributionCard.tsx`
- Create: `apps/yishan-admin/src/modules/crm/pages/dashboard/components/HospitalOverviewKpis.tsx`
- Create: `apps/yishan-admin/src/modules/crm/pages/dashboard/components/HospitalDrilldownDrawer.tsx`
- Modify: `apps/yishan-admin/src/modules/crm/api/index.ts`
- Modify: `apps/yishan-admin/src/modules/crm/pages/dashboard/types.ts`

**Interfaces:**
- `getHospitalOverview(params)` calls the new endpoint.
- `HospitalDistributionCard` receives normalized `byProvince`/`byCity` data and emits `{ provinceCode?, cityCode?, category? }` selection events.
- `HospitalDrilldownDrawer` receives the active filter context and loads paginated hospital rows without loading all hospitals.

- [ ] **Step 1: Add frontend type fixtures and failing component tests** for KPI click-to-filter, province-to-city drilldown, inherited filters, and empty/error states.
- [ ] **Step 2: Run focused frontend tests** and confirm the new components/contracts fail.
- [ ] **Step 3: Add the aggregate API client and normalize response data** in one dashboard request.
- [ ] **Step 4: Add fixed filter context controls** for date/category/province/city/status and synchronize the active context to the URL.
- [ ] **Step 5: Render KPI cards** for total/oral/plastic/uncategorized/new hospitals; clicking a card updates the global filter.
- [ ] **Step 6: Replace the distribution default with ranked province bars and a table toggle**; support city/category switching and preserve current filters.
- [ ] **Step 7: Add the right-side drilldown drawer** for province → city → hospital rows, with loading, pagination, and “view details” links.
- [ ] **Step 8: Add the uncategorized governance entry** linking to filtered hospital management without changing permissions.
- [ ] **Step 9: Run frontend tests, lint, and TypeScript checks**; commit as `feat(crm): add linked hospital overview dashboard`.

### Task 3: Cross-Layer Verification and Release Readiness

**Files:**
- Modify: `apps/yishan-api/src/modules/crm/tests/hospital-overview.test.ts`
- Create: `apps/yishan-admin/src/modules/crm/pages/dashboard/__tests__/hospital-overview.test.tsx`

- [ ] **Step 1: Add reconciliation tests** asserting category totals equal summary totals and province totals equal the filtered hospital total.
- [ ] **Step 2: Add browser-level tests** for filter → KPI → drilldown flow, including a no-data state and a failed request with retry.
- [ ] **Step 3: Run package test suites and both typechecks** with production-like environment variables.
- [ ] **Step 4: Manually verify permissions** for super admin, regular backend role, and hospital account.
- [ ] **Step 5: Review query plans on production-sized tables** and add an index migration only if the existing plan is insufficient.
- [ ] **Step 6: Commit verification updates** with `test(crm): cover hospital overview dashboard flows`.
