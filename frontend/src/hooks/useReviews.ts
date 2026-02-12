import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client.js";
import type { ReviewWithAuthor, CreateReviewInput } from "@betteratlas/shared";

export function useReviews(courseId: number) {
  return useQuery({
    queryKey: ["reviews", courseId],
    queryFn: () => api.get<ReviewWithAuthor[]>(`/courses/${courseId}/reviews`),
    enabled: courseId > 0,
  });
}

export function useCreateReview(courseId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateReviewInput) =>
      api.post(`/courses/${courseId}/reviews`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews", courseId] });
      queryClient.invalidateQueries({ queryKey: ["course", courseId] });
    },
  });
}

export function useDeleteReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reviewId: number) => api.delete(`/reviews/${reviewId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
      queryClient.invalidateQueries({ queryKey: ["course"] });
    },
  });
}
