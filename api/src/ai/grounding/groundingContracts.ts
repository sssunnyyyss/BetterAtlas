import type { CourseWithRatings } from "@betteratlas/shared";

export type GroundingValidationInput = {
  assistantMessage: string;
  candidates: CourseWithRatings[];
  blockedCourseIds: Set<number>;
};

export type GroundingViolation = {
  kind: "unknown_mention" | "blocked_mention";
  text: string;
};

export type GroundingValidationResult = {
  ok: boolean;
  violations: GroundingViolation[];
  matchedCandidateIds: number[];
};
