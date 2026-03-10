import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { addListItemSchema } from "@betteratlas/shared";
import {
    addToWishlist,
    getMyWishlist,
    moveToSchedule,
    removeFromWishlist,
} from "../services/wishlistService.js";

const router = Router();

router.get("/wishlist", requireAuth, async (req, res) => {
    const term = typeof req.query.term === "string" ? req.query.term : undefined;
    const wishlist = await getMyWishlist(req.user!.id, term);
    res.json(wishlist);
});

router.post(
    "/wishlist/items",
    requireAuth,
    validate(addListItemSchema),
    async (req, res) => {
        try {
            const result = await addToWishlist(req.user!.id, req.body);
            res.status(201).json(result);
        } catch (err: any) {
            res.status(400).json({ error: err.message || "Failed to add to wishlist" });
        }
    }
);

router.delete("/wishlist/items/:id", requireAuth, async (req, res) => {
    const itemId = parseInt(req.params.id, 10);
    if (isNaN(itemId)) {
        return res.status(400).json({ error: "Invalid item ID" });
    }

    const removed = await removeFromWishlist(req.user!.id, itemId);
    if (!removed) return res.status(404).json({ error: "Item not found" });
    res.json({ message: "Removed" });
});

router.post("/wishlist/items/:id/move-to-schedule", requireAuth, async (req, res) => {
    const itemId = parseInt(req.params.id, 10);
    if (isNaN(itemId)) {
        return res.status(400).json({ error: "Invalid item ID" });
    }

    try {
        const result = await moveToSchedule(req.user!.id, itemId);
        res.json(result);
    } catch (err: any) {
        res.status(400).json({ error: err.message || "Failed to move to schedule" });
    }
});

export default router;
