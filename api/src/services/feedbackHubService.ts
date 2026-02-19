import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { db } from "../db/index.js";
import {
  feedbackBoards,
  feedbackChangelogEntries,
  feedbackChangelogPosts,
  feedbackPostCategories,
  feedbackPostComments,
  feedbackPosts,
  feedbackPostVotes,
  feedbackStatusHistory,
  users,
} from "../db/schema.js";
import type {
  FeedbackHubAdminPostsQuery,
  FeedbackHubAuthorMode,
  FeedbackHubBoardPostsQuery,
  FeedbackHubChangelogEntry,
  FeedbackHubChangelogQuery,
  FeedbackHubCreateChangelogInput,
  FeedbackHubCreateCommentInput,
  FeedbackHubCreatePostInput,
  FeedbackHubPaginatedPosts,
  FeedbackHubPostDetail,
  FeedbackHubPostStatus,
  FeedbackHubPostSummary,
  FeedbackHubRoadmapColumn,
  FeedbackHubRoadmapQuery,
  FeedbackHubSearchQuery,
  FeedbackHubSort,
  FeedbackHubUpdatePostInput,
  FeedbackHubUpdateStatusInput,
} from "@betteratlas/shared";

type DbAuthor = {
  userId: string | null;
  username: string | null;
  displayName: string | null;
};

type FeedbackBoardRow = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  isPublic: boolean;
};

function toIso(value: Date | null): string {
  return value?.toISOString() ?? "";
}

function toBool(value: unknown): boolean {
  return value === true || value === "t" || value === 1;
}

function buildAuthor(author: DbAuthor, mode: FeedbackHubAuthorMode) {
  const fallbackDisplay = author.userId ? `Atlas #${author.userId.slice(0, 6)}` : "Atlas User";
  if (mode === "linked_profile") {
    return {
      userId: author.userId,
      username: author.username,
      displayName: author.username ? `@${author.username}` : author.displayName ?? fallbackDisplay,
      mode,
    };
  }
  return {
    userId: null,
    username: null,
    displayName: fallbackDisplay,
    mode,
  };
}

function mapPostSummary(
  row: {
    id: number;
    boardId: number;
    boardSlug: string;
    boardName: string;
    categoryId: number | null;
    categorySlug: string | null;
    categoryName: string | null;
    title: string;
    details: string | null;
    status: string;
    scoreCached: number;
    commentCountCached: number;
    createdAt: Date | null;
    updatedAt: Date | null;
    authorUserId: string;
    authorMode: string;
    username: string | null;
    displayName: string | null;
    viewerHasVoted: unknown;
  }
): FeedbackHubPostSummary {
  return {
    id: row.id,
    board: {
      id: row.boardId,
      slug: row.boardSlug,
      name: row.boardName,
    },
    category:
      row.categoryId && row.categorySlug && row.categoryName
        ? {
            id: row.categoryId,
            slug: row.categorySlug,
            name: row.categoryName,
          }
        : null,
    title: row.title,
    details: row.details,
    status: row.status as FeedbackHubPostStatus,
    score: row.scoreCached ?? 0,
    commentCount: row.commentCountCached ?? 0,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
    author: buildAuthor(
      {
        userId: row.authorUserId,
        username: row.username,
        displayName: row.displayName,
      },
      (row.authorMode as FeedbackHubAuthorMode) ?? "pseudonymous"
    ),
    viewerHasVoted: toBool(row.viewerHasVoted),
  };
}

async function getBoardBySlug(
  slug: string,
  includePrivate = false
): Promise<FeedbackBoardRow | null> {
  const [board] = await db
    .select({
      id: feedbackBoards.id,
      slug: feedbackBoards.slug,
      name: feedbackBoards.name,
      description: feedbackBoards.description,
      isPublic: feedbackBoards.isPublic,
    })
    .from(feedbackBoards)
    .where(
      includePrivate
        ? eq(feedbackBoards.slug, slug)
        : and(eq(feedbackBoards.slug, slug), eq(feedbackBoards.isPublic, true))
    )
    .limit(1);

  return board ?? null;
}

