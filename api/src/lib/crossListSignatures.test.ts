import { describe, expect, it } from "vitest";
import {
  buildCrossListSignatureMap,
  haveExactCrossListSignatures,
} from "./crossListSignatures.js";

describe("buildCrossListSignatureMap", () => {
  it("normalizes whitespace/casing and de-duplicates signature entries", () => {
    const signatures = buildCrossListSignatureMap([
      {
        courseId: 1,
        termCode: "2251",
        instructorId: 17,
        meetsDisplay: "MW 10:00-11:15",
      },
      {
        courseId: 1,
        termCode: "2251",
        instructorId: 17,
        meetsDisplay: "  mw   10:00-11:15  ",
      },
      {
        courseId: 1,
        termCode: "2251",
        instructorId: null,
        meetsDisplay: "MW 10:00-11:15",
      },
    ]);

    expect(signatures.get(1)).toEqual(new Set(["2251::17::mw 10:00-11:15"]));
  });
});

describe("haveExactCrossListSignatures", () => {
  it("returns true when signature sets match exactly", () => {
    expect(
      haveExactCrossListSignatures(
        new Set(["2251::17::mw 10:00-11:15", "2251::18::tth 13:00-14:15"]),
        new Set(["2251::18::tth 13:00-14:15", "2251::17::mw 10:00-11:15"])
      )
    ).toBe(true);
  });

  it("returns false when a candidate is missing one of the source signatures", () => {
    expect(
      haveExactCrossListSignatures(
        new Set(["2251::17::mw 10:00-11:15", "2251::18::tth 13:00-14:15"]),
        new Set(["2251::17::mw 10:00-11:15"])
      )
    ).toBe(false);
  });

  it("returns false when either course has no valid signatures", () => {
    expect(haveExactCrossListSignatures(new Set(), new Set(["2251::17::mw 10:00-11:15"]))).toBe(
      false
    );
    expect(haveExactCrossListSignatures(undefined, new Set(["2251::17::mw 10:00-11:15"]))).toBe(
      false
    );
  });
});
