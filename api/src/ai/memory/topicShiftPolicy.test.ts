import { describe, expect, it } from "vitest";
import {
  decayContextForTopicShift,
  detectTopicShift,
  resolveConstraintPrecedence,
} from "./topicShiftPolicy.js";

describe("topicShiftPolicy", () => {
  it("detects shift phrases plus low overlap as a topic shift", () => {
    const result = detectTopicShift({
      previousFingerprint: ["computer science", "algorithms", "proof-heavy"],
      latestUser: "Actually I want art history seminars instead.",
      resolvedConstraints: { department: "CS", semester: "Fall 2026" },
    });

    expect(result.detected).toBe(true);
    expect(result.reasons).toContain("shift_phrase");
    expect(result.reasons).toContain("low_overlap");
  });

  it("keeps continuity turns as non-shifts and preserves inferred context", () => {
    const detection = detectTopicShift({
      previousFingerprint: ["computer", "systems", "moderate workload"],
      latestUser: "Can you keep focusing on computer systems with moderate workload?",
      resolvedConstraints: { department: "CS", workload: "moderate" },
    });

    expect(detection.detected).toBe(false);

    const decayed = decayContextForTopicShift({
      detected: detection.detected,
      context: {
        messages: [
          { role: "user", content: "I need systems classes." },
          { role: "assistant", content: "Got it, systems focus." },
        ],
        inferredConstraints: { department: "CS", workload: "moderate" },
        topicFingerprint: ["computer", "systems", "moderate"],
      },
    });

    expect(decayed.inferredConstraints).toEqual({ department: "CS", workload: "moderate" });
    expect(decayed.topicFingerprint).toEqual(["computer", "systems", "moderate"]);
    expect(decayed.messages).toHaveLength(2);
  });

  it("decays stale inferred constraints and keeps only recent turns when shifted", () => {
    const decayed = decayContextForTopicShift({
      detected: true,
      keepRecentMessages: 2,
      context: {
        messages: [
          { role: "user", content: "I want CS theory classes." },
          { role: "assistant", content: "Try CS 300-level theory courses." },
          { role: "user", content: "Now I need beginner art classes." },
          { role: "assistant", content: "Switching to art-focused options." },
        ],
        inferredConstraints: { department: "CS", semester: "Fall 2026", workload: "hard" },
        topicFingerprint: ["computer", "science", "theory"],
      },
    });

    expect(decayed.messages).toHaveLength(2);
    expect(decayed.messages[0]?.content).toBe("Now I need beginner art classes.");
    expect(decayed.inferredConstraints).toEqual({});
    expect(decayed.topicFingerprint).toEqual([]);
  });

  it("flags explicit negation of a prior constraint as a contradiction shift", () => {
    const result = detectTopicShift({
      previousFingerprint: ["computer science", "algorithms"],
      latestUser: "No CS please, I want something else.",
      resolvedConstraints: { department: "CS" },
    });

    expect(result.detected).toBe(true);
    expect(result.reasons).toContain("constraint_contradiction:department");
  });

  it("resolves precedence as explicit current over latest inferred over prior inferred", () => {
    const resolved = resolveConstraintPrecedence({
      priorInferred: { department: "CS", semester: "Fall 2026", workload: "hard" },
      latestTurnInferred: { department: "QTM", workload: "moderate" },
      explicitCurrent: { workload: "easy", semester: "Spring 2027" },
    });

    expect(resolved).toEqual({
      department: "QTM",
      semester: "Spring 2027",
      workload: "easy",
    });
  });
});
