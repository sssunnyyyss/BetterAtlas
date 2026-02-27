import type {
  AiCourseRecommendation,
  AiPreferenceCourse,
} from "../../../hooks/useAi.js";

export type ChatMessageRole = "user" | "assistant";

export type ChatRequestState = "idle" | "sending" | "success" | "error";

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
