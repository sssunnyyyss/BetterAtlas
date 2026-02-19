import { useMemo, useState, type FormEvent } from "react";
import type { FeedbackHubPostStatus } from "@betteratlas/shared";
import {
  useAdminCreateChangelog,
  useAdminDeleteFeedbackPost,
  useAdminFeedbackPosts,
  useAdminUpdateFeedbackStatus,
  useFeedbackBoards,
} from "../../hooks/useFeedbackHub.js";

const STATUS_OPTIONS: FeedbackHubPostStatus[] = [
  "open",
  "under_review",
  "planned",
  "in_progress",
  "complete",
];

export default function AdminFeedback() {
  const boardsQuery = useFeedbackBoards();
  const [boardSlug, setBoardSlug] = useState("");
  const [status, setStatus] = useState<"" | FeedbackHubPostStatus>("");
  const [q, setQ] = useState("");
  const postsQuery = useAdminFeedbackPosts({
    boardSlug: boardSlug || undefined,
    status: status || undefined,
    q: q || undefined,
    page: 1,
    limit: 60,
  });
  const updateStatus = useAdminUpdateFeedbackStatus();
  const deletePost = useAdminDeleteFeedbackPost();
  const createChangelog = useAdminCreateChangelog();
  const [selectedPostIds, setSelectedPostIds] = useState<number[]>([]);
  const [changelogTitle, setChangelogTitle] = useState("");
  const [changelogBody, setChangelogBody] = useState("");

  const selectedPosts = useMemo(
    () => postsQuery.data?.items.filter((post) => selectedPostIds.includes(post.id)) ?? [],
    [postsQuery.data?.items, selectedPostIds]
  );

  function toggleSelected(postId: number) {
    setSelectedPostIds((prev) =>
      prev.includes(postId) ? prev.filter((id) => id !== postId) : [...prev, postId]
    );
  }

  async function onCreateChangelog(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      await createChangelog.mutateAsync({
        title: changelogTitle,
        body: changelogBody,
        postIds: selectedPostIds,
      });
      setChangelogTitle("");
      setChangelogBody("");
      setSelectedPostIds([]);
    } catch {
      // mutation state shows error
    }
  }

  async function onDeletePost(postId: number, title: string) {
    const ok = confirm(`Delete this feedback post?\n\n"${title}"\n\nThis cannot be undone.`);
    if (!ok) return;
    try {
      await deletePost.mutateAsync(postId);
      setSelectedPostIds((prev) => prev.filter((id) => id !== postId));
    } catch {
      // mutation state shows error
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Feedback Triage</h2>
        <div className="flex flex-wrap gap-3">
          <select
            value={boardSlug}
            onChange={(e) => setBoardSlug(e.target.value)}
            className="rounded-md border-gray-300 text-sm"
          >
            <option value="">All boards</option>
            {boardsQuery.data?.map((board) => (
              <option key={board.slug} value={board.slug}>
                {board.name}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "" | FeedbackHubPostStatus)}
            className="rounded-md border-gray-300 text-sm"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value.replace("_", " ")}
              </option>
            ))}
          </select>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title/details"
            className="rounded-md border-gray-300 text-sm min-w-[220px]"
          />
        </div>

        <div className="space-y-2">
          {postsQuery.isLoading && <p className="text-sm text-gray-600">Loading posts...</p>}
          {postsQuery.isError && <p className="text-sm text-red-600">Failed to load posts.</p>}
          {postsQuery.data?.items.map((post) => (
            <div
              key={post.id}
              className="rounded border border-gray-200 p-3 flex flex-wrap items-center gap-3"
            >
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={selectedPostIds.includes(post.id)}
                  onChange={() => toggleSelected(post.id)}
                />
                Select
              </label>
              <div className="flex-1 min-w-[260px]">
                <p className="font-medium text-gray-900">{post.title}</p>
                <p className="text-xs text-gray-500">
                  {post.board.name}
                  {post.category ? ` • ${post.category.name}` : ""}
                  {" • "}
                  {post.score} votes
                </p>
              </div>
              <select
                value={post.status}
                onChange={(e) =>
                  updateStatus.mutate({
                    postId: post.id,
                    status: e.target.value as FeedbackHubPostStatus,
                  })
                }
                className="rounded-md border-gray-300 text-sm"
              >
                {STATUS_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {value.replace("_", " ")}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => onDeletePost(post.id, post.title)}
                disabled={deletePost.isPending}
                className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
        {deletePost.isError && (
          <p className="text-sm text-red-600">
            {(deletePost.error as Error)?.message || "Failed to delete post."}
          </p>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Publish Changelog</h2>
        <p className="text-sm text-gray-600">
          Selected posts: {selectedPosts.length}
        </p>
        {selectedPosts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedPosts.map((post) => (
              <span key={post.id} className="text-xs rounded bg-gray-100 px-2 py-1 text-gray-600">
                {post.title}
              </span>
            ))}
          </div>
        )}
        <form onSubmit={onCreateChangelog} className="space-y-3">
          <input
            value={changelogTitle}
            onChange={(e) => setChangelogTitle(e.target.value)}
            placeholder="Changelog title"
            minLength={5}
            maxLength={200}
            required
            className="w-full rounded-md border-gray-300 text-sm"
          />
          <textarea
            value={changelogBody}
            onChange={(e) => setChangelogBody(e.target.value)}
            placeholder="What shipped, what changed, and any caveats."
            minLength={10}
            maxLength={12000}
            rows={5}
            required
            className="w-full rounded-md border-gray-300 text-sm"
          />
          <button
            type="submit"
            disabled={createChangelog.isPending}
            className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            {createChangelog.isPending ? "Publishing..." : "Publish Changelog"}
          </button>
          {createChangelog.isError && (
            <p className="text-sm text-red-600">
              {(createChangelog.error as Error)?.message || "Failed to publish changelog"}
            </p>
          )}
        </form>
      </section>
    </div>
  );
}
