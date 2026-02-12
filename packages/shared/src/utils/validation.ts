import { z } from "zod";

// Auth
export const registerSchema = z.object({
  email: z
    .string()
    .email()
    .refine((e) => e.endsWith(".edu"), "Must be a .edu email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  displayName: z.string().min(1).max(100),
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
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["rating", "code", "title", "difficulty"]).default("code"),
});

export const searchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Reviews
export const createReviewSchema = z.object({
  semester: z.string().min(1),
  ratingQuality: z.number().int().min(1).max(5),
  ratingDifficulty: z.number().int().min(1).max(5),
  ratingWorkload: z.number().int().min(1).max(5),
  comment: z.string().max(5000).optional(),
  isAnonymous: z.boolean().default(true),
});

export const updateReviewSchema = createReviewSchema.partial();

// Social
export const friendRequestSchema = z.object({
  addresseeId: z.string().uuid(), // UUID from Supabase Auth
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
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;
export type FriendRequestInput = z.infer<typeof friendRequestSchema>;
export type CreateListInput = z.infer<typeof createListSchema>;
export type AddListItemInput = z.infer<typeof addListItemSchema>;
