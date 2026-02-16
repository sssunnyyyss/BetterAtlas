import type { Badge } from "@betteratlas/shared";
import UserBadge from "../ui/UserBadge.js";

interface BadgeRevealProps {
  badge: Badge | null;
}

export default function BadgeReveal({ badge }: BadgeRevealProps) {
  return (
    <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 via-yellow-50 to-white p-6 text-center">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-2xl shadow-sm">
        {badge?.icon || "🌟"}
      </div>
      <div className="animate-[pulse_2.4s_ease-in-out_infinite]">
        {badge ? (
          <UserBadge badge={badge} className="px-3 py-1.5 text-sm" />
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800">
            🌟 Early Adopter
          </span>
        )}
      </div>
      <p className="mt-3 text-sm text-gray-600">
        {badge?.description || "Joined during the BetterAtlas beta."}
      </p>
    </div>
  );
}