async function refreshPostCounters(postId: number) {
  const [voteAgg] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(feedbackPostVotes)
    .where(eq(feedbackPostVotes.postId, postId));
  const [commentAgg] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(feedbackPostComments)
    .where(eq(feedbackPostComments.postId, postId));

  await db
    .update(feedbackPosts)
    .set({
      scoreCached: voteAgg?.count ?? 0,
      commentCountCached: commentAgg?.count ?? 0,
      updatedAt: new Date(),
    })
    .where(eq(feedbackPosts.id, postId));
}

function buildViewerVoteExpr(userId?: string) {
  if (!userId) {
    return sql<boolean>`false`;
  }
  return sql<boolean>`exists(
    select 1
    from feedback_post_votes fpv
    where fpv.post_id = ${feedbackPosts.id}
      and fpv.user_id = ${userId}
  )`;
}

export async function listFeedbackBoards() {
  const rows = await db
    .select({
      id: feedbackBoards.id,
      slug: feedbackBoards.slug,
      name: feedbackBoards.name,
      description: feedbackBoards.description,
      isPublic: feedbackBoards.isPublic,
      postCount: sql<number>`count(${feedbackPosts.id})::int`,
    })
    .from(feedbackBoards)
    .leftJoin(feedbackPosts, eq(feedbackPosts.boardId, feedbackBoards.id))
    .where(eq(feedbackBoards.isPublic, true))
    .groupBy(
      feedbackBoards.id,
      feedbackBoards.slug,
      feedbackBoards.name,
      feedbackBoards.description,
      feedbackBoards.isPublic
    )
    .orderBy(asc(feedbackBoards.id));

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    isPublic: row.isPublic,
    postCount: row.postCount ?? 0,
  }));
}

export async function listFeedbackBoardCategories(boardSlug: string) {
  const board = await getBoardBySlug(boardSlug, false);
  if (!board) return null;

  const rows = await db
    .select({
      id: feedbackPostCategories.id,
      boardId: feedbackPostCategories.boardId,
      slug: feedbackPostCategories.slug,
      name: feedbackPostCategories.name,
      postCount: sql<number>`count(${feedbackPosts.id})::int`,
    })
    .from(feedbackPostCategories)
    .leftJoin(feedbackPosts, eq(feedbackPosts.categoryId, feedbackPostCategories.id))
    .where(eq(feedbackPostCategories.boardId, board.id))
    .groupBy(
      feedbackPostCategories.id,
      feedbackPostCategories.boardId,
      feedbackPostCategories.slug,
      feedbackPostCategories.name
    )
    .orderBy(asc(feedbackPostCategories.name));

  return {
    board,
    categories: rows.map((row) => ({
      id: row.id,
      boardId: row.boardId,
      slug: row.slug,
      name: row.name,
      postCount: row.postCount ?? 0,
    })),
  };
}

function applyPostSort(sort: FeedbackHubSort) {
  if (sort === "new") {
    return [desc(feedbackPosts.createdAt)];
  }
  if (sort === "top") {
    return [desc(feedbackPosts.scoreCached), desc(feedbackPosts.createdAt)];
  }
  return [
    desc(
      sql<number>`(${feedbackPosts.scoreCached} * 4) + greatest(0, 30 - extract(day from now() - ${feedbackPosts.createdAt}))`
    ),
    desc(feedbackPosts.updatedAt),
  ];
}

