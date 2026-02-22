BEGIN;

-- Make workload nullable for RMP imports (RMP has no workload dimension)
ALTER TABLE reviews ALTER COLUMN rating_workload DROP NOT NULL;

-- Add source flag to distinguish native vs imported reviews
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS source VARCHAR(10) NOT NULL DEFAULT 'native';

-- Add external ID for idempotent imports
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS external_id VARCHAR(40);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_external_id
  ON reviews(external_id) WHERE external_id IS NOT NULL;

-- Per-review RMP metadata
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS reported_grade VARCHAR(12),
  ADD COLUMN IF NOT EXISTS grade_points NUMERIC(3,2);

-- Keep one native review per user per section, but allow many imported RMP reviews.
DROP INDEX IF EXISTS reviews_user_section_unique;
CREATE UNIQUE INDEX IF NOT EXISTS reviews_user_section_unique
  ON reviews (user_id, section_id)
  WHERE source = 'native' AND section_id IS NOT NULL;

-- Support half-point ratings (1.0..5.0 in 0.5 increments)
ALTER TABLE reviews
  ALTER COLUMN rating_quality TYPE NUMERIC(2,1)
    USING rating_quality::numeric(2,1),
  ALTER COLUMN rating_difficulty TYPE NUMERIC(2,1)
    USING rating_difficulty::numeric(2,1),
  ALTER COLUMN rating_workload TYPE NUMERIC(2,1)
    USING rating_workload::numeric(2,1);

ALTER TABLE reviews
  DROP CONSTRAINT IF EXISTS chk_reviews_rating_quality_half_step,
  DROP CONSTRAINT IF EXISTS chk_reviews_rating_difficulty_half_step,
  DROP CONSTRAINT IF EXISTS chk_reviews_rating_workload_half_step;

ALTER TABLE reviews
  ADD CONSTRAINT chk_reviews_rating_quality_half_step
    CHECK (
      rating_quality >= 1
      AND rating_quality <= 5
      AND mod(rating_quality * 2, 1) = 0
    ),
  ADD CONSTRAINT chk_reviews_rating_difficulty_half_step
    CHECK (
      rating_difficulty >= 1
      AND rating_difficulty <= 5
      AND mod(rating_difficulty * 2, 1) = 0
    ),
  ADD CONSTRAINT chk_reviews_rating_workload_half_step
    CHECK (
      rating_workload IS NULL
      OR (
        rating_workload >= 1
        AND rating_workload <= 5
        AND mod(rating_workload * 2, 1) = 0
      )
    );

COMMIT;
