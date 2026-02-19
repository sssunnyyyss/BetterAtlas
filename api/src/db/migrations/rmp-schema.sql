BEGIN;

-- Make workload nullable for RMP imports (RMP has no workload dimension)
ALTER TABLE reviews ALTER COLUMN rating_workload DROP NOT NULL;

-- Add source flag to distinguish native vs imported reviews
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS source VARCHAR(10) NOT NULL DEFAULT 'native';

-- Add external ID for idempotent imports
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS external_id VARCHAR(40);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_external_id
  ON reviews(external_id) WHERE external_id IS NOT NULL;

COMMIT;
