# RateMyProfessor Data Import - Design

## Goal

Seed BetterAtlas's review system with RateMyProfessor data so courses and professors have ratings from day one. Imported reviews are stored in the existing `reviews` table, marked with `source = 'rmp'` and attributed to a system user. RMP-specific metadata (tags, would-take-again %) is stored in dedicated tables.

## Approach

Use the `rate-my-professor-api-ts` npm package to query RMP's GraphQL API. Build a one-time CLI seed script that fetches all Emory professors, matches them to existing instructors, imports their reviews, and refreshes aggregate caches.

## Schema Changes

### Modify `reviews` table

Add a `source` column to distinguish imported from native reviews:

```sql
ALTER TABLE reviews ADD COLUMN source VARCHAR(10) NOT NULL DEFAULT 'native';
-- Values: 'native' (user-created), 'rmp' (imported from RateMyProfessor)
```

Add a unique constraint for idempotent RMP imports:

```sql
ALTER TABLE reviews ADD COLUMN external_id VARCHAR(40);
CREATE UNIQUE INDEX idx_reviews_external_id ON reviews(external_id) WHERE external_id IS NOT NULL;
```

### New table: `rmp_professors`

Maps BetterAtlas instructors to RMP teacher IDs and stores RMP-specific aggregate data.

```sql
CREATE TABLE rmp_professors (
  instructor_id   INT PRIMARY KEY REFERENCES instructors(id),
  rmp_teacher_id  VARCHAR(20) NOT NULL,
  rmp_avg_rating  NUMERIC(3,2),
  rmp_avg_difficulty NUMERIC(3,2),
  rmp_num_ratings INT,
  rmp_would_take_again NUMERIC(5,2),  -- percentage
  rmp_department  TEXT,
  imported_at     TIMESTAMPTZ DEFAULT NOW()
);
```

### New table: `rmp_professor_tags`

Stores RMP community tags per instructor (e.g., "tough grader", "lots of homework").

```sql
CREATE TABLE rmp_professor_tags (
  id SERIAL PRIMARY KEY,
  instructor_id INT REFERENCES instructors(id),
  tag TEXT NOT NULL,
  count INT DEFAULT 1,
  UNIQUE(instructor_id, tag)
);
```

### System user

Create a well-known system user for RMP review attribution:

- UUID: deterministic (e.g., `00000000-0000-0000-0000-000000000001`)
- Username: `rmp-import`
- Email: `system+rmp@betteratlas.app`
- Display name: `RateMyProfessor Import`

## Professor Matching

Match RMP professors to the existing `instructors` table:

1. **Exact match** - Normalize names (lowercase, trim, collapse whitespace). Match `"firstname lastname"` against `instructors.name`.
2. **Fuzzy match** - For non-exact matches, use token-based similarity with ~85% threshold. Levenshtein distance or similar.
3. **Department cross-check** - If multiple fuzzy matches, prefer the one whose department matches the RMP department.
4. **Unmatched** - Log for manual review. Do not create new instructor records.

## Course Matching

RMP reviews reference a course name but not a code:

1. Try to match RMP course name to `courses.title` (case-insensitive).
2. If ambiguous, use instructor's `departmentId` to narrow.
3. If no match, insert review at instructor level only (link to instructor's most-taught course or skip `courseId`).

## Rating Scale Mapping

| RMP Field | BetterAtlas Field | Notes |
|-----------|------------------|-------|
| quality (1-5) | ratingQuality (1-5) | Direct mapping, round to nearest int |
| difficulty (1-5) | ratingDifficulty (1-5) | Direct mapping, round to nearest int |
| N/A | ratingWorkload | Set to null (excluded from aggregates) |

Workload is left null. Aggregate cache functions already handle null values correctly.

## Seed Script (`api/src/jobs/rmpSeed.ts`)

### Flow

1. **Initialize** - Create/find the `rmp-import` system user
2. **Fetch school** - Look up "Emory University" on RMP to get school ID
3. **Fetch professors** - Get all Emory professors from RMP
4. **Match** - Fuzzy-match each to `instructors` table
5. **Store linkage** - Insert into `rmp_professors`
6. **Fetch reviews** - For each matched professor, get all RMP reviews
7. **Insert reviews** - Into `reviews` table with `source = 'rmp'`, `isAnonymous = true`
8. **Store tags** - Insert RMP tags into `rmp_professor_tags`
9. **Refresh caches** - Run all aggregate refresh functions
10. **Report** - Log match rate, import counts, unmatched professors

### Rate Limiting

- 200-500ms delay between API calls
- Retry with exponential backoff on 429/5xx
- Save progress to checkpoint JSON file for resume on failure

### Idempotency

- Check `rmp_professors` before re-importing a professor
- Use `external_id` (RMP review ID) unique index to skip duplicate reviews
- Safe to re-run

## Frontend Changes

1. **RMP badge** - Show "RateMyProfessor" label on review cards where `source === 'rmp'`
2. **Tags display** - Show RMP tags as pills on instructor detail pages
3. **Would-take-again %** - Display on instructor page from `rmp_professors`
4. **Source filter** - Let users filter reviews by source (all / native / RMP)

## Dependencies

- `rate-my-professor-api-ts` - npm package for RMP GraphQL API
- String similarity library (e.g., `string-similarity` or `fastest-levenshtein`) for fuzzy matching

## Risks

- RMP may rate-limit or block scraping. Mitigated by delays and retries.
- RMP GraphQL API is unofficial and may change. The npm package may need updates.
- Name matching will have false positives/negatives. Manual review log helps catch these.
- RMP reviews don't have a workload dimension - aggregate workload scores will only reflect native reviews.
