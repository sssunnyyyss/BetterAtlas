import { z } from "zod";

// Auth
export const registerSchema = z.object({
  email: z
    .string()
    .email()
    .refine((e) => e.endsWith(".edu"), "Must be a .edu email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  fullName: z.string().min(1).max(100),
  username: z
    .string()
    .min(1)
    .max(30)
    .transform((u) => u.trim().replace(/^@/, "").toLowerCase())
    .refine(
      (u) => /^[a-z0-9_]+$/.test(u),
      "Username can only contain letters, numbers, and underscores"
    ),
  inviteCode: z
    .string()
    .optional()
    .transform((code) => {
      if (typeof code !== "string") return undefined;
      const normalized = code.trim().toUpperCase();
      return normalized.length > 0 ? normalized : undefined;
    })
    .refine(
      (code) => code === undefined || /^[A-Z0-9-]+$/.test(code),
      "Invite code can only contain letters, numbers, and hyphens"
    ),
  graduationYear: z.number().int().min(2000).max(2040).optional(),
  major: z.string().max(100).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Courses
export const courseQuerySchema = z.object({
  department: z.string().optional(),
  semester: z.string().optional(),
  minRating: z.coerce.number().min(1).max(5).optional(),
  credits: z.coerce.number().int().positive().optional(),
  attributes: z.string().optional(),
  instructor: z.string().optional(),
  campus: z.string().optional(),
  componentType: z.string().optional(),
  instructionMethod: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["rating", "code", "title", "difficulty"]).default("code"),
});

export const searchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  department: z.string().optional(),
  semester: z.string().optional(),
  minRating: z.coerce.number().min(1).max(5).optional(),
  credits: z.coerce.number().int().positive().optional(),
  attributes: z.string().optional(),
  instructor: z.string().optional(),
  campus: z.string().optional(),
  componentType: z.string().optional(),
  instructionMethod: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const instructorQuerySchema = z.object({
  q: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(500),
});

// Programs (majors/minors)
export const programsQuerySchema = z.object({
  q: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const programCoursesQuerySchema = courseQuerySchema
  .omit({ department: true, semester: true })
  .extend({
    tab: z.enum(["required", "electives"]).default("required"),
    q: z.string().max(200).optional(),
  });

// Reviews
export const createReviewSchema = z.object({
  semester: z.string().min(1),
  sectionId: z.number().int().positive(),
  ratingQuality: z.number().int().min(1).max(5),
  ratingDifficulty: z.number().int().min(1).max(5),
  ratingWorkload: z.number().int().min(1).max(5).nullable().default(null),
  comment: z.string().max(5000).optional(),
  isAnonymous: z.boolean().default(true),
});

export const updateReviewSchema = createReviewSchema.partial();

// Feedback
export const createFeedbackSchema = z.object({
  category: z.enum([
    "general",
    "feature_request",
    "bug_report",
    "inaccurate_course_detail",
  ]),
  message: z
    .string()
    .trim()
    .min(10, "Please include at least a short description")
    .max(4000),
  courseId: z.number().int().positive().optional(),
  sectionId: z.number().int().positive().optional(),
  pagePath: z.string().trim().max(500).optional(),
});

// Feedback Hub
export const feedbackHubPostStatusSchema = z.enum([
  "open",
  "under_review",
  "planned",
  "in_progress",
  "complete",
]);

export const feedbackHubSortSchema = z.enum(["trending", "top", "new"]);

export const feedbackHubBoardPostsQuerySchema = z.object({
  status: feedbackHubPostStatusSchema.optional(),
  category: z.string().trim().min(1).max(80).optional(),
  q: z.string().trim().min(1).max(200).optional(),
  sort: feedbackHubSortSchema.default("trending"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const feedbackHubRoadmapQuerySchema = z.object({
  limitPerStatus: z.coerce.number().int().min(1).max(100).default(30),
});

export const feedbackHubSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const feedbackHubChangelogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const feedbackHubCreatePostSchema = z.object({
  boardSlug: z.string().trim().min(1).max(80),
  categorySlug: z.string().trim().min(1).max(80).optional(),
  title: z.string().trim().min(5).max(160),
  details: z.string().trim().min(1).max(4000).optional(),
  authorMode: z.enum(["pseudonymous", "linked_profile"]).default("pseudonymous"),
});

export const feedbackHubCreateCommentSchema = z.object({
  body: z.string().trim().min(1).max(3000),
});

export const feedbackHubSimilarPostsQuerySchema = z.object({
  boardSlug: z.string().trim().min(1).max(80),
  q: z.string().trim().min(3).max(160),
  limit: z.coerce.number().int().min(1).max(10).default(5),
});

export const feedbackHubAdminPostsQuerySchema = z.object({
  boardSlug: z.string().trim().min(1).max(80).optional(),
  status: feedbackHubPostStatusSchema.optional(),
  q: z.string().trim().min(1).max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const feedbackHubUpdatePostSchema = z.object({
  title: z.string().trim().min(5).max(160).optional(),
  details: z.string().trim().min(1).max(4000).optional(),
  categorySlug: z.string().trim().min(1).max(80).nullable().optional(),
});

export const feedbackHubUpdateStatusSchema = z.object({
  status: feedbackHubPostStatusSchema,
  note: z.string().trim().max(500).optional(),
});

export const feedbackHubCreateChangelogSchema = z.object({
  title: z.string().trim().min(5).max(200),
  body: z.string().trim().min(10).max(12000),
  postIds: z.array(z.number().int().positive()).max(50).default([]),
});

// Social
export const friendRequestSchema = z.object({
  username: z
    .string()
    .min(1)
    .max(30)
    .transform((u) => u.trim().replace(/^@/, "").toLowerCase())
    .refine(
      (u) => /^[a-z0-9_]+$/.test(u),
      "Username can only contain letters, numbers, and underscores"
    ),
});

export const createListSchema = z.object({
  semester: z.string().min(1),
  name: z.string().min(1).max(100).default("My Courses"),
  isPublic: z.boolean().default(false),
});

export const addListItemSchema = z.object({
  sectionId: z.number().int().positive(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});

// Pagination response
export const paginationMeta = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CourseQuery = z.infer<typeof courseQuerySchema>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type InstructorQuery = z.infer<typeof instructorQuerySchema>;
export type ProgramsQuery = z.infer<typeof programsQuerySchema>;
export type ProgramCoursesQuery = z.infer<typeof programCoursesQuerySchema>;
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;
export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>;
export type FeedbackHubPostStatusInput = z.infer<typeof feedbackHubPostStatusSchema>;
export type FeedbackHubSortInput = z.infer<typeof feedbackHubSortSchema>;
export type FeedbackHubBoardPostsQuery = z.infer<typeof feedbackHubBoardPostsQuerySchema>;
export type FeedbackHubRoadmapQuery = z.infer<typeof feedbackHubRoadmapQuerySchema>;
export type FeedbackHubSearchQuery = z.infer<typeof feedbackHubSearchQuerySchema>;
export type FeedbackHubChangelogQuery = z.infer<typeof feedbackHubChangelogQuerySchema>;
export type FeedbackHubCreatePostInput = z.infer<typeof feedbackHubCreatePostSchema>;
export type FeedbackHubCreateCommentInput = z.infer<typeof feedbackHubCreateCommentSchema>;
export type FeedbackHubSimilarPostsQuery = z.infer<typeof feedbackHubSimilarPostsQuerySchema>;
export type FeedbackHubAdminPostsQuery = z.infer<typeof feedbackHubAdminPostsQuerySchema>;
export type FeedbackHubUpdatePostInput = z.infer<typeof feedbackHubUpdatePostSchema>;
export type FeedbackHubUpdateStatusInput = z.infer<typeof feedbackHubUpdateStatusSchema>;
export type FeedbackHubCreateChangelogInput = z.infer<typeof feedbackHubCreateChangelogSchema>;
export type FriendRequestInput = z.infer<typeof friendRequestSchema>;
export type CreateListInput = z.infer<typeof createListSchema>;
export type AddListItemInput = z.infer<typeof addListItemSchema>;
