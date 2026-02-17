import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/auth.js";
import { aiLimiter } from "../middleware/rateLimit.js";
import { env } from "../config/env.js";
import { openAiChatJson } from "../lib/openai.js";
import { openAiEmbedText } from "../lib/openaiEmbeddings.js";
import { getUserById } from "../services/userService.js";
import {
  listCourses,
  listDepartments,
  searchCourses,
  areCourseEmbeddingsAvailable,
  semanticSearchCoursesByEmbedding,
} from "../services/courseService.js";
import { getAllAiTrainerScores } from "../services/aiTrainerService.js";
import type { CourseWithRatings } from "@betteratlas/shared";

const router = Router();

type AiMessage = { role: "user" | "assistant"; content: string };

const aiMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const aiFilterSchema = z.object({
  semester: z.string().max(80).optional(),
  department: z.string().max(20).optional(),
  minRating: z.coerce.number().min(1).max(5).optional(),
  credits: z.coerce.number().int().positive().optional(),
  attributes: z.string().max(100).optional(),
  instructor: z.string().max(120).optional(),
  campus: z.string().max(50).optional(),
  componentType: z.string().max(20).optional(),
  instructionMethod: z.string().max(20).optional(),
});

const preferenceCourseSchema = z.object({
  id: z.number().int().positive(),
  // Allow fuller client snapshots; server-side normalization still truncates to stable limits.
  code: z.string().min(1).max(80),
  title: z.string().min(1).max(600),
  department: z.string().max(40).nullable().optional(),
  gers: z.array(z.string().max(40)).max(20).optional(),
  campuses: z.array(z.string().max(120)).max(20).optional(),
  instructors: z.array(z.string().max(240)).max(20).optional(),
  description: z.string().max(8000).nullable().optional(),
});

const preferenceSignalsSchema = z.object({
  liked: z.array(preferenceCourseSchema).max(40).optional(),
  disliked: z.array(preferenceCourseSchema).max(40).optional(),
});

const recommendSchema = z
  .object({
    // New preferred API: client sends the next user prompt, server maintains per-user memory.
    prompt: z.string().min(1).max(4000).optional(),
    // Back-compat: client may send the whole message list.
    messages: z.array(aiMessageSchema).min(1).max(12).optional(),
    // Avoid recommending already-shown courses (used by "Generate more").
    excludeCourseIds: z.array(z.number().int().positive()).max(200).optional(),
    // Apply active catalog filters as hard constraints to candidate retrieval.
    filters: aiFilterSchema.optional(),
    // Lightweight training signals ("more like this", "less like this").
    preferences: preferenceSignalsSchema.optional(),
    // Clear per-user memory.
    reset: z.boolean().optional(),
  })
  .refine((v) => v.reset === true || typeof v.prompt === "string" || Array.isArray(v.messages), {
    message: "Must provide prompt/messages unless reset=true",
  });

const modelResponseSchema = z.object({
  assistant_message: z.string().min(1).max(2500),
  follow_up_question: z.string().min(1).max(400).nullable().optional(),
  recommendations: z
    .array(
      z.object({
        course_id: z.number().int().positive(),
        fit_score: z.number().int().min(1).max(10),
        why: z.array(z.string().min(1).max(160)).min(1).max(5),
        cautions: z.array(z.string().min(1).max(160)).max(4).optional(),
      })
    )
    .min(1)
    .max(16),
});

// OpenAI Structured Output schema — mirrors modelResponseSchema above.
// Guarantees the model MUST produce valid JSON matching this exact shape.
const modelResponseJsonSchema = {
  name: "course_recommendations",
  strict: true,
  schema: {
    type: "object",
    properties: {
      assistant_message: { type: "string" },
      follow_up_question: {
        anyOf: [{ type: "string" }, { type: "null" }],
      },
      recommendations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            course_id: { type: "integer" },
            fit_score: { type: "integer" },
            why: {
              type: "array",
              items: { type: "string" },
            },
            cautions: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["course_id", "fit_score", "why", "cautions"],
          additionalProperties: false,
        },
      },
    },
    required: ["assistant_message", "follow_up_question", "recommendations"],
    additionalProperties: false,
  },
};

function truncate(str: string, max: number) {
  if (str.length <= max) return str;
  return str.slice(0, Math.max(0, max - 1)).trimEnd() + "...";
}

function normalizeSearchQuery(text: string) {
  // Keep the catalog search query within its existing 200-char constraint.
  // This is only used to fetch candidates; the full user prompt still goes to the LLM.
  const cleaned = text.replace(/\s+/g, " ").trim();
  return truncate(cleaned, 200);
}

const GENERIC_WHY_RE =
  /(seems relevant|looks relevant|based on (the )?(catalog|title|description)|good fit|matches your interests)/i;

