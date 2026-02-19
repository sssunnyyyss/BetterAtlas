import { and, eq, sql } from "drizzle-orm";
import { env } from "../config/env.js";
import { db, dbClient } from "../db/index.js";
import { courses, departments, instructors, sections, terms } from "../db/schema.js";

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
  instmode?: string;
  session?: string;
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
  seats?: string;
  enrl_stat_html?: string;
  dates_html?: string;
  registration_restrictions?: string;
  attributes?: string;
  grademode_code?: string;
  inst_method_code?: string;
  clss_assoc_rqmnt_designt_html?: string;
  instructordetail_html?: string;
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

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function titleCaseWords(s: string): string {
  const cleaned = s.replace(/[_@]+/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ""))
    .join(" ");
}

function campusLabelFromCriteria(value: string | null): string | null {
  if (!value) return null;
  // "ATL@ATLANTA" -> "Atlanta"
  const parts = value.split("@");
  const raw = (parts[1] ?? parts[0] ?? "").trim();
  if (!raw) return null;
  if (raw.toUpperCase() === "ATLANTA") return "Atlanta";
  if (raw.toUpperCase() === "OXFORD") return "Oxford";
  return titleCaseWords(raw);
}

function parseInstructionMethodCode(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  // Prefer FOSE codes when available (P/DL/BL/FL/DR).
  if (["P", "DL", "BL", "FL", "DR"].includes(v)) return v;
  // Details API returns human-readable strings like "In Person".
  const norm = v.toLowerCase();
  if (norm.includes("in person")) return "P";
  if (norm.includes("hybrid")) return "BL";
  if (norm.includes("hyflex")) return "FL";
  if (norm.includes("online")) return "DL";
  if (norm.includes("directed")) return "DR";
  return null;
}

function parseInstructorName(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  const text = stripHtml(v);
  if (!text) return null;
  // Common separators for "multiple instructors".
  const first = text.split(/;|\/|\||\s{2,}/)[0]?.trim() ?? "";
  return first || null;
}

