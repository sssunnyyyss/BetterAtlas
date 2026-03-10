WITH target_instructors AS (
  SELECT i.id, i.name
  FROM instructors i
  WHERE lower(regexp_replace(reverse(split_part(reverse(i.name), ' ', 1)), '[^A-Za-z]', '', 'g')) = 'lee'
    AND lower(left(regexp_replace(split_part(i.name, ' ', 1), '[^A-Za-z]', '', 'g'), 1)) = 'b'
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
  ti.id,
  ti.name,
  c.code,
  count(DISTINCT t.term_code) AS terms_taught,
  min(t.term_code) AS first_term,
  max(t.term_code) AS last_term
FROM target_instructors ti
LEFT JOIN teach t ON t.instructor_id = ti.id
LEFT JOIN courses c ON c.id = t.course_id
WHERE c.code = 'FIN 320'
GROUP BY ti.id, ti.name, c.code
ORDER BY ti.name;

SELECT i.id, i.name, count(*) AS review_count
FROM reviews r
JOIN instructors i ON i.id = r.instructor_id
JOIN courses c ON c.id = r.course_id
WHERE c.code = 'FIN 320'
  AND lower(regexp_replace(reverse(split_part(reverse(i.name), ' ', 1)), '[^A-Za-z]', '', 'g')) = 'lee'
  AND lower(left(regexp_replace(split_part(i.name, ' ', 1), '[^A-Za-z]', '', 'g'), 1)) = 'b'
GROUP BY i.id, i.name
ORDER BY i.name;
