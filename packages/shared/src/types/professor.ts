import type { CourseWithRatings, Instructor } from "./course.js";

export interface ProfessorRmpTag {
  tag: string;
  count: number;
}

export interface ProfessorRmpSummary {
  avgRating: number | null;
  avgDifficulty: number | null;
  numRatings: number;
  wouldTakeAgain: number | null;
  tags: ProfessorRmpTag[];
}

export interface ProfessorDetail {
  professor: Instructor;
  // "Professor" score: average of quality across all reviews for this instructor.
  avgQuality: number | null;
  reviewCount: number;
  rmp: ProfessorRmpSummary | null;
  courses: CourseWithRatings[];
}

