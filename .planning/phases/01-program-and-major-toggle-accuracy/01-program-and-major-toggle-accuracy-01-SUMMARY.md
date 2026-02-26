---
phase: 01-program-and-major-toggle-accuracy
plan: 01
subsystem: api
tags: [programs, variants, deterministic-ordering, vitest]
requires:
  - phase: none
    provides: baseline program endpoints and catalog program-mode integration
provides:
  - strict-first variant family selection with normalized fallback only when needed
  - deterministic degree-aware major/minor ordering for variant responses
  - regression tests for strict-family matching and stable ordering contracts
affects: [catalog program toggles, program search/list behavior, phase-01-02 frontend wiring]
tech-stack:
  added: []
  patterns:
    - strict-first family candidate resolution with explicit fallback criteria
    - exact-degree affinity ranking with lexical/id tie-breakers
key-files:
  created:
    - api/src/services/__tests__/programService.test.ts
  modified:
    - api/src/services/programService.ts
key-decisions:
  - "Use trimmed/lowercased strict name matching as the first family filter and only use normalized fallback when strict candidates cannot provide both kinds."
  - "Rank variants by exact degree affinity first, then deterministic lexical/id ordering to remove arbitrary first-result picks."
patterns-established:
  - "Program family selection now enforces strict subset sufficiency before broad fallback."
  - "Program list/variant APIs apply deterministic ordering with explicit tie-breaks."
requirements-completed: [PRGM-01, PRGM-02, PRGM-03, PRGM-04]
duration: 2 min
completed: 2026-02-26
---

# Phase 1 Plan 01: Program Variant Selection Contract Summary

**Program variant lookup now enforces strict-family matching first and returns deterministic, degree-aware major/minor ordering for stable catalog toggles.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-26T16:41:30Z
- **Completed:** 2026-02-26T16:44:27Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments
- Reworked `getProgramVariants` to prefer strict same-name family candidates and only fall back to normalized-name grouping when strict candidates cannot supply both major and minor kinds.
- Added explicit degree-aware ranking and deterministic tie-break ordering for `majors`/`minors` outputs in variant responses.
- Hardened `listPrograms` by filtering to active records and applying stable ordering (`name -> kind -> degree -> id`) for predictable catalog selection inputs.
- Added focused regressions that lock strict-family preference, normalized fallback behavior, deterministic mixed-degree ordering, and major/minor response grouping.

## Task Commits

Each task was committed atomically:

1. **Task 1: Tighten variant-family candidate selection in `getProgramVariants`** - `555dcf7` (fix)
2. **Task 2: Make backend variant ordering deterministic and degree-aware** - `41f24cd` (feat)
3. **Task 3: Add regression coverage for strict-first matching and deterministic sorting** - `d6592d2` (test)

## Files Created/Modified
- `api/src/services/programService.ts` - strict-first family resolution, deterministic ordering helpers, and active/stable list ordering.
- `api/src/services/__tests__/programService.test.ts` - regression tests for strict-family fallback rules and deterministic ordering/grouping.

## Decisions Made
- Strict-family subset is considered sufficient only when it contains both major and minor kinds; otherwise normalized-name fallback remains available.
- Variant ordering prioritizes exact degree affinity against the anchor program before lexical and id tie-breaks.
- `listPrograms` must always ignore inactive programs and provide deterministic ordering for repeatable catalog selection behavior.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Bootstrapped missing `programService` test file before Task 2 verification**
- **Found during:** Task 2 verification
- **Issue:** Plan-specified verification command targeted `src/services/__tests__/programService.test.ts`, but the file did not yet exist.
- **Fix:** Created the targeted test file early so Task 2 verification could execute successfully, then completed the planned regression content in Task 3.
- **Files modified:** `api/src/services/__tests__/programService.test.ts`
- **Verification:** `pnpm --filter api test -- src/services/__tests__/programService.test.ts`
- **Committed in:** `d6592d2`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** No scope expansion; the deviation only unblocked the exact planned verification workflow.

## Issues Encountered
- Initial Vitest mock setup failed because mocked selector initialization was not hoist-safe. Resolved by switching to `vi.hoisted` for `selectMock` initialization.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Backend variant family/ordering contracts are now deterministic and regression-protected.
- Ready for `01-02` frontend toggle wiring and URL-state stabilization work.

## Self-Check: PASSED
- Confirmed summary file exists at `.planning/phases/01-program-and-major-toggle-accuracy/01-program-and-major-toggle-accuracy-01-SUMMARY.md`.
- Confirmed task commits exist in git history: `555dcf7`, `41f24cd`, `d6592d2`.

---
*Phase: 01-program-and-major-toggle-accuracy*
*Completed: 2026-02-26*
