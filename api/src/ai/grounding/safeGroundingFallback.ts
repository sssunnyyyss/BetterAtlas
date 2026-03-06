type SafeGroundingFallback = {
  assistantMessage: string;
  followUpQuestion: string | null;
  recommendations: [];
};

const SAFE_ASSISTANT_MESSAGE =
  "I want to keep suggestions aligned with your current filters and the catalog context. Share one priority, and I can refine from there.";
const SAFE_FOLLOW_UP_QUESTION = "What should I prioritize first?";

export function buildSafeGroundingFallback(): SafeGroundingFallback {
  return {
    assistantMessage: SAFE_ASSISTANT_MESSAGE,
    followUpQuestion: SAFE_FOLLOW_UP_QUESTION,
    recommendations: [],
  };
}
