import type { RetrievalMode } from "./retrievalModePolicy.js";

const TOP_K = 4;

const MODE_THRESHOLDS: Record<
  RetrievalMode,
  {
    minTopKAvg: number;
    minCoverage: number;
    minStrongScores: number;
  }
> = {
  lexical_only: {
    minTopKAvg: 1.2,
    minCoverage: 0.34,
    minStrongScores: 2,
  },
  hybrid: {
    minTopKAvg: 1.0,
    minCoverage: 0.28,
    minStrongScores: 2,
  },
  hybrid_degraded: {
    minTopKAvg: 1.15,
    minCoverage: 0.34,
    minStrongScores: 2,
  },
};

export type LowRelevanceRefineGuidance = {
  assistantMessage: string;
  followUpQuestion: string;
  recommendations: [];
};

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function finiteScores(scores: number[]) {
  return scores.filter((value) => Number.isFinite(value));
}

export function isRelevanceSufficient(input: {
  rankedBaseScores: number[];
  matchedTermCoverage: number;
  retrievalMode: RetrievalMode;
}): boolean {
  const scores = finiteScores(input.rankedBaseScores);
  if (scores.length === 0) return false;

  const topScores = scores.slice(0, TOP_K);
  const topKAvg = topScores.reduce((sum, score) => sum + score, 0) / topScores.length;
  const strongScoreCount = topScores.filter((score) => score >= 1).length;
  const coverage = clamp01(input.matchedTermCoverage);
  const thresholds = MODE_THRESHOLDS[input.retrievalMode];

  return (
    topKAvg >= thresholds.minTopKAvg &&
    coverage >= thresholds.minCoverage &&
    strongScoreCount >= thresholds.minStrongScores
  );
}

export function buildLowRelevanceRefineGuidance(input: {
  retrievalMode: RetrievalMode;
  matchedTermCoverage: number;
}): LowRelevanceRefineGuidance {
  const coverage = clamp01(input.matchedTermCoverage);
  const degradedSemantic = input.retrievalMode === "hybrid_degraded";

  if (coverage < 0.2) {
    return {
      assistantMessage: degradedSemantic
        ? "I found only weak partial matches this turn. Add one or two specifics and I can refine the list."
        : "I could not find strong matches yet. Add one or two specifics and I can refine the list.",
      followUpQuestion:
        "Could you share a preferred department, GER, semester, instructor, or workload target?",
      recommendations: [],
    };
  }

  if (coverage < 0.45) {
    return {
      assistantMessage:
        "The current candidates are only loosely aligned, so I should narrow the request before recommending courses.",
      followUpQuestion:
        "Should I prioritize department focus, easier workload, specific instructors, or a GER requirement?",
      recommendations: [],
    };
  }

  return {
    assistantMessage:
      "I need one more constraint to improve relevance before returning recommendations.",
    followUpQuestion:
      "Want to narrow by semester, credits, instruction method, or campus?",
    recommendations: [],
  };
}
