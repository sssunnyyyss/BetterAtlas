# Phase 3: Interaction Smoothness & Mobile Composer - Research

**Researched:** 2026-02-27  
**Domain:** Mobile keyboard-safe composer ergonomics, deterministic chat interaction flow, and recovery UX  
**Confidence:** MEDIUM-HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AIXP-01 | User can compose and submit prompts using a stable input composer that remains usable when the mobile keyboard is open. | Use a keyboard-aware layout pattern that combines existing `100dvh` shell sizing with `VisualViewport` event handling and safe-area/env padding fallbacks. |
| AIXP-02 | User experiences smooth, deterministic transitions from prompt submission to assistant response rendering. | Replace loosely coupled UI state transitions with a deterministic request lifecycle (`idle -> sending -> success/error -> idle`) and controlled feed auto-scroll behavior. |
| AIXP-03 | User can recover from failed AI requests via a visible retry path and non-destructive error feedback. | Preserve draft + conversation turns on failure, expose explicit retry CTA bound to last failed prompt payload, and surface actionable error messaging from `ApiError`. |
| AIXP-04 | User can start a conversation quickly using redesigned starter prompts/chips that seed useful first queries. | Replace static generic chips with curated starter intents and deterministic chip behaviors (seed draft vs immediate send) that remain discoverable after first failure/reset. |

</phase_requirements>

## Summary

Phase 2 established good structural primitives (`ChatShell`, `ChatFeed`, `ChatComposer`, `useChatSession`), but the interaction contract is still shallow for Phase 3 goals. The current UX has no explicit retry CTA, limited error detail, and no mobile keyboard-aware viewport handling beyond `100dvh` + safe-area bottom padding. Current auto-scroll also always uses smooth behavior and can produce jumpiness during request-state transitions.

The most important planning insight is that keyboard-safe mobile behavior cannot rely on `dvh` alone. Existing shell sizing (`min-h-[calc(100dvh-4rem)]`) is a useful baseline, but web-platform guidance and current browser behavior require combining viewport units with visual viewport observation/fallbacks for robust keyboard ergonomics.

**Primary recommendation:** Plan Phase 3 around a small interaction state model upgrade in `useChatSession` plus a dedicated viewport/composer ergonomics hook, then layer transition choreography and retry/starter UX on top.

## Current Baseline (What Planning Must Account For)

- `AiChat.tsx` is now a thin shell composition and passes a static chip list to `ChatFeed`.
- `ChatComposer.tsx` already handles auto-resize and safe-area bottom padding but has no keyboard viewport adaptation.
- `useChatSession.ts` tracks `requestState`, but only sets `error`/`success` labels; it does not retain explicit last-failed request context for one-tap retry.
- `ChatRequestStatus.tsx` displays status text, but there is no explicit retry action.
- Feed auto-scroll currently triggers on every `turns` or `requestState` change via `scrollIntoView({ behavior: "smooth" })`, which can be non-deterministic/jittery when multiple state updates happen close together.
- Existing tests (`AiChat.foundation.test.tsx`) cover structural contracts, not keyboard behavior, retry flow, or starter-chip interaction semantics.

## Standard Stack

### Core

| Library/Platform | Version | Purpose | Why Standard Here |
|------------------|---------|---------|-------------------|
| React | 18.3.1 | Component + state model | Existing frontend foundation; no migration allowed. |
| TypeScript | 5.5.x | Typed UI contracts | Already used across chat feature modules. |
| Tailwind CSS | 3.4.x | Layout/styling tokens | Existing utility + tokenized chat styling approach. |
| @tanstack/react-query | 5.56.x | AI mutation lifecycle | Existing request orchestration; exposes `status/isPending/isError` and retry controls. |
| React Router DOM | 6.26.x | `/ai` route + embedded mode | Existing route/deep-link behavior already integrated with chat. |

### Supporting Web APIs/CSS

