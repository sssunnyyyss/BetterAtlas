# Phase 2: Chat UI Foundation - Research

**Researched:** 2026-02-27
**Domain:** AI chat information architecture, message/state presentation, and responsive layout foundation
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AIUI-01 | User can immediately identify the AI chat page's primary zones (context/header, conversation feed, composer) without ambiguity. | Introduce explicit shell layout primitives (`ChatHeader`, `ChatFeed`, `ChatComposer`) with stable spacing, sticky/fixed behavior rules, and consistent visual boundaries. |
| AIUI-02 | User can clearly distinguish user messages from assistant messages through consistent visual hierarchy. | Normalize message model + shared bubble components with role-driven styling tokens, avatar/label treatment, and card grouping rules. |
| AIUI-03 | User can see explicit status feedback for waiting, success, and failure states during AI interactions. | Add request-state model (`idle/sending/success/error`) and dedicated status UI region (inline status row + error panel) instead of ad-hoc booleans. |
| AIUI-04 | User can use the redesigned AI chat layout across mobile and desktop breakpoints without clipping/overlap. | Rework route/container height strategy for app shell (`Navbar` + `Footer`), define breakpoint layout rules, and validate overlap matrix for `/ai` and embedded catalog mode. |
</phase_requirements>

## Summary

Phase 2 should focus on converting `frontend/src/pages/AiChat.tsx` from a monolithic screen into explicit layout and state primitives. The existing page is functional but currently mixes API orchestration, layout, and rendering logic in one component, which makes visual hierarchy and state communication harder to keep consistent.

The largest planning risk is layout behavior in the app shell. `/ai` currently uses `h-[calc(100vh-4rem)]` while the global app still renders `Navbar` and `Footer`; this can cause clipping/extra scroll on smaller screens and creates fragile behavior when combined with mobile keyboard changes and embedded mode in `Catalog`. The second risk is state clarity: pending/error are represented (`aiRec.isPending`, `showError`) but success is implicit and not modeled as a first-class UI state.

**Primary recommendation:** Plan Phase 2 as a structural refactor with a small internal chat state model first, then apply visual hierarchy and responsive rules on top of that structure.

## Current Baseline (What Planning Must Account For)

- `AiChat.tsx` currently owns all concerns: mutation calls, local conversation history, typing indicator, error bubble, recommendation rendering, and composer behavior.
- Message list uses role-based conditional rendering but does not use stable message ids (array index key), and status handling is not represented per request/message lifecycle.
- Global CSS applies `textarea { min-height: 7rem; resize: vertical; }`, which can conflict with chat composer ergonomics and responsive balance.
- `/ai` route is rendered inside the shared app shell (`Navbar` + `Footer`), while catalog AI mode uses `<AiChat embedded />` in a different height container (`h-[calc(100vh-9rem)]`).
- Existing test infrastructure is Vitest + jsdom with minimal UI coverage for AI chat; there is no current `AiChat` test suite.

## Dependencies

### Technical Dependencies
- Existing frontend stack: React 18, TypeScript, Tailwind, React Query, React Router.
- Existing API contract: `POST /api/ai/course-recommendations` in `api/src/routes/ai.ts` and `useAiCourseRecommendations` in `frontend/src/hooks/useAi.ts`.
- App shell constraints from `frontend/src/App.tsx`, `frontend/src/components/layout/Navbar.tsx`, `frontend/src/components/layout/Footer.tsx`.
- Embedded AI mode in `frontend/src/pages/Catalog.tsx`.

### Product/Scope Dependencies
- Must preserve current recommendation behavior and request/response shape (UI redesign milestone, not backend behavior change).
- Must enable Phase 3 work (interaction smoothness, retry UX, mobile keyboard hardening) without re-breaking foundation components.

## Architecture/Component Decomposition Recommendations

### Recommended Project Structure

