import { createHash } from "crypto";
import { db } from "../db/index.js";
import {
  programs,
  programRequirementNodes,
  programCourseCodes,
  programSubjectCodes,
  programElectiveRules,
} from "../db/schema.js";
import { eq } from "drizzle-orm";

const PROGRAMS_INDEX_URL =
  "https://catalog.college.emory.edu/academics/concentrations/index.html";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchHtml(url: string, timeoutMs = 20000): Promise<string> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "BetterAtlas programs sync (contact: admin)",
      },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|ul|ol|h1|h2|h3|h4|h5|h6)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

type ProgramVariant = {
  name: string;
  kind: "major" | "minor";
  degree: string | null;
  sourceUrl: string;
};

function toAbsoluteUrl(href: string): string {
  try {
    return new URL(href, PROGRAMS_INDEX_URL).toString();
  } catch {
    return href;
  }
}

function parseVariantLabel(labelText: string): { kind: "major" | "minor" | null; degree: string | null } {
  const t = labelText.toUpperCase();
  const kind = t.includes("MINOR") ? "minor" : t.includes("MAJOR") ? "major" : null;
  const degreeMatch = t.match(/\b(BA|BS|BBA|BSE|BFA)\b/);
  return { kind, degree: degreeMatch ? degreeMatch[1] : null };
}

function extractProgramsFromIndexHtml(html: string): ProgramVariant[] {
  const results: ProgramVariant[] = [];

  // Heuristic: each program name is an h2/h3 heading with variant links ("BA Major", "BS Major", "Minor") following it.
  const headingRe = /<h([23])[^>]*>([\s\S]*?)<\/h\1>/gi;
  const headings: Array<{ name: string; start: number; end: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = headingRe.exec(html))) {
    const raw = stripTags(m[2] || "");
    if (!raw) continue;
    headings.push({ name: raw, start: m.index, end: headingRe.lastIndex });
  }

  for (let i = 0; i < headings.length; i++) {
    const cur = headings[i]!;
    const next = headings[i + 1];
    const segment = html.slice(cur.end, next ? next.start : html.length);

    const aRe = /<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let a: RegExpExecArray | null;
    while ((a = aRe.exec(segment))) {
      const href = a[1] || "";
      const label = stripTags(a[2] || "");
      const { kind, degree } = parseVariantLabel(label);
      if (!kind) continue;
      if (!/\.html(\?|#|$)/i.test(href)) continue;
      results.push({
        name: cur.name,
        kind,
        degree,
        sourceUrl: toAbsoluteUrl(href),
      });
    }
  }

  // Deduplicate by URL (some pages repeat nav links).
  const seen = new Set<string>();
  return results.filter((r) => {
    const key = r.sourceUrl;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

type RequirementNode = {
  nodeType: "heading" | "paragraph" | "list_item";
  text: string;
  listLevel: number | null;
};

function extractRequirementsHtml(detailHtml: string): string | null {
  const re = /<h([23])[^>]*>\s*Requirements\s*<\/h\1>/i;
  const match = re.exec(detailHtml);
  if (!match) return null;
  const start = match.index + match[0].length;
  const rest = detailHtml.slice(start);
  const next = rest.search(/<h2[^>]*>/i);
  return next >= 0 ? rest.slice(0, next) : rest;
}

function extractMeta(detailHtml: string) {
  // Best-effort: many catalog pages list these as label/value lines.
  function find(label: string): string | null {
    const re = new RegExp(`${label}\\s*:?\\s*</[^>]+>\\s*([^<]+)`, "i");
    const m = re.exec(detailHtml);
    if (!m) return null;
    return stripTags(m[1] || "") || null;
  }

  return {
    hoursToComplete: find("Hours\\s+to\\s+Complete") ?? find("Hours\\s+to\\s+complete"),
    coursesRequired: find("Courses\\s+Required") ?? find("Courses\\s+required"),
    departmentContact: find("Department\\s+Contact") ?? find("Department\\s+contact"),
  };
}

function nodesFromRequirementsHtml(reqHtml: string): RequirementNode[] {
  const blocks: RequirementNode[] = [];

  const blockRe = /<(h3|h4|p|li)[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(reqHtml))) {
    const tag = (m[1] || "").toLowerCase();
    const text = stripTags(m[2] || "");
    if (!text) continue;
    if (tag === "h3" || tag === "h4") {
      blocks.push({ nodeType: "heading", text, listLevel: null });
    } else if (tag === "li") {
      blocks.push({ nodeType: "list_item", text, listLevel: 0 });
    } else {
      blocks.push({ nodeType: "paragraph", text, listLevel: null });
    }
  }

  // If parsing found nothing, fall back to stripped text as one paragraph.
  if (blocks.length === 0) {
    const text = stripTags(reqHtml);
    if (text) blocks.push({ nodeType: "paragraph", text, listLevel: null });
  }

  return blocks;
}

function extractCourseCodes(text: string): string[] {
  const out: string[] = [];
  const re =
    /\b([A-Z][A-Z0-9_]{1,}(?:\/[A-Z][A-Z0-9_]{1,})*)\s*([0-9]{3,4})([A-Z]{0,3})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text.toUpperCase()))) {
    const subjects = (m[1] || "")
      .split("/")
      .map((s) => s.trim())
      .filter(Boolean);
    const num = m[2] || "";
    const suffix = m[3] || "";
    for (const s of subjects) out.push(`${s} ${num}${suffix}`);
  }
  return Array.from(new Set(out));
}

