# Requirements: BetterAtlas v1.1 AI Chat Experience Redesign

**Defined:** 2026-02-27
**Core Value:** Students can coordinate course planning with friends while quickly discovering fitting classes with AI guidance.

## v1 Requirements

Requirements for the AI chat redesign milestone. Each requirement maps to exactly one roadmap phase.

### Chat Surface & Visual System

- [ ] **AIUI-01**: User can immediately identify the AI chat page's primary zones (context/header, conversation feed, composer) without ambiguity.
- [ ] **AIUI-02**: User can clearly distinguish user messages from assistant messages through consistent visual hierarchy.
- [ ] **AIUI-03**: User can see explicit status feedback for waiting, success, and failure states during AI interactions.
- [ ] **AIUI-04**: User can use the redesigned AI chat layout across mobile and desktop breakpoints without clipping/overlap.

### Conversation Interaction & Composer

- [ ] **AIXP-01**: User can compose and submit prompts using a stable input composer that remains usable when the mobile keyboard is open.
- [ ] **AIXP-02**: User experiences smooth, deterministic transitions from prompt submission to assistant response rendering.
- [ ] **AIXP-03**: User can recover from failed AI requests via a visible retry path and non-destructive error feedback.
- [ ] **AIXP-04**: User can start a conversation quickly using redesigned starter prompts/chips that seed useful first queries.

### Recommendation Cards & Decision Support

- [ ] **AIRC-01**: User can scan course code, title, and fit score at a glance from each recommendation card.
- [ ] **AIRC-02**: User can understand recommendation rationale from concise, readable explanation bullets.
- [ ] **AIRC-03**: User can navigate from a recommendation card to the course detail page through a clear primary action.
- [ ] **AIRC-04**: User can view caution/constraint context without overwhelming the primary recommendation hierarchy.

### Accessibility & UX Quality

- [ ] **AIQ-01**: User with reduced-motion preferences receives an equivalent experience without disruptive animation.
- [ ] **AIQ-02**: User can operate the redesigned chat interface with keyboard navigation and visible focus states.
- [ ] **AIQ-03**: User perceives responsive interactions on representative mobile devices during chat usage.

## v2 Requirements

Deferred to future milestones.

### Advanced AI Chat Capabilities

- **AIV2-01**: User can see progressive/streaming assistant responses before completion.
- **AIV2-02**: User can tune chat density and personalization presets.
- **AIV2-03**: User can share or collaborate on chat sessions.

## Out of Scope

| Feature | Reason |
|---------|--------|
| AI recommendation model/ranking retraining | This milestone targets interface quality, not recommendation logic behavior |
| New AI backend transport protocol (streaming/SSE/WebSocket) | Adds major backend and infra scope beyond UI redesign goals |
| Wishlist/social feature delivery | Deferred to future milestone to keep v1.1 focused |
| Admin tooling changes for AI chat | No direct user-facing polish impact for this milestone |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AIUI-01 | Phase 2 | Pending |
| AIUI-02 | Phase 2 | Pending |
| AIUI-03 | Phase 2 | Pending |
| AIUI-04 | Phase 2 | Pending |
| AIXP-01 | Phase 3 | Pending |
| AIXP-02 | Phase 3 | Pending |
| AIXP-03 | Phase 3 | Pending |
| AIXP-04 | Phase 3 | Pending |
| AIRC-01 | Phase 4 | Pending |
| AIRC-02 | Phase 4 | Pending |
| AIRC-03 | Phase 4 | Pending |
| AIRC-04 | Phase 4 | Pending |
| AIQ-01 | Phase 4 | Pending |
| AIQ-02 | Phase 4 | Pending |
| AIQ-03 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-27*
*Last updated: 2026-02-27 after milestone v1.1 requirement definition*
