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
  GROUP BY source_id, max_shared, top_shared_ties, dept_candidate_count, candidate_count
)
SELECT
  (SELECT count(*) FROM src) AS abbreviated_total,
  (SELECT count(DISTINCT source_id) FROM cand) AS abbreviated_with_candidates,
  (SELECT count(*) FROM chosen WHERE target_id IS NOT NULL) AS resolvable_now;
