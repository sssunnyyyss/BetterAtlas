import type { ReactNode } from "react";
import type { ChatMessageRole } from "../model/chatTypes.js";
import { chatRoleTokens } from "../styles/chatTokens.js";

type ChatMessageBubbleProps = {
  role: ChatMessageRole;
  children: ReactNode;
  className?: string;
  label?: string;
  showLabel?: boolean;
  align?: "auto" | "none";
};

export function ChatMessageBubble({
  role,
  children,
  className,
  label,
  showLabel = true,
  align = "auto",
}: ChatMessageBubbleProps) {
  const roleToken = chatRoleTokens[role];

  const content = (
    <div className={align === "auto" ? roleToken.widthClassName : undefined}>
      {showLabel && (
        <p className={roleToken.labelClassName}>{label ?? roleToken.label}</p>
      )}
      <div className={`${roleToken.bubbleClassName} ${className ?? ""}`}>
        {children}
      </div>
    </div>
  );

  if (align === "none") {
    return content;
  }

  return <div className={roleToken.rowClassName}>{content}</div>;
}
