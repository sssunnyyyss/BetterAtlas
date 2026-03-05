import type { ChatMessageRole, ChatRequestState } from "../model/chatTypes.js";

type ChatRoleToken = {
  rowClassName: string;
  widthClassName: string;
  labelClassName: string;
  bubbleClassName: string;
  label: string;
};

type ChatStatusToken = {
  containerClassName: string;
  iconClassName: string;
  textClassName: string;
  label: string;
};

export const chatRoleTokens: Record<ChatMessageRole, ChatRoleToken> = {
  user: {
    rowClassName: "flex justify-end",
    widthClassName: "max-w-[92%] sm:max-w-[80%]",
    labelClassName: "mb-1 text-right text-xs font-semibold uppercase tracking-wide text-[#8a8378]",
    bubbleClassName:
      "rounded-2xl rounded-br-sm bg-[#f7efe2] px-4 py-2.5 text-[#2f2d2a] shadow-sm",
    label: "You",
  },
  assistant: {
    rowClassName: "flex justify-start",
    widthClassName: "max-w-[96%] sm:max-w-[88%]",
    labelClassName: "mb-1 text-xs font-semibold uppercase tracking-wide text-[#8a8378]",
    bubbleClassName:
      "rounded-2xl rounded-tl-sm bg-white px-4 py-2.5 text-[#1f1e1d] shadow-sm",
    label: "Atlas AI",
  },
};

export const chatStatusTokens: Record<
  Exclude<ChatRequestState, "idle">,
  ChatStatusToken
> = {
  sending: {
    containerClassName: "border-gray-200 bg-gray-50",
    iconClassName: "text-gray-500",
    textClassName: "text-gray-700",
    label: "Analyzing your request...",
  },
  success: {
    containerClassName: "border-emerald-200 bg-emerald-50",
    iconClassName: "text-emerald-600",
    textClassName: "text-emerald-700",
    label: "Response received.",
  },
  error: {
    containerClassName: "border-red-200 bg-red-50",
    iconClassName: "text-red-600",
    textClassName: "text-red-700",
    label: "Something went wrong. Please try again.",
  },
};
