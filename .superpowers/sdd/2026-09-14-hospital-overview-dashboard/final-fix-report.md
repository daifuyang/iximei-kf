# Final fix report

Status: all seven P1/P2 findings addressed; no subagents spawned.

## Changes

1. Business rates now format the API's 0–100 percentage points directly. A nonzero page fixture proves one arrival from two dispatches renders `50.0%`.
2. Added the explicit `hospitalScope=period-new` creation-date mode throughout URL parsing, frontend requests, route schemas, service response filters, and shared aggregate/detail SQL predicates. The KPI preserves category, region, status, and dates. A visible selector exits the mode. Date omission continues to mean cumulative data, with that meaning stated on the page.
3. Hospital management now consumes `hospitalId` and loads that record through the existing detail API into a read-only drawer, independently of list pagination. The destination page test renders hospital 987 and verifies the request and open dialog. The drawer also handles failure and stale navigation responses.
4. Chose the review's minimum non-misleading legacy option: a bordered, separately headed “独立经营分析” region explicitly states that it owns its time/hospital controls and refresh. The overview refresh is named “刷新医院总览”. No unsupported category/region/status semantics are imposed on legacy customer/dispatch metrics.
5. Added `GET /dashboard/capabilities`, guarded by the existing dashboard permission. It returns the same super-admin / ALL / non-hospital capability boundary as the aggregate service. `/auth/me` does not supply role IDs or scope, so the frontend waits for this server-derived capability before requesting or showing hospital overview. Restricted users retain legacy analysis; an actual legacy component is rendered in the regression test. Capability lookup failures fail closed for the overview and preserve legacy.
6. Missing province/city use the explicit literal `missing` in aggregate buckets, API filters, response schemas, and URLs. Both aggregate and detail queries apply `IS NULL`. Buckets have readable “未填写省份/城市” labels, preserve every counted hospital, and can drill through province → city → matching hospital. City keys now include province to keep missing-city buckets distinct.
7. Retained overview results are marked stale while a changed filter is pending or failed. KPI handlers, distribution selection handlers, and city/hospital drawers cannot drill down from stale results. Successful selections carry a dedicated detail filter snapshot; toolbar changes close open drawers. Old counts remain visible with an explicit warning rather than being actionable under the new controls.

## TDD evidence

- Before implementation: API focused suite had 8 expected new failures (SQL predicates, missing bucket labels, route acceptance, and capability results) with the previous 16 tests passing.
- Before implementation: six added page regressions failed for the expected percentage, creation mode, missing URL, capability/legacy composition, independent-context label, and stale interaction defects. The actual hospital destination separately failed because hospital 987 was not opened.
- The hospital test's initial React import setup error was corrected and rerun before implementation, producing the intended missing-record failure.
- Strengthened the existing SQL fixture reconciliation: original filter has 3 hospitals and 2 newly created; `period-new` yields exactly 2 summary/category/province/city hospitals and detail IDs `[2, 1]`, with the older hospital's six dispatches excluded from the new-mode business metrics.
- Added actual page flow coverage for missing province/city → hospital detail request, plus rendered legacy metrics for an overview-ineligible account.

## Verification

- `pnpm --filter yishan-api test`: 42 files passed, 420 tests passed; the existing 3 integration suites / 20 tests remain skipped.
- `pnpm --filter yishan-admin exec jest --runInBand --silent`: 10 suites passed, 55 tests passed.
- After the final stale drawer guard, focused page suite: 11 tests passed.
- `pnpm --filter yishan-api exec tsc -p tsconfig.json --noEmit`: passed.
- `pnpm --filter yishan-admin exec tsc --noEmit`: passed.
- `git diff --check`: passed (Git reports the repository's usual LF → CRLF notices).

## Remaining verification limits

- No production-sized MySQL execution plans or latency measurements were taken. SQL tests evaluate emitted predicates against controlled fixtures, not a real MySQL dataset.
- No real logged-in super-admin, ordinary backend, or hospital browser session was available. Server route/service tests and rendered frontend flows cover these contracts but do not replace deployed end-to-end verification.
- Deploy API and admin together: the frontend now requires the capability endpoint. On an unavailable capability endpoint it deliberately retains only legacy analysis.
- Original design's page-wide unified-filter wording is refined by the expressly authorized independent legacy-context option above; unified hospital overview filters still apply to all new hospital overview modules.
