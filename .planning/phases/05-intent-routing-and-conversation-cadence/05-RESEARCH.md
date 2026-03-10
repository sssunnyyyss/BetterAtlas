# Phase 5: Intent Routing and Conversation Cadence - Research

**Researched:** 2026-03-05
**Domain:** AI request routing and turn-level response cadence in `POST /api/ai/course-recommendations`
**Confidence:** HIGH

## User Constraints

- Only write this file: `.planning/phases/05-intent-routing-and-conversation-cadence/05-RESEARCH.md`.
- Do not revert or interfere with concurrent edits in other files.
- Phase scope is exactly: recommendation retrieval/generation only when warranted, with clarify-first behavior for ambiguous asks.
- Must cover requirement IDs: `AIINT-01`, `AIINT-02`, `AIINT-03`, `AIINT-04`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AIINT-01 | Normal conversational turns should not force recommendations. | Add deterministic intent mode gating before retrieval; retrieval only in `recommend` mode. |
| AIINT-02 | Ambiguous recommendation asks should get a concise clarification first. | Add `clarify` mode and clarification question generation path returning zero recommendations. |
| AIINT-03 | Intent mode must be deterministic: `conversation`, `clarify`, `recommend`. | Introduce explicit `IntentMode` classifier with ordered rule precedence and test matrix for determinism. |
| AIINT-04 | Trivial greetings should return a fast conversational reply with no unnecessary retrieval. | Keep/strengthen greeting fast-path with early return and hard assertions that retrieval/embedding is skipped. |
</phase_requirements>

## Summary

Current behavior in [`api/src/routes/ai.ts`](../../../api/src/routes/ai.ts) is a binary gate (`wantsCourseSuggestions`) plus a greeting shortcut. This partially supports conversational turns and greeting latency, but it does not implement the required explicit 3-mode intent model, and it cannot provide clarify-first behavior for ambiguous asks. `followUpQuestion` is also always returned as `null`, even though model schema allows it.

The planning target should be a deterministic turn router that classifies each user turn into `conversation`, `clarify`, or `recommend` *before* retrieval. This keeps recommendation costs bounded, prevents over-recommending, and gives a predictable place to ask concise clarification questions.

**Primary recommendation:** Implement a rule-first `IntentDecision` module with an explicit `clarify` mode, gate retrieval strictly to `recommend`, and add route-level regression tests that prove no retrieval occurs in `conversation`/`clarify`.

## Current-State Findings (What Matters for Planning)

- Intent detection is currently broad keyword/regex-based via `isCourseSuggestionIntent`; terms like `course/class/professor` can push a turn into recommendation flow even when user intent is conversational.
- Greeting handling is already an early return (`isTrivialGreeting`) and avoids OpenAI/retrieval work; this is a strong base for `AIINT-04`.
- Recommendation path always performs candidate retrieval when intent is true and can trigger embeddings/search/ranking even for vague asks.
- Response contract already has `followUpQuestion`, but route always emits `null` and frontend currently renders assistant text only; this creates room for backward-compatible clarify behavior via `assistantMessage`.

## Implementation Options

### Option A: In-Place Route Upgrade (lowest refactor)

- Add `IntentMode` + `classifyIntent` directly in `ai.ts`.
- Add clarify branch in existing handler.
- Keep all retrieval/generation logic in same file.

**Pros:** Fastest delivery, lowest file churn.
**Cons:** Increases monolith complexity; harder to test classifier independently.

### Option B: Extract Intent + Cadence Module (recommended)

- Keep HTTP contract in `ai.ts`.
- Add `api/src/ai/intent/intentRouter.ts` (classification + reasons + clarify prompt helpers).
- Handler calls router result and branches deterministically.

**Pros:** Clean test seam for deterministic intent behavior; supports future phases without large rewrites.
**Cons:** Moderate refactor effort.

### Option C: LLM-Assisted Intent Classifier (not recommended for Phase 5)

- First LLM call decides mode (`conversation|clarify|recommend`), then branch.

**Pros:** Potentially better semantic nuance.
**Cons:** Adds latency/cost on every turn, weaker determinism, and failure modes before core safety phases are complete.

## Recommended Approach

Use **Option B** with strict deterministic routing:

