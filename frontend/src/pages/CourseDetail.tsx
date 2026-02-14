import { useParams, Link } from "react-router-dom";
import { useCourseDetail } from "../hooks/useCourses.js";
import { useMemo, useState, useCallback } from "react";
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

function SectionDetails({ section }: { section: Section }) {
  const sched = section.schedule as Schedule | null;
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

      {section.instructor && (
        <div>
          <span className="font-medium text-gray-800">Professor:</span>{" "}
          <Link to={`/professors/${section.instructor.id}`} className="text-gray-900 hover:underline">
            {section.instructor.name}
          </Link>
          {section.instructor.email && (
            <a
              href={`mailto:${section.instructor.email}`}
              className="text-primary-600 hover:text-primary-800 ml-2"
            >
              {section.instructor.email}
            </a>
          )}
        </div>
      )}

      {sched && (
        <div>
          <span className="font-medium text-gray-800">Meeting:</span>{" "}
          {sched.days.join("/")} {formatTimeRange12h(sched.start, sched.end)}
          {sched.location ? <span className="text-gray-600">, {sched.location}</span> : null}
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
  const [editingReview, setEditingReview] = useState<ReviewWithAuthor | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<number | null>(null);
  const closeSectionModal = useCallback(() => setActiveSectionId(null), []);
  const closeEditModal = useCallback(() => setEditingReview(null), []);
  const [scheduleMessage, setScheduleMessage] = useState<string>("");

  const professors = useMemo(() => {
    const c = course;
    if (!c) return [];

    if (c.professors && c.professors.length > 0) return c.professors;

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

    for (const s of c.sections) {
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

    return Array.from(seen.values());
  }, [course]);

  const activeSection = useMemo(() => {
    if (!course) return null;
    return course.sections.find((s) => s.id === activeSectionId) ?? null;
  }, [course, activeSectionId]);

  const { data: sectionReviews } = useSectionReviews(activeSection?.id ?? null);

  const groupedSections = useMemo(() => {
    if (!course) return [];

    const map = new Map<
      string,
      { key: string; instructorId: number | null; instructorName: string; sections: Section[] }
    >();

    for (const s of course.sections) {
      const instructorId = s.instructor?.id ?? null;
      const instructorName = s.instructor?.name ?? "TBA";
      const key = instructorId !== null ? `i:${instructorId}` : "i:tba";
      if (!map.has(key)) {
        map.set(key, { key, instructorId, instructorName, sections: [] });
      }
      map.get(key)!.sections.push(s);
    }

    const groups = Array.from(map.values());
    for (const g of groups) {
      g.sections.sort((a, b) => {
        const ak = sectionNumberSortKey(a.sectionNumber ?? null);
        const bk = sectionNumberSortKey(b.sectionNumber ?? null);
        if (ak.num !== bk.num) return ak.num - bk.num;
        if (ak.suffix !== bk.suffix) return ak.suffix.localeCompare(bk.suffix);
        return a.id - b.id;
      });
    }

    groups.sort((a, b) => {
      // Put "TBA" at the end.
      const atba = a.instructorId === null;
      const btba = b.instructorId === null;
      if (atba !== btba) return atba ? 1 : -1;
      return a.instructorName.localeCompare(b.instructorName);
    });

    return groups;
  }, [course]);

  const miniCalendarBlocks = useMemo(() => {
    if (!course) return [] as MiniBlock[];

    const blocks: MiniBlock[] = [];
    for (const s of course.sections) {
      const sched = s.schedule as Schedule | null;
      if (!sched) continue;
      const startMin = parseHHMMColon(sched.start);
      const endMin = parseHHMMColon(sched.end);
      if (startMin === null || endMin === null || endMin <= startMin) continue;

      const label = `Sec ${s.sectionNumber ?? "—"}`;
      const instructor = s.instructor?.name ? ` • ${s.instructor.name}` : "";
      const title = `${course.code} ${label} — ${formatTimeRange12h(sched.start, sched.end)}${sched.location ? ` • ${sched.location}` : ""}${instructor}`;
      const color = hashColor(`section:${s.id}`);

      for (const day of sched.days) {
        blocks.push({
          id: `sec:${s.id}:${day}`,
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

    return blocks;
  }, [course]);

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
      <Link to="/catalog" className="text-sm text-primary-600 hover:text-primary-800">
        &larr; Back to catalog
      </Link>

      {/* Header */}
      <div className="mt-4 mb-6">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-lg font-semibold text-primary-600">{course.code}</span>
          {course.credits && (
            <span className="text-sm text-gray-500">{course.credits} credits</span>
          )}
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{course.title}</h1>
        {course.department && (
          <p className="text-sm text-gray-500 mt-1">{course.department.name}</p>
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
        </div>
      </div>

      {/* Sections */}
      {course.sections.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Sections</h2>
          <div className="space-y-3">
            {groupedSections.map((group) => (
              <details
                key={group.key}
                className="bg-white rounded-lg border border-gray-200 p-3"
                open={course.sections.length <= 8}
              >
                <summary className="cursor-pointer select-none list-none flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">
                      {group.instructorName}
                      <span className="text-xs font-normal text-gray-500 ml-2">
                        {group.sections.length} section{group.sections.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {group.instructorId !== null && (
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
                    const sched = section.schedule as Schedule | null;
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
                            {section.instructor && (
                              <div className="mt-1.5">
                                <div className="text-sm text-gray-700 truncate">{section.instructor.name}</div>
                              </div>
                            )}
                            {section.registrationRestrictions && (
                              <div className="mt-1 text-xs text-gray-500 line-clamp-2">
                                <span className="font-medium text-gray-600">Requirements:</span>{" "}
                                {section.registrationRestrictions}
                              </div>
                            )}
                          </div>
                          <div className="text-right text-sm shrink-0">
                            {sched && (
                              <div className="font-medium text-gray-700">
                                {sched.days.join("/")} {formatTimeRange12h(sched.start, sched.end)}
                              </div>
                            )}
                            {sched?.location && (
                              <div className="text-sm text-gray-600 mt-0.5">{sched.location}</div>
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
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Reviews</h2>

        <ReviewForm
          sections={course.sections.map((s) => ({
            id: s.id,
            sectionNumber: s.sectionNumber,
            semester: s.semester,
            instructorName: s.instructor?.name ?? null,
          }))}
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

      <EditReviewModal
        isOpen={!!editingReview}
        review={editingReview}
        sections={course.sections.map((s) => ({
          id: s.id,
          sectionNumber: s.sectionNumber,
          semester: s.semester,
          instructorName: s.instructor?.name ?? null,
        }))}
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
