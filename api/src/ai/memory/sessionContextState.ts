export type AiMessage = { role: "user" | "assistant"; content: string };

export type AiSessionContext = {
  messages: AiMessage[];
  inferredConstraints: {
    department?: string;
    semester?: string;
    workload?: "easy" | "moderate" | "hard";
  };
  topicFingerprint: string[];
  updatedAt: number;
};

type SessionContextPatch = {
  messages?: AiMessage[];
  inferredConstraints?: AiSessionContext["inferredConstraints"];
  topicFingerprint?: string[];
};

export const AI_SESSION_CONTEXT_TTL_MS = 6 * 60 * 60 * 1000;
export const AI_SESSION_CONTEXT_MAX_MESSAGES = 6;

const MAX_SESSION_SEGMENT_LENGTH = 120;
const MAX_USER_SEGMENT_LENGTH = 120;
const MAX_TOPIC_FINGERPRINT_TOKENS = 16;

const contextBySession = new Map<string, AiSessionContext>();

function sanitizeSegment(value: string | null | undefined, maxLength: number) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
  return normalized ? normalized.slice(0, maxLength) : "";
}

function isExpired(entry: AiSessionContext, now: number) {
  return now - entry.updatedAt >= AI_SESSION_CONTEXT_TTL_MS;
}

function sweepExpiredEntries(now: number) {
  for (const [key, entry] of contextBySession.entries()) {
    if (isExpired(entry, now)) {
      contextBySession.delete(key);
    }
  }
}

function sanitizeMessages(messages: AiMessage[] | undefined) {
  const out: AiMessage[] = [];
  for (const message of messages ?? []) {
    if ((message.role !== "user" && message.role !== "assistant") || !message.content) continue;
    const content = message.content.trim();
    if (!content) continue;
    out.push({ role: message.role, content });
  }
  return out.slice(-AI_SESSION_CONTEXT_MAX_MESSAGES);
}

function normalizeTopicFingerprint(topicFingerprint: string[] | undefined) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of topicFingerprint ?? []) {
    const token = String(raw ?? "")
      .trim()
      .toLowerCase();
    if (!token || seen.has(token)) continue;
    seen.add(token);
    out.push(token);
  }
  return out.slice(-MAX_TOPIC_FINGERPRINT_TOKENS);
}

function normalizeInferredConstraints(
  inferred: AiSessionContext["inferredConstraints"] | undefined
): AiSessionContext["inferredConstraints"] {
  const departmentRaw = sanitizeSegment(inferred?.department, 20).toUpperCase();
  const semesterRaw = sanitizeSegment(inferred?.semester, 80);
  const workloadRaw = sanitizeSegment(inferred?.workload, 10).toLowerCase();

  return {
    department: departmentRaw || undefined,
    semester: semesterRaw || undefined,
    workload:
      workloadRaw === "easy" || workloadRaw === "moderate" || workloadRaw === "hard"
        ? workloadRaw
        : undefined,
  };
}

function buildDefaultContext(): AiSessionContext {
  return {
    messages: [],
    inferredConstraints: {},
    topicFingerprint: [],
    updatedAt: 0,
  };
}

function cloneContext(context: AiSessionContext): AiSessionContext {
  return {
    messages: context.messages.map((message) => ({ ...message })),
    inferredConstraints: { ...context.inferredConstraints },
    topicFingerprint: [...context.topicFingerprint],
    updatedAt: context.updatedAt,
  };
}

export function resolveAiSessionKey(input: {
  userId?: string | null;
  sessionId?: string | null;
}): string | null {
  const userId = sanitizeSegment(input.userId, MAX_USER_SEGMENT_LENGTH);
  const sessionId = sanitizeSegment(input.sessionId, MAX_SESSION_SEGMENT_LENGTH);

  if (sessionId) {
    return userId ? `user:${userId}:session:${sessionId}` : `anon:session:${sessionId}`;
  }

  return userId ? `user:${userId}` : null;
}

export function getSessionContext(sessionKey: string): AiSessionContext | null {
  if (!sessionKey) return null;

  const now = Date.now();
  sweepExpiredEntries(now);

  const existing = contextBySession.get(sessionKey);
  if (!existing) return null;
  if (isExpired(existing, now)) {
    contextBySession.delete(sessionKey);
    return null;
  }

  return cloneContext(existing);
}

export function upsertSessionContext(
  sessionKey: string,
  patch: SessionContextPatch
): AiSessionContext {
  if (!sessionKey) {
    throw new Error("sessionKey is required");
  }

  const now = Date.now();
  sweepExpiredEntries(now);

  const existing = contextBySession.get(sessionKey);
  const base =
    existing && !isExpired(existing, now)
      ? existing
      : {
          ...buildDefaultContext(),
          updatedAt: now,
        };

  const next: AiSessionContext = {
    messages: patch.messages ? sanitizeMessages(patch.messages) : [...base.messages],
    inferredConstraints: patch.inferredConstraints
      ? normalizeInferredConstraints({
          ...base.inferredConstraints,
          ...patch.inferredConstraints,
        })
      : { ...base.inferredConstraints },
    topicFingerprint: patch.topicFingerprint
      ? normalizeTopicFingerprint(patch.topicFingerprint)
      : [...base.topicFingerprint],
    updatedAt: now,
  };

  contextBySession.set(sessionKey, next);
  return cloneContext(next);
}

export function clearSessionContext(sessionKey: string): void {
  if (!sessionKey) return;
  contextBySession.delete(sessionKey);
}
