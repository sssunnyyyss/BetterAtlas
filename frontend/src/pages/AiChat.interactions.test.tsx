import type { MutableRefObject } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatSessionApi } from "../features/ai-chat/hooks/useChatSession.js";
import type {
  ChatRequestLifecycle,
  ChatTurn,
} from "../features/ai-chat/model/chatTypes.js";
import {
  resetVisualViewport,
  setViewportSize,
  setVisualViewport,
} from "../test/utils/viewport.js";
import AiChat from "./AiChat.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const hooks = vi.hoisted(() => ({
  useChatSession: vi.fn(),
}));

vi.mock("../features/ai-chat/hooks/useChatSession.js", () => ({
  useChatSession: hooks.useChatSession,
}));

function createTurns(): ChatTurn[] {
  return [
    {
      id: "turn-user",
      role: "user",
      content: "Find me easy GER options",
    },
    {
      id: "turn-assistant",
      role: "assistant",
      content: "Here are three low-workload GER options.",
      recommendations: [],
      followUp: null,
    },
  ];
}

function createRecommendationTurn(): ChatTurn {
  return {
    id: "turn-assistant-recommendations",
    role: "assistant",
    content: "Try these recommendations.",
    recommendations: [
      {
        course: {
          id: 731,
          code: "CS 171",
          title: "Intro to CS II",
          description: "Follow-up introductory course",
          credits: 4,
          departmentId: 1,
          attributes: null,
          department: null,
          avgQuality: 4,
          avgDifficulty: 3,
          avgWorkload: 3,
          reviewCount: 80,
          classScore: 4.1,
        },
        fitScore: 8,
        why: [
          "Strong continuation path from CS 170",
          "Balanced workload relative to similar options",
          "Frequent semester availability",
        ],
        cautions: ["Project deadlines cluster near finals week"],
      },
    ],
    followUp: null,
  };
}

function createLifecycle(
  overrides: Partial<ChatRequestLifecycle> = {},
): ChatRequestLifecycle {
  const now = Date.now();
  return {
    requestToken: 0,
    transitionSequence: 0,
    lastTransitionAt: now,
    lastTransitionFrom: "idle",
    lastTransitionTo: "idle",
    lastTransitionReason: "reset",
    settleDelayMs: 1200,
    settleDeadlineAt: null,
    lastSubmittedPrompt: null,
    lastFailedPrompt: null,
    lastFailedPromptPayload: null,
    lastErrorMessage: null,
    ...overrides,
  };
}

function setReducedMotionPreference(enabled: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === "(prefers-reduced-motion: reduce)" ? enabled : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  }));
}

function buildSession(overrides: Partial<ChatSessionApi> = {}): ChatSessionApi {
  const turns = overrides.turns ?? createTurns();
  const requestState = overrides.requestState ?? "idle";

  return {
    turns,
    draft: overrides.draft ?? "",
    requestState,
    requestLifecycle:
      overrides.requestLifecycle ??
      createLifecycle({
        lastTransitionTo: requestState,
      }),
    isSending: overrides.isSending ?? requestState === "sending",
    hasTurns: overrides.hasTurns ?? turns.length > 0,
    messagesEndRef:
      overrides.messagesEndRef ??
      ({ current: document.createElement("div") } as MutableRefObject<HTMLDivElement | null>),
    textareaRef:
      overrides.textareaRef ??
      ({
        current: document.createElement("textarea"),
      } as MutableRefObject<HTMLTextAreaElement | null>),
    setDraft: overrides.setDraft ?? vi.fn(),
    sendPrompt: overrides.sendPrompt ?? vi.fn(),
    sendDraft: overrides.sendDraft ?? vi.fn(),
    retryLastPrompt: overrides.retryLastPrompt ?? vi.fn(),
    resetChat: overrides.resetChat ?? vi.fn(),
  };
}

