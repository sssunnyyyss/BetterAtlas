import type { CourseWithRatings } from "@betteratlas/shared";

export const DEFAULT_PREFERENCE_CONTRIBUTION_CAP = 2;
export const DEFAULT_TRAINER_CONTRIBUTION_CAP = 1;

export type RankedCandidate = {
  course: CourseWithRatings;
  index: number;
  scores: {
    baseRelevance: number;
    preference: number;
    trainer: number;
    final: number;
  };
};

function toFiniteNumber(value: number | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

export function clampContribution(value: number, min: number, max: number): number {
  const numericValue = toFiniteNumber(value);
  const lower = Math.min(min, max);
  const upper = Math.max(min, max);
  return Math.min(upper, Math.max(lower, numericValue));
}

function compareTieBreakers(a: RankedCandidate, b: RankedCandidate): number {
  if (a.index !== b.index) {
    return a.index - b.index;
  }

  const codeCompare = a.course.code.localeCompare(b.course.code);
  if (codeCompare !== 0) {
    return codeCompare;
  }

  return a.course.id - b.course.id;
}

export function rankCandidatesWithBoundedSignals(input: {
  courses: CourseWithRatings[];
  baseRelevance: Map<number, number>;
  preferenceScores: Map<number, number>;
  trainerScores: Map<number, number>;
}): RankedCandidate[] {
  const ranked = input.courses.map((course, index) => {
    const baseRelevance = toFiniteNumber(input.baseRelevance.get(course.id));
    const preference = clampContribution(
      toFiniteNumber(input.preferenceScores.get(course.id)),
      -DEFAULT_PREFERENCE_CONTRIBUTION_CAP,
      DEFAULT_PREFERENCE_CONTRIBUTION_CAP
    );
    const trainer = clampContribution(
      toFiniteNumber(input.trainerScores.get(course.id)),
      -DEFAULT_TRAINER_CONTRIBUTION_CAP,
      DEFAULT_TRAINER_CONTRIBUTION_CAP
    );

    return {
      course,
      index,
      scores: {
        baseRelevance,
        preference,
        trainer,
        final: baseRelevance + preference + trainer,
      },
    };
  });

  return ranked.sort(
    (a, b) =>
      b.scores.final - a.scores.final ||
      b.scores.baseRelevance - a.scores.baseRelevance ||
      compareTieBreakers(a, b)
  );
}
