---
phase: 07-retrieval-and-ranking-relevance-calibration
plan: 03
subsystem: api
tags: [retrieval, ranking, diversity, relevance, vitest]
requires:
  - phase: 07-retrieval-and-ranking-relevance-calibration
    provides: retrieval/relevance/ranking/diversity policy modules from plans 01 and 02
provides:
  - recommend-route retrieval mode telemetry with explicit lexical/hybrid/hybrid_degraded accounting
  - bounded ranking plus final-card department diversity selection with concentration bypass controls
  - low-relevance refine guidance fallback with empty recommendation cards
  - route-level regression coverage for AIREL-01 through AIREL-04 behaviors
affects: [ai-course-recommendations-route, recommendation-relevance-calibration]
tech-stack:
  added: []
  patterns:
    - policy-driven route orchestration for retrieval, ranking, diversity, and sufficiency gating
    - route-level deterministic relevance calibration regression matrix
key-files:
  created:
    - api/src/routes/ai.relevance-calibration.test.ts
  modified:
    - api/src/routes/ai.ts
key-decisions:
  - "Semantic retrieval failures are surfaced as `hybrid_degraded` telemetry while recommendation requests continue with lexical candidates."
  - "Candidate ranking now uses bounded preference (+/-2) and trainer (+/-1) contributions on top of base relevance to prevent amplification drift."
  - "Recommendation cards are blocked by a low-relevance sufficiency gate and replaced with deterministic refine guidance when quality is weak."
patterns-established:
  - "Final-card diversity guardrails are applied after ranking/filter constraints with explicit concentration bypass logic."
  - "Relevance calibration assertions are validated at route level using in-process handler execution and mocked retrieval/ranking conditions."
requirements-completed: [AIREL-01, AIREL-02, AIREL-03, AIREL-04]
duration: 8 min
completed: 2026-03-06
---

# Phase 07 Plan 03: Retrieval and Ranking Relevance Calibration Summary

**Recommend-mode route orchestration now uses explicit retrieval modes, bounded ranking and diversity policies, and a low-relevance refine fallback with dedicated route regressions.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-06T19:26:03Z
- **Completed:** 2026-03-06T19:34:36Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments
- Wired retrieval envelope classification into recommend-mode flow and exposed deterministic retrieval telemetry in non-production debug payloads.
- Replaced prior unbounded route-level candidate ordering with bounded ranking policy integration and final recommendation-card diversity selection.
- Added a low-relevance sufficiency gate that returns refine guidance with empty cards and locked the behavior with route-level relevance calibration tests.

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire explicit retrieval mode envelope into recommend-mode candidate assembly** - `107286e` (feat)
2. **Task 2: Replace unbounded candidate scoring with bounded ranking + final diversity selector** - `3b7950b` (feat)
3. **Task 3: Add low-relevance refine fallback gate and route-level relevance calibration regressions** - `c26dac7` (feat)

**Plan metadata:** pending (created in docs completion commit)

## Files Created/Modified
- `api/src/routes/ai.ts` - Integrates retrieval envelope telemetry, bounded ranking flow, diversity selection, and low-relevance refine fallback gate.
- `api/src/routes/ai.relevance-calibration.test.ts` - Route-level regressions for hybrid/degraded retrieval, ranking bounds, diversity behavior, and low-relevance fallback.

## Decisions Made
- Keep lexical retrieval mandatory and treat semantic path failures as degradations (`hybrid_degraded`) instead of request failures.
- Evaluate recommendation sufficiency before card emission and return deterministic refine guidance (`recommendations: []`) when relevance is weak.
- Use final-card diversity guardrails by default and allow concentration only with explicit filters/intent signals.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 07 now has summaries for plans 01, 02, and 03 with no remaining execution blockers.

## Self-Check: PASSED

- Verified summary file exists on disk.
- Verified task commits `107286e`, `3b7950b`, and `c26dac7` exist in git history.

---
*Phase: 07-retrieval-and-ranking-relevance-calibration*
*Completed: 2026-03-06*
