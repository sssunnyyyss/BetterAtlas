import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/auth.js";
import { createFeedbackSchema } from "@betteratlas/shared";
import { createFeedbackReport } from "../services/feedbackService.js";

const router = Router();

// POST /api/feedback
router.post("/feedback", requireAuth, validate(createFeedbackSchema), async (req, res) => {
  try {
    const feedback = await createFeedbackReport(req.user!.id, req.body);
    res.status(201).json(feedback);
  } catch (err: any) {
    if (
      err?.message &&
      (String(err.message).includes("Selected section does not exist") ||
        String(err.message).includes("Selected section does not belong"))
    ) {
      return res.status(400).json({ error: err.message });
    }
    throw err;
  }
});

export default router;
