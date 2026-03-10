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
import { buildSafeGroundingFallback } from "../ai/grounding/safeGroundingFallback.js";

const PAGE_META = { page: 1, limit: 50, total: 2, totalPages: 1 };

function buildCourse(overrides: Partial<CourseWithRatings>): CourseWithRatings {
  return {
    id: 170,
    code: "CS 170",
    title: "Intro to Computer Science",
    description: "Foundational computing concepts and problem solving.",
    prerequisites: null,
    credits: 3,
    departmentId: 1,
    attributes: null,
    department: { id: 1, code: "CS", name: "Computer Science" },
    avgQuality: 4.2,
    avgDifficulty: 2.8,
    avgWorkload: 2.9,
    reviewCount: 42,
    instructors: ["Ada Lovelace"],
    gers: ["QR"],
    campuses: ["Atlanta"],
    requirements: null,
    classScore: 4.3,
    ...overrides,
  };
}

const catalogCourses: CourseWithRatings[] = [
  buildCourse({}),
  buildCourse({
    id: 205,
    code: "HIST 205",
    title: "Modern Atlantic Worlds",
    departmentId: 2,
    department: { id: 2, code: "HIST", name: "History" },
    instructors: ["Jordan Miles"],
    gers: ["HA"],
    campuses: ["Atlanta"],
    classScore: 4.1,
  }),
];

function buildPageResult(data: CourseWithRatings[]) {
  return {
    data,
    meta: { ...PAGE_META, total: data.length },
  };
}

function withCourseMetadata(course: CourseWithRatings, metadata: Record<string, unknown>) {
  return Object.assign({}, course, metadata) as CourseWithRatings;
}

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(getUserById).mockResolvedValue(null as any);
  vi.mocked(openAiChat).mockResolvedValue("Here are a few options to consider.");
  vi.mocked(openAiChatJson).mockResolvedValue({
    raw: JSON.stringify({
      assistant_message: "Try CS 170 Intro to Computer Science and HIST 205 Modern Atlantic Worlds.",
      follow_up_question: null,
    }),
    parsed: {
      assistant_message: "Try CS 170 Intro to Computer Science and HIST 205 Modern Atlantic Worlds.",
      follow_up_question: null,
    },
  });

  vi.mocked(listDepartments).mockResolvedValue([
    { id: 1, code: "CS", name: "Computer Science" },
    { id: 2, code: "HIST", name: "History" },
  ]);
  vi.mocked(getAllAiTrainerScores).mockResolvedValue(new Map<number, number>());
  vi.mocked(areCourseEmbeddingsAvailable).mockResolvedValue(false);
  vi.mocked(semanticSearchCoursesByEmbedding).mockResolvedValue([]);
  vi.mocked(searchCourses).mockImplementation(async () => buildPageResult(catalogCourses) as any);
  vi.mocked(listCourses).mockImplementation(async () => buildPageResult(catalogCourses) as any);
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