export async function listFeedbackBoardPosts(
  boardSlug: string,
  query: FeedbackHubBoardPostsQuery,
  viewerUserId?: string
): Promise<{ board: FeedbackBoardRow | null; result: FeedbackHubPaginatedPosts }> {
  const board = await getBoardBySlug(boardSlug, false);
  if (!board) {
    return {
      board: null,
      result: {
        items: [],
        page: query.page,
        limit: query.limit,
        total: 0,
        totalPages: 0,
      },
    };
  }

  const filters: SQL[] = [eq(feedbackPosts.boardId, board.id)];

  if (query.status) {
    filters.push(eq(feedbackPosts.status, query.status));
  }

  if (query.category) {
    const [category] = await db
      .select({ id: feedbackPostCategories.id })
      .from(feedbackPostCategories)
      .where(
        and(
          eq(feedbackPostCategories.boardId, board.id),
          eq(feedbackPostCategories.slug, query.category)
        )
      )
      .limit(1);

    if (!category) {
      return {
        board,
        result: {
          items: [],
          page: query.page,
          limit: query.limit,
          total: 0,
          totalPages: 0,
        },
      };
    }
    filters.push(eq(feedbackPosts.categoryId, category.id));
  }

  if (query.q) {
    filters.push(
      or(
        ilike(feedbackPosts.title, `%${query.q}%`),
        ilike(feedbackPosts.details, `%${query.q}%`)
      )!
    );
  }

  const whereClause = and(...filters);
  const offset = (query.page - 1) * query.limit;
  const viewerVoteExpr = buildViewerVoteExpr(viewerUserId);

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(feedbackPosts)
    .where(whereClause);

  const rows = await db
    .select({
      id: feedbackPosts.id,
      boardId: feedbackBoards.id,
      boardSlug: feedbackBoards.slug,
      boardName: feedbackBoards.name,
      categoryId: feedbackPostCategories.id,
      categorySlug: feedbackPostCategories.slug,
      categoryName: feedbackPostCategories.name,
      title: feedbackPosts.title,
      details: feedbackPosts.details,
      status: feedbackPosts.status,
      scoreCached: feedbackPosts.scoreCached,
      commentCountCached: feedbackPosts.commentCountCached,
      createdAt: feedbackPosts.createdAt,
      updatedAt: feedbackPosts.updatedAt,
      authorUserId: feedbackPosts.authorUserId,
      authorMode: feedbackPosts.authorMode,
      username: users.username,
      displayName: users.displayName,
      viewerHasVoted: viewerVoteExpr,
    })
    .from(feedbackPosts)
    .innerJoin(feedbackBoards, eq(feedbackPosts.boardId, feedbackBoards.id))
    .leftJoin(feedbackPostCategories, eq(feedbackPosts.categoryId, feedbackPostCategories.id))
    .innerJoin(users, eq(feedbackPosts.authorUserId, users.id))
    .where(whereClause)
    .orderBy(...applyPostSort(query.sort))
    .limit(query.limit)
    .offset(offset);

  const total = countRow?.count ?? 0;
  const totalPages = total === 0 ? 0 : Math.ceil(total / query.limit);
  return {
    board,
    result: {
      items: rows.map(mapPostSummary),
      page: query.page,
      limit: query.limit,
      total,
      totalPages,
    },
  };
}

