import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearSessionBlockedCourseIds,
  getSessionBlockedCourseIds,
  mergeSessionBlockedCourseIds,
} from "./sessionBlocklistState.js";

const TTL_MS = 6 * 60 * 60 * 1000;
const USER_A = "session-blocklist-user-a";
const USER_B = "session-blocklist-user-b";
const USER_C = "session-blocklist-user-c";

function sortedIds(ids: Set<number>) {
  return Array.from(ids).sort((a, b) => a - b);
}

afterEach(() => {
  clearSessionBlockedCourseIds(USER_A);
  clearSessionBlockedCourseIds(USER_B);
  clearSessionBlockedCourseIds(USER_C);
  vi.restoreAllMocks();
});

describe("sessionBlocklistState", () => {
  it("merges and dedupes blocked course IDs across calls", () => {
    const first = mergeSessionBlockedCourseIds(USER_A, [101, 202, 101, 303]);
    const second = mergeSessionBlockedCourseIds(USER_A, [202, 404]);
    const current = getSessionBlockedCourseIds(USER_A);

    expect(sortedIds(first)).toEqual([101, 202, 303]);
    expect(sortedIds(second)).toEqual([101, 202, 303, 404]);
    expect(sortedIds(current)).toEqual([101, 202, 303, 404]);
  });

  it("persists within TTL and expires after TTL boundary", () => {
    let now = 1_710_000_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);

    mergeSessionBlockedCourseIds(USER_A, [77, 88]);
    expect(sortedIds(getSessionBlockedCourseIds(USER_A))).toEqual([77, 88]);

    now += TTL_MS - 1;
    expect(sortedIds(getSessionBlockedCourseIds(USER_A))).toEqual([77, 88]);

    now += 2;
    expect(sortedIds(getSessionBlockedCourseIds(USER_A))).toEqual([]);
    expect(sortedIds(getSessionBlockedCourseIds(USER_A))).toEqual([]);
  });

  it("keeps blocklists isolated per user", () => {
    mergeSessionBlockedCourseIds(USER_A, [10, 20]);
    mergeSessionBlockedCourseIds(USER_B, [30]);

    expect(sortedIds(getSessionBlockedCourseIds(USER_A))).toEqual([10, 20]);
    expect(sortedIds(getSessionBlockedCourseIds(USER_B))).toEqual([30]);
    expect(sortedIds(getSessionBlockedCourseIds(USER_C))).toEqual([]);
  });

  it("supports explicit clear/reset behavior", () => {
    mergeSessionBlockedCourseIds(USER_A, [501, 502]);
    expect(sortedIds(getSessionBlockedCourseIds(USER_A))).toEqual([501, 502]);

    clearSessionBlockedCourseIds(USER_A);

    expect(sortedIds(getSessionBlockedCourseIds(USER_A))).toEqual([]);
  });
});
