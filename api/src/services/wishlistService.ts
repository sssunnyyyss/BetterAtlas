import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import {
    courseListItems,
    courseLists,
    courses,
    friendships,
    instructors,
    sections,
    terms,
    users,
} from "../db/schema.js";
import { scheduleFromMeetings, schedulesFromMeetings } from "../lib/schedule.js";
import { resolveTermCode } from "./termLookup.js";
import { getOrCreateScheduleListId } from "./scheduleServiceInternal.js";

const WISHLIST_LIST_NAME = "My Wishlist";

// ---- helpers ----

async function getActiveTerm() {
    const [t] = await db
        .select({ code: terms.srcdb, name: terms.name })
        .from(terms)
        .where(eq(terms.isActive, true))
        .limit(1);

    if (t) return t;

    const [fallback] = await db
        .select({ code: terms.srcdb, name: terms.name })
        .from(terms)
        .orderBy(sql`${terms.year} DESC, ${terms.srcdb} DESC`)
        .limit(1);

    if (!fallback) throw new Error("No terms found");
    return fallback;
}

async function getTermInfo(termCode: string) {
    const [t] = await db
        .select({ code: terms.srcdb, name: terms.name })
        .from(terms)
        .where(eq(terms.srcdb, termCode))
        .limit(1);
    return { code: termCode, name: t?.name ?? null };
}

async function getPreferredWishlistTerm(userId: string) {
    const [latest] = await db
        .select({ termCode: courseLists.termCode })
        .from(courseLists)
        .where(and(eq(courseLists.userId, userId), eq(courseLists.name, WISHLIST_LIST_NAME)))
        .orderBy(sql`${courseLists.createdAt} DESC, ${courseLists.id} DESC`)
        .limit(1);
    return latest?.termCode ?? null;
}

async function getOrCreateWishlistId(userId: string, termCode: string) {
    const [existing] = await db
        .select({ id: courseLists.id })
        .from(courseLists)
        .where(
            and(
                eq(courseLists.userId, userId),
                eq(courseLists.termCode, termCode),
                eq(courseLists.name, WISHLIST_LIST_NAME)
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
            name: WISHLIST_LIST_NAME,
            isPublic: true, // Visible to friends
        })
        .returning({ id: courseLists.id });

    return created?.id ?? null;
}

// ---- items query (mirrors scheduleService pattern) ----

async function getWishlistItems(listId: number) {
    const rows = await db
        .select({
            itemId: courseListItems.id,
            sectionId: sections.id,
            addedAt: courseListItems.addedAt,
            color: courseListItems.color,
            courseId: courses.id,
            courseCode: courses.code,
            courseTitle: courses.title,
            sectionNumber: sections.sectionNumber,
            meetings: sections.meetings,
            campus: sections.campus,
            componentType: sections.componentType,
            instructionMethod: sections.instructionMethod,
            enrollmentStatus: sections.enrollmentStatus,
            waitlistCount: sections.waitlistCount,
            waitlistCap: sections.waitlistCap,
            enrollmentCap: sections.enrollmentCap,
            enrollmentCur: sections.enrollmentCur,
            seatsAvail: sections.seatsAvail,
            startDate: sections.startDate,
            endDate: sections.endDate,
            instructorName: instructors.name,
            termCode: sections.termCode,
            termName: terms.name,
        })
        .from(courseListItems)
        .innerJoin(sections, eq(courseListItems.sectionId, sections.id))
        .innerJoin(courses, eq(sections.courseId, courses.id))
        .leftJoin(instructors, eq(sections.instructorId, instructors.id))
        .leftJoin(terms, eq(sections.termCode, terms.srcdb))
        .where(eq(courseListItems.listId, listId))
        .orderBy(asc(courseListItems.id));

    return rows.map((r) => {
        const sched = scheduleFromMeetings(r.meetings);
        const schedules = schedulesFromMeetings(r.meetings);
        return {
            itemId: r.itemId,
            sectionId: r.sectionId,
            addedAt: r.addedAt?.toISOString() ?? "",
            color: r.color ?? null,
            course: { id: r.courseId, code: r.courseCode, title: r.courseTitle },
            section: {
                sectionNumber: r.sectionNumber ?? null,
                semester: r.termName ?? r.termCode,
                schedule: sched,
                schedules,
                instructorName: r.instructorName ?? null,
                location: sched?.location ?? null,
                campus: r.campus ?? null,
                componentType: r.componentType ?? null,
                instructionMethod: r.instructionMethod ?? null,
                enrollmentStatus: r.enrollmentStatus ?? null,
                enrollmentCap: r.enrollmentCap ?? null,
                enrollmentCur: r.enrollmentCur ?? 0,
                seatsAvail:
                    r.seatsAvail ??
                    (r.enrollmentCap !== null
                        ? Math.max(0, (r.enrollmentCap ?? 0) - (r.enrollmentCur ?? 0))
                        : null),
                waitlistCount: r.waitlistCount ?? 0,
                waitlistCap: r.waitlistCap ?? null,
                startDate: r.startDate ?? null,
                endDate: r.endDate ?? null,
            },
        };
    });
}

