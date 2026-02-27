import { useEffect, type MutableRefObject } from "react";
import type { ChatRequestState } from "../model/chatTypes.js";
import { chatStatusTokens } from "../styles/chatTokens.js";

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
  const statusToken =
    requestState === "idle" ? null : chatStatusTokens[requestState];

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
  }, [textareaRef, value]);

  return (
    <div className="px-4 pb-4 pt-2">
      <div className="rounded-2xl border border-gray-200 bg-gray-50 transition-all focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-100">
        <div className="flex items-end gap-2 p-2">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (!isSending && value.trim()) {
                  onSubmit();
                }
              }
            }}
            placeholder="Ask about classes..."
            rows={1}
            className="ba-chat-composer-textarea max-h-[150px] flex-1 border-none bg-transparent px-2 py-1.5 text-sm text-gray-900 outline-none placeholder:text-gray-400"
          />
          <button
            type="button"
            onClick={onSubmit}
            disabled={!value.trim() || isSending}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-600 text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Send message"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18"
              />
            </svg>
          </button>
        </div>
      </div>
      {statusToken && (
        <p className={`mt-2 text-center text-xs font-semibold ${statusToken.textClassName}`}>
          {statusToken.label}
        </p>
      )}
      <p className="mt-2 text-center text-xs text-gray-400">
        AI results can be inaccurate. Always verify course details in the
        catalog.
      </p>
    </div>
  );
}
