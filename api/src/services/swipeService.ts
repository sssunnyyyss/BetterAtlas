import Stripe from "stripe";
import { and, desc, eq, gt, inArray, ne, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  swipeEarnings,
  swipeLocations,
  swipeMatches,
  swipeProfiles,
  swipeRequests,
  swipeSessions,
  users,
} from "../db/schema.js";
import { env } from "../config/env.js";

const stripe = new Stripe(env.stripeSecretKey);

// ── helpers ──────────────────────────────────────────────────────────────────

/** Freshmen/sophomores (grad year >= current year + 2) are eligible swipers. */
export function isSwiperEligible(graduationYear: number | null): boolean {
  if (!graduationYear) return false;
  return graduationYear >= new Date().getFullYear() + 2;
}

// ── profile ───────────────────────────────────────────────────────────────────

export async function getOrCreateProfile(userId: string) {
  const [existing] = await db
    .select()
    .from(swipeProfiles)
    .where(eq(swipeProfiles.userId, userId))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(swipeProfiles)
    .values({ userId })
    .returning();
  return created;
}

export async function updateProfile(
  userId: string,
  patch: { venmoHandle?: string | null; isSwiperEnabled?: boolean }
) {
  await getOrCreateProfile(userId);
  const [updated] = await db
    .update(swipeProfiles)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(swipeProfiles.userId, userId))
    .returning();
  return updated;
}

export async function getProfileWithUser(userId: string) {
  const profile = await getOrCreateProfile(userId);
  const [user] = await db
    .select({ graduationYear: users.graduationYear })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return {
    ...profile,
    isSwiperEligible: isSwiperEligible(user?.graduationYear ?? null),
  };
}

// ── locations ─────────────────────────────────────────────────────────────────

export async function getActiveLocations() {
  return db
    .select()
    .from(swipeLocations)
    .where(eq(swipeLocations.isActive, true))
    .orderBy(swipeLocations.name);
}

// ── sessions ──────────────────────────────────────────────────────────────────

export async function createSession(swiperId: string, locationId: number) {
  // Deactivate any existing active sessions
  await db
    .update(swipeSessions)
    .set({ status: "offline", updatedAt: new Date() })
    .where(and(eq(swipeSessions.swiperId, swiperId), eq(swipeSessions.status, "active")));

  const [session] = await db
    .insert(swipeSessions)
    .values({ swiperId, locationId, status: "active" })
    .returning();
  return session;
}

export async function endSession(swiperId: string, sessionId: string) {
  // Cancel any active match for this swiper
  const activeMatches = await db
    .select({ id: swipeMatches.id, requestId: swipeMatches.requestId })
    .from(swipeMatches)
    .where(
      and(
        eq(swipeMatches.swiperId, swiperId),
        eq(swipeMatches.sessionId, sessionId),
        eq(swipeMatches.status, "pending")
      )
    );

  for (const match of activeMatches) {
    await cancelMatchAndRefund(match.id, match.requestId);
  }

  const [session] = await db
    .update(swipeSessions)
    .set({ status: "offline", updatedAt: new Date() })
    .where(
      and(
        eq(swipeSessions.id, sessionId),
        eq(swipeSessions.swiperId, swiperId)
      )
    )
    .returning();
  return session ?? null;
}

export async function getActiveSession(swiperId: string) {
  const [session] = await db
    .select()
    .from(swipeSessions)
    .where(
      and(eq(swipeSessions.swiperId, swiperId), eq(swipeSessions.status, "active"))
    )
    .limit(1);
  return session ?? null;
}

// ── payments ──────────────────────────────────────────────────────────────────

export async function createPaymentIntent() {
  const intent = await stripe.paymentIntents.create({
    amount: 500, // $5.00
    currency: "usd",
    payment_method_types: ["card"],
  });
  return { clientSecret: intent.client_secret!, paymentIntentId: intent.id };
}

// ── requests ──────────────────────────────────────────────────────────────────

