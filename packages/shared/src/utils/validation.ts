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
  ratingWorkload: z.number().int().min(1).max(5),
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
export type FriendRequestInput = z.infer<typeof friendRequestSchema>;
export type CreateListInput = z.infer<typeof createListSchema>;
export type AddListItemInput = z.infer<typeof addListItemSchema>;
