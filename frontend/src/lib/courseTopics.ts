import type { CourseWithRatings } from "@betteratlas/shared";

const TOPIC_COURSE_PATTERN = /\btopics?\b/i;
const GENERIC_TOPIC_PATTERNS: RegExp[] = [
  /seminars arranged around current issues and controversies in american culture/i,
  /may be repeated as topic changes/i,
];

export type CatalogCourseEntry = CourseWithRatings & {
  topic?: string | null;
  sectionId?: number;
  sectionNumber?: string | null;
  virtualKey?: string;
};

export type CourseTopicDetail = {
  sections: Array<{
    id: number;
    semester: string;
    sectionNumber?: string | null;
    componentType?: string | null;
    sectionDescription?: string | null;
    classNotes?: string | null;
    enrollmentCap?: number | null;
    enrollmentCur?: number | null;
    campus?: string | null;
    gerCodes?: string[] | null;
    registrationRestrictions?: string | null;
    instructor?: {
      name?: string | null;
    } | null;
  }>;
};

export function normalizeTopic(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const topic = value.replace(/\s+/g, " ").trim();
  return topic ? topic : null;
}

function topicForCompare(value: string | null | undefined): string | null {
  const topic = normalizeTopic(value);
  if (!topic) return null;
  return topic.replace(/[.\s]+$/g, "").toLocaleLowerCase();
}

export function displayTopicLabel(value: string | null | undefined): string | null {
  const topic = normalizeTopic(value);
  if (!topic) return null;

  const lowered = topic.toLocaleLowerCase();
  if (GENERIC_TOPIC_PATTERNS.some((pattern) => pattern.test(lowered))) {
    return null;
  }
  if (/^(and|or|if|to|for|with|without)\b/i.test(lowered) && topic.split(/\s+/).length <= 5) {
    return null;
  }

  return topic.replace(/[.\s]+$/g, "").trim() || null;
}

function sectionSummary(
  course: CourseWithRatings,
  section: CourseTopicDetail["sections"][number]
): string | null {
  const candidates = [normalizeTopic(section.sectionDescription), normalizeTopic(section.classNotes)];
  const courseDescKey = topicForCompare(course.description);

  for (const candidate of candidates) {
    if (!candidate) continue;
    const key = topicForCompare(candidate);
    if (!key) continue;
    if (courseDescKey && key === courseDescKey) continue;
    return candidate;
  }

  return course.description ?? null;
}

export function isSpecialTopicsCourse(
  course: Pick<CourseWithRatings, "code" | "title">
): boolean {
  return TOPIC_COURSE_PATTERN.test(course.title) || TOPIC_COURSE_PATTERN.test(course.code);
}

function sectionRowsForSplit(
  sections: CourseTopicDetail["sections"],
  semester: string
): CourseTopicDetail["sections"] {
  const out: CourseTopicDetail["sections"] = [];
  const seen = new Set<number>();

  for (const section of sections) {
    if (semester && section.semester !== semester) continue;
    if (typeof section.id !== "number" || Number.isNaN(section.id)) continue;
    if (seen.has(section.id)) continue;

    const component = String(section.componentType ?? "").trim().toLocaleUpperCase();
    if (component === "LAB") continue;

    const sectionNumber = String(section.sectionNumber ?? "").trim().toLocaleUpperCase();
    if (sectionNumber === "9000" || sectionNumber.startsWith("LAB")) continue;

    seen.add(section.id);
    out.push(section);
  }

  return out;
}

function displayTopicForSection(
  course: CourseWithRatings,
  section: CourseTopicDetail["sections"][number]
): string | null {
  const topicCandidates = [
    displayTopicLabel(section.sectionDescription),
    displayTopicLabel(section.classNotes),
  ].filter((v): v is string => Boolean(v));
  const courseDescriptionKey = topicForCompare(course.description);
  const courseTitleKey = topicForCompare(course.title);
  const semester = normalizeTopic(section.semester);
  const sectionNumber = normalizeTopic(section.sectionNumber);
  const instructor = normalizeTopic(section.instructor?.name);
  const prefix = semester ? `${semester} · ` : "";

  for (const candidate of topicCandidates) {
    const candidateKey = topicForCompare(candidate);
    if (!candidateKey) continue;
    if (candidateKey === courseDescriptionKey) continue;
    if (candidateKey === courseTitleKey) continue;
    if (courseTitleKey && candidateKey.includes(courseTitleKey)) continue;
    if (courseTitleKey && courseTitleKey.includes(candidateKey)) continue;
    return candidate;
  }

  if (sectionNumber && instructor) return `${prefix}Section ${sectionNumber} - ${instructor}`;
  if (sectionNumber) return `${prefix}Section ${sectionNumber}`;
  if (instructor) return `${prefix}${instructor}`;
  return semester;
}

export function splitSpecialTopicCourses(
  courses: CourseWithRatings[],
  detailsByCourseId: Map<number, CourseTopicDetail>,
  options?: { semester?: string | null }
): CatalogCourseEntry[] {
  const semester = String(options?.semester ?? "").trim();
  const out: CatalogCourseEntry[] = [];

  for (const course of courses) {
    const baseVirtualKey = String(course.id);

    if (!isSpecialTopicsCourse(course)) {
      out.push({ ...course, virtualKey: baseVirtualKey });
      continue;
    }

    const detail = detailsByCourseId.get(course.id);
    if (!detail || !Array.isArray(detail.sections)) {
      out.push({ ...course, virtualKey: baseVirtualKey });
      continue;
    }

    const sectionsForSplit = sectionRowsForSplit(detail.sections, semester);
    if (sectionsForSplit.length === 0) {
      out.push({ ...course, virtualKey: baseVirtualKey });
      continue;
    }

    for (const section of sectionsForSplit) {
      const topic = displayTopicForSection(course, section);
      const sectionGers = Array.isArray(section.gerCodes)
        ? section.gerCodes.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
        : [];

      out.push({
        ...course,
        description: sectionSummary(course, section),
        instructors:
          typeof section.instructor?.name === "string" && section.instructor.name.trim()
            ? [section.instructor.name.trim()]
            : course.instructors,
        campuses:
          typeof section.campus === "string" && section.campus.trim()
            ? [section.campus.trim()]
            : course.campuses,
        gers: sectionGers.length > 0 ? sectionGers : course.gers,
        requirements:
          typeof section.registrationRestrictions === "string" &&
          section.registrationRestrictions.trim()
            ? section.registrationRestrictions.trim()
            : course.requirements,
        avgEnrollmentPercent: course.avgEnrollmentPercent,
        topic,
        sectionId: section.id,
        sectionNumber: section.sectionNumber ?? null,
        virtualKey: `${course.id}::section:${section.id}`,
      });
    }
  }

  return out;
}

export function buildCourseDetailSearch(params: {
  semester?: string | null;
  topic?: string | null;
  sectionId?: number | null;
}): string {
  const search = new URLSearchParams();
  const semester = String(params.semester ?? "").trim();
  const topic = normalizeTopic(params.topic);
  const sectionId =
    typeof params.sectionId === "number" && Number.isFinite(params.sectionId)
      ? params.sectionId
      : null;

  if (semester) search.set("semester", semester);
  if (sectionId !== null) {
    search.set("section", String(sectionId));
  } else if (topic) {
    search.set("topic", topic);
  }

  const query = search.toString();
  return query ? `?${query}` : "";
}
