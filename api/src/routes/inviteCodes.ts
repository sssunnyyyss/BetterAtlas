import { Router, type NextFunction, type Request, type Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import { isAdminEmail } from "../utils/admin.js";
import { getBadgeBySlug } from "../services/badgeService.js";
import {
  createInviteCode,
  deleteInviteCodeById,
  listInviteCodes,
  normalizeInviteCode,
} from "../services/inviteCodeService.js";

const router = Router();

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!isAdminEmail(req.user?.email)) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

router.use(requireAuth, requireAdmin);

router.post("/", async (req, res) => {
  try {
    const codeInput = typeof req.body?.code === "string" ? req.body.code : "";
    const code = normalizeInviteCode(codeInput);
    const badgeSlug =
      typeof req.body?.badgeSlug === "string"
        ? req.body.badgeSlug.trim().toLowerCase()
        : "";
    const maxUsesRaw = req.body?.maxUses;
    const expiresAtRaw = req.body?.expiresAt;

    if (!code) {
      return res.status(400).json({ error: "code is required" });
    }
    if (!/^[A-Z0-9-]+$/.test(code)) {
      return res
        .status(400)
        .json({ error: "code can only contain letters, numbers, and hyphens" });
    }
    if (!badgeSlug) {
      return res.status(400).json({ error: "badgeSlug is required" });
    }

    let maxUses: number | null = null;
    if (
      maxUsesRaw !== undefined &&
      maxUsesRaw !== null &&
      String(maxUsesRaw).trim() !== ""
    ) {
      const parsedMaxUses = Number.parseInt(String(maxUsesRaw), 10);
      if (!Number.isInteger(parsedMaxUses) || parsedMaxUses <= 0) {
        return res.status(400).json({ error: "maxUses must be a positive integer" });
      }
      maxUses = parsedMaxUses;
    }

    let expiresAt: Date | null = null;
    if (
      expiresAtRaw !== undefined &&
      expiresAtRaw !== null &&
      String(expiresAtRaw).trim() !== ""
    ) {
      const parsed = new Date(String(expiresAtRaw));
      if (Number.isNaN(parsed.getTime())) {
        return res.status(400).json({ error: "expiresAt must be a valid date" });
      }
      expiresAt = parsed;
    }

    const badge = await getBadgeBySlug(badgeSlug);
    if (!badge) {
      return res.status(400).json({ error: "badgeSlug does not exist" });
    }

    const created = await createInviteCode({
      code,
      badgeSlug,
      maxUses,
      expiresAt,
    });

    return res.status(201).json(created);
  } catch (err: any) {
    const message = String(err?.message || "");
    const normalized = message.toLowerCase();
    if (normalized.includes("idx_invite_codes_code_unique")) {
      return res.status(409).json({ error: "Invite code already exists" });
    }
    return res.status(500).json({ error: message || "Failed to create invite code" });
  }
});

router.get("/", async (_req, res) => {
  const inviteCodes = await listInviteCodes();
  res.json(inviteCodes);
});

router.delete("/:id", async (req, res) => {
  const inviteCodeId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(inviteCodeId) || inviteCodeId <= 0) {
    return res.status(400).json({ error: "Invalid invite code id" });
  }

  const deleted = await deleteInviteCodeById(inviteCodeId);
  if (!deleted) {
    return res.status(404).json({ error: "Invite code not found" });
  }

  return res.json(deleted);
});

export default router;
