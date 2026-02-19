import {
  pgTable,
  serial,
  text,
  varchar,
  smallint,
  integer,
  boolean,
  timestamp,
  numeric,
  jsonb,
  uniqueIndex,
  index,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Departments
export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 20 }).unique().notNull(),
  name: text("name").notNull(),
});

// Terms (Atlas srcdb codes)
export const terms = pgTable("terms", {
  srcdb: varchar("srcdb", { length: 10 }).primaryKey(),
  name: varchar("name", { length: 30 }).notNull(),
  season: varchar("season", { length: 10 }).notNull(),
  year: smallint("year").notNull(),
  isActive: boolean("is_active").default(true),
});

// Instructors
export const instructors = pgTable("instructors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  atlasId: varchar("atlas_id", { length: 20 }),
  departmentId: integer("department_id").references(() => departments.id),
});

// Courses
export const courses = pgTable(
  "courses",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 20 }).unique().notNull(),
    title: text("title").notNull(),
    description: text("description"),
    prerequisites: text("prerequisites"),
    attributes: text("attributes"),
    gradeMode: varchar("grade_mode", { length: 50 }),
    credits: smallint("credits"),
    departmentId: integer("department_id").references(() => departments.id),
  },
  (table) => ({
    deptIdx: index("idx_courses_dept").on(table.departmentId),
  })
);

// Sections
export const sections = pgTable(
  "sections",
  {
    id: serial("id").primaryKey(),
    courseId: integer("course_id")
      .references(() => courses.id)
      .notNull(),
    crn: varchar("crn", { length: 10 }),
    termCode: varchar("term_code", { length: 10 })
      .references(() => terms.srcdb)
      .notNull(),
    sectionNumber: varchar("section_number", { length: 10 }),
    instructorId: integer("instructor_id").references(() => instructors.id),
    meetings: jsonb("meetings"),
    meetsDisplay: varchar("meets_display", { length: 100 }),
    waitlistCount: integer("waitlist_count").default(0),
    waitlistCap: integer("waitlist_cap"),
    seatsAvail: integer("seats_avail"),
    enrollmentStatus: varchar("enrollment_status", { length: 5 }),
    componentType: varchar("component_type", { length: 5 }),
    instructionMethod: varchar("instruction_method", { length: 5 }),
    campus: varchar("campus", { length: 20 }),
    session: varchar("session", { length: 10 }),
    startDate: varchar("start_date", { length: 10 }),
    endDate: varchar("end_date", { length: 10 }),
    gerDesignation: text("ger_designation"),
    gerCodes: text("ger_codes"),
    registrationRestrictions: text("registration_restrictions"),
    atlasKey: varchar("atlas_key", { length: 20 }),
    lastSynced: timestamp("last_synced", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    enrollmentCap: integer("enrollment_cap"),
    enrollmentCur: integer("enrollment_cur").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    courseIdx: index("idx_sections_course").on(table.courseId),
    termIdx: index("idx_sections_term").on(table.termCode),
    statusIdx: index("idx_sections_status").on(table.enrollmentStatus),
    crnTermUnique: uniqueIndex("idx_sections_crn_term").on(table.crn, table.termCode),
    lastSeenIdx: index("idx_sections_last_seen_at").on(table.lastSeenAt),
  })
);

// Users (linked to Supabase Auth)
export const users = pgTable("users", {
  id: uuid("id").primaryKey(), // Matches Supabase Auth UUID
  email: text("email").unique().notNull(),
  username: varchar("username", { length: 30 }).unique().notNull(),
  displayName: text("display_name").notNull(),
  graduationYear: smallint("graduation_year"),
  major: text("major"),
  bio: text("bio"),
  interests: text("interests").array().default(sql`'{}'`),
  avatarUrl: text("avatar_url"),
  inviteCode: varchar("invite_code", { length: 64 }),
  hasCompletedOnboarding: boolean("has_completed_onboarding")
    .notNull()
    .default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Badges
export const badges = pgTable(
  "badges",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 50 }).notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    icon: text("icon").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    slugUnique: uniqueIndex("idx_badges_slug_unique").on(table.slug),
  })
);

