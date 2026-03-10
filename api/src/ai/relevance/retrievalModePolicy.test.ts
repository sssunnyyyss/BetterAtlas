import type { CourseWithRatings } from "@betteratlas/shared";
import { describe, expect, it } from "vitest";
import {
  buildRetrievalEnvelope,
  enforceSemanticCandidateQuota,
} from "./retrievalModePolicy.js";

function buildCourse(id: number): CourseWithRatings {
  return {
    id,
    code: `TEST ${id}`,
    title: `Test Course ${id}`,
    description: "Test catalog description",
    prerequisites: null,
    credits: 3,
    departmentId: 1,
    attributes: null,
    department: { id: 1, code: "TEST", name: "Test Department" },
    avgQuality: 4,
    avgDifficulty: 3,
    avgWorkload: 3,
    reviewCount: 10,
    instructors: [],
    gers: [],
    campuses: [],
    requirements: null,
  };
}

describe("retrievalModePolicy", () => {
  it("returns lexical_only when semantic retrieval is unavailable", () => {
    const envelope = buildRetrievalEnvelope({
      lexicalCount: 12,
      semanticCount: 8,
      semanticAvailable: false,
      semanticAttempted: false,
      semanticFailed: false,
    });

    expect(envelope).toEqual({
      mode: "lexical_only",
      lexicalCount: 12,
      semanticCount: 0,
      semanticAttempted: false,
      semanticAvailable: false,
    });
  });

  it("returns hybrid when semantic retrieval ran successfully", () => {
    const envelope = buildRetrievalEnvelope({
      lexicalCount: 14,
      semanticCount: 6,
      semanticAvailable: true,
      semanticAttempted: true,
      semanticFailed: false,
    });

    expect(envelope).toEqual({
      mode: "hybrid",
      lexicalCount: 14,
      semanticCount: 6,
      semanticAttempted: true,
      semanticAvailable: true,
    });
  });

  it("returns hybrid_degraded when semantic retrieval was available but failed", () => {
    const envelope = buildRetrievalEnvelope({
      lexicalCount: 9,
      semanticCount: 5,
      semanticAvailable: true,
      semanticAttempted: true,
      semanticFailed: true,
    });

    expect(envelope).toEqual({
      mode: "hybrid_degraded",
      lexicalCount: 9,
      semanticCount: 0,
      semanticAttempted: true,
      semanticAvailable: true,
    });
  });

  it("enforces semantic quota with deterministic tail replacement ordering", () => {
    const candidates = [1, 2, 3, 4].map(buildCourse);
    const semanticRanked = [6, 4, 5].map(buildCourse);
    const semanticIds = new Set<number>([4, 5, 6]);

    const out = enforceSemanticCandidateQuota({
      candidates,
      semanticRanked,
      semanticIds,
      excludeIds: new Set<number>(),
      maxCandidates: 4,
      minSemantic: 2,
    });

    expect(out.map((course) => course.id)).toEqual([1, 2, 6, 4]);
  });

  it("does not add excluded semantic candidates during quota enforcement", () => {
    const candidates = [1, 2, 3, 4].map(buildCourse);
    const semanticRanked = [6, 5, 4].map(buildCourse);
    const semanticIds = new Set<number>([4, 5, 6]);

    const out = enforceSemanticCandidateQuota({
      candidates,
      semanticRanked,
      semanticIds,
      excludeIds: new Set<number>([6]),
      maxCandidates: 4,
      minSemantic: 2,
    });

    expect(out.map((course) => course.id)).toEqual([1, 2, 5, 4]);
  });
});
