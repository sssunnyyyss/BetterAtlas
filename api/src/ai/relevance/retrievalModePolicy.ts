import type { CourseWithRatings } from "@betteratlas/shared";

export type RetrievalMode = "lexical_only" | "hybrid" | "hybrid_degraded";

export type RetrievalEnvelope = {
  mode: RetrievalMode;
  lexicalCount: number;
  semanticCount: number;
  semanticAttempted: boolean;
  semanticAvailable: boolean;
};

type BuildRetrievalEnvelopeInput = {
  lexicalCount: number;
  semanticCount: number;
  semanticAvailable: boolean;
  semanticAttempted: boolean;
  semanticFailed: boolean;
};

type EnforceSemanticCandidateQuotaInput = {
  candidates: CourseWithRatings[];
  semanticRanked: CourseWithRatings[];
  semanticIds: Set<number>;
  excludeIds: Set<number>;
  maxCandidates: number;
  minSemantic: number;
};

function normalizeCount(value: number) {
  if (!Number.isFinite(value)) return 0;
  const asInt = Math.trunc(value);
  return asInt > 0 ? asInt : 0;
}

function normalizeLimit(value: number) {
  if (!Number.isFinite(value)) return 0;
  const asInt = Math.trunc(value);
  return asInt > 0 ? asInt : 0;
}

export function buildRetrievalEnvelope(input: BuildRetrievalEnvelopeInput): RetrievalEnvelope {
  const semanticAvailable = Boolean(input.semanticAvailable);
  const semanticAttempted = Boolean(input.semanticAttempted);
  const semanticFailed = Boolean(input.semanticFailed);

  const lexicalCount = normalizeCount(input.lexicalCount);
  const rawSemanticCount = normalizeCount(input.semanticCount);

  const semanticPathRan = semanticAvailable && semanticAttempted;
  const semanticSucceeded = semanticPathRan && !semanticFailed;

  let mode: RetrievalMode = "lexical_only";
  if (semanticSucceeded) {
    mode = "hybrid";
  } else if (semanticPathRan && semanticFailed) {
    mode = "hybrid_degraded";
  }

  return {
    mode,
    lexicalCount,
    semanticCount: semanticSucceeded ? rawSemanticCount : 0,
    semanticAttempted,
    semanticAvailable,
  };
}

export function enforceSemanticCandidateQuota(
  input: EnforceSemanticCandidateQuotaInput
): CourseWithRatings[] {
  const maxCandidates = normalizeLimit(input.maxCandidates);
  if (maxCandidates <= 0) return [];

  const minSemantic = normalizeLimit(input.minSemantic);
  const semanticIds = input.semanticIds;
  const excludeIds = input.excludeIds;

  const selected = input.candidates.slice(0, maxCandidates);
  if (semanticIds.size === 0 || minSemantic <= 0 || selected.length === 0) {
    return selected;
  }

  const target = Math.min(minSemantic, semanticIds.size, maxCandidates);
  let semanticCount = selected.filter((course) => semanticIds.has(course.id)).length;
  if (semanticCount >= target) return selected;

  const selectedIds = new Set<number>(selected.map((course) => course.id));
  const addableSemantic = input.semanticRanked
    .filter((course) => semanticIds.has(course.id))
    .filter((course) => !excludeIds.has(course.id))
    .filter((course) => !selectedIds.has(course.id));

  for (const semanticCourse of addableSemantic) {
    if (semanticCount >= target) break;

    if (selected.length < maxCandidates) {
      selected.push(semanticCourse);
      selectedIds.add(semanticCourse.id);
      semanticCount += 1;
      continue;
    }

    let replaceIndex = -1;
    for (let i = selected.length - 1; i >= 0; i -= 1) {
      if (!semanticIds.has(selected[i]!.id)) {
        replaceIndex = i;
        break;
      }
    }

    if (replaceIndex === -1) break;

    selectedIds.delete(selected[replaceIndex]!.id);
    selected[replaceIndex] = semanticCourse;
    selectedIds.add(semanticCourse.id);
    semanticCount += 1;
  }

  return selected.slice(0, maxCandidates);
}
