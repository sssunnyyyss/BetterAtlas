import { useMemo, type CSSProperties } from "react";
import type { HighlightRect } from "./TourOverlay.js";

interface TourTooltipProps {
  title: string;
  body: string;
  progressText: string;
  targetRect: HighlightRect | null;
  isLastStep: boolean;
  isBusy?: boolean;
  isInteractive?: boolean;
  isInteractionComplete?: boolean;
  actionLabel?: string;
  onNext: () => void | Promise<void>;
  onSkip: () => void | Promise<void>;
}

const CARD_WIDTH = 360;
const CARD_ESTIMATED_HEIGHT = 196;
const VIEWPORT_GUTTER = 12;

function getTooltipStyle(targetRect: HighlightRect | null): CSSProperties {
  if (typeof window === "undefined") {
    return {
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: CARD_WIDTH,
    };
  }

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const width = Math.min(CARD_WIDTH, viewportWidth - VIEWPORT_GUTTER * 2);

  if (!targetRect) {
    return {
      top: Math.max(VIEWPORT_GUTTER, viewportHeight / 2 - CARD_ESTIMATED_HEIGHT / 2),
      left: Math.max(VIEWPORT_GUTTER, viewportWidth / 2 - width / 2),
      width,
    };
  }

  const anchorCenter = targetRect.left + targetRect.width / 2;
  const left = Math.min(
    Math.max(VIEWPORT_GUTTER, anchorCenter - width / 2),
    viewportWidth - width - VIEWPORT_GUTTER
  );

  const canPlaceBelow =
    targetRect.top + targetRect.height + CARD_ESTIMATED_HEIGHT + VIEWPORT_GUTTER <=
    viewportHeight;

  const top = canPlaceBelow
    ? targetRect.top + targetRect.height + VIEWPORT_GUTTER
    : Math.max(VIEWPORT_GUTTER, targetRect.top - CARD_ESTIMATED_HEIGHT - VIEWPORT_GUTTER);

  return { top, left, width };
}

export default function TourTooltip({
  title,
  body,
  progressText,
  targetRect,
  isLastStep,
  isBusy = false,
  isInteractive = false,
  isInteractionComplete = false,
  actionLabel,
  onNext,
  onSkip,
}: TourTooltipProps) {
  const style = useMemo(() => getTooltipStyle(targetRect), [targetRect]);

  const nextDisabled = isBusy || (isInteractive && !isInteractionComplete);

  let nextLabel: string;
  if (isBusy) {
    nextLabel = "Saving...";
  } else if (isInteractive && isInteractionComplete) {
    nextLabel = "Continue";
  } else if (isLastStep) {
    nextLabel = "Finish";
  } else {
    nextLabel = "Next";
  }

  return (
    <aside
      className="fixed z-[80] rounded-xl border border-gray-200 bg-white p-4 shadow-2xl"
      style={style}
      aria-live="polite"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary-600">
        {progressText}
      </p>
      <h3 className="mt-2 text-lg font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-600">{body}</p>

      {isInteractive && (
        <div className="mt-2 flex items-center gap-2 text-sm">
          {isInteractionComplete ? (
            <>
              <svg className="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="font-medium text-green-700">Done!</span>
            </>
          ) : (
            <>
              <span className="text-primary-600">→</span>
              <span className="font-medium text-primary-700">{actionLabel}</span>
            </>
          )}
        </div>
      )}

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => void onSkip()}
          disabled={isBusy}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Skip tour
        </button>
        <button
          type="button"
          onClick={() => void onNext()}
          disabled={nextDisabled}
          className="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {nextLabel}
        </button>
      </div>
    </aside>
  );
}
