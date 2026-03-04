import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { registerSchema, loginSchema } from "@betteratlas/shared";
import { z } from "zod";
import { supabase, supabaseAnon, db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { isAdminEmail } from "../utils/admin.js";
import {
  evaluateInviteCode,
  getInviteCodeByCode,
  incrementInviteCodeUsedCount,
} from "../services/inviteCodeService.js";
import { env } from "../config/env.js";
import {
  getBadgeBySlug,
  grantBadgeToUser,
  listBadgesForUser,
} from "../services/badgeService.js";
import crypto from "node:crypto";

const router = Router();
const resendVerificationSchema = z.object({
  email: z.string().email(),
});
const passwordResetRequestSchema = z.object({
  email: z.string().email(),
});
const passwordResetVerifySchema = z.object({
  email: z.string().email(),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Code must be a 6-digit number"),
});
const passwordResetCompleteSchema = z.object({
  resetToken: z.string().min(16),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});
const loginRedirectUrl = `${env.frontendUrl.replace(/\/+$/, "")}/login?emailVerified=1`;

const RESET_TOKEN_TTL_MS = 10 * 60 * 1000;
const resetChallengeTokens = new Map<
  string,
  { userId: string; email: string; expiresAt: number }
>();

function cleanupExpiredResetTokens() {
  const now = Date.now();
  for (const [token, payload] of resetChallengeTokens.entries()) {
    if (payload.expiresAt <= now) resetChallengeTokens.delete(token);
  }
}

const authUserSelect = {
  id: users.id,
  email: users.email,
  username: users.username,
  fullName: users.displayName,
  graduationYear: users.graduationYear,
  major: users.major,
  bio: users.bio,
  interests: users.interests,
  avatarUrl: users.avatarUrl,
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
  bio: string | null;
  interests: string[] | null;
  avatarUrl: string | null;
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
    bio: user.bio ?? null,
    interests: Array.isArray(user.interests) ? user.interests : [],
    avatarUrl: user.avatarUrl ?? null,
    badges,
  });
}

router.post("/invite-code/verify", authLimiter, async (req, res) => {
  const inviteCodeInput =
    typeof req.body?.inviteCode === "string" ? req.body.inviteCode : "";
  const inviteCode = inviteCodeInput.trim().toUpperCase();

  if (!inviteCode) {
    return res.status(400).json({ error: "Invite code is required" });
  }

  if (!/^[A-Z0-9-]+$/.test(inviteCode)) {
    return res
      .status(400)
      .json({ error: "Invite code can only contain letters, numbers, and hyphens" });
  }

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

  return res.json({
    valid: true,
    inviteCode: invite.code,
  });
});

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
      options: {
        emailRedirectTo: loginRedirectUrl,
      },
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
      requiresEmailVerification: !authData.session,
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

    if (authError) {
      if (String(authError.message || "").toLowerCase().includes("email not confirmed")) {
        return res.status(403).json({
          error: "Please verify your email before signing in. Check your inbox for the confirmation link.",
        });
      }
      return res.status(401).json({ error: "Invalid email or password" });
    }
    if (!authData.user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Get user profile from database
    const [user] = await db
      .select(authUserSelect)
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
        .returning(authUserSelect);

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
        .returning(authUserSelect);
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

router.post(
  "/resend-verification",
  authLimiter,
  validate(resendVerificationSchema),
  async (req, res) => {
    const { email } = req.body;

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: loginRedirectUrl,
        },
      });

      if (error) {
        const message = String(error.message || "").toLowerCase();
        // Avoid leaking whether an account exists for this email.
        if (message.includes("not found") || message.includes("for security purposes")) {
          return res.json({
            message:
              "If an unverified account exists for this email, a verification email has been sent.",
          });
        }
        throw error;
      }

      return res.json({
        message:
          "If an unverified account exists for this email, a verification email has been sent.",
      });
    } catch (err: any) {
      console.error("Resend verification error:", err);
      return res.status(500).json({ error: "Failed to resend verification email" });
    }
  }
);

