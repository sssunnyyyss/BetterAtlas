import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { registerSchema, loginSchema } from "@betteratlas/shared";
import { supabase, db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";

const router = Router();

router.post("/register", authLimiter, validate(registerSchema), async (req, res) => {
  try {
    const { email, password, displayName, graduationYear, major } = req.body;
    
    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      if (authError.message.includes("already registered")) {
        return res.status(409).json({ error: "Email already registered" });
      }
      throw authError;
    }

    if (!authData.user) {
      return res.status(500).json({ error: "Failed to create user" });
    }

    // Create user profile in database (using Supabase Auth UUID)
    const [user] = await db
      .insert(users)
      .values({
        id: authData.user.id,
        email,
        displayName,
        graduationYear: graduationYear ?? null,
        major: major ?? null,
      })
      .returning({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        graduationYear: users.graduationYear,
        major: users.major,
        createdAt: users.createdAt,
      });

    res.status(201).json({
      user,
      session: authData.session,
    });
  } catch (err: any) {
    console.error("Registration error:", err);
    res.status(500).json({ error: err.message || "Registration failed" });
  }
});

router.post("/login", authLimiter, validate(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Get user profile from database
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        graduationYear: users.graduationYear,
        major: users.major,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, authData.user.id))
      .limit(1);

    if (!user) {
      // Create profile if missing (edge case)
      const [newUser] = await db
        .insert(users)
        .values({
          id: authData.user.id,
          email: authData.user.email!,
          displayName: authData.user.user_metadata?.display_name || email.split("@")[0],
        })
        .returning({
          id: users.id,
          email: users.email,
          displayName: users.displayName,
          graduationYear: users.graduationYear,
          major: users.major,
          createdAt: users.createdAt,
        });
      
      return res.json({
        user: newUser,
        session: authData.session,
      });
    }

    res.json({
      user,
      session: authData.session,
    });
  } catch (err: any) {
    console.error("Login error:", err);
    res.status(500).json({ error: err.message || "Login failed" });
  }
});

router.post("/logout", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      await supabase.auth.admin.signOut(token);
    }
    
    res.json({ message: "Logged out" });
  } catch (err: any) {
    console.error("Logout error:", err);
    res.json({ message: "Logged out" });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        graduationYear: users.graduationYear,
        major: users.major,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, req.user!.id))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (err: any) {
    console.error("Get user error:", err);
    res.status(500).json({ error: err.message || "Failed to get user" });
  }
});

export default router;
