import { db } from "../db/index.js";
import {
  courses,
  sections,
  terms,
  departments,
  courseRatings,
  instructors,
  programs,
  programRequirementNodes,
  programCourseCodes,
  programSubjectCodes,
  programElectiveRules,
} from "../db/schema.js";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  sql,
} from "drizzle-orm";
import type { ProgramsQuery, ProgramCoursesQuery } from "@betteratlas/shared";

async function getSingleActiveTermCode(): Promise<string> {
  const active = await db
    .select({ srcdb: terms.srcdb })
    .from(terms)
    .where(eq(terms.isActive, true))
    .limit(2);

  if (active.length !== 1) {
    throw new Error(
      `Expected exactly one active term (terms.is_active=true), found ${active.length}`
    );
  }
  return active[0]!.srcdb;
}

function programSortOrder(sort: string) {
  switch (sort) {
    case "rating":
      return desc(courseRatings.avgQuality);
    case "title":
      return asc(courses.title);
    case "difficulty":
      return asc(courseRatings.avgDifficulty);
    default:
      return asc(courses.code);
  }
}

function courseNumberSql() {
  // Best-effort numeric extraction from course code like "CS 170" or "QTM 385W".
  // Returns NULL for codes that don't match.
  return sql<number | null>`NULLIF(substring(${courses.code} from '[0-9]+'), '')::int`;
}

export async function listPrograms(query: ProgramsQuery) {
  const { q, limit } = query;
  const base = db
    .select({
      id: programs.id,
      name: programs.name,
      kind: programs.kind,
      degree: programs.degree,
    })
    .from(programs);

  const qy = q ? base.where(ilike(programs.name, `%${q}%`)) : base;

  const rows = await qy
    .orderBy(asc(programs.name), asc(programs.kind), asc(programs.degree))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind as any,
    degree: r.degree ?? null,
  }));
}

export async function getProgramDetail(id: number) {
  const [p] = await db
    .select({
      id: programs.id,
      name: programs.name,
      kind: programs.kind,
      degree: programs.degree,
      sourceUrl: programs.sourceUrl,
      hoursToComplete: programs.hoursToComplete,
      coursesRequired: programs.coursesRequired,
      departmentContact: programs.departmentContact,
      lastSyncedAt: programs.lastSyncedAt,
    })
    .from(programs)
    .where(eq(programs.id, id))
    .limit(1);

  if (!p) return null;

  const [nodes, codes, subjects, [rule]] = await Promise.all([
    db
      .select({
        id: programRequirementNodes.id,
        ord: programRequirementNodes.ord,
        nodeType: programRequirementNodes.nodeType,
        text: programRequirementNodes.text,
        listLevel: programRequirementNodes.listLevel,
      })
      .from(programRequirementNodes)
      .where(eq(programRequirementNodes.programId, id))
      .orderBy(asc(programRequirementNodes.ord)),
    db
      .select({ courseCode: programCourseCodes.courseCode })
      .from(programCourseCodes)
      .where(eq(programCourseCodes.programId, id))
      .orderBy(asc(programCourseCodes.courseCode)),
    db
      .select({ subjectCode: programSubjectCodes.subjectCode })
      .from(programSubjectCodes)
      .where(eq(programSubjectCodes.programId, id))
      .orderBy(asc(programSubjectCodes.subjectCode)),
    db
      .select({ levelFloor: programElectiveRules.levelFloor })
      .from(programElectiveRules)
      .where(eq(programElectiveRules.programId, id))
      .limit(1),
  ]);

  return {
    id: p.id,
    name: p.name,
    kind: p.kind as any,
    degree: p.degree ?? null,
    sourceUrl: p.sourceUrl,
    hoursToComplete: p.hoursToComplete ?? null,
    coursesRequired: p.coursesRequired ?? null,
    departmentContact: p.departmentContact ?? null,
    lastSyncedAt: p.lastSyncedAt.toISOString(),
    requirements: nodes.map((n) => ({
      id: n.id,
      ord: n.ord,
      nodeType: n.nodeType as any,
      text: n.text,
      listLevel: n.listLevel ?? null,
    })),
    requiredCourseCodes: codes.map((c) => c.courseCode),
    subjectCodes: subjects.map((s) => s.subjectCode),
    electiveLevelFloor: rule?.levelFloor ?? null,
  };
}

