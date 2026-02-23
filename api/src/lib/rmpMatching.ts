import { distance } from "fastest-levenshtein";

const TITLE_PREFIXES = /^(dr\.?|prof\.?|professor|mr\.?|mrs\.?|ms\.?)\s+/i;
const NICKNAME_GROUPS = [
  ["michael", "mike", "mikey"],
  ["william", "bill", "billy", "will", "willy"],
  ["robert", "bob", "bobby", "rob", "robbie"],
  ["james", "jim", "jimmy", "jamie"],
  ["joseph", "joe", "joey"],
  ["thomas", "tom", "tommy"],
  ["steven", "steve", "stevie"],
  ["david", "dave", "davy"],
  ["richard", "rick", "ricky", "rich"],
  ["andrew", "andy", "drew"],
  ["anthony", "tony"],
  ["daniel", "dan", "danny"],
  ["charles", "charlie", "chuck"],
  ["matthew", "matt"],
  ["christopher", "chris"],
  ["nicholas", "nick"],
  ["jacob", "jake"],
  ["benjamin", "ben", "benny"],
  ["alexander", "alex"],
  ["elizabeth", "liz", "lizzy", "beth", "eliza"],
  ["katherine", "kathryn", "kate", "katie", "kathy"],
];
const NICKNAME_GROUP_BY_NAME = new Map<string, number>();
for (let idx = 0; idx < NICKNAME_GROUPS.length; idx++) {
  for (const name of NICKNAME_GROUPS[idx]!) {
    NICKNAME_GROUP_BY_NAME.set(name, idx);
  }
}