function fixWhyBullets(course: CourseWithRatings, why: string[]) {
  const cleaned = (Array.isArray(why) ? why : [])
    .map((w) => String(w ?? "").trim())
    .filter(Boolean)
    .filter((w) => !GENERIC_WHY_RE.test(w))
    .slice(0, 4);

  const out = [...cleaned];

  function pushIf(v: string | null) {
    const t = (v ?? "").trim();
    if (!t) return;
    if (out.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    out.push(truncate(t, 160));
  }

  if (out.length < 2) {
    if (course.gers && course.gers.length > 0) pushIf(`GER: ${course.gers.slice(0, 3).join(", ")}`);
    if (out.length < 2 && course.campuses && course.campuses.length > 0) {
      pushIf(`Campus: ${course.campuses.slice(0, 2).join(", ")}`);
    }
    const desc = (course.description ?? "").replace(/\s+/g, " ").trim();
    if (out.length < 2 && desc) pushIf(`Catalog: ${desc}`);
    if (out.length < 2) pushIf(`From title: ${course.title}`);
  }

  return out.slice(0, 4);
}

const AI_SEARCH_STOPWORDS = new Set(
  [
    "i",
    "im",
    "ive",
    "id",
    "me",
    "my",
    "mine",
    "we",
    "our",
    "us",
    "you",
    "your",
    "a",
    "an",
    "the",
    "and",
    "or",
    "but",
    "if",
    "then",
    "than",
    "so",
    "because",
    "as",
    "to",
    "of",
    "in",
    "on",
    "for",
    "with",
    "without",
    "from",
    "at",
    "want",
    "wants",
    "wanted",
    "need",
    "needs",
    "needed",
    "looking",
    "find",
    "finding",
    "recommend",
    "recommendations",
    "suggest",
    "suggestions",
    "take",
    "taking",
    "taken",
    "class",
    "classes",
    "course",
    "courses",
    "prof",
    "profs",
    "professor",
    "semester",
    "credits",
    "credit",
    "fulfill",
    "fulfilling",
    "requirement",
    "requirements",
    "ger",
    "gers",
    "easy",
    "easier",
    "hard",
    "harder",
    "chill",
    "fun",
    "interesting",
    "good",
    "bad",
    "best",
    "really",
    "very",
    "like",
    "likes",
    "kinda",
    "sorta",
    "please",
    "help",
    "give",
    "some",
    "random",
    "randomly",
    "anything",
    "something",
    "whatever",
  ].map((s) => s.toLowerCase())
);

function deriveAiSearchTerms(text: string, deps?: DepartmentMini[]) {
  const cleaned = normalizeSearchQuery(text);
  if (!cleaned) return [] as string[];

  // If the user typed a course code-ish thing, keep it intact (works well with existing search).
  // Examples: "CS 170", "QTM110", "BIOL 141L"
  const courseCodeM = cleaned.match(/\b([A-Za-z]{2,8})\s*-?\s*(\d{3,4}[A-Za-z]?)\b/);
  if (courseCodeM) {
    return [`${courseCodeM[1]} ${courseCodeM[2]}`.toUpperCase()];
  }

  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length <= 2 && cleaned.length <= 28) {
    return [cleaned];
  }

  // For AI prompts, the raw query is usually a whole sentence; passing it straight into
  // the catalog search yields weak matches. Pull out a few meaningful keywords instead.
  const tokens = cleaned
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const out: string[] = [];
  const seen = new Set<string>();
  const deptCodeSet = deps ? new Set(deps.map((d) => d.code.toLowerCase())) : null;
  for (const t of tokens) {
    if (AI_SEARCH_STOPWORDS.has(t)) continue;
    if (t.length < 3 && !/^[a-z]{2,4}$/.test(t) && !/^\d{3,4}$/.test(t)) continue;
    if (seen.has(t)) continue;
    seen.add(t);

    // Preserve *known* dept-code-like tokens in uppercase, everything else can stay lowercase.
    const isDeptToken = /^[a-z]{2,4}$/.test(t) && deptCodeSet && deptCodeSet.has(t);
    out.push(isDeptToken ? t.toUpperCase() : t);
    if (out.length >= 4) break;
  }

  return out;
}

const MEMORY_TTL_MS = 6 * 60 * 60 * 1000; // 6h
const MEMORY_MAX_MESSAGES = 6; // last N user/assistant messages (keep context small for latency)
const memoryByUser = new Map<string, { messages: AiMessage[]; updatedAt: number }>();

type DepartmentMini = { code: string; name: string };
type CacheEntry<T> = { value: T; updatedAt: number };
type AiCourseFilters = z.infer<typeof aiFilterSchema>;
type PreferenceCourse = z.infer<typeof preferenceCourseSchema>;

type PreferenceProfile = {
  likedDept: Map<string, number>;
  dislikedDept: Map<string, number>;
  likedGer: Map<string, number>;
  dislikedGer: Map<string, number>;
  likedCampus: Map<string, number>;
  dislikedCampus: Map<string, number>;
  likedInstructor: Map<string, number>;
  dislikedInstructor: Map<string, number>;
  likedTokens: Set<string>;
  dislikedTokens: Set<string>;
};

const DEPS_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
let depsCache: CacheEntry<DepartmentMini[]> | null = null;
let depsInFlight: Promise<DepartmentMini[]> | null = null;

const COURSES_CACHE_TTL_MS = 10 * 60 * 1000; // 10m
let topRatedCache: CacheEntry<CourseWithRatings[]> | null = null;
let topRatedInFlight: Promise<CourseWithRatings[]> | null = null;
const majorRatedCacheByDept = new Map<string, CacheEntry<CourseWithRatings[]>>();
const majorRatedInFlightByDept = new Map<string, Promise<CourseWithRatings[]>>();

const TRAINER_SCORES_CACHE_TTL_MS = 5 * 60 * 1000; // 5m
let trainerScoresCache: CacheEntry<Map<number, number>> | null = null;
let trainerScoresInFlight: Promise<Map<number, number>> | null = null;

async function getDepartmentsCached(): Promise<DepartmentMini[]> {
  if (depsCache && Date.now() - depsCache.updatedAt < DEPS_CACHE_TTL_MS) return depsCache.value;
  if (depsInFlight) return depsInFlight;

  depsInFlight = listDepartments()
    .then((rows: any[]) => rows.map((d) => ({ code: d.code, name: d.name })))
    .then((value) => {
      depsCache = { value, updatedAt: Date.now() };
      return value;
    })
    .finally(() => {
      depsInFlight = null;
    });

  return depsInFlight;
}