// User Badges
export const userBadges = pgTable(
  "user_badges",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    badgeId: integer("badge_id")
      .references(() => badges.id, { onDelete: "cascade" })
      .notNull(),
    awardedAt: timestamp("awarded_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userBadgeUnique: uniqueIndex("idx_user_badges_user_badge_unique").on(
      table.userId,
      table.badgeId
    ),
    userIdx: index("idx_user_badges_user").on(table.userId),
    badgeIdx: index("idx_user_badges_badge").on(table.badgeId),
  })
);

// Invite Codes
export const inviteCodes = pgTable(
  "invite_codes",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 64 }).notNull(),
    badgeSlug: varchar("badge_slug", { length: 50 })
      .references(() => badges.slug)
      .notNull(),
    maxUses: integer("max_uses"),
    usedCount: integer("used_count").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    codeUnique: uniqueIndex("idx_invite_codes_code_unique").on(table.code),
    badgeSlugIdx: index("idx_invite_codes_badge_slug").on(table.badgeSlug),
  })
);

// Reviews
export const reviews = pgTable(
  "reviews",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    courseId: integer("course_id")
      .references(() => courses.id)
      .notNull(),
    instructorId: integer("instructor_id").references(() => instructors.id),
    sectionId: integer("section_id").references(() => sections.id),
    termCode: varchar("term_code", { length: 10 }).references(() => terms.srcdb),
    ratingQuality: smallint("rating_quality").notNull(),
    ratingDifficulty: smallint("rating_difficulty").notNull(),
    ratingWorkload: smallint("rating_workload").notNull(),
    comment: text("comment"),
    isAnonymous: boolean("is_anonymous").default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    // One review per user per section.
    userSectionUnique: uniqueIndex("reviews_user_section_unique").on(
      table.userId,
      table.sectionId
    ),
    courseIdx: index("idx_reviews_course").on(table.courseId),
    instructorIdx: index("idx_reviews_instructor").on(table.instructorId),
    sectionIdx: index("idx_reviews_section").on(table.sectionId),
  })
);

// Feedback reports from users (general app feedback + data issue reports)
export const feedbackReports = pgTable(
  "feedback_reports",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    category: varchar("category", { length: 40 }).notNull(),
    message: text("message").notNull(),
    courseId: integer("course_id").references(() => courses.id),
    sectionId: integer("section_id").references(() => sections.id),
    pagePath: text("page_path"),
    status: varchar("status", { length: 20 }).notNull().default("new"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userIdx: index("idx_feedback_reports_user").on(table.userId),
    categoryIdx: index("idx_feedback_reports_category").on(table.category),
    statusIdx: index("idx_feedback_reports_status").on(table.status),
    createdAtIdx: index("idx_feedback_reports_created_at").on(table.createdAt),
  })
);

