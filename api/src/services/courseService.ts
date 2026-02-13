import { db } from "../db/index.js";
import {
  courses,
  sections,
  departments,
  instructors,
  terms,
  courseRatings,
} from "../db/schema.js";
import { eq, sql, and, asc, desc, ilike, inArray } from "drizzle-orm";
import type { CourseQuery, SearchQuery } from "@betteratlas/shared";

function dayNumToAbbrev(day: number): string {
  switch (day) {
    case 0:
      return "M";
    case 1:
      return "T";
    case 2:
      return "W";
    case 3:
      return "Th";
    case 4:
      return "F";
    case 5:
      return "Sa";
    case 6:
      return "Su";
    default:
      return String(day);
  }
}

function hhmmToColon(t: string): string {
  const digits = t.replace(/[^0-9]/g, "");
  if (digits.length !== 4) return t;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function scheduleFromMeetings(meetings: unknown) {
  if (!Array.isArray(meetings) || meetings.length === 0) return null;

  const parsed = meetings
    .map((m: any) => ({
      day: typeof m?.day === "string" ? Number(m.day) : m?.day,
      startTime: String(m?.startTime ?? m?.start_time ?? ""),
      endTime: String(m?.endTime ?? m?.end_time ?? ""),
      location: String(m?.location ?? ""),
    }))
    .filter((m) => Number.isFinite(m.day) && m.startTime && m.endTime);

  if (parsed.length === 0) return null;

  const days = Array.from(new Set(parsed.map((m) => m.day)))
    .sort((a, b) => a - b)
    .map(dayNumToAbbrev);

  const starts = parsed.map((m) => m.startTime).sort();
  const ends = parsed.map((m) => m.endTime).sort();
  const start = hhmmToColon(starts[0]);
  const end = hhmmToColon(ends[ends.length - 1]);
  const location = parsed.find((m) => m.location)?.location ?? "";

  return { days, start, end, location };
}

export async function listCourses(query: CourseQuery) {
  const {
    department, semester, minRating, credits, page, limit, sort,
    attributes, instructor, campus, componentType, instructionMethod,
  } = query;
  const offset = (page - 1) * limit;

  // Course listing is section-backed: filters and instructor display require joins.
  // This also avoids listing catalog entries that have no active sections.
  const conditions: any[] = [eq(sections.isActive, true)];

  if (department) conditions.push(eq(departments.code, department));
  if (semester) conditions.push(eq(terms.name, semester));
  if (credits) conditions.push(eq(courses.credits, credits));

  if (minRating) {
    // avgQuality is NUMERIC and may be NULL for unrated courses; treat NULL as 0.
    conditions.push(sql`coalesce(${courseRatings.avgQuality}, 0) >= ${minRating}`);
  }

  if (attributes) {
    // GER filter (Emory requirement designation), stored on sections.ger_codes as ",HA,CW,"
    const gerList = attributes.split(",").map((a) => a.trim()).filter(Boolean);
    if (gerList.length > 0) {
      const parts = gerList.map((code) => sql`${sections.gerCodes} LIKE ${`%,${code},%`}`);
      conditions.push(sql`(${sql.join(parts, sql` OR `)})`);
    }
  }

  if (campus) conditions.push(eq(sections.campus, campus));
  if (componentType) conditions.push(eq(sections.componentType, componentType));
  if (instructionMethod) {
    // Back-compat: older UI used O/H, FOSE uses DL/BL.
    const normalized =
      instructionMethod === "O" ? "DL" :
      instructionMethod === "H" ? "BL" :
      instructionMethod;
    conditions.push(eq(sections.instructionMethod, normalized));
  }

  let orderBy;
  switch (sort) {
    case "rating":
      orderBy = desc(courseRatings.avgQuality);
      break;
    case "title":
      orderBy = asc(courses.title);
      break;
    case "difficulty":
      orderBy = asc(courseRatings.avgDifficulty);
      break;
    default:
      orderBy = asc(courses.code);
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const baseQuery = db
    .select({
      id: courses.id,
      code: courses.code,
      title: courses.title,
      description: courses.description,
      credits: courses.credits,
      departmentId: courses.departmentId,
      attributes: courses.attributes,
      departmentCode: departments.code,
      departmentName: departments.name,
      avgQuality: courseRatings.avgQuality,
      avgDifficulty: courseRatings.avgDifficulty,
      avgWorkload: courseRatings.avgWorkload,
      reviewCount: courseRatings.reviewCount,
      instructors: sql<any>`coalesce(
        json_agg(DISTINCT ${instructors.name})
          FILTER (WHERE ${instructors.name} IS NOT NULL),
        '[]'::json
      )`,
      gers: sql<any>`coalesce((
        select json_agg(distinct code)
        from (
          select trim(code) as code
          from sections s,
            regexp_split_to_table(coalesce(trim(both ',' from s.ger_codes), ''), ',') as code
          where s.course_id = ${courses.id}
            and s.is_active = true
            and s.ger_codes is not null
        ) t
        where code <> ''
      ), '[]'::json)`,
    })
    .from(courses)
    .innerJoin(sections, eq(courses.id, sections.courseId))
    .leftJoin(departments, eq(courses.departmentId, departments.id))
    .leftJoin(courseRatings, eq(courses.id, courseRatings.courseId))
    .leftJoin(terms, eq(sections.termCode, terms.srcdb))
    .leftJoin(instructors, eq(sections.instructorId, instructors.id));

  // Instructor name filter needs instructors join; we always join (left), so just apply it.
  const filteredQuery = instructor
    ? (where
        ? baseQuery.where(and(where, ilike(instructors.name, `%${instructor}%`)))
        : baseQuery.where(ilike(instructors.name, `%${instructor}%`)))
    : (where ? baseQuery.where(where) : baseQuery);

  const groupedQuery = filteredQuery
    .groupBy(
      courses.id,
      courses.code,
      courses.title,
      courses.description,
      courses.credits,
      courses.departmentId,
      courses.attributes,
      departments.code,
      departments.name,
      courseRatings.avgQuality,
      courseRatings.avgDifficulty,
      courseRatings.avgWorkload,
      courseRatings.reviewCount
    )
    .orderBy(orderBy);

  const dataQuery = groupedQuery.limit(limit).offset(offset);

  const countBase = db
    .select({ count: sql<number>`count(DISTINCT ${courses.id})` })
    .from(courses)
    .innerJoin(sections, eq(courses.id, sections.courseId))
    .leftJoin(departments, eq(courses.departmentId, departments.id))
    .leftJoin(courseRatings, eq(courses.id, courseRatings.courseId))
    .leftJoin(terms, eq(sections.termCode, terms.srcdb))
    .leftJoin(instructors, eq(sections.instructorId, instructors.id));

  const countWhere = instructor
    ? (where
        ? and(where, ilike(instructors.name, `%${instructor}%`))
        : ilike(instructors.name, `%${instructor}%`))
    : where;

  const countQuery = (countWhere ? countBase.where(countWhere) : countBase).then(
    (r) => r[0]?.count ?? 0
  );

  const [data, countResult] = await Promise.all([dataQuery, countQuery]);

  return {
    data: data.map((row: any) => ({
      id: row.id,
      code: row.code,
      title: row.title,
      description: row.description,
      credits: row.credits,
      departmentId: row.departmentId,
      attributes: row.attributes ?? null,
      instructors: Array.isArray(row.instructors)
        ? (row.instructors.filter((s: any) => typeof s === "string" && s.trim()) as string[])
        : (() => {
            if (typeof row.instructors === "string") {
              try {
                const parsed = JSON.parse(row.instructors);
                return Array.isArray(parsed)
                  ? (parsed.filter((s) => typeof s === "string" && s.trim()) as string[])
                  : [];
              } catch {
                return [];
              }
            }
            return [];
          })(),
      gers: Array.isArray(row.gers)
        ? (row.gers.filter((s: any) => typeof s === "string" && s.trim()) as string[])
        : (() => {
            if (typeof row.gers === "string") {
              try {
                const parsed = JSON.parse(row.gers);
                return Array.isArray(parsed)
                  ? (parsed.filter((s) => typeof s === "string" && s.trim()) as string[])
                  : [];
              } catch {
                return [];
              }
            }
            return [];
          })(),
      department: row.departmentCode
        ? { id: row.departmentId!, code: row.departmentCode, name: row.departmentName! }
        : null,
      avgQuality: row.avgQuality ? parseFloat(row.avgQuality) : null,
      avgDifficulty: row.avgDifficulty ? parseFloat(row.avgDifficulty) : null,
      avgWorkload: row.avgWorkload ? parseFloat(row.avgWorkload) : null,
      reviewCount: row.reviewCount ?? 0,
    })),
    meta: {
      page,
      limit,
      total: Number(countResult),
      totalPages: Math.ceil(Number(countResult) / limit),
    },
  };
}

export async function searchCourses(query: SearchQuery) {
  const { q, page, limit } = query;
  const offset = (page - 1) * limit;

  const searchQuery = q.trim().split(/\s+/).join(" & ");

  const data = await db
    .select({
      id: courses.id,
      code: courses.code,
      title: courses.title,
      description: courses.description,
      credits: courses.credits,
      departmentId: courses.departmentId,
      attributes: courses.attributes,
      departmentCode: departments.code,
      departmentName: departments.name,
      avgQuality: courseRatings.avgQuality,
      avgDifficulty: courseRatings.avgDifficulty,
      avgWorkload: courseRatings.avgWorkload,
      reviewCount: courseRatings.reviewCount,
      rank: sql<number>`ts_rank(
        setweight(to_tsvector('english', coalesce(${courses.code}, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(${courses.title}, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(${courses.description}, '')), 'B'),
        to_tsquery('english', ${searchQuery})
      )`,
    })
    .from(courses)
    .leftJoin(departments, eq(courses.departmentId, departments.id))
    .leftJoin(courseRatings, eq(courses.id, courseRatings.courseId))
    .where(
      sql`(
        setweight(to_tsvector('english', coalesce(${courses.code}, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(${courses.title}, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(${courses.description}, '')), 'B')
      ) @@ to_tsquery('english', ${searchQuery})
      OR ${courses.code} ILIKE ${"%" + q + "%"}
      OR ${courses.title} ILIKE ${"%" + q + "%"}`
    )
    .orderBy(sql`ts_rank(
      setweight(to_tsvector('english', coalesce(${courses.code}, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(${courses.title}, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(${courses.description}, '')), 'B'),
      to_tsquery('english', ${searchQuery})
    ) DESC`)
    .limit(limit)
    .offset(offset);

  const courseIds = data.map((r) => r.id);
  const instructorsByCourse = new Map<number, string[]>();
  if (courseIds.length > 0) {
    const rows = await db
      .select({
        courseId: sections.courseId,
        instructors: sql<any>`coalesce(
          json_agg(DISTINCT ${instructors.name})
            FILTER (WHERE ${instructors.name} IS NOT NULL),
          '[]'::json
        )`,
      })
      .from(sections)
      .leftJoin(instructors, eq(sections.instructorId, instructors.id))
      .where(and(inArray(sections.courseId, courseIds), eq(sections.isActive, true)))
      .groupBy(sections.courseId);

    for (const r of rows) {
      const v = Array.isArray(r.instructors) ? r.instructors : [];
      instructorsByCourse.set(
        r.courseId,
        v.filter((s: any) => typeof s === "string" && s.trim())
      );
    }
  }

  return {
    data: data.map((row) => ({
      id: row.id,
      code: row.code,
      title: row.title,
      description: row.description,
      credits: row.credits,
      departmentId: row.departmentId,
      attributes: row.attributes ?? null,
      instructors: instructorsByCourse.get(row.id) ?? [],
      department: row.departmentCode
        ? { id: row.departmentId!, code: row.departmentCode, name: row.departmentName! }
        : null,
      avgQuality: row.avgQuality ? parseFloat(row.avgQuality) : null,
      avgDifficulty: row.avgDifficulty ? parseFloat(row.avgDifficulty) : null,
      avgWorkload: row.avgWorkload ? parseFloat(row.avgWorkload) : null,
      reviewCount: row.reviewCount ?? 0,
    })),
    meta: { page, limit, total: data.length, totalPages: 1 },
  };
}

export async function getCourseById(id: number) {
  const [course] = await db
    .select({
      id: courses.id,
      code: courses.code,
      title: courses.title,
      description: courses.description,
      credits: courses.credits,
      gradeMode: courses.gradeMode,
      departmentId: courses.departmentId,
      attributes: courses.attributes,
      departmentCode: departments.code,
      departmentName: departments.name,
      avgQuality: courseRatings.avgQuality,
      avgDifficulty: courseRatings.avgDifficulty,
      avgWorkload: courseRatings.avgWorkload,
      reviewCount: courseRatings.reviewCount,
    })
    .from(courses)
    .leftJoin(departments, eq(courses.departmentId, departments.id))
    .leftJoin(courseRatings, eq(courses.id, courseRatings.courseId))
    .where(eq(courses.id, id))
    .limit(1);

  if (!course) return null;

  const courseSections = await db
    .select({
      id: sections.id,
      courseId: sections.courseId,
      termCode: sections.termCode,
      semester: terms.name,
      sectionNumber: sections.sectionNumber,
      instructorId: sections.instructorId,
      instructorName: instructors.name,
      instructorEmail: instructors.email,
      instructorDepartmentId: instructors.departmentId,
      componentType: sections.componentType,
      instructionMethod: sections.instructionMethod,
      campus: sections.campus,
      enrollmentStatus: sections.enrollmentStatus,
      waitlistCount: sections.waitlistCount,
      waitlistCap: sections.waitlistCap,
      enrollmentCap: sections.enrollmentCap,
      enrollmentCur: sections.enrollmentCur,
      seatsAvail: sections.seatsAvail,
      startDate: sections.startDate,
      endDate: sections.endDate,
      gerDesignation: sections.gerDesignation,
      gerCodes: sections.gerCodes,
      meetings: sections.meetings,
      createdAt: sections.createdAt,
    })
    .from(sections)
    .leftJoin(instructors, eq(sections.instructorId, instructors.id))
    .leftJoin(terms, eq(sections.termCode, terms.srcdb))
    .where(and(eq(sections.courseId, id), eq(sections.isActive, true)));

  return {
    id: course.id,
    code: course.code,
    title: course.title,
    description: course.description,
    credits: course.credits,
    gradeMode: course.gradeMode ?? null,
    departmentId: course.departmentId,
    attributes: course.attributes ?? null,
    department: course.departmentCode
      ? { id: course.departmentId!, code: course.departmentCode, name: course.departmentName! }
      : null,
    avgQuality: course.avgQuality ? parseFloat(course.avgQuality) : null,
    avgDifficulty: course.avgDifficulty ? parseFloat(course.avgDifficulty) : null,
    avgWorkload: course.avgWorkload ? parseFloat(course.avgWorkload) : null,
    reviewCount: course.reviewCount ?? 0,
    sections: courseSections.map((s) => ({
      id: s.id,
      courseId: s.courseId,
      semester: s.semester ?? s.termCode,
      sectionNumber: s.sectionNumber,
      instructorId: s.instructorId,
      componentType: s.componentType ?? null,
      campus: s.campus ?? null,
      instructionMethod: s.instructionMethod ?? null,
      enrollmentStatus: s.enrollmentStatus ?? null,
      waitlistCount: s.waitlistCount ?? 0,
      waitlistCap: s.waitlistCap ?? null,
      instructor: s.instructorName
        ? {
            id: s.instructorId!,
            name: s.instructorName,
            email: s.instructorEmail ?? null,
            departmentId: s.instructorDepartmentId ?? null,
          }
        : undefined,
      schedule: scheduleFromMeetings(s.meetings),
      enrollmentCap: s.enrollmentCap,
      enrollmentCur: s.enrollmentCur ?? 0,
      seatsAvail: s.seatsAvail ?? (s.enrollmentCap !== null ? Math.max(0, (s.enrollmentCap ?? 0) - (s.enrollmentCur ?? 0)) : null),
      startDate: s.startDate ?? null,
      endDate: s.endDate ?? null,
      gerDesignation: s.gerDesignation ?? null,
      gerCodes: (() => {
        const raw = (s.gerCodes ?? "").trim();
        if (!raw) return [];
        return raw
          .split(",")
          .map((x) => x.trim())
          .filter((x) => x && x !== "");
      })(),
      createdAt: s.createdAt?.toISOString() ?? "",
    })),
  };
}

export async function listDepartments() {
  return db.select().from(departments).orderBy(asc(departments.code));
}
