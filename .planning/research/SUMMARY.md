# Project Research Summary

**Project:** BetterAtlas
**Domain:** AI chat interface redesign for course recommendation UX
**Researched:** 2026-02-27
**Confidence:** HIGH

## Executive Summary

The milestone should stay within the current frontend stack and treat the redesign as an interaction-quality initiative rather than a backend capability project. The highest-impact path is to establish clear chat state boundaries first (idle, pending, success, error), then layer visual polish and subtle motion.

Users will judge quality primarily by message readability, recommendation-card scanability, and mobile composer behavior. The redesign should prioritize these three surfaces before optional extras. Backward compatibility with the current AI API contract keeps delivery risk low and enables quick iteration.

The largest risks are over-animation, mobile keyboard collisions, and dense card layouts. These are avoidable with explicit state modeling, restrained motion, and progressive disclosure in recommendation cards.

## Key Findings

### Recommended Stack

Keep React + TypeScript + Tailwind + React Query as-is for this milestone.

**Core technologies:**
- React: composable chat surface and interaction boundaries.
- TypeScript: safer refactor coverage during major UI restructuring.
- Tailwind: fast visual iteration and responsive behavior tuning.
- React Query: deterministic mutation/loading/error handling.

### Expected Features

**Must have (table stakes):**
- Clear user/assistant message hierarchy and polished visual system.
- Reliable loading/error/typing interaction feedback.
- Recommendation cards with immediate scanability.
- Mobile-safe input composer and reduced-motion support.

**Should have (competitive):**
- Intent-driven prompt chips and stronger first-run guidance.
- Better card-level rationale/caution presentation.

**Defer (v2+):**
- Streaming token rendering.
- Collaborative/shared chat sessions.

### Architecture Approach

Refactor the existing AI chat route into smaller UI modules (shell, message list, bubble, recommendation card, composer) while preserving current API and mutation hooks.

**Major components:**
1. Chat shell/layout primitives
2. Message and state renderer
3. Recommendation card system
4. Composer and submit interactions

### Critical Pitfalls

1. **State ambiguity** — solve with explicit state-first design.
2. **Mobile keyboard collisions** — solve with early mobile-first composer validation.
3. **Over-animation and jank** — solve with restrained transform/opacity motion only.
4. **Card density overload** — solve with progressive disclosure and strong hierarchy.

## Implications for Roadmap

### Phase 2: Chat UI Foundation
**Rationale:** Establishes deterministic state + visual structure before polish.
**Delivers:** New layout primitives and chat message hierarchy.
**Addresses:** Core table-stakes readability and reliability.
**Avoids:** state ambiguity pitfall.

### Phase 3: Interaction Smoothness and Mobile Polish
**Rationale:** Motion and responsive behavior depend on stable layout/state foundations.
**Delivers:** refined transitions, loading/typing ergonomics, mobile-safe composer behavior.
**Implements:** interaction/motion and responsiveness requirements.

### Phase 4: Recommendation Card Redesign and Quality Hardening
**Rationale:** Cards are highest-value decision surface and need dedicated pass.
**Delivers:** redesigned recommendation cards + accessibility/performance quality verification.

### Phase Ordering Rationale

- Foundation first prevents styling rework and interaction regressions.
- Motion/responsive work second ensures polish is built on stable structure.
- Card redesign + hardening last consolidates final user-facing quality checks.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3:** keyboard-safe mobile chat ergonomics on multiple viewport classes.

Phases with standard patterns (skip research-phase):
- **Phase 2:** standard component decomposition and state-boundary work.
- **Phase 4:** standard card hierarchy + quality-hardening checks.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Existing stack already supports required redesign patterns |
| Features | HIGH | User objective is clear and directly mappable to UI capabilities |
| Architecture | HIGH | Clear component boundaries and low-risk integration path |
| Pitfalls | HIGH | Risks are known and recurring in chat UI refactors |

**Overall confidence:** HIGH

### Gaps to Address

- Validate final motion tuning on lower-performance mobile devices.
- Confirm updated card information hierarchy with quick user feedback after implementation.

## Sources

### Primary (HIGH confidence)
- BetterAtlas repository (current AI chat route, hooks, build/test setup)
- Existing milestone context and project planning artifacts

### Secondary (MEDIUM confidence)
- Established modern chat UX patterns and accessibility conventions

---
*Research completed: 2026-02-27*
*Ready for roadmap: yes*
