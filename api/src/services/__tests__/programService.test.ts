import { beforeEach, describe, expect, it, vi } from "vitest";

const { selectMock } = vi.hoisted(() => ({
  selectMock: vi.fn(),
}));

vi.mock("../../db/index.js", () => ({
  db: {
    select: selectMock,
  },
}));

import { getProgramVariants } from "../programService.js";

function mockLimitQuery(result: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
  };
}

function mockOrderedQuery(result: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue(result),
  };
}

describe("getProgramVariants", () => {
  beforeEach(() => {
    selectMock.mockReset();
  });

  it("prefers strict same-name family when strict subset can satisfy both kinds", async () => {
    selectMock
      .mockReturnValueOnce(
        mockLimitQuery([{ id: 10, name: "Biology", degree: "BA" }])
      )
      .mockReturnValueOnce(
        mockOrderedQuery([
          { id: 11, name: "Biology", kind: "major", degree: "BA" },
          { id: 12, name: "Biology ", kind: "minor", degree: null },
          { id: 13, name: "Bio-logy", kind: "major", degree: "BS" },
          { id: 14, name: "Bio-logy", kind: "minor", degree: null },
        ])
      );

    const result = await getProgramVariants(10);

    expect(result).toEqual({
      programId: 10,
      name: "Biology",
      majors: [{ id: 11, name: "Biology", kind: "major", degree: "BA" }],
      minors: [{ id: 12, name: "Biology ", kind: "minor", degree: null }],
    });
  });

  it("falls back to normalized family candidates when strict subset is insufficient", async () => {
    selectMock
      .mockReturnValueOnce(
        mockLimitQuery([{ id: 20, name: "Public Health", degree: "BS" }])
      )
      .mockReturnValueOnce(
        mockOrderedQuery([
          { id: 21, name: "Public Health", kind: "major", degree: "BS" },
          { id: 22, name: "Public-Health", kind: "minor", degree: null },
        ])
      );

    const result = await getProgramVariants(20);

    expect(result).toEqual({
      programId: 20,
      name: "Public Health",
      majors: [{ id: 21, name: "Public Health", kind: "major", degree: "BS" }],
      minors: [{ id: 22, name: "Public-Health", kind: "minor", degree: null }],
    });
  });

  it("orders mixed-degree variants deterministically with exact-degree affinity first", async () => {
    selectMock
      .mockReturnValueOnce(
        mockLimitQuery([{ id: 30, name: "Chemistry", degree: "BS" }])
      )
      .mockReturnValueOnce(
        mockOrderedQuery([
          { id: 35, name: "Chemistry", kind: "minor", degree: "BA" },
          { id: 31, name: "Chemistry", kind: "major", degree: "BS" },
          { id: 32, name: "Chemistry", kind: "major", degree: "BA" },
          { id: 33, name: "chemistry", kind: "major", degree: "BS" },
          { id: 34, name: "Chemistry", kind: "minor", degree: "BS" },
        ])
      );

    const result = await getProgramVariants(30);

    expect(result?.majors.map((v) => v.id)).toEqual([31, 33, 32]);
    expect(result?.minors.map((v) => v.id)).toEqual([34, 35]);
    expect(result?.majors.every((v) => v.kind === "major")).toBe(true);
    expect(result?.minors.every((v) => v.kind === "minor")).toBe(true);
  });
});