export async function getFeedbackPostDetail(postId: number, viewerUserId?: string) {
  const viewerVoteExpr = buildViewerVoteExpr(viewerUserId);
  const [row] = await db
    .select({
      id: feedbackPosts.id,
      boardId: feedbackBoards.id,
      boardSlug: feedbackBoards.slug,
      boardName: feedbackBoards.name,
      categoryId: feedbackPostCategories.id,
      categorySlug: feedbackPostCategories.slug,
      categoryName: feedbackPostCategories.name,
      title: feedbackPosts.title,
      details: feedbackPosts.details,
      status: feedbackPosts.status,
      scoreCached: feedbackPosts.scoreCached,
      commentCountCached: feedbackPosts.commentCountCached,
      createdAt: feedbackPosts.createdAt,
      updatedAt: feedbackPosts.updatedAt,
      authorUserId: feedbackPosts.authorUserId,
      authorMode: feedbackPosts.authorMode,
      username: users.username,
      displayName: users.displayName,
      viewerHasVoted: viewerVoteExpr,
    })
    .from(feedbackPosts)
    .innerJoin(feedbackBoards, eq(feedbackPosts.boardId, feedbackBoards.id))
    .leftJoin(feedbackPostCategories, eq(feedbackPosts.categoryId, feedbackPostCategories.id))
    .innerJoin(users, eq(feedbackPosts.authorUserId, users.id))
    .where(and(eq(feedbackPosts.id, postId), eq(feedbackBoards.isPublic, true)))
    .limit(1);

  if (!row) return null;

  const comments = await db
    .select({
      id: feedbackPostComments.id,
      postId: feedbackPostComments.postId,
      body: feedbackPostComments.body,
      createdAt: feedbackPostComments.createdAt,
      updatedAt: feedbackPostComments.updatedAt,
      userId: users.id,
      username: users.username,
      displayName: users.displayName,
    })
    .from(feedbackPostComments)
    .innerJoin(users, eq(feedbackPostComments.authorUserId, users.id))
    .where(eq(feedbackPostComments.postId, postId))
    .orderBy(asc(feedbackPostComments.createdAt));

  const statusHistory = await db
    .select({
      id: feedbackStatusHistory.id,
      fromStatus: feedbackStatusHistory.fromStatus,
      toStatus: feedbackStatusHistory.toStatus,
      note: feedbackStatusHistory.note,
      createdAt: feedbackStatusHistory.createdAt,
      changedByUserId: users.id,
      changedByUsername: users.username,
      changedByDisplayName: users.displayName,
    })
    .from(feedbackStatusHistory)
    .leftJoin(users, eq(feedbackStatusHistory.changedByUserId, users.id))
    .where(eq(feedbackStatusHistory.postId, postId))
    .orderBy(desc(feedbackStatusHistory.createdAt));

  const post = mapPostSummary(row);
  return {
    ...post,
    comments: comments.map((comment) => ({
      id: comment.id,
      postId: comment.postId,
      body: comment.body,
      createdAt: toIso(comment.createdAt),
      updatedAt: toIso(comment.updatedAt),
      author: buildAuthor(
        {
          userId: comment.userId,
          username: comment.username,
          displayName: comment.displayName,
        },
        "linked_profile"
      ),
    })),
    statusHistory: statusHistory.map((item) => ({
      id: item.id,
      fromStatus: item.fromStatus as FeedbackHubPostStatus | null,
      toStatus: item.toStatus as FeedbackHubPostStatus,
      note: item.note,
      createdAt: toIso(item.createdAt),
      changedBy: item.changedByUserId
        ? buildAuthor(
            {
              userId: item.changedByUserId,
              username: item.changedByUsername,
              displayName: item.changedByDisplayName,
            },
            "linked_profile"
          )
        : null,
    })),
  } satisfies FeedbackHubPostDetail;
}

export async function listFeedbackRoadmap(
  query: FeedbackHubRoadmapQuery,
  viewerUserId?: string
): Promise<FeedbackHubRoadmapColumn[]> {
  const statuses: Array<{ status: FeedbackHubPostStatus; label: string }> = [
    { status: "planned", label: "Planned" },
    { status: "in_progress", label: "In Progress" },
    { status: "complete", label: "Complete" },
  ];

  const viewerVoteExpr = buildViewerVoteExpr(viewerUserId);
  const columns: FeedbackHubRoadmapColumn[] = [];

  for (const col of statuses) {
    const rows = await db
      .select({
        id: feedbackPosts.id,
        boardId: feedbackBoards.id,
        boardSlug: feedbackBoards.slug,
        boardName: feedbackBoards.name,
        categoryId: feedbackPostCategories.id,
        categorySlug: feedbackPostCategories.slug,
        categoryName: feedbackPostCategories.name,
        title: feedbackPosts.title,
        details: feedbackPosts.details,
        status: feedbackPosts.status,
        scoreCached: feedbackPosts.scoreCached,
        commentCountCached: feedbackPosts.commentCountCached,
        createdAt: feedbackPosts.createdAt,
        updatedAt: feedbackPosts.updatedAt,
        authorUserId: feedbackPosts.authorUserId,
        authorMode: feedbackPosts.authorMode,
        username: users.username,
        displayName: users.displayName,
        viewerHasVoted: viewerVoteExpr,
      })
      .from(feedbackPosts)
      .innerJoin(feedbackBoards, eq(feedbackPosts.boardId, feedbackBoards.id))
      .leftJoin(feedbackPostCategories, eq(feedbackPosts.categoryId, feedbackPostCategories.id))
      .innerJoin(users, eq(feedbackPosts.authorUserId, users.id))
      .where(and(eq(feedbackPosts.status, col.status), eq(feedbackBoards.isPublic, true)))
      .orderBy(desc(feedbackPosts.scoreCached), desc(feedbackPosts.updatedAt))
      .limit(query.limitPerStatus);

    columns.push({
      status: col.status as "planned" | "in_progress" | "complete",
      label: col.label,
      posts: rows.map(mapPostSummary),
    });
  }

  return columns;
}

