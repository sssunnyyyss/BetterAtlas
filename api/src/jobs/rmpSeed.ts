/**
 * RMP Seed Script
 *
 * Imports professor data and student reviews from RateMyProfessor for Emory University,
 * matches them against our local instructor/course catalogue, and stores everything in
 * the BetterAtlas database.
 *
 * Usage:
 *   pnpm --filter api rmp:seed
 *
 * Environment variables (all optional):
 *   RMP_SCHOOL_NAME   — Override school name (default "Emory University")
 *   RMP_CHECKPOINT     — Path to checkpoint file (default "api/rmp-checkpoint.json")
 *
 * The script is idempotent: reviews use onConflictDoNothing on externalId, and
 * rmpProfessors upserts on the instructorId primary key.
 *
 * Checkpoint support lets you resume from where you left off if the script is
 * interrupted partway through.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db, dbClient } from "../db/index.js";
import {
  users,
  instructors,
  departments,
  courses,
  sections,
  sectionInstructors,
  terms,
  reviews,
  courseRatings,
  courseInstructorRatings,
  instructorRatings,
  rmpProfessors,
  rmpProfessorTags,
} from "../db/schema.js";
import {
  matchProfessor,
  matchCourse,
  listProfessorDisambiguationCandidates,
  type ProfessorDisambiguationCandidate,
} from "../lib/rmpMatching.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000001";
const SCHOOL_NAME = (process.env.RMP_SCHOOL_NAME ?? "Emory University").trim();
const CHECKPOINT_PATH = resolve(
  process.env.RMP_CHECKPOINT ?? "rmp-checkpoint.json"
);
const RATE_DELAY_MS = 300;
const ONLY_INSTRUCTOR_IDS = parseCsvIntSet(process.env.RMP_ONLY_INSTRUCTOR_IDS);
const ONLY_RMP_TEACHER_IDS = parseCsvSet(process.env.RMP_ONLY_TEACHER_IDS);
// Manual catalog renumbering map: legacy course code -> canonical course code.
// Keep this intentionally narrow and explicit.
const LEGACY_COURSE_CODE_ALIAS: Record<string, string> = {
  "OAM 499R": "OAM 464",
};
const API_LINK = "https://www.ratemyprofessors.com/graphql";
const HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0",
  Accept: "*/*",
  "Accept-Language": "en-US,en;q=0.5",
  "Content-Type": "application/json",
  Authorization: "Basic dGVzdDp0ZXN0",
  "Sec-GPC": "1",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin",
  Priority: "u=4",
};
const LETTER_GRADE_POINTS: Record<string, number> = {
  "A+": 4.0,
  A: 4.0,
  "A-": 3.7,
  "B+": 3.3,
  B: 3.0,
  "B-": 2.7,
  "C+": 2.3,
  C: 2.0,
  "C-": 1.7,
  "D+": 1.3,
  D: 1.0,
  "D-": 0.7,
  F: 0.0,
};

const TEACHER_LIST_PAGINATED = `
  query TeacherSearchResultsPageQuery(
    $query: TeacherSearchQuery!
    $schoolID: ID
    $includeSchoolFilter: Boolean!
    $after: String
  ) {
    search: newSearch {
      teachers(query: $query, first: 1000, after: $after) {
        edges {
          node {
            id
            legacyId
            firstName
            lastName
            department
            avgRating
            numRatings
            wouldTakeAgainPercent
            avgDifficulty
            school {
              name
              id
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
    school: node(id: $schoolID) @include(if: $includeSchoolFilter) {
      __typename
      ... on School {
        name
      }
      id
    }
  }
`;

const SCHOOL_SEARCH_QUERY = `
  query NewSearchSchoolsQuery($query: SchoolSearchQuery!) {
    newSearch {
      schools(query: $query) {
        edges {
          node {
            id
            name
          }
        }
      }
    }
  }
`;

const TEACHER_RATING_QUERY = `query RatingsListQuery(
  $count: Int!
  $id: ID!
  $courseFilter: String
  $cursor: String
) {
  node(id: $id) {
    __typename
    ... on Teacher {
      firstName
      lastName
      department
      school {
        name
        city
        state
      }
      ratings(first: $count, after: $cursor, courseFilter: $courseFilter) {
        edges {
          node {
            comment
            class
            date
            helpfulRating
            clarityRating
            difficultyRating
            grade
            wouldTakeAgain
            isForOnlineClass
            isForCredit
            attendanceMandatory
            textbookUse
            ratingTags
            thumbsUpTotal
            thumbsDownTotal
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
}`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function jitter(base: number): number {
  const spread = Math.max(30, Math.floor(base * 0.3));
  return base + Math.floor(Math.random() * spread);
}

function parseCsvSet(raw: string | undefined): Set<string> | null {
  if (!raw) return null;
  const values = raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  if (values.length === 0) return null;
  return new Set(values);
}

function parseCsvIntSet(raw: string | undefined): Set<number> | null {
  const values = parseCsvSet(raw);
  if (!values) return null;
  const out = new Set<number>();
  for (const value of values) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) out.add(parsed);
  }
  return out.size > 0 ? out : null;
}

async function rateLimitedPause() {
  await sleep(jitter(RATE_DELAY_MS));
}

async function retrieveSchoolId(schoolName: string): Promise<string> {
  const response = await fetch(API_LINK, {
    credentials: "include",
    headers: HEADERS,
    body: JSON.stringify({
      query: SCHOOL_SEARCH_QUERY,
      variables: {
        query: {
          text: schoolName,
        },
      },
    }),
    method: "POST",
    mode: "cors",
  });

  if (!response.ok) {
    throw new Error(`RMP school lookup failed: ${response.status} ${response.statusText}`);
  }

  const body: any = await response.json();
  const edges: Array<{ node?: { id?: string; name?: string } }> =
    body?.data?.newSearch?.schools?.edges ?? [];

  const normalized = schoolName.trim().toLowerCase();
  const exact = edges.find(
    (edge) => String(edge?.node?.name ?? "").trim().toLowerCase() === normalized
  );
  const picked = exact ?? edges[0];
  const schoolId = String(picked?.node?.id ?? "").trim();
  if (!schoolId) {
    throw new Error(`RMP school lookup returned no results for "${schoolName}"`);
  }
  return schoolId;
}

/** Clamp a number to [min, max] and round to nearest 0.5. */
function clampHalfStep(val: number, min: number, max: number): number {
  const bounded = Math.min(max, Math.max(min, val));
  return Math.round(bounded * 2) / 2;
}

/**
 * Keep external review IDs deterministic and <= 40 chars to fit reviews.external_id.
 */
function buildRmpExternalId(
  legacyTeacherId: number | string,
  dateStr: string,
  reviewIndex: number
): string {
  const raw = `${legacyTeacherId}|${dateStr}|${reviewIndex}`;
  const digest = createHash("sha1").update(raw).digest("hex").slice(0, 36);
  return `rmp-${digest}`;
}

