import { describe, expect, it } from "vitest";
import {
  buildLowRelevanceRefineGuidance,
  isRelevanceSufficient,
} from "./relevanceSufficiencyPolicy.js";

describe("relevanceSufficiencyPolicy", () => {
  it("rejects weak candidate pools with no meaningful term coverage", () => {
    const ok = isRelevanceSufficient({
      rankedBaseScores: [0.4, 0.3, 0.2],
      matchedTermCoverage: 0,
      retrievalMode: "lexical_only",
    });

    expect(ok).toBe(false);
  });

  it("accepts clearly relevant pools when top-k scores and coverage are strong", () => {
    const ok = isRelevanceSufficient({
      rankedBaseScores: [2.3, 1.9, 1.4, 1.2, 0.8],
      matchedTermCoverage: 0.55,
      retrievalMode: "hybrid",
    });

    expect(ok).toBe(true);
  });

  it("keeps degraded retrieval stricter on low-coverage borderline pools", () => {
    const ok = isRelevanceSufficient({
      rankedBaseScores: [1.7, 1.4, 1.1, 0.8],
      matchedTermCoverage: 0.3,
      retrievalMode: "hybrid_degraded",
    });

    expect(ok).toBe(false);
  });

  it("returns deterministic refine-guidance shape for low relevance responses", () => {
    const first = buildLowRelevanceRefineGuidance({
      retrievalMode: "hybrid_degraded",
      matchedTermCoverage: 0.1,
    });
    const second = buildLowRelevanceRefineGuidance({
      retrievalMode: "hybrid_degraded",
      matchedTermCoverage: 0.1,
    });

    expect(first).toEqual(second);
    expect(first).toEqual({
      assistantMessage:
        "I found only weak partial matches this turn. Add one or two specifics and I can refine the list.",
      followUpQuestion:
        "Could you share a preferred department, GER, semester, instructor, or workload target?",
      recommendations: [],
    });
  });
});
