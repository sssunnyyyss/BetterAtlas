\set ON_ERROR_STOP on

BEGIN;

DROP TABLE IF EXISTS tmp_alias_review_merge;

CREATE TEMP TABLE tmp_alias_review_merge AS
WITH src AS (
  SELECT
    i.id AS source_id,
    i.name AS source_name,
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
    i.id AS target_id,
    i.name AS target_name,
    i.department_id AS target_department_id,
    lower(regexp_replace(split_part(i.name, ' ', 1), '[^A-Za-z]', '', 'g')) AS tgt_first,
    lower(regexp_replace(reverse(split_part(reverse(i.name), ' ', 1)), '[^A-Za-z]', '', 'g')) AS tgt_last
  FROM instructors i
  WHERE NOT (
    split_part(i.name, ' ', 1) ~ '^[A-Za-z]\.?$'
    OR split_part(i.name, ' ', 1) ~ '^[A-Z]{2,4}$'
    OR split_part(i.name, ' ', 1) ~ '^(?:[A-Za-z]\.){2,4}$'
  )
),
pairs AS (
  SELECT
    s.source_id,
    s.source_name,
    t.target_id,
    t.target_name,
    t.target_department_id
  FROM src s
  JOIN tgt t
    ON t.tgt_last = s.src_last
   AND left(t.tgt_first, 1) = left(s.src_first, 1)
   AND t.target_id <> s.source_id
),
teach AS (
  SELECT DISTINCT
    s.instructor_id,
    s.course_id,
    s.term_code,
    c.department_id
  FROM sections s
  JOIN courses c ON c.id = s.course_id
  WHERE s.instructor_id IS NOT NULL
  UNION
  SELECT DISTINCT
    si.instructor_id,
    s.course_id,
    s.term_code,
    c.department_id
  FROM section_instructors si
  JOIN sections s ON s.id = si.section_id
  JOIN courses c ON c.id = s.course_id
),
source_teach AS (
  SELECT instructor_id AS source_id, course_id, term_code, department_id
  FROM teach
),
target_teach AS (
  SELECT instructor_id AS target_id, course_id, term_code, department_id
  FROM teach
),
source_reviews AS (
  SELECT
    r.id AS review_id,
    r.instructor_id AS source_id,
    r.course_id,
    r.term_code
  FROM reviews r
  WHERE r.instructor_id IS NOT NULL
),
pair_scores AS (
  SELECT
    p.source_id,
    p.source_name,
    p.target_id,
    p.target_name,
    count(DISTINCT sr.review_id) FILTER (
      WHERE EXISTS (
        SELECT 1
        FROM target_teach tt
        WHERE tt.target_id = p.target_id
          AND tt.course_id = sr.course_id
      )
    ) AS review_course_hits,
    count(DISTINCT sr.review_id) FILTER (
      WHERE sr.term_code IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM target_teach tt
          WHERE tt.target_id = p.target_id
            AND tt.course_id = sr.course_id
            AND tt.term_code = sr.term_code
        )
    ) AS review_term_hits,
    count(DISTINCT st.course_id) FILTER (
      WHERE EXISTS (
        SELECT 1
        FROM target_teach tt
        WHERE tt.target_id = p.target_id
          AND tt.course_id = st.course_id
      )
    ) AS section_course_hits,
    count(DISTINCT (st.course_id::text || '|' || coalesce(st.term_code, ''))) FILTER (
      WHERE EXISTS (
        SELECT 1
        FROM target_teach tt
        WHERE tt.target_id = p.target_id
          AND tt.course_id = st.course_id
          AND tt.term_code = st.term_code
      )
    ) AS section_term_hits,
    bool_or(st.department_id = p.target_department_id) AS department_signal
  FROM pairs p
  LEFT JOIN source_reviews sr ON sr.source_id = p.source_id
  LEFT JOIN source_teach st ON st.source_id = p.source_id
  GROUP BY p.source_id, p.source_name, p.target_id, p.target_name
),
scored AS (
  SELECT
    ps.*,
    (
      ps.review_term_hits * 10
      + ps.review_course_hits * 6
      + ps.section_term_hits * 3
      + ps.section_course_hits * 1
      + CASE WHEN ps.department_signal THEN 1 ELSE 0 END
    ) AS score
  FROM pair_scores ps
),
rank_base AS (
  SELECT
    s.*,
    max(s.score) OVER (PARTITION BY s.source_id) AS max_score,
    row_number() OVER (PARTITION BY s.source_id ORDER BY s.score DESC, s.target_id ASC) AS rn
  FROM scored s
),
ranked AS (
  SELECT
    rb.*,
    count(*) FILTER (WHERE rb.score = rb.max_score) OVER (PARTITION BY rb.source_id) AS max_score_ties
  FROM rank_base rb
)
SELECT
  source_id,
  source_name,
  target_id,
  target_name,
  score
FROM ranked
WHERE rn = 1
  AND max_score > 0
  AND max_score_ties = 1;

SELECT 'merge_candidates' AS step, count(*) AS count FROM tmp_alias_review_merge;

WITH moved AS (
  UPDATE sections s
  SET instructor_id = m.target_id
  FROM tmp_alias_review_merge m
  WHERE s.instructor_id = m.source_id
  RETURNING s.id
)
SELECT 'sections_updated' AS step, count(*) AS count FROM moved;

WITH removed AS (
  DELETE FROM section_instructors si
  USING tmp_alias_review_merge m,
        section_instructors existing
  WHERE si.instructor_id = m.source_id
    AND existing.section_id = si.section_id
    AND existing.instructor_id = m.target_id
  RETURNING si.id
)
SELECT 'section_instructors_removed_existing_target' AS step, count(*) AS count FROM removed;

WITH moved AS (
  UPDATE section_instructors si
  SET instructor_id = m.target_id,
      updated_at = now()
  FROM tmp_alias_review_merge m
  WHERE si.instructor_id = m.source_id
  RETURNING si.id
)
SELECT 'section_instructors_updated' AS step, count(*) AS count FROM moved;

WITH moved AS (
  UPDATE reviews r
  SET instructor_id = m.target_id
  FROM tmp_alias_review_merge m
  WHERE r.instructor_id = m.source_id
  RETURNING r.id
)
SELECT 'reviews_updated' AS step, count(*) AS count FROM moved;

WITH removed AS (
  DELETE FROM rmp_professors rp
  USING tmp_alias_review_merge m,
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
  FROM tmp_alias_review_merge m
  WHERE rp.instructor_id = m.source_id
  RETURNING rp.instructor_id
)
SELECT 'rmp_professors_updated' AS step, count(*) AS count FROM moved;

WITH removed AS (
  DELETE FROM rmp_professor_tags rt
  USING tmp_alias_review_merge m,
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
  FROM tmp_alias_review_merge m
  WHERE rt.instructor_id = m.source_id
  RETURNING rt.id
)
SELECT 'rmp_tags_updated' AS step, count(*) AS count FROM moved;

WITH affected AS (
  SELECT source_id AS instructor_id FROM tmp_alias_review_merge
  UNION
  SELECT target_id AS instructor_id FROM tmp_alias_review_merge
),
removed AS (
  DELETE FROM course_instructor_ratings cir
  USING affected a
  WHERE cir.instructor_id = a.instructor_id
  RETURNING cir.course_id
)
SELECT 'course_instructor_ratings_deleted' AS step, count(*) AS count FROM removed;

WITH affected AS (
  SELECT source_id AS instructor_id FROM tmp_alias_review_merge
  UNION
  SELECT target_id AS instructor_id FROM tmp_alias_review_merge
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
  USING tmp_alias_review_merge m
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
