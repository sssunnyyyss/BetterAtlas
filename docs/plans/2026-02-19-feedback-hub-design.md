# Feedback Hub Design (feedback.betteratlas.com)

**Date:** 2026-02-19  
**Status:** Validated

---

## Overview

Build a standalone, publicly readable feedback portal at `feedback.betteratlas.com` that mirrors Yale's product pattern: boards, voting, roadmap, and changelog.  
Write actions (create posts, vote, comment) require login.

The first release is an in-house implementation on the existing BetterAtlas stack (React + Express + Drizzle + Postgres), with moderation in the existing admin area.

---

## Goals

- Create a separate feedback interface with clear product ownership signals.
- Let users submit feature requests and bugs in a structured way.
- Prioritize by user demand via votes and status workflows.
- Make progress visible through roadmap columns and changelog entries.
- Keep full control of data, workflows, and future customization.

## Non-goals (MVP)

- Full anonymous posting.
- Complex threaded discussions.
- ML-heavy duplicate clustering.
- Separate microservice architecture.

---

## Chosen Approach

### Selected option: Extend current monorepo/API

Why:
- Fastest path to parity while reusing existing auth, DB, and shared types.
- Lower operational risk than introducing a second service.
- Can evolve incrementally from current feedback primitives.

Alternatives considered:
- Separate feedback service (clean boundary, higher current complexity).
- Third-party board product (fast parity, less control, recurring vendor cost).

---

## Audience and Access Model

- Public users: can browse boards, roadmap, changelog, and search.
- Authenticated users: can create posts, vote, and comment.
- Admins: triage/moderate from existing admin panel routes.

---

## UX and Information Architecture

Top-level surfaces on `feedback.betteratlas.com`:

1. `Roadmap` (default landing)
- Columns: `Planned`, `In Progress`, `Complete`.
- Cards show vote count, title, board, status.
- Click opens post detail page/drawer.

2. `Feedback` (board views)
- Boards: `Feature Requests`, `Bugs`.
- Inline create form at top.
- Feed supports sort/filter: `Trending`, `Top`, `New`, plus status/category.
- Vote controls on cards and detail pages.

3. `Changelog`
- Reverse chronological release notes.
- Entries can reference completed posts.

4. `Search`
- Global search across posts (MVP), extend to comments/changelog later.

Identity behavior:
- Posting defaults to pseudonymous identity.
- Optional "show my profile" toggle during post creation.

Anti-noise UX:
- Similar-post suggestions while typing title.
- Clear empty-state prompts by board.
- Basic abuse limits (rate limit + min content constraints).

---

## Architecture

### Frontend

- Dedicated subdomain frontend surface in the existing frontend codebase.
- Route group for roadmap/boards/post detail/changelog/search.
- Shared auth integration with main BetterAtlas session.
- Optimistic voting updates for low-latency interaction.

### Backend

- New route namespace: `/api/feedback-hub/*`.
- Read endpoints public.
- Write endpoints protected with `requireAuth`.
- Admin mutation endpoints protected with existing admin checks.

### Storage

- Postgres tables for boards, posts, votes, comments, status history, changelog.
- Keep existing `feedback_reports` table for legacy compatibility during migration.

---

## Data Model

### New tables

- `feedback_boards`
  - `id`, `slug`, `name`, `description`, `is_public`, timestamps
- `feedback_post_categories`
  - `id`, `board_id`, `slug`, `name`
- `feedback_posts`
  - `id`, `board_id`, `category_id`, `title`, `details`, `status`
  - `author_user_id`, `author_mode` (`pseudonymous` | `linked_profile`)
  - `score_cached`, `comment_count_cached`, timestamps
- `feedback_post_votes`
  - `post_id`, `user_id`, timestamp
  - unique `(post_id, user_id)`
- `feedback_post_comments`
  - `id`, `post_id`, `author_user_id`, `body`, timestamps
- `feedback_status_history`
  - `id`, `post_id`, `from_status`, `to_status`, `changed_by_user_id`, `note`, timestamp
- `feedback_changelog_entries`
  - `id`, `title`, `body`, `published_by_user_id`, `published_at`
- `feedback_changelog_posts` (join)
  - `changelog_entry_id`, `post_id`

### Core status enum

- `open`
- `under_review`
- `planned`
- `in_progress`
- `complete`

---

## API Contract

Base path: `/api/feedback-hub`

Public read:
- `GET /boards`
- `GET /boards/:slug/posts`
- `GET /posts/:id`
- `GET /roadmap`
- `GET /changelog`
- `GET /search?q=...`

Authenticated write:
- `POST /posts`
- `POST /posts/:id/vote` (toggle vote)
- `POST /posts/:id/comments`
- `GET /posts/similar?q=...` (used by create flow for dedupe prompts)

Admin:
- `PATCH /posts/:id`
- `PATCH /posts/:id/status`
- `DELETE /comments/:id`
- `POST /changelog`

List query semantics:
- Sort: `trending`, `top`, `new`
- Filters: `status`, `category`, `q`
- Pagination: cursor preferred for board feeds; page-based acceptable for MVP.

---

## Moderation and Operations

- Triage and moderation in existing admin panel.
- Admin can edit title/body/category/status.
- Status transitions recorded in `feedback_status_history`.
- Comments can be removed by admins.
- Changelog entries can link shipped items back to source requests.

---

## Security and Abuse Controls

- Public reads only; writes gated by auth.
- Endpoint-specific rate limits for post/comment/vote.
- Input validation via shared Zod schemas.
- Server-side length bounds and text normalization.
- Unique vote constraint prevents duplicate voting.

---

## Rollout Strategy

1. Ship schema + read APIs + public browse routes.
2. Enable create/vote/comment for authenticated users.
3. Add admin triage/status/changelog tools.
4. Bridge existing `/feedback` submissions into new model.
5. Backfill historical feedback where mapping is clean.
6. Announce public feedback hub once moderation flow is stable.

---

## Success Metrics

- Weekly active voters.
- Post creation volume by board.
- Median time from `open` to `planned`.
- Median time from `planned` to `complete`.
- Ratio of duplicate-post attempts prevented by suggestions.

---

## Risks and Mitigations

- Low-signal or spam posts: auth writes + rate limits + moderation queue.
- Empty roadmap perception early: seed a small set of planned items.
- Migration inconsistency from legacy feedback: migrate only high-confidence mapped records first.
