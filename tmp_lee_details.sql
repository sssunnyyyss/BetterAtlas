CREATE TEMP TABLE tmp_ids (instructor_id int);
INSERT INTO tmp_ids (instructor_id) VALUES (5297), (2121), (3581);

CREATE TEMP TABLE tmp_teach AS
SELECT DISTINCT s.instructor_id, s.course_id, s.term_code, 'primary'::text AS src
FROM sections s
WHERE s.instructor_id IN (SELECT instructor_id FROM tmp_ids)
UNION
SELECT DISTINCT si.instructor_id, s.course_id, s.term_code, 'roster'::text AS src
FROM section_instructors si
JOIN sections s ON s.id = si.section_id
WHERE si.instructor_id IN (SELECT instructor_id FROM tmp_ids);

SELECT i.id, i.name, i.email, i.department_id
FROM instructors i
WHERE i.id IN (SELECT instructor_id FROM tmp_ids)
ORDER BY i.id;

SELECT
  t.instructor_id,
  i.name,
  c.code,
  count(DISTINCT t.term_code) AS terms,
  min(t.term_code) AS first_term,
  max(t.term_code) AS last_term
FROM tmp_teach t
JOIN instructors i ON i.id = t.instructor_id
JOIN courses c ON c.id = t.course_id
GROUP BY t.instructor_id, i.name, c.code
ORDER BY c.code, i.name;

SELECT
  i.id,
  i.name,
  count(*) AS review_count,
  count(*) FILTER (WHERE r.source = 'rmp') AS rmp_reviews,
  count(*) FILTER (WHERE r.source = 'native') AS native_reviews
FROM reviews r
JOIN instructors i ON i.id = r.instructor_id
WHERE i.id IN (SELECT instructor_id FROM tmp_ids)
GROUP BY i.id, i.name
ORDER BY i.id;
