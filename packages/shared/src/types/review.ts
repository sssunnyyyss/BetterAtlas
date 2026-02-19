import type { Badge } from "./user.js";

export interface Review {
  id: number;
  userId: string;
  courseId: number;
  semester: string | null;
  sectionId: number | null;
  instructorId: number | null;
  instructor: { id: number; name: string } | null;
  ratingQuality: number;
  ratingDifficulty: number;
  ratingWorkload: number | null;
  comment: string | null;
  isAnonymous: boolean;
  source: "native" | "rmp";
  createdAt: string;
  updatedAt: string;
}

export interface ReviewWithAuthor extends Review {
  author: {
    username: string;
    badges: Badge[];
  } | null;
}

export interface UserReview extends ReviewWithAuthor {
  course: { id: number; code: string; title: string };
  section: { id: number; sectionNumber: string | null; semester: string | null } | null;
}

export interface CourseRatings {
  courseId: number;
  avgQuality: number | null;
  avgDifficulty: number | null;
  avgWorkload: number | null;
  reviewCount: number;
}