1. Define `IntentMode = "conversation" | "clarify" | "recommend"` and `IntentDecision` (`mode`, `reason`, `signals`).
2. Add ordered rule precedence (deterministic):
   - `trivial greeting` -> `conversation` with fast canned reply.
   - explicit recommendation intent (strong verbs/course-code patterns/request actions) -> `recommend`.
   - ambiguous course-seeking language (course nouns without clear request constraints) -> `clarify`.
   - otherwise -> `conversation`.
3. Gate expensive work:
   - `conversation`: no candidate retrieval, no embeddings.
   - `clarify`: no candidate retrieval; return one concise clarifying question.
   - `recommend`: run existing retrieval/ranking/generation path.
4. Cadence behavior:
   - Clarify response should be short and actionable (one question), with `recommendations: []`.
   - Populate both `assistantMessage` and `followUpQuestion` for compatibility.
5. Add debug observability fields in non-production response (e.g., `intentMode`, `intentReason`, `retrievalSkipped`).

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | >=20 | Runtime | Already required by repo; no migration needed. |
| Express | ^4.21.0 | Route orchestration | Existing `/api` router/middleware path. |
| TypeScript | ^5.5.0 | Deterministic intent types | Strong mode typing and branch exhaustiveness. |
| Zod | ^3.23.0 | Request/response validation | Existing schema strategy for AI payloads. |
| Vitest | ^2.1.9 | Regression tests | Existing API test framework. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `openAiChat` wrapper | in-repo | Conversational reply path | `conversation` mode only (or optional clarify phrasing). |
| `openAiChatJson` wrapper | in-repo | Structured recommendation reply | `recommend` mode only. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Rule-first classifier | LLM classifier | Better nuance but weaker determinism/cost profile for this phase. |

## Architecture Patterns

### Pattern 1: Deterministic Intent Router

**What:** Pure function from latest turn/context -> explicit mode.
**When to use:** Every request before retrieval.

```ts
export type IntentMode = "conversation" | "clarify" | "recommend";

export type IntentDecision = {
  mode: IntentMode;
  reason: string;
  signals: string[];
};

const decision = classifyIntent({ latestUser, history });
```

### Pattern 2: Cost-Gated Branching

**What:** Hard gate retrieval/embedding/LLM-JSON by intent mode.
**When to use:** In main route orchestration.

```ts
if (decision.mode === "conversation") return replyConversation();
if (decision.mode === "clarify") return replyClarify();
return replyRecommend();
```

### Pattern 3: Clarify-First Ambiguity Handling

**What:** Ask one concise follow-up before any recommendation list.
**When to use:** Course-related but underspecified asks.

```ts
return {
  assistantMessage: "Got it. Are you looking for easy workload, a GER, or something in your major?",
  followUpQuestion: "Easy workload, GER, or major requirement?",
  recommendations: [],
};
```

### Anti-Patterns to Avoid

- Branching by a single broad keyword boolean for all non-greeting turns.
- Running candidate retrieval before intent is finalized.
- Returning recommendations during clarify mode.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP validation for new mode fields | Custom ad-hoc checks | Zod schemas/refinements | Keeps API contract checks consistent and testable. |
| Free-form mode values | String literals across code | Typed `IntentMode` union | Prevents drift and non-deterministic branches. |
| New test harness | Bespoke scripts only | Existing Vitest setup (`api/vitest.config.ts`) | Faster integration into current CI/dev workflow. |

## Common Pitfalls

### Pitfall 1: Over-triggering `recommend`

- **What goes wrong:** Conversational turns with words like "course" still trigger retrieval.
- **How to avoid:** Add ambiguity bucket and stronger explicit-intent requirements.
- **Warning sign:** Retrieval called on policy/process questions.

### Pitfall 2: Clarify Loop

- **What goes wrong:** User answers clarification but router asks again.
- **How to avoid:** Include prior clarify context/signal and promote to `recommend` when answer provides actionable constraints.
- **Warning sign:** Multiple consecutive clarify responses with zero retrieval.

### Pitfall 3: Contract Mismatch

- **What goes wrong:** `followUpQuestion` set but `assistantMessage` empty/weak; frontend currently relies on `assistantMessage`.
- **How to avoid:** Always provide meaningful `assistantMessage`; mirror concise question into `followUpQuestion`.
- **Warning sign:** Blank or confusing assistant turns in UI tests.

