import { describe, expect, it, vi } from "vitest";
vi.mock("../../db/index.js", () => ({ db: {} }));
import {
  evaluateInviteCode,
  normalizeInviteCode,
} from "../inviteCodeService.js";

describe("normalizeInviteCode", () => {
  it("trims whitespace and uppercases the value", () => {
    expect(normalizeInviteCode("  early-adopter-2026  ")).toBe(
      "EARLY-ADOPTER-2026"
    );
  });
});

describe("evaluateInviteCode", () => {
  it("returns expired when the code has passed its expiration date", () => {
    const now = new Date("2026-02-16T12:00:00.000Z");
    const expiresAt = new Date("2026-02-16T11:59:59.000Z");

    expect(
      evaluateInviteCode({
        usedCount: 1,
        maxUses: 10,
        expiresAt,
        now,
      })
    ).toEqual({ ok: false, reason: "expired" });
  });

  it("returns maxed when usage has reached maxUses", () => {
    const now = new Date("2026-02-16T12:00:00.000Z");
    const expiresAt = new Date("2026-02-16T12:30:00.000Z");

    expect(
      evaluateInviteCode({
        usedCount: 5,
        maxUses: 5,
        expiresAt,
        now,
      })
    ).toEqual({ ok: false, reason: "maxed" });
  });

  it("returns ok for a valid code", () => {
    const now = new Date("2026-02-16T12:00:00.000Z");
    const expiresAt = new Date("2026-02-16T12:30:00.000Z");

    expect(
      evaluateInviteCode({
        usedCount: 4,
        maxUses: 5,
        expiresAt,
        now,
      })
    ).toEqual({ ok: true });
  });
});