function parseRmpTags(raw: unknown): string[] {
  const value = String(raw ?? "").trim();
  if (!value) return [];

  const normalizeTagToken = (token: string): string =>
    token
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const canonicalizeRmpTag = (token: string): string | null => {
    const t = normalizeTagToken(token);
    if (!t) return null;

    if (t.includes("tough grader") || t.includes("tests are tough")) {
      return "Tough Grader";
    }
    if (t.includes("get ready to read")) {
      return "Get Ready To Read";
    }
    if (
      t.includes("participation matters") ||
      t.startsWith("participatio") ||
      t === "matters"
    ) {
      return "Participation Matters";
    }
    if (t.includes("extra credit")) {
      return "Extra Credit";
    }
    if (t.includes("group projects")) {
      return "Group Projects";
    }
    if (t.includes("amazing lectures") || t.startsWith("amazi") || t === "g lectures") {
      return "Amazing Lectures";
    }
    if (
      t.includes("clear grading criteria") ||
      t.startsWith("clear gradi") ||
      t === "g criteria"
    ) {
      return "Clear Grading Criteria";
    }
    if (t.includes("gives good feedback")) {
      return "Gives Good Feedback";
    }
    if (t.includes("inspirational") || t.startsWith("spiratio")) {
      return "Inspirational";
    }
    if (t.includes("lots of homework")) {
      return "Lots Of Homework";
    }
    if (t.includes("hilarious")) {
      return "Hilarious";
    }
    if (t.includes("beware of pop quizzes")) {
      return "Beware Of Pop Quizzes";
    }
    if (t.includes("so many papers") || t.startsWith("so ma") || t === "y papers") {
      return "So Many Papers";
    }
    if (t.includes("caring") || t === "cari" || t.includes("cares about students")) {
      return "Caring";
    }
    if (t.includes("respected")) {
      return "Respected";
    }
    if (t.includes("lecture heavy")) {
      return "Lecture Heavy";
    }
    if (t.includes("test heavy")) {
      return "Test Heavy";
    }
    if (
      t.includes("graded by few things") ||
      t.startsWith("graded by few thi") ||
      t === "gs"
    ) {
      return "Graded By Few Things";
    }
    if (t.includes("accessible outside class")) {
      return "Accessible Outside Class";
    }
    if (t.includes("online savvy") || t === "e savvy") {
      return "Online Savvy";
    }

    return null;
  };

  const tags: string[] = [];
  const seen = new Set<string>();
  for (const tag of value
    .split(/\s*--\s*|[,\n;]+/)
    .map((t) => t.trim())
    .filter(Boolean)) {
    const canonical = canonicalizeRmpTag(tag);
    if (!canonical) continue;
    const key = canonical.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(canonical);
  }
  return tags;
}

function parseRmpDate(raw: string | null): Date | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;

  const normalized = value
    .replace(/\s+UTC$/i, "")
    .replace(
      /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+([+-]\d{2})(\d{2})$/,
      "$1T$2$3:$4"
    );

  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  const fallback = new Date(value);
  if (!Number.isNaN(fallback.getTime())) return fallback;
  return null;
}

function normalizeReportedGrade(raw: unknown): string | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;

  const canonical = /\b(A\+|A-|A|B\+|B-|B|C\+|C-|C|D\+|D-|D|F)\b/i.exec(value)?.[1];
  if (canonical) return canonical.toUpperCase();

  return value.toUpperCase().slice(0, 12);
}

function toGradePoints(reportedGrade: string | null): number | null {
  if (!reportedGrade) return null;
  const canonical = /\b(A\+|A-|A|B\+|B-|B|C\+|C-|C|D\+|D-|D|F)\b/i.exec(reportedGrade)?.[1];
  if (!canonical) return null;
  const points = LETTER_GRADE_POINTS[canonical.toUpperCase()];
  return typeof points === "number" ? points : null;
}

function seasonSortOrder(season: string | null): number {
  switch (String(season ?? "").toLowerCase()) {
    case "winter":
      return 0;
    case "spring":
      return 1;
    case "summer":
      return 2;
    case "fall":
      return 3;
    default:
      return 4;
  }
}

function termAnchorMs(year: number, season: string | null): number {
  const normalized = String(season ?? "").toLowerCase();
  switch (normalized) {
    case "winter":
      return Date.UTC(year, 0, 15);
    case "spring":
      return Date.UTC(year, 2, 15);
    case "summer":
      return Date.UTC(year, 5, 15);
    case "fall":
      return Date.UTC(year, 9, 1);
    default:
      return Date.UTC(year, 6, 1);
  }
}

type SectionCandidate = {
  id: number;
  courseId: number;
  termCode: string;
  termRank: number;
  anchorMs: number | null;
  instructorIds: Set<number>;
};

type TermSnapshot = {
  code: string;
  rank: number;
  anchorMs: number;
};

type ParsedCourseCode = {
  deptCode: string;
  courseNumber: string;
  courseSuffix: string;
};

function parseCourseCodeToken(value: string): ParsedCourseCode | null {
  const m = /\b([A-Za-z]{2,8})\s*[- ]?\s*(\d{3})([A-Za-z]{0,2})\b/.exec(value);
  if (!m) return null;

  const deptCode = String(m[1] ?? "").toUpperCase();
  const courseNumber = String(m[2] ?? "");
  const courseSuffix = String(m[3] ?? "").toUpperCase();
  if (!deptCode || !courseNumber) return null;
  return { deptCode, courseNumber, courseSuffix };
}

