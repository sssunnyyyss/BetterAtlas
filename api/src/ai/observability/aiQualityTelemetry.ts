import type { IntentMode } from "../intent/intentRouter.js";
import type { RetrievalMode } from "../relevance/retrievalModePolicy.js";

const INTENT_MODES = ["conversation", "clarify", "recommend"] as const;
const RETRIEVAL_MODES = ["none", "lexical_only", "hybrid", "hybrid_degraded"] as const;
const OUTCOME_TYPES = [
  "reset",
  "conversation_response",
  "clarify_response",
  "empty_candidates",
  "grounding_fallback",
  "low_relevance_refine",
  "filter_constraint_fallback",
  "recommendation_success",
  "route_error",
] as const;
const GROUNDING_STATUSES = ["not_applicable", "passed", "failed"] as const;

export type AiQualityRetrievalMode = "none" | RetrievalMode;
export type AiQualityOutcomeType = (typeof OUTCOME_TYPES)[number];
export type AiQualityGroundingStatus = (typeof GROUNDING_STATUSES)[number];

type WithUnknown<T extends string> = T | "unknown";
type BoolCounts = { true: number; false: number };

type CounterState = {
  totalEvents: number;
  intentModeCounts: Record<WithUnknown<IntentMode>, number>;
  retrievalModeCounts: Record<WithUnknown<AiQualityRetrievalMode>, number>;
  outcomeTypeCounts: Record<WithUnknown<AiQualityOutcomeType>, number>;
  groundingStatusCounts: Record<WithUnknown<AiQualityGroundingStatus>, number>;
  safeFallbackCounts: BoolCounts;
  jsonFallbackCounts: BoolCounts;
  groundingMismatchCounts: BoolCounts;
  compositeCounts: Map<string, number>;
};

export type AiQualityTelemetryEvent = {
  intentMode: IntentMode;
  retrievalMode: AiQualityRetrievalMode;
  outcomeType: AiQualityOutcomeType;
  groundingStatus: AiQualityGroundingStatus;
  safeFallbackUsed: boolean;
  usedJsonFallback: boolean;
  groundingMismatch: boolean;
};

export type AiQualityTelemetrySnapshot = {
  totalEvents: number;
  intentModeCounts: Record<WithUnknown<IntentMode>, number>;
  retrievalModeCounts: Record<WithUnknown<AiQualityRetrievalMode>, number>;
  outcomeTypeCounts: Record<WithUnknown<AiQualityOutcomeType>, number>;
  groundingStatusCounts: Record<WithUnknown<AiQualityGroundingStatus>, number>;
  safeFallbackCounts: BoolCounts;
  jsonFallbackCounts: BoolCounts;
  groundingMismatchCounts: BoolCounts;
  rates: {
    safeFallbackRate: number;
    jsonFallbackRate: number;
    groundingMismatchRate: number;
  };
  compositeEventCounts: Array<{ key: string; count: number }>;
};

function createCounterRecord<const T extends readonly string[]>(values: T): Record<WithUnknown<T[number]>, number> {
  const out = { unknown: 0 } as Record<WithUnknown<T[number]>, number>;
  for (const value of values) {
    out[value as T[number]] = 0;
  }
  return out;
}

function createState(): CounterState {
  return {
    totalEvents: 0,
    intentModeCounts: createCounterRecord(INTENT_MODES),
    retrievalModeCounts: createCounterRecord(RETRIEVAL_MODES),
    outcomeTypeCounts: createCounterRecord(OUTCOME_TYPES),
    groundingStatusCounts: createCounterRecord(GROUNDING_STATUSES),
    safeFallbackCounts: { true: 0, false: 0 },
    jsonFallbackCounts: { true: 0, false: 0 },
    groundingMismatchCounts: { true: 0, false: 0 },
    compositeCounts: new Map<string, number>(),
  };
}

let state = createState();

function normalizeEnumValue<const T extends readonly string[]>(
  value: unknown,
  allowed: T
): WithUnknown<T[number]> {
  if (typeof value !== "string") return "unknown";
  return allowed.includes(value as T[number]) ? (value as T[number]) : "unknown";
}

function incrementBoolCount(counts: BoolCounts, value: boolean) {
  if (value) {
    counts.true += 1;
  } else {
    counts.false += 1;
  }
}

function toRate(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Number((numerator / denominator).toFixed(4));
}

export function recordAiQualityEvent(event: AiQualityTelemetryEvent): void {
  const intentMode = normalizeEnumValue(event.intentMode, INTENT_MODES);
  const retrievalMode = normalizeEnumValue(event.retrievalMode, RETRIEVAL_MODES);
  const outcomeType = normalizeEnumValue(event.outcomeType, OUTCOME_TYPES);
  const groundingStatus = normalizeEnumValue(event.groundingStatus, GROUNDING_STATUSES);

  const safeFallbackUsed = Boolean(event.safeFallbackUsed);
  const usedJsonFallback = Boolean(event.usedJsonFallback);
  const groundingMismatch = Boolean(event.groundingMismatch);

  state.totalEvents += 1;
  state.intentModeCounts[intentMode] += 1;
  state.retrievalModeCounts[retrievalMode] += 1;
  state.outcomeTypeCounts[outcomeType] += 1;
  state.groundingStatusCounts[groundingStatus] += 1;
  incrementBoolCount(state.safeFallbackCounts, safeFallbackUsed);
  incrementBoolCount(state.jsonFallbackCounts, usedJsonFallback);
  incrementBoolCount(state.groundingMismatchCounts, groundingMismatch);

  const compositeKey = [
    `intent:${intentMode}`,
    `retrieval:${retrievalMode}`,
    `outcome:${outcomeType}`,
    `grounding:${groundingStatus}`,
    `safeFallback:${safeFallbackUsed ? "1" : "0"}`,
    `jsonFallback:${usedJsonFallback ? "1" : "0"}`,
    `groundingMismatch:${groundingMismatch ? "1" : "0"}`,
  ].join("|");
  state.compositeCounts.set(compositeKey, (state.compositeCounts.get(compositeKey) ?? 0) + 1);
}

export function getAiQualityTelemetrySnapshot(): AiQualityTelemetrySnapshot {
  const totalEvents = state.totalEvents;
  return {
    totalEvents,
    intentModeCounts: { ...state.intentModeCounts },
    retrievalModeCounts: { ...state.retrievalModeCounts },
    outcomeTypeCounts: { ...state.outcomeTypeCounts },
    groundingStatusCounts: { ...state.groundingStatusCounts },
    safeFallbackCounts: { ...state.safeFallbackCounts },
    jsonFallbackCounts: { ...state.jsonFallbackCounts },
    groundingMismatchCounts: { ...state.groundingMismatchCounts },
    rates: {
      safeFallbackRate: toRate(state.safeFallbackCounts.true, totalEvents),
      jsonFallbackRate: toRate(state.jsonFallbackCounts.true, totalEvents),
      groundingMismatchRate: toRate(state.groundingMismatchCounts.true, totalEvents),
    },
    compositeEventCounts: Array.from(state.compositeCounts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, count]) => ({ key, count })),
  };
}

export function resetAiQualityTelemetryForTests(): void {
  state = createState();
}
