\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE tmp_manual_merge (source_id int, target_id int);
INSERT INTO tmp_manual_merge (source_id, target_id) VALUES (2121, 3581);

WITH moved AS (
  UPDATE sections s
  SET instructor_id = m.target_id
  FROM tmp_manual_merge m
  WHERE s.instructor_id = m.source_id
  RETURNING s.id
)
SELECT 'sections_updated' AS step, count(*) AS count FROM moved;

WITH removed AS (
  DELETE FROM section_instructors si
  USING tmp_manual_merge m,
        section_instructors existing
  WHERE si.instructor_id = m.source_id
    AND existing.section_id = si.section_id
    AND existing.instructor_id = m.target_id
  RETURNING si.id
)
SELECT 'section_instructors_removed_conflicts' AS step, count(*) AS count FROM removed;

WITH moved AS (
  UPDATE section_instructors si
  SET instructor_id = m.target_id,
      updated_at = now()
  FROM tmp_manual_merge m
  WHERE si.instructor_id = m.source_id
  RETURNING si.id
)
SELECT 'section_instructors_updated' AS step, count(*) AS count FROM moved;

WITH moved AS (
  UPDATE reviews r
  SET instructor_id = m.target_id
  FROM tmp_manual_merge m
  WHERE r.instructor_id = m.source_id
  RETURNING r.id
)
SELECT 'reviews_updated' AS step, count(*) AS count FROM moved;

WITH removed AS (
  DELETE FROM rmp_professors rp
  USING tmp_manual_merge m,
        rmp_professors existing
  WHERE rp.instructor_id = m.source_id
    AND existing.instructor_id = m.target_id
  RETURNING rp.instructor_id
)
SELECT 'rmp_prof_removed_conflicts' AS step, count(*) AS count FROM removed;

WITH moved AS (
  UPDATE rmp_professors rp
  SET instructor_id = m.target_id,
      imported_at = now()
  FROM tmp_manual_merge m
  WHERE rp.instructor_id = m.source_id
  RETURNING rp.instructor_id
)
SELECT 'rmp_prof_updated' AS step, count(*) AS count FROM moved;

WITH removed AS (
  DELETE FROM rmp_professor_tags rt
  USING tmp_manual_merge m,
        rmp_professor_tags existing
  WHERE rt.instructor_id = m.source_id
    AND existing.instructor_id = m.target_id
    AND existing.tag = rt.tag
  RETURNING rt.id
)
SELECT 'rmp_tags_removed_conflicts' AS step, count(*) AS count FROM removed;

WITH moved AS (
  UPDATE rmp_professor_tags rt
  SET instructor_id = m.target_id
  FROM tmp_manual_merge m
  WHERE rt.instructor_id = m.source_id
  RETURNING rt.id
)
SELECT 'rmp_tags_updated' AS step, count(*) AS count FROM moved;

WITH affected AS (
  SELECT source_id AS instructor_id FROM tmp_manual_merge
  UNION
  SELECT target_id AS instructor_id FROM tmp_manual_merge
),
removed AS (
  DELETE FROM course_instructor_ratings cir
  USING affected a
  WHERE cir.instructor_id = a.instructor_id
  RETURNING cir.course_id
)
SELECT 'course_instructor_ratings_deleted' AS step, count(*) AS count FROM removed;

WITH affected AS (
  SELECT source_id AS instructor_id FROM tmp_manual_merge
  UNION
  SELECT target_id AS instructor_id FROM tmp_manual_merge
),
removed AS (
  DELETE FROM instructor_ratings ir
  USING affected a
  WHERE ir.instructor_id = a.instructor_id
  RETURNING ir.instructor_id
)
SELECT 'instructor_ratings_deleted' AS step, count(*) AS count FROM removed;

WITH deleted AS (
  DELETE FROM instructors i
  USING tmp_manual_merge m
  WHERE i.id = m.source_id
  RETURNING i.id
)
SELECT 'instructors_deleted' AS step, count(*) AS count FROM deleted;

COMMIT;

INSERT INTO course_instructor_ratings (course_id, instructor_id, avg_quality, avg_difficulty, avg_workload, review_count, updated_at)
SELECT
  r.course_id,
  r.instructor_id,
  ROUND(AVG(r.rating_quality), 2),
  ROUND(AVG(r.rating_difficulty), 2),
  ROUND(AVG(r.rating_workload), 2),
  COUNT(*)::int,
  NOW()
FROM reviews r
WHERE r.instructor_id IS NOT NULL
GROUP BY r.course_id, r.instructor_id
ON CONFLICT (course_id, instructor_id) DO UPDATE SET
  avg_quality    = EXCLUDED.avg_quality,
  avg_difficulty = EXCLUDED.avg_difficulty,
  avg_workload   = EXCLUDED.avg_workload,
  review_count   = EXCLUDED.review_count,
  updated_at     = NOW();

DELETE FROM course_instructor_ratings cir
WHERE NOT EXISTS (
  SELECT 1
  FROM reviews r
  WHERE r.course_id = cir.course_id
    AND r.instructor_id = cir.instructor_id
);

INSERT INTO instructor_ratings (instructor_id, avg_quality, review_count, updated_at)
SELECT
  r.instructor_id,
  ROUND(AVG(r.rating_quality), 2),
  COUNT(*)::int,
  NOW()
FROM reviews r
WHERE r.instructor_id IS NOT NULL
GROUP BY r.instructor_id
ON CONFLICT (instructor_id) DO UPDATE SET
  avg_quality  = EXCLUDED.avg_quality,
  review_count = EXCLUDED.review_count,
  updated_at   = NOW();

DELETE FROM instructor_ratings ir
WHERE NOT EXISTS (
  SELECT 1
  FROM reviews r
  WHERE r.instructor_id = ir.instructor_id
);
