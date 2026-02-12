export const SEMESTERS = [
  "Fall 2024",
  "Spring 2025",
  "Summer 2025",
  "Fall 2025",
  "Spring 2026",
] as const;

export const SORT_OPTIONS = ["rating", "code", "title", "difficulty"] as const;

export const RATING_LABELS = {
  quality: "Quality",
  difficulty: "Difficulty",
  workload: "Workload",
} as const;

export const RATING_COLORS = {
  high: "#22c55e", // green-500
  medium: "#eab308", // yellow-500
  low: "#ef4444", // red-500
} as const;

export function getRatingColor(rating: number | null): string {
  if (rating === null) return "#9ca3af"; // gray-400
  if (rating >= 4) return RATING_COLORS.high;
  if (rating >= 3) return RATING_COLORS.medium;
  return RATING_COLORS.low;
}

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
