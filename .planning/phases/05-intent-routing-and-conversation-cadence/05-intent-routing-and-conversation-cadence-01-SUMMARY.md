---
phase: 05-intent-routing-and-conversation-cadence
plan: 01
subsystem: api
tags: [intent-routing, deterministic-classifier, vitest]
requires:
  - phase: 04-recommendation-card-usability-and-quality-hardening
    provides: Stable AI chat API response contract and route orchestration baseline.
provides:
  - Deterministic 3-mode intent classifier contract for conversation, clarify, and recommend routing.
  - Normalized intent signal extraction resilient to case, punctuation, and spacing variance.
  - Regression matrix tests preventing mode drift and non-deterministic routing.
affects: [05-02-intent-cadence-routing, ai-route-branching]
tech-stack:
  added: []
  patterns:
    - Rule-first deterministic intent precedence before downstream routing.
    - Structured intent reason/signal diagnostics for cadence observability.
key-files:
  created:
    - api/src/ai/intent/intentRouter.ts
    - api/src/ai/intent/intentRouter.test.ts
  modified:
    - api/src/ai/intent/intentRouter.ts
key-decisions:
  - "Use deterministic rule ordering (greeting -> recommend -> clarify -> conversation fallback) for stable intent assignment."
  - "Normalize user text before signal extraction so equivalent prompt variants classify identically."
  - "Guard course-code detection with a semantic blocklist to avoid false positives like semester + year phrases."
patterns-established:
  - "Intent classifier purity: classifyIntent has no network/model dependencies and is safe for repeated deterministic calls."
  - "Intent diagnostics contract: every decision returns mode + reason + signals for downstream debug visibility."
requirements-completed: [AIINT-03]
duration: 3 min
completed: 2026-03-05
---

# Phase 05 Plan 01: Intent Routing Contracts Summary

**Deterministic intent classification now routes each user turn into conversation, clarify, or recommend with normalized rule-first signals and regression coverage.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-05T22:32:54Z
- **Completed:** 2026-03-05T22:36:32Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments
- Added dedicated `intentRouter` contracts (`IntentMode`, `IntentDecision`, `classifyIntent`) with explicit precedence.
- Implemented normalization + signal tagging so case/punctuation/spacing variants map to stable intent outputs.
- Added deterministic Vitest matrix asserting mode/reason outputs across representative and boundary prompts.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create intent router contracts and ordered rule precedence** - `8a38fc1` (feat)
2. **Task 2: Add normalization helpers that preserve deterministic intent outcomes** - `daf990d` (feat)
3. **Task 3: Add deterministic classifier matrix tests** - `f778a12` (test)

## Files Created/Modified
- `api/src/ai/intent/intentRouter.ts` - Deterministic intent classifier and normalized signal helpers.
- `api/src/ai/intent/intentRouter.test.ts` - Classification matrix and determinism regression coverage.

## Decisions Made
- Adopted explicit 3-mode intent typing to satisfy deterministic routing requirements and downstream cadence control.
- Preserved a pure rule-first classifier implementation with no probabilistic or model-scored behavior.
- Added semester-word blocklist protection in course-code detection to prevent false recommend routing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Prevent false course-code matches for semester/year phrases**
- **Found during:** Task 3 (Add deterministic classifier matrix tests)
- **Issue:** `Fall 2026` matched the course-code regex and incorrectly produced combined explicit recommendation reasoning.
- **Fix:** Added a department-token blocklist guard in course-code signal detection.
- **Files modified:** `api/src/ai/intent/intentRouter.ts`
- **Verification:** `pnpm --filter api test -- src/ai/intent/intentRouter.test.ts`
- **Committed in:** `f778a12`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Improved classifier correctness with no scope creep; all planned outcomes preserved.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Classifier contracts and tests are in place for route-level intent cadence wiring in Plan 05-02.
- No blockers identified for integrating `classifyIntent` into `api/src/routes/ai.ts`.

---
*Phase: 05-intent-routing-and-conversation-cadence*
*Completed: 2026-03-05*
