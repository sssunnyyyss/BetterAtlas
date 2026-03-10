import { describe, expect, it } from "vitest";
import type { ProgramSummary, ProgramVariants } from "@betteratlas/shared";
import {
  buildProgramSearchOptions,
  canonicalizeProgramTab,
  selectProgramVariant,
} from "./programVariantSelection.js";

function program(overrides: Partial<ProgramSummary> & Pick<ProgramSummary, "id">): ProgramSummary {
  return {
    id: overrides.id,
    name: overrides.name ?? `Program ${overrides.id}`,
    kind: overrides.kind ?? "major",
    degree: overrides.degree ?? null,
  };
}

describe("buildProgramSearchOptions", () => {
  it("keeps families even when no BA major exists and selects deterministic representatives", () => {
    const input: ProgramSummary[] = [
      program({ id: 4, name: "Computer Science", kind: "minor", degree: null }),
      program({ id: 3, name: "Computer Science", kind: "major", degree: "BS" }),
      program({ id: 2, name: "Computer Science", kind: "major", degree: "BA" }),
      program({ id: 8, name: "Nursing", kind: "major", degree: "BSN" }),
      program({ id: 9, name: "Nursing", kind: "minor", degree: null }),
      program({ id: 12, name: "Comparative Literature", kind: "minor", degree: null }),
    ];

    const options = buildProgramSearchOptions(input);

    expect(options.map((option) => option.id)).toEqual([12, 2, 8]);
    expect(options.map((option) => option.name)).toEqual([
      "Comparative Literature",
      "Computer Science",
      "Nursing",
    ]);
  });
});

describe("selectProgramVariant", () => {
  const variants: ProgramVariants = {
    programId: 100,
    name: "Chemistry",
    majors: [
      program({ id: 11, name: "Chemistry", kind: "major", degree: "BA" }),
      program({ id: 12, name: "Chemistry", kind: "major", degree: "BS" }),
      program({ id: 13, name: "Chemistry", kind: "major", degree: null }),
    ],
    minors: [
      program({ id: 21, name: "Chemistry", kind: "minor", degree: null }),
      program({ id: 22, name: "Chemistry", kind: "minor", degree: "BS" }),
    ],
  };

  it("restores previous selection for target kind when available", () => {
    const picked = selectProgramVariant({
      variants,
      targetKind: "major",
      current: program({ id: 21, name: "Chemistry", kind: "minor", degree: null }),
      previousByKind: {
        major: program({ id: 12, name: "Chemistry", kind: "major", degree: "BS" }),
      },
    });

    expect(picked?.id).toBe(12);
  });

  it("falls back to preferred degree when prior selection is unavailable", () => {
    const picked = selectProgramVariant({
      variants,
      targetKind: "minor",
      current: program({ id: 12, name: "Chemistry", kind: "major", degree: "BS" }),
      previousByKind: {
        minor: program({ id: 999, name: "Chemistry", kind: "minor", degree: null }),
      },
    });

    expect(picked?.id).toBe(22);
  });

  it("uses deterministic ranking when no preferred degree exists", () => {
    const picked = selectProgramVariant({
      variants,
      targetKind: "major",
      current: program({ id: 21, name: "Chemistry", kind: "minor", degree: null }),
    });

    expect(picked?.id).toBe(11);
  });
});

describe("canonicalizeProgramTab", () => {
  it("canonicalizes missing and invalid values to required", () => {
    expect(canonicalizeProgramTab(null)).toBe("required");
    expect(canonicalizeProgramTab(undefined)).toBe("required");
    expect(canonicalizeProgramTab("invalid")).toBe("required");
  });

  it("preserves electives tab", () => {
    expect(canonicalizeProgramTab("electives")).toBe("electives");
  });
});
