import type { ChatRequestState } from "../model/chatTypes.js";
import { chatStatusTokens } from "../styles/chatTokens.js";

type ChatRequestStatusProps = {
  requestState: ChatRequestState;
};

function SendingIcon() {
  return (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      <span className="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:0ms]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:150ms]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:300ms]" />
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

function StatusIcon({ requestState }: { requestState: Exclude<ChatRequestState, "idle"> }) {
  if (requestState === "sending") {
    return <SendingIcon />;
  }
  if (requestState === "success") {
    return <SuccessIcon />;
  }
  return <ErrorIcon />;
}

export function ChatRequestStatus({ requestState }: ChatRequestStatusProps) {
  if (requestState === "idle") {
    return null;
  }

  const token = chatStatusTokens[requestState];

  return (
    <div
      className={`rounded-xl border px-3 py-2 ${token.containerClassName}`}
      role={requestState === "error" ? "alert" : "status"}
      aria-live={requestState === "error" ? "assertive" : "polite"}
    >
      <div className={`flex items-center gap-2 ${token.iconClassName}`}>
        <StatusIcon requestState={requestState} />
        <p className={`text-xs font-semibold ${token.textClassName}`}>
          {token.label}
        </p>
      </div>
    </div>
  );
}
