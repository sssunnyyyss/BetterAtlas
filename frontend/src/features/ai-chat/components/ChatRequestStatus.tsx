import type {
  ChatRequestLifecycle,
  ChatRequestState,
} from "../model/chatTypes.js";
import { chatStatusTokens } from "../styles/chatTokens.js";

type ChatRequestStatusProps = {
  requestState: ChatRequestState;
  requestLifecycle?: ChatRequestLifecycle;
  prefersReducedMotion: boolean;
  onRetry?: () => void;
};

function SendingIcon({ prefersReducedMotion }: { prefersReducedMotion: boolean }) {
  const dotClassName = prefersReducedMotion
    ? "h-2 w-2 rounded-full bg-current"
    : "h-2 w-2 animate-bounce rounded-full bg-current";

  return (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      <span className={`${dotClassName} [animation-delay:0ms]`} />
      <span className={`${dotClassName} [animation-delay:150ms]`} />
      <span className={`${dotClassName} [animation-delay:300ms]`} />
    </div>
  );
}

function SuccessIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function ErrorIcon() {
  return (
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
        d="M12 9v3m0 3h.01M5.25 19.5h13.5a1.5 1.5 0 001.299-2.25L13.3 5.25a1.5 1.5 0 00-2.598 0L3.95 17.25A1.5 1.5 0 005.25 19.5z"
      />
    </svg>
  );
}

function StatusIcon({
  requestState,
  prefersReducedMotion,
}: {
  requestState: Exclude<ChatRequestState, "idle">;
  prefersReducedMotion: boolean;
}) {
  if (requestState === "sending") {
    return <SendingIcon prefersReducedMotion={prefersReducedMotion} />;
  }
  if (requestState === "success") {
    return <SuccessIcon />;
  }
  return <ErrorIcon />;
}

export function ChatRequestStatus({
  requestState,
  requestLifecycle,
  prefersReducedMotion,
  onRetry,
}: ChatRequestStatusProps) {
  if (requestState === "idle") {
    return null;
  }

  const token = chatStatusTokens[requestState];
  const label =
    requestState === "error" &&
    requestLifecycle?.lastErrorMessage &&
    requestLifecycle.lastErrorMessage.trim().length > 0
      ? requestLifecycle.lastErrorMessage
      : token.label;
  const canRetry =
    requestState === "error" &&
    typeof onRetry === "function" &&
    requestLifecycle?.lastFailedPromptPayload != null;

  return (
    <div
      className={`rounded-xl border px-3 py-2 ${token.containerClassName} ${prefersReducedMotion ? "" : "ba-chat-status-transition"}`.trim()}
      role={requestState === "error" ? "alert" : "status"}
      aria-live={requestState === "error" ? "assertive" : "polite"}
      data-testid="chat-request-status"
      data-request-state={requestState}
      data-transition-sequence={requestLifecycle?.transitionSequence}
      data-transition-reason={requestLifecycle?.lastTransitionReason}
    >
      <div className={`flex items-center gap-2 ${token.iconClassName}`}>
        <StatusIcon
          requestState={requestState}
          prefersReducedMotion={prefersReducedMotion}
        />
        <p className={`text-xs font-semibold ${token.textClassName}`}>
          {label}
        </p>
      </div>
      {canRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-700 transition-colors hover:border-red-300 hover:bg-red-50"
          data-testid="chat-request-retry"
        >
          Retry last request
        </button>
      )}
    </div>
  );
}
