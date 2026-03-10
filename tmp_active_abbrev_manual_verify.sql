with abbrev as (
  select
    i.id as abbrev_id,
    i.name as abbrev_name,
    lower(left(regexp_replace(split_part(i.name, ' ', 1), '[^a-z]', '', 'gi'), 1)) as first_initial,
    lower(regexp_replace(split_part(i.name, ' ', array_length(regexp_split_to_array(i.name, '\\s+'), 1)), '[^a-z]', '', 'gi')) as last_token,
    count(distinct si.section_id) + count(distinct s.id) + count(distinct r.id) as live_refs
  from instructors i
  left join section_instructors si on si.instructor_id = i.id
  left join sections s on s.instructor_id = i.id
  left join reviews r on r.instructor_id = i.id
  where
    split_part(i.name, ' ', 1) ~ '^[A-Za-z]\\.?$'
    or split_part(i.name, ' ', 1) ~ '^[A-Z]{2,4}$'
    or split_part(i.name, ' ', 1) ~ '^(?:[A-Za-z]\\.){2,4}$'
  group by i.id, i.name
),
active_abbrev as (
  select *
  from abbrev
  where live_refs > 0
),
abbrev_course_refs as (
  select a.abbrev_id, s.course_id
  from active_abbrev a
  join section_instructors si on si.instructor_id = a.abbrev_id
  join sections s on s.id = si.section_id
  union
  select a.abbrev_id, s.course_id
  from active_abbrev a
  join sections s on s.instructor_id = a.abbrev_id
),
abbrev_course_summary as (
  select
    a.abbrev_id,
    string_agg(distinct c.code, ', ' order by c.code) as abbrev_courses,
    string_agg(distinct d.code, ', ' order by d.code) as abbrev_departments
  from active_abbrev a
  left join abbrev_course_refs acr on acr.abbrev_id = a.abbrev_id
  left join courses c on c.id = acr.course_id
  left join departments d on d.id = c.department_id
  group by a.abbrev_id
),
candidates as (
  select
    a.abbrev_id,
    t.id as candidate_id,
    t.name as candidate_name,
    td.code as candidate_department
  from active_abbrev a
  join instructors t
    on t.id <> a.abbrev_id
   and lower(regexp_replace(split_part(t.name, ' ', array_length(regexp_split_to_array(t.name, '\\s+'), 1)), '[^a-z]', '', 'gi')) = a.last_token
   and lower(left(regexp_replace(split_part(t.name, ' ', 1), '[^a-z]', '', 'gi'), 1)) = a.first_initial
   and not (
      split_part(t.name, ' ', 1) ~ '^[A-Za-z]\\.?$'
      or split_part(t.name, ' ', 1) ~ '^[A-Z]{2,4}$'
      or split_part(t.name, ' ', 1) ~ '^(?:[A-Za-z]\\.){2,4}$'
   )
  left join departments td on td.id = t.department_id
),
candidate_course_refs as (
  select c.abbrev_id, c.candidate_id, s.course_id
  from candidates c
  join section_instructors si on si.instructor_id = c.candidate_id
  join sections s on s.id = si.section_id
  union
  select c.abbrev_id, c.candidate_id, s.course_id
  from candidates c
  join sections s on s.instructor_id = c.candidate_id
),
candidate_course_summary as (
  select
    c.abbrev_id,
    c.candidate_id,
    c.candidate_name,
    c.candidate_department,
    string_agg(distinct cr.code, ', ' order by cr.code) as candidate_courses
  from candidates c
  left join candidate_course_refs ccr
    on ccr.abbrev_id = c.abbrev_id
   and ccr.candidate_id = c.candidate_id
  left join courses cr on cr.id = ccr.course_id
  group by c.abbrev_id, c.candidate_id, c.candidate_name, c.candidate_department
)
select
  a.abbrev_id,
  a.abbrev_name,
  a.live_refs,
  coalesce(acs.abbrev_departments, '') as abbrev_departments,
  coalesce(acs.abbrev_courses, '') as abbrev_courses,
  ccs.candidate_id,
  ccs.candidate_name,
  coalesce(ccs.candidate_department, '') as candidate_department,
  coalesce(ccs.candidate_courses, '') as candidate_courses
from active_abbrev a
join candidate_course_summary ccs on ccs.abbrev_id = a.abbrev_id
left join abbrev_course_summary acs on acs.abbrev_id = a.abbrev_id
order by a.abbrev_name, ccs.candidate_name;