export async function confirmPaymentAndCreateRequest(
  buyerId: string,
  locationId: number,
  paymentIntentId: string
) {
  // Verify payment succeeded
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (intent.status !== "succeeded") {
    throw new Error(`Payment not completed (status: ${intent.status})`);
  }

  // Idempotency: return existing request if already created for this PI
  const [existing] = await db
    .select()
    .from(swipeRequests)
    .where(eq(swipeRequests.stripePaymentIntentId, paymentIntentId))
    .limit(1);
  if (existing) return existing;

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min from now
  const [request] = await db
    .insert(swipeRequests)
    .values({
      buyerId,
      locationId,
      status: "pending",
      amountCents: 500,
      stripePaymentIntentId: paymentIntentId,
      stripePaymentStatus: intent.status,
      expiresAt,
    })
    .returning();
  return request;
}

export async function getMyActiveRequest(buyerId: string) {
  const [request] = await db
    .select()
    .from(swipeRequests)
    .where(
      and(
        eq(swipeRequests.buyerId, buyerId),
        inArray(swipeRequests.status, ["pending", "matched"])
      )
    )
    .orderBy(desc(swipeRequests.createdAt))
    .limit(1);

  if (!request) return null;

  // Auto-expire if needed
  if (
    request.status === "pending" &&
    request.expiresAt &&
    request.expiresAt < new Date()
  ) {
    return expireRequest(request.id, request.stripePaymentIntentId);
  }

  return request;
}

export async function getAvailableRequests(swiperId: string) {
  const session = await getActiveSession(swiperId);
  if (!session) return [];

  const now = new Date();
  const rows = await db
    .select()
    .from(swipeRequests)
    .where(
      and(
        eq(swipeRequests.locationId, session.locationId),
        eq(swipeRequests.status, "pending"),
        gt(swipeRequests.expiresAt, now)
      )
    )
    .orderBy(swipeRequests.createdAt);

  return rows;
}

async function expireRequest(requestId: string, paymentIntentId: string | null) {
  if (paymentIntentId) {
    try {
      await stripe.refunds.create({ payment_intent: paymentIntentId });
    } catch {
      // Refund may already exist; ignore
    }
  }
  const [updated] = await db
    .update(swipeRequests)
    .set({ status: "expired", updatedAt: new Date() })
    .where(eq(swipeRequests.id, requestId))
    .returning();
  return updated ?? null;
}

// ── matches ───────────────────────────────────────────────────────────────────

export async function acceptRequest(swiperId: string, requestId: string) {
  const session = await getActiveSession(swiperId);
  if (!session) throw new Error("You must be online to accept requests");

  const [request] = await db
    .select()
    .from(swipeRequests)
    .where(eq(swipeRequests.id, requestId))
    .limit(1);

  if (!request) throw new Error("Request not found");
  if (request.status !== "pending") throw new Error("Request is no longer available");
  if (request.locationId !== session.locationId)
    throw new Error("Request is at a different location");
  if (request.buyerId === swiperId) throw new Error("You cannot swipe yourself");
  if (request.expiresAt && request.expiresAt < new Date())
    throw new Error("Request has expired");

  const [match] = await db
    .insert(swipeMatches)
    .values({
      requestId,
      sessionId: session.id,
      swiperId,
      status: "pending",
    })
    .returning();

  await db
    .update(swipeRequests)
    .set({ status: "matched", updatedAt: new Date() })
    .where(eq(swipeRequests.id, requestId));

  return match;
}

export async function confirmMatch(userId: string, matchId: string) {
  const [match] = await db
    .select()
    .from(swipeMatches)
    .where(eq(swipeMatches.id, matchId))
    .limit(1);

  if (!match) throw new Error("Match not found");
  if (match.status !== "pending") throw new Error("Match is already resolved");

  const [request] = await db
    .select()
    .from(swipeRequests)
    .where(eq(swipeRequests.id, match.requestId))
    .limit(1);
  if (!request) throw new Error("Request not found");

  const isBuyer = request.buyerId === userId;
  const isSwiper = match.swiperId === userId;
  if (!isBuyer && !isSwiper) throw new Error("Not a participant in this match");

  const patch: { buyerConfirmed?: boolean; swiperConfirmed?: boolean } = {};
  if (isBuyer) patch.buyerConfirmed = true;
  if (isSwiper) patch.swiperConfirmed = true;

  const newBuyerConfirmed = isBuyer ? true : match.buyerConfirmed ?? false;
  const newSwiperConfirmed = isSwiper ? true : match.swiperConfirmed ?? false;

  if (newBuyerConfirmed && newSwiperConfirmed) {
    // Both confirmed — complete the transaction
    await db
      .update(swipeMatches)
      .set({ ...patch, status: "completed", updatedAt: new Date() })
      .where(eq(swipeMatches.id, matchId));

    await db
      .update(swipeRequests)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(swipeRequests.id, match.requestId));

    // Credit swiper earnings
    await db.insert(swipeEarnings).values({
      swiperId: match.swiperId,
      matchId,
      amountCents: 400,
      status: "pending",
    });

    await db
      .update(swipeProfiles)
      .set({
        totalEarnedCents: sql`${swipeProfiles.totalEarnedCents} + 400`,
        updatedAt: new Date(),
      })
      .where(eq(swipeProfiles.userId, match.swiperId));
  } else {
    await db
      .update(swipeMatches)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(swipeMatches.id, matchId));
  }

  const [updated] = await db
    .select()
    .from(swipeMatches)
    .where(eq(swipeMatches.id, matchId))
    .limit(1);
  return updated;
}