function normalizeCourseCodeKey(value: string): string {
  return String(value ?? "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function buildPreferredCourseIdByCode(
  allCourses: Array<{ id: number; code: string }>
): Map<string, number> {
  const map = new Map<string, number>();
  for (const course of allCourses) {
    const key = normalizeCourseCodeKey(course.code);
    if (!key) continue;
    const prev = map.get(key);
    if (typeof prev !== "number" || course.id < prev) {
      map.set(key, course.id);
    }
  }
  return map;
}

function remapLegacyCourseId(input: {
  courseId: number;
  coursesById: Map<number, { id: number; code: string }>;
  preferredCourseIdByCode: Map<string, number>;
}): number {
  const sourceCourse = input.coursesById.get(input.courseId);
  if (!sourceCourse) return input.courseId;
  const sourceCode = normalizeCourseCodeKey(sourceCourse.code);
  const aliasCode = LEGACY_COURSE_CODE_ALIAS[sourceCode];
  if (!aliasCode) return input.courseId;
  const canonicalId = input.preferredCourseIdByCode.get(normalizeCourseCodeKey(aliasCode));
  return typeof canonicalId === "number" ? canonicalId : input.courseId;
}

function extractCourseNumbers(value: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const re = /\b(\d{3})(?:[A-Za-z]{0,2})\b/g;
  for (const m of value.matchAll(re)) {
    const num = String(m[1] ?? "").trim();
    if (!num || seen.has(num)) continue;
    seen.add(num);
    out.push(num);
  }
  return out;
}

function pickInstructorCourseFromNumberSignal(input: {
  rmpClassLabel: string;
  reviewComment: string | null;
  taughtCourseIds: Set<number>;
  coursesById: Map<number, { id: number; code: string }>;
}): number | null {
  if (input.taughtCourseIds.size === 0) return null;
  const signal = `${input.rmpClassLabel} ${String(input.reviewComment ?? "")}`.trim();
  const numbers = extractCourseNumbers(signal);
  if (numbers.length === 0) return null;

  const matches = new Set<number>();
  for (const courseId of input.taughtCourseIds) {
    const course = input.coursesById.get(courseId);
    if (!course) continue;
    const parsed = parseCourseCodeToken(course.code);
    if (!parsed) continue;
    if (numbers.includes(parsed.courseNumber)) {
      matches.add(courseId);
    }
  }

  if (matches.size === 1) return Array.from(matches)[0]!;
  return null;
}

function priorAcademicTermRankForReviewDate(reviewDate: Date | null): number | null {
  const reviewMs = reviewDate?.getTime();
  if (typeof reviewMs !== "number" || !Number.isFinite(reviewMs)) return null;

  const year = reviewDate!.getUTCFullYear();
  const month = reviewDate!.getUTCMonth();

  // Reviews are usually posted after the class ends:
  // spring-date reviews belong to prior fall, fall-date reviews belong to spring.
  if (month <= 4) {
    // Jan-May => spring review window => prior fall
    return (year - 1) * 10 + seasonSortOrder("fall");
  }
  if (month <= 7) {
    // Jun-Aug => summer review window => prior spring
    return year * 10 + seasonSortOrder("spring");
  }
  // Sep-Dec => fall review window => prior spring
  return year * 10 + seasonSortOrder("spring");
}

function pickLatestCandidateByTermRank(
  candidates: SectionCandidate[],
  preferredAnchorMs: number | null
): SectionCandidate {
  let picked = candidates[0];

  for (const candidate of candidates.slice(1)) {
    if (candidate.termRank > picked.termRank) {
      picked = candidate;
      continue;
    }
    if (candidate.termRank < picked.termRank) {
      continue;
    }

    if (
      typeof preferredAnchorMs === "number" &&
      Number.isFinite(preferredAnchorMs) &&
      typeof candidate.anchorMs === "number" &&
      typeof picked.anchorMs === "number"
    ) {
      const candidateDelta = Math.abs(preferredAnchorMs - candidate.anchorMs);
      const pickedDelta = Math.abs(preferredAnchorMs - picked.anchorMs);
      if (candidateDelta < pickedDelta) {
        picked = candidate;
        continue;
      }
      if (candidateDelta > pickedDelta) {
        continue;
      }
    }

    if (candidate.id < picked.id) {
      picked = candidate;
    }
  }

  return picked;
}

function pickFallbackTermCode(
  priorTermRank: number | null,
  availableTerms: TermSnapshot[]
): string | null {
  if (availableTerms.length === 0) return null;

  if (typeof priorTermRank !== "number" || !Number.isFinite(priorTermRank)) {
    return availableTerms[availableTerms.length - 1]?.code ?? null;
  }

  const eligible = availableTerms.filter((term) => term.rank <= priorTermRank);
  if (eligible.length > 0) {
    return eligible[eligible.length - 1]!.code;
  }

  // If historical data starts later than the review date, pin to the oldest term
  // so the review still has a semester label.
  return availableTerms[0]!.code;
}

function assignClosestSectionForReview(
  courseId: number,
  instructorId: number,
  reviewDate: Date | null,
  sectionsByCourseId: Map<number, SectionCandidate[]>,
  availableTerms: TermSnapshot[]
): { sectionId: number | null; termCode: string | null } {
  const courseSections = sectionsByCourseId.get(courseId) ?? [];
  const reviewMs = reviewDate?.getTime();
  const reviewMsFinite = typeof reviewMs === "number" && Number.isFinite(reviewMs);
  const priorTermRank = priorAcademicTermRankForReviewDate(reviewDate);
  const fallbackTermCode = pickFallbackTermCode(priorTermRank, availableTerms);

  if (courseSections.length === 0) {
    return { sectionId: null, termCode: fallbackTermCode };
  }

  const taughtByInstructor = courseSections.filter((section) =>
    section.instructorIds.has(instructorId)
  );
  if (taughtByInstructor.length === 0) {
    // Never attach a review to another instructor's section.
    // If we can't find an instructor-owned section in our local term window,
    // keep section_id null and only assign a fallback term label.
    return { sectionId: null, termCode: fallbackTermCode };
  }
  const pool = taughtByInstructor;

  if (typeof priorTermRank === "number" && Number.isFinite(priorTermRank)) {
    const priorPool = pool.filter((section) => section.termRank <= priorTermRank);
    if (priorPool.length > 0) {
      const pickedPrior = pickLatestCandidateByTermRank(
        priorPool,
        reviewMsFinite ? reviewMs : null
      );
      return {
        sectionId: pickedPrior.id,
        termCode: pickedPrior.termCode,
      };
    }

    return { sectionId: null, termCode: fallbackTermCode };
  }

  let picked = pool[0];

  if (reviewMsFinite) {
    for (const candidate of pool.slice(1)) {
      const pickedDelta =
        typeof picked.anchorMs === "number"
          ? Math.abs(reviewMs - picked.anchorMs)
          : Number.POSITIVE_INFINITY;
      const candidateDelta =
        typeof candidate.anchorMs === "number"
          ? Math.abs(reviewMs - candidate.anchorMs)
          : Number.POSITIVE_INFINITY;

      if (candidateDelta < pickedDelta) {
        picked = candidate;
        continue;
      }
      if (candidateDelta === pickedDelta) {
        if (candidate.termRank > picked.termRank) {
          picked = candidate;
          continue;
        }
        if (candidate.termRank === picked.termRank && candidate.id < picked.id) {
          picked = candidate;
        }
      }
    }
  } else {
    for (const candidate of pool.slice(1)) {
      if (candidate.termRank > picked.termRank) {
        picked = candidate;
        continue;
      }
      if (candidate.termRank === picked.termRank && candidate.id < picked.id) {
        picked = candidate;
      }
    }
  }

  return {
    sectionId: picked.id,
    termCode: picked.termCode,
  };
}

function resolveCourseIdWithSectionContext(
  rmpClassLabel: string,
  matchedCourseId: number,
  instructorId: number,
  reviewDate: Date | null,
  allCourses: Array<{ id: number; code: string }>,
  sectionsByCourseId: Map<number, SectionCandidate[]>,
  availableTerms: TermSnapshot[]
): number {
  const parsedTarget = parseCourseCodeToken(rmpClassLabel);
  if (!parsedTarget) return matchedCourseId;

  const candidateIds = allCourses
    .filter((course) => {
      const parsedLocal = parseCourseCodeToken(course.code);
      if (!parsedLocal) return false;
      if (
        parsedLocal.deptCode !== parsedTarget.deptCode ||
        parsedLocal.courseNumber !== parsedTarget.courseNumber
      ) {
        return false;
      }
      if (!parsedTarget.courseSuffix) return true;
      return parsedLocal.courseSuffix === parsedTarget.courseSuffix;
    })
    .map((course) => course.id);

  if (candidateIds.length <= 1) return matchedCourseId;

  const reviewMs = reviewDate?.getTime();
  const reviewMsFinite = typeof reviewMs === "number" && Number.isFinite(reviewMs);

  let bestCourseId = matchedCourseId;
  let bestHasInstructor = false;
  let bestDelta = Number.POSITIVE_INFINITY;
  let bestTermRank = Number.NEGATIVE_INFINITY;

  for (const candidateId of candidateIds) {
    const sectionMatch = assignClosestSectionForReview(
      candidateId,
      instructorId,
      reviewDate,
      sectionsByCourseId,
      availableTerms
    );
    const sections = sectionsByCourseId.get(candidateId) ?? [];
    const chosenSection =
      sections.find((section) => section.id === sectionMatch.sectionId) ?? null;

    const hasInstructor = Boolean(chosenSection?.instructorIds.has(instructorId));
    const delta =
      reviewMsFinite && typeof chosenSection?.anchorMs === "number"
        ? Math.abs(reviewMs - chosenSection.anchorMs)
        : Number.POSITIVE_INFINITY;
    const termRank = chosenSection?.termRank ?? Number.NEGATIVE_INFINITY;

    const better =
      (hasInstructor ? 1 : 0) > (bestHasInstructor ? 1 : 0) ||
      ((hasInstructor ? 1 : 0) === (bestHasInstructor ? 1 : 0) &&
        (delta < bestDelta ||
          (delta === bestDelta &&
            (termRank > bestTermRank ||
              (termRank === bestTermRank && candidateId < bestCourseId)))));

    if (better) {
      bestCourseId = candidateId;
      bestHasInstructor = hasInstructor;
      bestDelta = delta;
      bestTermRank = termRank;
    }
  }

  return bestCourseId;
}

type InstructorReviewEvidence = {
  instructorId: number;
  deptMatch: boolean;
  score: number;
  matchedReviews: number;
  courseSignals: number;
  totalReviews: number;
};

function pickInstructorFromReviewEvidence(input: {
  candidates: ProfessorDisambiguationCandidate[];
  ratings: RmpRatingNode[];
  allCourses: Array<{ id: number; code: string; title: string; departmentId: number | null }>;
  deptCodeMap: Map<number, string>;
  instructorDeptMap: Map<number, number | null>;
  sectionsByCourseId: Map<number, SectionCandidate[]>;
  coursesByInstructorId: Map<number, Set<number>>;
  availableTerms: TermSnapshot[];
}): InstructorReviewEvidence | null {
  if (input.candidates.length < 2 || input.ratings.length === 0) return null;

  const coursesById = new Map(input.allCourses.map((course) => [course.id, course] as const));

  const evidenceRows: InstructorReviewEvidence[] = input.candidates.map((candidate) => {
    let score = candidate.deptMatch ? 1 : 0;
    let matchedReviews = 0;
    let courseSignals = 0;

    const taughtCourses = input.coursesByInstructorId.get(candidate.instructorId) ?? new Set<number>();

    for (const rating of input.ratings) {
      const rmpClass = String(rating.class ?? "").trim();
      const reviewDate = parseRmpDate(rating.date);
      const matchedCourseId = matchCourse(
        rmpClass,
        input.instructorDeptMap.get(candidate.instructorId) ?? null,
        input.allCourses,
        input.deptCodeMap,
        rating.comment
      );
      if (!matchedCourseId) continue;
      courseSignals++;

      const resolvedCourseId = resolveCourseIdWithSectionContext(
        rmpClass,
        matchedCourseId,
        candidate.instructorId,
        reviewDate,
        input.allCourses,
        input.sectionsByCourseId,
        input.availableTerms
      );

      if (taughtCourses.has(resolvedCourseId)) {
        score += 4;
        matchedReviews++;
        continue;
      }
      if (taughtCourses.has(matchedCourseId)) {
        score += 3;
        matchedReviews++;
        continue;
      }

      const codeSignal = parseCourseCodeToken(`${rmpClass} ${String(rating.comment ?? "")}`);
      if (!codeSignal) continue;

      for (const courseId of taughtCourses) {
        const course = coursesById.get(courseId);
        if (!course) continue;
        const parsedCourse = parseCourseCodeToken(course.code);
        if (!parsedCourse) continue;
        if (
          parsedCourse.deptCode === codeSignal.deptCode &&
          parsedCourse.courseNumber === codeSignal.courseNumber
        ) {
          score += 1;
          matchedReviews++;
          break;
        }
      }
    }

    return {
      instructorId: candidate.instructorId,
      deptMatch: candidate.deptMatch,
      score,
      matchedReviews,
      courseSignals,
      totalReviews: input.ratings.length,
    };
  });

  evidenceRows.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    if (a.matchedReviews !== b.matchedReviews) return b.matchedReviews - a.matchedReviews;
    if (a.courseSignals !== b.courseSignals) return b.courseSignals - a.courseSignals;
    if (a.deptMatch !== b.deptMatch) return a.deptMatch ? -1 : 1;
    return a.instructorId - b.instructorId;
  });

  const best = evidenceRows[0];
  if (!best) return null;

  const second = evidenceRows[1] ?? null;
  const bestCoverage =
    best.courseSignals > 0 ? best.matchedReviews / best.courseSignals : 0;

  const clearWin =
    best.score >= 6 &&
    best.matchedReviews >= 2 &&
    bestCoverage >= 0.4 &&
    (!second ||
      (best.score - second.score >= 2 &&
        best.matchedReviews - second.matchedReviews >= 1));

  if (!clearWin) return null;
  return best;
}

