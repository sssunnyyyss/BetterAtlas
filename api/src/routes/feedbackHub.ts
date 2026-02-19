import { Router, type NextFunction, type Request, type Response } from "express";
import {
  feedbackHubAdminPostsQuerySchema,
  feedbackHubBoardPostsQuerySchema,
  feedbackHubChangelogQuerySchema,
  feedbackHubCreateChangelogSchema,
  feedbackHubCreateCommentSchema,
  feedbackHubCreatePostSchema,
  feedbackHubRoadmapQuerySchema,
  feedbackHubSearchQuerySchema,
  feedbackHubSimilarPostsQuerySchema,
  feedbackHubUpdatePostSchema,
  feedbackHubUpdateStatusSchema,
} from "@betteratlas/shared";
import { validate } from "../middleware/validate.js";
import { optionalAuth } from "../middleware/optionalAuth.js";
import { requireAuth } from "../middleware/auth.js";
import { feedbackHubWriteLimiter } from "../middleware/rateLimit.js";
import { isAdminEmail } from "../utils/admin.js";
import {
  addFeedbackPostComment,
  adminCreateFeedbackChangelog,
  adminDeleteFeedbackPost,
  adminDeleteFeedbackComment,
  adminUpdateFeedbackPost,
  adminUpdateFeedbackPostStatus,
  createFeedbackPost,
  getFeedbackPostDetail,
  listAdminFeedbackPosts,
  listFeedbackBoardCategories,
  listFeedbackBoardPosts,
  listFeedbackBoards,
  listFeedbackChangelog,
  listFeedbackRoadmap,
  listSimilarFeedbackPosts,
  searchFeedbackPosts,
  toggleFeedbackPostVote,
} from "../services/feedbackHubService.js";

const router = Router();

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!isAdminEmail(req.user?.email)) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

function parsePositiveId(raw: string) {
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value <= 0) return null;
  return value;
}

router.use(optionalAuth);

router.get("/boards", async (_req, res) => {
  const boards = await listFeedbackBoards();
  res.json(boards);
});

router.get("/boards/:boardSlug/categories", async (req, res) => {
  const result = await listFeedbackBoardCategories(req.params.boardSlug);
  if (!result) return res.status(404).json({ error: "Board not found" });
  res.json(result);
});

router.get(
  "/boards/:boardSlug/posts",
  validate(feedbackHubBoardPostsQuerySchema, "query"),
  async (req, res) => {
    const { board, result } = await listFeedbackBoardPosts(
      req.params.boardSlug,
      (req as any).validatedQuery,
      req.user?.id
    );
    if (!board) return res.status(404).json({ error: "Board not found" });
    res.json({ board, ...result });
  }
);

router.get("/posts/:id", async (req, res) => {
  const postId = parsePositiveId(req.params.id);
  if (!postId) return res.status(400).json({ error: "Invalid post id" });

  const post = await getFeedbackPostDetail(postId, req.user?.id);
  if (!post) return res.status(404).json({ error: "Post not found" });
  res.json(post);
});

router.get("/roadmap", validate(feedbackHubRoadmapQuerySchema, "query"), async (req, res) => {
  const roadmap = await listFeedbackRoadmap((req as any).validatedQuery, req.user?.id);
  res.json(roadmap);
});

router.get(
  "/changelog",
  validate(feedbackHubChangelogQuerySchema, "query"),
  async (req, res) => {
    const changelog = await listFeedbackChangelog((req as any).validatedQuery);
    res.json(changelog);
  }
);

router.get("/search", validate(feedbackHubSearchQuerySchema, "query"), async (req, res) => {
  const result = await searchFeedbackPosts((req as any).validatedQuery, req.user?.id);
  res.json(result);
});

router.get(
  "/similar",
  validate(feedbackHubSimilarPostsQuerySchema, "query"),
  async (req, res) => {
    const query = (req as any).validatedQuery;
    const similar = await listSimilarFeedbackPosts(query.boardSlug, query.q, query.limit);
    res.json(similar);
  }
);

