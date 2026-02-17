import { useEffect, useMemo, useState } from "react";
import {
  CAMPUS_OPTIONS,
  COMPONENT_TYPE_OPTIONS,
  GER_TAGS,
  INSTRUCTION_METHOD_OPTIONS,
  SEMESTERS,
} from "@betteratlas/shared";
import {
  useAiCourseRecommendations,
  useAiTrainerRatings,
  useUpsertAiTrainerRating,
  type AiCourseRecommendation,
  type AiMessage,
  type AiPreferenceCourse,
  type AiRecommendationFilters,
} from "../../hooks/useAi.js";

type TrainerFilterForm = {
  semester: string;
  department: string;
  minRating: string;
  credits: string;
  attributes: string;
  instructor: string;
  campus: string;
  componentType: string;
  instructionMethod: string;
};

type AutoTrainerQuery = {
  id: string;
  prompt: string;
  filters: AiRecommendationFilters;
  note: string;
};

const TRAINER_PREFS_STORAGE_KEY = "betteratlas.admin.aiTrainer.labels.v1";

const AUTO_TOPICS = [
  "discussion-heavy humanities classes",
  "intro courses for non-majors",
  "creative classes with projects",
  "quantitative classes with practical applications",
  "writing intensive classes",
  "policy and society classes",
  "science classes with lab exposure",
  "classes that mix theory and real-world examples",
];

const AUTO_PACES = [
  "lighter",
  "balanced",
  "challenging but manageable",
];

const AUTO_GOALS = [
  "interesting course discussions",
  "clear grading expectations",
  "skills they can use outside class",
  "strong instructor support",
  "classes that keep motivation high",
];

const AUTO_DEPARTMENTS = [
  "ENGL",
  "HIST",
  "PSYC",
  "SOC",
  "PHIL",
  "ECON",
  "ARTH",
  "BIOL",
  "QTM",
  "THEA",
];

const AUTO_MIN_RATINGS = [3, 3.5, 4];
const AUTO_CREDITS = [3, 4];

function ThumbUpIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.82 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" />
    </svg>
  );
}

function ThumbDownIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M15 3H6c-.82 0-1.54.5-1.84 1.22L1.14 11.27c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.58-6.59c.37-.36.59-.86.59-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z" />
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

function pick<T>(arr: readonly T[], n: number) {
  return arr[Math.abs(n) % arr.length] as T;
}

function toFilters(raw: TrainerFilterForm): AiRecommendationFilters {
  const out: AiRecommendationFilters = {};
  const toNum = (v: string) => {
    const trimmed = String(v ?? "").trim();
    if (!trimmed) return undefined;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : undefined;
  };

  if (raw.semester.trim()) out.semester = raw.semester.trim();
  if (raw.department.trim()) out.department = raw.department.trim();
  if (typeof toNum(raw.minRating) === "number") out.minRating = toNum(raw.minRating);
  if (typeof toNum(raw.credits) === "number") out.credits = toNum(raw.credits);
  if (raw.attributes.trim()) out.attributes = raw.attributes.trim();
  if (raw.instructor.trim()) out.instructor = raw.instructor.trim();
  if (raw.campus.trim()) out.campus = raw.campus.trim();
  if (raw.componentType.trim()) out.componentType = raw.componentType.trim();
  if (raw.instructionMethod.trim()) out.instructionMethod = raw.instructionMethod.trim();

  return out;
}

function fromFilters(filters: AiRecommendationFilters): TrainerFilterForm {
  return {
    semester: filters.semester ? String(filters.semester) : "",
    department: filters.department ? String(filters.department) : "",
    minRating:
      typeof filters.minRating === "number" ? String(filters.minRating) : "",
    credits: typeof filters.credits === "number" ? String(filters.credits) : "",
    attributes: filters.attributes ? String(filters.attributes) : "",
    instructor: filters.instructor ? String(filters.instructor) : "",
    campus: filters.campus ? String(filters.campus) : "",
    componentType: filters.componentType ? String(filters.componentType) : "",
    instructionMethod: filters.instructionMethod
      ? String(filters.instructionMethod)
      : "",
  };
}

function summarizeFilters(filters: AiRecommendationFilters) {
  const parts: string[] = [];
  if (filters.semester) parts.push(`semester=${filters.semester}`);
  if (filters.department) parts.push(`department=${filters.department}`);
  if (typeof filters.minRating === "number") parts.push(`minRating=${filters.minRating}`);
  if (typeof filters.credits === "number") parts.push(`credits=${filters.credits}`);
  if (filters.attributes) parts.push(`ger=${filters.attributes}`);
  if (filters.campus) parts.push(`campus=${filters.campus}`);
  if (filters.componentType) parts.push(`type=${filters.componentType}`);
  if (filters.instructionMethod) parts.push(`method=${filters.instructionMethod}`);
  if (filters.instructor) parts.push(`instructor=${filters.instructor}`);
  return parts.join(", ");
}

