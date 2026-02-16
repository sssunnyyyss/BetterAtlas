import { db } from "../db/index.js";
import { feedbackReports, sections } from "../db/schema.js";
import { eq } from "drizzle-orm";
import type { CreateFeedbackInput } from "@betteratlas/shared";

export async function createFeedbackReport(userId: string, input: CreateFeedbackInput) {
  let courseId = input.courseId ?? null;
  const sectionId = input.sectionId ?? null;
  const message = input.message.trim();
  const pagePath = input.pagePath?.trim() || null;

  if (sectionId !== null) {
    const [section] = await db
      .select({ id: sections.id, courseId: sections.courseId })
      .from(sections)
      .where(eq(sections.id, sectionId))
      .limit(1);

    if (!section) {
      throw new Error("Selected section does not exist");
    }

    if (courseId !== null && courseId !== section.courseId) {
      throw new Error("Selected section does not belong to the selected course");
    }

    courseId = section.courseId;
  }

  const [created] = await db
    .insert(feedbackReports)
    .values({
      userId,
      category: input.category,
      message,
      courseId,
      sectionId,
      pagePath,
      status: "new",
    })
    .returning({
      id: feedbackReports.id,
      userId: feedbackReports.userId,
      category: feedbackReports.category,
      message: feedbackReports.message,
      courseId: feedbackReports.courseId,
      sectionId: feedbackReports.sectionId,
      pagePath: feedbackReports.pagePath,
      status: feedbackReports.status,
      createdAt: feedbackReports.createdAt,
    });

  return {
    id: created.id,
    userId: created.userId,
    category: created.category,
    message: created.message,
    courseId: created.courseId,
    sectionId: created.sectionId,
    pagePath: created.pagePath,
    status: created.status,
    createdAt: created.createdAt?.toISOString() ?? "",
  };
}
