import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/auth.js";
import { createReviewSchema, updateReviewSchema } from "@betteratlas/shared";
import {
  getReviewsForCourse,
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
  const reviews = await getReviewsForCourse(courseId);
  res.json(reviews);
});

// POST /api/courses/:id/reviews
router.post(
  "/courses/:id/reviews",
  requireAuth,
  validate(createReviewSchema),
  async (req, res) => {
    const courseId = parseInt(req.params.id, 10);
    if (isNaN(courseId)) {
      return res.status(400).json({ error: "Invalid course ID" });
    }
    try {
      const review = await createReview(req.session.userId!, courseId, req.body);
      res.status(201).json(review);
    } catch (err: any) {
      if (err?.code === "23505") {
        return res
          .status(409)
          .json({ error: "You have already reviewed this course" });
      }
      throw err;
    }
  }
);

// PATCH /api/reviews/:id
router.patch(
  "/reviews/:id",
  requireAuth,
  validate(updateReviewSchema),
  async (req, res) => {
    const reviewId = parseInt(req.params.id, 10);
    if (isNaN(reviewId)) {
      return res.status(400).json({ error: "Invalid review ID" });
    }
    const updated = await updateReview(reviewId, req.session.userId!, req.body);
    if (!updated) {
      return res.status(404).json({ error: "Review not found" });
    }
    res.json(updated);
  }
);

// DELETE /api/reviews/:id
router.delete("/reviews/:id", requireAuth, async (req, res) => {
  const reviewId = parseInt(req.params.id, 10);
  if (isNaN(reviewId)) {
    return res.status(400).json({ error: "Invalid review ID" });
  }
  const deleted = await deleteReview(reviewId, req.session.userId!);
  if (!deleted) {
    return res.status(404).json({ error: "Review not found" });
  }
  res.json({ message: "Review deleted" });
});

export default router;
