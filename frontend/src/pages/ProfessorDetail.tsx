import { Link, useParams } from "react-router-dom";
import { useProfessorDetail } from "../hooks/useInstructors.js";
import RatingBadge from "../components/course/RatingBadge.js";
import CourseGrid from "../components/course/CourseGrid.js";

export default function ProfessorDetail() {
  const { id } = useParams<{ id: string }>();
  const professorId = parseInt(id || "0", 10);

  const { data, isLoading, isError, error } = useProfessorDetail(professorId);

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/4" />
          <div className="h-8 bg-gray-200 rounded w-1/2" />
          <div className="h-4 bg-gray-200 rounded w-full" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-5xl mx-auto p-6 text-center">
        <h2 className="text-xl font-semibold text-gray-900">Could not load professor</h2>
        <p className="text-sm text-gray-600 mt-2">
          {(error as any)?.message || "Request failed"}
        </p>
        <Link to="/catalog" className="text-primary-600 hover:text-primary-800 mt-3 inline-block">
          Back to catalog
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-5xl mx-auto p-6 text-center">
        <h2 className="text-xl font-semibold text-gray-900">Professor not found</h2>
        <Link to="/catalog" className="text-primary-600 hover:text-primary-800 mt-2 inline-block">
          Back to catalog
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <Link to="/catalog" className="text-sm text-primary-600 hover:text-primary-800">
        &larr; Back to catalog
      </Link>

      <div className="mt-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{data.professor.name}</h1>
        {data.professor.email && (
          <a
            href={`mailto:${data.professor.email}`}
            className="text-sm text-primary-600 hover:text-primary-800"
          >
            {data.professor.email}
          </a>
        )}

        <div className="flex gap-6 mt-4 items-center">
          <RatingBadge value={data.avgQuality} label="Professor" />
          <div className="flex flex-col items-center">
            <span className="text-lg font-bold text-gray-700">{data.reviewCount}</span>
            <span className="text-xs text-gray-500">Reviews</span>
          </div>
        </div>

        {data.rmp && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h3 className="mb-2 text-sm font-semibold text-amber-800">RateMyProfessor</h3>
            <div className="flex flex-wrap gap-4 text-sm text-amber-700">
              {data.rmp.avgRating != null && (
                <span>
                  Rating: <strong>{data.rmp.avgRating.toFixed(1)}/5</strong>
                </span>
              )}
              {data.rmp.avgDifficulty != null && (
                <span>
                  Difficulty: <strong>{data.rmp.avgDifficulty.toFixed(1)}/5</strong>
                </span>
              )}
              {data.rmp.wouldTakeAgain != null && (
                <span>
                  Would take again: <strong>{data.rmp.wouldTakeAgain.toFixed(0)}%</strong>
                </span>
              )}
              {data.rmp.numRatings > 0 && <span>{data.rmp.numRatings} ratings</span>}
            </div>
            {data.rmp.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {data.rmp.tags.map((t) => (
                  <span
                    key={t.tag}
                    className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800"
                  >
                    {t.tag} ({t.count})
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Courses Taught</h2>
        <CourseGrid courses={data.courses} />
      </div>
    </div>
  );
}
