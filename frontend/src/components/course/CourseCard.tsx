import { Link, useLocation } from "react-router-dom";
import RatingBadge from "./RatingBadge.js";
import GerPills from "./GerPills.js";
import type { CatalogCourseEntry } from "../../lib/courseTopics.js";
import { buildCourseDetailSearch } from "../../lib/courseTopics.js";

interface CourseCardProps {
  course: CatalogCourseEntry;
  view?: "grid" | "list";
}

function enrollmentTone(percent: number) {
  if (percent >= 95) return "border-red-200 bg-red-50 text-red-700";
  if (percent >= 80) return "border-amber-200 bg-amber-50 text-amber-700";
  if (percent >= 60) return "border-yellow-200 bg-yellow-50 text-yellow-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

export default function CourseCard({ course, view = "grid" }: CourseCardProps) {
  const location = useLocation();
  const instructors = course.instructors ?? [];
  const semester = new URLSearchParams(location.search).get("semester");
  const detailSearch = buildCourseDetailSearch({
    semester,
    topic: course.topic ?? null,
    sectionId: course.sectionId ?? null,
  });
  const displayTitle = (() => {
    const base = String(course.title ?? "").trim();
    const topic = String(course.topic ?? "").trim();
    if (!topic) return base;

    const baseKey = base.toLocaleLowerCase();
    const topicKey = topic.toLocaleLowerCase();
    if (baseKey.includes(topicKey)) return base;

    return `${base.replace(/[:\s]+$/g, "")}: ${topic}`;
  })();
  const avgEnrollmentPercent =
    typeof course.avgEnrollmentPercent === "number" && Number.isFinite(course.avgEnrollmentPercent)
      ? Math.round(course.avgEnrollmentPercent)
      : null;

  if (view === "list") {
    return (
      <Link
        to={`/catalog/${course.id}${detailSearch}`}
        className="block bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-primary-300 transition-all"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-sm font-semibold text-primary-600">{course.code}</span>
              {course.credits && <span className="text-xs text-gray-400">{course.credits} cr</span>}
              {course.department?.code && (
                <span className="text-xs text-gray-500">{course.department.code}</span>
              )}
              {avgEnrollmentPercent !== null && (
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${enrollmentTone(
                    avgEnrollmentPercent
                  )}`}
                >
                  {avgEnrollmentPercent}% enrolled
                </span>
              )}
            </div>

            <h3 className="font-semibold text-gray-900 mt-1">{displayTitle}</h3>

            {instructors.length > 0 && (
              <div className="text-xs text-gray-500 mt-1 truncate">
                {instructors.slice(0, 3).join(", ")}
                {instructors.length > 3 ? ` +${instructors.length - 3}` : ""}
              </div>
            )}

            <div className="mt-2">
              <GerPills gers={course.gers} />
            </div>

            {course.description && (
              <p className="text-sm text-gray-600 mt-2 line-clamp-2">{course.description}</p>
            )}
          </div>

          <div className="hidden sm:flex gap-2 shrink-0">
            <RatingBadge value={course.classScore ?? null} label="Class" />
            <RatingBadge value={course.avgDifficulty} label="Diff" />
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-xs text-gray-400">
            {course.reviewCount} review{course.reviewCount !== 1 ? "s" : ""}
          </span>
          <div className="sm:hidden flex gap-2">
            <RatingBadge value={course.classScore ?? null} label="Class" />
            <RatingBadge value={course.avgDifficulty} label="Diff" />
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      to={`/catalog/${course.id}${detailSearch}`}
      className="block bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md hover:border-primary-300 transition-all"
    >
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-primary-600">
              {course.code}
            </span>
            {course.credits && (
              <span className="text-xs text-gray-400">
                {course.credits} cr
              </span>
            )}
            {avgEnrollmentPercent !== null && (
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${enrollmentTone(
                  avgEnrollmentPercent
                )}`}
              >
                {avgEnrollmentPercent}% enrolled
              </span>
            )}
          </div>
          <h3 className="font-medium text-gray-900 mt-0.5 truncate">
            {displayTitle}
          </h3>
          {instructors.length > 0 && (
            <div className="text-xs text-gray-500 mt-0.5 truncate">
              {instructors.slice(0, 2).join(", ")}
              {instructors.length > 2 ? ` +${instructors.length - 2}` : ""}
            </div>
          )}
          <GerPills gers={course.gers} />
        </div>
        <div className="flex gap-2 shrink-0">
          <RatingBadge value={course.classScore ?? null} label="Class" />
          <RatingBadge value={course.avgDifficulty} label="Diff" />
        </div>
      </div>
      {course.description && (
        <p className="text-sm text-gray-600 mt-2 line-clamp-2">
          {course.description}
        </p>
      )}
      <div className="flex items-center gap-2 mt-2">
        <span className="text-xs text-gray-400">
          {course.reviewCount} review{course.reviewCount !== 1 ? "s" : ""}
        </span>
      </div>
    </Link>
  );
}
