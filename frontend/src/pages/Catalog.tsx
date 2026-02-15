import { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useCourses, useCourseSearch } from "../hooks/useCourses.js";
import { useAiCourseRecommendations, type AiMessage } from "../hooks/useAi.js";
import Sidebar from "../components/layout/Sidebar.js";
import CourseFilters from "../components/course/CourseFilters.js";
import CourseGrid from "../components/course/CourseGrid.js";

export default function Catalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialMode =
    searchParams.get("mode") === "ai" || searchParams.get("ai") === "1"
      ? "ai"
      : "search";
  const [mode, setMode] = useState<"search" | "ai">(initialMode);
  const [searchInput, setSearchInput] = useState(
    searchParams.get("q") || ""
  );
  const [debouncedSearch, setDebouncedSearch] = useState(searchInput);

  const [aiInput, setAiInput] = useState(searchParams.get("prompt") || "");
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([]);
  const aiRec = useAiCourseRecommendations();

  // Debounce search
  useEffect(() => {
    if (mode !== "search") return;
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput, mode]);

  // Keep mode in sync if the URL is changed externally (e.g. Home -> Catalog deep-link).
  useEffect(() => {
    const urlMode =
      searchParams.get("mode") === "ai" || searchParams.get("ai") === "1"
        ? "ai"
        : "search";
    setMode(urlMode);
    if (urlMode === "ai") {
      const prompt = searchParams.get("prompt") || "";
      setAiInput(prompt);
    } else {
      setSearchInput(searchParams.get("q") || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  // Build filters from URL
  const filters: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    if (key !== "q") filters[key] = value;
  }

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

  // Use search or browse
  const isSearching = mode === "search" && debouncedSearch.length > 0;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const browseResult = useCourses({ ...filters, page: String(page) }, mode === "search");
  const searchResult = useCourseSearch(debouncedSearch, page, mode === "search");

  const result = isSearching ? searchResult : browseResult;
  const courses = result.data?.data ?? [];
  const meta = result.data?.meta;

  const isAiMode = mode === "ai";
  const aiData = aiRec.data;

  function setModeAndUrl(next: "search" | "ai") {
    setMode(next);
    setSearchParams((prev) => {
      if (next === "ai") {
        prev.set("mode", "ai");
        prev.delete("q");
        prev.delete("page");
      } else {
        prev.delete("mode");
        prev.delete("ai");
        prev.delete("prompt");
      }
      return prev;
    });
    aiRec.reset();
    setAiMessages([]);
  }

  function resetAiChat() {
    setAiMessages([]);
    setAiInput("");
    aiRec.reset();
    setSearchParams((prev) => {
      prev.set("mode", "ai");
      prev.delete("prompt");
      return prev;
    });
    // Clear server-side per-user memory so results don't "stick" across users/sessions.
    aiRec.mutate({ reset: true });
  }

  async function runAi(prompt: string) {
    const trimmed = prompt.trim();
    if (!trimmed) return;

    setAiMessages((cur) => [...cur, { role: "user", content: trimmed }]);
    setSearchParams((prev) => {
      prev.set("mode", "ai");
      prev.set("prompt", trimmed);
      return prev;
    });

    aiRec.mutate(
      { prompt: trimmed },
      {
        onSuccess: (r) => {
          const assistantContent = [
            r.assistantMessage,
            r.followUpQuestion ? `Follow-up: ${r.followUpQuestion}` : "",
          ]
            .filter(Boolean)
            .join("\n\n");
          setAiMessages((cur) => [...cur, { role: "assistant", content: assistantContent }]);
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
    <div className="flex min-h-[calc(100vh-4rem)]">
      <Sidebar>
        <CourseFilters filters={filters} onChange={handleFilterChange} />
      </Sidebar>

      <main className="flex-1 p-6">
        {/* Search bar */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
              <button
                type="button"
                onClick={() => setModeAndUrl("search")}
                className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                  mode === "search"
                    ? "bg-primary-600 text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                Search
              </button>
              <button
                type="button"
                onClick={() => setModeAndUrl("ai")}
                className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                  mode === "ai"
                    ? "bg-primary-600 text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                Ask AI
              </button>
            </div>
            {mode === "ai" && (
              <>
                <span className="text-xs text-gray-500">
                  One-shot counselor mode (you can follow up).
                </span>
                <button
                  type="button"
                  onClick={resetAiChat}
                  className="text-xs font-medium text-gray-500 hover:text-gray-700 underline underline-offset-2"
                >
                  New chat
                </button>
              </>
            )}
          </div>

          <form
            className="flex gap-2 items-stretch"
            onSubmit={(e) => {
              e.preventDefault();
              if (mode === "ai") runAi(aiInput);
              else {
                // In search mode, the list is reactive, but submitting still resets paging.
                setSearchParams((prev) => {
                  if (searchInput) prev.set("q", searchInput);
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
                  if (v) {
                    setSearchParams((prev) => {
                      prev.set("q", v);
                      prev.set("page", "1");
                      return prev;
                    });
                  } else {
                    setSearchParams((prev) => {
                      prev.delete("q");
                      prev.set("page", "1");
                      return prev;
                    });
                  }
                }
              }}
              placeholder={
                mode === "ai"
                  ? 'Tell me your goals: "I want a chill writing class", "I like neuroscience + philosophy", ...'
                  : "Search by anything: course code, title, description, professor, department..."
              }
              className={`w-full max-w-3xl rounded-lg border text-sm px-4 py-2.5 shadow-sm transition-shadow focus:outline-none focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 ${
                mode === "ai"
                  ? "border-primary-300 ring-2 ring-primary-500/20 shadow-[0_22px_72px_rgba(37,99,235,0.20)]"
                  : "border-gray-300"
              }`}
            />
            <button
              type="submit"
              disabled={mode === "ai" && aiRec.isPending}
              className={`shrink-0 px-4 rounded-lg text-sm font-medium border transition-colors ${
                mode === "ai"
                  ? "bg-primary-600 text-white border-primary-600 hover:bg-primary-700 disabled:opacity-60"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {mode === "ai" ? (aiRec.isPending ? "Asking…" : "Ask") : "Search"}
            </button>
          </form>
        </div>

        {mode === "ai" ? (
          <>
            {aiRec.isError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4 text-sm">
                {(aiRec.error as any)?.message || "AI request failed"}
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {aiData?.recommendations?.map((rec) => (
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
                            <span className="text-xs text-gray-400">
                              {rec.course.credits} cr
                            </span>
                          )}
                          <span className="text-xs text-gray-400">
                            Fit {rec.fitScore}/10
                          </span>
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
                </div>
              ))}
            </div>

            {!aiData && (
              <div className="text-sm text-gray-500">
                Toggle “Ask AI”, describe what you want, and hit Ask.
              </div>
            )}
          </>
        ) : (
          <>
        {/* Results count */}
        {meta && (
          <p className="text-sm text-gray-500 mb-4">
            {meta.total} course{meta.total !== 1 ? "s" : ""} found
            {isSearching && ` for "${debouncedSearch}"`}
          </p>
        )}

        <CourseGrid courses={courses} isLoading={result.isLoading} />

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
