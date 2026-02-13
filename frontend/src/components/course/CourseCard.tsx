import { Link } from "react-router-dom";
import type { CourseWithRatings } from "@betteratlas/shared";
import { parseAttributes, GER_TAGS } from "@betteratlas/shared";
import RatingBadge from "./RatingBadge.js";

const MAX_VISIBLE_TAGS = 3;

interface CourseCardProps {
  course: CourseWithRatings;
}

export default function CourseCard({ course }: CourseCardProps) {
  const gerTags = parseAttributes(course.attributes);
  const visibleTags = gerTags.slice(0, MAX_VISIBLE_TAGS);
  const overflowCount = gerTags.length - MAX_VISIBLE_TAGS;

  return (
    <Link
      to={`/catalog/${course.id}`}
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
          {course.department && (
            <span className="text-xs text-gray-500">
              {course.department.name}
            </span>
          )}
          {gerTags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {visibleTags.map((tag) => (
                <span
                  key={tag}
                  className="bg-indigo-100 text-indigo-700 text-xs px-1.5 py-0.5 rounded-full"
                >
                  {GER_TAGS[tag] ?? tag}
                </span>
              ))}
              {overflowCount > 0 && (
                <span className="text-xs text-gray-400 px-1 py-0.5">
                  +{overflowCount} more
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <RatingBadge value={course.avgQuality} label="Quality" />
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
