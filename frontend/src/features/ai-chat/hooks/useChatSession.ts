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
  ChatLifecycleTransitionReason,
  ChatRequestLifecycle,
  ChatRequestState,
  ChatTurn,
  StoredPreferences,
} from "../model/chatTypes.js";

const PREFERENCES_KEY = "betteratlas.ai.preferences.v1";
const REQUEST_SETTLE_MS = 1200;

type PromptSendSource = Extract<
  ChatLifecycleTransitionReason,
  "send" | "retry" | "deep-link"
>;

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

function createInitialLifecycle(): ChatRequestLifecycle {
  const now = Date.now();
  return {
    requestToken: 0,
    transitionSequence: 0,
    lastTransitionAt: now,
    lastTransitionFrom: "idle",
    lastTransitionTo: "idle",
    lastTransitionReason: "reset",
    settleDelayMs: REQUEST_SETTLE_MS,
    settleDeadlineAt: null,
    lastSubmittedPrompt: null,
    lastFailedPrompt: null,
    lastErrorMessage: null,
  };
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }
  return "Something went wrong. Please try again.";
}

export type ChatSessionApi = {
  turns: ChatTurn[];
  draft: string;
  requestState: ChatRequestState;
  requestLifecycle?: ChatRequestLifecycle;
  isSending: boolean;
  hasTurns: boolean;
  messagesEndRef: MutableRefObject<HTMLDivElement | null>;
  textareaRef: MutableRefObject<HTMLTextAreaElement | null>;
  setDraft: (value: string) => void;
  sendPrompt: (prompt: string) => void;
  sendDraft: () => void;
  retryLastPrompt?: () => void;
  resetChat: () => void;
};

