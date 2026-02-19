import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { isAdminEmail } from "../utils/admin.js";
import * as oauthService from "../services/oauthService.js";

const router = Router();

// All routes require admin auth
router.use(requireAuth, (req, res, next) => {
  if (!isAdminEmail(req.user?.email)) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
});

// GET / — list all clients
router.get("/", async (_req, res) => {
  try {
    const clients = await oauthService.listClients();
    // Never expose the hashed secret
    const safe = clients.map(({ secret, ...rest }) => rest);
    res.json(safe);
  } catch (err) {
    console.error("Failed to list OAuth clients:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST / — create a new client
router.post("/", async (req, res) => {
  try {
    const { name, description, redirectUris, allowedScopes, isPublic } = req.body;

    if (!name || !Array.isArray(redirectUris) || redirectUris.length === 0) {
      return res.status(400).json({ error: "name and redirectUris are required" });
    }
    if (!Array.isArray(allowedScopes) || allowedScopes.length === 0) {
      return res.status(400).json({ error: "allowedScopes is required" });
    }

    const { client, rawSecret } = await oauthService.createClient({
      name,
      description,
      redirectUris,
      allowedScopes: allowedScopes,
      isPublic: !!isPublic,
      createdBy: req.user!.id,
    });

    const { secret, ...safeClient } = client;
    res.status(201).json({
      ...safeClient,
      // Raw secret is only shown once at creation time
      client_secret: rawSecret,
    });
  } catch (err) {
    console.error("Failed to create OAuth client:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /:id — get single client
router.get("/:id", async (req, res) => {
  try {
    const client = await oauthService.getClient(req.params.id);
    if (!client) return res.status(404).json({ error: "Client not found" });

    const { secret, ...safe } = client;
    res.json(safe);
  } catch (err) {
    console.error("Failed to get OAuth client:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /:id — update client details
router.patch("/:id", async (req, res) => {
  try {
    const { name, description, redirectUris, allowedScopes, isPublic, isActive } = req.body;
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (redirectUris !== undefined) updates.redirectUris = redirectUris;
    if (allowedScopes !== undefined) updates.allowedScopes = allowedScopes;
    if (isPublic !== undefined) updates.isPublic = isPublic;
    if (isActive !== undefined) updates.isActive = isActive;

    const client = await oauthService.updateClient(req.params.id, updates);
    if (!client) return res.status(404).json({ error: "Client not found" });

    const { secret, ...safe } = client;
    res.json(safe);
  } catch (err) {
    console.error("Failed to update OAuth client:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /:id — deactivate client (soft delete)
router.delete("/:id", async (req, res) => {
  try {
    const client = await oauthService.deactivateClient(req.params.id);
    if (!client) return res.status(404).json({ error: "Client not found" });
    res.json({ success: true });
  } catch (err) {
    console.error("Failed to deactivate OAuth client:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /:id/rotate-secret — rotate client secret
router.post("/:id/rotate-secret", async (req, res) => {
  try {
    const result = await oauthService.rotateClientSecret(req.params.id);
    if (!result) {
      return res.status(404).json({ error: "Client not found or is a public client" });
    }
    res.json({ client_secret: result.rawSecret });
  } catch (err) {
    console.error("Failed to rotate OAuth client secret:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
