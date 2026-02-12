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
  code: varchar("code", { length: 10 }).unique().notNull(),
  name: text("name").notNull(),
});

// Instructors
export const instructors = pgTable("instructors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
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
    semester: varchar("semester", { length: 20 }).notNull(),
    sectionNumber: varchar("section_number", { length: 10 }),
    instructorId: integer("instructor_id").references(() => instructors.id),
    schedule: jsonb("schedule"),
    enrollmentCap: integer("enrollment_cap"),
    enrollmentCur: integer("enrollment_cur").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    courseIdx: index("idx_sections_course").on(table.courseId),
    semesterIdx: index("idx_sections_semester").on(table.semester),
  })
);

// Users (linked to Supabase Auth)
export const users = pgTable("users", {
  id: uuid("id").primaryKey(), // Matches Supabase Auth UUID
  email: text("email").unique().notNull(),
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
    semester: varchar("semester", { length: 20 }),
    ratingQuality: smallint("rating_quality").notNull(),
    ratingDifficulty: smallint("rating_difficulty").notNull(),
    ratingWorkload: smallint("rating_workload").notNull(),
    comment: text("comment"),
    isAnonymous: boolean("is_anonymous").default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userCourseUnique: uniqueIndex("reviews_user_course_unique").on(table.userId, table.courseId),
    courseIdx: index("idx_reviews_course").on(table.courseId),
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
  semester: varchar("semester", { length: 20 }).notNull(),
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
