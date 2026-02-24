import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
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

const SCHEDULE_LIST_NAME = "My Schedule";

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
    .orderBy(desc(terms.year), desc(terms.srcdb))
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

async function getPreferredMyScheduleTerm(userId: string) {
  const [latest] = await db
    .select({ termCode: courseLists.termCode })
    .from(courseLists)
    .where(and(eq(courseLists.userId, userId), eq(courseLists.name, SCHEDULE_LIST_NAME)))
    .orderBy(desc(courseLists.createdAt), desc(courseLists.id))
    .limit(1);

  return latest?.termCode ?? null;
}


async function getScheduleItemsForList(listId: number) {
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

export async function getMySchedule(userId: string, term?: string) {
  const termCode = term
    ? await resolveTermCode(term)
    : (await getPreferredMyScheduleTerm(userId)) ?? (await getActiveTerm()).code;
  const termInfo = await getTermInfo(termCode);

  const [list] = await db
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

  if (!list) {
    return { term: termInfo, listId: null, items: [] };
  }

  const items = await getScheduleItemsForList(list.id);
  return { term: termInfo, listId: list.id, items };
}

export async function addToMySchedule(
  userId: string,
  input: { sectionId: number; color?: string }
) {
  const [section] = await db
    .select({ id: sections.id, termCode: sections.termCode })
    .from(sections)
    .where(eq(sections.id, input.sectionId))
    .limit(1);

  if (!section) throw new Error("Section not found");

  const listId = await getOrCreateScheduleListId(userId, section.termCode);
  if (!listId) throw new Error("Failed to create schedule");

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

  const itemId = existing
    ? existing.id
    : (
      await db
        .insert(courseListItems)
        .values({
          listId,
          sectionId: input.sectionId,
          color: input.color ?? null,
        })
        .returning({ id: courseListItems.id })
    )[0]?.id;

  if (!itemId) throw new Error("Failed to add to schedule");

  const schedule = await getMySchedule(userId, section.termCode);
  const item = schedule.items.find((i) => i.itemId === itemId) ?? null;
  return { term: schedule.term, listId: schedule.listId, item };
}

export async function removeFromMySchedule(userId: string, itemId: number) {
  const listIds = await db
    .select({ id: courseLists.id })
    .from(courseLists)
    .where(and(eq(courseLists.userId, userId), eq(courseLists.name, SCHEDULE_LIST_NAME)));

  if (listIds.length === 0) return false;

  const ids = listIds.map((l) => l.id);
  const result = await db
    .delete(courseListItems)
    .where(and(eq(courseListItems.id, itemId), inArray(courseListItems.listId, ids)));

  return true;
}

export async function getFriendsSchedules(userId: string, term?: string) {
  const termCode = term ? await resolveTermCode(term) : (await getActiveTerm()).code;
  const termInfo = await getTermInfo(termCode);

  const friends = await db
    .select({
      friendId: sql<string>`CASE WHEN ${friendships.requesterId} = ${userId} THEN ${friendships.addresseeId} ELSE ${friendships.requesterId} END`,
      username: users.username,
      fullName: users.displayName,
    })
    .from(friendships)
    .innerJoin(
      users,
      sql`${users.id} = CASE WHEN ${friendships.requesterId} = ${userId} THEN ${friendships.addresseeId} ELSE ${friendships.requesterId} END`
    )
    .where(
      and(
        or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId)),
        eq(friendships.status, "accepted")
      )
    );

  const out = [];
  for (const f of friends) {
    const [list] = await db
      .select({ id: courseLists.id })
      .from(courseLists)
      .where(
        and(
          eq(courseLists.userId, f.friendId),
          eq(courseLists.termCode, termCode),
          eq(courseLists.name, SCHEDULE_LIST_NAME)
        )
      )
      .orderBy(asc(courseLists.id))
      .limit(1);

    const items = list ? await getScheduleItemsForList(list.id) : [];

    out.push({
      friend: {
        id: f.friendId,
        username: f.username ?? "",
        fullName: f.fullName,
      },
      term: termInfo,
      items,
    });
  }

  return out;
}

export async function swapScheduleSection(
  userId: string,
  itemId: number,
  newSectionId: number
) {
  // 1. Find the schedule item and verify ownership
  const userListIds = await db
    .select({ id: courseLists.id, termCode: courseLists.termCode })
    .from(courseLists)
    .where(and(eq(courseLists.userId, userId), eq(courseLists.name, SCHEDULE_LIST_NAME)));

  if (userListIds.length === 0) throw new Error("Schedule not found");

  const ids = userListIds.map((l) => l.id);
  const [item] = await db
    .select({
      id: courseListItems.id,
      listId: courseListItems.listId,
      sectionId: courseListItems.sectionId,
      color: courseListItems.color,
    })
    .from(courseListItems)
    .where(and(eq(courseListItems.id, itemId), inArray(courseListItems.listId, ids)))
    .limit(1);

  if (!item) throw new Error("Schedule item not found");

  // 2. Get the courseId of the current section
  const [currentSection] = await db
    .select({ courseId: sections.courseId, termCode: sections.termCode })
    .from(sections)
    .where(eq(sections.id, item.sectionId))
    .limit(1);

  if (!currentSection) throw new Error("Current section not found");

  // 3. Validate the new section belongs to the same course
  const [newSection] = await db
    .select({ courseId: sections.courseId, termCode: sections.termCode })
    .from(sections)
    .where(eq(sections.id, newSectionId))
    .limit(1);

  if (!newSection) throw new Error("New section not found");
  if (newSection.courseId !== currentSection.courseId) {
    throw new Error("New section must belong to the same course");
  }

  // 4. Update the course list item to point to the new section
  await db
    .update(courseListItems)
    .set({ sectionId: newSectionId })
    .where(eq(courseListItems.id, itemId));

  // 5. Return updated schedule
  return getMySchedule(userId, currentSection.termCode);
}
