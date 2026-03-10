# RateMyProfessor Data Import - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Seed BetterAtlas with RateMyProfessor ratings, reviews, and tags so courses/professors have data from day one.

**Architecture:** A CLI seed script (`api/src/jobs/rmpSeed.ts`) uses the `rate-my-professor-api-ts` npm package to fetch all Emory professors and their reviews from RMP's GraphQL API. Reviews are inserted into the existing `reviews` table with a `source` flag. Professor-level RMP metadata (tags, would-take-again %) lives in dedicated tables. Frontend shows an "RMP" badge on imported reviews and displays tags on professor pages.

**Tech Stack:** TypeScript, Drizzle ORM, PostgreSQL, `rate-my-professor-api-ts`, `fastest-levenshtein`

**Design doc:** `docs/plans/2026-02-19-rmp-import-design.md`

---

## Critical Design Note: `ratingWorkload` is NOT NULL

The current `reviews.rating_workload` column is `NOT NULL` and validated as `1-5` in shared validation schemas. RMP does not have a workload dimension. Two options:

1. **Make nullable** — alter the column to allow NULL, update shared types/validation. This is the correct long-term fix but touches more files.
2. **Use sentinel value 0** — set workload to `0` for RMP imports. Simpler but semantically wrong and may confuse aggregate calculations.

**This plan uses option 1 (make nullable)** since the aggregate refresh functions already use `avg()` which ignores NULLs.

---

### Task 1: Install dependencies

**Files:**
- Modify: `api/package.json`

**Step 1: Install npm packages**

Run from repo root:
```bash
cd api && pnpm add rate-my-professor-api-ts fastest-levenshtein
```

**Step 2: Verify installation**

Run: `cd api && pnpm ls rate-my-professor-api-ts fastest-levenshtein`
Expected: Both packages listed with versions.

**Step 3: Commit**

```bash
git add api/package.json api/pnpm-lock.yaml pnpm-lock.yaml
git commit -m "chore: add rate-my-professor-api-ts and fastest-levenshtein deps"
```

---

### Task 2: Schema changes — add `source` and `external_id` to reviews

**Files:**
- Modify: `api/src/db/schema.ts:186-217` (reviews table definition)

**Step 1: Add columns to Drizzle schema**

In `api/src/db/schema.ts`, add two columns to the `reviews` table definition:

```typescript
// Inside the reviews pgTable columns object, after `isAnonymous`:
source: varchar("source", { length: 10 }).notNull().default("native"),
externalId: varchar("external_id", { length: 40 }),
```

And add an index in the table's index function:

```typescript
// Inside the reviews pgTable index function, after sectionIdx:
externalIdIdx: uniqueIndex("idx_reviews_external_id")
  .on(table.externalId)
  .where(sql`external_id IS NOT NULL`),
```

Note: Drizzle's `uniqueIndex().where()` may not support partial indexes directly. If it doesn't compile, use a raw SQL migration instead (see step 3 fallback).

**Step 2: Make `ratingWorkload` nullable**

In the same `reviews` table in `api/src/db/schema.ts`, change:

```typescript
// FROM:
ratingWorkload: smallint("rating_workload").notNull(),
// TO:
ratingWorkload: smallint("rating_workload"),
```

**Step 3: Update shared types**

In `packages/shared/src/types/review.ts`, update the `Review` interface:

```typescript
// FROM:
ratingWorkload: number;
// TO:
ratingWorkload: number | null;
```

**Step 4: Update shared validation**

In `packages/shared/src/utils/validation.ts`, in the create review schema, change:

```typescript
// FROM:
ratingWorkload: z.number().int().min(1).max(5),
// TO:
ratingWorkload: z.number().int().min(1).max(5).nullable().default(null),
```

Also check `updateReviewSchema` — if it has `ratingWorkload`, make it `.nullable()` too.

**Step 5: Add `source` to shared Review type**

In `packages/shared/src/types/review.ts`, add to `Review` interface:

```typescript
source?: "native" | "rmp";
```

**Step 6: Write the SQL migration**

Create `api/src/db/migrations/rmp-schema.sql`:

```sql
BEGIN;

-- Make workload nullable for RMP imports (RMP has no workload dimension)
ALTER TABLE reviews ALTER COLUMN rating_workload DROP NOT NULL;

-- Add source flag to distinguish native vs imported reviews
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS source VARCHAR(10) NOT NULL DEFAULT 'native';

-- Add external ID for idempotent imports
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS external_id VARCHAR(40);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_external_id
  ON reviews(external_id) WHERE external_id IS NOT NULL;

COMMIT;
```

**Step 7: Push schema changes**

Run: `cd api && pnpm db:push`
Expected: Schema synced successfully. If `db:push` doesn't handle the nullable change, run the migration SQL manually.

