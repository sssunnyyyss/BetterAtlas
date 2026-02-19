import { useParams, Link, useSearchParams, useLocation } from "react-router-dom";
import { useCourseDetail } from "../hooks/useCourses.js";
import { useMemo, useState, useCallback, useEffect, useRef, type FormEvent } from "react";
import { useReviews, useSectionReviews, useCreateReview, useUpdateReview, useDeleteReview } from "../hooks/useReviews.js";
import RatingBadge from "../components/course/RatingBadge.js";
import GerPills from "../components/course/GerPills.js";
import ReviewCard from "../components/review/ReviewCard.js";
import ReviewForm from "../components/review/ReviewForm.js";
import EditReviewModal from "../components/review/EditReviewModal.js";
import Modal from "../components/ui/Modal.js";
import { formatTimeRange12h } from "../lib/time.js";
import type { Schedule, Section, ReviewWithAuthor } from "@betteratlas/shared";
import { INSTRUCTION_METHOD_OPTIONS } from "@betteratlas/shared";
import { useAddToSchedule } from "../hooks/useSchedule.js";
import { layoutOverlaps } from "../lib/calendarLayout.js";
import { useSubmitFeedback } from "../hooks/useFeedback.js";
import { normalizeTopic } from "../lib/courseTopics.js";

const ENROLLMENT_STATUS_LABELS: Record<string, string> = {
  O: "Open",
  C: "Closed",
  W: "Wait List",
};

const DAYS: Array<{ key: string; label: string }> = [
  { key: "M", label: "Mon" },
  { key: "T", label: "Tue" },
  { key: "W", label: "Wed" },
  { key: "Th", label: "Thu" },
  { key: "F", label: "Fri" },
];

