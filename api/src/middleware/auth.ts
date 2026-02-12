import type { Request, Response, NextFunction } from "express";
import { supabaseAnon } from "../db/index.js";

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
      };
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const token = authHeader.substring(7);
  
  try {
    const { data: { user }, error } = await supabaseAnon.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    req.user = {
      id: user.id,
      email: user.email || "",
    };
    
    next();
  } catch (err) {
    return res.status(401).json({ error: "Authentication failed" });
  }
}
