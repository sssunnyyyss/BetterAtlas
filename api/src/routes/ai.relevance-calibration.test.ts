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
import { buildLowRelevanceRefineGuidance } from "../ai/relevance/relevanceSufficiencyPolicy.js";

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
    gers: overrides.gers ?? ["QR"],
    campuses: overrides.campuses ?? ["Atlanta"],
    requirements: overrides.requirements ?? null,
    classScore: overrides.classScore ?? 4.1,
  };
}

function buildPageResult(data: CourseWithRatings[]) {
  return {
    data,
    meta: { ...PAGE_META, total: data.length },
  };
}

function padCoursesToMin(courses: CourseWithRatings[], minimum = 24): CourseWithRatings[] {
  const out = [...courses];
  let seed = 0;
  while (out.length < minimum) {
    const template = courses[seed % courses.length]!;
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

function strongCatalogCourses(): CourseWithRatings[] {
  return [
    buildCourse({
      id: 201,
      code: "CS 201",
      title: "Data Systems Studio",
      description: "Data systems design and modeling lab.",
      department: { id: 1, code: "CS", name: "Computer Science" },
    }),
    buildCourse({
      id: 202,
      code: "QTM 202",
      title: "Data Modeling for Policy",
      description: "Modeling and data systems for policy decisions.",
      department: { id: 2, code: "QTM", name: "Quantitative Theory and Methods" },
    }),
    buildCourse({
      id: 203,
      code: "HIST 203",
      title: "Historical Data Methods",
      description: "Data-driven historical systems and archival interpretation.",
      department: { id: 3, code: "HIST", name: "History" },
    }),
    buildCourse({
      id: 204,
      code: "BIOL 204",
      title: "Biology Data Lab",
      description: "Data and systems methods for experimental biology.",
      department: { id: 4, code: "BIOL", name: "Biology" },
    }),
    buildCourse({
      id: 205,
      code: "ECON 205",
      title: "Applied Data Economics",
      description: "Economic systems with data modeling projects.",
      department: { id: 5, code: "ECON", name: "Economics" },
    }),
  ];
}

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

async function postRecommendation(body: Record<string, unknown>) {
  const handlers = getCourseRecommendationsHandlers();
  const req = {
    method: "POST",
    url: "/ai/course-recommendations",
    path: "/ai/course-recommendations",
    body,
    headers: {},
    user: undefined,
    ip: "127.0.0.1",
  };
  const res = createMockResponse();

  await runHandlers(handlers, req, res);

  return { status: res.statusCode, body: res.payload };
}

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(getUserById).mockResolvedValue(null as any);
  vi.mocked(openAiChat).mockResolvedValue("I can help narrow this down.");
  vi.mocked(openAiChatJson).mockResolvedValue({
    raw: JSON.stringify({
      assistant_message: "I can help compare options from the catalog candidates.",
      follow_up_question: null,
    }),
    parsed: {
      assistant_message: "I can help compare options from the catalog candidates.",
      follow_up_question: null,
    },
  });

  vi.mocked(listDepartments).mockResolvedValue([
    { id: 1, code: "CS", name: "Computer Science" },
    { id: 2, code: "QTM", name: "Quantitative Theory and Methods" },
    { id: 3, code: "HIST", name: "History" },
    { id: 4, code: "BIOL", name: "Biology" },
    { id: 5, code: "ECON", name: "Economics" },
    { id: 6, code: "PHIL", name: "Philosophy" },
    { id: 7, code: "MUS", name: "Music" },
    { id: 8, code: "REL", name: "Religion" },
  ]);
  vi.mocked(getAllAiTrainerScores).mockResolvedValue(new Map<number, number>());
  vi.mocked(areCourseEmbeddingsAvailable).mockResolvedValue(false);
  vi.mocked(semanticSearchCoursesByEmbedding).mockResolvedValue([]);
  vi.mocked(searchCourses).mockImplementation(
    async () => buildPageResult(padCoursesToMin(strongCatalogCourses())) as any
  );
  vi.mocked(listCourses).mockImplementation(
    async () => buildPageResult(padCoursesToMin(strongCatalogCourses())) as any
  );
  vi.mocked(openAiEmbedText).mockResolvedValue([0.1, 0.2, 0.3]);
});

