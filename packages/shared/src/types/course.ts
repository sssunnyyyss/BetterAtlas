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
  credits: number | null;
  departmentId: number | null;
}

export interface CourseWithRatings extends Course {
  department: Department | null;
  avgQuality: number | null;
  avgDifficulty: number | null;
  avgWorkload: number | null;
  reviewCount: number;
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
  enrollmentCap: number | null;
  enrollmentCur: number;
  createdAt: string;
}

export interface CourseDetail extends CourseWithRatings {
  sections: Section[];
}