// ---- friend overlap ----

async function getMutualFriendIds(userId: string): Promise<string[]> {
    const rows = await db
        .select({
            friendId: sql<string>`CASE WHEN ${friendships.requesterId} = ${userId} THEN ${friendships.addresseeId} ELSE ${friendships.requesterId} END`,
        })
        .from(friendships)
        .where(
            and(
                sql`(${friendships.requesterId} = ${userId} OR ${friendships.addresseeId} = ${userId})`,
                eq(friendships.status, "accepted")
            )
        );
    return rows.map((r) => r.friendId);
}

/**
 * For each courseId on the user's wishlist, count how many friends also have
 * that courseId on *their* wishlist for the same term.
 */
async function computeFriendOverlap(
    termCode: string,
    courseIds: number[],
    friendIds: string[]
): Promise<Map<number, number>> {
    const overlaps = new Map<number, number>();
    if (friendIds.length === 0 || courseIds.length === 0) return overlaps;

    // Find friend wishlist list IDs for this term
    const friendLists = await db
        .select({ id: courseLists.id })
        .from(courseLists)
        .where(
            and(
                inArray(courseLists.userId, friendIds),
                eq(courseLists.termCode, termCode),
                eq(courseLists.name, WISHLIST_LIST_NAME)
            )
        );

    if (friendLists.length === 0) return overlaps;

    const friendListIds = friendLists.map((l) => l.id);

    // Count by courseId how many friend list items share the same course
    const rows = await db
        .select({
            courseId: sections.courseId,
            friendCount: sql<number>`COUNT(DISTINCT ${courseLists.userId})`,
        })
        .from(courseListItems)
        .innerJoin(sections, eq(courseListItems.sectionId, sections.id))
        .innerJoin(courseLists, eq(courseListItems.listId, courseLists.id))
        .where(
            and(
                inArray(courseListItems.listId, friendListIds),
                inArray(sections.courseId, courseIds)
            )
        )
        .groupBy(sections.courseId);

    for (const row of rows) {
        overlaps.set(row.courseId, Number(row.friendCount));
    }

    return overlaps;
}

// ---- public API ----

export async function getMyWishlist(userId: string, term?: string) {
    const termCode = term
        ? await resolveTermCode(term)
        : (await getPreferredWishlistTerm(userId)) ?? (await getActiveTerm()).code;
    const termInfo = await getTermInfo(termCode);

    const [list] = await db
        .select({ id: courseLists.id })
        .from(courseLists)
        .where(
            and(
                eq(courseLists.userId, userId),
                eq(courseLists.termCode, termCode),
                eq(courseLists.name, WISHLIST_LIST_NAME)
            )
        )
        .orderBy(asc(courseLists.id))
        .limit(1);

    if (!list) {
        return { term: termInfo, listId: null, items: [] };
    }

    const items = await getWishlistItems(list.id);

    // Compute friend overlap
    const friendIds = await getMutualFriendIds(userId);
    const courseIds = [...new Set(items.map((i) => i.course.id))];
    const overlapMap = await computeFriendOverlap(termCode, courseIds, friendIds);

    const itemsWithOverlap = items.map((item) => ({
        ...item,
        friendOverlapCount: overlapMap.get(item.course.id) ?? 0,
    }));

    return { term: termInfo, listId: list.id, items: itemsWithOverlap };
}

