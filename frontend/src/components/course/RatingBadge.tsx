import { formatRating, getDifficultyColor, getRatingColor } from "../../lib/utils.js";

interface RatingBadgeProps {
  value: number | null;
  label: string;
  size?: "sm" | "md";
}

export default function RatingBadge({ value, label, size = "md" }: RatingBadgeProps) {
  const isDifficultyLabel = /^(d|diff|difficulty)$/i.test(label.trim());
  const color = isDifficultyLabel ? getDifficultyColor(value) : getRatingColor(value);
  const valueClass =
    size === "sm"
      ? "text-base font-bold rounded-md px-1.5 py-0.5"
      : "text-lg font-bold rounded-md px-2 py-0.5";
  const labelClass = size === "sm" ? "text-[11px] text-gray-500 mt-0.5" : "text-xs text-gray-500 mt-0.5";

  return (
    <div className="flex flex-col items-center">
      <span
        className={valueClass}
        style={{ color, backgroundColor: `${color}18` }}
      >
        {formatRating(value)}
      </span>
      <span className={labelClass}>{label}</span>
    </div>
  );
}
