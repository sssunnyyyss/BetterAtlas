DROP TABLE IF EXISTS tmp_remaining_chosen;

CREATE TEMP TABLE tmp_remaining_chosen AS
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
),
pairs AS (
  SELECT s.source_id, s.source_name, t.target_id, t.target_name
  FROM src s
  JOIN tgt t
    ON t.tgt_last = s.src_last
   AND left(t.tgt_first, 1) = left(s.src_first, 1)
   AND t.target_id <> s.source_id
),
scored AS (
  SELECT
    p.source_id,
    p.source_name,
    p.target_id,
    p.target_name,
    count(DISTINCT st.course_id) FILTER (WHERE tt.course_id IS NOT NULL) AS course_hits,
    count(DISTINCT (st.course_id::text || '|' || coalesce(st.term_code,''))) FILTER (WHERE tt.course_id IS NOT NULL AND tt.term_code = st.term_code) AS course_term_hits,
    count(DISTINCT r.id) FILTER (WHERE tt2.course_id IS NOT NULL) AS review_course_hits,
    count(DISTINCT r.id) FILTER (WHERE tt3.course_id IS NOT NULL AND tt3.term_code = r.term_code) AS review_term_hits
  FROM pairs p
  LEFT JOIN teach st ON st.instructor_id = p.source_id
  LEFT JOIN teach tt ON tt.instructor_id = p.target_id AND tt.course_id = st.course_id
  LEFT JOIN reviews r ON r.instructor_id = p.source_id
  LEFT JOIN teach tt2 ON tt2.instructor_id = p.target_id AND tt2.course_id = r.course_id
  LEFT JOIN teach tt3 ON tt3.instructor_id = p.target_id AND tt3.course_id = r.course_id
  GROUP BY p.source_id, p.source_name, p.target_id, p.target_name
),
best AS (
  SELECT
    s.*,
    (s.review_term_hits * 10 + s.review_course_hits * 6 + s.course_term_hits * 3 + s.course_hits) AS score,
    max(s.review_term_hits * 10 + s.review_course_hits * 6 + s.course_term_hits * 3 + s.course_hits) OVER (PARTITION BY s.source_id) AS max_score,
    row_number() OVER (
      PARTITION BY s.source_id
      ORDER BY (s.review_term_hits * 10 + s.review_course_hits * 6 + s.course_term_hits * 3 + s.course_hits) DESC, s.target_id ASC
    ) AS rn
  FROM scored s
),
tie AS (
  SELECT b.*, count(*) FILTER (WHERE b.score = b.max_score) OVER (PARTITION BY b.source_id) AS max_ties
  FROM best b
)
SELECT *
FROM tie
WHERE rn = 1
  AND max_score > 0
  AND max_ties = 1;

WITH src AS (
  SELECT
    i.id AS source_id,
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
  SELECT s.source_id
  FROM src s
  JOIN tgt t
    ON t.tgt_last = s.src_last
   AND left(t.tgt_first, 1) = left(s.src_first, 1)
   AND t.target_id <> s.source_id
  GROUP BY s.source_id
)
SELECT
  (SELECT count(*) FROM pairs) AS unresolved_with_candidates,
  (SELECT count(*) FROM tmp_remaining_chosen) AS newly_resolvable,
  (SELECT count(*) FROM tmp_remaining_chosen WHERE review_course_hits > 0 OR review_term_hits > 0) AS resolvable_with_review_signal,
  (SELECT count(*) FROM tmp_remaining_chosen WHERE review_course_hits = 0 AND review_term_hits = 0) AS resolvable_with_section_only_signal;

SELECT
  source_id,
  source_name,
  target_id,
  target_name,
  score,
  review_term_hits,
  review_course_hits,
  course_term_hits,
  course_hits
FROM tmp_remaining_chosen
ORDER BY score DESC, source_name ASC
LIMIT 120;
