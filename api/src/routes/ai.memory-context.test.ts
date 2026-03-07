import type { CourseWithRatings } from "@betteratlas/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test-openai-key";
process.env.OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
process.env.NODE_ENV = "test";

vi.mock("../middleware/optionalAuth.js", () => ({
  optionalAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../middleware/rateLimit.js", () => ({
  aiLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../lib/openai.js", () => ({
  openAiChat: vi.fn(),
  openAiChatJson: vi.fn(),
}));

vi.mock("../lib/openaiEmbeddings.js", () => ({
  openAiEmbedText: vi.fn(),
}));

vi.mock("../services/courseService.js", () => ({
  listCourses: vi.fn(),
  listDepartments: vi.fn(),
  searchCourses: vi.fn(),
  areCourseEmbeddingsAvailable: vi.fn(),
  semanticSearchCoursesByEmbedding: vi.fn(),
}));

vi.mock("../services/aiTrainerService.js", () => ({
  getAllAiTrainerScores: vi.fn(),
}));

vi.mock("../services/userService.js", () => ({
  getUserById: vi.fn(),
}));

import aiRouter from "./ai.js";
import { openAiChat, openAiChatJson } from "../lib/openai.js";
import { openAiEmbedText } from "../lib/openaiEmbeddings.js";
import {
  areCourseEmbeddingsAvailable,
  listCourses,
  listDepartments,
  searchCourses,
  semanticSearchCoursesByEmbedding,
} from "../services/courseService.js";
import { getAllAiTrainerScores } from "../services/aiTrainerService.js";
import { getUserById } from "../services/userService.js";

const PAGE_META = { page: 1, limit: 50, total: 0, totalPages: 1 };

function buildCourse(overrides: Partial<CourseWithRatings>): CourseWithRatings {
  const department =
    overrides.department ??
    ({
      id: 1,
      code: "CS",
      name: "Computer Science",
    } as const);

  return {
    id: overrides.id ?? 100,
    code: overrides.code ?? "CS 100",
    title: overrides.title ?? "Data Systems Foundations",
    description:
      overrides.description ?? "Data systems modeling with practical projects and analysis.",
    prerequisites: overrides.prerequisites ?? null,
    credits: overrides.credits ?? 3,
    departmentId: overrides.departmentId ?? department.id,
    attributes: overrides.attributes ?? null,
    department,
    avgQuality: overrides.avgQuality ?? 4.2,
    avgDifficulty: overrides.avgDifficulty ?? 2.7,
    avgWorkload: overrides.avgWorkload ?? 2.9,
    reviewCount: overrides.reviewCount ?? 15,
    instructors: overrides.instructors ?? ["Alex Rivera"],
    gers: overrides.gers ?? ["HA"],
    campuses: overrides.campuses ?? ["Atlanta"],
    requirements: overrides.requirements ?? null,
    classScore: overrides.classScore ?? 4.1,
  };
}

function buildCatalogCourses(): CourseWithRatings[] {
  const seeds = [
    buildCourse({
      id: 170,
      code: "CS 170",
      title: "Intro to Computer Science",
      department: { id: 1, code: "CS", name: "Computer Science" },
      gers: ["QR"],
    }),
    buildCourse({
      id: 205,
      code: "ECON 205",
      title: "Applied Economics",
      department: { id: 2, code: "ECON", name: "Economics" },
      gers: ["SB"],
    }),
    buildCourse({
      id: 310,
      code: "HIST 310",
      title: "Public History Methods",
      department: { id: 3, code: "HIST", name: "History" },
      gers: ["HA"],
    }),
    buildCourse({
      id: 411,
      code: "QTM 411",
      title: "Quantitative Modeling Studio",
      department: { id: 4, code: "QTM", name: "Quantitative Theory and Methods" },
      gers: ["QR"],
    }),
  ];

  const out = [...seeds];
  let seed = 0;
  while (out.length < 24) {
    const template = seeds[seed % seeds.length]!;
    const nextId = template.id + 1000 + seed;
    out.push({
      ...template,
      id: nextId,
      code: `${template.department?.code ?? "GEN"} ${nextId}`,
      title: `${template.title} ${seed + 1}`,
    });
    seed += 1;
  }
  return out;
}

function buildPageResult(data: CourseWithRatings[]) {
  return {
    data,
    meta: { ...PAGE_META, total: data.length },
  };
}