**Step 8: Commit**

```bash
git add api/src/db/schema.ts packages/shared/src/types/review.ts packages/shared/src/utils/validation.ts api/src/db/migrations/rmp-schema.sql
git commit -m "feat: add source/external_id to reviews, make workload nullable for RMP import"
```

---

### Task 3: Schema changes — new `rmp_professors` and `rmp_professor_tags` tables

**Files:**
- Modify: `api/src/db/schema.ts` (add new table definitions at the end)

**Step 1: Add `rmpProfessors` table to schema**

Append to `api/src/db/schema.ts`:

```typescript
// RMP professor linkage (maps instructors to RMP teacher IDs)
export const rmpProfessors = pgTable("rmp_professors", {
  instructorId: integer("instructor_id")
    .primaryKey()
    .references(() => instructors.id),
  rmpTeacherId: varchar("rmp_teacher_id", { length: 20 }).notNull(),
  rmpAvgRating: numeric("rmp_avg_rating", { precision: 3, scale: 2 }),
  rmpAvgDifficulty: numeric("rmp_avg_difficulty", { precision: 3, scale: 2 }),
  rmpNumRatings: integer("rmp_num_ratings"),
  rmpWouldTakeAgain: numeric("rmp_would_take_again", { precision: 5, scale: 2 }),
  rmpDepartment: text("rmp_department"),
  importedAt: timestamp("imported_at", { withTimezone: true }).defaultNow(),
});
```

**Step 2: Add `rmpProfessorTags` table to schema**

Append to `api/src/db/schema.ts`:

```typescript
// RMP community tags per instructor
export const rmpProfessorTags = pgTable(
  "rmp_professor_tags",
  {
    id: serial("id").primaryKey(),
    instructorId: integer("instructor_id")
      .references(() => instructors.id)
      .notNull(),
    tag: text("tag").notNull(),
    count: integer("count").default(1),
  },
  (table) => ({
    instructorTagUnique: uniqueIndex("idx_rmp_professor_tags_instructor_tag").on(
      table.instructorId,
      table.tag
    ),
    instructorIdx: index("idx_rmp_professor_tags_instructor").on(table.instructorId),
  })
);
```

**Step 3: Push schema**

Run: `cd api && pnpm db:push`
Expected: Two new tables created.

**Step 4: Commit**

```bash
git add api/src/db/schema.ts
git commit -m "feat: add rmp_professors and rmp_professor_tags tables"
```

---

### Task 4: Professor matching utility

**Files:**
- Create: `api/src/lib/rmpMatching.ts`
- Create: `api/src/lib/rmpMatching.test.ts`

**Step 1: Write the failing test**

Create `api/src/lib/rmpMatching.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { normalizeName, matchProfessor } from "./rmpMatching.js";

describe("normalizeName", () => {
  it("lowercases and trims", () => {
    expect(normalizeName("  John  Smith  ")).toBe("john smith");
  });

  it("removes titles", () => {
    expect(normalizeName("Dr. Jane Doe")).toBe("jane doe");
    expect(normalizeName("Prof. Jane Doe")).toBe("jane doe");
  });

  it("handles single names", () => {
    expect(normalizeName("Madonna")).toBe("madonna");
  });
});

describe("matchProfessor", () => {
  const instructors = [
    { id: 1, name: "John Smith", departmentId: 10 },
    { id: 2, name: "Jane Doe", departmentId: 20 },
    { id: 3, name: "John Smyth", departmentId: 10 },
  ];

  it("exact match", () => {
    const result = matchProfessor("John", "Smith", "Computer Science", instructors, new Map([[10, "CS"]]));
    expect(result).toEqual({ instructorId: 1, confidence: "exact" });
  });

  it("fuzzy match", () => {
    const result = matchProfessor("Jon", "Smith", "Computer Science", instructors, new Map([[10, "CS"]]));
    expect(result).not.toBeNull();
    expect(result?.confidence).toBe("fuzzy");
  });

  it("returns null for no match", () => {
    const result = matchProfessor("Completely", "Unknown", "Art", instructors, new Map());
    expect(result).toBeNull();
  });

  it("prefers department match when multiple fuzzy hits", () => {
    // Both "John Smith" and "John Smyth" are close to "John Smit"
    // but dept cross-check should disambiguate
    const result = matchProfessor("John", "Smit", "CS", instructors, new Map([[10, "CS"], [20, "MATH"]]));
    expect(result).not.toBeNull();
    expect(result?.instructorId).toBe(1); // or 3, both dept 10=CS
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd api && pnpm test -- src/lib/rmpMatching.test.ts`
Expected: FAIL — module not found.