// ---------------------------------------------------------------------------
// Checkpoint persistence
// ---------------------------------------------------------------------------

interface Checkpoint {
  /** Set of "instructorId" strings that have already been fully processed. */
  processedInstructorIds: string[];
}

function loadCheckpoint(): Set<string> {
  if (!existsSync(CHECKPOINT_PATH)) return new Set();
  try {
    const raw = readFileSync(CHECKPOINT_PATH, "utf-8");
    const data: Checkpoint = JSON.parse(raw);
    console.log(
      `[rmpSeed] loaded checkpoint with ${data.processedInstructorIds.length} processed instructors`
    );
    return new Set(data.processedInstructorIds);
  } catch {
    console.warn("[rmpSeed] could not parse checkpoint file, starting fresh");
    return new Set();
  }
}

function saveCheckpoint(processed: Set<string>) {
  const data: Checkpoint = {
    processedInstructorIds: Array.from(processed),
  };
  writeFileSync(CHECKPOINT_PATH, JSON.stringify(data, null, 2));
}

// ---------------------------------------------------------------------------
// RMP GraphQL helpers (use the library's auth headers + API endpoint directly
// so we can retain all fields the wrapper normally discards)
// ---------------------------------------------------------------------------

/** Raw teacher node as returned from the TEACHER_LIST GraphQL query. */
interface RmpTeacherNode {
  id: string; // Base64 encoded RMP ID
  legacyId: number;
  firstName: string;
  lastName: string;
  department: string;
  avgRating: number;
  numRatings: number;
  wouldTakeAgainPercent: number;
  avgDifficulty: number;
  school: { name: string; id: string };
}

