import bcrypt from "bcryptjs";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import type { RegisterInput } from "@betteratlas/shared";

export async function createUser(input: RegisterInput) {
  const passwordHash = await bcrypt.hash(input.password, 12);

  const [user] = await db
    .insert(users)
    .values({
      email: input.email,
      passwordHash,
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

export async function verifyCredentials(email: string, password: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) return null;

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    graduationYear: user.graduationYear,
    major: user.major,
    createdAt: user.createdAt?.toISOString() ?? "",
  };
}

export async function getUserById(id: number) {
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
  id: number,
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
