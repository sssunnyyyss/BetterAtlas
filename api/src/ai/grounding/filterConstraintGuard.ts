import type { CourseWithRatings } from "@betteratlas/shared";

export type AiCourseFilters = {
  semester?: string;
  department?: string;
  minRating?: number;
  credits?: number;
  attributes?: string;
  instructor?: string;
  campus?: string;
  componentType?: string;
  instructionMethod?: string;
};

function normalizeToken(value: string) {
  return value.trim().toLowerCase();
}

function normalizeCompactToken(value: string) {
  return normalizeToken(value).replace(/\s+/g, " ");
}

function normalizeInstructionMethodFilter(value: string | undefined) {
  if (!value) return undefined;
  if (value === "O") return "DL";
  if (value === "H") return "BL";
  return value;
}

function getStringList(input: unknown): string[] {
  if (typeof input === "string") {
    const trimmed = input.trim();
    return trimmed ? [trimmed] : [];
  }

  if (!Array.isArray(input)) return [];

  const out: string[] = [];
  for (const item of input) {
    if (typeof item === "string") {
      const trimmed = item.trim();
      if (trimmed) out.push(trimmed);
      continue;
    }

    if (!item || typeof item !== "object") continue;

    const maybeName = (item as Record<string, unknown>).name;
    if (typeof maybeName === "string" && maybeName.trim()) {
      out.push(maybeName.trim());
      continue;
    }

    const maybeCode = (item as Record<string, unknown>).code;
    if (typeof maybeCode === "string" && maybeCode.trim()) {
      out.push(maybeCode.trim());
    }
  }

  return out;
}

function getSectionFieldValues(course: CourseWithRatings, field: string): string[] {
  const sections = (course as unknown as Record<string, unknown>).sections;
  if (!Array.isArray(sections)) return [];

  const out: string[] = [];
  for (const section of sections) {
    if (!section || typeof section !== "object") continue;
    const value = (section as Record<string, unknown>)[field];
    out.push(...getStringList(value));
  }

  return out;
}

function getCourseFieldValues(
  course: CourseWithRatings,
  directField: string,
  pluralField: string,
  sectionField: string
): string[] {
  const source = course as unknown as Record<string, unknown>;
  return [
    ...getStringList(source[directField]),
    ...getStringList(source[pluralField]),
    ...getSectionFieldValues(course, sectionField),
  ];
}

function hasAnyAiFilters(filters: AiCourseFilters) {
  return Boolean(
    filters.semester ||
      filters.department ||
      filters.minRating ||
      filters.credits ||
      filters.attributes ||
      filters.instructor ||
      filters.campus ||
      filters.componentType ||
      filters.instructionMethod
  );
}

function courseMatchesSemesterFilter(course: CourseWithRatings, semester: string) {
  const wanted = normalizeCompactToken(semester);
  if (!wanted) return true;

  const values = getCourseFieldValues(course, "semester", "semesters", "semester").map(normalizeCompactToken);
  if (values.length === 0) return false;

  return values.some((value) => value === wanted);
}

function courseMatchesDepartmentFilter(course: CourseWithRatings, department: string) {
  const wanted = department.trim().toUpperCase();
  if (!wanted) return true;
  const deptCode = (course.department?.code ?? "").trim().toUpperCase();
  return Boolean(deptCode) && deptCode === wanted;
}

function courseMatchesMinRatingFilter(course: CourseWithRatings, minRating: number) {
  if (!Number.isFinite(minRating)) return true;

  const classScore = Number(course.classScore);
  if (Number.isFinite(classScore)) {
    return classScore >= minRating;
  }

  const avgQuality = Number(course.avgQuality);
  if (Number.isFinite(avgQuality)) {
    return avgQuality >= minRating;
  }

  return false;
}

function courseMatchesCreditsFilter(course: CourseWithRatings, credits: number) {
  if (!Number.isFinite(credits)) return true;
  return Number(course.credits) === credits;
}

function courseMatchesAttributesFilter(course: CourseWithRatings, attributes: string) {
  const expected = attributes
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

  if (expected.length === 0) return true;

  const gerCodes = new Set((course.gers ?? []).map((value) => value.trim().toUpperCase()).filter(Boolean));
  if (gerCodes.size === 0) return false;

  return expected.every((code) => gerCodes.has(code));
}

function courseMatchesInstructorFilter(course: CourseWithRatings, instructor: string) {
  const wanted = normalizeCompactToken(instructor);
  if (!wanted) return true;

  return (course.instructors ?? [])
    .map((value) => normalizeCompactToken(value))
    .some((value) => value.includes(wanted));
}

function courseMatchesCampusFilter(course: CourseWithRatings, campus: string) {
  const wanted = normalizeToken(campus);
  if (!wanted) return true;

  return (course.campuses ?? [])
    .map((value) => normalizeToken(value))
    .some((value) => value === wanted);
}

function courseMatchesComponentTypeFilter(course: CourseWithRatings, componentType: string) {
  const wanted = componentType.trim().toUpperCase();
  if (!wanted) return true;

  const values = getCourseFieldValues(course, "componentType", "componentTypes", "componentType")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

  if (values.length === 0) return false;

  return values.some((value) => value === wanted);
}

function courseMatchesInstructionMethodFilter(course: CourseWithRatings, instructionMethod: string) {
  const normalizedFilter = normalizeInstructionMethodFilter(instructionMethod.trim().toUpperCase());
  if (!normalizedFilter) return true;

  const values = getCourseFieldValues(course, "instructionMethod", "instructionMethods", "instructionMethod")
    .map((value) => normalizeInstructionMethodFilter(value.trim().toUpperCase()))
    .filter((value): value is string => Boolean(value));

  if (values.length === 0) return false;

  return values.some((value) => value === normalizedFilter);
}

export function courseSatisfiesAiFilters(course: CourseWithRatings, filters: AiCourseFilters): boolean {
  if (!hasAnyAiFilters(filters)) return true;

  if (filters.semester && !courseMatchesSemesterFilter(course, filters.semester)) return false;
  if (filters.department && !courseMatchesDepartmentFilter(course, filters.department)) return false;
  if (typeof filters.minRating === "number" && !courseMatchesMinRatingFilter(course, filters.minRating)) {
    return false;
  }
  if (typeof filters.credits === "number" && !courseMatchesCreditsFilter(course, filters.credits)) return false;
  if (filters.attributes && !courseMatchesAttributesFilter(course, filters.attributes)) return false;
  if (filters.instructor && !courseMatchesInstructorFilter(course, filters.instructor)) return false;
  if (filters.campus && !courseMatchesCampusFilter(course, filters.campus)) return false;
  if (filters.componentType && !courseMatchesComponentTypeFilter(course, filters.componentType)) return false;
  if (
    filters.instructionMethod &&
    !courseMatchesInstructionMethodFilter(course, filters.instructionMethod)
  ) {
    return false;
  }

  return true;
}

export function enforceRecommendationFilterConstraints<T extends { course: CourseWithRatings }>(
  recommendations: T[],
  filters: AiCourseFilters
): { valid: T[]; droppedCount: number } {
  if (!Array.isArray(recommendations) || recommendations.length === 0) {
    return {
      valid: [],
      droppedCount: 0,
    };
  }

  if (!hasAnyAiFilters(filters)) {
    return {
      valid: recommendations,
      droppedCount: 0,
    };
  }

  const valid = recommendations.filter((item) => courseSatisfiesAiFilters(item.course, filters));

  return {
    valid,
    droppedCount: recommendations.length - valid.length,
  };
}
