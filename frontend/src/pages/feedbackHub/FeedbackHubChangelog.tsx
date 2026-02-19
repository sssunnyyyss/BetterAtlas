import { Link, useSearchParams } from "react-router-dom";
import { useFeedbackChangelog } from "../../hooks/useFeedbackHub.js";

export default function FeedbackHubChangelog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number.parseInt(searchParams.get("page") || "1", 10) || 1;
  const changelogQuery = useFeedbackChangelog(page, 12);

  if (changelogQuery.isLoading) {
    return <p className="text-sm text-gray-600">Loading changelog...</p>;
  }

  if (changelogQuery.isError || !changelogQuery.data) {
    return <p className="text-sm text-red-600">Failed to load changelog.</p>;
  }

  const result = changelogQuery.data;

  return (
    <div className="space-y-4">
      {result.items.length === 0 && (
        <p className="text-sm text-gray-600">No changelog entries yet.</p>
      )}

      {result.items.map((entry) => (
        <article key={entry.id} className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
          <header>
            <h2 className="text-lg font-semibold text-gray-900">{entry.title}</h2>
            <p className="text-xs text-gray-500">
              {new Date(entry.publishedAt).toLocaleString()}
              {entry.publishedBy ? ` • ${entry.publishedBy.displayName}` : ""}
            </p>
          </header>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{entry.body}</p>
          {entry.linkedPosts.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-500">Linked posts</p>
              <div className="flex flex-wrap gap-2">
                {entry.linkedPosts.map((post) => (
                  <Link
                    key={post.id}
                    to={`/feedback-hub/${post.board.slug}/post/${post.id}`}
                    className="text-xs rounded bg-gray-100 px-2 py-1 text-gray-700 hover:bg-gray-200"
                  >
                    {post.title}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </article>
      ))}

      {result.totalPages > 1 && (
        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3">
          <button
            type="button"
            disabled={result.page <= 1}
            onClick={() => setSearchParams({ page: String(result.page - 1) })}
            className="px-3 py-1 rounded border border-gray-300 text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {result.page} of {result.totalPages}
          </span>
          <button
            type="button"
            disabled={result.page >= result.totalPages}
            onClick={() => setSearchParams({ page: String(result.page + 1) })}
            className="px-3 py-1 rounded border border-gray-300 text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
