import type { AiCourseRecommendation } from "../../../hooks/useAi.js";
import { ChatMessageBubble } from "./ChatMessageBubble.js";
import { RecommendationCard } from "./RecommendationCard.js";

type ChatAssistantBlockProps = {
  content: string;
  recommendations: AiCourseRecommendation[];
  followUp: string | null;
};

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
            <RecommendationCard
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