function extractSubjectCodesFromText(text: string): string[] {
  const out = new Set<string>();
  for (const code of extractCourseCodes(text)) {
    out.add(code.split(" ")[0]!);
  }
  // Also capture "CS electives" style mentions.
  const re = /\b([A-Z][A-Z0-9_]{1,})\s+electives?\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text.toUpperCase()))) {
    out.add(m[1]!);
  }
  return Array.from(out);
}

function inferElectiveLevelFloor(text: string): number | null {
  const upper = text.toUpperCase();
  if (!upper.includes("ELECTIVE")) return null;

  // Union semantics:
  // - If any "elective(s)" mention is not tied to a specific level, default to any level (null).
  const electiveWordRe = /\belectives?\b/gi;
  const levelPrefixRe = /[0-9]{3}\s*-\s*level\s+electives?/i;
  let hasUnspecified = false;
  let ew: RegExpExecArray | null;
  while ((ew = electiveWordRe.exec(text))) {
    const windowStart = Math.max(0, ew.index - 25);
    const window = text.slice(windowStart, ew.index + ew[0].length);
    if (!levelPrefixRe.test(window)) {
      hasUnspecified = true;
      break;
    }
  }
  let floors: number[] = [];
  const re = /\b([0-9]{3})\s*-\s*level\s+electives?\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(upper))) {
    floors.push(parseInt(m[1]!, 10));
  }

  if (hasUnspecified) return null;
  if (floors.length === 0) return null;
  return Math.min(...floors);
}

export type ProgramsSyncStats = {
  fetchedPrograms: number;
  upsertedPrograms: number;
  updatedRequirements: number;
  skippedUnchanged: number;
  errors: Array<{ sourceUrl: string; error: string }>;
};

