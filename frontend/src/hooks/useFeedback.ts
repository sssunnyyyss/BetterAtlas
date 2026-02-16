import { useMutation } from "@tanstack/react-query";
import { api } from "../api/client.js";
import type { CreateFeedbackInput, FeedbackSubmission } from "@betteratlas/shared";

export function useSubmitFeedback() {
  return useMutation({
    mutationFn: (data: CreateFeedbackInput) =>
      api.post<FeedbackSubmission>("/feedback", data),
  });
}
