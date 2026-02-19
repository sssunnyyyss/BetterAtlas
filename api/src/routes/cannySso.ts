import crypto from "node:crypto";
import { Router } from "express";
import { eq } from "drizzle-orm";
import { env } from "../config/env.js";
import { supabaseAnon } from "../db/index.js";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";

const router = Router();

// ── Minimal HS256 JWT (no external deps) ─────────────────────

function base64url(data: string | Buffer): string {
  const buf = typeof data === "string" ? Buffer.from(data) : data;
  return buf.toString("base64url");
}

function signJwt(payload: Record<string, unknown>, secret: string): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

// ── GET /api/oauth/canny ─────────────────────────────────────
//
// Canny redirects users here with ?redirect=...&companyID=...
// 1. If no `token` param → redirect to frontend login with ?next= pointing back here
// 2. If `token` present → validate via Supabase, build Canny JWT, redirect to Canny

router.get("/", async (req, res) => {
  try {
    const {
      redirect: cannyRedirect,
      companyID,
      token,
    } = req.query as Record<string, string | undefined>;

    if (!cannyRedirect || !companyID) {
      return res.status(400).json({ error: "redirect and companyID are required" });
    }

    if (!env.cannySsoKey) {
      console.error("CANNY_SSO_KEY is not configured");
      return res.status(500).json({ error: "Canny SSO is not configured" });
    }

    // No token → send to login, come back after
    if (!token) {
      const currentUrl = new URL(`${req.protocol}://${req.get("host")}${req.originalUrl}`);
      const loginUrl = `${env.frontendUrl}/login?next=${encodeURIComponent(currentUrl.toString())}`;
      return res.redirect(loginUrl);
    }

    // Validate Supabase JWT
    const { data: { user }, error } = await supabaseAnon.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // Fetch user profile from our DB
    const [profile] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    if (!profile) {
      return res.status(404).json({ error: "User profile not found" });
    }

    // Build Canny SSO token
    const ssoToken = signJwt(
      {
        avatarURL: profile.avatarUrl || "",
        email: profile.email,
        id: profile.id,
        name: profile.displayName,
      },
      env.cannySsoKey
    );

    // Redirect back to Canny
    const cannyUrl = new URL("https://canny.io/api/redirects/sso");
    cannyUrl.searchParams.set("ssoToken", ssoToken);
    cannyUrl.searchParams.set("companyID", companyID);
    cannyUrl.searchParams.set("redirect", cannyRedirect);

    res.redirect(cannyUrl.toString());
  } catch (err) {
    console.error("Canny SSO error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
