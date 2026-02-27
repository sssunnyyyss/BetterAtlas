import { Link } from "react-router-dom";
import type { AiCourseRecommendation } from "../../../hooks/useAi.js";
import { ChatMessageBubble } from "./ChatMessageBubble.js";

type ChatAssistantBlockProps = {
  content: string;
  recommendations: AiCourseRecommendation[];
  followUp: string | null;
};

function fitScoreColor(score: number): string {
  if (score >= 8) return "bg-emerald-100 text-emerald-800";
  if (score >= 5) return "bg-amber-100 text-amber-800";
  return "bg-rose-100 text-rose-800";
}

function formatRating(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toFixed(1);
}

function CourseCard({ recommendation }: { recommendation: AiCourseRecommendation }) {
  const { course, fitScore, why } = recommendation;

  return (
    <Link
      to={`/catalog/${course.id}`}
      className="block rounded-xl border border-gray-200 bg-white p-3 transition-all hover:border-primary-400 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">
            {course.code}
          </p>
          <p className="truncate text-sm text-gray-600">{course.title}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {course.classScore != null && (
            <span className="text-xs text-gray-500">
              ★ {formatRating(course.classScore)}
            </span>
          )}
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${fitScoreColor(fitScore)}`}
          >
            {fitScore}/10
          </span>
        </div>
      </div>

      {why.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {why.slice(0, 2).map((reason, index) => (
            <li
              key={`${reason}-${index}`}
              className="flex items-start gap-1 text-xs text-gray-500"
            >
              <span className="mt-0.5 shrink-0">•</span>
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      )}
    </Link>
  );
}

export function ChatAssistantBlock({
  content,
  recommendations,
  followUp,
}: ChatAssistantBlockProps) {
  return (
    <div className="space-y-2 rounded-2xl border border-gray-200/80 bg-gray-50/70 p-2">
      <ChatMessageBubble role="assistant" align="none">
        <p className="whitespace-pre-wrap text-sm text-gray-800">{content}</p>
      </ChatMessageBubble>

      {recommendations.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {recommendations.map((recommendation) => (
            <CourseCard
              key={recommendation.course.id}
              recommendation={recommendation}
            />
          ))}
        </div>
      )}

      {followUp && (
        <ChatMessageBubble
          role="assistant"
          align="none"
          label="Follow-up"
          className="border-primary-100 bg-primary-50 text-primary-900"
        >
          <p className="text-sm italic">{followUp}</p>
        </ChatMessageBubble>
      )}
    </div>
  );
}
