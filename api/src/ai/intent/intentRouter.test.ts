import { describe, expect, it } from "vitest";
import { classifyIntent, type IntentMode } from "./intentRouter.js";

const EMPTY_HISTORY: { role: "user" | "assistant"; content: string }[] = [];

type Fixture = {
  name: string;
  prompt: string;
  mode: IntentMode;
  reason: string;
};

function classify(prompt: string) {
  return classifyIntent({
    latestUser: prompt,
    recentMessages: EMPTY_HISTORY,
  });
}

describe("classifyIntent", () => {
  const fixtures: Fixture[] = [
    {
      name: "trivial greeting routes to conversation",
      prompt: "hey",
      mode: "conversation",
      reason: "trivial_greeting",
    },
    {
      name: "empty turn routes to conversation",
      prompt: "   ",
      mode: "conversation",
      reason: "empty_turn",
    },
    {
      name: "general conversational turn stays conversation",
      prompt: "I'm overwhelmed planning next semester.",
      mode: "conversation",
      reason: "general_conversation",
    },
    {
      name: "ambiguous course-seeking turn routes to clarify",
      prompt: "Can you help me pick classes?",
      mode: "clarify",
      reason: "ambiguous_course_request_missing_constraints",
    },
    {
      name: "explicit recommendation language routes to recommend",
      prompt: "Recommend 3 easy HA classes for Fall 2026.",
      mode: "recommend",
      reason: "explicit_recommendation_request",
    },
    {
      name: "course code signal routes to recommend",
      prompt: "cs170",
      mode: "recommend",
      reason: "explicit_course_code_request",
    },
    {
      name: "course code and recommendation language combine into recommend",
      prompt: "Can you recommend CS-170 for me?",
      mode: "recommend",
      reason: "explicit_recommendation_course_code_and_request",
    },
  ];

  for (const fixture of fixtures) {
    it(fixture.name, () => {
      const decision = classify(fixture.prompt);
      expect(decision.mode).toBe(fixture.mode);
      expect(decision.reason).toBe(fixture.reason);
      expect(decision.signals.length).toBeGreaterThan(0);
    });
  }

  it("normalizes recommendation prompt variants to the same deterministic decision", () => {
    const variants = [
      "recommend some classes",
      " RECOMMEND   some classes   ",
      "recommend some classes!!!",
      "recommend / some // classes",
    ];

    const decisions = variants.map((prompt) => classify(prompt));

    expect(decisions.map((d) => d.mode)).toEqual([
      "recommend",
      "recommend",
      "recommend",
      "recommend",
    ]);
    expect(decisions.map((d) => d.reason)).toEqual([
      "explicit_recommendation_request",
      "explicit_recommendation_request",
      "explicit_recommendation_request",
      "explicit_recommendation_request",
    ]);
  });

  it("normalizes ambiguous prompt variants to the same deterministic decision", () => {
    const variants = [
      "Can you help me pick classes",
      "can you help me pick classes???",
      " CAN YOU   HELP ME PICK CLASSES ",
    ];

    const decisions = variants.map((prompt) => classify(prompt));

    expect(decisions.map((d) => d.mode)).toEqual(["clarify", "clarify", "clarify"]);
    expect(decisions.map((d) => d.reason)).toEqual([
      "ambiguous_course_request_missing_constraints",
      "ambiguous_course_request_missing_constraints",
      "ambiguous_course_request_missing_constraints",
    ]);
  });

  it("returns stable mode and reason across repeated invocations", () => {
    const prompt = "Can you help me pick classes?";
    const first = classify(prompt);

    for (let i = 0; i < 10; i += 1) {
      expect(classify(prompt)).toEqual(first);
    }
  });
});
