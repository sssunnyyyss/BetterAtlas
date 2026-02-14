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

export async function getReviewsForCourse(courseId: number) {
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
      comment: reviews.comment,
      isAnonymous: reviews.isAnonymous,
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
    .where(eq(reviews.courseId, courseId))
    .orderBy(desc(reviews.createdAt));

  return data.map((r) => ({
    id: r.id,
    userId: r.userId,
    courseId: r.courseId,
    semester: r.termName ?? r.termCode,
    sectionId: r.sectionId ?? null,
    instructorId: r.instructorId ?? null,
    instructor: r.instructorId && r.instructorName ? { id: r.instructorId, name: r.instructorName } : null,
    ratingQuality: r.ratingQuality,
    ratingDifficulty: r.ratingDifficulty,
    ratingWorkload: r.ratingWorkload,
    comment: r.comment,
    isAnonymous: r.isAnonymous,
    createdAt: r.createdAt?.toISOString() ?? "",
    updatedAt: r.updatedAt?.toISOString() ?? "",
    author: r.isAnonymous ? null : { username: r.username ?? "user" },
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
      comment: reviews.comment,
      isAnonymous: reviews.isAnonymous,
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
    ratingQuality: r.ratingQuality,
    ratingDifficulty: r.ratingDifficulty,
    ratingWorkload: r.ratingWorkload,
    comment: r.comment,
    isAnonymous: r.isAnonymous,
    createdAt: r.createdAt?.toISOString() ?? "",
    updatedAt: r.updatedAt?.toISOString() ?? "",
    // This is a private "my reviews" view.
    author: { username: r.username ?? "you" },
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
      comment: reviews.comment,
      isAnonymous: reviews.isAnonymous,
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

  return data.map((r) => ({
    id: r.id,
    userId: r.userId,
    courseId: r.courseId,
    semester: r.termName ?? r.termCode,
    sectionId: r.sectionId ?? null,
    instructorId: r.instructorId ?? null,
    instructor: r.instructorId && r.instructorName ? { id: r.instructorId, name: r.instructorName } : null,
    ratingQuality: r.ratingQuality,
    ratingDifficulty: r.ratingDifficulty,
    ratingWorkload: r.ratingWorkload,
    comment: r.comment,
    isAnonymous: r.isAnonymous,
    createdAt: r.createdAt?.toISOString() ?? "",
    updatedAt: r.updatedAt?.toISOString() ?? "",
    author: r.isAnonymous ? null : { username: r.username ?? "user" },
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
      ratingQuality: input.ratingQuality,
      ratingDifficulty: input.ratingDifficulty,
      ratingWorkload: input.ratingWorkload,
      comment: input.comment ?? null,
      isAnonymous: input.isAnonymous,
    })
    .returning();

  await refreshCourseRatings(courseId);
  await refreshCourseInstructorRatings(courseId);
  await refreshSectionRatings(input.sectionId);
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
      ratingQuality: input.ratingQuality ?? undefined,
      ratingDifficulty: input.ratingDifficulty ?? undefined,
      ratingWorkload: input.ratingWorkload ?? undefined,
      comment: input.comment ?? undefined,
      isAnonymous: input.isAnonymous ?? undefined,
      updatedAt: new Date(),
    })
    .where(eq(reviews.id, reviewId))
    .returning();

  await refreshCourseRatings(existing.courseId);
  await refreshCourseInstructorRatings(existing.courseId);
  if (existing.sectionId) await refreshSectionRatings(existing.sectionId);
  if (existing.instructorId) await refreshInstructorRatings(existing.instructorId);
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
  await refreshCourseRatings(existing.courseId);
  await refreshCourseInstructorRatings(existing.courseId);
  if (existing.sectionId) await refreshSectionRatings(existing.sectionId);
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

  await db
    .insert(courseRatings)
    .values({
      courseId,
      avgQuality: agg.avgQuality,
      avgDifficulty: agg.avgDifficulty,
      avgWorkload: agg.avgWorkload,
      reviewCount: agg.count,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: courseRatings.courseId,
      set: {
        avgQuality: agg.avgQuality,
        avgDifficulty: agg.avgDifficulty,
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
