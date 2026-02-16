import { Router } from "express";
import { env } from "../config/env.js";
import { syncPrograms } from "../jobs/programsSync.js";
import { requireAuth } from "../middleware/auth.js";
import { isAdminEmail } from "../utils/admin.js";

const router = Router();

function requireSyncSecret(req: any, res: any, next: any) {
  const want = env.programsSyncSecret;
  if (!want) return res.status(500).json({ error: "Sync secret not configured" });

  const got = String(req.headers["x-programs-sync-secret"] || "");
  if (got !== want) return res.status(401).json({ error: "Unauthorized" });
  next();
}

function requireAdmin(req: any, res: any, next: any) {
  if (!isAdminEmail(req.user?.email)) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

router.post("/programs/sync", requireSyncSecret, async (_req, res) => {
  const stats = await syncPrograms();
  res.json(stats);
});

router.post("/programs/sync/me", requireAuth, requireAdmin, async (_req, res) => {
  const stats = await syncPrograms();
  res.json(stats);
});

export default router;

