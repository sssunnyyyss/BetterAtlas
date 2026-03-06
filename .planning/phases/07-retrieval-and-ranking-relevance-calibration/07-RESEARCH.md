# Phase 7: Retrieval and Ranking Relevance Calibration - Research

**Researched:** 2026-03-06
**Domain:** Hybrid retrieval quality, bounded ranking calibration, diversity guardrails, and low-relevance fallback behavior in `POST /api/ai/course-recommendations`
**Confidence:** HIGH

## User Constraints

- Only write this file: `.planning/phases/07-retrieval-and-ranking-relevance-calibration/07-RESEARCH.md`.
- Phase scope is exactly: retrieval/ranking relevance calibration after Phase 6 grounding safety.
- Must cover requirement IDs: `AIREL-01`, `AIREL-02`, `AIREL-03`, `AIREL-04`.
- Must account for project instructions: `CLAUDE.md` is absent; `.agents/skills/` is absent.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AIREL-01 | Recommendation requests use lexical retrieval + semantic retrieval when embedding support exists. | Add explicit retrieval mode orchestration (`lexical_only`, `hybrid`, `hybrid_degraded`) that always runs lexical and conditionally adds semantic when embeddings are available. |
| AIREL-02 | Recommendations are ranked with bounded preference + trainer-quality signals. | Replace unbounded additive scoring with normalized component scores and hard caps on preference/trainer contributions. |
| AIREL-03 | Recommendation lists maintain department diversity unless intent/filters require concentration. | Add post-ranking diversity policy over final recommendation cards with intent/filter-aware bypass rules. |
| AIREL-04 | When relevance is insufficient, assistant provides refinement guidance instead of forced low-quality recommendations. | Add explicit relevance sufficiency gate before final card assembly; return clarify/refine guidance with empty cards when threshold is not met. |
</phase_requirements>

## Summary

Phase 6 established strict grounding and filter safety, but relevance calibration is still partly heuristic and can over-amplify bias. Current behavior already retrieves lexical and semantic candidates in many recommendation turns, but the path is not explicitly modeled as a hybrid contract, ranking boosts are effectively unbounded relative to user preference volume, and final recommendation assembly can still force weak matches when query relevance is poor.

For planning, treat this phase as a calibration pass over existing architecture, not a rewrite. Keep the current route contract and services, but extract explicit retrieval/ranking policies into dedicated helpers so quality behavior is deterministic and testable.

**Primary recommendation:** Implement a dedicated `relevancePolicy` layer that enforces hybrid retrieval mode, bounded score composition, diversity-aware final selection, and a deterministic low-relevance refine fallback.

## Current-State Findings (Planning-Critical)

- `api/src/routes/ai.ts` already runs lexical retrieval (`searchCourses`) and semantic retrieval (`semanticSearchCoursesByEmbedding`) in recommend mode when embeddings are available.
- `api/src/services/courseService.ts` has semantic availability checks and pgvector-backed search; hybrid infrastructure exists.
- Candidate ranking currently uses `scoreCourseWithPreferenceSignals` + trainer score weight (`GLOBAL_SCORE_WEIGHT = 2.0`) without normalization by signal volume and without hard score caps.
- Department interleaving exists at candidate pool time (`interleaveByDepartment`) but is partially undone by later global ranking and mention/fallback assembly, so final list diversity is not guaranteed.
- Low-quality avoidance is incomplete: if no explicit model mentions are usable, fallback logic still returns top candidate slices even when query-term relevance is effectively zero.

## Recommended Approach

### 1. Formalize Retrieval Mode Contract (AIREL-01)

- Introduce an explicit retrieval result envelope:
  - `mode: "lexical_only" | "hybrid" | "hybrid_degraded"`
  - `lexicalCount`, `semanticCount`, `semanticAttempted`, `semanticAvailable`
- Keep lexical retrieval mandatory for recommend mode.
- Attempt semantic retrieval when `areCourseEmbeddingsAvailable()` is true; degrade safely on embed/query failure without failing the request.
- Avoid hidden double-semantic behavior by centralizing hybrid orchestration in one helper (route-level semantic + `searchCourses` semantic fallback should not both drive ranking policy implicitly).

### 2. Bounded Ranking Composition (AIREL-02)

- Split scoring into named components:
  - `baseRelevance` (lexical/semantic/query-term match)
  - `preferenceComponent` (liked/disliked signals)
  - `trainerComponent` (global trainer score)
- Normalize and clamp:
  - Clamp `preferenceComponent` to a bounded interval (example: `[-2.0, 2.0]`).
  - Clamp `trainerComponent` to a bounded interval (example: `[-1.0, 1.0]` after weighting).
  - Keep `baseRelevance` dominant unless user preference confidence is high.
- Preserve deterministic tie-breakers (existing stable index/code fallback pattern).

### 3. Diversity Policy on Final Recommendation List (AIREL-03)

- Apply diversity policy to final recommendation cards, not only candidate pool:
  - Default: max per department in top `N` (example: max 2 in top 6, max 3 in top 8).
  - Ensure minimum department spread where feasible.
