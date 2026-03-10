---
phase: 07-retrieval-and-ranking-relevance-calibration
plan: 04
subsystem: api
tags: [retrieval, ranking, relevance, lexical, vitest]
requires:
  - phase: 07-retrieval-and-ranking-relevance-calibration
    provides: route-level retrieval/ranking/diversity/sufficiency integration from plan 03
provides:
  - recommend-mode lexical retrieval fallback that always executes a primary lexical catalog search
  - regression coverage proving empty-derived-term recommend prompts still invoke lexical retrieval
  - telemetry lock for lexical_only retrieval behavior when semantic retrieval is unavailable
affects: [ai-course-recommendations-route, recommendation-relevance-calibration]
tech-stack:
  added: []
  patterns:
    - always-on lexical retrieval in recommend mode with normalized prompt fallback query
    - route-level regression assertions for retrieval invocation plus telemetry consistency
key-files:
  created: []
  modified:
    - api/src/routes/ai.ts
    - api/src/routes/ai.relevance-calibration.test.ts
key-decisions:
  - "Recommend-mode lexical search should never be skipped; fallback query is normalized prompt text when derived terms are empty."
  - "Per-term lexical broadening remains conditional on `searchTerms.length > 1` to avoid unnecessary fan-out for empty-term prompts."
  - "Regression assertions focus on lexical invocation and telemetry coherence instead of requiring non-empty recommendation cards."
patterns-established:
  - "Route retrieval flow now guarantees a primary lexical search call regardless of derived term extraction output."
  - "Empty-derived-term prompts are guarded by deterministic route tests asserting lexical search call + lexical telemetry."
requirements-completed: [AIREL-01, AIREL-02, AIREL-03, AIREL-04]
duration: 2 min
completed: 2026-03-06
---

# Phase 07 Plan 04: Lexical Retrieval Gap Closure Summary

**Recommend-mode retrieval now always issues a lexical catalog search via normalized prompt fallback when derived search terms are empty, with route-level regression coverage locking the behavior.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-06T23:10:50Z
- **Completed:** 2026-03-06T23:12:41Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Removed the conditional lexical-search guard so recommend-mode always performs a primary `searchCourses` call.
- Added fallback lexical query derivation from normalized prompt text when `deriveAiSearchTerms(...)` returns no terms.
- Added a focused route regression to verify lexical invocation and lexical telemetry consistency for empty-derived-term prompts.

## Task Commits

Each task was committed atomically:

1. **Task 1: Enforce unconditional recommend-mode lexical search with empty-term fallback query** - `227c70a` (fix)
2. **Task 2: Add route regression for empty-derived-term recommend prompts to prove lexical retrieval always runs** - `cdcba1c` (test)

**Plan metadata:** pending (created in docs completion commit)

## Files Created/Modified
- `api/src/routes/ai.ts` - Guarantees primary lexical retrieval executes in recommend mode by using a prompt-derived fallback query when terms are empty.
- `api/src/routes/ai.relevance-calibration.test.ts` - Adds empty-term regression asserting lexical `searchCourses` invocation and `lexical_only` telemetry coherence.

## Decisions Made
- Use `candidateQuery` as the fallback lexical query and only fall back to a safe constant when normalized prompt text is empty.
- Keep per-term broadening unchanged (`searchTerms.length > 1`) to preserve existing behavior and cost characteristics.
- Treat empty-term prompts as valid low-relevance cases in test expectations while still asserting lexical retrieval happened.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 07 gap closure is complete and AIREL-01 lexical retrieval behavior is now locked by route-level regression coverage.

## Self-Check: PASSED

- Verified summary file exists on disk.
- Verified task commits `227c70a` and `cdcba1c` exist in git history.

---
*Phase: 07-retrieval-and-ranking-relevance-calibration*
*Completed: 2026-03-06*