export async function listProgramCourses(programId: number, query: ProgramCoursesQuery) {
  const {
    tab,
    q,
    minRating,
    credits,
    attributes,
    instructor,
    campus,
    componentType,
    instructionMethod,
    page,
    limit,
    sort,
  } = query;

  const offset = (page - 1) * limit;
  const termCode = await getSingleActiveTermCode();

  const baseConditions: any[] = [
    eq(sections.termCode, termCode),
    eq(sections.isActive, true),
  ];

  if (credits) baseConditions.push(eq(courses.credits, credits));
  if (minRating) baseConditions.push(gte(courseRatings.avgQuality, String(minRating)));
  if (campus) baseConditions.push(ilike(sections.campus, campus));
  if (componentType) baseConditions.push(eq(sections.componentType, componentType));
  if (instructionMethod) baseConditions.push(eq(sections.instructionMethod, instructionMethod));
  if (instructor) baseConditions.push(ilike(instructors.name, `%${instructor}%`));

  if (attributes) {
    const attrList = attributes.split(",").map((a) => a.trim()).filter(Boolean);
    for (const attr of attrList) {
      baseConditions.push(ilike(courses.attributes, `%${attr}%`));
    }
  }

  if (q && q.trim()) {
    const raw = q.trim();
    const ts = raw.split(/\s+/).join(" & ");
    baseConditions.push(
      sql`(
        setweight(to_tsvector('english', coalesce(${courses.code}, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(${courses.title}, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(${courses.description}, '')), 'B')
      ) @@ to_tsquery('english', ${ts})
      OR ${courses.code} ILIKE ${"%" + raw + "%"}
      OR ${courses.title} ILIKE ${"%" + raw + "%"}`
    );
  }

  // Program constraints
  if (tab === "required") {
    baseConditions.push(eq(programCourseCodes.programId, programId));
  } else {
    // Electives: all subjects referenced by the program, plus optional level floor.
    baseConditions.push(eq(programSubjectCodes.programId, programId));

    // Exclude explicitly required codes.
    baseConditions.push(
      sql`NOT EXISTS (
        SELECT 1 FROM ${programCourseCodes} pcc
        WHERE pcc.program_id = ${programId} AND pcc.course_code = ${courses.code}
      )`
    );

    const [rule] = await db
      .select({ levelFloor: programElectiveRules.levelFloor })
      .from(programElectiveRules)
      .where(eq(programElectiveRules.programId, programId))
      .limit(1);

    if (rule?.levelFloor) {
      baseConditions.push(sql`${courseNumberSql()} >= ${rule.levelFloor}`);
    }
  }

  const where = and(...baseConditions);

  // Always join sections (active term gating).
  // Conditionally join instructors when filtering by instructor.
  const needInstructorJoin = !!instructor;

  let queryBase: any = db
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
    })
    .from(courses)
    .innerJoin(sections, eq(courses.id, sections.courseId))
    .leftJoin(departments, eq(courses.departmentId, departments.id))
    .leftJoin(courseRatings, eq(courses.id, courseRatings.courseId));

  if (needInstructorJoin) {
    queryBase = queryBase.innerJoin(instructors, eq(sections.instructorId, instructors.id));
  }

  if (tab === "required") {
    queryBase = queryBase.innerJoin(programCourseCodes, eq(programCourseCodes.courseCode, courses.code));
  } else {
    queryBase = queryBase.innerJoin(programSubjectCodes, eq(programSubjectCodes.subjectCode, departments.code));
  }

  const orderBy = programSortOrder(sort);

  let countQuery: any = db
    .select({ count: sql<number>`count(DISTINCT ${courses.id})` })
    .from(courses)
    .innerJoin(sections, eq(courses.id, sections.courseId))
    .leftJoin(departments, eq(courses.departmentId, departments.id))
    .leftJoin(courseRatings, eq(courses.id, courseRatings.courseId));

  if (needInstructorJoin) {
    countQuery = countQuery.innerJoin(instructors, eq(sections.instructorId, instructors.id));
  }

  if (tab === "required") {
    countQuery = countQuery.innerJoin(
      programCourseCodes,
      and(eq(programCourseCodes.programId, programId), eq(programCourseCodes.courseCode, courses.code))
    );
  } else {
    countQuery = countQuery.innerJoin(
      programSubjectCodes,
      and(
        eq(programSubjectCodes.programId, programId),
        eq(programSubjectCodes.subjectCode, departments.code)
      )
    );
  }

  const countRow = await countQuery
    .where(where)
    .then((r: any[]) => r[0]?.count ?? 0);

  const data = await queryBase
    .where(where)
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
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  return {
    data: data.map((row: any) => ({
      id: row.id,
      code: row.code,
      title: row.title,
      description: row.description,
      credits: row.credits,
      departmentId: row.departmentId,
      attributes: row.attributes ?? null,
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
      total: Number(countRow),
      totalPages: Math.ceil(Number(countRow) / limit),
    },
  };
}
