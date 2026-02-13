import { and, eq, sql } from "drizzle-orm";
import { env } from "../config/env.js";
import { db } from "../db/index.js";
import { courses, departments, sections, terms } from "../db/schema.js";

type FoseSearchRow = {
  key: string;
  code: string;
  title: string;
  crn: string;
  no?: string;
  schd?: string;
  stat?: string;
  meets?: string;
  meetingTimes?: string;
  instr?: string;
  start_date?: string;
  end_date?: string;
  enrl_stat?: string;
  srcdb?: string;
};

type FoseSearchResponse = {
  srcdb?: string;
  count?: number;
  results?: FoseSearchRow[];
};

type FoseDetailsResponse = {
  code?: string;
  title?: string;
  section?: string;
  crn?: string;
  description?: string;
  hours_html?: string;
  registration_restrictions?: string;
  attributes?: string;
  grademode_code?: string;
  inst_method_code?: string;
};

const FOSE_BASE = "https://atlas.emory.edu/api/?page=fose";
const FOSE_SEARCH_URL = `${FOSE_BASE}&route=search`;
const FOSE_DETAILS_URL = `${FOSE_BASE}&route=details`;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function jitter(ms: number) {
  const spread = Math.max(50, Math.floor(ms * 0.25));
  return ms + Math.floor((Math.random() - 0.5) * spread * 2);
}

