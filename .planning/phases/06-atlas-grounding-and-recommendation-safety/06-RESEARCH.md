# Phase 6: Atlas Grounding and Recommendation Safety - Research

**Researched:** 2026-03-06
**Domain:** Grounding enforcement and hard recommendation safety in `POST /api/ai/course-recommendations`
**Confidence:** HIGH

## User Constraints

- Only write this file: `.planning/phases/06-atlas-grounding-and-recommendation-safety/06-RESEARCH.md`.
- Do not revert or interfere with concurrent edits by other contributors.
- Phase scope is exactly: enforce strict catalog grounding and hard safety constraints on recommendation outputs.
- Must cover requirement IDs: `AIGRD-01`, `AIGRD-02`, `AIGRD-03`, `AIGRD-04`.
- No `CLAUDE.md` and no `.agents/skills` directory exist for this project.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AIGRD-01 | Specific course codes/titles in assistant replies must exist in active candidate set. | Add explicit post-generation grounding validation against candidate index before response is returned. |
| AIGRD-02 | Excluded/disliked courses must never be recommended in same session. | Build session-scoped exclusion state and enforce it in candidate pool, mention mapping, and grounding checks. |
| AIGRD-03 | If grounding fails, return safe fallback with no fabricated specific course names. | Add fail-closed fallback policy triggered by grounding violations, with safe non-specific assistant text. |
| AIGRD-04 | Active catalog filters must be hard constraints for recommendations. | Keep filter-aware retrieval and add post-retrieval/post-assembly hard assertions so filtered-out courses cannot leak. |
</phase_requirements>

## Summary

Phase 5 completed deterministic intent/cadence routing, but recommendation safety is still prompt-led rather than policy-enforced. Current `ai.ts` asks the model to use candidate courses and avoid excluded courses, but there is no hard server-side validator on `assistantMessage` before returning a response. Recommendations are assembled from candidate mentions (or candidate fallback), which is helpful, but user-visible assistant text can still contain off-catalog course references because text and recommendation cards are not currently governed by a strict grounding gate.

The strongest planning direction is to keep the existing route contract and retrieval stack, then add a dedicated grounding/safety layer that runs after model generation and before response mapping. That layer should (1) validate specific course mentions against active candidates, (2) enforce session-level exclusion/dislike constraints consistently, (3) fail closed to a safe non-specific fallback on mismatch, and (4) assert that all returned recommendation cards satisfy active filters.

**Primary recommendation:** Implement a fail-closed `groundingValidator` + `safetyPolicy` module in the recommendation path, with route-level regression tests that explicitly prove AIGRD-01..04 behavior.

## Current-State Findings (What Matters for Planning)

- `ai.ts` already has strong preconditions for recommendation mode: filters are normalized, candidates are bounded, and retrieval calls pass filters into lexical/semantic/filler queries.
- Exclusions are currently request-scoped (`excludeCourseIds` + `preferences.disliked`) and used to filter candidate pool/recommendation assembly, but not persisted across session turns server-side.
- `assistantMessage` is returned directly from model output (JSON mode or chat fallback) without a grounding validator pass; only recommendation cards are derived from candidate mentions/fallback.
- Prompt policy text says “candidate list only” and “never excluded,” but policy is not a hard gate.
- Existing tests cover intent/cadence behavior (`ai.intent-routing.test.ts`) but do not yet enforce grounding safety constraints.

## Implementation Options

### Option A: Prompt-Only Tightening (not recommended)

- Add stricter prompt wording and larger candidate context hints.
- Keep current assembly logic unchanged.

**Pros:** Fastest implementation.
**Cons:** Does not satisfy hard-constraint requirements reliably; prompt instructions are not enforcement.

### Option B: Post-Generation Grounding Guard in Route (recommended)

- Keep route structure in `ai.ts`.
- Add pure functions for grounding and safety checks, invoked after model response and before final payload.
- On violation, return deterministic safe fallback response with no specific course names.

