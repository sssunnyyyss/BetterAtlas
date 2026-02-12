import type { FriendWithProfile } from "@betteratlas/shared";

interface FriendCardProps {
  friend: FriendWithProfile;
  onViewCourses?: (friendId: number) => void;
  onRemove?: (friendshipId: number) => void;
}

export default function FriendCard({
  friend,
  onViewCourses,
  onRemove,
}: FriendCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between">
      <div>
        <h4 className="font-medium text-gray-900">
          {friend.user.displayName}
        </h4>
        <div className="flex gap-3 text-xs text-gray-500 mt-0.5">
          {friend.user.major && <span>{friend.user.major}</span>}
          {friend.user.graduationYear && (
            <span>Class of {friend.user.graduationYear}</span>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        {onViewCourses && (
          <button
            onClick={() => onViewCourses(friend.user.id)}
            className="text-sm text-primary-600 hover:text-primary-800"
          >
            View Courses
          </button>
        )}
        {onRemove && (
          <button
            onClick={() => onRemove(friend.friendshipId)}
            className="text-sm text-red-500 hover:text-red-700"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
