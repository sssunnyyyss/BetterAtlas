---
phase: 05-intent-routing-and-conversation-cadence
plan: 03
subsystem: api
tags: [intent-routing, greeting-fast-path, regression-tests]
requires:
  - phase: 05-intent-routing-and-conversation-cadence
    provides: Intent-mode route branching and clarify-first cadence from plan 02.
provides:
  - Earliest safe trivial-greeting fast-path before recommendation dependency/retrieval setup.
  - Route-level intent-routing regression suite covering greeting, conversation, clarify, and recommend cadence.
  - Deterministic in-process route test harness with no retrieval assertions for greeting requests.
affects: [phase-05-gates, ai-route-latency, regression-safety]
tech-stack:
  added: []
  patterns:
    - Trivial greeting branch exits before filter/preference normalization and recommendation dependency loading.
    - Route-level cadence tests mock retrieval dependencies locally and assert retrieval side effects per intent mode.
key-files:
  created:
    - api/src/routes/ai.intent-routing.test.ts
  modified:
    - api/src/routes/ai.ts
    - api/src/routes/ai.intent-routing.test.ts
key-decisions:
  - "Defer recommendation-specific setup (filters/preferences/user retrieval dependencies) until after non-recommend branches to keep greeting and conversational turns lightweight."
  - "Validate intent cadence at route level with explicit greeting/conversation/clarify/recommend fixtures instead of classifier-only coverage."
  - "Use in-process route handler execution in tests to avoid socket-binding instability in constrained CI/sandbox environments."
patterns-established:
  - "Greeting regression gate: trivial greeting responses must return canned text with `recommendations: []` and zero retrieval calls."
  - "Cadence matrix gate: one suite exercises all core modes and verifies branch-specific retrieval behavior."
requirements-completed: [AIINT-04]
duration: 3 min
completed: 2026-03-05
---

# Phase 05 Plan 03: Greeting Fast-Path and Intent-Routing Regression Summary

**Greeting turns now short-circuit before recommendation setup work, and route-level cadence tests enforce no-retrieval behavior plus cross-mode intent routing stability.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-05T22:49:42Z
- **Completed:** 2026-03-05T22:53:08Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments
- Refactored `POST /ai/course-recommendations` so trivial greeting and other non-recommend paths run before recommendation-only setup work.
- Added route-level regression tests covering greeting, conversation, clarify, and recommend fixtures in one cadence suite.
- Hardened the new suite for deterministic repeated execution with in-process handler invocation and fresh fixture objects per test run.

## Task Commits

Each task was committed atomically:

1. **Task 1: Move trivial greeting handling to the earliest safe route branch** - `957984e` (feat)
2. **Task 2: Add route-level intent-routing regression tests with greeting no-retrieval assertions** - `a4d3a85` (test)
3. **Task 3: Wire targeted test command into phase verification cadence** - `a6563fb` (test)

## Files Created/Modified
- `api/src/routes/ai.ts` - Moved recommendation-specific setup behind mode gating and made greeting fast-path explicitly early via `isTrivialGreeting` branch.
- `api/src/routes/ai.intent-routing.test.ts` - Added route-level cadence regression suite and deterministic in-process route execution harness.

## Decisions Made
- Prioritized earliest-safe intent branching so conversational/greeting requests avoid unnecessary recommendation-prep work.
- Added route-level (not only classifier-level) intent tests to protect real handler side-effect boundaries.
- Chose in-process route execution for reliable sandbox/CI runs without opening network sockets.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Replaced socket-based test server with in-process route execution**
- **Found during:** Task 2 (route-level regression suite verification)
- **Issue:** Sandbox/CI denied local socket binding (`listen EPERM`) during route tests.
- **Fix:** Implemented in-process handler execution against router stack, preserving middleware behavior without opening ports.
- **Files modified:** `api/src/routes/ai.intent-routing.test.ts`
- **Verification:** `pnpm --filter api test -- src/routes/ai.intent-routing.test.ts`
- **Committed in:** `a6563fb`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Kept the planned route-level coverage intact while making the suite stable in constrained environments.

## Issues Encountered
- Initial socket-based route test harness failed under sandbox constraints (`listen EPERM`); resolved by in-process handler execution.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 5 now has intent classifier, route cadence gating, and greeting fast-path regression coverage in place.
- No blockers remain for transitioning to Phase 6 planning/execution.

---
*Phase: 05-intent-routing-and-conversation-cadence*
*Completed: 2026-03-05*