export async function searchFeedbackPosts(
  query: FeedbackHubSearchQuery,
  viewerUserId?: string
): Promise<FeedbackHubPaginatedPosts> {
  const filters: SQL[] = [
    eq(feedbackBoards.isPublic, true),
    or(
      ilike(feedbackPosts.title, `%${query.q}%`),
      ilike(feedbackPosts.details, `%${query.q}%`)
    )!,
  ];
  const whereClause = and(...filters);
  const offset = (query.page - 1) * query.limit;
  const viewerVoteExpr = buildViewerVoteExpr(viewerUserId);

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(feedbackPosts)
    .innerJoin(feedbackBoards, eq(feedbackPosts.boardId, feedbackBoards.id))
    .where(whereClause);

  const rows = await db
    .select({
      id: feedbackPosts.id,
      boardId: feedbackBoards.id,
      boardSlug: feedbackBoards.slug,
      boardName: feedbackBoards.name,
      categoryId: feedbackPostCategories.id,
      categorySlug: feedbackPostCategories.slug,
      categoryName: feedbackPostCategories.name,
      title: feedbackPosts.title,
      details: feedbackPosts.details,
      status: feedbackPosts.status,
      scoreCached: feedbackPosts.scoreCached,
      commentCountCached: feedbackPosts.commentCountCached,
      createdAt: feedbackPosts.createdAt,
      updatedAt: feedbackPosts.updatedAt,
      authorUserId: feedbackPosts.authorUserId,
      authorMode: feedbackPosts.authorMode,
      username: users.username,
      displayName: users.displayName,
      viewerHasVoted: viewerVoteExpr,
    })
    .from(feedbackPosts)
    .innerJoin(feedbackBoards, eq(feedbackPosts.boardId, feedbackBoards.id))
    .leftJoin(feedbackPostCategories, eq(feedbackPosts.categoryId, feedbackPostCategories.id))
    .innerJoin(users, eq(feedbackPosts.authorUserId, users.id))
    .where(whereClause)
    .orderBy(desc(feedbackPosts.scoreCached), desc(feedbackPosts.updatedAt))
    .limit(query.limit)
    .offset(offset);

  const total = countRow?.count ?? 0;
  const totalPages = total === 0 ? 0 : Math.ceil(total / query.limit);
  return {
    items: rows.map(mapPostSummary),
    page: query.page,
    limit: query.limit,
    total,
    totalPages,
  };
}

export async function listSimilarFeedbackPosts(boardSlug: string, q: string, limit: number) {
  const board = await getBoardBySlug(boardSlug, false);
  if (!board) return [];

  const rows = await db
    .select({
      id: feedbackPosts.id,
      title: feedbackPosts.title,
      status: feedbackPosts.status,
      score: feedbackPosts.scoreCached,
    })
    .from(feedbackPosts)
    .where(
      and(
        eq(feedbackPosts.boardId, board.id),
        or(
          ilike(feedbackPosts.title, `%${q}%`),
          ilike(feedbackPosts.details, `%${q}%`)
        )
      )
    )
    .orderBy(
      asc(sql<number>`case when lower(${feedbackPosts.title}) = lower(${q}) then 0 else 1 end`),
      desc(feedbackPosts.scoreCached),
      desc(feedbackPosts.updatedAt)
    )
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status as FeedbackHubPostStatus,
    score: row.score ?? 0,
  }));
}

export async function createFeedbackPost(userId: string, input: FeedbackHubCreatePostInput) {
  const board = await getBoardBySlug(input.boardSlug, false);
  if (!board) throw new Error("Board not found");

  let categoryId: number | null = null;
  if (input.categorySlug) {
    const [category] = await db
      .select({ id: feedbackPostCategories.id })
      .from(feedbackPostCategories)
      .where(
        and(
          eq(feedbackPostCategories.boardId, board.id),
          eq(feedbackPostCategories.slug, input.categorySlug)
        )
      )
      .limit(1);
    if (!category) {
      throw new Error("Category not found");
    }
    categoryId = category.id;
  }

  const [created] = await db
    .insert(feedbackPosts)
    .values({
      boardId: board.id,
      categoryId,
      title: input.title.trim(),
      details: input.details?.trim() || null,
      status: "open",
      authorUserId: userId,
      authorMode: input.authorMode,
    })
    .returning({ id: feedbackPosts.id });

  return getFeedbackPostDetail(created.id, userId);
}

