import { ChatComposer } from "../features/ai-chat/components/ChatComposer.js";
import { ChatFeed } from "../features/ai-chat/components/ChatFeed.js";
import { ChatHeader } from "../features/ai-chat/components/ChatHeader.js";
import { ChatShell } from "../features/ai-chat/components/ChatShell.js";
import { useChatSession } from "../features/ai-chat/hooks/useChatSession.js";

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
    <ChatShell
      mode={embedded ? "embedded" : "standalone"}
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
          isSending={isSending}
          textareaRef={textareaRef}
          onValueChange={setDraft}
          onSubmit={sendDraft}
        />
      }
    />
  );
}
