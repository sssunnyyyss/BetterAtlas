import { Router } from "express";
import { env } from "../config/env.js";
import { supabaseAnon } from "../db/index.js";
import { oauthTokenLimiter } from "../middleware/rateLimit.js";
import { requireOAuthToken } from "../middleware/oauthAuth.js";
import * as oauthService from "../services/oauthService.js";

const router = Router();

// ── Helpers ──────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderConsentPage(params: {
  clientName: string;
  clientDescription: string | null;
  scopes: string[];
  formAction: string;
  clientId: string;
  redirectUri: string;
  state: string;
  scope: string;
  token: string;
  codeChallenge: string;
  codeChallengeMethod: string;
}) {
  const scopeList = params.scopes
    .map((s) => `<li>${escapeHtml(s)}</li>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authorize ${escapeHtml(params.clientName)} — BetterAtlas</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .card { background: white; border-radius: 12px; padding: 2rem; max-width: 420px; width: 100%; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { font-size: 1.25rem; margin-bottom: 0.5rem; }
    .app-name { color: #4f46e5; font-weight: 600; }
    p { color: #666; font-size: 0.9rem; margin-bottom: 1rem; }
    .scopes { margin: 1rem 0; }
    .scopes h3 { font-size: 0.85rem; color: #333; margin-bottom: 0.5rem; }
    .scopes ul { list-style: none; }
    .scopes li { padding: 0.4rem 0; border-bottom: 1px solid #eee; font-size: 0.9rem; }
    .scopes li::before { content: "\\2713 "; color: #22c55e; font-weight: bold; }
    .actions { display: flex; gap: 0.75rem; margin-top: 1.5rem; }
    button { flex: 1; padding: 0.7rem; border: none; border-radius: 8px; font-size: 0.95rem; cursor: pointer; font-weight: 500; }
    .allow { background: #4f46e5; color: white; }
    .allow:hover { background: #4338ca; }
    .deny { background: #e5e7eb; color: #374151; }
    .deny:hover { background: #d1d5db; }
    .brand { text-align: center; color: #999; font-size: 0.75rem; margin-top: 1.5rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1><span class="app-name">${escapeHtml(params.clientName)}</span> wants to access your BetterAtlas account</h1>
    ${params.clientDescription ? `<p>${escapeHtml(params.clientDescription)}</p>` : ""}
    <div class="scopes">
      <h3>This will allow the application to:</h3>
      <ul>${scopeList}</ul>
    </div>
    <form method="POST" action="${escapeHtml(params.formAction)}">
      <input type="hidden" name="client_id" value="${escapeHtml(params.clientId)}">
      <input type="hidden" name="redirect_uri" value="${escapeHtml(params.redirectUri)}">
      <input type="hidden" name="state" value="${escapeHtml(params.state)}">
      <input type="hidden" name="scope" value="${escapeHtml(params.scope)}">
      <input type="hidden" name="token" value="${escapeHtml(params.token)}">
      <input type="hidden" name="code_challenge" value="${escapeHtml(params.codeChallenge)}">
      <input type="hidden" name="code_challenge_method" value="${escapeHtml(params.codeChallengeMethod)}">
      <div class="actions">
        <button type="submit" name="action" value="deny" class="deny">Deny</button>
        <button type="submit" name="action" value="allow" class="allow">Allow</button>
      </div>
    </form>
    <div class="brand">BetterAtlas OAuth</div>
  </div>
</body>
</html>`;
}

function renderErrorPage(title: string, message: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} — BetterAtlas</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .card { background: white; border-radius: 12px; padding: 2rem; max-width: 420px; width: 100%; box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: center; }
    h1 { font-size: 1.25rem; margin-bottom: 0.75rem; color: #dc2626; }
    p { color: #666; font-size: 0.9rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
  </div>
</body>
</html>`;
}

// ── Scope display labels ─────────────────────────────────────

const SCOPE_LABELS: Record<string, string> = {
  profile: "View your profile (username, display name, bio, avatar)",
  email: "View your email address",
};

// ── GET /authorize ───────────────────────────────────────────

router.get("/authorize", async (req, res) => {
  try {
    const {
      response_type,
      client_id,
      redirect_uri,
      scope,
      state,
      code_challenge,
      code_challenge_method,
      token,
    } = req.query as Record<string, string | undefined>;

    // Validate required params
    if (response_type !== "code") {
      return res.status(400).send(renderErrorPage("Invalid Request", "response_type must be 'code'"));
    }
    if (!client_id || !redirect_uri) {
      return res.status(400).send(renderErrorPage("Invalid Request", "client_id and redirect_uri are required"));
    }

    // Look up client
    const client = await oauthService.getActiveClient(client_id);
    if (!client) {
      return res.status(400).send(renderErrorPage("Invalid Client", "Unknown or inactive client_id"));
    }

    // Validate redirect_uri (exact match)
    if (!client.redirectUris.includes(redirect_uri)) {
      return res.status(400).send(renderErrorPage("Invalid Redirect URI", "The redirect_uri is not registered for this client"));
    }

    // Parse and validate scopes
    const requestedScopes = (scope || "profile").split(/[\s+]+/).filter(Boolean);
    const invalidScopes = requestedScopes.filter((s) => !client.allowedScopes.includes(s));
    if (invalidScopes.length > 0) {
      const url = new URL(redirect_uri);
      url.searchParams.set("error", "invalid_scope");
      if (state) url.searchParams.set("state", state);
      return res.redirect(url.toString());
    }

    // PKCE validation
    if (client.isPublic && !code_challenge) {
      return res.status(400).send(renderErrorPage("PKCE Required", "Public clients must use PKCE (code_challenge is required)"));
    }
    if (code_challenge && code_challenge_method !== "S256") {
      return res.status(400).send(renderErrorPage("Invalid PKCE Method", "Only S256 code_challenge_method is supported"));
    }

    // If no token, redirect to login
    if (!token) {
      const authorizeUrl = new URL(`${req.protocol}://${req.get("host")}${req.originalUrl}`);
      const loginUrl = `${env.frontendUrl}/login?next=${encodeURIComponent(authorizeUrl.toString())}`;
      return res.redirect(loginUrl);
    }

    // Validate the Supabase JWT token
    const { data: { user }, error } = await supabaseAnon.auth.getUser(token);
    if (error || !user) {
      return res.status(401).send(renderErrorPage("Authentication Failed", "Invalid or expired login token. Please try again."));
    }

    // Render consent page
    const scopeLabels = requestedScopes.map((s) => SCOPE_LABELS[s] || s);
    const html = renderConsentPage({
      clientName: client.name,
      clientDescription: client.description,
      scopes: scopeLabels,
      formAction: "/api/oauth/authorize/confirm",
      clientId: client_id,
      redirectUri: redirect_uri,
      state: state || "",
      scope: requestedScopes.join(" "),
      token,
      codeChallenge: code_challenge || "",
      codeChallengeMethod: code_challenge_method || "",
    });

    res.setHeader("Content-Type", "text/html");
    res.send(html);
  } catch (err) {
    console.error("OAuth authorize error:", err);
    res.status(500).send(renderErrorPage("Server Error", "An unexpected error occurred"));
  }
});

