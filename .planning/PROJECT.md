# BetterAtlas — Shared Wishlist & Section Switching

## What This Is

BetterAtlas is a university course discovery and scheduling platform. Students search courses, read reviews, build schedules, and connect with friends. The most recently shipped milestone focused on deterministic program/major toggle behavior in catalog program mode.

## Core Value

Students can coordinate course planning with friends through a shared wishlist and flexibly adjust their schedules by switching sections without starting over.

## Current State

- **Shipped milestone:** v1.0 Program Toggle Accuracy (2026-02-26)
- **Latest delivery:** Program-mode major/minor toggles are deterministic and stable across URL deep links/refreshes.
- **Verification:** Phase-level verification passed (`4/4 must-haves`) with targeted backend/frontend regression coverage.

## Requirements

### Validated

<!-- Inferred from existing codebase -->

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

- [ ] Shared wishlist as a staging area (add courses, move to schedule)
- [ ] Friend wishlist visibility (view friends' wishlists)
- [ ] Overlap badges ("3 friends also want this" on wishlist courses)
- [ ] Section switching in schedule view (swap to different section of same course)
- [ ] Degree-specific program variant picker in catalog mode
- [ ] Counterpart-availability hints when major/minor variant is missing

### Out of Scope

- Real-time notifications for wishlist changes — adds complexity, not core to coordination
- Wishlist commenting/messaging — follow system + overlap badges are sufficient for now
- Group scheduling (auto-find sections that work for multiple friends) — too complex for v1
- Public/searchable wishlists — wishlists visible only to mutual friends

## Context

- **Existing social layer:** Mutual follow system is already in place — wishlist visibility builds directly on this
- **Schedule view exists:** Section switching extends the existing schedule UI rather than building new
- **Monorepo structure:** API (Express/Drizzle), frontend (React/React Query), shared types package — new features follow existing patterns
- **Database:** PostgreSQL via Supabase with Drizzle ORM — need new tables for wishlists
- **Sections data:** Course sections with times, instructors, and enrollment are already modeled in the database

## Constraints

- **Tech stack**: Must use existing stack (Express, React, Drizzle, Supabase) — no new frameworks
- **Auth**: Build on existing Supabase auth and mutual follow system — no new auth flows
- **Database**: PostgreSQL via Supabase — new tables/migrations via Drizzle

## Next Milestone Goals

1. Deliver shared wishlist as a true staging workflow between discovery and schedule.
2. Add friend overlap visibility for wishlist coordination.
3. Implement schedule section switching UX and API behavior.
4. Close remaining program UX gaps only where they support adoption of wishlist/scheduling flows.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Wishlist as staging area (separate from schedule) | Users want to explore before committing; keeps schedule as "committed" courses | — Pending |
| Overlap badges (not dedicated view) | Lightweight UX, surfaces coordination value without extra navigation | — Pending |
| One-way follow visibility (mutual required) | Leverages existing mutual follow system, maintains privacy | — Pending |
| Section swap replaces in schedule (no side-by-side compare) | Simpler UX, user just wants to change — can always switch back | — Pending |
| Strict-first program family matching with normalized fallback | Prevent unrelated variant jumps while still handling naming drift | ✓ Implemented in v1.0 |
| Deterministic degree-aware variant ranking | Eliminate first-result instability in major/minor toggles | ✓ Implemented in v1.0 |
| Bounded AI-summary relevance boost (not hard filter) | Improve relevance ordering without making unstable opaque filtering rules | ✓ Implemented in v1.0 |

---
*Last updated: 2026-02-26 after v1.0 milestone completion*