export async function toggleFeedbackPostVote(postId: number, userId: string) {
  const [post] = await db
    .select({ id: feedbackPosts.id })
    .from(feedbackPosts)
    .where(eq(feedbackPosts.id, postId))
    .limit(1);
  if (!post) return null;

  const [existing] = await db
    .select({ id: feedbackPostVotes.id })
    .from(feedbackPostVotes)
    .where(and(eq(feedbackPostVotes.postId, postId), eq(feedbackPostVotes.userId, userId)))
    .limit(1);

  if (existing) {
    await db.delete(feedbackPostVotes).where(eq(feedbackPostVotes.id, existing.id));
  } else {
    await db.insert(feedbackPostVotes).values({ postId, userId });
  }

  await refreshPostCounters(postId);

  const [postAfter] = await db
    .select({ score: feedbackPosts.scoreCached })
    .from(feedbackPosts)
    .where(eq(feedbackPosts.id, postId))
    .limit(1);

  return {
    postId,
    voted: !existing,
    score: postAfter?.score ?? 0,
  };
}

export async function addFeedbackPostComment(
  postId: number,
  userId: string,
  input: FeedbackHubCreateCommentInput
) {
  const [post] = await db
    .select({ id: feedbackPosts.id })
    .from(feedbackPosts)
    .where(eq(feedbackPosts.id, postId))
    .limit(1);
  if (!post) return null;

  const [inserted] = await db
    .insert(feedbackPostComments)
    .values({
      postId,
      authorUserId: userId,
      body: input.body.trim(),
    })
    .returning({ id: feedbackPostComments.id });

  await refreshPostCounters(postId);

  const [comment] = await db
    .select({
      id: feedbackPostComments.id,
      postId: feedbackPostComments.postId,
      body: feedbackPostComments.body,
      createdAt: feedbackPostComments.createdAt,
      updatedAt: feedbackPostComments.updatedAt,
      userId: users.id,
      username: users.username,
      displayName: users.displayName,
    })
    .from(feedbackPostComments)
    .innerJoin(users, eq(feedbackPostComments.authorUserId, users.id))
    .where(eq(feedbackPostComments.id, inserted.id))
    .limit(1);

  if (!comment) return null;
  return {
    id: comment.id,
    postId: comment.postId,
    body: comment.body,
    createdAt: toIso(comment.createdAt),
    updatedAt: toIso(comment.updatedAt),
    author: buildAuthor(
      {
        userId: comment.userId,
        username: comment.username,
        displayName: comment.displayName,
      },
      "linked_profile"
    ),
  };
}

