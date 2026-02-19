type CrossListSignatureRow = {
  courseId: number;
  termCode: string | null;
  instructorId: number | null;
  meetsDisplay: string | null;
};

function normalizeMeetsDisplay(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function signatureKeyFromRow(row: CrossListSignatureRow): string | null {
  if (typeof row.instructorId !== "number") return null;
  if (!row.termCode) return null;
  if (!row.meetsDisplay) return null;

  const normalizedMeeting = normalizeMeetsDisplay(row.meetsDisplay);
  if (!normalizedMeeting) return null;

  return `${row.termCode}::${row.instructorId}::${normalizedMeeting}`;
}

export function buildCrossListSignatureMap(rows: CrossListSignatureRow[]): Map<number, Set<string>> {
  const signatureMap = new Map<number, Set<string>>();

  for (const row of rows) {
    const key = signatureKeyFromRow(row);
    if (!key) continue;

    if (!signatureMap.has(row.courseId)) {
      signatureMap.set(row.courseId, new Set<string>());
    }
    signatureMap.get(row.courseId)!.add(key);
  }

  return signatureMap;
}

export function haveExactCrossListSignatures(
  sourceSignatures: Set<string> | undefined,
  candidateSignatures: Set<string> | undefined
): boolean {
  if (!sourceSignatures || !candidateSignatures) return false;
  if (sourceSignatures.size === 0 || candidateSignatures.size === 0) return false;
  if (sourceSignatures.size !== candidateSignatures.size) return false;

  for (const signature of sourceSignatures) {
    if (!candidateSignatures.has(signature)) return false;
  }
  return true;
}
