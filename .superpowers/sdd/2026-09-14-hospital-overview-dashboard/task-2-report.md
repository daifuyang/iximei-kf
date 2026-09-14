# Task 2 Report

## Status

Implemented and verified the linked hospital overview dashboard interaction.

## Changes

- Added typed hospital overview filters, aggregate response fixtures, and response normalization.
- Added `getHospitalOverview` API wrapper for `/api/crm/v1/dashboard/hospital-overview`.
- Reworked the dashboard around one aggregate request keyed by URL-synchronized date, category, province, city, and status filters.
- Added clickable KPI cards for total, oral, plastic, uncategorized, and period-new hospitals.
- Replaced the distribution card with ranked province/city/category chart and table modes; selections emit filter events.
- Added a right-side paginated hospital drilldown drawer that reuses the existing hospital list API and supports loading, empty, error, retry, pagination, and details links.
- Added an uncategorized governance link to filtered hospital management.
- Added focused component tests covering KPI filtering, province selection, inherited drawer filters, pagination request shape, empty state, and retryable errors.

## Verification

- `pnpm --filter yishan-admin exec -- jest src/modules/crm/pages/dashboard/components/__tests__/hospital-overview-components.test.tsx --runInBand --silent` - PASS (4 tests)
- `pnpm --filter yishan-admin exec tsc --noEmit` - PASS
- `pnpm --filter yishan-admin exec -- npx @biomejs/biome lint ...` - PASS

## Risks / Concerns

- The existing hospital pagination OpenAPI query contract only declares `page`, `pageSize`, `keyword`, `startTime`, and `endTime`; the drawer forwards category/province/city/status context as requested, but backend support for those extra list filters is not declared in the generated client.
- The dashboard page is now focused on the hospital overview and no longer renders the previous customer/dispatch summary cards. Restore those sections if backward compatibility with the former dashboard composition is required.

## Fix Round 1

- Added the dedicated, paginated `/dashboard/hospital-overview/details` API. It uses the overview authorization boundary and filter predicates, and returns hospital rows with dispatch, arrival, deal, and latest-dispatch metrics.
- Added a province-to-city drawer stage before the hospital-row drawer; city selection updates the same filter context.
- Added strict frontend URL parsing and backend bounds for province, city, and status filters.
- Added the hospital management `category` query contract and filtering implementation so the uncategorized governance link resolves to usable rows.
- Restored the established customer, dispatch, funnel, activity, ranking, and hospital-search dashboard modules beneath the hospital overview.
- Added focused API, URL parsing, city-flow, and detail pagination regression tests.
