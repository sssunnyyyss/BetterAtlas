---
phase: 03-interaction-smoothness-mobile-composer
plan: 03
subsystem: ui
tags: [react, retry, onboarding, ai-chat]
requires:
  - phase: 03-interaction-smoothness-mobile-composer
    provides: Deterministic lifecycle orchestration and transition contracts from 03-02
provides:
  - Non-destructive failed-request payload retention with deterministic retry orchestration
  - Error-state status UI with explicit retry CTA wiring
  - Structured starter-chip onboarding with zero-turn-only visibility and regression tests
affects: [04-01, ai-chat-ui]
tech-stack:
  added: []
  patterns:
    - Retry path replays retained failed payload without duplicating user turns
    - Starter chips are modeled as structured intents and rendered only for `turns.length === 0`
key-files:
  created: []
  modified:
    - frontend/src/features/ai-chat/model/chatTypes.ts
    - frontend/src/features/ai-chat/hooks/useChatSession.ts
    - frontend/src/features/ai-chat/components/ChatFeed.tsx
    - frontend/src/features/ai-chat/components/ChatRequestStatus.tsx
    - frontend/src/pages/AiChat.tsx
    - frontend/src/pages/AiChat.interactions.test.tsx
    - frontend/src/pages/AiChat.foundation.test.tsx
key-decisions:
  - "Persist full failed prompt payload so retry can replay the exact last request context."
  - "Enforce a deterministic zero-turn chip visibility rule for onboarding consistency."
patterns-established:
  - "Error status surface now exposes a direct retry affordance when failed payload exists."
  - "Starter chips send immediately through existing session send path and are hidden once conversation turns exist."
requirements-completed: [AIXP-03, AIXP-04]
duration: 9 min
completed: 2026-02-27
---

# Phase 3 Plan 03: Retry and Starter-Prompt Interaction Summary

**AI chat now preserves failure context with one-tap retry recovery and uses structured starter prompts that appear only in zero-turn onboarding states.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-02-27T23:32:02Z
- **Completed:** 2026-02-27T23:41:37Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- Added retained failed-prompt payload state and retry orchestration that preserves existing conversation context.
- Added explicit retry CTA/error messaging wiring in status UI and session integration.
- Redesigned starter chips as structured onboarding intents with deterministic zero-turn-only visibility and interaction tests.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add non-destructive error and retry state to chat session orchestration** - `29f41a5` (feat)
2. **Task 2: Wire visible retry CTA and actionable error copy into request status UI** - `ee9e35f` (feat)
3. **Task 3: Redesign starter chips as curated onboarding intents with deterministic behavior** - `b12611a` (test + feature assertions)

## Files Created/Modified
- `frontend/src/features/ai-chat/model/chatTypes.ts` - Failed prompt payload contract in lifecycle metadata.
- `frontend/src/features/ai-chat/hooks/useChatSession.ts` - Retry payload retention/replay and non-destructive failure handling.
- `frontend/src/features/ai-chat/components/ChatRequestStatus.tsx` - Error-state retry CTA and actionable status rendering.
- `frontend/src/features/ai-chat/components/ChatFeed.tsx` - Structured starter-chip rendering and retry callback integration.
- `frontend/src/pages/AiChat.tsx` - Curated starter intent definitions and retry wiring into feed/status.
- `frontend/src/pages/AiChat.interactions.test.tsx` - Retry CTA and zero-turn-only starter-chip behavior coverage.
- `frontend/src/pages/AiChat.foundation.test.tsx` - Session fixture alignment with retry API contract.

## Decisions Made
- Retry uses retained failed payload messages to avoid duplicate user turns while re-running the same request context.
- Starter-chip behavior is deterministic and immediate-send to minimize onboarding friction.

## Deviations from Plan
None - plan executed as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- AIXP-03 and AIXP-04 are now covered with retry and onboarding interaction protections.
- Phase 3 implementation is ready for phase-level verification and transition toward Phase 4 planning/execution.

## Self-Check: PASSED

---
*Phase: 03-interaction-smoothness-mobile-composer*
*Completed: 2026-02-27*
