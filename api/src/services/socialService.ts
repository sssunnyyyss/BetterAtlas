import { db } from "../db/index.js";
import {
  friendships,
  users,
  courseLists,
  courseListItems,
  sections,
  courses,
} from "../db/schema.js";
import { eq, and, or, sql } from "drizzle-orm";
import type { CreateListInput, AddListItemInput } from "@betteratlas/shared";

// ---- Friends ----

export async function getFriends(userId: string) {
  const rows = await db
    .select({
      friendshipId: friendships.id,
      requesterId: friendships.requesterId,
      addresseeId: friendships.addresseeId,
      status: friendships.status,
      friendId: sql<string>`CASE WHEN ${friendships.requesterId} = ${userId} THEN ${friendships.addresseeId} ELSE ${friendships.requesterId} END`,
      displayName: users.displayName,
      graduationYear: users.graduationYear,
      major: users.major,
    })
    .from(friendships)
    .innerJoin(
      users,
      sql`${users.id} = CASE WHEN ${friendships.requesterId} = ${userId} THEN ${friendships.addresseeId} ELSE ${friendships.requesterId} END`
    )
    .where(
      and(
        or(
          eq(friendships.requesterId, userId),
          eq(friendships.addresseeId, userId)
        ),
        eq(friendships.status, "accepted")
      )
    );

  return rows.map((r) => ({
    friendshipId: r.friendshipId,
    user: {
      id: r.friendId,
      displayName: r.displayName,
      graduationYear: r.graduationYear,
      major: r.major,
    },
    status: r.status as "accepted",
  }));
}

export async function getPendingRequests(userId: string) {
  const rows = await db
    .select({
      friendshipId: friendships.id,
      requesterId: friendships.requesterId,
      displayName: users.displayName,
      graduationYear: users.graduationYear,
      major: users.major,
      createdAt: friendships.createdAt,
    })
    .from(friendships)
    .innerJoin(users, eq(users.id, friendships.requesterId))
    .where(
      and(
        eq(friendships.addresseeId, userId),
        eq(friendships.status, "pending")
      )
    );

  return rows.map((r) => ({
    friendshipId: r.friendshipId,
    user: {
      id: r.requesterId,
      displayName: r.displayName,
      graduationYear: r.graduationYear,
      major: r.major,
    },
    status: "pending" as const,
  }));
}

export async function sendFriendRequest(requesterId: string, addresseeId: string) {
  if (requesterId === addresseeId) {
    throw new Error("Cannot send a friend request to yourself");
  }

  const [existing] = await db
    .select()
    .from(friendships)
    .where(
      or(
        and(
          eq(friendships.requesterId, requesterId),
          eq(friendships.addresseeId, addresseeId)
        ),
        and(
          eq(friendships.requesterId, addresseeId),
          eq(friendships.addresseeId, requesterId)
        )
      )
    )
    .limit(1);

  if (existing) {
    throw new Error("Friendship already exists");
  }

  const [friendship] = await db
    .insert(friendships)
    .values({ requesterId, addresseeId })
    .returning();

  return friendship;
}

export async function acceptFriendRequest(friendshipId: number, userId: string) {
  const [updated] = await db
    .update(friendships)
    .set({ status: "accepted" })
    .where(
      and(eq(friendships.id, friendshipId), eq(friendships.addresseeId, userId))
    )
    .returning();

  return updated ?? null;
}

export async function removeFriend(friendshipId: number, userId: string) {
  const result = await db
    .delete(friendships)
    .where(
      and(
        eq(friendships.id, friendshipId),
        or(
          eq(friendships.requesterId, userId),
          eq(friendships.addresseeId, userId)
        )
      )
    );

  return true;
}

// ---- Course Lists ----

