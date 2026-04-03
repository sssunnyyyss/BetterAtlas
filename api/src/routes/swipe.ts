import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  acceptRequest,
  cancelRequest,
  confirmMatch,
  confirmPaymentAndCreateRequest,
  createPaymentIntent,
  createSession,
  endSession,
  getActiveLocations,
  getActiveSession,
  getAvailableRequests,
  getEarnings,
  getHistory,
  getMatchForRequest,
  getMyActiveRequest,
  getProfileWithUser,
  isSwiperEligible,
  updateProfile,
} from "../services/swipeService.js";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";

const router = Router();

// ── Locations ─────────────────────────────────────────────────────────────────

router.get("/locations", async (_req, res) => {
  const locations = await getActiveLocations();
  res.json(locations);
});

// ── Payments ──────────────────────────────────────────────────────────────────

// Creates a Stripe PaymentIntent and returns client_secret for the iOS app
router.post("/payment-intent", requireAuth, async (_req, res) => {
  try {
    const result = await createPaymentIntent();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to create payment intent" });
  }
});

// ── Requests ──────────────────────────────────────────────────────────────────

// Create a request after Apple Pay succeeds
router.post("/requests", requireAuth, async (req, res) => {
  const { locationId, paymentIntentId } = req.body;
  if (!locationId || !paymentIntentId) {
    return res.status(400).json({ error: "locationId and paymentIntentId are required" });
  }
  try {
    const request = await confirmPaymentAndCreateRequest(
      req.user!.id,
      Number(locationId),
      String(paymentIntentId)
    );
    res.status(201).json(request);
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to create request" });
  }
});

// Buyer's current active request (with match info if matched)
router.get("/requests/mine", requireAuth, async (req, res) => {
  const request = await getMyActiveRequest(req.user!.id);
  if (!request) return res.json(null);

  let match = null;
  if (request.status === "matched") {
    match = await getMatchForRequest(request.id);
  }
  res.json({ ...request, match });
});

// Pending requests at the swiper's active session location
router.get("/requests/available", requireAuth, async (req, res) => {
  const requests = await getAvailableRequests(req.user!.id);
  res.json(requests);
});

// Swiper accepts a pending request
router.post("/requests/:id/accept", requireAuth, async (req, res) => {
  try {
    const match = await acceptRequest(req.user!.id, req.params.id);
    res.status(201).json(match);
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to accept request" });
  }
});

// Buyer or swiper confirms the meeting happened
router.post("/requests/:id/confirm", requireAuth, async (req, res) => {
  // Find the match for this request
  const match = await getMatchForRequest(req.params.id);
  if (!match) return res.status(404).json({ error: "No match found for this request" });

  try {
    const updated = await confirmMatch(req.user!.id, match.id);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to confirm" });
  }
});

// Buyer cancels their request (issues refund)
router.post("/requests/:id/cancel", requireAuth, async (req, res) => {
  try {
    const request = await cancelRequest(req.user!.id, req.params.id);
    res.json(request);
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to cancel request" });
  }
});

// ── Sessions ──────────────────────────────────────────────────────────────────

// Swiper goes online at a location
router.post("/sessions", requireAuth, async (req, res) => {
  const { locationId } = req.body;
  if (!locationId) {
    return res.status(400).json({ error: "locationId is required" });
  }

  // Verify user is a swiper
  const [user] = await db
    .select({ graduationYear: users.graduationYear })
    .from(users)
    .where(eq(users.id, req.user!.id))
    .limit(1);

  if (!user || !isSwiperEligible(user.graduationYear ?? null)) {
    return res.status(403).json({ error: "Only eligible swipers can go online" });
  }

  try {
    const session = await createSession(req.user!.id, Number(locationId));
    res.status(201).json(session);
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to create session" });
  }
});

// Swiper goes offline
router.delete("/sessions/:id", requireAuth, async (req, res) => {
  const session = await endSession(req.user!.id, req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found" });
  res.json(session);
});

// Get swiper's active session
router.get("/sessions/active", requireAuth, async (req, res) => {
  const session = await getActiveSession(req.user!.id);
  res.json(session ?? null);
});

// ── Earnings ──────────────────────────────────────────────────────────────────

router.get("/earnings", requireAuth, async (req, res) => {
  const earnings = await getEarnings(req.user!.id);
  res.json(earnings);
});

// ── History ───────────────────────────────────────────────────────────────────

router.get("/history", requireAuth, async (req, res) => {
  const history = await getHistory(req.user!.id);
  res.json(history);
});

// ── Profile ───────────────────────────────────────────────────────────────────

router.get("/profile", requireAuth, async (req, res) => {
  const profile = await getProfileWithUser(req.user!.id);
  res.json(profile);
});

router.patch("/profile", requireAuth, async (req, res) => {
  const { venmoHandle, isSwiperEnabled } = req.body;
  try {
    const updated = await updateProfile(req.user!.id, {
      ...(venmoHandle !== undefined && { venmoHandle }),
      ...(isSwiperEnabled !== undefined && { isSwiperEnabled }),
    });
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to update profile" });
  }
});

export default router;