async function getTopRatedCached(): Promise<CourseWithRatings[]> {
  if (topRatedCache && Date.now() - topRatedCache.updatedAt < COURSES_CACHE_TTL_MS) {
    return topRatedCache.value;
  }
  if (topRatedInFlight) return topRatedInFlight;

  topRatedInFlight = listCourses({ page: 1, limit: 18, sort: "rating" })
    .then((r) => r.data ?? [])
    .then((value) => {
      topRatedCache = { value, updatedAt: Date.now() };
      return value;
    })
    .finally(() => {
      topRatedInFlight = null;
    });

  return topRatedInFlight;
}

async function getMajorRatedCached(deptCode: string): Promise<CourseWithRatings[]> {
  const cached = majorRatedCacheByDept.get(deptCode);
  if (cached && Date.now() - cached.updatedAt < COURSES_CACHE_TTL_MS) return cached.value;

  const inflight = majorRatedInFlightByDept.get(deptCode);
  if (inflight) return inflight;

  const p = listCourses({ page: 1, limit: 18, sort: "rating", department: deptCode })
    .then((r) => r.data ?? [])
    .then((value) => {
      majorRatedCacheByDept.set(deptCode, { value, updatedAt: Date.now() });
      return value;
    })
    .finally(() => {
      majorRatedInFlightByDept.delete(deptCode);
    });

  majorRatedInFlightByDept.set(deptCode, p);
  return p;
}

async function getTrainerScoresCached(): Promise<Map<number, number>> {
  if (trainerScoresCache && Date.now() - trainerScoresCache.updatedAt < TRAINER_SCORES_CACHE_TTL_MS) {
    return trainerScoresCache.value;
  }
  if (trainerScoresInFlight) return trainerScoresInFlight;

  trainerScoresInFlight = getAllAiTrainerScores()
    .then((value) => {
      trainerScoresCache = { value, updatedAt: Date.now() };
      return value;
    })
    .finally(() => {
      trainerScoresInFlight = null;
    });

  return trainerScoresInFlight;
}

const GLOBAL_SCORE_WEIGHT = 2.0;

function rankCandidatesWithGlobalBias(
  courses: CourseWithRatings[],
  profile: PreferenceProfile,
  trainerScores: Map<number, number>,
  globalWeight = GLOBAL_SCORE_WEIGHT
) {
  const hasPrefs = hasAnyPreferenceSignals(profile);
  const hasTrainer = trainerScores.size > 0;
  if (!hasPrefs && !hasTrainer) return courses;

  return courses
    .map((course, idx) => {
      const prefScore = hasPrefs ? scoreCourseWithPreferenceSignals(course, profile) : 0;
      const globalScore = (trainerScores.get(course.id) ?? 0) * globalWeight;
      return { course, idx, score: prefScore + globalScore };
    })
    .sort((a, b) => b.score - a.score || a.idx - b.idx)
    .map((x) => x.course);
}

function getUserMemory(userId: string): AiMessage[] {
  const existing = memoryByUser.get(userId);
  if (!existing) return [];
  if (Date.now() - existing.updatedAt > MEMORY_TTL_MS) {
    memoryByUser.delete(userId);
    return [];
  }
  return existing.messages;
}

function setUserMemory(userId: string, messages: AiMessage[]) {
  const trimmed = messages.slice(-MEMORY_MAX_MESSAGES);
  memoryByUser.set(userId, { messages: trimmed, updatedAt: Date.now() });
}

function clearUserMemory(userId: string) {
  memoryByUser.delete(userId);
}

function dedupeCourses(courses: CourseWithRatings[]) {
  const map = new Map<number, CourseWithRatings>();
  for (const c of courses) {
    if (!map.has(c.id)) map.set(c.id, c);
  }
  return map;
}

function enforceSemanticCandidateQuota(input: {
  candidates: CourseWithRatings[];
  semanticRanked: CourseWithRatings[];
  semanticIds: Set<number>;
  excludeIds: Set<number>;
  maxCandidates: number;
  minSemantic: number;
}) {
  const { candidates, semanticRanked, semanticIds, excludeIds, maxCandidates, minSemantic } = input;

  if (semanticIds.size === 0 || minSemantic <= 0) return candidates;

  const target = Math.min(minSemantic, semanticIds.size, maxCandidates);
  if (target <= 0) return candidates;

  const out = [...candidates];
  let semanticCount = out.filter((c) => semanticIds.has(c.id)).length;
  if (semanticCount >= target) return out;

  const selectedIds = new Set<number>(out.map((c) => c.id));
  const addableSemantic = semanticRanked
    .filter((c) => semanticIds.has(c.id))
    .filter((c) => !excludeIds.has(c.id))
    .filter((c) => !selectedIds.has(c.id));

  for (const sem of addableSemantic) {
    if (semanticCount >= target) break;

    // Replace from the tail so higher-ranked/earlier candidates stay stable.
    let replaceIdx = -1;
    for (let i = out.length - 1; i >= 0; i--) {
      if (!semanticIds.has(out[i].id)) {
        replaceIdx = i;
        break;
      }
    }

    if (replaceIdx === -1) {
      if (out.length >= maxCandidates) break;
      out.push(sem);
    } else {
      selectedIds.delete(out[replaceIdx].id);
      out[replaceIdx] = sem;
    }

    selectedIds.add(sem.id);
    semanticCount += 1;
  }

  return out.slice(0, maxCandidates);
}

function findDepartmentCodeFromMajor(
  major: string | null,
  deps: DepartmentMini[]
) {
  if (!major) return null;
  const m = major.trim().toLowerCase();
  if (!m) return null;

  // Exact code match: "CS", "QTM"
  for (const d of deps) {
    if (d.code.toLowerCase() === m) return d.code;
  }

  // Name contains: "Computer Science" -> "CS"
  for (const d of deps) {
    if (d.name.toLowerCase().includes(m)) return d.code;
  }

  return null;
}