- Bypass or relax diversity when concentration is explicitly requested:
  - Active department filter is set.
  - Query intent clearly targets one department/domain.
  - Candidate pool itself is concentrated due hard filters.
- Keep this as a deterministic post-rank selector, not an LLM instruction.

### 4. Relevance Sufficiency Gate + Refine Guidance (AIREL-04)

- Define a relevance sufficiency metric before returning cards:
  - Top-k average relevance score.
  - Query-term coverage ratio.
  - Optional semantic confidence contribution when hybrid mode is active.
- If below threshold:
  - Return concise refinement guidance (constraints to add/relax).
  - `recommendations: []`.
  - Optional single follow-up question in `followUpQuestion`.
- This is separate from grounding fallback: low relevance is a quality fallback, not a safety violation.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | >=20 | Runtime for AI route orchestration | Project baseline runtime. |
| Express | ^4.21.0 | `/api/ai/course-recommendations` endpoint flow | Existing transport contract is stable. |
| TypeScript | ^5.5.0 | Typed policy/ranking contracts | Needed for deterministic scoring modules. |
| Zod | ^3.23.0 | Request/response validation | Already used in AI route schema path. |
| PostgreSQL + pgvector + pg_trgm | schema-migration-managed | Lexical + semantic retrieval backend | Existing infra supports hybrid retrieval without new services. |

### Supporting

| Library/Module | Purpose | When to Use |
|----------------|---------|-------------|
| `courseService.searchCourses` | Lexical retrieval with filter support | Always in recommend mode. |
| `courseService.semanticSearchCoursesByEmbedding` | Semantic recall from embeddings | When embeddings table is available. |
| `openAiEmbedText` | Query embedding generation | Semantic path only. |
| `getAllAiTrainerScores` | Trainer-quality global signal | Ranked candidate calibration. |
| Vitest (`api`) | Regression verification | Route-level and policy-unit tests. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Bounded server-side rank policy | Prompt-only ranking instructions | Less deterministic, weak against regressions. |
| Post-rank deterministic diversity selector | LLM-only diversity instructions | No enforceable guarantees on output mix. |
| Low-relevance refine fallback | Always return best-effort recommendations | Violates AIREL-04 quality bar and hurts trust. |

## Architecture Patterns

### Pattern 1: Explicit Hybrid Retrieval Envelope

**What:** Retrieval helper returns candidates plus retrieval-mode metadata.
**When to use:** Every recommend-mode request.

```ts
const retrieval = await retrieveCandidatesHybrid({
  latestUser,
  filters: activeFilters,
  excludeIds: excludeSet,
});
// retrieval.mode: lexical_only | hybrid | hybrid_degraded
```

### Pattern 2: Bounded Composite Ranking

**What:** Sum normalized components with hard caps.
**When to use:** After dedupe/exclusion, before diversity selection.

```ts
const score =
  baseRelevance +
  clamp(preferenceComponent, -2.0, 2.0) +
  clamp(trainerComponent, -1.0, 1.0);
```

### Pattern 3: Diversity-Aware Final Selector

**What:** Build final list with per-department caps unless concentration is explicitly intended.
**When to use:** Immediately before card assembly.

```ts
const finalCandidates = selectWithDiversityPolicy({
  ranked,
  targetCount: 8,
  concentrationAllowed,
});
```

### Pattern 4: Relevance Sufficiency Gate

**What:** Block low-confidence recommendation cards and ask for refinement.
**When to use:** After ranking + diversity, before response payload return.

```ts
if (!isRelevanceSufficient(finalCandidates, latestUser, searchTerms)) {
  return buildRefinementGuidanceResponse();
}
```

### Anti-Patterns to Avoid

- Adding larger prompt instructions instead of enforcing bounded ranking policy in code.
- Applying diversity only before ranking and assuming it survives later reordering.
- Treating "non-empty candidates" as equivalent to "relevant recommendations."
- Mixing multiple semantic fallback paths without explicit mode accounting.

## Don’t Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Implicit scoring math scattered across route | Inline magic numbers and ad hoc sorting | Dedicated `relevancePolicy` helper with typed score breakdown | Makes calibration testable and auditable. |
| LLM-based diversity guarantees | Prompt phrases like “be diverse” | Deterministic post-rank selector | Enforceable output behavior. |
| One-off relevance heuristics per fallback path | Separate relevance checks in multiple branches | Single `isRelevanceSufficient` function reused in all assembly paths | Prevents drift between mention and fallback outputs. |
| New vector/search infrastructure | External vector DB for this phase | Existing pgvector + course embeddings table | Existing infra already supports requirement scope. |

## Common Pitfalls

### Pitfall 1: Unbounded Preference Amplification

**What goes wrong:** Many liked/disliked examples overpower query relevance.
**Why it happens:** Raw additive scoring scales with signal count.
**How to avoid:** Normalize by signal volume and clamp component contributions.
**Warning signs:** Same courses dominate across unrelated prompts after preference history grows.

### Pitfall 2: Trainer Score Popularity Lock