```text
frontend/src/pages/
  AiChat.tsx                       # thin page wrapper + route-level props

frontend/src/features/ai-chat/
  components/
    ChatShell.tsx                  # header/feed/composer zones
    ChatHeader.tsx
    ChatFeed.tsx
    ChatMessageBubble.tsx
    ChatAssistantBlock.tsx         # assistant text + cards + follow-up grouping
    ChatRequestStatus.tsx          # waiting/success/error surface
    ChatComposer.tsx
  hooks/
    useChatSession.ts              # orchestrates local UI state around mutation
  model/
    chatTypes.ts                   # message + request-state types
  styles/
    chatTokens.ts                  # role/status style tokens (optional)
```

### State Model Recommendation

Use explicit UI state instead of separate booleans:

```ts
type ChatRequestState = "idle" | "sending" | "success" | "error";

type ChatTurn = {
  id: string;
  role: "user" | "assistant";
  content: string;
  recommendations?: AiCourseRecommendation[];
  followUp?: string | null;
};
```

Planning outcome: every send flow must drive a deterministic state transition (`idle -> sending -> success|error`), and status UI must be derived from this model.

### Zone Hierarchy Recommendation (AIUI-01)
- `ChatHeader`: always visible context zone (`shrink-0`, explicit border/background).
- `ChatFeed`: dedicated scroll container (`min-h-0 flex-1 overflow-y-auto`) so message scrolling never pushes composer off-screen.
- `ChatComposer`: fixed zone at bottom of chat shell with separate surface treatment and safe padding.

### Message Hierarchy Recommendation (AIUI-02)
- Single `ChatMessageBubble` API with `role` variants; avoid duplicated markup blocks.
- Assistant text + recommendation cards + follow-up should render as one grouped assistant block to preserve visual ownership.
- Add consistent metadata affordance (at least role cue icon/label) to reduce ambiguity for first-time users.

### Status Presentation Recommendation (AIUI-03)
- `sending`: inline pending row near latest turn plus disabled send affordance.
- `success`: transient success acknowledgment (lightweight, non-blocking), not only inferred by assistant bubble arrival.
- `error`: persistent error state region with clear text (retry action can remain Phase 3, but failure must be explicit now).

### Responsive Layout Recommendation (AIUI-04)
- Replace fragile fixed `calc(100vh-...)` assumptions with shell-aware container sizing strategy used consistently across `/ai` and embedded mode.
- Define explicit breakpoint contracts (`<640`, `640-1023`, `>=1024`) for max widths, bubble widths, and card grid columns.
- Ensure mobile composer has no overlap with floating/fixed UI elements (including catalog mobile filter FAB when embedded).

## Implementation Risks

### High Risk
1. App-shell height math conflict causes clipping/overlap.
- Why: `/ai` container height and persistent footer/nav compete for viewport space.
- Mitigation: establish one canonical chat shell sizing contract and validate with footer present.

2. Foundation refactor can regress API interaction flow.
- Why: logic currently intertwined in `AiChat.tsx`; splitting components can break message ordering or reset behavior.
- Mitigation: move interaction logic into `useChatSession` first, then refactor rendering.

### Medium Risk
1. Global `textarea` base styles may override composer intent.
- Why: global `min-height: 7rem` and `resize: vertical` apply to all textareas.
- Mitigation: isolate composer textarea class with explicit `min-h-0`/size override and disable manual resize in chat composer.

2. Embedded mode divergence from route mode.
- Why: `embedded` variant has different parent height assumptions.
- Mitigation: same layout primitives with a small container strategy switch (`standalone` vs `embedded`) only at shell level.

3. Status semantics drift between UI and mutation flags.
- Why: React Query mutation flags are request-level and do not encode full UX lifecycle.
- Mitigation: maintain local `ChatRequestState` as the UI contract; map mutation callbacks into it.

## Testing Strategy

