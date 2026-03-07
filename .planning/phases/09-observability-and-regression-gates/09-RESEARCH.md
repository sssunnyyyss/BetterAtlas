# Phase 9: Observability and Regression Gates - Research

**Researched:** 2026-03-06
**Domain:** Production-safe AI quality telemetry, non-production diagnostics, and release-blocking regression gates for `POST /api/ai/course-recommendations`
**Confidence:** HIGH

## User Constraints

- First load role instructions from `/root/.codex/agents/gsd-phase-researcher.md`.
- Use required context files:
  - `.planning/REQUIREMENTS.md`
  - `.planning/STATE.md`
  - `.planning/phases/08-memory-and-multi-turn-context-reliability/VERIFICATION.md`
- Respect dependency context: Phase 8 is complete and is the baseline for Phase 9.
- Do not revert or interfere with concurrent changes in the workspace.
- Must cover requirement IDs: `AIOPS-01`, `AIOPS-02`, `AIOPS-03`.
- Project instruction files are absent for this run: `CLAUDE.md` missing, `.agents/skills/` missing.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AIOPS-01 | Team can monitor production-safe AI quality telemetry including intent mode, retrieval mode, fallback usage, and grounding mismatch indicators. | Add a dedicated AI quality telemetry module that records only low-cardinality, non-PII dimensions on every route outcome; expose aggregated metrics via admin-safe monitoring surface and/or structured logs. |
| AIOPS-02 | Team has automated regression tests that verify intent gating, Atlas grounding, exclusion handling, and empty/low-relevance behaviors. | Consolidate existing route suites into an explicit release gate command, add observability-focused assertions, and add missing telemetry/debug contract regressions. |
| AIOPS-03 | Team can inspect non-production debug diagnostics for candidate composition, filter enforcement, and ranking factors. | Keep `debug` non-production-only, centralize debug payload builder, and extend diagnostics with ranking-factor breakdown + filter enforcement evidence in deterministic schema. |
</phase_requirements>

## Summary

The codebase already contains most behavioral gates from Phases 5-8 and robust route-level suites (`ai.intent-routing`, `ai.grounding-safety`, `ai.relevance-calibration`, `ai.memory-context`). It also already emits rich **non-production** debug payloads and several branch-specific flags (`intentMode`, `retrievalMode`, `safeFallbackUsed`, `groundingStatus`, `lowRelevanceRefineUsed`).

The planning-critical gap is that **production** has no dedicated quality telemetry channel today. Debug payloads are correctly hidden in production (`env.nodeEnv !== "production"` guard), but there is no consolidated, production-safe metric stream for intent/retrieval/fallback/grounding quality. Additionally, regression suites are present but not yet packaged as an explicit release gate contract.

**Primary recommendation:** Add a small, deterministic telemetry layer (in-process counters + structured event logging), centralize debug diagnostics generation for non-production, and create a first-class `ai` regression gate command that blocks release when intent/grounding/relevance safety contracts drift.

## Current-State Findings (Planning-Critical)

- `api/src/routes/ai.ts` already computes most required signals for telemetry:
  - intent branch (`decision.mode`, `decision.reason`)
  - retrieval envelope (`retrievalMode`, semantic attempted/available/count)
  - safety/fallback outcomes (`safeFallbackUsed`, `groundingStatus`, `groundingViolationCount`, `excludedMentionCount`, `usedJsonFallback`, `filterConstraintDroppedCount`, `lowRelevanceRefineUsed`)
- Non-production debug payloads are present across route outcomes, but field shape is duplicated across many return branches.
- Production currently has only ad hoc `console.log("ai/course-recommendations timings", ...)` on slow requests and no quality-counter aggregation.
- Route-level regression suites already verify most AIOPS-02 behaviors:
  - intent gating: `api/src/routes/ai.intent-routing.test.ts`
  - grounding/exclusion/filter safety: `api/src/routes/ai.grounding-safety.test.ts`
  - low/empty relevance behavior: `api/src/routes/ai.relevance-calibration.test.ts`
  - memory + exclusion isolation context: `api/src/routes/ai.memory-context.test.ts`
