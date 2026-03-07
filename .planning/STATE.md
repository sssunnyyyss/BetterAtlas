---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: Conversational Atlas-Grounded Chat
status: unknown
last_updated: "2026-03-07T02:32:52.845Z"
progress:
  total_phases: 9
  completed_phases: 9
  total_plans: 28
  completed_plans: 28
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-05)

**Core value:** Students can coordinate course planning with friends while quickly discovering fitting classes with AI guidance.
**Current focus:** Milestone v1.2 phase 9 completed; observability regressions and release-blocking AI gate command are now packaged and documented.

## Current Position

Phase: 9 - Observability and Regression Gates (complete)
Plan: 09-03 complete (03/03 summaries)
Status: Phase 9 complete; AI observability and behavior regressions are now enforced through a single release-blocking gate command with runbook guidance.
Last activity: 2026-03-07 - completed 09-03 observability route regressions + gate scripts + release policy runbook (AIOPS-02, AIOPS-01 reinforcement)

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**
- Total plans completed: 28
- Average duration: 6-9 min per plan (recent phase)
- Total execution time: >1 hour cumulative
- Latest execution: Plan 09-03 in 3 min (3 tasks, 4 implementation/docs files + planning docs)

## Accumulated Context

### Decisions

- [Plan 09-02 diagnostics contract]: Added `buildAiDebugDiagnostics` + `buildRankingTopBreakdown` as the single non-production diagnostics assembly contract with stable default keys.
- [Plan 09-02 route parity]: Replaced duplicated branch-local `debug` literals in `POST /ai/course-recommendations` with centralized helper generation behind a shared production gate wrapper.
- [Plan 09-02 regression lock]: Expanded `ai.relevance-calibration` assertions to enforce ranking breakdown shape and filter evidence semantics across recommend outcomes.
- [Plan 09-01 telemetry contract]: Added a dedicated bounded telemetry recorder with enum/boolean-only dimensions and deterministic aggregate snapshot/rate APIs.
- [Plan 09-01 route instrumentation]: Instrumented every terminal response branch in `POST /ai/course-recommendations` to emit exactly one quality telemetry event per outcome.
- [Plan 09-01 admin monitoring]: Exposed `aiQualityTelemetry` snapshot in `/api/admin/system/metrics` under existing `requireAuth` + admin middleware protections.
- [Plan 08-03 frontend request contract]: Extend frontend AI request typing to support prompt/session and reset/session payloads while preserving `messages` compatibility for non-first-party callers.
- [Plan 08-03 first-party payload policy]: Use stable per-tab `sessionId` from `sessionStorage` and send prompt-first mutation payloads for send/retry/deep-link flows.
- [Plan 08-03 reset parity]: Route reset through `{ reset: true, sessionId }` to clear server memory on the same session channel used by active turns.
- [Plan 08-02 session-key route contract]: Extend `POST /ai/course-recommendations` with optional `sessionId`, resolve stable session keys, and route memory/blocklist reads/writes/clears through session-keyed helpers (including anonymous session-key support).
- [Plan 08-02 blocklist parity]: Align `sessionBlocklistState` with chat session keys so exclusions/dislikes and reset semantics remain isolated per session ID for the same authenticated user.
- [Plan 08-02 recommend context policy]: Apply deterministic precedence (explicit current > latest-turn inferred > prior inferred), run topic-shift decay before recommend-mode context reuse, and persist resolved constraints/fingerprint in session context after each recommend turn.
- [Plan 08-02 retrieval integration]: Keep explicit request filters as hard constraints while feeding resolved memory constraints into retrieval term derivation to avoid stale-topic dominance without over-constraining candidate filters.
- [Plan 08-02 regression lock]: Add dedicated route-level `ai.memory-context` tests for same-user multi-session isolation, reset scope targeting, topic-shift decay behavior, latest-turn explicit override, and `messages` backward compatibility.
- [Plan 08-01 session context isolation]: Introduce `sessionContextState` as the canonical session-keyed context store with authenticated/anonymous/fallback key derivation, TTL expiry, bounded history, and explicit clear/upsert APIs.
- [Plan 08-01 topic-shift policy]: Detect topic shifts deterministically from shift phrases, token-overlap signals, and explicit negation contradictions, then decay stale inferred context predictably.
- [Plan 08-01 precedence contract]: Resolve constraints by strict deterministic ordering: explicit current request > latest-turn inferred > prior inferred.
- [Plan 06-04 title-only grounding]: Treat bounded course-like title spans after recommendation triggers as `unknown_mention` violations when they do not map to active candidate titles.
- [Plan 06-04 hard-filter metadata policy]: Enforce fail-closed behavior for active semester/component/instruction filters when recommendation metadata is missing.
- [Plan 06-04 regression matrix]: Route-level grounding safety tests must cover title-only hallucinations and hard-filter enforcement across semester/credits/attributes/instructor/campus/component/instruction dimensions.
- [Plan 06-03 output safety gate]: Enforce active recommendation filters at final response assembly using deterministic `courseSatisfiesAiFilters` predicates and dropped-card accounting.
- [Plan 06-03 fail-closed filter policy]: If post-assembly filter enforcement drops all recommendations after model generation, return deterministic safe grounding fallback with empty recommendation cards.
- [Plan 06-03 regression lock]: Route-level safety tests must cover off-catalog mentions, session blocklist carryover, hard filter constraints, and JSON fallback path parity.
- [Plan 06-02 exclusion persistence]: Merge request exclusions/dislikes with per-user TTL session blocklist and treat the merged set as the single blocked-ID policy.
- [Plan 06-02 grounding alignment]: Pass merged blocked IDs into grounding validation and fail closed with safe fallback when grounding checks fail.
- [Plan 06-02 reset parity]: Clear session blocklist state when `reset=true` alongside user memory reset behavior.
- [Plan 06-01 grounding contracts]: Normalize course-code mentions to a canonical compact token while accepting `CS170`, `CS 170`, and `CS-170` surface forms.
- [Plan 06-01 grounding safety]: Treat unknown explicit course mentions and blocked-candidate mentions as hard grounding failures (`unknown_mention` / `blocked_mention`).
- [Plan 06-01 fallback policy]: Use deterministic safe fallback text with no specific catalog course entities and an empty recommendation list payload.
- [Milestone v1.2 kickoff]: Focus AI chat on conversational quality with context-aware recommendation cadence and strict Atlas-grounded suggestions.
- [Milestone v1.2 roadmap]: Sequence milestone into phases 5-9 (intent routing, grounding safety, retrieval/ranking calibration, memory reliability, observability/regression gates).
- [Milestone v1.2 roadmap]: Map all 18 v1.2 requirements one-to-one to exactly one phase with no cross-phase duplication.
- [Plan 05-01 intent routing]: Establish explicit `IntentMode` contract (`conversation` | `clarify` | `recommend`) with deterministic rule ordering.
- [Plan 05-01 intent routing]: Normalize prompt variants (case, punctuation, spacing) before signal extraction to prevent mode drift.
- [Plan 05-01 intent routing]: Protect course-code detection from semester/year false positives (e.g., "Fall 2026").
- [Plan 05-02 cadence routing]: Route-level behavior now branches strictly by `decision.mode` (`conversation`, `clarify`, `recommend`) before any retrieval work.
- [Plan 05-02 cadence routing]: Ambiguous recommendation asks return deterministic clarify-first assistant text with a single non-null follow-up question and zero recommendations.
- [Plan 05-02 cadence routing]: Non-production debug payloads now expose `intentMode`, `intentReason`, and `retrievalSkipped` for branch verification.
- [Plan 05-03 greeting fast-path]: Trivial greeting handling now exits before recommendation-only setup (filters/preferences/user retrieval dependencies), keeping greeting turns lightweight.
- [Plan 05-03 regression gate]: Route-level intent cadence tests now cover greeting, conversation, clarify, and recommend fixtures with explicit no-retrieval assertions for greetings.
- [Plan 05-03 test determinism]: Intent-routing route tests execute in-process (no socket binding) with fresh fixtures per run for stable CI/sandbox behavior.
- Phase 1 prioritized toggle correctness over broad UI redesign.
- [Phase 01-program-and-major-toggle-accuracy]: Use trimmed/lowercased strict name matching first, with normalized fallback only when strict candidates cannot provide both kinds.
- [Phase 01-program-and-major-toggle-accuracy]: Rank variant candidates by exact degree affinity before lexical/id tie-breakers.
- [Phase 01-program-and-major-toggle-accuracy]: Filter listPrograms to active rows and deterministic ordering for stable catalog selection.
- [Phase 01-program-and-major-toggle-accuracy]: Frontend selector logic is centralized in programVariantSelection utilities for options, toggles, and tab canonicalization.
- [Phase 01-program-and-major-toggle-accuracy]: Program-mode major/minor switching now prefers previous same-kind selections before degree-aware deterministic fallback.
- [Phase 01-program-and-major-toggle-accuracy]: AI summary/highlights contribute bounded deterministic ranking boosts with stable fallback ordering.
- [Milestone v1.1 kickoff]: Scope is a complete AI chat UI polish/redesign with API compatibility preserved.
- [Milestone v1.1 roadmap]: Sequence work as foundation → interaction smoothness → cards + quality hardening.
- [Plan 02-01 chat foundation]: Centralize AI chat send/reset/deep-link orchestration in `useChatSession` while keeping request payload semantics unchanged.
- [Plan 02-01 chat foundation]: Route and embedded AI chat must render via the same `ChatShell` header/feed/composer contract.
- [Plan 02-02 visual hierarchy]: Use tokenized role/status styling so user/assistant and lifecycle visuals remain consistent across components.
- [Plan 02-02 visual hierarchy]: Neutralize global textarea min-height/resize only within chat composer via a local CSS class override.
- [Plan 02-03 responsive hardening]: Use explicit `ChatShell` standalone/embedded variants with bounded feed/composer zones to avoid clipping and overlap.
- [Phase 02 verification]: Lock core chat foundation behavior with automated `AiChat.foundation` tests plus a repeatable breakpoint QA checklist.
- [Plan 03-01 mobile composer ergonomics]: Apply `useComposerViewport` keyboard insets at the ChatShell composer zone to keep input controls reachable without changing shell decomposition.
- [Plan 03-01 mobile composer ergonomics]: Model keyboard-open behavior in tests with deterministic VisualViewport mocks instead of user-agent heuristics.
- [Plan 03-02 transitions]: Track request lifecycle metadata (sequence/reason/timing) in session state for deterministic state progression.
- [Plan 03-02 transitions]: Gate turn/status animations and scroll behavior by reduced-motion preference and user intent to avoid jitter.
- [Plan 03-03 recovery/onboarding]: Retry replays retained failed payload and preserves conversation context instead of adding duplicate prompt turns.
- [Plan 03-03 recovery/onboarding]: Starter chips use deterministic structured intents and display only for zero-turn states.
- [Plan 04-01 recommendation cards]: Split recommendation UI into dedicated card/disclosure primitives with scan-first hierarchy and explicit detail CTA.
- [Plan 04-02 accessibility hardening]: Standardize keyboard focus affordances via shared chat focus-ring semantics and enforce reduced-motion parity in interactive disclosures.
- [Plan 04-03 performance hardening]: Memoize recommendation rendering paths and add render-count regression tests to prevent request-state-only rerender churn.
- [Phase 07]: Cap preference contribution at +/-2.0 and trainer contribution at +/-1.0 in ranking policy.
- [Phase 07]: Enforce department diversity at final recommendation selection and only relax caps for explicit concentration intent/filters.
- [Phase 07]: Represent recommendation retrieval with explicit retrieval modes (lexical_only/hybrid/hybrid_degraded) and semantic attempt/availability accounting.
- [Phase 07]: Gate recommendation output on deterministic top-k base relevance plus matched-term coverage; return refine guidance with empty recommendations when insufficient.
- [Phase 07]: Semantic retrieval failures are surfaced as hybrid_degraded telemetry while recommend requests continue on lexical candidates.
- [Phase 07]: Recommendation ranking now uses bounded preference (+/-2) and trainer (+/-1) signals on top of base relevance.
- [Phase 07]: Low-relevance candidate pools return deterministic refine guidance with recommendations: [] instead of weak forced cards.
- [Plan 07-04 lexical fallback]: Recommend-mode lexical retrieval always executes a primary search call, using normalized prompt text when derived terms are empty.
- [Plan 07-04 broadening policy]: Per-term lexical broadening remains gated to `searchTerms.length > 1` while preserving existing relevance calibration flow.
- [Plan 07-04 regression lock]: Route-level relevance calibration tests now assert lexical invocation and lexical_only telemetry for empty-derived-term prompts.
- [Phase 09]: Adopted a single test:ai:gates release command to run build plus all AI route regression suites. — Prevents per-suite command drift and enforces one CI/release invocation path.
- [Phase 09]: Added a dedicated ai.observability route test suite for telemetry outcome and debug environment contract coverage. — Isolating observability checks keeps failures actionable without coupling unrelated behavior suites.
- [Phase 09]: Documented gate failures as release-blocking in docs/ai-regression-gates.md. — Aligns operational policy with automated AI safety and observability regression guarantees.

### Pending Todos

- None.

### Blockers/Concerns

- None active.

## Session Continuity

Last session: 2026-03-07
Stopped at: Completed 09-observability-and-regression-gates-03-PLAN.md
Resume file: None
