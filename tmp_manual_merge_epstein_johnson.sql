begin;

-- Ensure a Jordan Johnson row exists for the WGS-aligned RMP/review identity.
insert into instructors (name, department_id)
select
  'Jordan Johnson',
  (
    select c.department_id
    from courses c
    where c.code = 'WGS 100W' and c.department_id is not null
    order by c.id
    limit 1
  )
where not exists (
  select 1 from instructors i where lower(i.name) = 'jordan johnson'
);

-- 1) Merge J. Epstein + Jeffrey Epstein into Jeff Epstein (id=4476).
update section_instructors si
set instructor_id = 4476
where si.instructor_id in (3689, 7610)
  and not exists (
    select 1
    from section_instructors t
    where t.section_id = si.section_id
      and t.instructor_id = 4476
  );

delete from section_instructors
where instructor_id in (3689, 7610);

update sections
set instructor_id = 4476
where instructor_id in (3689, 7610);

update reviews
set instructor_id = 4476
where instructor_id in (3689, 7610);

update rmp_professor_tags rpt
set instructor_id = 4476
where rpt.instructor_id in (3689, 7610)
  and not exists (
    select 1
    from rmp_professor_tags x
    where x.instructor_id = 4476
      and x.tag = rpt.tag
  );

delete from rmp_professor_tags
where instructor_id in (3689, 7610);

insert into rmp_professors (
  instructor_id,
  rmp_teacher_id,
  rmp_avg_rating,
  rmp_avg_difficulty,
  rmp_num_ratings,
  rmp_would_take_again,
  rmp_department,
  imported_at
)
select
  4476,
  rp.rmp_teacher_id,
  rp.rmp_avg_rating,
  rp.rmp_avg_difficulty,
  rp.rmp_num_ratings,
  rp.rmp_would_take_again,
  rp.rmp_department,
  rp.imported_at
from rmp_professors rp
where rp.instructor_id in (3689, 7610)
  and not exists (
    select 1 from rmp_professors t where t.instructor_id = 4476
  )
order by rp.imported_at desc nulls last
limit 1;

delete from rmp_professors
where instructor_id in (3689, 7610);

-- 2) Split J. Johnson mixed identity.
--    - REL/AAS sections move to Jasmine Johnson (id=3845)
--    - WGS review + RMP profile move to Jordan Johnson.
update section_instructors si
set instructor_id = 3845
where si.instructor_id = 7518
  and not exists (
    select 1
    from section_instructors t
    where t.section_id = si.section_id
      and t.instructor_id = 3845
  );

delete from section_instructors
where instructor_id = 7518;

update sections s
set instructor_id = 3845
where s.instructor_id = 7518
  and s.course_id in (
    select c.id from courses c where c.code in ('AAS 325', 'REL 325')
  );

update reviews r
set instructor_id = (
  select i.id
  from instructors i
  where lower(i.name) = 'jordan johnson'
  order by i.id
  limit 1
)
where r.instructor_id = 7518;

update rmp_professor_tags rpt
set instructor_id = (
  select i.id
  from instructors i
  where lower(i.name) = 'jordan johnson'
  order by i.id
  limit 1
)
where rpt.instructor_id = 7518
  and not exists (
    select 1
    from rmp_professor_tags x
    where x.instructor_id = (
      select i.id
      from instructors i
      where lower(i.name) = 'jordan johnson'
      order by i.id
      limit 1
    )
      and x.tag = rpt.tag
  );

delete from rmp_professor_tags
where instructor_id = 7518;

insert into rmp_professors (
  instructor_id,
  rmp_teacher_id,
  rmp_avg_rating,
  rmp_avg_difficulty,
  rmp_num_ratings,
  rmp_would_take_again,
  rmp_department,
  imported_at
)
select
  (
    select i.id
    from instructors i
    where lower(i.name) = 'jordan johnson'
    order by i.id
    limit 1
  ) as instructor_id,
  rp.rmp_teacher_id,
  rp.rmp_avg_rating,
  rp.rmp_avg_difficulty,
  rp.rmp_num_ratings,
  rp.rmp_would_take_again,
  rp.rmp_department,
  rp.imported_at
from rmp_professors rp
where rp.instructor_id = 7518
  and not exists (
    select 1
    from rmp_professors t
    where t.instructor_id = (
      select i.id
      from instructors i
      where lower(i.name) = 'jordan johnson'
      order by i.id
      limit 1
    )
  );

delete from rmp_professors
where instructor_id = 7518;

-- Recompute aggregate ratings from reviews after reassignment.
insert into course_instructor_ratings (
  course_id,
  instructor_id,
  avg_quality,
  avg_difficulty,
  avg_workload,
  review_count,
  updated_at
)
select
  r.course_id,
  r.instructor_id,
  round(avg(r.rating_quality), 2),
  round(avg(r.rating_difficulty), 2),
  round(avg(r.rating_workload), 2),
  count(*)::int,
  now()
from reviews r
where r.instructor_id is not null
group by r.course_id, r.instructor_id
on conflict (course_id, instructor_id) do update set
  avg_quality = excluded.avg_quality,
  avg_difficulty = excluded.avg_difficulty,
  avg_workload = excluded.avg_workload,
  review_count = excluded.review_count,
  updated_at = now();

delete from course_instructor_ratings cir
where not exists (
  select 1
  from reviews r
  where r.course_id = cir.course_id
    and r.instructor_id = cir.instructor_id
);

insert into instructor_ratings (
  instructor_id,
  avg_quality,
  review_count,
  updated_at
)
select
  r.instructor_id,
  round(avg(r.rating_quality), 2),
  count(*)::int,
  now()
from reviews r
where r.instructor_id is not null
group by r.instructor_id
on conflict (instructor_id) do update set
  avg_quality = excluded.avg_quality,
  review_count = excluded.review_count,
  updated_at = now();

delete from instructor_ratings ir
where not exists (
  select 1
  from reviews r
  where r.instructor_id = ir.instructor_id
);

-- Drop fully-orphaned source rows.
delete from instructors i
where i.id in (3689, 7610, 7518)
  and not exists (select 1 from sections s where s.instructor_id = i.id)
  and not exists (select 1 from section_instructors si where si.instructor_id = i.id)
  and not exists (select 1 from reviews r where r.instructor_id = i.id)
  and not exists (select 1 from rmp_professors rp where rp.instructor_id = i.id)
  and not exists (select 1 from rmp_professor_tags rpt where rpt.instructor_id = i.id)
  and not exists (select 1 from instructor_ratings ir where ir.instructor_id = i.id)
  and not exists (select 1 from course_instructor_ratings cir where cir.instructor_id = i.id);

commit;