describe("POST /ai/course-recommendations relevance calibration", () => {
  it("emits hybrid retrieval telemetry when semantic retrieval succeeds", async () => {
    vi.mocked(areCourseEmbeddingsAvailable).mockResolvedValueOnce(true);
    vi.mocked(semanticSearchCoursesByEmbedding).mockResolvedValueOnce(
      strongCatalogCourses().slice(0, 2)
    );

    const { status, body } = await postRecommendation({
      prompt: "Recommend data systems modeling classes.",
    });

    expect(status).toBe(200);
    expect(body.recommendations.length).toBeGreaterThan(0);
    expect(body.debug.retrievalMode).toBe("hybrid");
    expect(body.debug.semanticAttempted).toBe(true);
    expect(body.debug.semanticAvailable).toBe(true);
    expect(body.debug.semanticCount).toBeGreaterThan(0);
  });

  it("emits hybrid_degraded telemetry when semantic retrieval fails", async () => {
    vi.mocked(areCourseEmbeddingsAvailable).mockResolvedValueOnce(true);
    vi.mocked(openAiEmbedText).mockRejectedValueOnce(new Error("embedding provider unavailable"));

    const { status, body } = await postRecommendation({
      prompt: "Recommend data systems modeling classes.",
    });

    expect(status).toBe(200);
    expect(body.recommendations.length).toBeGreaterThan(0);
    expect(body.debug.retrievalMode).toBe("hybrid_degraded");
    expect(body.debug.semanticAttempted).toBe(true);
    expect(body.debug.semanticAvailable).toBe(true);
    expect(body.debug.semanticCount).toBe(0);
  });

  it("keeps ranking relevance-led despite extreme trainer and preference signals", async () => {
    const relevanceLeader = buildCourse({
      id: 310,
      code: "QTM 310",
      title: "Data Systems Modeling",
      description: "Data systems modeling research methods.",
      department: { id: 2, code: "QTM", name: "Quantitative Theory and Methods" },
    });
    const amplifiedButWeak = buildCourse({
      id: 311,
      code: "CS 311",
      title: "Intro Topic Survey",
      description: "General overview seminar.",
      department: { id: 1, code: "CS", name: "Computer Science" },
    });
    const supportCourses = [
      buildCourse({
        id: 312,
        code: "HIST 312",
        title: "Historical Data Systems",
        description: "Historical data systems analysis and modeling.",
        department: { id: 3, code: "HIST", name: "History" },
      }),
      buildCourse({
        id: 313,
        code: "BIOL 313",
        title: "Biology Data Methods",
        description: "Data modeling in biology systems.",
        department: { id: 4, code: "BIOL", name: "Biology" },
      }),
    ];

    const rankingSet = [amplifiedButWeak, relevanceLeader, ...supportCourses];
    const rankingSetWithPadding = padCoursesToMin(rankingSet);
    vi.mocked(searchCourses).mockImplementation(
      async () => buildPageResult(rankingSetWithPadding) as any
    );
    vi.mocked(listCourses).mockImplementation(
      async () => buildPageResult(rankingSetWithPadding) as any
    );
    vi.mocked(getAllAiTrainerScores).mockResolvedValueOnce(new Map<number, number>([[311, 99]]));

    const { status, body } = await postRecommendation({
      prompt: "Recommend data systems modeling classes.",
      preferences: {
        liked: [
          {
            id: 311,
            code: "CS 311",
            title: "Intro Topic Survey",
            department: "CS",
          },
        ],
      },
    });

    expect(status).toBe(200);
    expect(body.recommendations.length).toBeGreaterThan(0);
    const recommendationIds = body.recommendations.map((item: any) => item.course.id);
    const leaderIndex = recommendationIds.indexOf(310);
    const amplifiedIndex = recommendationIds.indexOf(311);
    expect(leaderIndex).toBeGreaterThanOrEqual(0);
    if (amplifiedIndex !== -1) {
      expect(leaderIndex).toBeLessThan(amplifiedIndex);
    }
    expect(recommendationIds[0]).not.toBe(311);
  });

  it("enforces final-card department diversity for unconstrained requests", async () => {
    const concentratedSet = [
      buildCourse({
        id: 401,
        code: "CS 401",
        title: "CS Data Systems I",
        description: "Data systems and modeling for software applications.",
        department: { id: 1, code: "CS", name: "Computer Science" },
      }),
      buildCourse({
        id: 402,
        code: "CS 402",
        title: "CS Data Systems II",
        description: "Advanced systems data methods and modeling.",
        department: { id: 1, code: "CS", name: "Computer Science" },
      }),
      buildCourse({
        id: 403,
        code: "CS 403",
        title: "CS Data Systems III",
        description: "Systems engineering with data projects.",
        department: { id: 1, code: "CS", name: "Computer Science" },
      }),
      buildCourse({
        id: 404,
        code: "QTM 404",
        title: "Data Inference Studio",
        description: "Data systems modeling and inference.",
        department: { id: 2, code: "QTM", name: "Quantitative Theory and Methods" },
      }),
      buildCourse({
        id: 405,
        code: "HIST 405",
        title: "Digital History Data",
        description: "Historical systems analysis using data methods.",
        department: { id: 3, code: "HIST", name: "History" },
      }),
      buildCourse({
        id: 406,
        code: "QTM 406",
        title: "Quantitative Systems Lab",
        description: "Data and systems labs with reproducible methods.",
        department: { id: 2, code: "QTM", name: "Quantitative Theory and Methods" },
      }),
      buildCourse({
        id: 407,
        code: "BIOL 407",
        title: "Biology Systems Analytics",
        description: "Biology systems and data analytics techniques.",
        department: { id: 4, code: "BIOL", name: "Biology" },
      }),
      buildCourse({
        id: 408,
        code: "ECON 408",
        title: "Economic Systems Data",
        description: "Economic systems analysis with data modeling.",
        department: { id: 5, code: "ECON", name: "Economics" },
      }),
    ];

    const concentratedSetWithPadding = padCoursesToMin(concentratedSet);
    vi.mocked(searchCourses).mockImplementation(
      async () => buildPageResult(concentratedSetWithPadding) as any
    );
    vi.mocked(listCourses).mockImplementation(
      async () => buildPageResult(concentratedSetWithPadding) as any
    );

    const { status, body } = await postRecommendation({
      prompt: "Recommend cs data systems classes.",
    });

    expect(status).toBe(200);
    expect(body.recommendations.length).toBeGreaterThan(0);
    const departments = body.recommendations.map((item: any) => item.course.department?.code ?? "OTHER");
    const earlyRecommendations = departments.slice(0, 4);
    expect(earlyRecommendations.filter((code: string) => code === "CS").length).toBeLessThanOrEqual(2);
    expect(new Set(earlyRecommendations).size).toBeGreaterThan(1);
    expect(body.debug.concentrationAllowed).toBe(false);
  });

  it("allows concentration when explicit department filters are active", async () => {
    const csOnly = [
      buildCourse({
        id: 501,
        code: "CS 501",
        title: "CS Systems Practicum",
        description: "Data systems practicum for CS majors.",
        department: { id: 1, code: "CS", name: "Computer Science" },
      }),
      buildCourse({
        id: 502,
        code: "CS 502",
        title: "CS Data Methods",
        description: "Data methods and systems optimization.",
        department: { id: 1, code: "CS", name: "Computer Science" },
      }),
      buildCourse({
        id: 503,
        code: "CS 503",
        title: "CS Modeling Lab",
        description: "Modeling and systems experimentation.",
        department: { id: 1, code: "CS", name: "Computer Science" },
      }),
      buildCourse({
        id: 504,
        code: "CS 504",
        title: "CS Applied Systems",
        description: "Applied systems and data engineering.",
        department: { id: 1, code: "CS", name: "Computer Science" },
      }),
    ];

    const csOnlyWithPadding = padCoursesToMin(csOnly);
    vi.mocked(searchCourses).mockImplementation(
      async () => buildPageResult(csOnlyWithPadding) as any
    );
    vi.mocked(listCourses).mockImplementation(
      async () => buildPageResult(csOnlyWithPadding) as any
    );

    const { status, body } = await postRecommendation({
      prompt: "Recommend cs data systems classes.",
      filters: { department: "CS" },
    });

    expect(status).toBe(200);
    expect(body.recommendations.length).toBeGreaterThan(0);
    expect(
      body.recommendations.every((item: any) => item.course.department?.code === "CS")
    ).toBe(true);
    expect(body.debug.concentrationAllowed).toBe(true);
  });

  it("returns low-relevance refine guidance with zero recommendations", async () => {
    const weakCatalog = [
      buildCourse({
        id: 601,
        code: "HIST 601",
        title: "Colonial Trade Routes",
        description: "Maritime exchange networks before industrialization.",
        department: { id: 3, code: "HIST", name: "History" },
      }),
      buildCourse({
        id: 602,
        code: "PHIL 602",
        title: "Ethics of Obligation",
        description: "Normative ethics and civic responsibility.",
        department: { id: 6, code: "PHIL", name: "Philosophy" },
      }),
      buildCourse({
        id: 603,
        code: "MUS 603",
        title: "Choral Traditions",
        description: "Performance practices in choral music.",
        department: { id: 7, code: "MUS", name: "Music" },
      }),
      buildCourse({
        id: 604,
        code: "REL 604",
        title: "Comparative Ritual Studies",
        description: "Ritual analysis across faith traditions.",
        department: { id: 8, code: "REL", name: "Religion" },
      }),
    ];

    const weakCatalogWithPadding = padCoursesToMin(weakCatalog);
    vi.mocked(searchCourses).mockImplementation(
      async () => buildPageResult(weakCatalogWithPadding) as any
    );
    vi.mocked(listCourses).mockImplementation(
      async () => buildPageResult(weakCatalogWithPadding) as any
    );

    const { status, body } = await postRecommendation({
      prompt: "Recommend astrophysics nanotechnology bioluminescence classes.",
    });
    const expected = buildLowRelevanceRefineGuidance({
      retrievalMode: "lexical_only",
      matchedTermCoverage: 0,
    });

    expect(status).toBe(200);
    expect(body.assistantMessage).toBe(expected.assistantMessage);
    expect(body.followUpQuestion).toBe(expected.followUpQuestion);
    expect(body.recommendations).toEqual([]);
    expect(body.debug.lowRelevanceRefineUsed).toBe(true);
    expect(body.debug.safeFallbackUsed).toBe(false);
    expect(body.debug.relevanceSufficient).toBe(false);
  });
});
