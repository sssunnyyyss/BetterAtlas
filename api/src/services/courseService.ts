import { db } from "../db/index.js";
import {
  courses,
  sections,
  departments,
  instructors,
  terms,
  courseRatings,
  courseInstructorRatings,
  sectionRatings,
  instructorRatings,
} from "../db/schema.js";
import { eq, sql, and, asc, desc, ilike, inArray } from "drizzle-orm";
import type { CourseQuery, SearchQuery, CourseWithRatings } from "@betteratlas/shared";
import { scheduleFromMeetings, schedulesFromMeetings } from "../lib/schedule.js";
import {
  buildCrossListSignatureMap,
  haveExactCrossListSignatures,
} from "../lib/crossListSignatures.js";

type CourseFilterQuery = Partial<
  Pick<
    CourseQuery,
    | "department"
    | "semester"
    | "minRating"
    | "credits"
    | "attributes"
    | "instructor"
    | "campus"
    | "componentType"
    | "instructionMethod"
  >
>;

function classScoreExpr() {
  // "Class" score = average of professor-wide scores for instructors teaching the course.
  // Uses DISTINCT to avoid overweighting instructors with multiple sections.
  return sql`avg(DISTINCT ${instructorRatings.avgQuality})`;
}

function avgEnrollmentPercentExpr() {
  return sql<number>`avg(
    case
      when ${sections.enrollmentCap} is not null and ${sections.enrollmentCap} > 0
      then (coalesce(${sections.enrollmentCur}, 0)::float / nullif(${sections.enrollmentCap}, 0)) * 100
      else null
    end
  )`;
}

