import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Badge } from "@betteratlas/shared";
import { api } from "../../api/client.js";
import UserBadge from "../ui/UserBadge.js";

interface ProfileUser {
  id: string;
  username: string;
  fullName: string;
  graduationYear: number | null;
  major: string | null;
  bio: string | null;
  interests: string[];
  avatarUrl: string | null;
  badges?: Badge[];
}

interface UserProfileModalProps {
  user: ProfileUser | null;
  isFriend: boolean;
  hasPendingRequest: boolean;
  onClose: () => void;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function UserProfileModal({
  user,
  isFriend,
  hasPendingRequest,
  onClose,
}: UserProfileModalProps) {
  const queryClient = useQueryClient();

  const sendRequest = useMutation({
    mutationFn: (username: string) =>
      api.post("/friends/request", { username }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["friends"] }),
        queryClient.invalidateQueries({ queryKey: ["friends", "pending"] }),
      ]),
  });

  if (!user) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl leading-none"
          aria-label="Close"
        >
          ×
        </button>

        {/* Avatar */}
        <div className="flex flex-col items-center mb-4">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.fullName}
              className="w-24 h-24 rounded-full object-cover border-2 border-gray-200"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-2xl font-bold border-2 border-primary-200">
              {getInitials(user.fullName)}
            </div>
          )}
          <h2 className="mt-3 text-xl font-bold text-gray-900">{user.fullName}</h2>
          <p className="text-sm text-gray-500">@{user.username}</p>
        </div>

        {/* Details */}
        <div className="space-y-3 text-sm">
          {(user.major || user.graduationYear) && (
            <div className="flex gap-3 text-gray-600">
              {user.major && <span>{user.major}</span>}
              {user.graduationYear && <span>Class of {user.graduationYear}</span>}
            </div>
          )}

          {user.bio && (
            <p className="text-gray-700 whitespace-pre-wrap">{user.bio}</p>
          )}

          {user.interests && user.interests.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {user.interests.map((interest) => (
                <span
                  key={interest}
                  className="inline-flex items-center rounded-full bg-primary-50 border border-primary-200 px-2.5 py-0.5 text-xs font-medium text-primary-700"
                >
                  {interest}
                </span>
              ))}
            </div>
          )}

          {(user.badges?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {(user.badges ?? []).map((badge) => (
                <UserBadge key={badge.slug} badge={badge} />
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-5 flex gap-3">
          {!isFriend && !hasPendingRequest && (
            <button
              onClick={() => sendRequest.mutate(user.username)}
              disabled={sendRequest.isPending || sendRequest.isSuccess}
              className="flex-1 bg-primary-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              {sendRequest.isPending
                ? "Sending..."
                : sendRequest.isSuccess
                ? "Request sent"
                : "Add Friend"}
            </button>
          )}
          {hasPendingRequest && (
            <p className="flex-1 text-center text-sm text-gray-500 py-2">
              Friend request pending
            </p>
          )}
          {isFriend && (
            <p className="flex-1 text-center text-sm text-gray-500 py-2">
              Already friends
            </p>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm font-medium border border-gray-300 hover:bg-gray-50"
          >
            Close
          </button>
        </div>

        {sendRequest.isError && (
          <p className="mt-2 text-xs text-red-600 text-center">
            {(sendRequest.error as any)?.message || "Failed to send request"}
          </p>
        )}
      </div>
    </div>
  );
}
