export type FeedbackCategory =
  | "general"
  | "feature_request"
  | "bug_report"
  | "inaccurate_course_detail";

export interface FeedbackSubmission {
  id: number;
  userId: string;
  category: FeedbackCategory;
  message: string;
  courseId: number | null;
  sectionId: number | null;
  pagePath: string | null;
  status: string;
  createdAt: string;
}
