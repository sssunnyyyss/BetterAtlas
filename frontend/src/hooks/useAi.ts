import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client.js";
import type { CourseWithRatings } from "@betteratlas/shared";

export type AiMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AiCourseRecommendation = {
  course: CourseWithRatings;
  fitScore: number;
  why: string[];
  cautions: string[];
};

export type AiCourseRecommendationsResponse = {
  assistantMessage: string;
  followUpQuestion: string | null;
  recommendations: AiCourseRecommendation[];
};

export type AiRecommendationFilters = {
  semester?: string;
  department?: string;
  minRating?: number;
  credits?: number;
  attributes?: string;
  instructor?: string;
  campus?: string;
  componentType?: string;
  instructionMethod?: string;
};

export type AiPreferenceCourse = {
  id: number;
  code: string;
  title: string;
  department?: string | null;
  gers?: string[];
  campuses?: string[];
  instructors?: string[];
  description?: string | null;
};

export type AiPreferenceSignals = {
  liked?: AiPreferenceCourse[];
  disliked?: AiPreferenceCourse[];
};

export type AiCourseRecommendationsRequest =
  | {
      prompt: string;
      reset?: boolean;
      excludeCourseIds?: number[];
      filters?: AiRecommendationFilters;
      preferences?: AiPreferenceSignals;
    }
  | {
      messages: AiMessage[];
      reset?: boolean;
      excludeCourseIds?: number[];
      filters?: AiRecommendationFilters;
      preferences?: AiPreferenceSignals;
    }
  | { reset: true };

export function useAiCourseRecommendations() {
  return useMutation({
    mutationFn: (body: AiCourseRecommendationsRequest) =>
      api.post<AiCourseRecommendationsResponse>("/ai/course-recommendations", body),
  });
}

// --- AI Trainer Ratings (admin-only, persisted to DB) ---

export type AiTrainerRating = {
  id: number;
  courseId: number;
  courseCode: string;
  courseTitle: string;
  rating: number; // +1 or -1
  createdAt: string;
  updatedAt: string;
};

export function useAiTrainerRatings() {
  return useQuery({
    queryKey: ["ai-trainer-ratings"],
    queryFn: () => api.get<AiTrainerRating[]>("/admin/ai-trainer/ratings"),
  });
}

export function useUpsertAiTrainerRating() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ courseId, rating, context }: { courseId: number; rating: number; context?: unknown }) =>
      api.put(`/admin/ai-trainer/ratings/${courseId}`, { rating, context }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-trainer-ratings"] });
    },
  });
}

export function useDeleteAiTrainerRating() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (courseId: number) =>
      api.delete(`/admin/ai-trainer/ratings/${courseId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-trainer-ratings"] });
    },
  });
}
