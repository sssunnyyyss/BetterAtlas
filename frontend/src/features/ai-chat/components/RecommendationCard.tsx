import { memo } from "react";
import { Link } from "react-router-dom";
import type { AiCourseRecommendation } from "../../../hooks/useAi.js";
import { RecommendationDisclosure } from "./RecommendationDisclosure.js";

type RecommendationCardProps = {
  recommendation: AiCourseRecommendation;
  prefersReducedMotion?: boolean;
};

function fitScoreTone(score: number): string {
  if (score >= 8) return "bg-emerald-100 text-emerald-800";
  if (score >= 5) return "bg-amber-100 text-amber-900";
  return "bg-rose-100 text-rose-800";
}

function formatRating(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toFixed(1);
}

function RecommendationCardImpl({
  recommendation,
  prefersReducedMotion = false,
}: RecommendationCardProps) {
  const { course, fitScore, why, cautions } = recommendation;
  const visibleWhy = why.slice(0, 2);
  const hiddenWhy = why.slice(2);

  return (
    <article
      className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
      data-testid={`chat-recommendation-card-${course.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className="truncate text-xs font-semibold uppercase tracking-wide text-gray-500"
            data-testid={`chat-recommendation-code-${course.id}`}
          >
            {course.code}
          </p>
          <p
            className="truncate text-sm font-semibold text-gray-900"
            data-testid={`chat-recommendation-title-${course.id}`}
          >
            {course.title}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-500">
            Fit
          </span>
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${fitScoreTone(fitScore)}`}
            data-testid={`chat-recommendation-fit-${course.id}`}
          >
            {fitScore}/10
          </span>
        </div>
      </div>

      {course.classScore != null && (
        <p className="mt-1 text-xs text-gray-500">Class score: {formatRating(course.classScore)}</p>
      )}

      {visibleWhy.length > 0 && (
        <ul
          className="mt-2 space-y-1"
          data-testid={`chat-recommendation-why-${course.id}`}
        >
          {visibleWhy.map((reason, index) => (
            <li
              key={`${reason}-${index}`}
              className="flex items-start gap-1 text-xs text-gray-700"
            >
              <span className="mt-0.5 shrink-0 text-primary-600">•</span>
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      )}

      {hiddenWhy.length > 0 && (
        <RecommendationDisclosure
          label={`Show ${hiddenWhy.length} more reason${hiddenWhy.length === 1 ? "" : "s"}`}
          expandedLabel="Hide extra reasons"
          testId={`chat-recommendation-why-more-${course.id}`}
          prefersReducedMotion={prefersReducedMotion}
        >
          <ul className="space-y-1 pl-1">
            {hiddenWhy.map((reason, index) => (
              <li
                key={`${reason}-${index}`}
                className="flex items-start gap-1 text-xs text-gray-600"
              >
                <span className="mt-0.5 shrink-0 text-gray-400">•</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </RecommendationDisclosure>
      )}

      {cautions.length > 0 && (
        <RecommendationDisclosure
          label={`Show cautions (${cautions.length})`}
          expandedLabel="Hide cautions"
          testId={`chat-recommendation-cautions-${course.id}`}
          prefersReducedMotion={prefersReducedMotion}
        >
          <ul className="space-y-1 rounded-md border border-amber-200 bg-amber-50 p-2">
            {cautions.map((caution, index) => (
              <li
                key={`${caution}-${index}`}
                className="flex items-start gap-1 text-xs text-amber-900"
              >
                <span className="mt-0.5 shrink-0">!</span>
                <span>{caution}</span>
              </li>
            ))}
          </ul>
        </RecommendationDisclosure>
      )}

      <div className="mt-3 flex justify-end">
        <Link
          to={`/catalog/${course.id}`}
          aria-label={`View course details for ${course.code}`}
          className="ba-chat-focus-ring inline-flex items-center rounded-lg border border-primary-200 bg-primary-50 px-2.5 py-1.5 text-xs font-semibold text-primary-800 hover:border-primary-300 hover:bg-primary-100"
          data-testid={`chat-recommendation-detail-link-${course.id}`}
        >
          View course details
        </Link>
      </div>
    </article>
  );
}

function recommendationCardPropsEqual(
  previous: RecommendationCardProps,
  next: RecommendationCardProps,
): boolean {
  return (
    previous.prefersReducedMotion === next.prefersReducedMotion &&
    previous.recommendation === next.recommendation
  );
}

export const RecommendationCard = memo(
  RecommendationCardImpl,
  recommendationCardPropsEqual,
);
