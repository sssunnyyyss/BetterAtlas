import type { IntentMode } from "../intent/intentRouter.js";
import type { AiCourseFilters } from "../grounding/filterConstraintGuard.js";
import type { RankedCandidate } from "../relevance/rankingPolicy.js";
import type { RetrievalMode } from "../relevance/retrievalModePolicy.js";

type AiDebugRetrievalMode = "none" | RetrievalMode;
type AiDebugGroundingStatus = "not_applicable" | "passed" | "failed";

const RETRIEVAL_MODES: readonly AiDebugRetrievalMode[] = [
  "none",
  "lexical_only",
  "hybrid",
  "hybrid_degraded",
];

const GROUNDING_STATUSES: readonly AiDebugGroundingStatus[] = [
  "not_applicable",
  "passed",
  "failed",
];

export type RankingTopBreakdownEntry = {
  rank: number;
  courseId: number;
  courseCode: string;
  courseTitle: string;
  baseRelevance: number;
  preference: number;
  trainer: number;
  final: number;
};

export type AiDebugDiagnostics = {
  intentMode: IntentMode;
  intentReason: string;
  retrievalSkipped: boolean;
  retrievalMode: AiDebugRetrievalMode;
  semanticAttempted: boolean;
  semanticAvailable: boolean;
  lexicalCount: number;
  semanticCount: number;
  model: string | null;
  totalMs: number | null;
  depsMs: number | null;
  candidatesMs: number | null;
  embedMs: number | null;
  semanticMs: number | null;
  openaiMs: number | null;
  searchTerms: string[];
  candidateCount: number;
  hadFillers: boolean;
  userMajor: string | null;
  deptCode: string | null;
  searchUniqueCount: number;
  semanticUniqueCount: number;
  semanticCandidateCount: number;
  candidatesWithDescription: number;
  deptCounts: Record<string, number>;
  candidateComposition: {
    totalCandidates: number;
    searchUniqueCount: number;
    semanticUniqueCount: number;
    semanticCandidateCount: number;
    withDescriptionCount: number;
    byDepartment: Record<string, number>;
  };
  appliedFilters: AiCourseFilters;
  likedSignals: number;
  dislikedSignals: number;
  trainerScoresLoaded: number;
  trainerBoostedCount: number;
  trainerDemotedCount: number;
  usedJsonFallback: boolean;
  groundingStatus: AiDebugGroundingStatus;
  groundingViolationCount: number;
  excludedMentionCount: number;
  blockedCourseCount: number;
  safeFallbackUsed: boolean;
  filterConstraintDroppedCount: number;
  filterEvidence: {
    droppedCount: number;
    constraintFallbackTriggered: boolean;
    constraintsActive: boolean;
  };
  concentrationAllowed: boolean | null;
  lowRelevanceRefineUsed: boolean;
  relevanceGateEligible: boolean | null;
  matchedTermCoverage: number | null;
  relevanceSufficient: boolean | null;
  rankingTopBreakdown: RankingTopBreakdownEntry[];
};

type BuildAiDebugDiagnosticsInput = {
  intentMode: IntentMode;
  intentReason: string;
  retrievalSkipped: boolean;
  retrieval?: Partial<{
    retrievalMode: AiDebugRetrievalMode;
    semanticAttempted: boolean;
    semanticAvailable: boolean;
    lexicalCount: number;
    semanticCount: number;
  }>;
  timings?: Partial<{
    model: string | null;
    totalMs: number;
    depsMs: number;
    candidatesMs: number;
    embedMs: number;
    semanticMs: number;
    openaiMs: number;
  }>;
  candidateComposition?: Partial<{
    candidateCount: number;
    hadFillers: boolean;
    userMajor: string | null;
    deptCode: string | null;
    searchUniqueCount: number;
    semanticUniqueCount: number;
    semanticCandidateCount: number;
    candidatesWithDescription: number;
    deptCounts: Record<string, number>;
  }>;
  query?: Partial<{
    searchTerms: string[];
  }>;
  preferenceSignals?: Partial<{
    appliedFilters: AiCourseFilters;
    likedSignals: number;
    dislikedSignals: number;
  }>;
  trainerSignals?: Partial<{
    trainerScoresLoaded: number;
    trainerBoostedCount: number;
    trainerDemotedCount: number;
  }>;
  grounding?: Partial<{
    status: AiDebugGroundingStatus;
    violationCount: number;
    excludedMentionCount: number;
    blockedCourseCount: number;
  }>;
  outcome?: Partial<{
    usedJsonFallback: boolean;
    safeFallbackUsed: boolean;
    lowRelevanceRefineUsed: boolean;
    concentrationAllowed: boolean | null;
  }>;
  relevanceGate?: Partial<{
    eligible: boolean | null;
    matchedTermCoverage: number | null;
    sufficient: boolean | null;
  }>;
  filterEnforcement?: Partial<{
    droppedCount: number;
    constraintFallbackTriggered: boolean;
    constraintsActive: boolean;
  }>;
  rankingTopBreakdown?: RankingTopBreakdownEntry[];
};

function toFiniteNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toNullableFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toOptionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function normalizeRetrievalMode(value: unknown): AiDebugRetrievalMode {
  return RETRIEVAL_MODES.includes(value as AiDebugRetrievalMode)
    ? (value as AiDebugRetrievalMode)
    : "none";
}

function normalizeGroundingStatus(value: unknown): AiDebugGroundingStatus {
  return GROUNDING_STATUSES.includes(value as AiDebugGroundingStatus)
    ? (value as AiDebugGroundingStatus)
    : "not_applicable";
}

function hasActiveAiFilters(filters: AiCourseFilters): boolean {
  return Boolean(
    filters.semester ||
      filters.department ||
      filters.minRating ||
      filters.credits ||
      filters.attributes ||
      filters.instructor ||
      filters.campus ||
      filters.componentType ||
      filters.instructionMethod
  );
}

function sanitizeDeptCounts(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, number> = {};
  for (const [key, count] of Object.entries(value as Record<string, unknown>)) {
    out[key] = toFiniteNumber(count);
  }
  return out;
}

export function buildRankingTopBreakdown(input: {
  rankedCandidates: RankedCandidate[];
  limit?: number;
}): RankingTopBreakdownEntry[] {
  const limit = Math.max(0, Math.trunc(toFiniteNumber(input.limit, 5)));
  if (limit === 0) return [];

  return input.rankedCandidates.slice(0, limit).map((candidate, index) => ({
    rank: index + 1,
    courseId: candidate.course.id,
    courseCode: candidate.course.code,
    courseTitle: candidate.course.title,
    baseRelevance: toFiniteNumber(candidate.scores.baseRelevance),
    preference: toFiniteNumber(candidate.scores.preference),
    trainer: toFiniteNumber(candidate.scores.trainer),
    final: toFiniteNumber(candidate.scores.final),
  }));
}

