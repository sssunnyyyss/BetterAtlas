type ChatHeaderProps = {
  title?: string;
  hasTurns: boolean;
  onReset: () => void;
};

export function ChatHeader({
  title = "Atlas AI",
  hasTurns,
  onReset,
}: ChatHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-gray-200 bg-gradient-to-b from-white to-gray-50 px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-100">
          <svg
            className="h-5 w-5 text-primary-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
            />
          </svg>
        </div>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
          <p className="text-xs text-gray-500">Course planning assistant</p>
        </div>
      </div>
      {hasTurns && (
        <button
          type="button"
          onClick={onReset}
          className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-sm text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-800"
        >
          New chat
        </button>
      )}
    </div>
  );
}