| API/Feature | Purpose | When to Use |
|------------|---------|-------------|
| `window.visualViewport` | Detect visual viewport resize/offset changes (including OSK effects on supported browsers) | Mobile keyboard ergonomics and composer visibility logic. |
| `env(safe-area-inset-bottom)` | Protect bottom controls from notch/system UI overlap | Composer/container bottom spacing. |
| `dvh/svh/lvh` viewport units | Better baseline viewport sizing across dynamic browser chrome | Chat shell height contracts. |
| `@media (prefers-reduced-motion: reduce)` | Reduce/disable non-essential motion | Transition choreography + scroll behavior fallback. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native CSS transitions + feature hooks | Framer Motion | Adds dependency/scope for patterns already achievable with existing stack. |
| `VisualViewport`-aware handling | UA sniffing keyboard heuristics | Brittle across browsers/devices and hard to verify. |
| React Query mutation states | Custom promise/retry state machine | Reinvents capabilities already present in existing data layer. |

## Architecture Patterns

### Pattern 1: Keyboard-Safe Composer Contract

**What:** Add a dedicated hook (for example `useComposerViewport`) that computes runtime inset/height adjustments from `visualViewport` with safe fallbacks.  
**When to use:** Mobile and tablet breakpoints where on-screen keyboard can obscure bottom UI.

**Recommended design:**
- Keep Phase 2 shell structure (`header/feed/composer`) unchanged.
- Add a feed scroll container ref plus viewport metrics hook output.
- Apply computed bottom offset via CSS variable/class on chat shell/composer wrapper.
- Continue safe-area fallback (`env(safe-area-inset-bottom)`), do not remove it.
- Do not rely on `scrollend`; it has limited availability.

### Pattern 2: Deterministic Request Lifecycle

**What:** Extend session state to track request lifecycle metadata (`lastSubmittedPrompt`, `lastErrorMessage`, timestamps, request token).  
**When to use:** Every send path (`sendDraft`, chip click, deep-link prompt, retry).

**Recommended transitions:**
- `idle -> sending` when mutation starts
- `sending -> success` on response commit
- `sending -> error` with preserved prompt/draft + retry payload
- `success -> idle` after short deterministic settle window (or on next edit/send)

### Pattern 3: Controlled Auto-Scroll

**What:** Move from unconditional smooth `scrollIntoView` on every status change to intent-aware auto-scroll.  
**When to use:** New user turn, assistant response append, retry completion.

**Rules to lock in plan:**
- Auto-scroll only when user is near bottom OR when user just sent/retried.
- Use `behavior: "auto"` when reduced-motion is active; otherwise `smooth`.
- Keep the last assistant response anchor deterministic (`block: "end"`).

### Pattern 4: Non-Destructive Error + Visible Retry

**What:** Introduce explicit retry CTA adjacent to error state and retain conversation context.  
**When to use:** Any failed mutation (network/server/validation).

**Behavior contract:**
- Do not remove failed user turn.
- Keep draft text unless user explicitly clears it.
- Show actionable error string when available (`ApiError.message`), with fallback copy.
- `Retry` uses exact last failed prompt payload (or deep-link prompt) and re-enters `sending`.

### Pattern 5: Starter Prompt Interaction Model

**What:** Replace static chips with intent-seeded starters and explicit interaction semantics.  
**When to use:** Empty conversation and post-reset states (optionally also after first failure).

**Recommended chip model:**
- Structured chip data: `id`, `label`, `prompt`, optional `category`.
- Keep deterministic order (no random shuffle).
- Decide one rule and keep it consistent:
  - `click -> send immediately`, or
  - `click -> seed draft; user confirms send`.

## Don’t Hand-Roll

| Problem | Don’t Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Mutation retry semantics | Custom retry timers in components | React Query mutation options/state | Already integrated; avoids inconsistent lifecycle handling. |
| Keyboard detection by device type | User-agent/platform branching | `visualViewport` + CSS fallbacks | More robust to browser differences. |
| Global animation toggles via JS everywhere | Per-component ad hoc motion flags | Existing CSS media-query strategy + one reduced-motion utility | Keeps behavior consistent and maintainable. |
| Scroll choreography via chained `setTimeout` | Timing hacks | Measured near-bottom checks + `scrollIntoView` options | Reduces jank and race conditions. |

