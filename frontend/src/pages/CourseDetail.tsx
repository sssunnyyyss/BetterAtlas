import { useParams, Link } from "react-router-dom";
import { useCourseDetail } from "../hooks/useCourses.js";
import { useReviews, useCreateReview, useDeleteReview } from "../hooks/useReviews.js";
import RatingBadge from "../components/course/RatingBadge.js";
import ReviewCard from "../components/review/ReviewCard.js";
import ReviewForm from "../components/review/ReviewForm.js";
import type { Schedule } from "@betteratlas/shared";

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
                  className="bg-white rounded-lg border border-gray-200 p-3 flex items-center justify-between"
                >
                  <div>
                    <span className="text-sm font-medium text-gray-900">
                      Section {section.sectionNumber}
                    </span>
                    <span className="text-sm text-gray-500 ml-3">
                      {section.semester}
                    </span>
                    {section.instructor && (
                      <span className="text-sm text-gray-600 ml-3">
                        {section.instructor.name}
                      </span>
                    )}
                  </div>
                  <div className="text-right text-sm">
                    {sched && (
                      <div className="text-gray-600">
                        {sched.days.join("/")} {sched.start}-{sched.end}
                      </div>
                    )}
                    {sched?.location && (
                      <div className="text-gray-400 text-xs">{sched.location}</div>
                    )}
                    {section.enrollmentCap && (
                      <div className="text-xs text-gray-400">
                        {section.enrollmentCur}/{section.enrollmentCap} enrolled
                      </div>
                    )}
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
