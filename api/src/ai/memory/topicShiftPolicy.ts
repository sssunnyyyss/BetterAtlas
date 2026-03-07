import type { AiMessage, AiSessionContext } from "./sessionContextState.js";

type ConstraintValue = string | number | null | undefined;
type ConstraintMap = Record<string, ConstraintValue>;

const SHIFT_PHRASE_RE =
  /\b(actually|instead|switch(?:ing)?|different|change(?:d|ing)?|rather than|not anymore|new topic|on second thought)\b/i;
const NEGATION_RE = /\b(not|no|without|instead of|rather than|avoid|except)\b/i;
const TOKEN_RE = /[a-z0-9]+/g;
const TOKEN_STOPWORDS = new Set<string>([
  "a",
  "an",
  "and",
  "for",
  "i",
  "im",
  "me",
  "my",
  "of",
  "or",
  "please",
  "the",
  "to",
  "want",
  "with",
]);

function normalizeConstraintMap(input: ConstraintMap | undefined): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [key, raw] of Object.entries(input ?? {})) {
    if (typeof raw === "number" && Number.isFinite(raw)) {
      out[key] = raw;
      continue;
    }
    if (typeof raw !== "string") continue;
    const value = raw.trim();
    if (!value) continue;
    out[key] = value;
  }
  return out;
}

function sortedObject(input: Record<string, string | number>) {
  const out: Record<string, string | number> = {};
  for (const key of Object.keys(input).sort((a, b) => a.localeCompare(b))) {
    out[key] = input[key];
  }
  return out;
}

function tokenizeText(input: string): string[] {
  const tokens = input.toLowerCase().match(TOKEN_RE) ?? [];
  return tokens.filter((token) => token.length >= 2 && !TOKEN_STOPWORDS.has(token));
}

function tokenizeFingerprint(previousFingerprint: string[]) {
  const out = new Set<string>();
  for (const raw of previousFingerprint) {
    const normalized = String(raw ?? "")
      .trim()
      .toLowerCase();
    if (!normalized) continue;
    for (const token of tokenizeText(normalized)) {
      out.add(token);
    }
  }
  return out;
}

function constraintContradictionReasons(input: {
  latestLower: string;
  resolvedConstraints: Record<string, string | number>;
}): string[] {
  const reasons: string[] = [];

  if (!NEGATION_RE.test(input.latestLower)) {
    return reasons;
  }

  for (const [key, value] of Object.entries(input.resolvedConstraints)) {
    if (typeof value !== "string") continue;
    const normalizedValue = value.trim().toLowerCase();
    if (!normalizedValue) continue;
    if (!input.latestLower.includes(normalizedValue)) continue;

    reasons.push(`constraint_contradiction:${key}`);
  }

  return reasons;
}

function cloneMessages(messages: AiMessage[]) {
  return messages.map((message) => ({ ...message }));
}

function clampKeepRecentMessages(value: number | undefined) {
  if (!Number.isFinite(value)) return 2;
  return Math.max(0, Math.min(6, Math.trunc(value as number)));
}

export function detectTopicShift(input: {
  previousFingerprint: string[];
  latestUser: string;
  resolvedConstraints: ConstraintMap;
}): { detected: boolean; reasons: string[] } {
  const latestUser = String(input.latestUser ?? "").trim();
  if (!latestUser) {
    return { detected: false, reasons: [] };
  }

  const latestLower = latestUser.toLowerCase();
  const previousTokens = tokenizeFingerprint(input.previousFingerprint ?? []);
  const latestTokens = new Set<string>(tokenizeText(latestUser));
  const normalizedConstraints = normalizeConstraintMap(input.resolvedConstraints);

  const reasons: string[] = [];

  if (SHIFT_PHRASE_RE.test(latestLower)) {
    reasons.push("shift_phrase");
  }

  if (previousTokens.size > 0 && latestTokens.size > 0) {
    let overlap = 0;
    for (const token of latestTokens) {
      if (previousTokens.has(token)) overlap += 1;
    }
    const overlapRatio = overlap / Math.max(previousTokens.size, latestTokens.size);
    if (overlapRatio <= 0.2) {
      reasons.push("low_overlap");
    }
  }

  const contradictionReasons = constraintContradictionReasons({
    latestLower,
    resolvedConstraints: normalizedConstraints,
  });
  reasons.push(...contradictionReasons);

  const hasStrongReason = reasons.some(
    (reason) => reason === "shift_phrase" || reason.startsWith("constraint_contradiction:")
  );
  const hasLowOverlapSignal =
    reasons.includes("low_overlap") && previousTokens.size >= 3 && latestTokens.size >= 3;

  return {
    detected: hasStrongReason || hasLowOverlapSignal,
    reasons,
  };
}

export function decayContextForTopicShift(input: {
  detected: boolean;
  context: Pick<AiSessionContext, "messages" | "inferredConstraints" | "topicFingerprint">;
  keepRecentMessages?: number;
}): Pick<AiSessionContext, "messages" | "inferredConstraints" | "topicFingerprint"> {
  const messages = cloneMessages(input.context.messages ?? []);
  const inferredConstraints = { ...(input.context.inferredConstraints ?? {}) };
  const topicFingerprint = [...(input.context.topicFingerprint ?? [])];

  if (!input.detected) {
    return {
      messages,
      inferredConstraints,
      topicFingerprint,
    };
  }

  const keepRecentMessages = clampKeepRecentMessages(input.keepRecentMessages);

  return {
    messages: keepRecentMessages > 0 ? messages.slice(-keepRecentMessages) : [],
    inferredConstraints: {},
    topicFingerprint: [],
  };
}

export function resolveConstraintPrecedence(input: {
  explicitCurrent: ConstraintMap;
  latestTurnInferred: ConstraintMap;
  priorInferred: ConstraintMap;
}): Record<string, string | number> {
  const priorInferred = normalizeConstraintMap(input.priorInferred);
  const latestTurnInferred = normalizeConstraintMap(input.latestTurnInferred);
  const explicitCurrent = normalizeConstraintMap(input.explicitCurrent);

  return sortedObject({
    ...priorInferred,
    ...latestTurnInferred,
    ...explicitCurrent,
  });
}
