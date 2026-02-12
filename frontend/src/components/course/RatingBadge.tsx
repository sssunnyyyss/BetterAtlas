import { formatRating, getRatingColor } from "../../lib/utils.js";

interface RatingBadgeProps {
  value: number | null;
  label: string;
}

export default function RatingBadge({ value, label }: RatingBadgeProps) {
  const color = getRatingColor(value);

  return (
    <div className="flex flex-col items-center">
      <span
        className="text-lg font-bold rounded-md px-2 py-0.5"
        style={{ color, backgroundColor: `${color}18` }}
      >
        {formatRating(value)}
      </span>
      <span className="text-xs text-gray-500 mt-0.5">{label}</span>
    </div>
  );
}
