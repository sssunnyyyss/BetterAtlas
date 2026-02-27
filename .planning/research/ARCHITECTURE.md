# Architecture Research

**Domain:** Frontend interaction architecture for AI chat redesign
**Researched:** 2026-02-27
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Route Layer (`/ai`)                    │
├─────────────────────────────────────────────────────────────┤
│  ┌────────────────┐  ┌────────────────┐  ┌───────────────┐ │
│  │ Header/Intro   │  │ Message List   │  │ Composer      │ │
│  └───────┬────────┘  └───────┬────────┘  └──────┬────────┘ │
│          │                   │                   │          │
├──────────┴───────────────────┴───────────────────┴──────────┤
│                  Interaction/State Layer                     │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Local UI state + React Query mutation + URL prompt   │  │
│  └───────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                         Data/API Layer                      │
│  ┌──────────────────────┐  ┌─────────────────────────────┐ │
│  │ /api/ai/recommend... │  │ Local preference snapshot   │ │
│  └──────────────────────┘  └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `AiChat` route shell | Layout orchestration and page-level states | Route component with responsive wrappers |
| Message renderer | Distinct rendering of user/assistant/error/loading rows | Presentational components with clear variants |
| Recommendation card | Course recommendation display and action affordances | Reusable card component with constrained metadata |
| Composer | Input, submit, keyboard behavior, disabled/loading control | Controlled textarea + submit actions |

## Recommended Project Structure

```
frontend/src/
├── pages/
│   └── AiChat.tsx                  # Route shell and orchestration
├── components/ai/
│   ├── AiChatShell.tsx             # Top-level chat layout blocks
│   ├── AiMessageList.tsx           # Message stream renderer
│   ├── AiMessageBubble.tsx         # User/assistant bubble variants
│   ├── AiRecommendationCard.tsx    # Polished recommendation card
│   └── AiComposer.tsx              # Input and send interactions
├── hooks/
│   └── useAi.ts                    # API interactions (existing)
└── styles/
    └── ai-chat.css (optional)      # Scoped animation/util polish
```

### Structure Rationale

- **`components/ai/`:** isolates redesign-specific UI from page orchestration.
- **Route shell + focused subcomponents:** enables progressive polish without large fragile rewrites.

## Architectural Patterns

### Pattern 1: State-Explicit UI

**What:** Every network transition has a dedicated visual state.
**When to use:** Any async chat request boundary.
**Trade-offs:** Slightly more UI branches, much clearer user feedback.

### Pattern 2: Progressive Disclosure Cards

**What:** Show key decision info first, expand details second.
**When to use:** Recommendation-rich outputs on small screens.
**Trade-offs:** Requires thoughtful information hierarchy design.

### Pattern 3: Motion-As-Feedback

**What:** Use subtle transitions to communicate causality/order.
**When to use:** Message insertion, loading completion, card appearance.
**Trade-offs:** Must be reduced-motion aware and performance-tuned.

## Data Flow

### Request Flow

```
[User enters prompt]
    ↓
[AiComposer submit] → [useAiCourseRecommendations mutation] → [/api/ai/course-recommendations]
    ↓                                                      ↓
[Pending state shown] ← [response parsed] ← [assistant message + cards]
```

### State Management

```
[Route-local chat state]
    ↓
[Message list renderer] ←→ [composer actions] → [mutation callbacks]
```

### Key Data Flows

1. **Prompt deep-link flow:** query param prompt seeds first user message.
2. **Recommendation rendering flow:** API recommendations map to standardized cards.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current beta usage | Route-local state is sufficient |
| Higher engagement | Split heavy card components and memoize expensive list rows |
| Large-scale usage | Consider virtualization only if message history becomes long |

### Scaling Priorities

1. **First bottleneck:** unnecessary re-renders on message updates.
2. **Second bottleneck:** oversized card content on mobile layouts.

## Anti-Patterns

### Anti-Pattern 1: One giant route component

**What people do:** Keep all layout/state/rendering logic in a single `AiChat.tsx` file.
**Why it's wrong:** Hard to maintain polish without regressions.
**Do this instead:** Split into shell/list/bubble/card/composer components.

### Anti-Pattern 2: Animation-first before state clarity

**What people do:** Add motion without explicit loading/error boundaries.
**Why it's wrong:** Creates flashy but confusing UX.
**Do this instead:** Make states deterministic, then layer subtle motion.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| AI recommendations API | Existing mutation call contract | Keep request/response compatibility |
| Browser localStorage | Preference persistence | Validate shape and fail safely |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `AiChat` route ↔ `useAi` | Hook contract | Preserve mutation API and error semantics |
| message list ↔ cards | props composition | Avoid coupling cards to route logic |

## Sources

- BetterAtlas current AI chat implementation
- Existing frontend architecture and route conventions

---
*Architecture research for: AI chat frontend redesign*
*Researched: 2026-02-27*
