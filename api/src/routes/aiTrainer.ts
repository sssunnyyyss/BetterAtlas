import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { isAdminEmail } from "../utils/admin.js";
import {
  upsertAiTrainerRating,
  deleteAiTrainerRating,
  getAiTrainerRatingsForUser,
} from "../services/aiTrainerService.js";

const router = Router();

router.use(requireAuth, (req, res, next) => {
  if (!isAdminEmail(req.user?.email)) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
});

// GET /api/admin/ai-trainer/ratings — load all ratings for current admin
router.get("/ratings", async (req, res) => {
  try {
    const ratings = await getAiTrainerRatingsForUser(req.user!.id);
    res.json(ratings);
  } catch (err: any) {
    console.error("GET ai-trainer ratings error:", err);
    res.status(500).json({ error: err?.message || "Failed to load ratings" });
  }
});

// PUT /api/admin/ai-trainer/ratings/:courseId — upsert rating
router.put("/ratings/:courseId", async (req, res) => {
  try {
    const courseId = Number.parseInt(req.params.courseId, 10);
    if (!Number.isFinite(courseId) || courseId <= 0) {
      return res.status(400).json({ error: "Invalid courseId" });
    }

    const rating = Number(req.body?.rating);
    if (rating !== 1 && rating !== -1) {
      return res.status(400).json({ error: "rating must be 1 or -1" });
    }

    const context = req.body?.context ?? null;
    await upsertAiTrainerRating(req.user!.id, courseId, rating, context);
    res.json({ ok: true, courseId, rating });
  } catch (err: any) {
    console.error("PUT ai-trainer rating error:", err);
    res.status(500).json({ error: err?.message || "Failed to save rating" });
  }
});

// DELETE /api/admin/ai-trainer/ratings/:courseId — remove rating
router.delete("/ratings/:courseId", async (req, res) => {
  try {
    const courseId = Number.parseInt(req.params.courseId, 10);
    if (!Number.isFinite(courseId) || courseId <= 0) {
      return res.status(400).json({ error: "Invalid courseId" });
    }

    await deleteAiTrainerRating(req.user!.id, courseId);
    res.json({ ok: true, courseId });
  } catch (err: any) {
    console.error("DELETE ai-trainer rating error:", err);
    res.status(500).json({ error: err?.message || "Failed to delete rating" });
  }
});

export default router;
