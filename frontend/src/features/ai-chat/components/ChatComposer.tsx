import type { MutableRefObject } from "react";
import { ClaudeChatInput } from "../../../components/ui/claude-style-chat-input.js";
import type { ChatRequestState } from "../model/chatTypes.js";

type ChatComposerProps = {
  value: string;
  requestState: ChatRequestState;
  isSending: boolean;
  hasTurns: boolean;
  textareaRef: MutableRefObject<HTMLTextAreaElement | null>;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  onReset?: () => void;
};

export function ChatComposer({
  value,
  requestState,
  isSending,
  hasTurns,
  textareaRef,
  onValueChange,
  onSubmit,
  onReset,
}: ChatComposerProps) {
  void requestState;

  const handleComposerWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (Math.abs(event.deltaY) < 1) return;

    const shell = event.currentTarget.closest('[data-testid^="chat-shell-"]');
    const feed = shell?.querySelector<HTMLElement>(
      '[data-testid="chat-feed-scroll-container"]',
    );
    if (!feed) return;
    if (feed.scrollHeight <= feed.clientHeight) return;

    feed.scrollBy({ top: event.deltaY, behavior: "auto" });
    event.preventDefault();
  };

  return (
    <div
      className="shrink-0 bg-[#fcfcf9] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
      data-testid="chat-composer-shell"
      onWheelCapture={handleComposerWheel}
    >
      {hasTurns && onReset ? (
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={onReset}
            className="rounded-lg border border-[#e0dbcf] bg-white px-2.5 py-1 text-xs font-medium text-[#66625a] transition-colors hover:border-[#cbc1af] hover:text-[#2f2b24]"
            data-testid="chat-composer-reset"
          >
            New session
          </button>
        </div>
      ) : null}
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
