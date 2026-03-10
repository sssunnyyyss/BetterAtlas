import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { instructorQuerySchema } from "@betteratlas/shared";
import { db } from "../db/index.js";
import {
  instructors,
  instructorRatings,
  sections,
  courses,
  departments,
  courseRatings,
  rmpProfessors,
  rmpProfessorTags,
  reviews,
} from "../db/schema.js";
import { asc, and, desc, eq, ilike, sql } from "drizzle-orm";

const router = Router();

function normalizeInstructorQueryLoose(value: string): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// GET /api/instructors?q=...&limit=...
router.get("/", validate(instructorQuerySchema, "query"), async (req, res) => {
  const { q, limit } = (req as any).validatedQuery as {
    q?: string;
    limit: number;
  };

  const base = db
    .select({
      id: instructors.id,
      name: instructors.name,
      email: instructors.email,
      departmentId: instructors.departmentId,
    })
    .from(instructors);

  const rawQuery = String(q ?? "").trim();
  const looseQuery = normalizeInstructorQueryLoose(rawQuery);
  const filtered = rawQuery
    ? base.where(
        sql`lower(${instructors.name}) like lower(${`%${rawQuery}%`})
            or regexp_replace(lower(${instructors.name}), '[^a-z0-9 ]', ' ', 'g') like ${`%${looseQuery}%`}`
      )
    : base;

  const rows = await filtered.orderBy(asc(instructors.name)).limit(limit);
  res.json(rows);
});

// GET /api/instructors/:id
router.get("/:id", async (req, res) => {
  const instructorId = parseInt(req.params.id, 10);
  if (isNaN(instructorId)) {
    return res.status(400).json({ error: "Invalid instructor ID" });
  }

  const [prof] = await db
    .select({
      id: instructors.id,
      name: instructors.name,
      email: instructors.email,
      departmentId: instructors.departmentId,
      avgQuality: instructorRatings.avgQuality,
      reviewCount: instructorRatings.reviewCount,
    })
    .from(instructors)
    .leftJoin(instructorRatings, eq(instructors.id, instructorRatings.instructorId))
    .where(eq(instructors.id, instructorId))
    .limit(1);

  if (!prof) {
    return res.status(404).json({ error: "Instructor not found" });
  }

  const [rmpData] = await db
    .select({
      avgRating: rmpProfessors.rmpAvgRating,
      avgDifficulty: rmpProfessors.rmpAvgDifficulty,
      numRatings: rmpProfessors.rmpNumRatings,
      wouldTakeAgain: rmpProfessors.rmpWouldTakeAgain,
    })
    .from(rmpProfessors)
    .where(eq(rmpProfessors.instructorId, instructorId))
    .limit(1);

  const [rmpReviewAgg] = await db
    .select({
      avgRating: sql<string>`avg(${reviews.ratingQuality})::numeric(3,2)`,
      avgDifficulty: sql<string>`avg(${reviews.ratingDifficulty})::numeric(3,2)`,
      numRatings: sql<number>`count(*)::int`,
    })
    .from(reviews)
    .where(
      and(
        eq(reviews.instructorId, instructorId),
        eq(reviews.source, "rmp")
      )
    );

  const rmpTags = rmpData || (rmpReviewAgg?.numRatings ?? 0) > 0
    ? await db
        .select({ tag: rmpProfessorTags.tag, count: rmpProfessorTags.count })
        .from(rmpProfessorTags)
        .where(eq(rmpProfessorTags.instructorId, instructorId))
        .orderBy(desc(rmpProfessorTags.count), asc(rmpProfessorTags.tag))
    : [];

  // Courses taught by this instructor (from active sections).
  const rows = await db
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
      classScore: sql<any>`avg(DISTINCT ${instructorRatings.avgQuality})`,
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
    .leftJoin(instructors, eq(sections.instructorId, instructors.id))
    .leftJoin(instructorRatings, eq(sections.instructorId, instructorRatings.instructorId))
    .where(and(eq(sections.isActive, true), eq(sections.instructorId, instructorId)))
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
    .orderBy(asc(courses.code));

  res.json({
    professor: {
      id: prof.id,
      name: prof.name,
      email: prof.email ?? null,
      departmentId: prof.departmentId ?? null,
    },
    avgQuality: prof.avgQuality ? parseFloat(prof.avgQuality) : null,
    reviewCount: prof.reviewCount ?? 0,
    rmp: rmpData || (rmpReviewAgg?.numRatings ?? 0) > 0
      ? {
          avgRating: rmpReviewAgg?.avgRating
            ? parseFloat(rmpReviewAgg.avgRating)
            : rmpData?.avgRating
              ? parseFloat(rmpData.avgRating)
              : null,
          avgDifficulty: rmpReviewAgg?.avgDifficulty
            ? parseFloat(rmpReviewAgg.avgDifficulty)
            : rmpData?.avgDifficulty
              ? parseFloat(rmpData.avgDifficulty)
            : null,
          numRatings: rmpReviewAgg?.numRatings ?? rmpData?.numRatings ?? 0,
          wouldTakeAgain: rmpData?.wouldTakeAgain
            ? parseFloat(rmpData.wouldTakeAgain)
            : null,
          tags: rmpTags.map((t) => ({
            tag: t.tag,
            count: t.count ?? 0,
          })),
        }
      : null,
    courses: rows.map((row: any) => ({
      id: row.id,
      code: row.code,
      title: row.title,
      description: row.description,
      credits: row.credits,
      departmentId: row.departmentId,
      attributes: row.attributes ?? null,
      instructors: Array.isArray(row.instructors)
        ? (row.instructors.filter((s: any) => typeof s === "string" && s.trim()) as string[])
        : [],
      gers: Array.isArray(row.gers)
        ? (row.gers.filter((s: any) => typeof s === "string" && s.trim()) as string[])
        : [],
      department: row.departmentCode
        ? { id: row.departmentId!, code: row.departmentCode, name: row.departmentName! }
        : null,
      avgQuality: row.avgQuality ? parseFloat(row.avgQuality) : null,
      avgDifficulty: row.avgDifficulty ? parseFloat(row.avgDifficulty) : null,
      avgWorkload: row.avgWorkload ? parseFloat(row.avgWorkload) : null,
      reviewCount: row.reviewCount ?? 0,
      classScore: row.classScore ? parseFloat(row.classScore) : null,
    })),
  });
});

export default router;
