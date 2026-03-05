export type IntentMode = "conversation" | "clarify" | "recommend";

export type IntentDecision = {
  mode: IntentMode;
  reason: string;
  signals: string[];
};

type IntentInput = {
  latestUser: string;
  recentMessages: { role: "user" | "assistant"; content: string }[];
};

const COURSE_CODE_RE = /\b([a-z]{2,8})\s*-?\s*(\d{3,4}[a-z]?)\b/i;
const RECOMMEND_VERB_RE =
  /\b(recommend|suggest|suggestions|what should i take|which classes should i|which course should i|find me classes|find me courses|plan my schedule|build my schedule)\b/i;
const COURSE_NOUN_RE =
  /\b(course|courses|class|classes|ger|gers|elective|electives|professor|instructor|catalog)\b/i;
const COURSE_SEEKING_RE = /\b(help|find|looking|pick|choose|take|taking|need|want|plan)\b/i;
const ACTIONABLE_CONSTRAINT_RE =
  /\b(easy|hard|beginner|advanced|major|minor|semester|fall|spring|summer|credit|credits|online|in-person|in person|campus|workload|rating|department)\b/i;

function normalizeRawText(text: string): string {
  return text.trim();
}

function isTrivialGreeting(text: string): boolean {
  const lowered = text.toLowerCase();
  if (!lowered) return true;
  if (lowered.length <= 24) {
    const alpha = lowered.replace(/[^a-z]/g, "");
    if (/^(hi|hey|yo|sup|help|test|testing)$/.test(alpha)) return true;
    if (/^h+e+l+o+w*$/.test(alpha)) return true;
  }
  return false;
}

function hasCourseCodeSignal(text: string): boolean {
  return COURSE_CODE_RE.test(text);
}

function hasStrongRecommendationSignal(text: string): boolean {
  return RECOMMEND_VERB_RE.test(text) || hasCourseCodeSignal(text);
}

function isAmbiguousCourseSeeking(text: string): boolean {
  if (!COURSE_NOUN_RE.test(text)) return false;
  if (!COURSE_SEEKING_RE.test(text)) return false;
  return !ACTIONABLE_CONSTRAINT_RE.test(text);
}

export function classifyIntent(input: IntentInput): IntentDecision {
  const latestUser = normalizeRawText(input.latestUser);

  if (!latestUser) {
    return {
      mode: "conversation",
      reason: "empty_turn",
      signals: ["empty_input"],
    };
  }

  if (isTrivialGreeting(latestUser)) {
    return {
      mode: "conversation",
      reason: "trivial_greeting",
      signals: ["greeting_short"],
    };
  }

  if (hasStrongRecommendationSignal(latestUser)) {
    return {
      mode: "recommend",
      reason: "explicit_recommendation_request",
      signals: ["recommendation_signal"],
    };
  }

  if (isAmbiguousCourseSeeking(latestUser)) {
    return {
      mode: "clarify",
      reason: "ambiguous_course_request",
      signals: ["course_seeking_without_constraints"],
    };
  }

  return {
    mode: "conversation",
    reason: "general_conversation",
    signals: ["fallback_conversation"],
  };
}
