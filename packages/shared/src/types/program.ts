import type { CourseWithRatings } from "./course.js";

export type ProgramKind = "major" | "minor";
export type ProgramTab = "required" | "electives";

export interface ProgramSummary {
  id: number;
  name: string;
  kind: ProgramKind;
  degree: string | null;
}

export interface ProgramRequirementNode {
  id: number;
  ord: number;
  nodeType: "heading" | "paragraph" | "list_item";
  text: string;
  listLevel: number | null;
}

export interface ProgramDetail extends ProgramSummary {
  sourceUrl: string;
  hoursToComplete: string | null;
  coursesRequired: string | null;
  departmentContact: string | null;
  lastSyncedAt: string;

  requirements: ProgramRequirementNode[];
  requiredCourseCodes: string[];

  subjectCodes: string[];
  electiveLevelFloor: number | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export type ProgramCoursesResponse = PaginatedResponse<CourseWithRatings>;