export async function cancelRequest(userId: string, requestId: string) {
  const [request] = await db
    .select()
    .from(swipeRequests)
    .where(eq(swipeRequests.id, requestId))
    .limit(1);

  if (!request) throw new Error("Request not found");
  if (request.buyerId !== userId) throw new Error("Not your request");
  if (!["pending", "matched"].includes(request.status))
    throw new Error("Request cannot be cancelled");

  // Cancel any active match
  if (request.status === "matched") {
    const [activeMatch] = await db
      .select({ id: swipeMatches.id })
      .from(swipeMatches)
      .where(
        and(eq(swipeMatches.requestId, requestId), eq(swipeMatches.status, "pending"))
      )
      .limit(1);
    if (activeMatch) {
      await db
        .update(swipeMatches)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(swipeMatches.id, activeMatch.id));
    }
  }

  // Refund buyer
  if (request.stripePaymentIntentId) {
    try {
      await stripe.refunds.create({ payment_intent: request.stripePaymentIntentId });
    } catch {
      // Ignore duplicate refund errors
    }
  }

  const [updated] = await db
    .update(swipeRequests)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(swipeRequests.id, requestId))
    .returning();
  return updated;
}

async function cancelMatchAndRefund(matchId: string, requestId: string) {
  await db
    .update(swipeMatches)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(swipeMatches.id, matchId));

  const [request] = await db
    .select({ stripePaymentIntentId: swipeRequests.stripePaymentIntentId })
    .from(swipeRequests)
    .where(eq(swipeRequests.id, requestId))
    .limit(1);

  if (request?.stripePaymentIntentId) {
    try {
      await stripe.refunds.create({ payment_intent: request.stripePaymentIntentId });
    } catch {
      // Ignore duplicate refund errors
    }
  }

  await db
    .update(swipeRequests)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(swipeRequests.id, requestId));
}

// ── earnings & history ────────────────────────────────────────────────────────

export async function getEarnings(swiperId: string) {
  const profile = await getOrCreateProfile(swiperId);
  const pending = await db
    .select()
    .from(swipeEarnings)
    .where(and(eq(swipeEarnings.swiperId, swiperId), eq(swipeEarnings.status, "pending")))
    .orderBy(desc(swipeEarnings.createdAt));

  return {
    totalEarnedCents: profile.totalEarnedCents ?? 0,
    pendingCents: pending.reduce((sum, e) => sum + e.amountCents, 0),
    pendingPayouts: pending,
  };
}

export async function getHistory(userId: string) {
  const asBuyer = await db
    .select()
    .from(swipeRequests)
    .where(
      and(
        eq(swipeRequests.buyerId, userId),
        inArray(swipeRequests.status, ["completed", "cancelled", "expired"])
      )
    )
    .orderBy(desc(swipeRequests.createdAt))
    .limit(50);

  const asSwiper = await db
    .select()
    .from(swipeMatches)
    .where(
      and(
        eq(swipeMatches.swiperId, userId),
        ne(swipeMatches.status, "pending")
      )
    )
    .orderBy(desc(swipeMatches.createdAt))
    .limit(50);

  return { asBuyer, asSwiper };
}

export async function getMatchForRequest(requestId: string) {
  const [match] = await db
    .select()
    .from(swipeMatches)
    .where(eq(swipeMatches.requestId, requestId))
    .orderBy(desc(swipeMatches.createdAt))
    .limit(1);
  return match ?? null;
}
