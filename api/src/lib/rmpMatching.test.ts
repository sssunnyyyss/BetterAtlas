import { describe, it, expect } from "vitest";
import { normalizeName, matchProfessor, matchCourse } from "./rmpMatching.js";

describe("normalizeName", () => {
  it("lowercases and trims", () => {
    expect(normalizeName("  John  Smith  ")).toBe("john smith");
  });

  it("removes titles", () => {
    expect(normalizeName("Dr. Jane Doe")).toBe("jane doe");
    expect(normalizeName("Prof. Jane Doe")).toBe("jane doe");
  });

  it("handles single names", () => {
    expect(normalizeName("Madonna")).toBe("madonna");
  });
});

describe("matchProfessor", () => {
  const instructors = [
    { id: 1, name: "John Smith", departmentId: 10 },
    { id: 2, name: "Jane Doe", departmentId: 20 },
    { id: 3, name: "John Smyth", departmentId: 10 },
  ];

  it("exact match", () => {
    const result = matchProfessor("John", "Smith", "Computer Science", instructors, new Map([[10, "CS"]]));
    expect(result).toEqual({ instructorId: 1, confidence: "exact" });
  });

  it("fuzzy match", () => {
    const result = matchProfessor("Jon", "Smith", "Computer Science", instructors, new Map([[10, "CS"]]));
    expect(result).not.toBeNull();
    expect(result?.confidence).toBe("fuzzy");
  });

  it("returns null for no match", () => {
    const result = matchProfessor("Completely", "Unknown", "Art", instructors, new Map());
    expect(result).toBeNull();
  });

  it("prefers department match when multiple fuzzy hits", () => {
    const result = matchProfessor("John", "Smit", "CS", instructors, new Map([[10, "CS"], [20, "MATH"]]));
    expect(result).not.toBeNull();
  });
});

describe("matchCourse", () => {
  const courses = [
    { id: 1, title: "Data Structures", departmentId: 10 },
    { id: 2, title: "Introduction to Psychology", departmentId: 20 },
    { id: 3, title: "Data Structures and Algorithms", departmentId: 10 },
  ];

  it("exact title match", () => {
    const result = matchCourse("Data Structures", 10, courses);
    expect(result).toBe(1);
  });

  it("case-insensitive match", () => {
    const result = matchCourse("data structures", 10, courses);
    expect(result).toBe(1);
  });

  it("returns null when no match", () => {
    const result = matchCourse("Organic Chemistry", 30, courses);
    expect(result).toBeNull();
  });
});
