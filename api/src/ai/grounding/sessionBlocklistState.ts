const SESSION_BLOCKLIST_TTL_MS = 6 * 60 * 60 * 1000; // 6h

type SessionBlocklistEntry = {
  blockedCourseIds: Set<number>;
  updatedAt: number;
};

const blocklistBySessionKey = new Map<string, SessionBlocklistEntry>();

function isValidCourseId(value: number) {
  return Number.isInteger(value) && value > 0;
}

function getFreshEntry(sessionKey: string): SessionBlocklistEntry | null {
  if (!sessionKey) return null;
  const entry = blocklistBySessionKey.get(sessionKey);
  if (!entry) return null;

  if (Date.now() - entry.updatedAt > SESSION_BLOCKLIST_TTL_MS) {
    blocklistBySessionKey.delete(sessionKey);
    return null;
  }

  return entry;
}

function sanitizeIds(blockedIds: Iterable<number>) {
  const out = new Set<number>();
  for (const value of blockedIds) {
    if (isValidCourseId(value)) out.add(value);
  }
  return out;
}

export function getSessionBlockedCourseIds(sessionKey: string): Set<number> {
  const entry = getFreshEntry(sessionKey);
  if (!entry) return new Set<number>();
  return new Set<number>(entry.blockedCourseIds);
}

export function mergeSessionBlockedCourseIds(
  sessionKey: string,
  blockedIds: Iterable<number>
): Set<number> {
  if (!sessionKey) {
    return sanitizeIds(blockedIds);
  }

  const existing = getFreshEntry(sessionKey);
  const merged = new Set<number>(existing ? existing.blockedCourseIds : []);
  const incoming = sanitizeIds(blockedIds);

  for (const blockedId of incoming) {
    merged.add(blockedId);
  }

  if (merged.size === 0) {
    blocklistBySessionKey.delete(sessionKey);
    return merged;
  }

  blocklistBySessionKey.set(sessionKey, {
    blockedCourseIds: merged,
    updatedAt: Date.now(),
  });

  return new Set<number>(merged);
}

export function clearSessionBlockedCourseIds(sessionKey: string): void {
  if (!sessionKey) return;
  blocklistBySessionKey.delete(sessionKey);
}
