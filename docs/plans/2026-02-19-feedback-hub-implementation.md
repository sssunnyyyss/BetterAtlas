# Feedback Hub Implementation Plan

**Date:** 2026-02-19  
**Related design:** `docs/plans/2026-02-19-feedback-hub-design.md`

---

## Delivery Goal

Ship an in-house feedback platform at `feedback.betteratlas.com` with:
- Public boards + roadmap + changelog + search
- Authenticated create/vote/comment
- Admin triage/status/changelog management in existing admin area

---

## Phase 1: Schema and Shared Types

### Tasks

1. Add new feedback-hub tables to `api/src/db/schema.ts`.
2. Add migration SQL in `schema-migration.sql` (or generated migration path used by project).
3. Add shared type exports in `packages/shared/src/types/`.
4. Add validation schemas in `packages/shared/src/utils/validation.ts`.
5. Seed default boards/categories in `api/src/db/seed.ts`.

### File targets

- `api/src/db/schema.ts`
- `schema-migration.sql`
- `api/src/db/seed.ts`
- `packages/shared/src/types/index.ts`
- `packages/shared/src/utils/validation.ts`

### Verification

- `pnpm db:push`
- `pnpm db:seed`
- Confirm seeded boards include `feature-requests` and `bugs`.

---

## Phase 2: Public Read APIs

### Tasks

1. Add routes for boards, board posts, post detail, roadmap, changelog, search.
2. Add service layer queries with sorting/filtering and pagination.
3. Add indexed queries for status and post listing performance.

### File targets

- `api/src/routes/feedbackHub.ts` (new)
- `api/src/services/feedbackHubService.ts` (new)
- `api/src/index.ts` (route registration)
- `api/src/middleware/validate.ts` (reuse shared schemas)

### Verification

- `pnpm --filter api test`
- Manual endpoint checks:
  - `GET /api/feedback-hub/boards`
  - `GET /api/feedback-hub/roadmap`
  - `GET /api/feedback-hub/changelog`

---

## Phase 3: Authenticated Interaction APIs

### Tasks

1. Add create post endpoint with validation and author mode.
2. Add vote toggle endpoint with unique constraint handling.
3. Add comment creation endpoint.
4. Add similar-post suggestion endpoint for dedupe flow.
5. Add route-level rate limiting for write endpoints.

### File targets

- `api/src/routes/feedbackHub.ts`
- `api/src/services/feedbackHubService.ts`
- `api/src/middleware/rateLimit.ts`
- `packages/shared/src/utils/validation.ts`

### Verification

- `pnpm --filter api test`
- Auth checks:
  - write endpoints return `401` while logged out
  - write endpoints succeed while logged in
- Vote idempotency check: repeated toggles produce expected counts.

---

## Phase 4: Subdomain Frontend UX

### Tasks

1. Add route group for feedback hub pages.
2. Build `Roadmap`, `Board`, `PostDetail`, `Changelog`, and `Search` pages.
3. Add create post form with duplicate suggestions.
4. Add optimistic vote UX and auth redirect handling.
5. Add category/status filter controls and sort modes.

### File targets

- `frontend/src/App.tsx`
- `frontend/src/pages/feedback-hub/Roadmap.tsx` (new)
- `frontend/src/pages/feedback-hub/Board.tsx` (new)
- `frontend/src/pages/feedback-hub/PostDetail.tsx` (new)
- `frontend/src/pages/feedback-hub/Changelog.tsx` (new)
- `frontend/src/pages/feedback-hub/Search.tsx` (new)
- `frontend/src/hooks/useFeedbackHub.ts` (new)
- `frontend/src/api/client.ts` (reuse/extend methods)

### Verification

- `pnpm --filter frontend test`
- `pnpm dev:frontend`
- Manual QA:
  - public browsing works logged out
  - creating/voting/commenting requires login
  - roadmap reflects backend status changes

---

## Phase 5: Admin Triage in Existing Admin Panel

### Tasks

1. Add admin list view for feedback posts with filters.
2. Add post moderation actions (edit, status move, comment removal).
3. Add changelog publish UI linking completed posts.
4. Record status transitions with notes in history table.

### File targets

- `frontend/src/pages/admin/AdminFeedback.tsx` (new)
- `frontend/src/pages/admin/AdminLayout.tsx` (navigation link)
- `api/src/routes/adminFeedback.ts` (new or extend)
- `api/src/services/feedbackHubService.ts`

### Verification

- `pnpm --filter frontend test`
- `pnpm --filter api test`
- Admin-only route access control validated.

---

## Phase 6: Legacy Bridge and Launch

### Tasks

1. Keep legacy `/feedback` route active initially.
2. Write mapping logic from legacy submissions to new post model.
3. Backfill high-confidence historical records.
4. Launch with soft rollout and observe moderation load.

### File targets

- `api/src/routes/feedback.ts`
- `api/src/services/feedbackService.ts`
- `api/src/services/feedbackHubMigrationService.ts` (new, optional)
- `frontend/src/pages/Feedback.tsx` (link users to new hub when ready)

### Verification

- Legacy submission still succeeds.
- New hub receives mapped records.
- No duplicate migrations on reruns.

---

## Recommended Ticket Breakdown

1. `FBH-1` Schema + seed + shared types.
2. `FBH-2` Public read APIs.
3. `FBH-3` Auth write APIs + rate limits.
4. `FBH-4` Frontend roadmap + board list.
5. `FBH-5` Post detail + comments + voting.
6. `FBH-6` Admin triage UI + status transitions.
7. `FBH-7` Changelog publishing.
8. `FBH-8` Legacy bridge + rollout.

---

## Launch Checklist

- Public pages load without auth.
- Logged-in user can create post, vote, and comment.
- Vote totals are accurate under repeated toggles.
- Admin status updates appear in roadmap columns.
- Changelog entries display and deep-link to shipped posts.
- Rate limits protect writes without blocking normal usage.
- Basic analytics available for weekly triage reviews.
