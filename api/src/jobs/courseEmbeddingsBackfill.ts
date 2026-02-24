import crypto from "node:crypto";
import { sql } from "drizzle-orm";
import { env } from "../config/env.js";
import { db } from "../db/index.js";
import { openAiEmbedText } from "../lib/openaiEmbeddings.js";
import { areCourseEmbeddingsAvailable, listCourses } from "../services/courseService.js";
import type { CourseWithRatings } from "@betteratlas/shared";
import { runReviewSummarization } from "./reviewSummarization.js";

/* ------------------------------------------------------------------ */
/*  Utility helpers                                                    */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Enrichment data types & loader                                     */
/* ------------------------------------------------------------------ */

interface InstructorRating {
  name: string;
  avgQuality: number | null;
}

interface EnrichmentData {
  instructorRatings: Map<number, InstructorRating[]>;
  reviewSummaries: Map<number, string>;
  avgEnrollmentPercent: Map<number, number>;
}

async function loadEnrichmentData(): Promise<EnrichmentData> {
  // Instructor ratings per course
  const instrRows = (await db.execute(sql`
    select
      cir.course_id,
      i.name,
      cir.avg_quality
    from course_instructor_ratings cir
    inner join instructors i on i.id = cir.instructor_id
    order by cir.course_id, cir.avg_quality desc nulls last
  `)) as any[];

  const instructorRatings = new Map<number, InstructorRating[]>();
  for (const r of instrRows) {
    const id = Number(r.course_id);
    if (!Number.isFinite(id)) continue;
    if (!instructorRatings.has(id)) instructorRatings.set(id, []);
    instructorRatings.get(id)!.push({
      name: String(r.name),
      avgQuality: r.avg_quality != null ? Number(r.avg_quality) : null,
    });
  }

  // Review summaries
  const summaryRows = (await db.execute(sql`
    select course_id, summary from course_review_summaries
  `)) as any[];

  const reviewSummaries = new Map<number, string>();
  for (const r of summaryRows) {
    const id = Number(r.course_id);
    const summary = typeof r.summary === "string" ? r.summary.trim() : "";
    if (Number.isFinite(id) && summary) reviewSummaries.set(id, summary);
  }

  // Average enrollment percentage from active sections
  const enrollRows = (await db.execute(sql`
    select
      course_id,
      round(avg(enrollment_cur::numeric / enrollment_cap * 100), 0) as avg_pct
    from sections
    where is_active = true and enrollment_cap > 0
    group by course_id
  `)) as any[];

  const avgEnrollmentPercent = new Map<number, number>();
  for (const r of enrollRows) {
    const id = Number(r.course_id);
    const pct = Number(r.avg_pct);
    if (Number.isFinite(id) && Number.isFinite(pct)) avgEnrollmentPercent.set(id, pct);
  }

  return { instructorRatings, reviewSummaries, avgEnrollmentPercent };
}

/* ------------------------------------------------------------------ */
/*  Embedding text builder                                             */
/* ------------------------------------------------------------------ */

