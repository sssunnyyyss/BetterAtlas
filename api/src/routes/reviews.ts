import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/auth.js";
import { reviewLimiter } from "../middleware/rateLimit.js";
import { createReviewSchema, updateReviewSchema } from "@betteratlas/shared";
import {
  getReviewsForCourse,
  getReviewsForSection,
  createReview,
  updateReview,
  deleteReview,
} from "../services/reviewService.js";

const router = Router();

// GET /api/courses/:id/reviews
router.get("/courses/:id/reviews", async (req, res) => {
  const courseId = parseInt(req.params.id, 10);
  if (isNaN(courseId)) {
    return res.status(400).json({ error: "Invalid course ID" });
  }
  const sourceParam = req.query.source;
  if (
    sourceParam !== undefined &&
    sourceParam !== "native" &&
    sourceParam !== "rmp"
  ) {
    return res.status(400).json({ error: "Invalid source filter" });
  }

  const source = sourceParam as "native" | "rmp" | undefined;
  const reviews = await getReviewsForCourse(courseId, source);
  res.json(reviews);
});

// GET /api/sections/:id/reviews
router.get("/sections/:id/reviews", async (req, res) => {
  const sectionId = parseInt(req.params.id, 10);
  if (isNaN(sectionId)) {
    return res.status(400).json({ error: "Invalid section ID" });
  }
  const reviews = await getReviewsForSection(sectionId);
  res.json(reviews);
});

// POST /api/courses/:id/reviews
router.post(
  "/courses/:id/reviews",
  requireAuth,
  reviewLimiter,
  validate(createReviewSchema),
  async (req, res) => {
    const courseId = parseInt(req.params.id, 10);
    if (isNaN(courseId)) {
      return res.status(400).json({ error: "Invalid course ID" });
    }
    try {
      const review = await createReview(req.user!.id, courseId, req.body);
      res.status(201).json(review);
    } catch (err: any) {
      if (err?.message && String(err.message).includes("Selected section does not belong")) {
        return res.status(400).json({ error: err.message });
      }
      if (err?.code === "23505") {
        return res
          .status(409)
          .json({ error: "You have already reviewed this section" });
      }
      throw err;
    }
  }
);

// PATCH /api/reviews/:id
router.patch(
  "/reviews/:id",
  requireAuth,
  reviewLimiter,
  validate(updateReviewSchema),
  async (req, res) => {
    const reviewId = parseInt(req.params.id, 10);
    if (isNaN(reviewId)) {
      return res.status(400).json({ error: "Invalid review ID" });
    }
    const updated = await updateReview(reviewId, req.user!.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: "Review not found" });
    }
    res.json(updated);
  }
);

// DELETE /api/reviews/:id
router.delete("/reviews/:id", requireAuth, reviewLimiter, async (req, res) => {
  const reviewId = parseInt(req.params.id, 10);
  if (isNaN(reviewId)) {
    return res.status(400).json({ error: "Invalid review ID" });
  }
  const deleted = await deleteReview(reviewId, req.user!.id);
  if (!deleted) {
    return res.status(404).json({ error: "Review not found" });
  }
  res.json({ message: "Review deleted" });
});

export default router;
