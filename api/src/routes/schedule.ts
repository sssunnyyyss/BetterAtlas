import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { addListItemSchema } from "@betteratlas/shared";
import {
  addToMySchedule,
  getFriendsSchedules,
  getMySchedule,
  removeFromMySchedule,
} from "../services/scheduleService.js";

const router = Router();

router.get("/schedule", requireAuth, async (req, res) => {
  const term = typeof req.query.term === "string" ? req.query.term : undefined;
  const schedule = await getMySchedule(req.user!.id, term);
  res.json(schedule);
});

router.post(
  "/schedule/items",
  requireAuth,
  validate(addListItemSchema),
  async (req, res) => {
    try {
      const created = await addToMySchedule(req.user!.id, req.body);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ error: err.message || "Failed to add to schedule" });
    }
  }
);

router.delete("/schedule/items/:id", requireAuth, async (req, res) => {
  const itemId = parseInt(req.params.id, 10);
  if (isNaN(itemId)) {
    return res.status(400).json({ error: "Invalid item ID" });
  }

  const removed = await removeFromMySchedule(req.user!.id, itemId);
  if (!removed) return res.status(404).json({ error: "Item not found" });
  res.json({ message: "Removed" });
});

router.get("/schedule/friends", requireAuth, async (req, res) => {
  const term = typeof req.query.term === "string" ? req.query.term : undefined;
  const schedules = await getFriendsSchedules(req.user!.id, term);
  res.json(schedules);
});

export default router;

