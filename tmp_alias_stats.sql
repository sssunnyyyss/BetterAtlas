WITH src AS (
  SELECT
    i.id,
    i.name,
    lower(regexp_replace(split_part(i.name, ' ', 1), '[^A-Za-z]', '', 'g')) AS src_first,
    lower(regexp_replace(regexp_replace(i.name, '^.*\s', ''), '[^A-Za-z]', '', 'g')) AS src_last
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
    lower(regexp_replace(regexp_replace(i.name, '^.*\s', ''), '[^A-Za-z]', '', 'g')) AS tgt_last
  FROM instructors i
  WHERE NOT (
    split_part(i.name, ' ', 1) ~ '^[A-Za-z]\.?$'
    OR split_part(i.name, ' ', 1) ~ '^[A-Z]{2,4}$'
    OR split_part(i.name, ' ', 1) ~ '^(?:[A-Za-z]\.){2,4}$'
  )
  AND length(regexp_replace(split_part(i.name, ' ', 1), '[^A-Za-z]', '', 'g')) >= 3
  AND lower(regexp_replace(split_part(i.name, ' ', 1), '[^A-Za-z]', '', 'g')) NOT IN ('fnu', 'lnu', 'tba', 'staff')
),
teach_dept AS (
  SELECT DISTINCT s.instructor_id, c.department_id
  FROM sections s
  JOIN courses c ON c.id = s.course_id
  WHERE s.instructor_id IS NOT NULL
    AND c.department_id IS NOT NULL
  UNION
  SELECT DISTINCT si.instructor_id, c.department_id
  FROM section_instructors si
  JOIN sections s ON s.id = si.section_id
  JOIN courses c ON c.id = s.course_id
  WHERE c.department_id IS NOT NULL
),
source_dept AS (
  SELECT instructor_id AS source_id, department_id
  FROM teach_dept
),
cand AS (
  SELECT
    s.id AS source_id,
    s.name AS source_name,
    sd.department_id AS source_department_id,
    t.id AS target_id,
    t.name AS target_name,
    t.department_id AS target_department_id,
    CASE WHEN sd.department_id IS NOT NULL AND sd.department_id = t.department_id THEN 1 ELSE 0 END AS dept_exact
  FROM src s
  JOIN tgt t
    ON t.tgt_last = s.src_last
   AND left(t.tgt_first, 1) = left(s.src_first, 1)
   AND t.id <> s.id
  LEFT JOIN source_dept sd
    ON sd.source_id = s.id
),
agg AS (
  SELECT
    source_id,
    source_name,
    count(*) AS candidate_count,
    count(*) FILTER (WHERE dept_exact = 1) AS dept_candidate_count
  FROM cand
  GROUP BY source_id, source_name
),
chosen AS (
  SELECT
    a.source_id,
    a.source_name,
    CASE
      WHEN a.dept_candidate_count = 1 THEN (
        SELECT c.target_id FROM cand c
        WHERE c.source_id = a.source_id AND c.dept_exact = 1
        ORDER BY c.target_id
        LIMIT 1
      )
      WHEN a.candidate_count = 1 THEN (
        SELECT c.target_id FROM cand c
        WHERE c.source_id = a.source_id
        ORDER BY c.target_id
        LIMIT 1
      )
      ELSE NULL
    END AS target_id
  FROM agg a
)
SELECT
  (SELECT count(*) FROM src) AS abbreviated_total,
  (SELECT count(DISTINCT source_id) FROM cand) AS abbreviated_with_name_candidates,
  (SELECT count(*) FROM chosen WHERE target_id IS NOT NULL) AS safe_merge_count;

WITH src AS (
  SELECT
    i.id,
    i.name,
    lower(regexp_replace(split_part(i.name, ' ', 1), '[^A-Za-z]', '', 'g')) AS src_first,
    lower(regexp_replace(regexp_replace(i.name, '^.*\s', ''), '[^A-Za-z]', '', 'g')) AS src_last
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
    lower(regexp_replace(regexp_replace(i.name, '^.*\s', ''), '[^A-Za-z]', '', 'g')) AS tgt_last
  FROM instructors i
  WHERE NOT (
    split_part(i.name, ' ', 1) ~ '^[A-Za-z]\.?$'
    OR split_part(i.name, ' ', 1) ~ '^[A-Z]{2,4}$'
    OR split_part(i.name, ' ', 1) ~ '^(?:[A-Za-z]\.){2,4}$'
  )
  AND length(regexp_replace(split_part(i.name, ' ', 1), '[^A-Za-z]', '', 'g')) >= 3
  AND lower(regexp_replace(split_part(i.name, ' ', 1), '[^A-Za-z]', '', 'g')) NOT IN ('fnu', 'lnu', 'tba', 'staff')
),
teach_dept AS (
  SELECT DISTINCT s.instructor_id, c.department_id
  FROM sections s
  JOIN courses c ON c.id = s.course_id
  WHERE s.instructor_id IS NOT NULL
    AND c.department_id IS NOT NULL
  UNION
  SELECT DISTINCT si.instructor_id, c.department_id
  FROM section_instructors si
  JOIN sections s ON s.id = si.section_id
  JOIN courses c ON c.id = s.course_id
  WHERE c.department_id IS NOT NULL
),
source_dept AS (
  SELECT instructor_id AS source_id, department_id
  FROM teach_dept
),
cand AS (
  SELECT
    s.id AS source_id,
    s.name AS source_name,
    sd.department_id AS source_department_id,
    t.id AS target_id,
    t.name AS target_name,
    t.department_id AS target_department_id,
    CASE WHEN sd.department_id IS NOT NULL AND sd.department_id = t.department_id THEN 1 ELSE 0 END AS dept_exact
  FROM src s
  JOIN tgt t
    ON t.tgt_last = s.src_last
   AND left(t.tgt_first, 1) = left(s.src_first, 1)
   AND t.id <> s.id
  LEFT JOIN source_dept sd
    ON sd.source_id = s.id
),
agg AS (
  SELECT
    source_id,
    source_name,
    count(*) AS candidate_count,
    count(*) FILTER (WHERE dept_exact = 1) AS dept_candidate_count
  FROM cand
  GROUP BY source_id, source_name
)
SELECT
  a.source_id,
  a.source_name,
  a.candidate_count,
  a.dept_candidate_count
FROM agg a
WHERE a.candidate_count > 1 AND a.dept_candidate_count <> 1
ORDER BY a.source_name
LIMIT 100;
