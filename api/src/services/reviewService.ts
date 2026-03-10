import { db } from "../db/index.js";
import {
  reviews,
  courseRatings,
  courseInstructorRatings,
  sectionRatings,
  instructorRatings,
  users,
  terms,
  instructors,
  sections,
  courses,
} from "../db/schema.js";
import { eq, and, sql, desc } from "drizzle-orm";
import type { CreateReviewInput, UpdateReviewInput } from "@betteratlas/shared";
import { resolveTermCode } from "./termLookup.js";
import { listBadgesForUsers } from "./badgeService.js";

type ReviewSource = "native" | "rmp";

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function toHalfStepString(value: number): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    throw new Error("Invalid rating value");
  }
  return (Math.round(n * 2) / 2).toFixed(1);
}

export async function getReviewsForCourse(
  courseId: number,
  source?: ReviewSource
) {
  const conditions = [eq(reviews.courseId, courseId)];
  if (source) {
    conditions.push(eq(reviews.source, source));
  }

  const data = await db
    .select({
      id: reviews.id,
      userId: reviews.userId,
      courseId: reviews.courseId,
      termCode: reviews.termCode,
      termName: terms.name,
      ratingQuality: reviews.ratingQuality,
      ratingDifficulty: reviews.ratingDifficulty,
      ratingWorkload: reviews.ratingWorkload,
      tags: reviews.tags,
      reportedGrade: reviews.reportedGrade,
      gradePoints: reviews.gradePoints,
      comment: reviews.comment,
      isAnonymous: reviews.isAnonymous,
      source: reviews.source,
      createdAt: reviews.createdAt,
      updatedAt: reviews.updatedAt,
      username: users.username,
      instructorId: reviews.instructorId,
      instructorName: instructors.name,
      sectionId: reviews.sectionId,
    })
    .from(reviews)
    .leftJoin(users, eq(reviews.userId, users.id))
    .leftJoin(terms, eq(reviews.termCode, terms.srcdb))
    .leftJoin(instructors, eq(reviews.instructorId, instructors.id))
    .where(and(...conditions))
    .orderBy(desc(reviews.createdAt));
  const badgesByUser = await listBadgesForUsers(
    data.filter((r) => !r.isAnonymous).map((r) => r.userId)
  );

  return data.map((r) => ({
    id: r.id,
    userId: r.userId,
    courseId: r.courseId,
    semester: r.termName ?? r.termCode,
    sectionId: r.sectionId ?? null,
    instructorId: r.instructorId ?? null,
    instructor: r.instructorId && r.instructorName ? { id: r.instructorId, name: r.instructorName } : null,
    ratingQuality: toNullableNumber(r.ratingQuality) ?? 0,
    ratingDifficulty: toNullableNumber(r.ratingDifficulty) ?? 0,
    ratingWorkload: toNullableNumber(r.ratingWorkload),
    tags: Array.isArray(r.tags)
      ? r.tags.filter((tag: unknown): tag is string => typeof tag === "string" && tag.trim().length > 0)
      : [],
    reportedGrade: r.reportedGrade ?? null,
    gradePoints: toNullableNumber(r.gradePoints),
    comment: r.comment,
    isAnonymous: r.isAnonymous,
    source: r.source === "rmp" ? "rmp" : "native",
    createdAt: r.createdAt?.toISOString() ?? "",
    updatedAt: r.updatedAt?.toISOString() ?? "",
    author: r.isAnonymous
      ? null
      : {
          username: r.username ?? "user",
          badges: badgesByUser.get(r.userId) ?? [],
        },
  }));
}

