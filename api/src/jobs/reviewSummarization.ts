import crypto from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { openAiChatJson } from "../lib/openai.js";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function sha256Hex(text: string) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

interface CourseWithReviews {
  courseId: number;
  code: string;
  title: string;
  reviews: Array<{
    ratingQuality: string;
    ratingDifficulty: string;
    ratingWorkload: string | null;
    comment: string | null;
  }>;
}

/**
 * Load all courses that have reviews, with up to 20 most recent reviews each.
 */
async function loadCoursesWithReviews(): Promise<CourseWithReviews[]> {
  const rows = (await db.execute(sql`
    select
      c.id        as course_id,
      c.code      as code,
      c.title     as title,
      r.rating_quality,
      r.rating_difficulty,
      r.rating_workload,
      r.comment
    from courses c
    inner join lateral (
      select rv.rating_quality, rv.rating_difficulty, rv.rating_workload, rv.comment
      from reviews rv
      where rv.course_id = c.id
      order by rv.created_at desc
      limit 20
    ) r on true
    order by c.id
  `)) as any[];

  const map = new Map<number, CourseWithReviews>();
  for (const r of rows) {
    const id = Number(r.course_id);
    if (!map.has(id)) {
      map.set(id, {
        courseId: id,
        code: String(r.code),
        title: String(r.title),
        reviews: [],
      });
    }
    map.get(id)!.reviews.push({
      ratingQuality: String(r.rating_quality),
      ratingDifficulty: String(r.rating_difficulty),
      ratingWorkload: r.rating_workload != null ? String(r.rating_workload) : null,
      comment: r.comment != null ? String(r.comment) : null,
    });
  }

  return Array.from(map.values());
}

/**
 * Load existing review hashes from course_review_summaries.
 */
async function loadExistingHashes(): Promise<Map<number, string>> {
  const rows = (await db.execute(sql`
    select course_id, review_hash from course_review_summaries
  `)) as any[];

  const out = new Map<number, string>();
  for (const r of rows) {
    const id = Number(r?.course_id);
    const h = typeof r?.review_hash === "string" ? r.review_hash : "";
    if (!Number.isFinite(id) || !h) continue;
    out.set(id, h);
  }
  return out;
}

/**
 * Build a deterministic hash of review content for change detection.
 */
function hashReviews(
  reviews: CourseWithReviews["reviews"],
): string {
  const parts = reviews.map(
    (r) =>
      `${r.ratingQuality}|${r.ratingDifficulty}|${r.ratingWorkload ?? ""}|${r.comment ?? ""}`,
  );
  return sha256Hex(parts.join("\n"));
}

/**
 * Format reviews into a text block for the LLM prompt.
 */
function formatReviewsForPrompt(reviews: CourseWithReviews["reviews"]): string {
  return reviews
    .map((r, i) => {
      const workload =
        r.ratingWorkload != null ? `, Workload ${r.ratingWorkload}/10` : "";
      const header = `Review ${i + 1}: Quality ${r.ratingQuality}/5, Difficulty ${r.ratingDifficulty}/5${workload}`;
      const comment =
        r.comment != null ? r.comment.slice(0, 500) : "(no comment)";
      return `${header}\n${comment}`;
    })
    .join("\n\n");
}

/**
 * Call OpenAI to generate a summary for a course's reviews.
 */
async function summarizeCourse(course: CourseWithReviews): Promise<string> {
  const systemPrompt = [
    `Summarize student feedback for ${course.code} "${course.title}" in 2-4 sentences.`,
    "Cover teaching quality, difficulty, workload, and common praise or complaints.",
    "Be specific and factual based on the reviews below. Do not make up information.",
  ].join(" ");

  const userContent = formatReviewsForPrompt(course.reviews);

  const { parsed } = await openAiChatJson({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    model: "gpt-4o-mini",
    temperature: 0.2,
    maxTokens: 300,
    responseFormat: { type: "json_object" },
    timeoutMs: 20_000,
  });

  const summary = (parsed as any)?.summary;
  if (typeof summary !== "string" || summary.trim().length === 0) {
    throw new Error("OpenAI did not return a valid summary string");
  }
  return summary.trim();
}

/**
 * Upsert a summary into course_review_summaries.
 */
async function upsertSummary(
  courseId: number,
  summary: string,
  reviewCount: number,
  reviewHash: string,
) {
  await db.execute(sql`
    insert into course_review_summaries (course_id, summary, review_count, review_hash, updated_at)
    values (${courseId}, ${summary}, ${reviewCount}, ${reviewHash}, now())
    on conflict (course_id) do update set
      summary = excluded.summary,
      review_count = excluded.review_count,
      review_hash = excluded.review_hash,
      updated_at = excluded.updated_at
  `);
}

/**
 * Run the review summarization job (Phase 1 of enriched embeddings).
 *
 * For each course with reviews, generates an LLM summary and upserts it
 * into course_review_summaries. Skips courses whose review hash is unchanged.
 */
export async function runReviewSummarization() {
  const delayMs = Math.max(
    0,
    Number(process.env.SUMMARIES_DELAY_MS ?? "200"),
  );

  console.log("[summaries] loading courses with reviews...");
  const courses = await loadCoursesWithReviews();
  console.log(`[summaries] found ${courses.length} courses with reviews`);

  console.log("[summaries] loading existing hashes...");
  const existing = await loadExistingHashes();
  console.log(`[summaries] existing summaries: ${existing.size}`);

  // Filter to only courses needing summarization
  const pending: Array<{ course: CourseWithReviews; hash: string }> = [];
  for (const course of courses) {
    const hash = hashReviews(course.reviews);
    if (existing.get(course.courseId) === hash) continue;
    pending.push({ course, hash });
  }

  console.log(`[summaries] pending: ${pending.length}`);
  if (pending.length === 0) return;

  let done = 0;
  for (const { course, hash } of pending) {
    try {
      const summary = await summarizeCourse(course);
      await upsertSummary(course.courseId, summary, course.reviews.length, hash);
      done++;
      console.log(
        `[summaries] ${done}/${pending.length} — ${course.code}`,
      );
    } catch (err) {
      console.error(
        `[summaries] error summarizing ${course.code} (id=${course.courseId}):`,
        err,
      );
    }

    if (delayMs > 0) await sleep(delayMs);
  }

  console.log(`[summaries] done — ${done}/${pending.length} summarized`);
}
