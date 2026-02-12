import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useCourses, useCourseSearch } from "../hooks/useCourses.js";
import Sidebar from "../components/layout/Sidebar.js";
import CourseFilters from "../components/course/CourseFilters.js";
import CourseGrid from "../components/course/CourseGrid.js";

export default function Catalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(
    searchParams.get("q") || ""
  );
  const [debouncedSearch, setDebouncedSearch] = useState(searchInput);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

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
        prev.set("page", "1");
        return prev;
      });
    },
    [setSearchParams]
  );

  // Use search or browse
  const isSearching = debouncedSearch.length > 0;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const browseResult = useCourses({ ...filters, page: String(page) });
  const searchResult = useCourseSearch(debouncedSearch, page);

  const result = isSearching ? searchResult : browseResult;
  const courses = result.data?.data ?? [];
  const meta = result.data?.meta;

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <Sidebar>
        <CourseFilters filters={filters} onChange={handleFilterChange} />
      </Sidebar>

      <main className="flex-1 p-6">
        {/* Search bar */}
        <div className="mb-6">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              if (e.target.value) {
                setSearchParams((prev) => {
                  prev.set("q", e.target.value);
                  return prev;
                });
              } else {
                setSearchParams((prev) => {
                  prev.delete("q");
                  return prev;
                });
              }
            }}
            placeholder="Search courses by name, code, or description..."
            className="w-full max-w-xl rounded-lg border-gray-300 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500 px-4 py-2.5"
          />
        </div>

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
      </main>
    </div>
  );
}
