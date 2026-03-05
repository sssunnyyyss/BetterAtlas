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

const PAGE_META = { page: 1, limit: 1, total: 1, totalPages: 1 };

function buildSampleCourse(): CourseWithRatings {
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
  };
}

function buildPageResult() {
  return {
    data: [buildSampleCourse()],
    meta: PAGE_META,
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(getUserById).mockResolvedValue(null as any);
  vi.mocked(openAiChat).mockResolvedValue(
    "I hear you. We can talk through priorities before looking at classes.",
  );
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
  ]);
  vi.mocked(getAllAiTrainerScores).mockResolvedValue(new Map<number, number>());
  vi.mocked(areCourseEmbeddingsAvailable).mockResolvedValue(false);
  vi.mocked(semanticSearchCoursesByEmbedding).mockResolvedValue([]);
  vi.mocked(searchCourses).mockImplementation(async () => buildPageResult() as any);
  vi.mocked(listCourses).mockImplementation(async () => buildPageResult() as any);
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

async function postRecommendation(prompt: string) {
  const handlers = getCourseRecommendationsHandlers();
  const req = {
    method: "POST",
    url: "/ai/course-recommendations",
    path: "/ai/course-recommendations",
    body: { prompt },
    headers: {},
    user: undefined,
    ip: "127.0.0.1",
  };
  const res = createMockResponse();

  await runHandlers(handlers, req, res);

  return { status: res.statusCode, body: res.payload };
}

describe("POST /ai/course-recommendations intent routing", () => {
  it("returns a fast greeting response with no retrieval side effects", async () => {
    const { status, body } = await postRecommendation("hey");

    expect(status).toBe(200);
    expect(body.assistantMessage).toBe(
      "Hi. I can help with anything, including classes when you ask for course recommendations.",
    );
    expect(body.followUpQuestion).toBeNull();
    expect(body.recommendations).toEqual([]);
    expect(body.debug.intentMode).toBe("conversation");
    expect(body.debug.intentReason).toBe("trivial_greeting");
    expect(body.debug.retrievalSkipped).toBe(true);

    expect(openAiChat).not.toHaveBeenCalled();
    expect(openAiChatJson).not.toHaveBeenCalled();
    expect(listDepartments).not.toHaveBeenCalled();
    expect(getAllAiTrainerScores).not.toHaveBeenCalled();
    expect(searchCourses).not.toHaveBeenCalled();
    expect(listCourses).not.toHaveBeenCalled();
    expect(areCourseEmbeddingsAvailable).not.toHaveBeenCalled();
    expect(semanticSearchCoursesByEmbedding).not.toHaveBeenCalled();
    expect(openAiEmbedText).not.toHaveBeenCalled();
  });

  it("keeps general conversation in conversation mode without recommendation retrieval", async () => {
    const { status, body } = await postRecommendation(
      "I'm overwhelmed planning next semester.",
    );

    expect(status).toBe(200);
    expect(body.assistantMessage).toBe(
      "I hear you. We can talk through priorities before looking at classes.",
    );
    expect(body.followUpQuestion).toBeNull();
    expect(body.recommendations).toEqual([]);
    expect(body.debug.intentMode).toBe("conversation");
    expect(body.debug.retrievalSkipped).toBe(true);

    expect(openAiChat).toHaveBeenCalledTimes(1);
    expect(openAiChatJson).not.toHaveBeenCalled();
    expect(listDepartments).not.toHaveBeenCalled();
    expect(searchCourses).not.toHaveBeenCalled();
    expect(openAiEmbedText).not.toHaveBeenCalled();
  });

  it("routes ambiguous class asks to clarify mode with no recommendations", async () => {
    const { status, body } = await postRecommendation("Can you help me pick classes?");

    expect(status).toBe(200);
    expect(body.assistantMessage).toContain("I can help with that.");
    expect(typeof body.followUpQuestion).toBe("string");
    expect(body.followUpQuestion.length).toBeGreaterThan(0);
    expect(body.recommendations).toEqual([]);
    expect(body.debug.intentMode).toBe("clarify");
    expect(body.debug.retrievalSkipped).toBe(true);

    expect(openAiChat).not.toHaveBeenCalled();
    expect(openAiChatJson).not.toHaveBeenCalled();
    expect(listDepartments).not.toHaveBeenCalled();
    expect(searchCourses).not.toHaveBeenCalled();
    expect(openAiEmbedText).not.toHaveBeenCalled();
  });

  it("routes explicit recommendation asks to recommend mode and uses retrieval", async () => {
    const { status, body } = await postRecommendation(
      "Recommend 3 easy HA classes for Fall 2026.",
    );

    expect(status).toBe(200);
    expect(body.followUpQuestion).toBeNull();
    expect(Array.isArray(body.recommendations)).toBe(true);
    expect(body.recommendations.length).toBeGreaterThan(0);
    expect(body.recommendations[0].course.code).toBe("CS 170");
    expect(body.debug.intentMode).toBe("recommend");
    expect(body.debug.retrievalSkipped).toBe(false);

    expect(openAiChatJson).toHaveBeenCalledTimes(1);
    expect(listDepartments).toHaveBeenCalledTimes(1);
    expect(getAllAiTrainerScores).toHaveBeenCalledTimes(1);
    expect(searchCourses).toHaveBeenCalled();
    expect(listCourses).toHaveBeenCalled();
  });

  it("stays deterministic across repeated recommend invocations", async () => {
    const first = await postRecommendation("Recommend 3 easy HA classes for Fall 2026.");
    const second = await postRecommendation("Recommend 3 easy HA classes for Fall 2026.");

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body.debug.intentMode).toBe("recommend");
    expect(second.body.debug.intentMode).toBe("recommend");
    expect(first.body.recommendations).toEqual(second.body.recommendations);
  });
});
