import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { FeedbackHubPostStatus } from "@betteratlas/shared";
import { useAuth } from "../../lib/auth.js";
import {
  useCreateFeedbackPost,
  useFeedbackBoardCategories,
  useFeedbackBoardPosts,
  useSimilarFeedbackPosts,
  useToggleFeedbackVote,
} from "../../hooks/useFeedbackHub.js";

const STATUS_FILTERS: Array<{ value: "" | FeedbackHubPostStatus; label: string }> = [
  { value: "", label: "All statuses" },
  { value: "open", label: "Open" },
  { value: "under_review", label: "Under Review" },
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In Progress" },
  { value: "complete", label: "Complete" },
];

export default function FeedbackHubBoard() {
  const { boardSlug = "" } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [categorySlug, setCategorySlug] = useState("");
  const [authorMode, setAuthorMode] = useState<"pseudonymous" | "linked_profile">("pseudonymous");

  const status = (searchParams.get("status") || "") as "" | FeedbackHubPostStatus;
  const category = searchParams.get("category") || "";
  const sort = (searchParams.get("sort") || "trending") as "trending" | "top" | "new";
  const q = searchParams.get("q") || "";
  const page = Number.parseInt(searchParams.get("page") || "1", 10) || 1;

  const categoriesQuery = useFeedbackBoardCategories(boardSlug);
  const postsQuery = useFeedbackBoardPosts(boardSlug, {
    status: status || undefined,
    category: category || undefined,
    sort,
    q: q || undefined,
    page,
    limit: 20,
  });
  const similarQuery = useSimilarFeedbackPosts(boardSlug, title);
  const createPost = useCreateFeedbackPost();
  const toggleVote = useToggleFeedbackVote();

  const boardTitle = postsQuery.data?.board.name || categoriesQuery.data?.board.name || "Board";
  const boardDescription =
    postsQuery.data?.board.description || categoriesQuery.data?.board.description || "";

  const pagination = postsQuery.data;
  const showPrev = (pagination?.page ?? 1) > 1;
  const showNext = pagination ? pagination.page < pagination.totalPages : false;

  const categoryOptions = useMemo(
    () => categoriesQuery.data?.categories ?? [],
    [categoriesQuery.data?.categories]
  );

  function setParam(name: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value.length === 0) next.delete(name);
    else next.set(name, value);
    next.set("page", "1");
    setSearchParams(next);
  }

  async function onCreatePost(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;

    try {
      const created = await createPost.mutateAsync({
        boardSlug,
        categorySlug: categorySlug || undefined,
        title: title.trim(),
        details: details.trim() || undefined,
        authorMode,
      });
      setTitle("");
      setDetails("");
      setCategorySlug("");
      navigate(`/feedback-hub/${created.board.slug}/post/${created.id}`);
    } catch {
      // handled by mutation error text
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-gray-200 bg-white p-5 space-y-2">
        <h2 className="text-xl font-semibold text-gray-900">{boardTitle}</h2>
        {boardDescription && <p className="text-sm text-gray-600">{boardDescription}</p>}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
        <div className="flex flex-wrap gap-3">
          <select
            value={sort}
            onChange={(e) => setParam("sort", e.target.value)}
            className="rounded-md border-gray-300 text-sm"
          >
            <option value="trending">Trending</option>
            <option value="top">Top</option>
            <option value="new">New</option>
          </select>

          <select
            value={status}
            onChange={(e) => setParam("status", e.target.value)}
            className="rounded-md border-gray-300 text-sm"
          >
            {STATUS_FILTERS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={category}
            onChange={(e) => setParam("category", e.target.value)}
            className="rounded-md border-gray-300 text-sm"
          >
            <option value="">All categories</option>
            {categoryOptions.map((cat) => (
              <option key={cat.id} value={cat.slug}>
                {cat.name}
              </option>
            ))}
          </select>

          <input
            value={q}
            onChange={(e) => {
              const next = new URLSearchParams(searchParams);
              if (e.target.value.trim().length === 0) next.delete("q");
              else next.set("q", e.target.value);
              next.set("page", "1");
              setSearchParams(next);
            }}
            placeholder="Search posts..."
            className="rounded-md border-gray-300 text-sm min-w-[220px]"
          />
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
        <h3 className="font-semibold text-gray-900">Create Post</h3>
        {!user && (
          <p className="text-sm text-gray-600">
            <Link to="/login" className="text-primary-700 hover:underline">
              Log in
            </Link>{" "}
            to submit a new post.
          </p>
        )}
        {user && (
          <form onSubmit={onCreatePost} className="space-y-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short, descriptive title"
              minLength={5}
              maxLength={160}
              required
              className="w-full rounded-md border-gray-300 text-sm"
            />
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={4}
              maxLength={4000}
              placeholder="Any additional details..."
              className="w-full rounded-md border-gray-300 text-sm"
            />
            <div className="flex flex-wrap gap-3">
              <select
                value={categorySlug}
                onChange={(e) => setCategorySlug(e.target.value)}
                className="rounded-md border-gray-300 text-sm"
              >
                <option value="">No category</option>
                {categoryOptions.map((cat) => (
                  <option key={cat.id} value={cat.slug}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <select
                value={authorMode}
                onChange={(e) =>
                  setAuthorMode(e.target.value as "pseudonymous" | "linked_profile")
                }
                className="rounded-md border-gray-300 text-sm"
              >
                <option value="pseudonymous">Post as pseudonymous</option>
                <option value="linked_profile">Post with profile</option>
              </select>
              <button
                type="submit"
                disabled={createPost.isPending}
                className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
              >
                {createPost.isPending ? "Creating..." : "Create Post"}
              </button>
            </div>

            {title.trim().length >= 3 && similarQuery.data && similarQuery.data.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-medium text-amber-900 mb-2">Similar posts</p>
                <div className="space-y-1">
                  {similarQuery.data.map((post) => (
                    <Link
                      key={post.id}
                      to={`/feedback-hub/${boardSlug}/post/${post.id}`}
                      className="block text-sm text-amber-900 hover:underline"
                    >
                      {post.title} ({post.score} votes)
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {createPost.isError && (
              <p className="text-sm text-red-600">
                {(createPost.error as Error)?.message || "Failed to create post"}
              </p>
            )}
          </form>
        )}
      </section>

      <section className="space-y-3">
        {postsQuery.isLoading && <p className="text-sm text-gray-600">Loading posts...</p>}
        {postsQuery.isError && <p className="text-sm text-red-600">Failed to load posts.</p>}
        {postsQuery.data?.items.length === 0 && (
          <p className="text-sm text-gray-600">No posts found for this filter.</p>
        )}

        {postsQuery.data?.items.map((post) => (
          <article
            key={post.id}
            className="rounded-lg border border-gray-200 bg-white p-4 flex items-start gap-3"
          >
            <button
              type="button"
              onClick={() => {
                if (!user) return;
                toggleVote.mutate(post.id);
              }}
              disabled={!user || toggleVote.isPending}
              className={`min-w-[72px] px-2 py-1 rounded text-xs font-semibold border ${
                post.viewerHasVoted
                  ? "bg-primary-50 border-primary-200 text-primary-700"
                  : "bg-white border-gray-200 text-gray-700"
              } disabled:opacity-50`}
              title={user ? "Toggle vote" : "Log in to vote"}
            >
              ▲ {post.score}
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-2 items-center">
                <Link
                  to={`/feedback-hub/${post.board.slug}/post/${post.id}`}
                  className="font-semibold text-gray-900 hover:text-primary-700"
                >
                  {post.title}
                </Link>
                <span className="text-xs rounded bg-gray-100 px-2 py-0.5 text-gray-600">
                  {post.status.replace("_", " ")}
                </span>
                {post.category && (
                  <span className="text-xs rounded bg-gray-100 px-2 py-0.5 text-gray-600">
                    {post.category.name}
                  </span>
                )}
              </div>
              {post.details && (
                <p className="text-sm text-gray-600 mt-2 line-clamp-2">{post.details}</p>
              )}
              <p className="text-xs text-gray-500 mt-2">
                {post.commentCount} comments • {post.author.displayName}
              </p>
            </div>
          </article>
        ))}
      </section>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3">
          <button
            type="button"
            disabled={!showPrev}
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.set("page", String((pagination.page ?? 1) - 1));
              setSearchParams(next);
            }}
            className="px-3 py-1 rounded border border-gray-300 text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            type="button"
            disabled={!showNext}
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.set("page", String((pagination.page ?? 1) + 1));
              setSearchParams(next);
            }}
            className="px-3 py-1 rounded border border-gray-300 text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
