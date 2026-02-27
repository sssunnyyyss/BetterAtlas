---
phase: 02-chat-ui-foundation
plan: 01
subsystem: ui
tags: [react, typescript, ai-chat, state-management]
requires:
  - phase: 01-program-and-major-toggle-accuracy
    provides: Stable catalog AI entry points and deterministic catalog mode behavior
provides:
  - Canonical chat turn and request-state contracts for the AI chat UI
  - A centralized useChatSession hook for send/reset/deep-link orchestration
  - Shared shell primitives that support both /ai and embedded catalog rendering
affects: [02-02, 02-03, ai-chat-ui]
tech-stack:
  added: []
  patterns:
    - Feature-scoped model/hook/component structure under frontend/src/features/ai-chat
    - Thin route wrapper composition through explicit header/feed/composer props
key-files:
  created:
    - frontend/src/features/ai-chat/model/chatTypes.ts
    - frontend/src/features/ai-chat/hooks/useChatSession.ts
    - frontend/src/features/ai-chat/components/ChatShell.tsx
    - frontend/src/features/ai-chat/components/ChatHeader.tsx
    - frontend/src/features/ai-chat/components/ChatFeed.tsx
    - frontend/src/features/ai-chat/components/ChatComposer.tsx
  modified:
    - frontend/src/pages/AiChat.tsx
key-decisions:
  - "Centralize prompt send/reset/deep-link behavior in useChatSession while preserving existing API payload semantics."
  - "Render route and embedded chat through one ChatShell contract with explicit header/feed/composer ownership."
patterns-established:
  - "AI chat foundation now lives in feature-local model + hook + component modules."
  - "AiChat.tsx is a thin wrapper that wires session state into shared primitives."
requirements-completed: [AIUI-01]
duration: 10 min
completed: 2026-02-27
---

# Phase 2 Plan 01: Chat UI Foundation Summary

**AI chat now uses a typed session orchestrator and explicit shell zones so both `/ai` and embedded catalog mode share one structural contract.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-02-27T03:05:13Z
- **Completed:** 2026-02-27T03:15:13Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- Added canonical chat contracts for turn roles, assistant payload metadata, and request lifecycle state.
- Extracted send/reset/deep-link orchestration from `AiChat.tsx` into `useChatSession` with unchanged API request shape.
- Replaced monolithic route JSX with `ChatShell` composition using explicit `ChatHeader`, `ChatFeed`, and `ChatComposer` primitives.

## Task Commits

Each task was committed atomically:

1. **Task 1: Define chat foundation contracts and shell component interfaces** - `5817b24` (feat)
2. **Task 2: Extract AI chat state orchestration into `useChatSession`** - `f7d683c` (feat)
3. **Task 3: Recompose `AiChat` around explicit header/feed/composer primitives** - `dd1d6c5` (feat)

## Files Created/Modified
- `frontend/src/features/ai-chat/model/chatTypes.ts` - Shared chat type contracts.
- `frontend/src/features/ai-chat/hooks/useChatSession.ts` - Typed session orchestration for mutation flow and deep-link bootstrap.
- `frontend/src/features/ai-chat/components/ChatShell.tsx` - Layout primitive for header/feed/composer zone composition.
- `frontend/src/features/ai-chat/components/ChatHeader.tsx` - Header zone with reset affordance.
- `frontend/src/features/ai-chat/components/ChatFeed.tsx` - Feed zone with welcome, message rendering, and request-state feedback.
- `frontend/src/features/ai-chat/components/ChatComposer.tsx` - Composer zone with autosize and submit behavior.
- `frontend/src/pages/AiChat.tsx` - Route wrapper that composes shell primitives for standalone and embedded usage.

## Decisions Made
- Centralized chat session orchestration in one hook to prevent state drift across route and embedded contexts.
- Kept `POST /api/ai/course-recommendations` message payload semantics unchanged to avoid backend/API regressions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TypeScript ref and literal-role typing alignment**
- **Found during:** Task 1 and Task 2 build verification.
- **Issue:** New component/hook contracts produced strict typing errors for ref props and `AiMessage.role` literals.
- **Fix:** Switched ref prop types to mutable refs and narrowed role assignments with literal types.
- **Files modified:** `frontend/src/features/ai-chat/components/ChatComposer.tsx`, `frontend/src/features/ai-chat/components/ChatFeed.tsx`, `frontend/src/features/ai-chat/hooks/useChatSession.ts`.
- **Verification:** `pnpm --filter frontend build` passed after adjustments.
- **Committed in:** `5817b24`, `f7d683c`.

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Blocking fixes were required for compile correctness and did not expand scope.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Foundation contracts and composition boundaries are in place for visual hierarchy/state presentation work in plan `02-02`.
- No blockers identified for proceeding to the next plan.

## Self-Check: PASSED

---
*Phase: 02-chat-ui-foundation*
*Completed: 2026-02-27*
