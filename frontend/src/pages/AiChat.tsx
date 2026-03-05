import { useEffect, useState } from "react";
import { ChatComposer } from "../features/ai-chat/components/ChatComposer.js";
import type { ChatStarterChip } from "../features/ai-chat/components/ChatFeed.js";
import { ChatFeed } from "../features/ai-chat/components/ChatFeed.js";
import { ChatHeader } from "../features/ai-chat/components/ChatHeader.js";
import { ChatShell } from "../features/ai-chat/components/ChatShell.js";
import { useChatSession } from "../features/ai-chat/hooks/useChatSession.js";
import { useComposerViewport } from "../features/ai-chat/hooks/useComposerViewport.js";

type AiChatProps = {
  embedded?: boolean;
};

const SUGGESTION_CHIPS: readonly ChatStarterChip[] = [
  {
    id: "ger-easy",
    label: "Easy GER Options",
    prompt: "Find easy GER classes with lighter workload.",
    category: "Onboarding",
  },
  {
    id: "next-semester",
    label: "Plan Next Semester",
    prompt: "Help me plan a balanced schedule for next semester.",
    category: "Planning",
  },
  {
    id: "cs-picks",
    label: "Top CS Classes",
    prompt: "Recommend strong CS classes based on practical value.",
    category: "Major",
  },
  {
    id: "low-workload",
    label: "Low-workload Electives",
    prompt: "Suggest low-workload electives that still count for credit.",
    category: "Elective",
  },
] as const;

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyPreference = () => {
      setPrefersReducedMotion(mediaQuery.matches);
    };

    applyPreference();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", applyPreference);
      return () => {
        mediaQuery.removeEventListener("change", applyPreference);
      };
    }

    mediaQuery.addListener(applyPreference);
    return () => {
      mediaQuery.removeListener(applyPreference);
    };
  }, []);

  return prefersReducedMotion;
}

function resolveGreetingName() {
  if (typeof window === "undefined") return "there";

  const candidateKeys = [
    "betteratlas.user.fullName",
    "betteratlas.fullName",
    "fullName",
    "userFullName",
  ];
  for (const key of candidateKeys) {
    const raw = window.localStorage.getItem(key);
    if (raw && raw.trim().length > 0) {
      return raw.trim().split(/\s+/)[0];
    }
  }
  return "there";
}

export default function AiChat({ embedded = false }: AiChatProps) {
  const { keyboardInset, viewportHeight } = useComposerViewport();
  const prefersReducedMotion = usePrefersReducedMotion();
  const greetingName = resolveGreetingName();

  useEffect(() => {
    if (embedded) return;
    const html = document.documentElement;
    html.style.overflow = "hidden";
    html.style.height = "100dvh";
    return () => {
      html.style.overflow = "";
      html.style.height = "";
    };
  }, [embedded]);

  const {
    turns,
    draft,
    requestState,
    requestLifecycle,
    isSending,
    hasTurns,
    messagesEndRef,
    textareaRef,
    setDraft,
    sendPrompt,
    sendDraft,
    retryLastPrompt,
    resetChat,
  } = useChatSession();

  return (
    <div
      className={
        embedded
          ? "flex h-full min-h-0 w-full touch-pan-y"
          : "flex h-[calc(100dvh-4rem)] max-h-[calc(100dvh-4rem)] w-full overflow-hidden touch-pan-y px-3 py-3 sm:px-6 sm:py-5"
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
            requestLifecycle={requestLifecycle}
            prefersReducedMotion={prefersReducedMotion}
            suggestionChips={SUGGESTION_CHIPS}
            greetingName={greetingName}
            onSuggestionSelect={sendPrompt}
            onRetry={retryLastPrompt}
            endRef={messagesEndRef}
          />
        }
        composer={
          <ChatComposer
            value={draft}
            requestState={requestState}
            isSending={isSending}
            hasTurns={hasTurns}
            textareaRef={textareaRef}
            onValueChange={setDraft}
            onSubmit={sendDraft}
            onReset={resetChat}
          />
        }
      />
    </div>
  );
}
