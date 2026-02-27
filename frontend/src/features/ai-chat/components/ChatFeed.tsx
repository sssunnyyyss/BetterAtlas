import type { MutableRefObject } from "react";
import { Link } from "react-router-dom";
import type { AiCourseRecommendation } from "../../../hooks/useAi.js";
import type { ChatRequestState, ChatTurn } from "../model/chatTypes.js";

type ChatFeedProps = {
  turns: ChatTurn[];
  requestState: ChatRequestState;
  suggestionChips: readonly string[];
  onSuggestionSelect: (prompt: string) => void;
  endRef: MutableRefObject<HTMLDivElement | null>;
};

function fitScoreColor(score: number): string {
  if (score >= 8) return "bg-green-100 text-green-800";
  if (score >= 5) return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
}

function formatRating(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toFixed(1);
}

function TypingIndicator() {
  return (
    <div className="mb-4 flex items-start gap-2">
      <div className="max-w-[80%] rounded-2xl rounded-tl-sm border border-gray-200 bg-gray-50 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

function ErrorBubble() {
  return (
    <div className="mb-4 flex items-start gap-2">
      <div className="max-w-[80%] rounded-2xl rounded-tl-sm border border-red-200 bg-red-50 px-4 py-3">
        <p className="text-sm text-red-700">
          Something went wrong. Please try again.
        </p>
      </div>
    </div>
  );
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

export function ChatFeed({
  turns,
  requestState,
  suggestionChips,
  onSuggestionSelect,
  endRef,
}: ChatFeedProps) {
  const hasTurns = turns.length > 0;

  return (
    <div className="h-full overflow-y-auto px-4 py-4">
      {!hasTurns ? (
        <div className="flex h-full flex-col items-center justify-center px-4 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-100">
            <svg
              className="h-8 w-8 text-primary-600"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
              />
            </svg>
          </div>
          <h2 className="mb-2 text-xl font-semibold text-gray-900 sm:text-2xl">
            Atlas AI
          </h2>
          <p className="mb-8 max-w-sm text-sm text-gray-500">
            I can help you find the perfect classes. Tell me what you&apos;re
            looking for, or try one of the suggestions below.
          </p>
          <div className="grid w-full max-w-sm grid-cols-1 gap-2 sm:grid-cols-2">
            {suggestionChips.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => onSuggestionSelect(chip)}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left text-sm text-gray-700 transition-colors hover:border-primary-300 hover:bg-primary-50"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {turns.map((turn) =>
            turn.role === "user" ? (
              <div
                key={turn.id}
                className="flex justify-end animate-[ba-fade-in-up_0.2s_ease-out]"
              >
                <div className="max-w-[90%] rounded-2xl rounded-br-sm bg-primary-600 px-4 py-2.5 text-white sm:max-w-[80%]">
                  <p className="whitespace-pre-wrap text-sm">{turn.content}</p>
                </div>
              </div>
            ) : (
              <div
                key={turn.id}
                className="space-y-2 animate-[ba-fade-in-up_0.2s_ease-out]"
              >
                <div className="flex items-start gap-2">
                  <div className="max-w-[95%] rounded-2xl rounded-tl-sm border border-gray-200 bg-gray-50 px-4 py-2.5 sm:max-w-[85%]">
                    <p className="whitespace-pre-wrap text-sm text-gray-800">
                      {turn.content}
                    </p>
                  </div>
                </div>

                {turn.recommendations.length > 0 && (
                  <div className="grid max-w-[95%] gap-2 sm:max-w-[85%] sm:grid-cols-2">
                    {turn.recommendations.map((recommendation) => (
                      <CourseCard
                        key={recommendation.course.id}
                        recommendation={recommendation}
                      />
                    ))}
                  </div>
                )}

                {turn.followUp && (
                  <div className="flex items-start gap-2">
                    <div className="max-w-[95%] rounded-2xl rounded-tl-sm border border-gray-200 bg-gray-50 px-4 py-2.5 sm:max-w-[85%]">
                      <p className="text-sm italic text-gray-600">
                        {turn.followUp}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ),
          )}

          {requestState === "sending" && <TypingIndicator />}
          {requestState === "error" && <ErrorBubble />}

          <div ref={endRef} />
        </div>
      )}
    </div>
  );
}