function toRoundedPercent(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

function normalizeInstructionMethodFilter(value: string | undefined) {
  if (!value) return value;
  if (value === "O") return "DL";
  if (value === "H") return "BL";
  return value;
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

  // minRating is applied as a HAVING filter on classScore (aggregate).

  if (attributes) {
    // GER filter (Emory requirement designation), stored on sections.ger_codes as ",HA,CW,"
    const gerList = attributes.split(",").map((a) => a.trim()).filter(Boolean);
    if (gerList.length > 0) {
      // AND semantics at the *course* level:
      // A course matches only if it contains *all* selected GER codes across its active sections.
      //
      // Implementation detail: we keep an OR in the WHERE to reduce scanned rows, then apply
      // HAVING (added later) to enforce each selected code is present at least once.
      const orParts = gerList.map(
        (code) => sql`coalesce(${sections.gerCodes}, '') LIKE ${`%,${code},%`}`
      );
      conditions.push(sql`(${sql.join(orParts, sql` OR `)})`);
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
      orderBy = sql`${classScoreExpr()} DESC NULLS LAST`;
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
      prerequisites: courses.prerequisites,
      credits: courses.credits,
      departmentId: courses.departmentId,
      attributes: courses.attributes,
      departmentCode: departments.code,
      departmentName: departments.name,
      avgQuality: courseRatings.avgQuality,
      avgDifficulty: courseRatings.avgDifficulty,
      avgWorkload: courseRatings.avgWorkload,
      reviewCount: courseRatings.reviewCount,
      classScore: classScoreExpr(),
      avgEnrollmentPercent: avgEnrollmentPercentExpr(),
      instructors: sql<any>`coalesce(
        json_agg(DISTINCT ${instructors.name})
          FILTER (WHERE ${instructors.name} IS NOT NULL),
        '[]'::json
      )`,
      campuses: sql<any>`coalesce(
        json_agg(DISTINCT ${sections.campus})
          FILTER (WHERE ${sections.campus} IS NOT NULL),
        '[]'::json
      )`,
      requirements: sql<any>`(
        array_agg(${sections.registrationRestrictions} ORDER BY length(${sections.registrationRestrictions}) DESC NULLS LAST)
          FILTER (WHERE ${sections.registrationRestrictions} IS NOT NULL)
      )[1]`,
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
    .leftJoin(instructors, eq(sections.instructorId, instructors.id))
    .leftJoin(instructorRatings, eq(sections.instructorId, instructorRatings.instructorId));

  // Instructor name filter needs instructors join; we always join (left), so just apply it.
  const filteredQuery = instructor
    ? (where
        ? baseQuery.where(and(where, ilike(instructors.name, `%${instructor}%`)))
        : baseQuery.where(ilike(instructors.name, `%${instructor}%`)))
    : (where ? baseQuery.where(where) : baseQuery);

  const groupedQueryBase = filteredQuery
    .groupBy(
      courses.id,
      courses.code,
      courses.title,
      courses.description,
      courses.prerequisites,
      courses.credits,
      courses.departmentId,
      courses.attributes,
      departments.code,
      departments.name,
      courseRatings.avgQuality,
      courseRatings.avgDifficulty,
      courseRatings.avgWorkload,
      courseRatings.reviewCount
    );

  const groupedQuery = (() => {
    const havingParts: any[] = [];

    if (attributes) {
      const gerList = attributes.split(",").map((a) => a.trim()).filter(Boolean);
      if (gerList.length > 0) {
        // Each selected code must appear in at least one active section row for the course.
        for (const code of gerList) {
          havingParts.push(
            sql`sum(case when coalesce(${sections.gerCodes}, '') LIKE ${`%,${code},%`} then 1 else 0 end) > 0`
          );
        }
      }
    }

    if (minRating) {
      havingParts.push(sql`coalesce(${classScoreExpr()}, 0) >= ${minRating}`);
    }

    return havingParts.length > 0
      ? groupedQueryBase.having(sql.join(havingParts, sql` AND `))
      : groupedQueryBase;
  })();

  const dataQuery = groupedQuery.orderBy(orderBy).limit(limit).offset(offset);

  const countBase = db
    .select({ id: courses.id })
    .from(courses)
    .innerJoin(sections, eq(courses.id, sections.courseId))
    .leftJoin(departments, eq(courses.departmentId, departments.id))
    .leftJoin(courseRatings, eq(courses.id, courseRatings.courseId))
    .leftJoin(terms, eq(sections.termCode, terms.srcdb))
    .leftJoin(instructors, eq(sections.instructorId, instructors.id))
    .leftJoin(instructorRatings, eq(sections.instructorId, instructorRatings.instructorId));

  const countWhere = instructor
    ? (where
        ? and(where, ilike(instructors.name, `%${instructor}%`))
        : ilike(instructors.name, `%${instructor}%`))
    : where;

  const countFiltered = countWhere ? countBase.where(countWhere) : countBase;

  const countGroupedBase = countFiltered.groupBy(courses.id);
  const countGrouped = (() => {
    const havingParts: any[] = [];

    if (attributes) {
      const gerList = attributes.split(",").map((a) => a.trim()).filter(Boolean);
      if (gerList.length > 0) {
        for (const code of gerList) {
          havingParts.push(
            sql`sum(case when coalesce(${sections.gerCodes}, '') LIKE ${`%,${code},%`} then 1 else 0 end) > 0`
          );
        }
      }
    }

    if (minRating) {
      // Must join instructorRatings for this HAVING to work.
      // We add the join below.
      havingParts.push(sql`coalesce(${classScoreExpr()}, 0) >= ${minRating}`);
    }

    return havingParts.length > 0
      ? countGroupedBase.having(sql.join(havingParts, sql` AND `))
      : countGroupedBase;
  })();

  const countQuery = db
    .select({ count: sql<number>`count(*)` })
    .from(countGrouped.as("t"))
    .then((r) => r[0]?.count ?? 0);

  const [data, countResult] = await Promise.all([dataQuery, countQuery]);

  return {
    data: data.map((row: any) => ({
      id: row.id,
      code: row.code,
      title: row.title,
      description: row.description,
      prerequisites: row.prerequisites ?? null,
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
      campuses: Array.isArray((row as any).campuses)
        ? (((row as any).campuses as any[]).filter((s: any) => typeof s === "string" && s.trim()) as string[])
        : (() => {
            const v = (row as any).campuses;
            if (typeof v === "string") {
              try {
                const parsed = JSON.parse(v);
                return Array.isArray(parsed)
                  ? (parsed.filter((s) => typeof s === "string" && s.trim()) as string[])
                  : [];
              } catch {
                return [];
              }
            }
            return [];
          })(),
      requirements: (() => {
        const v = (row as any).requirements;
        if (typeof v !== "string") return null;
        const t = v.trim();
        return t ? t : null;
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
      classScore: row.classScore ? parseFloat(row.classScore) : null,
      avgEnrollmentPercent: toRoundedPercent((row as any).avgEnrollmentPercent),
    })),
    meta: {
      page,
      limit,
      total: Number(countResult),
      totalPages: Math.ceil(Number(countResult) / limit),
    },
  };
}

export async function searchCourses(query: SearchQuery & CourseFilterQuery) {
  const {
    q,
    page,
    limit,
    department,
    semester,
    minRating,
    credits,
    attributes,
    instructor,
    campus,
    componentType,
    instructionMethod,
  } = query;
  const offset = (page - 1) * limit;

  const term = q.trim();
  const tsQuery = sql`plainto_tsquery('english', ${term})`;

  const courseVector = sql`(
    setweight(to_tsvector('english', coalesce(${courses.code}, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(${courses.title}, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(${courses.description}, '')), 'B')
  )`;

  // This search is intentionally "anything-ish":
  // - course code/title/description via FTS + ILIKE
  // - department code/name via ILIKE
  // - instructor name via ILIKE (section-backed, active sections only)
  const searchWhere = sql`(
    ${courseVector} @@ ${tsQuery}
    OR ${courses.code} ILIKE ${"%" + term + "%"}
    OR ${courses.title} ILIKE ${"%" + term + "%"}
    OR ${departments.code} ILIKE ${"%" + term + "%"}
    OR ${departments.name} ILIKE ${"%" + term + "%"}
    OR ${instructors.name} ILIKE ${"%" + term + "%"}
  )`;

  const whereParts: any[] = [searchWhere];
  if (department) whereParts.push(eq(departments.code, department));
  if (semester) whereParts.push(eq(terms.name, semester));
  if (credits) whereParts.push(eq(courses.credits, credits));
  if (campus) whereParts.push(eq(sections.campus, campus));
  if (componentType) whereParts.push(eq(sections.componentType, componentType));
  const normalizedInstructionMethod = normalizeInstructionMethodFilter(instructionMethod);
  if (normalizedInstructionMethod) {
    whereParts.push(eq(sections.instructionMethod, normalizedInstructionMethod));
  }
  if (instructor) {
    whereParts.push(ilike(instructors.name, `%${instructor}%`));
  }
  if (attributes) {
    const gerList = attributes.split(",").map((a) => a.trim()).filter(Boolean);
    if (gerList.length > 0) {
      const orParts = gerList.map(
        (code) => sql`coalesce(${sections.gerCodes}, '') LIKE ${`%,${code},%`}`
      );
      whereParts.push(sql`(${sql.join(orParts, sql` OR `)})`);
    }
  }

  const havingParts: any[] = [];
  if (attributes) {
    const gerList = attributes.split(",").map((a) => a.trim()).filter(Boolean);
    if (gerList.length > 0) {
      for (const code of gerList) {
        havingParts.push(
          sql`sum(case when coalesce(${sections.gerCodes}, '') LIKE ${`%,${code},%`} then 1 else 0 end) > 0`
        );
      }
    }
  }
  if (minRating) {
    havingParts.push(sql`coalesce(${classScoreExpr()}, 0) >= ${minRating}`);
  }

  const rankExpr = sql<number>`max(
    ts_rank(${courseVector}, ${tsQuery})
    + (case when ${courses.code} ILIKE ${"%" + term + "%"} then 0.12 else 0 end)
    + (case when ${courses.title} ILIKE ${"%" + term + "%"} then 0.08 else 0 end)
    + (case when ${departments.code} ILIKE ${"%" + term + "%"} then 0.07 else 0 end)
    + (case when ${departments.name} ILIKE ${"%" + term + "%"} then 0.06 else 0 end)
    + (case when ${instructors.name} ILIKE ${"%" + term + "%"} then 0.18 else 0 end)
  )`;

  const base = db
    .select({
      id: courses.id,
      code: courses.code,
      title: courses.title,
      description: courses.description,
      prerequisites: courses.prerequisites,
      credits: courses.credits,
      departmentId: courses.departmentId,
      attributes: courses.attributes,
      departmentCode: departments.code,
      departmentName: departments.name,
      avgQuality: courseRatings.avgQuality,
      avgDifficulty: courseRatings.avgDifficulty,
      avgWorkload: courseRatings.avgWorkload,
      reviewCount: courseRatings.reviewCount,
      rank: rankExpr,
    })
    .from(courses)
    .innerJoin(sections, and(eq(courses.id, sections.courseId), eq(sections.isActive, true)))
    .leftJoin(departments, eq(courses.departmentId, departments.id))
    .leftJoin(courseRatings, eq(courses.id, courseRatings.courseId))
    .leftJoin(terms, eq(sections.termCode, terms.srcdb))
    .leftJoin(instructors, eq(sections.instructorId, instructors.id))
    .leftJoin(instructorRatings, eq(sections.instructorId, instructorRatings.instructorId))
    .where(and(...whereParts))
    .groupBy(
      courses.id,
      courses.code,
      courses.title,
      courses.description,
      courses.prerequisites,
      courses.credits,
      courses.departmentId,
      courses.attributes,
      departments.code,
      departments.name,
      courseRatings.avgQuality,
      courseRatings.avgDifficulty,
      courseRatings.avgWorkload,
      courseRatings.reviewCount
    );

  const groupedBase =
    havingParts.length > 0 ? base.having(sql.join(havingParts, sql` AND `)) : base;

  const data = await groupedBase
    .orderBy(desc(rankExpr), asc(courses.code))
    .limit(limit)
    .offset(offset);

  const total = await db
    .select({ count: sql<number>`count(*)` })
    .from(groupedBase.as("t"))
    .then((r) => r[0]?.count ?? 0);

  const courseIds = data.map((r) => r.id);
  const instructorsByCourse = new Map<number, string[]>();
  const classScoreByCourse = new Map<number, number | null>();
  const avgEnrollmentByCourse = new Map<number, number | null>();
  const campusesByCourse = new Map<number, string[]>();
  const gersByCourse = new Map<number, string[]>();
  const requirementsByCourse = new Map<number, string | null>();
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

    const detailRows = await db
      .select({
        courseId: sections.courseId,
        campus: sections.campus,
        gerCodes: sections.gerCodes,
        requirements: sections.registrationRestrictions,
      })
      .from(sections)
      .where(and(inArray(sections.courseId, courseIds), eq(sections.isActive, true)));

    const campusSets = new Map<number, Set<string>>();
    const gerSets = new Map<number, Set<string>>();
    for (const r of detailRows as any[]) {
      const id = r.courseId as number;
      if (typeof r.campus === "string" && r.campus.trim()) {
        const s = campusSets.get(id) ?? new Set<string>();
        s.add(r.campus.trim());
        campusSets.set(id, s);
      }

      const rawGer = typeof r.gerCodes === "string" ? r.gerCodes.trim() : "";
      if (rawGer) {
        const s = gerSets.get(id) ?? new Set<string>();
        for (const code of rawGer.split(",")) {
          const v = code.trim();
          if (v) s.add(v);
        }
        gerSets.set(id, s);
      }

      const reqText = typeof r.requirements === "string" ? r.requirements.trim() : "";
      if (reqText) {
        const prev = requirementsByCourse.get(id) ?? null;
        if (!prev || reqText.length > prev.length) {
          requirementsByCourse.set(id, reqText);
        }
      }
    }

    for (const id of courseIds) {
      campusesByCourse.set(id, Array.from(campusSets.get(id) ?? new Set<string>()));
      gersByCourse.set(id, Array.from(gerSets.get(id) ?? new Set<string>()));
      if (!requirementsByCourse.has(id)) requirementsByCourse.set(id, null);
    }

    const scoreRows = await db
      .select({
        courseId: sections.courseId,
        classScore: classScoreExpr(),
        avgEnrollmentPercent: avgEnrollmentPercentExpr(),
      })
      .from(sections)
      .leftJoin(instructorRatings, eq(sections.instructorId, instructorRatings.instructorId))
      .where(and(inArray(sections.courseId, courseIds), eq(sections.isActive, true)))
      .groupBy(sections.courseId);

    for (const r of scoreRows as any[]) {
      classScoreByCourse.set(
        r.courseId,
        r.classScore ? parseFloat(r.classScore) : null
      );
      avgEnrollmentByCourse.set(r.courseId, toRoundedPercent(r.avgEnrollmentPercent));
    }
  }

  return {
    data: data.map((row) => ({
      id: row.id,
      code: row.code,
      title: row.title,
      description: row.description,
      prerequisites: (row as any).prerequisites ?? null,
      credits: row.credits,
      departmentId: row.departmentId,
      attributes: row.attributes ?? null,
      instructors: instructorsByCourse.get(row.id) ?? [],
      campuses: campusesByCourse.get(row.id) ?? [],
      gers: gersByCourse.get(row.id) ?? [],
      requirements: requirementsByCourse.get(row.id) ?? null,
      department: row.departmentCode
        ? { id: row.departmentId!, code: row.departmentCode, name: row.departmentName! }
        : null,
      avgQuality: row.avgQuality ? parseFloat(row.avgQuality) : null,
      avgDifficulty: row.avgDifficulty ? parseFloat(row.avgDifficulty) : null,
      avgWorkload: row.avgWorkload ? parseFloat(row.avgWorkload) : null,
      reviewCount: row.reviewCount ?? 0,
      classScore: classScoreByCourse.get(row.id) ?? null,
      avgEnrollmentPercent: avgEnrollmentByCourse.get(row.id) ?? null,
    })),
    meta: {
      page,
      limit,
      total: Number(total),
      totalPages: Math.ceil(Number(total) / limit) || 1,
    },
  };
}

export async function getCourseById(id: number) {
  const [course] = await db
    .select({
      id: courses.id,
      code: courses.code,
      title: courses.title,
      description: courses.description,
      prerequisites: courses.prerequisites,
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

  // Detect cross-listed courses in parallel with sections + professors.
  // Two signals:
  //   1. Same title (case-insensitive) — Emory always gives cross-lists the same title.
  //   2. Shared active section — same instructor + same meeting display + same term,
  //      meaning two codes literally run as the same physical class.
  const crossListPromise = db.execute(sql`
    SELECT DISTINCT c.id, c.code, c.department_id,
           d.code  AS dept_code,
           d.name  AS dept_name
    FROM   courses c
    LEFT JOIN departments d ON d.id = c.department_id
    WHERE  c.id != ${id}
      AND (
        lower(c.title) = lower((SELECT title FROM courses WHERE id = ${id}))
        OR EXISTS (
          SELECT 1
          FROM   sections s1
          JOIN   sections s2
                 ON  s1.instructor_id  = s2.instructor_id
                 AND s1.meets_display  = s2.meets_display
                 AND s1.term_code      = s2.term_code
          WHERE  s1.course_id = ${id}
            AND  s2.course_id = c.id
            AND  s1.is_active = true
            AND  s2.is_active = true
            AND  s1.instructor_id IS NOT NULL
            AND  s1.meets_display IS NOT NULL
            AND  s1.meets_display != ''
        )
      )
    ORDER BY c.code
  `);

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
	      sectionDescription: sections.sectionDescription,
	      registrationRestrictions: sections.registrationRestrictions,
	      meetings: sections.meetings,
	      createdAt: sections.createdAt,
	      avgQuality: sectionRatings.avgQuality,
	      avgDifficulty: sectionRatings.avgDifficulty,
	      avgWorkload: sectionRatings.avgWorkload,
      sectionReviewCount: sectionRatings.reviewCount,
      instructorAvgQuality: instructorRatings.avgQuality,
      instructorReviewCount: instructorRatings.reviewCount,
    })
    .from(sections)
    .leftJoin(instructors, eq(sections.instructorId, instructors.id))
    .leftJoin(terms, eq(sections.termCode, terms.srcdb))
    .leftJoin(sectionRatings, eq(sections.id, sectionRatings.sectionId))
    .leftJoin(instructorRatings, eq(sections.instructorId, instructorRatings.instructorId))
    .where(and(eq(sections.courseId, id), eq(sections.isActive, true)));

  const [professors, crossListRows] = await Promise.all([
    db
      .selectDistinct({
        id: instructors.id,
        name: instructors.name,
        email: instructors.email,
        departmentId: instructors.departmentId,
        avgQuality: courseInstructorRatings.avgQuality,
        avgDifficulty: courseInstructorRatings.avgDifficulty,
        avgWorkload: courseInstructorRatings.avgWorkload,
        reviewCount: courseInstructorRatings.reviewCount,
      })
      .from(sections)
      .innerJoin(instructors, eq(sections.instructorId, instructors.id))
      .leftJoin(
        courseInstructorRatings,
        and(
          eq(courseInstructorRatings.courseId, sections.courseId),
          eq(courseInstructorRatings.instructorId, sections.instructorId)
        )
      )
      .where(and(eq(sections.courseId, id), eq(sections.isActive, true)))
      .orderBy(asc(instructors.name)),
    crossListPromise,
  ]);
  const candidateCourseIds = Array.from(
    new Set(
      (crossListRows as any[])
        .map((row) => Number(row.id))
        .filter((courseId) => Number.isInteger(courseId))
    )
  );

  let filteredCrossListRows = crossListRows as any[];

  if (candidateCourseIds.length > 0) {
    const signatureRows = await db
      .select({
        courseId: sections.courseId,
        termCode: sections.termCode,
        instructorId: sections.instructorId,
        meetsDisplay: sections.meetsDisplay,
      })
      .from(sections)
      .where(
        and(
          eq(sections.isActive, true),
          inArray(sections.courseId, [id, ...candidateCourseIds])
        )
      );

    const signatureMap = buildCrossListSignatureMap(signatureRows);
    const sourceSignatures = signatureMap.get(id);

    filteredCrossListRows = filteredCrossListRows.filter((row) =>
      haveExactCrossListSignatures(sourceSignatures, signatureMap.get(Number(row.id)))
    );
  }

  const distinctSectionDescriptions = Array.from(
    new Set(
      (courseSections as any[])
        .map((s) =>
          typeof s.sectionDescription === "string" ? s.sectionDescription.trim() : ""
        )
        .filter(Boolean)
    )
  );
  const hasMultipleSectionDescriptions = distinctSectionDescriptions.length > 1;
  const resolvedCourseDescription = hasMultipleSectionDescriptions
    ? null
    : (course.description ?? distinctSectionDescriptions[0] ?? null);

  return {
    id: course.id,
    code: course.code,
    title: course.title,
    description: resolvedCourseDescription,
    prerequisites: course.prerequisites ?? null,
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
    classScore: (() => {
      const seen = new Map<number, number>();
      for (const s of courseSections as any[]) {
        if (typeof s.instructorId !== "number") continue;
        if (!s.instructorAvgQuality) continue;
        const v = parseFloat(s.instructorAvgQuality);
        if (Number.isFinite(v)) seen.set(s.instructorId, v);
      }
      const vals = Array.from(seen.values());
      if (vals.length === 0) return null;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    })(),
    gers: Array.from(
      new Set(
        courseSections
          .flatMap((s) => String(s.gerCodes ?? "").split(","))
          .map((x) => x.trim())
          .filter(Boolean)
      )
    ),
    professors: professors.map((p: any) => ({
      id: p.id,
      name: p.name,
      email: p.email ?? null,
      departmentId: p.departmentId ?? null,
      avgQuality: p.avgQuality ? parseFloat(p.avgQuality) : null,
      avgDifficulty: p.avgDifficulty ? parseFloat(p.avgDifficulty) : null,
      avgWorkload: p.avgWorkload ? parseFloat(p.avgWorkload) : null,
      reviewCount: p.reviewCount ?? 0,
    })),
    crossListedWith: filteredCrossListRows.map((r) => ({
      id: Number(r.id),
      code: String(r.code),
      department: r.dept_code
        ? { id: Number(r.department_id), code: String(r.dept_code), name: String(r.dept_name) }
        : null,
    })),
    sections: courseSections.map((s) => {
      const schedules = schedulesFromMeetings(s.meetings);
      return {
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
        sectionDescription:
          typeof s.sectionDescription === "string" && s.sectionDescription.trim()
            ? s.sectionDescription.trim()
            : null,
        registrationRestrictions: s.registrationRestrictions ?? null,
        instructor: s.instructorName
          ? {
              id: s.instructorId!,
              name: s.instructorName,
              email: s.instructorEmail ?? null,
              departmentId: s.instructorDepartmentId ?? null,
            }
          : undefined,
        schedule: scheduleFromMeetings(s.meetings),
        schedules,
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
      avgQuality: s.avgQuality ? parseFloat(s.avgQuality) : null,
      avgDifficulty: s.avgDifficulty ? parseFloat(s.avgDifficulty) : null,
      avgWorkload: s.avgWorkload ? parseFloat(s.avgWorkload) : null,
      reviewCount: s.sectionReviewCount ?? 0,
      instructorAvgQuality: s.instructorAvgQuality ? parseFloat(s.instructorAvgQuality) : null,
      instructorReviewCount: s.instructorReviewCount ?? 0,
      createdAt: s.createdAt?.toISOString() ?? "",
      };
    }),
  };
}

const EMBEDDINGS_AVAIL_TTL_MS = 5 * 60 * 1000; // 5m
let embeddingsAvailCache: { value: boolean; updatedAt: number } | null = null;
let embeddingsAvailInFlight: Promise<boolean> | null = null;

export async function areCourseEmbeddingsAvailable(): Promise<boolean> {
  if (embeddingsAvailCache && Date.now() - embeddingsAvailCache.updatedAt < EMBEDDINGS_AVAIL_TTL_MS) {
    return embeddingsAvailCache.value;
  }
  if (embeddingsAvailInFlight) return embeddingsAvailInFlight;

  embeddingsAvailInFlight = (async () => {
    try {
      const rows = (await db.execute(sql`
        select to_regclass('public.course_embeddings') as rel
      `)) as any[];
      const ok = Boolean(rows?.[0]?.rel);
      embeddingsAvailCache = { value: ok, updatedAt: Date.now() };
      return ok;
    } catch {
      embeddingsAvailCache = { value: false, updatedAt: Date.now() };
      return false;
    } finally {
      embeddingsAvailInFlight = null;
    }
  })();

  return embeddingsAvailInFlight;
}

export async function listDepartments() {
  return db.select().from(departments).orderBy(asc(departments.code));
}

function embeddingToVectorLiteral(embedding: number[]) {
  const clean = embedding.map((v) => (Number.isFinite(v) ? v : 0));
  return `[${clean.join(",")}]`;
}

export async function semanticSearchCoursesByEmbedding(input: {
  embedding: number[];
  limit: number;
  filters?: CourseFilterQuery;
}): Promise<CourseWithRatings[]> {
  const { embedding, limit, filters } = input;
  if (!Array.isArray(embedding) || embedding.length === 0) return [];

  const vec = embeddingToVectorLiteral(embedding);

  const filterWhereParts: any[] = [
    sql`s.course_id = ce.course_id`,
    sql`s.is_active = true`,
  ];
  if (filters?.department) filterWhereParts.push(sql`d.code = ${filters.department}`);
  if (filters?.semester) filterWhereParts.push(sql`t.name = ${filters.semester}`);
  if (filters?.credits) filterWhereParts.push(sql`c.credits = ${filters.credits}`);
  if (filters?.campus) filterWhereParts.push(sql`s.campus = ${filters.campus}`);
  if (filters?.componentType) filterWhereParts.push(sql`s.component_type = ${filters.componentType}`);
  const normalizedInstructionMethod = normalizeInstructionMethodFilter(filters?.instructionMethod);
  if (normalizedInstructionMethod) {
    filterWhereParts.push(sql`s.instruction_method = ${normalizedInstructionMethod}`);
  }
  if (filters?.instructor) {
    filterWhereParts.push(sql`i.name ILIKE ${"%" + filters.instructor + "%"}`);
  }
  if (filters?.attributes) {
    const gerList = filters.attributes.split(",").map((a) => a.trim()).filter(Boolean);
    if (gerList.length > 0) {
      const orParts = gerList.map(
        (code) => sql`coalesce(s.ger_codes, '') LIKE ${`%,${code},%`}`
      );
      filterWhereParts.push(sql`(${sql.join(orParts, sql` OR `)})`);
    }
  }

  const filterHavingParts: any[] = [];
  if (filters?.attributes) {
    const gerList = filters.attributes.split(",").map((a) => a.trim()).filter(Boolean);
    if (gerList.length > 0) {
      for (const code of gerList) {
        filterHavingParts.push(
          sql`sum(case when coalesce(s.ger_codes, '') LIKE ${`%,${code},%`} then 1 else 0 end) > 0`
        );
      }
    }
  }
  if (filters?.minRating) {
    filterHavingParts.push(sql`coalesce(avg(distinct ir.avg_quality), 0) >= ${filters.minRating}`);
  }
  const filterHavingSql =
    filterHavingParts.length > 0
      ? sql`having ${sql.join(filterHavingParts, sql` AND `)}`
      : sql``;

  // Raw query so we don't have to add Drizzle schema for pgvector tables.
  const rows = (await db.execute(sql`
    select
      ce.course_id as course_id,
      (ce.embedding <=> ${vec}::vector) as distance
    from course_embeddings ce
    where exists (
      select 1
      from sections s
      left join terms t on s.term_code = t.srcdb
      left join instructors i on s.instructor_id = i.id
      left join instructor_ratings ir on s.instructor_id = ir.instructor_id
      left join courses c on s.course_id = c.id
      left join departments d on c.department_id = d.id
      where ${sql.join(filterWhereParts, sql` and `)}
      group by s.course_id
      ${filterHavingSql}
    )
    order by ce.embedding <=> ${vec}::vector asc
    limit ${Math.max(1, Math.min(200, limit))}
  `)) as any[];

  const rankedIds = rows
    .map((r) => Number(r?.course_id))
    .filter((id) => Number.isFinite(id)) as number[];

  if (rankedIds.length === 0) return [];

  // Fetch core course + ratings + department for just these ids.
  const data = await db
    .select({
      id: courses.id,
      code: courses.code,
      title: courses.title,
      description: courses.description,
      prerequisites: courses.prerequisites,
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
    .leftJoin(departments, eq(courses.departmentId, departments.id))
    .leftJoin(courseRatings, eq(courses.id, courseRatings.courseId))
    .where(inArray(courses.id, rankedIds));

  const courseIds = data.map((r) => r.id);
  const instructorsByCourse = new Map<number, string[]>();
  const classScoreByCourse = new Map<number, number | null>();
  const avgEnrollmentByCourse = new Map<number, number | null>();
  const campusesByCourse = new Map<number, string[]>();
  const gersByCourse = new Map<number, string[]>();
  const requirementsByCourse = new Map<number, string | null>();

  if (courseIds.length > 0) {
    const instructorRows = await db
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

    for (const r of instructorRows as any[]) {
      const v = Array.isArray(r.instructors) ? r.instructors : [];
      instructorsByCourse.set(
        r.courseId,
        v.filter((s: any) => typeof s === "string" && s.trim())
      );
    }

    const detailRows = await db
      .select({
        courseId: sections.courseId,
        campus: sections.campus,
        gerCodes: sections.gerCodes,
        requirements: sections.registrationRestrictions,
      })
      .from(sections)
      .where(and(inArray(sections.courseId, courseIds), eq(sections.isActive, true)));

    const campusSets = new Map<number, Set<string>>();
    const gerSets = new Map<number, Set<string>>();
    for (const r of detailRows as any[]) {
      const id = r.courseId as number;
      if (typeof r.campus === "string" && r.campus.trim()) {
        const s = campusSets.get(id) ?? new Set<string>();
        s.add(r.campus.trim());
        campusSets.set(id, s);
      }

      const rawGer = typeof r.gerCodes === "string" ? r.gerCodes.trim() : "";
      if (rawGer) {
        const s = gerSets.get(id) ?? new Set<string>();
        for (const code of rawGer.split(",")) {
          const v = code.trim();
          if (v) s.add(v);
        }
        gerSets.set(id, s);
      }

      const reqText = typeof r.requirements === "string" ? r.requirements.trim() : "";
      if (reqText) {
        const prev = requirementsByCourse.get(id) ?? null;
        if (!prev || reqText.length > prev.length) {
          requirementsByCourse.set(id, reqText);
        }
      }
    }

    for (const id of courseIds) {
      campusesByCourse.set(id, Array.from(campusSets.get(id) ?? new Set<string>()));
      gersByCourse.set(id, Array.from(gerSets.get(id) ?? new Set<string>()));
      if (!requirementsByCourse.has(id)) requirementsByCourse.set(id, null);
    }

    const scoreRows = await db
      .select({
        courseId: sections.courseId,
        classScore: classScoreExpr(),
        avgEnrollmentPercent: avgEnrollmentPercentExpr(),
      })
      .from(sections)
      .leftJoin(instructorRatings, eq(sections.instructorId, instructorRatings.instructorId))
      .where(and(inArray(sections.courseId, courseIds), eq(sections.isActive, true)))
      .groupBy(sections.courseId);

    for (const r of scoreRows as any[]) {
      classScoreByCourse.set(
        r.courseId,
        r.classScore ? parseFloat(r.classScore) : null
      );
      avgEnrollmentByCourse.set(r.courseId, toRoundedPercent(r.avgEnrollmentPercent));
    }
  }

  const byId = new Map<number, CourseWithRatings>();
  for (const row of data as any[]) {
    byId.set(row.id, {
      id: row.id,
      code: row.code,
      title: row.title,
      description: row.description,
      prerequisites: row.prerequisites ?? null,
      credits: row.credits,
      departmentId: row.departmentId,
      attributes: row.attributes ?? null,
      instructors: instructorsByCourse.get(row.id) ?? [],
      campuses: campusesByCourse.get(row.id) ?? [],
      gers: gersByCourse.get(row.id) ?? [],
      requirements: requirementsByCourse.get(row.id) ?? null,
      department: row.departmentCode
        ? { id: row.departmentId!, code: row.departmentCode, name: row.departmentName! }
        : null,
      avgQuality: row.avgQuality ? parseFloat(row.avgQuality) : null,
      avgDifficulty: row.avgDifficulty ? parseFloat(row.avgDifficulty) : null,
      avgWorkload: row.avgWorkload ? parseFloat(row.avgWorkload) : null,
      reviewCount: row.reviewCount ?? 0,
      classScore: classScoreByCourse.get(row.id) ?? null,
      avgEnrollmentPercent: avgEnrollmentByCourse.get(row.id) ?? null,
    });
  }

  return rankedIds.map((id) => byId.get(id)).filter(Boolean) as CourseWithRatings[];
}
