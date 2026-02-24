# Enriched Course Embeddings Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enrich course embeddings with instructor data, ratings, enrollment stats, and LLM-generated review summaries to improve AI recommendation quality.

**Architecture:** Add a `course_review_summaries` table for storing LLM-generated summaries. Create a two-phase backfill job: Phase 1 summarizes reviews via gpt-4o-mini, Phase 2 builds enriched embedding text (with ratings, instructors, summaries) and embeds via text-embedding-3-small. Reuses existing pgvector infrastructure.

**Tech Stack:** PostgreSQL + pgvector, Drizzle ORM, OpenAI API (gpt-4o-mini for summaries, text-embedding-3-small for embeddings), TypeScript

---

### Task 1: Add `course_review_summaries` table

**Files:**
- Modify: `api/src/db/schema.ts` (add Drizzle table definition)
- Modify: `schema-migration.sql` (add SQL migration)

**Step 1: Add Drizzle schema definition**

In `api/src/db/schema.ts`, add this after the `aiTrainerScores` table definition (around line 702):

```typescript
// Course Review Summaries (LLM-generated summaries of student reviews)
export const courseReviewSummaries = pgTable("course_review_summaries", {
  courseId: integer("course_id")
    .primaryKey()
    .references(() => courses.id),
  summary: text("summary").notNull(),
  reviewCount: integer("review_count").notNull(),
  reviewHash: varchar("review_hash", { length: 64 }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
```

**Step 2: Add SQL migration**

Append to `schema-migration.sql`:

```sql
-- Course review summaries (LLM-generated)
CREATE TABLE IF NOT EXISTS course_review_summaries (
  course_id INTEGER PRIMARY KEY REFERENCES courses(id),
  summary TEXT NOT NULL,
  review_count INTEGER NOT NULL,
  review_hash VARCHAR(64) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Step 3: Apply the migration**

Run against the database:
```bash
cd api && npx tsx -e "
import { db } from './src/db/index.js';
import { sql } from 'drizzle-orm';
await db.execute(sql\`
  CREATE TABLE IF NOT EXISTS course_review_summaries (
    course_id INTEGER PRIMARY KEY REFERENCES courses(id),
    summary TEXT NOT NULL,
    review_count INTEGER NOT NULL,
    review_hash VARCHAR(64) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
\`);
console.log('done');
process.exit(0);
"
```

Alternatively, run the SQL directly via `psql` or the Supabase SQL editor.

**Step 4: Verify TypeScript compiles**

Run: `cd api && npx tsc --noEmit`

**Step 5: Commit**

```bash
git add api/src/db/schema.ts schema-migration.sql
git commit -m "feat: add course_review_summaries table for LLM review summaries"
```

---

### Task 2: Create the review summarization job (Phase 1)

**Files:**
- Create: `api/src/jobs/reviewSummarization.ts`

**Step 1: Create the summarization job**

Create `api/src/jobs/reviewSummarization.ts`:

```typescript
import crypto from "node:crypto";
import { sql } from "drizzle-orm";
import { env } from "../config/env.js";
import { db } from "../db/index.js";
import { openAiChatJson } from "../lib/openai.js";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function sha256Hex(text: string) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

type CourseReviewBundle = {
  courseId: number;
  courseCode: string;
  courseTitle: string;
  reviews: Array<{
    ratingQuality: string;
    ratingDifficulty: string;
    ratingWorkload: string | null;
    comment: string | null;
  }>;
};

async function loadCoursesWithReviews(): Promise<CourseReviewBundle[]> {
  const rows = (await db.execute(sql`
    SELECT
      c.id AS course_id,
      c.code AS course_code,
      c.title AS course_title,
      json_agg(
        json_build_object(
          'ratingQuality', r.rating_quality,
          'ratingDifficulty', r.rating_difficulty,
          'ratingWorkload', r.rating_workload,
          'comment', r.comment
        )
        ORDER BY r.created_at DESC
      ) AS reviews
    FROM courses c
    JOIN reviews r ON r.course_id = c.id
    GROUP BY c.id, c.code, c.title
    HAVING count(r.id) >= 1
    ORDER BY c.code
  `)) as any[];

  return rows.map((r) => ({
    courseId: Number(r.course_id),
    courseCode: String(r.course_code),
    courseTitle: String(r.course_title),
    reviews: (Array.isArray(r.reviews) ? r.reviews : []).slice(0, 20),
  }));
}

async function loadExistingHashes(): Promise<Map<number, string>> {
  const rows = (await db.execute(sql`
    SELECT course_id, review_hash FROM course_review_summaries
  `)) as any[];

  const out = new Map<number, string>();
  for (const r of rows) {
    const id = Number(r?.course_id);
    const h = typeof r?.review_hash === "string" ? r.review_hash : "";
    if (Number.isFinite(id) && h) out.set(id, h);
  }
  return out;
}

function buildReviewHash(reviews: CourseReviewBundle["reviews"]): string {
  const text = reviews
    .map((r) => `${r.ratingQuality}|${r.ratingDifficulty}|${r.ratingWorkload ?? ""}|${r.comment ?? ""}`)
    .join("\n");
  return sha256Hex(text);
}

function buildSummarizationPrompt(bundle: CourseReviewBundle): string {
  const reviewTexts = bundle.reviews
    .map((r, i) => {
      const parts = [`Review ${i + 1}: Quality ${r.ratingQuality}/5, Difficulty ${r.ratingDifficulty}/5`];
      if (r.ratingWorkload) parts[0] += `, Workload ${r.ratingWorkload}/10`;
      if (r.comment) parts.push(r.comment.slice(0, 500));
      return parts.join("\n");
    })
    .join("\n\n");

  return `Summarize student feedback for ${bundle.courseCode} "${bundle.courseTitle}" in 2-4 sentences. Cover teaching quality, difficulty, workload, and common praise or complaints. Be specific and factual based on the reviews below. Do not make up information.\n\n${reviewTexts}`;
}

async function summarizeCourse(bundle: CourseReviewBundle): Promise<string> {
  const prompt = buildSummarizationPrompt(bundle);
  const { parsed } = await openAiChatJson({
    messages: [
      {
        role: "system",
        content: "You summarize student course reviews. Return JSON: {\"summary\": \"...\"}. Be concise and factual.",
      },
      { role: "user", content: prompt },
    ],
    model: env.openaiModel,
    temperature: 0.2,
    maxTokens: 300,
    responseFormat: { type: "json_object" },
    timeoutMs: 20_000,
  });

  const summary = (parsed as any)?.summary;
  if (typeof summary !== "string" || summary.length < 10) {
    throw new Error(`Invalid summary response for course ${bundle.courseId}`);
  }
  return summary.trim();
}

async function upsertSummary(courseId: number, summary: string, reviewCount: number, reviewHash: string) {
  await db.execute(sql`
    INSERT INTO course_review_summaries (course_id, summary, review_count, review_hash, updated_at)
    VALUES (${courseId}, ${summary}, ${reviewCount}, ${reviewHash}, now())
    ON CONFLICT (course_id) DO UPDATE SET
      summary = EXCLUDED.summary,
      review_count = EXCLUDED.review_count,
      review_hash = EXCLUDED.review_hash,
      updated_at = EXCLUDED.updated_at
  `);
}

export async function runReviewSummarization() {
  if (!env.openaiApiKey) throw new Error("OPENAI_API_KEY is required");

  console.log("[summaries] loading courses with reviews...");
  const bundles = await loadCoursesWithReviews();
  console.log(`[summaries] courses with reviews: ${bundles.length}`);

  const existing = await loadExistingHashes();
  console.log(`[summaries] existing summaries: ${existing.size}`);

  const toSummarize = bundles.filter((b) => {
    const hash = buildReviewHash(b.reviews);
    return existing.get(b.courseId) !== hash;
  });

  console.log(`[summaries] pending summaries: ${toSummarize.length}`);
  if (toSummarize.length === 0) return;

  const delayMs = Math.max(0, Number(process.env.SUMMARIES_DELAY_MS ?? "200"));
  let done = 0;

  for (const bundle of toSummarize) {
    try {
      const summary = await summarizeCourse(bundle);
      const hash = buildReviewHash(bundle.reviews);
      await upsertSummary(bundle.courseId, summary, bundle.reviews.length, hash);
      done++;
      console.log(`[summaries] ${done}/${toSummarize.length} — ${bundle.courseCode}`);
    } catch (e: any) {
      console.error(`[summaries] FAILED ${bundle.courseCode}: ${e?.message || e}`);
    }
    if (delayMs > 0) await sleep(delayMs);
  }

  console.log(`[summaries] done (${done}/${toSummarize.length} succeeded)`);
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd api && npx tsc --noEmit`

**Step 3: Commit**

```bash
git add api/src/jobs/reviewSummarization.ts
git commit -m "feat: add review summarization job (Phase 1 of enriched embeddings)"
```

---

### Task 3: Enrich the embedding text function and integrate Phase 1 + Phase 2

**Files:**
- Modify: `api/src/jobs/courseEmbeddingsBackfill.ts`

**Step 1: Update the backfill job to run both phases**

Replace the contents of `api/src/jobs/courseEmbeddingsBackfill.ts` with:

```typescript
import crypto from "node:crypto";
import { sql } from "drizzle-orm";
import { env } from "../config/env.js";
import { db } from "../db/index.js";
import { openAiEmbedText } from "../lib/openaiEmbeddings.js";
import { areCourseEmbeddingsAvailable, listCourses } from "../services/courseService.js";
import { runReviewSummarization } from "./reviewSummarization.js";
import type { CourseWithRatings } from "@betteratlas/shared";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function sha256Hex(text: string) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function truncateText(s: string, max: number) {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : t.slice(0, Math.max(0, max - 1)).trimEnd() + "...";
}

function fmt(n: number | null | undefined, label: string): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  return `${label}: ${n.toFixed(1)}`;
}

type EnrichmentData = {
  instructorRatings: Map<number, Array<{ name: string; avgQuality: number | null }>>;
  reviewSummaries: Map<number, string>;
  enrollmentPercents: Map<number, number>;
};

async function loadEnrichmentData(): Promise<EnrichmentData> {
  // Instructor ratings per course
  const instrRows = (await db.execute(sql`
    SELECT
      cir.course_id,
      i.name,
      cir.avg_quality
    FROM course_instructor_ratings cir
    JOIN instructors i ON i.id = cir.instructor_id
    ORDER BY cir.course_id, cir.avg_quality DESC NULLS LAST
  `)) as any[];

  const instructorRatings = new Map<number, Array<{ name: string; avgQuality: number | null }>>();
  for (const r of instrRows) {
    const courseId = Number(r.course_id);
    if (!instructorRatings.has(courseId)) instructorRatings.set(courseId, []);
    instructorRatings.get(courseId)!.push({
      name: String(r.name),
      avgQuality: r.avg_quality != null ? Number(r.avg_quality) : null,
    });
  }

  // Review summaries
  const summRows = (await db.execute(sql`
    SELECT course_id, summary FROM course_review_summaries
  `)) as any[];

  const reviewSummaries = new Map<number, string>();
  for (const r of summRows) {
    reviewSummaries.set(Number(r.course_id), String(r.summary));
  }

  // Average enrollment percent per course
  const enrRows = (await db.execute(sql`
    SELECT
      course_id,
      ROUND(AVG(
        CASE WHEN enrollment_cap > 0
          THEN (enrollment_cur::numeric / enrollment_cap) * 100
          ELSE NULL
        END
      ))::int AS avg_pct
    FROM sections
    WHERE is_active = true AND enrollment_cap > 0
    GROUP BY course_id
  `)) as any[];

  const enrollmentPercents = new Map<number, number>();
  for (const r of enrRows) {
    const pct = Number(r.avg_pct);
    if (Number.isFinite(pct)) enrollmentPercents.set(Number(r.course_id), pct);
  }

  return { instructorRatings, reviewSummaries, enrollmentPercents };
}

function embeddingTextFromCourse(c: CourseWithRatings, enrich: EnrichmentData): string {
  const parts: string[] = [];

  // Core catalog data
  parts.push(`Code: ${c.code}`);
  parts.push(`Title: ${c.title}`);
  if (c.department?.code) parts.push(`Department: ${c.department.code}`);
  if (c.credits) parts.push(`Credits: ${c.credits}`);
  if (c.gers && c.gers.length > 0) parts.push(`GER: ${c.gers.join(", ")}`);
  if (c.campuses && c.campuses.length > 0) parts.push(`Campus: ${c.campuses.join(", ")}`);
  if (c.prerequisites) parts.push(`Prerequisites: ${truncateText(String(c.prerequisites), 400)}`);
  if (c.requirements) parts.push(`Requirements: ${truncateText(String(c.requirements), 600)}`);

  // Instructor data with quality ratings
  const instrData = enrich.instructorRatings.get(c.id);
  if (instrData && instrData.length > 0) {
    const instrText = instrData
      .slice(0, 5)
      .map((i) => (i.avgQuality != null ? `${i.name} (quality ${i.avgQuality.toFixed(1)}/5)` : i.name))
      .join(", ");
    parts.push(`Instructors: ${instrText}`);
  } else if (c.instructors && c.instructors.length > 0) {
    parts.push(`Instructors: ${c.instructors.slice(0, 5).join(", ")}`);
  }

  // Aggregate ratings
  const ratingParts = [
    fmt(c.avgQuality, "quality"),
    fmt(c.avgDifficulty, "difficulty"),
    fmt(c.avgWorkload, "workload"),
  ].filter(Boolean);
  if (ratingParts.length > 0) {
    const countStr = c.reviewCount > 0 ? `, ${c.reviewCount} reviews` : "";
    parts.push(`Ratings: ${ratingParts.join("/5, ")}/5${countStr}`);
  }

  // Enrollment
  const enrPct = enrich.enrollmentPercents.get(c.id);
  if (enrPct != null) parts.push(`Enrollment: ${enrPct}% average enrollment`);

  // Description
  if (c.description) parts.push(`Description: ${truncateText(String(c.description), 1600)}`);

  // Review summary
  const summary = enrich.reviewSummaries.get(c.id);
  if (summary) parts.push(`Student Feedback: ${truncateText(summary, 800)}`);

  return parts.join("\n");
}

async function loadAllCourses(): Promise<CourseWithRatings[]> {
  const out: CourseWithRatings[] = [];
  const limit = 100;
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const resp = await listCourses({ page, limit, sort: "code" } as any);
    out.push(...(resp.data ?? []));
    totalPages = resp.meta?.totalPages ?? totalPages;
    page++;
  }

  return out;
}

async function loadExistingHashes(): Promise<Map<number, string>> {
  const rows = (await db.execute(sql`
    SELECT course_id, content_hash FROM course_embeddings
  `)) as any[];

  const out = new Map<number, string>();
  for (const r of rows) {
    const id = Number(r?.course_id);
    const h = typeof r?.content_hash === "string" ? r.content_hash : "";
    if (Number.isFinite(id) && h) out.set(id, h);
  }
  return out;
}

async function upsertEmbeddingBatch(batch: Array<{ courseId: number; hash: string; vec: string }>) {
  if (batch.length === 0) return;

  const values = sql.join(
    batch.map((b) => sql`(${b.courseId}, ${b.hash}, ${b.vec}::vector, now())`),
    sql`, `
  );

  await db.execute(sql`
    INSERT INTO course_embeddings (course_id, content_hash, embedding, updated_at)
    VALUES ${values}
    ON CONFLICT (course_id) DO UPDATE SET
      content_hash = EXCLUDED.content_hash,
      embedding = EXCLUDED.embedding,
      updated_at = EXCLUDED.updated_at
  `);
}

function embeddingToVectorLiteral(embedding: number[]) {
  const clean = embedding.map((v) => (Number.isFinite(v) ? v : 0));
  return `[${clean.join(",")}]`;
}

async function main() {
  if (!env.databaseUrl) throw new Error("DATABASE_URL is required");
  if (!env.openaiApiKey) throw new Error("OPENAI_API_KEY is required");

  const ok = await areCourseEmbeddingsAvailable();
  if (!ok) {
    throw new Error(
      "course_embeddings table not found. Apply schema-migration.sql first."
    );
  }

  // ── Phase 1: Review Summarization ──
  console.log("\n=== Phase 1: Review Summarization ===\n");
  await runReviewSummarization();

  // ── Phase 2: Embedding Generation ──
  console.log("\n=== Phase 2: Embedding Generation ===\n");

  const batchSize = Math.max(1, Math.min(96, Number(process.env.EMBEDDINGS_BATCH_SIZE ?? "48")));
  const delayMs = Math.max(0, Number(process.env.EMBEDDINGS_DELAY_MS ?? "0"));

  console.log("[embeddings] loading courses...");
  const courses = await loadAllCourses();
  console.log(`[embeddings] courses loaded: ${courses.length}`);

  console.log("[embeddings] loading enrichment data...");
  const enrich = await loadEnrichmentData();
  console.log(
    `[embeddings] enrichment: ${enrich.instructorRatings.size} instructor sets, ` +
    `${enrich.reviewSummaries.size} summaries, ${enrich.enrollmentPercents.size} enrollment records`
  );

  console.log("[embeddings] loading existing hashes...");
  const existing = await loadExistingHashes();
  console.log(`[embeddings] existing embeddings: ${existing.size}`);

  const toEmbed: Array<{ courseId: number; hash: string; text: string }> = [];
  for (const c of courses) {
    const text = embeddingTextFromCourse(c, enrich);
    const hash = sha256Hex(text);
    const prev = existing.get(c.id);
    if (prev && prev === hash) continue;
    toEmbed.push({ courseId: c.id, hash, text });
  }

  console.log(`[embeddings] pending embeddings: ${toEmbed.length}`);
  if (toEmbed.length === 0) {
    console.log("[embeddings] all up to date");
    return;
  }

  let done = 0;
  for (let i = 0; i < toEmbed.length; i += batchSize) {
    const chunk = toEmbed.slice(i, i + batchSize);
    const inputs = chunk.map((x) => x.text);

    const embeddings = (await openAiEmbedText({ input: inputs })) as number[][];
    if (!Array.isArray(embeddings) || embeddings.length !== inputs.length) {
      throw new Error("OpenAI embeddings returned an unexpected shape");
    }

    const upsertBatch = chunk.map((x, idx) => ({
      courseId: x.courseId,
      hash: x.hash,
      vec: embeddingToVectorLiteral(embeddings[idx] ?? []),
    }));

    await upsertEmbeddingBatch(upsertBatch);
    done += chunk.length;

    console.log(`[embeddings] upserted ${done}/${toEmbed.length}`);
    if (delayMs > 0) await sleep(delayMs);
  }

  console.log("[embeddings] done");
}

main().catch((e) => {
  console.error("[embeddings] failed:", e);
  process.exitCode = 1;
});
```

**Step 2: Verify TypeScript compiles**

Run: `cd api && npx tsc --noEmit`

**Step 3: Commit**

```bash
git add api/src/jobs/courseEmbeddingsBackfill.ts
git commit -m "feat: enrich embedding text with ratings, instructors, and review summaries"
```

---

### Task 4: Run the backfill and verify

**Step 1: Run the backfill job**

```bash
cd api && pnpm embeddings:backfill
```

Expected output:
```
=== Phase 1: Review Summarization ===

[summaries] loading courses with reviews...
[summaries] courses with reviews: NNN
[summaries] existing summaries: 0
[summaries] pending summaries: NNN
[summaries] 1/NNN — ACCT 201
...
[summaries] done (NNN/NNN succeeded)

=== Phase 2: Embedding Generation ===

[embeddings] loading courses...
[embeddings] courses loaded: NNN
[embeddings] loading enrichment data...
[embeddings] enrichment: NNN instructor sets, NNN summaries, NNN enrollment records
[embeddings] loading existing hashes...
[embeddings] existing embeddings: NNN
[embeddings] pending embeddings: NNN (all should re-embed since text changed)
...
[embeddings] done
```

**Step 2: Verify data in the database**

Check that summaries were stored:
```sql
SELECT course_id, review_count, length(summary) AS summary_len
FROM course_review_summaries
ORDER BY review_count DESC
LIMIT 10;
```

Check that embeddings were updated (content_hash should have changed):
```sql
SELECT count(*) FROM course_embeddings
WHERE updated_at > now() - interval '1 hour';
```

**Step 3: Test AI recommendations**

Navigate to `/ai` in the app and ask something like "Find me an easy but interesting science class." The semantic search should now return more contextually relevant results since the embeddings encode ratings, instructor quality, and student sentiment.

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "chore: run enriched embeddings backfill"
```
