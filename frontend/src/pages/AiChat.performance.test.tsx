import type { MutableRefObject } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatFeed } from "../features/ai-chat/components/ChatFeed.js";
import type {
  ChatRequestLifecycle,
  ChatRequestState,
  ChatTurn,
} from "../features/ai-chat/model/chatTypes.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let assistantRenderCount = 0;
let scrollIntoViewMock: ReturnType<typeof vi.fn> | null = null;
const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

vi.mock("../features/ai-chat/components/ChatAssistantBlock.js", () => ({
  ChatAssistantBlock: ({
    content,
  }: {
    content: string;
    prefersReducedMotion: boolean;
  }) => {
    assistantRenderCount += 1;
    return <div data-testid="mock-assistant-block">{content}</div>;
  },
}));

function createLifecycle(
  requestState: ChatRequestState,
  sequence: number,
): ChatRequestLifecycle {
  const now = Date.now();
  return {
    requestToken: 0,
    transitionSequence: sequence,
    lastTransitionAt: now,
    lastTransitionFrom: "idle",
    lastTransitionTo: requestState,
    lastTransitionReason: "send",
    settleDelayMs: 1200,
    settleDeadlineAt: null,
    lastSubmittedPrompt: null,
    lastFailedPrompt: null,
    lastFailedPromptPayload: null,
    lastErrorMessage: null,
  };
}

function createTurns(count: number): ChatTurn[] {
  const turns: ChatTurn[] = [];
  for (let i = 0; i < count; i += 1) {
    turns.push({
      id: `assistant-${i}`,
      role: "assistant",
      content: `Recommendation batch ${i + 1}`,
      recommendations: [
        {
          course: {
            id: 700 + i,
            code: `CS ${170 + i}`,
            title: `Course ${i + 1}`,
            description: "Mock course",
            credits: 4,
            departmentId: 1,
            attributes: null,
            department: null,
            avgQuality: 4,
            avgDifficulty: 3,
            avgWorkload: 3,
            reviewCount: 50,
            classScore: 4,
          },
          fitScore: 8,
          why: ["Reason A", "Reason B", "Reason C"],
          cautions: ["Caution A"],
        },
      ],
      followUp: null,
    });
  }
  return turns;
}

function renderFeed({
  turns,
  requestState,
  requestLifecycle,
}: {
  turns: ChatTurn[];
  requestState: ChatRequestState;
  requestLifecycle: ChatRequestLifecycle;
}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  const endRef = { current: document.createElement("div") } as MutableRefObject<HTMLDivElement | null>;

  const render = (next: {
    turns: ChatTurn[];
    requestState: ChatRequestState;
    requestLifecycle: ChatRequestLifecycle;
  }) => {
    act(() => {
      root.render(
        <ChatFeed
          turns={next.turns}
          requestState={next.requestState}
          requestLifecycle={next.requestLifecycle}
          prefersReducedMotion={false}
          suggestionChips={[]}
          onSuggestionSelect={vi.fn()}
          onRetry={vi.fn()}
          endRef={endRef}
        />,
      );
    });
  };

  render({ turns, requestState, requestLifecycle });

  return {
    rerender: render,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe("AiChat performance", () => {
  beforeEach(() => {
    assistantRenderCount = 0;
    scrollIntoViewMock = vi.fn();
    (HTMLElement.prototype as { scrollIntoView?: (options?: unknown) => void }).scrollIntoView =
      scrollIntoViewMock;
  });

  afterEach(() => {
    document.body.innerHTML = "";
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    vi.clearAllMocks();
  });

  it("avoids recommendation-block rerenders across request-state-only transitions", () => {
    const turns = createTurns(1);
    const view = renderFeed({
      turns,
      requestState: "idle",
      requestLifecycle: createLifecycle("idle", 1),
    });

    try {
      expect(assistantRenderCount).toBe(1);

      view.rerender({
        turns,
        requestState: "sending",
        requestLifecycle: createLifecycle("sending", 2),
      });
      view.rerender({
        turns,
        requestState: "success",
        requestLifecycle: createLifecycle("success", 3),
      });
      view.rerender({
        turns,
        requestState: "error",
        requestLifecycle: createLifecycle("error", 4),
      });

      expect(assistantRenderCount).toBe(1);
    } finally {
      view.unmount();
    }
  });

  it("recomputes assistant block rendering when recommendation turns actually change", () => {
    const initialTurns = createTurns(1);
    const view = renderFeed({
      turns: initialTurns,
      requestState: "idle",
      requestLifecycle: createLifecycle("idle", 1),
    });

    try {
      expect(assistantRenderCount).toBe(1);

      const nextTurns = [
        ...initialTurns,
        ...createTurns(1).map((turn) => ({ ...turn, id: `${turn.id}-new` })),
      ];
      view.rerender({
        turns: nextTurns,
        requestState: "idle",
        requestLifecycle: createLifecycle("idle", 2),
      });

      expect(assistantRenderCount).toBe(3);
    } finally {
      view.unmount();
    }
  });
});
