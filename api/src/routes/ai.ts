import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/auth.js";
import { aiLimiter } from "../middleware/rateLimit.js";
import { env } from "../config/env.js";
import { openAiChatJson } from "../lib/openai.js";
import { getUserById } from "../services/userService.js";
import { listCourses, listDepartments, searchCourses } from "../services/courseService.js";
import type { CourseWithRatings } from "@betteratlas/shared";

const router = Router();

type AiMessage = { role: "user" | "assistant"; content: string };

const aiMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const recommendSchema = z
  .object({
    // New preferred API: client sends the next user prompt, server maintains per-user memory.
    prompt: z.string().min(1).max(4000).optional(),
    // Back-compat: client may send the whole message list.
    messages: z.array(aiMessageSchema).min(1).max(12).optional(),
    // Avoid recommending already-shown courses (used by "Generate more").
    excludeCourseIds: z.array(z.number().int().positive()).max(200).optional(),
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

const DEPS_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
let depsCache: CacheEntry<DepartmentMini[]> | null = null;
let depsInFlight: Promise<DepartmentMini[]> | null = null;

const COURSES_CACHE_TTL_MS = 10 * 60 * 1000; // 10m
let topRatedCache: CacheEntry<CourseWithRatings[]> | null = null;
let topRatedInFlight: Promise<CourseWithRatings[]> | null = null;
const majorRatedCacheByDept = new Map<string, CacheEntry<CourseWithRatings[]>>();
const majorRatedInFlightByDept = new Map<string, Promise<CourseWithRatings[]>>();

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

      const { messages, prompt, reset, excludeCourseIds } = req.body as z.infer<typeof recommendSchema>;
      const user = await getUserById(req.user!.id);
      const excludeSet = new Set<number>(
        (excludeCourseIds ?? []).filter((id) => typeof id === "number" && Number.isFinite(id))
      );

      const tDepsStart = Date.now();
      const deps = await getDepartmentsCached();
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
      let searchCoursesRaw: CourseWithRatings[] = [];
      if (searchTerms.length > 0) {
        // 1) Try a single "combined" query first (cheap and often good enough).
        const primary = await searchCourses({
          q: searchTerms.join(" "),
          page: 1,
          limit: 24,
        });
        searchCoursesRaw = primary.data ?? [];

        // 2) If that was too strict (common with AND semantics), broaden by searching per-keyword.
        if (searchCoursesRaw.length < 18 && searchTerms.length > 1) {
          const perTerm = await Promise.all(
            searchTerms.map((t) => searchCourses({ q: t, page: 1, limit: 12 }))
          );
          searchCoursesRaw = [
            ...searchCoursesRaw,
            ...perTerm.flatMap((r) => r.data ?? []),
          ];
        }
      }
      const searchUnique = Array.from(dedupeCourses(searchCoursesRaw).values());

      // Only pay for fillers (top-rated, major-rated) when search isn't providing enough options.
      const needFillers = searchUnique.length < 24 && candidateQuery.length >= 3;
      const [topRated, majorRated] = await Promise.all([
        needFillers
          ? getTopRatedCached().then((data) => ({ data, meta: { page: 1, limit: data.length, total: data.length, totalPages: 1 } }))
          : Promise.resolve({ data: [] as CourseWithRatings[], meta: { page: 1, limit: 0, total: 0, totalPages: 1 } }),
        needFillers && deptCode
          ? getMajorRatedCached(deptCode).then((data) => ({ data, meta: { page: 1, limit: data.length, total: data.length, totalPages: 1 } }))
          : Promise.resolve({ data: [] as CourseWithRatings[], meta: { page: 1, limit: 0, total: 0, totalPages: 1 } }),
      ]);
      const candidatesMs = Date.now() - tCandidatesStart;

      const courseMap = dedupeCourses([
        ...searchUnique,
        ...(topRated.data ?? []),
        ...(majorRated.data ?? []),
      ]);

      // Keep context bounded for cost + latency.
      const pool = Array.from(courseMap.values()).filter((c) => !excludeSet.has(c.id));
      let candidates = interleaveByDepartment(pool, 42, 6);
      // Put described courses first so the model can make better judgments from text.
      candidates = candidates.sort((a, b) => Number(Boolean(b.description)) - Number(Boolean(a.description)));

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
        "Prioritize fit to the course title and description.",
        "Do NOT default to CS/tech courses unless the student asks for them or the course clearly matches their described interests.",
        "Unless the student explicitly asks for one department, diversify: pick from at least 3 departments when possible and avoid recommending more than 3 courses from any single department.",
        "Use course details when helpful: instructors, campuses, GERs, prerequisites, and requirements/restrictions.",
        "You must ONLY recommend courses from the provided candidate list, using their numeric id.",
        "Never recommend any excluded course_id values provided in context.",
        "If the student's request is vague, make reasonable assumptions and include exactly ONE concise follow-up question.",
        "Keep output concise and helpful. No moralizing. No long disclaimers.",
        "In each recommendation's `why` bullets, reference at least one concrete keyword from the course title or `desc:` snippet provided (no hallucinated details).",
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
        `Excluded course IDs: ${excludeSet.size > 0 ? Array.from(excludeSet).slice(0, 200).join(", ") : "(none)"}`,
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
        maxTokens: 700,
        responseFormat: { type: "json_object" },
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
          why: r.why,
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
          if (why.length < 2) why.push("Looks relevant based on the catalog description.");

          const cautions: string[] = [];
          const req = (c.requirements ?? c.prerequisites ?? "").trim();
          if (req) cautions.push(truncate(`Requirements: ${req.replace(/\s+/g, " ").trim()}`, 160));

          recommendations.push({
            course: c,
            fitScore: Math.max(4, Math.min(8, 4 + scoreCourse(c))),
            why: why.slice(0, 4),
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
                openaiMs,
                searchTerms,
                candidateCount: candidates.length,
                hadFillers: needFillers,
                userMajor: user?.major ?? null,
                deptCode,
                searchUniqueCount: searchUnique.length,
                candidatesWithDescription: candidates.filter((c) => Boolean(c.description)).length,
                deptCounts,
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


