import type { MutableRefObject } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatSessionApi } from "../features/ai-chat/hooks/useChatSession.js";
import type { ChatTurn } from "../features/ai-chat/model/chatTypes.js";
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

function buildSession(overrides: Partial<ChatSessionApi> = {}): ChatSessionApi {
  const turns = overrides.turns ?? createTurns();
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
});
