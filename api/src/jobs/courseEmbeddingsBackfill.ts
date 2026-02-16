import crypto from "node:crypto";
import { sql } from "drizzle-orm";
import { env } from "../config/env.js";
import { db } from "../db/index.js";
import { openAiEmbedText } from "../lib/openaiEmbeddings.js";
import { areCourseEmbeddingsAvailable, listCourses } from "../services/courseService.js";
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

function embeddingTextFromCourse(c: CourseWithRatings) {
  const parts: string[] = [];
  parts.push(`Code: ${c.code}`);
  parts.push(`Title: ${c.title}`);
  if (c.department?.code) parts.push(`Department: ${c.department.code}`);
  if (c.gers && c.gers.length > 0) parts.push(`GER: ${c.gers.join(", ")}`);
  if (c.campuses && c.campuses.length > 0) parts.push(`Campus: ${c.campuses.join(", ")}`);
  if (c.prerequisites) parts.push(`Prerequisites: ${truncateText(String(c.prerequisites), 400)}`);
  if (c.requirements) parts.push(`Requirements: ${truncateText(String(c.requirements), 600)}`);
  if (c.description) parts.push(`Description: ${truncateText(String(c.description), 1600)}`);
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

async function main() {
  if (!env.databaseUrl) throw new Error("DATABASE_URL is required");
  if (!env.openaiApiKey) throw new Error("OPENAI_API_KEY is required");

  const ok = await areCourseEmbeddingsAvailable();
  if (!ok) {
    throw new Error(
      "course_embeddings table not found. Apply schema-migration.sql (pgvector + course_embeddings) first."
    );
  }

  const batchSize = Math.max(1, Math.min(96, Number(process.env.EMBEDDINGS_BATCH_SIZE ?? "48")));
  const delayMs = Math.max(0, Number(process.env.EMBEDDINGS_DELAY_MS ?? "0"));

  console.log(`[embeddings] loading courses...`);
  const courses = await loadAllCourses();
  console.log(`[embeddings] courses loaded: ${courses.length}`);

  console.log(`[embeddings] loading existing hashes...`);
  const existing = await loadExistingHashes();
  console.log(`[embeddings] existing embeddings: ${existing.size}`);

  const toEmbed: Array<{ courseId: number; hash: string; text: string }> = [];
  for (const c of courses) {
    const text = embeddingTextFromCourse(c);
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

