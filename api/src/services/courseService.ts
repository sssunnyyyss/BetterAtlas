import { db } from "../db/index.js";
import {
  courses,
  sections,
  departments,
  instructors,
  terms,
  courseRatings,
} from "../db/schema.js";
import { eq, sql, and, gte, asc, desc, ilike } from "drizzle-orm";
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
  const { department, semester, minRating, credits, page, limit, sort } = query;
  const offset = (page - 1) * limit;

  const conditions: ReturnType<typeof eq>[] = [];
  if (department) {
    const dept = await db
      .select({ id: departments.id })
      .from(departments)
      .where(eq(departments.code, department))
      .limit(1);
    if (dept.length > 0) {
      conditions.push(eq(courses.departmentId, dept[0].id));
    }
  }
  if (credits) {
    conditions.push(eq(courses.credits, credits));
  }
  if (minRating) {
    conditions.push(gte(courseRatings.avgQuality, String(minRating)));
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
      departmentCode: departments.code,
      departmentName: departments.name,
      avgQuality: courseRatings.avgQuality,
      avgDifficulty: courseRatings.avgDifficulty,
      avgWorkload: courseRatings.avgWorkload,
      reviewCount: courseRatings.reviewCount,
    })
    .from(courses)
    .leftJoin(departments, eq(courses.departmentId, departments.id))
    .leftJoin(courseRatings, eq(courses.id, courseRatings.courseId));

  const filteredQuery = where ? baseQuery.where(where) : baseQuery;

  const [data, countResult] = await Promise.all([
    filteredQuery.orderBy(orderBy).limit(limit).offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(courses)
      .then((r) => r[0]?.count ?? 0),
  ]);

  return {
    data: data.map((row) => ({
      id: row.id,
      code: row.code,
      title: row.title,
      description: row.description,
      credits: row.credits,
      departmentId: row.departmentId,
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

  return {
    data: data.map((row) => ({
      id: row.id,
      code: row.code,
      title: row.title,
      description: row.description,
      credits: row.credits,
      departmentId: row.departmentId,
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
      departmentId: courses.departmentId,
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
      meetings: sections.meetings,
      enrollmentCap: sections.enrollmentCap,
      enrollmentCur: sections.enrollmentCur,
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
    departmentId: course.departmentId,
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
      instructor: s.instructorName
        ? { id: s.instructorId!, name: s.instructorName, email: null, departmentId: null }
        : undefined,
      schedule: scheduleFromMeetings(s.meetings),
      enrollmentCap: s.enrollmentCap,
      enrollmentCur: s.enrollmentCur ?? 0,
      createdAt: s.createdAt?.toISOString() ?? "",
    })),
  };
}

export async function listDepartments() {
  return db.select().from(departments).orderBy(asc(departments.code));
}
