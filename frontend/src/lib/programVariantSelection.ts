import type { ProgramSummary, ProgramTab, ProgramVariants } from "@betteratlas/shared";

type ProgramKind = ProgramSummary["kind"];

type ProgramSummaryByKind = Partial<Record<ProgramKind, ProgramSummary | null>>;

function normalizeProgramName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizeDegree(value: string | null | undefined): string | null {
  const normalized = (value ?? "").trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

function degreeRank(value: string | null | undefined): number {
  const degree = normalizeDegree(value);
  if (degree === "BA") return 0;
  if (degree === "BS") return 1;
  if (degree) return 2;
  return 3;
}

function kindRank(kind: ProgramKind): number {
  return kind === "major" ? 0 : 1;
}

function compareProgramSummary(a: ProgramSummary, b: ProgramSummary): number {
  const aName = a.name.trim().toLowerCase();
  const bName = b.name.trim().toLowerCase();
  const byName = aName.localeCompare(bName);
  if (byName !== 0) return byName;

  const byKind = kindRank(a.kind) - kindRank(b.kind);
  if (byKind !== 0) return byKind;

  const byDegreeRank = degreeRank(a.degree) - degreeRank(b.degree);
  if (byDegreeRank !== 0) return byDegreeRank;

  const byDegree = (normalizeDegree(a.degree) ?? "").localeCompare(normalizeDegree(b.degree) ?? "");
  if (byDegree !== 0) return byDegree;

  return a.id - b.id;
}

function compareWithPreferredDegree(
  a: ProgramSummary,
  b: ProgramSummary,
  preferredDegree: string | null
): number {
  const aDegree = normalizeDegree(a.degree);
  const bDegree = normalizeDegree(b.degree);

  const aMatchesPreferred = preferredDegree && aDegree === preferredDegree ? 0 : 1;
  const bMatchesPreferred = preferredDegree && bDegree === preferredDegree ? 0 : 1;
  if (aMatchesPreferred !== bMatchesPreferred) return aMatchesPreferred - bMatchesPreferred;

  return compareProgramSummary(a, b);
}

export function buildProgramSearchOptions(programs: ProgramSummary[] | null | undefined): ProgramSummary[] {
  if (!programs || programs.length === 0) return [];

  const byFamily = new Map<string, ProgramSummary[]>();

  for (const program of programs) {
    const familyKey = normalizeProgramName(program.name);
    const existing = byFamily.get(familyKey) ?? [];
    existing.push(program);
    byFamily.set(familyKey, existing);
  }

  const representatives = [...byFamily.values()].map((family) =>
    [...family].sort(compareProgramSummary)[0]!
  );

  return representatives.sort(compareProgramSummary);
}

export function selectProgramVariant(input: {
  variants: ProgramVariants | null | undefined;
  targetKind: ProgramKind;
  current: ProgramSummary | null | undefined;
  previousByKind?: ProgramSummaryByKind;
}): ProgramSummary | null {
  const { variants, targetKind, current, previousByKind } = input;
  if (!variants) return null;

  const candidates = targetKind === "major" ? variants.majors : variants.minors;
  if (candidates.length === 0) return null;

  const previousSelection = previousByKind?.[targetKind] ?? null;
  if (previousSelection) {
    const previousById = candidates.find((candidate) => candidate.id === previousSelection.id);
    if (previousById) return previousById;
  }

  const preferredDegree =
    normalizeDegree(previousSelection?.degree) ?? normalizeDegree(current?.degree);

  return [...candidates].sort((a, b) => compareWithPreferredDegree(a, b, preferredDegree))[0] ?? null;
}

export function canonicalizeProgramTab(value: string | null | undefined): ProgramTab {
  return value === "electives" ? "electives" : "required";
}
