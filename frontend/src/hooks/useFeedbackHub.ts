import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  FeedbackHubBoard,
  FeedbackHubBoardCategoriesResponse,
  FeedbackHubBoardPostsResponse,
  FeedbackHubChangelogEntry,
  FeedbackHubPaginatedChangelog,
  FeedbackHubPaginatedPosts,
  FeedbackHubPostDetail,
  FeedbackHubPostStatus,
  FeedbackHubRoadmapColumn,
} from "@betteratlas/shared";
import { api } from "../api/client.js";

function withQuery(path: string, params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query.length > 0 ? `${path}?${query}` : path;
}

export function useFeedbackBoards() {
  return useQuery({
    queryKey: ["feedback-hub", "boards"],
    queryFn: () => api.get<FeedbackHubBoard[]>("/feedback-hub/boards"),
  });
}

export function useFeedbackBoardCategories(boardSlug: string) {
  return useQuery({
    queryKey: ["feedback-hub", "board-categories", boardSlug],
    queryFn: () =>
      api.get<FeedbackHubBoardCategoriesResponse>(`/feedback-hub/boards/${boardSlug}/categories`),
    enabled: boardSlug.length > 0,
  });
}

export function useFeedbackBoardPosts(
  boardSlug: string,
  params: {
    status?: FeedbackHubPostStatus;
    category?: string;
    sort?: "trending" | "top" | "new";
    q?: string;
    page?: number;
    limit?: number;
  }
) {
  return useQuery({
    queryKey: ["feedback-hub", "board-posts", boardSlug, params],
    queryFn: () =>
      api.get<FeedbackHubBoardPostsResponse>(
        withQuery(`/feedback-hub/boards/${boardSlug}/posts`, {
          status: params.status,
          category: params.category,
          sort: params.sort,
          q: params.q,
          page: params.page ?? 1,
          limit: params.limit ?? 20,
        })
      ),
    enabled: boardSlug.length > 0,
  });
}

export function useFeedbackPost(postId: number | null) {
  return useQuery({
    queryKey: ["feedback-hub", "post", postId],
    queryFn: () => api.get<FeedbackHubPostDetail>(`/feedback-hub/posts/${postId}`),
    enabled: typeof postId === "number" && postId > 0,
  });
}

export function useFeedbackRoadmap(limitPerStatus = 30) {
  return useQuery({
    queryKey: ["feedback-hub", "roadmap", limitPerStatus],
    queryFn: () =>
      api.get<FeedbackHubRoadmapColumn[]>(
        withQuery("/feedback-hub/roadmap", { limitPerStatus })
      ),
  });
}

export function useFeedbackChangelog(page = 1, limit = 20) {
  return useQuery({
    queryKey: ["feedback-hub", "changelog", page, limit],
    queryFn: () =>
      api.get<FeedbackHubPaginatedChangelog>(
        withQuery("/feedback-hub/changelog", { page, limit })
      ),
  });
}

export function useFeedbackSearch(q: string, page = 1, limit = 20) {
  return useQuery({
    queryKey: ["feedback-hub", "search", q, page, limit],
    queryFn: () =>
      api.get<FeedbackHubPaginatedPosts>(withQuery("/feedback-hub/search", { q, page, limit })),
    enabled: q.trim().length > 0,
  });
}

export function useSimilarFeedbackPosts(boardSlug: string, q: string) {
  return useQuery({
    queryKey: ["feedback-hub", "similar", boardSlug, q],
    queryFn: () =>
      api.get<Array<{ id: number; title: string; status: FeedbackHubPostStatus; score: number }>>(
        withQuery("/feedback-hub/similar", {
          boardSlug,
          q,
          limit: 5,
        })
      ),
    enabled: boardSlug.length > 0 && q.trim().length >= 3,
  });
}

export function useCreateFeedbackPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      boardSlug: string;
      categorySlug?: string;
      title: string;
      details?: string;
      authorMode?: "pseudonymous" | "linked_profile";
    }) => api.post<FeedbackHubPostDetail>("/feedback-hub/posts", data),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["feedback-hub", "board-posts", created.board.slug] });
      queryClient.invalidateQueries({ queryKey: ["feedback-hub", "roadmap"] });
      queryClient.invalidateQueries({ queryKey: ["feedback-hub", "boards"] });
    },
  });
}

export function useToggleFeedbackVote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId: number) => api.post<{ postId: number; voted: boolean; score: number }>(`/feedback-hub/posts/${postId}/vote`),
    onSuccess: (_result, postId) => {
      queryClient.invalidateQueries({ queryKey: ["feedback-hub", "post", postId] });
      queryClient.invalidateQueries({ queryKey: ["feedback-hub", "board-posts"] });
      queryClient.invalidateQueries({ queryKey: ["feedback-hub", "roadmap"] });
      queryClient.invalidateQueries({ queryKey: ["feedback-hub", "search"] });
      queryClient.invalidateQueries({ queryKey: ["feedback-hub", "admin-posts"] });
    },
  });
}

export function useCreateFeedbackComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { postId: number; body: string }) =>
      api.post(`/feedback-hub/posts/${input.postId}/comments`, { body: input.body }),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["feedback-hub", "post", variables.postId] });
      queryClient.invalidateQueries({ queryKey: ["feedback-hub", "board-posts"] });
      queryClient.invalidateQueries({ queryKey: ["feedback-hub", "admin-posts"] });
    },
  });
}

export function useAdminFeedbackPosts(params: {
  boardSlug?: string;
  status?: FeedbackHubPostStatus;
  q?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["feedback-hub", "admin-posts", params],
    queryFn: () =>
      api.get<FeedbackHubPaginatedPosts>(
        withQuery("/feedback-hub/admin/posts", {
          boardSlug: params.boardSlug,
          status: params.status,
          q: params.q,
          page: params.page ?? 1,
          limit: params.limit ?? 30,
        })
      ),
  });
}

export function useAdminUpdateFeedbackStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { postId: number; status: FeedbackHubPostStatus; note?: string }) =>
      api.patch<FeedbackHubPostDetail>(`/feedback-hub/admin/posts/${input.postId}/status`, {
        status: input.status,
        note: input.note,
      }),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["feedback-hub", "post", variables.postId] });
      queryClient.invalidateQueries({ queryKey: ["feedback-hub", "admin-posts"] });
      queryClient.invalidateQueries({ queryKey: ["feedback-hub", "board-posts"] });
      queryClient.invalidateQueries({ queryKey: ["feedback-hub", "roadmap"] });
    },
  });
}

export function useAdminDeleteFeedbackPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId: number) => api.delete<{ ok: true }>(`/feedback-hub/admin/posts/${postId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feedback-hub", "admin-posts"] });
      queryClient.invalidateQueries({ queryKey: ["feedback-hub", "board-posts"] });
      queryClient.invalidateQueries({ queryKey: ["feedback-hub", "roadmap"] });
      queryClient.invalidateQueries({ queryKey: ["feedback-hub", "search"] });
      queryClient.invalidateQueries({ queryKey: ["feedback-hub", "changelog"] });
    },
  });
}

export function useAdminCreateChangelog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; body: string; postIds: number[] }) =>
      api.post<FeedbackHubChangelogEntry>("/feedback-hub/admin/changelog", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feedback-hub", "changelog"] });
    },
  });
}