export function normalizeName(name: string): string {
  return name
    .replace(TITLE_PREFIXES, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizePersonToken(value: string): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .trim();
}

function tokenizePersonName(value: string): string[] {
  return normalizeName(value)
    .split(" ")
    .map(normalizePersonToken)
    .filter(Boolean);
}

function firstNameSimilarity(a: string, b: string): number {
  const left = normalizePersonToken(a);
  const right = normalizePersonToken(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const maxLen = Math.max(left.length, right.length);
  if (maxLen === 0) return 0;
  return 1 - distance(left, right) / maxLen;
}

function areLikelySameFirstName(a: string, b: string): boolean {
  const left = normalizePersonToken(a);
  const right = normalizePersonToken(b);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left[0] === right[0] && (left.startsWith(right) || right.startsWith(left))) {
    return true;
  }
  const leftGroup = NICKNAME_GROUP_BY_NAME.get(left);
  const rightGroup = NICKNAME_GROUP_BY_NAME.get(right);
  return leftGroup !== undefined && leftGroup === rightGroup;
}

function normalizeDepartmentText(value: string): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function departmentAcronym(value: string): string {
  const parts = normalizeDepartmentText(value)
    .split(" ")
    .map((v) => v.trim())
    .filter(Boolean);
  return parts.map((p) => p[0]).join("");
}

function hasDepartmentSignal(
  rmpDepartment: string,
  instructorDeptId: number | null,
  deptCodeMap: Map<number, string>
): boolean {
  if (typeof instructorDeptId !== "number") return false;
  const deptCodeRaw = deptCodeMap.get(instructorDeptId);
  if (!deptCodeRaw) return false;

  const deptCode = normalizeDepartmentText(deptCodeRaw).replace(/\s+/g, "");
  const rmpDept = normalizeDepartmentText(rmpDepartment);
  const rmpCompact = rmpDept.replace(/\s+/g, "");
  const rmpAcr = departmentAcronym(rmpDept);

  if (!deptCode || !rmpDept) return false;
  if (rmpDept.includes(deptCode)) return true;
  if (rmpCompact.includes(deptCode)) return true;
  if (deptCode.includes(rmpDept.slice(0, 4))) return true;
  if (rmpAcr && (rmpAcr === deptCode || rmpAcr.startsWith(deptCode) || deptCode.startsWith(rmpAcr))) {
    return true;
  }
  return false;
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

export interface ProfessorDisambiguationCandidate {
  instructorId: number;
  deptMatch: boolean;
  firstScore: number;
  similarity: number;
}

export function listProfessorDisambiguationCandidates(
  firstName: string,
  lastName: string,
  rmpDepartment: string,
  instructors: InstructorRow[],
  deptCodeMap: Map<number, string>
): ProfessorDisambiguationCandidate[] {
  const rmpTokens = tokenizePersonName(`${firstName} ${lastName}`);
  const rmpFirstTokens = tokenizePersonName(firstName);
  const rmpLastTokens = tokenizePersonName(lastName);
  const rmpFirst = rmpFirstTokens[0] ?? rmpTokens[0] ?? "";
  const rmpLast = rmpLastTokens[rmpLastTokens.length - 1] ?? rmpTokens[rmpTokens.length - 1] ?? "";
  if (!rmpLast) return [];

  const out: ProfessorDisambiguationCandidate[] = [];
  for (const inst of instructors) {
    const tokens = tokenizePersonName(inst.name);
    if (tokens.length === 0) continue;

    const instFirst = tokens[0]!;
    const instLast = tokens[tokens.length - 1]!;
    if (instLast !== rmpLast) continue;

    const firstExact = Boolean(rmpFirst) && instFirst === rmpFirst;
    const firstNickname = Boolean(rmpFirst) && areLikelySameFirstName(instFirst, rmpFirst);
    const sameInitial =
      Boolean(rmpFirst) &&
      instFirst.length > 0 &&
      rmpFirst.length > 0 &&
      instFirst[0] === rmpFirst[0];
    const firstScore = firstExact ? 3 : firstNickname ? 2 : sameInitial ? 1 : 0;
    if (firstScore === 0) continue;

    out.push({
      instructorId: inst.id,
      deptMatch: hasDepartmentSignal(rmpDepartment, inst.departmentId, deptCodeMap),
      firstScore,
      similarity: firstNameSimilarity(instFirst, rmpFirst),
    });
  }

  out.sort((a, b) => {
    if (a.deptMatch !== b.deptMatch) return a.deptMatch ? -1 : 1;
    if (a.firstScore !== b.firstScore) return b.firstScore - a.firstScore;
    if (a.similarity !== b.similarity) return b.similarity - a.similarity;
    return a.instructorId - b.instructorId;
  });

  return out;
}

export function matchProfessor(
  firstName: string,
  lastName: string,
  rmpDepartment: string,
  instructors: InstructorRow[],
  deptCodeMap: Map<number, string>
): MatchResult | null {
  const rmpNorm = normalizeName(`${firstName} ${lastName}`);
  const rmpTokens = tokenizePersonName(`${firstName} ${lastName}`);
  const rmpFirstTokens = tokenizePersonName(firstName);
  const rmpLastTokens = tokenizePersonName(lastName);
  const rmpFirst = rmpFirstTokens[0] ?? rmpTokens[0] ?? "";
  const rmpLast = rmpLastTokens[rmpLastTokens.length - 1] ?? rmpTokens[rmpTokens.length - 1] ?? "";

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

  for (const inst of instructors) {
    const instNorm = normalizeName(inst.name);
    const maxLen = Math.max(rmpNorm.length, instNorm.length);
    if (maxLen === 0) continue;

    const dist = distance(rmpNorm, instNorm);
    const similarity = 1 - dist / maxLen;

    if (similarity >= THRESHOLD) {
      const deptMatch = hasDepartmentSignal(
        rmpDepartment,
        inst.departmentId,
        deptCodeMap
      );

      candidates.push({ id: inst.id, similarity, deptMatch });
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => {
      if (a.deptMatch !== b.deptMatch) return a.deptMatch ? -1 : 1;
      return b.similarity - a.similarity;
    });
    return { instructorId: candidates[0].id, confidence: "fuzzy" };
  }

  // Pass 3: conservative fallback for nickname/short-name cases.
  // Requires matching last name and a compatible first-name signal.
  type LastNameCandidate = {
    id: number;
    deptMatch: boolean;
    firstScore: number;
    similarity: number;
  };
  const lastNameCandidates: LastNameCandidate[] = [];

  for (const inst of instructors) {
    const tokens = tokenizePersonName(inst.name);
    if (tokens.length === 0) continue;

    const instFirst = tokens[0]!;
    const instLast = tokens[tokens.length - 1]!;
    if (!rmpLast || instLast !== rmpLast) continue;

    const deptMatch = hasDepartmentSignal(
      rmpDepartment,
      inst.departmentId,
      deptCodeMap
    );
    const firstExact = Boolean(rmpFirst) && instFirst === rmpFirst;
    const firstNickname = Boolean(rmpFirst) && areLikelySameFirstName(instFirst, rmpFirst);
    const sameInitial =
      Boolean(rmpFirst) &&
      instFirst.length > 0 &&
      rmpFirst.length > 0 &&
      instFirst[0] === rmpFirst[0];

    const firstScore = firstExact ? 3 : firstNickname ? 2 : sameInitial ? 1 : 0;
    if (firstScore === 0) continue;

    lastNameCandidates.push({
      id: inst.id,
      deptMatch,
      firstScore,
      similarity: firstNameSimilarity(instFirst, rmpFirst),
    });
  }

  if (lastNameCandidates.length === 0) return null;

  lastNameCandidates.sort((a, b) => {
    if (a.deptMatch !== b.deptMatch) return a.deptMatch ? -1 : 1;
    if (a.firstScore !== b.firstScore) return b.firstScore - a.firstScore;
    return b.similarity - a.similarity;
  });

  if (lastNameCandidates.length === 1) {
    return { instructorId: lastNameCandidates[0].id, confidence: "fuzzy" };
  }

  const best = lastNameCandidates[0]!;
  const next = lastNameCandidates[1]!;
  const bestWinsClearly =
    (best.deptMatch && !next.deptMatch) ||
    best.firstScore > next.firstScore ||
    best.similarity - next.similarity >= 0.15;

  if (!bestWinsClearly) return null;
  return { instructorId: best.id, confidence: "fuzzy" };
}

interface CourseRow {
  id: number;
  code: string;
  title: string;
  departmentId: number | null;
}

function normalizeCourseText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

type DeptCourseToken = {
  deptCode: string;
  courseNumber: string;
  courseSuffix: string;
};

function extractDeptCourseTokens(
  text: string,
  validDeptCodes?: Set<string>
): DeptCourseToken[] {
  const out: DeptCourseToken[] = [];
  const seen = new Set<string>();
  const regex = /\b([A-Za-z]{2,8})\s*[- ]?\s*(\d{3})([A-Za-z]{0,2})\b/g;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(text)) !== null) {
    const deptCode = String(m[1] ?? "").toUpperCase();
    const courseNumber = String(m[2] ?? "");
    const courseSuffix = String(m[3] ?? "").toUpperCase();
    if (!deptCode || !courseNumber) continue;
    if (validDeptCodes && !validDeptCodes.has(deptCode)) continue;

    const key = `${deptCode}:${courseNumber}:${courseSuffix}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ deptCode, courseNumber, courseSuffix });
  }

  return out;
}

function extractCourseNumbers(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const regex = /\b(\d{3})(?:[A-Za-z]{1,2})?\b/g;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(text)) !== null) {
    const courseNumber = String(m[1] ?? "");
    if (!courseNumber || seen.has(courseNumber)) continue;
    seen.add(courseNumber);
    out.push(courseNumber);
  }

  return out;
}

function parseLocalCourseCode(code: string): DeptCourseToken | null {
  const m = /\b([A-Za-z]{2,8})\s*[- ]?\s*(\d{3})([A-Za-z]{0,2})\b/.exec(code);
  if (!m) return null;

  const deptCode = String(m[1] ?? "").toUpperCase();
  const courseNumber = String(m[2] ?? "");
  const courseSuffix = String(m[3] ?? "").toUpperCase();
  if (!deptCode || !courseNumber) return null;
  return { deptCode, courseNumber, courseSuffix };
}

function tokenMatchesCourseCode(
  token: DeptCourseToken,
  parsed: DeptCourseToken,
  options?: { ignoreSuffix?: boolean }
): boolean {
  if (
    token.deptCode !== parsed.deptCode ||
    token.courseNumber !== parsed.courseNumber
  ) {
    return false;
  }
  if (options?.ignoreSuffix) return true;
  if (!token.courseSuffix) return true;
  return token.courseSuffix === parsed.courseSuffix;
}

export function matchCourse(
  rmpCourseName: string,
  instructorDeptId: number | null,
  courses: CourseRow[],
  deptCodeMap: Map<number, string>,
  reviewText?: string | null
): number | null {
  const norm = normalizeCourseText(rmpCourseName);
  const reviewNorm = normalizeCourseText(String(reviewText ?? ""));
  const combined = `${norm} ${reviewNorm}`.trim();

  const validDeptCodes = new Set(
    Array.from(deptCodeMap.values()).map((v) => String(v).trim().toUpperCase())
  );

  // Pass 0a: explicit code match from class text or review text (e.g. "MKT 340")
  const deptCourseTokens = extractDeptCourseTokens(combined, validDeptCodes);
  if (deptCourseTokens.length > 0) {
    const strictCodeMatches = courses.filter((course) => {
      const parsed = parseLocalCourseCode(course.code);
      if (!parsed) return false;
      return deptCourseTokens.some(
        (token) => tokenMatchesCourseCode(token, parsed)
      );
    });
    const relaxedCodeMatches =
      strictCodeMatches.length > 0
        ? strictCodeMatches
        : courses.filter((course) => {
            const parsed = parseLocalCourseCode(course.code);
            if (!parsed) return false;
            return deptCourseTokens.some((token) =>
              tokenMatchesCourseCode(token, parsed, { ignoreSuffix: true })
            );
          });

    if (relaxedCodeMatches.length === 1) return relaxedCodeMatches[0].id;
    if (relaxedCodeMatches.length > 1) {
      const sameDept = relaxedCodeMatches.find(
        (course) => course.departmentId === instructorDeptId
      );
      return sameDept?.id ?? relaxedCodeMatches[0].id;
    }
  }

  // Pass 0b: if no explicit dept code found, try instructor dept + any 3-digit course number.
  if (typeof instructorDeptId === "number") {
    const instructorDeptCode = deptCodeMap.get(instructorDeptId)?.toUpperCase();
    if (instructorDeptCode) {
      const numbers = extractCourseNumbers(combined);
      if (numbers.length > 0) {
        const deptNumberMatches = courses.filter((course) => {
          const parsed = parseLocalCourseCode(course.code);
          return (
            parsed !== null &&
            parsed.deptCode === instructorDeptCode &&
            numbers.includes(parsed.courseNumber)
          );
        });

        if (deptNumberMatches.length === 1) return deptNumberMatches[0].id;
        if (deptNumberMatches.length > 1) return deptNumberMatches[0].id;
      }
    }
  }

  // Exact title match
  const exact = courses.filter((c) => normalizeCourseText(c.title) === norm);
  if (exact.length === 1) return exact[0].id;
  if (exact.length > 1) {
    const sameDept = exact.find((c) => c.departmentId === instructorDeptId);
    return sameDept?.id ?? exact[0].id;
  }

  // Substring match
  const substring = courses.filter(
    (c) =>
      normalizeCourseText(c.title).includes(norm) ||
      norm.includes(normalizeCourseText(c.title))
  );
  if (substring.length === 1) return substring[0].id;
  if (substring.length > 1) {
    const sameDept = substring.find((c) => c.departmentId === instructorDeptId);
    return sameDept?.id ?? substring[0].id;
  }

  return null;
}
