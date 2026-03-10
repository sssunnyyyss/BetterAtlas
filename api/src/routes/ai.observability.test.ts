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
import { env } from "../config/env.js";
import { openAiChatJson } from "../lib/openai.js";
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
import {
  getAiQualityTelemetrySnapshot,
  resetAiQualityTelemetryForTests,
} from "../ai/observability/aiQualityTelemetry.js";

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
    id: overrides.id ?? 170,
    code: overrides.code ?? "CS 170",
    title: overrides.title ?? "Intro to Computer Science",
    description:
      overrides.description ?? "Foundational computing concepts and problem solving.",
    prerequisites: overrides.prerequisites ?? null,
    credits: overrides.credits ?? 3,
    departmentId: overrides.departmentId ?? department.id,
    attributes: overrides.attributes ?? null,
    department,
    avgQuality: overrides.avgQuality ?? 4.2,
    avgDifficulty: overrides.avgDifficulty ?? 2.8,
    avgWorkload: overrides.avgWorkload ?? 2.9,
    reviewCount: overrides.reviewCount ?? 40,
    instructors: overrides.instructors ?? ["Ada Lovelace"],
    gers: overrides.gers ?? ["QR"],
    campuses: overrides.campuses ?? ["Atlanta"],
    requirements: overrides.requirements ?? null,
    classScore: overrides.classScore ?? 4.2,
  };
}

function buildPageResult(data: CourseWithRatings[]) {
  return {
    data,
    meta: { ...PAGE_META, total: data.length },
  };
}

function buildStrongCatalog(): CourseWithRatings[] {
  return [
    buildCourse({ id: 170, code: "CS 170", title: "Intro to Computer Science" }),
    buildCourse({
      id: 205,
      code: "HIST 205",
      title: "Modern Atlantic Worlds",
      departmentId: 2,
      department: { id: 2, code: "HIST", name: "History" },
      gers: ["HA"],
    }),
    buildCourse({
      id: 260,
      code: "QTM 260",
      title: "Data Modeling for Policy",
      departmentId: 3,
      department: { id: 3, code: "QTM", name: "Quantitative Theory and Methods" },
    }),
    buildCourse({
      id: 141,
      code: "BIOL 141",
      title: "Foundations of Biology I",
      departmentId: 4,
      department: { id: 4, code: "BIOL", name: "Biology" },
    }),
  ];
}

function buildWeakCatalog(): CourseWithRatings[] {
  return [
    buildCourse({
      id: 801,
      code: "MUS 801",
      title: "Choral Traditions",
      description: "Performance practices in choral music.",
      departmentId: 5,
      department: { id: 5, code: "MUS", name: "Music" },
    }),
    buildCourse({
      id: 802,
      code: "REL 802",
      title: "Comparative Ritual Studies",
      description: "Ritual analysis across faith traditions.",
      departmentId: 6,
      department: { id: 6, code: "REL", name: "Religion" },
    }),
    buildCourse({
      id: 803,
      code: "PHIL 803",
      title: "Ethics of Obligation",
      description: "Normative ethics and civic responsibility.",
      departmentId: 7,
      department: { id: 7, code: "PHIL", name: "Philosophy" },
    }),
    buildCourse({
      id: 804,
      code: "HIST 804",
      title: "Colonial Trade Routes",
      description: "Maritime exchange networks before industrialization.",
      departmentId: 2,
      department: { id: 2, code: "HIST", name: "History" },
    }),
  ];
}

function getCourseRecommendationsHandlers() {
  const layer = (aiRouter as any).stack.find(
    (entry: any) =>
      entry?.route?.path === "/ai/course-recommendations" && entry?.route?.methods?.post
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
  resetAiQualityTelemetryForTests();
  (env as any).nodeEnv = "test";

  vi.mocked(getUserById).mockResolvedValue(null as any);
  vi.mocked(openAiChatJson).mockResolvedValue({
    raw: JSON.stringify({
      assistant_message: "Try CS 170 Intro to Computer Science.",
      follow_up_question: null,
    }),
    parsed: {
      assistant_message: "Try CS 170 Intro to Computer Science.",
      follow_up_question: null,
    },
  });

  vi.mocked(listDepartments).mockResolvedValue([
    { id: 1, code: "CS", name: "Computer Science" },
    { id: 2, code: "HIST", name: "History" },
    { id: 3, code: "QTM", name: "Quantitative Theory and Methods" },
    { id: 4, code: "BIOL", name: "Biology" },
    { id: 5, code: "MUS", name: "Music" },
    { id: 6, code: "REL", name: "Religion" },
    { id: 7, code: "PHIL", name: "Philosophy" },
  ]);
  vi.mocked(getAllAiTrainerScores).mockResolvedValue(new Map<number, number>());
  vi.mocked(areCourseEmbeddingsAvailable).mockResolvedValue(false);
  vi.mocked(semanticSearchCoursesByEmbedding).mockResolvedValue([]);
  vi.mocked(searchCourses).mockImplementation(async () => buildPageResult(buildStrongCatalog()) as any);
  vi.mocked(listCourses).mockImplementation(async () => buildPageResult(buildStrongCatalog()) as any);
  vi.mocked(openAiEmbedText).mockResolvedValue([0.1, 0.2, 0.3]);
});