export async function getReviewsForUser(userId: string) {
  const data = await db
    .select({
      id: reviews.id,
      userId: reviews.userId,
      courseId: reviews.courseId,
      courseCode: courses.code,
      courseTitle: courses.title,
      sectionId: reviews.sectionId,
      sectionNumber: sections.sectionNumber,
      termCode: reviews.termCode,
      termName: terms.name,
      ratingQuality: reviews.ratingQuality,
      ratingDifficulty: reviews.ratingDifficulty,
      ratingWorkload: reviews.ratingWorkload,
      tags: reviews.tags,
      reportedGrade: reviews.reportedGrade,
      gradePoints: reviews.gradePoints,
      comment: reviews.comment,
      isAnonymous: reviews.isAnonymous,
      source: reviews.source,
      createdAt: reviews.createdAt,
      updatedAt: reviews.updatedAt,
      username: users.username,
      instructorId: reviews.instructorId,
      instructorName: instructors.name,
    })
    .from(reviews)
    .innerJoin(courses, eq(reviews.courseId, courses.id))
    .leftJoin(sections, eq(reviews.sectionId, sections.id))
    .leftJoin(terms, eq(reviews.termCode, terms.srcdb))
    .leftJoin(users, eq(reviews.userId, users.id))
    .leftJoin(instructors, eq(reviews.instructorId, instructors.id))
    .where(eq(reviews.userId, userId))
    .orderBy(desc(reviews.createdAt));
  const badgesByUser = await listBadgesForUsers([userId]);
  const userBadges = badgesByUser.get(userId) ?? [];

  return data.map((r) => ({
    id: r.id,
    userId: r.userId,
    courseId: r.courseId,
    semester: r.termName ?? r.termCode,
    sectionId: r.sectionId ?? null,
    section: r.sectionId
      ? {
          id: r.sectionId,
          sectionNumber: r.sectionNumber ?? null,
          semester: r.termName ?? r.termCode ?? null,
        }
      : null,
    instructorId: r.instructorId ?? null,
    instructor: r.instructorId && r.instructorName ? { id: r.instructorId, name: r.instructorName } : null,
    ratingQuality: toNullableNumber(r.ratingQuality) ?? 0,
    ratingDifficulty: toNullableNumber(r.ratingDifficulty) ?? 0,
    ratingWorkload: toNullableNumber(r.ratingWorkload),
    tags: Array.isArray(r.tags)
      ? r.tags.filter((tag: unknown): tag is string => typeof tag === "string" && tag.trim().length > 0)
      : [],
    reportedGrade: r.reportedGrade ?? null,
    gradePoints: toNullableNumber(r.gradePoints),
    comment: r.comment,
    isAnonymous: r.isAnonymous,
    source: r.source === "rmp" ? "rmp" : "native",
    createdAt: r.createdAt?.toISOString() ?? "",
    updatedAt: r.updatedAt?.toISOString() ?? "",
    // This is a private "my reviews" view.
    author: { username: r.username ?? "you", badges: userBadges },
    course: { id: r.courseId, code: r.courseCode, title: r.courseTitle },
  }));
}

export async function getReviewsForSection(sectionId: number) {
  const data = await db
    .select({
      id: reviews.id,
      userId: reviews.userId,
      courseId: reviews.courseId,
      sectionId: reviews.sectionId,
      termCode: reviews.termCode,
      termName: terms.name,
      ratingQuality: reviews.ratingQuality,
      ratingDifficulty: reviews.ratingDifficulty,
      ratingWorkload: reviews.ratingWorkload,
      tags: reviews.tags,
      reportedGrade: reviews.reportedGrade,
      gradePoints: reviews.gradePoints,
      comment: reviews.comment,
      isAnonymous: reviews.isAnonymous,
      source: reviews.source,
      createdAt: reviews.createdAt,
      updatedAt: reviews.updatedAt,
      username: users.username,
      instructorId: reviews.instructorId,
      instructorName: instructors.name,
    })
    .from(reviews)
    .leftJoin(users, eq(reviews.userId, users.id))
    .leftJoin(terms, eq(reviews.termCode, terms.srcdb))
    .leftJoin(instructors, eq(reviews.instructorId, instructors.id))
    .where(eq(reviews.sectionId, sectionId))
    .orderBy(desc(reviews.createdAt));
  const badgesByUser = await listBadgesForUsers(
    data.filter((r) => !r.isAnonymous).map((r) => r.userId)
  );

  return data.map((r) => ({
    id: r.id,
    userId: r.userId,
    courseId: r.courseId,
    semester: r.termName ?? r.termCode,
    sectionId: r.sectionId ?? null,
    instructorId: r.instructorId ?? null,
    instructor: r.instructorId && r.instructorName ? { id: r.instructorId, name: r.instructorName } : null,
    ratingQuality: toNullableNumber(r.ratingQuality) ?? 0,
    ratingDifficulty: toNullableNumber(r.ratingDifficulty) ?? 0,
    ratingWorkload: toNullableNumber(r.ratingWorkload),
    tags: Array.isArray(r.tags)
      ? r.tags.filter((tag: unknown): tag is string => typeof tag === "string" && tag.trim().length > 0)
      : [],
    reportedGrade: r.reportedGrade ?? null,
    gradePoints: toNullableNumber(r.gradePoints),
    comment: r.comment,
    isAnonymous: r.isAnonymous,
    source: r.source === "rmp" ? "rmp" : "native",
    createdAt: r.createdAt?.toISOString() ?? "",
    updatedAt: r.updatedAt?.toISOString() ?? "",
    author: r.isAnonymous
      ? null
      : {
          username: r.username ?? "user",
          badges: badgesByUser.get(r.userId) ?? [],
        },
  }));
}