function isTrivialGreeting(text: string) {
  const t = text.trim().toLowerCase();
  if (!t) return true;
  if (t.length <= 24) {
    const alpha = t.replace(/[^a-z]/g, "");
    if (/^(hi|hey|yo|sup|help|test|testing)$/.test(alpha)) return true;
    // hello, hellooo, hellow, helo
    if (/^h+e+l+o+w*$/.test(alpha)) return true;
  }
  return false;
}

function interleaveByDepartment(
  courses: CourseWithRatings[],
  max: number,
  maxPerDept: number
) {
  const byDept = new Map<string, CourseWithRatings[]>();
  for (const c of courses) {
    const dept = c.department?.code ?? "OTHER";
    const list = byDept.get(dept);
    if (list) list.push(c);
    else byDept.set(dept, [c]);
  }

  const depts = Array.from(byDept.keys()).sort((a, b) => a.localeCompare(b));
  const selected: CourseWithRatings[] = [];
  const perDeptCount = new Map<string, number>();
  let progress = true;

  while (selected.length < max && progress) {
    progress = false;
    for (const d of depts) {
      if (selected.length >= max) break;
      const count = perDeptCount.get(d) ?? 0;
      if (count >= maxPerDept) continue;
      const list = byDept.get(d);
      if (!list || list.length === 0) continue;
      const next = list.shift();
      if (!next) continue;
      selected.push(next);
      perDeptCount.set(d, count + 1);
      progress = true;
    }
  }

  return selected;
}

function normalizeInstructionMethodFilter(value: string | undefined) {
  if (!value) return undefined;
  if (value === "O") return "DL";
  if (value === "H") return "BL";
  return value;
}

function normalizeAiFilters(raw: AiCourseFilters | undefined) {
  const out: AiCourseFilters = {};
  if (!raw) return out;

  const normalizeString = (v: string | undefined, max = 120) => {
    const t = String(v ?? "").trim();
    return t ? truncate(t, max) : undefined;
  };

  out.semester = normalizeString(raw.semester, 80);
  out.department = normalizeString(raw.department, 20)?.toUpperCase();
  out.attributes = normalizeString(raw.attributes, 100);
  out.instructor = normalizeString(raw.instructor, 120);
  out.campus = normalizeString(raw.campus, 50);
  out.componentType = normalizeString(raw.componentType, 20)?.toUpperCase();
  out.instructionMethod = normalizeInstructionMethodFilter(
    normalizeString(raw.instructionMethod, 20)?.toUpperCase()
  );
  out.minRating =
    typeof raw.minRating === "number" && Number.isFinite(raw.minRating)
      ? Math.min(5, Math.max(1, raw.minRating))
      : undefined;
  out.credits =
    typeof raw.credits === "number" && Number.isFinite(raw.credits)
      ? Math.max(1, Math.trunc(raw.credits))
      : undefined;

  return out;
}

function hasAnyAiFilters(filters: AiCourseFilters) {
  return Boolean(
    filters.semester ||
      filters.department ||
      filters.minRating ||
      filters.credits ||
      filters.attributes ||
      filters.instructor ||
      filters.campus ||
      filters.componentType ||
      filters.instructionMethod
  );
}

function summarizeAiFilters(filters: AiCourseFilters) {
  const pairs: string[] = [];
  if (filters.semester) pairs.push(`semester=${filters.semester}`);
  if (filters.department) pairs.push(`department=${filters.department}`);
  if (filters.minRating) pairs.push(`minRating=${filters.minRating}`);
  if (filters.credits) pairs.push(`credits=${filters.credits}`);
  if (filters.attributes) pairs.push(`attributes=${filters.attributes}`);
  if (filters.instructor) pairs.push(`instructor=${filters.instructor}`);
  if (filters.campus) pairs.push(`campus=${filters.campus}`);
  if (filters.componentType) pairs.push(`componentType=${filters.componentType}`);
  if (filters.instructionMethod) pairs.push(`instructionMethod=${filters.instructionMethod}`);
  return pairs.join(", ") || "(none)";
}

function normalizePreferenceCourses(items: PreferenceCourse[] | undefined) {
  const dedup = new Map<number, PreferenceCourse>();
  for (const item of items ?? []) {
    if (!item || !Number.isFinite(item.id)) continue;
    dedup.set(item.id, {
      id: item.id,
      code: truncate(String(item.code || "").trim(), 30),
      title: truncate(String(item.title || "").trim(), 240),
      department: item.department ? truncate(String(item.department).trim().toUpperCase(), 20) : null,
      gers: (item.gers ?? []).map((x) => String(x).trim()).filter(Boolean).slice(0, 12),
      campuses: (item.campuses ?? []).map((x) => String(x).trim()).filter(Boolean).slice(0, 12),
      instructors: (item.instructors ?? []).map((x) => String(x).trim()).filter(Boolean).slice(0, 12),
      description: item.description ? truncate(String(item.description).trim(), 500) : null,
    });
  }
  return Array.from(dedup.values());
}

function preferenceTokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3)
    .filter((t) => !AI_SEARCH_STOPWORDS.has(t))
    .slice(0, 20);
}

function incrementMap(map: Map<string, number>, key: string, weight = 1) {
  const k = key.trim();
  if (!k) return;
  map.set(k, (map.get(k) ?? 0) + weight);
}