- There is no explicit test suite today for:
  - production-safe telemetry emission/aggregation
  - non-production diagnostics schema parity (especially ranking-factor breakdown)
  - release gate command integrity

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | >=20 | Runtime for telemetry aggregation and route orchestration | Already required by repo and current API deployment. |
| Express | ^4.21.0 | AI route + admin metrics surfaces | Existing API routing model; no migration needed. |
| TypeScript | ^5.5.0 | Typed telemetry/debug contracts and event enums | Prevents contract drift across branches/tests. |
| Vitest | ^2.1.9 | Regression gates for route behavior + telemetry helpers | Existing test framework used across all AI route suites. |

### Supporting

| Module | Purpose | When to Use |
|--------|---------|-------------|
| `api/src/routes/ai.ts` | Source of truth for intent/retrieval/grounding/relevance outcomes | Instrument exactly once per response path. |
| `api/src/ai/relevance/rankingPolicy.ts` | Provides per-candidate score components | Derive ranking-factor diagnostics in non-prod debug. |
| `api/src/routes/adminPrograms.ts` | Existing admin/system metrics endpoint patterns | Reuse authorization + metrics endpoint style for telemetry visibility. |
| `api/src/config/env.ts` | Environment guards (`nodeEnv`) | Enforce prod-safe telemetry and non-prod-only diagnostics. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| In-process quality counters + optional structured logs | Persist telemetry in Postgres table | Better history, but adds schema/retention overhead to this phase. |
| Extend existing route tests + explicit gate command | Build full CI workflow in same phase | CI setup is valuable but larger infra scope; gate command can ship first. |
| Non-prod debug response diagnostics | New frontend diagnostics UI | UI is optional; API diagnostics + tests satisfy requirement with lower scope. |

## Recommended Approach

### 1. Add a Dedicated AI Quality Telemetry Module (AIOPS-01)

Create a small module (for example `api/src/ai/observability/aiQualityTelemetry.ts`) that records one **sanitized event** per AI route completion.

Event dimensions should stay low-cardinality and PII-safe:

- `intentMode`: `conversation | clarify | recommend`
- `retrievalMode`: `none | lexical_only | hybrid | hybrid_degraded`
- `outcomeType`: `success | grounding_fallback | filter_constraint_fallback | low_relevance_refine | empty_candidates | reset | route_error`
- `safeFallbackUsed`: boolean
- `usedJsonFallback`: boolean
- `groundingStatus`: `passed | failed`
- `groundingMismatch`: boolean (`groundingViolationCount > 0`)

Do not record prompt text, user message text, session IDs, course codes/titles, instructor names, or raw filter strings.

### 2. Centralize Debug Diagnostics Assembly for Non-Production (AIOPS-03)

Current debug payloads are duplicated across many return branches. Introduce one helper to build:

- common diagnostics (`intent`, `retrieval`, timings, counts)
- branch-specific diagnostics (`grounding`, fallback flags, filter drops, relevance gate)
- ranking-factor breakdown (non-production only): top-N candidates with `baseRelevance`, `preference`, `trainer`, `final`

This reduces drift and makes diagnostics assertable in one contract-focused test file.

### 3. Add Monitoring Surface for Production-Safe Metrics (AIOPS-01)

Expose telemetry aggregate snapshot through an existing admin-safe path (e.g., under `/api/admin/...`), or emit structured logs on an interval/request.

Minimum useful snapshot:

- total requests by intent/retrieval mode
- fallback rates (`safeFallbackUsed`, `usedJsonFallback`)
- grounding mismatch rate
- low-relevance refine rate
- rolling window counters (since process start + last N minutes if feasible)

Given current architecture, in-memory + admin endpoint is the fastest fit; note restart reset and single-process scope as known tradeoff.

### 4. Make Regression Gates Explicit and Release-Blocking (AIOPS-02)

Codify the AI safety suites as one command (e.g., `pnpm --filter api test -- ...files...`) and ensure release process treats failure as a stop condition.

Recommended gate set:

- `api/src/routes/ai.intent-routing.test.ts`
- `api/src/routes/ai.grounding-safety.test.ts`
- `api/src/routes/ai.relevance-calibration.test.ts`
- `api/src/routes/ai.memory-context.test.ts`
- new: `api/src/routes/ai.observability.test.ts` (telemetry/debug contract)

Also include `pnpm --filter api build` in the gate sequence.

## Architecture Patterns

### Pattern 1: Single Outcome Event Per Request

**What:** Emit one final quality event at every terminal response path.
**When to use:** Every `return res.json(...)` and error path in `POST /ai/course-recommendations`.

