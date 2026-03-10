export type IntentMode = "conversation" | "clarify" | "recommend";

export type IntentDecision = {
  mode: IntentMode;
  reason: string;
  signals: string[];
};

export type ClarifyResponse = {
  assistantMessage: string;
  followUpQuestion: string;
};

type IntentInput = {
  latestUser: string;
  recentMessages: { role: "user" | "assistant"; content: string }[];
};

type NormalizedIntentText = {
  raw: string;
  collapsed: string;
  keywordText: string;
  alphaText: string;
};

const COURSE_CODE_RE = /\b([a-z]{2,8})\s*-?\s*(\d{3,4}[a-z]?)\b/i;
const COURSE_CODE_DEPT_BLOCKLIST = new Set([
  "fall",
  "spring",
  "summer",
  "winter",
  "easy",
  "hard",
]);
const RECOMMEND_VERB_RE =
  /\b(recommend|suggest|suggestions|what should i take|which classes should i|which course should i|find me classes|find me courses|plan my schedule|build my schedule|give me classes)\b/i;
const COURSE_NOUN_RE =
  /\b(course|courses|class|classes|ger|gers|elective|electives|professor|instructor|catalog)\b/i;
const COURSE_SEEKING_RE =
  /\b(help|find|looking|pick|choose|take|taking|need|want|plan|planning|search)\b/i;
const ACTIONABLE_CONSTRAINT_RE =
  /\b(easy|hard|beginner|advanced|major|minor|semester|fall|spring|summer|credit|credits|online|in-person|in person|campus|workload|rating|department|ger|gers|attribute|professor|instructor)\b/i;
const CLARIFY_GER_RE = /\b(ger|gers|attribute|attributes|requirement|requirements)\b/i;
const CLARIFY_DEPARTMENT_RE = /\b(major|minor|department)\b/i;
const CLARIFY_WORKLOAD_RE = /\b(workload|easy|hard|beginner|advanced|chill)\b/i;
const CLARIFY_SEMESTER_RE = /\b(semester|fall|spring|summer|winter)\b/i;

function normalizeIntentText(text: string): NormalizedIntentText {
  const raw = text.trim();
  const collapsed = raw.toLowerCase().replace(/\s+/g, " ").trim();
  const keywordText = collapsed
    .replace(/[_/\\|]+/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const alphaText = keywordText.replace(/[^a-z]/g, "");

  return {
    raw,
    collapsed,
    keywordText,
    alphaText,
  };
}

function isTrivialGreeting(text: NormalizedIntentText): boolean {
  if (!text.collapsed) return true;
  if (text.collapsed.length <= 24) {
    const alpha = text.alphaText;
    if (/^(hi|hey|yo|sup|help|test|testing)$/.test(alpha)) return true;
    if (/^h+e+l+o+w*$/.test(alpha)) return true;
  }
  return false;
}

function hasCourseCodeSignal(text: NormalizedIntentText): boolean {
  const match = COURSE_CODE_RE.exec(text.keywordText);
  if (!match) return false;

  const deptToken = (match[1] ?? "").toLowerCase();
  if (COURSE_CODE_DEPT_BLOCKLIST.has(deptToken)) return false;

  return true;
}

function hasStrongRecommendationVerb(text: NormalizedIntentText): boolean {
  return RECOMMEND_VERB_RE.test(text.keywordText);
}

function hasCourseNounSignal(text: NormalizedIntentText): boolean {
  return COURSE_NOUN_RE.test(text.keywordText);
}

function hasCourseSeekingSignal(text: NormalizedIntentText): boolean {
  return COURSE_SEEKING_RE.test(text.keywordText);
}

function hasActionableConstraint(text: NormalizedIntentText): boolean {
  return ACTIONABLE_CONSTRAINT_RE.test(text.keywordText);
}

function dedupeSignals(signals: string[]): string[] {
  return [...new Set(signals)];
}

function buildClarifyQuestion(text: NormalizedIntentText): string {
  if (CLARIFY_GER_RE.test(text.keywordText)) {
    return "Which GER or requirement should this satisfy, and for which semester?";
  }
  if (CLARIFY_DEPARTMENT_RE.test(text.keywordText)) {
    return "Which department or major should I prioritize, and how heavy should the workload be?";
  }
  if (CLARIFY_WORKLOAD_RE.test(text.keywordText)) {
    return "Which semester is this for, and do you want easy, moderate, or challenging workload?";
  }
  if (CLARIFY_SEMESTER_RE.test(text.keywordText)) {
    return "For that semester, should I focus on a department, a GER, or a lighter workload?";
  }
  return "What should I optimize first: workload, GER, department, or semester?";
}

export function classifyIntent(input: IntentInput): IntentDecision {
  const text = normalizeIntentText(input.latestUser);
  const signals: string[] = ["normalized_input"];

  if (!text.raw) {
    return {
      mode: "conversation",
      reason: "empty_turn",
      signals: dedupeSignals([...signals, "empty_input"]),
    };
  }

  if (isTrivialGreeting(text)) {
    return {
      mode: "conversation",
      reason: "trivial_greeting",
      signals: dedupeSignals([...signals, "greeting_short"]),
    };
  }

  const hasCourseCode = hasCourseCodeSignal(text);
  const hasRecommendVerb = hasStrongRecommendationVerb(text);
  if (hasCourseCode) signals.push("course_code_signal");
  if (hasRecommendVerb) signals.push("recommendation_verb_signal");

  if (hasCourseCode || hasRecommendVerb) {
    const reason =
      hasCourseCode && hasRecommendVerb
        ? "explicit_recommendation_course_code_and_request"
        : hasCourseCode
          ? "explicit_course_code_request"
          : "explicit_recommendation_request";

    return {
      mode: "recommend",
      reason,
      signals: dedupeSignals(signals),
    };
  }

  const hasCourseNoun = hasCourseNounSignal(text);
  const hasCourseSeeking = hasCourseSeekingSignal(text);
  const hasConstraint = hasActionableConstraint(text);
  if (hasCourseNoun) signals.push("course_noun_signal");
  if (hasCourseSeeking) signals.push("course_seeking_signal");
  if (hasConstraint) signals.push("actionable_constraint_signal");

  if (hasCourseNoun && hasCourseSeeking && !hasConstraint) {
    return {
      mode: "clarify",
      reason: "ambiguous_course_request_missing_constraints",
      signals: dedupeSignals([...signals, "missing_actionable_constraints"]),
    };
  }

  return {
    mode: "conversation",
    reason: "general_conversation",
    signals: dedupeSignals([...signals, "fallback_conversation"]),
  };
}

export function buildClarifyResponse(input: IntentInput): ClarifyResponse {
  const text = normalizeIntentText(input.latestUser);
  const followUpQuestion = buildClarifyQuestion(text);

  return {
    assistantMessage: `I can help with that. ${followUpQuestion}`,
    followUpQuestion,
  };
}