export function useChatSession(): ChatSessionApi {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([]);
  const [requestState, setRequestState] = useState<ChatRequestState>("idle");
  const [requestLifecycle, setRequestLifecycle] = useState<ChatRequestLifecycle>(
    () => createInitialLifecycle(),
  );
  const [searchParams] = useSearchParams();
  const deepLinkAppliedRef = useRef(false);
  const aiMessagesRef = useRef<AiMessage[]>([]);
  const requestStateRef = useRef<ChatRequestState>("idle");
  const activeRequestTokenRef = useRef(0);
  const settleTimerRef = useRef<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [preferences] = useState(loadPreferences);
  const aiRec = useAiCourseRecommendations();

  useEffect(() => {
    aiMessagesRef.current = aiMessages;
  }, [aiMessages]);

  const clearSettleTimer = useCallback(() => {
    if (settleTimerRef.current === null) return;
    window.clearTimeout(settleTimerRef.current);
    settleTimerRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      clearSettleTimer();
    };
  }, [clearSettleTimer]);

  const applyRequestTransition = useCallback(
    (
      nextState: ChatRequestState,
      reason: ChatLifecycleTransitionReason,
      lifecyclePatch: Partial<ChatRequestLifecycle> = {},
    ) => {
      const previousState = requestStateRef.current;
      if (previousState === nextState) {
        return;
      }

      const now = Date.now();
      requestStateRef.current = nextState;
      setRequestState(nextState);
      setRequestLifecycle((previousLifecycle) => ({
        ...previousLifecycle,
        ...lifecyclePatch,
        transitionSequence: previousLifecycle.transitionSequence + 1,
        lastTransitionAt: now,
        lastTransitionFrom: previousState,
        lastTransitionTo: nextState,
        lastTransitionReason: reason,
      }));
    },
    [],
  );

  const scheduleSettleToIdle = useCallback(
    (requestToken: number) => {
      clearSettleTimer();
      const settleDeadlineAt = Date.now() + REQUEST_SETTLE_MS;
      setRequestLifecycle((previousLifecycle) => ({
        ...previousLifecycle,
        settleDeadlineAt,
      }));

      settleTimerRef.current = window.setTimeout(() => {
        settleTimerRef.current = null;
        if (activeRequestTokenRef.current !== requestToken) {
          return;
        }

        applyRequestTransition("idle", "settle-idle", {
          requestToken,
          settleDeadlineAt: null,
        });
      }, REQUEST_SETTLE_MS);
    },
    [applyRequestTransition, clearSettleTimer],
  );

  useEffect(() => {
    if (window.innerWidth >= 640) {
      textareaRef.current?.focus();
    }
  }, []);

  const sendPromptWithSource = useCallback(
    (text: string, source: PromptSendSource) => {
      const trimmed = text.trim();
      if (!trimmed || aiRec.isPending) return;

      clearSettleTimer();
      const requestToken = activeRequestTokenRef.current + 1;
      activeRequestTokenRef.current = requestToken;

      applyRequestTransition("sending", source, {
        requestToken,
        settleDeadlineAt: null,
        lastSubmittedPrompt: trimmed,
        lastErrorMessage: null,
        ...(source === "retry" ? {} : { lastFailedPrompt: null }),
      });

      const nextUserTurn: ChatTurn = {
        id: createTurnId(),
        role: "user",
        content: trimmed,
      };
      setTurns((previousTurns) => [...previousTurns, nextUserTurn]);
      setDraft("");

      const nextMessages: AiMessage[] = [
        ...aiMessagesRef.current,
        { role: "user" as const, content: trimmed },
      ].slice(-12);
      aiMessagesRef.current = nextMessages;
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
            if (activeRequestTokenRef.current !== requestToken) {
              return;
            }

            const nextAssistantTurn: ChatTurn = {
              id: createTurnId(),
              role: "assistant",
              content: response.assistantMessage,
              recommendations: response.recommendations,
              followUp: response.followUpQuestion,
            };

            setTurns((previousTurns) => [...previousTurns, nextAssistantTurn]);
            setAiMessages((previousMessages) => {
              const nextAssistantMessages = [
                ...previousMessages,
                {
                  role: "assistant" as const,
                  content: response.assistantMessage,
                },
              ].slice(-12);
              aiMessagesRef.current = nextAssistantMessages;
              return nextAssistantMessages;
            });

            applyRequestTransition("success", "response-success", {
              requestToken,
              lastFailedPrompt: null,
              lastErrorMessage: null,
            });
            scheduleSettleToIdle(requestToken);
          },
          onError: (error) => {
            if (activeRequestTokenRef.current !== requestToken) {
              return;
            }

            applyRequestTransition("error", "response-error", {
              requestToken,
              lastFailedPrompt: trimmed,
              lastErrorMessage: readErrorMessage(error),
            });
            scheduleSettleToIdle(requestToken);
          },
        },
      );
    },
    [
      aiRec,
      applyRequestTransition,
      clearSettleTimer,
      preferences.disliked,
      preferences.liked,
      scheduleSettleToIdle,
    ],
  );

  const sendPrompt = useCallback(
    (text: string) => {
      sendPromptWithSource(text, "send");
    },
    [sendPromptWithSource],
  );

  const sendDraft = useCallback(() => {
    sendPrompt(draft);
  }, [draft, sendPrompt]);

  const retryLastPrompt = useCallback(() => {
    if (!requestLifecycle.lastFailedPrompt) return;
    sendPromptWithSource(requestLifecycle.lastFailedPrompt, "retry");
  }, [requestLifecycle.lastFailedPrompt, sendPromptWithSource]);

  const resetChat = useCallback(() => {
    clearSettleTimer();
    const previousState = requestStateRef.current;
    const requestToken = activeRequestTokenRef.current + 1;
    activeRequestTokenRef.current = requestToken;
    requestStateRef.current = "idle";

    setTurns([]);
    aiMessagesRef.current = [];
    setAiMessages([]);
    setDraft("");
    setRequestState("idle");
    setRequestLifecycle((previousLifecycle) => ({
      ...previousLifecycle,
      requestToken,
      transitionSequence: previousLifecycle.transitionSequence + 1,
      lastTransitionAt: Date.now(),
      lastTransitionFrom: previousState,
      lastTransitionTo: "idle",
      lastTransitionReason: "reset",
      settleDeadlineAt: null,
      lastSubmittedPrompt: null,
      lastFailedPrompt: null,
      lastErrorMessage: null,
    }));
    aiRec.mutate({ reset: true });
  }, [aiRec, clearSettleTimer]);

  useEffect(() => {
    if (deepLinkAppliedRef.current) return;
    if (turns.length > 0) return;

    const prompt = searchParams.get("prompt")?.trim();
    if (!prompt) return;

    deepLinkAppliedRef.current = true;
    sendPromptWithSource(prompt, "deep-link");
  }, [searchParams, sendPromptWithSource, turns.length]);

  return {
    turns,
    draft,
    requestState,
    requestLifecycle,
    isSending: requestState === "sending",
    hasTurns: turns.length > 0,
    messagesEndRef,
    textareaRef,
    setDraft,
    sendPrompt,
    sendDraft,
    retryLastPrompt,
    resetChat,
  };
}
