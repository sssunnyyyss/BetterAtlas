-- ============================================================
-- BetterAtlas Schema Migration: Atlas API Integration
-- Run this in Supabase SQL Editor (or psql)
-- ============================================================

BEGIN;

-- ============================================================
-- 1. CREATE terms TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS terms (
  srcdb VARCHAR(10) PRIMARY KEY,
  name VARCHAR(30) NOT NULL,
  season VARCHAR(10) NOT NULL,
  year SMALLINT NOT NULL,
  is_active BOOLEAN DEFAULT true
);

INSERT INTO terms (srcdb, name, season, year, is_active) VALUES
  -- Keep exactly one "active" term by default; the nightly sync expects a single active term.
  ('5266', 'Summer 2026', 'Summer', 2026, false),
  ('5261', 'Spring 2026', 'Spring', 2026, true),
  ('5259', 'Fall 2025',   'Fall',   2025, false),
  ('5256', 'Summer 2025', 'Summer', 2025, false),
  ('5251', 'Spring 2025', 'Spring', 2025, false),
  ('5249', 'Fall 2024',   'Fall',   2024, false),
  ('5246', 'Summer 2024', 'Summer', 2024, false),
  ('5241', 'Spring 2024', 'Spring', 2024, false),
  ('5239', 'Fall 2023',   'Fall',   2023, false),
  ('5236', 'Summer 2023', 'Summer', 2023, false),
  ('5231', 'Spring 2023', 'Spring', 2023, false),
  ('5229', 'Fall 2022',   'Fall',   2022, false),
  ('5226', 'Summer 2022', 'Summer', 2022, false),
  ('5221', 'Spring 2022', 'Spring', 2022, false),
  ('5219', 'Fall 2021',   'Fall',   2021, false),
  ('5216', 'Summer 2021', 'Summer', 2021, false),
  ('5211', 'Spring 2021', 'Spring', 2021, false),
  ('5209', 'Fall 2020',   'Fall',   2020, false),
  ('5206', 'Summer 2020', 'Summer', 2020, false),
  ('5201', 'Spring 2020', 'Spring', 2020, false),
  ('5199', 'Fall 2019',   'Fall',   2019, false),
  ('5196', 'Summer 2019', 'Summer', 2019, false),
  ('5191', 'Spring 2019', 'Spring', 2019, false)
ON CONFLICT (srcdb) DO NOTHING;

-- Keep at most one active term row.
WITH active_ranked AS (
  SELECT
    srcdb,
    ROW_NUMBER() OVER (ORDER BY year DESC, srcdb DESC) AS rn
  FROM terms
  WHERE is_active = true
)
UPDATE terms t
SET is_active = false
FROM active_ranked ar
WHERE t.srcdb = ar.srcdb
  AND ar.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_terms_single_active_true
  ON terms (is_active)
  WHERE is_active = true;

-- ============================================================
-- 2. ALTER departments — widen code for longer subject codes
-- ============================================================
ALTER TABLE departments
  ALTER COLUMN code TYPE VARCHAR(20);

-- ============================================================
-- 3. ALTER instructors — add Atlas ID for sync
-- ============================================================
ALTER TABLE instructors
  ADD COLUMN IF NOT EXISTS atlas_id VARCHAR(20);

CREATE UNIQUE INDEX IF NOT EXISTS idx_instructors_atlas_id
  ON instructors (atlas_id)
  WHERE atlas_id IS NOT NULL;

-- ============================================================
-- 4. ALTER courses — add fields from Atlas detail API
-- ============================================================
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS prerequisites TEXT,
  ADD COLUMN IF NOT EXISTS attributes TEXT,
  ADD COLUMN IF NOT EXISTS grade_mode VARCHAR(50);

-- ============================================================
-- 5. ALTER sections — add all Atlas fields
-- ============================================================