function uniqStrings(xs: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of xs) {
    const v = x.trim();
    if (!v) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function gerCodesFromDesignationText(text: string): string[] {
  const t = text.toLowerCase();
  const codes: string[] = [];

  if (t.includes("humanities") && t.includes("arts")) codes.push("HA");
  if (t.includes("natural science")) codes.push("NS");
  if (t.includes("quantitative reasoning")) codes.push("QR");
  if (t.includes("social science")) codes.push("SS");
  if (t.includes("intercultural communication")) codes.push("IC");
  if (t.includes("race") && t.includes("ethnic")) codes.push("ETHN");
  if (t.includes("first-year seminar") || t.includes("first year seminar")) codes.push("FS");
  if (t.includes("first-year writing") || t.includes("first year writing")) codes.push("FW");
  if (
    t.includes("continuing communication") ||
    t.includes("continuing writing") ||
    t.includes("c.comm") ||
    t.includes("c. comm")
  ) {
    codes.push("CW");
  }

  return uniqStrings(codes);
}

function gerCodesToDbString(codes: string[]): string | null {
  const uniq = uniqStrings(codes);
  if (uniq.length === 0) return null;
  return `,${uniq.join(",")},`;
}

function parseSeatsHtml(seatsHtml: string | null | undefined): {
  enrollmentCap: number | null;
  seatsAvail: number | null;
  waitlistTotal: number | null;
  waitlistCap: number | null;
} {
  const text = stripHtml(seatsHtml ?? "");
  if (!text) {
    return {
      enrollmentCap: null,
      seatsAvail: null,
      waitlistTotal: null,
      waitlistCap: null,
    };
  }

  const capM = text.match(/Maximum Enrollment\s*:?\s*(\d+)/i);
  const availM = text.match(/Seats Avail\s*:?\s*(\d+)/i);
  const wlM = text.match(/Waitlist Total\s*:?\s*(\d+)(?:\s*of\s*(\d+))?/i);

  const enrollmentCap = capM ? Number(capM[1]) : null;
  const seatsAvail = availM ? Number(availM[1]) : null;
  const waitlistTotal = wlM ? Number(wlM[1]) : null;
  const waitlistCap = wlM && wlM[2] ? Number(wlM[2]) : null;

  return { enrollmentCap, seatsAvail, waitlistTotal, waitlistCap };
}

function enrollmentStatusCodeFromHtml(label: string | null | undefined): string | null {
  const t = stripHtml(label ?? "").toLowerCase();
  if (!t) return null;
  if (t.includes("wait")) return "W";
  if (t.includes("open")) return "O";
  if (t.includes("closed")) return "C";
  return null;
}

function parseDatesHtml(
  datesHtml: string | null | undefined
): { start: string | null; end: string | null } {
  const t = stripHtml(datesHtml ?? "");
  if (!t) return { start: null, end: null };
  const m = t.match(/(\d{4}-\d{2}-\d{2})\s+through\s+(\d{4}-\d{2}-\d{2})/i);
  if (!m) return { start: null, end: null };
  return { start: m[1], end: m[2] };
}

function parseInstructorDetail(
  html: string | null | undefined
): { name: string | null; email: string | null } {
  const raw = String(html ?? "");
  if (!raw.trim()) return { name: null, email: null };

  const nameM =
    raw.match(/data-provider="search-by-instructor"[^>]*>([^<]+)<\/a>/i) ??
    raw.match(/<div class="instructor-name"[^>]*>\s*<a[^>]*>([^<]+)<\/a>/i);
  const emailM = raw.match(/mailto:([^"'>\s]+)/i);

  const name = nameM ? stripHtml(nameM[1]) : null;
  const email = emailM ? String(emailM[1]).trim() : null;
  return { name: name || null, email: email || null };
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
    .returning({ id: courses.id, description: courses.description });

  return row;
}

async function upsertInstructorByName(input: {
  name: string;
  email?: string | null;
  departmentId: number | null;
}) {
  const name = input.name.trim();
  const [existing] = await db
    .select({ id: instructors.id, email: instructors.email })
    .from(instructors)
    .where(eq(instructors.name, name))
    .limit(1);

  if (existing) {
    const nextEmail = (input.email ?? "").trim() || null;
    if (nextEmail && !existing.email) {
      await db.update(instructors).set({ email: nextEmail }).where(eq(instructors.id, existing.id));
    }
    return existing.id;
  }

  const [row] = await db
    .insert(instructors)
    .values({ name, email: (input.email ?? "").trim() || null, departmentId: input.departmentId })
    .returning({ id: instructors.id });

  return row.id;
}

async function upsertSection(input: {
  courseId: number;
  termCode: string;
  crn: string;
  atlasKey: string | null;
  sectionNumber: string | null;
  instructorId: number | null;
  componentType: string | null;
  instructionMethod: string | null;
  campus: string | null;
  session: string | null;
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
      instructorId: input.instructorId,
      componentType: input.componentType,
      instructionMethod: input.instructionMethod,
      campus: input.campus,
      session: input.session,
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
        // Don't wipe instructor/method fields if the search payload doesn't include them.
        instructorId: sql`coalesce(${input.instructorId}, ${sections.instructorId})`,
        componentType: input.componentType,
        instructionMethod: sql`coalesce(${input.instructionMethod}, ${sections.instructionMethod})`,
        campus: sql`coalesce(${input.campus}, ${sections.campus})`,
        session: sql`coalesce(${input.session}, ${sections.session})`,
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
    ? subjectsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const useAllResults =
    subjects.length === 0 || (subjects.length === 1 && /^(all|\*)$/i.test(subjects[0] ?? ""));

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
  const subjectsLabel = useAllResults ? "ALL" : subjects.join(",");
  console.log(
    `[atlasSync] start term=${termCode} subjects=${subjectsLabel} detailsMode=${detailsMode} concurrency=${concurrency}`
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
          const campusLabel = campusLabelFromCriteria(campus);
          const instructionMethod = parseInstructionMethodCode(r.instmode);
          const session = r.session ? String(r.session).trim() : null;
          // Prefer instructor info from details (`instructordetail_html`) to avoid short-name duplicates.
          const instructorId = null;

          // Load previous snapshot for "sampled details" change detection.
          const [existing] = await db
            .select({
              id: sections.id,
              atlasKey: sections.atlasKey,
              meetsDisplay: sections.meetsDisplay,
              enrollmentStatus: sections.enrollmentStatus,
              instructionMethod: sections.instructionMethod,
              enrollmentCap: sections.enrollmentCap,
              seatsAvail: sections.seatsAvail,
              waitlistCap: sections.waitlistCap,
              gerCodes: sections.gerCodes,
              instructorId: sections.instructorId,
              registrationRestrictions: sections.registrationRestrictions,
              sectionDescription: sections.sectionDescription,
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
            instructorId,
            componentType,
            instructionMethod,
            campus: campusLabel,
            session,
            enrollmentStatus,
            meetsDisplay,
            meetings,
            startDate,
            endDate,
            runStartedAt,
          });

          const needsSectionEnrichment =
            !existing?.instructionMethod ||
            existing?.enrollmentCap == null ||
            existing?.seatsAvail == null ||
            existing?.gerCodes == null ||
            existing?.instructorId == null ||
            existing?.registrationRestrictions == null ||
            existing?.sectionDescription == null;

          if (detailsMode === "all") {
            detailsTasks.push({ courseId: courseRow.id, courseCode, crn, atlasKey });
          } else if (detailsMode === "missing") {
            if (needsSectionEnrichment) {
              detailsTasks.push({ courseId: courseRow.id, courseCode, crn, atlasKey });
            }
          } else if (detailsMode === "sampled") {
            const isNew = !existing;
            const changed =
              !isNew &&
              (existing.atlasKey !== atlasKey ||
                (existing.meetsDisplay ?? null) !== (meetsDisplay ?? null) ||
                (existing.enrollmentStatus ?? null) !== (enrollmentStatus ?? null));

            const courseNeedsEnrichment = !courseRow.description;

            const shouldEnrich =
              isNew || changed || courseNeedsEnrichment || needsSectionEnrichment;

            if (shouldEnrich) {
              // Avoid scheduling redundant "course lacks description" enrichments.
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

      const sectionDescription = (details.description ?? "").trim();
      const registrationRestrictionsRaw = stripHtml(details.registration_restrictions ?? "");
      const registrationRestrictions = registrationRestrictionsRaw ? registrationRestrictionsRaw : null;
      const attributes = (details.attributes ?? "").trim();
      const gradeMode = (details.grademode_code ?? "").trim();
      const credits = (details.hours_html ?? "").trim();
      const instMethod = parseInstructionMethodCode(details.inst_method_code);
      const statusCode = enrollmentStatusCodeFromHtml(details.enrl_stat_html);
      const dates = parseDatesHtml(details.dates_html);
      const seatInfo = parseSeatsHtml(details.seats);
      const gerDesignationRaw = stripHtml(details.clss_assoc_rqmnt_designt_html ?? "");
      const gerDesignation = gerDesignationRaw ? gerDesignationRaw : null;
      const gerCodes = gerDesignation ? gerCodesToDbString(gerCodesFromDesignationText(gerDesignation)) : null;
      const instr = parseInstructorDetail(details.instructordetail_html);

      const set: Record<string, any> = {};
      if (sectionDescription) {
        // Details can vary by section for special-topics courses.
        // Only backfill the course-level description when it's currently empty.
        set.description = sql`coalesce(${courses.description}, ${sectionDescription})`;
      }
      if (attributes) set.attributes = attributes;
      if (gradeMode) set.gradeMode = gradeMode;
      if (credits && /^[0-9]+$/.test(credits)) set.credits = Number(credits);

      if (Object.keys(set).length > 0) {
        await db.update(courses).set(set).where(eq(courses.id, t.courseId));
      }

      const sectionSet: Record<string, any> = {};
      if (instMethod) sectionSet.instructionMethod = instMethod;
      if (statusCode) sectionSet.enrollmentStatus = statusCode;
      if (dates.start) sectionSet.startDate = dates.start;
      if (dates.end) sectionSet.endDate = dates.end;
      if (sectionDescription) sectionSet.sectionDescription = sectionDescription;
      if (registrationRestrictions) sectionSet.registrationRestrictions = registrationRestrictions;

      if (seatInfo.enrollmentCap !== null) sectionSet.enrollmentCap = seatInfo.enrollmentCap;
      if (seatInfo.seatsAvail !== null) sectionSet.seatsAvail = seatInfo.seatsAvail;
      if (seatInfo.waitlistTotal !== null) sectionSet.waitlistCount = seatInfo.waitlistTotal;
      if (seatInfo.waitlistCap !== null) sectionSet.waitlistCap = seatInfo.waitlistCap;
      if (seatInfo.enrollmentCap !== null && seatInfo.seatsAvail !== null) {
        sectionSet.enrollmentCur = Math.max(0, seatInfo.enrollmentCap - seatInfo.seatsAvail);
      }

      if (gerDesignation) sectionSet.gerDesignation = gerDesignation;
      if (gerCodes) sectionSet.gerCodes = gerCodes;

      if (instr.name) {
        const instructorId = await upsertInstructorByName({
          name: instr.name,
          email: instr.email,
          departmentId: null,
        });
        sectionSet.instructorId = instructorId;
      }

      if (Object.keys(sectionSet).length > 0) {
        await db
          .update(sections)
          .set(sectionSet)
          .where(and(eq(sections.crn, t.crn), eq(sections.termCode, termCode)));
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

async function run() {
  try {
    await main();
  } catch (e) {
    console.error("[atlasSync] fatal:", e);
    process.exitCode = 1;
  } finally {
    // Ensure open DB sockets are closed so the process exits and admin run status can finalize.
    await dbClient.end({ timeout: 5 });
  }
}

void run();
