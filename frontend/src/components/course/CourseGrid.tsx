import { Link, useLocation } from "react-router-dom";
import CourseCard from "./CourseCard.js";
import { formatRating, getDifficultyColor, getRatingColor } from "../../lib/utils.js";
import type { CatalogCourseEntry } from "../../lib/courseTopics.js";
import { buildCourseDetailSearch } from "../../lib/courseTopics.js";

interface CourseGridProps {
  courses: CatalogCourseEntry[];
  isLoading?: boolean;
  view?: "grid" | "list";
}

export default function CourseGrid({ courses, isLoading, view = "grid" }: CourseGridProps) {
  const isList = view === "list";
  const location = useLocation();
  const semester = new URLSearchParams(location.search).get("semester");

  function detailPathForCourse(course: CatalogCourseEntry) {
    const detailSearch = buildCourseDetailSearch({
      semester,
      topic: course.topic ?? null,
      sectionId: course.sectionId ?? null,
    });
    return `/catalog/${course.id}${detailSearch}`;
  }

  function displayTitle(course: CatalogCourseEntry) {
    return course.title;
  }

  function ratingBlock(
    value: number | null | undefined,
    mode: "default" | "difficulty" = "default"
  ) {
    const normalized = typeof value === "number" && Number.isFinite(value) ? value : null;
    const color = mode === "difficulty" ? getDifficultyColor(normalized) : getRatingColor(normalized);
    return (
      <span
        className="inline-flex min-w-11 items-center justify-center rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums"
        style={{ color, backgroundColor: `${color}1A`, border: `1px solid ${color}55` }}
      >
        {formatRating(normalized)}
      </span>
    );
  }

  function formatInstructors(list: string[] | undefined) {
    const instructors = list ?? [];
    if (instructors.length === 0) return "—";
    const shown = instructors.slice(0, 2).join(", ");
    return instructors.length > 2 ? `${shown} +${instructors.length - 2}` : shown;
  }

  function formatEnrollment(value: number | null | undefined) {
    if (typeof value !== "number" || Number.isNaN(value)) return "—";
    return `${Math.round(value)}%`;
  }

  function enrollmentTone(value: number | null | undefined) {
    if (typeof value !== "number" || Number.isNaN(value)) return "text-gray-500";
    if (value >= 95) return "text-red-700";
    if (value >= 80) return "text-amber-700";
    if (value >= 60) return "text-yellow-700";
    return "text-emerald-700";
  }

  if (isLoading) {
    return (
      <div className={isList ? "space-y-1" : "grid grid-cols-1 md:grid-cols-2 gap-4"}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={`bg-white border border-gray-200 p-4 animate-pulse ${
              isList ? "rounded-md" : "rounded-lg"
            }`}
          >
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-2" />
            <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
            <div className="h-3 bg-gray-200 rounded w-1/2 mb-3" />
            <div className="h-4 bg-gray-200 rounded w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No courses found. Try adjusting your filters.
      </div>
    );
  }

  if (isList) {
    return (
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <div className="min-w-[980px]">
          <div className="grid grid-cols-[120px_1.6fr_80px_100px_1.4fr_80px_80px_80px] items-center gap-3 border-b border-gray-200 bg-gray-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
            <span>Code</span>
            <span>Title</span>
            <span>Credits</span>
            <span>Enrolled</span>
            <span>Instructor</span>
            <span>Class</span>
            <span>Diff</span>
            <span>Reviews</span>
          </div>

          {courses.map((course) => (
            <Link
              key={course.virtualKey ?? String(course.id)}
              to={detailPathForCourse(course)}
              className="grid grid-cols-[120px_1.6fr_80px_100px_1.4fr_80px_80px_80px] items-center gap-3 border-b border-gray-100 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-primary-50/50 last:border-b-0"
            >
              <span className="font-semibold text-primary-700 truncate">{course.code}</span>
              <span className="truncate font-medium text-gray-900">{displayTitle(course)}</span>
              <span className="text-gray-600">{course.credits ?? "—"}</span>
              <span className={`tabular-nums font-medium ${enrollmentTone(course.avgEnrollmentPercent)}`}>
                {formatEnrollment(course.avgEnrollmentPercent)}
              </span>
              <span className="truncate text-gray-600">{formatInstructors(course.instructors)}</span>
              <span>{ratingBlock(course.classScore ?? null)}</span>
              <span>{ratingBlock(course.avgDifficulty, "difficulty")}</span>
              <span className="tabular-nums text-gray-600">{course.reviewCount}</span>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {courses.map((course) => (
      <CourseCard key={course.virtualKey ?? String(course.id)} course={course} view={view} />
      ))}
    </div>
  );
}
