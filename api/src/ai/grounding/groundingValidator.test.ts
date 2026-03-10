import type { CourseWithRatings } from "@betteratlas/shared";
import { describe, expect, it } from "vitest";
import { validateAssistantGrounding } from "./groundingValidator.js";

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
    department: overrides.department ?? { id: 1, code: "CS", name: "Computer Science" },
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

describe("validateAssistantGrounding", () => {
  it("passes grounded code/title mentions including code-format variants", () => {
    const candidates: CourseWithRatings[] = [
      buildCourse({
        id: 170,
        code: "CS 170",
        title: "Intro to Computer Science",
      }),
      buildCourse({
        id: 110,
        code: "QTM 110",
        title: "Introduction to Statistical Computing",
        department: { id: 2, code: "QTM", name: "Quantitative Theory and Methods" },
      }),
    ];

    const result = validateAssistantGrounding({
      assistantMessage:
        "I recommend CS-170 for fundamentals, and qtm110 plus introduction to statistical computing for data work.",
      candidates,
      blockedCourseIds: new Set<number>(),
    });

    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.matchedCandidateIds).toEqual([110, 170]);
  });

  it("fails with unknown_mention for fabricated off-catalog course codes", () => {
    const candidates: CourseWithRatings[] = [
      buildCourse({
        id: 170,
        code: "CS 170",
        title: "Intro to Computer Science",
      }),
    ];

    const result = validateAssistantGrounding({
      assistantMessage: "You should take MATH 999 next semester.",
      candidates,
      blockedCourseIds: new Set<number>(),
    });

    expect(result.ok).toBe(false);
    expect(result.violations).toEqual([{ kind: "unknown_mention", text: "MATH 999" }]);
    expect(result.matchedCandidateIds).toEqual([]);
  });

  it("fails with unknown_mention for fabricated title-only course mentions", () => {
    const candidates: CourseWithRatings[] = [
      buildCourse({
        id: 170,
        code: "CS 170",
        title: "Intro to Computer Science",
      }),
    ];

    const result = validateAssistantGrounding({
      assistantMessage: "You should take Quantum Basket Weaving next semester.",
      candidates,
      blockedCourseIds: new Set<number>(),
    });

    expect(result.ok).toBe(false);
    expect(result.violations).toEqual([{ kind: "unknown_mention", text: "Quantum Basket Weaving" }]);
    expect(result.matchedCandidateIds).toEqual([]);
  });

  it("fails with blocked_mention when candidate mentions map to blocked ids", () => {
    const candidates: CourseWithRatings[] = [
      buildCourse({
        id: 170,
        code: "CS 170",
        title: "Intro to Computer Science",
      }),
    ];

    const result = validateAssistantGrounding({
      assistantMessage: "CS170 is a strong fit for your request.",
      candidates,
      blockedCourseIds: new Set<number>([170]),
    });

    expect(result.ok).toBe(false);
    expect(result.violations).toEqual([{ kind: "blocked_mention", text: "CS170" }]);
    expect(result.matchedCandidateIds).toEqual([]);
  });

  it("returns deterministic results for repeated equivalent assistant outputs", () => {
    const candidates: CourseWithRatings[] = [
      buildCourse({
        id: 170,
        code: "CS 170",
        title: "Intro to Computer Science",
      }),
      buildCourse({
        id: 111,
        code: "QTM 111",
        title: "Statistical Inference I",
        department: { id: 2, code: "QTM", name: "Quantitative Theory and Methods" },
      }),
    ];

    const input = {
      assistantMessage:
        "Consider CS 170 and statistical inference i if you want an analytic sequence.",
      candidates,
      blockedCourseIds: new Set<number>(),
    };

    const first = validateAssistantGrounding(input);
    const second = validateAssistantGrounding(input);

    expect(first).toEqual(second);
    expect(first).toEqual({
      ok: true,
      violations: [],
      matchedCandidateIds: [111, 170],
    });
  });

  it("does not classify generic recommendation phrasing as title-like mentions", () => {
    const candidates: CourseWithRatings[] = [
      buildCourse({
        id: 170,
        code: "CS 170",
        title: "Intro to Computer Science",
      }),
    ];

    const result = validateAssistantGrounding({
      assistantMessage: "I can recommend options that fit your interests and schedule.",
      candidates,
      blockedCourseIds: new Set<number>(),
    });

    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.matchedCandidateIds).toEqual([]);
  });
});
