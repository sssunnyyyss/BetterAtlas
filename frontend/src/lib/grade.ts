export function gradeLabelFromPoints(points: number | null | undefined): string | null {
  if (typeof points !== "number" || !Number.isFinite(points)) return null;
  if (points >= 3.85) return "A";
  if (points >= 3.65) return "A-";
  if (points >= 3.35) return "B+";
  if (points >= 2.85) return "B";
  if (points >= 2.65) return "B-";
  if (points >= 2.35) return "C+";
  if (points >= 1.85) return "C";
  if (points >= 1.65) return "C-";
  if (points >= 1.35) return "D+";
  if (points >= 0.85) return "D";
  if (points >= 0.65) return "D-";
  return "F";
}

export function gradeColor(points: number | null | undefined): string {
  const label = gradeLabelFromPoints(points);
  if (!label) return "#9ca3af"; // gray-400

  switch (label) {
    case "A":
      return "#22c55e"; // bright green
    case "A-":
      return "#86efac"; // lighter green
    case "B+":
      return "#a16207"; // amber-700
    case "B":
      return "#ca8a04"; // amber-600
    case "B-":
      return "#eab308"; // yellow-500
    case "C+":
      return "#f87171"; // red-400
    case "C":
      return "#ef4444"; // red-500
    case "C-":
      return "#dc2626"; // red-600
    case "D+":
    case "D":
    case "D-":
      return "#b91c1c"; // red-700
    case "F":
    default:
      return "#991b1b"; // red-800
  }
}
