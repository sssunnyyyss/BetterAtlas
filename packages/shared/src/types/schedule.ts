import type { Schedule } from "./course.js";

export interface ScheduleCourseBlock {
  itemId: number;
  sectionId: number;
  addedAt: string;
  color: string | null;
  course: { id: number; code: string; title: string };
  section: {
    sectionNumber: string | null;
    semester: string;
    schedule: Schedule | null;
    instructorName: string | null;
    location: string | null;
    campus: string | null;
    componentType: string | null;
    instructionMethod: string | null;
    enrollmentStatus: string | null;
    enrollmentCap: number | null;
    enrollmentCur: number;
    seatsAvail: number | null;
    waitlistCount: number;
    waitlistCap: number | null;
    startDate: string | null;
    endDate: string | null;
  };
}

export interface MyScheduleResponse {
  term: { code: string; name: string | null };
  listId: number | null;
  items: ScheduleCourseBlock[];
}

export interface FriendScheduleResponse {
  friend: { id: string; username: string; fullName: string };
  term: { code: string; name: string | null };
  items: ScheduleCourseBlock[];
}
