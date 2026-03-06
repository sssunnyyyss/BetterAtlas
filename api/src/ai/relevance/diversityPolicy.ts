import type { CourseWithRatings } from "@betteratlas/shared";

const CONCENTRATION_INTENT_SIGNALS = new Set<string>([
  "concentration_required",
  "department_focus",
  "single_department_request",
]);

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function getDepartmentCode(course: CourseWithRatings): string {
  const code = (course.department?.code ?? "").trim().toUpperCase();
  return code || "OTHER";
}

export function shouldAllowDepartmentConcentration(input: {
  filters?: { department?: string | null } | null;
  intentSignals?: string[] | null;
  rankedDepartmentCodes?: string[] | null;
}): boolean {
  const filterDepartment = input.filters?.department;
  if (typeof filterDepartment === "string" && filterDepartment.trim()) {
    return true;
  }

  for (const signal of input.intentSignals ?? []) {
    if (CONCENTRATION_INTENT_SIGNALS.has(normalizeToken(signal))) {
      return true;
    }
  }

  if (Array.isArray(input.rankedDepartmentCodes)) {
    const unique = new Set(
      input.rankedDepartmentCodes
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean)
    );
    if (unique.size <= 1) {
      return true;
    }
  }

  return false;
}

export function selectWithDepartmentDiversity<T extends { course: CourseWithRatings }>(input: {
  ranked: T[];
  targetCount: number;
  maxPerDepartment: number;
  concentrationAllowed: boolean;
}): T[] {
  if (!Array.isArray(input.ranked) || input.ranked.length === 0) return [];
  if (!Number.isFinite(input.targetCount) || input.targetCount <= 0) return [];

  const targetCount = Math.trunc(input.targetCount);
  if (input.concentrationAllowed) {
    return input.ranked.slice(0, targetCount);
  }

  const maxPerDepartment = Math.max(1, Math.trunc(input.maxPerDepartment || 1));
  const counts = new Map<string, number>();
  const selected: T[] = [];
  const skipped: T[] = [];

  for (const candidate of input.ranked) {
    if (selected.length >= targetCount) break;
    const dept = getDepartmentCode(candidate.course);
    const deptCount = counts.get(dept) ?? 0;
    if (deptCount >= maxPerDepartment) {
      skipped.push(candidate);
      continue;
    }

    selected.push(candidate);
    counts.set(dept, deptCount + 1);
  }

  // If strict caps under-fill the list, backfill in ranked order.
  if (selected.length < targetCount) {
    for (const candidate of skipped) {
      if (selected.length >= targetCount) break;
      selected.push(candidate);
    }
  }

  return selected;
}
