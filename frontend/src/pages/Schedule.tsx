import { useEffect, useMemo, useState } from "react";
import type { FriendScheduleResponse, ScheduleCourseBlock } from "@betteratlas/shared";
import { useFriendsSchedules, useMySchedule, useRemoveFromSchedule } from "../hooks/useSchedule.js";
import { formatTimeRange12h } from "../lib/time.js";
import Modal from "../components/ui/Modal.js";
import { Link } from "react-router-dom";
import { INSTRUCTION_METHOD_OPTIONS } from "@betteratlas/shared";
import { SEMESTERS } from "@betteratlas/shared";
import { layoutOverlaps } from "../lib/calendarLayout.js";

const DAYS: Array<{ key: string; label: string }> = [
  { key: "M", label: "Mon" },
  { key: "T", label: "Tue" },
  { key: "W", label: "Wed" },
  { key: "Th", label: "Thu" },
  { key: "F", label: "Fri" },
];

const ENROLLMENT_STATUS_LABELS: Record<string, string> = {
  O: "Open",
  C: "Closed",
  W: "Wait List",
};

const TERM_SEASON_RANK: Record<string, number> = {
  winter: 0,
  spring: 1,
  summer: 2,
  fall: 3,
};

function parseHHMMColon(s: string) {
  const m = /^([0-9]{1,2}):([0-9]{2})$/.exec(s.trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

function hashColor(key: string) {
  // Deterministic pastel-ish palette.
  const palette = ["#0ea5e9", "#22c55e", "#f97316", "#a855f7", "#ef4444", "#14b8a6", "#eab308"];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function parseNamedTerm(value: string) {
  const m = /^(Spring|Summer|Fall|Winter)\s+([0-9]{4})$/i.exec(value.trim());
  if (!m) return null;
  const season = m[1].toLowerCase();
  const year = Number(m[2]);
  if (!Number.isFinite(year)) return null;
  return { season, year };
}

function compareTermValues(a: string, b: string) {
  const pa = parseNamedTerm(a);
  const pb = parseNamedTerm(b);

  // Newest terms first when both are named terms.
  if (pa && pb) {
    if (pa.year !== pb.year) return pb.year - pa.year;
    const sa = TERM_SEASON_RANK[pa.season] ?? -1;
    const sb = TERM_SEASON_RANK[pb.season] ?? -1;
    if (sa !== sb) return sb - sa;
    return a.localeCompare(b);
  }

  // Prefer named terms ahead of raw codes/labels.
  if (pa && !pb) return -1;
  if (!pa && pb) return 1;

  // Fallback for raw codes/labels.
  return a.localeCompare(b);
}

type CalendarBlock = {
  id: string;
  owner: "me" | "friend";
  ownerLabel: string;
  friend?: { id: string; username: string; fullName: string };
  day: string;
  startMin: number;
  endMin: number;
  title: string;
  subtitle: string;
  color: string;
  itemId?: number;
  sectionId: number;
  courseId: number;
  courseTitle: string;
  sectionNumber: string | null;
  instructorName: string | null;
  location: string | null;
  campus: string | null;
  componentType: string | null;
  instructionMethod: string | null;
  enrollmentStatus: string | null;
  enrollmentCap: number | null;
  enrollmentCur: number;
  seatsAvail: number | null;
  waitlistCount: number;
  waitlistCap: number | null;
  startDate: string | null;
  endDate: string | null;
};

function WeeklyCalendar({
  blocks,
  minMinute,
  maxMinute,
  onBlockClick,
}: {
  blocks: CalendarBlock[];
  minMinute: number;
  maxMinute: number;
  onBlockClick?: (b: CalendarBlock) => void;
}) {
  const pxPerMin = 1.2;
  const height = Math.max(400, (maxMinute - minMinute) * pxPerMin);

  const hours: number[] = [];
  for (let m = Math.floor(minMinute / 60) * 60; m <= maxMinute; m += 60) {
    hours.push(m);
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="grid grid-cols-[4rem_repeat(5,minmax(0,1fr))] border-b border-gray-200">
        <div className="p-3 text-xs font-medium text-gray-500">Time</div>
        {DAYS.map((d) => (
          <div key={d.key} className="p-3 text-xs font-medium text-gray-700 border-l border-gray-100">
            {d.label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[4rem_repeat(5,minmax(0,1fr))]">
        <div className="relative border-r border-gray-200" style={{ height }}>
          {hours.map((m) => {
            const top = (m - minMinute) * pxPerMin;
            const hour = Math.floor(m / 60);
            const label = `${((hour + 11) % 12) + 1}${hour >= 12 ? "p" : "a"}`;
            return (
              <div key={m} className="absolute left-0 right-0" style={{ top }}>
                <div className="text-[10px] text-gray-500 px-2 -mt-1">{label}</div>
                <div className="h-px bg-gray-100" />
              </div>
            );
          })}
        </div>

        {DAYS.map((d) => (
          <div key={d.key} className="relative border-l border-gray-100" style={{ height }}>
            {hours.map((m) => (
              <div key={m} className="absolute left-0 right-0" style={{ top: (m - minMinute) * pxPerMin }}>
                <div className="h-px bg-gray-50" />
              </div>
            ))}

            {layoutOverlaps(blocks.filter((b) => b.day === d.key)).map((b) => {
                const top = (b.startMin - minMinute) * pxPerMin;
                const blockHeight = Math.max(22, (b.endMin - b.startMin) * pxPerMin);
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => onBlockClick?.(b)}
                    className={`absolute rounded-md border px-2 py-1 text-xs shadow-sm ${
                      b.owner === "me" ? "border-gray-200" : "border-gray-200 opacity-75"
                    } text-left`}
                    style={{
                      top,
                      height: blockHeight,
                      left: `calc(100% * ${b.col} / ${b.colCount})`,
                      right: `calc(100% * ${b.colCount - b.col - 1} / ${b.colCount})`,
                      marginLeft: 8,
                      marginRight: 8,
                      backgroundColor: `${b.color}22`,
                      borderLeft: `4px solid ${b.color}`,
                    }}
                    title={`${b.title} (${b.subtitle})`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900 truncate">
                          {b.title}
                          {b.sectionNumber ? (
                            <span className="font-medium text-gray-700">
                              {" "}
                              · {b.sectionNumber}
                            </span>
                          ) : null}
                        </div>
                        <div className="text-[11px] text-gray-700 truncate">{b.courseTitle}</div>
                      </div>
                      {b.owner === "friend" && b.friend?.username ? (
                        <span className="text-[10px] text-gray-700 bg-white/70 border border-gray-200 rounded px-1.5 py-0.5 shrink-0">
                          @{b.friend.username}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-[11px] text-gray-700 truncate mt-0.5">{b.subtitle}</div>
                    {b.owner === "friend" && (
                      <div className="text-[10px] text-gray-600 truncate">{b.ownerLabel}</div>
                    )}
                  </button>
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
}

function courseLabel(item: ScheduleCourseBlock) {
  const sec = item.section.sectionNumber ? `Sec ${item.section.sectionNumber}` : "Section";
  return `${item.course.code} (${sec})`;
}

function blocksFromSchedule(items: ScheduleCourseBlock[], ownerLabel: string, owner: "me" | "friend") {
  const blocks: CalendarBlock[] = [];
  for (const item of items) {
    const sched = item.section.schedule;
    if (!sched) continue;
    const startMin = parseHHMMColon(sched.start);
    const endMin = parseHHMMColon(sched.end);
    if (startMin === null || endMin === null || endMin <= startMin) continue;
    const color = item.color ?? hashColor(`${ownerLabel}:${item.course.code}`);

    for (const day of sched.days) {
      blocks.push({
        id: `${owner}:${ownerLabel}:${item.itemId}:${day}`,
        owner,
        ownerLabel,
        day,
        startMin,
        endMin,
        title: item.course.code,
        subtitle: `${formatTimeRange12h(sched.start, sched.end)}${item.section.location ? ` • ${item.section.location}` : ""}`,
        color,
        itemId: item.itemId,
        sectionId: item.sectionId,
        courseId: item.course.id,
        courseTitle: item.course.title,
        sectionNumber: item.section.sectionNumber ?? null,
        instructorName: item.section.instructorName ?? null,
        location: item.section.location ?? null,
        campus: item.section.campus ?? null,
        componentType: item.section.componentType ?? null,
        instructionMethod: item.section.instructionMethod ?? null,
        enrollmentStatus: item.section.enrollmentStatus ?? null,
        enrollmentCap: item.section.enrollmentCap ?? null,
        enrollmentCur: item.section.enrollmentCur ?? 0,
        seatsAvail: item.section.seatsAvail ?? null,
        waitlistCount: item.section.waitlistCount ?? 0,
        waitlistCap: item.section.waitlistCap ?? null,
        startDate: item.section.startDate ?? null,
        endDate: item.section.endDate ?? null,
      });
    }
  }
  return blocks;
}

export default function Schedule() {
  const [startHour, setStartHour] = useState<number>(() => {
    const raw = localStorage.getItem("schedule_start_hour");
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : 7;
  });
  const [selectedTerm, setSelectedTerm] = useState<string>("");
  const [friendView, setFriendView] = useState(false);
  const [selectedFriendIds, setSelectedFriendIds] = useState<Record<string, boolean>>({});
  const [activeBlock, setActiveBlock] = useState<CalendarBlock | null>(null);
  const { data: mine, isLoading } = useMySchedule(selectedTerm || undefined);
  const friendTerm = selectedTerm || mine?.term.code;
  const { data: friends, isLoading: friendsLoading } = useFriendsSchedules(friendTerm || undefined);
  const removeItem = useRemoveFromSchedule();

  useEffect(() => {
    localStorage.setItem("schedule_start_hour", String(startHour));
  }, [startHour]);

  useEffect(() => {
    if (!friendView) return;
    const fs = friends ?? [];
    if (fs.length === 0) return;
    setSelectedFriendIds((prev) => {
      const next = { ...prev };
      // Default new friends to "on".
      for (const f of fs) {
        if (next[f.friend.id] === undefined) next[f.friend.id] = true;
      }
      // Remove ids that are no longer in the list.
      const currentIds = new Set(fs.map((f) => f.friend.id));
      for (const id of Object.keys(next)) {
        if (!currentIds.has(id)) delete next[id];
      }
      return next;
    });
  }, [friendView, friends]);

  const termOptions = useMemo(() => {
    const set = new Set<string>();
    for (const semester of SEMESTERS) set.add(semester);
    if (mine?.term.name) set.add(mine.term.name);
    else if (mine?.term.code) set.add(mine.term.code);
    for (const item of mine?.items ?? []) {
      if (item.section.semester) set.add(item.section.semester);
    }
    if (selectedTerm) set.add(selectedTerm);
    return Array.from(set).sort(compareTermValues);
  }, [mine, selectedTerm]);

  const myBlocks = useMemo(
    () => blocksFromSchedule(mine?.items ?? [], "me", "me"),
    [mine?.items]
  );

  const friendBlocks = useMemo(() => {
    if (!friendView) return [];
    const out: CalendarBlock[] = [];
    for (const f of friends ?? []) {
      if (selectedFriendIds[f.friend.id] === false) continue;
      const blocks = blocksFromSchedule(f.items, `@${f.friend.username}`, "friend").map((b) => ({
        ...b,
        friend: f.friend,
      }));
      out.push(...blocks);
    }
    return out;
  }, [friendView, friends, selectedFriendIds]);

  const calendarBlocks = useMemo(() => [...myBlocks, ...friendBlocks], [myBlocks, friendBlocks]);

  const minMinute = useMemo(() => {
    const mins = calendarBlocks.map((b) => b.startMin);
    const preferred = Math.max(0, Math.min(23, startHour)) * 60;
    return mins.length ? Math.min(...mins, preferred) : preferred;
  }, [calendarBlocks, startHour]);

  const maxMinute = useMemo(() => {
    const mins = calendarBlocks.map((b) => b.endMin);
    return mins.length ? Math.max(...mins, 18 * 60) : 18 * 60;
  }, [calendarBlocks]);

  const unscheduled = useMemo(() => (mine?.items ?? []).filter((i) => !i.section.schedule), [mine?.items]);

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/4" />
          <div className="h-96 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  const termLabel = mine?.term.name ?? mine?.term.code ?? "";

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Schedule</h1>
          <p className="text-sm text-gray-500 mt-1">{termLabel}</p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-700 select-none">
            <span className="text-sm text-gray-600">Semester</span>
            <select
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value)}
              className="rounded-md border-gray-300 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500"
            >
              <option value="">My latest / default</option>
              {termOptions.map((term) => (
                <option key={term} value={term}>
                  {term}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 select-none">
            <span className="text-sm text-gray-600">Start</span>
            <select
              value={startHour}
              onChange={(e) => setStartHour(parseInt(e.target.value, 10))}
              className="rounded-md border-gray-300 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500"
            >
              {[6, 7, 8, 9, 10].map((h) => (
                <option key={h} value={h}>
                  {h}:00 AM
                </option>
              ))}
              {[11].map((h) => (
                <option key={h} value={h}>
                  {h}:00 AM
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 select-none">
            <input
              type="checkbox"
              checked={friendView}
              onChange={(e) => setFriendView(e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            Friend view
            {friendView && friendsLoading && <span className="text-gray-400">Loading...</span>}
          </label>
        </div>
      </div>

      {friendView && (friends ?? []).length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-gray-900">Show friends on calendar</div>
            <div className="flex gap-2">
              <button
                type="button"
                className="text-sm text-gray-600 hover:text-gray-900"
                onClick={() => {
                  const next: Record<string, boolean> = {};
                  for (const f of friends ?? []) next[f.friend.id] = true;
                  setSelectedFriendIds(next);
                }}
              >
                All
              </button>
              <button
                type="button"
                className="text-sm text-gray-600 hover:text-gray-900"
                onClick={() => {
                  const next: Record<string, boolean> = {};
                  for (const f of friends ?? []) next[f.friend.id] = false;
                  setSelectedFriendIds(next);
                }}
              >
                None
              </button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            {(friends ?? []).map((f) => (
              <label
                key={f.friend.id}
                className="flex items-center gap-2 text-sm text-gray-700 border border-gray-200 rounded-md px-2 py-1"
              >
                <input
                  type="checkbox"
                  checked={selectedFriendIds[f.friend.id] !== false}
                  onChange={(e) =>
                    setSelectedFriendIds((prev) => ({
                      ...prev,
                      [f.friend.id]: e.target.checked,
                    }))
                  }
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="font-medium">@{f.friend.username}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div data-tour-id="schedule-grid">
        <WeeklyCalendar
          blocks={calendarBlocks}
          minMinute={minMinute}
          maxMinute={maxMinute}
          onBlockClick={(b) => setActiveBlock(b)}
        />
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">My Courses</h2>
          {(mine?.items ?? []).length === 0 ? (
            <p className="text-sm text-gray-500">No courses added yet.</p>
          ) : (
            <ul className="space-y-2">
              {(mine?.items ?? []).map((item) => (
                <li key={item.itemId} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{courseLabel(item)}</div>
                    {item.section.schedule ? (
                      <div className="text-xs text-gray-500 truncate">
                        {item.section.schedule.days.join("/")} {formatTimeRange12h(item.section.schedule.start, item.section.schedule.end)}
                        {item.section.location ? ` • ${item.section.location}` : ""}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500 truncate">No meeting time listed</div>
                    )}
                  </div>
                  <button
                    onClick={() => removeItem.mutate(item.itemId)}
                    disabled={removeItem.isPending}
                    className="text-sm text-red-500 hover:text-red-700 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          {unscheduled.length > 0 && (
            <p className="text-xs text-gray-500 mt-3">
              Some sections have no meeting times, so they are not shown on the calendar.
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Friends (Tentative)</h2>
          {!friendView ? (
            <p className="text-sm text-gray-500">Enable friend view to see friends' schedules here.</p>
          ) : (friends ?? []).length === 0 ? (
            <p className="text-sm text-gray-500">No friends yet.</p>
          ) : (
            <div className="space-y-3">
              {(friends ?? []).map((f: FriendScheduleResponse) => (
                <div key={f.friend.id} className="border border-gray-100 rounded-md p-3">
                  <div className="text-sm font-medium text-gray-900">
                    @{f.friend.username} <span className="text-xs text-gray-500 ml-2">{f.friend.fullName}</span>
                  </div>
                  {f.items.length === 0 ? (
                    <div className="text-xs text-gray-500 mt-1">No courses added.</div>
                  ) : (
                    <ul className="mt-2 space-y-1">
                      {f.items.slice(0, 6).map((i) => (
                        <li key={i.itemId} className="text-xs text-gray-700 truncate">
                          {courseLabel(i)}
                        </li>
                      ))}
                      {f.items.length > 6 && (
                        <li className="text-xs text-gray-500">+ {f.items.length - 6} more</li>
                      )}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={!!activeBlock}
        title={
          activeBlock
            ? `${activeBlock.title}${activeBlock.sectionNumber ? ` · ${activeBlock.sectionNumber}` : ""}`
            : "Section"
        }
        onClose={() => setActiveBlock(null)}
      >
        {activeBlock ? (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {activeBlock.courseTitle}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {activeBlock.subtitle}
                </div>
                {activeBlock.owner === "friend" && activeBlock.friend ? (
                  <div className="text-xs text-gray-500 mt-1">
                    Friend: @{activeBlock.friend.username} ({activeBlock.friend.fullName})
                  </div>
                ) : null}
              </div>
              <Link
                to={`/catalog/${activeBlock.courseId}`}
                className="text-sm text-primary-600 hover:text-primary-800 shrink-0"
              >
                View course
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border border-gray-200 bg-white p-3">
                <div className="text-xs text-gray-500">Seats Available</div>
                <div className="text-lg font-semibold text-gray-900">
                  {activeBlock.seatsAvail ?? "—"}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Capacity {activeBlock.enrollmentCap ?? "—"} · Enrolled {activeBlock.enrollmentCur ?? 0}
                </div>
              </div>
              <div className="rounded-md border border-gray-200 bg-white p-3">
                <div className="text-xs text-gray-500">Waitlist</div>
                <div className="text-lg font-semibold text-gray-900">
                  {activeBlock.waitlistCount ?? 0}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Cap {activeBlock.waitlistCap ?? "—"}
                </div>
              </div>
            </div>

            <div className="space-y-2 text-sm text-gray-800">
              <div>
                <span className="text-xs text-gray-500">Section:</span>{" "}
                <span className="text-gray-900">{activeBlock.sectionNumber ?? "—"}</span>
              </div>
              {activeBlock.instructorName ? (
                <div>
                  <span className="text-xs text-gray-500">Professor:</span>{" "}
                  <span className="text-gray-900">{activeBlock.instructorName}</span>
                </div>
              ) : null}
              <div>
                <span className="text-xs text-gray-500">Meeting:</span>{" "}
                <span className="text-gray-900">{activeBlock.subtitle}</span>
              </div>
              <div>
                <span className="text-xs text-gray-500">Location:</span>{" "}
                <span className="text-gray-900">{activeBlock.location || "—"}</span>
              </div>
              <div>
                <span className="text-xs text-gray-500">Campus:</span>{" "}
                <span className="text-gray-900">{activeBlock.campus || "—"}</span>
              </div>
              <div>
                <span className="text-xs text-gray-500">Instruction:</span>{" "}
                <span className="text-gray-900">
                  {activeBlock.instructionMethod
                    ? (INSTRUCTION_METHOD_OPTIONS as any)[activeBlock.instructionMethod] ??
                      activeBlock.instructionMethod
                    : "—"}
                </span>
              </div>
              <div>
                <span className="text-xs text-gray-500">Enrollment Status:</span>{" "}
                <span className="text-gray-900">
                  {activeBlock.enrollmentStatus
                    ? ENROLLMENT_STATUS_LABELS[activeBlock.enrollmentStatus] ??
                      activeBlock.enrollmentStatus
                    : "—"}
                </span>
              </div>
              <div>
                <span className="text-xs text-gray-500">Dates:</span>{" "}
                <span className="text-gray-900">
                  {activeBlock.startDate || "?"} through {activeBlock.endDate || "?"}
                </span>
              </div>
            </div>

            {activeBlock.owner === "me" && typeof activeBlock.itemId === "number" ? (
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={async () => {
                    await removeItem.mutateAsync(activeBlock.itemId!);
                    setActiveBlock(null);
                  }}
                  disabled={removeItem.isPending}
                  className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                >
                  Remove from schedule
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
