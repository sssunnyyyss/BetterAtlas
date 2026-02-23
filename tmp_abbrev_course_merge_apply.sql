\set ON_ERROR_STOP on

BEGIN;

DROP TABLE IF EXISTS tmp_alias_course_merge;
CREATE TEMP TABLE tmp_alias_course_merge AS
WITH src AS (
  SELECT
    i.id,
    i.name,
    lower(regexp_replace(split_part(i.name, ' ', 1), '[^A-Za-z]', '', 'g')) AS src_first,
    lower(regexp_replace(reverse(split_part(reverse(i.name), ' ', 1)), '[^A-Za-z]', '', 'g')) AS src_last
  FROM instructors i
  WHERE (
    split_part(i.name, ' ', 1) ~ '^[A-Za-z]\.?$'
    OR split_part(i.name, ' ', 1) ~ '^[A-Z]{2,4}$'
    OR split_part(i.name, ' ', 1) ~ '^(?:[A-Za-z]\.){2,4}$'
  )
),
tgt AS (
  SELECT
    i.id,
    i.name,
    i.department_id,
    lower(regexp_replace(split_part(i.name, ' ', 1), '[^A-Za-z]', '', 'g')) AS tgt_first,
    lower(regexp_replace(reverse(split_part(reverse(i.name), ' ', 1)), '[^A-Za-z]', '', 'g')) AS tgt_last
  FROM instructors i
  WHERE NOT (
    split_part(i.name, ' ', 1) ~ '^[A-Za-z]\.?$'
    OR split_part(i.name, ' ', 1) ~ '^[A-Z]{2,4}$'
    OR split_part(i.name, ' ', 1) ~ '^(?:[A-Za-z]\.){2,4}$'
  )
  AND lower(regexp_replace(split_part(i.name, ' ', 1), '[^A-Za-z]', '', 'g')) NOT IN ('fnu', 'lnu', 'tba', 'staff')
),
teach AS (
  SELECT DISTINCT
    s.instructor_id,
    upper(regexp_replace(c.code, '[^A-Za-z0-9]', '', 'g')) AS course_key,
    c.department_id
  FROM sections s
  JOIN courses c ON c.id = s.course_id
  WHERE s.instructor_id IS NOT NULL
  UNION
  SELECT DISTINCT
    si.instructor_id,
    upper(regexp_replace(c.code, '[^A-Za-z0-9]', '', 'g')) AS course_key,
    c.department_id
  FROM section_instructors si
  JOIN sections s ON s.id = si.section_id
  JOIN courses c ON c.id = s.course_id
),
cand AS (
  SELECT
    s.id AS source_id,
    s.name AS source_name,
    t.id AS target_id,
    t.name AS target_name,
    count(DISTINCT st.course_key) FILTER (WHERE tt.course_key IS NOT NULL) AS shared_course_count,
    bool_or(sd.department_id = t.department_id) AS dept_match_assigned,
    bool_or(td.department_id IS NOT NULL) AS dept_match_taught
  FROM src s
  JOIN tgt t
    ON t.tgt_last = s.src_last
   AND left(t.tgt_first, 1) = left(s.src_first, 1)
   AND t.id <> s.id
  LEFT JOIN teach st ON st.instructor_id = s.id
  LEFT JOIN teach tt
    ON tt.instructor_id = t.id
   AND tt.course_key = st.course_key
  LEFT JOIN teach sd
    ON sd.instructor_id = s.id
   AND sd.department_id IS NOT NULL
  LEFT JOIN teach td
    ON td.instructor_id = t.id
   AND td.department_id = sd.department_id
  GROUP BY s.id, s.name, t.id, t.name, t.department_id
),
scored AS (
  SELECT
    c.*,
    (c.dept_match_assigned OR c.dept_match_taught) AS dept_match,
    count(*) OVER (PARTITION BY c.source_id) AS candidate_count,
    max(c.shared_course_count) OVER (PARTITION BY c.source_id) AS max_shared
  FROM cand c
),
ranked AS (
  SELECT
    s.*,
    count(*) FILTER (WHERE s.shared_course_count = s.max_shared) OVER (PARTITION BY s.source_id) AS top_shared_ties,
    count(*) FILTER (WHERE s.dept_match) OVER (PARTITION BY s.source_id) AS dept_candidate_count
  FROM scored s
),
chosen AS (
  SELECT
    source_id,
    source_name,
    CASE
      WHEN max_shared > 0 AND top_shared_ties = 1 THEN (
        SELECT r2.target_id
        FROM ranked r2
        WHERE r2.source_id = r.source_id
          AND r2.shared_course_count = r.max_shared
        ORDER BY r2.target_id
        LIMIT 1
      )
      WHEN dept_candidate_count = 1 THEN (
        SELECT r2.target_id
        FROM ranked r2
        WHERE r2.source_id = r.source_id
          AND r2.dept_match
        ORDER BY r2.target_id
        LIMIT 1
      )
      WHEN candidate_count = 1 THEN (
        SELECT r2.target_id
        FROM ranked r2
        WHERE r2.source_id = r.source_id
        ORDER BY r2.target_id
        LIMIT 1
      )
      ELSE NULL
    END AS target_id
  FROM ranked r
  GROUP BY source_id, source_name, max_shared, top_shared_ties, dept_candidate_count, candidate_count
)
SELECT
  c.source_id,
  c.source_name,
  c.target_id,
  t.name AS target_name