**Pros:** Minimal architectural churn, deterministic enforcement, easy to test.
**Cons:** Adds complexity in already-large route unless helper modules are introduced.

### Option C: Structured Recommendation Plan Output (deeper refactor)

- Ask model to output explicit candidate IDs (or indexes) plus narrative.
- Validate IDs server-side, then synthesize final `assistantMessage` from validated cards.

**Pros:** Strongest grounding integrity long-term.
**Cons:** Higher refactor scope/risk for this phase; can delay delivery.

## Recommended Approach

Use **Option B** now, while extracting helpers under `api/src/ai/grounding/` to avoid further route monolith growth.

### 1. Add Grounding Validation Gate (AIGRD-01, AIGRD-03)

- Build a candidate index keyed by:
  - course ID
  - normalized code variants (`CS170`, `CS 170`, `CS-170`)
  - normalized full title
- Parse model `assistant_message` for explicit course references:
  - code-like patterns
  - exact/near-exact candidate title matches (bounded and deterministic)
- Classify result:
  - `pass`: all specific mentions map to candidate set
  - `fail`: at least one specific mention is unmapped or excluded
- On `fail`, do not return raw model text; return safe fallback text with no course-specific entities.

### 2. Enforce Session-Level Exclusion/Dislike Policy (AIGRD-02)

- Extend in-memory per-user state with TTL-bounded exclusion IDs in recommendation context.
- Merge exclusion sources each turn:
  - request `excludeCourseIds`
  - request `preferences.disliked`
  - prior session exclusions/dislikes in memory
- Apply merged exclusion set at all layers:
  - candidate pool construction
  - mention-derived recommendation extraction
  - fallback recommendation selection
  - grounding mention validation

### 3. Add Hard Filter Assertions on Output (AIGRD-04)

- Keep existing filter-aware retrieval calls.
- Add final server assertion: every returned recommendation course must satisfy active filters used for retrieval.
- If any recommendation violates filters (service mismatch, stale cache edge case, future regression), drop invalid items and run safe fallback branch when needed.

### 4. Add Fail-Closed Safe Fallback Policy (AIGRD-03)

- Define one deterministic fallback for grounding failures:
  - no explicit course code/title strings
  - short explanation + one refinement request
  - `recommendations: []`
- Keep current empty-candidate fallback for strict-filter no-result scenarios, but ensure it also contains no fabricated specifics.

### 5. Preserve Existing Contract + Debug Extensions

- Keep response keys unchanged: `assistantMessage`, `followUpQuestion`, `recommendations`.
- In non-production debug payload, add safety diagnostics:
  - `groundingStatus` (`pass|fail`)
  - `groundingViolationCount`
  - `excludedMentionCount`
  - `safeFallbackUsed` (boolean)

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | >=20 | Runtime | Already required by project. |
| Express | ^4.21.0 | Route orchestration | Existing API contract path. |
| TypeScript | ^5.5.0 | Typed safety policy and validator interfaces | Deterministic, testable guards. |
| Zod | ^3.23.0 | Input/output schema constraints | Already used in AI route contract. |
| Vitest | ^2.1.9 | Route and unit regression tests | Existing test framework in API package. |

### Supporting

| Library/Module | Purpose | When to Use |
|----------------|---------|-------------|
| `openAiChatJson` / `openAiChat` wrappers | Recommendation text generation | Keep current generation strategy; enforce safety after generation. |
| `courseService` filter-aware retrieval APIs | Candidate generation under hard filters | Reuse existing retrieval/filter plumbing; add output assertions in phase. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Post-generation mention validator | LLM self-check prompt | Lower reliability and no deterministic enforcement. |
| In-memory session exclusion state | Persistent DB/Redis state | Better multi-instance consistency but larger scope than phase need. |

## Architecture Patterns

### Pattern 1: Fail-Closed Grounding Validator

**What:** Treat model output as untrusted until mention validation passes.
**When to use:** All `recommend` mode responses before final JSON response.

