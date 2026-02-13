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

COMMIT;
