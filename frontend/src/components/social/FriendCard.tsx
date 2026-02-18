import type { FriendWithProfile } from "@betteratlas/shared";
import UserBadge from "../ui/UserBadge.js";

interface FriendCardProps {
  friend: FriendWithProfile;
  onViewProfile?: () => void;
  onViewCourses?: (friendId: string) => void;
  onRemove?: (friendshipId: number) => void;
}

export default function FriendCard({
  friend,
  onViewProfile,
  onViewCourses,
  onRemove,
}: FriendCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={onViewProfile}
            className="font-medium text-gray-900 hover:text-primary-600 text-left"
          >
            @{friend.user.username}
          </button>
          {(friend.user.badges ?? []).map((badge) => (
            <UserBadge key={badge.slug} badge={badge} />
          ))}
        </div>
        <div className="text-xs text-gray-500 mt-0.5">{friend.user.fullName}</div>
        <div className="flex gap-3 text-xs text-gray-500 mt-0.5">
          {friend.user.major && <span>{friend.user.major}</span>}
          {friend.user.graduationYear && (
            <span>Class of {friend.user.graduationYear}</span>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        {onViewProfile && (
          <button
            onClick={onViewProfile}
            className="text-sm text-primary-600 hover:text-primary-800"
          >
            Profile
          </button>
        )}
        {onViewCourses && (
          <button
            onClick={() => onViewCourses(friend.user.id)}
            className="text-sm text-primary-600 hover:text-primary-800"
          >
            Courses
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
