import { ChatComposer } from "../features/ai-chat/components/ChatComposer.js";
import { ChatFeed } from "../features/ai-chat/components/ChatFeed.js";
import { ChatHeader } from "../features/ai-chat/components/ChatHeader.js";
import { ChatShell } from "../features/ai-chat/components/ChatShell.js";
import { useChatSession } from "../features/ai-chat/hooks/useChatSession.js";
import { useComposerViewport } from "../features/ai-chat/hooks/useComposerViewport.js";

type AiChatProps = {
  embedded?: boolean;
};

const SUGGESTION_CHIPS = [
  "Find easy GER classes",
  "Help me plan next semester",
  "Best CS classes",
  "Low-workload electives",
] as const;

export default function AiChat({ embedded = false }: AiChatProps) {
  const { keyboardInset, viewportHeight } = useComposerViewport();

  const {
    turns,
    draft,
    requestState,
    isSending,
    hasTurns,
    messagesEndRef,
    textareaRef,
    setDraft,
    sendPrompt,
    sendDraft,
    resetChat,
  } = useChatSession();

  return (
    <div
      className={
        embedded
          ? "flex h-full min-h-0 w-full"
          : "flex min-h-[calc(100dvh-4rem)] w-full px-3 py-3 sm:px-6 sm:py-5"
      }
      data-viewport-height={viewportHeight > 0 ? viewportHeight : undefined}
    >
      <ChatShell
        variant={embedded ? "embedded" : "standalone"}
        composerInset={keyboardInset}
        header={<ChatHeader hasTurns={hasTurns} onReset={resetChat} />}
        feed={
          <ChatFeed
            turns={turns}
            requestState={requestState}
            suggestionChips={SUGGESTION_CHIPS}
            onSuggestionSelect={sendPrompt}
            endRef={messagesEndRef}
          />
        }
        composer={
          <ChatComposer
            value={draft}
            requestState={requestState}
            isSending={isSending}
            textareaRef={textareaRef}
            onValueChange={setDraft}
            onSubmit={sendDraft}
          />
        }
      />
    </div>
  );
}
