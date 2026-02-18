import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  getUserById,
  getUserByUsername,
  markOnboardingComplete,
  searchUsers,
  updateUser,
} from "../services/userService.js";
import { getReviewsForUser } from "../services/reviewService.js";
import { isAdminEmail } from "../utils/admin.js";
import { listBadgesForUser } from "../services/badgeService.js";

const router = Router();

async function withUserPayload<T extends { id: string; email: string }>(user: T) {
  const badges = await listBadgesForUser(user.id);
  return {
    ...user,
    badges,
    isAdmin: isAdminEmail(user.email),
  };
}

router.get("/me", requireAuth, async (req, res) => {
  const user = await getUserById(req.user!.id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  res.json(await withUserPayload(user));
});

router.patch("/me", requireAuth, async (req, res) => {
  const rawUsername = typeof req.body.username === "string" ? req.body.username : undefined;
  const username = rawUsername
    ? rawUsername.trim().replace(/^@/, "").toLowerCase()
    : undefined;
  const fullName = typeof req.body.fullName === "string" ? req.body.fullName : undefined;
  const graduationYear = typeof req.body.graduationYear === "number" ? req.body.graduationYear : undefined;
  const major = typeof req.body.major === "string" ? req.body.major : undefined;
  const bio = typeof req.body.bio === "string" ? req.body.bio : undefined;
  const interests = Array.isArray(req.body.interests) ? req.body.interests.filter((i: unknown) => typeof i === "string") : undefined;
  const avatarUrl = typeof req.body.avatarUrl === "string" ? req.body.avatarUrl : undefined;

  try {
    const updated = await updateUser(req.user!.id, {
      username,
      fullName,
      graduationYear,
      major,
      bio,
      interests,
      avatarUrl,
    });
    if (!updated) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(await withUserPayload(updated));
  } catch (err: any) {
    const msg = String(err?.message || "");
    if (msg.toLowerCase().includes("username")) {
      return res.status(409).json({ error: "Username already taken" });
    }
    res.status(400).json({ error: "Failed to update user" });
  }
});

router.patch("/me/onboarding", requireAuth, async (req, res) => {
  const updated = await markOnboardingComplete(req.user!.id);
  if (!updated) {
    return res.status(404).json({ error: "User not found" });
  }
  res.json(await withUserPayload(updated));
});

router.get("/me/reviews", requireAuth, async (req, res) => {
  const reviews = await getReviewsForUser(req.user!.id);
  res.json(reviews);
});

router.get("/search", requireAuth, async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (q.length < 1) return res.json([]);
  const results = await searchUsers(q, req.user!.id);
  res.json(results);
});

router.get("/:id/badges", requireAuth, async (req, res) => {
  const badges = await listBadgesForUser(req.params.id);
  res.json(badges);
});

router.get("/:username", requireAuth, async (req, res) => {
  const username = req.params.username.trim().replace(/^@/, "").toLowerCase();
  const user = await getUserByUsername(username);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  res.json(await withUserPayload(user));
});

export default router;
