import type { CourseWithRatings } from "@betteratlas/shared";
import { describe, expect, it } from "vitest";
import type { RankedCandidate } from "../relevance/rankingPolicy.js";
import {
  buildAiDebugDiagnostics,
  buildRankingTopBreakdown,
  type RankingTopBreakdownEntry,
} from "./aiDebugDiagnostics.js";

function buildCourse(id: number, code: string, title: string): CourseWithRatings {
  return {
    id,
    code,
    title,
    description: `${title} description`,
    prerequisites: null,
    credits: 3,
    departmentId: 1,
    attributes: null,
    department: {
      id: 1,
      code: "CS",
      name: "Computer Science",
    },
    avgQuality: 4.2,
    avgDifficulty: 2.7,
    avgWorkload: 2.8,
    reviewCount: 30,
    instructors: ["Ada Lovelace"],
    gers: ["QR"],
    campuses: ["Atlanta"],
    requirements: null,
    classScore: 4.1,
  };
}

function buildRankedCandidates(): RankedCandidate[] {
  return [
    {
      course: buildCourse(101, "CS 101", "Computing Foundations"),
      index: 0,
      scores: {
        baseRelevance: 2.4,
        preference: 0.5,
        trainer: 0.3,
        final: 3.2,
      },
    },
    {
      course: buildCourse(202, "QTM 202", "Modeling for Policy"),
      index: 1,
      scores: {
        baseRelevance: 1.9,
        preference: 0.2,
        trainer: 0.1,
        final: 2.2,
      },
    },
  ];
}

describe("aiDebugDiagnostics", () => {
  it("builds ranking top breakdown entries with stable score fields", () => {
    const breakdown = buildRankingTopBreakdown({
      rankedCandidates: buildRankedCandidates(),
      limit: 2,
    });

    expect(breakdown).toHaveLength(2);
    expect(breakdown[0]).toEqual<RankingTopBreakdownEntry>({
      rank: 1,
      courseId: 101,
      courseCode: "CS 101",
      courseTitle: "Computing Foundations",
      baseRelevance: 2.4,
      preference: 0.5,
      trainer: 0.3,
      final: 3.2,
    });
    expect(breakdown[1]?.rank).toBe(2);
  });

  it("returns a deterministic diagnostics schema for minimal non-retrieval branches", () => {
    const diagnostics = buildAiDebugDiagnostics({
      intentMode: "clarify",
      intentReason: "clarify_required",
      retrievalSkipped: true,
    });

    expect(Object.keys(diagnostics).sort()).toEqual(
      [
        "appliedFilters",
        "blockedCourseCount",
        "candidateComposition",
        "candidateCount",
        "candidatesMs",
        "candidatesWithDescription",
        "concentrationAllowed",
        "depsMs",
        "deptCode",
        "deptCounts",
        "dislikedSignals",
        "embedMs",
        "excludedMentionCount",
        "filterConstraintDroppedCount",
        "filterEvidence",
        "groundingStatus",
        "groundingViolationCount",
        "hadFillers",
        "intentMode",
        "intentReason",
        "lexicalCount",
        "likedSignals",
        "lowRelevanceRefineUsed",
        "matchedTermCoverage",
        "model",
        "openaiMs",
        "rankingTopBreakdown",
        "relevanceGateEligible",
        "relevanceSufficient",
        "retrievalMode",
        "retrievalSkipped",
        "safeFallbackUsed",
        "searchTerms",
        "searchUniqueCount",
        "semanticAttempted",
        "semanticAvailable",
        "semanticCandidateCount",
        "semanticCount",
        "semanticMs",
        "semanticUniqueCount",
        "totalMs",
        "trainerBoostedCount",
        "trainerDemotedCount",
        "trainerScoresLoaded",
        "usedJsonFallback",
        "userMajor",
      ].sort()
    );
    expect(diagnostics.retrievalMode).toBe("none");
    expect(diagnostics.filterEvidence).toEqual({
      droppedCount: 0,
      constraintFallbackTriggered: false,
      constraintsActive: false,
    });
    expect(diagnostics.rankingTopBreakdown).toEqual([]);
  });

  it("builds filter evidence and ranking breakdown for recommend outcomes", () => {
    const rankedCandidates = buildRankedCandidates();
    const rankingTopBreakdown = buildRankingTopBreakdown({
      rankedCandidates,
      limit: 2,
    });

    const diagnostics = buildAiDebugDiagnostics({
      intentMode: "recommend",
      intentReason: "explicit_course_request",
      retrievalSkipped: false,
      retrieval: {
        retrievalMode: "hybrid",
        semanticAttempted: true,
        semanticAvailable: true,
        lexicalCount: 12,
        semanticCount: 4,
      },
      candidateComposition: {
        candidateCount: 18,
        searchUniqueCount: 12,
        semanticUniqueCount: 4,
        semanticCandidateCount: 5,
        candidatesWithDescription: 18,
        deptCounts: { CS: 7, QTM: 4 },
      },
      preferenceSignals: {
        appliedFilters: { department: "CS" },
        likedSignals: 2,
        dislikedSignals: 1,
      },
      trainerSignals: {
        trainerScoresLoaded: 18,
        trainerBoostedCount: 3,
        trainerDemotedCount: 2,
      },
      grounding: {
        status: "passed",
        violationCount: 0,
        excludedMentionCount: 0,
        blockedCourseCount: 5,
      },
      outcome: {
        usedJsonFallback: false,
        safeFallbackUsed: false,
        lowRelevanceRefineUsed: false,
        concentrationAllowed: true,
      },
      filterEnforcement: {
        droppedCount: 3,
        constraintFallbackTriggered: true,
      },
      relevanceGate: {
        eligible: true,
        matchedTermCoverage: 0.67,
        sufficient: true,
      },
      rankingTopBreakdown,
    });

    expect(diagnostics.filterConstraintDroppedCount).toBe(3);
    expect(diagnostics.filterEvidence).toEqual({
      droppedCount: 3,
      constraintFallbackTriggered: true,
      constraintsActive: true,
    });
    expect(diagnostics.rankingTopBreakdown).toHaveLength(2);
    expect(diagnostics.rankingTopBreakdown[0]).toMatchObject({
      baseRelevance: 2.4,
      preference: 0.5,
      trainer: 0.3,
      final: 3.2,
    });
    expect(diagnostics.candidateComposition).toEqual({
      totalCandidates: 18,
      searchUniqueCount: 12,
      semanticUniqueCount: 4,
      semanticCandidateCount: 5,
      withDescriptionCount: 18,
      byDepartment: { CS: 7, QTM: 4 },
    });
  });
});