### Automated
- Add a focused `AiChat.foundation.test.tsx` suite for structure and state behavior.
- Mock `useAiCourseRecommendations` to simulate `pending/success/error` deterministically.
- Assert zone presence and ordering (header/feed/composer), role-specific message rendering, and status visibility changes.
- Add responsive behavior unit checks by stubbing `window.innerWidth` and rerendering for mobile/desktop variants.

### Manual QA (Required for layout clipping/overlap confidence)
- Validate `/ai` and embedded catalog AI mode on representative sizes:
  - 390x844 (mobile portrait)
  - 768x1024 (tablet)
  - 1280x800 (desktop)
- Confirm no overlap with nav/footer/floating controls, and no clipped composer/feed surfaces.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.x + jsdom |
| Config file | `frontend/vitest.config.ts` |
| Quick run command | `pnpm --filter frontend test -- AiChat.foundation` |
| Full suite command | `pnpm --filter frontend test` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AIUI-01 | Header/feed/composer zones render with stable hierarchy and remain identifiable after first message | unit/component | `pnpm --filter frontend test -- AiChat.foundation` | ❌ (create in Phase 2) |
| AIUI-02 | User vs assistant messages render with distinct role classes/structure consistently | unit/component | `pnpm --filter frontend test -- AiChat.foundation` | ❌ |
| AIUI-03 | Sending/success/error statuses are explicit and transition correctly | unit/component | `pnpm --filter frontend test -- AiChat.foundation` | ❌ |
| AIUI-04 | Layout contract holds for mobile and desktop variants without component overlap assumptions | unit + manual viewport QA | `pnpm --filter frontend test -- AiChat.foundation` | ❌ + manual checklist needed |

### Wave 0 Gaps
- Missing AI chat test file for structural and state assertions.
- No reusable test helpers for viewport breakpoint simulation in frontend tests.
- No existing manual QA checklist artifact for chat layout overlap across route and embedded mode.

## Plan Boundaries

### In Scope for Phase 2
- Chat UI foundation refactor into layout/message/composer primitives.
- Explicit visual hierarchy and explicit waiting/success/error state presentation.
- Responsive structural fixes to avoid overlap/clipping in primary breakpoints.
- Minimal styling/token updates required to support hierarchy clarity.

### Out of Scope for Phase 2
- Streaming responses / transport changes.
- Deep interaction choreography and retry flow UX depth (Phase 3).
- Full recommendation card information redesign and accessibility/performance hardening (Phase 4).
- AI ranking/model behavior changes.

## Recommended Plan Decomposition (for 02-01 / 02-02 / 02-03)

1. 02-01 (Structure)
- Extract `useChatSession` + typed chat state model.
- Split `AiChat` into shell/header/feed/composer primitives with no visual redesign yet.

2. 02-02 (Hierarchy + States)
- Apply role/status visual system and explicit pending/success/error surfaces.
- Normalize assistant block grouping and consistent message styling.

3. 02-03 (Responsive Validation)
- Resolve shell height/overflow issues for route and embedded mode.
- Add tests + manual breakpoint checklist execution; fix overlap/clipping defects.

## Sources

### Primary (HIGH confidence)
- `frontend/src/pages/AiChat.tsx`
- `frontend/src/hooks/useAi.ts`
- `frontend/src/App.tsx`
- `frontend/src/pages/Catalog.tsx`
- `frontend/src/components/layout/Navbar.tsx`
- `frontend/src/components/layout/Footer.tsx`
- `frontend/src/index.css`
- `frontend/package.json`
- `frontend/vitest.config.ts`
- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- `.planning/ROADMAP.md`
- `.planning/PROJECT.md`

## Metadata

**Confidence breakdown:**
- Dependencies: HIGH (verified directly from source files/config).
- Architecture decomposition: HIGH (directly derived from current code coupling and roadmap plan structure).
- Responsive/layout risk assessment: MEDIUM-HIGH (code evidence is strong; final overlap confirmation needs browser QA).

**Research date:** 2026-02-27
**Valid until:** 2026-03-29