```ts
const grounding = validateGrounding({
  assistantMessage: modelResult.assistant_message,
  candidates,
  excludedIds,
});

if (!grounding.ok) {
  return buildSafeGroundingFallback();
}
```

### Pattern 2: Unified Safety Set

**What:** Build one merged `blockedCourseIds` set for all recommendation stages.
**When to use:** Start of recommendation branch and persisted per user session.

```ts
const blockedCourseIds = mergeBlockedIds({
  requestExcludeIds,
  dislikedFromPreferences,
  priorSessionBlockedIds,
});
```

### Pattern 3: Output Filter Assertions

**What:** Re-validate final recommendation cards against active filter object.
**When to use:** Immediately before response return.

```ts
const validatedRecommendations = recommendations.filter((rec) =>
  courseSatisfiesFilters(rec.course, activeFilters),
);
```

### Anti-Patterns to Avoid

- Returning model `assistant_message` directly without grounding verification.
- Enforcing exclusion only for cards while allowing excluded/off-catalog mentions in assistant text.
- Treating retrieval-time filter application as sufficient without post-assembly safety checks.

## Don’t Hand-Roll

| Problem | Don’t Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Ad-hoc string matching for mentions in many places | Duplicated regex snippets across route | Single `groundingValidator` helper module | Keeps safety logic consistent and testable. |
| New test harness for AI route | Bespoke scripts only | Existing Vitest route-style tests (`ai.intent-routing.test.ts` pattern) | Faster and stable regression coverage. |
| Overly stateful exclusion logic in route body | Manual map mutations spread across branch logic | Dedicated state helper (`merge + TTL + trim`) | Reduces accidental drift and leakage bugs. |

## Common Pitfalls

### Pitfall 1: Grounding False Negatives

**What goes wrong:** Validator misses fabricated course names and passes unsafe text.
**Why it happens:** Matching only by code and ignoring title mentions/variants.
**How to avoid:** Validate both code and title pathways with normalized matching.
**Warning signs:** Assistant text includes course-looking names absent from candidates while status says pass.

### Pitfall 2: Grounding False Positives

**What goes wrong:** Safe valid messages are rejected too often, causing excessive fallback.
**Why it happens:** Over-aggressive title matching or broad course-like regex.
**How to avoid:** Trigger violations only for high-confidence explicit course mentions.
**Warning signs:** `safeFallbackUsed` spikes despite clean candidate context.

### Pitfall 3: Session Exclusion Drift

**What goes wrong:** Previously excluded/disliked courses reappear in later turns.
**Why it happens:** Exclusions only read from current request payload.
**How to avoid:** Persist and merge blocked IDs in user-scoped TTL memory.
**Warning signs:** Repeat recommendations for known disliked items across sequential prompts.

### Pitfall 4: Filter Leakage via Assembly Edge Cases

**What goes wrong:** Returned cards violate active filters despite filtered retrieval.
**Why it happens:** Future code changes, stale data assumptions, or fallback path bypass.
**How to avoid:** Final output assertion that every course in `recommendations` satisfies active filters.
**Warning signs:** Tests passing retrieval mocks but failing end-response filter integrity.

## Code Examples

### Suggested Grounding Result Type

```ts
type GroundingValidationResult = {
  ok: boolean;
  violations: Array<{
    kind: "unknown_mention" | "excluded_mention";
    text: string;
  }>;
  matchedCandidateIds: number[];
};
```

### Safe Fallback Shape

```ts
function buildSafeGroundingFallback() {
  return {
    assistantMessage:
      "I want to make sure recommendations stay accurate to the current catalog and your filters. Tell me one or two constraints (like semester, GER, or workload), and I’ll refine safely.",
    followUpQuestion: "Which constraint should I prioritize first?",
    recommendations: [],
  };
}
```

## Validation Checks Useful for Planning

### Automated Tests (Phase Gate)

