export interface Department {
  id: number;
  code: string;
  name: string;
}

export interface Instructor {
  id: number;
  name: string;
  email: string | null;
  departmentId: number | null;
}

export interface Course {
  id: number;
  code: string;
  title: string;
  description: string | null;
  prerequisites?: string | null;
  credits: number | null;
  gradeMode?: string | null;
  departmentId: number | null;
  attributes: string | null;
}

export interface CourseWithRatings extends Course {
  department: Department | null;
  avgQuality: number | null;
  avgDifficulty: number | null;
  avgWorkload: number | null;
  reviewCount: number;
  // "Class" score: aggregate of professor scores for instructors teaching this course.
  classScore?: number | null;
  // Average section fill percentage across active sections for this course.
  avgEnrollmentPercent?: number | null;
  // Aggregated from sections/instructors (often filtered by selected semester).
  instructors?: string[];
  // Emory GER requirement codes aggregated from active sections.
  gers?: string[];
  // Distinct campus labels aggregated from active sections (e.g. "Atlanta", "Oxford").
  campuses?: string[];
  // Section-backed requirements/restrictions text (often includes prereqs); may be null/empty.
  requirements?: string | null;
}

export interface Schedule {
  days: string[];
  start: string;
  end: string;
  location: string;
}

export interface Section {
  id: number;
  courseId: number;
  semester: string;
  sectionNumber: string | null;
  instructorId: number | null;
  instructor?: Instructor;
  schedule: Schedule | null;
  campus?: string | null;
  componentType?: string | null;
  instructionMethod?: string | null;
  enrollmentStatus?: string | null;
  enrollmentCap: number | null;
  enrollmentCur: number;
  seatsAvail?: number | null;
  waitlistCount?: number;
  waitlistCap?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  gerDesignation?: string | null;
  gerCodes?: string[];
  registrationRestrictions?: string | null;
  avgQuality?: number | null;
  avgDifficulty?: number | null;
  avgWorkload?: number | null;
  reviewCount?: number;
  instructorAvgQuality?: number | null;
  instructorReviewCount?: number;
  createdAt: string;
}

export interface CrossListedCourse {
  id: number;
  code: string;
  department: Department | null;
}

export interface CourseDetail extends CourseWithRatings {
  sections: Section[];
  professors?: Array<{
    id: number;
    name: string;
    email: string | null;
    departmentId: number | null;
    avgQuality: number | null;
    avgDifficulty: number | null;
    avgWorkload: number | null;
    reviewCount: number;
  }>;
  /** Other course codes that represent the same class (cross-listed). */
  crossListedWith?: CrossListedCourse[];
}