**Step 3: Write the implementation**

Create `api/src/lib/rmpMatching.ts`:

```typescript
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

/**
 * Match an RMP professor (firstName + lastName) to a BetterAtlas instructor.
 *
 * @param firstName - RMP professor first name
 * @param lastName - RMP professor last name
 * @param rmpDepartment - RMP department string (e.g., "Computer Science")
 * @param instructors - All BetterAtlas instructors
 * @param deptCodeMap - Map of departmentId -> department code (e.g., 10 -> "CS")
 * @returns Best match or null
 */
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

  // Prefer department matches, then highest similarity
  candidates.sort((a, b) => {
    if (a.deptMatch !== b.deptMatch) return a.deptMatch ? -1 : 1;
    return b.similarity - a.similarity;
  });

  return { instructorId: candidates[0].id, confidence: "fuzzy" };
}
```

**Step 4: Run test to verify it passes**

Run: `cd api && pnpm test -- src/lib/rmpMatching.test.ts`
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add api/src/lib/rmpMatching.ts api/src/lib/rmpMatching.test.ts
git commit -m "feat: add professor name matching utility for RMP import"
```

---

### Task 5: Course matching utility

**Files:**
- Modify: `api/src/lib/rmpMatching.ts` (add course matching)
- Modify: `api/src/lib/rmpMatching.test.ts` (add tests)

**Step 1: Write the failing test**

Add to `api/src/lib/rmpMatching.test.ts`:

```typescript
import { matchCourse } from "./rmpMatching.js";

