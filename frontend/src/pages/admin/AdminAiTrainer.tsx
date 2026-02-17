import { useCallback, useEffect, useRef, useState } from "react";
import {
  CAMPUS_OPTIONS,
  COMPONENT_TYPE_OPTIONS,
  GER_TAGS,
  INSTRUCTION_METHOD_OPTIONS,
} from "@betteratlas/shared";
import {
  useAiCourseRecommendations,
  useAiTrainerRatings,
  useUpsertAiTrainerRating,
  type AiCourseRecommendation,
  type AiPreferenceCourse,
  type AiRecommendationFilters,
} from "../../hooks/useAi.js";

const TRAINER_PREFS_STORAGE_KEY = "betteratlas.admin.aiTrainer.labels.v1";

// How few unrated items before we fetch more.
const REFILL_THRESHOLD = 4;

const AUTO_TOPICS = [
  "discussion-heavy humanities classes",
  "intro courses for non-majors",
  "creative classes with projects",
  "quantitative classes with practical applications",
  "writing intensive classes",
  "policy and society classes",
  "science classes with lab exposure",
  "classes that mix theory and real-world examples",
  "classes focused on data analysis and statistics",
  "performing arts and studio classes",
  "research-oriented seminar courses",
  "global and cross-cultural perspectives",
  "health and wellness related courses",
  "environmental science and sustainability",
  "business and entrepreneurship fundamentals",
  "computer science and programming",
];

const AUTO_PACES = ["lighter", "balanced", "challenging but manageable"];

const AUTO_GOALS = [
  "interesting course discussions",
  "clear grading expectations",
  "skills they can use outside class",
  "strong instructor support",
  "classes that keep motivation high",
];

const AUTO_DEPARTMENTS = [
  "ENGL", "HIST", "PSYC", "SOC", "PHIL", "ECON", "ARTH",
  "BIOL", "QTM", "THEA", "CS", "MATH", "CHEM", "POLS",
  "ANT", "MUS", "SPAN", "FREN", "PHYS", "NBB",
];

const AUTO_MIN_RATINGS = [3, 3.5, 4];
const AUTO_CREDITS = [3, 4];

function pick<T>(arr: readonly T[], n: number) {
  return arr[Math.abs(n) % arr.length] as T;
}

let querySeq = 0;

function buildAutoQuery(): { prompt: string; filters: AiRecommendationFilters } {
  const n = Date.now() + querySeq++ * 17;
  const topic = pick(AUTO_TOPICS, n + 1);
  const pace = pick(AUTO_PACES, n + 3);
  const goal = pick(AUTO_GOALS, n + 5);
  const campus = pick(CAMPUS_OPTIONS, n + 11);
  const gerCode = pick(Object.keys(GER_TAGS), n + 13);
  const dept = pick(AUTO_DEPARTMENTS, n + 17);
  const credits = pick(AUTO_CREDITS, n + 19);
  const minRating = pick(AUTO_MIN_RATINGS, n + 23);
  const componentType = pick(Object.keys(COMPONENT_TYPE_OPTIONS), n + 29);
  const instructionMethod = pick(Object.keys(INSTRUCTION_METHOD_OPTIONS), n + 31);

  let filters: AiRecommendationFilters;
  switch (querySeq % 8) {
    case 0: filters = { minRating }; break;
    case 1: filters = { campus }; break;
    case 2: filters = { attributes: gerCode }; break;
    case 3: filters = { credits, componentType }; break;
    case 4: filters = { minRating, instructionMethod }; break;
    case 5: filters = { department: dept }; break;
    case 6: filters = { department: dept, minRating }; break;
    default: filters = {}; break;
  }

  const prompt =
    `Recommend courses for a student who wants ${topic}. ` +
    `They prefer a ${pace} workload and care about ${goal}.`;

  return { prompt, filters };
}

function ThumbUpIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.82 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" />
    </svg>
  );
}

function ThumbDownIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M15 3H6c-.82 0-1.54.5-1.84 1.22L1.14 11.27c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.58-6.59c.37-.36.59-.86.59-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z" />
    </svg>
  );
}

function SkipIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
    </svg>
  );
}

function truncate(value: string, max: number) {
  if (value.length <= max) return value;
  return value.slice(0, max);
}

function snapshot(course: AiCourseRecommendation["course"]): AiPreferenceCourse {
  const clampList = (items: string[] | undefined, itemMax: number, countMax: number) =>
    (items ?? []).map((v) => truncate(String(v), itemMax)).slice(0, countMax);

  return {
    id: course.id,
    code: truncate(course.code, 80),
    title: truncate(course.title, 600),
    department: course.department?.code ? truncate(course.department.code, 40) : null,
    gers: clampList(course.gers, 40, 20),
    campuses: clampList(course.campuses, 120, 20),
    instructors: clampList(course.instructors, 240, 20),
    description: course.description ? truncate(course.description, 8000) : null,
  };
}

type QueueItem = AiCourseRecommendation & { key: string };