export async function getUserLists(userId: string) {
  const lists = await db
    .select()
    .from(courseLists)
    .where(eq(courseLists.userId, userId));

  const result = [];
  for (const list of lists) {
    const items = await db
      .select({
        id: courseListItems.id,
        listId: courseListItems.listId,
        sectionId: courseListItems.sectionId,
        color: courseListItems.color,
        addedAt: courseListItems.addedAt,
        courseCode: courses.code,
        courseTitle: courses.title,
        sectionNumber: sections.sectionNumber,
        semester: sections.semester,
      })
      .from(courseListItems)
      .innerJoin(sections, eq(courseListItems.sectionId, sections.id))
      .innerJoin(courses, eq(sections.courseId, courses.id))
      .where(eq(courseListItems.listId, list.id));

    result.push({
      ...list,
      createdAt: list.createdAt?.toISOString() ?? "",
      items: items.map((i) => ({
        id: i.id,
        listId: i.listId,
        sectionId: i.sectionId,
        color: i.color,
        addedAt: i.addedAt?.toISOString() ?? "",
        course: { code: i.courseCode, title: i.courseTitle },
        section: { sectionNumber: i.sectionNumber, semester: i.semester },
      })),
    });
  }

  return result;
}

export async function createList(userId: string, input: CreateListInput) {
  const [list] = await db
    .insert(courseLists)
    .values({
      userId,
      semester: input.semester,
      name: input.name,
      isPublic: input.isPublic,
    })
    .returning();

  return list;
}

export async function addItemToList(
  listId: number,
  userId: string,
  input: AddListItemInput
) {
  // Verify ownership
  const [list] = await db
    .select()
    .from(courseLists)
    .where(and(eq(courseLists.id, listId), eq(courseLists.userId, userId)))
    .limit(1);

  if (!list) return null;

  const [item] = await db
    .insert(courseListItems)
    .values({
      listId,
      sectionId: input.sectionId,
      color: input.color ?? null,
    })
    .returning();

  return item;
}

export async function removeItemFromList(
  listId: number,
  itemId: number,
  userId: string
) {
  // Verify ownership
  const [list] = await db
    .select()
    .from(courseLists)
    .where(and(eq(courseLists.id, listId), eq(courseLists.userId, userId)))
    .limit(1);

  if (!list) return false;

  await db.delete(courseListItems).where(eq(courseListItems.id, itemId));
  return true;
}

export async function getFriendCourseLists(friendId: string, userId: string) {
  // Check they're friends
  const [friendship] = await db
    .select()
    .from(friendships)
    .where(
      and(
        or(
          and(
            eq(friendships.requesterId, userId),
            eq(friendships.addresseeId, friendId)
          ),
          and(
            eq(friendships.requesterId, friendId),
            eq(friendships.addresseeId, userId)
          )
        ),
        eq(friendships.status, "accepted")
      )
    )
    .limit(1);

  if (!friendship) return null;

  // Only return public lists
  const lists = await db
    .select()
    .from(courseLists)
    .where(
      and(eq(courseLists.userId, friendId), eq(courseLists.isPublic, true))
    );

  const result = [];
  for (const list of lists) {
    const items = await db
      .select({
        id: courseListItems.id,
        listId: courseListItems.listId,
        sectionId: courseListItems.sectionId,
        color: courseListItems.color,
        addedAt: courseListItems.addedAt,
        courseCode: courses.code,
        courseTitle: courses.title,
        sectionNumber: sections.sectionNumber,
        semester: sections.semester,
      })
      .from(courseListItems)
      .innerJoin(sections, eq(courseListItems.sectionId, sections.id))
      .innerJoin(courses, eq(sections.courseId, courses.id))
      .where(eq(courseListItems.listId, list.id));

    result.push({
      ...list,
      createdAt: list.createdAt?.toISOString() ?? "",
      items: items.map((i) => ({
        id: i.id,
        listId: i.listId,
        sectionId: i.sectionId,
        color: i.color,
        addedAt: i.addedAt?.toISOString() ?? "",
        course: { code: i.courseCode, title: i.courseTitle },
        section: { sectionNumber: i.sectionNumber, semester: i.semester },
      })),
    });
  }

  return result;
}