const CATALOG_COURSES = buildCatalogCourses();

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(getUserById).mockResolvedValue(null as any);
  vi.mocked(openAiChat).mockResolvedValue("I can help narrow this down.");
  vi.mocked(openAiChatJson).mockResolvedValue({
    raw: JSON.stringify({
      assistant_message: "I can suggest options from the active catalog candidates.",
      follow_up_question: null,
    }),
    parsed: {
      assistant_message: "I can suggest options from the active catalog candidates.",
      follow_up_question: null,
    },
  });
  vi.mocked(listDepartments).mockResolvedValue([
    { id: 1, code: "CS", name: "Computer Science" },
    { id: 2, code: "ECON", name: "Economics" },
    { id: 3, code: "HIST", name: "History" },
    { id: 4, code: "QTM", name: "Quantitative Theory and Methods" },
  ]);
  vi.mocked(getAllAiTrainerScores).mockResolvedValue(new Map<number, number>());
  vi.mocked(areCourseEmbeddingsAvailable).mockResolvedValue(false);
  vi.mocked(semanticSearchCoursesByEmbedding).mockResolvedValue([]);
  vi.mocked(searchCourses).mockImplementation(async () => buildPageResult(CATALOG_COURSES) as any);
  vi.mocked(listCourses).mockImplementation(async () => buildPageResult(CATALOG_COURSES) as any);
  vi.mocked(openAiEmbedText).mockResolvedValue([0.1, 0.2, 0.3]);
});

function getCourseRecommendationsHandlers() {
  const layer = (aiRouter as any).stack.find(
    (entry: any) => entry?.route?.path === "/ai/course-recommendations" && entry?.route?.methods?.post
  );
  if (!layer) {
    throw new Error("Could not find POST /ai/course-recommendations route handlers");
  }
  return layer.route.stack.map((entry: any) => entry.handle) as Array<
    (req: any, res: any, next: (err?: unknown) => void) => unknown
  >;
}

function createMockResponse() {
  return {
    statusCode: 200,
    headersSent: false,
    payload: undefined as any,
    locals: {},
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.payload = body;
      this.headersSent = true;
      return this;
    },
  };
}

async function runHandlers(
  handlers: Array<(req: any, res: any, next: (err?: unknown) => void) => unknown>,
  req: any,
  res: any
) {
  for (const handler of handlers) {
    if (res.headersSent) break;

    await new Promise<void>((resolve, reject) => {
      let nextCalled = false;
      const next = (err?: unknown) => {
        if (err) {
          reject(err);
          return;
        }
        nextCalled = true;
        resolve();
      };

      try {
        const maybePromise = handler(req, res, next);
        Promise.resolve(maybePromise)
          .then(() => {
            if (nextCalled || res.headersSent || handler.length < 3) {
              resolve();
            }
          })
          .catch(reject);
      } catch (error) {
        reject(error);
      }
    });
  }
}

async function postRecommendation({
  body,
  userId,
}: {
  body: Record<string, unknown>;
  userId?: string;
}) {
  const handlers = getCourseRecommendationsHandlers();
  const req = {
    method: "POST",
    url: "/ai/course-recommendations",
    path: "/ai/course-recommendations",
    body,
    headers: {},
    user: userId ? { id: userId } : undefined,
    ip: "127.0.0.1",
  };
  const res = createMockResponse();

  await runHandlers(handlers, req, res);

  return { status: res.statusCode, body: res.payload };
}

