import { memo, useMemo } from "react";
import type { AiCourseRecommendation } from "../../../hooks/useAi.js";
import { ChatMessageBubble } from "./ChatMessageBubble.js";
import { RecommendationCard } from "./RecommendationCard.js";

type ChatAssistantBlockProps = {
  content: string;
  recommendations: AiCourseRecommendation[];
  followUp: string | null;
  prefersReducedMotion: boolean;
};

function ChatAssistantBlockImpl({
  content,
  recommendations,
  followUp,
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

      {followUp && (
        <ChatMessageBubble
          role="assistant"
          align="none"
          label="Follow-up"
          className="border-[#efd9c0] bg-[#f8efe3] text-[#362d23]"
        >
          <p className="text-sm italic">{followUp}</p>
        </ChatMessageBubble>
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
    previous.followUp === next.followUp &&
    previous.prefersReducedMotion === next.prefersReducedMotion &&
    previous.recommendations === next.recommendations
  );
}

export const ChatAssistantBlock = memo(
  ChatAssistantBlockImpl,
  assistantBlockPropsEqual,
);