- `POST /ai/course-recommendations` returns only candidate-grounded specific mentions in assistant text.
- If model text includes off-catalog explicit course mention, response uses safe fallback and `recommendations` is empty.
- Excluded/disliked IDs are never present in returned recommendations or grounded mention map, including multi-turn same-session flow.
- Active filters are enforced on all returned recommendation cards (semester/department/rating/credits/attribute/instructor/campus/component/instruction method).
- JSON-mode fallback (`openAiChat`) path still passes through grounding validator and safety policy.

### Test File Strategy

- Extend route tests with new safety fixtures:
  - `api/src/routes/ai.grounding-safety.test.ts` (new)
  - keep `ai.intent-routing.test.ts` unchanged for intent scope
- Add unit tests for validator helpers:
  - `api/src/ai/grounding/groundingValidator.test.ts` (new)
  - `api/src/ai/grounding/safetyPolicy.test.ts` (new)

### Quick Commands

- `pnpm --filter api test -- src/routes/ai.grounding-safety.test.ts`
- `pnpm --filter api test -- src/ai/grounding/groundingValidator.test.ts`
- `pnpm --filter api test`

### Manual Validation Scenarios

1. Prompt asks recommendations with filters; verify cards and any specific mentions respect filters.
2. Inject model response containing fabricated course title; verify safe fallback with no specific names.
3. Multi-turn: dislike/exclude course in turn 1, ask for more in turn 2; verify course never reappears.
4. Tight filters causing sparse candidates; verify no fabricated specific courses in fallback text.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Grounding validator is too permissive | Off-catalog mentions leak to users | Build strict high-confidence mention rules + dedicated unit tests for edge cases. |
| Grounding validator is too strict | Excessive fallback, poor UX | Tune violation thresholds, keep fallback concise, measure fallback rate in debug metrics first. |
| Session exclusion stored only in-process | Inconsistent behavior across multiple API instances | Document limitation now; plan Redis-backed memory in later memory phase if needed. |
| Large `ai.ts` complexity increases regression risk | Slower delivery and fragile edits | Extract helper modules under `api/src/ai/grounding/` and keep route as orchestration layer. |
| Filter assertion duplicates service logic | Potential drift if semantics diverge | Keep assertion intentionally simple and aligned to request-level constraints, not full DB logic. |

## Open Questions

1. Should grounding failure always force `recommendations: []`, or should we allow safe cards with sanitized text?
2. Do we persist exclusion/dislike state for anonymous users (request-only) or only authenticated users (memory-backed)?
3. Should follow-up question be mandatory on every grounding fallback, or optional based on detected ambiguity?
4. Do we treat near-title fuzzy matches as valid mentions, or require exact normalized title/code only for Phase 6?

## Sources

### Primary (HIGH confidence)

- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `.planning/research/SUMMARY.md`
- `.planning/research/ARCHITECTURE.md`
- `.planning/research/PITFALLS.md`
- `.planning/research/STACK.md`
- `.planning/research/FEATURES.md`
- `api/src/routes/ai.ts`
- `api/src/ai/intent/intentRouter.ts`
- `api/src/routes/ai.intent-routing.test.ts`
- `api/src/ai/intent/intentRouter.test.ts`
- `api/src/services/courseService.ts`
- `api/package.json`
- `api/vitest.config.ts`

## Metadata

**Confidence breakdown:**
- Grounding/safety architecture: HIGH (directly mapped to current route behavior and requirement gaps).
- Exclusion/filter enforcement strategy: HIGH (existing retrieval path + explicit missing hard gates identified).
- Validation approach: HIGH (existing Vitest route pattern ready for extension).

**Research date:** 2026-03-06
**Valid until:** 2026-04-05

## RESEARCH COMPLETE

- Hard safety gap is post-generation grounding enforcement, not retrieval capability.
- Phase 6 should add fail-closed validation for assistant text plus unified exclusion/filter assertions.
- Existing route tests provide a direct template; add dedicated grounding safety suites as phase gate.
