import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearSessionBlockedCourseIds,
  getSessionBlockedCourseIds,
  mergeSessionBlockedCourseIds,
} from "./sessionBlocklistState.js";

const TTL_MS = 6 * 60 * 60 * 1000;
const SESSION_KEY_A = "user:session-blocklist-user-a:session:tab-a";
const SESSION_KEY_B = "user:session-blocklist-user-a:session:tab-b";
const SESSION_KEY_C = "anon:session:blocklist-anon";

function sortedIds(ids: Set<number>) {
  return Array.from(ids).sort((a, b) => a - b);
}

afterEach(() => {
  clearSessionBlockedCourseIds(SESSION_KEY_A);
  clearSessionBlockedCourseIds(SESSION_KEY_B);
  clearSessionBlockedCourseIds(SESSION_KEY_C);
  vi.restoreAllMocks();
});

describe("sessionBlocklistState", () => {
  it("merges and dedupes blocked course IDs across calls", () => {
    const first = mergeSessionBlockedCourseIds(SESSION_KEY_A, [101, 202, 101, 303]);
    const second = mergeSessionBlockedCourseIds(SESSION_KEY_A, [202, 404]);
    const current = getSessionBlockedCourseIds(SESSION_KEY_A);

    expect(sortedIds(first)).toEqual([101, 202, 303]);
    expect(sortedIds(second)).toEqual([101, 202, 303, 404]);
    expect(sortedIds(current)).toEqual([101, 202, 303, 404]);
  });

  it("persists within TTL and expires after TTL boundary", () => {
    let now = 1_710_000_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);

    mergeSessionBlockedCourseIds(SESSION_KEY_A, [77, 88]);
    expect(sortedIds(getSessionBlockedCourseIds(SESSION_KEY_A))).toEqual([77, 88]);

    now += TTL_MS - 1;
    expect(sortedIds(getSessionBlockedCourseIds(SESSION_KEY_A))).toEqual([77, 88]);

    now += 2;
    expect(sortedIds(getSessionBlockedCourseIds(SESSION_KEY_A))).toEqual([]);
    expect(sortedIds(getSessionBlockedCourseIds(SESSION_KEY_A))).toEqual([]);
  });

  it("keeps blocklists isolated per session key", () => {
    mergeSessionBlockedCourseIds(SESSION_KEY_A, [10, 20]);
    mergeSessionBlockedCourseIds(SESSION_KEY_B, [30]);

    expect(sortedIds(getSessionBlockedCourseIds(SESSION_KEY_A))).toEqual([10, 20]);
    expect(sortedIds(getSessionBlockedCourseIds(SESSION_KEY_B))).toEqual([30]);
    expect(sortedIds(getSessionBlockedCourseIds(SESSION_KEY_C))).toEqual([]);
  });

  it("supports explicit clear/reset behavior", () => {
    mergeSessionBlockedCourseIds(SESSION_KEY_A, [501, 502]);
    expect(sortedIds(getSessionBlockedCourseIds(SESSION_KEY_A))).toEqual([501, 502]);

    clearSessionBlockedCourseIds(SESSION_KEY_A);

    expect(sortedIds(getSessionBlockedCourseIds(SESSION_KEY_A))).toEqual([]);
  });
});