export async function createReview(
  userId: string,
  courseId: number,
  input: CreateReviewInput
) {
  const termCode = await resolveTermCode(input.semester);

  const [section] = await db
    .select({
      id: sections.id,
      courseId: sections.courseId,
      instructorId: sections.instructorId,
      termCode: sections.termCode,
    })
    .from(sections)
    .where(eq(sections.id, input.sectionId))
    .limit(1);

  if (!section || section.courseId !== courseId) {
    throw new Error("Selected section does not belong to this course");
  }

  const [review] = await db
    .insert(reviews)
    .values({
      userId,
      courseId,
      sectionId: input.sectionId,
      instructorId: section.instructorId ?? null,
      termCode,
      ratingQuality: toHalfStepString(input.ratingQuality),
      ratingDifficulty: toHalfStepString(input.ratingDifficulty),
      ratingWorkload:
        typeof input.ratingWorkload === "number"
          ? toHalfStepString(input.ratingWorkload)
          : null,
      comment: input.comment ?? null,
      isAnonymous: input.isAnonymous,
    })
    .returning();

  await refreshSectionRatings(input.sectionId);
  await refreshCourseRatings(courseId);
  await refreshCourseInstructorRatings(courseId);
  if (section.instructorId) await refreshInstructorRatings(section.instructorId);
  return review;
}

export async function updateReview(
  reviewId: number,
  userId: string,
  input: UpdateReviewInput
) {
  const [existing] = await db
    .select()
    .from(reviews)
    .where(and(eq(reviews.id, reviewId), eq(reviews.userId, userId)))
    .limit(1);

  if (!existing) return null;

  const termCode = input.semester ? await resolveTermCode(input.semester) : undefined;
  let nextInstructorId: number | null | undefined = undefined;
  if (input.sectionId) {
    const [section] = await db
      .select({ id: sections.id, courseId: sections.courseId, instructorId: sections.instructorId })
      .from(sections)
      .where(eq(sections.id, input.sectionId))
      .limit(1);
    if (section && section.courseId === existing.courseId) {
      nextInstructorId = section.instructorId ?? null;
    }
  }

  const [updated] = await db
    .update(reviews)
    .set({
      termCode: termCode ?? undefined,
      sectionId: input.sectionId ?? undefined,
      instructorId: nextInstructorId,
      ratingQuality:
        typeof input.ratingQuality === "number"
          ? toHalfStepString(input.ratingQuality)
          : undefined,
      ratingDifficulty:
        typeof input.ratingDifficulty === "number"
          ? toHalfStepString(input.ratingDifficulty)
          : undefined,
      ratingWorkload:
        input.ratingWorkload === undefined
          ? undefined
          : input.ratingWorkload === null
            ? null
            : toHalfStepString(input.ratingWorkload),
      comment: input.comment ?? undefined,
      isAnonymous: input.isAnonymous ?? undefined,
      updatedAt: new Date(),
    })
    .where(eq(reviews.id, reviewId))
    .returning();

  const touchedSections = new Set<number>();
  if (existing.sectionId) touchedSections.add(existing.sectionId);
  if (updated.sectionId) touchedSections.add(updated.sectionId);
  for (const sectionId of touchedSections) {
    await refreshSectionRatings(sectionId);
  }

  await refreshCourseRatings(existing.courseId);
  await refreshCourseInstructorRatings(existing.courseId);

  const touchedInstructors = new Set<number>();
  if (existing.instructorId) touchedInstructors.add(existing.instructorId);
  if (updated.instructorId) touchedInstructors.add(updated.instructorId);
  for (const instructorId of touchedInstructors) {
    await refreshInstructorRatings(instructorId);
  }
  return updated;
}

export async function deleteReview(reviewId: number, userId: string) {
  const [existing] = await db
    .select()
    .from(reviews)
    .where(and(eq(reviews.id, reviewId), eq(reviews.userId, userId)))
    .limit(1);

  if (!existing) return false;

  await db.delete(reviews).where(eq(reviews.id, reviewId));
  if (existing.sectionId) await refreshSectionRatings(existing.sectionId);
  await refreshCourseRatings(existing.courseId);
  await refreshCourseInstructorRatings(existing.courseId);
  if (existing.instructorId) await refreshInstructorRatings(existing.instructorId);
  return true;
}

