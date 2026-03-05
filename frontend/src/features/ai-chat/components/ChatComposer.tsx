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
  void requestState;

  return (
    <div
      className="shrink-0 bg-[#fcfcf9] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
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
