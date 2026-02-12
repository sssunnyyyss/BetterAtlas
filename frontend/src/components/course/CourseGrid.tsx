import type { CourseWithRatings } from "@betteratlas/shared";
import CourseCard from "./CourseCard.js";

interface CourseGridProps {
  courses: CourseWithRatings[];
  isLoading?: boolean;
}

export default function CourseGrid({ courses, isLoading }: CourseGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse"
          >
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-2" />
            <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
            <div className="h-3 bg-gray-200 rounded w-1/3 mb-3" />
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {courses.map((course) => (
        <CourseCard key={course.id} course={course} />
      ))}
    </div>
  );
}
