import { desc, eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { inviteCodes } from "../db/schema.js";

type EvaluateInviteCodeInput = {
  usedCount: number;
  maxUses: number | null;
  expiresAt: Date | null;
  now?: Date;
};

type EvaluateInviteCodeResult =
  | { ok: true }
  | { ok: false; reason: "expired" | "maxed" };

const inviteCodeSelect = {
  id: inviteCodes.id,
  code: inviteCodes.code,
  badgeSlug: inviteCodes.badgeSlug,
  maxUses: inviteCodes.maxUses,
  usedCount: inviteCodes.usedCount,
  expiresAt: inviteCodes.expiresAt,
  createdAt: inviteCodes.createdAt,
};

export function normalizeInviteCode(code: string): string {
  return code.trim().toUpperCase();
}

export function evaluateInviteCode(
  input: EvaluateInviteCodeInput
): EvaluateInviteCodeResult {
  const now = input.now ?? new Date();

  if (input.expiresAt && input.expiresAt.getTime() <= now.getTime()) {
    return { ok: false, reason: "expired" };
  }

  if (input.maxUses !== null && input.usedCount >= input.maxUses) {
    return { ok: false, reason: "maxed" };
  }

  return { ok: true };
}

export async function getInviteCodeByCode(code: string) {
  const normalizedCode = normalizeInviteCode(code);

  const [inviteCode] = await db
    .select(inviteCodeSelect)
    .from(inviteCodes)
    .where(eq(inviteCodes.code, normalizedCode))
    .limit(1);

  return inviteCode ?? null;
}

export async function createInviteCode(input: {
  code: string;
  badgeSlug: string;
  maxUses: number | null;
  expiresAt: Date | null;
}) {
  const [created] = await db
    .insert(inviteCodes)
    .values({
      code: normalizeInviteCode(input.code),
      badgeSlug: input.badgeSlug,
      maxUses: input.maxUses,
      expiresAt: input.expiresAt,
    })
    .returning(inviteCodeSelect);

  return created ?? null;
}

export async function listInviteCodes() {
  return db
    .select(inviteCodeSelect)
    .from(inviteCodes)
    .orderBy(desc(inviteCodes.createdAt), desc(inviteCodes.id));
}

export async function deleteInviteCodeById(id: number) {
  const [deleted] = await db
    .delete(inviteCodes)
    .where(eq(inviteCodes.id, id))
    .returning(inviteCodeSelect);

  return deleted ?? null;
}

export async function incrementInviteCodeUsedCount(id: number) {
  const [updated] = await db
    .update(inviteCodes)
    .set({
      usedCount: sql`${inviteCodes.usedCount} + 1`,
    })
    .where(eq(inviteCodes.id, id))
    .returning(inviteCodeSelect);

  return updated ?? null;
}