export async function addToWishlist(
    userId: string,
    input: { sectionId: number; color?: string }
) {
    const [section] = await db
        .select({ id: sections.id, termCode: sections.termCode })
        .from(sections)
        .where(eq(sections.id, input.sectionId))
        .limit(1);

    if (!section) throw new Error("Section not found");

    const listId = await getOrCreateWishlistId(userId, section.termCode);
    if (!listId) throw new Error("Failed to create wishlist");

    // Skip if already present
    const [existing] = await db
        .select({ id: courseListItems.id })
        .from(courseListItems)
        .where(
            and(
                eq(courseListItems.listId, listId),
                eq(courseListItems.sectionId, input.sectionId)
            )
        )
        .limit(1);

    if (!existing) {
        await db
            .insert(courseListItems)
            .values({
                listId,
                sectionId: input.sectionId,
                color: input.color ?? null,
            });
    }

    return getMyWishlist(userId, section.termCode);
}

export async function removeFromWishlist(userId: string, itemId: number) {
    const listIds = await db
        .select({ id: courseLists.id })
        .from(courseLists)
        .where(and(eq(courseLists.userId, userId), eq(courseLists.name, WISHLIST_LIST_NAME)));

    if (listIds.length === 0) return false;

    const ids = listIds.map((l) => l.id);
    await db
        .delete(courseListItems)
        .where(and(eq(courseListItems.id, itemId), inArray(courseListItems.listId, ids)));

    return true;
}

export async function moveToSchedule(userId: string, itemId: number) {
    // 1. Find the wishlist item to get its sectionId
    const userWishlistIds = await db
        .select({ id: courseLists.id })
        .from(courseLists)
        .where(and(eq(courseLists.userId, userId), eq(courseLists.name, WISHLIST_LIST_NAME)));

    if (userWishlistIds.length === 0) throw new Error("Wishlist not found");

    const ids = userWishlistIds.map((l) => l.id);
    const [item] = await db
        .select({
            id: courseListItems.id,
            sectionId: courseListItems.sectionId,
            color: courseListItems.color,
        })
        .from(courseListItems)
        .where(and(eq(courseListItems.id, itemId), inArray(courseListItems.listId, ids)))
        .limit(1);

    if (!item) throw new Error("Wishlist item not found");

    // 2. Get section term to add to the correct schedule
    const [section] = await db
        .select({ termCode: sections.termCode })
        .from(sections)
        .where(eq(sections.id, item.sectionId))
        .limit(1);

    if (!section) throw new Error("Section not found");

    // 3. Add to schedule
    const scheduleListId = await getOrCreateScheduleListId(userId, section.termCode);
    if (!scheduleListId) throw new Error("Failed to create schedule");

    // Check if not already on schedule
    const [alreadyScheduled] = await db
        .select({ id: courseListItems.id })
        .from(courseListItems)
        .where(
            and(
                eq(courseListItems.listId, scheduleListId),
                eq(courseListItems.sectionId, item.sectionId)
            )
        )
        .limit(1);

    if (!alreadyScheduled) {
        await db.insert(courseListItems).values({
            listId: scheduleListId,
            sectionId: item.sectionId,
            color: item.color,
        });
    }

    // 4. Remove from wishlist
    await db.delete(courseListItems).where(eq(courseListItems.id, itemId));

    return { moved: true, sectionId: item.sectionId };
}
