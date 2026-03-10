import { useEffect, useState } from "react";

import { ChatComposer } from "../features/ai-chat/components/ChatComposer.js";
import { ChatFeed, type ChatStarterChip } from "../features/ai-chat/components/ChatFeed.js";
import { ChatHeader } from "../features/ai-chat/components/ChatHeader.js";
import { ChatShell } from "../features/ai-chat/components/ChatShell.js";
import { useChatSession } from "../features/ai-chat/hooks/useChatSession.js";
import { useComposerViewport } from "../features/ai-chat/hooks/useComposerViewport.js";

type AiChatProps = {
  embedded?: boolean;
};

const STARTER_CHIPS: readonly ChatStarterChip[] = [
  {
    id: "ger-easy",
    label: "Find easy GER classes",
    prompt: "Find easy GER classes with lighter workload.",
    category: "Quick start",
  },
  {
    id: "cs-next",
    label: "Pick my next CS class",
    prompt: "Recommend the next CS class after CS 170 with balanced workload.",
    category: "Major path",
  },
  {
    id: "schedule-balance",
    label: "Balance my semester",
    prompt: "Help me plan a balanced semester with one challenging class and lighter electives.",
    category: "Planning",
  },
  {
    id: "writing-humanities",
    label: "Suggest a writing-heavy elective",
    prompt: "Recommend discussion-based writing or humanities electives with strong reviews.",
    category: "Electives",
  },
];

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setPrefersReducedMotion(mediaQuery.matches);

    sync();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", sync);
      return () => mediaQuery.removeEventListener("change", sync);
    }

    mediaQuery.addListener(sync);
    return () => mediaQuery.removeListener(sync);
  }, []);

  return prefersReducedMotion;
}

export default function AiChat({ embedded = false }: AiChatProps) {
  const session = useChatSession();
  const { keyboardInset } = useComposerViewport();
  const prefersReducedMotion = usePrefersReducedMotion();

  const shell = (
    <ChatShell
      variant={embedded ? "embedded" : "standalone"}
      header={
        <ChatHeader
          title="Atlas AI"
          hasTurns={session.hasTurns}
          onReset={session.resetChat}
        />
      }
      feed={
        <ChatFeed
          turns={session.turns}
          requestState={session.requestState}
          requestLifecycle={session.requestLifecycle}
          prefersReducedMotion={prefersReducedMotion}
          suggestionChips={STARTER_CHIPS}
          onSuggestionSelect={session.sendPrompt}
          onRetry={session.retryLastPrompt}
          endRef={session.messagesEndRef}
        />
      }
      composer={
        <ChatComposer
          value={session.draft}
          requestState={session.requestState}
          isSending={session.isSending}
          hasTurns={session.hasTurns}
          textareaRef={session.textareaRef}
          onValueChange={session.setDraft}
          onSubmit={session.sendDraft}
          onReset={session.resetChat}
        />
      }
      composerInset={keyboardInset}
    />
  );

  if (embedded) {
    return <div className="flex h-full min-h-0 w-full">{shell}</div>;
  }

  return (
    <div className="flex h-[calc(100dvh-4rem)] max-h-[calc(100dvh-4rem)] min-h-[calc(100dvh-4rem)] w-full items-stretch justify-center bg-[radial-gradient(circle_at_top,_rgba(252,248,241,0.98),_rgba(246,239,228,0.88)_34%,_rgba(255,255,255,0.96)_72%)] px-0 py-0 sm:px-4 sm:py-4 md:px-6 md:py-6">
      {shell}
    </div>
  );
}
