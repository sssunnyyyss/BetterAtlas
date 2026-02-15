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
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

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
