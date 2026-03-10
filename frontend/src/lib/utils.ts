export function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

export function formatRating(value: number | null): string {
  if (value === null) return "N/A";
  return value.toFixed(1);
}

export function getRatingColor(value: number | null): string {
  if (value === null) return "#9ca3af"; // gray-400
  if (value >= 4.5) return "#22c55e"; // bright green
  if (value >= 4.0) return "#86efac"; // lighter green
  if (value >= 3.5) return "#eab308"; // yellow-500
  if (value >= 3.0) return "#ca8a04"; // amber-600
  return "#ef4444"; // red-500
}

export function getDifficultyColor(value: number | null): string {
  if (value === null) return "#9ca3af"; // gray-400
  if (value >= 4.5) return "#991b1b"; // red-800 (hardest)
  if (value >= 4.0) return "#dc2626"; // red-600
  if (value >= 3.5) return "#ef4444"; // red-500
  if (value >= 3.0) return "#ca8a04"; // amber-600
  return "#22c55e"; // bright green (easiest)
}
