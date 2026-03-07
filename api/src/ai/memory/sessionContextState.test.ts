import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AI_SESSION_CONTEXT_MAX_MESSAGES,
  AI_SESSION_CONTEXT_TTL_MS,
  clearSessionContext,
  getSessionContext,
  resolveAiSessionKey,
  upsertSessionContext,
} from "./sessionContextState.js";

const USER_ID = "memory-user-a";
const SESSION_A = "tab-a";
const SESSION_B = "tab-b";
const SESSION_C = "tab-c";

const SESSION_KEY_A = resolveAiSessionKey({ userId: USER_ID, sessionId: SESSION_A }) as string;
const SESSION_KEY_B = resolveAiSessionKey({ userId: USER_ID, sessionId: SESSION_B }) as string;
const SESSION_KEY_C = resolveAiSessionKey({ userId: USER_ID, sessionId: SESSION_C }) as string;

afterEach(() => {
  clearSessionContext(SESSION_KEY_A);
  clearSessionContext(SESSION_KEY_B);
  clearSessionContext(SESSION_KEY_C);
  vi.restoreAllMocks();
});

describe("sessionContextState", () => {
  it("derives stable session keys for authenticated, anonymous, and fallback inputs", () => {
    expect(resolveAiSessionKey({ userId: "u-1", sessionId: "s-1" })).toBe("user:u-1:session:s-1");
    expect(resolveAiSessionKey({ sessionId: "anon-sid" })).toBe("anon:session:anon-sid");
    expect(resolveAiSessionKey({ userId: "u-1" })).toBe("user:u-1");
    expect(resolveAiSessionKey({})).toBeNull();
  });

  it("isolates context for same user across different sessions", () => {
    upsertSessionContext(SESSION_KEY_A, {
      messages: [{ role: "user", content: "Need CS classes" }],
      inferredConstraints: { department: "CS" },
      topicFingerprint: ["cs", "coding"],
    });
    upsertSessionContext(SESSION_KEY_B, {
      messages: [{ role: "user", content: "Need QTM classes" }],
      inferredConstraints: { department: "QTM" },
      topicFingerprint: ["qtm", "statistics"],
    });

    expect(getSessionContext(SESSION_KEY_A)?.inferredConstraints.department).toBe("CS");
    expect(getSessionContext(SESSION_KEY_B)?.inferredConstraints.department).toBe("QTM");
  });

  it("expires context at the TTL boundary", () => {
    let now = 1_710_000_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);

    upsertSessionContext(SESSION_KEY_A, {
      messages: [{ role: "user", content: "Find me design classes" }],
    });
    expect(getSessionContext(SESSION_KEY_A)).not.toBeNull();

    now += AI_SESSION_CONTEXT_TTL_MS - 1;
    expect(getSessionContext(SESSION_KEY_A)).not.toBeNull();

    now += 1;
    expect(getSessionContext(SESSION_KEY_A)).toBeNull();
  });

  it("clears only the targeted session context", () => {
    upsertSessionContext(SESSION_KEY_A, {
      messages: [{ role: "user", content: "Session A memory" }],
    });
    upsertSessionContext(SESSION_KEY_B, {
      messages: [{ role: "user", content: "Session B memory" }],
    });

    clearSessionContext(SESSION_KEY_A);

    expect(getSessionContext(SESSION_KEY_A)).toBeNull();
    expect(getSessionContext(SESSION_KEY_B)?.messages[0]?.content).toBe("Session B memory");
  });

  it("trims stored history to the configured max message bound", () => {
    const messages = Array.from({ length: AI_SESSION_CONTEXT_MAX_MESSAGES + 3 }, (_, index) => ({
      role: (index % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `message-${index + 1}`,
    }));

    upsertSessionContext(SESSION_KEY_A, { messages });

    const stored = getSessionContext(SESSION_KEY_A);
    expect(stored?.messages).toHaveLength(AI_SESSION_CONTEXT_MAX_MESSAGES);
    expect(stored?.messages[0]?.content).toBe(`message-${messages.length - AI_SESSION_CONTEXT_MAX_MESSAGES + 1}`);
    expect(stored?.messages.at(-1)?.content).toBe(`message-${messages.length}`);
  });
});
