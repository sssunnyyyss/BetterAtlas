/**
 * Shared helper extracted from scheduleService so that wishlistService
 * can also add items to the user's schedule list without duplicating logic.
 */
import { and, asc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { courseLists } from "../db/schema.js";

const SCHEDULE_LIST_NAME = "My Schedule";

export async function getOrCreateScheduleListId(userId: string, termCode: string) {
    const [existing] = await db
        .select({ id: courseLists.id })
        .from(courseLists)
        .where(
            and(
                eq(courseLists.userId, userId),
                eq(courseLists.termCode, termCode),
                eq(courseLists.name, SCHEDULE_LIST_NAME)
            )
        )
        .orderBy(asc(courseLists.id))
        .limit(1);

    if (existing) return existing.id;

    const [created] = await db
        .insert(courseLists)
        .values({
            userId,
            termCode,
            name: SCHEDULE_LIST_NAME,
            isPublic: false,
        })
        .returning({ id: courseLists.id });

    return created?.id ?? null;
}
