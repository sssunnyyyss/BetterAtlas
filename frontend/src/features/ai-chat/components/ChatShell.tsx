import type { ReactNode } from "react";

type ChatShellProps = {
  variant?: ChatShellVariant;
  header: ReactNode;
  feed: ReactNode;
  composer: ReactNode;
  composerInset?: number;
};

export type ChatShellVariant = "standalone" | "embedded";

export function ChatShell({
  variant = "standalone",
  header,
  feed,
  composer,
  composerInset = 0,
}: ChatShellProps) {
  return (
    <div
      data-testid={`chat-shell-${variant}`}
      className={
        variant === "embedded"
          ? "flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#fcfcf9]"
          : "mx-auto flex h-full min-h-0 w-full max-w-3xl flex-1 flex-col overflow-hidden rounded-2xl border border-[#ebe8df] bg-[#fcfcf9] shadow-sm"
      }
    >
      <div className="shrink-0" data-testid="chat-zone-header">
        {header}
      </div>
      <div className="min-h-0 flex-1" data-testid="chat-zone-feed">
        {feed}
      </div>
      <div
        className="shrink-0 transition-[padding] duration-150"
        data-testid="chat-zone-composer"
        data-keyboard-inset={composerInset}
        style={
          composerInset > 0
            ? { paddingBottom: `${composerInset}px` }
            : undefined
        }
      >
        {composer}
      </div>
    </div>
  );
}
