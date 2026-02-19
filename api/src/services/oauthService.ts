import crypto from "node:crypto";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  oauthClients,
  oauthAuthorizationCodes,
  oauthAccessTokens,
  users,
} from "../db/schema.js";

// ── Helpers ──────────────────────────────────────────────────

function randomHex(bytes: number): string {
  return crypto.randomBytes(bytes).toString("hex");
}

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function sha256Buffer(input: string): Buffer {
  return crypto.createHash("sha256").update(input).digest();
}

/** Base64url-encode (no padding) */
function base64url(buf: Buffer): string {
  return buf.toString("base64url");
}

// ── Client CRUD ──────────────────────────────────────────────

export type OAuthClient = typeof oauthClients.$inferSelect;

export async function createClient(params: {
  name: string;
  description?: string;
  redirectUris: string[];
  allowedScopes: string[];
  isPublic: boolean;
  createdBy?: string;
}): Promise<{ client: OAuthClient; rawSecret: string | null }> {
  const id = crypto.randomUUID();
  let rawSecret: string | null = null;
  let hashedSecret: string | null = null;

  if (!params.isPublic) {
    rawSecret = randomHex(32);
    hashedSecret = sha256(rawSecret);
  }

  const [client] = await db
    .insert(oauthClients)
    .values({
      id,
      secret: hashedSecret,
      name: params.name,
      description: params.description ?? null,
      redirectUris: params.redirectUris,
      allowedScopes: params.allowedScopes,
      isPublic: params.isPublic,
      createdBy: params.createdBy ?? null,
    })
    .returning();

  return { client, rawSecret };
}

export async function getClient(id: string): Promise<OAuthClient | undefined> {
  const [client] = await db
    .select()
    .from(oauthClients)
    .where(eq(oauthClients.id, id))
    .limit(1);
  return client;
}

export async function getActiveClient(id: string): Promise<OAuthClient | undefined> {
  const [client] = await db
    .select()
    .from(oauthClients)
    .where(and(eq(oauthClients.id, id), eq(oauthClients.isActive, true)))
    .limit(1);
  return client;
}

export async function listClients(): Promise<OAuthClient[]> {
  return db.select().from(oauthClients);
}

export async function updateClient(
  id: string,
  updates: Partial<Pick<OAuthClient, "name" | "description" | "redirectUris" | "allowedScopes" | "isPublic" | "isActive">>
): Promise<OAuthClient | undefined> {
  const [client] = await db
    .update(oauthClients)
    .set(updates)
    .where(eq(oauthClients.id, id))
    .returning();
  return client;
}

export async function deactivateClient(id: string): Promise<OAuthClient | undefined> {
  return updateClient(id, { isActive: false });
}

export async function rotateClientSecret(id: string): Promise<{ rawSecret: string } | undefined> {
  const client = await getClient(id);
  if (!client || client.isPublic) return undefined;

  const rawSecret = randomHex(32);
  const hashedSecret = sha256(rawSecret);

  await db
    .update(oauthClients)
    .set({ secret: hashedSecret })
    .where(eq(oauthClients.id, id));

  return { rawSecret };
}

/** Verify client_secret against stored hash using timing-safe comparison */
export function verifyClientSecret(client: OAuthClient, providedSecret: string): boolean {
  if (!client.secret) return false;
  const providedHash = sha256Buffer(providedSecret);
  const storedHash = Buffer.from(client.secret, "hex");
  if (providedHash.length !== storedHash.length) return false;
  return crypto.timingSafeEqual(providedHash, storedHash);
}

// ── Authorization Codes ──────────────────────────────────────

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function createAuthorizationCode(params: {
  clientId: string;
  userId: string;
  redirectUri: string;
  scopes: string[];
  codeChallenge?: string;
  codeChallengeMethod?: string;
}): Promise<string> {
  const code = randomHex(32);
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  await db.insert(oauthAuthorizationCodes).values({
    code,
    clientId: params.clientId,
    userId: params.userId,
    redirectUri: params.redirectUri,
    scopes: params.scopes,
    codeChallenge: params.codeChallenge ?? null,
    codeChallengeMethod: params.codeChallengeMethod ?? null,
    expiresAt,
  });

  return code;
}

/**
 * Consume an authorization code atomically (single-use).
 * Returns the code row if valid, or undefined if expired/already used.
 */
export async function consumeAuthorizationCode(code: string) {
  const now = new Date();
  // Atomic: only mark as used if not already used
  const [row] = await db
    .update(oauthAuthorizationCodes)
    .set({ usedAt: now })
    .where(
      and(
        eq(oauthAuthorizationCodes.code, code),
        isNull(oauthAuthorizationCodes.usedAt)
      )
    )
    .returning();

  if (!row) return undefined;
  if (row.expiresAt < now) return undefined; // expired
  return row;
}

/** Verify PKCE code_verifier against stored code_challenge (S256 only) */
export function verifyCodeChallenge(codeVerifier: string, codeChallenge: string): boolean {
  const computed = base64url(sha256Buffer(codeVerifier));
  return computed === codeChallenge;
}

// ── Access Tokens ────────────────────────────────────────────

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function createAccessToken(params: {
  clientId: string;
  userId: string;
  scopes: string[];
}): Promise<{ token: string; expiresAt: Date }> {
  const token = randomHex(32);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await db.insert(oauthAccessTokens).values({
    token,
    clientId: params.clientId,
    userId: params.userId,
    scopes: params.scopes,
    expiresAt,
  });

  return { token, expiresAt };
}

/** Look up a valid (non-expired, non-revoked) access token */
export async function validateAccessToken(token: string) {
  const [row] = await db
    .select()
    .from(oauthAccessTokens)
    .where(
      and(
        eq(oauthAccessTokens.token, token),
        isNull(oauthAccessTokens.revokedAt)
      )
    )
    .limit(1);

  if (!row) return undefined;
  if (row.expiresAt < new Date()) return undefined;
  return row;
}

export async function revokeAccessToken(token: string): Promise<boolean> {
  const [row] = await db
    .update(oauthAccessTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(oauthAccessTokens.token, token),
        isNull(oauthAccessTokens.revokedAt)
      )
    )
    .returning();
  return !!row;
}

// ── User Info ────────────────────────────────────────────────

export async function getUserProfile(userId: string, scopes: string[]) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return undefined;

  const profile: Record<string, unknown> = { sub: user.id };

  if (scopes.includes("profile")) {
    profile.username = user.username;
    profile.display_name = user.displayName;
    profile.graduation_year = user.graduationYear;
    profile.major = user.major;
    profile.bio = user.bio;
    profile.avatar_url = user.avatarUrl;
  }

  if (scopes.includes("email")) {
    profile.email = user.email;
  }

  return profile;
}