router.post(
  "/posts",
  requireAuth,
  feedbackHubWriteLimiter,
  validate(feedbackHubCreatePostSchema),
  async (req, res) => {
    try {
      const post = await createFeedbackPost(req.user!.id, req.body);
      if (!post) return res.status(500).json({ error: "Failed to create post" });
      return res.status(201).json(post);
    } catch (err: any) {
      const message = String(err?.message || "");
      if (message.includes("Board not found") || message.includes("Category not found")) {
        return res.status(400).json({ error: message });
      }
      throw err;
    }
  }
);

router.post(
  "/posts/:id/vote",
  requireAuth,
  feedbackHubWriteLimiter,
  async (req, res) => {
    const postId = parsePositiveId(req.params.id);
    if (!postId) return res.status(400).json({ error: "Invalid post id" });

    const result = await toggleFeedbackPostVote(postId, req.user!.id);
    if (!result) return res.status(404).json({ error: "Post not found" });
    res.json(result);
  }
);

router.post(
  "/posts/:id/comments",
  requireAuth,
  feedbackHubWriteLimiter,
  validate(feedbackHubCreateCommentSchema),
  async (req, res) => {
    const postId = parsePositiveId(req.params.id);
    if (!postId) return res.status(400).json({ error: "Invalid post id" });

    const comment = await addFeedbackPostComment(postId, req.user!.id, req.body);
    if (!comment) return res.status(404).json({ error: "Post not found" });
    res.status(201).json(comment);
  }
);

router.get(
  "/admin/posts",
  requireAuth,
  requireAdmin,
  validate(feedbackHubAdminPostsQuerySchema, "query"),
  async (req, res) => {
    const result = await listAdminFeedbackPosts((req as any).validatedQuery);
    res.json(result);
  }
);

router.patch(
  "/admin/posts/:id",
  requireAuth,
  requireAdmin,
  validate(feedbackHubUpdatePostSchema),
  async (req, res) => {
    const postId = parsePositiveId(req.params.id);
    if (!postId) return res.status(400).json({ error: "Invalid post id" });

    try {
      const updated = await adminUpdateFeedbackPost(postId, req.body);
      if (!updated) return res.status(404).json({ error: "Post not found" });
      res.json(updated);
    } catch (err: any) {
      const message = String(err?.message || "");
      if (message.includes("Category not found")) {
        return res.status(400).json({ error: message });
      }
      throw err;
    }
  }
);

router.patch(
  "/admin/posts/:id/status",
  requireAuth,
  requireAdmin,
  validate(feedbackHubUpdateStatusSchema),
  async (req, res) => {
    const postId = parsePositiveId(req.params.id);
    if (!postId) return res.status(400).json({ error: "Invalid post id" });

    const updated = await adminUpdateFeedbackPostStatus(postId, req.body, req.user!.id);
    if (!updated) return res.status(404).json({ error: "Post not found" });
    res.json(updated);
  }
);

router.delete("/admin/posts/:id", requireAuth, requireAdmin, async (req, res) => {
  const postId = parsePositiveId(req.params.id);
  if (!postId) return res.status(400).json({ error: "Invalid post id" });

  const deleted = await adminDeleteFeedbackPost(postId);
  if (!deleted) return res.status(404).json({ error: "Post not found" });
  res.json({ ok: true });
});

router.delete("/admin/comments/:id", requireAuth, requireAdmin, async (req, res) => {
  const commentId = parsePositiveId(req.params.id);
  if (!commentId) return res.status(400).json({ error: "Invalid comment id" });

  const deleted = await adminDeleteFeedbackComment(commentId);
  if (!deleted) return res.status(404).json({ error: "Comment not found" });
  res.json({ ok: true });
});

router.post(
  "/admin/changelog",
  requireAuth,
  requireAdmin,
  validate(feedbackHubCreateChangelogSchema),
  async (req, res) => {
    const created = await adminCreateFeedbackChangelog(req.body, req.user!.id);
    if (!created) return res.status(500).json({ error: "Failed to create changelog entry" });
    res.status(201).json(created);
  }
);

export default router;
