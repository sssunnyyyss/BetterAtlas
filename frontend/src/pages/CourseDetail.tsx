import { useParams, Link } from "react-router-dom";
import { useCourseDetail } from "../hooks/useCourses.js";
import { useReviews, useCreateReview, useDeleteReview } from "../hooks/useReviews.js";
import RatingBadge from "../components/course/RatingBadge.js";
import ReviewCard from "../components/review/ReviewCard.js";
import ReviewForm from "../components/review/ReviewForm.js";
import type { Schedule } from "@betteratlas/shared";
import { INSTRUCTION_METHOD_OPTIONS } from "@betteratlas/shared";

const ENROLLMENT_STATUS_LABELS: Record<string, string> = {
  O: "Open",
  C: "Closed",
  W: "Wait List",
};

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const courseId = parseInt(id || "0", 10);

  const { data: course, isLoading } = useCourseDetail(courseId);
  const { data: reviews } = useReviews(courseId);
  const createReview = useCreateReview(courseId);
  const deleteReview = useDeleteReview();

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/4" />
          <div className="h-8 bg-gray-200 rounded w-1/2" />
          <div className="h-4 bg-gray-200 rounded w-full" />
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <h2 className="text-xl font-semibold text-gray-900">Course not found</h2>
        <Link to="/catalog" className="text-primary-600 hover:text-primary-800 mt-2 inline-block">
          Back to catalog
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Breadcrumb */}
      <Link to="/catalog" className="text-sm text-primary-600 hover:text-primary-800">
        &larr; Back to catalog
      </Link>

      {/* Header */}
      <div className="mt-4 mb-6">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-lg font-semibold text-primary-600">{course.code}</span>
          {course.credits && (
            <span className="text-sm text-gray-500">{course.credits} credits</span>
          )}
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{course.title}</h1>
        {course.department && (
          <p className="text-sm text-gray-500 mt-1">{course.department.name}</p>
        )}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
          <span>
            <span className="font-medium text-gray-700">Credit Hours:</span>{" "}
            {course.credits ?? "—"}
          </span>
          <span>
            <span className="font-medium text-gray-700">Grading Mode:</span>{" "}
            {course.gradeMode ?? "—"}
          </span>
        </div>
        {course.description && (
          <p className="text-gray-700 mt-3">{course.description}</p>
        )}

        {/* Ratings */}
        <div className="flex gap-6 mt-4">
          <RatingBadge value={course.avgQuality} label="Quality" />
          <RatingBadge value={course.avgDifficulty} label="Difficulty" />
          <RatingBadge value={course.avgWorkload} label="Workload" />
          <div className="flex flex-col items-center">
            <span className="text-lg font-bold text-gray-700">{course.reviewCount}</span>
            <span className="text-xs text-gray-500">Reviews</span>
          </div>
        </div>
      </div>

      {/* Sections */}
      {course.sections.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Sections</h2>
          <div className="space-y-2">
            {course.sections.map((section) => {
              const sched = section.schedule as Schedule | null;
              return (
                <div
                  key={section.id}
                  className="bg-white rounded-lg border border-gray-200 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900">
                          Section {section.sectionNumber}
                        </span>
                        <span className="text-sm text-gray-500">
                          {section.semester}
                        </span>
                        {section.campus && (
                          <span className="text-xs text-gray-400">
                            {section.campus}
                          </span>
                        )}
                      </div>
                      {section.instructor && (
                        <div className="mt-1.5">
                          <span className="text-sm font-medium text-gray-900">
                            {section.instructor.name}
                          </span>
                          {section.instructor.email && (
                            <a
                              href={`mailto:${section.instructor.email}`}
                              className="text-sm text-primary-600 hover:text-primary-800 ml-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {section.instructor.email}
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-right text-sm shrink-0">
                      {sched && (
                        <div className="font-medium text-gray-700">
                          {sched.days.join("/")} {sched.start}-{sched.end}
                        </div>
                      )}
                      {sched?.location && (
                        <div className="text-sm text-gray-600 mt-0.5">{sched.location}</div>
                      )}
                      {(section.startDate || section.endDate) && (
                        <div className="text-xs text-gray-500 mt-1">
                          Dates: {section.startDate ?? "?"} through {section.endDate ?? "?"}
                        </div>
                      )}
                      {(section.enrollmentCap !== null || section.seatsAvail !== null) && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          Seats: Maximum Enrollment: {section.enrollmentCap ?? "—"} / Seats Avail:{" "}
                          {section.seatsAvail ?? (section.enrollmentCap !== null ? Math.max(0, (section.enrollmentCap ?? 0) - (section.enrollmentCur ?? 0)) : "—")}
                        </div>
                      )}
                      {typeof section.waitlistCount === "number" && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          Waitlist Total: {section.waitlistCount}
                          {section.waitlistCap !== null && section.waitlistCap !== undefined
                            ? ` of ${section.waitlistCap}`
                            : ""}
                        </div>
                      )}
                      {section.enrollmentStatus && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          Enrollment Status:{" "}
                          {ENROLLMENT_STATUS_LABELS[section.enrollmentStatus] ??
                            section.enrollmentStatus}
                        </div>
                      )}
                      {section.instructionMethod && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          Instruction Method:{" "}
                          {INSTRUCTION_METHOD_OPTIONS[section.instructionMethod] ??
                            section.instructionMethod}
                        </div>
                      )}
                      {section.gerDesignation && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          Requirement Designation: {section.gerDesignation}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Reviews */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Reviews</h2>

        <ReviewForm
          onSubmit={(data) => createReview.mutate(data)}
          isLoading={createReview.isPending}
        />

        {createReview.isError && (
          <p className="text-sm text-red-600 mt-2">
            {(createReview.error as any)?.message || "Failed to submit review"}
          </p>
        )}

        <div className="space-y-3 mt-4">
          {reviews?.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              onDelete={(id) => deleteReview.mutate(id)}
            />
          ))}
          {reviews?.length === 0 && (
            <p className="text-sm text-gray-500">No reviews yet. Be the first!</p>
          )}
        </div>
      </div>
    </div>
  );
}
