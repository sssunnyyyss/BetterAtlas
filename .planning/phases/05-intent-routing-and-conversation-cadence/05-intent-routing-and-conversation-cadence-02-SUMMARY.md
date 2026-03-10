---
phase: 05-intent-routing-and-conversation-cadence
plan: 02
subsystem: api
tags: [intent-cadence, clarify-first, ai-routing]
requires:
  - phase: 05-intent-routing-and-conversation-cadence
    provides: Deterministic intent classification contracts from plan 01.
provides:
  - Route-level intent mode branching for conversation, clarify, and recommend responses.
  - Clarify-first ambiguous ask handling with no course cards returned in the same turn.
  - Non-production debug metadata proving retrieval is skipped outside recommend mode.
affects: [ai-route-branching, phase-05-plan-03, observability]
tech-stack:
  added: []
  patterns:
    - Intent classification executes before retrieval candidate assembly.
    - Clarify branch returns a single actionable follow-up question and empty recommendations.
key-files:
  created: []
  modified:
    - api/src/routes/ai.ts
    - api/src/ai/intent/intentRouter.ts
key-decisions:
  - "Use `decision.mode` as the sole branch selector so retrieval work is unreachable from conversation/clarify turns."
  - "Keep clarify replies deterministic and template-driven via intentRouter helpers instead of LLM-generated clarifications."
  - "Expose intent cadence diagnostics only in non-production debug payloads to preserve production response compatibility."
patterns-established:
  - "Recommendation retrieval gating: dependency loads and candidate assembly run only in recommend mode."
  - "Intent diagnostics contract: debug responses include `intentMode`, `intentReason`, and `retrievalSkipped`."
requirements-completed: [AIINT-01, AIINT-02]
duration: 3 min
completed: 2026-03-05
---

# Phase 05 Plan 02: Intent Cadence Routing Summary

**AI route orchestration now enforces conversation/clarify/recommend cadence with clarify-first ambiguous handling and retrieval restricted to recommend mode.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-05T22:40:55Z
- **Completed:** 2026-03-05T22:44:03Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments
- Replaced legacy binary suggestion gating with explicit `decision.mode` branching in `POST /ai/course-recommendations`.
- Added deterministic clarify response generation and wired clarify mode to return `assistantMessage` + non-null `followUpQuestion` with `recommendations: []`.
- Extended non-production debug payloads with intent routing diagnostics to verify retrieval gating behavior.

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace binary suggestion gate with 3-mode intent cadence branching** - `1978e19` (feat)
2. **Task 2: Implement clarify-first ambiguous ask responses with stable output contract** - `dc39f98` (feat)
3. **Task 3: Add non-production intent-cadence diagnostics for verification** - `eefac55` (feat)

## Files Created/Modified
- `api/src/routes/ai.ts` - Mode-driven route branching, clarify handling, retrieval gating, and debug intent diagnostics.
- `api/src/ai/intent/intentRouter.ts` - Deterministic clarify response generator for ambiguous recommendation asks.

## Decisions Made
- Routed branch control entirely through `classifyIntent` output to keep recommendation retrieval unreachable from non-recommend turns.
- Implemented clarify responses as deterministic templates so the branch always returns one concise actionable question.
- Added intent diagnostics only under non-production guard to protect production API compatibility.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 05-03 can now layer route integration safeguards on top of explicit intent-mode branching and clarify-first behavior.
- No blockers identified.

---
*Phase: 05-intent-routing-and-conversation-cadence*
*Completed: 2026-03-05*