describe("matchCourse", () => {
  const courses = [
    { id: 1, title: "Data Structures", departmentId: 10 },
    { id: 2, title: "Introduction to Psychology", departmentId: 20 },
    { id: 3, title: "Data Structures and Algorithms", departmentId: 10 },
  ];

  it("exact title match", () => {
    const result = matchCourse("Data Structures", 10, courses);
    expect(result).toBe(1);
  });

  it("case-insensitive match", () => {
    const result = matchCourse("data structures", 10, courses);
    expect(result).toBe(1);
  });

  it("prefers same department when multiple matches", () => {
    // "Data Structures" matches both id=1 and id=3, both dept 10
    const result = matchCourse("Data Structures", 10, courses);
    expect(result).toBe(1); // exact title match preferred
  });

  it("returns null when no match", () => {
    const result = matchCourse("Organic Chemistry", 30, courses);
    expect(result).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd api && pnpm test -- src/lib/rmpMatching.test.ts`
Expected: FAIL — matchCourse not exported.

**Step 3: Implement matchCourse**

Add to `api/src/lib/rmpMatching.ts`:

```typescript
interface CourseRow {
  id: number;
  title: string;
  departmentId: number | null;
}

/**
 * Match an RMP course name to a BetterAtlas course.
 * Returns courseId or null.
 */
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
    // Prefer same department
    const sameDept = exact.find((c) => c.departmentId === instructorDeptId);
    return sameDept?.id ?? exact[0].id;
  }

  // Substring match (RMP course name contained in or contains course title)
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
```

**Step 4: Run tests**

Run: `cd api && pnpm test -- src/lib/rmpMatching.test.ts`
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add api/src/lib/rmpMatching.ts api/src/lib/rmpMatching.test.ts
git commit -m "feat: add course name matching for RMP import"
```

---

### Task 6: RMP seed script — core structure

**Files:**
- Create: `api/src/jobs/rmpSeed.ts`
- Modify: `api/package.json` (add script)

**Step 1: Add npm script**

In `api/package.json`, add to `"scripts"`:

```json
"rmp:seed": "tsx src/jobs/rmpSeed.ts"
```

**Step 2: Create the seed script skeleton**

Create `api/src/jobs/rmpSeed.ts`. This is the main orchestrator:

```typescript
import { db, dbClient } from "../db/index.js";
import {
  instructors,
  departments,
  courses,
  reviews,
  rmpProfessors,
  rmpProfessorTags,
  users,
} from "../db/schema.js";
import { eq, sql } from "drizzle-orm";
import { RateMyProfessor } from "rate-my-professor-api-ts";
import { matchProfessor, matchCourse } from "../lib/rmpMatching.js";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ──────────────────────────────────────────────────────
const SCHOOL_NAME = "Emory University";
const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000001";
const SYSTEM_USER_EMAIL = "system+rmp@betteratlas.app";
const SYSTEM_USER_USERNAME = "rmp-import";
const SYSTEM_USER_DISPLAY_NAME = "RateMyProfessor Import";
const DELAY_MS = 300; // ms between RMP API calls
const CHECKPOINT_FILE = path.resolve(__dirname, "../../rmp-checkpoint.json");

// ── Helpers ─────────────────────────────────────────────────────
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function jitter(ms: number) {
  return ms + Math.floor((Math.random() - 0.5) * ms * 0.5);
}

interface Checkpoint {
  schoolId: string | null;
  matchedProfessors: Array<{ instructorId: number; rmpTeacherId: string }>;
  importedProfessorIds: number[];
  stats: {
    rmpProfessorsFound: number;
    matched: number;
    unmatched: number;
    reviewsImported: number;
    reviewsSkipped: number;
    tagsImported: number;
  };
}

async function loadCheckpoint(): Promise<Checkpoint> {
  try {
    const raw = await fs.readFile(CHECKPOINT_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      schoolId: null,
      matchedProfessors: [],
      importedProfessorIds: [],
      stats: {
        rmpProfessorsFound: 0,
        matched: 0,
        unmatched: 0,
        reviewsImported: 0,
        reviewsSkipped: 0,
        tagsImported: 0,
      },
    };
  }
}

async function saveCheckpoint(cp: Checkpoint) {
  await fs.writeFile(CHECKPOINT_FILE, JSON.stringify(cp, null, 2));
}

// ── Main ────────────────────────────────────────────────────────
async function main() {
  console.log("[rmp-seed] Starting RateMyProfessor import...");

  const checkpoint = await loadCheckpoint();

  // Step 1: Ensure system user exists
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, SYSTEM_USER_ID))
    .limit(1);

  if (!existingUser) {
    console.log("[rmp-seed] Creating system user for RMP import...");
    await db.insert(users).values({
      id: SYSTEM_USER_ID,
      email: SYSTEM_USER_EMAIL,
      username: SYSTEM_USER_USERNAME,
      displayName: SYSTEM_USER_DISPLAY_NAME,
      hasCompletedOnboarding: true,
    });
  }

  // Step 2: Load all BetterAtlas instructors and courses
  const allInstructors = await db
    .select({
      id: instructors.id,
      name: instructors.name,
      departmentId: instructors.departmentId,
    })
    .from(instructors);

  const allDepts = await db
    .select({ id: departments.id, code: departments.code })
    .from(departments);

  const deptCodeMap = new Map(allDepts.map((d) => [d.id, d.code]));

  const allCourses = await db
    .select({
      id: courses.id,
      title: courses.title,
      departmentId: courses.departmentId,
    })
    .from(courses);

  console.log(
    `[rmp-seed] Loaded ${allInstructors.length} instructors, ${allCourses.length} courses, ${allDepts.length} departments`
  );

  // Step 3: Initialize RMP client and find school
  const rmp = new RateMyProfessor();

  let schoolId = checkpoint.schoolId;
  if (!schoolId) {
    console.log(`[rmp-seed] Looking up "${SCHOOL_NAME}" on RMP...`);
    // The API may require setting up the college first
    // We need to search for the school and get its ID
    // This depends on the rate-my-professor-api-ts API surface
    // TODO: Implement school lookup based on actual API
    // For now, use Emory's known RMP school ID
    schoolId = "1350"; // Emory University's RMP school ID
    checkpoint.schoolId = schoolId;
    await saveCheckpoint(checkpoint);
    console.log(`[rmp-seed] School ID: ${schoolId}`);
  }

  // Step 4: Fetch all professors from RMP
  if (checkpoint.matchedProfessors.length === 0) {
    console.log("[rmp-seed] Fetching professor list from RMP...");
    // TODO: Use rmp.get_professor_list() or equivalent
    // This depends on the actual API of rate-my-professor-api-ts
    // The implementation will need to:
    // 1. Get all professors for the school
    // 2. For each, call matchProfessor()
    // 3. Store matches in checkpoint
    //
    // Placeholder for the actual API calls:
    console.log("[rmp-seed] Professor fetching needs implementation based on actual RMP API");
  }

  // Step 5: For each matched professor, fetch and import reviews
  for (const match of checkpoint.matchedProfessors) {
    if (checkpoint.importedProfessorIds.includes(match.instructorId)) {
      continue; // already done
    }

    console.log(`[rmp-seed] Importing reviews for instructor ${match.instructorId}...`);
    await sleep(jitter(DELAY_MS));

    // TODO: Fetch reviews for this professor from RMP
    // For each review:
    //   - Map quality -> ratingQuality, difficulty -> ratingDifficulty
    //   - Try matchCourse() for courseId
    //   - Insert into reviews with source='rmp', externalId=rmpReviewId
    //   - Skip duplicates via externalId unique constraint

    checkpoint.importedProfessorIds.push(match.instructorId);
    await saveCheckpoint(checkpoint);
  }

  // Step 6: Refresh aggregate caches
  console.log("[rmp-seed] Refreshing aggregate rating caches...");
  // The reviewService refresh functions are not exported for bulk use.
  // We'll need to either:
  // a) Export them and call per-course/instructor, or
  // b) Run raw SQL to recompute all aggregates at once.
  // Option (b) is better for a bulk import:
  await db.execute(sql`
    INSERT INTO course_ratings (course_id, avg_quality, avg_difficulty, avg_workload, review_count, updated_at)
    SELECT
      course_id,
      avg(rating_quality)::numeric(3,2),
      avg(rating_difficulty)::numeric(3,2),
      avg(rating_workload)::numeric(3,2),
      count(*),
      now()
    FROM reviews
    GROUP BY course_id
    ON CONFLICT (course_id) DO UPDATE SET
      avg_quality = EXCLUDED.avg_quality,
      avg_difficulty = EXCLUDED.avg_difficulty,
      avg_workload = EXCLUDED.avg_workload,
      review_count = EXCLUDED.review_count,
      updated_at = now()
  `);

  await db.execute(sql`
    INSERT INTO instructor_ratings (instructor_id, avg_quality, review_count, updated_at)
    SELECT
      instructor_id,
      avg(rating_quality)::numeric(3,2),
      count(*),
      now()
    FROM reviews
    WHERE instructor_id IS NOT NULL
    GROUP BY instructor_id
    ON CONFLICT (instructor_id) DO UPDATE SET
      avg_quality = EXCLUDED.avg_quality,
      review_count = EXCLUDED.review_count,
      updated_at = now()
  `);

  // Step 7: Report
  console.log("[rmp-seed] === Import Complete ===");
  console.log(JSON.stringify(checkpoint.stats, null, 2));

  await dbClient.end({ timeout: 5 });
}

main().catch((e) => {
  console.error("[rmp-seed] Fatal error:", e);
  process.exitCode = 1;
});
```

**Note:** The `rate-my-professor-api-ts` API surface needs to be explored at implementation time. The TODO sections mark where the actual API calls need to be filled in. The engineer should:

1. Run `cd api && node -e "import('rate-my-professor-api-ts').then(m => console.log(Object.keys(m)))"` to inspect exports
2. Check the package's README/source for the correct method names
3. Fill in the TODO sections accordingly

**Step 3: Commit**

```bash
git add api/src/jobs/rmpSeed.ts api/package.json
git commit -m "feat: add RMP seed script skeleton with checkpoint support"
```

---

### Task 7: Implement RMP API integration (fill in TODOs)

**Files:**
- Modify: `api/src/jobs/rmpSeed.ts` (fill in TODO sections)

This task requires exploring the `rate-my-professor-api-ts` API at runtime. The engineer should:

**Step 1: Explore the API**

Run:
```bash
cd api && node --loader tsx -e "
import { RateMyProfessor } from 'rate-my-professor-api-ts';
const rmp = new RateMyProfessor();
console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(rmp)));
"
```

This reveals available methods. Based on the npm description, expect:
- `set_college(name)` or similar to set school context
- `get_professor_list()` to get all professors
- `get_professor_summary(professorId)` for detailed info
- `get_comments(professorId)` for individual reviews

**Step 2: Implement school lookup + professor fetching**

Replace the TODO in Step 3-4 of `rmpSeed.ts` with actual API calls. The general pattern:

```typescript
// Set school context
await rmp.set_college(SCHOOL_NAME); // or however the API works
await sleep(jitter(DELAY_MS));

// Get all professors
const rmpProfs = await rmp.get_professor_list();
checkpoint.stats.rmpProfessorsFound = rmpProfs.length;

console.log(`[rmp-seed] Found ${rmpProfs.length} professors on RMP`);

const unmatchedLog: Array<{ firstName: string; lastName: string; dept: string }> = [];

for (const prof of rmpProfs) {
  const match = matchProfessor(
    prof.firstName, // adjust field names per API
    prof.lastName,
    prof.department || "",
    allInstructors,
    deptCodeMap
  );

  if (match) {
    checkpoint.matchedProfessors.push({
      instructorId: match.instructorId,
      rmpTeacherId: String(prof.id), // adjust field name
    });
    checkpoint.stats.matched++;

    // Store RMP professor linkage
    await db.insert(rmpProfessors).values({
      instructorId: match.instructorId,
      rmpTeacherId: String(prof.id),
      rmpAvgRating: String(prof.avgRating ?? 0),
      rmpAvgDifficulty: String(prof.avgDifficulty ?? 0),
      rmpNumRatings: prof.numRatings ?? 0,
      rmpWouldTakeAgain: String(prof.wouldTakeAgain ?? 0),
      rmpDepartment: prof.department ?? null,
    }).onConflictDoNothing();
  } else {
    unmatchedLog.push({
      firstName: prof.firstName,
      lastName: prof.lastName,
      dept: prof.department || "?",
    });
    checkpoint.stats.unmatched++;
  }
}

// Save unmatched for manual review
await fs.writeFile(
  path.resolve(__dirname, "../../rmp-unmatched.json"),
  JSON.stringify(unmatchedLog, null, 2)
);
await saveCheckpoint(checkpoint);
console.log(`[rmp-seed] Matched: ${checkpoint.stats.matched}, Unmatched: ${checkpoint.stats.unmatched}`);
```

**Step 3: Implement review fetching and import**

Replace the TODO in Step 5 with:

```typescript
// Fetch reviews/comments for this professor
const comments = await rmp.get_comments(match.rmpTeacherId); // adjust method name
await sleep(jitter(DELAY_MS));

for (const comment of comments) {
  const externalId = `rmp-${comment.id}`; // adjust field name

  // Try to match course
  const instructor = allInstructors.find((i) => i.id === match.instructorId);
  const courseId = comment.courseName
    ? matchCourse(comment.courseName, instructor?.departmentId ?? null, allCourses)
    : null;

  if (!courseId) {
    checkpoint.stats.reviewsSkipped++;
    continue; // courseId is NOT NULL in reviews table
  }

  const quality = Math.round(Math.min(5, Math.max(1, comment.qualityRating ?? 3)));
  const difficulty = Math.round(Math.min(5, Math.max(1, comment.difficultyRating ?? 3)));

  try {
    await db.insert(reviews).values({
      userId: SYSTEM_USER_ID,
      courseId,
      instructorId: match.instructorId,
      sectionId: null, // RMP reviews don't reference specific sections
      termCode: null,
      ratingQuality: quality,
      ratingDifficulty: difficulty,
      ratingWorkload: null, // RMP has no workload
      comment: comment.comment || null, // adjust field name
      isAnonymous: true,
      source: "rmp",
      externalId,
    }).onConflictDoNothing(); // skip if externalId already exists

    checkpoint.stats.reviewsImported++;
  } catch (err: any) {
    // Log but continue — may be unique constraint violation etc.
    console.warn(`[rmp-seed] Skipped review ${externalId}: ${err.message}`);
    checkpoint.stats.reviewsSkipped++;
  }
}

// Import tags for this professor
if (Array.isArray((comments as any).tags)) {
  for (const tag of (comments as any).tags) {
    await db.insert(rmpProfessorTags).values({
      instructorId: match.instructorId,
      tag: tag.name || tag, // adjust based on API shape
      count: tag.count ?? 1,
    }).onConflictDoNothing();
    checkpoint.stats.tagsImported++;
  }
}
```

**Important:** Field names (`firstName`, `lastName`, `avgRating`, `get_comments`, etc.) are guesses based on the npm docs. The engineer MUST verify against the actual API and adjust.

**Step 4: Test the script with a dry run**

Run: `cd api && pnpm rmp:seed`

Watch for:
- System user created
- School found
- Professors fetched and matched
- Reviews imported
- No crash

**Step 5: Commit**

```bash
git add api/src/jobs/rmpSeed.ts
git commit -m "feat: implement RMP API integration in seed script"
```

---

### Task 8: Handle `reviews.sectionId` NOT NULL constraint

**Files:**
- Modify: `api/src/db/schema.ts:186-217`

**Critical issue:** The `reviews` table has a unique index `reviews_user_section_unique` on `(userId, sectionId)`. RMP reviews have no section — they'll all share the same system user + null section, violating uniqueness.

**Step 1: Check the constraint**

The constraint is:
```typescript
userSectionUnique: uniqueIndex("reviews_user_section_unique").on(
  table.userId,
  table.sectionId
),
```

Since `sectionId` can be null, and PostgreSQL treats NULLs as distinct in unique indexes, multiple rows with `(system_user_id, NULL)` should be allowed. **Verify this is the case.** If not, the unique index needs to become partial:

```sql
-- Replace with:
CREATE UNIQUE INDEX reviews_user_section_unique
  ON reviews(user_id, section_id)
  WHERE section_id IS NOT NULL;
```

**Step 2: Also verify `courseId` is NOT NULL**

The reviews table has `courseId: integer("course_id").references(() => courses.id).notNull()`. This means we MUST find a course match for every imported review, or skip it. The seed script already handles this (skips reviews with no course match).

**Step 3: Commit if changes needed**

```bash
git add api/src/db/schema.ts
git commit -m "fix: make reviews unique constraint partial to allow RMP imports"
```

---

### Task 9: Update API to return `source` field in review responses

**Files:**
- Modify: `api/src/services/reviewService.ts` (add `source` to SELECT queries)

**Step 1: Add `source` to `getReviewsForCourse`**

In `api/src/services/reviewService.ts:19-71`, add `source: reviews.source` to the `.select()` call and include it in the returned object:

```typescript
// In the .select() at line ~21, add:
source: reviews.source,

// In the .map() return object at line ~49, add:
source: r.source ?? "native",
```

**Step 2: Add `source` to `getReviewsForSection` and `getReviewsForUser`**

Same pattern — add `source: reviews.source` to select, include in response map.

**Step 3: Update shared types**

In `packages/shared/src/types/review.ts`, change `source` from optional to required:

```typescript
// In Review interface, change:
source?: "native" | "rmp";
// To:
source: "native" | "rmp";
```

**Step 4: Commit**

```bash
git add api/src/services/reviewService.ts packages/shared/src/types/review.ts
git commit -m "feat: include review source field in API responses"
```

---

### Task 10: Frontend — RMP badge on ReviewCard

**Files:**
- Modify: `frontend/src/components/review/ReviewCard.tsx`

**Step 1: Add RMP badge**

In `frontend/src/components/review/ReviewCard.tsx`, after the author name/badges section (~line 21-26), add:

```tsx
{review.source === "rmp" && (
  <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
    RateMyProfessor
  </span>
)}
```

**Step 2: Handle null workload display**

In the ratings section (~line 55-68), wrap the workload display conditionally:

```tsx
{review.ratingWorkload != null && (
  <div className="flex items-center gap-1">
    <span className="text-xs text-gray-500">Workload:</span>
    <RatingStars value={review.ratingWorkload} readonly size="sm" />
  </div>
)}
```

**Step 3: Commit**

```bash
git add frontend/src/components/review/ReviewCard.tsx
git commit -m "feat: show RMP badge on imported reviews, handle null workload"
```

---

### Task 11: Frontend — RMP tags and would-take-again on ProfessorDetail

**Files:**
- Modify: `api/src/routes/instructors.ts` (add RMP data to professor detail endpoint)
- Modify: `frontend/src/pages/ProfessorDetail.tsx` (display RMP tags + would-take-again)

**Step 1: Add RMP data to instructor detail API**

In `api/src/routes/instructors.ts`, in the `GET /:id` handler, after fetching the professor, add:

```typescript
import { rmpProfessors, rmpProfessorTags } from "../db/schema.js";

// After the existing professor query:
const [rmpData] = await db
  .select()
  .from(rmpProfessors)
  .where(eq(rmpProfessors.instructorId, instructorId))
  .limit(1);

const rmpTags = rmpData
  ? await db
      .select({ tag: rmpProfessorTags.tag, count: rmpProfessorTags.count })
      .from(rmpProfessorTags)
      .where(eq(rmpProfessorTags.instructorId, instructorId))
      .orderBy(desc(rmpProfessorTags.count))
  : [];
```

Then include in the response:

```typescript
rmp: rmpData
  ? {
      avgRating: rmpData.rmpAvgRating ? parseFloat(rmpData.rmpAvgRating) : null,
      avgDifficulty: rmpData.rmpAvgDifficulty ? parseFloat(rmpData.rmpAvgDifficulty) : null,
      numRatings: rmpData.rmpNumRatings ?? 0,
      wouldTakeAgain: rmpData.rmpWouldTakeAgain ? parseFloat(rmpData.rmpWouldTakeAgain) : null,
      tags: rmpTags,
    }
  : null,
```

**Step 2: Display on ProfessorDetail page**

In `frontend/src/pages/ProfessorDetail.tsx`, after the professor name/email section, add:

```tsx
{data.rmp && (
  <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-4">
    <h3 className="text-sm font-semibold text-amber-800 mb-2">
      RateMyProfessor
    </h3>
    <div className="flex flex-wrap gap-4 text-sm text-amber-700">
      {data.rmp.avgRating != null && (
        <span>Rating: <strong>{data.rmp.avgRating.toFixed(1)}/5</strong></span>
      )}
      {data.rmp.wouldTakeAgain != null && (
        <span>Would take again: <strong>{data.rmp.wouldTakeAgain.toFixed(0)}%</strong></span>
      )}
      {data.rmp.numRatings > 0 && (
        <span>{data.rmp.numRatings} ratings</span>
      )}
    </div>
    {data.rmp.tags.length > 0 && (
      <div className="flex flex-wrap gap-1.5 mt-2">
        {data.rmp.tags.map((t: { tag: string; count: number }) => (
          <span
            key={t.tag}
            className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800"
          >
            {t.tag} ({t.count})
          </span>
        ))}
      </div>
    )}
  </div>
)}
```

**Step 3: Commit**

```bash
git add api/src/routes/instructors.ts frontend/src/pages/ProfessorDetail.tsx
git commit -m "feat: display RMP tags and would-take-again on professor pages"
```

---

### Task 12: Frontend — source filter on reviews

**Files:**
- Modify: `frontend/src/pages/CourseDetail.tsx` (add source filter to reviews section)
- Modify: `api/src/routes/reviews.ts` (add optional `source` query param)
- Modify: `api/src/services/reviewService.ts` (filter by source)

**Step 1: Add source filter to API**

In `api/src/services/reviewService.ts`, modify `getReviewsForCourse` to accept an optional `source` param:

```typescript
export async function getReviewsForCourse(courseId: number, source?: "native" | "rmp") {
  // Add to the .where() clause:
  const conditions = [eq(reviews.courseId, courseId)];
  if (source) conditions.push(eq(reviews.source, source));
  // Use and(...conditions) in .where()
```

**Step 2: Add query param to route**

In `api/src/routes/reviews.ts`, pass the `source` query param:

```typescript
const source = req.query.source as "native" | "rmp" | undefined;
const data = await getReviewsForCourse(courseId, source);
```

**Step 3: Add filter UI to CourseDetail**

In the reviews section of `frontend/src/pages/CourseDetail.tsx`, add a small filter:

```tsx
<div className="flex gap-2 mb-3">
  {["all", "native", "rmp"].map((s) => (
    <button
      key={s}
      onClick={() => setSourceFilter(s === "all" ? undefined : s)}
      className={`text-xs px-2 py-1 rounded-full ${
        sourceFilter === (s === "all" ? undefined : s)
          ? "bg-primary-100 text-primary-700"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      }`}
    >
      {s === "all" ? "All" : s === "native" ? "BetterAtlas" : "RateMyProfessor"}
    </button>
  ))}
</div>
```

**Step 4: Commit**

```bash
git add api/src/services/reviewService.ts api/src/routes/reviews.ts frontend/src/pages/CourseDetail.tsx
git commit -m "feat: add review source filter (all/native/RMP)"
```

---

### Task 13: Run the seed script and verify

**Step 1: Run the import**

```bash
cd api && pnpm rmp:seed
```

Watch the output for:
- System user created
- Professors matched (expect 60-80% match rate)
- Reviews imported
- Aggregate caches refreshed

**Step 2: Verify data in database**

```bash
cd api && node --loader tsx -e "
import { db } from './src/db/index.js';
import { reviews, rmpProfessors, rmpProfessorTags } from './src/db/schema.js';
import { eq, sql } from 'drizzle-orm';

const rmpReviewCount = await db.select({ count: sql\`count(*)\` }).from(reviews).where(eq(reviews.source, 'rmp'));
const profCount = await db.select({ count: sql\`count(*)\` }).from(rmpProfessors);
const tagCount = await db.select({ count: sql\`count(*)\` }).from(rmpProfessorTags);

console.log('RMP reviews:', rmpReviewCount[0].count);
console.log('RMP professors linked:', profCount[0].count);
console.log('RMP tags:', tagCount[0].count);
process.exit(0);
"
```

**Step 3: Verify frontend**

1. Open the app in browser
2. Navigate to a course with reviews — verify RMP badge appears
3. Navigate to a professor page — verify RMP tags and would-take-again show
4. Test the source filter on reviews

**Step 4: Review the unmatched professors log**

Check `api/rmp-unmatched.json` for professors that didn't match. Consider:
- Are there naming discrepancies that could be fixed?
- Are these genuine mismatches (professors not in your Atlas data)?

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete RMP data import with seed data"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Install deps | `api/package.json` |
| 2 | Schema: source + external_id + nullable workload | `schema.ts`, `review.ts`, `validation.ts` |
| 3 | Schema: rmp_professors + rmp_professor_tags | `schema.ts` |
| 4 | Professor matching utility + tests | `rmpMatching.ts`, `rmpMatching.test.ts` |
| 5 | Course matching utility + tests | `rmpMatching.ts`, `rmpMatching.test.ts` |
| 6 | Seed script skeleton | `rmpSeed.ts`, `package.json` |
| 7 | RMP API integration (fill TODOs) | `rmpSeed.ts` |
| 8 | Handle sectionId unique constraint | `schema.ts` |
| 9 | API: return source field | `reviewService.ts`, `review.ts` |
| 10 | Frontend: RMP badge + null workload | `ReviewCard.tsx` |
| 11 | Frontend: tags + would-take-again | `instructors.ts`, `ProfessorDetail.tsx` |
| 12 | Frontend: source filter | `reviewService.ts`, `reviews.ts`, `CourseDetail.tsx` |
| 13 | Run seed + verify | N/A (manual) |