```ts
recordAiQualityEvent({
  intentMode,
  retrievalMode,
  outcomeType,
  safeFallbackUsed,
  usedJsonFallback,
  groundingStatus,
  groundingMismatch: groundingViolationCount > 0,
});
```

### Pattern 2: Shared Diagnostics Builder

**What:** One helper for debug payload composition.
**When to use:** Non-production response construction only.

```ts
const debug = buildAiDebugDiagnostics({
  intent,
  retrieval,
  counts,
  timings,
  rankingTopBreakdown,
  branch,
});
```

### Pattern 3: Cardinality-Safe Counter Store

**What:** In-memory counter map keyed by bounded enums.
**When to use:** Production-safe telemetry aggregation.

```ts
const key = `${intentMode}|${retrievalMode}|${outcomeType}|${groundingStatus}`;
counters.set(key, (counters.get(key) ?? 0) + 1);
```

### Pattern 4: Regression Gate Aggregator Script

**What:** One command that runs all AI behavior gates.
**When to use:** Pre-merge and pre-release.

```bash
pnpm --filter api test -- \
  src/routes/ai.intent-routing.test.ts \
  src/routes/ai.grounding-safety.test.ts \
  src/routes/ai.relevance-calibration.test.ts \
  src/routes/ai.memory-context.test.ts \
  src/routes/ai.observability.test.ts
```

### Anti-Patterns to Avoid

- Emitting telemetry with user prompts/course titles/instructor names.
- Using unbounded labels (course code/session key) as metric dimensions.
- Instrumenting only the “happy path” and missing fallback/error branches.
- Keeping duplicated branch-specific debug object literals in `ai.ts`.

## Don’t Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Quality telemetry storage | Ad hoc string logs with no schema | Typed telemetry recorder + bounded counters | Enables stable monitoring and deterministic tests. |
| Debug diagnostics | Per-branch copy/paste debug objects | Shared `buildAiDebugDiagnostics` helper | Prevents drift and missing fields. |
| Regression gates | Manual selective test runs | Single scripted AI gate command | Makes release blocking explicit and repeatable. |
| Ranking-factor evidence | Prompt-only “why” text for internal debugging | Structured score breakdown from `rankCandidatesWithBoundedSignals` output | Deterministic and testable. |

## Common Pitfalls

### Pitfall 1: “Telemetry” That Leaks Request Content

**What goes wrong:** Prompt/user content gets logged in production metrics.
**Why it happens:** Reusing debug payloads for production telemetry.
**How to avoid:** Separate production telemetry schema from debug schema; enforce no free-text fields.
**Warning signs:** Metrics/events contain arbitrary strings or user-entered terms.

### Pitfall 2: High-Cardinality Metric Keys

**What goes wrong:** Metrics become noisy/unusable and memory grows without bound.
**Why it happens:** Using course IDs/session IDs/filter values as dimensions.
**How to avoid:** Restrict keys to enums/booleans and small bounded sets.
**Warning signs:** Counter map size tracks traffic volume linearly.

### Pitfall 3: Missing Branch Instrumentation

**What goes wrong:** Grounding fallback/low-relevance outcomes are invisible in production telemetry.
**Why it happens:** Instrumentation only attached to success return path.
**How to avoid:** Build branch matrix and assert event emission in observability tests.
**Warning signs:** Fallback flags appear in debug but never in telemetry summary.

### Pitfall 4: Regression Suite Exists but Isn’t a Gate

**What goes wrong:** Critical tests pass locally but are skipped in release flow.
**Why it happens:** No single required gate command.
**How to avoid:** Add explicit script + document release-blocking policy in phase outputs.
**Warning signs:** Behavior regressions slip despite test files existing.

### Pitfall 5: Non-Prod Diagnostics Contract Drift

**What goes wrong:** Debug fields differ per branch, breaking QA and tests.
**Why it happens:** Repeated object literals.
**How to avoid:** Centralized diagnostics builder and schema tests.
**Warning signs:** New branch adds/omits keys unexpectedly.

## Code Examples

### Production-Safe Telemetry Event Contract

```ts
type AiQualityEvent = {
  intentMode: "conversation" | "clarify" | "recommend";
  retrievalMode: "none" | "lexical_only" | "hybrid" | "hybrid_degraded";
  outcomeType:
    | "success"
    | "grounding_fallback"
    | "filter_constraint_fallback"
    | "low_relevance_refine"
    | "empty_candidates"
    | "reset"
    | "route_error";
  groundingStatus: "passed" | "failed";
  safeFallbackUsed: boolean;
  usedJsonFallback: boolean;
  groundingMismatch: boolean;
  ts: number;
};
```