-- 5a. Add new columns
ALTER TABLE sections
  ADD COLUMN IF NOT EXISTS crn VARCHAR(10),
  ADD COLUMN IF NOT EXISTS term_code VARCHAR(10),
  -- Soft-stale support (nightly Atlas sync)
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS meetings JSONB,
  ADD COLUMN IF NOT EXISTS meets_display VARCHAR(100),
  ADD COLUMN IF NOT EXISTS waitlist_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS waitlist_cap INTEGER,
  ADD COLUMN IF NOT EXISTS seats_avail INTEGER,
  ADD COLUMN IF NOT EXISTS enrollment_status VARCHAR(5),
  ADD COLUMN IF NOT EXISTS component_type VARCHAR(5),
  ADD COLUMN IF NOT EXISTS instruction_method VARCHAR(5),
  ADD COLUMN IF NOT EXISTS campus VARCHAR(20),
  ADD COLUMN IF NOT EXISTS session VARCHAR(10),
  ADD COLUMN IF NOT EXISTS start_date VARCHAR(10),
  ADD COLUMN IF NOT EXISTS end_date VARCHAR(10),
  -- Emory GER requirement designation (from `clss_assoc_rqmnt_designt_html`)
  ADD COLUMN IF NOT EXISTS ger_designation TEXT,
  -- Comma-delimited codes with leading/trailing commas, e.g. ",HA,CW,ETHN,"
  ADD COLUMN IF NOT EXISTS ger_codes TEXT,
  ADD COLUMN IF NOT EXISTS atlas_key VARCHAR(20),
  ADD COLUMN IF NOT EXISTS last_synced TIMESTAMPTZ;

-- 5a.1 Backfill soft-stale fields for existing rows
UPDATE sections
SET is_active = true
WHERE is_active IS DISTINCT FROM true;

UPDATE sections
SET last_seen_at = NOW()
WHERE last_seen_at IS NULL;

-- 5b. Migrate existing semester text → term_code
UPDATE sections SET term_code = '5249' WHERE semester = 'Fall 2024';
UPDATE sections SET term_code = '5251' WHERE semester = 'Spring 2025';
UPDATE sections SET term_code = '5259' WHERE semester = 'Fall 2025';
UPDATE sections SET term_code = '5261' WHERE semester = 'Spring 2026';
UPDATE sections SET term_code = '5266' WHERE semester = 'Summer 2026';

-- 5c. For any rows that didn't match, set a default so FK won't fail
UPDATE sections SET term_code = '5261' WHERE term_code IS NULL;

-- 5d. Add FK constraint and NOT NULL
ALTER TABLE sections
  ALTER COLUMN term_code SET NOT NULL;

ALTER TABLE sections
  ADD CONSTRAINT fk_sections_term
  FOREIGN KEY (term_code) REFERENCES terms(srcdb);

-- 5e. Indexes
CREATE INDEX IF NOT EXISTS idx_sections_term ON sections (term_code);
CREATE INDEX IF NOT EXISTS idx_sections_status ON sections (enrollment_status);

-- NOTE: Do not make this a partial index; the sync job uses `ON CONFLICT (crn, term_code)`
-- which requires a predicate-free unique index/constraint to match.
CREATE UNIQUE INDEX IF NOT EXISTS idx_sections_crn_term
  ON sections (crn, term_code);

-- 5f. Drop old semester column
ALTER TABLE sections DROP COLUMN IF EXISTS semester;

-- 5g. Migrate old schedule JSONB → meetings array format
-- Old format: {"days":["M","W"],"start":"08:00","end":"08:50","location":"Science Hall 101"}
-- New format: [{"day":0,"startTime":"0800","endTime":"0850","location":"Science Hall 101"}, ...]
UPDATE sections
SET meetings = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'day',
      CASE d.val
        WHEN 'M'  THEN 0
        WHEN 'T'  THEN 1
        WHEN 'W'  THEN 2
        WHEN 'Th' THEN 3
        WHEN 'R'  THEN 3
        WHEN 'F'  THEN 4
        ELSE 0
      END,
      'startTime', REPLACE(schedule->>'start', ':', ''),
      'endTime',   REPLACE(schedule->>'end', ':', ''),
      'location',  COALESCE(schedule->>'location', '')
    )
  )
  FROM jsonb_array_elements_text(schedule->'days') AS d(val)
)
WHERE schedule IS NOT NULL
  AND schedule->>'days' IS NOT NULL
  AND meetings IS NULL;

-- 5h. Drop old schedule column
ALTER TABLE sections DROP COLUMN IF EXISTS schedule;

-- ============================================================
-- 6. ALTER reviews — semester text → term_code FK
-- ============================================================
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS term_code VARCHAR(10);

