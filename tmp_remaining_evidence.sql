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
    lower(regexp_replace(split_part(i.name, ' ', 1), '[^A-Za-z]', '', 'g')) AS tgt_first,
    lower(regexp_replace(reverse(split_part(reverse(i.name), ' ', 1)), '[^A-Za-z]', '', 'g')) AS tgt_last
  FROM instructors i
  WHERE NOT (
    split_part(i.name, ' ', 1) ~ '^[A-Za-z]\.?$'
    OR split_part(i.name, ' ', 1) ~ '^[A-Z]{2,4}$'
    OR split_part(i.name, ' ', 1) ~ '^(?:[A-Za-z]\.){2,4}$'
  )
),
unresolved AS (
  SELECT DISTINCT s.source_id, s.source_name
  FROM src s
  JOIN tgt t
    ON t.tgt_last = s.src_last
   AND left(t.tgt_first, 1) = left(s.src_first, 1)
   AND t.target_id <> s.source_id
),
section_hits AS (
  SELECT u.source_id, count(*) AS section_refs
  FROM unresolved u
  LEFT JOIN sections s ON s.instructor_id = u.source_id
  GROUP BY u.source_id
),
roster_hits AS (
  SELECT u.source_id, count(*) AS roster_refs
  FROM unresolved u
  LEFT JOIN section_instructors si ON si.instructor_id = u.source_id
  GROUP BY u.source_id
),
review_hits AS (
  SELECT u.source_id, count(*) AS review_refs
  FROM unresolved u
  LEFT JOIN reviews r ON r.instructor_id = u.source_id
  GROUP BY u.source_id
)
SELECT
  count(*) AS unresolved_total,
  count(*) FILTER (WHERE coalesce(s.section_refs,0) > 0 OR coalesce(rh.roster_refs,0) > 0 OR coalesce(rv.review_refs,0) > 0) AS unresolved_with_any_evidence,
  count(*) FILTER (WHERE coalesce(s.section_refs,0) = 0 AND coalesce(rh.roster_refs,0) = 0 AND coalesce(rv.review_refs,0) = 0) AS unresolved_orphan_rows
FROM unresolved u
LEFT JOIN section_hits s ON s.source_id = u.source_id
LEFT JOIN roster_hits rh ON rh.source_id = u.source_id
LEFT JOIN review_hits rv ON rv.source_id = u.source_id;

SELECT
  u.source_id,
  u.source_name,
  coalesce(s.section_refs,0) AS section_refs,
  coalesce(rh.roster_refs,0) AS roster_refs,
  coalesce(rv.review_refs,0) AS review_refs
FROM unresolved u
LEFT JOIN section_hits s ON s.source_id = u.source_id
LEFT JOIN roster_hits rh ON rh.source_id = u.source_id
LEFT JOIN review_hits rv ON rv.source_id = u.source_id
WHERE coalesce(s.section_refs,0) > 0 OR coalesce(rh.roster_refs,0) > 0 OR coalesce(rv.review_refs,0) > 0
ORDER BY (coalesce(s.section_refs,0) + coalesce(rh.roster_refs,0) + coalesce(rv.review_refs,0)) DESC, u.source_name
LIMIT 100;