async function refreshCourseRatings(courseId: number) {
  const [agg] = await db
    .select({
      avgQuality: sql<string>`avg(${reviews.ratingQuality})::numeric(3,2)`,
      avgDifficulty: sql<string>`avg(${reviews.ratingDifficulty})::numeric(3,2)`,
      avgWorkload: sql<string>`avg(${reviews.ratingWorkload})::numeric(3,2)`,
      count: sql<number>`count(*)`,
    })
    .from(reviews)
    .where(eq(reviews.courseId, courseId));

  // Course difficulty = average of section difficulties (unweighted by section size).
  // Fallback to raw review average only for legacy rows with no section aggregates yet.
  const [sectionAgg] = await db
    .select({
      avgDifficulty: sql<string>`avg(${sectionRatings.avgDifficulty})::numeric(3,2)`,
    })
    .from(sectionRatings)
    .innerJoin(sections, eq(sectionRatings.sectionId, sections.id))
    .where(
      and(
        eq(sections.courseId, courseId),
        sql`${sectionRatings.avgDifficulty} is not null`
      )
    );
  const sectionAvgDifficulty = sectionAgg?.avgDifficulty ?? null;
  const resolvedCourseDifficulty = sectionAvgDifficulty ?? agg.avgDifficulty;

  await db
    .insert(courseRatings)
    .values({
      courseId,
      avgQuality: agg.avgQuality,
      avgDifficulty: resolvedCourseDifficulty,
      avgWorkload: agg.avgWorkload,
      reviewCount: agg.count,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: courseRatings.courseId,
      set: {
        avgQuality: agg.avgQuality,
        avgDifficulty: resolvedCourseDifficulty,
        avgWorkload: agg.avgWorkload,
        reviewCount: agg.count,
        updatedAt: new Date(),
      },
    });
}

async function refreshCourseInstructorRatings(courseId: number) {
  const aggs = await db
    .select({
      instructorId: reviews.instructorId,
      avgQuality: sql<string>`avg(${reviews.ratingQuality})::numeric(3,2)`,
      avgDifficulty: sql<string>`avg(${reviews.ratingDifficulty})::numeric(3,2)`,
      avgWorkload: sql<string>`avg(${reviews.ratingWorkload})::numeric(3,2)`,
      count: sql<number>`count(*)`,
    })
    .from(reviews)
    .where(and(eq(reviews.courseId, courseId), sql`${reviews.instructorId} is not null`))
    .groupBy(reviews.instructorId);

  const instructorIds = aggs
    .map((r) => r.instructorId)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));

  if (instructorIds.length === 0) {
    await db.delete(courseInstructorRatings).where(eq(courseInstructorRatings.courseId, courseId));
    return;
  }

  // Delete stale aggregates for professors that no longer have reviews.
  await db.delete(courseInstructorRatings).where(
    and(
      eq(courseInstructorRatings.courseId, courseId),
      sql`${courseInstructorRatings.instructorId} NOT IN (${sql.join(
        instructorIds.map((v) => sql`${v}`),
        sql`, `
      )})`
    )
  );

  // Upsert all current aggregates.
  for (const agg of aggs) {
    const instructorId = agg.instructorId as number | null;
    if (!instructorId) continue;
    await db
      .insert(courseInstructorRatings)
      .values({
        courseId,
        instructorId,
        avgQuality: agg.avgQuality,
        avgDifficulty: agg.avgDifficulty,
        avgWorkload: agg.avgWorkload,
        reviewCount: agg.count,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [courseInstructorRatings.courseId, courseInstructorRatings.instructorId],
        set: {
          avgQuality: agg.avgQuality,
          avgDifficulty: agg.avgDifficulty,
          avgWorkload: agg.avgWorkload,
          reviewCount: agg.count,
          updatedAt: new Date(),
        },
      });
  }
}

async function refreshSectionRatings(sectionId: number) {
  const [agg] = await db
    .select({
      avgQuality: sql<string>`avg(${reviews.ratingQuality})::numeric(3,2)`,
      avgDifficulty: sql<string>`avg(${reviews.ratingDifficulty})::numeric(3,2)`,
      avgWorkload: sql<string>`avg(${reviews.ratingWorkload})::numeric(3,2)`,
      count: sql<number>`count(*)`,
    })
    .from(reviews)
    .where(eq(reviews.sectionId, sectionId));

  await db
    .insert(sectionRatings)
    .values({
      sectionId,
      avgQuality: agg.avgQuality,
      avgDifficulty: agg.avgDifficulty,
      avgWorkload: agg.avgWorkload,
      reviewCount: agg.count,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: sectionRatings.sectionId,
      set: {
        avgQuality: agg.avgQuality,
        avgDifficulty: agg.avgDifficulty,
        avgWorkload: agg.avgWorkload,
        reviewCount: agg.count,
        updatedAt: new Date(),
      },
    });
}

async function refreshInstructorRatings(instructorId: number) {
  const [agg] = await db
    .select({
      avgQuality: sql<string>`avg(${reviews.ratingQuality})::numeric(3,2)`,
      count: sql<number>`count(*)`,
    })
    .from(reviews)
    .where(eq(reviews.instructorId, instructorId));

  await db
    .insert(instructorRatings)
    .values({
      instructorId,
      avgQuality: agg.avgQuality,
      reviewCount: agg.count,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: instructorRatings.instructorId,
      set: {
        avgQuality: agg.avgQuality,
        reviewCount: agg.count,
        updatedAt: new Date(),
      },
    });
}
