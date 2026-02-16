import { useMutation } from "@tanstack/react-query";
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
