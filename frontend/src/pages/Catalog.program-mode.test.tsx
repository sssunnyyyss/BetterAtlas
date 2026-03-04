import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type {
  CourseWithRatings,
  ProgramAiRequirementsSummary,
  ProgramSummary,
  ProgramTab,
} from "@betteratlas/shared";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Catalog from "./Catalog.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const hooks = vi.hoisted(() => ({
  useProgram: vi.fn(),
  useProgramAiSummary: vi.fn(),
  useProgramCourses: vi.fn(),
  useCourses: vi.fn(),
  useCourseSearch: vi.fn(),
}));

vi.mock("../hooks/usePrograms.js", () => ({
  useProgram: hooks.useProgram,
  useProgramAiSummary: hooks.useProgramAiSummary,
  useProgramCourses: hooks.useProgramCourses,
}));

vi.mock("../hooks/useCourses.js", () => ({
  useCourses: hooks.useCourses,
  useCourseSearch: hooks.useCourseSearch,
}));

vi.mock("../components/layout/Sidebar.js", () => ({
  default: ({ children }: { children: unknown }) => <>{children}</>,
}));

vi.mock("./AiChat.js", () => ({
  default: () => <div data-testid="mock-ai-chat">AI chat</div>,
}));

vi.mock("../components/course/CourseFilters.js", () => ({
  default: ({ onChange }: { onChange: (key: string, value: string) => void }) => (
    <button
      type="button"
      data-testid="select-program"
      onClick={() => {
        onChange("programId", "201");
        onChange("programTab", "required");
      }}
    >
      Select Program
    </button>
  ),
}));

vi.mock("../components/course/CourseGrid.js", () => ({
  default: ({ courses }: { courses: Array<{ virtualKey?: string; id: number; code: string }> }) => (
    <ol data-testid="course-order">
      {courses.map((course) => (
        <li
          key={course.virtualKey ?? String(course.id)}
          data-testid="course-item"
          data-course-code={course.code}
        >
          {course.code}
        </li>
      ))}
    </ol>
  ),
}));

const PROGRAMS_BY_ID: Record<number, ProgramSummary> = {
  201: { id: 201, name: "Chemistry", kind: "major", degree: "BS" },
  202: { id: 202, name: "Chemistry", kind: "major", degree: "BA" },
  301: { id: 301, name: "Chemistry", kind: "minor", degree: null },
  302: { id: 302, name: "Chemistry", kind: "minor", degree: "BS" },
};

function createCourse(
  id: number,
  code: string,
  title: string,
  description: string
): CourseWithRatings {
  return {
    id,
    code,
    title,
    description,
    credits: 3,
    departmentId: null,
    attributes: null,
    department: null,
    avgQuality: null,
    avgDifficulty: null,
    avgWorkload: null,
    reviewCount: 0,
  };
}

function queryResult<T>(data: T) {
  return {
    data,
    isLoading: false,
    isError: false,
    error: null,
  };
}

let currentCourses: CourseWithRatings[] = [];
let currentAiSummary: ProgramAiRequirementsSummary | undefined;

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
}

function renderCatalog(initialEntry: string) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter
          initialEntries={[initialEntry]}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Routes>
            <Route
              path="/catalog"
              element={
                <>
                  <Catalog />
                  <LocationProbe />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  });

  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
      queryClient.clear();
    },
  };
}

function getButton(container: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find(
    (candidate) => candidate.textContent?.trim() === label
  );
  if (!button) throw new Error(`Expected button "${label}"`);
  return button as HTMLButtonElement;
}

function getLocationSearch(container: HTMLElement): string {
  return container.querySelector('[data-testid="location-search"]')?.textContent ?? "";
}

function getCourseOrder(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('[data-testid="course-item"]')).map(
    (item) => item.getAttribute("data-course-code") ?? ""
  );
}

async function click(button: HTMLButtonElement) {
  await act(async () => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

async function waitFor(assertion: () => void, timeoutMs = 1500) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      assertion();
      return;
    } catch {
      await act(async () => {
        await Promise.resolve();
      });
    }
  }
  assertion();
}

