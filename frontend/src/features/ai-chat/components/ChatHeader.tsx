import { RotateCcw, Sparkles } from "lucide-react";

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
    <div className="border-b border-[#e7dfcf] bg-[#fcfcf9] px-4 py-4 sm:px-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#eadfcd] bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a7864]">
            <Sparkles className="h-3.5 w-3.5" />
            Currently under development
          </div>
          <h1 className="text-2xl font-semibold text-[#1f1e1d] sm:text-[2rem]">{title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-[#6c675f]">
            This feature is not available right now. Atlas AI is currently under development and
            will be available soon.
          </p>
          <p className="mt-2 max-w-2xl text-sm text-[#6c675f]">
            You can still preview the interface while we keep tuning the experience across desktop
            and mobile.
          </p>
        </div>

        {hasTurns ? (
          <button
            type="button"
            onClick={onReset}
            className="ba-chat-focus-ring hidden shrink-0 items-center gap-2 rounded-full border border-[#dccfb9] bg-white px-3 py-2 text-xs font-semibold text-[#4b4339] transition hover:border-[#c9b89d] hover:bg-[#fffaf2] sm:inline-flex"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            New chat
          </button>
        ) : null}
      </div>
    </div>
  );
}
