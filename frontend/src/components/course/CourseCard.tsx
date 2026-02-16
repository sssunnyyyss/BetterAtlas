import { Link, useLocation } from "react-router-dom";
import type { CourseWithRatings } from "@betteratlas/shared";
import RatingBadge from "./RatingBadge.js";
import GerPills from "./GerPills.js";

interface CourseCardProps {
  course: CourseWithRatings;
}

export default function CourseCard({ course }: CourseCardProps) {
  const location = useLocation();
  const instructors = course.instructors ?? [];
  const semester = new URLSearchParams(location.search).get("semester");
  const detailSearch = semester ? `?semester=${encodeURIComponent(semester)}` : "";

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
          </div>
          <h3 className="font-medium text-gray-900 mt-0.5 truncate">
            {course.title}
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
