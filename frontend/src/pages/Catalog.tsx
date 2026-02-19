import { useState, useEffect, useCallback, startTransition, useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import type { ProgramTab } from "@betteratlas/shared";
import { api } from "../api/client.js";
import { useCourses, useCourseSearch } from "../hooks/useCourses.js";
import { useProgram, useProgramAiSummary, useProgramCourses, useProgramVariants } from "../hooks/usePrograms.js";
import {
  useAiCourseRecommendations,
  type AiCourseRecommendation,
  type AiMessage,
  type AiPreferenceCourse,
  type AiRecommendationFilters,
} from "../hooks/useAi.js";
import Sidebar from "../components/layout/Sidebar.js";
import CourseFilters from "../components/course/CourseFilters.js";
import CourseGrid from "../components/course/CourseGrid.js";
import {
  isSpecialTopicsCourse,
  splitSpecialTopicCourses,
  type CourseTopicDetail,
} from "../lib/courseTopics.js";

function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ThumbUpIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.82 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" />
    </svg>
  );
}

function ThumbDownIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M15 3H6c-.82 0-1.54.5-1.84 1.22L1.14 11.27c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.58-6.59c.37-.36.59-.86.59-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z" />
    </svg>
  );
}

const AI_PREFS_STORAGE_KEY = "betteratlas.ai.preferences.v1";
const CATALOG_VIEW_STORAGE_KEY = "betteratlas.catalog.view.v1";
const FILTER_LABELS: Partial<Record<keyof AiRecommendationFilters, string>> = {
  semester: "Semester",
  department: "Department",
  minRating: "Min rating",
  credits: "Credits",
  attributes: "GER",
  instructor: "Instructor",
  campus: "Campus",
  componentType: "Component",
  instructionMethod: "Instruction method",
};

function truncate(value: string, max: number) {
  if (value.length <= max) return value;
  return value.slice(0, max);
}

function makePreferenceSnapshot(course: AiCourseRecommendation["course"]): AiPreferenceCourse {
  const clampList = (items: string[] | undefined, itemMax: number, countMax: number) =>
    (items ?? []).map((v) => truncate(String(v), itemMax)).slice(0, countMax);

  return {
    id: course.id,
    code: truncate(course.code, 80),
    title: truncate(course.title, 600),
    department: course.department?.code ? truncate(course.department.code, 40) : null,
    gers: clampList(course.gers, 40, 20),
    campuses: clampList(course.campuses, 120, 20),
    instructors: clampList(course.instructors, 240, 20),
    description: course.description ? truncate(course.description, 8000) : null,
  };
}

function buildAiFilters(rawFilters: Record<string, string>): AiRecommendationFilters {
  const toNum = (v: string | undefined) => {
    const trimmed = String(v ?? "").trim();
    if (!trimmed) return undefined;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : undefined;
  };

  const out: AiRecommendationFilters = {};
  const semester = rawFilters.semester?.trim();
  const department = rawFilters.department?.trim();
  const minRating = toNum(rawFilters.minRating);
  const credits = toNum(rawFilters.credits);
  const attributes = rawFilters.attributes?.trim();
  const instructor = rawFilters.instructor?.trim();
  const campus = rawFilters.campus?.trim();
  const componentType = rawFilters.componentType?.trim();
  const instructionMethod = rawFilters.instructionMethod?.trim();

  if (semester) out.semester = semester;
  if (department) out.department = department;
  if (typeof minRating === "number") out.minRating = minRating;
  if (typeof credits === "number") out.credits = credits;
  if (attributes) out.attributes = attributes;
  if (instructor) out.instructor = instructor;
  if (campus) out.campus = campus;
  if (componentType) out.componentType = componentType;
  if (instructionMethod) out.instructionMethod = instructionMethod;

  return out;
}

