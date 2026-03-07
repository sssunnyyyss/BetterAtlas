import { useEffect } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatSessionApi } from "./useChatSession.js";
import { useChatSession } from "./useChatSession.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const aiHooks = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
}));

vi.mock("../../../hooks/useAi.js", () => ({
  useAiCourseRecommendations: () => ({
    mutate: aiHooks.mutate,
    isPending: aiHooks.isPending,
  }),
}));

type MutateOptions = {
  onSuccess?: (response: {
    assistantMessage: string;
    recommendations: [];
    followUpQuestion: string | null;
  }) => void;
  onError?: (error: unknown) => void;
};

function mountSession(initialEntry = "/ai-chat") {
  let latestSession: ChatSessionApi | null = null;

  function Harness() {
    const session = useChatSession();
    useEffect(() => {
      latestSession = session;
    }, [session]);
    return null;
  }

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);

  act(() => {
    root.render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Harness />
      </MemoryRouter>,
    );
  });

  return {
    getSession: () => {
      if (!latestSession) {
        throw new Error("Session not ready");
      }
      return latestSession;
    },
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe("useChatSession", () => {
  beforeEach(() => {
    aiHooks.mutate.mockReset();
    aiHooks.isPending = false;
    window.sessionStorage.clear();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("sends prompt-first payloads with a stable sessionId and no messages replay", () => {
    const view = mountSession();

    try {
      act(() => {
        view.getSession().sendPrompt("Find easy GER classes");
      });

      act(() => {
        view.getSession().sendPrompt("What about CS electives?");
      });

      expect(aiHooks.mutate).toHaveBeenCalledTimes(2);

      const firstPayload = aiHooks.mutate.mock.calls[0]?.[0] as Record<string, unknown>;
      const secondPayload = aiHooks.mutate.mock.calls[1]?.[0] as Record<string, unknown>;

      expect(firstPayload).toMatchObject({
        prompt: "Find easy GER classes",
        sessionId: expect.any(String),
      });
      expect(secondPayload).toMatchObject({
        prompt: "What about CS electives?",
        sessionId: firstPayload.sessionId,
      });
      expect(firstPayload).not.toHaveProperty("messages");
      expect(secondPayload).not.toHaveProperty("messages");
    } finally {
      view.unmount();
    }
  });

  it("retries with the original prompt and same sessionId", () => {
    const view = mountSession();

    try {
      act(() => {
        view.getSession().sendPrompt("Recommend one easy history class");
      });

      const firstPayload = aiHooks.mutate.mock.calls[0]?.[0] as Record<string, unknown>;
      const firstOptions = aiHooks.mutate.mock.calls[0]?.[1] as MutateOptions;

      act(() => {
        firstOptions.onError?.(new Error("timeout"));
      });

      act(() => {
        view.getSession().retryLastPrompt();
      });

      expect(aiHooks.mutate).toHaveBeenCalledTimes(2);
      const retryPayload = aiHooks.mutate.mock.calls[1]?.[0] as Record<string, unknown>;
      expect(retryPayload).toMatchObject({
        prompt: "Recommend one easy history class",
        sessionId: firstPayload.sessionId,
      });
      expect(retryPayload).not.toHaveProperty("messages");
    } finally {
      view.unmount();
    }
  });

  it("resets with reset:true on the same sessionId channel", () => {
    const view = mountSession();

    try {
      act(() => {
        view.getSession().sendPrompt("Suggest low-workload classes");
      });

      const sendPayload = aiHooks.mutate.mock.calls[0]?.[0] as Record<string, unknown>;

      act(() => {
        view.getSession().resetChat();
      });

      const resetPayload = aiHooks.mutate.mock.calls[1]?.[0] as Record<string, unknown>;
      expect(resetPayload).toEqual({
        reset: true,
        sessionId: sendPayload.sessionId,
      });
    } finally {
      view.unmount();
    }
  });

  it("uses the same sessionId for deep-link and follow-up sends", () => {
    const view = mountSession("/ai-chat?prompt=Find%20CS%20classes");

    try {
      expect(aiHooks.mutate).toHaveBeenCalledTimes(1);
      const deepLinkPayload = aiHooks.mutate.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(deepLinkPayload).toMatchObject({
        prompt: "Find CS classes",
        sessionId: expect.any(String),
      });
      expect(deepLinkPayload).not.toHaveProperty("messages");

      act(() => {
        view.getSession().sendPrompt("Now focus on 100-level");
      });

      const followUpPayload = aiHooks.mutate.mock.calls[1]?.[0] as Record<string, unknown>;
      expect(followUpPayload).toMatchObject({
        prompt: "Now focus on 100-level",
        sessionId: deepLinkPayload.sessionId,
      });
      expect(followUpPayload).not.toHaveProperty("messages");
    } finally {
      view.unmount();
    }
  });
});
