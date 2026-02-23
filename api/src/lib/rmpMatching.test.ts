import { describe, it, expect } from "vitest";
import {
  normalizeName,
  matchProfessor,
  matchCourse,
  listProfessorDisambiguationCandidates,
} from "./rmpMatching.js";

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

  it("matches nickname by last name + department fallback", () => {
    const result = matchProfessor(
      "Mike",
      "Carr",
      "Mathematics",
      [
        { id: 10, name: "Michael Carr", departmentId: 30 },
        { id: 11, name: "Michelle Carr", departmentId: 20 },
      ],
      new Map([
        [30, "MATH"],
        [20, "CHEM"],
      ])
    );
    expect(result).toEqual({ instructorId: 10, confidence: "fuzzy" });
  });

  it("returns null for ambiguous nickname fallback candidates", () => {
    const result = matchProfessor(
      "M.",
      "Carr",
      "Mathematics",
      [
        { id: 20, name: "Michael Carr", departmentId: 30 },
        { id: 21, name: "Matthew Carr", departmentId: 30 },
      ],
      new Map([[30, "MATH"]])
    );
    expect(result).toBeNull();
  });

  it("handles multi-token RMP last names in fallback matching", () => {
    const result = matchProfessor(
      "Tracy",
      "Morkin McGill",
      "Chemistry",
      [
        { id: 30, name: "Tracy McGill", departmentId: 40 },
        { id: 31, name: "T. McGill", departmentId: null },
      ],
      new Map([[40, "CHEM"]])
    );
    expect(result).toEqual({ instructorId: 30, confidence: "fuzzy" });
  });
});

describe("matchCourse", () => {
  const deptCodeMap = new Map<number, string>([
    [10, "CS"],
    [20, "PSYC"],
    [30, "MKT"],
    [40, "ACT"],
  ]);

  const courses = [
    { id: 1, code: "CS 240", title: "Data Structures", departmentId: 10 },
    { id: 2, code: "PSYC 110", title: "Introduction to Psychology", departmentId: 20 },
    { id: 3, code: "CS 241", title: "Data Structures and Algorithms", departmentId: 10 },
    { id: 4, code: "MKT 340", title: "Marketing Strategy", departmentId: 30 },
    { id: 5, code: "ACT 399", title: "Special Topics in Accounting", departmentId: 40 },
    { id: 6, code: "ACT 399R", title: "Special Topics in Accounting: Research", departmentId: 40 },
  ];

  it("exact title match", () => {
    const result = matchCourse("Data Structures", 10, courses, deptCodeMap);
    expect(result).toBe(1);
  });

  it("case-insensitive match", () => {
    const result = matchCourse("data structures", 10, courses, deptCodeMap);
    expect(result).toBe(1);
  });

  it("matches by dept + 3-digit course number from class text", () => {
    const result = matchCourse("MKT 340", null, courses, deptCodeMap);
    expect(result).toBe(4);
  });

  it("matches by dept + 3-digit course number from review text", () => {
    const result = matchCourse(
      "Special topics class",
      null,
      courses,
      deptCodeMap,
      "This was basically MKT 340 with lots of cases"
    );
    expect(result).toBe(4);
  });

  it("uses instructor department + number when dept code is missing", () => {
    const result = matchCourse(
      "Course 340",
      30,
      courses,
      deptCodeMap,
      "Hard but useful 340 class"
    );
    expect(result).toBe(4);
  });

  it("matches suffix-coded classes like ACT399R", () => {
    const result = matchCourse("ACT399R", 40, courses, deptCodeMap);
    expect(result).toBe(6);
  });

  it("returns null when no match", () => {
    const result = matchCourse("Organic Chemistry", 30, courses, deptCodeMap);
    expect(result).toBeNull();
  });
});

describe("listProfessorDisambiguationCandidates", () => {
  it("returns last-name compatible candidates ordered by dept and first-name confidence", () => {
    const candidates = listProfessorDisambiguationCandidates(
      "B.",
      "Lee",
      "Finance",
      [
        { id: 10, name: "Brian Lee", departmentId: 1 },
        { id: 11, name: "Beatrice Lee", departmentId: 1 },
        { id: 12, name: "Brandon Li", departmentId: 1 },
      ],
      new Map([[1, "FIN"]])
    );

    expect(candidates.map((c) => c.instructorId)).toEqual([10, 11]);
    expect(candidates[0]?.firstScore).toBeGreaterThanOrEqual(candidates[1]?.firstScore ?? 0);
  });
});