export default function Catalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialMode =
    searchParams.get("mode") === "ai" || searchParams.get("ai") === "1"
      ? "ai"
      : "search";
  const [mode, setMode] = useState<"search" | "ai">(initialMode);
  const [searchInput, setSearchInput] = useState(searchParams.get("q") || "");
  const [debouncedSearch, setDebouncedSearch] = useState(searchInput);
  const [catalogView, setCatalogView] = useState<"grid" | "list">(() => {
    try {
      const saved = localStorage.getItem(CATALOG_VIEW_STORAGE_KEY);
      return saved === "list" ? "list" : "grid";
    } catch {
      return "grid";
    }
  });

  const [aiInput, setAiInput] = useState(searchParams.get("prompt") || "");
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([]);
  const aiRec = useAiCourseRecommendations();
  const [aiAllRecs, setAiAllRecs] = useState<AiCourseRecommendation[]>([]);
  const [likedPreferenceCourses, setLikedPreferenceCourses] = useState<AiPreferenceCourse[]>([]);
  const [dislikedPreferenceCourses, setDislikedPreferenceCourses] = useState<AiPreferenceCourse[]>(
    []
  );

  // Sync debouncedSearch from URL on external navigation (e.g. deep-link).
  useEffect(() => {
    if (mode !== "search") return;
    setDebouncedSearch(searchInput);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Live search: narrow results as the user types/deletes.
  useEffect(() => {
    if (mode !== "search") return;
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 120);
    return () => window.clearTimeout(timer);
  }, [mode, searchInput]);

  // Keep mode in sync if the URL is changed externally (e.g. Home -> Catalog deep-link).
  useEffect(() => {
    const urlMode =
      searchParams.get("mode") === "ai" || searchParams.get("ai") === "1"
        ? "ai"
        : "search";
    setMode((prev) => (prev === urlMode ? prev : urlMode));
    if (urlMode === "ai") {
      const prompt = searchParams.get("prompt") || "";
      setAiInput((prev) => (prev === prompt ? prev : prompt));
    } else {
      // Only hydrate from URL when q is explicitly present.
      // This avoids wiping in-progress search text when other filters change.
      if (searchParams.has("q")) {
        const qFromUrl = searchParams.get("q") || "";
        setSearchInput((prev) => (prev === qFromUrl ? prev : qFromUrl));
        setDebouncedSearch((prev) => (prev === qFromUrl.trim() ? prev : qFromUrl.trim()));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(AI_PREFS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        liked?: AiPreferenceCourse[];
        disliked?: AiPreferenceCourse[];
      };
      setLikedPreferenceCourses(Array.isArray(parsed?.liked) ? parsed.liked.slice(0, 40) : []);
      setDislikedPreferenceCourses(
        Array.isArray(parsed?.disliked) ? parsed.disliked.slice(0, 40) : []
      );
    } catch {
      // Ignore invalid local preference cache.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        AI_PREFS_STORAGE_KEY,
        JSON.stringify({
          liked: likedPreferenceCourses.slice(0, 40),
          disliked: dislikedPreferenceCourses.slice(0, 40),
        })
      );
    } catch {
      // Ignore storage failures.
    }
  }, [likedPreferenceCourses, dislikedPreferenceCourses]);

  useEffect(() => {
    try {
      localStorage.setItem(CATALOG_VIEW_STORAGE_KEY, catalogView);
    } catch {
      // Ignore storage failures.
    }
  }, [catalogView]);

  // Build filters from URL (everything except the free-text search param "q")
  const filters: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    if (key !== "q") filters[key] = value;
  }

  const programId = parseInt(searchParams.get("programId") || "0", 10) || 0;
  const programTab = (searchParams.get("programTab") as ProgramTab | null) || "required";
  const isProgramMode = mode === "search" && programId > 0;
  const programIdForQueries = isProgramMode ? programId : 0;

  const programQuery = useProgram(programIdForQueries);
  const program = programQuery.data;
  const variantsQuery = useProgramVariants(programIdForQueries);
  const variants = variantsQuery.data;
  const aiSummaryQuery = useProgramAiSummary(programIdForQueries);
  const aiSummary = aiSummaryQuery.data;

  useEffect(() => {
    if (!isProgramMode) return;
    if (searchParams.get("programTab")) return;
    setSearchParams((prev) => {
      prev.set("programTab", "required");
      return prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProgramMode]);

  const handleFilterChange = useCallback(
    (key: string, value: string) => {
      setSearchParams((prev) => {
        if (value) {
          prev.set(key, value);
        } else {
          prev.delete(key);
        }
        // Reset pagination when changing filters/search, but not when changing the page itself.
        if (key !== "page") prev.set("page", "1");
        return prev;
      });
    },
    [setSearchParams]
  );

  // Use search or browse (or program mode)
  const isSearching = mode === "search" && debouncedSearch.length > 0;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const searchParamsWithFilters: Record<string, string> = {
    ...filters,
    q: debouncedSearch.trim(),
    page: String(page),
  };
  delete searchParamsWithFilters.mode;
  delete searchParamsWithFilters.ai;
  delete searchParamsWithFilters.prompt;
  delete searchParamsWithFilters.programId;
  delete searchParamsWithFilters.programTab;
  if (!searchParamsWithFilters.q) delete searchParamsWithFilters.q;

  const browseResult = useCourses(
    { ...filters, page: String(page) },
    mode === "search" && !isProgramMode
  );
  const searchResult = useCourseSearch(
    searchParamsWithFilters,
    mode === "search" && !isProgramMode
  );

  const programParams: Record<string, string> = { ...filters, page: String(page) };
  delete programParams.programId;
  delete programParams.programTab;
  delete programParams.mode;
  delete programParams.ai;
  delete programParams.prompt;
  delete programParams.department;
  if (debouncedSearch.trim()) programParams.q = debouncedSearch.trim();
  else delete programParams.q;

  const programResult = useProgramCourses(programId, programTab, programParams);

  const result = isProgramMode ? programResult : isSearching ? searchResult : browseResult;
  const baseCourses = result.data?.data ?? [];
  const meta = result.data?.meta;

  const specialTopicCourseIds = useMemo(() => {
    const out: number[] = [];
    const seen = new Set<number>();

    for (const course of baseCourses) {
      if (!isSpecialTopicsCourse(course)) continue;
      if (seen.has(course.id)) continue;
      seen.add(course.id);
      out.push(course.id);
    }

    return out;
  }, [baseCourses]);

  const specialTopicDetailQueries = useQueries({
    queries: specialTopicCourseIds.map((courseId) => ({
      queryKey: ["course", courseId, "catalog-special-topics"] as const,
      queryFn: () => api.get<CourseTopicDetail>(`/courses/${courseId}`),
      enabled: mode === "search",
      staleTime: 5 * 60 * 1000,
    })),
  });

  const specialTopicDetailsByCourseId = useMemo(() => {
    const byCourseId = new Map<number, CourseTopicDetail>();

    for (let i = 0; i < specialTopicCourseIds.length; i++) {
      const courseId = specialTopicCourseIds[i];
      const detail = specialTopicDetailQueries[i]?.data;
      if (!detail) continue;
      byCourseId.set(courseId, detail);
    }

    return byCourseId;
  }, [specialTopicCourseIds, specialTopicDetailQueries]);

  const courses = useMemo(
    () =>
      splitSpecialTopicCourses(baseCourses, specialTopicDetailsByCourseId, {
        semester: filters.semester,
      }),
    [baseCourses, specialTopicDetailsByCourseId, filters.semester]
  );

  const isAiMode = mode === "ai";
  const aiData = aiRec.data;
  const displayedRecs = aiAllRecs.length > 0 ? aiAllRecs : aiData?.recommendations ?? [];
  const aiRequestFilters = buildAiFilters(filters);
  const hardFilterSummary = Object.entries(aiRequestFilters)
    .map(([key, value]) => {
      const typedKey = key as keyof AiRecommendationFilters;
      if (value === undefined || value === null || String(value).trim() === "") return null;
      const label = FILTER_LABELS[typedKey] ?? key;
      return `${label}: ${String(value)}`;
    })
    .filter(Boolean)
    .join(" • ");
  const aiDebug = (aiData as any)?.debug as
    | {
        model?: string;
        totalMs?: number;
        depsMs?: number;
        candidatesMs?: number;
        embedMs?: number;
        semanticMs?: number;
        openaiMs?: number;
        searchTerms?: string[];
        candidateCount?: number;
        hadFillers?: boolean;
        userMajor?: string | null;
        deptCode?: string | null;
        searchUniqueCount?: number;
        semanticUniqueCount?: number;
        candidatesWithDescription?: number;
        deptCounts?: Record<string, number>;
        appliedFilters?: Record<string, string | number>;
        likedSignals?: number;
        dislikedSignals?: number;
      }
    | undefined;

  function setModeAndUrl(next: "search" | "ai") {
    if (next === mode) return;
    setMode(next);
    aiRec.reset();
    setAiMessages([]);
    setAiAllRecs([]);
    // Let the segmented toggle animate first, then sync URL as a transition.
    window.requestAnimationFrame(() => {
      startTransition(() => {
        setSearchParams((prev) => {
          const nextParams = new URLSearchParams(prev);
          if (next === "ai") {
            nextParams.set("mode", "ai");
            nextParams.delete("q");
            nextParams.delete("page");
          } else {
            nextParams.delete("mode");
            nextParams.delete("ai");
            nextParams.delete("prompt");
          }
          return nextParams;
        });
      });
    });
  }

  function resetAiChat() {
    setAiMessages([]);
    setAiInput("");
    aiRec.reset();
    setAiAllRecs([]);
    setSearchParams((prev) => {
      prev.set("mode", "ai");
      prev.delete("prompt");
      return prev;
    });
    // Clear server-side per-user memory so results don't "stick" across users/sessions.
    aiRec.mutate({ reset: true });
  }

  function clearAiTrainingData() {
    setLikedPreferenceCourses([]);
    setDislikedPreferenceCourses([]);
  }

  function markCoursePreference(course: AiCourseRecommendation["course"], verdict: "liked" | "disliked") {
    const snap = makePreferenceSnapshot(course);
    if (verdict === "liked") {
      setLikedPreferenceCourses((cur) => {
        const map = new Map<number, AiPreferenceCourse>(cur.map((c) => [c.id, c]));
        map.set(snap.id, snap);
        return Array.from(map.values()).slice(-40);
      });
      setDislikedPreferenceCourses((cur) => cur.filter((c) => c.id !== snap.id));
    } else {
      setDislikedPreferenceCourses((cur) => {
        const map = new Map<number, AiPreferenceCourse>(cur.map((c) => [c.id, c]));
        map.set(snap.id, snap);
        return Array.from(map.values()).slice(-40);
      });
      setLikedPreferenceCourses((cur) => cur.filter((c) => c.id !== snap.id));
    }
  }

  async function runAi(prompt: string) {
    const trimmed = prompt.trim();
    if (!trimmed) return;

    const nextMessages = [...aiMessages, { role: "user" as const, content: trimmed }].slice(
      -12
    );
    setAiMessages(nextMessages);
    setSearchParams((prev) => {
      prev.set("mode", "ai");
      prev.set("prompt", trimmed);
      return prev;
    });

    aiRec.mutate(
      {
        messages: nextMessages,
        filters: aiRequestFilters,
        preferences: {
          liked: likedPreferenceCourses,
          disliked: dislikedPreferenceCourses,
        },
      },
      {
        onSuccess: (r) => {
          setAiAllRecs(r.recommendations);
          const assistantContent = [
            r.assistantMessage,
            r.followUpQuestion ? `Follow-up: ${r.followUpQuestion}` : "",
          ]
            .filter(Boolean)
            .join("\n\n");
          setAiMessages((cur) =>
            [...cur, { role: "assistant" as const, content: assistantContent }].slice(-12)
          );
        },
      }
    );
  }

  function generateMoreAiCourses() {
    if (aiRec.isPending) return;
    if (aiMessages.length === 0) return;

    const excludeCourseIds = displayedRecs
      .map((r) => r.course.id)
      .filter((id) => Number.isFinite(id))
      .slice(-200);

    aiRec.mutate(
      {
        messages: aiMessages,
        excludeCourseIds,
        filters: aiRequestFilters,
        preferences: {
          liked: likedPreferenceCourses,
          disliked: dislikedPreferenceCourses,
        },
      },
      {
        onSuccess: (r) => {
          setAiAllRecs((cur) => {
            const seen = new Set<number>(cur.map((x) => x.course.id));
            const out = [...cur];
            for (const rec of r.recommendations) {
              if (seen.has(rec.course.id)) continue;
              out.push(rec);
              seen.add(rec.course.id);
            }
            return out;
          });
        },
      }
    );
  }

  // Auto-run if deep-linked with mode=ai&prompt=...
  useEffect(() => {
    if (!isAiMode) return;
    const prompt = (searchParams.get("prompt") || "").trim();
    if (!prompt) return;
    if (aiMessages.length > 0) return; // already ran in this session
    runAi(prompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAiMode]);

  return (
    <div className="flex min-h-[calc(100vh-4rem)]" data-tour-id="catalog-search-filters">
      <Sidebar>
        <CourseFilters
          filters={filters}
          onChange={handleFilterChange}
          onSetQuery={(q) => {
            const v = q.trim();
            setMode("search");
            setSearchInput(v);
            setSearchParams((prev) => {
              prev.delete("mode");
              prev.delete("ai");
              prev.delete("prompt");
              if (v) prev.set("q", v);
              else prev.delete("q");
              prev.set("page", "1");
              return prev;
            });
          }}
        />
      </Sidebar>

      <main className="flex-1 p-4 sm:p-6">
        {/* Search bar */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <div
              className="ba-segmented"
              style={{ ["--ba-segment-index" as any]: mode === "ai" ? 1 : 0, ["--ba-segments" as any]: 2 }}
            >
              <span className="ba-segmented-glider" aria-hidden="true" />
              <button
                type="button"
                onClick={() => setModeAndUrl("search")}
                className={`ba-segmented-btn ${mode === "search" ? "ba-segmented-btn-active" : ""}`}
              >
                Search
              </button>
              <button
                type="button"
                onClick={() => setModeAndUrl("ai")}
                data-tour-id="catalog-ai-entry"
                className={`ba-segmented-btn ${mode === "ai" ? "ba-segmented-btn-active" : ""}`}
              >
                Ask AI
              </button>
            </div>
            {mode === "ai" && (
              <>
                <span className="text-xs text-gray-500">
                  One-shot counselor mode (you can follow up).
                </span>
                <span className="text-xs text-gray-500">
                  Training: {likedPreferenceCourses.length} liked / {dislikedPreferenceCourses.length} disliked
                </span>
                <button
                  type="button"
                  onClick={resetAiChat}
                  className="text-xs font-medium text-gray-500 hover:text-gray-700 underline underline-offset-2"
                >
                  New chat
                </button>
                <button
                  type="button"
                  onClick={clearAiTrainingData}
                  className="text-xs font-medium text-gray-500 hover:text-gray-700 underline underline-offset-2"
                >
                  Clear training
                </button>
              </>
            )}
          </div>

          <form
            className="flex w-full max-w-3xl gap-2 items-stretch"
            onSubmit={(e) => {
              e.preventDefault();
              if (mode === "ai") runAi(aiInput);
              else {
                const q = searchInput.trim();
                setSearchInput(q);
                setDebouncedSearch(q);
                setSearchParams((prev) => {
                  if (q) prev.set("q", q);
                  else prev.delete("q");
                  prev.set("page", "1");
                  return prev;
                });
              }
            }}
          >
            <input
              type="text"
              value={mode === "ai" ? aiInput : searchInput}
              onChange={(e) => {
                const v = e.target.value;
                if (mode === "ai") {
                  setAiInput(v);
                } else {
                  setSearchInput(v);
                }
              }}
              placeholder={
                mode === "ai"
                  ? 'Tell me your goals: "I want a chill writing class", "I like neuroscience + philosophy", ...'
                  : "Search by anything: course code, title, description, professor, department..."
              }
              className={`w-full rounded-full border text-sm px-5 py-2.5 shadow-sm transition-colors focus:outline-none focus:border-primary-500 ${
                mode === "ai"
                  ? "border-primary-300 bg-primary-50/30 shadow-[0_14px_38px_rgba(0,40,120,0.14)]"
                  : "border-gray-300 bg-white"
              }`}
            />
            <button
              type="submit"
              disabled={mode === "ai" && aiRec.isPending}
              className={`shrink-0 px-5 rounded-full text-sm font-medium border transition-colors ${
                mode === "ai"
                  ? "bg-primary-600 text-white border-primary-600 hover:bg-primary-700 disabled:opacity-60"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {mode === "ai" ? (
                <span className="inline-flex items-center gap-2">
                  {aiRec.isPending && <Spinner className="text-white/90" />}
                  {aiRec.isPending ? "Asking..." : "Ask"}
                </span>
              ) : (
                "Search"
              )}
            </button>
          </form>

          <div className="mt-2 max-w-3xl text-xs text-gray-600">
            <span className="font-semibold text-primary-700">Filters are hard constraints.</span>{" "}
            {hardFilterSummary
              ? `Current filters: ${hardFilterSummary}. Search and AI only show courses inside these filters.`
              : "Set filters in the left panel first. Search and AI will always stay within them."}
          </div>

          {mode === "ai" && (
            <div className="mt-3 max-w-3xl rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm text-amber-900">
                AI results can be inaccurate. Verify important details with{" "}
                <a
                  href="https://atlas.emory.edu/"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium underline underline-offset-2 hover:text-amber-950"
                >
                  Emory&apos;s Course Atlas
                </a>
                . Known bugs include occasional issues with cross-listed classes.
              </p>
            </div>
          )}

          {isProgramMode && (
            <div className="mt-4 max-w-3xl">
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900">
                      AI Summary: {program ? `${program.name}` : "Program"}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Based on the catalog requirements text (may miss "approved elective" lists).
                    </div>
                  </div>
                  {aiSummaryQuery.isLoading && (
                    <div className="shrink-0 text-gray-500">
                      <Spinner />
                    </div>
                  )}
                </div>

                {aiSummaryQuery.isError && (
                  <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                    {(aiSummaryQuery.error as any)?.message || "Failed to load AI summary"}
                  </div>
                )}

                {!aiSummaryQuery.isError && aiSummary && (
                  <div className="mt-3 space-y-2">
                    {aiSummary.summary && (
                      <p className="text-sm text-gray-700">{aiSummary.summary}</p>
                    )}
                    {aiSummary.highlights && aiSummary.highlights.length > 0 && (
                      <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
                        {aiSummary.highlights.slice(0, 7).map((h, i) => (
                          <li key={i}>{h}</li>
                        ))}
                      </ul>
                    )}
                    {!aiSummary.available && !aiSummary.summary && (
                      <div className="text-sm text-gray-500">
                        AI summary is not available on this server.
                      </div>
                    )}
                    {aiSummary.sourceUrl && (
                      <a
                        href={aiSummary.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2"
                      >
                        View in Emory catalog
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {mode === "ai" ? (
          <>
            {aiRec.isError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4 text-sm">
                {(aiRec.error as any)?.message || "AI request failed"}
              </div>
            )}

            {aiRec.isPending && (
              <div className="mb-5">
                <div className="bg-white rounded-lg border border-primary-200 p-4 flex items-center gap-3">
                  <div className="shrink-0">
                    <div className="h-9 w-9 rounded-full bg-primary-50 border border-primary-200 flex items-center justify-center text-primary-700">
                      <Spinner className="text-primary-700" />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900">BetterAtlas AI</div>
                    <div className="text-sm text-gray-700">
                      Thinking... scanning course titles and descriptions.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {aiData && (
              <div className="mb-5">
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="text-sm font-semibold text-gray-900 mb-1">BetterAtlas AI</div>
                  <p className="text-sm text-gray-700 whitespace-pre-line">
                    {aiData.assistantMessage}
                  </p>
                  {aiData.followUpQuestion && (
                    <p className="text-sm text-gray-700 mt-3">
                      <span className="font-semibold text-gray-900">Follow-up:</span>{" "}
                      {aiData.followUpQuestion}
                    </p>
                  )}
                </div>
              </div>
            )}

            {aiDebug?.totalMs != null && (
              <div className="mb-4 text-xs text-gray-500">
                AI timings: {Math.round(aiDebug.totalMs)}ms total
                {aiDebug.candidatesMs != null
                  ? `, ${Math.round(aiDebug.candidatesMs)}ms catalog`
                  : ""}
                {aiDebug.embedMs != null ? `, ${Math.round(aiDebug.embedMs)}ms embed` : ""}
                {aiDebug.semanticMs != null ? `, ${Math.round(aiDebug.semanticMs)}ms semantic` : ""}
                {aiDebug.openaiMs != null ? `, ${Math.round(aiDebug.openaiMs)}ms OpenAI` : ""}
                {aiDebug.model ? ` (${aiDebug.model})` : ""}
                {aiDebug.searchTerms && aiDebug.searchTerms.length > 0
                  ? ` | terms: ${aiDebug.searchTerms.join(", ")}`
                  : ""}
                {aiDebug.appliedFilters &&
                Object.keys(aiDebug.appliedFilters).length > 0
                  ? ` | filters: ${Object.entries(aiDebug.appliedFilters)
                      .map(([k, v]) => `${k}=${String(v)}`)
                      .join(", ")}`
                  : ""}
                {aiDebug.candidateCount != null ? ` | candidates: ${aiDebug.candidateCount}` : ""}
                {aiDebug.semanticUniqueCount != null
                  ? ` | semantic: ${aiDebug.semanticUniqueCount}`
                  : ""}
                {aiDebug.candidatesWithDescription != null && aiDebug.candidateCount != null
                  ? ` | desc: ${aiDebug.candidatesWithDescription}/${aiDebug.candidateCount}`
                  : ""}
                {aiDebug.likedSignals != null || aiDebug.dislikedSignals != null
                  ? ` | prefs: ${aiDebug.likedSignals ?? 0}/${aiDebug.dislikedSignals ?? 0}`
                  : ""}
                {aiDebug.hadFillers != null ? ` | fillers: ${aiDebug.hadFillers ? "yes" : "no"}` : ""}
                {aiDebug.deptCode ? ` | deptHint: ${aiDebug.deptCode}` : ""}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayedRecs.map((rec) => (
                <div
                  key={rec.course.id}
                  className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md hover:border-primary-300 transition-all"
                >
                  <Link to={`/catalog/${rec.course.id}`} className="block">
                    <div className="flex justify-between items-start gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-primary-600">
                            {rec.course.code}
                          </span>
                          {rec.course.credits && (
                            <span className="text-xs text-gray-400">{rec.course.credits} cr</span>
                          )}
                          <span className="text-xs text-gray-400">Fit {rec.fitScore}/10</span>
                        </div>
                        <h3 className="font-medium text-gray-900 mt-0.5 truncate">
                          {rec.course.title}
                        </h3>
                        {rec.course.instructors && rec.course.instructors.length > 0 && (
                          <div className="text-xs text-gray-500 mt-0.5 truncate">
                            {rec.course.instructors.slice(0, 2).join(", ")}
                            {rec.course.instructors.length > 2
                              ? ` +${rec.course.instructors.length - 2}`
                              : ""}
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>

                  <div className="mt-3">
                    <div className="text-xs font-semibold text-gray-700 mb-1">Why</div>
                    <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
                      {rec.why.slice(0, 4).map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                    {rec.cautions.length > 0 && (
                      <>
                        <div className="text-xs font-semibold text-gray-700 mt-3 mb-1">
                          Watch-outs
                        </div>
                        <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
                          {rec.cautions.slice(0, 2).map((c, i) => (
                            <li key={i}>{c}</li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => markCoursePreference(rec.course, "liked")}
                      aria-label={`Thumbs up for ${rec.course.code} ${rec.course.title}`}
                      title="Thumbs up"
                      className={`inline-flex items-center justify-center h-8 w-8 rounded-full border transition-colors ${
                        likedPreferenceCourses.some((c) => c.id === rec.course.id)
                          ? "bg-green-600 text-white border-green-600"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <ThumbUpIcon />
                    </button>
                    <button
                      type="button"
                      onClick={() => markCoursePreference(rec.course, "disliked")}
                      aria-label={`Thumbs down for ${rec.course.code} ${rec.course.title}`}
                      title="Thumbs down"
                      className={`inline-flex items-center justify-center h-8 w-8 rounded-full border transition-colors ${
                        dislikedPreferenceCourses.some((c) => c.id === rec.course.id)
                          ? "bg-red-600 text-white border-red-600"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <ThumbDownIcon />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {displayedRecs.length > 0 && (
              <div className="flex justify-center mt-6">
                <button
                  type="button"
                  onClick={generateMoreAiCourses}
                  disabled={aiRec.isPending || aiMessages.length === 0}
                  className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-60"
                >
                  <span className="inline-flex items-center gap-2">
                    {aiRec.isPending && <Spinner className="text-gray-600" />}
                    Generate more
                  </span>
                </button>
              </div>
            )}

            {aiRec.isPending && !aiData && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-lg border border-gray-200 p-4" aria-hidden="true">
                    <div className="animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                      <div className="h-5 bg-gray-200 rounded w-5/6 mb-3" />
                      <div className="h-3 bg-gray-200 rounded w-2/3 mb-2" />
                      <div className="h-3 bg-gray-200 rounded w-3/5 mb-2" />
                      <div className="h-3 bg-gray-200 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!aiData && (
              <div className="text-sm text-gray-500">
                Toggle "Ask AI", describe what you want, and hit Ask.
              </div>
            )}
          </>
        ) : (
          <>
            {isProgramMode && (
              <div className="flex items-center gap-2 mb-4">
                {variants && variants.majors.length > 0 && variants.minors.length > 0 && (
                  <div
                    className="ba-segmented mr-2"
                    style={{
                      ["--ba-segment-index" as any]: program?.kind === "minor" ? 1 : 0,
                      ["--ba-segments" as any]: 2,
                    }}
                  >
                    <span className="ba-segmented-glider" aria-hidden="true" />
                    <button
                      type="button"
                      onClick={() => {
                        if (program?.kind === "major") return;
                        const pick = [...variants.majors].sort((a, b) => {
                          const ad = (a.degree || "").toUpperCase();
                          const bd = (b.degree || "").toUpperCase();
                          const rank = (d: string) =>
                            d === "BA" ? 0 : d === "BS" ? 1 : d ? 2 : 3;
                          return rank(ad) - rank(bd) || ad.localeCompare(bd) || a.id - b.id;
                        })[0];
                        if (pick) handleFilterChange("programId", String(pick.id));
                      }}
                      className={`ba-segmented-btn ba-segmented-btn-compact ${
                        program?.kind === "major" ? "ba-segmented-btn-active" : ""
                      }`}
                    >
                      Major
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (program?.kind === "minor") return;
                        const pick = [...variants.minors].sort((a, b) => a.id - b.id)[0];
                        if (pick) handleFilterChange("programId", String(pick.id));
                      }}
                      className={`ba-segmented-btn ba-segmented-btn-compact ${
                        program?.kind === "minor" ? "ba-segmented-btn-active" : ""
                      }`}
                    >
                      Minor
                    </button>
                  </div>
                )}
                <div
                  className="ba-segmented"
                  style={{
                    ["--ba-segment-index" as any]: programTab === "electives" ? 1 : 0,
                    ["--ba-segments" as any]: 2,
                  }}
                >
                  <span className="ba-segmented-glider" aria-hidden="true" />
                  <button
                    type="button"
                    onClick={() => handleFilterChange("programTab", "required")}
                    className={`ba-segmented-btn ba-segmented-btn-compact ${
                      programTab === "required" ? "ba-segmented-btn-active" : ""
                    }`}
                  >
                    Required
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFilterChange("programTab", "electives")}
                    className={`ba-segmented-btn ba-segmented-btn-compact ${
                      programTab === "electives" ? "ba-segmented-btn-active" : ""
                    }`}
                  >
                    Electives
                  </button>
                </div>
                {debouncedSearch.trim() && (
                  <span className="text-xs text-gray-500 ml-2">
                    Filtering within {programTab} for "{debouncedSearch.trim()}"
                  </span>
                )}
              </div>
            )}

            <div className="mb-4 flex flex-wrap items-center gap-3">
              {meta && (
                <p className="text-sm text-gray-500">
                  {meta.total} course{meta.total !== 1 ? "s" : ""} found
                  {!isProgramMode && isSearching && ` for "${debouncedSearch}"`}
                </p>
              )}

              <div
                className="ml-auto ba-segmented"
                style={{
                  ["--ba-segment-index" as any]: catalogView === "list" ? 1 : 0,
                  ["--ba-segments" as any]: 2,
                }}
              >
                <span className="ba-segmented-glider" aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => setCatalogView("grid")}
                  className={`ba-segmented-btn ba-segmented-btn-compact ${
                    catalogView === "grid" ? "ba-segmented-btn-active" : ""
                  }`}
                >
                  Cards
                </button>
                <button
                  type="button"
                  onClick={() => setCatalogView("list")}
                  className={`ba-segmented-btn ba-segmented-btn-compact ${
                    catalogView === "list" ? "ba-segmented-btn-active" : ""
                  }`}
                >
                  List
                </button>
              </div>
            </div>

            <CourseGrid courses={courses} isLoading={result.isLoading} view={catalogView} />

            {/* Pagination */}
            {meta && meta.totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-8">
                <button
                  disabled={page <= 1}
                  onClick={() => handleFilterChange("page", String(page - 1))}
                  className="px-3 py-1.5 text-sm rounded-md border border-gray-300 disabled:opacity-50 hover:bg-gray-50"
                >
                  Previous
                </button>
                <span className="px-3 py-1.5 text-sm text-gray-600">
                  Page {page} of {meta.totalPages}
                </span>
                <button
                  disabled={page >= meta.totalPages}
                  onClick={() => handleFilterChange("page", String(page + 1))}
                  className="px-3 py-1.5 text-sm rounded-md border border-gray-300 disabled:opacity-50 hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