FROM chosen c
JOIN instructors t ON t.id = c.target_id
WHERE c.target_id IS NOT NULL;

SELECT 'merge_candidates' AS step, count(*) AS count FROM tmp_alias_course_merge;

WITH moved AS (
  UPDATE sections s
  SET instructor_id = m.target_id
  FROM tmp_alias_course_merge m
  WHERE s.instructor_id = m.source_id
  RETURNING s.id
)
SELECT 'sections_updated' AS step, count(*) AS count FROM moved;

WITH removed AS (
  DELETE FROM section_instructors si
  USING tmp_alias_course_merge m,
        section_instructors existing
  WHERE si.instructor_id = m.source_id
    AND existing.section_id = si.section_id
    AND existing.instructor_id = m.target_id
  RETURNING si.id
)
SELECT 'section_instructors_removed_existing_target' AS step, count(*) AS count FROM removed;

WITH removed AS (
  DELETE FROM section_instructors si
  USING tmp_alias_course_merge m1,
        tmp_alias_course_merge m2,
        section_instructors keeper
  WHERE si.instructor_id = m2.source_id
    AND keeper.section_id = si.section_id
    AND keeper.instructor_id = m1.source_id
    AND m1.target_id = m2.target_id
    AND keeper.id < si.id
  RETURNING si.id
)
SELECT 'section_instructors_removed_source_dupes' AS step, count(*) AS count FROM removed;

WITH moved AS (
  UPDATE section_instructors si
  SET instructor_id = m.target_id,
      updated_at = now()
  FROM tmp_alias_course_merge m
  WHERE si.instructor_id = m.source_id
  RETURNING si.id
)
SELECT 'section_instructors_updated' AS step, count(*) AS count FROM moved;

WITH moved AS (
  UPDATE reviews r
  SET instructor_id = m.target_id
  FROM tmp_alias_course_merge m
  WHERE r.instructor_id = m.source_id
  RETURNING r.id
)
SELECT 'reviews_updated' AS step, count(*) AS count FROM moved;

WITH removed AS (
  DELETE FROM rmp_professors rp
  USING tmp_alias_course_merge m,
        rmp_professors existing
  WHERE rp.instructor_id = m.source_id
    AND existing.instructor_id = m.target_id
  RETURNING rp.instructor_id
)
SELECT 'rmp_professors_removed_conflicts' AS step, count(*) AS count FROM removed;

WITH moved AS (
  UPDATE rmp_professors rp
  SET instructor_id = m.target_id,
      imported_at = now()
  FROM tmp_alias_course_merge m
  WHERE rp.instructor_id = m.source_id
  RETURNING rp.instructor_id
)
SELECT 'rmp_professors_updated' AS step, count(*) AS count FROM moved;

WITH removed AS (
  DELETE FROM rmp_professor_tags rt
  USING tmp_alias_course_merge m,
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
  FROM tmp_alias_course_merge m
  WHERE rt.instructor_id = m.source_id
  RETURNING rt.id
)
SELECT 'rmp_tags_updated' AS step, count(*) AS count FROM moved;

WITH affected AS (
  SELECT source_id AS instructor_id FROM tmp_alias_course_merge
  UNION
  SELECT target_id AS instructor_id FROM tmp_alias_course_merge
),
removed AS (
  DELETE FROM course_instructor_ratings cir
  USING affected a
  WHERE cir.instructor_id = a.instructor_id
  RETURNING cir.course_id
)
SELECT 'course_instructor_ratings_deleted' AS step, count(*) AS count FROM removed;

WITH affected AS (
  SELECT source_id AS instructor_id FROM tmp_alias_course_merge
  UNION
  SELECT target_id AS instructor_id FROM tmp_alias_course_merge
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
  USING tmp_alias_course_merge m
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
