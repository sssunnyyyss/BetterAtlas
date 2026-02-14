export function formatTime12h(time: string): string {
  const raw = String(time ?? "").trim();
  if (!raw) return time;

  // Accept:
  // - "14:30"
  // - "14:30:00"
  // - "1430"
  const colon = /^\s*(\d{1,2}):(\d{2})(?::\d{2})?\s*$/.exec(raw);
  const compact = /^\s*(\d{3,4})\s*$/.exec(raw);

  let hoursStr: string | undefined;
  let minutes: string | undefined;

  if (colon) {
    hoursStr = colon[1];
    minutes = colon[2];
  } else if (compact) {
    const digits = compact[1]!;
    hoursStr = digits.length === 3 ? digits.slice(0, 1) : digits.slice(0, 2);
    minutes = digits.slice(-2);
  } else {
    return time;
  }

  const hours = Number(hoursStr);
  if (!Number.isFinite(hours) || hours < 0 || hours > 23) return time;

  const isPm = hours >= 12;
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${h12}:${minutes} ${isPm ? "PM" : "AM"}`;
}

export function formatTimeRange12h(start: string, end: string): string {
  return `${formatTime12h(start)}-${formatTime12h(end)}`;
}
