import { useEffect, useMemo, useRef, useState } from "react";
import { useProgram, usePrograms } from "../../hooks/usePrograms.js";
import { useInstructors } from "../../hooks/useInstructors.js";
import { useTerms } from "../../hooks/useCourses.js";
import AppDropdown from "../ui/AppDropdown.js";
import { buildProgramSearchOptions } from "../../lib/programVariantSelection.js";
import {
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
  const { data: terms } = useTerms();
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
  const semesterOptions = useMemo(() => {
    const names = (terms ?? [])
      .map((term) => String(term.name ?? "").trim())
      .filter(Boolean);
    const uniqueNames = [...new Set(names)];
    const selectedSemester = String(filters.semester ?? "").trim();

    if (selectedSemester && !uniqueNames.includes(selectedSemester)) {
      uniqueNames.unshift(selectedSemester);
    }

    return uniqueNames;
  }, [terms, filters.semester]);
  const semesterDropdownOptions = useMemo(
    () => [{ value: "", label: "All Semesters" }, ...semesterOptions.map((s) => ({ value: s, label: s }))],
    [semesterOptions]
  );
  const sortDropdownOptions = useMemo(
    () =>
      SORT_OPTIONS.map((opt) => ({
        value: opt,
        label: opt.charAt(0).toUpperCase() + opt.slice(1),
      })),
    []
  );
  const creditsDropdownOptions = useMemo(
    () => [
      { value: "", label: "Any" },
      ...[1, 2, 3, 4].map((c) => ({
        value: String(c),
        label: `${c} credit${c > 1 ? "s" : ""}`,
      })),
    ],
    []
  );
  const campusDropdownOptions = useMemo(
    () => [{ value: "", label: "All Campuses" }, ...CAMPUS_OPTIONS.map((c) => ({ value: c, label: c }))],
    []
  );
  const componentTypeDropdownOptions = useMemo(
    () => [
      { value: "", label: "All Types" },
      ...Object.entries(COMPONENT_TYPE_OPTIONS).map(([code, label]) => ({
        value: code,
        label,
      })),
    ],
    []
  );
  const instructionMethodDropdownOptions = useMemo(
    () => [
      { value: "", label: "All Methods" },
      ...Object.entries(INSTRUCTION_METHOD_OPTIONS).map(([code, label]) => ({
        value: code,
        label,
      })),
    ],
    []
  );

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
    return buildProgramSearchOptions(programResults);
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
        <AppDropdown
          value={filters.semester || ""}
          options={semesterDropdownOptions}
          onChange={(value) => onChange("semester", value)}
        />
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
        <AppDropdown
          value={filters.sort || "code"}
          options={sortDropdownOptions}
          onChange={(value) => onChange("sort", value)}
        />
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
        <AppDropdown
          value={filters.credits || ""}
          options={creditsDropdownOptions}
          onChange={(value) => onChange("credits", value)}
        />
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
            <AppDropdown
              value={filters.campus || ""}
              options={campusDropdownOptions}
              onChange={(value) => onChange("campus", value)}
            />
          </div>

          {/* Component Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Component Type
            </label>
            <AppDropdown
              value={filters.componentType || ""}
              options={componentTypeDropdownOptions}
              onChange={(value) => onChange("componentType", value)}
            />
          </div>

          {/* Instruction Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Instruction Method
            </label>
            <AppDropdown
              value={filters.instructionMethod || ""}
              options={instructionMethodDropdownOptions}
              onChange={(value) => onChange("instructionMethod", value)}
            />
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