function embeddingTextFromCourse(c: CourseWithRatings, enrich: EnrichmentData) {
  const parts: string[] = [];

  parts.push(`Code: ${c.code}`);
  parts.push(`Title: ${c.title}`);
  if (c.department?.code) parts.push(`Department: ${c.department.code}`);
  if (c.credits) parts.push(`Credits: ${c.credits}`);
  if (c.gers && c.gers.length > 0) parts.push(`GER: ${c.gers.join(", ")}`);
  if (c.campuses && c.campuses.length > 0) parts.push(`Campus: ${c.campuses.join(", ")}`);
  if (c.prerequisites) parts.push(`Prerequisites: ${truncateText(String(c.prerequisites), 400)}`);
  if (c.requirements) parts.push(`Requirements: ${truncateText(String(c.requirements), 600)}`);

  // Instructors with per-instructor quality ratings
  const instrRatings = enrich.instructorRatings.get(c.id);
  if (instrRatings && instrRatings.length > 0) {
    const instrParts = instrRatings.map((ir) =>
      ir.avgQuality != null
        ? `${ir.name} (quality ${ir.avgQuality.toFixed(1)}/5)`
        : ir.name,
    );
    parts.push(`Instructors: ${instrParts.join(", ")}`);
  } else if (c.instructors && c.instructors.length > 0) {
    parts.push(`Instructors: ${c.instructors.join(", ")}`);
  }

  // Aggregate ratings
  if (c.avgQuality != null || c.avgDifficulty != null || c.avgWorkload != null) {
    const ratingParts: string[] = [];
    if (c.avgQuality != null) ratingParts.push(`quality ${c.avgQuality.toFixed(1)}/5`);
    if (c.avgDifficulty != null) ratingParts.push(`difficulty ${c.avgDifficulty.toFixed(1)}/5`);
    if (c.avgWorkload != null) ratingParts.push(`workload ${c.avgWorkload.toFixed(1)}/5`);
    if (c.reviewCount) ratingParts.push(`${c.reviewCount} reviews`);
    parts.push(`Ratings: ${ratingParts.join(", ")}`);
  }

  // Enrollment percentage
  const enrollPct = enrich.avgEnrollmentPercent.get(c.id);
  if (enrollPct != null) {
    parts.push(`Enrollment: ${enrollPct}% average enrollment`);
  }

  if (c.description) parts.push(`Description: ${truncateText(String(c.description), 1600)}`);

  // Student feedback from review summaries
  const summary = enrich.reviewSummaries.get(c.id);
  if (summary) {
    parts.push(`Student Feedback: ${truncateText(summary, 800)}`);
  }

  return parts.join("\n");
}

/* ------------------------------------------------------------------ */
/*  Course loading                                                     */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Embedding persistence                                              */
/* ------------------------------------------------------------------ */

async function loadExistingHashes(): Promise<Map<number, string>> {
  const rows = (await db.execute(sql`
    select course_id, content_hash
    from course_embeddings
  `)) as any[];

  const out = new Map<number, string>();
  for (const r of rows) {
    const id = Number(r?.course_id);
    const h = typeof r?.content_hash === "string" ? r.content_hash : "";
    if (!Number.isFinite(id) || !h) continue;
    out.set(id, h);
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
    insert into course_embeddings (course_id, content_hash, embedding, updated_at)
    values ${values}
    on conflict (course_id) do update set
      content_hash = excluded.content_hash,
      embedding = excluded.embedding,
      updated_at = excluded.updated_at
  `);
}

function embeddingToVectorLiteral(embedding: number[]) {
  const clean = embedding.map((v) => (Number.isFinite(v) ? v : 0));
  return `[${clean.join(",")}]`;
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

async function main() {
  if (!env.databaseUrl) throw new Error("DATABASE_URL is required");
  if (!env.openaiApiKey) throw new Error("OPENAI_API_KEY is required");

  const ok = await areCourseEmbeddingsAvailable();
  if (!ok) {
    throw new Error(
      "course_embeddings table not found. Apply schema-migration.sql (pgvector + course_embeddings) first."
    );
  }

  /* ---- Phase 1: Review summarization ---- */
  console.log("[embeddings] Phase 1 — generating review summaries...");
  await runReviewSummarization();

  /* ---- Phase 2: Enriched embeddings ---- */
  console.log("[embeddings] Phase 2 — building enriched embeddings...");

  const batchSize = Math.max(1, Math.min(96, Number(process.env.EMBEDDINGS_BATCH_SIZE ?? "48")));
  const delayMs = Math.max(0, Number(process.env.EMBEDDINGS_DELAY_MS ?? "0"));

  console.log(`[embeddings] loading courses...`);
  const courses = await loadAllCourses();
  console.log(`[embeddings] courses loaded: ${courses.length}`);

  console.log(`[embeddings] loading enrichment data...`);
  const enrich = await loadEnrichmentData();
  console.log(
    `[embeddings] enrichment — instructors: ${enrich.instructorRatings.size}, summaries: ${enrich.reviewSummaries.size}, enrollment: ${enrich.avgEnrollmentPercent.size}`
  );

  console.log(`[embeddings] loading existing hashes...`);
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
  if (toEmbed.length === 0) return;

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
