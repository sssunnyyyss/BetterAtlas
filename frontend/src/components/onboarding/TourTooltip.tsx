import { useMemo, type CSSProperties } from "react";
import type { HighlightRect } from "./TourOverlay.js";

interface TourTooltipProps {
  title: string;
  body: string;
  progressText: string;
  targetRect: HighlightRect | null;
  isLastStep: boolean;
  isBusy?: boolean;
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
  onNext,
  onSkip,
}: TourTooltipProps) {
  const style = useMemo(() => getTooltipStyle(targetRect), [targetRect]);

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
          disabled={isBusy}
          className="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isBusy ? "Saving..." : isLastStep ? "Finish" : "Next"}
        </button>
      </div>
    </aside>
  );
}