export default function AdminAiTrainer() {
  const ai = useAiCourseRecommendations();
  const trainerRatingsQuery = useAiTrainerRatings();
  const upsertRating = useUpsertAiTrainerRating();

  // Preference arrays (for sending with each request so the AI can use them).
  const [liked, setLiked] = useState<AiPreferenceCourse[]>([]);
  const [disliked, setDisliked] = useState<AiPreferenceCourse[]>([]);

  // Queue of courses to rate.
  const [queue, setQueue] = useState<QueueItem[]>([]);
  // IDs fading out right now.
  const [fadingIds, setFadingIds] = useState<Set<string>>(new Set());
  // All course IDs we've seen (for exclude dedup).
  const seenIdsRef = useRef<Set<number>>(new Set());
  // Total rated this session.
  const [ratedCount, setRatedCount] = useState(0);
  // Whether initial load has fired.
  const initialLoadFired = useRef(false);
  // Ref to track if a fetch is in-flight (more reliable than ai.isPending across closures).
  const fetchingRef = useRef(false);

  // --- Hydrate from DB / localStorage ---
  const [dbHydrated, setDbHydrated] = useState(false);

  useEffect(() => {
    if (dbHydrated) return;
    if (trainerRatingsQuery.isLoading) return;

    if (trainerRatingsQuery.data && trainerRatingsQuery.data.length > 0) {
      const dbLiked: AiPreferenceCourse[] = [];
      const dbDisliked: AiPreferenceCourse[] = [];
      for (const r of trainerRatingsQuery.data) {
        const pref: AiPreferenceCourse = {
          id: r.courseId,
          code: r.courseCode,
          title: r.courseTitle,
        };
        if (r.rating === 1) dbLiked.push(pref);
        else if (r.rating === -1) dbDisliked.push(pref);
        seenIdsRef.current.add(r.courseId);
      }
      setLiked(dbLiked.slice(0, 80));
      setDisliked(dbDisliked.slice(0, 80));
      setDbHydrated(true);
      return;
    }

    try {
      const raw = localStorage.getItem(TRAINER_PREFS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          liked?: AiPreferenceCourse[];
          disliked?: AiPreferenceCourse[];
        };
        const l = Array.isArray(parsed?.liked) ? parsed.liked.slice(0, 80) : [];
        const d = Array.isArray(parsed?.disliked) ? parsed.disliked.slice(0, 80) : [];
        setLiked(l);
        setDisliked(d);
        for (const c of [...l, ...d]) seenIdsRef.current.add(c.id);
      }
    } catch { /* ignore */ }
    setDbHydrated(true);
  }, [dbHydrated, trainerRatingsQuery.isLoading, trainerRatingsQuery.data]);

  // localStorage write-through.
  useEffect(() => {
    try {
      localStorage.setItem(
        TRAINER_PREFS_STORAGE_KEY,
        JSON.stringify({ liked: liked.slice(0, 80), disliked: disliked.slice(0, 80) })
      );
    } catch { /* ignore */ }
  }, [liked, disliked]);

  // --- Fetch a batch of courses ---
  const fetchBatch = useCallback(() => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    const { prompt, filters } = buildAutoQuery();
    const excludeCourseIds = Array.from(seenIdsRef.current).slice(-200);

    ai.mutate(
      {
        prompt,
        reset: true,
        filters,
        excludeCourseIds,
        preferences: { liked, disliked },
      },
      {
        onSuccess: (r) => {
          const newItems: QueueItem[] = [];
          for (const rec of r.recommendations) {
            if (seenIdsRef.current.has(rec.course.id)) continue;
            seenIdsRef.current.add(rec.course.id);
            newItems.push({ ...rec, key: `${rec.course.id}-${Date.now()}` });
          }
          if (newItems.length > 0) {
            setQueue((cur) => [...cur, ...newItems]);
          }
          fetchingRef.current = false;
        },
        onError: () => {
          fetchingRef.current = false;
        },
      }
    );
  }, [ai, liked, disliked]);

  // Initial load: fire first batch once hydrated.
  useEffect(() => {
    if (!dbHydrated) return;
    if (initialLoadFired.current) return;
    initialLoadFired.current = true;
    fetchBatch();
  }, [dbHydrated, fetchBatch]);

  // Auto-refill: when unrated queue gets low, fetch more.
  const unreatedCount = queue.filter((q) => !fadingIds.has(q.key)).length;

  useEffect(() => {
    if (unreatedCount < REFILL_THRESHOLD && dbHydrated && !fetchingRef.current) {
      fetchBatch();
    }
  }, [unreatedCount, dbHydrated, fetchBatch]);

  // --- Rate a course ---
  function rate(item: QueueItem, verdict: "liked" | "disliked") {
    if (fadingIds.has(item.key)) return;

    const s = snapshot(item.course);

    // Update local preference arrays.
    if (verdict === "liked") {
      setLiked((cur) => {
        const map = new Map<number, AiPreferenceCourse>(cur.map((x) => [x.id, x]));
        map.set(s.id, s);
        return Array.from(map.values()).slice(-80);
      });
      setDisliked((cur) => cur.filter((x) => x.id !== s.id));
    } else {
      setDisliked((cur) => {
        const map = new Map<number, AiPreferenceCourse>(cur.map((x) => [x.id, x]));
        map.set(s.id, s);
        return Array.from(map.values()).slice(-80);
      });
      setLiked((cur) => cur.filter((x) => x.id !== s.id));
    }

    // Persist to DB.
    upsertRating.mutate({
      courseId: s.id,
      rating: verdict === "liked" ? 1 : -1,
      context: s,
    });

    setRatedCount((c) => c + 1);

    // Fade out, then remove from queue.
    setFadingIds((cur) => new Set(cur).add(item.key));
    setTimeout(() => {
      setQueue((cur) => cur.filter((q) => q.key !== item.key));
      setFadingIds((cur) => {
        const next = new Set(cur);
        next.delete(item.key);
        return next;
      });
    }, 300);
  }

  function skip(item: QueueItem) {
    if (fadingIds.has(item.key)) return;
    setFadingIds((cur) => new Set(cur).add(item.key));
    setTimeout(() => {
      setQueue((cur) => cur.filter((q) => q.key !== item.key));
      setFadingIds((cur) => {
        const next = new Set(cur);
        next.delete(item.key);
        return next;
      });
    }, 200);
  }

  function clearTraining() {
    setLiked([]);
    setDisliked([]);
    seenIdsRef.current.clear();
  }

  const visibleQueue = queue.filter((q) => !fadingIds.has(q.key) || fadingIds.has(q.key));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">AI Trainer</h2>
            <p className="text-sm text-gray-500">
              Rate courses to improve recommendations for all users. Courses auto-load as you go.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-1 text-green-700">
                <ThumbUpIcon className="h-4 w-4" /> {liked.length}
              </span>
              <span className="inline-flex items-center gap-1 text-red-700">
                <ThumbDownIcon className="h-4 w-4" /> {disliked.length}
              </span>
              <span className="text-gray-400">|</span>
              <span className="text-gray-600">{ratedCount} this session</span>
            </div>
            <button
              onClick={clearTraining}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Clear all
            </button>
          </div>
        </div>

        {ai.isError && (
          <p className="text-sm text-red-600 mt-2">
            {(ai.error as any)?.message || "Failed to load courses"} — retrying...
          </p>
        )}
      </div>

      {/* Loading state */}
      {visibleQueue.length === 0 && fetchingRef.current && (
        <div className="text-center py-12 text-gray-500 text-sm">
          Loading courses to rate...
        </div>
      )}

      {/* Course feed */}
      <div className="space-y-3">
        {visibleQueue.map((item) => (
          <div
            key={item.key}
            className={`bg-white rounded-lg border border-gray-200 p-4 transition-all duration-300 ${
              fadingIds.has(item.key)
                ? "opacity-0 scale-95 -translate-x-4"
                : "opacity-100 scale-100 translate-x-0"
            }`}
          >
            <div className="flex items-start gap-4">
              {/* Course info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-primary-600 shrink-0">
                    {item.course.code}
                  </span>
                  {item.course.credits != null && (
                    <span className="text-xs text-gray-400">{item.course.credits}cr</span>
                  )}
                  {item.course.department?.code && (
                    <span className="text-xs text-gray-400">{item.course.department.code}</span>
                  )}
                </div>
                <p className="font-medium text-gray-900 mt-0.5">{item.course.title}</p>
                {item.course.instructors && item.course.instructors.length > 0 && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {item.course.instructors.slice(0, 3).join(", ")}
                  </p>
                )}
                {item.course.description && (
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                    {item.course.description}
                  </p>
                )}
                {item.why && item.why.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {item.why.slice(0, 3).map((w, i) => (
                      <span key={i} className="text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">
                        {w}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Rating buttons */}
              <div className="flex flex-col items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => rate(item, "liked")}
                  className="inline-flex items-center justify-center h-10 w-10 rounded-full border-2 border-green-200 text-green-600 hover:bg-green-50 hover:border-green-400 hover:text-green-700 transition-colors active:scale-90"
                  title="Good recommendation"
                >
                  <ThumbUpIcon />
                </button>
                <button
                  type="button"
                  onClick={() => skip(item)}
                  className="inline-flex items-center justify-center h-7 w-7 rounded-full text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
                  title="Skip"
                >
                  <SkipIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => rate(item, "disliked")}
                  className="inline-flex items-center justify-center h-10 w-10 rounded-full border-2 border-red-200 text-red-500 hover:bg-red-50 hover:border-red-400 hover:text-red-700 transition-colors active:scale-90"
                  title="Bad recommendation"
                >
                  <ThumbDownIcon />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Loading more indicator */}
      {visibleQueue.length > 0 && fetchingRef.current && (
        <div className="text-center py-4 text-gray-400 text-xs">
          Loading more...
        </div>
      )}
    </div>
  );
}