router.post(
  "/password-reset/request",
  authLimiter,
  validate(passwordResetRequestSchema),
  async (req, res) => {
    const { email } = req.body;
    const genericMessage =
      "If an account exists for this email, a 6-digit verification code has been sent.";

    try {
      const { error } = await supabaseAnon.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
        },
      });

      if (error) {
        const message = String(error.message || "").toLowerCase();
        // Do not leak account existence.
        if (
          message.includes("not found") ||
          message.includes("not registered") ||
          message.includes("for security purposes") ||
          message.includes("signups not allowed")
        ) {
          return res.json({ message: genericMessage });
        }
        throw error;
      }

      return res.json({ message: genericMessage });
    } catch (err: any) {
      console.error("Password reset request error:", err);
      return res.status(500).json({ error: "Failed to send verification code" });
    }
  }
);

router.post(
  "/password-reset/verify-code",
  authLimiter,
  validate(passwordResetVerifySchema),
  async (req, res) => {
    const { email, code } = req.body;

    try {
      cleanupExpiredResetTokens();
      const { data, error } = await supabaseAnon.auth.verifyOtp({
        email,
        token: code,
        type: "email",
      });

      if (error) {
        return res.status(400).json({ error: "Invalid or expired verification code" });
      }

      const userId = data.user?.id ?? data.session?.user?.id;
      if (!userId) {
        return res.status(400).json({ error: "Invalid or expired verification code" });
      }

      const resetToken = crypto.randomBytes(24).toString("hex");
      resetChallengeTokens.set(resetToken, {
        userId,
        email,
        expiresAt: Date.now() + RESET_TOKEN_TTL_MS,
      });

      return res.json({
        resetToken,
        message: "Code verified. Continue to set your new password.",
      });
    } catch (err: any) {
      console.error("Password reset verify error:", err);
      return res.status(500).json({ error: "Failed to verify code" });
    }
  }
);

router.post(
  "/password-reset/complete",
  authLimiter,
  validate(passwordResetCompleteSchema),
  async (req, res) => {
    const { resetToken, newPassword } = req.body;
    cleanupExpiredResetTokens();

    const challenge = resetChallengeTokens.get(resetToken);
    if (!challenge || challenge.expiresAt <= Date.now()) {
      if (challenge) resetChallengeTokens.delete(resetToken);
      return res.status(400).json({ error: "Reset session expired. Request a new code." });
    }

    const hasStrongPassword =
      /.{8,}/.test(newPassword) &&
      /[0-9]/.test(newPassword) &&
      /[a-z]/.test(newPassword) &&
      /[A-Z]/.test(newPassword) &&
      /[!-\/:-@[-`{-~]/.test(newPassword);
    if (!hasStrongPassword) {
      return res.status(400).json({
        error:
          "Password must include at least 8 characters, upper and lowercase letters, a number, and a special character.",
      });
    }

    try {
      const { error } = await supabase.auth.admin.updateUserById(challenge.userId, {
        password: newPassword,
      });
      if (error) {
        console.error("Password reset complete error:", error.message);
        return res.status(500).json({ error: "Failed to update password" });
      }

      resetChallengeTokens.delete(resetToken);
      return res.json({ message: "Password updated successfully. You can now sign in." });
    } catch (err: any) {
      console.error("Password reset complete exception:", err);
      return res.status(500).json({ error: "Failed to update password" });
    }
  }
);

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
        .select(authUserSelect)
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
        .returning(authUserSelect);

      if (created) return res.json(await withAuthPayload(created));

      // In case of a race where another request inserted the row, re-read once.
      const [reloaded] = await db
        .select(authUserSelect)
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
        .returning(authUserSelect);
      if (updated) return res.json(await withAuthPayload(updated));
    }

    res.json(await withAuthPayload(user));
  } catch (err: any) {
    console.error("Get user error:", err);
    res.status(500).json({ error: err.message || "Failed to get user" });
  }
});

export default router;
