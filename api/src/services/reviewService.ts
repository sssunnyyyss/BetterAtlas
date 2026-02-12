import { db } from "../db/index.js";
import { reviews, courseRatings, users } from "../db/schema.js";
import { eq, and, sql, desc } from "drizzle-orm";
import type { CreateReviewInput, UpdateReviewInput } from "@betteratlas/shared";

export async function getReviewsForCourse(courseId: number) {
  const data = await db
    .select({
      id: reviews.id,
      userId: reviews.userId,
      courseId: reviews.courseId,
      semester: reviews.semester,
      ratingQuality: reviews.ratingQuality,
      ratingDifficulty: reviews.ratingDifficulty,
      ratingWorkload: reviews.ratingWorkload,
      comment: reviews.comment,
      isAnonymous: reviews.isAnonymous,
      createdAt: reviews.createdAt,
      updatedAt: reviews.updatedAt,
      displayName: users.displayName,
    })
    .from(reviews)
    .leftJoin(users, eq(reviews.userId, users.id))
    .where(eq(reviews.courseId, courseId))
    .orderBy(desc(reviews.createdAt));

  return data.map((r) => ({
    id: r.id,
    userId: r.userId,
    courseId: r.courseId,
    semester: r.semester,
    ratingQuality: r.ratingQuality,
    ratingDifficulty: r.ratingDifficulty,
    ratingWorkload: r.ratingWorkload,
    comment: r.comment,
    isAnonymous: r.isAnonymous,
    createdAt: r.createdAt?.toISOString() ?? "",
    updatedAt: r.updatedAt?.toISOString() ?? "",
    author: r.isAnonymous ? null : { displayName: r.displayName! },
  }));
}

export async function createReview(
  userId: number,
  courseId: number,
  input: CreateReviewInput
) {
  const [review] = await db
    .insert(reviews)
    .values({
      userId,
      courseId,
      semester: input.semester,
      ratingQuality: input.ratingQuality,
      ratingDifficulty: input.ratingDifficulty,
      ratingWorkload: input.ratingWorkload,
      comment: input.comment ?? null,
      isAnonymous: input.isAnonymous,
    })
    .returning();

  await refreshCourseRatings(courseId);
  return review;
}

export async function updateReview(
  reviewId: number,
  userId: number,
  input: UpdateReviewInput
) {
  const [existing] = await db
    .select()
    .from(reviews)
    .where(and(eq(reviews.id, reviewId), eq(reviews.userId, userId)))
    .limit(1);

  if (!existing) return null;

  const [updated] = await db
    .update(reviews)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(reviews.id, reviewId))
    .returning();

  await refreshCourseRatings(existing.courseId);
  return updated;
}

export async function deleteReview(reviewId: number, userId: number) {
  const [existing] = await db
    .select()
    .from(reviews)
    .where(and(eq(reviews.id, reviewId), eq(reviews.userId, userId)))
    .limit(1);

  if (!existing) return false;

  await db.delete(reviews).where(eq(reviews.id, reviewId));
  await refreshCourseRatings(existing.courseId);
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
