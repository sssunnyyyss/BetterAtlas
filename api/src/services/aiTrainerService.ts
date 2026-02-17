import { db } from "../db/index.js";
import { aiTrainerRatings, aiTrainerScores, courses } from "../db/schema.js";
import { eq, and, sql } from "drizzle-orm";

export async function upsertAiTrainerRating(
  userId: string,
  courseId: number,
  rating: number,
  context?: unknown
) {
  await db
    .insert(aiTrainerRatings)
    .values({
      userId,
      courseId,
      rating,
      context: context ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [aiTrainerRatings.userId, aiTrainerRatings.courseId],
      set: {
        rating,
        context: context ?? null,
        updatedAt: new Date(),
      },
    });

  await refreshAiTrainerScore(courseId);
}

export async function deleteAiTrainerRating(userId: string, courseId: number) {
  await db
    .delete(aiTrainerRatings)
    .where(
      and(
        eq(aiTrainerRatings.userId, userId),
        eq(aiTrainerRatings.courseId, courseId)
      )
    );

  await refreshAiTrainerScore(courseId);
}

export async function getAiTrainerRatingsForUser(userId: string) {
  return db
    .select({
      id: aiTrainerRatings.id,
      courseId: aiTrainerRatings.courseId,
      courseCode: courses.code,
      courseTitle: courses.title,
      rating: aiTrainerRatings.rating,
      createdAt: aiTrainerRatings.createdAt,
      updatedAt: aiTrainerRatings.updatedAt,
    })
    .from(aiTrainerRatings)
    .innerJoin(courses, eq(aiTrainerRatings.courseId, courses.id))
    .where(eq(aiTrainerRatings.userId, userId));
}

async function refreshAiTrainerScore(courseId: number) {
  const [agg] = await db
    .select({
      upCount: sql<number>`count(*) filter (where ${aiTrainerRatings.rating} = 1)`,
      downCount: sql<number>`count(*) filter (where ${aiTrainerRatings.rating} = -1)`,
      totalCount: sql<number>`count(*)`,
    })
    .from(aiTrainerRatings)
    .where(eq(aiTrainerRatings.courseId, courseId));

  const up = agg.upCount ?? 0;
  const down = agg.downCount ?? 0;
  const total = agg.totalCount ?? 0;
  const score = String((up - down) / (total + 5));

  if (total === 0) {
    await db.delete(aiTrainerScores).where(eq(aiTrainerScores.courseId, courseId));
    return;
  }

  await db
    .insert(aiTrainerScores)
    .values({
      courseId,
      upCount: up,
      downCount: down,
      totalCount: total,
      score,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: aiTrainerScores.courseId,
      set: {
        upCount: up,
        downCount: down,
        totalCount: total,
        score,
        updatedAt: new Date(),
      },
    });
}

export async function getAllAiTrainerScores(): Promise<Map<number, number>> {
  const rows = await db
    .select({
      courseId: aiTrainerScores.courseId,
      score: aiTrainerScores.score,
    })
    .from(aiTrainerScores);

  const map = new Map<number, number>();
  for (const row of rows) {
    const s = Number(row.score);
    if (Number.isFinite(s)) {
      map.set(row.courseId, s);
    }
  }
  return map;
}
