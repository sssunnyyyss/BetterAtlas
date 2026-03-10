import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import type { AiCourseRecommendation } from "../../../hooks/useAi.js";
import { ChatAssistantBlock } from "./ChatAssistantBlock.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function createRecommendation(
  overrides: Partial<AiCourseRecommendation> = {},
): AiCourseRecommendation {
  return {
    course: {
      id: 101,
      code: "CS 170",
      title: "Intro to Computer Science",
      description: "Introduction course",
      credits: 4,
      departmentId: 1,
      attributes: null,
      department: null,
      avgQuality: 4.2,
      avgDifficulty: 2.4,
      avgWorkload: 2.8,
      reviewCount: 120,
      classScore: 4.4,
    },
    fitScore: 9,
    why: [
      "Low workload compared to peer classes",
      "Strong instructor consistency",
      "Frequent availability in spring terms",
    ],
    cautions: [
      "Some sections fill quickly during registration week",
      "Group project pacing varies by instructor",
    ],
    ...overrides,
  };
}

function renderAssistantBlock(recommendations: AiCourseRecommendation[]) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);

  act(() => {
    root.render(
      <MemoryRouter>
        <ChatAssistantBlock
          content="Here are your best matches."
          recommendations={recommendations}
          prefersReducedMotion={false}
        />
      </MemoryRouter>,
    );
  });

  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe("ChatAssistantBlock recommendations", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders scan-first summary row and primary course details action", () => {
    const rec = createRecommendation();
    const view = renderAssistantBlock([rec]);

    try {
      expect(view.container.textContent).toContain("CS 170");
      expect(view.container.textContent).toContain("Intro to Computer Science");
      expect(view.container.textContent).toContain("Fit");
      expect(view.container.textContent).toContain("9/10");

      const detailLink = view.container.querySelector(
        `[data-testid="chat-recommendation-detail-link-${rec.course.id}"]`,
      ) as HTMLAnchorElement | null;
      expect(detailLink).not.toBeNull();
      expect(detailLink?.getAttribute("href")).toBe(`/catalog/${rec.course.id}`);
      expect(detailLink?.textContent).toContain("View course details");
    } finally {
      view.unmount();
    }
  });

  it("keeps rationale concise by default and reveals overflow + cautions on disclosure", () => {
    const rec = createRecommendation();
    const view = renderAssistantBlock([rec]);

    try {
      expect(view.container.textContent).toContain(rec.why[0]);
      expect(view.container.textContent).toContain(rec.why[1]);
      expect(view.container.textContent).not.toContain(rec.why[2]);
      expect(view.container.textContent).not.toContain(rec.cautions[0]);

      const reasonsToggle = view.container.querySelector(
        `[data-testid="chat-recommendation-why-more-${rec.course.id}"]`,
      ) as HTMLButtonElement | null;
      const cautionsToggle = view.container.querySelector(
        `[data-testid="chat-recommendation-cautions-${rec.course.id}"]`,
      ) as HTMLButtonElement | null;

      expect(reasonsToggle).not.toBeNull();
      expect(cautionsToggle).not.toBeNull();

      act(() => {
        reasonsToggle?.click();
      });
      expect(view.container.textContent).toContain(rec.why[2]);

      act(() => {
        cautionsToggle?.click();
      });
      expect(view.container.textContent).toContain(rec.cautions[0]);
      expect(view.container.textContent).toContain(rec.cautions[1]);
    } finally {
      view.unmount();
    }
  });

  it("omits caution disclosure controls when no cautions exist", () => {
    const rec = createRecommendation({ course: { ...createRecommendation().course, id: 202 }, cautions: [] });
    const view = renderAssistantBlock([rec]);

    try {
      expect(
        view.container.querySelector(
          `[data-testid="chat-recommendation-cautions-${rec.course.id}"]`,
        ),
      ).toBeNull();
    } finally {
      view.unmount();
    }
  });
});
