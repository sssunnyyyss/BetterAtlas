import { distance } from "fastest-levenshtein";

const TITLE_PREFIXES = /^(dr\.?|prof\.?|professor|mr\.?|mrs\.?|ms\.?)\s+/i;

export function normalizeName(name: string): string {
  return name
    .replace(TITLE_PREFIXES, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

interface InstructorRow {
  id: number;
  name: string;
  departmentId: number | null;
}

interface MatchResult {
  instructorId: number;
  confidence: "exact" | "fuzzy";
}

export function matchProfessor(
  firstName: string,
  lastName: string,
  rmpDepartment: string,
  instructors: InstructorRow[],
  deptCodeMap: Map<number, string>
): MatchResult | null {
  const rmpNorm = normalizeName(`${firstName} ${lastName}`);

  // Pass 1: exact match
  for (const inst of instructors) {
    if (normalizeName(inst.name) === rmpNorm) {
      return { instructorId: inst.id, confidence: "exact" };
    }
  }

  // Pass 2: fuzzy match
  const THRESHOLD = 0.85;
  type Candidate = { id: number; similarity: number; deptMatch: boolean };
  const candidates: Candidate[] = [];

  const rmpDeptNorm = rmpDepartment.toLowerCase().trim();

  for (const inst of instructors) {
    const instNorm = normalizeName(inst.name);
    const maxLen = Math.max(rmpNorm.length, instNorm.length);
    if (maxLen === 0) continue;

    const dist = distance(rmpNorm, instNorm);
    const similarity = 1 - dist / maxLen;

    if (similarity >= THRESHOLD) {
      const deptCode = inst.departmentId ? deptCodeMap.get(inst.departmentId) : null;
      const deptMatch = deptCode
        ? rmpDeptNorm.includes(deptCode.toLowerCase()) ||
          deptCode.toLowerCase().includes(rmpDeptNorm.slice(0, 4))
        : false;

      candidates.push({ id: inst.id, similarity, deptMatch });
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (a.deptMatch !== b.deptMatch) return a.deptMatch ? -1 : 1;
    return b.similarity - a.similarity;
  });

  return { instructorId: candidates[0].id, confidence: "fuzzy" };
}

interface CourseRow {
  id: number;
  title: string;
  departmentId: number | null;
}

export function matchCourse(
  rmpCourseName: string,
  instructorDeptId: number | null,
  courses: CourseRow[]
): number | null {
  const norm = rmpCourseName.toLowerCase().trim();

  // Exact title match
  const exact = courses.filter((c) => c.title.toLowerCase().trim() === norm);
  if (exact.length === 1) return exact[0].id;
  if (exact.length > 1) {
    const sameDept = exact.find((c) => c.departmentId === instructorDeptId);
    return sameDept?.id ?? exact[0].id;
  }

  // Substring match
  const substring = courses.filter(
    (c) =>
      c.title.toLowerCase().includes(norm) ||
      norm.includes(c.title.toLowerCase().trim())
  );
  if (substring.length === 1) return substring[0].id;
  if (substring.length > 1) {
    const sameDept = substring.find((c) => c.departmentId === instructorDeptId);
    return sameDept?.id ?? substring[0].id;
  }

  return null;
}
