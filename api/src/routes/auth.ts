import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { registerSchema, loginSchema } from "@betteratlas/shared";
import { supabase, db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { isAdminEmail } from "../utils/admin.js";
import { env } from "../config/env.js";
import {
  evaluateInviteCode,
  getInviteCodeByCode,
  incrementInviteCodeUsedCount,
} from "../services/inviteCodeService.js";
import {
  getBadgeBySlug,
  grantBadgeToUser,
  listBadgesForUser,
} from "../services/badgeService.js";

const router = Router();

const authUserSelect = {
  id: users.id,
  email: users.email,
  username: users.username,
  fullName: users.displayName,
  graduationYear: users.graduationYear,
  major: users.major,
  hasCompletedOnboarding: users.hasCompletedOnboarding,
  createdAt: users.createdAt,
};

type AuthUserRow = {
  id: string;
  email: string;
  username: string;
  fullName: string;
  graduationYear: number | null;
  major: string | null;
  hasCompletedOnboarding: boolean;
  createdAt: Date | null;
};

function withAdminFlag<T extends { email: string }>(user: T) {
  return {
    ...user,
    isAdmin: isAdminEmail(user.email),
  };
}

async function withAuthPayload(user: AuthUserRow) {
  const badges = await listBadgesForUser(user.id);
  return withAdminFlag({
    ...user,
    badges,
  });
}

router.post("/register", authLimiter, validate(registerSchema), async (req, res) => {
  try {
    const {
      email,
      password,
      fullName,
      username,
      graduationYear,
      major,
      inviteCode,
    } = req.body;

    if (env.betaRequireInviteCode && !inviteCode) {
      return res
        .status(400)
        .json({ error: "Invite code is required while beta access is enabled" });
    }

    // Pre-check username uniqueness for a clean 409 response.
    const [usernameTaken] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    if (usernameTaken) {
      return res.status(409).json({ error: "Username already taken" });
    }

    let validInviteCode:
      | {
          id: number;
          code: string;
          badgeSlug: string;
          maxUses: number | null;
          usedCount: number;
          expiresAt: Date | null;
          createdAt: Date | null;
        }
      | null = null;

    if (inviteCode) {
      const invite = await getInviteCodeByCode(inviteCode);
      if (!invite) {
        return res.status(400).json({ error: "Invalid or expired invite code" });
      }

      const evaluation = evaluateInviteCode({
        usedCount: invite.usedCount,
        maxUses: invite.maxUses,
        expiresAt: invite.expiresAt,
      });
      if (!evaluation.ok) {
        return res.status(400).json({ error: "Invalid or expired invite code" });
      }

      validInviteCode = invite;
    }
    
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
        username,
        displayName: fullName,
        graduationYear: graduationYear ?? null,
        major: major ?? null,
        inviteCode: validInviteCode?.code ?? null,
      })
      .returning(authUserSelect);

    if (validInviteCode) {
      await incrementInviteCodeUsedCount(validInviteCode.id);
      const badge = await getBadgeBySlug(validInviteCode.badgeSlug);
      if (badge) {
        await grantBadgeToUser(user.id, badge.id);
      }
    }

    const authUser = await withAuthPayload(user);

    res.status(201).json({
      user: authUser,
      session: authData.session,
    });
  } catch (err: any) {
    console.error("Registration error:", err);
    if (String(err?.message || "").toLowerCase().includes("username")) {
      return res.status(409).json({ error: "Username already taken" });
    }
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
        username: users.username,
        fullName: users.displayName,
        graduationYear: users.graduationYear,
        major: users.major,
        hasCompletedOnboarding: users.hasCompletedOnboarding,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, authData.user.id))
      .limit(1);

    if (!user) {
      // Create profile if missing (edge case)
      const base = (authData.user.email || email).split("@")[0].toLowerCase();
      let derivedUsername = base.replace(/[^a-z0-9_]+/g, "_").slice(0, 30);
      for (let i = 0; i < 5; i++) {
        const [taken] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.username, derivedUsername))
          .limit(1);
        if (!taken) break;
        derivedUsername = `${base}_${i + 1}`.replace(/[^a-z0-9_]+/g, "_").slice(0, 30);
      }
      const [newUser] = await db
        .insert(users)
        .values({
          id: authData.user.id,
          email: authData.user.email!,
          username: derivedUsername,
          displayName: authData.user.user_metadata?.display_name || email.split("@")[0],
        })
        .returning({
          id: users.id,
          email: users.email,
          username: users.username,
          fullName: users.displayName,
          graduationYear: users.graduationYear,
          major: users.major,
          hasCompletedOnboarding: users.hasCompletedOnboarding,
          createdAt: users.createdAt,
        });

      const authUser = await withAuthPayload(newUser);
      
      return res.json({
        user: authUser,
        session: authData.session,
      });
    }

    if (!user.username) {
      const base = (authData.user.email || email).split("@")[0].toLowerCase();
      const derivedUsername = base.replace(/[^a-z0-9_]+/g, "_").slice(0, 30);
      const [updated] = await db
        .update(users)
        .set({ username: derivedUsername })
        .where(eq(users.id, authData.user.id))
        .returning({
          id: users.id,
          email: users.email,
          username: users.username,
          fullName: users.displayName,
          graduationYear: users.graduationYear,
          major: users.major,
          hasCompletedOnboarding: users.hasCompletedOnboarding,
          createdAt: users.createdAt,
        });
      if (updated) {
        const authUser = await withAuthPayload(updated);
        return res.json({ user: authUser, session: authData.session });
      }
    }

    const authUser = await withAuthPayload(user);
    res.json({
      user: authUser,
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
          username: users.username,
          fullName: users.displayName,
          graduationYear: users.graduationYear,
          major: users.major,
          hasCompletedOnboarding: users.hasCompletedOnboarding,
          createdAt: users.createdAt,
        })
      .from(users)
      .where(eq(users.id, req.user!.id))
      .limit(1);

    if (!user) {
      // Self-heal: if Auth user exists but profile row doesn't (e.g., legacy accounts),
      // create a minimal profile so the client can proceed.
      const displayName = req.user!.email
        ? req.user!.email.split("@")[0]
        : "User";
      const base = (req.user!.email || "user").split("@")[0].toLowerCase();
      let derivedUsername = base.replace(/[^a-z0-9_]+/g, "_").slice(0, 30);
      for (let i = 0; i < 5; i++) {
        const [taken] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.username, derivedUsername))
          .limit(1);
        if (!taken) break;
        derivedUsername = `${base}_${i + 1}`.replace(/[^a-z0-9_]+/g, "_").slice(0, 30);
      }

      const [created] = await db
        .insert(users)
        .values({
          id: req.user!.id,
          email: req.user!.email || "",
          username: derivedUsername,
          displayName,
        })
        .onConflictDoNothing()
        .returning({
          id: users.id,
          email: users.email,
          username: users.username,
          fullName: users.displayName,
          graduationYear: users.graduationYear,
          major: users.major,
          hasCompletedOnboarding: users.hasCompletedOnboarding,
          createdAt: users.createdAt,
        });

      if (created) return res.json(await withAuthPayload(created));

      // In case of a race where another request inserted the row, re-read once.
      const [reloaded] = await db
        .select({
          id: users.id,
          email: users.email,
          username: users.username,
          fullName: users.displayName,
          graduationYear: users.graduationYear,
          major: users.major,
          hasCompletedOnboarding: users.hasCompletedOnboarding,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.id, req.user!.id))
        .limit(1);

      if (!reloaded) return res.status(404).json({ error: "User not found" });
      return res.json(await withAuthPayload(reloaded));
    }

    if (!user.username) {
      const base = (req.user!.email || "user").split("@")[0].toLowerCase();
      const derivedUsername = base.replace(/[^a-z0-9_]+/g, "_").slice(0, 30);
      const [updated] = await db
        .update(users)
        .set({ username: derivedUsername })
        .where(eq(users.id, req.user!.id))
        .returning({
          id: users.id,
          email: users.email,
          username: users.username,
          fullName: users.displayName,
          graduationYear: users.graduationYear,
          major: users.major,
          hasCompletedOnboarding: users.hasCompletedOnboarding,
          createdAt: users.createdAt,
        });
      if (updated) return res.json(await withAuthPayload(updated));
    }

    res.json(await withAuthPayload(user));
  } catch (err: any) {
    console.error("Get user error:", err);
    res.status(500).json({ error: err.message || "Failed to get user" });
  }
});

export default router;
