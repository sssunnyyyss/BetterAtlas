# BetterAtlas Atlas Sync (Nightly -> Supabase) Design

Date: 2026-02-13

## Summary

Add a server-side cron job that periodically pulls course/section data from Emory Atlas FOSE (`emory-atlas-api.md`) and upserts it into Supabase Postgres (via `DATABASE_URL`). The job is idempotent, runs nightly, syncs a single “active term”, uses “sampled details” enrichment, and “soft-stales” sections that disappear from Atlas without deleting them.

## Goals

- Run on the production server (not a local machine), with no dependency on a local Supabase instance.
- Sync one active term (`srcdb`) nightly.
- Store normalized data into Supabase Postgres tables used by the API.
- Avoid re-fetching details for unchanged sections (“sampled details”).
- Preserve history of removed/cancelled sections via soft-stale.

## Non-goals (v1)

- Perfectly parsing all HTML fields from FOSE `details` responses.
- Full backfill of all historical terms.
- Real-time updates; nightly is sufficient.

## Current Context (Repo)

- FOSE endpoints and payloads documented in `emory-atlas-api.md`.
- API uses Drizzle + Postgres via `api/src/db/index.ts` (`env.DATABASE_URL`), which should point at Supabase Postgres in prod.
- Supabase client exists for auth/admin (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`) but the sync job should primarily write via Postgres.
- `schema-migration.sql` contains intended Supabase-side migrations for `terms` and richer `sections` fields (including `term_code`, `crn`, and indexes).

## Deployment Model

- Build the API on deploy (`pnpm --filter api build`), producing `api/dist/**`.
- Cron invokes the built job entrypoint nightly:

```bash
0 3 * * * /usr/bin/node /srv/betteratlas/api/dist/jobs/atlasSync.js >> /var/log/atlas-sync.log 2>&1
```

## Configuration (env vars)

- `DATABASE_URL` (required): Supabase Postgres connection string/pooler URL.
- `ATLAS_TERM_CODE` (optional): explicit term code to sync (example: `5261`). If unset, pick the single active term from `terms` (or fail fast if ambiguous).
- `ATLAS_SUBJECTS` (required): comma-separated subjects to sync (example: `CS,MATH,ECON,BIOL_OX`).
- `ATLAS_DETAILS_MODE=sampled` (v1): only call `route=details` for new/changed sections.
- `ATLAS_CONCURRENCY` (optional): max concurrent FOSE requests.
- `ATLAS_RATE_DELAY_MS` (optional): delay between requests to be polite.

## Schema Requirements

### Soft-stale fields

Add to `sections`:

- `is_active boolean not null default true`
- `last_seen_at timestamptz`

Soft-stale logic uses these columns; sections are never deleted in v1.

### Term model alignment

This design assumes term-based identity for sections using:

- `terms(srcdb)` and `sections.term_code` (FK)
- `sections.crn`
- unique index on `(crn, term_code)`

If `schema-migration.sql` is applied (it drops `sections.semester`), update API code that reads `sections.semester` (for example in `api/src/services/courseService.ts`) to use `term_code` and optionally join `terms` for display.

## Data Sources (FOSE)

From `emory-atlas-api.md`:

- Search: `POST https://atlas.emory.edu/api/?page=fose&route=search`
- Details: `POST https://atlas.emory.edu/api/?page=fose&route=details`

Sync strategy:

- Search is authoritative for the “inventory” (what sections exist).
- Details is enrichment only (description/prereqs/attributes/grade mode and any extra section metadata we choose to parse).

## Sync Algorithm

Each nightly run:

1. Determine `term_code`:
   - If `ATLAS_TERM_CODE` set, use it.
   - Else load from `terms where is_active = true`; require exactly one.
2. Set `run_started_at = now()`.
3. For each `subject` in `ATLAS_SUBJECTS`:
   - Call FOSE `search` with `other.srcdb=term_code` and `criteria=[{field:'subject', value:subject}]`.
   - Paginate until all results are retrieved.
4. For each search result row:
   - Normalize + upsert:
     - `departments` (by `code`) if needed.
     - `courses` (by `code`) with `title` (and leave existing `description` intact unless empty).
     - `sections` (by `(crn, term_code)`) with:
       - `atlas_key = result.key`
       - `component_type = result.schd`
       - `enrollment_status = result.enrl_stat` (and/or `stat` as needed)
       - `meets_display = result.meets`
       - `meetings = JSON.parse(result.meetingTimes)` when valid
       - `start_date`, `end_date`
       - `last_synced = now()`
       - `is_active = true`
       - `last_seen_at = run_started_at`
   - Decide whether to enrich with details (“sampled details”):
     - New section (no existing `(crn, term_code)`), or
     - `atlas_key` changed, or
     - `meets_display` changed, or
     - `enrollment_status` changed, or
     - course lacks `description`/`prerequisites`
   - If enrichment needed, call FOSE `details` and update:
     - `courses.description`, `courses.prerequisites`, `courses.attributes`, `courses.grade_mode` (best-effort parsing).
     - Any section fields we elect to parse from details.
5. Soft-stale:
   - After all subjects processed:
     - `update sections set is_active=false where term_code=? and last_seen_at < run_started_at`

## Failure Handling

- Network: retry FOSE requests on 429/5xx with exponential backoff + jitter and a max attempts cap.
- Timeouts: set per-request timeout; treat as retryable up to the cap.
- Parse errors (for example invalid `meetingTimes` JSON): log and continue; store `meetings=null`.
- Partial runs: do not soft-stale if the run fails early before finishing all subjects (guard by tracking completion per run).

## Security Notes

- Prefer writing via Postgres (`DATABASE_URL`) rather than using `SUPABASE_SERVICE_ROLE_KEY` for database writes.
- If any admin endpoint is added later (for manual triggers), require strong auth (for example, a shared secret header) and never expose service role keys to clients.

## Testing Plan

- Unit tests:
  - Normalization: FOSE search row -> `courses/sections` shapes.
  - Change detection: “sampled details” decision logic.
- Integration tests (mocked):
  - Stub FOSE responses and assert idempotent upsert behavior and soft-stale behavior.

## Rollout Checklist

1. Apply schema changes in Supabase (soft-stale columns; and term/CRN schema if not already applied).
2. Update API code to match the DB schema (especially if `sections.semester` is removed).
3. Deploy code.
4. Manually run the sync once with a small `ATLAS_SUBJECTS` list to validate.
5. Enable nightly cron.

