import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../lib/auth.js";
import {
  useCreateFeedbackComment,
  useFeedbackPost,
  useToggleFeedbackVote,
} from "../../hooks/useFeedbackHub.js";

export default function FeedbackHubPostDetail() {
  const { boardSlug = "", postId = "" } = useParams();
  const numericPostId = Number.parseInt(postId, 10);
  const { user } = useAuth();
  const postQuery = useFeedbackPost(Number.isInteger(numericPostId) ? numericPostId : null);
  const voteMutation = useToggleFeedbackVote();
  const commentMutation = useCreateFeedbackComment();
  const [commentBody, setCommentBody] = useState("");

  async function onCommentSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user || !Number.isInteger(numericPostId)) return;
    try {
      await commentMutation.mutateAsync({
        postId: numericPostId,
        body: commentBody,
      });
      setCommentBody("");
    } catch {
      // handled below
    }
  }

  if (postQuery.isLoading) {
    return <p className="text-sm text-gray-600">Loading post...</p>;
  }

  if (postQuery.isError || !postQuery.data) {
    return <p className="text-sm text-red-600">Post not found.</p>;
  }

  const post = postQuery.data;

  return (
    <div className="space-y-6">
      <div>
        <Link
          to={`/feedback-hub/${boardSlug || post.board.slug}`}
          className="text-sm text-primary-700 hover:underline"
        >
          ← Back to {post.board.name}
        </Link>
      </div>

      <article className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => {
              if (!user) return;
              voteMutation.mutate(post.id);
            }}
            disabled={!user || voteMutation.isPending}
            className={`min-w-[82px] px-3 py-2 rounded text-sm font-semibold border ${
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
              <h2 className="text-xl font-semibold text-gray-900">{post.title}</h2>
              <span className="text-xs rounded bg-gray-100 px-2 py-0.5 text-gray-600">
                {post.status.replace("_", " ")}
              </span>
              {post.category && (
                <span className="text-xs rounded bg-gray-100 px-2 py-0.5 text-gray-600">
                  {post.category.name}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Posted by {post.author.displayName} • {new Date(post.createdAt).toLocaleString()}
            </p>
            {post.details && <p className="text-sm text-gray-700 mt-4 whitespace-pre-wrap">{post.details}</p>}
          </div>
        </div>
      </article>

      <section className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
        <h3 className="font-semibold text-gray-900">Comments ({post.comments.length})</h3>
        {!user && (
          <p className="text-sm text-gray-600">
            <Link to="/login" className="text-primary-700 hover:underline">
              Log in
            </Link>{" "}
            to join the discussion.
          </p>
        )}
        {user && (
          <form onSubmit={onCommentSubmit} className="space-y-2">
            <textarea
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder="Add a comment..."
              minLength={1}
              maxLength={3000}
              rows={3}
              required
              className="w-full rounded-md border-gray-300 text-sm"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">{commentBody.length}/3000</span>
              <button
                type="submit"
                disabled={commentMutation.isPending}
                className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
              >
                {commentMutation.isPending ? "Posting..." : "Post Comment"}
              </button>
            </div>
            {commentMutation.isError && (
              <p className="text-sm text-red-600">
                {(commentMutation.error as Error)?.message || "Failed to post comment"}
              </p>
            )}
          </form>
        )}

        <div className="space-y-3">
          {post.comments.length === 0 && (
            <p className="text-sm text-gray-600">No comments yet.</p>
          )}
          {post.comments.map((comment) => (
            <div key={comment.id} className="rounded-md border border-gray-100 bg-gray-50 p-3">
              <p className="text-xs text-gray-500">
                {comment.author.displayName} • {new Date(comment.createdAt).toLocaleString()}
              </p>
              <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{comment.body}</p>
            </div>
          ))}
        </div>
      </section>

      {post.statusHistory.length > 0 && (
        <section className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
          <h3 className="font-semibold text-gray-900">Status History</h3>
          {post.statusHistory.map((item) => (
            <div key={item.id} className="text-sm text-gray-700">
              <span className="font-medium">{item.fromStatus ?? "none"}</span>
              {" → "}
              <span className="font-medium">{item.toStatus}</span>
              {" • "}
              <span className="text-gray-500">{new Date(item.createdAt).toLocaleString()}</span>
              {item.note && <p className="text-xs text-gray-500 mt-1">{item.note}</p>}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
