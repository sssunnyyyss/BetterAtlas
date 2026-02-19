function dayNumToAbbrev(day: number): string {
  switch (day) {
    case 0:
      return "M";
    case 1:
      return "T";
    case 2:
      return "W";
    case 3:
      return "Th";
    case 4:
      return "F";
    case 5:
      return "Sa";
    case 6:
      return "Su";
    default:
      return String(day);
  }
}

function hhmmToColon(t: string): string {
  const digits = t.replace(/[^0-9]/g, "");
  if (digits.length === 3) return `${digits.slice(0, 1)}:${digits.slice(1)}`;
  if (digits.length !== 4) return t;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function normalizeTimeDigits(t: string): string {
  const digits = t.replace(/[^0-9]/g, "");
  if (digits.length === 3) return `0${digits}`;
  if (digits.length === 4) return digits;
  return "";
}

type ParsedMeeting = {
  day: number;
  startTime: string;
  endTime: string;
  location: string;
};

function parseMeetings(meetings: unknown): ParsedMeeting[] {
  if (!Array.isArray(meetings) || meetings.length === 0) return [];

  return meetings
    .map((m: any) => ({
      day: typeof m?.day === "string" ? Number(m.day) : m?.day,
      // Atlas times are usually "0830" but can sometimes come through as "830".
      // Normalize to 4 digits so sorting and formatting are consistent.
      startTime: normalizeTimeDigits(String(m?.startTime ?? m?.start_time ?? "")),
      endTime: normalizeTimeDigits(String(m?.endTime ?? m?.end_time ?? "")),
      location: String(m?.location ?? ""),
    }))
    .filter((m) => Number.isFinite(m.day) && m.startTime && m.endTime);
}

export function schedulesFromMeetings(meetings: unknown) {
  const parsed = parseMeetings(meetings);
  if (parsed.length === 0) return null;

  const grouped = new Map<string, { days: number[]; start: string; end: string; location: string }>();
  for (const m of parsed) {
    const key = `${m.startTime}|${m.endTime}|${m.location}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.days.push(m.day);
    } else {
      grouped.set(key, {
        days: [m.day],
        start: m.startTime,
        end: m.endTime,
        location: m.location,
      });
    }
  }

  return Array.from(grouped.values())
    .map((g) => {
      const dayNums = Array.from(new Set(g.days)).sort((a, b) => a - b);
      return {
        dayNums,
        days: dayNums.map(dayNumToAbbrev),
        start: hhmmToColon(g.start),
        end: hhmmToColon(g.end),
        location: g.location,
      };
    })
    .sort((a, b) => {
      const dayA = a.dayNums[0] ?? Number.POSITIVE_INFINITY;
      const dayB = b.dayNums[0] ?? Number.POSITIVE_INFINITY;
      if (dayA !== dayB) return dayA - dayB;
      if (a.start !== b.start) return a.start.localeCompare(b.start);
      if (a.end !== b.end) return a.end.localeCompare(b.end);
      return a.location.localeCompare(b.location);
    })
    .map(({ dayNums: _dayNums, ...rest }) => rest);
}

export function scheduleFromMeetings(meetings: unknown) {
  const schedules = schedulesFromMeetings(meetings);
  if (!schedules || schedules.length === 0) return null;

  // Backward-compatible single schedule representation for clients that have not
  // migrated to `schedules` yet.
  if (schedules.length === 1) return schedules[0];

  const parsed = parseMeetings(meetings);
  if (parsed.length === 0) return null;

  const days = Array.from(new Set(parsed.map((m) => m.day)))
    .sort((a, b) => a - b)
    .map(dayNumToAbbrev);

  const starts = parsed.map((m) => m.startTime).sort();
  const ends = parsed.map((m) => m.endTime).sort();
  const start = hhmmToColon(starts[0]);
  const end = hhmmToColon(ends[ends.length - 1]);
  const location = parsed.find((m) => m.location)?.location ?? "";

  return { days, start, end, location };
}
