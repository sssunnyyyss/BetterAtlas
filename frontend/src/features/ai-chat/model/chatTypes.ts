import type {
  AiCourseRecommendation,
  AiPreferenceCourse,
} from "../../../hooks/useAi.js";

export type ChatMessageRole = "user" | "assistant";

export type ChatRequestState = "idle" | "sending" | "success" | "error";

export type ChatLifecycleTransitionReason =
  | "send"
  | "retry"
  | "deep-link"
  | "response-success"
  | "response-error"
  | "settle-idle"
  | "reset";

export type ChatRequestLifecycle = {
  requestToken: number;
  transitionSequence: number;
  lastTransitionAt: number;
  lastTransitionFrom: ChatRequestState;
  lastTransitionTo: ChatRequestState;
  lastTransitionReason: ChatLifecycleTransitionReason;
  settleDelayMs: number;
  settleDeadlineAt: number | null;
  lastSubmittedPrompt: string | null;
  lastFailedPrompt: string | null;
  lastErrorMessage: string | null;
};

type ChatTurnBase = {
  id: string;
  role: ChatMessageRole;
  content: string;
};

export type UserChatTurn = ChatTurnBase & {
  role: "user";
};

export type AssistantChatTurn = ChatTurnBase & {
  role: "assistant";
  recommendations: AiCourseRecommendation[];
  followUp: string | null;
};

export type ChatTurn = UserChatTurn | AssistantChatTurn;

export type StoredPreferences = {
  liked: AiPreferenceCourse[];
  disliked: AiPreferenceCourse[];
};

export type ChatShellMode = "standalone" | "embedded";
