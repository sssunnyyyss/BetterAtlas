import { useState, useEffect, useCallback, useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import type { ProgramTab } from "@betteratlas/shared";
import { api } from "../api/client.js";
import { useCourses, useCourseSearch } from "../hooks/useCourses.js";
import { useProgram, useProgramAiSummary, useProgramCourses, useProgramVariants } from "../hooks/usePrograms.js";
import Sidebar from "../components/layout/Sidebar.js";
import CourseFilters from "../components/course/CourseFilters.js";
import CourseGrid from "../components/course/CourseGrid.js";
import AiChat from "./AiChat.js";
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

const CATALOG_VIEW_STORAGE_KEY = "betteratlas.catalog.view.v2";

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
      return saved === "grid" ? "grid" : "list";
    } catch {
      return "list";
    }
  });

  // Sync debouncedSearch from URL on external navigation (e.g. deep-link).
  useEffect(() => {
    setDebouncedSearch(searchInput);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live search: narrow results as the user types/deletes.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 120);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // Keep search input in sync if the URL is changed externally (e.g. Home -> Catalog deep-link).
  useEffect(() => {
    // Only hydrate from URL when q is explicitly present.
    // This avoids wiping in-progress search text when other filters change.
    if (searchParams.has("q")) {
      const qFromUrl = searchParams.get("q") || "";
      setSearchInput((prev) => (prev === qFromUrl ? prev : qFromUrl));
      setDebouncedSearch((prev) => (prev === qFromUrl.trim() ? prev : qFromUrl.trim()));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

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
  const isProgramMode = programId > 0;
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
  const isSearching = debouncedSearch.length > 0;
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
    !isProgramMode
  );
  const searchResult = useCourseSearch(
    searchParamsWithFilters,
    !isProgramMode
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

  return (
    <div className="flex min-h-[calc(100vh-4rem)]" data-tour-id="catalog-search-filters">
      <Sidebar>
        <CourseFilters
          filters={filters}
          onChange={handleFilterChange}
          onSetQuery={(q) => {
            const v = q.trim();
            setSearchInput(v);
            setSearchParams((prev) => {
              if (v) prev.set("q", v);
              else prev.delete("q");
              prev.set("page", "1");
              return prev;
            });
          }}
        />
      </Sidebar>

      <main className="flex-1 p-4 sm:p-6">
        <div className="mb-3 flex items-center justify-start">
          <div
            className="ba-segmented"
            style={{
              ["--ba-segment-index" as any]: mode === "ai" ? 1 : 0,
              ["--ba-segments" as any]: 2,
            }}
          >
            <span className="ba-segmented-glider" aria-hidden="true" />
            <button
              type="button"
              onClick={() => setMode("search")}
              className={`ba-segmented-btn ba-segmented-btn-compact ${
                mode === "search" ? "ba-segmented-btn-active" : ""
              }`}
            >
              Catalog
            </button>
            <button
              type="button"
              onClick={() => setMode("ai")}
              className={`ba-segmented-btn ba-segmented-btn-compact ${
                mode === "ai" ? "ba-segmented-btn-active" : ""
              }`}
            >
              AI
            </button>
          </div>
        </div>

        {mode === "ai" ? (
          <div className="ba-ai-expand-in h-[calc(100vh-9rem)] w-full">
            <AiChat embedded />
          </div>
        ) : (
          <>
            {/* Search bar */}
            <div className="mb-6">
          <form
            className="flex w-full max-w-3xl gap-2 items-stretch"
            onSubmit={(e) => {
              e.preventDefault();
              const q = searchInput.trim();
              setSearchInput(q);
              setDebouncedSearch(q);
              setSearchParams((prev) => {
                if (q) prev.set("q", q);
                else prev.delete("q");
                prev.set("page", "1");
                return prev;
              });
            }}
          >
            <input
              type="text"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
              }}
              placeholder="Search by anything: course code, title, description, professor, department..."
              className="w-full rounded-full border text-sm px-5 py-2.5 shadow-sm transition-colors focus:outline-none focus:border-primary-500 border-gray-300 bg-white"
            />
            <button
              type="submit"
              className="shrink-0 px-5 rounded-full text-sm font-medium border transition-colors bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            >
              Search
            </button>
          </form>

          <div className="mt-2 max-w-3xl text-xs text-gray-600">
            <span className="font-semibold text-primary-700">Filters are hard constraints.</span>{" "}
            Set filters in the left panel first. Search will always stay within them.
          </div>

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
              ["--ba-segment-index" as any]: catalogView === "list" ? 0 : 1,
              ["--ba-segments" as any]: 2,
            }}
          >
            <span className="ba-segmented-glider" aria-hidden="true" />
            <button
              type="button"
              onClick={() => setCatalogView("list")}
              className={`ba-segmented-btn ba-segmented-btn-compact ${
                catalogView === "list" ? "ba-segmented-btn-active" : ""
              }`}
            >
              List
            </button>
            <button
              type="button"
              onClick={() => setCatalogView("grid")}
              className={`ba-segmented-btn ba-segmented-btn-compact ${
                catalogView === "grid" ? "ba-segmented-btn-active" : ""
              }`}
            >
              Cards
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
