import type { Badge } from "@betteratlas/shared";
import UserBadge from "../ui/UserBadge.js";

interface BadgeRevealProps {
  badge: Badge | null;
}

export default function BadgeReveal({ badge }: BadgeRevealProps) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-yellow-50 to-white p-8 text-center shadow-sm">
      <div className="ob-badge-glow mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-3xl">
        {badge?.icon || "\uD83C\uDF1F"}
      </div>
      <div>
        {badge ? (
          <UserBadge badge={badge} className="px-4 py-2 text-base" />
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-base font-medium text-amber-800">
            🌟 Early Adopter
          </span>
        )}
      </div>
      <p className="mt-4 text-sm text-gray-500">
        {badge?.description || "Joined during the BetterAtlas beta."}
      </p>
    </div>
  );
}