function buildPreferenceProfile(liked: PreferenceCourse[], disliked: PreferenceCourse[]): PreferenceProfile {
  const profile: PreferenceProfile = {
    likedDept: new Map(),
    dislikedDept: new Map(),
    likedGer: new Map(),
    dislikedGer: new Map(),
    likedCampus: new Map(),
    dislikedCampus: new Map(),
    likedInstructor: new Map(),
    dislikedInstructor: new Map(),
    likedTokens: new Set(),
    dislikedTokens: new Set(),
  };

  for (const c of liked) {
    if (c.department) incrementMap(profile.likedDept, c.department, 1.5);
    for (const g of c.gers ?? []) incrementMap(profile.likedGer, g, 1);
    for (const camp of c.campuses ?? []) incrementMap(profile.likedCampus, camp, 1);
    for (const inst of c.instructors ?? []) incrementMap(profile.likedInstructor, inst, 1);
    for (const token of preferenceTokenize(`${c.code} ${c.title} ${c.description ?? ""}`)) {
      profile.likedTokens.add(token);
    }
  }

  for (const c of disliked) {
    if (c.department) incrementMap(profile.dislikedDept, c.department, 2);
    for (const g of c.gers ?? []) incrementMap(profile.dislikedGer, g, 1.25);
    for (const camp of c.campuses ?? []) incrementMap(profile.dislikedCampus, camp, 1.25);
    for (const inst of c.instructors ?? []) incrementMap(profile.dislikedInstructor, inst, 1.25);
    for (const token of preferenceTokenize(`${c.code} ${c.title} ${c.description ?? ""}`)) {
      profile.dislikedTokens.add(token);
    }
  }

  return profile;
}

function hasAnyPreferenceSignals(profile: PreferenceProfile) {
  return (
    profile.likedDept.size > 0 ||
    profile.dislikedDept.size > 0 ||
    profile.likedGer.size > 0 ||
    profile.dislikedGer.size > 0 ||
    profile.likedCampus.size > 0 ||
    profile.dislikedCampus.size > 0 ||
    profile.likedInstructor.size > 0 ||
    profile.dislikedInstructor.size > 0 ||
    profile.likedTokens.size > 0 ||
    profile.dislikedTokens.size > 0
  );
}

function scoreCourseWithPreferenceSignals(course: CourseWithRatings, profile: PreferenceProfile) {
  let score = 0;

  const dept = (course.department?.code ?? "").trim().toUpperCase();
  if (dept) {
    score += (profile.likedDept.get(dept) ?? 0) * 2.6;
    score -= (profile.dislikedDept.get(dept) ?? 0) * 3.1;
  }

  for (const g of course.gers ?? []) {
    score += (profile.likedGer.get(g) ?? 0) * 1.15;
    score -= (profile.dislikedGer.get(g) ?? 0) * 1.45;
  }
  for (const c of course.campuses ?? []) {
    score += (profile.likedCampus.get(c) ?? 0) * 0.9;
    score -= (profile.dislikedCampus.get(c) ?? 0) * 1.2;
  }
  for (const i of course.instructors ?? []) {
    score += (profile.likedInstructor.get(i) ?? 0) * 0.9;
    score -= (profile.dislikedInstructor.get(i) ?? 0) * 1.2;
  }

  const tokens = preferenceTokenize(`${course.code} ${course.title} ${course.description ?? ""}`);
  for (const t of tokens) {
    if (profile.likedTokens.has(t)) score += 0.45;
    if (profile.dislikedTokens.has(t)) score -= 0.6;
  }

  return score;
}

function rankCandidatesByPreferenceSignals(
  courses: CourseWithRatings[],
  profile: PreferenceProfile
) {
  if (!hasAnyPreferenceSignals(profile)) return courses;

  return courses
    .map((course, idx) => ({
      course,
      idx,
      score: scoreCourseWithPreferenceSignals(course, profile),
    }))
    .sort((a, b) => b.score - a.score || a.idx - b.idx)
    .map((x) => x.course);
}

