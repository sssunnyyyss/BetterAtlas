import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/auth.js";
import {
  friendRequestSchema,
  createListSchema,
  addListItemSchema,
} from "@betteratlas/shared";
import {
  getFriends,
  getPendingRequests,
  sendFriendRequest,
  acceptFriendRequest,
  removeFriend,
  getFriendCourseLists,
  getUserLists,
  createList,
  addItemToList,
  removeItemFromList,
} from "../services/socialService.js";

const router = Router();

// ---- Friends ----

router.get("/friends", requireAuth, async (req, res) => {
  const friends = await getFriends(req.user!.id);
  res.json(friends);
});

router.get("/friends/pending", requireAuth, async (req, res) => {
  const pending = await getPendingRequests(req.user!.id);
  res.json(pending);
});

router.post(
  "/friends/request",
  requireAuth,
  validate(friendRequestSchema),
  async (req, res) => {
    try {
      const friendship = await sendFriendRequest(
        req.user!.id,
        req.body.addresseeId
      );
      res.status(201).json(friendship);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }
);

router.post("/friends/:id/accept", requireAuth, async (req, res) => {
  const friendshipId = parseInt(req.params.id, 10);
  if (isNaN(friendshipId)) {
    return res.status(400).json({ error: "Invalid friendship ID" });
  }
  const updated = await acceptFriendRequest(friendshipId, req.user!.id);
  if (!updated) {
    return res.status(404).json({ error: "Friend request not found" });
  }
  res.json(updated);
});

router.delete("/friends/:id", requireAuth, async (req, res) => {
  const friendshipId = parseInt(req.params.id, 10);
  if (isNaN(friendshipId)) {
    return res.status(400).json({ error: "Invalid friendship ID" });
  }
  await removeFriend(friendshipId, req.user!.id);
  res.json({ message: "Friend removed" });
});

router.get("/friends/:id/courses", requireAuth, async (req, res) => {
  const friendId = req.params.id; // UUID string
  const lists = await getFriendCourseLists(friendId, req.user!.id);
  if (lists === null) {
    return res.status(403).json({ error: "Not friends with this user" });
  }
  res.json(lists);
});

// ---- Course Lists ----

router.get("/lists", requireAuth, async (req, res) => {
  const lists = await getUserLists(req.user!.id);
  res.json(lists);
});

router.post(
  "/lists",
  requireAuth,
  validate(createListSchema),
  async (req, res) => {
    const list = await createList(req.user!.id, req.body);
    res.status(201).json(list);
  }
);

router.post(
  "/lists/:id/courses",
  requireAuth,
  validate(addListItemSchema),
  async (req, res) => {
    const listId = parseInt(req.params.id, 10);
    if (isNaN(listId)) {
      return res.status(400).json({ error: "Invalid list ID" });
    }
    const item = await addItemToList(listId, req.user!.id, req.body);
    if (!item) {
      return res.status(404).json({ error: "List not found" });
    }
    res.status(201).json(item);
  }
);

router.delete("/lists/:id/courses/:courseId", requireAuth, async (req, res) => {
  const listId = parseInt(req.params.id, 10);
  const itemId = parseInt(req.params.courseId, 10);
  if (isNaN(listId) || isNaN(itemId)) {
    return res.status(400).json({ error: "Invalid ID" });
  }
  const removed = await removeItemFromList(listId, itemId, req.user!.id);
  if (!removed) {
    return res.status(404).json({ error: "List not found" });
  }
  res.json({ message: "Item removed" });
});

export default router;
