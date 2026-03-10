DROP TABLE IF EXISTS tmp_unresolved_pairs;

CREATE TEMP TABLE tmp_unresolved_pairs AS
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
    lower(regexp_replace(split_part(i.name, ' ', 1), '[^A-Za-z]', '', 'g')) AS tgt_first,
    lower(regexp_replace(reverse(split_part(reverse(i.name), ' ', 1)), '[^A-Za-z]', '', 'g')) AS tgt_last
  FROM instructors i
  WHERE NOT (
    split_part(i.name, ' ', 1) ~ '^[A-Za-z]\.?$'
    OR split_part(i.name, ' ', 1) ~ '^[A-Z]{2,4}$'
    OR split_part(i.name, ' ', 1) ~ '^(?:[A-Za-z]\.){2,4}$'
  )
),
teach AS (
  SELECT DISTINCT s.instructor_id, s.course_id, s.term_code
  FROM sections s
  WHERE s.instructor_id IS NOT NULL
  UNION
  SELECT DISTINCT si.instructor_id, s.course_id, s.term_code
  FROM section_instructors si
  JOIN sections s ON s.id = si.section_id
)
SELECT
  s.source_id,
  s.source_name,
  t.target_id,
  t.target_name,
  count(DISTINCT st.course_id) FILTER (WHERE tt.course_id IS NOT NULL) AS course_hits,
  count(DISTINCT (st.course_id::text || '|' || coalesce(st.term_code,''))) FILTER (WHERE tt.course_id IS NOT NULL AND tt.term_code = st.term_code) AS course_term_hits,
  count(DISTINCT r.id) FILTER (WHERE tt2.course_id IS NOT NULL) AS review_course_hits,
  count(DISTINCT r.id) FILTER (WHERE tt3.course_id IS NOT NULL AND tt3.term_code = r.term_code) AS review_term_hits
FROM src s
JOIN tgt t
  ON t.tgt_last = s.src_last
 AND left(t.tgt_first, 1) = left(s.src_first, 1)
 AND t.target_id <> s.source_id
LEFT JOIN teach st ON st.instructor_id = s.source_id
LEFT JOIN teach tt ON tt.instructor_id = t.target_id AND tt.course_id = st.course_id
LEFT JOIN reviews r ON r.instructor_id = s.source_id
LEFT JOIN teach tt2 ON tt2.instructor_id = t.target_id AND tt2.course_id = r.course_id
LEFT JOIN teach tt3 ON tt3.instructor_id = t.target_id AND tt3.course_id = r.course_id
GROUP BY s.source_id, s.source_name, t.target_id, t.target_name;

WITH by_source AS (
  SELECT
    up.source_id,
    up.source_name,
    count(*) AS candidate_count,
    max(up.review_term_hits*10 + up.review_course_hits*6 + up.course_term_hits*3 + up.course_hits) AS best_score,
    sum(up.review_term_hits) AS total_review_term_hits,
    sum(up.review_course_hits) AS total_review_course_hits,
    sum(up.course_term_hits) AS total_course_term_hits,
    sum(up.course_hits) AS total_course_hits
  FROM tmp_unresolved_pairs up
  GROUP BY up.source_id, up.source_name
),
source_refs AS (
  SELECT
    b.source_id,
    count(*) FILTER (WHERE s.instructor_id = b.source_id) AS section_refs,
    count(*) FILTER (WHERE si.instructor_id = b.source_id) AS roster_refs,
    count(*) FILTER (WHERE r.instructor_id = b.source_id) AS review_refs
  FROM by_source b
  LEFT JOIN sections s ON s.instructor_id = b.source_id
  LEFT JOIN section_instructors si ON si.instructor_id = b.source_id
  LEFT JOIN reviews r ON r.instructor_id = b.source_id
  GROUP BY b.source_id
)
SELECT
  b.source_id,
  b.source_name,
  b.candidate_count,
  b.best_score,
  b.total_review_term_hits,
  b.total_review_course_hits,
  b.total_course_term_hits,
  b.total_course_hits,
  sr.section_refs,
  sr.roster_refs,
  sr.review_refs
FROM by_source b
JOIN source_refs sr ON sr.source_id = b.source_id
WHERE b.best_score = 0
ORDER BY (sr.section_refs + sr.roster_refs + sr.review_refs) DESC, b.source_name
LIMIT 30;

SELECT
  up.source_id,
  up.source_name,
  string_agg(format('%s:%s(rt=%s,rc=%s,ct=%s,c=%s)', up.target_id, up.target_name, up.review_term_hits, up.review_course_hits, up.course_term_hits, up.course_hits), ' | ' ORDER BY up.target_name)
FROM tmp_unresolved_pairs up
WHERE up.source_id IN (
  SELECT b.source_id
  FROM (
    SELECT source_id, source_name
    FROM tmp_unresolved_pairs
    GROUP BY source_id, source_name
    ORDER BY source_name
    LIMIT 5
  ) b
)
GROUP BY up.source_id, up.source_name
ORDER BY up.source_name;
