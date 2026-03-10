# Phase 4: Recommendation Cards & Quality Hardening - Research

**Researched:** 2026-03-02  
**Domain:** Recommendation-card information hierarchy, progressive disclosure, accessibility, and interaction performance hardening for AI chat  
**Confidence:** MEDIUM-HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AIRC-01 | User can scan course code, title, and fit score at a glance from each recommendation card. | Promote code/title/fit score into a fixed top row with strong visual hierarchy, consistent spacing, and explicit `Fit` labeling (not score-only chip). |
| AIRC-02 | User can understand recommendation rationale from concise, readable explanation bullets. | Keep rationale bullets short (1-3 primary reasons visible first) and defer overflow reasons behind a disclosure control. |
| AIRC-03 | User can navigate from a recommendation card to the course detail page through a clear primary action. | Use a dedicated primary CTA (`View course details`) with explicit affordance and keyboard-visible focus treatment; keep full-card link behavior optional but not ambiguous. |
| AIRC-04 | User can view caution/constraint context without overwhelming the primary recommendation hierarchy. | Render cautions as a secondary section using progressive disclosure (`Show cautions`) with count badge and concise risk text. |
| AIQ-01 | User with reduced-motion preferences receives an equivalent experience without disruptive animation. | Keep reduced-motion as first-class behavior for card/status/feed transitions; no essential information should require animation to notice. |
| AIQ-02 | User can operate the redesigned chat interface with keyboard navigation and visible focus states. | Enforce keyboard order + visible focus rings for chips, cards, disclosure toggles, retry button, and primary CTA links. |
| AIQ-03 | User perceives responsive interactions on representative mobile devices during chat usage. | Reduce rerender pressure and expensive card recomputation in long threads by memoizing card blocks and stabilizing callback/object props. |

</phase_requirements>

## Summary

Phase 3 introduced deterministic request state and mobile-composer ergonomics, but recommendation cards still compress too much information into a single linked surface. The current card does not clearly separate key scan data (code/title/fit), rationale, and cautions; it also lacks an explicit primary action. This is the core gap for AIRC-01..04.

The best planning approach is to split Phase 4 into three steps:
1. Ship a new recommendation card system with progressive disclosure and explicit primary action.
2. Run a focused accessibility hardening pass on keyboard/focus/reduced-motion behavior across chat surfaces.
3. Complete performance/polish hardening to keep interactions responsive on mobile under realistic turn volume.

## Current Baseline (What Planning Must Account For)

- `ChatAssistantBlock.tsx` currently renders each recommendation as one `Link` card with truncated rationale and no caution rendering.
- `AiCourseRecommendation` already includes `cautions: string[]` in `useAi.ts`, so phase work is UI-first and does not need API schema changes.
- `ChatFeed.tsx` already has intent-aware auto-scroll and reduced-motion handling from Phase 3; Phase 4 should preserve that behavior.
- Existing tests (`AiChat.foundation.test.tsx`, `AiChat.interactions.test.tsx`) do not deeply validate recommendation-card hierarchy, caution disclosure, or keyboard/focus traversal for card actions.

## Recommended Architecture Patterns

### Pattern 1: Card Surface Decomposition

**What:** Split recommendation rendering into explicit sub-areas: summary row, rationale preview, caution disclosure, and action row.  
**Why:** Enforces scan-first behavior and prevents caution details from dominating card hierarchy.

**Recommended structure:**
- Summary row: `course.code`, `course.title`, and labeled fit indicator (`Fit 8/10`).
- Rationale block: top 2-3 bullets always visible with optional overflow disclosure.
- Cautions block: collapsed by default when cautions exist; opened via explicit toggle.
- Action row: primary link button to `/catalog/:id` with deterministic label.

### Pattern 2: Progressive Disclosure With Accessible Controls

**What:** Use semantic `button` controls with `aria-expanded`/`aria-controls` for rationale/caution expansion.  
**Why:** Keeps default card density low while preserving full context for users who need detail.

### Pattern 3: Keyboard and Focus Contract

