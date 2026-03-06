const SESSION_BLOCKLIST_TTL_MS = 6 * 60 * 60 * 1000; // 6h

type SessionBlocklistEntry = {
  blockedCourseIds: Set<number>;
  updatedAt: number;
};

const blocklistByUser = new Map<string, SessionBlocklistEntry>();

function isValidCourseId(value: number) {
  return Number.isInteger(value) && value > 0;
}

function getFreshEntry(userId: string): SessionBlocklistEntry | null {
  const entry = blocklistByUser.get(userId);
  if (!entry) return null;

  if (Date.now() - entry.updatedAt > SESSION_BLOCKLIST_TTL_MS) {
    blocklistByUser.delete(userId);
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

export function getSessionBlockedCourseIds(userId: string): Set<number> {
  const entry = getFreshEntry(userId);
  if (!entry) return new Set<number>();
  return new Set<number>(entry.blockedCourseIds);
}

export function mergeSessionBlockedCourseIds(
  userId: string,
  blockedIds: Iterable<number>
): Set<number> {
  const existing = getFreshEntry(userId);
  const merged = new Set<number>(existing ? existing.blockedCourseIds : []);
  const incoming = sanitizeIds(blockedIds);

  for (const blockedId of incoming) {
    merged.add(blockedId);
  }

  if (merged.size === 0) {
    blocklistByUser.delete(userId);
    return merged;
  }

  blocklistByUser.set(userId, {
    blockedCourseIds: merged,
    updatedAt: Date.now(),
  });

  return new Set<number>(merged);
}

export function clearSessionBlockedCourseIds(userId: string): void {
  blocklistByUser.delete(userId);
}