describe("POST /ai/course-recommendations grounding safety", () => {
  it("fails closed when assistant references an off-catalog course code", async () => {
    vi.mocked(openAiChatJson).mockResolvedValueOnce({
      raw: JSON.stringify({
        assistant_message: "You should take MATH 999 Quantum Basket Weaving.",
        follow_up_question: null,
      }),
      parsed: {
        assistant_message: "You should take MATH 999 Quantum Basket Weaving.",
        follow_up_question: null,
      },
    });

    const safeFallback = buildSafeGroundingFallback();
    const { status, body } = await postRecommendation({
      body: { prompt: "Recommend 3 easy HA classes for Fall 2026." },
    });

    expect(status).toBe(200);
    expect(body.assistantMessage).toBe(safeFallback.assistantMessage);
    expect(body.followUpQuestion).toBe(safeFallback.followUpQuestion);
    expect(body.recommendations).toEqual([]);
    expect(body.debug.groundingStatus).toBe("failed");
    expect(body.debug.groundingViolationCount).toBeGreaterThan(0);
    expect(body.debug.safeFallbackUsed).toBe(true);
  });

  it("fails closed when assistant references an unknown title-only course mention", async () => {
    vi.mocked(openAiChatJson).mockResolvedValueOnce({
      raw: JSON.stringify({
        assistant_message: "You should take Quantum Basket Weaving next semester.",
        follow_up_question: null,
      }),
      parsed: {
        assistant_message: "You should take Quantum Basket Weaving next semester.",
        follow_up_question: null,
      },
    });

    const safeFallback = buildSafeGroundingFallback();
    const { status, body } = await postRecommendation({
      body: { prompt: "Recommend 3 easy HA classes for Fall 2026." },
    });

    expect(status).toBe(200);
    expect(body.assistantMessage).toBe(safeFallback.assistantMessage);
    expect(body.followUpQuestion).toBe(safeFallback.followUpQuestion);
    expect(body.recommendations).toEqual([]);
    expect(body.debug.groundingStatus).toBe("failed");
    expect(body.debug.groundingViolationCount).toBeGreaterThan(0);
    expect(body.debug.safeFallbackUsed).toBe(true);
  });

  it("keeps excluded course IDs blocked across sequential calls for the same user", async () => {
    vi.mocked(openAiChatJson)
      .mockResolvedValueOnce({
        raw: JSON.stringify({
          assistant_message: "Try CS 170 Intro to Computer Science.",
          follow_up_question: null,
        }),
        parsed: {
          assistant_message: "Try CS 170 Intro to Computer Science.",
          follow_up_question: null,
        },
      })
      .mockResolvedValueOnce({
        raw: JSON.stringify({
          assistant_message: "I can suggest options aligned with your interests.",
          follow_up_question: null,
        }),
        parsed: {
          assistant_message: "I can suggest options aligned with your interests.",
          follow_up_question: null,
        },
      });

    const userId = "grounding-safety-user-1";

    const first = await postRecommendation({
      userId,
      body: {
        prompt: "Recommend 3 easy HA classes for Fall 2026.",
        excludeCourseIds: [170],
      },
    });

    expect(first.status).toBe(200);
    expect(first.body.recommendations).toEqual([]);
    expect(first.body.debug.safeFallbackUsed).toBe(true);

    const second = await postRecommendation({
      userId,
      body: {
        prompt: "Recommend 3 more easy HA classes for Fall 2026.",
      },
    });

    expect(second.status).toBe(200);
    expect(second.body.recommendations.length).toBeGreaterThan(0);
    expect(second.body.recommendations.every((item: any) => item.course.id !== 170)).toBe(true);
    expect(second.body.debug.blockedCourseCount).toBeGreaterThan(0);
  });

  it("enforces active filters as hard constraints on output recommendation cards", async () => {
    vi.mocked(openAiChatJson).mockResolvedValueOnce({
      raw: JSON.stringify({
        assistant_message: "Try CS 170 Intro to Computer Science and HIST 205 Modern Atlantic Worlds.",
        follow_up_question: null,
      }),
      parsed: {
        assistant_message: "Try CS 170 Intro to Computer Science and HIST 205 Modern Atlantic Worlds.",
        follow_up_question: null,
      },
    });

    const { status, body } = await postRecommendation({
      body: {
        prompt: "Recommend 3 history classes for Fall 2026.",
        filters: { department: "HIST" },
      },
    });

    expect(status).toBe(200);
    expect(body.recommendations.length).toBeGreaterThan(0);
    expect(
      body.recommendations.every((item: any) => item.course.department?.code === "HIST")
    ).toBe(true);
    expect(body.debug.filterConstraintDroppedCount).toBeGreaterThan(0);
    expect(body.debug.safeFallbackUsed).toBe(false);
  });

  it("enforces semester/credits/attributes/instructor/campus/component/instruction hard filters, including missing metadata", async () => {
    const scenarios: Array<{
      name: string;
      filters: Record<string, unknown>;
      matching: CourseWithRatings;
      missingMetadata: CourseWithRatings;
    }> = [
      {
        name: "semester",
        filters: { semester: "Fall 2026" },
        matching: withCourseMetadata(
          buildCourse({ id: 301, code: "HIST 301", title: "Public History Methods" }),
          { semesters: ["Fall 2026"] }
        ),
        missingMetadata: buildCourse({
          id: 302,
          code: "HIST 302",
          title: "Oral History Studio",
        }),
      },
      {
        name: "credits",
        filters: { credits: 4 },
        matching: buildCourse({ id: 311, code: "QTM 311", title: "Applied Modeling", credits: 4 }),
        missingMetadata: buildCourse({
          id: 312,
          code: "QTM 312",
          title: "Model Validation Lab",
          credits: null,
        }),
      },
      {
        name: "attributes",
        filters: { attributes: "HA" },
        matching: buildCourse({ id: 321, code: "HIST 321", title: "Comparative Revolutions", gers: ["HA"] }),
        missingMetadata: buildCourse({
          id: 322,
          code: "HIST 322",
          title: "Historical Archives Practicum",
          gers: [],
        }),
      },
      {
        name: "instructor",
        filters: { instructor: "Jordan Miles" },
        matching: buildCourse({
          id: 331,
          code: "HIST 331",
          title: "Atlantic Networks",
          instructors: ["Jordan Miles"],
        }),
        missingMetadata: buildCourse({
          id: 332,
          code: "HIST 332",
          title: "Colonial Economies",
          instructors: [],
        }),
      },
      {
        name: "campus",
        filters: { campus: "Oxford" },
        matching: buildCourse({ id: 341, code: "ENG 341", title: "Poetics Workshop", campuses: ["Oxford"] }),
        missingMetadata: buildCourse({
          id: 342,
          code: "ENG 342",
          title: "Literary Translation",
          campuses: [],
        }),
      },
      {
        name: "componentType",
        filters: { componentType: "lec" },
        matching: withCourseMetadata(
          buildCourse({ id: 351, code: "CS 351", title: "Systems Design" }),
          { componentType: "LEC" }
        ),
        missingMetadata: buildCourse({
          id: 352,
          code: "CS 352",
          title: "Distributed Services",
        }),
      },
      {
        name: "instructionMethod",
        filters: { instructionMethod: "O" },
        matching: withCourseMetadata(
          buildCourse({ id: 361, code: "ECON 361", title: "Global Policy Analysis" }),
          { instructionMethod: "DL" }
        ),
        missingMetadata: buildCourse({
          id: 362,
          code: "ECON 362",
          title: "Public Economics",
        }),
      },
    ];

    for (const scenario of scenarios) {
      const courses = [scenario.matching, scenario.missingMetadata];
      vi.mocked(searchCourses).mockImplementation(async () => buildPageResult(courses) as any);
      vi.mocked(listCourses).mockImplementation(async () => buildPageResult(courses) as any);
      vi.mocked(openAiChatJson).mockResolvedValueOnce({
        raw: JSON.stringify({
          assistant_message: `Try ${scenario.matching.code} ${scenario.matching.title} and ${scenario.missingMetadata.code} ${scenario.missingMetadata.title}.`,
          follow_up_question: null,
        }),
        parsed: {
          assistant_message: `Try ${scenario.matching.code} ${scenario.matching.title} and ${scenario.missingMetadata.code} ${scenario.missingMetadata.title}.`,
          follow_up_question: null,
        },
      });

      const { status, body } = await postRecommendation({
        body: {
          prompt: `Recommend classes with ${scenario.name} constraints.`,
          filters: scenario.filters,
        },
      });

      expect(status).toBe(200);
      expect(body.recommendations).toHaveLength(1);
      expect(body.recommendations[0].course.id).toBe(scenario.matching.id);
      expect(body.debug.filterConstraintDroppedCount).toBeGreaterThan(0);
      expect(body.debug.safeFallbackUsed).toBe(false);
    }
  });

  it("fails closed when active hard filters cannot be verified for any recommendation", async () => {
    const courseWithoutComponentMetadata = buildCourse({
      id: 470,
      code: "PHIL 470",
      title: "Justice and Society",
    });

    vi.mocked(searchCourses).mockImplementation(
      async () => buildPageResult([courseWithoutComponentMetadata]) as any
    );
    vi.mocked(listCourses).mockImplementation(async () => buildPageResult([courseWithoutComponentMetadata]) as any);
    vi.mocked(openAiChatJson).mockResolvedValueOnce({
      raw: JSON.stringify({
        assistant_message: "Try PHIL 470 Justice and Society.",
        follow_up_question: null,
      }),
      parsed: {
        assistant_message: "Try PHIL 470 Justice and Society.",
        follow_up_question: null,
      },
    });

    const safeFallback = buildSafeGroundingFallback();
    const { status, body } = await postRecommendation({
      body: {
        prompt: "Recommend lecture courses in philosophy.",
        filters: { componentType: "LEC" },
      },
    });

    expect(status).toBe(200);
    expect(body.assistantMessage).toBe(safeFallback.assistantMessage);
    expect(body.recommendations).toEqual([]);
    expect(body.debug.filterConstraintDroppedCount).toBeGreaterThan(0);
    expect(body.debug.safeFallbackUsed).toBe(true);
  });

  it("applies the same safety gate when JSON-mode parsing falls back to openAiChat", async () => {
    vi.mocked(openAiChatJson).mockRejectedValueOnce(
      new Error("invalid response format: missing message content"),
    );
    vi.mocked(openAiChat).mockResolvedValueOnce(
      "Take MATH 999 Quantum Basket Weaving next semester.",
    );

    const safeFallback = buildSafeGroundingFallback();
    const { status, body } = await postRecommendation({
      body: { prompt: "Recommend 3 easy HA classes for Fall 2026." },
    });

    expect(status).toBe(200);
    expect(openAiChat).toHaveBeenCalledTimes(1);
    expect(body.assistantMessage).toBe(safeFallback.assistantMessage);
    expect(body.followUpQuestion).toBe(safeFallback.followUpQuestion);
    expect(body.recommendations).toEqual([]);
    expect(body.debug.usedJsonFallback).toBe(true);
    expect(body.debug.groundingStatus).toBe("failed");
    expect(body.debug.safeFallbackUsed).toBe(true);
  });
});
