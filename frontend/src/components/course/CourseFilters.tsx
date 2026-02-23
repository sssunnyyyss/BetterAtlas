import { useEffect, useMemo, useRef, useState } from "react";
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
  return p.name;
}

export default function CourseFilters({
  filters,
  onChange,
  onSetQuery,
}: CourseFiltersProps) {
  const programId = filters.programId ? parseInt(filters.programId, 10) : 0;
  const { data: program } = useProgram(programId);
  const programBoxRef = useRef<HTMLDivElement | null>(null);
  const instructorBoxRef = useRef<HTMLDivElement | null>(null);

  const [programInput, setProgramInput] = useState("");
  const [programOpen, setProgramOpen] = useState(false);
  const programQuery = programInput.trim();
  const { data: programResults, isLoading: programsLoading } = usePrograms(programQuery);
  const [instructorInput, setInstructorInput] = useState(filters.instructor || "");
  const [instructorOpen, setInstructorOpen] = useState(false);
  const instructorQuery = instructorInput.trim();
  const { data: instructors, isLoading: instructorsLoading } = useInstructors(
    instructorQuery ? { q: instructorQuery, limit: 12 } : { limit: 12 }
  );
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

  useEffect(() => {
    setInstructorInput(filters.instructor || "");
  }, [filters.instructor]);

  const programOptions = useMemo(() => {
    if (!programQuery) return [];

    const majorsOnly = (programResults ?? []).filter(
      (p) => p.kind === "major" && (p.degree || "").toUpperCase() === "BA"
    );

    // Keep one dropdown entry per program name.
    const byName = new Map<string, (typeof majorsOnly)[number]>();
    for (const p of majorsOnly) {
      const key = p.name.trim().toLowerCase();
      if (!byName.has(key)) byName.set(key, p);
    }

    return [...byName.values()];
  }, [programResults, programQuery]);

  const instructorOptions = useMemo(() => {
    if (!instructorQuery) return [];

    const seen = new Set<string>();
    const out: Array<{ id: number; name: string }> = [];
    for (const i of instructors ?? []) {
      const name = String(i.name ?? "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ id: i.id, name });
    }
    return out.slice(0, 10);
  }, [instructors, instructorQuery]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (target && programBoxRef.current && !programBoxRef.current.contains(target)) {
        setProgramOpen(false);
      }
      if (target && instructorBoxRef.current && !instructorBoxRef.current.contains(target)) {
        setInstructorOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-900">Filters</h3>

      {/* Basic Filters */}
      <div className="relative" ref={programBoxRef}>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Program
        </label>
        <div className="flex gap-2">
          <input
            value={programInput}
            onChange={(e) => {
              const next = e.target.value;
              setProgramInput(next);
              if (programId > 0) {
                onChange("programId", "");
                onChange("programTab", "");
              }
              setProgramOpen(Boolean(next.trim()));
            }}
            onFocus={() => setProgramOpen(Boolean(programInput.trim()))}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setProgramOpen(false);
                (e.currentTarget as HTMLInputElement).blur();
              }
            }}
            placeholder="Type to search programs..."
            autoComplete="off"
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

        {programOpen && programQuery && (
          <div className="absolute z-20 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg max-h-64 overflow-auto ba-dropdown-pop">
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
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 first:rounded-t-xl last:rounded-b-xl"
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
          <div className="relative" ref={instructorBoxRef}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Instructor
            </label>
            <input
              type="text"
              value={instructorInput}
              onChange={(e) => {
                const next = e.target.value;
                setInstructorInput(next);
                onChange("instructor", next);
                setInstructorOpen(Boolean(next.trim()));
              }}
              onFocus={() => setInstructorOpen(Boolean(instructorInput.trim()))}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setInstructorOpen(false);
                  (e.currentTarget as HTMLInputElement).blur();
                }
              }}
              placeholder="Type to search instructors..."
              autoComplete="off"
              className="w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500"
            />
            {instructorOpen && instructorQuery && (
              <div className="absolute z-20 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg max-h-64 overflow-auto ba-dropdown-pop">
                {instructorsLoading && (
                  <div className="px-3 py-2 text-sm text-gray-500">Loading...</div>
                )}
                {!instructorsLoading && instructorOptions.length === 0 && (
                  <div className="px-3 py-2 text-sm text-gray-500">No instructors found</div>
                )}
                {!instructorsLoading &&
                  instructorOptions.map((i) => (
                    <button
                      key={i.id}
                      type="button"
                      onClick={() => {
                        setInstructorInput(i.name);
                        onChange("instructor", i.name);
                        setInstructorOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 first:rounded-t-xl last:rounded-b-xl"
                    >
                      {i.name}
                    </button>
                  ))}
              </div>
            )}
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

      <button
        onClick={() => {
          setProgramInput("");
          setProgramOpen(false);
          setInstructorInput("");
          setInstructorOpen(false);
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
