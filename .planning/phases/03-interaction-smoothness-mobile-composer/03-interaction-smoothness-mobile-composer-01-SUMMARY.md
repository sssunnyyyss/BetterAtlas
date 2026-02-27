---
phase: 03-interaction-smoothness-mobile-composer
plan: 01
subsystem: ui
tags: [react, visualviewport, mobile-composer, vitest]
requires:
  - phase: 02-chat-ui-foundation
    provides: ChatShell decomposition and responsive zone contracts from phase 02
provides:
  - VisualViewport-aware composer viewport metrics hook with non-VisualViewport fallback
  - Keyboard-safe composer inset wiring for standalone and embedded chat shells
  - Interaction regression tests for keyboard-open viewport behavior and send affordance rules
affects: [03-02, 03-03, ai-chat-ui]
tech-stack:
  added: []
  patterns:
    - Composer zone inset is derived from runtime `window.visualViewport` keyboard delta
    - Viewport tests use deterministic visual viewport mocks instead of UA heuristics
key-files:
  created:
    - frontend/src/features/ai-chat/hooks/useComposerViewport.ts
    - frontend/src/pages/AiChat.interactions.test.tsx
  modified:
    - frontend/src/pages/AiChat.tsx
    - frontend/src/features/ai-chat/components/ChatShell.tsx
    - frontend/src/features/ai-chat/components/ChatComposer.tsx
    - frontend/src/test/utils/viewport.ts
key-decisions:
  - "Apply keyboard-safe offset at the ChatShell composer zone to preserve existing header/feed/composer structure."
  - "Model keyboard-open behavior through VisualViewport-driven tests so regressions are caught in jsdom."
patterns-established:
  - "`useComposerViewport` publishes `{ keyboardInset, viewportHeight }` as the shared mobile composer contract."
  - "Composer send controls remain enabled/disabled strictly by draft/sending state, independent of viewport changes."
requirements-completed: [AIXP-01]
duration: 4 min
completed: 2026-02-27
---

# Phase 3 Plan 01: Mobile Composer Keyboard-Safe Ergonomics Summary

**AI chat now keeps the composer reachable during mobile keyboard-open viewport shrink by applying VisualViewport-driven inset spacing in both standalone and embedded shells, with interaction tests guarding regressions.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-27T06:48:30Z
- **Completed:** 2026-02-27T06:52:13Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Added `useComposerViewport` to compute deterministic keyboard inset and viewport height metrics with safe fallback behavior.
- Wired `AiChat` + `ChatShell` + `ChatComposer` so keyboard inset spacing keeps textarea and send controls reachable without changing shell decomposition.
- Added `AiChat.interactions` coverage to simulate keyboard-open viewport changes and lock send-button usability rules.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add a VisualViewport-aware composer ergonomics hook and test helper support** - `811987c` (feat)
2. **Task 2: Wire keyboard-safe inset behavior into AiChat shell/composer layout without changing decomposition** - `3bf6d9a` (feat)
3. **Task 3: Add interaction tests for keyboard-safe composer visibility and submit usability** - `4cc49a7` (test)

## Files Created/Modified
- `frontend/src/features/ai-chat/hooks/useComposerViewport.ts` - Hook for keyboard inset + viewport metrics from VisualViewport and fallback resize handling.
- `frontend/src/test/utils/viewport.ts` - Deterministic VisualViewport mock/update/reset helpers for keyboard simulation in tests.
- `frontend/src/pages/AiChat.tsx` - Composer viewport metrics consumed and passed into shell composer inset.
- `frontend/src/features/ai-chat/components/ChatShell.tsx` - Composer zone now applies runtime keyboard inset spacing while preserving zone boundaries.
- `frontend/src/features/ai-chat/components/ChatComposer.tsx` - Stable composer test ids for textarea/send/shell interaction assertions.
- `frontend/src/pages/AiChat.interactions.test.tsx` - Regression tests for standalone and embedded keyboard-open behavior.

## Decisions Made
- Keep shell decomposition stable and apply keyboard handling as an additive inset contract.
- Expose deterministic composer test selectors to avoid brittle class-based interaction assertions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Build-safe cleanup for VisualViewport mock reset**
- **Found during:** Task 2 verification (`pnpm --filter frontend build`)
- **Issue:** TypeScript rejected `delete window.visualViewport` in test utility cleanup.
- **Fix:** Switched cleanup to `Reflect.deleteProperty(window, "visualViewport")`.
- **Files modified:** `frontend/src/test/utils/viewport.ts`
- **Verification:** Frontend build passed after fix.
- **Committed in:** `3bf6d9a`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** No scope increase; blocking fix was required for successful compile/verification.

## Issues Encountered
- Manual mobile-device verification gates (iOS Safari / Android Chrome keyboard-open checks) were not executable in this CLI environment and remain required for sign-off.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- AIXP-01 implementation and automated regression coverage are complete.
- Ready to execute `03-02-PLAN.md` for transition choreography, with manual device gate follow-through still required for final phase acceptance.

## Self-Check: PASSED

---
*Phase: 03-interaction-smoothness-mobile-composer*
*Completed: 2026-02-27*