router.post(
  "/ai/course-recommendations",
  requireAuth,
  aiLimiter,
  validate(recommendSchema),
  async (req, res) => {
    try {
      const tStart = Date.now();

      if (!env.openaiApiKey) {
        return res.status(500).json({ error: "AI is not configured on the server" });
      }

      const { messages, prompt, reset, excludeCourseIds, filters, preferences } = req.body as z.infer<
        typeof recommendSchema
      >;
      const user = await getUserById(req.user!.id);
      const activeFilters = normalizeAiFilters(filters);
      const likedCourses = normalizePreferenceCourses(preferences?.liked);
      const dislikedCourses = normalizePreferenceCourses(preferences?.disliked);
      const preferenceProfile = buildPreferenceProfile(likedCourses, dislikedCourses);

      const excludeSet = new Set<number>(
        (excludeCourseIds ?? []).filter((id) => typeof id === "number" && Number.isFinite(id))
      );
      for (const c of dislikedCourses) excludeSet.add(c.id);

      const tDepsStart = Date.now();
      const [deps, trainerScores] = await Promise.all([
        getDepartmentsCached(),
        getTrainerScoresCached(),
      ]);
      const deptCode = findDepartmentCodeFromMajor(
        user?.major ?? null,
        deps
      );
      const depsMs = Date.now() - tDepsStart;

      if (reset) clearUserMemory(req.user!.id);
      if (reset && !messages && !prompt) {
        return res.json({
          assistantMessage: "AI memory cleared.",
          followUpQuestion: null,
          recommendations: [],
        });
      }

      const effectiveMessages: AiMessage[] = (() => {
        if (Array.isArray(messages)) return messages as AiMessage[];
        const mem = getUserMemory(req.user!.id);
        const nextUser = (prompt ?? "").trim();
        const merged = nextUser ? [...mem, { role: "user" as const, content: nextUser }] : mem;
        // Keep model context bounded.
        return merged.slice(-12);
      })();

      const latestUser =
        [...effectiveMessages].reverse().find((m) => m.role === "user")?.content ?? "";

      // If someone just says "hello", don't burn an expensive LLM call.
      if (isTrivialGreeting(latestUser)) {
        setUserMemory(req.user!.id, [
          ...getUserMemory(req.user!.id),
          {
            role: "assistant" as const,
            content:
              "Hi. Tell me what you want in a class (interests, workload, credits, semester) and I'll recommend courses.",
          },
        ]);
        const totalMs = Date.now() - tStart;
        if (totalMs > 1500) {
          console.log("ai/course-recommendations timings", {
            totalMs,
            depsMs,
            openaiMs: 0,
            note: "trivial_greeting",
            model: env.openaiModel,
          });
        }
        return res.json({
          assistantMessage:
            "Tell me what you want in a class (interests, workload, credits, semester) and I'll recommend courses.",
          followUpQuestion: "What are 2-3 topics you'd actually be excited to learn right now?",
          recommendations: [],
        });
      }

      const candidateQuery = normalizeSearchQuery(latestUser);
      const searchTerms = deriveAiSearchTerms(latestUser, deps).slice(0, 3);

      const tCandidatesStart = Date.now();
      let embedMs = 0;
      let semanticMs = 0;
      let semanticUnique: CourseWithRatings[] = [];
      const hasFilters = hasAnyAiFilters(activeFilters);

      if (candidateQuery.length >= 3 && (await areCourseEmbeddingsAvailable())) {
        try {
          const tEmbed = Date.now();
          const embedding = (await openAiEmbedText({ input: latestUser })) as number[];
          embedMs = Date.now() - tEmbed;

          const tSemantic = Date.now();
          semanticUnique = await semanticSearchCoursesByEmbedding({
            embedding,
            limit: 36,
            filters: activeFilters,
          });
          semanticMs = Date.now() - tSemantic;
        } catch (e) {
          // Don't fail the whole request if embeddings aren't set up yet.
          semanticUnique = [];
          embedMs = 0;
          semanticMs = 0;
        }
      }

      let searchCoursesRaw: CourseWithRatings[] = [];
      if (searchTerms.length > 0) {
        // 1) Try a single "combined" query first (cheap and often good enough).
        const primary = await searchCourses({
          q: searchTerms.join(" "),
          page: 1,
          limit: 24,
          ...activeFilters,
        });
        searchCoursesRaw = primary.data ?? [];

        // 2) If that was too strict (common with AND semantics), broaden by searching per-keyword.
        if (searchCoursesRaw.length < 18 && searchTerms.length > 1) {
          const perTerm = await Promise.all(
            searchTerms.map((t) =>
              searchCourses({
                q: t,
                page: 1,
                limit: 12,
                ...activeFilters,
              })
            )
          );
          searchCoursesRaw = [
            ...searchCoursesRaw,
            ...perTerm.flatMap((r) => r.data ?? []),
          ];
        }
      }
      const searchUnique = Array.from(dedupeCourses(searchCoursesRaw).values());

      // Only pay for fillers (top-rated, major-rated) when search isn't providing enough options.
      const needFillers = searchUnique.length + semanticUnique.length < 24 && candidateQuery.length >= 3;
      const [topRated, majorRated] = await Promise.all([
        needFillers
          ? hasFilters
            ? listCourses({ page: 1, limit: 18, sort: "rating", ...activeFilters })
            : getTopRatedCached().then((data) => ({
                data,
                meta: { page: 1, limit: data.length, total: data.length, totalPages: 1 },
              }))
          : Promise.resolve({
              data: [] as CourseWithRatings[],
              meta: { page: 1, limit: 0, total: 0, totalPages: 1 },
            }),
        needFillers && deptCode && !activeFilters.department
          ? hasFilters
            ? listCourses({ page: 1, limit: 18, sort: "rating", ...activeFilters, department: deptCode })
            : getMajorRatedCached(deptCode).then((data) => ({
                data,
                meta: { page: 1, limit: data.length, total: data.length, totalPages: 1 },
              }))
          : Promise.resolve({
              data: [] as CourseWithRatings[],
              meta: { page: 1, limit: 0, total: 0, totalPages: 1 },
            }),
      ]);
      const candidatesMs = Date.now() - tCandidatesStart;

      const courseMap = dedupeCourses([
        ...semanticUnique,
        ...searchUnique,
        ...(topRated.data ?? []),
        ...(majorRated.data ?? []),
      ]);

      // Keep context bounded for cost + latency.
      const CANDIDATE_MAX = 42;
      const MAX_PER_DEPT = 6;
      const MIN_SEMANTIC_CANDIDATES = 6;

      const pool = Array.from(courseMap.values()).filter((c) => !excludeSet.has(c.id));
      const semanticIds = new Set<number>(semanticUnique.map((c) => c.id));
      let candidates = interleaveByDepartment(pool, CANDIDATE_MAX, MAX_PER_DEPT);
      // Put described courses first so the model can make better judgments from text.
      candidates = candidates.sort((a, b) => Number(Boolean(b.description)) - Number(Boolean(a.description)));
      candidates = enforceSemanticCandidateQuota({
        candidates,
        semanticRanked: semanticUnique,
        semanticIds,
        excludeIds: excludeSet,
        maxCandidates: CANDIDATE_MAX,
        minSemantic: MIN_SEMANTIC_CANDIDATES,
      });
      candidates = rankCandidatesWithGlobalBias(candidates, preferenceProfile, trainerScores);
      const semanticCandidateCount = candidates.filter((c) => semanticIds.has(c.id)).length;

      if (candidates.length === 0) {
        return res.json({
          assistantMessage:
            "I couldn't find any courses that satisfy your current filters. Relax one or two filters (often semester + instructor + GER) and try again.",
          followUpQuestion: "Want me to prioritize semester first, then broaden instructor/campus constraints?",
          recommendations: [],
          ...(env.nodeEnv !== "production"
            ? {
                debug: {
                  model: env.openaiModel,
                  totalMs: Date.now() - tStart,
                  depsMs,
                  candidatesMs,
                  embedMs,
                  semanticMs,
                  openaiMs: 0,
                  searchTerms,
                  candidateCount: 0,
                  hadFillers: needFillers,
                  userMajor: user?.major ?? null,
                  deptCode,
                  searchUniqueCount: searchUnique.length,
                  semanticUniqueCount: semanticUnique.length,
                  semanticCandidateCount: 0,
                  candidatesWithDescription: 0,
                  appliedFilters: activeFilters,
                  likedSignals: likedCourses.length,
                  dislikedSignals: dislikedCourses.length,
                  trainerScoresLoaded: trainerScores.size,
                  trainerBoostedCount: 0,
                  trainerDemotedCount: 0,
                },
              }
            : {}),
        });
      }

      const modelCandidates = candidates.map((c) => ({
        id: c.id,
        code: c.code,
        title: c.title,
        credits: c.credits ?? null,
        department: c.department?.code ?? null,
        campuses: (c.campuses ?? []).slice(0, 3),
        instructors: (c.instructors ?? []).slice(0, 3),
        gers: (c.gers ?? []).slice(0, 6),
        prerequisites: c.prerequisites
          ? truncate(String(c.prerequisites).replace(/\s+/g, " ").trim(), 160)
          : null,
        requirements: c.requirements
          ? truncate(String(c.requirements).replace(/\s+/g, " ").trim(), 220)
          : null,
        description: c.description ? truncate(c.description.replace(/\s+/g, " ").trim(), 360) : null,
      }));

      const systemPrompt = [
        "You are BetterAtlas AI, an academic counselor inside a course catalog.",
        "Goal: recommend courses that match the student's interests and intentions.",
        "The student's major is a hint, not a constraint.",
        "Treat active catalog filters as hard constraints; never suggest anything outside them.",
        "Prioritize fit to the course title and description.",
        "Do NOT default to CS/tech courses unless the student asks for them or the course clearly matches their described interests.",
        "Unless the student explicitly asks for one department, diversify: pick from at least 3 departments when possible and avoid recommending more than 3 courses from any single department.",
        "Use course details when helpful: instructors, campuses, GERs, prerequisites, and requirements/restrictions.",
        "Use developer/user feedback signals (liked/disliked course examples) as strong preference hints.",
        "You must ONLY recommend courses from the provided candidate list, using their numeric id.",
        "Never recommend any excluded course_id values provided in context.",
        "If the student's request is vague, make reasonable assumptions and include exactly ONE concise follow-up question.",
        "Keep output concise and helpful. No moralizing. No long disclaimers.",
        "In each recommendation's `why` bullets, reference at least one concrete keyword from the course title or `desc:` snippet provided (no hallucinated details).",
        "Do NOT use generic why bullets like \"seems relevant\" or \"based on the title/description\"; each why bullet must cite a specific course detail (keyword phrase, GER code, campus, instructor, prerequisite, or requirement).",
        "",
        "Return ONLY valid JSON (no markdown, no code fences) matching this shape:",
        "{",
        '  "assistant_message": string,',
        '  "follow_up_question": string|null,',
        '  "recommendations": [',
        "    {",
        '      "course_id": number,',
        '      "fit_score": integer 1-10,',
        '      "why": string[] (2-4 short bullets),',
        '      "cautions": string[] (0-2 short bullets)',
        "    }",
        "  ] (8 items; minimum 6)",
        "}",
      ].join("\n");

      const counselorContextText = [
        `Student major: ${user?.major ?? "unknown"}`,
        `Student graduationYear: ${user?.graduationYear ?? "unknown"}`,
        `Student deptCode (hint): ${deptCode ?? "unknown"}`,
        `Active filters (hard constraints): ${summarizeAiFilters(activeFilters)}`,
        `Liked feedback examples: ${
          likedCourses.length > 0
            ? likedCourses
                .slice(0, 12)
                .map((c) => `${c.code} ${c.title}`)
                .join(" | ")
            : "(none)"
        }`,
        `Disliked feedback examples: ${
          dislikedCourses.length > 0
            ? dislikedCourses
                .slice(0, 12)
                .map((c) => `${c.code} ${c.title}`)
                .join(" | ")
            : "(none)"
        }`,
        `Excluded course IDs: ${excludeSet.size > 0 ? Array.from(excludeSet).slice(0, 200).join(", ") : "(none)"}`,
        (() => {
          const boosted = modelCandidates
            .filter((c) => (trainerScores.get(c.id) ?? 0) > 0.3)
            .map((c) => c.code);
          const demoted = modelCandidates
            .filter((c) => (trainerScores.get(c.id) ?? 0) < -0.3)
            .map((c) => c.code);
          const parts: string[] = [];
          if (boosted.length > 0) parts.push(`Globally well-rated courses (prefer these): ${boosted.join(", ")}`);
          if (demoted.length > 0) parts.push(`Globally poorly-rated courses (deprioritize these): ${demoted.join(", ")}`);
          return parts.length > 0 ? parts.join("\n") : "";
        })(),
        "",
        "Candidates JSON (ONLY recommend from these ids):",
        JSON.stringify(modelCandidates),
      ].join("\n");

      const openAiMessages = [
        { role: "system" as const, content: systemPrompt },
        {
          role: "system" as const,
          content:
            "Context:\n" + counselorContextText,
        },
        ...effectiveMessages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ];

      const tOpenAiStart = Date.now();
      const { parsed } = await openAiChatJson({
        messages: openAiMessages,
        model: env.openaiModel,
        temperature: 0.2,
        maxTokens: 1500,
        responseFormat: { type: "json_schema", json_schema: modelResponseJsonSchema },
      });
      const openaiMs = Date.now() - tOpenAiStart;

      const parsedResult = modelResponseSchema.safeParse(parsed);
      if (!parsedResult.success) {
        return res.status(500).json({
          error: "AI returned an invalid response format",
          details: parsedResult.error.flatten().fieldErrors,
        });
      }

      const modelResult = parsedResult.data;

      const byId = new Map<number, CourseWithRatings>();
      for (const c of candidates) byId.set(c.id, c);

      const TARGET_RECS = 8;
      const MIN_RECS = 6;

      const seen = new Set<number>();
      let recommendations = modelResult.recommendations
        .filter((r) => byId.has(r.course_id))
        .filter((r) => !excludeSet.has(r.course_id))
        .filter((r) => {
          if (seen.has(r.course_id)) return false;
          seen.add(r.course_id);
          return true;
        })
        .slice(0, 16)
        .map((r) => ({
          course: byId.get(r.course_id)!,
          fitScore: r.fit_score,
          why: fixWhyBullets(byId.get(r.course_id)!, r.why),
          cautions: r.cautions ?? [],
        }));

      if (recommendations.length < MIN_RECS) {
        const existingIds = new Set<number>(recommendations.map((r) => r.course.id));
        const perDept = new Map<string, number>();
        for (const r of recommendations) {
          const dept = r.course.department?.code ?? "OTHER";
          perDept.set(dept, (perDept.get(dept) ?? 0) + 1);
        }

        const termsLower = searchTerms.map((t) => t.toLowerCase());
        function scoreCourse(c: CourseWithRatings) {
          const text = `${c.code} ${c.title} ${c.description ?? ""}`.toLowerCase();
          let score = 0;
          for (const t of termsLower) {
            if (!t) continue;
            if (text.includes(t)) score += 1;
          }
          if (c.description) score += 1;
          return score;
        }

        const fill = candidates
          .filter((c) => !excludeSet.has(c.id))
          .filter((c) => !existingIds.has(c.id))
          .slice()
          .sort((a, b) => scoreCourse(b) - scoreCourse(a));

        for (const c of fill) {
          if (recommendations.length >= MIN_RECS) break;
          const dept = c.department?.code ?? "OTHER";
          if ((perDept.get(dept) ?? 0) >= 3) continue;

          const text = `${c.code} ${c.title} ${c.description ?? ""}`.toLowerCase();
          const matched = termsLower.filter((t) => t && text.includes(t)).slice(0, 3);

          const why: string[] = [];
          if (matched.length > 0) why.push(`Title/description mentions: ${matched.join(", ")}`);
          if (c.gers && c.gers.length > 0) why.push(`GER: ${c.gers.slice(0, 3).join(", ")}`);
          if (why.length < 2) {
            const desc = (c.description ?? "").replace(/\s+/g, " ").trim();
            if (desc) why.push(truncate(`Catalog: ${desc}`, 160));
            else why.push(truncate(`From title: ${c.title}`, 160));
          }

          const cautions: string[] = [];
          const req = (c.requirements ?? c.prerequisites ?? "").trim();
          if (req) cautions.push(truncate(`Requirements: ${req.replace(/\s+/g, " ").trim()}`, 160));

          recommendations.push({
            course: c,
            fitScore: Math.max(4, Math.min(8, 4 + scoreCourse(c))),
            why: fixWhyBullets(c, why.slice(0, 4)),
            cautions: cautions.slice(0, 2),
          });
          existingIds.add(c.id);
          perDept.set(dept, (perDept.get(dept) ?? 0) + 1);
        }
      }

      recommendations = recommendations.slice(0, TARGET_RECS);

      if (recommendations.length === 0) {
        return res.status(500).json({ error: "AI did not select any valid courses" });
      }

      // Persist per-user memory (isolated by user id).
      setUserMemory(req.user!.id, [
        ...effectiveMessages,
        { role: "assistant" as const, content: modelResult.assistant_message },
      ]);

      const totalMs = Date.now() - tStart;
      if (totalMs > 1500) {
        console.log("ai/course-recommendations timings", {
          totalMs,
          depsMs,
          candidatesMs,
          embedMs,
          semanticMs,
          openaiMs,
          model: env.openaiModel,
        });
      }

      const deptCounts: Record<string, number> = {};
      for (const c of candidates) {
        const k = c.department?.code ?? "OTHER";
        deptCounts[k] = (deptCounts[k] ?? 0) + 1;
      }

      return res.json({
        assistantMessage: modelResult.assistant_message,
        followUpQuestion: modelResult.follow_up_question ?? null,
        recommendations,
        ...(env.nodeEnv !== "production"
          ? {
              debug: {
                model: env.openaiModel,
                totalMs,
                depsMs,
                candidatesMs,
                embedMs,
                semanticMs,
                openaiMs,
                searchTerms,
                candidateCount: candidates.length,
                hadFillers: needFillers,
                userMajor: user?.major ?? null,
                deptCode,
                searchUniqueCount: searchUnique.length,
                semanticUniqueCount: semanticUnique.length,
                semanticCandidateCount,
                candidatesWithDescription: candidates.filter((c) => Boolean(c.description)).length,
                deptCounts,
                appliedFilters: activeFilters,
                likedSignals: likedCourses.length,
                dislikedSignals: dislikedCourses.length,
                trainerScoresLoaded: trainerScores.size,
                trainerBoostedCount: candidates.filter((c) => (trainerScores.get(c.id) ?? 0) > 0.3).length,
                trainerDemotedCount: candidates.filter((c) => (trainerScores.get(c.id) ?? 0) < -0.3).length,
              },
            }
          : {}),
      });
    } catch (err: any) {
      console.error("AI recommend error:", err);
      return res.status(500).json({ error: err?.message || "AI request failed" });
    }
  }
);

export default router;

