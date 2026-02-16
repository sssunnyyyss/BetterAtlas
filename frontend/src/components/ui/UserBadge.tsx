import type { Badge } from "@betteratlas/shared";
import { cn } from "../../lib/utils.js";

interface UserBadgeProps {
  badge: Badge;
  className?: string;
}

export default function UserBadge({ badge, className }: UserBadgeProps) {
  const isEarlyAdopter = badge.slug === "early-adopter";

  return (
    <span
      title={badge.description}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4",
        isEarlyAdopter
          ? "border-amber-300 bg-amber-50 text-amber-800"
          : "border-gray-200 bg-gray-50 text-gray-700",
        className
      )}
    >
      {badge.icon ? <span aria-hidden>{badge.icon}</span> : null}
      <span>{badge.name}</span>
    </span>
  );
}
