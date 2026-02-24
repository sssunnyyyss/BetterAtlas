# BetterAtlas — Shared Wishlist & Section Switching

## What This Is

BetterAtlas is a university course discovery and scheduling platform. Students search courses, read reviews, build schedules, and connect with friends. This milestone adds a shared wishlist (staging area for courses before committing them to a schedule) with friend overlap indicators, and the ability to switch between sections of a course directly in the schedule view.

## Core Value

Students can coordinate course planning with friends through a shared wishlist and flexibly adjust their schedules by switching sections without starting over.

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

### Active

- [ ] Shared wishlist as a staging area (add courses, move to schedule)
- [ ] Friend wishlist visibility (view friends' wishlists)
- [ ] Overlap badges ("3 friends also want this" on wishlist courses)
- [ ] Section switching in schedule view (swap to different section of same course)

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

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Wishlist as staging area (separate from schedule) | Users want to explore before committing; keeps schedule as "committed" courses | — Pending |
| Overlap badges (not dedicated view) | Lightweight UX, surfaces coordination value without extra navigation | — Pending |
| One-way follow visibility (mutual required) | Leverages existing mutual follow system, maintains privacy | — Pending |
| Section swap replaces in schedule (no side-by-side compare) | Simpler UX, user just wants to change — can always switch back | — Pending |

---
*Last updated: 2026-02-24 after initialization*