**What:** Add consistent focus-visible rings and predictable tab order for all interactive elements in chat cards/status controls.  
**Why:** AIQ-02 requires complete keyboard operation and visible focus feedback.

### Pattern 4: Lightweight Performance Hardening

**What:** Memoize expensive recommendation subtrees and stabilize per-card handlers/props in feed rendering paths.  
**Why:** Large assistant turns can trigger avoidable rerenders on each request-state update, degrading mobile responsiveness.

## Pitfalls To Avoid

### Pitfall 1: Ambiguous Card Click Behavior
- **Issue:** Entire-card link plus nested interactive controls can produce invalid nesting or confusing focus behavior.
- **Avoidance:** Use non-link card container with a dedicated primary action link/button; keep other controls as sibling elements.

### Pitfall 2: Overloading Primary Hierarchy With Cautions
- **Issue:** Showing all cautions by default reduces scan speed and hides key data.
- **Avoidance:** Collapse cautions by default and show count-based disclosure (`Show cautions (2)`).

### Pitfall 3: Accessibility Regressions From New Motion/Transitions
- **Issue:** New disclosure/card transitions can ignore reduced-motion preferences.
- **Avoidance:** Pair every animation/transition with reduced-motion fallback in `index.css` and component class logic.

### Pitfall 4: Performance Regression Through Repeated List Work
- **Issue:** Recomputing card-derived metadata on every feed state update creates noticeable lag on mobile.
- **Avoidance:** Use `React.memo`, `useMemo`, and stable callbacks for recommendation cards and disclosure state management.

## Testing Strategy (Plan Inputs)

### Automated Coverage To Add/Extend

- New component-level coverage for recommendation-card hierarchy, disclosures, and primary CTA.
- Extend `AiChat.interactions` for keyboard/focus and reduced-motion behavior around new card controls.
- Add lightweight performance regression checks (render-count or rerender-bounding assertions) for recommendation-heavy turns.

### Requirement -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AIRC-01 | Card summary row exposes code/title/fit for rapid scan | component | `pnpm --filter frontend test -- src/features/ai-chat/components/ChatAssistantBlock.test.tsx` | ❌ |
| AIRC-02 | Rationale bullets are concise with overflow disclosure | component | `pnpm --filter frontend test -- src/features/ai-chat/components/ChatAssistantBlock.test.tsx` | ❌ |
| AIRC-03 | Primary CTA navigates to course detail reliably | component/integration | `pnpm --filter frontend test -- src/features/ai-chat/components/ChatAssistantBlock.test.tsx` | ❌ |
| AIRC-04 | Cautions are available via progressive disclosure | component | `pnpm --filter frontend test -- src/features/ai-chat/components/ChatAssistantBlock.test.tsx` | ❌ |
| AIQ-01 | Reduced-motion behavior disables non-essential chat/card motion | interaction | `pnpm --filter frontend test -- src/pages/AiChat.interactions.test.tsx` | ✅ |
| AIQ-02 | Keyboard nav + focus-visible states cover card/status controls | interaction | `pnpm --filter frontend test -- src/pages/AiChat.interactions.test.tsx` | ✅ |
| AIQ-03 | Recommendation-heavy turns avoid unnecessary rerenders on mobile-like viewport | interaction/perf | `pnpm --filter frontend test -- src/pages/AiChat.performance.test.tsx` | ❌ |

## Manual QA Required

- Verify recommendation card scan speed at `390x844` and `768x1024` (code/title/fit identifiable within one glance).
- With keyboard-only input, tab through starter chips -> card disclosures -> primary CTA -> retry button and confirm visible focus at each stop.
- With OS/browser reduced-motion enabled, confirm no disruptive transition animations for card reveal/status transitions.
- On representative mobile hardware/emulator, run a conversation that renders multiple recommendation turns and confirm composer typing and scroll remain responsive.

## Planning Guardrails

- Keep `/api/ai/course-recommendations` contract unchanged (UI quality hardening only).
- Do not re-open Phase 2 shell decomposition or Phase 3 request lifecycle semantics unless required for AIQ quality fixes.
- Keep recommendation-card architecture modular so future v2 streaming/personalization work can reuse the card primitives.