// ── POST /authorize/confirm ──────────────────────────────────

router.post("/authorize/confirm", async (req, res) => {
  try {
    const {
      client_id,
      redirect_uri,
      state,
      scope,
      token,
      code_challenge,
      code_challenge_method,
      action,
    } = req.body;

    // Re-validate client
    const client = await oauthService.getActiveClient(client_id);
    if (!client) {
      return res.status(400).send(renderErrorPage("Invalid Client", "Unknown or inactive client"));
    }

    if (!client.redirectUris.includes(redirect_uri)) {
      return res.status(400).send(renderErrorPage("Invalid Redirect URI", "The redirect_uri is not registered for this client"));
    }

    // User denied
    if (action === "deny") {
      const url = new URL(redirect_uri);
      url.searchParams.set("error", "access_denied");
      if (state) url.searchParams.set("state", state);
      return res.redirect(url.toString());
    }

    // Validate token
    const { data: { user }, error } = await supabaseAnon.auth.getUser(token);
    if (error || !user) {
      return res.status(401).send(renderErrorPage("Authentication Failed", "Session expired. Please try again."));
    }

    // Generate authorization code
    const scopes = (scope || "profile").split(/[\s+]+/).filter(Boolean);
    const code = await oauthService.createAuthorizationCode({
      clientId: client_id,
      userId: user.id,
      redirectUri: redirect_uri,
      scopes,
      codeChallenge: code_challenge || undefined,
      codeChallengeMethod: code_challenge_method || undefined,
    });

    // Redirect to client with code
    const url = new URL(redirect_uri);
    url.searchParams.set("code", code);
    if (state) url.searchParams.set("state", state);
    res.redirect(url.toString());
  } catch (err) {
    console.error("OAuth authorize confirm error:", err);
    res.status(500).send(renderErrorPage("Server Error", "An unexpected error occurred"));
  }
});

