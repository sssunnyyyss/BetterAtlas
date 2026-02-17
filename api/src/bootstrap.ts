import { db } from "./db/index.js";
import {
  users,
  courseLists,
  courseListItems,
  sections,
  terms,
} from "./db/schema.js";
import { and, eq } from "drizzle-orm";

/** Well-known UUID for the "johndoe" test account. */
export const JOHNDOE_ID = "00000000-0000-0000-0000-00000000d0e1";

/**
 * Idempotently creates the johndoe demo user with a preloaded schedule.
 * Safe to call on every server start — skips work that's already done.
 */
export async function ensureJohnDoe() {
  // 1. Create the user if missing.
  await db
    .insert(users)
    .values({
      id: JOHNDOE_ID,
      email: "johndoe@betteratlas.test",
      username: "johndoe",
      displayName: "John Doe",
      hasCompletedOnboarding: true,
    })
    .onConflictDoNothing();

  // 2. Find the active term.
  const [term] = await db
    .select({ code: terms.srcdb })
    .from(terms)
    .where(eq(terms.isActive, true))
    .limit(1);

  if (!term) return; // No terms seeded yet — nothing to build a schedule from.

  // 3. Create a "My Schedule" list if johndoe doesn't have one for this term.
  const [existing] = await db
    .select({ id: courseLists.id })
    .from(courseLists)
    .where(
      and(
        eq(courseLists.userId, JOHNDOE_ID),
        eq(courseLists.termCode, term.code),
        eq(courseLists.name, "My Schedule")
      )
    )
    .limit(1);

  if (existing) return; // Schedule already set up.

  const [list] = await db
    .insert(courseLists)
    .values({
      userId: JOHNDOE_ID,
      termCode: term.code,
      name: "My Schedule",
      isPublic: false,
    })
    .returning({ id: courseLists.id });

  if (!list) return;

  // 4. Pick a handful of sections from the active term so the calendar isn't empty.
  const secs = await db
    .select({ id: sections.id })
    .from(sections)
    .where(eq(sections.termCode, term.code))
    .limit(4);

  for (const sec of secs) {
    await db
      .insert(courseListItems)
      .values({ listId: list.id, sectionId: sec.id })
      .onConflictDoNothing();
  }
}
