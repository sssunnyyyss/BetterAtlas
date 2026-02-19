import { Link } from "react-router-dom";
import { useAuth } from "../../lib/auth.js";
import { useFeedbackRoadmap, useToggleFeedbackVote } from "../../hooks/useFeedbackHub.js";

export default function FeedbackHubRoadmap() {
  const { user } = useAuth();
  const roadmapQuery = useFeedbackRoadmap(40);
  const toggleVote = useToggleFeedbackVote();

  if (roadmapQuery.isLoading) {
    return <p className="text-sm text-gray-600">Loading roadmap...</p>;
  }

  if (roadmapQuery.isError) {
    return <p className="text-sm text-red-600">Failed to load roadmap.</p>;
  }

  const columns = roadmapQuery.data ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {columns.map((column) => (
        <section
          key={column.status}
          className="rounded-lg border border-gray-200 bg-white p-4 space-y-3 min-h-[320px]"
        >
          <header className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">{column.label}</h2>
            <span className="text-xs text-gray-500">{column.posts.length} posts</span>
          </header>

          {column.posts.length === 0 && (
            <p className="text-sm text-gray-500">No posts in this status yet.</p>
          )}

          <div className="space-y-3">
            {column.posts.map((post) => (
              <article
                key={post.id}
                className="rounded-md border border-gray-100 p-3 bg-gray-50 space-y-2"
              >
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!user) return;
                      toggleVote.mutate(post.id);
                    }}
                    disabled={!user || toggleVote.isPending}
                    className={`min-w-[64px] px-2 py-1 rounded text-xs font-medium border ${
                      post.viewerHasVoted
                        ? "bg-primary-50 border-primary-200 text-primary-700"
                        : "bg-white border-gray-200 text-gray-700"
                    } disabled:opacity-50`}
                    title={user ? "Toggle vote" : "Log in to vote"}
                  >
                    ▲ {post.score}
                  </button>
                  <div className="min-w-0">
                    <Link
                      to={`/feedback-hub/${post.board.slug}/post/${post.id}`}
                      className="font-medium text-gray-900 hover:text-primary-700"
                    >
                      {post.title}
                    </Link>
                    <p className="text-xs text-gray-500 mt-1">
                      {post.board.name}
                      {post.category ? ` • ${post.category.name}` : ""}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