function buildAutoQuery(index: number, seed: number): AutoTrainerQuery {
  const n = seed + index * 17;
  const topic = pick(AUTO_TOPICS, n + 1);
  const pace = pick(AUTO_PACES, n + 3);
  const goal = pick(AUTO_GOALS, n + 5);
  const semester = pick(SEMESTERS, n + 7);
  const campus = pick(CAMPUS_OPTIONS, n + 11);
  const gerCode = pick(Object.keys(GER_TAGS), n + 13);
  const dept = pick(AUTO_DEPARTMENTS, n + 17);
  const credits = pick(AUTO_CREDITS, n + 19);
  const minRating = pick(AUTO_MIN_RATINGS, n + 23);
  const componentType = pick(Object.keys(COMPONENT_TYPE_OPTIONS), n + 29);
  const instructionMethod = pick(Object.keys(INSTRUCTION_METHOD_OPTIONS), n + 31);

  let filters: AiRecommendationFilters = { semester };
  let note = `Semester + quality preference`;

  switch (index % 6) {
    case 0:
      filters = { semester, minRating };
      note = "Semester + rating";
      break;
    case 1:
      filters = { semester, campus };
      note = "Semester + campus";
      break;
    case 2:
      filters = { semester, attributes: gerCode };
      note = "Semester + GER";
      break;
    case 3:
      filters = { semester, credits, componentType };
      note = "Semester + credits + component type";
      break;
    case 4:
      filters = { semester, minRating, instructionMethod };
      note = "Semester + rating + instruction method";
      break;
    default:
      filters = { department: dept, minRating };
      note = "Department + rating";
      break;
  }

  const constraintText = summarizeFilters(filters);
  const prompt =
    `Recommend six courses for a student who wants ${topic}. ` +
    `They prefer a ${pace} workload and care about ${goal}. ` +
    `Apply these constraints: ${constraintText}.`;

  return {
    id: `auto-${seed}-${index}`,
    prompt,
    filters,
    note,
  };
}

function generateAutoQueryBatch(count: number): AutoTrainerQuery[] {
  const seed = Date.now();
  const out: AutoTrainerQuery[] = [];
  for (let i = 0; i < count; i++) {
    out.push(buildAutoQuery(i, seed));
  }
  return out;
}