### Ranking-Factor Debug Breakdown (Non-Production)

```ts
const rankingTopBreakdown = rankedCandidates.slice(0, 8).map((item, idx) => ({
  rank: idx + 1,
  courseId: item.course.id,
  code: item.course.code,
  baseRelevance: item.scores.baseRelevance,
  preference: item.scores.preference,
  trainer: item.scores.trainer,
  final: item.scores.final,
}));
```

### Observability Regression Assertion Pattern

```ts
expect(body.debug).toMatchObject({
  intentMode: "recommend",
  retrievalMode: "lexical_only",
  groundingStatus: "passed",
  safeFallbackUsed: false,
});
expect(body.debug.rankingTopBreakdown[0]).toHaveProperty("final");
```

## State of the Art (Project-Specific)

| Current State | Phase 9 Target | Impact |
|---------------|----------------|--------|
| Non-prod debug has many quality signals; production has no structured quality telemetry. | Production-safe telemetry event stream + aggregate counters for intent/retrieval/fallback/grounding mismatch. | Satisfies AIOPS-01. |
| Strong route-level suites exist but are spread and not packaged as a release gate contract. | Explicit regression gate command and observability coverage additions. | Satisfies AIOPS-02. |
| Candidate/filter diagnostics exist, but ranking-factor breakdown is not explicitly exposed in debug contract. | Deterministic non-prod diagnostics including ranking score components. | Satisfies AIOPS-03. |

## Suggested Plan Slices

1. `09-01`: Telemetry foundation
- Add `aiQualityTelemetry` module + tests.
- Instrument all AI route outcome branches.
- Expose admin-safe summary endpoint (or equivalent monitor output).

2. `09-02`: Non-prod diagnostics contract hardening
- Refactor duplicated debug assembly to helper.
- Add ranking-factor breakdown and explicit filter-enforcement evidence fields.
- Add diagnostics schema regression tests.

3. `09-03`: Regression gate packaging
- Add `ai.observability` route test suite.
- Add single gate command/script and document release-blocking runbook.
- Verify full AI gate matrix passes.

## Open Questions

1. Should telemetry persistence remain in-memory for Phase 9, or write to DB for historical trend inspection?
2. Should monitoring surface live under existing `/api/admin/system/metrics` payload or a dedicated admin AI telemetry endpoint?
3. What retention/window is required for “monitor” in production (process lifetime vs rolling window snapshots)?
4. Should ranking-factor breakdown include only top returned cards or top candidate pool entries before final filtering/diversity?

## Sources

### Primary (HIGH confidence)

- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- `.planning/ROADMAP.md`
- `.planning/config.json`
- `.planning/phases/08-memory-and-multi-turn-context-reliability/VERIFICATION.md`
- `api/src/routes/ai.ts`
- `api/src/routes/ai.intent-routing.test.ts`
- `api/src/routes/ai.grounding-safety.test.ts`
- `api/src/routes/ai.relevance-calibration.test.ts`
- `api/src/routes/ai.memory-context.test.ts`
- `api/src/ai/relevance/rankingPolicy.ts`
- `api/src/ai/relevance/retrievalModePolicy.ts`
- `api/src/ai/relevance/relevanceSufficiencyPolicy.ts`
- `api/src/ai/grounding/groundingValidator.ts`
- `api/src/ai/grounding/filterConstraintGuard.ts`
- `api/src/ai/memory/sessionContextState.ts`
- `api/src/routes/adminPrograms.ts`
- `api/src/config/env.ts`
- `api/package.json`
- `api/vitest.config.ts`

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH (verified from repository dependencies/config).
- Architecture patterns: HIGH (directly mapped to current route branches and helper modules).
- Pitfalls/gates: HIGH (validated against existing tests and current instrumentation gaps).

**Research date:** 2026-03-06
**Valid until:** 2026-04-05

## RESEARCH COMPLETE

- Phase 9 is an instrumentation-and-gating phase, not a behavior rewrite.
- Existing route logic already computes most required quality signals; the missing layer is production-safe aggregation and explicit gate packaging.
- Best-fit implementation is: centralized debug builder (non-prod), production-safe telemetry recorder, and a single release-blocking AI regression command.
