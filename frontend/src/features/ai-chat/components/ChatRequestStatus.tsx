import { useEffect, useMemo, useState } from "react";
import { TextShimmer } from "../../../components/ui/text-shimmer.js";
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

function deriveThinkingMessages(lastPrompt: string | null | undefined): string[] {
  const normalized = (lastPrompt ?? "").toLowerCase();
  const messages = ["Analyzing your request..."];

  if (normalized.includes("ger")) {
    messages.push("Matching GER options to your goals...");
  }
  if (
    normalized.includes("schedule") ||
    normalized.includes("semester") ||
    normalized.includes("plan")
  ) {
    messages.push("Balancing workload across your semester...");
  }
  if (
    normalized.includes("cs") ||
    normalized.includes("computer science") ||
    normalized.includes("major")
  ) {
    messages.push("Prioritizing major-relevant course picks...");
  }
  if (normalized.includes("elective") || normalized.includes("easy")) {
    messages.push("Filtering for lower-workload options...");
  }

  messages.push("Checking ratings, workload, and fit...");
  return Array.from(new Set(messages));
}

export function ChatRequestStatus({
  requestState,
  requestLifecycle,
  prefersReducedMotion,
  onRetry,
}: ChatRequestStatusProps) {
  const isIdle = requestState === "idle";
  const thinkingMessages = useMemo(
    () => deriveThinkingMessages(requestLifecycle?.lastSubmittedPrompt),
    [requestLifecycle?.lastSubmittedPrompt],
  );
  const [thinkingIndex, setThinkingIndex] = useState(0);

  useEffect(() => {
    if (requestState !== "sending") {
      setThinkingIndex(0);
      return;
    }

    const timer = window.setInterval(() => {
      setThinkingIndex((previous) => (previous + 1) % thinkingMessages.length);
    }, 1800);
    return () => window.clearInterval(timer);
  }, [requestState, thinkingMessages.length]);

  if (isIdle) {
    return null;
  }

  const token = chatStatusTokens[requestState];

  const label =
    requestState === "error" &&
    requestLifecycle?.lastErrorMessage &&
    requestLifecycle.lastErrorMessage.trim().length > 0
      ? requestLifecycle.lastErrorMessage
      : requestState === "sending"
        ? thinkingMessages[thinkingIndex] ?? token.label
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
        {requestState === "sending" ? (
          <TextShimmer
            as="p"
            className={`text-xs font-semibold ${token.textClassName} [--base-color:#6b7280] [--base-gradient-color:#111827]`}
            duration={1.4}
          >
            {label}
          </TextShimmer>
        ) : (
          <p className={`text-xs font-semibold ${token.textClassName}`}>{label}</p>
        )}
      </div>
      {canRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="ba-chat-focus-ring mt-2 rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-700 transition-colors hover:border-red-300 hover:bg-red-50"
          data-testid="chat-request-retry"
        >
          Retry last request
        </button>
      )}
    </div>
  );
}