export default function AdminAiTrainer() {
  const ai = useAiCourseRecommendations();
  const trainerRatingsQuery = useAiTrainerRatings();
  const upsertRating = useUpsertAiTrainerRating();
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [allRecs, setAllRecs] = useState<AiCourseRecommendation[]>([]);
  const [liked, setLiked] = useState<AiPreferenceCourse[]>([]);
  const [disliked, setDisliked] = useState<AiPreferenceCourse[]>([]);
  const [filters, setFilters] = useState<TrainerFilterForm>({
    semester: "",
    department: "",
    minRating: "",
    credits: "",
    attributes: "",
    instructor: "",
    campus: "",
    componentType: "",
    instructionMethod: "",
  });
  const [autoQueries, setAutoQueries] = useState<AutoTrainerQuery[]>(
    generateAutoQueryBatch(10)
  );
  const [autoCursor, setAutoCursor] = useState(0);
  const [activeAutoQueryId, setActiveAutoQueryId] = useState<string | null>(
    null
  );

  const appliedFilters = useMemo(() => toFilters(filters), [filters]);
  const recs = allRecs.length > 0 ? allRecs : ai.data?.recommendations ?? [];

  // Hydrate from DB ratings when they load; fall back to localStorage on first mount.
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
      }
      setLiked(dbLiked.slice(0, 80));
      setDisliked(dbDisliked.slice(0, 80));
      setDbHydrated(true);
      return;
    }

    // Fall back to localStorage if DB has no ratings.
    try {
      const raw = localStorage.getItem(TRAINER_PREFS_STORAGE_KEY);
      if (!raw) { setDbHydrated(true); return; }
      const parsed = JSON.parse(raw) as {
        liked?: AiPreferenceCourse[];
        disliked?: AiPreferenceCourse[];
      };
      setLiked(Array.isArray(parsed?.liked) ? parsed.liked.slice(0, 80) : []);
      setDisliked(Array.isArray(parsed?.disliked) ? parsed.disliked.slice(0, 80) : []);
    } catch {
      // Ignore invalid storage.
    }
    setDbHydrated(true);
  }, [dbHydrated, trainerRatingsQuery.isLoading, trainerRatingsQuery.data]);

  useEffect(() => {
    try {
      localStorage.setItem(
        TRAINER_PREFS_STORAGE_KEY,
        JSON.stringify({ liked: liked.slice(0, 80), disliked: disliked.slice(0, 80) })
      );
    } catch {
      // Ignore storage failures.
    }
  }, [liked, disliked]);

  function mark(course: AiCourseRecommendation["course"], verdict: "liked" | "disliked") {
    const s = snapshot(course);
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
    // Persist to DB (fire-and-forget alongside optimistic local state).
    upsertRating.mutate({
      courseId: s.id,
      rating: verdict === "liked" ? 1 : -1,
      context: s,
    });
  }

  function applyAssistantResponse(response: {
    assistantMessage: string;
    followUpQuestion: string | null;
    recommendations: AiCourseRecommendation[];
  }) {
    setAllRecs(response.recommendations);
    const assistant = [
      response.assistantMessage,
      response.followUpQuestion ? `Follow-up: ${response.followUpQuestion}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    setMessages((cur) =>
      [...cur, { role: "assistant" as const, content: assistant }].slice(-12)
    );
  }

  function run() {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    setActiveAutoQueryId(null);
    const next = [...messages, { role: "user" as const, content: trimmed }].slice(-12);
    setMessages(next);
    ai.mutate(
      {
        messages: next,
        filters: appliedFilters,
        preferences: {
          liked,
          disliked,
        },
      },
      {
        onSuccess: (r) => applyAssistantResponse(r),
      }
    );
  }

  function runAutoQuery(query: AutoTrainerQuery, nextCursor: number) {
    setActiveAutoQueryId(query.id);
    setPrompt(query.prompt);
    setFilters(fromFilters(query.filters));
    setMessages([{ role: "user", content: query.prompt }]);
    setAutoCursor(nextCursor);

    ai.mutate(
      {
        prompt: query.prompt,
        reset: true,
        filters: query.filters,
        preferences: {
          liked,
          disliked,
        },
      },
      {
        onSuccess: (r) => {
          setMessages([
            { role: "user", content: query.prompt },
            {
              role: "assistant",
              content: [
                r.assistantMessage,
                r.followUpQuestion ? `Follow-up: ${r.followUpQuestion}` : "",
              ]
                .filter(Boolean)
                .join("\n\n"),
            },
          ]);
          setAllRecs(r.recommendations);
        },
      }
    );
  }

  function runAutoAt(index: number) {
    if (index < 0 || index >= autoQueries.length) return;
    const q = autoQueries[index];
    const nextCursor = Math.max(autoCursor, index + 1);
    runAutoQuery(q, nextCursor);
  }

  function runNextAutoQuery() {
    if (autoQueries.length === 0) {
      const batch = generateAutoQueryBatch(10);
      setAutoQueries(batch);
      setAutoCursor(0);
      runAutoQuery(batch[0], 1);
      return;
    }

    if (autoCursor >= autoQueries.length) {
      const batch = generateAutoQueryBatch(10);
      setAutoQueries(batch);
      setAutoCursor(0);
      runAutoQuery(batch[0], 1);
      return;
    }

    runAutoAt(autoCursor);
  }

  function regenerateAutoQueries() {
    setAutoQueries(generateAutoQueryBatch(10));
    setAutoCursor(0);
    setActiveAutoQueryId(null);
  }

  function generateMore() {
    if (ai.isPending || messages.length === 0) return;
    const excludeCourseIds = recs.map((r) => r.course.id).slice(-200);
    ai.mutate(
      {
        messages,
        excludeCourseIds,
        filters: appliedFilters,
        preferences: {
          liked,
          disliked,
        },
      },
      {
        onSuccess: (r) => {
          setAllRecs((cur) => {
            const seen = new Set<number>(cur.map((x) => x.course.id));
            const out = [...cur];
            for (const rec of r.recommendations) {
              if (seen.has(rec.course.id)) continue;
              out.push(rec);
              seen.add(rec.course.id);
            }
            return out;
          });
        },
      }
    );
  }

  function reset() {
    setPrompt("");
    setMessages([]);
    setAllRecs([]);
    setActiveAutoQueryId(null);
    ai.reset();
    ai.mutate({ reset: true });
  }

  function clearTraining() {
    setLiked([]);
    setDisliked([]);
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Developers AI Trainer</h2>
            <p className="text-sm text-gray-600">
              Auto-generate prompts, run one-click evaluations, then rate courses with thumbs.
            </p>
          </div>
          <div className="text-xs text-gray-500">
            Labels: {liked.length} up / {disliked.length} down
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={runNextAutoQuery}
            disabled={ai.isPending}
            className="bg-primary-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-60"
          >
            {ai.isPending ? "Running..." : "Run Next Auto Query"}
          </button>
          <button
            onClick={regenerateAutoQueries}
            className="bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-50"
          >
            Regenerate Auto Queries
          </button>
          <button
            onClick={clearTraining}
            className="bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-50"
          >
            Clear Labels
          </button>
        </div>

        <div className="text-xs text-gray-500">
          Queue position: {Math.min(autoCursor + 1, autoQueries.length)}/{autoQueries.length}
        </div>

        <div className="grid lg:grid-cols-2 gap-3 max-h-[260px] overflow-auto pr-1">
          {autoQueries.map((q, idx) => (
            <button
              key={q.id}
              type="button"
              onClick={() => runAutoAt(idx)}
              className={`text-left rounded-md border p-3 transition-colors ${
                activeAutoQueryId === q.id
                  ? "border-primary-400 bg-primary-50"
                  : idx < autoCursor
                    ? "border-green-200 bg-green-50 hover:bg-green-100"
                    : "border-gray-200 bg-white hover:bg-gray-50"
              }`}
            >
              <p className="text-xs font-semibold text-gray-700">
                Query {idx + 1} - {q.note}
              </p>
              <p className="text-xs text-gray-500 mt-1">{summarizeFilters(q.filters)}</p>
              <p className="text-sm text-gray-800 mt-2 line-clamp-3">{q.prompt}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
        <h3 className="font-semibold text-gray-900">Manual Prompt Override</h3>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="Optional manual prompt for ad-hoc checks."
          className="w-full rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500"
        />

        <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-3">
          <input
            value={filters.semester}
            onChange={(e) => setFilters((cur) => ({ ...cur, semester: e.target.value }))}
            placeholder="Semester"
            className="rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500"
          />
          <input
            value={filters.department}
            onChange={(e) => setFilters((cur) => ({ ...cur, department: e.target.value }))}
            placeholder="Dept (e.g. HIST)"
            className="rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500"
          />
          <input
            value={filters.minRating}
            onChange={(e) => setFilters((cur) => ({ ...cur, minRating: e.target.value }))}
            placeholder="Min rating"
            className="rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500"
          />
          <input
            value={filters.credits}
            onChange={(e) => setFilters((cur) => ({ ...cur, credits: e.target.value }))}
            placeholder="Credits"
            className="rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500"
          />
          <input
            value={filters.attributes}
            onChange={(e) => setFilters((cur) => ({ ...cur, attributes: e.target.value }))}
            placeholder="GER codes (comma)"
            className="rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={run}
            disabled={ai.isPending}
            className="bg-primary-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-60"
          >
            {ai.isPending ? "Running..." : "Run Manual Prompt"}
          </button>
          <button
            onClick={generateMore}
            disabled={ai.isPending || messages.length === 0}
            className="bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
          >
            Generate More
          </button>
          <button
            onClick={reset}
            className="bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-50"
          >
            Reset Chat
          </button>
        </div>

        {ai.isError && (
          <p className="text-sm text-red-700">{(ai.error as any)?.message || "AI request failed"}</p>
        )}

        {ai.data?.assistantMessage && (
          <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 whitespace-pre-line">
            {ai.data.assistantMessage}
            {ai.data.followUpQuestion ? `\n\nFollow-up: ${ai.data.followUpQuestion}` : ""}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {recs.map((rec) => (
          <div key={rec.course.id} className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
            <div>
              <p className="text-xs text-primary-600 font-semibold">
                {rec.course.code} - Fit {rec.fitScore}/10
              </p>
              <p className="font-medium text-gray-900">{rec.course.title}</p>
              {rec.course.instructors && rec.course.instructors.length > 0 && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {rec.course.instructors.slice(0, 2).join(", ")}
                </p>
              )}
            </div>
            <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
              {rec.why.slice(0, 4).map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => mark(rec.course, "liked")}
                aria-label={`Thumbs up for ${rec.course.code} ${rec.course.title}`}
                title="Thumbs up"
                className={`inline-flex items-center justify-center h-8 w-8 rounded-full border transition-colors ${
                  liked.some((x) => x.id === rec.course.id)
                    ? "bg-green-600 text-white border-green-600"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                <ThumbUpIcon />
              </button>
              <button
                type="button"
                onClick={() => mark(rec.course, "disliked")}
                aria-label={`Thumbs down for ${rec.course.code} ${rec.course.title}`}
                title="Thumbs down"
                className={`inline-flex items-center justify-center h-8 w-8 rounded-full border transition-colors ${
                  disliked.some((x) => x.id === rec.course.id)
                    ? "bg-red-600 text-white border-red-600"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                <ThumbDownIcon />
              </button>
            </div>
          </div>
        ))}
        {recs.length === 0 && (
          <div className="text-sm text-gray-500">
            Run an auto query and start rating recommendations with thumbs.
          </div>
        )}
      </div>
    </div>
  );
}