/** Raw rating edge node from TEACHER_RATING_QUERY. */
interface RmpRatingNode {
  comment: string | null;
  class: string | null;
  date: string | null;
  helpfulRating: number;
  clarityRating: number;
  difficultyRating: number;
  grade: string | null;
  wouldTakeAgain: number; // 1 or 0 or -1
  isForOnlineClass: boolean;
  isForCredit: boolean;
  attendanceMandatory: string | null;
  textbookUse: number;
  ratingTags: string;
  thumbsUpTotal: number;
  thumbsDownTotal: number;
}

async function fetchAllProfessors(
  schoolId: string
): Promise<RmpTeacherNode[]> {
  const out: RmpTeacherNode[] = [];
  let cursor: string | null = "";
  let hasMore = true;

  while (hasMore) {
    await rateLimitedPause();

    const response = await fetch(API_LINK, {
      credentials: "include",
      headers: HEADERS as Record<string, string>,
      body: JSON.stringify({
        query: TEACHER_LIST_PAGINATED,
        variables: {
          query: {
            text: "",
            schoolID: schoolId,
            fallback: true,
            departmentID: null,
          },
          schoolID: schoolId,
          includeSchoolFilter: true,
          after: cursor,
        },
      }),
      method: "POST",
      mode: "cors",
    });

    if (!response.ok) {
      throw new Error(
        `RMP fetchAllProfessors failed: ${response.status} ${response.statusText}`
      );
    }

    const data: any = await response.json();
    const teachers = data?.data?.search?.teachers;
    const edges: Array<{ node: RmpTeacherNode }> = teachers?.edges ?? [];
    out.push(...edges.map((e) => e.node));

    const pageInfo: { hasNextPage?: boolean; endCursor?: string | null } =
      teachers?.pageInfo ?? {};
    hasMore = pageInfo.hasNextPage === true;
    cursor = pageInfo.endCursor ?? null;

    if (hasMore && !cursor) {
      // Guard against server returning hasNextPage=true without a cursor.
      hasMore = false;
    }
  }

  return out;
}

async function fetchProfessorRatings(
  teacherId: string
): Promise<RmpRatingNode[]> {
  const allRatings: RmpRatingNode[] = [];
  let cursor: string | null = null;
  let hasMore = true;

  while (hasMore) {
    await rateLimitedPause();

    const resp: Response = await fetch(API_LINK, {
      credentials: "include",
      headers: HEADERS as Record<string, string>,
      body: JSON.stringify({
        query: TEACHER_RATING_QUERY,
        variables: {
          count: 1000,
          id: teacherId,
          courseFilter: null,
          cursor,
        },
      }),
      method: "POST",
      mode: "cors",
    });

    if (!resp.ok) {
      throw new Error(
        `RMP fetchProfessorRatings failed: ${resp.status} ${resp.statusText}`
      );
    }

    const body: any = await resp.json();
    const teacher: any = body?.data?.node;
    if (!teacher?.ratings) break;

    const edges: Array<{ node: RmpRatingNode }> =
      teacher.ratings.edges ?? [];
    for (const edge of edges) {
      allRatings.push(edge.node);
    }

    const pageInfo: { hasNextPage?: boolean; endCursor?: string } =
      teacher.ratings.pageInfo;
    hasMore = pageInfo?.hasNextPage === true;
    cursor = pageInfo?.endCursor ?? null;
  }

  return allRatings;
}

// ---------------------------------------------------------------------------
// Aggregate refresh
// ---------------------------------------------------------------------------

