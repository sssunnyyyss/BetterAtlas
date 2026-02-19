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
import { eq, sql } from "drizzle-orm";
import { db, dbClient } from "../db/index.js";
import {
  users,
  instructors,
  departments,
  courses,
  reviews,
  courseRatings,
  courseInstructorRatings,
  instructorRatings,
  rmpProfessors,
  rmpProfessorTags,
} from "../db/schema.js";
import { matchProfessor, matchCourse } from "../lib/rmpMatching.js";
import {
  API_LINK,
  HEADERS,
  TEACHER_LIST,
  TEACHER_RATING_QUERY,
  retrieve_school_id,
} from "rate-my-professor-api-ts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000001";
const SCHOOL_NAME = (process.env.RMP_SCHOOL_NAME ?? "Emory University").trim();
const CHECKPOINT_PATH = resolve(
  process.env.RMP_CHECKPOINT ?? "rmp-checkpoint.json"
);
const RATE_DELAY_MS = 300;

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

async function rateLimitedPause() {
  await sleep(jitter(RATE_DELAY_MS));
}

/** Clamp a number to [min, max] and round to nearest integer. */
function clampRound(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(val)));
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
  const response = await fetch(API_LINK, {
    credentials: "include",
    headers: HEADERS as Record<string, string>,
    body: JSON.stringify({
      query: TEACHER_LIST,
      variables: {
        query: {
          text: "",
          schoolID: schoolId,
          fallback: true,
          departmentID: null,
        },
        schoolID: schoolId,
        includeSchoolFilter: true,
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

  const data = await response.json();
  const edges: Array<{ node: RmpTeacherNode }> =
    data?.data?.search?.teachers?.edges ?? [];
  return edges.map((e) => e.node);
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
  console.log("[rmpSeed] refreshing course_ratings...");
  await db.execute(sql`
    INSERT INTO course_ratings (course_id, avg_quality, avg_difficulty, avg_workload, review_count, updated_at)
    SELECT
      r.course_id,
      ROUND(AVG(r.rating_quality), 2),
      ROUND(AVG(r.rating_difficulty), 2),
      ROUND(AVG(r.rating_workload), 2),
      COUNT(*)::int,
      NOW()
    FROM reviews r
    GROUP BY r.course_id
    ON CONFLICT (course_id) DO UPDATE SET
      avg_quality    = EXCLUDED.avg_quality,
      avg_difficulty = EXCLUDED.avg_difficulty,
      avg_workload   = EXCLUDED.avg_workload,
      review_count   = EXCLUDED.review_count,
      updated_at     = NOW()
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
    reviewsSkippedNoCourse: 0,
    reviewsSkippedDuplicate: 0,
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
  console.log("[rmpSeed] loading local instructors, departments, courses...");
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
      title: courses.title,
      departmentId: courses.departmentId,
    })
    .from(courses);

  // Build lookup maps
  const deptCodeMap = new Map<number, string>();
  for (const d of allDepartments) {
    deptCodeMap.set(d.id, d.code);
  }

  console.log(
    `[rmpSeed] local data: ${allInstructors.length} instructors, ${allDepartments.length} departments, ${allCourses.length} courses`
  );

  // ---- 3. RMP school lookup ---
  console.log(`[rmpSeed] looking up school "${SCHOOL_NAME}" on RMP...`);
  await rateLimitedPause();
  const schoolId = await retrieve_school_id(SCHOOL_NAME);
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

  for (const rmpProf of rmpProfessorsList) {
    const match = matchProfessor(
      String(rmpProf.firstName),
      String(rmpProf.lastName),
      String(rmpProf.department),
      allInstructors,
      deptCodeMap
    );

    if (match) {
      stats.matched++;
      if (match.confidence === "exact") stats.matchedExact++;
      else stats.matchedFuzzy++;

      matched.push({
        rmpTeacher: rmpProf,
        instructorId: match.instructorId,
        confidence: match.confidence,
      });

      // Store linkage in rmpProfessors
      await db
        .insert(rmpProfessors)
        .values({
          instructorId: match.instructorId,
          rmpTeacherId: String(rmpProf.id),
          rmpAvgRating: String(rmpProf.avgRating),
          rmpAvgDifficulty: String(rmpProf.avgDifficulty),
          rmpNumRatings: rmpProf.numRatings,
          rmpWouldTakeAgain: String(rmpProf.wouldTakeAgainPercent),
          rmpDepartment: String(rmpProf.department),
        })
        .onConflictDoNothing();
    } else {
      stats.unmatched++;
    }
  }

  console.log(
    `[rmpSeed] matching done: ${stats.matched} matched (${stats.matchedExact} exact, ${stats.matchedFuzzy} fuzzy), ${stats.unmatched} unmatched`
  );

  // ---- 7 & 8. Fetch reviews and import ---
  console.log("[rmpSeed] loading checkpoint...");
  const processed = loadCheckpoint();

  for (let i = 0; i < matched.length; i++) {
    const { rmpTeacher, instructorId } = matched[i];
    const instrKey = String(instructorId);

    if (processed.has(instrKey)) {
      continue;
    }

    const profLabel = `${rmpTeacher.firstName} ${rmpTeacher.lastName}`;
    console.log(
      `[rmpSeed] [${i + 1}/${matched.length}] fetching reviews for ${profLabel} (instructorId=${instructorId})...`
    );

    let rmpRatings: RmpRatingNode[];
    try {
      rmpRatings = await fetchProfessorRatings(String(rmpTeacher.id));
    } catch (err) {
      console.error(
        `[rmpSeed] failed to fetch reviews for ${profLabel}:`,
        err
      );
      continue;
    }

    console.log(
      `[rmpSeed]   got ${rmpRatings.length} reviews for ${profLabel}`
    );

    // ---- 9. Collect tags across all reviews for this professor ---
    const tagCounts = new Map<string, number>();

    for (let ri = 0; ri < rmpRatings.length; ri++) {
      const rating = rmpRatings[ri];

      // Collect tags
      const rawTags = String(rating.ratingTags ?? "");
      if (rawTags) {
        // Tags are typically a comma-separated or newline-separated string
        const tags = rawTags
          .split(/[,\n]+/)
          .map((t) => t.trim())
          .filter(Boolean);
        for (const tag of tags) {
          tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
        }
      }

      // Build a stable externalId from the professor + review index + date
      // RMP reviews don't have their own unique ID exposed in the wrapper,
      // so we create a composite key from the teacher ID and review metadata.
      const dateStr = String(rating.date ?? "unknown");
      const externalId = `rmp-${rmpTeacher.legacyId}-${dateStr}-${ri}`;

      // Match the RMP "class" field to a local course
      const rmpClass = String(rating.class ?? "").trim();
      if (!rmpClass) {
        stats.reviewsSkippedNoCourse++;
        continue;
      }

      const courseId = matchCourse(rmpClass, null, allCourses);
      if (!courseId) {
        stats.reviewsSkippedNoCourse++;
        continue;
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

      const ratingQuality = clampRound(qualityRaw, 1, 5);
      const ratingDifficulty = clampRound(rating.difficultyRating || 3, 1, 5);

      try {
        const result = await db
          .insert(reviews)
          .values({
            userId: SYSTEM_USER_ID,
            courseId,
            instructorId,
            sectionId: null,
            termCode: null,
            ratingQuality,
            ratingDifficulty,
            ratingWorkload: null, // RMP has no workload metric
            comment: rating.comment || null,
            isAnonymous: true,
            source: "rmp",
            externalId,
          })
          .onConflictDoNothing()
          .returning({ id: reviews.id });

        if (result.length > 0) {
          stats.reviewsImported++;
        } else {
          stats.reviewsSkippedDuplicate++;
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
          .onConflictDoNothing();
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
  console.log(`Reviews skipped (no course match): ${stats.reviewsSkippedNoCourse}`);
  console.log(`Reviews skipped (duplicate):       ${stats.reviewsSkippedDuplicate}`);
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
