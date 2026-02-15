import { useEffect, useMemo, useState } from "react";
import { useProgram, usePrograms } from "../../hooks/usePrograms.js";
import { useInstructors } from "../../hooks/useInstructors.js";
import {
  SEMESTERS,
  SORT_OPTIONS,
  GER_TAGS,
  CAMPUS_OPTIONS,
  COMPONENT_TYPE_OPTIONS,
  INSTRUCTION_METHOD_OPTIONS,
} from "@betteratlas/shared";

interface CourseFiltersProps {
  filters: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onSetQuery: (q: string) => void;
}

function programLabel(p: { name: string; kind: string; degree?: string | null }) {
  const kindLabel = p.kind === "minor" ? "Minor" : "Major";
  const degree = p.degree ? ` (${p.degree})` : "";
  return `${p.name} - ${kindLabel}${degree}`;
}

function renderTextWithCourseLinks(text: string, onClickCode: (code: string) => void) {
  const re =
    /\b([A-Z][A-Z0-9_]{1,}(?:\/[A-Z][A-Z0-9_]{1,})*)\s*([0-9]{3,4})([A-Z]{0,3})\b/g;

  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;

  const upper = text.toUpperCase();
  while ((m = re.exec(upper))) {
    const start = m.index;
    const end = start + m[0].length;
    if (start > last) parts.push(text.slice(last, start));

    const code = `${m[1]!} ${m[2]!}${m[3] || ""}`;
    parts.push(
      <button
        key={`${start}-${code}`}
        type="button"
        onClick={() => onClickCode(code)}
        className="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium"
        title={`Search ${code}`}
      >
        {code}
      </button>
    );

    last = end;
  }

  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

export default function CourseFilters({
  filters,
  onChange,
  onSetQuery,
}: CourseFiltersProps) {
  const programId = filters.programId ? parseInt(filters.programId, 10) : 0;
  const { data: program } = useProgram(programId);

  const [programInput, setProgramInput] = useState("");
  const [programOpen, setProgramOpen] = useState(false);
  const { data: programResults, isLoading: programsLoading } = usePrograms(programInput);
  const { data: instructors } = useInstructors();
  const [showAdvanced, setShowAdvanced] = useState(
    () =>
      !!(
        filters.instructor ||
        filters.campus ||
        filters.componentType ||
        filters.instructionMethod
      )
  );

  const selectedGers = filters.attributes
    ? filters.attributes.split(",").filter(Boolean)
    : [];

  function toggleGer(code: string) {
    const next = selectedGers.includes(code)
      ? selectedGers.filter((c) => c !== code)
      : [...selectedGers, code];
    onChange("attributes", next.join(","));
  }

  useEffect(() => {
    if (program) setProgramInput(programLabel(program));
  }, [program?.id]);

  const programOptions = useMemo(() => programResults ?? [], [programResults]);

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-900">Filters</h3>

      {/* Basic Filters */}
      <div className="relative">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Major / Minor
        </label>
        <div className="flex gap-2">
          <input
            value={programInput}
            onChange={(e) => {
              setProgramInput(e.target.value);
              setProgramOpen(true);
            }}
            onFocus={() => setProgramOpen(true)}
            placeholder="Search majors and minors..."
            className="w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500"
          />
          {programId > 0 && (
            <button
              type="button"
              onClick={() => {
                setProgramInput("");
                setProgramOpen(false);
                onChange("programId", "");
                onChange("programTab", "");
                onSetQuery("");
              }}
              className="px-2 rounded-md border border-gray-300 text-sm hover:bg-gray-50"
              title="Clear program"
            >
              X
            </button>
          )}
        </div>

        {programOpen && (
          <div className="absolute z-20 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg max-h-64 overflow-auto">
            {programsLoading && (
              <div className="px-3 py-2 text-sm text-gray-500">Loading...</div>
            )}
            {!programsLoading && programOptions.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-500">No programs found</div>
            )}
            {!programsLoading &&
              programOptions.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onChange("programId", String(p.id));
                    onChange("programTab", "required");
                    setProgramInput(programLabel(p));
                    setProgramOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                >
                  {programLabel(p)}
                </button>
              ))}
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Semester
        </label>
        <select
          value={filters.semester || ""}
          onChange={(e) => onChange("semester", e.target.value)}
          className="w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500"
        >
          <option value="">All Semesters</option>
          {SEMESTERS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* GER Requirements */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          GER Requirement
        </label>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(GER_TAGS).map(([code]) => {
            const active = selectedGers.includes(code);
            return (
              <button
                key={code}
                type="button"
                onClick={() => toggleGer(code)}
                className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                  active
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"
                }`}
              >
                {code}
              </button>
            );
          })}
        </div>
        {selectedGers.length > 0 && (
          <p className="text-xs text-gray-500 mt-1">
            {selectedGers.map((c) => GER_TAGS[c] ?? c).join(", ")}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Sort by
        </label>
        <select
          value={filters.sort || "code"}
          onChange={(e) => onChange("sort", e.target.value)}
          className="w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt.charAt(0).toUpperCase() + opt.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Min Rating
        </label>
        <input
          type="range"
          min="1"
          max="5"
          step="0.5"
          value={filters.minRating || "1"}
          onChange={(e) => onChange("minRating", e.target.value)}
          className="w-full"
        />
        <div className="text-xs text-gray-500 text-center">
          {filters.minRating || "Any"}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Credits
        </label>
        <select
          value={filters.credits || ""}
          onChange={(e) => onChange("credits", e.target.value)}
          className="w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500"
        >
          <option value="">Any</option>
          {[1, 2, 3, 4].map((c) => (
            <option key={c} value={String(c)}>
              {c} credit{c > 1 ? "s" : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Advanced Filters Toggle */}
      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 w-full"
      >
        <svg
          className={`w-4 h-4 transition-transform ${showAdvanced ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        Advanced Filters
      </button>

      {showAdvanced && (
        <div className="space-y-4 pl-2 border-l-2 border-gray-100">
          {/* Instructor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Instructor
            </label>
            <input
              type="text"
              value={filters.instructor || ""}
              onChange={(e) => onChange("instructor", e.target.value)}
              placeholder="Search by name..."
              list="betteratlas-instructor-list"
              className="w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500"
            />
            <datalist id="betteratlas-instructor-list">
              {(instructors ?? []).map((i) => (
                <option key={i.id} value={i.name} />
              ))}
            </datalist>
          </div>

          {/* Campus */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Campus
            </label>
            <select
              value={filters.campus || ""}
              onChange={(e) => onChange("campus", e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500"
            >
              <option value="">All Campuses</option>
              {CAMPUS_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Component Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Component Type
            </label>
            <select
              value={filters.componentType || ""}
              onChange={(e) => onChange("componentType", e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500"
            >
              <option value="">All Types</option>
              {Object.entries(COMPONENT_TYPE_OPTIONS).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Instruction Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Instruction Method
            </label>
            <select
              value={filters.instructionMethod || ""}
              onChange={(e) => onChange("instructionMethod", e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500"
            >
              <option value="">All Methods</option>
              {Object.entries(INSTRUCTION_METHOD_OPTIONS).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {program && (
        <div className="pt-2 border-t border-gray-100 space-y-2">
          <div className="text-sm font-semibold text-gray-900">Requirements</div>
          <div className="text-xs text-gray-500">
            Some requirements (like “approved electives”) can’t be fully interpreted yet.
          </div>
          <div className="space-y-2">
            {program.requirements.map((n) => {
              const key = `${n.ord}-${n.id}`;
              if (n.nodeType === "heading") {
                return (
                  <div key={key} className="text-sm font-semibold text-gray-900">
                    {n.text}
                  </div>
                );
              }
              if (n.nodeType === "list_item") {
                return (
                  <div key={key} className="text-sm text-gray-700 flex gap-2">
                    <span className="text-gray-400">•</span>
                    <span>{renderTextWithCourseLinks(n.text, (code) => onSetQuery(code))}</span>
                  </div>
                );
              }
              return (
                <div key={key} className="text-sm text-gray-700">
                  {renderTextWithCourseLinks(n.text, (code) => onSetQuery(code))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <button
        onClick={() => {
          onChange("programId", "");
          onChange("programTab", "");
          onChange("semester", "");
          onChange("sort", "code");
          onChange("minRating", "");
          onChange("credits", "");
          onChange("attributes", "");
          onChange("instructor", "");
          onChange("campus", "");
          onChange("componentType", "");
          onChange("instructionMethod", "");
          onSetQuery("");
        }}
        className="w-full text-sm text-primary-600 hover:text-primary-800"
      >
        Reset Filters
      </button>
    </div>
  );
}
