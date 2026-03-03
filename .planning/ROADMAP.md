# Roadmap: BetterAtlas

## Milestones

- ✅ **v1.0 Program Toggle Accuracy** — Phase 1 (2/2 plans, shipped 2026-02-26). Archive: [.planning/milestones/v1.0-ROADMAP.md](./milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 AI Chat Experience Redesign** — Phases 2-4 (9/9 plans, shipped 2026-03-03)

## Most Recent Milestone

### v1.1 AI Chat Experience Redesign

**Goal:** Completely redesign the AI chat user interface so course discovery feels polished, smooth, and reliable across devices.

**Requirements:** 15 total (`AIUI`, `AIXP`, `AIRC`, `AIQ`)
**Phases:** 3 (Phase 2 → Phase 4)
**Coverage:** 15/15 mapped ✓

## Proposed Roadmap

**3 phases** | **15 requirements mapped** | All covered ✓

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 2 | Chat UI Foundation | Establish redesigned chat structure and state clarity | AIUI-01, AIUI-02, AIUI-03, AIUI-04 | 4 |
| 3 | Interaction Smoothness & Mobile Composer | Make prompt/response interactions feel fluid and reliable | AIXP-01, AIXP-02, AIXP-03, AIXP-04 | 4 |
| 4 | Recommendation Cards & Quality Hardening | Redesign recommendation decision surface and enforce UX quality | AIRC-01, AIRC-02, AIRC-03, AIRC-04, AIQ-01, AIQ-02, AIQ-03 | 5 |

## Phase Details

### Phase 2: Chat UI Foundation

**Goal:** Build a new visual foundation for AI chat with clear hierarchy, explicit states, and responsive layout structure.
**Depends on:** Existing AI chat route and API contract
**Requirements:** AIUI-01, AIUI-02, AIUI-03, AIUI-04

**Success criteria:**
1. Users can immediately identify chat header/context, message feed, and composer zones.
2. User and assistant messages are visually distinct and consistent.
3. Pending/success/error states are explicit and non-ambiguous.
4. Core layout works at target mobile and desktop breakpoints without overlap/clipping.

Plans:
- [x] 02-01: Refactor AI chat route into composable layout/message/composer primitives (completed 2026-02-27)
- [x] 02-02: Implement redesigned visual hierarchy and state presentation (completed 2026-02-27)
- [x] 02-03: Validate responsive foundations across primary breakpoints (completed 2026-02-27)

### Phase 3: Interaction Smoothness & Mobile Composer

**Goal:** Deliver smooth interactions from prompt entry through response display, with robust mobile keyboard ergonomics.
**Depends on:** Phase 2
**Requirements:** AIXP-01, AIXP-02, AIXP-03, AIXP-04

**Success criteria:**
1. Composer remains usable and visible when mobile keyboard is open.
2. Send → waiting → response transitions feel smooth and deterministic.
3. Request failures surface clear retry/recovery UX without losing conversation context.
4. Starter prompt chips provide low-friction first-query onboarding.

Plans:
- [x] 03-01-PLAN.md — Rework composer behavior for keyboard-safe responsive interaction (completed 2026-02-27)
- [x] 03-02-PLAN.md — Add deterministic transition choreography with reduced-motion support (completed 2026-02-27)
- [x] 03-03-PLAN.md — Redesign error/retry and starter-prompt interactions (completed 2026-02-27)

### Phase 4: Recommendation Cards & Quality Hardening

**Goal:** Redesign recommendation cards for decision speed, then finish with accessibility and performance hardening.
**Depends on:** Phase 3
**Requirements:** AIRC-01, AIRC-02, AIRC-03, AIRC-04, AIQ-01, AIQ-02, AIQ-03

**Success criteria:**
1. Users can quickly scan each card's key information (code, title, fit score).
2. Rationale and caution information is readable without overwhelming the card.
3. Primary navigation/action affordance to course details is obvious and reliable.
4. Keyboard/focus and reduced-motion behavior pass manual UX checks.
5. Chat interactions remain responsive on representative mobile devices.

Plans:
- [x] 04-01: Ship redesigned recommendation card system with progressive disclosure (completed 2026-03-03)
- [x] 04-02: Complete accessibility pass (keyboard, focus, reduced motion) (completed 2026-03-03)
- [x] 04-03: Complete performance and polish hardening for production readiness (completed 2026-03-03)

## Progress

| Milestone | Phases | Plans | Status | Shipped |
|-----------|--------|-------|--------|---------|
| v1.0 Program Toggle Accuracy | 1 | 2/2 | Complete | 2026-02-26 |
| v1.1 AI Chat Experience Redesign | 3 | 9/9 | Complete | 2026-03-03 |

## Next Up

Archive completed v1.1 milestone and initialize next milestone planning.

- `$gsd-complete-milestone v1.1`
- `$gsd-new-milestone`

---
*Last updated: 2026-03-03 after completing and approving phase 04 for milestone v1.1*