UPDATE reviews SET term_code = '5249' WHERE semester = 'Fall 2024';
UPDATE reviews SET term_code = '5251' WHERE semester = 'Spring 2025';
UPDATE reviews SET term_code = '5259' WHERE semester = 'Fall 2025';
UPDATE reviews SET term_code = '5261' WHERE semester = 'Spring 2026';

ALTER TABLE reviews
  ADD CONSTRAINT fk_reviews_term
  FOREIGN KEY (term_code) REFERENCES terms(srcdb);

ALTER TABLE reviews DROP COLUMN IF EXISTS semester;

-- ============================================================
-- 6b. ALTER reviews — add instructor_id + section_id for professor/section-specific ratings
-- ============================================================
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS instructor_id INTEGER;

ALTER TABLE reviews
  ADD CONSTRAINT fk_reviews_instructor
  FOREIGN KEY (instructor_id) REFERENCES instructors(id);

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS section_id INTEGER;

ALTER TABLE reviews
  ADD CONSTRAINT fk_reviews_section
  FOREIGN KEY (section_id) REFERENCES sections(id);

DROP INDEX IF EXISTS reviews_user_course_unique;
DROP INDEX IF EXISTS reviews_user_section_unique;
CREATE UNIQUE INDEX IF NOT EXISTS reviews_user_section_unique
  ON reviews (user_id, section_id);

CREATE INDEX IF NOT EXISTS idx_reviews_instructor
  ON reviews (instructor_id);

CREATE INDEX IF NOT EXISTS idx_reviews_section
  ON reviews (section_id);

-- ============================================================
-- 6c. CREATE course_instructor_ratings TABLE (aggregate cache)
-- ============================================================
CREATE TABLE IF NOT EXISTS course_instructor_ratings (
  course_id INTEGER NOT NULL REFERENCES courses(id),
  instructor_id INTEGER NOT NULL REFERENCES instructors(id),
  avg_quality NUMERIC(3,2),
  avg_difficulty NUMERIC(3,2),
  avg_workload NUMERIC(3,2),
  review_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (course_id, instructor_id)
);

