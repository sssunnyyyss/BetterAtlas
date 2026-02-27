# BetterAtlas — AI Chat Experience Redesign

## What This Is

BetterAtlas is a university course discovery and scheduling platform. Students search courses, read reviews, build schedules, and connect with friends. This milestone focuses on a complete redesign of the AI chat interface so course discovery feels polished, fast, and smooth across desktop and mobile.

## Core Value

Students can coordinate course planning with friends through a shared wishlist and flexibly adjust schedules while quickly discovering fitting classes with AI guidance.

## Current Milestone: v1.1 AI Chat Experience Redesign

**Goal:** Redesign the AI chat UI to feel modern, fluid, and reliable without changing recommendation quality semantics.

**Target features:**
- A redesigned AI chat page layout with clearer hierarchy and stronger visual polish.
- Smoother conversation interactions (animations, typing/loading states, transitions).
- More legible recommendation cards and in-chat action affordances.
- Mobile-first responsiveness, accessibility, and perceived-performance polish.

## Current State

- **Shipped milestone:** v1.0 Program Toggle Accuracy (2026-02-26)
- **Latest delivery:** Program-mode major/minor toggles are deterministic and stable across URL deep links/refreshes.
- **Verification:** Phase-level verification passed (`4/4 must-haves`) with targeted backend/frontend regression coverage.

## Requirements

### Validated

- ✓ User authentication (Supabase email/password, sessions) — existing
- ✓ Course catalog with search (hybrid semantic + lexical) — existing
- ✓ Course detail pages with professor ratings and reviews — existing
- ✓ Review submission and display — existing
- ✓ Schedule builder ("my schedule" view) — existing
- ✓ Mutual follow system (friend connections) — existing
- ✓ User profiles — existing
- ✓ Admin panel and admin operations — existing
- ✓ AI chat interface for course discovery — existing
- ✓ Rate My Professor integration — existing
- ✓ Program/degree tracking — existing
- ✓ Deterministic program variant matching and ordering in catalog mode — v1.0
- ✓ Program-mode URL tab canonicalization (`programTab`) and deep-link stability — v1.0
- ✓ Program-mode regression suite for variant toggles and relevance ordering — v1.0

### Active

- [ ] AI chat information architecture redesign (header, message surface, composer, spacing/typography)
- [ ] Smooth interaction system for chat responses and loading states
- [ ] Recommendation-card redesign with stronger scanability and clearer actions
- [ ] Responsive/mobile layout polish and keyboard-safe input behavior
- [ ] Accessibility and performance quality pass for the redesigned chat experience

### Out of Scope

- Rebuilding recommendation/ranking logic in the AI backend — this milestone is UI/UX-focused
- Streaming/progressive token transport changes to the AI API — keep current request/response shape
- Shared wishlist and section-switching delivery — deferred to a future milestone
- New social workflows in AI chat (sharing, collaborative chat rooms) — not required for this redesign

## Context

- AI chat currently exists as a functional page (`frontend/src/pages/AiChat.tsx`) with basic interaction patterns.
- The frontend stack is React + React Query + Tailwind; redesign should preserve existing conventions where practical.
- The API contract for AI recommendations is already in production and should remain backward-compatible for this milestone.
- The app now supports public browsing; AI chat is public and must behave cleanly for logged-out users.

## Constraints

- **Tech stack**: Must use existing stack (React, TypeScript, Tailwind, React Query) — no framework migration.
- **API compatibility**: Keep `/api/ai/course-recommendations` request/response shape compatible with existing clients.
- **Scope control**: Prioritize UX/UI polish and interaction smoothness over new backend capability work.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Treat v1.1 as an AI chat UI/UX milestone | User goal is explicit redesign quality, not backend feature expansion | — Pending |
| Keep existing AI recommendation API contract during redesign | Avoid coupling UX refresh to backend risk | — Pending |
| Preserve strong mobile responsiveness and accessibility as table stakes | Polished feel requires quality across devices and input modes | — Pending |
| Strict-first program family matching with normalized fallback | Prevent unrelated variant jumps while still handling naming drift | ✓ Implemented in v1.0 |
| Deterministic degree-aware variant ranking | Eliminate first-result instability in major/minor toggles | ✓ Implemented in v1.0 |
| Bounded AI-summary relevance boost (not hard filter) | Improve relevance ordering without unstable opaque filtering rules | ✓ Implemented in v1.0 |

---
*Last updated: 2026-02-27 after starting milestone v1.1*