describe("Catalog program mode regressions", () => {
  beforeEach(() => {
    currentCourses = [
      createCourse(1, "BIO 101", "Intro Biology", "Foundational biology concepts"),
      createCourse(2, "QTM 110", "Quantitative Methods", "Data modeling and quantitative analysis"),
      createCourse(3, "CHEM 150", "General Chemistry", "Core chemistry principles"),
    ];
    currentAiSummary = undefined;

    hooks.useProgram.mockReset();
    hooks.useProgramAiSummary.mockReset();
    hooks.useProgramCourses.mockReset();
    hooks.useCourses.mockReset();
    hooks.useCourseSearch.mockReset();

    hooks.useProgram.mockImplementation((programId: number) =>
      queryResult(programId > 0 ? PROGRAMS_BY_ID[programId] : undefined)
    );
    hooks.useProgramAiSummary.mockImplementation((programId: number) =>
      queryResult(programId > 0 ? currentAiSummary : undefined)
    );
    hooks.useProgramCourses.mockImplementation((programId: number, tab: ProgramTab) =>
      queryResult(
        programId > 0
          ? {
              data: currentCourses,
              meta: { page: 1, limit: 20, total: currentCourses.length, totalPages: 1 },
              tab,
            }
          : undefined
      )
    );
    hooks.useCourses.mockReturnValue(
      queryResult({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } })
    );
    hooks.useCourseSearch.mockReturnValue(
      queryResult({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } })
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("selects program mode and uses Main/Elective tabs without a Major/Minor toggle", async () => {
    const view = renderCatalog("/catalog");
    try {
      await click(getButton(view.container, "Select Program"));
      await waitFor(() => {
        expect(getLocationSearch(view.container)).toContain("programId=201");
        expect(getLocationSearch(view.container)).toContain("programTab=required");
      });

      expect(() => getButton(view.container, "Major")).toThrow();
      expect(() => getButton(view.container, "Minor")).toThrow();

      await click(getButton(view.container, "Elective"));
      await waitFor(() => {
        expect(getLocationSearch(view.container)).toContain("programTab=electives");
      });

      await click(getButton(view.container, "Main"));
      await waitFor(() => {
        expect(getLocationSearch(view.container)).toContain("programTab=required");
      });
    } finally {
      view.unmount();
    }
  });

  it("canonicalizes invalid or missing programTab to required for deep links and refresh behavior", async () => {
    const invalidView = renderCatalog("/catalog?programId=201&programTab=invalid");
    try {
      await waitFor(() => {
        expect(getLocationSearch(invalidView.container)).toContain("programTab=required");
      });
      const invalidTabCalls = hooks.useProgramCourses.mock.calls;
      expect(invalidTabCalls.some((call) => call[1] === "required")).toBe(true);
    } finally {
      invalidView.unmount();
    }

    const missingView = renderCatalog("/catalog?programId=201");
    try {
      await waitFor(() => {
        expect(getLocationSearch(missingView.container)).toContain("programTab=required");
      });
      const missingTabCalls = hooks.useProgramCourses.mock.calls;
      expect(missingTabCalls.some((call) => call[1] === "required")).toBe(true);
    } finally {
      missingView.unmount();
    }
  });

  it("applies AI-summary relevance ordering deterministically across rerenders", async () => {
    currentAiSummary = {
      programId: 201,
      requirementsHash: "hash",
      available: true,
      summary: "Quantitative and data-heavy coursework is emphasized.",
      highlights: ["data modeling", "quantitative analysis"],
      model: "test-model",
      updatedAt: "2026-02-26T00:00:00Z",
      sourceUrl: "https://catalog.example/chemistry",
    };

    const firstRender = renderCatalog("/catalog?programId=201&programTab=required");
    let firstOrder: string[] = [];
    try {
      await waitFor(() => {
        const order = getCourseOrder(firstRender.container);
        expect(order.length).toBe(3);
      });
      firstOrder = getCourseOrder(firstRender.container);
      expect(firstOrder[0]).toBe("QTM 110");
    } finally {
      firstRender.unmount();
    }

    const secondRender = renderCatalog("/catalog?programId=201&programTab=required");
    try {
      await waitFor(() => {
        const order = getCourseOrder(secondRender.container);
        expect(order.length).toBe(3);
      });
      const secondOrder = getCourseOrder(secondRender.container);
      expect(secondOrder).toEqual(firstOrder);
    } finally {
      secondRender.unmount();
    }
  });
});
