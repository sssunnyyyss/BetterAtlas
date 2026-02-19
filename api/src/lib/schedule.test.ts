import { describe, expect, it } from "vitest";
import { scheduleFromMeetings, schedulesFromMeetings } from "./schedule.js";

describe("schedulesFromMeetings", () => {
  it("keeps distinct meeting blocks when a section meets at different times", () => {
    const meetings = [
      { day: "0", start_time: "1000", end_time: "1115", location: "White Hall 205" },
      { day: "2", start_time: "1000", end_time: "1115", location: "White Hall 205" },
      { day: "0", start_time: "1600", end_time: "1800", location: "White Hall 205" },
    ];

    expect(schedulesFromMeetings(meetings)).toEqual([
      { days: ["M", "W"], start: "10:00", end: "11:15", location: "White Hall 205" },
      { days: ["M"], start: "16:00", end: "18:00", location: "White Hall 205" },
    ]);
  });

  it("normalizes 3-digit times and groups matching day/time blocks", () => {
    const meetings = [
      { day: 0, startTime: "830", endTime: "945", location: "" },
      { day: 2, startTime: "0830", endTime: "0945", location: "" },
    ];

    expect(schedulesFromMeetings(meetings)).toEqual([
      { days: ["M", "W"], start: "08:30", end: "09:45", location: "" },
    ]);
  });
});

describe("scheduleFromMeetings", () => {
  it("returns the single grouped schedule when only one exists", () => {
    const meetings = [
      { day: 1, startTime: "1300", endTime: "1415", location: "Atwood 360" },
      { day: 3, startTime: "1300", endTime: "1415", location: "Atwood 360" },
    ];

    expect(scheduleFromMeetings(meetings)).toEqual({
      days: ["T", "Th"],
      start: "13:00",
      end: "14:15",
      location: "Atwood 360",
    });
  });

  it("keeps backward-compatible aggregate schedule when multiple groups exist", () => {
    const meetings = [
      { day: 0, startTime: "1000", endTime: "1115", location: "White Hall 205" },
      { day: 2, startTime: "1000", endTime: "1115", location: "White Hall 205" },
      { day: 0, startTime: "1600", endTime: "1800", location: "White Hall 205" },
    ];

    expect(scheduleFromMeetings(meetings)).toEqual({
      days: ["M", "W"],
      start: "10:00",
      end: "18:00",
      location: "White Hall 205",
    });
  });
});