## Common Pitfalls

### Pitfall 1: Treating `100dvh` as Complete Keyboard Handling
- **What goes wrong:** Composer can still be obscured during keyboard open scenarios.
- **Why:** Dynamic viewport units and keyboard behavior are not uniformly equivalent across browsers/OSK behavior.
- **How to avoid:** Combine existing `dvh` shell sizing with `visualViewport`-driven adjustment + safe-area fallback.
- **Warning signs:** Input caret hidden behind keyboard; send button partially off-screen.

### Pitfall 2: Smooth-Scroll on Every State Transition
- **What goes wrong:** Feed jumps during send/success/error transitions.
- **Why:** Multiple rapid state updates trigger repeated smooth scroll.
- **How to avoid:** Gate auto-scroll by user intent/near-bottom threshold.
- **Warning signs:** Scroll position oscillates while response renders.

### Pitfall 3: Error State Without Retry Payload
- **What goes wrong:** User sees failure text but must manually reconstruct action.
- **Why:** No retained last-attempt context.
- **How to avoid:** Persist last failed prompt/request data and wire explicit retry CTA.
- **Warning signs:** Repeated failed attempts with abandoned draft/context.

### Pitfall 4: Motion Accessibility Regression
- **What goes wrong:** New transitions ignore reduced-motion preference.
- **Why:** New classes/animations bypass existing media-query guardrails.
- **How to avoid:** Define transition tokens that always provide reduced-motion fallback.
- **Warning signs:** Animated send/response transitions still run with reduced-motion enabled.

### Pitfall 5: Chip UX That Disappears After First Interaction
- **What goes wrong:** Users cannot quickly restart with guided prompts after failure/reset.
- **Why:** Chips only render in initial empty state with no re-entry path.
- **How to avoid:** Define clear chip visibility states (empty, reset, optional post-error).
- **Warning signs:** Higher friction after first failed response.

## Code Examples

### Keyboard-aware viewport hook sketch

```ts
import { useEffect, useState } from "react";

type ComposerViewport = { keyboardInset: number; viewportHeight: number | null };

export function useComposerViewport(): ComposerViewport {
  const [state, setState] = useState<ComposerViewport>({ keyboardInset: 0, viewportHeight: null });

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const keyboardInset = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
      setState({ keyboardInset, viewportHeight: vv.height });
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return state;
}
```

### Retry-oriented send contract sketch

```ts
type PendingRequest = { prompt: string; createdAt: number };

const [lastFailedRequest, setLastFailedRequest] = useState<PendingRequest | null>(null);

const sendPrompt = (prompt: string) => {
  const trimmed = prompt.trim();
  if (!trimmed) return;

  setRequestState("sending");
  aiRec.mutate(
    { messages: nextMessagesFrom(trimmed), preferences: buildPreferences() },
    {
      onSuccess: () => {
        setLastFailedRequest(null);
        setRequestState("success");
      },
      onError: (error) => {
        setLastFailedRequest({ prompt: trimmed, createdAt: Date.now() });
        setRequestState("error");
        setErrorMessage(readableApiError(error));
      },
    },
  );
};

const retryLast = () => {
  if (!lastFailedRequest) return;
  sendPrompt(lastFailedRequest.prompt);
};
```

## Planning Guardrails

- Preserve API contract compatibility for `/api/ai/course-recommendations` (UI-only phase).
- Keep `ChatShell` zone structure stable; Phase 3 should not re-open Phase 2 layout decomposition.
- Treat embedded and standalone chat as the same interaction model with container-level differences only.
- Prefer additive state/model changes inside `useChatSession` over scattering logic into multiple components.

## Testing Strategy (Plan Inputs)

### Automated Coverage to Add

