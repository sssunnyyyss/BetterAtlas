import type { MutableRefObject } from "react";
import type { ChatRequestState, ChatTurn } from "../model/chatTypes.js";
import { ChatAssistantBlock } from "./ChatAssistantBlock.js";
import { ChatMessageBubble } from "./ChatMessageBubble.js";
import { ChatRequestStatus } from "./ChatRequestStatus.js";

type ChatFeedProps = {
  turns: ChatTurn[];
  requestState: ChatRequestState;
  suggestionChips: readonly string[];
  onSuggestionSelect: (prompt: string) => void;
  endRef: MutableRefObject<HTMLDivElement | null>;
};

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
              <div key={turn.id} className="animate-[ba-fade-in-up_0.2s_ease-out]">
                <ChatMessageBubble role="user">
                  <p className="whitespace-pre-wrap text-sm">{turn.content}</p>
                </ChatMessageBubble>
              </div>
            ) : (
              <div
                key={turn.id}
                className="flex justify-start animate-[ba-fade-in-up_0.2s_ease-out]"
              >
                <div className="max-w-[96%] sm:max-w-[88%]">
                  <ChatAssistantBlock
                    content={turn.content}
                    recommendations={turn.recommendations}
                    followUp={turn.followUp}
                  />
                </div>
              </div>
            ),
          )}

          <ChatRequestStatus requestState={requestState} />

          <div ref={endRef} />
        </div>
      )}
    </div>
  );
}
