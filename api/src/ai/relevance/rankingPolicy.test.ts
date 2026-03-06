import type { CourseWithRatings } from "@betteratlas/shared";
import { describe, expect, it } from "vitest";
import {
  clampContribution,
  rankCandidatesWithBoundedSignals,
} from "./rankingPolicy.js";

function buildCourse(overrides: Partial<CourseWithRatings>): CourseWithRatings {
  return {
    id: overrides.id ?? 1,
    code: overrides.code ?? "CS 170",
    title: overrides.title ?? "Intro to Computer Science",
    description: overrides.description ?? "Catalog description",
    prerequisites: overrides.prerequisites ?? null,
    credits: overrides.credits ?? 3,
    departmentId: overrides.departmentId ?? 1,
    attributes: overrides.attributes ?? null,
    department: overrides.department ?? {
      id: 1,
      code: "CS",
      name: "Computer Science",
    },
    avgQuality: overrides.avgQuality ?? 4,
    avgDifficulty: overrides.avgDifficulty ?? 3,
    avgWorkload: overrides.avgWorkload ?? 3,
    reviewCount: overrides.reviewCount ?? 10,
    instructors: overrides.instructors ?? ["Ada Lovelace"],
    gers: overrides.gers ?? ["QR"],
    campuses: overrides.campuses ?? ["Atlanta"],
    requirements: overrides.requirements ?? null,
  };
}

describe("rankingPolicy", () => {
  it("clamps preference and trainer contributions into hard bounded ranges", () => {
    const courses = [buildCourse({ id: 1, code: "CS 170" })];

    const ranked = rankCandidatesWithBoundedSignals({
      courses,
      baseRelevance: new Map([[1, 3]]),
      preferenceScores: new Map([[1, 99]]),
      trainerScores: new Map([[1, -42]]),
    });

    expect(ranked).toHaveLength(1);
    expect(ranked[0].scores.baseRelevance).toBe(3);
    expect(ranked[0].scores.preference).toBe(2);
    expect(ranked[0].scores.trainer).toBe(-1);
    expect(ranked[0].scores.final).toBe(4);
  });

  it("keeps base relevance dominant when non-base signals are weak", () => {
    const highBase = buildCourse({ id: 1, code: "HIST 101" });
    const lowBase = buildCourse({ id: 2, code: "CS 170" });

    const ranked = rankCandidatesWithBoundedSignals({
      courses: [lowBase, highBase],
      baseRelevance: new Map([
        [1, 8],
        [2, 5],
      ]),
      preferenceScores: new Map([[2, 0.4]]),
      trainerScores: new Map([[2, 0.2]]),
    });

    expect(ranked.map((candidate) => candidate.course.id)).toEqual([1, 2]);
    expect(ranked[0].scores.final).toBeGreaterThan(ranked[1].scores.final);
  });

  it("is deterministic for tie scores using stable input ordering", () => {
    const courseA = buildCourse({ id: 10, code: "QTM 110" });
    const courseB = buildCourse({ id: 11, code: "CS 170" });

    const input = {
      courses: [courseA, courseB],
      baseRelevance: new Map<number, number>(),
      preferenceScores: new Map<number, number>(),
      trainerScores: new Map<number, number>(),
    };

    const first = rankCandidatesWithBoundedSignals(input);
    const second = rankCandidatesWithBoundedSignals(input);

    expect(first.map((candidate) => candidate.course.id)).toEqual([10, 11]);
    expect(second).toEqual(first);
  });

  it("clampContribution normalizes swapped min/max bounds", () => {
    expect(clampContribution(3, 5, 1)).toBe(3);
    expect(clampContribution(9, 5, 1)).toBe(5);
    expect(clampContribution(-4, -2, -8)).toBe(-4);
  });
});
