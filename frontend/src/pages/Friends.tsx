import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client.js";
import type { FriendWithProfile, CourseListWithItems } from "@betteratlas/shared";
import FriendCard from "../components/social/FriendCard.js";
import CourseListCard from "../components/social/CourseListCard.js";

export default function Friends() {
  const queryClient = useQueryClient();
  const [usernameInput, setUsernameInput] = useState("");
  const [viewingFriendId, setViewingFriendId] = useState<string | null>(null);

  const { data: friends, isLoading: loadingFriends } = useQuery({
    queryKey: ["friends"],
    queryFn: () => api.get<FriendWithProfile[]>("/friends"),
  });

  const { data: pending } = useQuery({
    queryKey: ["friends", "pending"],
    queryFn: () => api.get<FriendWithProfile[]>("/friends/pending"),
  });

  const { data: friendCourses } = useQuery({
    queryKey: ["friends", viewingFriendId, "courses"],
    queryFn: () =>
      api.get<CourseListWithItems[]>(
        `/friends/${viewingFriendId}/courses`
      ),
    enabled: viewingFriendId !== null,
  });

  const sendRequest = useMutation({
    mutationFn: (username: string) =>
      api.post("/friends/request", { username }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["friends"] }),
        queryClient.invalidateQueries({ queryKey: ["friends", "pending"] }),
      ]),
  });

  const acceptRequest = useMutation({
    mutationFn: (friendshipId: number) =>
      api.post(`/friends/${friendshipId}/accept`),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["friends"] }),
        queryClient.invalidateQueries({ queryKey: ["friends", "pending"] }),
      ]),
  });

  const declineRequest = useMutation({
    mutationFn: (friendshipId: number) =>
      api.post(`/friends/${friendshipId}/decline`),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["friends"] }),
        queryClient.invalidateQueries({ queryKey: ["friends", "pending"] }),
      ]),
  });

  const removeFriend = useMutation({
    mutationFn: (friendshipId: number) =>
      api.delete(`/friends/${friendshipId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["friends"] }),
  });

  function handleSendRequest(e: React.FormEvent) {
    e.preventDefault();
    const u = usernameInput.trim().replace(/^@/, "").toLowerCase();
    if (!u) return;
    sendRequest.mutate(u);
    setUsernameInput("");
  }

  return (
    <div className="max-w-4xl mx-auto p-6" data-tour-id="friends-add-list">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Friends</h1>

      {/* Send friend request */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <h3 className="font-medium text-gray-900 mb-2">Add a Friend</h3>
        <form onSubmit={handleSendRequest} className="flex gap-2">
          <input
            type="text"
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
            placeholder="Enter @username"
            className="rounded-md border-gray-300 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500"
          />
          <button
            type="submit"
            disabled={sendRequest.isPending}
            className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            Send Request
          </button>
        </form>
        {sendRequest.isError && (
          <p className="text-sm text-red-600 mt-2">
            {(sendRequest.error as any)?.message || "Failed to send request"}
          </p>
        )}
      </div>

      {/* Pending requests */}
      {pending && pending.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Pending Requests
          </h2>
          <div className="space-y-2">
            {pending.map((p) => (
              <div
                key={p.friendshipId}
                className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between"
              >
                <div>
                  <span className="font-medium text-gray-900">
                    @{p.user.username}
                  </span>
                  <span className="text-xs text-gray-500 ml-2">
                    {p.user.fullName}
                  </span>
                  {p.user.major && (
                    <span className="text-xs text-gray-500 ml-2">
                      {p.user.major}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => acceptRequest.mutate(p.friendshipId)}
                    className="bg-primary-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-primary-700"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => declineRequest.mutate(p.friendshipId)}
                    className="px-3 py-1.5 rounded-md text-sm font-medium border border-gray-300 hover:bg-gray-50"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Friends list */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          My Friends
        </h2>
        {loadingFriends ? (
          <div className="animate-pulse space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-200 rounded-lg" />
            ))}
          </div>
        ) : friends?.length === 0 ? (
          <p className="text-sm text-gray-500">
            No friends yet. Send a friend request to get started!
          </p>
        ) : (
          <div className="space-y-2">
            {friends?.map((f) => (
              <FriendCard
                key={f.friendshipId}
                friend={f}
                onViewCourses={setViewingFriendId}
                onRemove={(id) => removeFriend.mutate(id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Friend's courses */}
      {viewingFriendId !== null && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">
              {friends?.find((f) => f.user.id === viewingFriendId)?.user
                .username
                ? `@${friends?.find((f) => f.user.id === viewingFriendId)?.user.username}`
                : "Friend"}
              's Courses
            </h2>
            <button
              onClick={() => setViewingFriendId(null)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Close
            </button>
          </div>
          {friendCourses?.length === 0 ? (
            <p className="text-sm text-gray-500">
              No public course lists.
            </p>
          ) : (
            <div className="space-y-3">
              {friendCourses?.map((list) => (
                <CourseListCard key={list.id} list={list} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