**What goes wrong:** Globally popular courses crowd out intent-specific matches.
**Why it happens:** Trainer weight dominates weak query relevance.
**How to avoid:** Cap trainer contribution and require minimum base relevance.
**Warning signs:** Repeated recommendation of same high-score courses across different intents.

### Pitfall 3: Diversity Lost After Re-Ranking

**What goes wrong:** Candidate pool is diverse, final cards are concentrated.
**Why it happens:** Diversity applied pre-rank only.
**How to avoid:** Apply diversity policy at final-card selection stage.
**Warning signs:** `deptCounts` diverse in debug candidates but narrow in returned cards.

### Pitfall 4: Forced Low-Relevance Recommendations

**What goes wrong:** System returns weak matches instead of asking clarifying guidance.
**Why it happens:** Fallback path prefers non-empty output over quality threshold.
**How to avoid:** Introduce explicit relevance sufficiency gate and refine response.
**Warning signs:** User says results are unrelated despite strict filters/intents.

## Code Examples

Verified planning patterns derived from current code organization:

### Bounded Score Breakdown Object

```ts
type RankedCandidate = {
  course: CourseWithRatings;
  scores: {
    baseRelevance: number;
    preference: number;
    trainer: number;
    final: number;
  };
};
```

### Relevance Sufficiency Policy

```ts
function isRelevanceSufficient(input: {
  ranked: RankedCandidate[];
  minTopKAvg: number;
  minTermCoverage: number;
}) {
  // Deterministic quality gate for AIREL-04.
  const top = input.ranked.slice(0, 4);
  if (top.length === 0) return false;
  const avg = top.reduce((sum, c) => sum + c.scores.baseRelevance, 0) / top.length;
  return avg >= input.minTopKAvg;
}
```

### Diversity Bypass Decision

```ts
function allowConcentration(filters: AiCourseFilters, intentSignals: string[]) {
  if (filters.department) return true;
  if (intentSignals.includes("single_department_request")) return true;
  return false;
}
```

## State of the Art (Project-Specific)

| Old/Current | Current in Codebase | Phase 7 Target | Impact |
|-------------|---------------------|----------------|--------|
| Retrieval | Lexical + semantic available but not formalized as explicit mode contract | Explicit hybrid retrieval mode with degradations tracked | Improves reliability and debuggability for AIREL-01. |
| Ranking | Preference + trainer additive boosts without hard bounds | Bounded composite scoring with normalized components | Meets AIREL-02 and reduces amplification regressions. |
| Diversity | Candidate-level interleaving before later rerank/assembly | Final-output diversity selector with concentration exceptions | Meets AIREL-03 in observable payloads. |
| Low-quality handling | Empty-candidate fallback exists; weak-match fallback still returns cards | Relevance sufficiency gate with refinement response | Meets AIREL-04 and avoids forced poor recommendations. |

## Open Questions

1. What numeric relevance threshold should trigger refine fallback in production?
   - What we know: current fallback accepts score-0 candidate pools.
   - What is unclear: threshold values that avoid over-triggering.
   - Recommendation: start with conservative threshold + non-prod debug counters, tune in phase verification.

2. Should diversity policy apply to recommendation cards only or also assistant narrative mentions?
   - What we know: cards are the enforced structured payload.
   - What is unclear: user experience when narrative names concentrated courses but cards diversify.
   - Recommendation: enforce diversity on cards first; keep narrative grounded to selected cards in same phase where feasible.

3. Should semantic retrieval be mandatory whenever embeddings exist, even for very short prompts?
   - What we know: current logic already gates by query length in some paths.
   - What is unclear: latency/cost impact for short low-information prompts.
   - Recommendation: keep short-query guardrails but record `semanticAttempted` reason in debug metadata.

## Sources

### Primary (HIGH confidence)

- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- `.planning/ROADMAP.md`
- `.planning/research/SUMMARY.md`
- `api/src/routes/ai.ts`
- `api/src/services/courseService.ts`
- `api/src/services/aiTrainerService.ts`
- `api/src/lib/openaiEmbeddings.ts`
- `api/src/routes/ai.grounding-safety.test.ts`
- `api/src/routes/ai.intent-routing.test.ts`
- `schema-migration.sql`
- `api/package.json`

### Secondary (MEDIUM confidence)

- `docs/plans/2026-02-23-enriched-embeddings-design.md`
- `docs/plans/2026-02-23-enriched-embeddings-implementation.md`

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH (directly verified from repo dependencies and active code paths).
- Architecture patterns: HIGH (derived from current implementation seams and requirement deltas).
- Pitfalls: HIGH (observed from current scoring/selection/fallback behavior).

**Research date:** 2026-03-06
**Valid until:** 2026-04-05

## RESEARCH COMPLETE

- Existing code already has hybrid retrieval primitives; Phase 7 should formalize and verify them.
- Ranking calibration is the largest gap: score components are not yet bounded.
- Department diversity must be enforced at final output stage, not only candidate construction.
- Low-relevance detection needs an explicit quality gate to replace forced weak recommendations.