// ── POST /token ──────────────────────────────────────────────

router.post("/token", oauthTokenLimiter, async (req, res) => {
  try {
    const {
      grant_type,
      code,
      redirect_uri,
      client_id,
      client_secret,
      code_verifier,
    } = req.body;

    if (grant_type !== "authorization_code") {
      return res.status(400).json({ error: "unsupported_grant_type" });
    }

    if (!code || !client_id || !redirect_uri) {
      return res.status(400).json({ error: "invalid_request", error_description: "code, client_id, and redirect_uri are required" });
    }

    // Look up client
    const client = await oauthService.getActiveClient(client_id);
    if (!client) {
      return res.status(400).json({ error: "invalid_client" });
    }

    // Authenticate confidential client
    if (!client.isPublic) {
      if (!client_secret) {
        return res.status(401).json({ error: "invalid_client", error_description: "client_secret is required" });
      }
      if (!oauthService.verifyClientSecret(client, client_secret)) {
        return res.status(401).json({ error: "invalid_client", error_description: "Invalid client credentials" });
      }
    }

    // Consume authorization code (atomic single-use)
    const authCode = await oauthService.consumeAuthorizationCode(code);
    if (!authCode) {
      return res.status(400).json({ error: "invalid_grant", error_description: "Invalid, expired, or already used authorization code" });
    }

    // Validate code belongs to this client and redirect_uri matches
    if (authCode.clientId !== client_id) {
      return res.status(400).json({ error: "invalid_grant", error_description: "Code was not issued to this client" });
    }
    if (authCode.redirectUri !== redirect_uri) {
      return res.status(400).json({ error: "invalid_grant", error_description: "redirect_uri mismatch" });
    }

    // PKCE verification
    if (authCode.codeChallenge) {
      if (!code_verifier) {
        return res.status(400).json({ error: "invalid_grant", error_description: "code_verifier is required" });
      }
      if (!oauthService.verifyCodeChallenge(code_verifier, authCode.codeChallenge)) {
        return res.status(400).json({ error: "invalid_grant", error_description: "PKCE verification failed" });
      }
    }

    // Issue access token
    const { token, expiresAt } = await oauthService.createAccessToken({
      clientId: client_id,
      userId: authCode.userId,
      scopes: authCode.scopes,
    });

    res.json({
      access_token: token,
      token_type: "Bearer",
      expires_in: Math.floor((expiresAt.getTime() - Date.now()) / 1000),
      scope: authCode.scopes.join(" "),
    });
  } catch (err) {
    console.error("OAuth token error:", err);
    res.status(500).json({ error: "server_error" });
  }
});

// ── GET /userinfo ────────────────────────────────────────────

router.get("/userinfo", requireOAuthToken, async (req, res) => {
  try {
    const { userId, scopes } = req.oauthUser!;
    const profile = await oauthService.getUserProfile(userId, scopes);

    if (!profile) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(profile);
  } catch (err) {
    console.error("OAuth userinfo error:", err);
    res.status(500).json({ error: "server_error" });
  }
});

// ── POST /revoke ─────────────────────────────────────────────

router.post("/revoke", async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: "token is required" });
    }

    // RFC 7009: always return 200 regardless of whether token existed
    await oauthService.revokeAccessToken(token);
    res.json({ success: true });
  } catch (err) {
    console.error("OAuth revoke error:", err);
    res.status(500).json({ error: "server_error" });
  }
});

export default router;
