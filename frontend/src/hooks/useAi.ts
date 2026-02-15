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

export type AiCourseRecommendationsRequest =
  | { prompt: string; reset?: boolean; excludeCourseIds?: number[] }
  | { messages: AiMessage[]; reset?: boolean; excludeCourseIds?: number[] }
  | { reset: true };

export function useAiCourseRecommendations() {
  return useMutation({
    mutationFn: (body: AiCourseRecommendationsRequest) =>
      api.post<AiCourseRecommendationsResponse>("/ai/course-recommendations", body),
  });
}