- `frontend/src/pages/AiChat.interactions.test.tsx` (new): send lifecycle, retry path, chip behavior.
- Extend `frontend/src/pages/AiChat.foundation.test.tsx`: transition-state visibility and reduced-motion-aware behavior toggles.
- Add viewport mock support for `window.visualViewport` in `frontend/src/test/utils/viewport.ts` (or adjacent helper).

### Requirement -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AIXP-01 | Composer remains visible/usable with simulated keyboard viewport changes | component + viewport simulation | `pnpm --filter frontend test -- src/pages/AiChat.interactions.test.tsx` | ❌ |
| AIXP-02 | Send -> waiting -> response lifecycle is deterministic and status transitions are stable | component/unit | `pnpm --filter frontend test -- src/pages/AiChat.interactions.test.tsx` | ❌ |
| AIXP-03 | Error state keeps context and exposes visible retry action that re-sends last failed prompt | component/unit | `pnpm --filter frontend test -- src/pages/AiChat.interactions.test.tsx` | ❌ |
| AIXP-04 | Starter chips seed expected prompts and stay low-friction in empty/reset states | component/unit | `pnpm --filter frontend test -- src/pages/AiChat.interactions.test.tsx` | ❌ |

### Manual QA Required

- iOS Safari and Android Chrome keyboard-open composer checks (real device preferred).
- `/ai` route and `/catalog` embedded mode at:
  - `390x844`
  - `768x1024`
  - `1280x800`
- Reduced-motion enabled OS setting: verify non-essential motion is reduced.

## Open Questions for Planning

1. Retry semantics: should retry re-send the exact last prompt only, or include edited draft if user changed text after failure?
2. Starter chip interaction: should chip click auto-submit or only prefill draft for confirmation?
3. Success-state behavior: should success status auto-dismiss after N ms or persist until next action?
4. Mobile ergonomics scope: should keyboard-specific adjustments apply only under `sm` breakpoint or all touch-sized layouts?

## Sources

### Primary (HIGH confidence)
- `/mnt/Apps/BetterAtlas/frontend/src/pages/AiChat.tsx`
- `/mnt/Apps/BetterAtlas/frontend/src/features/ai-chat/hooks/useChatSession.ts`
- `/mnt/Apps/BetterAtlas/frontend/src/features/ai-chat/components/ChatComposer.tsx`
- `/mnt/Apps/BetterAtlas/frontend/src/features/ai-chat/components/ChatFeed.tsx`
- `/mnt/Apps/BetterAtlas/frontend/src/features/ai-chat/components/ChatRequestStatus.tsx`
- `/mnt/Apps/BetterAtlas/frontend/src/pages/AiChat.foundation.test.tsx`
- `/mnt/Apps/BetterAtlas/frontend/src/index.css`
- `/mnt/Apps/BetterAtlas/frontend/src/api/client.ts`
- `/mnt/Apps/BetterAtlas/frontend/package.json`
- `/mnt/Apps/BetterAtlas/.planning/REQUIREMENTS.md`
- `/mnt/Apps/BetterAtlas/.planning/STATE.md`
- `/mnt/Apps/BetterAtlas/.planning/ROADMAP.md`

### Secondary (MEDIUM confidence, official docs)
- MDN VisualViewport: https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport
- MDN `env()` CSS function: https://developer.mozilla.org/en-US/docs/Web/CSS/env
- MDN `prefers-reduced-motion`: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
- MDN `scrollIntoView`: https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView
- web.dev viewport units (`svh/lvh/dvh`) caveats: https://web.dev/blog/viewport-units
- TanStack Query `useMutation` reference: https://tanstack.com/query/latest/docs/framework/react/reference/useMutation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH (verified in repo manifests and code usage)
- Architecture patterns: MEDIUM-HIGH (verified against current implementation and official platform guidance)
- Pitfalls: MEDIUM (browser/device variation around mobile keyboards still requires manual validation)

**Research date:** 2026-02-27  
**Valid until:** 2026-03-29
