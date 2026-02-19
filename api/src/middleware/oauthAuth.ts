import type { Request, Response, NextFunction } from "express";
import { validateAccessToken } from "../services/oauthService.js";

// Extend Express Request to include OAuth user info
declare global {
  namespace Express {
    interface Request {
      oauthUser?: {
        userId: string;
        clientId: string;
        scopes: string[];
      };
    }
  }
}

/**
 * Middleware that validates an OAuth Bearer access token.
 * Sets req.oauthUser on success.
 */
export async function requireOAuthToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Bearer token required" });
  }

  const token = authHeader.substring(7);

  try {
    const row = await validateAccessToken(token);
    if (!row) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    req.oauthUser = {
      userId: row.userId,
      clientId: row.clientId,
      scopes: row.scopes,
    };

    next();
  } catch {
    return res.status(500).json({ error: "Token validation failed" });
  }
}