function renderAiChat({
  embedded = false,
  sessionOverrides,
}: {
  embedded?: boolean;
  sessionOverrides?: Partial<ChatSessionApi>;
} = {}) {
  hooks.useChatSession.mockReturnValue(buildSession(sessionOverrides));

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);

  act(() => {
    root.render(
      <MemoryRouter>
        <AiChat embedded={embedded} />
      </MemoryRouter>,
    );
  });

  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe("AiChat interactions", () => {
  beforeEach(() => {
    hooks.useChatSession.mockReset();
    setReducedMotionPreference(false);
    setViewportSize(390, 844);
    setVisualViewport({
      width: 390,
      height: 844,
      offsetTop: 0,
      offsetLeft: 0,
      scale: 1,
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
    resetVisualViewport();
    vi.clearAllMocks();
  });

  it("keeps standalone composer controls reachable when keyboard shrinks visual viewport", () => {
    const view = renderAiChat({
      sessionOverrides: {
        draft: "Find classes for spring",
        isSending: false,
      },
    });

    try {
      const composerZone = view.container.querySelector('[data-testid="chat-zone-composer"]');
      const composerShell = view.container.querySelector(
        '[data-testid="chat-composer-shell"]',
      );
      const textarea = view.container.querySelector(
        '[data-testid="chat-composer-textarea"]',
      );
      const sendButton = view.container.querySelector(
        '[data-testid="chat-composer-send"]',
      ) as HTMLButtonElement | null;

      expect(composerZone).not.toBeNull();
      expect(composerShell).not.toBeNull();
      expect(textarea).not.toBeNull();
      expect(sendButton).not.toBeNull();
      expect(sendButton?.disabled).toBe(false);

      act(() => {
        setVisualViewport({ height: 544 });
      });

      expect(composerZone).toHaveStyle({ paddingBottom: "300px" });
      expect(sendButton?.disabled).toBe(false);

      act(() => {
        setVisualViewport({ height: 844 });
      });

      expect(composerZone?.getAttribute("style") ?? "").not.toContain("padding-bottom");
    } finally {
      view.unmount();
    }
  });

  it("applies keyboard inset in embedded mode and keeps composer controls visible", () => {
    const view = renderAiChat({
      embedded: true,
      sessionOverrides: {
        draft: "",
        isSending: false,
      },
    });

    try {
      const embeddedShell = view.container.querySelector('[data-testid="chat-shell-embedded"]');
      const composerZone = view.container.querySelector('[data-testid="chat-zone-composer"]');
      const composerShell = view.container.querySelector(
        '[data-testid="chat-composer-shell"]',
      );
      const textarea = view.container.querySelector(
        '[data-testid="chat-composer-textarea"]',
      );
      const sendButton = view.container.querySelector(
        '[data-testid="chat-composer-send"]',
      ) as HTMLButtonElement | null;

      expect(embeddedShell).not.toBeNull();
      expect(composerZone).not.toBeNull();
      expect(composerShell).not.toBeNull();
      expect(textarea).not.toBeNull();
      expect(sendButton).not.toBeNull();
      expect(sendButton?.disabled).toBe(true);

      act(() => {
        setVisualViewport({ height: 604, offsetTop: 20 });
      });

      expect(composerZone).toHaveStyle({ paddingBottom: "220px" });
      expect(sendButton?.disabled).toBe(true);
    } finally {
      view.unmount();
    }
  });

  it("keeps send disabled state controlled by draft and sending flags, not viewport changes", () => {
    const scenarios = [
      { draft: "", isSending: false, expectedDisabled: true },
      { draft: "Plan schedule", isSending: false, expectedDisabled: false },
      { draft: "Plan schedule", isSending: true, expectedDisabled: true },
    ];

    for (const scenario of scenarios) {
      const view = renderAiChat({
        embedded: true,
        sessionOverrides: {
          draft: scenario.draft,
          isSending: scenario.isSending,
        },
      });

      try {
        const sendButton = view.container.querySelector(
          '[data-testid="chat-composer-send"]',
        ) as HTMLButtonElement | null;
        const composerZone = view.container.querySelector('[data-testid="chat-zone-composer"]');

        expect(sendButton).not.toBeNull();
        expect(sendButton?.disabled).toBe(scenario.expectedDisabled);

        act(() => {
          setVisualViewport({ height: 560, offsetTop: 0 });
        });

        expect(composerZone).toHaveStyle({ paddingBottom: "284px" });
        expect(sendButton?.disabled).toBe(scenario.expectedDisabled);
      } finally {
        view.unmount();
      }
    }
  });

  it("renders deterministic lifecycle status progression", () => {
    const lifecycleSteps: Array<{
      requestState: ChatSessionApi["requestState"];
      lifecycle: ChatRequestLifecycle;
      expectedReason?: string;
      expectedLabel?: string;
      expectedRole?: "status" | "alert";
    }> = [
      {
        requestState: "idle",
        lifecycle: createLifecycle({
          transitionSequence: 1,
          lastTransitionTo: "idle",
          lastTransitionReason: "reset",
        }),
      },
      {
        requestState: "sending",
        lifecycle: createLifecycle({
          transitionSequence: 2,
          lastTransitionFrom: "idle",
          lastTransitionTo: "sending",
          lastTransitionReason: "send",
        }),
        expectedReason: "send",
        expectedLabel: "Atlas AI is thinking...",
        expectedRole: "status",
      },
      {
        requestState: "success",
        lifecycle: createLifecycle({
          transitionSequence: 3,
          lastTransitionFrom: "sending",
          lastTransitionTo: "success",
          lastTransitionReason: "response-success",
        }),
        expectedReason: "response-success",
        expectedLabel: "Response received.",
        expectedRole: "status",
      },
      {
        requestState: "error",
        lifecycle: createLifecycle({
          transitionSequence: 4,
          lastTransitionFrom: "sending",
          lastTransitionTo: "error",
          lastTransitionReason: "response-error",
          lastErrorMessage: "Network timeout",
        }),
        expectedReason: "response-error",
        expectedLabel: "Network timeout",
        expectedRole: "alert",
      },
      {
        requestState: "idle",
        lifecycle: createLifecycle({
          transitionSequence: 5,
          lastTransitionFrom: "error",
          lastTransitionTo: "idle",
          lastTransitionReason: "settle-idle",
        }),
      },
    ];

    for (const step of lifecycleSteps) {
      const view = renderAiChat({
        sessionOverrides: {
          requestState: step.requestState,
          requestLifecycle: step.lifecycle,
        },
      });

      try {
        const statusRegion = view.container.querySelector(
          '[data-testid="chat-request-status"]',
        );
        if (!step.expectedReason) {
          expect(statusRegion).toBeNull();
          continue;
        }

        expect(statusRegion).not.toBeNull();
        expect(statusRegion?.getAttribute("data-transition-reason")).toBe(
          step.expectedReason,
        );
        expect(statusRegion?.getAttribute("data-request-state")).toBe(
          step.requestState,
        );
        expect(view.container.textContent).toContain(step.expectedLabel);
        expect(
          view.container.querySelector(`[role="${step.expectedRole}"]`),
        ).not.toBeNull();
      } finally {
        view.unmount();
      }
    }
  });

  it("disables non-essential motion when reduced-motion is enabled", () => {
    setReducedMotionPreference(true);
    const view = renderAiChat({
      sessionOverrides: {
        requestState: "sending",
        requestLifecycle: createLifecycle({
          transitionSequence: 8,
          lastTransitionFrom: "idle",
          lastTransitionTo: "sending",
          lastTransitionReason: "send",
        }),
      },
    });

    try {
      const animatedTurn = view.container.querySelector(".ba-chat-turn-enter");
      expect(animatedTurn).toBeNull();

      const statusRegion = view.container.querySelector(
        '[data-testid="chat-request-status"]',
      );
      expect(statusRegion).not.toBeNull();
      expect(statusRegion?.className.includes("ba-chat-status-transition")).toBe(
        false,
      );
      const sendingDots = view.container.querySelectorAll(".animate-bounce");
      expect(sendingDots.length).toBe(0);
    } finally {
      view.unmount();
    }
  });

  it("shows retry CTA for error state and replays last failed prompt", () => {
    const retryLastPrompt = vi.fn();
    const view = renderAiChat({
      sessionOverrides: {
        requestState: "error",
        draft: "Keep this enabled",
        isSending: false,
        requestLifecycle: createLifecycle({
          transitionSequence: 12,
          lastTransitionFrom: "sending",
          lastTransitionTo: "error",
          lastTransitionReason: "response-error",
          lastFailedPrompt: "Find easy GER classes",
          lastFailedPromptPayload: {
            prompt: "Find easy GER classes",
            messages: [
              { role: "user", content: "Find easy GER classes" },
            ],
          },
          lastErrorMessage: "Gateway timeout",
        }),
        retryLastPrompt,
      },
    });

    try {
      const retryButton = view.container.querySelector(
        '[data-testid="chat-request-retry"]',
      ) as HTMLButtonElement | null;
      expect(retryButton).not.toBeNull();
      expect(view.container.textContent).toContain("Gateway timeout");

      act(() => {
        retryButton?.click();
      });

      expect(retryLastPrompt).toHaveBeenCalledTimes(1);
    } finally {
      view.unmount();
    }
  });

  it("shows starter chips only for zero-turn state and sends chip prompt immediately", () => {
    const sendPrompt = vi.fn();
    const emptyView = renderAiChat({
      sessionOverrides: {
        turns: [],
        hasTurns: false,
        requestState: "idle",
        sendPrompt,
      },
    });

    try {
      const firstChip = emptyView.container.querySelector(
        '[data-testid="chat-starter-chip-ger-easy"]',
      ) as HTMLButtonElement | null;
      expect(firstChip).not.toBeNull();

      act(() => {
        firstChip?.click();
      });

      expect(sendPrompt).toHaveBeenCalledWith(
        "Find easy GER classes with lighter workload.",
      );
    } finally {
      emptyView.unmount();
    }

    const conversationView = renderAiChat({
      sessionOverrides: {
        turns: createTurns(),
        hasTurns: true,
        requestState: "error",
        requestLifecycle: createLifecycle({
          transitionSequence: 20,
          lastTransitionTo: "error",
          lastTransitionReason: "response-error",
          lastErrorMessage: "Network timeout",
          lastFailedPromptPayload: {
            prompt: "Find me easy GER options",
            messages: [{ role: "user", content: "Find me easy GER options" }],
          },
        }),
      },
    });

    try {
      expect(
        conversationView.container.querySelector(
          '[data-testid="chat-starter-chip-ger-easy"]',
        ),
      ).toBeNull();
    } finally {
      conversationView.unmount();
    }
  });

  it("exposes recommendation/status/composer controls with keyboard focus-ring affordances", () => {
    const view = renderAiChat({
      sessionOverrides: {
        turns: [
          {
            id: "turn-user-keyboard",
            role: "user",
            content: "Recommend next CS class",
          },
          createRecommendationTurn(),
        ],
        hasTurns: true,
        requestState: "error",
        draft: "Keep this enabled",
        isSending: false,
        requestLifecycle: createLifecycle({
          transitionSequence: 30,
          lastTransitionFrom: "sending",
          lastTransitionTo: "error",
          lastTransitionReason: "response-error",
          lastErrorMessage: "Timeout",
          lastFailedPromptPayload: {
            prompt: "Recommend next CS class",
            messages: [{ role: "user", content: "Recommend next CS class" }],
          },
        }),
      },
    });

    try {
      const reasonToggle = view.container.querySelector(
        '[data-testid="chat-recommendation-why-more-731"]',
      ) as HTMLButtonElement | null;
      const cautionToggle = view.container.querySelector(
        '[data-testid="chat-recommendation-cautions-731"]',
      ) as HTMLButtonElement | null;
      const detailsLink = view.container.querySelector(
        '[data-testid="chat-recommendation-detail-link-731"]',
      ) as HTMLAnchorElement | null;
      const retryButton = view.container.querySelector(
        '[data-testid="chat-request-retry"]',
      ) as HTMLButtonElement | null;
      const sendButton = view.container.querySelector(
        '[data-testid="chat-composer-send"]',
      ) as HTMLButtonElement | null;

      expect(reasonToggle?.className.includes("ba-chat-focus-ring")).toBe(true);
      expect(cautionToggle?.className.includes("ba-chat-focus-ring")).toBe(true);
      expect(detailsLink?.className.includes("ba-chat-focus-ring")).toBe(true);
      expect(retryButton?.className.includes("ba-chat-focus-ring")).toBe(true);
      expect(sendButton?.className.includes("ba-chat-focus-ring")).toBe(true);

      reasonToggle?.focus();
      expect(document.activeElement).toBe(reasonToggle);
      detailsLink?.focus();
      expect(document.activeElement).toBe(detailsLink);
      retryButton?.focus();
      expect(document.activeElement).toBe(retryButton);
      sendButton?.focus();
      expect(document.activeElement).toBe(sendButton);
    } finally {
      view.unmount();
    }
  });

  it("removes disclosure transition classes when reduced-motion is enabled", () => {
    setReducedMotionPreference(true);
    const view = renderAiChat({
      sessionOverrides: {
        turns: [
          {
            id: "turn-user-reduced-motion",
            role: "user",
            content: "Need a CS recommendation",
          },
          createRecommendationTurn(),
        ],
        hasTurns: true,
      },
    });

    try {
      const reasonToggle = view.container.querySelector(
        '[data-testid="chat-recommendation-why-more-731"]',
      ) as HTMLButtonElement | null;
      const icon = view.container.querySelector(
        '[data-testid="chat-recommendation-why-more-731-icon"]',
      );

      expect(reasonToggle).not.toBeNull();
      expect(icon?.getAttribute("class")?.includes("transition-transform")).toBe(
        false,
      );

      act(() => {
        reasonToggle?.click();
      });

      const disclosureContent = view.container.querySelector(
        '[data-testid="chat-recommendation-why-more-731-content"]',
      );
      expect(disclosureContent).not.toBeNull();
      expect(disclosureContent?.className.includes("ba-chat-disclosure-content")).toBe(
        false,
      );
    } finally {
      view.unmount();
    }
  });
});
