import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client.js";
import type { ReviewWithAuthor, CreateReviewInput, UpdateReviewInput, UserReview } from "@betteratlas/shared";

export function useReviews(courseId: number) {
  return useQuery({
    queryKey: ["reviews", courseId],
    queryFn: () => api.get<ReviewWithAuthor[]>(`/courses/${courseId}/reviews`),
    enabled: courseId > 0,
  });
}

export function useMyReviews() {
  return useQuery({
    queryKey: ["myReviews"],
    queryFn: () => api.get<UserReview[]>("/users/me/reviews"),
  });
}

export function useSectionReviews(sectionId: number | null) {
  return useQuery({
    queryKey: ["sectionReviews", sectionId],
    queryFn: () => api.get<ReviewWithAuthor[]>(`/sections/${sectionId}/reviews`),
    enabled: typeof sectionId === "number" && sectionId > 0,
  });
}

export function useCreateReview(courseId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateReviewInput) =>
      api.post(`/courses/${courseId}/reviews`, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["reviews", courseId] });
      queryClient.invalidateQueries({ queryKey: ["course", courseId] });
      // Refresh the catalogue/search lists so ratings reflect immediately without a full reload.
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["professor"] });
      queryClient.invalidateQueries({ queryKey: ["myReviews"] });
      if (variables?.sectionId) {
        queryClient.invalidateQueries({ queryKey: ["sectionReviews", variables.sectionId] });
      }
    },
  });
}

export function useUpdateReview(courseId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (args: { reviewId: number; data: UpdateReviewInput; prevSectionId?: number | null }) =>
      api.patch(`/reviews/${args.reviewId}`, args.data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["reviews", courseId] });
      queryClient.invalidateQueries({ queryKey: ["course", courseId] });
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["professor"] });
      queryClient.invalidateQueries({ queryKey: ["myReviews"] });

      const nextSectionId = variables.data.sectionId ?? undefined;
      const prevSectionId = variables.prevSectionId ?? undefined;
      if (prevSectionId) queryClient.invalidateQueries({ queryKey: ["sectionReviews", prevSectionId] });
      if (nextSectionId) queryClient.invalidateQueries({ queryKey: ["sectionReviews", nextSectionId] });
    },
  });
}

export function useDeleteReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (args: { reviewId: number; courseId: number; sectionId?: number | null }) =>
      api.delete(`/reviews/${args.reviewId}`),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["reviews", variables.courseId] });
      queryClient.invalidateQueries({ queryKey: ["course", variables.courseId] });
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["professor"] });
      queryClient.invalidateQueries({ queryKey: ["myReviews"] });
      if (variables.sectionId) {
        queryClient.invalidateQueries({ queryKey: ["sectionReviews", variables.sectionId] });
      }
    },
  });
}
