import { memo, useMemo } from "react";
import type { AiCourseRecommendation } from "../../../hooks/useAi.js";
import { ChatMessageBubble } from "./ChatMessageBubble.js";
import { RecommendationCard } from "./RecommendationCard.js";

type ChatAssistantBlockProps = {
  content: string;
  recommendations: AiCourseRecommendation[];
  prefersReducedMotion: boolean;
};

function ChatAssistantBlockImpl({
  content,
  recommendations,
  prefersReducedMotion,
}: ChatAssistantBlockProps) {
  const recommendationCards = useMemo(
    () =>
      recommendations.map((recommendation) => (
        <RecommendationCard
          key={recommendation.course.id}
          recommendation={recommendation}
          prefersReducedMotion={prefersReducedMotion}
        />
      )),
    [prefersReducedMotion, recommendations],
  );

  return (
    <div className="space-y-2 rounded-2xl bg-[#faf8f2] p-2">
      <ChatMessageBubble role="assistant" align="none">
        <p className="whitespace-pre-wrap text-sm text-[#302f2b]">{content}</p>
      </ChatMessageBubble>

      {recommendations.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">{recommendationCards}</div>
      )}
    </div>
  );
}

function assistantBlockPropsEqual(
  previous: ChatAssistantBlockProps,
  next: ChatAssistantBlockProps,
): boolean {
  return (
    previous.content === next.content &&
    previous.prefersReducedMotion === next.prefersReducedMotion &&
    previous.recommendations === next.recommendations
  );
}

export const ChatAssistantBlock = memo(
  ChatAssistantBlockImpl,
  assistantBlockPropsEqual,
);
