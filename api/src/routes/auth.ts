import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { registerSchema, loginSchema } from "@betteratlas/shared";
import { createUser, verifyCredentials, getUserById } from "../services/userService.js";

const router = Router();

router.post("/register", authLimiter, validate(registerSchema), async (req, res) => {
  try {
    const user = await createUser(req.body);
    req.session.userId = user.id;
    res.status(201).json(user);
  } catch (err: any) {
    if (err?.code === "23505") {
      return res.status(409).json({ error: "Email already registered" });
    }
    throw err;
  }
});

router.post("/login", authLimiter, validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;
  const user = await verifyCredentials(email, password);
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  req.session.userId = user.id;
  res.json(user);
});

router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Failed to logout" });
    }
    res.clearCookie("connect.sid");
    res.json({ message: "Logged out" });
  });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await getUserById(req.session.userId!);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  res.json(user);
});

export default router;
