import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import type { RegisterInput } from "@betteratlas/shared";

const userProfileSelect = {
  id: users.id,
  email: users.email,
  username: users.username,
  fullName: users.displayName,
  graduationYear: users.graduationYear,
  major: users.major,
  hasCompletedOnboarding: users.hasCompletedOnboarding,
  createdAt: users.createdAt,
};

export async function createUserProfile(input: RegisterInput & { id: string }) {
  const [user] = await db
    .insert(users)
    .values({
      id: input.id,
      email: input.email,
      username: input.username,
      displayName: input.fullName,
      graduationYear: input.graduationYear ?? null,
      major: input.major ?? null,
      inviteCode: input.inviteCode ?? null,
    })
    .returning(userProfileSelect);

  return user;
}

export async function getUserById(id: string) {
  const [user] = await db
    .select(userProfileSelect)
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  return user ?? null;
}

export async function updateUser(
  id: string,
  data: { username?: string; fullName?: string; graduationYear?: number; major?: string }
) {
  const [updated] = await db
    .update(users)
    .set({
      ...(data.username !== undefined ? { username: data.username } : {}),
      ...(data.fullName !== undefined ? { displayName: data.fullName } : {}),
      ...(data.graduationYear !== undefined ? { graduationYear: data.graduationYear } : {}),
      ...(data.major !== undefined ? { major: data.major } : {}),
    })
    .where(eq(users.id, id))
    .returning(userProfileSelect);

  return updated ?? null;
}

export async function markOnboardingComplete(id: string) {
  const [updated] = await db
    .update(users)
    .set({ hasCompletedOnboarding: true })
    .where(eq(users.id, id))
    .returning(userProfileSelect);

  return updated ?? null;
}
