import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import type { RegisterInput } from "@betteratlas/shared";

export async function createUserProfile(input: RegisterInput & { id: string }) {
  const [user] = await db
    .insert(users)
    .values({
      id: input.id,
      email: input.email,
      displayName: input.displayName,
      graduationYear: input.graduationYear ?? null,
      major: input.major ?? null,
    })
    .returning({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      graduationYear: users.graduationYear,
      major: users.major,
      createdAt: users.createdAt,
    });

  return user;
}

export async function getUserById(id: string) {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      graduationYear: users.graduationYear,
      major: users.major,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  return user ?? null;
}

export async function updateUser(
  id: string,
  data: { displayName?: string; graduationYear?: number; major?: string }
) {
  const [updated] = await db
    .update(users)
    .set(data)
    .where(eq(users.id, id))
    .returning({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      graduationYear: users.graduationYear,
      major: users.major,
      createdAt: users.createdAt,
    });

  return updated ?? null;
}
