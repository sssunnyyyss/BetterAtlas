import { getRatingColor } from "@betteratlas/shared";

export function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

export function formatRating(value: number | null): string {
  if (value === null) return "N/A";
  return value.toFixed(1);
}

export { getRatingColor };
