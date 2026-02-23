begin;

-- Canonical target: T Cooper (id=2004), source alias: T. Cooper (id=6395)

update section_instructors si
set instructor_id = 2004
where si.instructor_id = 6395
  and not exists (
    select 1
    from section_instructors t
    where t.section_id = si.section_id
      and t.instructor_id = 2004
  );

delete from section_instructors
where instructor_id = 6395;

update sections
set instructor_id = 2004
where instructor_id = 6395;

update reviews
set instructor_id = 2004
where instructor_id = 6395;

update rmp_professor_tags rpt
set instructor_id = 2004
where rpt.instructor_id = 6395
  and not exists (
    select 1
    from rmp_professor_tags x
    where x.instructor_id = 2004
      and x.tag = rpt.tag
  );

delete from rmp_professor_tags
where instructor_id = 6395;

-- Keep the stronger RMP summary profile (higher ratings count) as canonical.
with src as (
  select *
  from rmp_professors
  where instructor_id = 6395
), tgt as (
  select *
  from rmp_professors
  where instructor_id = 2004
)
update rmp_professors rp
set
  rmp_teacher_id = src.rmp_teacher_id,
  rmp_avg_rating = src.rmp_avg_rating,
  rmp_avg_difficulty = src.rmp_avg_difficulty,
  rmp_num_ratings = src.rmp_num_ratings,
  rmp_would_take_again = src.rmp_would_take_again,
  rmp_department = src.rmp_department,
  imported_at = src.imported_at
from src, tgt
where rp.instructor_id = 2004
  and coalesce(src.rmp_num_ratings, 0) > coalesce(tgt.rmp_num_ratings, 0);

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
  2004,
  src.rmp_teacher_id,
  src.rmp_avg_rating,
  src.rmp_avg_difficulty,
  src.rmp_num_ratings,
  src.rmp_would_take_again,
  src.rmp_department,
  src.imported_at
from rmp_professors src
where src.instructor_id = 6395
  and not exists (
    select 1 from rmp_professors t where t.instructor_id = 2004
  );

delete from rmp_professors
where instructor_id = 6395;

-- Refresh aggregates.
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

-- Drop now-orphaned alias row.
delete from instructors i
where i.id = 6395
  and not exists (select 1 from sections s where s.instructor_id = i.id)
  and not exists (select 1 from section_instructors si where si.instructor_id = i.id)
  and not exists (select 1 from reviews r where r.instructor_id = i.id)
  and not exists (select 1 from rmp_professors rp where rp.instructor_id = i.id)
  and not exists (select 1 from rmp_professor_tags rpt where rpt.instructor_id = i.id)
  and not exists (select 1 from instructor_ratings ir where ir.instructor_id = i.id)
  and not exists (select 1 from course_instructor_ratings cir where cir.instructor_id = i.id);

commit;
