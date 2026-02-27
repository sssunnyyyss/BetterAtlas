import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { useSearchParams } from "react-router-dom";
import {
  useAiCourseRecommendations,
  type AiMessage,
} from "../../../hooks/useAi.js";
import type {
  ChatRequestState,
  ChatTurn,
  StoredPreferences,
} from "../model/chatTypes.js";

const PREFERENCES_KEY = "betteratlas.ai.preferences.v1";

function createTurnId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function loadPreferences(): StoredPreferences {
  try {
    const raw = localStorage.getItem(PREFERENCES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredPreferences;
      return {
        liked: Array.isArray(parsed.liked) ? parsed.liked : [],
        disliked: Array.isArray(parsed.disliked) ? parsed.disliked : [],
      };
    }
  } catch {
    // Ignore malformed local storage payloads.
  }

  return { liked: [], disliked: [] };
}

export type ChatSessionApi = {
  turns: ChatTurn[];
  draft: string;
  requestState: ChatRequestState;
  isSending: boolean;
  hasTurns: boolean;
  messagesEndRef: MutableRefObject<HTMLDivElement | null>;
  textareaRef: MutableRefObject<HTMLTextAreaElement | null>;
  setDraft: (value: string) => void;
  sendPrompt: (prompt: string) => void;
  sendDraft: () => void;
  resetChat: () => void;
};

export function useChatSession(): ChatSessionApi {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([]);
  const [requestState, setRequestState] = useState<ChatRequestState>("idle");
  const [searchParams] = useSearchParams();
  const deepLinkAppliedRef = useRef(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [preferences] = useState(loadPreferences);
  const aiRec = useAiCourseRecommendations();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, requestState]);

  useEffect(() => {
    if (window.innerWidth >= 640) {
      textareaRef.current?.focus();
    }
  }, []);

  const sendPrompt = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || aiRec.isPending) return;

      setRequestState("sending");

      const nextUserTurn: ChatTurn = {
        id: createTurnId(),
        role: "user",
        content: trimmed,
      };
      setTurns((previousTurns) => [...previousTurns, nextUserTurn]);
      setDraft("");

      const nextMessages: AiMessage[] = [
        ...aiMessages,
        { role: "user" as const, content: trimmed },
      ].slice(-12);
      setAiMessages(nextMessages);

      aiRec.mutate(
        {
          messages: nextMessages,
          preferences:
            preferences.liked.length > 0 || preferences.disliked.length > 0
              ? {
                  liked: preferences.liked,
                  disliked: preferences.disliked,
                }
              : undefined,
        },
        {
          onSuccess: (response) => {
            const nextAssistantTurn: ChatTurn = {
              id: createTurnId(),
              role: "assistant",
              content: response.assistantMessage,
              recommendations: response.recommendations,
              followUp: response.followUpQuestion,
            };

            setTurns((previousTurns) => [...previousTurns, nextAssistantTurn]);
            setAiMessages((previousMessages) => [
              ...previousMessages,
              {
                role: "assistant" as const,
                content: response.assistantMessage,
              },
            ]);
            setRequestState("success");
          },
          onError: () => {
            setRequestState("error");
          },
        },
      );
    },
    [aiMessages, aiRec, preferences.disliked, preferences.liked],
  );

  const sendDraft = useCallback(() => {
    sendPrompt(draft);
  }, [draft, sendPrompt]);

  const resetChat = useCallback(() => {
    setTurns([]);
    setAiMessages([]);
    setDraft("");
    setRequestState("idle");
    aiRec.mutate({ reset: true });
  }, [aiRec]);

  useEffect(() => {
    if (deepLinkAppliedRef.current) return;
    if (turns.length > 0) return;

    const prompt = searchParams.get("prompt")?.trim();
    if (!prompt) return;

    deepLinkAppliedRef.current = true;
    sendPrompt(prompt);
  }, [searchParams, sendPrompt, turns.length]);

  return {
    turns,
    draft,
    requestState,
    isSending: requestState === "sending",
    hasTurns: turns.length > 0,
    messagesEndRef,
    textareaRef,
    setDraft,
    sendPrompt,
    sendDraft,
    resetChat,
  };
}
