---
phase: 06-atlas-grounding-and-recommendation-safety
plan: 01
subsystem: api
tags: [grounding, recommendation-safety, vitest, deterministic-validation]
requires:
  - phase: 05-intent-routing-and-conversation-cadence
    provides: Deterministic recommend-mode route orchestration and candidate assembly pipeline.
provides:
  - Typed grounding validation contracts for assistant-message enforcement.
  - Deterministic mention normalization/matching for course code and title variants.
  - Explicit fail-closed unknown/blocked grounding violation classification.
  - Safe fallback builder payload with non-specific assistant text and empty recommendations.
  - Unit regression matrix for pass/fail grounding and deterministic repeatability.
affects: [phase-06-route-integration, ai-recommendation-safety, regression-gates]
tech-stack:
  added: []
  patterns:
    - Grounding validation treats assistant text as untrusted until candidate/block checks pass.
    - Code/title mention extraction is deterministic and normalization-driven.
    - Grounding safety fallback payload is deterministic and course-name-free.
key-files:
  created:
    - api/src/ai/grounding/groundingContracts.ts
    - api/src/ai/grounding/groundingValidator.ts
    - api/src/ai/grounding/safeGroundingFallback.ts
    - api/src/ai/grounding/groundingValidator.test.ts
  modified:
    - api/src/ai/grounding/groundingValidator.ts
key-decisions:
  - "Normalize course code mentions to a compact canonical token while supporting CS170/CS 170/CS-170 variants."
  - "Classify mentions mapping to blocked candidate IDs as hard grounding failures (`blocked_mention`) before recommendation use."
  - "Use a deterministic safe fallback payload with no specific catalog code/title tokens."
patterns-established:
  - "Grounding contracts first: validator I/O is strongly typed and route-agnostic."
  - "Violation-first policy: unknown or blocked explicit mentions force fail-closed behavior."
requirements-completed: [AIGRD-01, AIGRD-03]
duration: 1 min
completed: 2026-03-06
---

# Phase 06 Plan 01: Grounding Contracts and Fail-Closed Safety Summary

**Deterministic grounding contracts and validator primitives now classify unknown/blocked course mentions and provide a safe fallback payload to prevent fabricated specific recommendations.**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-06T17:36:16Z
- **Completed:** 2026-03-06T17:38:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Added typed grounding interfaces for validation inputs, violation reporting, and deterministic result shape.
- Implemented deterministic mention normalization and validation logic for code/title matching with `unknown_mention` and `blocked_mention` outcomes.
- Added a safe fail-closed fallback builder and a regression-focused unit test matrix that locks pass/fail behavior and repeatability.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create grounding validator contracts and mention-normalization primitives** - `74d8d08` (feat)
2. **Task 2: Implement fail-closed grounding result classification and safe fallback builder** - `e5d499f` (feat)
3. **Task 3: Add validator unit tests for pass, unknown-mention fail, and blocked-mention fail paths** - `3703026` (test)

## Files Created/Modified
- `api/src/ai/grounding/groundingContracts.ts` - Grounding validator contracts for input, violation, and result typing.
- `api/src/ai/grounding/groundingValidator.ts` - Deterministic code/title mention extraction and grounding validation classification.
- `api/src/ai/grounding/safeGroundingFallback.ts` - Fail-closed non-specific fallback response builder.
- `api/src/ai/grounding/groundingValidator.test.ts` - Unit tests for pass/fail grounding behavior and deterministic repeatability.

## Decisions Made
- Normalized course mentions to canonical code tokens while preserving support for common format variants.
- Treated blocked-candidate mentions as hard violations in the same path as unknown explicit mentions.
- Kept fallback messaging deterministic and explicitly free of specific course entities.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Grounding contracts and fail-closed primitives are ready for route integration in subsequent phase plans.
- No blockers identified for proceeding to plan `06-02`.

---
*Phase: 06-atlas-grounding-and-recommendation-safety*
*Completed: 2026-03-06*
