# Requirements: BetterAtlas v1.1 AI Chat Experience Redesign

**Defined:** 2026-02-27
**Core Value:** Students can coordinate course planning with friends while quickly discovering fitting classes with AI guidance.

## v1 Requirements

Requirements for the AI chat redesign milestone. Each requirement maps to exactly one roadmap phase.

### Chat Surface & Visual System

- [x] **AIUI-01**: User can immediately identify the AI chat page's primary zones (context/header, conversation feed, composer) without ambiguity.
- [x] **AIUI-02**: User can clearly distinguish user messages from assistant messages through consistent visual hierarchy.
- [x] **AIUI-03**: User can see explicit status feedback for waiting, success, and failure states during AI interactions.
- [x] **AIUI-04**: User can use the redesigned AI chat layout across mobile and desktop breakpoints without clipping/overlap.

### Conversation Interaction & Composer

- [x] **AIXP-01**: User can compose and submit prompts using a stable input composer that remains usable when the mobile keyboard is open.
- [x] **AIXP-02**: User experiences smooth, deterministic transitions from prompt submission to assistant response rendering.
- [x] **AIXP-03**: User can recover from failed AI requests via a visible retry path and non-destructive error feedback.
- [x] **AIXP-04**: User can start a conversation quickly using redesigned starter prompts/chips that seed useful first queries.

### Recommendation Cards & Decision Support

- [x] **AIRC-01**: User can scan course code, title, and fit score at a glance from each recommendation card.
- [x] **AIRC-02**: User can understand recommendation rationale from concise, readable explanation bullets.
- [x] **AIRC-03**: User can navigate from a recommendation card to the course detail page through a clear primary action.
- [x] **AIRC-04**: User can view caution/constraint context without overwhelming the primary recommendation hierarchy.

### Accessibility & UX Quality

- [x] **AIQ-01**: User with reduced-motion preferences receives an equivalent experience without disruptive animation.
- [x] **AIQ-02**: User can operate the redesigned chat interface with keyboard navigation and visible focus states.
- [x] **AIQ-03**: User perceives responsive interactions on representative mobile devices during chat usage.

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
| AIUI-01 | Phase 2 | Complete (02-01) |
| AIUI-02 | Phase 2 | Complete (02-02) |
| AIUI-03 | Phase 2 | Complete (02-02) |
| AIUI-04 | Phase 2 | Complete (02-03) |
| AIXP-01 | Phase 3 | Complete (03-01) |
| AIXP-02 | Phase 3 | Complete (03-02) |
| AIXP-03 | Phase 3 | Complete (03-03) |
| AIXP-04 | Phase 3 | Complete (03-03) |
| AIRC-01 | Phase 4 | Complete |
| AIRC-02 | Phase 4 | Complete |
| AIRC-03 | Phase 4 | Complete |
| AIRC-04 | Phase 4 | Complete |
| AIQ-01 | Phase 4 | Complete |
| AIQ-02 | Phase 4 | Complete |
| AIQ-03 | Phase 4 | Complete |

**Coverage:**
- v1 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-27*
*Last updated: 2026-03-03 after completing and verifying phase 04 (AIRC-01, AIRC-02, AIRC-03, AIRC-04, AIQ-01, AIQ-02, AIQ-03)*