export async function listFeedbackChangelog(
  query: FeedbackHubChangelogQuery
): Promise<{
  items: FeedbackHubChangelogEntry[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}> {
  const offset = (query.page - 1) * query.limit;
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(feedbackChangelogEntries);

  const entries = await db
    .select({
      id: feedbackChangelogEntries.id,
      title: feedbackChangelogEntries.title,
      body: feedbackChangelogEntries.body,
      publishedAt: feedbackChangelogEntries.publishedAt,
      userId: users.id,
      username: users.username,
      displayName: users.displayName,
    })
    .from(feedbackChangelogEntries)
    .leftJoin(users, eq(feedbackChangelogEntries.publishedByUserId, users.id))
    .orderBy(desc(feedbackChangelogEntries.publishedAt))
    .limit(query.limit)
    .offset(offset);

  const entryIds = entries.map((entry) => entry.id);
  const linkedRows =
    entryIds.length === 0
      ? []
      : await db
          .select({
            entryId: feedbackChangelogPosts.changelogEntryId,
            postId: feedbackPosts.id,
            postTitle: feedbackPosts.title,
            postStatus: feedbackPosts.status,
            boardId: feedbackBoards.id,
            boardSlug: feedbackBoards.slug,
            boardName: feedbackBoards.name,
          })
          .from(feedbackChangelogPosts)
          .innerJoin(feedbackPosts, eq(feedbackChangelogPosts.postId, feedbackPosts.id))
          .innerJoin(feedbackBoards, eq(feedbackPosts.boardId, feedbackBoards.id))
          .where(inArray(feedbackChangelogPosts.changelogEntryId, entryIds))
          .orderBy(asc(feedbackChangelogPosts.id));

  const linkedByEntry = new Map<number, FeedbackHubChangelogEntry["linkedPosts"]>();
  for (const row of linkedRows) {
    const arr = linkedByEntry.get(row.entryId) ?? [];
    arr.push({
      id: row.postId,
      title: row.postTitle,
      status: row.postStatus as FeedbackHubPostStatus,
      board: {
        id: row.boardId,
        slug: row.boardSlug,
        name: row.boardName,
      },
    });
    linkedByEntry.set(row.entryId, arr);
  }

  const items: FeedbackHubChangelogEntry[] = entries.map((entry) => ({
    id: entry.id,
    title: entry.title,
    body: entry.body,
    publishedAt: toIso(entry.publishedAt),
    publishedBy: entry.userId
      ? buildAuthor(
          {
            userId: entry.userId,
            username: entry.username,
            displayName: entry.displayName,
          },
          "linked_profile"
        )
      : null,
    linkedPosts: linkedByEntry.get(entry.id) ?? [],
  }));

  const total = countRow?.count ?? 0;
  const totalPages = total === 0 ? 0 : Math.ceil(total / query.limit);
  return { items, page: query.page, limit: query.limit, total, totalPages };
}

export async function listAdminFeedbackPosts(query: FeedbackHubAdminPostsQuery) {
  const filters: SQL[] = [];
  if (query.boardSlug) {
    filters.push(eq(feedbackBoards.slug, query.boardSlug));
  }
  if (query.status) {
    filters.push(eq(feedbackPosts.status, query.status));
  }
  if (query.q) {
    filters.push(
      or(
        ilike(feedbackPosts.title, `%${query.q}%`),
        ilike(feedbackPosts.details, `%${query.q}%`)
      )!
    );
  }
  const whereClause = filters.length > 0 ? and(...filters) : undefined;
  const offset = (query.page - 1) * query.limit;

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(feedbackPosts)
    .innerJoin(feedbackBoards, eq(feedbackPosts.boardId, feedbackBoards.id))
    .where(whereClause);

  const rows = await db
    .select({
      id: feedbackPosts.id,
      boardId: feedbackBoards.id,
      boardSlug: feedbackBoards.slug,
      boardName: feedbackBoards.name,
      categoryId: feedbackPostCategories.id,
      categorySlug: feedbackPostCategories.slug,
      categoryName: feedbackPostCategories.name,
      title: feedbackPosts.title,
      details: feedbackPosts.details,
      status: feedbackPosts.status,
      scoreCached: feedbackPosts.scoreCached,
      commentCountCached: feedbackPosts.commentCountCached,
      createdAt: feedbackPosts.createdAt,
      updatedAt: feedbackPosts.updatedAt,
      authorUserId: feedbackPosts.authorUserId,
      authorMode: feedbackPosts.authorMode,
      username: users.username,
      displayName: users.displayName,
      viewerHasVoted: sql<boolean>`false`,
    })
    .from(feedbackPosts)
    .innerJoin(feedbackBoards, eq(feedbackPosts.boardId, feedbackBoards.id))
    .leftJoin(feedbackPostCategories, eq(feedbackPosts.categoryId, feedbackPostCategories.id))
    .innerJoin(users, eq(feedbackPosts.authorUserId, users.id))
    .where(whereClause)
    .orderBy(desc(feedbackPosts.updatedAt))
    .limit(query.limit)
    .offset(offset);

  const total = countRow?.count ?? 0;
  const totalPages = total === 0 ? 0 : Math.ceil(total / query.limit);
  return {
    items: rows.map(mapPostSummary),
    page: query.page,
    limit: query.limit,
    total,
    totalPages,
  };
}

export async function adminUpdateFeedbackPost(postId: number, input: FeedbackHubUpdatePostInput) {
  const [post] = await db
    .select({ id: feedbackPosts.id, boardId: feedbackPosts.boardId })
    .from(feedbackPosts)
    .where(eq(feedbackPosts.id, postId))
    .limit(1);
  if (!post) return null;

  let categoryId: number | null | undefined = undefined;
  if (input.categorySlug !== undefined) {
    if (input.categorySlug === null) {
      categoryId = null;
    } else {
      const [category] = await db
        .select({ id: feedbackPostCategories.id })
        .from(feedbackPostCategories)
        .where(
          and(
            eq(feedbackPostCategories.boardId, post.boardId),
            eq(feedbackPostCategories.slug, input.categorySlug)
          )
        )
        .limit(1);
      if (!category) {
        throw new Error("Category not found");
      }
      categoryId = category.id;
    }
  }

  const updatePayload: Record<string, unknown> = { updatedAt: new Date() };
  if (input.title !== undefined) updatePayload.title = input.title.trim();
  if (input.details !== undefined) updatePayload.details = input.details.trim();
  if (categoryId !== undefined) updatePayload.categoryId = categoryId;

  await db.update(feedbackPosts).set(updatePayload).where(eq(feedbackPosts.id, postId));
  return getFeedbackPostDetail(postId);
}

export async function adminUpdateFeedbackPostStatus(
  postId: number,
  input: FeedbackHubUpdateStatusInput,
  adminUserId: string
) {
  const [post] = await db
    .select({ id: feedbackPosts.id, status: feedbackPosts.status })
    .from(feedbackPosts)
    .where(eq(feedbackPosts.id, postId))
    .limit(1);
  if (!post) return null;

  if (post.status !== input.status) {
    await db
      .update(feedbackPosts)
      .set({
        status: input.status,
        updatedAt: new Date(),
      })
      .where(eq(feedbackPosts.id, postId));
  }

  if (post.status !== input.status || input.note) {
    await db.insert(feedbackStatusHistory).values({
      postId,
      fromStatus: post.status,
      toStatus: input.status,
      changedByUserId: adminUserId,
      note: input.note?.trim() || null,
    });
  }

  return getFeedbackPostDetail(postId);
}

export async function adminDeleteFeedbackComment(commentId: number) {
  const [comment] = await db
    .select({ id: feedbackPostComments.id, postId: feedbackPostComments.postId })
    .from(feedbackPostComments)
    .where(eq(feedbackPostComments.id, commentId))
    .limit(1);
  if (!comment) return false;

  await db.delete(feedbackPostComments).where(eq(feedbackPostComments.id, commentId));
  await refreshPostCounters(comment.postId);
  return true;
}

export async function adminDeleteFeedbackPost(postId: number) {
  const [post] = await db
    .select({ id: feedbackPosts.id })
    .from(feedbackPosts)
    .where(eq(feedbackPosts.id, postId))
    .limit(1);
  if (!post) return false;

  await db.delete(feedbackPosts).where(eq(feedbackPosts.id, postId));
  return true;
}

export async function adminCreateFeedbackChangelog(
  input: FeedbackHubCreateChangelogInput,
  adminUserId: string
) {
  const [entry] = await db
    .insert(feedbackChangelogEntries)
    .values({
      title: input.title.trim(),
      body: input.body.trim(),
      publishedByUserId: adminUserId,
      publishedAt: new Date(),
    })
    .returning({ id: feedbackChangelogEntries.id });

  if (input.postIds.length > 0) {
    const validPosts = await db
      .select({ id: feedbackPosts.id })
      .from(feedbackPosts)
      .where(inArray(feedbackPosts.id, input.postIds));
    const uniqueIds = Array.from(new Set(validPosts.map((post) => post.id)));
    if (uniqueIds.length > 0) {
      await db
        .insert(feedbackChangelogPosts)
        .values(uniqueIds.map((postId) => ({ changelogEntryId: entry.id, postId })))
        .onConflictDoNothing();
    }
  }

  const details = await listFeedbackChangelog({ page: 1, limit: 1 });
  return details.items.find((item) => item.id === entry.id) ?? null;
}
