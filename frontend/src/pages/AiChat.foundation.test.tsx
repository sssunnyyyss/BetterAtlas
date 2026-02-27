import type { MutableRefObject } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatSessionApi } from "../features/ai-chat/hooks/useChatSession.js";
import type { ChatRequestState, ChatTurn } from "../features/ai-chat/model/chatTypes.js";
import { setViewportSize } from "../test/utils/viewport.js";
import AiChat from "./AiChat.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const hooks = vi.hoisted(() => ({
  useChatSession: vi.fn(),
}));

vi.mock("../features/ai-chat/hooks/useChatSession.js", () => ({
  useChatSession: hooks.useChatSession,
}));

const STATUS_LABELS = {
  sending: "Atlas AI is thinking...",
  success: "Response received.",
  error: "Something went wrong. Please try again.",
} as const;

function createTurns(): ChatTurn[] {
  return [
    {
      id: "turn-user",
      role: "user",
      content: "I need easy GER options",
    },
    {
      id: "turn-assistant",
      role: "assistant",
      content: "Try these low-workload classes.",
      recommendations: [],
      followUp: null,
    },
  ];
}

function buildSession(overrides: Partial<ChatSessionApi> = {}): ChatSessionApi {
  const turns = overrides.turns ?? [];
  const requestState = overrides.requestState ?? "idle";

  return {
    turns,
    draft: overrides.draft ?? "",
    requestState,
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

function expectStatusText(container: HTMLElement, label: string) {
  expect(container.textContent?.includes(label)).toBe(true);
}

describe("AiChat foundation", () => {
  beforeEach(() => {
    hooks.useChatSession.mockReset();
    setViewportSize(1024, 768);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("renders header/feed/composer zones in the expected hierarchy", () => {
    const view = renderAiChat();
    try {
      const shell = view.container.querySelector('[data-testid="chat-shell-standalone"]');
      expect(shell).not.toBeNull();

      const zoneOrder = Array.from(shell?.children ?? []).map((element) =>
        element.getAttribute("data-testid"),
      );
      expect(zoneOrder).toEqual([
        "chat-zone-header",
        "chat-zone-feed",
        "chat-zone-composer",
      ]);

      const feedZone = view.container.querySelector('[data-testid="chat-zone-feed"]');
      expect(feedZone).toHaveClass("min-h-0", "flex-1");
    } finally {
      view.unmount();
    }
  });

  it("renders user and assistant turns with distinct visual-role alignment", () => {
    const view = renderAiChat({
      sessionOverrides: {
        turns: createTurns(),
        requestState: "success",
      },
    });

    try {
      const userText = view.container.querySelector("p.whitespace-pre-wrap.text-sm");
      expect(userText?.textContent).toContain("I need easy GER options");

      const assistantText = Array.from(
        view.container.querySelectorAll("p.whitespace-pre-wrap.text-sm"),
      ).find((node) => node.textContent?.includes("Try these low-workload classes."));
      expect(assistantText).not.toBeNull();

      const userRow = userText?.closest('div[class*="justify-end"]');
      const assistantRow = assistantText?.closest('div[class*="justify-start"]');
      expect(userRow).not.toBeNull();
      expect(assistantRow).not.toBeNull();
      expect(view.container.textContent?.includes("You")).toBe(true);
      expect(view.container.textContent?.includes("Atlas AI")).toBe(true);
    } finally {
      view.unmount();
    }
  });

  it("shows explicit sending, success, and error request-state visibility", () => {
    const states: Array<{
      requestState: ChatRequestState;
      role: "status" | "alert" | null;
      label: string | null;
    }> = [
      { requestState: "idle", role: null, label: null },
      { requestState: "sending", role: "status", label: STATUS_LABELS.sending },
      { requestState: "success", role: "status", label: STATUS_LABELS.success },
      { requestState: "error", role: "alert", label: STATUS_LABELS.error },
    ];

    for (const state of states) {
      const view = renderAiChat({
        sessionOverrides: {
          turns: createTurns(),
          requestState: state.requestState,
        },
      });

      try {
        if (state.role === null || state.label === null) {
          expect(view.container.textContent?.includes(STATUS_LABELS.sending)).toBe(false);
          expect(view.container.textContent?.includes(STATUS_LABELS.success)).toBe(false);
          expect(view.container.textContent?.includes(STATUS_LABELS.error)).toBe(false);
        } else {
          const statusRegion = view.container.querySelector(`[role="${state.role}"]`);
          expect(statusRegion).not.toBeNull();
          expectStatusText(view.container, state.label);
        }
      } finally {
        view.unmount();
      }
    }
  });

  it("keeps responsive layout contracts at mobile, tablet, and desktop breakpoints", () => {
    setViewportSize(390, 844);
    const mobileStandalone = renderAiChat();
    try {
      const standaloneContainer = mobileStandalone.container.querySelector(
        'div[class*="min-h-[calc(100dvh-4rem)]"]',
      );
      expect(standaloneContainer).not.toBeNull();
      expect(
        mobileStandalone.container.querySelector('[data-testid="chat-shell-standalone"]'),
      ).not.toBeNull();
    } finally {
      mobileStandalone.unmount();
    }

    setViewportSize(768, 1024);
    const tabletEmbedded = renderAiChat({ embedded: true });
    try {
      const embeddedShell = tabletEmbedded.container.querySelector(
        '[data-testid="chat-shell-embedded"]',
      );
      expect(embeddedShell).toHaveClass("h-full", "min-h-0");
      const feedZone = tabletEmbedded.container.querySelector('[data-testid="chat-zone-feed"]');
      expect(feedZone).toHaveClass("min-h-0", "flex-1");
    } finally {
      tabletEmbedded.unmount();
    }

    setViewportSize(1280, 800);
    const desktopStandalone = renderAiChat();
    try {
      const standaloneShell = desktopStandalone.container.querySelector(
        '[data-testid="chat-shell-standalone"]',
      );
      expect(standaloneShell).toHaveClass("max-w-3xl");
      expect(desktopStandalone.container.textContent?.includes("Atlas AI")).toBe(true);
    } finally {
      desktopStandalone.unmount();
    }
  });
});
