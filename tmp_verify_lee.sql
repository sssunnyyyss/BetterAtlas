select id,name,email from instructors where id in (5297,2121,3581) order by id;

with teach as (
  select distinct s.instructor_id, s.course_id, s.term_code
  from sections s
  where s.instructor_id in (2121,3581)
  union
  select distinct si.instructor_id, s.course_id, s.term_code
  from section_instructors si
  join sections s on s.id = si.section_id
  where si.instructor_id in (2121,3581)
)
select t.instructor_id, i.name, c.code, count(*) as term_rows, min(t.term_code), max(t.term_code)
from teach t
join instructors i on i.id=t.instructor_id
join courses c on c.id=t.course_id
where c.code='FIN 320'
group by t.instructor_id, i.name, c.code
order by i.name;

select i.id,i.name,count(*) as fin320_sections
from sections s
join instructors i on i.id=s.instructor_id
join courses c on c.id=s.course_id
where c.code='FIN 320' and i.id in (2121,3581)
group by i.id,i.name
order by i.name;