## Code Examples

### Suggested Classifier Skeleton

```ts
function classifyIntent(input: { latestUser: string }): IntentDecision {
  const text = input.latestUser.trim();

  if (isTrivialGreeting(text)) {
    return { mode: "conversation", reason: "trivial_greeting", signals: ["greeting"] };
  }

  if (hasExplicitRecommendationIntent(text)) {
    return { mode: "recommend", reason: "explicit_recommendation", signals: ["explicit_verb_or_course_code"] };
  }

  if (hasAmbiguousCourseIntent(text)) {
    return { mode: "clarify", reason: "ambiguous_course_request", signals: ["course_noun_without_constraints"] };
  }

  return { mode: "conversation", reason: "general_conversation", signals: [] };
}
```

## Validation Checks Useful for Planning

### Automated checks (Phase 5 gate)

- `intentRouter.classifyIntent` determinism table test:
  - Same normalized input always maps to same mode.
  - Case/punctuation variants keep same mode.
- Route behavior tests for `POST /api/ai/course-recommendations`:
  - `conversation` turn returns `recommendations: []` and skips retrieval/embedding calls.
  - `clarify` turn returns concise question and `recommendations: []`.
  - `recommend` turn triggers retrieval path.
  - Trivial greeting returns fast canned response and skips retrieval.
- Regression test for ambiguity requirement:
  - Ambiguous ask must not return course cards in same response.
- Contract test:
  - Response always includes `assistantMessage`, `followUpQuestion` (nullable), `recommendations` array.

### Manual validation script (planning-ready examples)

1. Conversational-only input:
   - Prompt: "I’m overwhelmed planning next semester."
   - Expect: supportive conversational response, no recommendations.
2. Ambiguous recommendation input:
   - Prompt: "Can you help me pick classes?"
   - Expect: one concise clarifying question, no recommendations.
3. Explicit recommendation input:
   - Prompt: "Recommend 3 easy HA classes for Fall 2026."
   - Expect: recommendation path activated.
4. Greeting input:
   - Prompt: "hey"
   - Expect: fast canned reply, no retrieval.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Misclassification at boundary cases | Users get wrong cadence | Add gold test corpus of representative prompts and require deterministic outputs. |
| Clarify mode perceived as extra friction | UX drop-off | Keep question concise and directly actionable; avoid repeated clarify turns. |
| Hidden retrieval still executes | Cost/latency regression | Add explicit `retrievalSkipped` assertions and mocks in tests. |
| Frontend ignores `followUpQuestion` | Clarify not visible if only field used | Keep clarify text in `assistantMessage`; treat `followUpQuestion` as secondary metadata. |

## Open Questions

1. Should ambiguity detection require at least one missing slot (e.g., goal, constraint, preference), or use lexical confidence thresholds only?
2. Should clarify responses be fully deterministic templates for Phase 5, or allow lightweight LLM phrasing in `clarify` mode?
3. Should intent mode be returned in non-prod debug payload immediately (Phase 5) or deferred to observability phase?

## Sources

### Primary (HIGH confidence)

- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `.planning/research/SUMMARY.md`
- `api/src/routes/ai.ts`
- `api/src/lib/openai.ts`
- `api/package.json`
- `api/vitest.config.ts`

### Secondary (MEDIUM confidence)

- `.planning/research/STACK.md`
- `.planning/research/ARCHITECTURE.md`
- `.planning/research/PITFALLS.md`
- `.planning/research/FEATURES.md`

## Metadata

**Confidence breakdown:**
- Intent routing architecture: HIGH (directly based on current route implementation and requirements).
- Cadence/clarify behavior design: HIGH (direct requirement mapping, existing response contract support).
- Testability and validation path: HIGH (existing Vitest setup confirmed).

**Research date:** 2026-03-05
**Valid until:** 2026-04-04

## RESEARCH COMPLETE

- Deterministic 3-mode router is the critical missing capability for this phase.
- Clarify-first must be a distinct no-retrieval path, not a prompt hint inside recommendation flow.
- Planning should include strict retrieval gating tests to prove AIINT-01 through AIINT-04.