describe("POST /ai/course-recommendations memory context", () => {
  it("isolates memory and blocklist state across session IDs for the same user", async () => {
    const userId = "aimem-user-1";
    const sessionA = "tab-a";
    const sessionB = "tab-b";

    const first = await postRecommendation({
      userId,
      body: {
        sessionId: sessionA,
        prompt: "Recommend history classes for me.",
        excludeCourseIds: [170],
      },
    });
    expect(first.status).toBe(200);

    const second = await postRecommendation({
      userId,
      body: {
        sessionId: sessionB,
        prompt: "Recommend more options.",
      },
    });
    const sessionBQuery = vi.mocked(searchCourses).mock.calls.at(-1)?.[0]?.q ?? "";

    const third = await postRecommendation({
      userId,
      body: {
        sessionId: sessionA,
        prompt: "Recommend more options.",
      },
    });
    const sessionAQuery = vi.mocked(searchCourses).mock.calls.at(-1)?.[0]?.q ?? "";

    expect(second.status).toBe(200);
    expect(second.body.debug.blockedCourseCount).toBe(0);
    expect(sessionBQuery).not.toMatch(/HIST/i);

    expect(third.status).toBe(200);
    expect(third.body.debug.blockedCourseCount).toBeGreaterThan(0);
    expect(sessionAQuery).toMatch(/HIST/i);
  });

  it("reset clears only the targeted session context and keeps sibling session state", async () => {
    const userId = "aimem-user-2";
    const sessionA = "tab-a";
    const sessionB = "tab-b";

    await postRecommendation({
      userId,
      body: {
        sessionId: sessionA,
        prompt: "Recommend history classes.",
        excludeCourseIds: [170],
      },
    });
    await postRecommendation({
      userId,
      body: {
        sessionId: sessionB,
        prompt: "Recommend economics classes.",
        excludeCourseIds: [205],
      },
    });

    const reset = await postRecommendation({
      userId,
      body: {
        sessionId: sessionA,
        reset: true,
      },
    });
    expect(reset.status).toBe(200);
    expect(reset.body.assistantMessage).toBe("AI memory cleared.");

    const postResetA = await postRecommendation({
      userId,
      body: {
        sessionId: sessionA,
        prompt: "Recommend more options.",
      },
    });
    const queryA = vi.mocked(searchCourses).mock.calls.at(-1)?.[0]?.q ?? "";

    const postResetB = await postRecommendation({
      userId,
      body: {
        sessionId: sessionB,
        prompt: "Recommend more options.",
      },
    });
    const queryB = vi.mocked(searchCourses).mock.calls.at(-1)?.[0]?.q ?? "";

    expect(postResetA.status).toBe(200);
    expect(postResetA.body.debug.blockedCourseCount).toBe(0);
    expect(queryA).not.toMatch(/HIST/i);

    expect(postResetB.status).toBe(200);
    expect(postResetB.body.debug.blockedCourseCount).toBeGreaterThan(0);
    expect(queryB).toMatch(/ECON/i);
  });

  it("decays stale inferred constraints after a topic shift", async () => {
    const userId = "aimem-user-3";
    const sessionId = "shift-session";

    await postRecommendation({
      userId,
      body: {
        sessionId,
        prompt: "Recommend history classes for Fall 2026.",
      },
    });

    const shifted = await postRecommendation({
      userId,
      body: {
        sessionId,
        prompt: "Actually switch to computer science classes instead and recommend options.",
      },
    });
    const openAiCall = vi.mocked(openAiChatJson).mock.calls.at(-1)?.[0];
    const contextMessage = openAiCall?.messages?.[1]?.content ?? "";
    const resolvedLine =
      contextMessage
        .split("\n")
        .find((line: string) => line.startsWith("Resolved memory constraints:")) ?? "";

    expect(shifted.status).toBe(200);
    expect(shifted.body.debug.intentMode).toBe("recommend");
    expect(resolvedLine).toContain('Resolved memory constraints: {"department":"CS"}');
    expect(resolvedLine).not.toContain("Fall 2026");
    expect(resolvedLine).not.toContain('"department":"HIST"');
  });

  it("latest-turn explicit constraints override older inferred context", async () => {
    const userId = "aimem-user-4";
    const sessionId = "precedence-session";

    await postRecommendation({
      userId,
      body: {
        sessionId,
        prompt: "Recommend history classes.",
      },
    });

    const explicit = await postRecommendation({
      userId,
      body: {
        sessionId,
        prompt: "Recommend options.",
        filters: { department: "QTM" },
      },
    });
    const searchArgs = (vi.mocked(searchCourses).mock.calls.at(-1)?.[0] ?? {}) as any;
    const openAiCall = vi.mocked(openAiChatJson).mock.calls.at(-1)?.[0];
    const contextMessage = openAiCall?.messages?.[1]?.content ?? "";
    const resolvedLine =
      contextMessage
        .split("\n")
        .find((line: string) => line.startsWith("Resolved memory constraints:")) ?? "";

    expect(explicit.status).toBe(200);
    expect(searchArgs.department).toBe("QTM");
    expect(resolvedLine).toContain('Resolved memory constraints: {"department":"QTM"}');
    expect(resolvedLine).not.toContain('"department":"HIST"');
    expect(
      explicit.body.recommendations.every((item: any) => item.course.department?.code === "QTM")
    ).toBe(true);
  });

  it("keeps backward-compatible messages payload requests working", async () => {
    const result = await postRecommendation({
      body: {
        messages: [{ role: "user", content: "Recommend history classes I can take." }],
      },
    });

    expect(result.status).toBe(200);
    expect(typeof result.body.assistantMessage).toBe("string");
    expect(Array.isArray(result.body.recommendations)).toBe(true);
    expect(openAiChatJson).toHaveBeenCalled();
  });
});
