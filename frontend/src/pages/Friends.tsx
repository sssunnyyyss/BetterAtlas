import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client.js";
import type { FriendWithProfile, CourseListWithItems, User } from "@betteratlas/shared";
import FriendCard from "../components/social/FriendCard.js";
import CourseListCard from "../components/social/CourseListCard.js";
import UserProfileModal from "../components/social/UserProfileModal.js";

interface SearchResult {
  id: string;
  username: string;
  fullName: string;
  graduationYear: number | null;
  major: string | null;
  bio: string | null;
  interests: string[];
  avatarUrl: string | null;
}

function getInitials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
}

export default function Friends() {
  const queryClient = useQueryClient();
  const [viewingFriendId, setViewingFriendId] = useState<string | null>(null);
  const [viewingProfile, setViewingProfile] = useState<User | null>(null);

  // Suggestive search state
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const { data: searchResults, isFetching: searching } = useQuery({
    queryKey: ["users", "search", debouncedSearch],
    queryFn: () => api.get<SearchResult[]>(`/users/search?q=${encodeURIComponent(debouncedSearch)}`),
    enabled: debouncedSearch.length > 0,
    staleTime: 10_000,
  });

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
    queryFn: () => api.get<CourseListWithItems[]>(`/friends/${viewingFriendId}/courses`),
    enabled: viewingFriendId !== null,
  });

  const acceptRequest = useMutation({
    mutationFn: (friendshipId: number) => api.post(`/friends/${friendshipId}/accept`),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["friends"] }),
        queryClient.invalidateQueries({ queryKey: ["friends", "pending"] }),
      ]),
  });

  const declineRequest = useMutation({
    mutationFn: (friendshipId: number) => api.post(`/friends/${friendshipId}/decline`),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["friends"] }),
        queryClient.invalidateQueries({ queryKey: ["friends", "pending"] }),
      ]),
  });

  const removeFriend = useMutation({
    mutationFn: (friendshipId: number) => api.delete(`/friends/${friendshipId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["friends"] }),
  });

  function openProfile(result: SearchResult) {
    setViewingProfile(result as unknown as User);
    setSearchOpen(false);
    setSearchInput("");
  }

  function isFriendWith(userId: string) {
    return (friends ?? []).some((f) => f.user.id === userId);
  }

  function hasPendingWith(userId: string) {
    return (pending ?? []).some((p) => p.user.id === userId);
  }

  const showDropdown = searchOpen && debouncedSearch.length > 0;

  return (
    <div className="max-w-4xl mx-auto p-6" data-tour-id="friends-add-list">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Friends</h1>

      {/* Find Users — suggestive search */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6" data-tour-id="friends-add-form">
        <h3 className="font-medium text-gray-900 mb-2">Find Users</h3>
        <div ref={searchRef} className="relative">
          <div className="relative">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Search by name or @username"
              className="w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500 pr-8"
            />
            {searching && (
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                <div className="w-3.5 h-3.5 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          {showDropdown && (
            <div className="absolute z-[75] mt-1 w-full bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden ba-dropdown-pop">
              {!searchResults || searchResults.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-500">
                  {searching ? "Searching..." : "No users found"}
                </div>
              ) : (
                <ul>
                  {searchResults.map((result) => (
                    <li key={result.id}>
                      <button
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => openProfile(result)}
                      >
                        {result.avatarUrl ? (
                          <img
                            src={result.avatarUrl}
                            alt={result.fullName}
                            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-bold flex-shrink-0">
                            {getInitials(result.fullName)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {result.fullName}
                            {isFriendWith(result.id) && (
                              <span className="ml-1.5 text-xs text-primary-600 font-normal">friends</span>
                            )}
                            {hasPendingWith(result.id) && (
                              <span className="ml-1.5 text-xs text-amber-600 font-normal">pending</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            @{result.username}
                            {result.major && ` · ${result.major}`}
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Pending requests */}
      {pending && pending.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Pending Requests</h2>
          <div className="space-y-2">
            {pending.map((p) => (
              <div
                key={p.friendshipId}
                className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between"
              >
                <button
                  className="text-left"
                  onClick={() => setViewingProfile(p.user as unknown as User)}
                >
                  <span className="font-medium text-gray-900 hover:text-primary-600">
                    @{p.user.username}
                  </span>
                  <span className="text-xs text-gray-500 ml-2">{p.user.fullName}</span>
                  {p.user.major && (
                    <span className="text-xs text-gray-500 ml-2">{p.user.major}</span>
                  )}
                </button>
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
        <h2 className="text-lg font-semibold text-gray-900 mb-3">My Friends</h2>
        {loadingFriends ? (
          <div className="animate-pulse space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-200 rounded-lg" />
            ))}
          </div>
        ) : friends?.length === 0 ? (
          <p className="text-sm text-gray-500">No friends yet. Send a friend request to get started!</p>
        ) : (
          <div className="space-y-2">
            {friends?.map((f) => (
              <FriendCard
                key={f.friendshipId}
                friend={f}
                onViewProfile={() => setViewingProfile(f.user as unknown as User)}
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
              {friends?.find((f) => f.user.id === viewingFriendId)?.user.username
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
            <p className="text-sm text-gray-500">No public course lists.</p>
          ) : (
            <div className="space-y-3">
              {friendCourses?.map((list) => (
                <CourseListCard key={list.id} list={list} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* User Profile Modal */}
      {viewingProfile && (
        <UserProfileModal
          user={viewingProfile}
          isFriend={isFriendWith(viewingProfile.id)}
          hasPendingRequest={hasPendingWith(viewingProfile.id)}
          onClose={() => setViewingProfile(null)}
        />
      )}
    </div>
  );
}
