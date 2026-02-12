export interface Review {
  id: number;
  userId: number;
  courseId: number;
  semester: string | null;
  ratingQuality: number;
  ratingDifficulty: number;
  ratingWorkload: number;
  comment: string | null;
  isAnonymous: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewWithAuthor extends Review {
  author: {
    displayName: string;
  } | null;
}

export interface CourseRatings {
  courseId: number;
  avgQuality: number | null;
  avgDifficulty: number | null;
  avgWorkload: number | null;
  reviewCount: number;
}