async function refreshAggregates() {
  console.log("[rmpSeed] refreshing section_ratings...");
  await db.execute(sql`
    INSERT INTO section_ratings (section_id, avg_quality, avg_difficulty, avg_workload, review_count, updated_at)
    SELECT
      r.section_id,
      ROUND(AVG(r.rating_quality), 2),
      ROUND(AVG(r.rating_difficulty), 2),
      ROUND(AVG(r.rating_workload), 2),
      COUNT(*)::int,
      NOW()
    FROM reviews r
    WHERE r.section_id IS NOT NULL
    GROUP BY r.section_id
    ON CONFLICT (section_id) DO UPDATE SET
      avg_quality    = EXCLUDED.avg_quality,
      avg_difficulty = EXCLUDED.avg_difficulty,
      avg_workload   = EXCLUDED.avg_workload,
      review_count   = EXCLUDED.review_count,
      updated_at     = NOW()
  `);
  await db.execute(sql`
    DELETE FROM section_ratings sr
    WHERE NOT EXISTS (
      SELECT 1
      FROM reviews r
      WHERE r.section_id = sr.section_id
    )
  `);

  console.log("[rmpSeed] refreshing course_ratings...");
  await db.execute(sql`
    WITH review_agg AS (
      SELECT
        r.course_id,
        ROUND(AVG(r.rating_quality), 2) AS avg_quality,
        ROUND(AVG(r.rating_difficulty), 2) AS avg_difficulty_fallback,
        ROUND(AVG(r.rating_workload), 2) AS avg_workload,
        COUNT(*)::int AS review_count
      FROM reviews r
      GROUP BY r.course_id
    ),
    section_agg AS (
      SELECT
        s.course_id,
        ROUND(AVG(sr.avg_difficulty), 2) AS avg_difficulty_from_sections
      FROM section_ratings sr
      INNER JOIN sections s ON s.id = sr.section_id
      WHERE sr.avg_difficulty IS NOT NULL
      GROUP BY s.course_id
    )
    INSERT INTO course_ratings (course_id, avg_quality, avg_difficulty, avg_workload, review_count, updated_at)
    SELECT
      ra.course_id,
      ra.avg_quality,
      COALESCE(sa.avg_difficulty_from_sections, ra.avg_difficulty_fallback),
      ra.avg_workload,
      ra.review_count,
      NOW()
    FROM review_agg ra
    LEFT JOIN section_agg sa
      ON sa.course_id = ra.course_id
    ON CONFLICT (course_id) DO UPDATE SET
      avg_quality    = EXCLUDED.avg_quality,
      avg_difficulty = EXCLUDED.avg_difficulty,
      avg_workload   = EXCLUDED.avg_workload,
      review_count   = EXCLUDED.review_count,
      updated_at     = NOW()
  `);
  await db.execute(sql`
    DELETE FROM course_ratings cr
    WHERE NOT EXISTS (
      SELECT 1
      FROM reviews r
      WHERE r.course_id = cr.course_id
    )
  `);

  console.log("[rmpSeed] refreshing course_instructor_ratings...");
  await db.execute(sql`
    INSERT INTO course_instructor_ratings (course_id, instructor_id, avg_quality, avg_difficulty, avg_workload, review_count, updated_at)
    SELECT
      r.course_id,
      r.instructor_id,
      ROUND(AVG(r.rating_quality), 2),
      ROUND(AVG(r.rating_difficulty), 2),
      ROUND(AVG(r.rating_workload), 2),
      COUNT(*)::int,
      NOW()
    FROM reviews r
    WHERE r.instructor_id IS NOT NULL
    GROUP BY r.course_id, r.instructor_id
    ON CONFLICT (course_id, instructor_id) DO UPDATE SET
      avg_quality    = EXCLUDED.avg_quality,
      avg_difficulty = EXCLUDED.avg_difficulty,
      avg_workload   = EXCLUDED.avg_workload,
      review_count   = EXCLUDED.review_count,
      updated_at     = NOW()
  `);
  await db.execute(sql`
    DELETE FROM course_instructor_ratings cir
    WHERE NOT EXISTS (
      SELECT 1
      FROM reviews r
      WHERE r.course_id = cir.course_id
        AND r.instructor_id = cir.instructor_id
    )
  `);

  console.log("[rmpSeed] refreshing instructor_ratings...");
  await db.execute(sql`
    INSERT INTO instructor_ratings (instructor_id, avg_quality, review_count, updated_at)
    SELECT
      r.instructor_id,
      ROUND(AVG(r.rating_quality), 2),
      COUNT(*)::int,
      NOW()
    FROM reviews r
    WHERE r.instructor_id IS NOT NULL
    GROUP BY r.instructor_id
    ON CONFLICT (instructor_id) DO UPDATE SET
      avg_quality  = EXCLUDED.avg_quality,
      review_count = EXCLUDED.review_count,
      updated_at   = NOW()
  `);
  await db.execute(sql`
    DELETE FROM instructor_ratings ir
    WHERE NOT EXISTS (
      SELECT 1
      FROM reviews r
      WHERE r.instructor_id = ir.instructor_id
    )
  `);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const stats = {
    rmpProfessorsFound: 0,
    matched: 0,
    matchedExact: 0,
    matchedFuzzy: 0,
    unmatched: 0,
    reviewsImported: 0,
    reviewsUpdatedExisting: 0,
    reviewsSkippedNoCourse: 0,
    reviewsSkippedDuplicate: 0,
    reviewsRemovedStale: 0,
    tagsImported: 0,
  };

  // ---- 1. Ensure system user exists ---
  console.log("[rmpSeed] ensuring system user...");
  await db
    .insert(users)
    .values({
      id: SYSTEM_USER_ID,
      email: "system+rmp@betteratlas.app",
      username: "rmp-import",
      displayName: "RateMyProfessor Import",
      hasCompletedOnboarding: true,
    })
    .onConflictDoNothing();

  // ---- 2. Load local data ---
  console.log(
    "[rmpSeed] loading local instructors, departments, courses, terms, and sections..."
  );
  const allInstructors = await db
    .select({
      id: instructors.id,
      name: instructors.name,
      departmentId: instructors.departmentId,
    })
    .from(instructors);

  const allDepartments = await db
    .select({ id: departments.id, code: departments.code })
    .from(departments);

  const allCourses = await db
    .select({
      id: courses.id,
      code: courses.code,
      title: courses.title,
      departmentId: courses.departmentId,
    })
    .from(courses);
  const coursesById = new Map(allCourses.map((course) => [course.id, course] as const));
  const preferredCourseIdByCode = buildPreferredCourseIdByCode(allCourses);

  const allTerms = await db
    .select({
      srcdb: terms.srcdb,
      name: terms.name,
      season: terms.season,
      year: terms.year,
    })
    .from(terms);

  const allSections = await db
    .select({
      id: sections.id,
      courseId: sections.courseId,
      termCode: sections.termCode,
      instructorId: sections.instructorId,
      isActive: sections.isActive,
    })
    .from(sections);

  let allSectionInstructors: Array<{ sectionId: number; instructorId: number }> = [];
  try {
    allSectionInstructors = await db
      .select({
        sectionId: sectionInstructors.sectionId,
        instructorId: sectionInstructors.instructorId,
      })
      .from(sectionInstructors);
  } catch {
    console.warn(
      "[rmpSeed] section_instructors table unavailable; falling back to primary section instructor only"
    );
  }

  // Build lookup maps
  const deptCodeMap = new Map<number, string>();
  for (const d of allDepartments) {
    deptCodeMap.set(d.id, d.code);
  }

  const instructorDeptMap = new Map<number, number | null>();
  for (const instructor of allInstructors) {
    instructorDeptMap.set(instructor.id, instructor.departmentId ?? null);
  }

  const termMetaByCode = new Map<
    string,
    { anchorMs: number; termRank: number; name: string }
  >();
  const availableTerms: TermSnapshot[] = [];
  for (const term of allTerms) {
    const anchorMs = termAnchorMs(term.year, term.season ?? null);
    const termRank = term.year * 10 + seasonSortOrder(term.season ?? null);
    termMetaByCode.set(term.srcdb, {
      anchorMs,
      termRank,
      name: term.name,
    });
    availableTerms.push({
      code: term.srcdb,
      rank: termRank,
      anchorMs,
    });
  }
  availableTerms.sort((a, b) => a.rank - b.rank || a.anchorMs - b.anchorMs || a.code.localeCompare(b.code));

  const sectionsById = new Map<number, SectionCandidate>();
  const sectionsByCourseId = new Map<number, SectionCandidate[]>();
  for (const section of allSections) {
    const termMeta = termMetaByCode.get(section.termCode);
    const fallbackTermRank = Number(section.termCode) || -1;
    const candidate: SectionCandidate = {
      id: section.id,
      courseId: section.courseId,
      termCode: section.termCode,
      termRank: termMeta?.termRank ?? fallbackTermRank,
      anchorMs: termMeta?.anchorMs ?? null,
      instructorIds: new Set<number>(),
    };

    if (typeof section.instructorId === "number") {
      candidate.instructorIds.add(section.instructorId);
    }

    sectionsById.set(candidate.id, candidate);
    const courseSections = sectionsByCourseId.get(candidate.courseId) ?? [];
    courseSections.push(candidate);
    sectionsByCourseId.set(candidate.courseId, courseSections);
  }

  for (const roster of allSectionInstructors) {
    const section = sectionsById.get(roster.sectionId);
    if (!section) continue;
    section.instructorIds.add(roster.instructorId);
  }

  const coursesByInstructorId = new Map<number, Set<number>>();
  for (const section of sectionsById.values()) {
    for (const instructorId of section.instructorIds) {
      const taught = coursesByInstructorId.get(instructorId) ?? new Set<number>();
      taught.add(section.courseId);
      coursesByInstructorId.set(instructorId, taught);
    }
  }

  console.log(
    `[rmpSeed] local data: ${allInstructors.length} instructors, ${allDepartments.length} departments, ${allCourses.length} courses, ${allSections.length} sections, ${allTerms.length} terms`
  );

  // ---- 3. RMP school lookup ---
  console.log(`[rmpSeed] looking up school "${SCHOOL_NAME}" on RMP...`);
  await rateLimitedPause();
  const schoolId = await retrieveSchoolId(SCHOOL_NAME);
  console.log(`[rmpSeed] school ID: ${schoolId}`);

  // ---- 4. Fetch all professors from RMP ---
  console.log("[rmpSeed] fetching professor list from RMP...");
  await rateLimitedPause();
  const rmpProfessorsList = await fetchAllProfessors(String(schoolId));
  stats.rmpProfessorsFound = rmpProfessorsList.length;
  console.log(`[rmpSeed] found ${rmpProfessorsList.length} professors on RMP`);

  // ---- 5 & 6. Match professors and store linkage ---
  console.log("[rmpSeed] matching professors to local instructors...");

  interface MatchedProfessor {
    rmpTeacher: RmpTeacherNode;
    instructorId: number;
    confidence: "exact" | "fuzzy";
  }
  const matched: MatchedProfessor[] = [];
  const prefetchedRatingsByTeacherId = new Map<string, RmpRatingNode[]>();

  async function upsertRmpProfessorLink(rmpProf: RmpTeacherNode, instructorId: number) {
    await db
      .insert(rmpProfessors)
      .values({
        instructorId,
        rmpTeacherId: String(rmpProf.id),
        rmpAvgRating: String(rmpProf.avgRating),
        rmpAvgDifficulty: String(rmpProf.avgDifficulty),
        rmpNumRatings: rmpProf.numRatings,
        rmpWouldTakeAgain: String(rmpProf.wouldTakeAgainPercent),
        rmpDepartment: String(rmpProf.department),
      })
      .onConflictDoUpdate({
        target: rmpProfessors.instructorId,
        set: {
          rmpTeacherId: String(rmpProf.id),
          rmpAvgRating: String(rmpProf.avgRating),
          rmpAvgDifficulty: String(rmpProf.avgDifficulty),
          rmpNumRatings: rmpProf.numRatings,
          rmpWouldTakeAgain: String(rmpProf.wouldTakeAgainPercent),
          rmpDepartment: String(rmpProf.department),
          importedAt: new Date(),
        },
      });
  }

  for (const rmpProf of rmpProfessorsList) {
    const directMatch = matchProfessor(
      String(rmpProf.firstName),
      String(rmpProf.lastName),
      String(rmpProf.department),
      allInstructors,
      deptCodeMap
    );
    let resolvedMatch: { instructorId: number; confidence: "exact" | "fuzzy" } | null =
      directMatch;

    if (!resolvedMatch) {
      const candidates = listProfessorDisambiguationCandidates(
        String(rmpProf.firstName),
        String(rmpProf.lastName),
        String(rmpProf.department),
        allInstructors,
        deptCodeMap
      );

      if (candidates.length >= 2) {
        try {
          const ratings = await fetchProfessorRatings(String(rmpProf.id));
          prefetchedRatingsByTeacherId.set(String(rmpProf.id), ratings);

          const bestEvidence = pickInstructorFromReviewEvidence({
            candidates,
            ratings,
            allCourses,
            deptCodeMap,
            instructorDeptMap,
            sectionsByCourseId,
            coursesByInstructorId,
            availableTerms,
          });

          if (bestEvidence) {
            resolvedMatch = {
              instructorId: bestEvidence.instructorId,
              confidence: "fuzzy",
            };
            console.log(
              `[rmpSeed] disambiguated ${rmpProf.firstName} ${rmpProf.lastName} -> instructor=${bestEvidence.instructorId} score=${bestEvidence.score} matchedReviews=${bestEvidence.matchedReviews}/${bestEvidence.courseSignals}`
            );
          }
        } catch (err) {
          console.warn(
            `[rmpSeed] review-based disambiguation failed for ${rmpProf.firstName} ${rmpProf.lastName}: ${String(
              err
            )}`
          );
        }
      }
    }

    if (resolvedMatch) {
      stats.matched++;
      if (resolvedMatch.confidence === "exact") stats.matchedExact++;
      else stats.matchedFuzzy++;

      matched.push({
        rmpTeacher: rmpProf,
        instructorId: resolvedMatch.instructorId,
        confidence: resolvedMatch.confidence,
      });

      await upsertRmpProfessorLink(rmpProf, resolvedMatch.instructorId);
    } else {
      stats.unmatched++;
    }
  }

  console.log(
    `[rmpSeed] matching done: ${stats.matched} matched (${stats.matchedExact} exact, ${stats.matchedFuzzy} fuzzy), ${stats.unmatched} unmatched`
  );

  const matchedToProcess =
    ONLY_INSTRUCTOR_IDS || ONLY_RMP_TEACHER_IDS
      ? matched.filter(({ rmpTeacher, instructorId }) => {
          if (ONLY_INSTRUCTOR_IDS && !ONLY_INSTRUCTOR_IDS.has(instructorId)) {
            return false;
          }
          if (ONLY_RMP_TEACHER_IDS && !ONLY_RMP_TEACHER_IDS.has(String(rmpTeacher.id))) {
            return false;
          }
          return true;
        })
      : matched;
  if (ONLY_INSTRUCTOR_IDS || ONLY_RMP_TEACHER_IDS) {
    console.log(
      `[rmpSeed] applying filter: processing ${matchedToProcess.length}/${matched.length} matched professors`
    );
  }

  // ---- 7 & 8. Fetch reviews and import ---
  console.log("[rmpSeed] loading checkpoint...");
  const processed = loadCheckpoint();

  for (let i = 0; i < matchedToProcess.length; i++) {
    const { rmpTeacher, instructorId } = matchedToProcess[i];
    const instrKey = String(instructorId);

    if (processed.has(instrKey)) {
      continue;
    }

    const profLabel = `${rmpTeacher.firstName} ${rmpTeacher.lastName}`;
    console.log(
      `[rmpSeed] [${i + 1}/${matchedToProcess.length}] fetching reviews for ${profLabel} (instructorId=${instructorId})...`
    );

    const prefetched = prefetchedRatingsByTeacherId.get(String(rmpTeacher.id));
    let rmpRatings: RmpRatingNode[];
    if (prefetched) {
      rmpRatings = prefetched;
    } else {
      try {
        rmpRatings = await fetchProfessorRatings(String(rmpTeacher.id));
      } catch (err) {
        console.error(
          `[rmpSeed] failed to fetch reviews for ${profLabel}:`,
          err
        );
        continue;
      }
    }

    console.log(
      `[rmpSeed]   got ${rmpRatings.length} reviews for ${profLabel}`
    );

    // ---- 9. Collect tags across all reviews for this professor ---
    const tagCounts = new Map<string, number>();

    for (let ri = 0; ri < rmpRatings.length; ri++) {
      const rating = rmpRatings[ri];

      // Collect tags
      const tags = parseRmpTags(rating.ratingTags);
      for (const tag of tags) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }

      // Build a stable externalId from the professor + review index + date
      // RMP reviews don't have their own unique ID exposed in the wrapper,
      // so we create a stable hash from the teacher ID and review metadata.
      const dateStr = String(rating.date ?? "unknown");
      const externalId = buildRmpExternalId(rmpTeacher.legacyId, dateStr, ri);
      const reviewDate = parseRmpDate(rating.date);

      // Match the RMP "class" field to a local course
      const rmpClass = String(rating.class ?? "").trim();

      const courseId = matchCourse(
        rmpClass,
        instructorDeptMap.get(instructorId) ?? null,
        allCourses,
        deptCodeMap,
        rating.comment
      );
      if (!courseId) {
        const removed = await db
          .delete(reviews)
          .where(and(eq(reviews.externalId, externalId), eq(reviews.source, "rmp")))
          .returning({ id: reviews.id });
        if (removed.length > 0) stats.reviewsRemovedStale += removed.length;
        stats.reviewsSkippedNoCourse++;
        continue;
      }
      let resolvedCourseId = resolveCourseIdWithSectionContext(
        rmpClass,
        courseId,
        instructorId,
        reviewDate,
        allCourses,
        sectionsByCourseId,
        availableTerms
      );
      resolvedCourseId = remapLegacyCourseId({
        courseId: resolvedCourseId,
        coursesById,
        preferredCourseIdByCode,
      });

      const taughtCourseIds = coursesByInstructorId.get(instructorId) ?? new Set<number>();
      const explicitCourseToken = parseCourseCodeToken(
        `${rmpClass} ${String(rating.comment ?? "")}`
      );

      // For weak class labels (no explicit dept+course code),
      // don't allow mapping to courses the instructor never taught in local data.
      if (
        taughtCourseIds.size > 0 &&
        !taughtCourseIds.has(resolvedCourseId) &&
        !explicitCourseToken
      ) {
        const instructorCourseFallback = pickInstructorCourseFromNumberSignal({
          rmpClassLabel: rmpClass,
          reviewComment: rating.comment,
          taughtCourseIds,
          coursesById,
        });

        if (instructorCourseFallback) {
          resolvedCourseId = instructorCourseFallback;
        } else {
          const removed = await db
            .delete(reviews)
            .where(and(eq(reviews.externalId, externalId), eq(reviews.source, "rmp")))
            .returning({ id: reviews.id });
          if (removed.length > 0) stats.reviewsRemovedStale += removed.length;
          stats.reviewsSkippedNoCourse++;
          continue;
        }
      }

      // Map RMP quality rating: RMP uses helpfulRating + clarityRating averaged,
      // but the raw API gives helpfulRating and clarityRating separately.
      // The "quality" score on RMP is (helpfulRating + clarityRating) / 2,
      // but these are on a 1-5 scale already. We'll use clarityRating as our
      // quality proxy since it maps best to teaching quality.
      const qualityRaw =
        rating.clarityRating > 0 && rating.helpfulRating > 0
          ? (rating.clarityRating + rating.helpfulRating) / 2
          : rating.clarityRating > 0
            ? rating.clarityRating
            : rating.helpfulRating > 0
              ? rating.helpfulRating
              : 3; // fallback

      const ratingQuality = clampHalfStep(qualityRaw, 1, 5);
      const ratingDifficulty = clampHalfStep(rating.difficultyRating || 3, 1, 5);
      const sectionMatch = assignClosestSectionForReview(
        resolvedCourseId,
        instructorId,
        reviewDate,
        sectionsByCourseId,
        availableTerms
      );
      const reportedGrade = normalizeReportedGrade(rating.grade);
      const gradePoints = toGradePoints(reportedGrade);

      const ratingQualityValue = ratingQuality.toFixed(1);
      const ratingDifficultyValue = ratingDifficulty.toFixed(1);

      try {
        const gradePointsValue = gradePoints !== null ? String(gradePoints) : null;
        const updatePayload = {
          courseId: resolvedCourseId,
          instructorId,
          sectionId: sectionMatch.sectionId,
          termCode: sectionMatch.termCode,
          ratingQuality: ratingQualityValue,
          ratingDifficulty: ratingDifficultyValue,
          ratingWorkload: null as string | null,
          tags,
          reportedGrade,
          gradePoints: gradePointsValue,
          comment: rating.comment || null,
          isAnonymous: true,
          source: "rmp" as const,
          createdAt: reviewDate ?? new Date(),
          updatedAt: reviewDate ?? new Date(),
        };

        const result = await db
          .insert(reviews)
          .values({
            userId: SYSTEM_USER_ID,
            ...updatePayload,
            externalId,
          })
          .onConflictDoNothing()
          .returning({ id: reviews.id });

        if (result.length > 0) {
          stats.reviewsImported++;
        } else {
          await db
            .update(reviews)
            .set(updatePayload)
            .where(eq(reviews.externalId, externalId));
          stats.reviewsUpdatedExisting++;
        }
      } catch (err) {
        // Constraint violations (e.g. missing FK) are non-fatal
        stats.reviewsSkippedDuplicate++;
      }
    }

    // ---- Store tags for this professor ---
    for (const [tag, count] of tagCounts) {
      try {
        await db
          .insert(rmpProfessorTags)
          .values({ instructorId, tag, count })
          .onConflictDoUpdate({
            target: [rmpProfessorTags.instructorId, rmpProfessorTags.tag],
            set: { count },
          });
        stats.tagsImported++;
      } catch {
        // ignore tag insert failures
      }
    }

    // Mark this instructor as processed in checkpoint
    processed.add(instrKey);
    saveCheckpoint(processed);
  }

  // ---- 12. Refresh aggregate tables ---
  console.log("[rmpSeed] refreshing aggregate rating tables...");
  await refreshAggregates();

  // ---- 13. Final report ---
  console.log("\n========== RMP Seed Report ==========");
  console.log(`RMP professors found:     ${stats.rmpProfessorsFound}`);
  console.log(
    `Matched to local:         ${stats.matched} (${stats.matchedExact} exact, ${stats.matchedFuzzy} fuzzy)`
  );
  console.log(`Unmatched:                ${stats.unmatched}`);
  console.log(`Reviews imported:         ${stats.reviewsImported}`);
  console.log(`Reviews updated existing: ${stats.reviewsUpdatedExisting}`);
  console.log(`Reviews skipped (no course match): ${stats.reviewsSkippedNoCourse}`);
  console.log(`Reviews skipped (duplicate):       ${stats.reviewsSkippedDuplicate}`);
  console.log(`Reviews removed (stale mapping):  ${stats.reviewsRemovedStale}`);
  console.log(`Tags imported:            ${stats.tagsImported}`);
  console.log("======================================\n");
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function run() {
  try {
    await main();
  } catch (e) {
    console.error("[rmpSeed] fatal:", e);
    process.exitCode = 1;
  } finally {
    await dbClient.end({ timeout: 5 });
  }
}

void run();
