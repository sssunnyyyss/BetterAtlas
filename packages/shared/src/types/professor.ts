import type { CourseWithRatings, Instructor } from "./course.js";

export interface ProfessorDetail {
  professor: Instructor;
  // "Professor" score: average of quality across all reviews for this instructor.
  avgQuality: number | null;
  reviewCount: number;
  courses: CourseWithRatings[];
}