export function buildAiDebugDiagnostics(input: BuildAiDebugDiagnosticsInput): AiDebugDiagnostics {
  const appliedFilters = input.preferenceSignals?.appliedFilters ?? {};
  const filterDroppedCount = toFiniteNumber(input.filterEnforcement?.droppedCount);
  const constraintsActive =
    typeof input.filterEnforcement?.constraintsActive === "boolean"
      ? input.filterEnforcement.constraintsActive
      : hasActiveAiFilters(appliedFilters);
  const constraintFallbackTriggered = Boolean(
    input.filterEnforcement?.constraintFallbackTriggered
  );
  const deptCounts = sanitizeDeptCounts(input.candidateComposition?.deptCounts);

  return {
    intentMode: input.intentMode,
    intentReason: input.intentReason,
    retrievalSkipped: Boolean(input.retrievalSkipped),
    retrievalMode: normalizeRetrievalMode(input.retrieval?.retrievalMode),
    semanticAttempted: Boolean(input.retrieval?.semanticAttempted),
    semanticAvailable: Boolean(input.retrieval?.semanticAvailable),
    lexicalCount: toFiniteNumber(input.retrieval?.lexicalCount),
    semanticCount: toFiniteNumber(input.retrieval?.semanticCount),
    model: toOptionalString(input.timings?.model),
    totalMs: toNullableFiniteNumber(input.timings?.totalMs),
    depsMs: toNullableFiniteNumber(input.timings?.depsMs),
    candidatesMs: toNullableFiniteNumber(input.timings?.candidatesMs),
    embedMs: toNullableFiniteNumber(input.timings?.embedMs),
    semanticMs: toNullableFiniteNumber(input.timings?.semanticMs),
    openaiMs: toNullableFiniteNumber(input.timings?.openaiMs),
    searchTerms: Array.isArray(input.query?.searchTerms)
      ? input.query.searchTerms.map((term) => String(term))
      : [],
    candidateCount: toFiniteNumber(input.candidateComposition?.candidateCount),
    hadFillers: Boolean(input.candidateComposition?.hadFillers),
    userMajor: toOptionalString(input.candidateComposition?.userMajor),
    deptCode: toOptionalString(input.candidateComposition?.deptCode),
    searchUniqueCount: toFiniteNumber(input.candidateComposition?.searchUniqueCount),
    semanticUniqueCount: toFiniteNumber(input.candidateComposition?.semanticUniqueCount),
    semanticCandidateCount: toFiniteNumber(input.candidateComposition?.semanticCandidateCount),
    candidatesWithDescription: toFiniteNumber(input.candidateComposition?.candidatesWithDescription),
    deptCounts,
    candidateComposition: {
      totalCandidates: toFiniteNumber(input.candidateComposition?.candidateCount),
      searchUniqueCount: toFiniteNumber(input.candidateComposition?.searchUniqueCount),
      semanticUniqueCount: toFiniteNumber(input.candidateComposition?.semanticUniqueCount),
      semanticCandidateCount: toFiniteNumber(input.candidateComposition?.semanticCandidateCount),
      withDescriptionCount: toFiniteNumber(input.candidateComposition?.candidatesWithDescription),
      byDepartment: deptCounts,
    },
    appliedFilters,
    likedSignals: toFiniteNumber(input.preferenceSignals?.likedSignals),
    dislikedSignals: toFiniteNumber(input.preferenceSignals?.dislikedSignals),
    trainerScoresLoaded: toFiniteNumber(input.trainerSignals?.trainerScoresLoaded),
    trainerBoostedCount: toFiniteNumber(input.trainerSignals?.trainerBoostedCount),
    trainerDemotedCount: toFiniteNumber(input.trainerSignals?.trainerDemotedCount),
    usedJsonFallback: Boolean(input.outcome?.usedJsonFallback),
    groundingStatus: normalizeGroundingStatus(input.grounding?.status),
    groundingViolationCount: toFiniteNumber(input.grounding?.violationCount),
    excludedMentionCount: toFiniteNumber(input.grounding?.excludedMentionCount),
    blockedCourseCount: toFiniteNumber(input.grounding?.blockedCourseCount),
    safeFallbackUsed: Boolean(input.outcome?.safeFallbackUsed),
    filterConstraintDroppedCount: filterDroppedCount,
    filterEvidence: {
      droppedCount: filterDroppedCount,
      constraintFallbackTriggered,
      constraintsActive,
    },
    concentrationAllowed:
      typeof input.outcome?.concentrationAllowed === "boolean"
        ? input.outcome.concentrationAllowed
        : null,
    lowRelevanceRefineUsed: Boolean(input.outcome?.lowRelevanceRefineUsed),
    relevanceGateEligible:
      typeof input.relevanceGate?.eligible === "boolean" ? input.relevanceGate.eligible : null,
    matchedTermCoverage: toNullableFiniteNumber(input.relevanceGate?.matchedTermCoverage),
    relevanceSufficient:
      typeof input.relevanceGate?.sufficient === "boolean"
        ? input.relevanceGate.sufficient
        : null,
    rankingTopBreakdown: Array.isArray(input.rankingTopBreakdown)
      ? input.rankingTopBreakdown
      : [],
  };
}