async function fosePostJson<T>(
  url: string,
  body: unknown,
  opts: {
    timeoutMs: number;
    maxAttempts: number;
    rateDelayMs: number;
  }
): Promise<T> {
  let attempt = 0;
  let lastErr: unknown;

  while (attempt < opts.maxAttempts) {
    attempt++;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), opts.timeoutMs);

    try {
      if (opts.rateDelayMs > 0) await sleep(opts.rateDelayMs);

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/plain, */*",
          // FOSE is a browser-backed API; these headers help avoid occasional HTML responses.
          "user-agent":
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
          "accept-language": "en-US,en;q=0.9",
          origin: "https://atlas.emory.edu",
          referer: "https://atlas.emory.edu/",
          "x-requested-with": "XMLHttpRequest",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        const retryable = res.status === 429 || (res.status >= 500 && res.status <= 599);
        if (retryable) {
          const backoffMs = jitter(Math.min(30_000, 400 * 2 ** (attempt - 1)));
          console.warn(
            `[FOSE] ${url} attempt ${attempt}/${opts.maxAttempts} -> ${res.status}; retrying in ${backoffMs}ms`
          );
          if (text) console.warn(`[FOSE] body: ${text.slice(0, 300)}`);
          await sleep(backoffMs);
          continue;
        }
        throw new Error(`[FOSE] ${url} failed: ${res.status} ${res.statusText} ${text}`.trim());
      }

      const contentType = res.headers.get("content-type") ?? "";
      const text = await res.text();

      try {
        // Some deployments return JSON with text/html content-type, so we don't hard-fail on content-type.
        return JSON.parse(text) as T;
      } catch (e) {
        const snippet = text.slice(0, 400).replace(/\s+/g, " ").trim();
        const backoffMs = jitter(Math.min(30_000, 400 * 2 ** (attempt - 1)));
        const msg = `[FOSE] ${url} invalid JSON (content-type=${contentType || "?"}) snippet="${snippet}"`;
        if (attempt < opts.maxAttempts) {
          console.warn(`${msg}; retrying in ${backoffMs}ms`);
          await sleep(backoffMs);
          continue;
        }
        throw new Error(msg);
      }
    } catch (e) {
      lastErr = e;
      const retryable = e instanceof Error && (e.name === "AbortError" || /fetch/i.test(e.message));
      if (attempt < opts.maxAttempts && retryable) {
        const backoffMs = jitter(Math.min(30_000, 400 * 2 ** (attempt - 1)));
        console.warn(
          `[FOSE] ${url} attempt ${attempt}/${opts.maxAttempts} -> ${String(e)}; retrying in ${backoffMs}ms`
        );
        await sleep(backoffMs);
        continue;
      }
      throw e;
    } finally {
      clearTimeout(t);
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error("FOSE request failed");
}

async function searchBySubject(termCode: string, subject: string, opts: {
  timeoutMs: number;
  maxAttempts: number;
  rateDelayMs: number;
}): Promise<FoseSearchRow[]> {
  return searchWithCriteria(
    termCode,
    [{ field: "subject", value: subject }],
    opts,
    `subject=${subject}`
  );
}

async function searchAll(termCode: string, opts: {
  timeoutMs: number;
  maxAttempts: number;
  rateDelayMs: number;
}): Promise<FoseSearchRow[]> {
  // FOSE appears to support an "all results" search when criteria is empty.
  return searchWithCriteria(termCode, [], opts, "all");
}

async function searchWithCriteria(
  termCode: string,
  criteria: Array<{ field: string; value: string }>,
  opts: {
    timeoutMs: number;
    maxAttempts: number;
    rateDelayMs: number;
  },
  label: string
): Promise<FoseSearchRow[]> {
  const rows: FoseSearchRow[] = [];
  let expectedCount: number | null = null;
  let offset = 0;
  let page = 0;
  const seenKeys = new Set<string>();

  while (true) {
    page++;
    const body = {
      other: { srcdb: termCode, start: offset },
      criteria,
    };

    const resp = await fosePostJson<FoseSearchResponse>(FOSE_SEARCH_URL, body, opts);
    const batch = Array.isArray(resp.results) ? resp.results : [];
    if (expectedCount === null && typeof resp.count === "number") expectedCount = resp.count;

    // If the API ignores pagination, we can get the same batch back repeatedly.
    let newInBatch = 0;
    for (const r of batch) {
      const k = String(r?.key ?? "");
      if (!k) continue;
      if (seenKeys.has(k)) continue;
      seenKeys.add(k);
      rows.push(r);
      newInBatch++;
    }

    if (batch.length === 0) break;
    if (expectedCount !== null && rows.length >= expectedCount) break;
    if (newInBatch === 0) break;

    offset = rows.length;
    if (page > 200) {
      console.warn(`[atlasSync] pagination guard tripped for ${label} (term ${termCode})`);
      break;
    }
  }

  if (expectedCount !== null && rows.length < expectedCount) {
    console.warn(
      `[atlasSync] ${label} term=${termCode}: expected ${expectedCount} results but got ${rows.length}`
    );
  }

  return rows;
}

function parseMeetingTimes(meetingTimes: string | undefined): any[] | null {
  if (!meetingTimes) return null;
  try {
    const parsed = JSON.parse(meetingTimes);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .map((m: any) => ({
        day: typeof m?.meet_day === "string" ? Number(m.meet_day) : m?.day,
        startTime: String(m?.start_time ?? m?.startTime ?? ""),
        endTime: String(m?.end_time ?? m?.endTime ?? ""),
        location: String(m?.location ?? ""),
      }))
      .filter((m) => Number.isFinite(m.day) && m.startTime && m.endTime);
  } catch {
    return null;
  }
}

function subjectFromCourseCode(courseCode: string): string | null {
  const v = courseCode.trim();
  const m = v.match(/^([A-Z0-9_]+)\s+/);
  return m ? m[1] : null;
}

async function upsertDepartment(subjectCode: string) {
  await db
    .insert(departments)
    .values({ code: subjectCode, name: subjectCode })
    .onConflictDoNothing();

  const [dept] = await db
    .select({ id: departments.id })
    .from(departments)
    .where(eq(departments.code, subjectCode))
    .limit(1);

  if (!dept) throw new Error(`failed to load department after upsert: ${subjectCode}`);
  return dept.id;
}

async function upsertCourse(input: {
  code: string;
  title: string;
  departmentId: number | null;
}) {
  const [row] = await db
    .insert(courses)
    .values({
      code: input.code,
      title: input.title,
      departmentId: input.departmentId,
    })
    .onConflictDoUpdate({
      target: courses.code,
      set: {
        title: input.title,
        departmentId: input.departmentId,
      },
    })
    .returning({ id: courses.id, description: courses.description, prerequisites: courses.prerequisites });

  return row;
}

async function upsertSection(input: {
  courseId: number;
  termCode: string;
  crn: string;
  atlasKey: string | null;
  sectionNumber: string | null;
  componentType: string | null;
  enrollmentStatus: string | null;
  meetsDisplay: string | null;
  meetings: any[] | null;
  startDate: string | null;
  endDate: string | null;
  runStartedAt: Date;
}) {
  const [row] = await db
    .insert(sections)
    .values({
      courseId: input.courseId,
      termCode: input.termCode,
      crn: input.crn,
      atlasKey: input.atlasKey,
      sectionNumber: input.sectionNumber,
      componentType: input.componentType,
      enrollmentStatus: input.enrollmentStatus,
      meetsDisplay: input.meetsDisplay,
      meetings: input.meetings,
      startDate: input.startDate,
      endDate: input.endDate,
      lastSynced: new Date(),
      isActive: true,
      lastSeenAt: input.runStartedAt,
    })
    .onConflictDoUpdate({
      target: [sections.crn, sections.termCode],
      set: {
        courseId: input.courseId,
        atlasKey: input.atlasKey,
        sectionNumber: input.sectionNumber,
        componentType: input.componentType,
        enrollmentStatus: input.enrollmentStatus,
        meetsDisplay: input.meetsDisplay,
        meetings: input.meetings,
        startDate: input.startDate,
        endDate: input.endDate,
        lastSynced: new Date(),
        isActive: true,
        lastSeenAt: input.runStartedAt,
      },
    })
    .returning({
      id: sections.id,
      atlasKey: sections.atlasKey,
      meetsDisplay: sections.meetsDisplay,
      enrollmentStatus: sections.enrollmentStatus,
    });

  return row;
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>
) {
  const limit = Math.max(1, Math.floor(concurrency));
  let idx = 0;

  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= items.length) return;
      await fn(items[i]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
}

async function main() {
  if (!env.databaseUrl) throw new Error("DATABASE_URL is required");

  const termFromEnv = (process.env.ATLAS_TERM_CODE ?? "").trim();
  const subjectsRaw = (process.env.ATLAS_SUBJECTS ?? "").trim();
  if (!subjectsRaw) throw new Error("ATLAS_SUBJECTS is required (comma-separated, or ALL)");

  const campusesRaw = (process.env.ATLAS_CAMPUSES ?? "ATL@ATLANTA,OXF@OXFORD").trim();
  const campuses = campusesRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const detailsMode = (process.env.ATLAS_DETAILS_MODE ?? "sampled").trim();
  const concurrency = Number(process.env.ATLAS_CONCURRENCY ?? "6");
  const rateDelayMs = Number(process.env.ATLAS_RATE_DELAY_MS ?? "0");

  const timeoutMs = 30_000;
  const maxAttempts = 6;

  const subjects = subjectsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const useAllResults =
    subjects.length === 1 && /^(all|\*)$/i.test(subjects[0] ?? "");

  let termCode: string;
  if (termFromEnv) {
    termCode = termFromEnv;
  } else {
    const active = await db
      .select({ srcdb: terms.srcdb, name: terms.name })
      .from(terms)
      .where(eq(terms.isActive, true));

    if (active.length !== 1) {
      const names = active.map((t) => `${t.name} (${t.srcdb})`).join(", ");
      throw new Error(
        `ATLAS_TERM_CODE is required unless exactly one terms.is_active=true. Found ${active.length}: ${names}`
      );
    }
    termCode = active[0].srcdb;
  }

  const runStartedAt = new Date();
  console.log(
    `[atlasSync] start term=${termCode} subjects=${subjects.join(",")} detailsMode=${detailsMode} concurrency=${concurrency}`
  );

  const opts = { timeoutMs, maxAttempts, rateDelayMs };
  let allSubjectsOk = true;
  const detailsTasks: {
    courseId: number;
    courseCode: string;
    crn: string;
    atlasKey: string;
  }[] = [];
  const courseDetailScheduled = new Set<number>();
  const seenCrnTerm = new Set<string>();

  const subjectWork = useAllResults ? [null] : subjects;
  const campusWork = campuses.length > 0 ? campuses : [null];

  for (const subject of subjectWork) {
    try {
      for (const campus of campusWork) {
        const label = useAllResults
          ? `all${campus ? ` camp=${campus}` : ""}`
          : `subject=${subject}${campus ? ` camp=${campus}` : ""}`;

        if (useAllResults) {
          console.log(`[atlasSync] searching all results term=${termCode}${campus ? ` camp=${campus}` : ""}`);
        } else {
          console.log(`[atlasSync] searching subject=${subject} term=${termCode}${campus ? ` camp=${campus}` : ""}`);
        }

        const criteria: Array<{ field: string; value: string }> = [];
        if (!useAllResults && subject) criteria.push({ field: "subject", value: subject });
        if (campus) criteria.push({ field: "camp", value: campus });

        const results = criteria.length === 0
          ? await searchAll(termCode, opts)
          : await searchWithCriteria(termCode, criteria, opts, label);

        console.log(`[atlasSync] ${label} got=${results.length}`);

        for (const r of results) {
          const courseCode = String(r.code ?? "").trim();
          const title = String(r.title ?? "").trim();
          const crn = String(r.crn ?? "").trim();
          const atlasKey = String(r.key ?? "").trim();
          if (!courseCode || !title || !crn || !atlasKey) continue;

          const crnTermKey = `${termCode}:${crn}`;
          if (seenCrnTerm.has(crnTermKey)) continue;
          seenCrnTerm.add(crnTermKey);

          const subj = subjectFromCourseCode(courseCode) ?? (subject ?? "UNKNOWN");
          const deptId = await upsertDepartment(subj);

          const courseRow = await upsertCourse({
            code: courseCode,
            title,
            departmentId: deptId,
          });

          const meetings = parseMeetingTimes(r.meetingTimes);
          const meetsDisplay = r.meets ? String(r.meets).trim() : null;
          const enrollmentStatus = r.enrl_stat ? String(r.enrl_stat).trim() : null;
          const componentType = r.schd ? String(r.schd).trim() : null;
          const sectionNumber = r.no ? String(r.no).trim() : null;
          const startDate = r.start_date ? String(r.start_date).trim() : null;
          const endDate = r.end_date ? String(r.end_date).trim() : null;

          // Load previous snapshot for "sampled details" change detection.
          const [existing] = await db
            .select({
              id: sections.id,
              atlasKey: sections.atlasKey,
              meetsDisplay: sections.meetsDisplay,
              enrollmentStatus: sections.enrollmentStatus,
            })
            .from(sections)
            .where(and(eq(sections.crn, crn), eq(sections.termCode, termCode)))
            .limit(1);

          const upserted = await upsertSection({
            courseId: courseRow.id,
            termCode,
            crn,
            atlasKey,
            sectionNumber,
            componentType,
            enrollmentStatus,
            meetsDisplay,
            meetings,
            startDate,
            endDate,
            runStartedAt,
          });

          if (detailsMode === "sampled") {
            const isNew = !existing;
            const changed =
              !isNew &&
              (existing.atlasKey !== atlasKey ||
                (existing.meetsDisplay ?? null) !== (meetsDisplay ?? null) ||
                (existing.enrollmentStatus ?? null) !== (enrollmentStatus ?? null));

            const courseNeedsEnrichment =
              !courseRow.description || !courseRow.prerequisites;

            const shouldEnrich =
              isNew || changed || courseNeedsEnrichment;

            if (shouldEnrich) {
              // Avoid scheduling redundant "course lacks description/prereqs" enrichments.
              if (courseNeedsEnrichment) {
                if (!courseDetailScheduled.has(courseRow.id)) {
                  courseDetailScheduled.add(courseRow.id);
                  detailsTasks.push({ courseId: courseRow.id, courseCode, crn, atlasKey });
                }
              } else {
                detailsTasks.push({ courseId: courseRow.id, courseCode, crn, atlasKey });
              }
            }
          }
        }
      }
    } catch (e) {
      allSubjectsOk = false;
      console.error(
        useAllResults
          ? `[atlasSync] all-results failed:`
          : `[atlasSync] subject=${subject} failed:`,
        e
      );
    }
  }

  console.log(`[atlasSync] details scheduled=${detailsTasks.length}`);
  await runWithConcurrency(detailsTasks, concurrency, async (t) => {
    try {
      const body = {
        group: `code:${t.courseCode}`,
        key: `crn:${t.crn}`,
        srcdb: termCode,
        matched: `crn:${t.crn}`,
      };

      const details = await fosePostJson<FoseDetailsResponse>(FOSE_DETAILS_URL, body, opts);

      const description = (details.description ?? "").trim();
      const prerequisites = (details.registration_restrictions ?? "").trim();
      const attributes = (details.attributes ?? "").trim();
      const gradeMode = (details.grademode_code ?? "").trim();
      const credits = (details.hours_html ?? "").trim();

      const set: Record<string, any> = {};
      if (description) set.description = description;
      if (prerequisites) set.prerequisites = prerequisites;
      if (attributes) set.attributes = attributes;
      if (gradeMode) set.gradeMode = gradeMode;
      if (credits && /^[0-9]+$/.test(credits)) set.credits = Number(credits);

      if (Object.keys(set).length > 0) {
        await db.update(courses).set(set).where(eq(courses.id, t.courseId));
      }
    } catch (e) {
      console.error(
        `[atlasSync] details failed course=${t.courseCode} crn=${t.crn} term=${termCode}:`,
        e
      );
    }
  });

  if (allSubjectsOk) {
    console.log(`[atlasSync] soft-stale start term=${termCode}`);
    await db
      .update(sections)
      .set({ isActive: false })
      .where(
        and(
          eq(sections.termCode, termCode),
          // Drizzle/postgres-js sometimes fails to bind Date objects in raw `sql` fragments.
          // ISO strings are safely castable to timestamptz by Postgres.
          sql`${sections.lastSeenAt} < ${runStartedAt.toISOString()}`
        )
      );
  } else {
    console.warn("[atlasSync] skipping soft-stale due to subject failures");
  }

  console.log("[atlasSync] done");
}

main().catch((e) => {
  console.error("[atlasSync] fatal:", e);
  process.exitCode = 1;
});
