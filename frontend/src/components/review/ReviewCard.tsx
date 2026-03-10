import type { ReviewWithAuthor } from "@betteratlas/shared";
import RatingStars from "./RatingStars.js";
import { useAuth } from "../../lib/auth.js";
import UserBadge from "../ui/UserBadge.js";

const TAG_COLORS = [
  "bg-blue-50 text-blue-700 ring-blue-600/20",
  "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  "bg-orange-50 text-orange-700 ring-orange-600/20",
  "bg-cyan-50 text-cyan-700 ring-cyan-600/20",
  "bg-rose-50 text-rose-700 ring-rose-600/20",
  "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
];

function tagColorClass(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
  }
  return TAG_COLORS[hash % TAG_COLORS.length] ?? TAG_COLORS[0];
}

interface ReviewCardProps {
  review: ReviewWithAuthor;
  onDelete?: (id: number) => void;
  onEdit?: (review: ReviewWithAuthor) => void;
}

export default function ReviewCard({ review, onDelete, onEdit }: ReviewCardProps) {
  const { user } = useAuth();
  const isOwner = user?.id === review.userId;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium text-gray-900">
              {review.author ? `@${review.author.username}` : "Anonymous"}
            </span>
            {(review.author?.badges ?? []).map((badge) => (
              <UserBadge key={badge.slug} badge={badge} />
            ))}
            {review.source === "rmp" && (
              <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                RateMyProfessor
              </span>
            )}
            {review.reportedGrade && (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 ring-1 ring-inset ring-slate-400/30">
                Grade {review.reportedGrade}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500">
            {review.semester && <span>{review.semester}</span>}
            {review.instructor?.name && <span>{review.instructor.name}</span>}
          </div>
        </div>
        {isOwner && (
          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                onClick={() => onEdit(review)}
                className="text-xs text-gray-600 hover:text-gray-900"
              >
                Edit
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(review.id)}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-4 mt-2">
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">Quality:</span>
          <RatingStars value={review.ratingQuality} readonly size="sm" />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">Difficulty:</span>
          <RatingStars value={review.ratingDifficulty} readonly size="sm" />
        </div>
        {review.ratingWorkload != null && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">Workload:</span>
            <RatingStars value={review.ratingWorkload} readonly size="sm" />
          </div>
        )}
      </div>

      {review.source === "rmp" && review.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {review.tags.map((tag) => (
            <span
              key={tag}
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${tagColorClass(
                tag
              )}`}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {review.comment && (
        <p className="text-sm text-gray-700 mt-3">{review.comment}</p>
      )}

      <p className="text-xs text-gray-400 mt-2">
        {new Date(review.createdAt).toLocaleDateString()}
      </p>
    </div>
  );
}
