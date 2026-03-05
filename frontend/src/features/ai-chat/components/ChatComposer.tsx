import type { MutableRefObject } from "react";
import { ClaudeChatInput } from "../../../components/ui/claude-style-chat-input.js";
import type { ChatRequestState } from "../model/chatTypes.js";

type ChatComposerProps = {
  value: string;
  requestState: ChatRequestState;
  isSending: boolean;
  textareaRef: MutableRefObject<HTMLTextAreaElement | null>;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
};

export function ChatComposer({
  value,
  requestState,
  isSending,
  textareaRef,
  onValueChange,
  onSubmit,
}: ChatComposerProps) {
  const requestToneClassName =
    requestState === "error"
      ? "border-red-100 bg-red-50/30"
      : requestState === "success"
        ? "border-emerald-100 bg-emerald-50/20"
        : "border-gray-200 bg-white";

  return (
    <div
      className={`shrink-0 border-t border-gray-200 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 ${requestToneClassName}`}
      data-testid="chat-composer-shell"
    >
      <ClaudeChatInput
        value={value}
        onValueChange={onValueChange}
        isSending={isSending}
        textareaRef={textareaRef}
        onSendMessage={(payload) => {
          if (!payload.message.trim() || isSending) {
            return;
          }
          onSubmit();
        }}
        testIds={{
          textarea: "chat-composer-textarea",
          sendButton: "chat-composer-send",
        }}
      />
    </div>
  );
}