// Course Ratings (aggregate cache)
export const courseRatings = pgTable("course_ratings", {
  courseId: integer("course_id")
    .primaryKey()
    .references(() => courses.id),
  avgQuality: numeric("avg_quality", { precision: 3, scale: 2 }),
  avgDifficulty: numeric("avg_difficulty", { precision: 3, scale: 2 }),
  avgWorkload: numeric("avg_workload", { precision: 3, scale: 2 }),
  reviewCount: integer("review_count").default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Course + Instructor Ratings (aggregate cache)
export const courseInstructorRatings = pgTable(
  "course_instructor_ratings",
  {
    courseId: integer("course_id")
      .notNull()
      .references(() => courses.id),
    instructorId: integer("instructor_id")
      .notNull()
      .references(() => instructors.id),
    avgQuality: numeric("avg_quality", { precision: 3, scale: 2 }),
    avgDifficulty: numeric("avg_difficulty", { precision: 3, scale: 2 }),
    avgWorkload: numeric("avg_workload", { precision: 3, scale: 2 }),
    reviewCount: integer("review_count").default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    pk: uniqueIndex("course_instructor_ratings_pk").on(table.courseId, table.instructorId),
    courseIdx: index("idx_cir_course").on(table.courseId),
    instructorIdx: index("idx_cir_instructor").on(table.instructorId),
  })
);

// Section Ratings (aggregate cache)
export const sectionRatings = pgTable("section_ratings", {
  sectionId: integer("section_id")
    .primaryKey()
    .references(() => sections.id),
  avgQuality: numeric("avg_quality", { precision: 3, scale: 2 }),
  avgDifficulty: numeric("avg_difficulty", { precision: 3, scale: 2 }),
  avgWorkload: numeric("avg_workload", { precision: 3, scale: 2 }),
  reviewCount: integer("review_count").default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Instructor Ratings (aggregate cache across all courses)
export const instructorRatings = pgTable("instructor_ratings", {
  instructorId: integer("instructor_id")
    .primaryKey()
    .references(() => instructors.id),
  avgQuality: numeric("avg_quality", { precision: 3, scale: 2 }),
  reviewCount: integer("review_count").default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Friendships
export const friendships = pgTable(
  "friendships",
  {
    id: serial("id").primaryKey(),
    requesterId: uuid("requester_id")
      .references(() => users.id)
      .notNull(),
    addresseeId: uuid("addressee_id")
      .references(() => users.id)
      .notNull(),
    status: varchar("status", { length: 10 }).default("pending").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    pairUnique: uniqueIndex("friendships_pair_unique").on(
      table.requesterId,
      table.addresseeId
    ),
    usersIdx: index("idx_friendships_users").on(table.requesterId, table.addresseeId),
  })
);

// Course Lists
export const courseLists = pgTable("course_lists", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  termCode: varchar("term_code", { length: 10 })
    .references(() => terms.srcdb)
    .notNull(),
  name: text("name").default("My Courses"),
  isPublic: boolean("is_public").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Course List Items
export const courseListItems = pgTable("course_list_items", {
  id: serial("id").primaryKey(),
  listId: integer("list_id")
    .references(() => courseLists.id, { onDelete: "cascade" })
    .notNull(),
  sectionId: integer("section_id")
    .references(() => sections.id)
    .notNull(),
  color: varchar("color", { length: 7 }),
  addedAt: timestamp("added_at", { withTimezone: true }).defaultNow(),
});

// Programs (Emory majors/minors)
export const programs = pgTable(
  "programs",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    kind: varchar("kind", { length: 10 }).notNull(), // "major" | "minor"
    degree: varchar("degree", { length: 10 }),
    sourceUrl: text("source_url").notNull(),
    hoursToComplete: text("hours_to_complete"),
    coursesRequired: text("courses_required"),
    departmentContact: text("department_contact"),
    requirementsHash: varchar("requirements_hash", { length: 64 }).notNull(),
    requirementsSummary: text("requirements_summary"),
    requirementsSummaryHighlights: text("requirements_summary_highlights"),
    requirementsSummaryHash: varchar("requirements_summary_hash", { length: 64 }),
    requirementsSummaryModel: varchar("requirements_summary_model", { length: 50 }),
    requirementsSummaryUpdatedAt: timestamp("requirements_summary_updated_at", { withTimezone: true }),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    isActive: boolean("is_active").notNull().default(true),
  },
  (table) => ({
    sourceUrlUnique: uniqueIndex("programs_source_url_unique").on(table.sourceUrl),
    nameIdx: index("idx_programs_name").on(table.name),
  })
);

export const programRequirementNodes = pgTable(
  "program_requirement_nodes",
  {
    id: serial("id").primaryKey(),
    programId: integer("program_id")
      .references(() => programs.id, { onDelete: "cascade" })
      .notNull(),
    ord: integer("ord").notNull(),
    nodeType: varchar("node_type", { length: 20 }).notNull(), // heading|paragraph|list_item
    text: text("text").notNull(),
    listLevel: smallint("list_level"),
  },
  (table) => ({
    programOrdUnique: uniqueIndex("program_requirement_nodes_program_ord_unique").on(
      table.programId,
      table.ord
    ),
    programIdx: index("idx_program_requirement_nodes_program").on(table.programId),
  })
);

export const programCourseCodes = pgTable(
  "program_course_codes",
  {
    programId: integer("program_id")
      .references(() => programs.id, { onDelete: "cascade" })
      .notNull(),
    courseCode: varchar("course_code", { length: 30 }).notNull(),
  },
  (table) => ({
    programCourseUnique: uniqueIndex("program_course_codes_program_code_unique").on(
      table.programId,
      table.courseCode
    ),
    programIdx: index("idx_program_course_codes_program").on(table.programId),
  })
);

export const programSubjectCodes = pgTable(
  "program_subject_codes",
  {
    programId: integer("program_id")
      .references(() => programs.id, { onDelete: "cascade" })
      .notNull(),
    subjectCode: varchar("subject_code", { length: 20 }).notNull(),
  },
  (table) => ({
    programSubjectUnique: uniqueIndex("program_subject_codes_program_subject_unique").on(
      table.programId,
      table.subjectCode
    ),
    programIdx: index("idx_program_subject_codes_program").on(table.programId),
  })
);

export const programElectiveRules = pgTable("program_elective_rules", {
  programId: integer("program_id")
    .primaryKey()
    .references(() => programs.id, { onDelete: "cascade" }),
  levelFloor: smallint("level_floor"), // 300 means 300+
});

// AI Trainer Ratings (individual admin votes on courses)
export const aiTrainerRatings = pgTable(
  "ai_trainer_ratings",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    courseId: integer("course_id")
      .references(() => courses.id)
      .notNull(),
    rating: smallint("rating").notNull(), // +1 liked, -1 disliked
    context: jsonb("context"), // course snapshot at rating time for audit
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userCourseUnique: uniqueIndex("ai_trainer_ratings_user_course_unique").on(
      table.userId,
      table.courseId
    ),
    courseIdx: index("idx_ai_trainer_ratings_course").on(table.courseId),
    userIdx: index("idx_ai_trainer_ratings_user").on(table.userId),
  })
);

// AI Trainer Scores (aggregate cache per course)
export const aiTrainerScores = pgTable("ai_trainer_scores", {
  courseId: integer("course_id")
    .primaryKey()
    .references(() => courses.id),
  upCount: integer("up_count").default(0),
  downCount: integer("down_count").default(0),
  totalCount: integer("total_count").default(0),
  score: numeric("score", { precision: 5, scale: 4 }), // smoothed: (up - down) / (total + 5)
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// OAuth Clients — registered third-party apps (admin-managed)
export const oauthClients = pgTable("oauth_clients", {
  id: varchar("id", { length: 36 }).primaryKey(), // UUID, used as public client_id
  secret: varchar("secret", { length: 64 }), // SHA-256 hash; NULL for public PKCE clients
  name: text("name").notNull(),
  description: text("description"),
  redirectUris: text("redirect_uris").array().notNull(),
  allowedScopes: text("allowed_scopes").array().notNull(),
  isPublic: boolean("is_public").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
});

// OAuth Authorization Codes — short-lived (10 min), single-use
export const oauthAuthorizationCodes = pgTable("oauth_authorization_codes", {
  code: varchar("code", { length: 64 }).primaryKey(), // 32 random bytes hex
  clientId: varchar("client_id", { length: 36 })
    .references(() => oauthClients.id)
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  redirectUri: text("redirect_uri").notNull(),
  scopes: text("scopes").array().notNull(),
  codeChallenge: varchar("code_challenge", { length: 128 }),
  codeChallengeMethod: varchar("code_challenge_method", { length: 10 }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }), // replay protection
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// OAuth Access Tokens — opaque tokens (1 hour), soft-revocable
export const oauthAccessTokens = pgTable("oauth_access_tokens", {
  token: varchar("token", { length: 64 }).primaryKey(), // 32 random bytes hex
  clientId: varchar("client_id", { length: 36 })
    .references(() => oauthClients.id)
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  scopes: text("scopes").array().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }), // soft revocation
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
