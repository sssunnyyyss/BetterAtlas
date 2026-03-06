---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Conversational Atlas-Grounded Chat
status: in_phase_execution
last_updated: "2026-03-06T18:19:30Z"
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 7
  completed_plans: 7
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-05)

**Core value:** Students can coordinate course planning with friends while quickly discovering fitting classes with AI guidance.
**Current focus:** Milestone v1.2 transition from completed phase 6 grounding safety to phase 7 retrieval/relevance calibration.

## Current Position

Phase: 7 - Retrieval and Ranking Relevance Calibration (ready)
Plan: Phase 6 complete (04/04)
Status: Ready to plan/execute 07-01
Last activity: 2026-03-06 - completed 06-04 grounding/title-mention strictness + fail-closed hard-filter gap closure (AIGRD-01, AIGRD-04)

Progress: [██████░░░░] 40%

## Performance Metrics

**Velocity:**
- Total plans completed: 19
- Average duration: 6-9 min per plan (recent phase)
- Total execution time: >1 hour cumulative

## Accumulated Context

### Decisions

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

### Pending Todos

- Start phase 7 planning/execution for hybrid retrieval and ranking relevance calibration requirements (AIREL-01..04).

### Blockers/Concerns

- None active.

## Session Continuity

Last session: 2026-03-06
Stopped at: Completed 06-04-PLAN.md
Resume file: None
