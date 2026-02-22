import { getRatingColor } from "@betteratlas/shared";

export function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

export function formatRating(value: number | null): string {
  if (value === null) return "N/A";
  return value.toFixed(1);
}

export function getDifficultyColor(value: number | null): string {
  if (value === null) return "#9ca3af"; // gray-400
  if (value >= 4) return "#ef4444"; // red-500 (hard)
  if (value >= 3) return "#eab308"; // yellow-500
  return "#22c55e"; // green-500 (easy)
}

export { getRatingColor };