-- ============================================================
-- 6d. CREATE section_ratings TABLE (aggregate cache)
-- ============================================================
CREATE TABLE IF NOT EXISTS section_ratings (
  section_id INTEGER PRIMARY KEY REFERENCES sections(id),
  avg_quality NUMERIC(3,2),
  avg_difficulty NUMERIC(3,2),
  avg_workload NUMERIC(3,2),
  review_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6e. CREATE instructor_ratings TABLE (aggregate cache across all courses)
-- ============================================================
CREATE TABLE IF NOT EXISTS instructor_ratings (
  instructor_id INTEGER PRIMARY KEY REFERENCES instructors(id),
  avg_quality NUMERIC(3,2),
  review_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 7. ALTER course_lists — semester text → term_code FK
-- ============================================================
ALTER TABLE course_lists
  ADD COLUMN IF NOT EXISTS term_code VARCHAR(10);

UPDATE course_lists SET term_code = '5249' WHERE semester = 'Fall 2024';
UPDATE course_lists SET term_code = '5251' WHERE semester = 'Spring 2025';
UPDATE course_lists SET term_code = '5259' WHERE semester = 'Fall 2025';
UPDATE course_lists SET term_code = '5261' WHERE semester = 'Spring 2026';
UPDATE course_lists SET term_code = '5261' WHERE term_code IS NULL;

ALTER TABLE course_lists
  ALTER COLUMN term_code SET NOT NULL;

ALTER TABLE course_lists
  ADD CONSTRAINT fk_course_lists_term
  FOREIGN KEY (term_code) REFERENCES terms(srcdb);

ALTER TABLE course_lists DROP COLUMN IF EXISTS semester;

-- ============================================================
-- 8. DROP old indexes that reference removed columns
-- ============================================================
DROP INDEX IF EXISTS idx_sections_semester;

-- ============================================================
-- 9. ALTER users — add username (for @handle identity)
-- ============================================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS username VARCHAR(30);

-- Backfill missing usernames from email prefix.
UPDATE users
SET username = LEFT(
  LOWER(REGEXP_REPLACE(SPLIT_PART(email, '@', 1), '[^a-zA-Z0-9_]+', '_', 'g')),
  30
)
WHERE (username IS NULL OR username = '')
  AND email IS NOT NULL
  AND email <> '';

-- Resolve duplicates by appending _<n>.
WITH ranked AS (
  SELECT
    id,
    username,
    ROW_NUMBER() OVER (PARTITION BY username ORDER BY created_at NULLS LAST, id) AS rn
  FROM users
  WHERE username IS NOT NULL
)
UPDATE users u
SET username = LEFT(r.username || '_' || (r.rn - 1)::text, 30)
FROM ranked r
WHERE u.id = r.id
  AND r.rn > 1;

-- Enforce uniqueness.
ALTER TABLE users
  ALTER COLUMN username SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique
  ON users (username);

-- ============================================================
-- 10. ALTER sections — add per-section registration restrictions
-- ============================================================
ALTER TABLE sections
  ADD COLUMN IF NOT EXISTS registration_restrictions TEXT;

-- ============================================================
-- 11. ALTER users - admin flags + deactivation + activity tracking
-- ============================================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS disabled_reason TEXT,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_is_admin
  ON users (is_admin);

CREATE INDEX IF NOT EXISTS idx_users_is_disabled
  ON users (is_disabled);

CREATE INDEX IF NOT EXISTS idx_users_last_seen_at
  ON users (last_seen_at);

-- ============================================================
-- 12. CREATE admin tables (jobs, logs, presets, diagnostics)
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_job_runs (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'queued',
  requested_by UUID NULL REFERENCES users(id),
  params JSONB,
  stats JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_admin_job_runs_type
  ON admin_job_runs (type);

CREATE INDEX IF NOT EXISTS idx_admin_job_runs_status
  ON admin_job_runs (status);

CREATE INDEX IF NOT EXISTS idx_admin_job_runs_created_at
  ON admin_job_runs (created_at);

CREATE TABLE IF NOT EXISTS admin_job_logs (
  id SERIAL PRIMARY KEY,
  run_id INTEGER NOT NULL REFERENCES admin_job_runs(id) ON DELETE CASCADE,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  level VARCHAR(10) NOT NULL DEFAULT 'info',
  message TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_job_logs_run_id
  ON admin_job_logs (run_id);

CREATE INDEX IF NOT EXISTS idx_admin_job_logs_run_id_id
  ON admin_job_logs (run_id, id);

CREATE TABLE IF NOT EXISTS admin_sync_presets (
  id SERIAL PRIMARY KEY,
  kind VARCHAR(50) NOT NULL,
  name TEXT NOT NULL,
  params JSONB NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID NULL REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_admin_sync_presets_kind
  ON admin_sync_presets (kind);

CREATE INDEX IF NOT EXISTS idx_admin_sync_presets_active
  ON admin_sync_presets (is_active);

CREATE TABLE IF NOT EXISTS admin_app_errors (
  id SERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  method VARCHAR(10),
  path TEXT,
  status INTEGER,
  message TEXT,
  stack TEXT,
  user_id UUID NULL REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_admin_app_errors_ts
  ON admin_app_errors (ts);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id SERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_id UUID NULL REFERENCES users(id),
  action VARCHAR(50) NOT NULL,
  target TEXT,
  meta JSONB
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_ts
  ON admin_audit_log (ts);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action
  ON admin_audit_log (action);

-- ============================================================
-- 12b. CREATE admin course sync schedule table
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_course_sync_schedule (
  id SERIAL PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT false,
  hour SMALLINT NOT NULL DEFAULT 3,
  minute SMALLINT NOT NULL DEFAULT 0,
  timezone VARCHAR(64) NOT NULL DEFAULT 'America/New_York',
  term_code VARCHAR(10),
  updated_by UUID NULL REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_course_sync_schedule_updated_at
  ON admin_course_sync_schedule (updated_at);

-- ============================================================
-- 13. Enable pgvector + course embeddings for AI retrieval
-- ============================================================

-- Supabase ships pgvector; this enables semantic (meaning-based) search.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS course_embeddings (
  course_id INTEGER PRIMARY KEY REFERENCES courses(id) ON DELETE CASCADE,
  content_hash VARCHAR(64) NOT NULL,
  embedding vector(1536) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_course_embeddings_updated_at
  ON course_embeddings (updated_at);

-- Cosine distance index (works well with OpenAI embeddings).
CREATE INDEX IF NOT EXISTS idx_course_embeddings_embedding_ivfflat
  ON course_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ============================================================
-- 14. CREATE feedback reports table
-- ============================================================
CREATE TABLE IF NOT EXISTS feedback_reports (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  category VARCHAR(40) NOT NULL,
  message TEXT NOT NULL,
  course_id INTEGER REFERENCES courses(id),
  section_id INTEGER REFERENCES sections(id),
  page_path TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_reports_user
  ON feedback_reports (user_id);

CREATE INDEX IF NOT EXISTS idx_feedback_reports_category
  ON feedback_reports (category);

CREATE INDEX IF NOT EXISTS idx_feedback_reports_status
  ON feedback_reports (status);

CREATE INDEX IF NOT EXISTS idx_feedback_reports_created_at
  ON feedback_reports (created_at);

-- ============================================================
-- 15. ALTER users - beta invite + onboarding progress
-- ============================================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS invite_code VARCHAR(64),
  ADD COLUMN IF NOT EXISTS has_completed_onboarding BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE users
  ALTER COLUMN has_completed_onboarding SET DEFAULT false;

UPDATE users
SET has_completed_onboarding = false
WHERE has_completed_onboarding IS NULL;

ALTER TABLE users
  ALTER COLUMN has_completed_onboarding SET NOT NULL;

-- ============================================================
-- 16. CREATE badges + invite code tables
-- ============================================================
CREATE TABLE IF NOT EXISTS badges (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(50) NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'STAR',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_badges_slug_unique
  ON badges (slug);

ALTER TABLE badges
  ADD COLUMN IF NOT EXISTS icon TEXT;

UPDATE badges
SET description = COALESCE(description, '')
WHERE description IS NULL;

ALTER TABLE badges
  ALTER COLUMN description SET NOT NULL;

UPDATE badges
SET icon = 'STAR'
WHERE icon IS NULL;

ALTER TABLE badges
  ALTER COLUMN icon SET NOT NULL;

CREATE TABLE IF NOT EXISTS user_badges (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id INTEGER NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  awarded_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_badges
  ADD COLUMN IF NOT EXISTS awarded_at TIMESTAMPTZ DEFAULT NOW();

UPDATE user_badges
SET awarded_at = COALESCE(awarded_at, NOW())
WHERE awarded_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_badges_user_badge_unique
  ON user_badges (user_id, badge_id);

CREATE INDEX IF NOT EXISTS idx_user_badges_user
  ON user_badges (user_id);

CREATE INDEX IF NOT EXISTS idx_user_badges_badge
  ON user_badges (badge_id);

CREATE TABLE IF NOT EXISTS invite_codes (
  id SERIAL PRIMARY KEY,
  code VARCHAR(64) NOT NULL,
  badge_slug VARCHAR(50) NOT NULL,
  max_uses INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invite_codes_code_unique
  ON invite_codes (code);

CREATE INDEX IF NOT EXISTS idx_invite_codes_badge_slug
  ON invite_codes (badge_slug);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_invite_codes_badge_slug'
      AND conrelid = 'invite_codes'::regclass
  ) THEN
    ALTER TABLE invite_codes
      ADD CONSTRAINT fk_invite_codes_badge_slug
      FOREIGN KEY (badge_slug) REFERENCES badges(slug);
  END IF;
END $$;

-- ============================================================
-- 17. CREATE ai_trainer_ratings + ai_trainer_scores tables
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_trainer_ratings (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  course_id INTEGER NOT NULL REFERENCES courses(id),
  rating SMALLINT NOT NULL,  -- +1 liked, -1 disliked
  context JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_trainer_ratings_user_course_unique
  ON ai_trainer_ratings (user_id, course_id);

CREATE INDEX IF NOT EXISTS idx_ai_trainer_ratings_course
  ON ai_trainer_ratings (course_id);

CREATE INDEX IF NOT EXISTS idx_ai_trainer_ratings_user
  ON ai_trainer_ratings (user_id);

CREATE TABLE IF NOT EXISTS ai_trainer_scores (
  course_id INTEGER PRIMARY KEY REFERENCES courses(id),
  up_count INTEGER DEFAULT 0,
  down_count INTEGER DEFAULT 0,
  total_count INTEGER DEFAULT 0,
  score NUMERIC(5,4),  -- smoothed: (up - down) / (total + 5)
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMIT;
