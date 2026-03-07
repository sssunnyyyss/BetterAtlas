import { beforeEach, describe, expect, it } from "vitest";
import {
  getAiQualityTelemetrySnapshot,
  recordAiQualityEvent,
  resetAiQualityTelemetryForTests,
} from "./aiQualityTelemetry.js";

describe("aiQualityTelemetry", () => {
  beforeEach(() => {
    resetAiQualityTelemetryForTests();
  });

  it("collapses untrusted enum values into bounded unknown buckets", () => {
    for (let i = 0; i < 12; i += 1) {
      recordAiQualityEvent({
        intentMode: `intent-${i}` as any,
        retrievalMode: `retrieval-${i}` as any,
        outcomeType: `outcome-${i}` as any,
        groundingStatus: `grounding-${i}` as any,
        safeFallbackUsed: false,
        usedJsonFallback: false,
        groundingMismatch: false,
      });
    }

    const snapshot = getAiQualityTelemetrySnapshot();
    expect(snapshot.totalEvents).toBe(12);
    expect(snapshot.intentModeCounts.unknown).toBe(12);
    expect(snapshot.retrievalModeCounts.unknown).toBe(12);
    expect(snapshot.outcomeTypeCounts.unknown).toBe(12);
    expect(snapshot.groundingStatusCounts.unknown).toBe(12);
    expect(snapshot.compositeEventCounts).toEqual([
      {
        key: "intent:unknown|retrieval:unknown|outcome:unknown|grounding:unknown|safeFallback:0|jsonFallback:0|groundingMismatch:0",
        count: 12,
      },
    ]);
  });

  it("accumulates fallback and grounding mismatch counters with deterministic rates", () => {
    recordAiQualityEvent({
      intentMode: "recommend",
      retrievalMode: "hybrid",
      outcomeType: "recommendation_success",
      groundingStatus: "passed",
      safeFallbackUsed: false,
      usedJsonFallback: false,
      groundingMismatch: false,
    });
    recordAiQualityEvent({
      intentMode: "recommend",
      retrievalMode: "hybrid_degraded",
      outcomeType: "grounding_fallback",
      groundingStatus: "failed",
      safeFallbackUsed: true,
      usedJsonFallback: false,
      groundingMismatch: true,
    });
    recordAiQualityEvent({
      intentMode: "recommend",
      retrievalMode: "lexical_only",
      outcomeType: "filter_constraint_fallback",
      groundingStatus: "passed",
      safeFallbackUsed: true,
      usedJsonFallback: true,
      groundingMismatch: false,
    });

    const snapshot = getAiQualityTelemetrySnapshot();
    expect(snapshot.totalEvents).toBe(3);
    expect(snapshot.safeFallbackCounts).toEqual({ true: 2, false: 1 });
    expect(snapshot.jsonFallbackCounts).toEqual({ true: 1, false: 2 });
    expect(snapshot.groundingMismatchCounts).toEqual({ true: 1, false: 2 });
    expect(snapshot.rates).toEqual({
      safeFallbackRate: 0.6667,
      jsonFallbackRate: 0.3333,
      groundingMismatchRate: 0.3333,
    });
  });

  it("returns a deterministic snapshot shape across repeated reads", () => {
    recordAiQualityEvent({
      intentMode: "conversation",
      retrievalMode: "none",
      outcomeType: "conversation_response",
      groundingStatus: "not_applicable",
      safeFallbackUsed: false,
      usedJsonFallback: false,
      groundingMismatch: false,
    });
    recordAiQualityEvent({
      intentMode: "clarify",
      retrievalMode: "none",
      outcomeType: "clarify_response",
      groundingStatus: "not_applicable",
      safeFallbackUsed: false,
      usedJsonFallback: false,
      groundingMismatch: false,
    });

    const first = getAiQualityTelemetrySnapshot();
    const second = getAiQualityTelemetrySnapshot();

    expect(second).toEqual(first);
    expect(first.intentModeCounts).toEqual({
      conversation: 1,
      clarify: 1,
      recommend: 0,
      unknown: 0,
    });
    expect(first.retrievalModeCounts).toEqual({
      none: 2,
      lexical_only: 0,
      hybrid: 0,
      hybrid_degraded: 0,
      unknown: 0,
    });
    expect(first.outcomeTypeCounts).toEqual({
      reset: 0,
      conversation_response: 1,
      clarify_response: 1,
      empty_candidates: 0,
      grounding_fallback: 0,
      low_relevance_refine: 0,
      filter_constraint_fallback: 0,
      recommendation_success: 0,
      route_error: 0,
      unknown: 0,
    });
  });
});
