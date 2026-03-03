import { useId, useState, type ReactNode } from "react";

type RecommendationDisclosureProps = {
  label: string;
  expandedLabel?: string;
  children: ReactNode;
  defaultExpanded?: boolean;
  testId?: string;
};

export function RecommendationDisclosure({
  label,
  expandedLabel,
  children,
  defaultExpanded = false,
  testId,
}: RecommendationDisclosureProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const contentId = useId();

  return (
    <div className="mt-2">
      <button
        type="button"
        className="ba-chat-focus-ring inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-xs font-semibold text-gray-600 hover:text-gray-900"
        onClick={() => setExpanded((previous) => !previous)}
        aria-expanded={expanded}
        aria-controls={contentId}
        data-testid={testId}
      >
        <svg
          className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-90" : ""}`.trim()}
          fill="none"
          viewBox="0 0 20 20"
          strokeWidth={2}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 5l6 5-6 5" />
        </svg>
        <span>{expanded ? (expandedLabel ?? label) : label}</span>
      </button>
      {expanded && (
        <div
          id={contentId}
          className="ba-chat-disclosure-content mt-1"
          data-testid={testId ? `${testId}-content` : undefined}
        >
          {children}
        </div>
      )}
    </div>
  );
}