describe("POST /ai/course-recommendations observability", () => {
  it("records recommendation success telemetry and keeps aggregate schema production-safe", async () => {
    const promptText = "Recommend computer science data systems classes.";

    const { status, body } = await postRecommendation({
      prompt: promptText,
    });

    expect(status).toBe(200);
    expect(body.recommendations.length).toBeGreaterThan(0);
    expect(body.debug).toMatchObject({
      intentMode: "recommend",
      retrievalMode: "lexical_only",
      groundingStatus: "passed",
      safeFallbackUsed: false,
    });
    expect(Array.isArray(body.debug.rankingTopBreakdown)).toBe(true);

    const snapshot = getAiQualityTelemetrySnapshot();
    expect(snapshot.totalEvents).toBe(1);
    expect(snapshot.outcomeTypeCounts.recommendation_success).toBe(1);
    expect(snapshot.intentModeCounts.recommend).toBe(1);
    expect(snapshot.retrievalModeCounts.lexical_only).toBe(1);

    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toContain(promptText);
    expect(serialized).not.toContain("assistantMessage");
    expect(serialized).not.toContain("courseTitle");
  });

  it("records grounding fallback telemetry when the assistant references off-catalog courses", async () => {
    vi.mocked(openAiChatJson).mockResolvedValueOnce({
      raw: JSON.stringify({
        assistant_message: "Take MATH 999 Quantum Basket Weaving.",
        follow_up_question: null,
      }),
      parsed: {
        assistant_message: "Take MATH 999 Quantum Basket Weaving.",
        follow_up_question: null,
      },
    });

    const { status, body } = await postRecommendation({
      prompt: "Recommend classes for next semester.",
    });

    expect(status).toBe(200);
    expect(body.recommendations).toEqual([]);
    expect(body.debug.groundingStatus).toBe("failed");
    expect(body.debug.safeFallbackUsed).toBe(true);

    const snapshot = getAiQualityTelemetrySnapshot();
    expect(snapshot.totalEvents).toBe(1);
    expect(snapshot.outcomeTypeCounts.grounding_fallback).toBe(1);
    expect(snapshot.safeFallbackCounts.true).toBe(1);
    expect(snapshot.groundingStatusCounts.failed).toBe(1);
    expect(snapshot.groundingMismatchCounts.true).toBe(1);
  });

  it("records low-relevance refine telemetry when relevance gating blocks weak candidates", async () => {
    vi.mocked(openAiChatJson).mockResolvedValueOnce({
      raw: JSON.stringify({
        assistant_message: "I can help narrow your request.",
        follow_up_question: null,
      }),
      parsed: {
        assistant_message: "I can help narrow your request.",
        follow_up_question: null,
      },
    });
    vi.mocked(searchCourses).mockImplementation(async () => buildPageResult(buildWeakCatalog()) as any);
    vi.mocked(listCourses).mockImplementation(async () => buildPageResult(buildWeakCatalog()) as any);

    const { status, body } = await postRecommendation({
      prompt: "Recommend astrophysics nanotechnology bioluminescence classes.",
    });

    expect(status).toBe(200);
    expect(body.recommendations).toEqual([]);
    expect(body.debug.lowRelevanceRefineUsed).toBe(true);
    expect(body.debug.relevanceSufficient).toBe(false);

    const snapshot = getAiQualityTelemetrySnapshot();
    expect(snapshot.totalEvents).toBe(1);
    expect(snapshot.outcomeTypeCounts.low_relevance_refine).toBe(1);
    expect(snapshot.safeFallbackCounts.true).toBe(0);
    expect(snapshot.safeFallbackCounts.false).toBe(1);
  });

  it("records reset and route-error telemetry outcomes", async () => {
    const resetResponse = await postRecommendation({
      sessionId: "obs-reset-session",
      reset: true,
    });

    expect(resetResponse.status).toBe(200);
    expect(resetResponse.body.assistantMessage).toBe("AI memory cleared.");

    let snapshot = getAiQualityTelemetrySnapshot();
    expect(snapshot.totalEvents).toBe(1);
    expect(snapshot.outcomeTypeCounts.reset).toBe(1);
    expect(snapshot.retrievalModeCounts.none).toBe(1);

    resetAiQualityTelemetryForTests();
    vi.mocked(searchCourses).mockRejectedValueOnce(new Error("catalog service unavailable"));

    const errorResponse = await postRecommendation({
      prompt: "Recommend classes for me.",
    });

    expect(errorResponse.status).toBe(500);
    snapshot = getAiQualityTelemetrySnapshot();
    expect(snapshot.totalEvents).toBe(1);
    expect(snapshot.outcomeTypeCounts.route_error).toBe(1);
  });

  it("hides debug diagnostics in production responses while still recording telemetry", async () => {
    (env as any).nodeEnv = "production";

    const { status, body } = await postRecommendation({
      prompt: "Recommend computer science data systems classes.",
    });

    expect(status).toBe(200);
    expect(body.debug).toBeUndefined();

    const snapshot = getAiQualityTelemetrySnapshot();
    expect(snapshot.totalEvents).toBe(1);
    expect(snapshot.outcomeTypeCounts.route_error).toBe(0);
  });
});
