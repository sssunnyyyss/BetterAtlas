import type { ReviewWithAuthor } from "@betteratlas/shared";
import RatingStars from "./RatingStars.js";
import { useAuth } from "../../lib/auth.js";

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
      <div className="flex justify-between items-start">
        <div>
          <span className="text-sm font-medium text-gray-900">
            {review.author ? `@${review.author.username}` : "Anonymous"}
          </span>
          {review.semester && (
            <span className="text-xs text-gray-500 ml-2">
              {review.semester}
            </span>
          )}
          {review.instructor?.name && (
            <span className="text-xs text-gray-500 ml-2">
              {review.instructor.name}
            </span>
          )}
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
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">Workload:</span>
          <RatingStars value={review.ratingWorkload} readonly size="sm" />
        </div>
      </div>

      {review.comment && (
        <p className="text-sm text-gray-700 mt-3">{review.comment}</p>
      )}

      <p className="text-xs text-gray-400 mt-2">
        {new Date(review.createdAt).toLocaleDateString()}
      </p>
    </div>
  );
}
