# BetterAtlas Admin Panel (Ops + Sync + Users) Design

Date: 2026-02-16

## Summary

Add a role-protected `/admin` panel for operators to:

- Trigger Emory Atlas FOSE course sync (existing `api/src/jobs/atlasSync.ts`) as a background run, view live-ish logs, and keep run history.
- Monitor server health/resources (CPU/mem/disk/process + DB ping).
- View product + catalog stats (usage + data freshness).
- Create users and deactivate/reactivate users.
- View diagnostics (sync logs + recent app errors).

The admin API is protected via the existing Supabase Bearer token flow (`Authorization: Bearer <access_token>`) plus a DB-backed `users.is_admin` flag.

## Goals

- **One place to operate the system** without SSH: run sync, see logs, check health.
- **Safe-by-default**: no user deletions; deactivation blocks access without data loss.
- **Bootstrappable admin**: never lock yourself out; `ADMIN_EMAILS` auto-grants admin.
- **Low infra**: no external queue required in v1; background runs are child processes.

## Non-goals (v1)

- A fully distributed job queue/worker system.
- Perfect real-time streaming; polling is acceptable given header-based auth.
- Rich observability stack (Prometheus/Grafana). This is a lightweight embedded ops UI.

## Current Context (Repo)

- Backend: Express + TS (`api/src/index.ts`)
- Auth: Supabase tokens validated server-side (`api/src/middleware/auth.ts`)
- Atlas sync job: `api/src/jobs/atlasSync.ts` (writes to Postgres via Drizzle)
- Existing cron entrypoint: `scripts/atlas-sync.sh` (runs `api/dist/jobs/atlasSync.js`)

## Admin Access Model

### Data model

Add to `users` table:

- `is_admin boolean not null default false`
- `is_disabled boolean not null default false`
- `disabled_at timestamptz null`
- `disabled_reason text null`
- `last_seen_at timestamptz null` (for active-user stats)

### Bootstrap (initial admin)

Add `ADMIN_EMAILS` env var (comma-separated).

On `/api/auth/me`, after user profile load/self-heal:

- If `req.user.email` is in `ADMIN_EMAILS`, set `users.is_admin=true`.

### Middleware

- `requireAuth`: validates Supabase token, sets `req.user {id,email}`.
- `requireAdmin`: `requireAuth` + loads `users` row; denies if `is_disabled` or not `is_admin`.
- (Optional) for all authenticated routes: block disabled users. Implemented as a lightweight DB check in `requireAuth` when a profile row exists.

## Jobs: Background Runs + Logs + Presets

### Why polling (not SSE)

Browser `EventSource` cannot send `Authorization` headers. To keep bearer-token auth, the admin UI uses polling endpoints:

- `GET /api/admin/jobs/:id` (status)
- `GET /api/admin/jobs/:id/logs?afterId=...` (incremental logs)

### Tables

`admin_job_runs`

- `id`
- `type` (e.g. `atlas_sync`)
- `status` (`queued|running|succeeded|failed|canceled`)
- `requested_by` (admin user id)
- `params jsonb` (resolved run config)
- `stats jsonb` (best-effort summary; optional)
- `error text`
- `created_at`, `started_at`, `finished_at`

`admin_job_logs`

- `id`
- `run_id`
- `ts`
- `level` (`info|warn|error`)
- `message`

`admin_sync_presets`

- `id`
- `kind` (`atlas_sync`)
- `name`
- `params jsonb`
- `is_default`
- `is_active`
- audit fields (`created_at`, `updated_at`, `updated_by`)

### Atlas sync run implementation

To minimize refactors, v1 runs Atlas sync as a child process:

- Dev: `tsx api/src/jobs/atlasSync.ts`
- Prod: `node api/dist/jobs/atlasSync.js`

Stdout/stderr are captured line-by-line into `admin_job_logs`, and the run transitions `queued -> running -> (succeeded|failed)`.

Single-flight locking:

- Reject new atlas sync runs if another `atlas_sync` run is `running` (HTTP 409 with current run id).

### Run config

Presets + overrides resolve into:

- `ATLAS_TERM_CODE`
- `ATLAS_SUBJECTS`
- `ATLAS_CAMPUSES`
- `ATLAS_DETAILS_MODE`
- `ATLAS_CONCURRENCY`
- `ATLAS_RATE_DELAY_MS`

## System Monitoring

Admin endpoint: `GET /api/admin/system/metrics`

- Host: `uptime`, `loadavg`, CPU count
- Memory: total/free
- Disk: `statfs` for a configured path (best-effort; may be null on unsupported platforms)
- Process: RSS/heap + event-loop delay (p95)
- Dependencies: Postgres ping and measured latency
- App version string

Admin UI polls this endpoint (e.g. every 5s). Optional persistence (`admin_metric_samples`) can be added later if needed.

## Stats

Admin endpoint: `GET /api/admin/stats/overview?window=7d|30d`

Core metrics:

- Users: total, new users in window, active users (based on `last_seen_at`)
- Reviews: total, new reviews in window
- Social: friendships count, pending requests
- Catalog freshness: last successful `atlas_sync` run time, count of active sections, count of “stale” sections (last_synced older than threshold)

Optional “cool but useful” lists:

- Top rated courses, most reviewed courses, polarizing courses

## Users

Admin endpoints:

- `GET /api/admin/users` (search + pagination)
- `POST /api/admin/users` (create user via Supabase Admin + insert profile)
- `PATCH /api/admin/users/:id` (set `is_disabled`, `is_admin`)

Deletion is not exposed; use deactivation.

## Logs

Admin UI includes:

- Job run log viewer (by `admin_job_runs` + `admin_job_logs`)
- Recent app error records (`admin_app_errors`) captured from Express error handler (best-effort, redacted)

## UI / Information Architecture

Routes:

- `/admin/sync`
- `/admin/system`
- `/admin/stats`
- `/admin/users`
- `/admin/logs`

Signature interaction:

- **Sync Timeline**: run “stamps” you click to inspect logs/stats.

Visual direction:

- “Library tools”: parchment surfaces, ink text, navy accent; logs use a terminal-like inset surface.

## Error Handling

- Admin endpoints return structured `{ error: string }` plus validation details.
- Child-process job failures persist `admin_job_runs.error` and mark status `failed`.
- Atlas sync stays idempotent; the admin trigger is equivalent to running the existing job with env overrides.

## Testing Plan

- Unit: validate `ADMIN_EMAILS` allowlist parsing and single-flight run locking.
- Integration (smoke): admin can start a run, logs are written, status transitions occur.
- Frontend: manual checks for admin-only access and run polling behavior.

## Rollout Checklist

1. Apply DB migration (users admin fields + admin tables).
2. Set `ADMIN_EMAILS` in production.
3. Deploy API + frontend with `/admin`.
4. Create an Atlas sync preset (“Default”) and set it as default.
5. Run a manual sync in admin UI with a small subject list to validate.

