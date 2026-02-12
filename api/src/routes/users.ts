import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getUserById, updateUser } from "../services/userService.js";

const router = Router();

router.get("/me", requireAuth, async (req, res) => {
  const user = await getUserById(req.session.userId!);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  res.json(user);
});

router.patch("/me", requireAuth, async (req, res) => {
  const { displayName, graduationYear, major } = req.body;
  const updated = await updateUser(req.session.userId!, {
    displayName,
    graduationYear,
    major,
  });
  if (!updated) {
    return res.status(404).json({ error: "User not found" });
  }
  res.json(updated);
});

export default router;