function parseHHMMColon(s: string) {
  const m = /^([0-9]{1,2}):([0-9]{2})$/.exec(String(s ?? "").trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

function hashColor(key: string) {
  const palette = ["#0ea5e9", "#22c55e", "#f97316", "#a855f7", "#ef4444", "#14b8a6", "#eab308"];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function seatsAvailForSection(section: Section) {
  if (typeof section.seatsAvail === "number") return section.seatsAvail;
  if (section.enrollmentCap !== null) {
    return Math.max(0, (section.enrollmentCap ?? 0) - (section.enrollmentCur ?? 0));
  }
  return null;
}

function enrollmentPercent(enrolled: number | null | undefined, cap: number | null | undefined) {
  if (typeof cap !== "number" || cap <= 0) return null;
  const safeEnrolled = typeof enrolled === "number" ? Math.max(0, enrolled) : 0;
  return Math.max(0, Math.round((safeEnrolled / cap) * 100));
}

function enrollmentTone(percent: number | null) {
  if (percent === null) return "border-gray-200 bg-gray-100 text-gray-700";
  if (percent >= 95) return "border-red-200 bg-red-50 text-red-700";
  if (percent >= 80) return "border-amber-200 bg-amber-50 text-amber-700";
  if (percent >= 60) return "border-yellow-200 bg-yellow-50 text-yellow-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function schedulesForSection(section: Section): Schedule[] {
  if (Array.isArray(section.schedules) && section.schedules.length > 0) {
    return section.schedules;
  }
  return section.schedule ? [section.schedule as Schedule] : [];
}

function sectionTopic(section: Section): string | null {
  return normalizeTopic(section.sectionDescription) ?? normalizeTopic(section.classNotes);
}

function sectionInstructorNames(section: Section): string[] {
  if (Array.isArray(section.instructors) && section.instructors.length > 0) {
    return Array.from(
      new Set(
        section.instructors
          .map((ins) => String(ins.name ?? "").trim())
          .filter(Boolean)
      )
    );
  }
  if (section.instructor?.name) return [section.instructor.name];
  return [];
}

function SectionDetails({ section }: { section: Section }) {
  const scheds = schedulesForSection(section);
  const roster =
    Array.isArray(section.instructors) && section.instructors.length > 0
      ? section.instructors
      : section.instructor
        ? [{ ...section.instructor, role: null }]
        : [];
  return (
    <div className="space-y-2 text-sm text-gray-700">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <span>
          <span className="font-medium text-gray-800">Section:</span>{" "}
          {section.sectionNumber ?? "—"}
        </span>
        <span>
          <span className="font-medium text-gray-800">Semester:</span>{" "}
          {section.semester}
        </span>
        {section.campus && (
          <span>
            <span className="font-medium text-gray-800">Campus:</span> {section.campus}
          </span>
        )}
      </div>

      {roster.length > 0 && (
        <div>
          <span className="font-medium text-gray-800">
            {roster.length > 1 ? "Instructors:" : "Instructor:"}
          </span>
          <div className="mt-1 space-y-1">
            {roster.map((ins, idx) => (
              <div key={`${ins.id}:${idx}`} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Link to={`/professors/${ins.id}`} className="text-gray-900 hover:underline">
                  {ins.name}
                </Link>
                {ins.email && (
                  <a href={`mailto:${ins.email}`} className="text-primary-600 hover:text-primary-800">
                    {ins.email}
                  </a>
                )}
                {ins.role && <span className="text-xs text-gray-500">{ins.role}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {scheds.length > 0 && (
        <div>
          <span className="font-medium text-gray-800">
            {scheds.length > 1 ? "Meetings:" : "Meeting:"}
          </span>
          <div className="mt-1 space-y-1">
            {scheds.map((sched, idx) => (
              <div key={`${sched.days.join("/")}:${sched.start}:${sched.end}:${idx}`}>
                {sched.days.join("/")} {formatTimeRange12h(sched.start, sched.end)}
                {sched.location ? <span className="text-gray-600">, {sched.location}</span> : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {(section.startDate || section.endDate) && (
        <div>
          <span className="font-medium text-gray-800">Dates:</span>{" "}
          {section.startDate ?? "?"} through {section.endDate ?? "?"}
        </div>
      )}

      {(section.enrollmentCap !== null || section.seatsAvail !== null) && (
        <div>
          <span className="font-medium text-gray-800">Seats:</span>{" "}
          Maximum Enrollment: {section.enrollmentCap ?? "—"} / Seats Avail:{" "}
          {seatsAvailForSection(section) ?? "—"}
        </div>
      )}

      {typeof section.waitlistCount === "number" && (
        <div>
          <span className="font-medium text-gray-800">Waitlist:</span>{" "}
          {section.waitlistCount}
          {section.waitlistCap !== null && section.waitlistCap !== undefined
            ? ` of ${section.waitlistCap}`
            : ""}
        </div>
      )}

      {section.enrollmentStatus && (
        <div>
          <span className="font-medium text-gray-800">Enrollment Status:</span>{" "}
          {ENROLLMENT_STATUS_LABELS[section.enrollmentStatus] ?? section.enrollmentStatus}
        </div>
      )}

      {section.instructionMethod && (
        <div>
          <span className="font-medium text-gray-800">Instruction Method:</span>{" "}
          {INSTRUCTION_METHOD_OPTIONS[section.instructionMethod] ?? section.instructionMethod}
        </div>
      )}

      {section.gerDesignation && (
        <div>
          <span className="font-medium text-gray-800">Requirement Designation:</span>{" "}
          {section.gerDesignation}
        </div>
      )}

      {sectionTopic(section) && (
        <div>
          <span className="font-medium text-gray-800">Topic:</span> {sectionTopic(section)}
        </div>
      )}

      {section.registrationRestrictions && (
        <div>
          <span className="font-medium text-gray-800">Requirements:</span>{" "}
          {section.registrationRestrictions}
        </div>
      )}
    </div>
  );
}

function sectionNumberSortKey(sectionNumber: string | null) {
  if (!sectionNumber) return { num: Number.POSITIVE_INFINITY, suffix: "" };
  const s = String(sectionNumber).trim();
  const m = /^0*([0-9]+)\s*([A-Za-z].*)?$/.exec(s);
  if (!m) return { num: Number.POSITIVE_INFINITY, suffix: s.toUpperCase() };
  return { num: Number(m[1]), suffix: String(m[2] ?? "").toUpperCase() };
}

function semesterSortKey(semester: string | null | undefined) {
  const raw = String(semester ?? "").trim();
  const m = /^(Spring|Summer|Fall|Winter)\s+(\d{4})$/i.exec(raw);
  if (!m) return { year: -1, term: -1, raw: raw.toUpperCase() };

  const season = m[1].toLowerCase();
  const year = Number(m[2]);
  const termOrder: Record<string, number> = {
    winter: 0,
    spring: 1,
    summer: 2,
    fall: 3,
  };
  return {
    year: Number.isFinite(year) ? year : -1,
    term: termOrder[season] ?? -1,
    raw: raw.toUpperCase(),
  };
}

type MiniBlock = {
  id: string;
  sectionId: number;
  day: string;
  startMin: number;
  endMin: number;
  label: string;
  color: string;
  title: string;
};

function MiniWeeklyCalendar({
  blocks,
  onSelectSection,
  startHour = 7,
  endHour = 19,
}: {
  blocks: MiniBlock[];
  onSelectSection: (sectionId: number) => void;
  startHour?: number;
  endHour?: number;
}) {
  const minMinute = startHour * 60;
  const maxMinute = endHour * 60;
  const pxPerMin = 0.75;
  const height = Math.max(260, (maxMinute - minMinute) * pxPerMin);

  const hours: number[] = [];
  for (let m = minMinute; m <= maxMinute; m += 60) hours.push(m);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="grid grid-cols-[3.25rem_repeat(5,minmax(0,1fr))] border-b border-gray-200">
        <div className="p-2 text-[11px] font-medium text-gray-500">Time</div>
        {DAYS.map((d) => (
          <div key={d.key} className="p-2 text-[11px] font-medium text-gray-700 border-l border-gray-100">
            {d.label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[3.25rem_repeat(5,minmax(0,1fr))]">
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
                const blockHeight = Math.max(18, (b.endMin - b.startMin) * pxPerMin);
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => onSelectSection(b.sectionId)}
                    className="absolute rounded-md border px-1.5 py-1 text-[11px] shadow-sm text-left hover:opacity-90"
                    style={{
                      top,
                      height: blockHeight,
                      left: `calc(100% * ${b.col} / ${b.colCount})`,
                      right: `calc(100% * ${b.colCount - b.col - 1} / ${b.colCount})`,
                      marginLeft: 4,
                      marginRight: 4,
                      backgroundColor: `${b.color}22`,
                      borderLeft: `3px solid ${b.color}`,
                      borderColor: "#e5e7eb",
                    }}
                    title={b.title}
                  >
                    <div className="font-semibold text-gray-900 truncate">{b.label}</div>
                  </button>
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const courseId = parseInt(id || "0", 10);
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const selectedSemester = (searchParams.get("semester") || "").trim();
  const selectedTopic = normalizeTopic(searchParams.get("topic"));
  const selectedSectionIdRaw = (searchParams.get("section") || "").trim();
  const selectedSectionId =
    /^\d+$/.test(selectedSectionIdRaw) && Number(selectedSectionIdRaw) > 0
      ? Number(selectedSectionIdRaw)
      : null;

  const {
    data: course,
    isLoading,
    isError,
    error,
  } = useCourseDetail(courseId);
  const { data: reviews } = useReviews(courseId);
  const createReview = useCreateReview(courseId);
  const updateReview = useUpdateReview(courseId);
  const deleteReview = useDeleteReview();
  const addToSchedule = useAddToSchedule();
  const submitFeedback = useSubmitFeedback();
  const [editingReview, setEditingReview] = useState<ReviewWithAuthor | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<number | null>(null);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportSectionId, setReportSectionId] = useState<number | "">("");
  const [reportMessage, setReportMessage] = useState("");
  const [reportStatusMessage, setReportStatusMessage] = useState("");
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);
  const closeSectionModal = useCallback(() => setActiveSectionId(null), []);
  const closeEditModal = useCallback(() => setEditingReview(null), []);
  const [scheduleMessage, setScheduleMessage] = useState<string>("");

  const closeReportModal = useCallback(() => {
    setIsReportModalOpen(false);
    setReportMessage("");
    setReportSectionId("");
  }, []);

  const openReportModal = useCallback(() => {
    setIsActionsMenuOpen(false);
    setReportStatusMessage("");
    setIsReportModalOpen(true);
  }, []);

  useEffect(() => {
    if (!isActionsMenuOpen) return;

    function handleOutsideClick(e: MouseEvent) {
      if (actionsMenuRef.current?.contains(e.target as Node)) return;
      setIsActionsMenuOpen(false);
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isActionsMenuOpen]);

  const visibleSections = useMemo(() => {
    if (!course) return [] as Section[];

    if (selectedSectionId !== null) {
      return course.sections.filter((section) => {
        if (section.id !== selectedSectionId) return false;
        if (selectedSemester && section.semester !== selectedSemester) return false;
        return true;
      });
    }

    const selectedTopicKey = selectedTopic ? selectedTopic.toLocaleLowerCase() : null;

    return course.sections.filter((section) => {
      if (selectedSemester && section.semester !== selectedSemester) return false;
      if (!selectedTopicKey) return true;
      const topic = sectionTopic(section);
      return topic ? topic.toLocaleLowerCase() === selectedTopicKey : false;
    });
  }, [course, selectedSectionId, selectedSemester, selectedTopic]);

  const professors = useMemo(() => {
    const c = course;
    if (!c) return [];
    if (visibleSections.length === 0) return [];

    const visibleInstructorIds = new Set<number>();
    for (const s of visibleSections) {
      const id = s.instructor?.id;
      if (typeof id === "number") visibleInstructorIds.add(id);
    }
    if (visibleInstructorIds.size === 0) return [];

    if (c.professors && c.professors.length > 0) {
      return c.professors
        .filter((p) => visibleInstructorIds.has(p.id))
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    const seen = new Map<
      number,
      {
        id: number;
        name: string;
        email: string | null;
        departmentId: number | null;
        avgQuality: number | null;
        avgDifficulty: number | null;
        avgWorkload: number | null;
        reviewCount: number;
      }
    >();

    for (const s of visibleSections) {
      const i = s.instructor;
      if (!i) continue;
      if (!seen.has(i.id)) {
        seen.set(i.id, {
          id: i.id,
          name: i.name,
          email: i.email ?? null,
          departmentId: i.departmentId ?? null,
          avgQuality: null,
          avgDifficulty: null,
          avgWorkload: null,
          reviewCount: 0,
        });
      }
    }

    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [course, visibleSections]);

  const activeSection = useMemo(() => {
    if (!activeSectionId) return null;
    return visibleSections.find((s) => s.id === activeSectionId) ?? null;
  }, [visibleSections, activeSectionId]);

  const courseEnrollment = useMemo(() => {
    const sectionPercents = visibleSections.reduce(
      (acc, section) => {
        const cap = section.enrollmentCap;
        if (typeof cap === "number" && cap > 0) {
          const enrolled = Math.max(0, section.enrollmentCur ?? 0);
          const sectionPct = enrollmentPercent(enrolled, cap);
          if (sectionPct !== null) {
            acc.push(sectionPct);
          }
        }
        return acc;
      },
      [] as number[]
    );

    if (sectionPercents.length === 0) return null;

    return {
      averagePercent: Math.round(
        sectionPercents.reduce((sum, pct) => sum + pct, 0) / sectionPercents.length
      ),
      sectionCount: sectionPercents.length,
    };
  }, [visibleSections]);

  const { data: sectionReviews } = useSectionReviews(activeSection?.id ?? null);

  const hasMultipleSectionTopics = useMemo(() => {
    const topics = new Set<string>();
    for (const section of visibleSections) {
      const topic = sectionTopic(section);
      if (topic) topics.add(topic);
    }
    return topics.size > 1;
  }, [visibleSections]);

  const groupedBySemester = useMemo(() => {
    return new Set(visibleSections.map((s) => String(s.semester ?? "").trim())).size > 1;
  }, [visibleSections]);

  const groupedSections = useMemo(() => {
    if (visibleSections.length === 0) return [];
    const semesterCount = new Set(visibleSections.map((s) => String(s.semester ?? "").trim())).size;
    const groupBySemester = semesterCount > 1;

    const map = new Map<
      string,
      {
        key: string;
        semester: string | null;
        instructorId: number | null;
        instructorName: string;
        topic: string | null;
        sections: Section[];
      }
    >();

    for (const s of visibleSections) {
      const semester = normalizeTopic(s.semester);
      if (groupBySemester) {
        const semesterKey = semester ?? "Semester TBD";
        const key = `sem:${semesterKey.toLowerCase()}`;
        if (!map.has(key)) {
          map.set(key, {
            key,
            semester: semesterKey,
            instructorId: null,
            instructorName: "",
            topic: null,
            sections: [],
          });
        }
        map.get(key)!.sections.push(s);
        continue;
      }

      const instructorId = s.instructor?.id ?? null;
      const instructorName = s.instructor?.name ?? "TBA";
      const topic = hasMultipleSectionTopics ? sectionTopic(s) : null;
      const instructorKey = instructorId !== null ? `i:${instructorId}` : "i:tba";
      const key =
        topic !== null
          ? `t:${topic.toLowerCase()}::${instructorKey}`
          : hasMultipleSectionTopics
            ? `t:tbd::${instructorKey}`
            : instructorKey;
      if (!map.has(key)) {
        map.set(key, {
          key,
          semester: null,
          instructorId,
          instructorName,
          topic,
          sections: [],
        });
      }
      map.get(key)!.sections.push(s);
    }

    const groups = Array.from(map.values());
    for (const g of groups) {
      g.sections.sort((a, b) => {
        if (groupBySemester) {
          const aName = a.instructor?.name ?? "";
          const bName = b.instructor?.name ?? "";
          if (aName !== bName) return aName.localeCompare(bName);
        }
        const ak = sectionNumberSortKey(a.sectionNumber ?? null);
        const bk = sectionNumberSortKey(b.sectionNumber ?? null);
        if (ak.num !== bk.num) return ak.num - bk.num;
        if (ak.suffix !== bk.suffix) return ak.suffix.localeCompare(bk.suffix);
        return a.id - b.id;
      });
    }

    groups.sort((a, b) => {
      if (groupBySemester) {
        const ak = semesterSortKey(a.semester);
        const bk = semesterSortKey(b.semester);
        if (ak.year !== bk.year) return bk.year - ak.year;
        if (ak.term !== bk.term) return bk.term - ak.term;
        return ak.raw.localeCompare(bk.raw);
      }

      if (hasMultipleSectionTopics) {
        const aTopic = a.topic ?? "~";
        const bTopic = b.topic ?? "~";
        if (aTopic !== bTopic) return aTopic.localeCompare(bTopic);
      }
      const atba = a.instructorId === null;
      const btba = b.instructorId === null;
      if (atba !== btba) return atba ? 1 : -1;
      return a.instructorName.localeCompare(b.instructorName);
    });

    return groups;
  }, [visibleSections, hasMultipleSectionTopics]);

  const miniCalendarBlocks = useMemo(() => {
    if (!course || visibleSections.length === 0) return [] as MiniBlock[];

    const blocks: MiniBlock[] = [];
    for (const s of visibleSections) {
      const scheds = schedulesForSection(s);
      for (let i = 0; i < scheds.length; i++) {
        const sched = scheds[i];
        const startMin = parseHHMMColon(sched.start);
        const endMin = parseHHMMColon(sched.end);
        if (startMin === null || endMin === null || endMin <= startMin) continue;

        const label = `Sec ${s.sectionNumber ?? "—"}`;
        const instructor = s.instructor?.name ? ` • ${s.instructor.name}` : "";
        const title = `${course.code} ${label} — ${formatTimeRange12h(sched.start, sched.end)}${sched.location ? ` • ${sched.location}` : ""}${instructor}`;
        const color = hashColor(`section:${s.id}`);

        for (const day of sched.days) {
          blocks.push({
            id: `sec:${s.id}:${i}:${day}`,
            sectionId: s.id,
            day,
            startMin,
            endMin,
            label,
            color,
            title,
          });
        }
      }
    }

    return blocks;
  }, [course, visibleSections]);

  const sectionOptions = useMemo(
    () =>
      visibleSections.map((s) => ({
        id: s.id,
        sectionNumber: s.sectionNumber,
        semester: s.semester,
        instructorName: s.instructor?.name ?? null,
      })),
    [visibleSections]
  );

  const editSectionOptions = useMemo(() => {
    if (!course || !editingReview) return sectionOptions;
    if (sectionOptions.some((s) => s.id === editingReview.sectionId)) return sectionOptions;

    const extra = course.sections.find((s) => s.id === editingReview.sectionId);
    if (!extra) return sectionOptions;

    return [
      {
        id: extra.id,
        sectionNumber: extra.sectionNumber,
        semester: extra.semester,
        instructorName: extra.instructor?.name ?? null,
      },
      ...sectionOptions,
    ];
  }, [course, editingReview, sectionOptions]);

  async function handleSubmitInaccurateReport(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setReportStatusMessage("");

    try {
      await submitFeedback.mutateAsync({
        category: "inaccurate_course_detail",
        message: reportMessage,
        courseId,
        sectionId: reportSectionId === "" ? undefined : reportSectionId,
        pagePath: `${location.pathname}${location.search}`,
      });

      setReportStatusMessage("Thanks. Your report was submitted.");
      closeReportModal();
    } catch {
      // Error is shown via mutation state.
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/4" />
          <div className="h-8 bg-gray-200 rounded w-1/2" />
          <div className="h-4 bg-gray-200 rounded w-full" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <h2 className="text-xl font-semibold text-gray-900">Could not load course</h2>
        <p className="text-sm text-gray-600 mt-2">
          {(error as any)?.message || "Request failed"}
        </p>
        <Link to="/catalog" className="text-primary-600 hover:text-primary-800 mt-3 inline-block">
          Back to catalog
        </Link>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <h2 className="text-xl font-semibold text-gray-900">Course not found</h2>
        <Link to="/catalog" className="text-primary-600 hover:text-primary-800 mt-2 inline-block">
          Back to catalog
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Breadcrumb */}
      <Link
        to={selectedSemester ? `/catalog?semester=${encodeURIComponent(selectedSemester)}` : "/catalog"}
        className="text-sm text-primary-600 hover:text-primary-800"
      >
        &larr; Back to catalog
      </Link>
      {reportStatusMessage && (
        <p className="mt-2 text-sm text-primary-700">{reportStatusMessage}</p>
      )}

      {/* Header */}
      <div className="mt-4 mb-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-lg font-semibold text-primary-600">{course.code}</span>
              {course.credits && (
                <span className="text-sm text-gray-500">{course.credits} credits</span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{course.title}</h1>
          </div>

          <div ref={actionsMenuRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setIsActionsMenuOpen((open) => !open)}
              className="h-9 w-9 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              aria-haspopup="menu"
              aria-expanded={isActionsMenuOpen}
              aria-label="More actions"
            >
              <span aria-hidden="true">⋮</span>
            </button>
            {isActionsMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 min-w-[220px] rounded-xl border border-gray-200 bg-white shadow-lg z-20 ba-dropdown-pop"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={openReportModal}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 first:rounded-t-xl last:rounded-b-xl"
                >
                  Report inaccurate details
                </button>
              </div>
            )}
          </div>
        </div>
        {course.department && (
          <p className="text-sm text-gray-500 mt-1">{course.department.name}</p>
        )}
        {course.crossListedWith && course.crossListedWith.length > 0 && (
          <p className="mt-1.5 text-sm text-gray-500">
            Also offered as:{" "}
            {course.crossListedWith.map((c, i) => (
              <span key={c.id}>
                <Link
                  to={`/catalog/${c.id}`}
                  className="text-primary-600 hover:underline font-medium"
                >
                  {c.code}
                </Link>
                {c.department && (
                  <span className="text-gray-400"> ({c.department.code})</span>
                )}
                {i < course.crossListedWith!.length - 1 && ", "}
              </span>
            ))}
          </p>
        )}
        <GerPills gers={course.gers} />
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
          <span>
            <span className="font-medium text-gray-700">Credit Hours:</span>{" "}
            {course.credits ?? "—"}
          </span>
          <span>
            <span className="font-medium text-gray-700">Grading Mode:</span>{" "}
            {course.gradeMode ?? "—"}
          </span>
        </div>
        {course.description && (
          <p className="text-gray-700 mt-3">{course.description}</p>
        )}

        {professors.length > 0 && (
          <div className="mt-3">
            <div className="text-sm font-medium text-gray-700">Professors:</div>
            <ul className="mt-1 space-y-1">
              {professors.map((p) => (
                <li key={p.id} className="text-sm text-gray-700 flex items-center gap-2">
                  <Link to={`/professors/${p.id}`} className="text-gray-900 font-medium hover:underline">
                    {p.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Ratings */}
        <div className="flex gap-6 mt-4">
          <RatingBadge value={course.classScore ?? null} label="Class" />
          <RatingBadge value={course.avgDifficulty} label="Difficulty" />
          <RatingBadge value={course.avgWorkload} label="Workload" />
          <div className="flex flex-col items-center">
            <span className="text-lg font-bold text-gray-700">{course.reviewCount}</span>
            <span className="text-xs text-gray-500">Reviews</span>
          </div>
          {courseEnrollment && (
            <div
              className={`flex flex-col items-center rounded-lg border px-3 py-1.5 ${enrollmentTone(
                courseEnrollment.averagePercent
              )}`}
            >
              <span className="text-sm font-semibold">
                Avg {courseEnrollment.averagePercent}% enrolled
              </span>
              <span className="text-[10px]">{courseEnrollment.sectionCount} sections</span>
            </div>
          )}
        </div>
      </div>

      {/* Sections */}
      {course.sections.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Sections</h2>
          {hasMultipleSectionTopics && (
            <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
              This course has section-specific topics. Each section group below is treated like a
              mini class.
            </div>
          )}
          {selectedSemester && visibleSections.length === 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
              No sections found for <span className="font-medium text-gray-900">{selectedSemester}</span>.
            </div>
          )}
          {visibleSections.length > 0 && (
          <div className="space-y-3">
            {groupedSections.map((group) => (
              <details
                key={group.key}
                className="bg-white rounded-lg border border-gray-200 p-3"
                open={visibleSections.length <= 8}
              >
                <summary className="cursor-pointer select-none list-none flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">
                      {groupedBySemester
                        ? group.semester ?? "Semester TBD"
                        : hasMultipleSectionTopics
                          ? (group.topic ?? "Topic TBD")
                          : group.instructorName}
                      <span className="text-xs font-normal text-gray-500 ml-2">
                        {group.sections.length} section{group.sections.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {hasMultipleSectionTopics && !groupedBySemester && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        Professor: {group.instructorName}
                      </div>
                    )}
                    {!groupedBySemester && group.instructorId !== null && (
                      <div className="text-xs text-gray-500">
                        <Link
                          to={`/professors/${group.instructorId}`}
                          className="text-primary-600 hover:text-primary-800"
                          onClick={(e) => e.stopPropagation()}
                        >
                          View professor
                        </Link>
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">Toggle</span>
                </summary>

                <div className="mt-3 space-y-2">
                  {group.sections.map((section) => {
                    const scheds = schedulesForSection(section);
                    const sectionEnrollment = enrollmentPercent(
                      section.enrollmentCur ?? 0,
                      section.enrollmentCap
                    );
                    return (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => setActiveSectionId(section.id)}
                        className="w-full text-left bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md hover:border-primary-300 transition-all"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-gray-900">
                                Section {section.sectionNumber ?? "—"}
                              </span>
                              <span className="text-sm text-gray-500">
                                {section.semester}
                              </span>
                              {section.campus && (
                                <span className="text-xs text-gray-400">
                                  {section.campus}
                                </span>
                              )}
                            </div>
                            {sectionInstructorNames(section).length > 0 && (
                              <div className="mt-1.5">
                                <div className="text-sm text-gray-700 truncate">
                                  {sectionInstructorNames(section).join(", ")}
                                </div>
                              </div>
                            )}
                            {section.registrationRestrictions && (
                              <div className="mt-1 text-xs text-gray-500 line-clamp-2">
                                <span className="font-medium text-gray-600">Requirements:</span>{" "}
                                {section.registrationRestrictions}
                              </div>
                            )}
                            {sectionTopic(section) && (
                              <div className="mt-1 text-xs text-gray-600 line-clamp-2">
                                <span className="font-medium text-gray-700">Description:</span>{" "}
                                {sectionTopic(section)}
                              </div>
                            )}
                          </div>
                          <div className="text-right text-sm shrink-0">
                            {scheds.length > 0 && (
                              <div className="font-medium text-gray-700 space-y-0.5">
                                {scheds.map((sched, idx) => (
                                  <div key={`${section.id}:${sched.days.join("/")}:${sched.start}:${idx}`}>
                                    {sched.days.join("/")} {formatTimeRange12h(sched.start, sched.end)}
                                    {sched.location ? ` • ${sched.location}` : ""}
                                  </div>
                                ))}
                              </div>
                            )}
                            {sectionEnrollment !== null && (
                              <div
                                className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${enrollmentTone(
                                  sectionEnrollment
                                )}`}
                              >
                                {sectionEnrollment}% enrolled
                              </div>
                            )}
                            <div className="flex justify-end gap-3 mt-2">
                              <RatingBadge value={section.instructorAvgQuality ?? null} label="Prof" size="sm" />
                              <RatingBadge value={section.avgDifficulty ?? null} label="D" size="sm" />
                              <RatingBadge value={section.avgWorkload ?? null} label="W" size="sm" />
                            </div>
                            <div className="text-xs text-gray-500 mt-1">Click for details</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </details>
            ))}
          </div>
          )}

          {miniCalendarBlocks.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Section Times (Mini Calendar)</h3>
              <MiniWeeklyCalendar
                blocks={miniCalendarBlocks}
                onSelectSection={(sid) => setActiveSectionId(sid)}
              />
              <p className="text-xs text-gray-500 mt-2">
                Click a block to open that section’s details.
              </p>
            </div>
          )}

          <Modal
            isOpen={!!activeSection}
            title={activeSection ? `Section ${activeSection.sectionNumber ?? "—"}` : "Section"}
            onClose={closeSectionModal}
          >
            {activeSection ? (
              <div className="space-y-4">
                {(() => {
                  const activeEnrollment = enrollmentPercent(
                    activeSection.enrollmentCur ?? 0,
                    activeSection.enrollmentCap
                  );
                  return activeEnrollment !== null ? (
                    <div
                      className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${enrollmentTone(
                        activeEnrollment
                      )}`}
                    >
                      {activeEnrollment}% enrolled
                    </div>
                  ) : null;
                })()}
                <div className="flex gap-4">
                  <RatingBadge value={activeSection.instructorAvgQuality ?? null} label="Prof" />
                  <RatingBadge value={activeSection.avgDifficulty ?? null} label="Difficulty" />
                  <RatingBadge value={activeSection.avgWorkload ?? null} label="Workload" />
                  <div className="flex flex-col items-center">
                    <span className="text-lg font-bold text-gray-700">{activeSection.reviewCount ?? 0}</span>
                    <span className="text-xs text-gray-500">Reviews</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md border border-gray-200 bg-white p-3">
                    <div className="text-xs text-gray-500">Seats Available</div>
                    <div className="text-lg font-semibold text-gray-900">
                      {seatsAvailForSection(activeSection) ?? "—"}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Capacity {activeSection.enrollmentCap ?? "—"} · Enrolled {activeSection.enrollmentCur ?? 0}
                    </div>
                  </div>
                  <div className="rounded-md border border-gray-200 bg-white p-3">
                    <div className="text-xs text-gray-500">Waitlist</div>
                    <div className="text-lg font-semibold text-gray-900">
                      {activeSection.waitlistCount ?? 0}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Cap {activeSection.waitlistCap ?? "—"}
                    </div>
                  </div>
                </div>

                <SectionDetails section={activeSection} />

                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      setScheduleMessage("");
                      try {
                        await addToSchedule.mutateAsync({ sectionId: activeSection.id });
                        setScheduleMessage("Added to My Schedule");
                      } catch (e: any) {
                        setScheduleMessage(e?.message || "Failed to add to schedule");
                      }
                    }}
                    disabled={addToSchedule.isPending}
                    className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
                  >
                    {addToSchedule.isPending ? "Adding..." : "Add to My Schedule"}
                  </button>
                  {scheduleMessage && (
                    <div
                      className={`text-sm ${
                        scheduleMessage.toLowerCase().includes("fail")
                          ? "text-red-600"
                          : "text-gray-600"
                      }`}
                    >
                      {scheduleMessage}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Section Reviews</h3>
	                  <div className="space-y-3 mt-2">
	                    {(sectionReviews ?? []).map((review) => (
	                      <ReviewCard
	                        key={review.id}
	                        review={review}
	                        onEdit={(r) => setEditingReview(r)}
	                        onDelete={(id) =>
	                          deleteReview.mutate({ reviewId: id, courseId, sectionId: review.sectionId })
	                        }
	                      />
	                    ))}
	                    {sectionReviews?.length === 0 && (
	                      <p className="text-sm text-gray-500">No reviews for this section yet.</p>
	                    )}
	                  </div>
	                </div>
              </div>
            ) : null}
          </Modal>
        </div>
      )}

      {/* Reviews */}
      <div data-tour-id="course-detail-reviews">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Reviews</h2>

        <ReviewForm
          sections={sectionOptions}
          onSubmit={(data) => createReview.mutate(data)}
          isLoading={createReview.isPending}
        />

        {createReview.isError && (
          <p className="text-sm text-red-600 mt-2">
            {(createReview.error as any)?.message || "Failed to submit review"}
          </p>
        )}

        <div className="space-y-3 mt-4">
          {reviews?.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              onEdit={(r) => setEditingReview(r)}
              onDelete={(id) =>
                deleteReview.mutate({ reviewId: id, courseId, sectionId: review.sectionId })
              }
            />
          ))}
          {reviews?.length === 0 && (
            <p className="text-sm text-gray-500">No reviews yet. Be the first!</p>
          )}
        </div>
      </div>

      <Modal
        isOpen={isReportModalOpen}
        title="Report Inaccurate Details"
        onClose={closeReportModal}
      >
        <form onSubmit={handleSubmitInaccurateReport} className="space-y-4">
          <p className="text-sm text-gray-600">
            Tell us what is inaccurate for <span className="font-medium text-gray-900">{course.code}</span>.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="report-section">
              Section (optional)
            </label>
            <select
              id="report-section"
              value={reportSectionId === "" ? "" : String(reportSectionId)}
              onChange={(e) => setReportSectionId(e.target.value ? Number(e.target.value) : "")}
              className="mt-1 w-full rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500"
            >
              <option value="">Course page in general</option>
              {sectionOptions.map((section) => (
                <option key={section.id} value={section.id}>
                  Section {section.sectionNumber ?? "—"} · {section.semester}
                  {section.instructorName ? ` · ${section.instructorName}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="report-message">
              What is inaccurate?
            </label>
            <textarea
              id="report-message"
              value={reportMessage}
              onChange={(e) => setReportMessage(e.target.value)}
              rows={6}
              required
              minLength={10}
              maxLength={4000}
              placeholder="Example: Section 101 says open seats, but enrollment is closed in Atlas."
              className="mt-1 w-full rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500"
            />
            <div className="mt-1 text-xs text-gray-500">{reportMessage.length}/4000</div>
          </div>

          {submitFeedback.isError && (
            <p className="text-sm text-red-600">
              {(submitFeedback.error as any)?.message || "Failed to submit report"}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeReportModal}
              className="px-3 py-2 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitFeedback.isPending}
              className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              {submitFeedback.isPending ? "Submitting..." : "Submit Report"}
            </button>
          </div>
        </form>
      </Modal>

      <EditReviewModal
        isOpen={!!editingReview}
        review={editingReview}
        sections={editSectionOptions}
        isLoading={updateReview.isPending}
        error={
          updateReview.isError
            ? ((updateReview.error as any)?.message || "Failed to update review")
            : null
        }
        onClose={closeEditModal}
        onSubmit={(data, prevSectionId) =>
          editingReview
            ? updateReview.mutate(
                { reviewId: editingReview.id, data, prevSectionId },
                { onSuccess: () => closeEditModal() }
              )
            : undefined
        }
      />
    </div>
  );
}
