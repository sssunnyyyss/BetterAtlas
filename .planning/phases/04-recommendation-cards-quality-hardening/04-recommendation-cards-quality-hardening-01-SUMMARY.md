---
phase: 04-recommendation-cards-quality-hardening
plan: 01
subsystem: ui
tags: [react, ai-chat, recommendations, accessibility]
requires:
  - phase: 03-interaction-smoothness-mobile-composer
    provides: keyboard-safe composer and deterministic chat lifecycle primitives
provides:
  - redesigned recommendation card system with scan-first hierarchy
  - progressive disclosure for overflow rationale and cautions
  - explicit primary CTA to course detail route
affects: [04-02 accessibility hardening, 04-03 performance hardening]
tech-stack:
  added: []
  patterns:
    - modular recommendation card composition
    - accessible disclosure controls with aria-expanded
    - explicit card action over full-card link wrapping
key-files:
  created:
    - frontend/src/features/ai-chat/components/RecommendationCard.tsx
    - frontend/src/features/ai-chat/components/RecommendationDisclosure.tsx
    - frontend/src/features/ai-chat/components/ChatAssistantBlock.test.tsx
  modified:
    - frontend/src/features/ai-chat/components/ChatAssistantBlock.tsx
    - frontend/src/index.css
key-decisions:
  - "Recommendation UI was split into RecommendationCard and RecommendationDisclosure to isolate hierarchy and disclosure behavior."
  - "Primary navigation moved to an explicit \"View course details\" action to avoid nested interactive conflicts with disclosure controls."
  - "Shared ba-chat focus-ring/disclosure utility classes were added to keep interaction affordances consistent across card controls."
patterns-established:
  - "Recommendation cards render key scan data first (code/title/fit) and defer secondary details behind semantic disclosure controls."
  - "Chat interactive controls should use ba-chat-focus-ring for visible keyboard focus parity."
requirements-completed: [AIRC-01, AIRC-02, AIRC-03, AIRC-04]
duration: 9 min
completed: 2026-03-02
---

# Phase 04 Plan 01: Recommendation Card System Summary

**Redesigned recommendation cards now prioritize scan speed with explicit detail actions and progressive disclosure for rationale/cautions.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-03T05:56:00Z
- **Completed:** 2026-03-03T06:05:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Shipped dedicated `RecommendationCard` and `RecommendationDisclosure` components with scan-first card hierarchy.
- Integrated the new card system into `ChatAssistantBlock` while preserving assistant message/follow-up composition.
- Added regression coverage for summary hierarchy, disclosure behavior, and primary course-detail routing.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build scan-first recommendation card primitives** - `8281a4c` (feat)
2. **Task 2: Integrate redesigned cards into assistant-turn rendering** - `cf8bd30` (feat)
3. **Task 3: Add targeted regression tests for recommendation-card behavior** - `9a88b22` (test)

## Files Created/Modified
- `frontend/src/features/ai-chat/components/RecommendationCard.tsx` - New recommendation card primitive with fit hierarchy and details CTA.
- `frontend/src/features/ai-chat/components/RecommendationDisclosure.tsx` - Reusable semantic disclosure control for overflow rationale/cautions.
- `frontend/src/features/ai-chat/components/ChatAssistantBlock.tsx` - Assistant recommendation list now composes `RecommendationCard`.
- `frontend/src/features/ai-chat/components/ChatAssistantBlock.test.tsx` - Component-level regression tests for AIRC card behaviors.
- `frontend/src/index.css` - Shared chat focus-ring and disclosure transition utilities.

## Decisions Made
- Recommendation rendering was split into dedicated primitives so Phase 2/3 feed/session scaffolding remains untouched while card behavior evolves.
- The card surface uses an explicit primary details action instead of full-card link wrapping to preserve valid, keyboard-friendly nested control semantics.
- Progressive disclosure labels were made count-aware (`Show cautions (N)`) to expose risk context without crowding the default card state.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- React Router v7 future-flag warnings appear in test stderr but did not affect execution or assertions.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Recommendation card foundation is complete and ready for accessibility hardening in `04-02`.
- No blockers for reduced-motion/keyboard focus pass.

---
*Phase: 04-recommendation-cards-quality-hardening*
*Completed: 2026-03-02*
