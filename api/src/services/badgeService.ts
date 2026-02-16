import { desc, eq, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { badges, userBadges } from "../db/schema.js";
import type { Badge } from "@betteratlas/shared";

export async function getBadgeBySlug(slug: string) {
  const [badge] = await db
    .select({
      id: badges.id,
      slug: badges.slug,
      name: badges.name,
      description: badges.description,
      icon: badges.icon,
      createdAt: badges.createdAt,
    })
    .from(badges)
    .where(eq(badges.slug, slug))
    .limit(1);

  return badge ?? null;
}

export async function grantBadgeToUser(userId: string, badgeId: number) {
  const [granted] = await db
    .insert(userBadges)
    .values({
      userId,
      badgeId,
    })
    .onConflictDoNothing({
      target: [userBadges.userId, userBadges.badgeId],
    })
    .returning({
      id: userBadges.id,
      userId: userBadges.userId,
      badgeId: userBadges.badgeId,
      awardedAt: userBadges.awardedAt,
    });

  return granted ?? null;
}

export async function listBadgesForUser(userId: string) {
  const rows = await db
    .select({
      slug: badges.slug,
      name: badges.name,
      description: badges.description,
      icon: badges.icon,
      awardedAt: userBadges.awardedAt,
    })
    .from(userBadges)
    .innerJoin(badges, eq(userBadges.badgeId, badges.id))
    .where(eq(userBadges.userId, userId))
    .orderBy(desc(userBadges.awardedAt), desc(userBadges.id));

  return rows.map((row) => ({
    slug: row.slug,
    name: row.name,
    description: row.description,
    icon: row.icon,
    awardedAt: row.awardedAt?.toISOString() ?? "",
  }));
}

export async function listBadgesForUsers(userIds: string[]) {
  const uniqueUserIds = userIds
    .filter(Boolean)
    .filter((userId, index, allIds) => allIds.indexOf(userId) === index);
  const badgesByUser = new Map<string, Badge[]>();

  if (uniqueUserIds.length === 0) {
    return badgesByUser;
  }

  for (const userId of uniqueUserIds) {
    badgesByUser.set(userId, []);
  }

  const rows = await db
    .select({
      userId: userBadges.userId,
      slug: badges.slug,
      name: badges.name,
      description: badges.description,
      icon: badges.icon,
      awardedAt: userBadges.awardedAt,
    })
    .from(userBadges)
    .innerJoin(badges, eq(userBadges.badgeId, badges.id))
    .where(inArray(userBadges.userId, uniqueUserIds))
    .orderBy(desc(userBadges.awardedAt), desc(userBadges.id));

  for (const row of rows) {
    const userBadgeList = badgesByUser.get(row.userId);
    if (!userBadgeList) continue;
    userBadgeList.push({
      slug: row.slug,
      name: row.name,
      description: row.description,
      icon: row.icon,
      awardedAt: row.awardedAt?.toISOString() ?? "",
    });
  }

  return badgesByUser;
}
