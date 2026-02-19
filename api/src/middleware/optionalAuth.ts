import type { NextFunction, Request, Response } from "express";
import { supabaseAnon } from "../db/index.js";

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.substring(7);
  try {
    const {
      data: { user },
      error,
    } = await supabaseAnon.auth.getUser(token);

    if (!error && user) {
      req.user = {
        id: user.id,
        email: user.email || "",
      };
    }
  } catch {
    // Ignore optional auth failures for public read routes.
  }

  next();
}
