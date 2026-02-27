# Roadmap: BetterAtlas

## Milestones

- ✅ **v1.0 Program Toggle Accuracy** — Phase 1 (2/2 plans, shipped 2026-02-26). Archive: [.planning/milestones/v1.0-ROADMAP.md](./milestones/v1.0-ROADMAP.md)
- ◆ **v1.1 AI Chat Experience Redesign** — Active (Phases 2-4)

## Active Milestone

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
- [ ] 03-02-PLAN.md — Add deterministic transition choreography with reduced-motion support
- [ ] 03-03-PLAN.md — Redesign error/retry and starter-prompt interactions

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
- [ ] 04-01: Ship redesigned recommendation card system with progressive disclosure
- [ ] 04-02: Complete accessibility pass (keyboard, focus, reduced motion)
- [ ] 04-03: Complete performance and polish hardening for production readiness

## Progress

| Milestone | Phases | Plans | Status | Shipped |
|-----------|--------|-------|--------|---------|
| v1.0 Program Toggle Accuracy | 1 | 2/2 | Complete | 2026-02-26 |
| v1.1 AI Chat Experience Redesign | 3 | 4/9 | In Progress | — |

## Next Up

Run `03-02-PLAN.md` to continue Phase 3 interaction smoothness work.

---
*Last updated: 2026-02-27 after completing 03-01 for milestone v1.1*