export async function syncPrograms(opts?: { rateDelayMs?: number }) {
  const rateDelayMs = opts?.rateDelayMs ?? 0;

  const indexHtml = await fetchHtml(PROGRAMS_INDEX_URL);
  const variants = extractProgramsFromIndexHtml(indexHtml);

  const stats: ProgramsSyncStats = {
    fetchedPrograms: variants.length,
    upsertedPrograms: 0,
    updatedRequirements: 0,
    skippedUnchanged: 0,
    errors: [],
  };

  for (const v of variants) {
    try {
      const detailHtml = await fetchHtml(v.sourceUrl);
      const meta = extractMeta(detailHtml);
      const reqHtml = extractRequirementsHtml(detailHtml);
      if (!reqHtml) {
        throw new Error("Could not find Requirements section");
      }

      const nodes = nodesFromRequirementsHtml(reqHtml);
      const requirementsTextForHash = nodes.map((n) => `${n.nodeType}:${n.text}`).join("\n");
      const requirementsHash = sha256Hex(requirementsTextForHash);

      const allText = nodes.map((n) => n.text).join("\n");
      const requiredCourseCodes = extractCourseCodes(allText);
      const subjectCodes = extractSubjectCodesFromText(allText);

      // Elective floor inference: union rules => unspecified electives => null.
      const electiveLevelFloor = inferElectiveLevelFloor(allText);

      await db.transaction(async (tx) => {
        const [existing] = await tx
          .select({ id: programs.id, requirementsHash: programs.requirementsHash })
          .from(programs)
          .where(eq(programs.sourceUrl, v.sourceUrl))
          .limit(1);

        const [upserted] = await tx
          .insert(programs)
          .values({
            name: v.name,
            kind: v.kind,
            degree: v.degree,
            sourceUrl: v.sourceUrl,
            hoursToComplete: meta.hoursToComplete,
            coursesRequired: meta.coursesRequired,
            departmentContact: meta.departmentContact,
            requirementsHash,
            isActive: true,
          })
          .onConflictDoUpdate({
            target: programs.sourceUrl,
            set: {
              name: v.name,
              kind: v.kind,
              degree: v.degree,
              hoursToComplete: meta.hoursToComplete,
              coursesRequired: meta.coursesRequired,
              departmentContact: meta.departmentContact,
              requirementsHash,
              isActive: true,
              lastSyncedAt: new Date(),
            },
          })
          .returning({ id: programs.id });

        const programId = upserted!.id;
        stats.upsertedPrograms += 1;

        if (existing && existing.requirementsHash === requirementsHash) {
          stats.skippedUnchanged += 1;

          // Still keep derived subjects/rules reasonably fresh.
          await tx
            .insert(programElectiveRules)
            .values({ programId, levelFloor: electiveLevelFloor })
            .onConflictDoUpdate({
              target: programElectiveRules.programId,
              set: { levelFloor: electiveLevelFloor },
            });

          // Subjects can change even if requirements text didn't (rare), but keep it simple: no-op here.
          return;
        }

        stats.updatedRequirements += 1;

        await Promise.all([
          tx.delete(programRequirementNodes).where(eq(programRequirementNodes.programId, programId)),
          tx.delete(programCourseCodes).where(eq(programCourseCodes.programId, programId)),
          tx.delete(programSubjectCodes).where(eq(programSubjectCodes.programId, programId)),
        ]);

        if (nodes.length) {
          await tx.insert(programRequirementNodes).values(
            nodes.map((n, idx) => ({
              programId,
              ord: idx,
              nodeType: n.nodeType,
              text: n.text,
              listLevel: n.listLevel,
            }))
          );
        }

        if (requiredCourseCodes.length) {
          await tx.insert(programCourseCodes).values(
            requiredCourseCodes.map((c) => ({ programId, courseCode: c }))
          );
        }

        if (subjectCodes.length) {
          await tx.insert(programSubjectCodes).values(
            subjectCodes.map((s) => ({ programId, subjectCode: s }))
          );
        }

        await tx
          .insert(programElectiveRules)
          .values({ programId, levelFloor: electiveLevelFloor })
          .onConflictDoUpdate({
            target: programElectiveRules.programId,
            set: { levelFloor: electiveLevelFloor },
          });
      });

      if (rateDelayMs) await sleep(rateDelayMs);
    } catch (err: any) {
      stats.errors.push({ sourceUrl: v.sourceUrl, error: err?.message || String(err) });
    }
  }

  return stats;
}

// Allow running the job directly via tsx / node.
if (import.meta.url === `file://${process.argv[1]}`) {
  syncPrograms({ rateDelayMs: 200 })
    .then((s) => {
      console.log(JSON.stringify(s, null, 2));
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
