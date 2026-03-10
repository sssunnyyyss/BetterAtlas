---
phase: 01-program-and-major-toggle-accuracy
plan: 02
subsystem: ui
tags: [catalog, program-mode, variants, url-state, ai-summary, vitest]
requires:
  - phase: 01-program-and-major-toggle-accuracy
    provides: strict-first family matching and deterministic variant ordering from API
provides:
  - deterministic frontend program variant selector utility and tab canonicalization helper
  - catalog wiring to shared variant selection with previous-kind intent preservation
  - deterministic AI-summary relevance ranking for program-mode course ordering
  - regression tests for program-mode deep links, toggles, and relevance ordering
affects: [catalog filters, program-mode toggles, URL deep links, frontend regression coverage]
tech-stack:
  added: []
  patterns:
    - centralized program variant selection contract shared by filter and catalog toggle flows
    - URL canonicalization guard for programTab in program mode
    - bounded token-weight relevance boost using AI summary/highlights with stable fallback order
key-files:
  created:
    - frontend/src/lib/programVariantSelection.ts
    - frontend/src/lib/programVariantSelection.test.ts
    - frontend/src/pages/Catalog.program-mode.test.tsx
  modified:
    - frontend/src/components/course/CourseFilters.tsx
    - frontend/src/pages/Catalog.tsx
key-decisions:
  - "Frontend now uses one deterministic selector utility for program dropdown families, major/minor counterpart selection, and programTab canonicalization."
  - "Major/minor round-trip behavior preserves prior kind selections when still available, then falls back to degree-aware deterministic ranking."
  - "Program-mode course ordering applies AI-summary token weights only as a ranking boost and keeps stable original-order fallback ties."
patterns-established:
  - "Program-mode URL tab safety: canonicalize invalid/missing programTab to required and persist to URL."
  - "Program-mode regression tests mock query boundaries and assert behavior via URL + ordered-course output."
requirements-completed: [PRGM-01, PRGM-02, PRGM-03, PRGM-04]
duration: 6 min
completed: 2026-02-26
---

# Phase 1 Plan 02: Program Toggle Wiring and URL Stability Summary

**Catalog program mode now uses deterministic shared variant-selection rules, canonical URL tab state, and AI-summary-informed course ordering with regression coverage for deep links and toggles.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-26T16:49:45Z
- **Completed:** 2026-02-26T16:55:50Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Added `frontend/src/lib/programVariantSelection.ts` with deterministic `buildProgramSearchOptions`, `selectProgramVariant`, and `canonicalizeProgramTab`.
- Added focused selector unit tests in `frontend/src/lib/programVariantSelection.test.ts` for family-preserving options, degree-aware fallback, prior-selection restoration, and tab canonicalization.
- Rewired `CourseFilters` program search options to use shared utility logic instead of BA-only filtering.
- Rewired `Catalog` to use shared variant selection for major/minor toggles, retain previous kind selections, and canonicalize invalid/missing `programTab` values.
- Added deterministic AI-summary relevance scoring in program mode using summary/highlight token weights with stable fallback tie-breaking.
- Added `frontend/src/pages/Catalog.program-mode.test.tsx` regression tests for deterministic toggles, deep-link tab canonicalization, and deterministic AI-summary ordering across rerenders.

## Verification
- `pnpm --filter frontend test -- src/lib/programVariantSelection.test.ts`
- `pnpm --filter frontend build`
- `pnpm --filter frontend test -- src/pages/Catalog.program-mode.test.tsx`

## Task Commits

Each task was committed atomically:

1. **Task 1: Create deterministic frontend selector utilities and option builders** - `6b55f27` (feat)
2. **Task 2: Rewire `CourseFilters` and `Catalog` to consume selector utilities** - `bc3221f` (feat)
3. **Task 3: Add URL/deep-link regression tests for program mode** - `b57f9a2` (test)

## Files Created/Modified
- `frontend/src/lib/programVariantSelection.ts` - deterministic option generation, variant picking, and tab canonicalization helpers.
- `frontend/src/lib/programVariantSelection.test.ts` - selector and canonicalization unit regressions.
- `frontend/src/components/course/CourseFilters.tsx` - program options now sourced from shared family-preserving selector.
- `frontend/src/pages/Catalog.tsx` - deterministic toggle selection, previous-kind preservation, tab canonicalization, and AI-summary relevance ordering.
- `frontend/src/pages/Catalog.program-mode.test.tsx` - integration-style regressions for toggles, URL stability, and relevance ordering.

## Decisions Made
- Preserve user round-trip intent by storing previous major/minor selections and preferring those IDs when still present in current candidates.
- Canonicalize `programTab` to `required` for all invalid/missing program-mode deep links and immediately write canonical state back into URL params.
- Apply AI summary data as a bounded deterministic ranking signal (token weights) rather than replacing existing catalog ordering logic.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Initial test implementation emitted React act-environment warnings; resolved by setting `IS_REACT_ACT_ENVIRONMENT` and enabling React Router future flags in the test harness.

## User Setup Required

None - no external setup needed.

## Next Phase Readiness
- Phase 1 now has plan-level backend and frontend deterministic contracts with regression coverage.
- Phase 1 roadmap is ready to be marked complete after state/roadmap metadata update.

## Self-Check: PASSED
- Confirmed summary file exists at `.planning/phases/01-program-and-major-toggle-accuracy/01-program-and-major-toggle-accuracy-02-SUMMARY.md`.
- Confirmed task commits exist in git history: `6b55f27`, `bc3221f`, `b57f9a2`.

---
*Phase: 01-program-and-major-toggle-accuracy*
*Completed: 2026-02-26*
