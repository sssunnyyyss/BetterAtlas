import { useDepartments } from "../../hooks/useCourses.js";
import { SEMESTERS, SORT_OPTIONS } from "@betteratlas/shared";

interface CourseFiltersProps {
  filters: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

export default function CourseFilters({ filters, onChange }: CourseFiltersProps) {
  const { data: departments } = useDepartments();

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-900">Filters</h3>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Department
        </label>
        <select
          value={filters.department || ""}
          onChange={(e) => onChange("department", e.target.value)}
          className="w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500"
        >
          <option value="">All Departments</option>
          {departments?.map((d) => (
            <option key={d.code} value={d.code}>
              {d.code} - {d.name}
            </option>
          ))}
        </select>
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

      <button
        onClick={() => {
          onChange("department", "");
          onChange("semester", "");
          onChange("sort", "code");
          onChange("minRating", "");
          onChange("credits", "");
        }}
        className="w-full text-sm text-primary-600 hover:text-primary-800"
      >
        Reset Filters
      </button>
    </div>
  );
}
