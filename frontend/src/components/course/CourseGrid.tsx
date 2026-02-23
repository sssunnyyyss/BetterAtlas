import { Link } from "react-router-dom";
import CourseCard from "./CourseCard.js";
import { formatRating, getDifficultyColor, getRatingColor } from "../../lib/utils.js";
import type { CatalogCourseEntry } from "../../lib/courseTopics.js";
import { buildCourseDetailSearch } from "../../lib/courseTopics.js";
import { gradeColor, gradeLabelFromPoints } from "../../lib/grade.js";

interface CourseGridProps {
  courses: CatalogCourseEntry[];
  isLoading?: boolean;
  view?: "grid" | "list";
}

export default function CourseGrid({ courses, isLoading, view = "grid" }: CourseGridProps) {
  const isList = view === "list";
  const listGridCols = "grid-cols-[120px_1.6fr_76px_96px_1.4fr_70px_70px_70px]";

  function detailPathForCourse(course: CatalogCourseEntry) {
    const detailSearch = buildCourseDetailSearch({
      topic: course.topic ?? null,
      sectionId: course.sectionId ?? null,
    });
    return `/catalog/${course.id}${detailSearch}`;
  }

  function displayTitle(course: CatalogCourseEntry) {
    return course.title;
  }

  function ratingCell(
    value: number | null | undefined,
    mode: "default" | "difficulty" = "default"
  ) {
    const normalized = typeof value === "number" && Number.isFinite(value) ? value : null;
    const color = mode === "difficulty" ? getDifficultyColor(normalized) : getRatingColor(normalized);
    const hasRating = normalized !== null;
    return (
      <span
        className="flex h-full min-h-9 items-center justify-center px-1.5 py-1 text-xs font-semibold tabular-nums"
        style={{
          color: hasRating ? "#111827" : "#4b5563",
          backgroundColor: hasRating ? `${color}4D` : "#f3f4f6",
        }}
      >
        {formatRating(normalized)}
      </span>
    );
  }

  function gradeCell(points: number | null | undefined) {
    const normalized = typeof points === "number" && Number.isFinite(points) ? points : null;
    const label = gradeLabelFromPoints(normalized);
    const color = gradeColor(normalized);
    return (
      <span
        className="flex h-full min-h-9 items-center justify-center px-1.5 py-1 text-xs font-semibold tabular-nums"
        style={{
          color: normalized === null ? "#4b5563" : "#111827",
          backgroundColor: normalized === null ? "#f3f4f6" : `${color}4D`,
        }}
      >
        {label ?? "N/A"}
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
          <div
            className={`grid ${listGridCols} border-b border-gray-200 bg-gray-50 text-[11px] font-semibold uppercase tracking-wide text-gray-600`}
          >
            <span className="px-3 py-2">Code</span>
            <span className="px-3 py-2">Title</span>
            <span className="px-3 py-2">Credits</span>
            <span className="px-3 py-2">Enrolled</span>
            <span className="px-3 py-2">Instructor</span>
            <span className="px-3 py-2 text-center">Class</span>
            <span className="px-3 py-2 text-center">Diff</span>
            <span className="px-3 py-2 text-center">Grade</span>
          </div>

          {courses.map((course) => (
            <Link
              key={course.virtualKey ?? String(course.id)}
              to={detailPathForCourse(course)}
              className={`group grid ${listGridCols} border-b border-gray-100 text-sm text-gray-700 transition-colors hover:bg-primary-50/50 last:border-b-0`}
            >
              <span className="truncate px-3 py-2 font-semibold text-primary-700">{course.code}</span>
              <span className="truncate px-3 py-2 font-medium text-gray-900">{displayTitle(course)}</span>
              <span className="px-3 py-2 text-gray-600">{course.credits ?? "—"}</span>
              <span
                className={`px-3 py-2 tabular-nums font-medium ${enrollmentTone(course.avgEnrollmentPercent)}`}
              >
                {formatEnrollment(course.avgEnrollmentPercent)}
              </span>
              <span className="truncate px-3 py-2 text-gray-600">
                {formatInstructors(course.instructors)}
              </span>
              {ratingCell(course.classScore ?? null)}
              {ratingCell(course.avgDifficulty, "difficulty")}
              {gradeCell(course.avgGradePoints ?? null)}
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
