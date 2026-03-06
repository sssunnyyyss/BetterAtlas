import type { CourseWithRatings } from "@betteratlas/shared";
import type { GroundingValidationInput, GroundingValidationResult } from "./groundingContracts.js";

const COURSE_CODE_MENTION_RE = /\b([A-Za-z]{2,8})\s*(?:-|\s)?\s*(\d{3,4}[A-Za-z]?)\b/g;

type MentionedCode = {
  text: string;
  normalizedCode: string;
  index: number;
};

type CandidateTitleMention = {
  text: string;
  normalizedTitle: string;
  candidateIds: number[];
};

type CandidateCodeIndex = Map<string, number[]>;
type CandidateTitleIndexEntry = {
  text: string;
  normalizedTitle: string;
  candidateIds: number[];
};

function uniqueSortedIds(ids: Iterable<number>) {
  return Array.from(new Set(Array.from(ids))).sort((a, b) => a - b);
}

function appendIndex(map: Map<string, number[]>, key: string, value: number) {
  const existing = map.get(key);
  if (!existing) {
    map.set(key, [value]);
    return;
  }
  if (!existing.includes(value)) {
    existing.push(value);
    existing.sort((a, b) => a - b);
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeWordTokens(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeCourseCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, "");
}

export function buildCourseCodeVariants(value: string) {
  const normalized = normalizeCourseCode(value);
  if (!normalized) return [] as string[];

  const parsed = /^([A-Z]{2,8})(\d{3,4}[A-Z]?)$/.exec(normalized);
  if (!parsed) return [normalized];

  const [, dept, number] = parsed;
  return Array.from(new Set([`${dept}${number}`, `${dept} ${number}`, `${dept}-${number}`]));
}

export function extractCourseCodeMentions(assistantMessage: string) {
  const mentions: MentionedCode[] = [];
  const re = new RegExp(COURSE_CODE_MENTION_RE.source, COURSE_CODE_MENTION_RE.flags);
  let match: RegExpExecArray | null = null;

  while ((match = re.exec(assistantMessage)) !== null) {
    const mentionText = match[0];
    const normalizedCode = normalizeCourseCode(`${match[1]}${match[2]}`);
    if (!normalizedCode) continue;
    mentions.push({
      text: mentionText,
      normalizedCode,
      index: match.index,
    });
  }

  return mentions.sort((a, b) => a.index - b.index || a.text.localeCompare(b.text));
}

function buildCandidateCodeIndex(candidates: CourseWithRatings[]) {
  const byCode: CandidateCodeIndex = new Map();
  for (const candidate of candidates) {
    for (const variant of buildCourseCodeVariants(candidate.code)) {
      const key = normalizeCourseCode(variant);
      if (!key) continue;
      appendIndex(byCode, key, candidate.id);
    }
  }
  return byCode;
}

function buildCandidateTitleIndex(candidates: CourseWithRatings[]) {
  const byTitle = new Map<string, CandidateTitleIndexEntry>();
  const sortedCandidates = [...candidates].sort((a, b) => a.id - b.id);

  for (const candidate of sortedCandidates) {
    const text = String(candidate.title ?? "").trim();
    const normalizedTitle = normalizeWordTokens(text);
    if (normalizedTitle.length < 6) continue;

    const existing = byTitle.get(normalizedTitle);
    if (!existing) {
      byTitle.set(normalizedTitle, {
        text,
        normalizedTitle,
        candidateIds: [candidate.id],
      });
      continue;
    }

    if (!existing.candidateIds.includes(candidate.id)) {
      existing.candidateIds.push(candidate.id);
      existing.candidateIds.sort((a, b) => a - b);
    }
  }

  return Array.from(byTitle.values()).sort(
    (a, b) =>
      b.normalizedTitle.length - a.normalizedTitle.length ||
      a.text.localeCompare(b.text) ||
      a.candidateIds[0] - b.candidateIds[0]
  );
}

export function extractCandidateTitleMentions(
  assistantMessage: string,
  candidates: CourseWithRatings[]
) {
  const normalizedMessage = normalizeWordTokens(assistantMessage);
  if (!normalizedMessage) return [] as CandidateTitleMention[];

  const mentions: CandidateTitleMention[] = [];
  for (const entry of buildCandidateTitleIndex(candidates)) {
    const re = new RegExp(`(?:^|\\s)${escapeRegExp(entry.normalizedTitle)}(?:\\s|$)`, "i");
    if (!re.test(normalizedMessage)) continue;
    mentions.push({
      text: entry.text,
      normalizedTitle: entry.normalizedTitle,
      candidateIds: [...entry.candidateIds],
    });
  }

  return mentions.sort(
    (a, b) =>
      b.normalizedTitle.length - a.normalizedTitle.length ||
      a.text.localeCompare(b.text) ||
      a.candidateIds[0] - b.candidateIds[0]
  );
}

export function validateAssistantGrounding(
  input: GroundingValidationInput
): GroundingValidationResult {
  const codeIndex = buildCandidateCodeIndex(input.candidates);
  const codeMentions = extractCourseCodeMentions(input.assistantMessage);
  const titleMentions = extractCandidateTitleMentions(input.assistantMessage, input.candidates);
  const blockedCourseIds = input.blockedCourseIds ?? new Set<number>();
  const matchedCandidateIds = new Set<number>();
  const seenViolations = new Set<string>();
  const violations: GroundingValidationResult["violations"] = [];

  const pushViolation = (kind: "unknown_mention" | "blocked_mention", text: string) => {
    const key = `${kind}:${text.toLowerCase()}`;
    if (seenViolations.has(key)) return;
    seenViolations.add(key);
    violations.push({ kind, text });
  };

  for (const mention of codeMentions) {
    const candidateIds = codeIndex.get(mention.normalizedCode);
    if (!candidateIds || candidateIds.length === 0) {
      pushViolation("unknown_mention", mention.text);
      continue;
    }

    if (candidateIds.some((id) => blockedCourseIds.has(id))) {
      pushViolation("blocked_mention", mention.text);
      continue;
    }

    for (const id of candidateIds) {
      matchedCandidateIds.add(id);
    }
  }

  for (const mention of titleMentions) {
    if (mention.candidateIds.some((id) => blockedCourseIds.has(id))) {
      pushViolation("blocked_mention", mention.text);
      continue;
    }

    for (const id of mention.candidateIds) {
      matchedCandidateIds.add(id);
    }
  }

  return {
    ok: violations.length === 0,
    violations,
    matchedCandidateIds: uniqueSortedIds(matchedCandidateIds),
  };
}
