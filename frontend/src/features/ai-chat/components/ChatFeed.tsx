import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type MutableRefObject,
} from "react";
import type {
  ChatRequestLifecycle,
  ChatRequestState,
  ChatTurn,
} from "../model/chatTypes.js";
import { ChatAssistantBlock } from "./ChatAssistantBlock.js";
import { ChatMessageBubble } from "./ChatMessageBubble.js";
import { ChatRequestStatus } from "./ChatRequestStatus.js";

const AUTO_SCROLL_NEAR_BOTTOM_THRESHOLD_PX = 96;
const SEND_INTENT_REASONS = new Set(["send", "retry", "deep-link"]);

export type ChatStarterChip = {
  id: string;
  label: string;
  prompt: string;
  category?: string;
};

type ChatFeedProps = {
  turns: ChatTurn[];
  requestState: ChatRequestState;
  requestLifecycle?: ChatRequestLifecycle;
  prefersReducedMotion: boolean;
  suggestionChips: readonly ChatStarterChip[];
  greetingName?: string;
  onSuggestionSelect: (prompt: string) => void;
  onRetry?: () => void;
  endRef: MutableRefObject<HTMLDivElement | null>;
};

export function ChatFeed({
  turns,
  requestState,
  requestLifecycle,
  prefersReducedMotion,
  suggestionChips,
  greetingName = "there",
  onSuggestionSelect,
  onRetry,
  endRef,
}: ChatFeedProps) {
  const hasTurns = turns.length > 0;
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const nearBottomRef = useRef(true);
  const previousTurnCountRef = useRef(turns.length);
  const handledTransitionSequenceRef = useRef<number | null>(
    requestLifecycle?.transitionSequence ?? null,
  );

  const updateNearBottom = useCallback(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const distanceFromBottom =
      scrollContainer.scrollHeight -
      scrollContainer.scrollTop -
      scrollContainer.clientHeight;
    nearBottomRef.current =
      distanceFromBottom <= AUTO_SCROLL_NEAR_BOTTOM_THRESHOLD_PX;
  }, []);

  useEffect(() => {
    updateNearBottom();
  }, [turns.length, updateNearBottom]);

  useEffect(() => {
    const endElement = endRef.current;
    if (!endElement) return;

    const transitionSequence = requestLifecycle?.transitionSequence ?? null;
    const hasNewTurns = turns.length > previousTurnCountRef.current;
    const hasUnhandledTransition =
      transitionSequence !== handledTransitionSequenceRef.current;
    const transitionToSending = requestLifecycle?.lastTransitionTo === "sending";
    const shouldForceBottom =
      hasUnhandledTransition &&
      transitionToSending &&
      SEND_INTENT_REASONS.has(requestLifecycle?.lastTransitionReason ?? "");
    const shouldScrollForNewTurns = hasNewTurns && nearBottomRef.current;

    if (shouldForceBottom || shouldScrollForNewTurns) {
      endElement.scrollIntoView({
        block: "end",
        behavior: prefersReducedMotion ? "auto" : "smooth",
      });
    }

    previousTurnCountRef.current = turns.length;
    handledTransitionSequenceRef.current = transitionSequence;
  }, [endRef, prefersReducedMotion, requestLifecycle, turns.length]);

  const transitionClassName = prefersReducedMotion ? "" : "ba-chat-turn-enter";
  const renderedTurns = useMemo(
    () =>
      turns.map((turn) =>
        turn.role === "user" ? (
          <div key={turn.id} className={transitionClassName}>
            <ChatMessageBubble role="user">
              <p className="whitespace-pre-wrap text-sm">{turn.content}</p>
            </ChatMessageBubble>
          </div>
        ) : (
          <div
            key={turn.id}
            className={`flex justify-start ${transitionClassName}`.trim()}
          >
            <div className="max-w-[96%] sm:max-w-[88%]">
              <ChatAssistantBlock
                content={turn.content}
                recommendations={turn.recommendations}
                followUp={turn.followUp}
                prefersReducedMotion={prefersReducedMotion}
              />
            </div>
          </div>
        ),
      ),
    [prefersReducedMotion, transitionClassName, turns],
  );

  const currentHour = new Date().getHours();
  let greeting = "Good morning";
  if (currentHour >= 12 && currentHour < 18) {
    greeting = "Good afternoon";
  } else if (currentHour >= 18) {
    greeting = "Good evening";
  }

  return (
    <div
      ref={scrollContainerRef}
      onScroll={updateNearBottom}
      className="h-full min-h-0 overflow-y-auto overscroll-y-contain px-4 py-4"
      data-testid="chat-feed-scroll-container"
    >
      {!hasTurns ? (
        <div className="flex min-h-full flex-col items-center justify-center px-4 py-8 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f3eee5] shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
            <svg
              className="h-8 w-8 text-[#d97757]"
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
          <h2 className="mb-1 text-2xl font-light tracking-tight text-[#1f1e1d] sm:text-3xl">
            {greeting},{" "}
            <span className="relative inline-block pb-1">
              {greetingName}
              <svg
                className="absolute -bottom-1 -left-[7%] h-[14px] w-[114%] text-[#d97757]"
                viewBox="0 0 140 24"
                fill="none"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path
                  d="M6 16 Q 70 24, 134 14"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </span>
          </h2>
          <h3 className="mb-2 text-xl font-semibold text-[#1f1e1d] sm:text-2xl">
            Atlas AI
          </h3>
          <p className="mb-8 max-w-xl text-sm text-[#6f6d67]">
            I can help you find the perfect classes. Tell me what you&apos;re
            looking for, or try one of the suggestions below.
          </p>
          <div className="grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
            {suggestionChips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => onSuggestionSelect(chip.prompt)}
                data-testid={`chat-starter-chip-${chip.id}`}
                className="rounded-2xl border border-[#e9e4d9] bg-white px-3 py-3 text-left text-sm text-[#2f2e2b] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all hover:-translate-y-0.5 hover:border-[#d9cfc0] hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)]"
              >
                <span className="text-sm font-semibold">{chip.label}</span>
                {chip.category && (
                  <span className="mt-1 block text-xs font-medium uppercase tracking-wide text-[#8f8a80]">
                    {chip.category}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {renderedTurns}

          <ChatRequestStatus
            requestState={requestState}
            requestLifecycle={requestLifecycle}
            prefersReducedMotion={prefersReducedMotion}
            onRetry={onRetry}
          />

          <div ref={endRef} />
        </div>
      )}
    </div>
  );
}
