import type { CourseWithRatings } from "@betteratlas/shared";
import { describe, expect, it } from "vitest";
import {
  selectWithDepartmentDiversity,
  shouldAllowDepartmentConcentration,
} from "./diversityPolicy.js";

function buildCourse(overrides: Partial<CourseWithRatings>): CourseWithRatings {
  const department =
    overrides.department ??
    ({
      id: 1,
      code: "CS",
      name: "Computer Science",
    } as const);

  return {
    id: overrides.id ?? 1,
    code: overrides.code ?? "CS 170",
    title: overrides.title ?? "Intro to Computer Science",
    description: overrides.description ?? "Catalog description",
    prerequisites: overrides.prerequisites ?? null,
    credits: overrides.credits ?? 3,
    departmentId: overrides.departmentId ?? department.id,
    attributes: overrides.attributes ?? null,
    department: department ?? null,
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

function buildCandidate(
  id: number,
  code: string,
  departmentCode: string
): { course: CourseWithRatings; marker: string } {
  return {
    marker: code,
    course: buildCourse({
      id,
      code,
      department: {
        id,
        code: departmentCode,
        name: departmentCode,
      },
    }),
  };
}

describe("diversityPolicy", () => {
  it("enforces per-department caps when ranked options allow spread", () => {
    const ranked = [
      buildCandidate(1, "CS 170", "CS"),
      buildCandidate(2, "CS 171", "CS"),
      buildCandidate(3, "QTM 110", "QTM"),
      buildCandidate(4, "HIST 101", "HIST"),
    ];

    const selected = selectWithDepartmentDiversity({
      ranked,
      targetCount: 3,
      maxPerDepartment: 1,
      concentrationAllowed: false,
    });

    expect(selected.map((item) => item.marker)).toEqual([
      "CS 170",
      "QTM 110",
      "HIST 101",
    ]);
  });

  it("backfills deterministically when strict caps would under-fill target count", () => {
    const ranked = [
      buildCandidate(1, "CS 170", "CS"),
      buildCandidate(2, "CS 171", "CS"),
      buildCandidate(3, "CS 172", "CS"),
    ];

    const selected = selectWithDepartmentDiversity({
      ranked,
      targetCount: 3,
      maxPerDepartment: 1,
      concentrationAllowed: false,
    });

    expect(selected.map((item) => item.marker)).toEqual([
      "CS 170",
      "CS 171",
      "CS 172",
    ]);
  });

  it("bypasses caps when concentration is explicitly allowed", () => {
    const ranked = [
      buildCandidate(1, "CS 170", "CS"),
      buildCandidate(2, "CS 171", "CS"),
      buildCandidate(3, "QTM 110", "QTM"),
    ];

    const selected = selectWithDepartmentDiversity({
      ranked,
      targetCount: 2,
      maxPerDepartment: 1,
      concentrationAllowed: true,
    });

    expect(selected.map((item) => item.marker)).toEqual([
      "CS 170",
      "CS 171",
    ]);
  });

  it("detects concentration allowance from filters, intent signals, and pool shape", () => {
    expect(
      shouldAllowDepartmentConcentration({
        filters: { department: "CS" },
      })
    ).toBe(true);

    expect(
      shouldAllowDepartmentConcentration({
        filters: {},
        intentSignals: ["single_department_request"],
      })
    ).toBe(true);

    expect(
      shouldAllowDepartmentConcentration({
        filters: {},
        intentSignals: [],
        rankedDepartmentCodes: ["CS", "CS", "CS"],
      })
    ).toBe(true);

    expect(
      shouldAllowDepartmentConcentration({
        filters: {},
        intentSignals: [],
        rankedDepartmentCodes: ["CS", "QTM"],
      })
    ).toBe(false);
  });
});
