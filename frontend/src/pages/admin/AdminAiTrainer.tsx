import { useEffect, useMemo, useState } from "react";
import {
  useAiCourseRecommendations,
  type AiCourseRecommendation,
  type AiMessage,
  type AiPreferenceCourse,
  type AiRecommendationFilters,
} from "../../hooks/useAi.js";

function snapshot(course: AiCourseRecommendation["course"]): AiPreferenceCourse {
  return {
    id: course.id,
    code: course.code,
    title: course.title,
    department: course.department?.code ?? null,
    gers: (course.gers ?? []).slice(0, 12),
    campuses: (course.campuses ?? []).slice(0, 12),
    instructors: (course.instructors ?? []).slice(0, 12),
    description: course.description ?? null,
  };
}

const TRAINER_PREFS_STORAGE_KEY = "betteratlas.admin.aiTrainer.labels.v1";

function toFilters(raw: {
  semester: string;
  department: string;
  minRating: string;
  credits: string;
  attributes: string;
  instructor: string;
  campus: string;
  componentType: string;
  instructionMethod: string;
}): AiRecommendationFilters {
  const out: AiRecommendationFilters = {};
  const toNum = (v: string) => {
    const n = Number(v);
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

export default function AdminAiTrainer() {
  const ai = useAiCourseRecommendations();
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [allRecs, setAllRecs] = useState<AiCourseRecommendation[]>([]);
  const [liked, setLiked] = useState<AiPreferenceCourse[]>([]);
  const [disliked, setDisliked] = useState<AiPreferenceCourse[]>([]);
  const [filters, setFilters] = useState({
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

  const appliedFilters = useMemo(() => toFilters(filters), [filters]);
  const recs = allRecs.length > 0 ? allRecs : ai.data?.recommendations ?? [];

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TRAINER_PREFS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { liked?: AiPreferenceCourse[]; disliked?: AiPreferenceCourse[] };
      setLiked(Array.isArray(parsed?.liked) ? parsed.liked.slice(0, 80) : []);
      setDisliked(Array.isArray(parsed?.disliked) ? parsed.disliked.slice(0, 80) : []);
    } catch {
      // Ignore invalid storage.
    }
  }, []);

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
  }

  function run() {
    const trimmed = prompt.trim();
    if (!trimmed) return;
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
        onSuccess: (r) => {
          setAllRecs(r.recommendations);
          const assistant = [
            r.assistantMessage,
            r.followUpQuestion ? `Follow-up: ${r.followUpQuestion}` : "",
          ]
            .filter(Boolean)
            .join("\n\n");
          setMessages((cur) => [...cur, { role: "assistant" as const, content: assistant }].slice(-12));
        },
      }
    );
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
            <h2 className="text-lg font-semibold text-gray-900">AI Trainer Workspace</h2>
            <p className="text-sm text-gray-600">
              Developer loop: prompt, inspect recommendations, label each as good/bad.
            </p>
          </div>
          <div className="text-xs text-gray-500">
            Labeled feedback: {liked.length} good / {disliked.length} bad
          </div>
        </div>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="Example: I want a discussion-heavy humanities class with low workload."
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
            {ai.isPending ? "Running..." : "Run Prompt"}
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
          <button
            onClick={clearTraining}
            className="bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-50"
          >
            Clear Labels
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
                <p className="text-xs text-gray-500 mt-0.5">{rec.course.instructors.slice(0, 2).join(", ")}</p>
              )}
            </div>
            <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
              {rec.why.slice(0, 4).map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => mark(rec.course, "liked")}
                className={`px-2.5 py-1 rounded-md text-xs font-medium border ${
                  liked.some((x) => x.id === rec.course.id)
                    ? "bg-green-600 text-white border-green-600"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                Good
              </button>
              <button
                type="button"
                onClick={() => mark(rec.course, "disliked")}
                className={`px-2.5 py-1 rounded-md text-xs font-medium border ${
                  disliked.some((x) => x.id === rec.course.id)
                    ? "bg-red-600 text-white border-red-600"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                Bad
              </button>
            </div>
          </div>
        ))}
        {recs.length === 0 && (
          <div className="text-sm text-gray-500">Run a prompt to start labeling recommendations.</div>
        )}
      </div>
    </div>
  );
}
