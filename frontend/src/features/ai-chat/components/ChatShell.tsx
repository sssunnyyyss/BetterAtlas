import type { ReactNode } from "react";
import type { ChatShellMode } from "../model/chatTypes.js";

type ChatShellProps = {
  mode?: ChatShellMode;
  header: ReactNode;
  feed: ReactNode;
  composer: ReactNode;
};

export function ChatShell({
  mode = "standalone",
  header,
  feed,
  composer,
}: ChatShellProps) {
  return (
    <div
      className={
        mode === "embedded"
          ? "flex h-full w-full flex-col bg-white"
          : "mx-auto flex h-[calc(100vh-4rem)] w-full max-w-3xl flex-col bg-white"
      }
    >
      <div className="shrink-0">{header}</div>
      <div className="min-h-0 flex-1">{feed}</div>
      <div className="shrink-0">{composer}</div>
    </div>
  );
}
