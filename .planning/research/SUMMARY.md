# Project Research Summary

**Project:** BetterAtlas
**Domain:** v1.2 conversational AI counselor + Atlas-grounded course recommendation behavior (API)
**Researched:** 2026-03-05
**Confidence:** HIGH

## Executive Summary

BetterAtlas v1.2 should ship as a behavior-correctness milestone, not a net-new surface milestone. The strongest path is to keep the current API contract and stack, then harden internal orchestration so the assistant can distinguish conversational turns from recommendation intent, ask clarifying questions when needed, and only recommend catalog-backed courses.

Research across [STACK.md](./STACK.md), [FEATURES.md](./FEATURES.md), [ARCHITECTURE.md](./ARCHITECTURE.md), and [PITFALLS.md](./PITFALLS.md) converges on one principle: retrieval and grounding quality determine user trust more than extra model complexity. The main risks are over-recommending, off-catalog mentions, relevance drift from weak retrieval/ranking, stale memory carryover, and missing production quality telemetry. The roadmap should sequence intent gating and grounding controls first, then retrieval/ranking calibration, then memory lifecycle and observability.

## Key Findings

### Recommended Stack

Use the existing Node 20 + Express + TypeScript/Zod + OpenAI wrappers + Postgres/pgvector stack, with no major platform migration for v1.2 (details: [STACK.md](./STACK.md)). This preserves endpoint compatibility and focuses effort on behavior correctness.

**Core technologies:**
- Node.js 20 + Express: stable request orchestration on current `/ai/course-recommendations` path.
- TypeScript + Zod: strict request/response validation and safer fallback behavior.
- OpenAI chat + JSON-schema fallback wrappers: conversational generation with structured outputs.
- Postgres + pgvector + Drizzle: Atlas-grounded hybrid retrieval (lexical + semantic) and hard filter enforcement.

### Expected Features

v1.2 should prioritize conversational naturalness plus strict recommendation grounding (details: [FEATURES.md](./FEATURES.md)).

**Must have (table stakes):**
- Intent-gated behavior (conversation vs recommendation).
- Catalog-only recommendations with hard filter adherence.
- Adaptive cadence (direct answer first, optional follow-up, recommendations when appropriate).
- Exclusion/memory hygiene and clear recommendation reasons.

**Should have (competitive):**
- Mention-anchored extraction so recommendation cards match assistant narrative.
- Hybrid retrieval + preference/global-signal reranking + department diversity controls.

**Defer (v2+):**
- Full multi-turn schedule construction and requirement-graph optimization.
- Long-term personalized memory systems.

### Architecture Approach

Keep `routes/ai.ts` as a contract adapter and move behavior into modular orchestration layers for intent, retrieval/ranking, grounding validation, response assembly, and short-lived state (details: [ARCHITECTURE.md](./ARCHITECTURE.md)). This minimizes regression risk while enabling targeted tests.

**Major components:**
1. Intent router: classify conversational/clarify/recommend paths.
2. Candidate retrieval + ranker: Atlas-only hybrid candidate pool with deterministic scoring.
3. Grounding/validator layer: enforce candidate-only mentions and fail closed on invalid outputs.
4. Response assembler + contract mapper: preserve existing response schema.
5. Memory/cache abstraction: bounded TTL session state with future Redis migration path.

### Critical Pitfalls

Top risks and mitigations (details: [PITFALLS.md](./PITFALLS.md)):

1. **Over-recommending on conversational turns** - enforce stricter intent modes and clarify-first branch.
2. **Off-catalog hallucinations in assistant text** - post-validate mentions against candidate set; rewrite or withhold invalid specifics.
3. **Retrieval/ranking mismatch and popularity bias** - enforce relevance floors, calibrated weights, and diversity constraints.
4. **Stale-memory drift across turns** - use structured session state with topic-shift decay/reset behavior.
5. **Missing production observability** - add quality telemetry (grounding mismatch, fallback rate, intent mode, acceptance signals).

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Intent Routing and Cadence Control
**Rationale:** Intent gating is the first dependency for both cost control and conversational quality.
**Delivers:** Clear `conversation`/`clarify`/`recommend` routing and recommendation trigger rules.
**Addresses:** Intent-aware behavior and adaptive cadence requirements.
**Avoids:** Over-recommending pitfall.

### Phase 2: Grounding Enforcement and Structured Response Validation
**Rationale:** Trust-critical grounding must be locked before deeper ranking iteration.
**Delivers:** Candidate-only mention validation, structured response checks, safe fallback/rewrite logic.
**Uses:** Existing OpenAI JSON/chat wrapper fallback patterns.
**Implements:** Grounding policy + output validator + contract mapper.

### Phase 3: Retrieval and Ranking Relevance Calibration
**Rationale:** After safe gating/grounding, relevance quality becomes primary leverage.
**Delivers:** Hybrid retrieval thresholds, low-relevance clarify fallback, calibrated preference/global scoring, diversity controls.
**Addresses:** Relevance and fairness risks.
**Avoids:** Filler-dominated and popularity-lock recommendations.

### Phase 4: Memory Lifecycle and Topic-Shift Handling
**Rationale:** Multi-turn drift is best solved after core routing and ranking behavior stabilizes.
**Delivers:** Structured short-term memory state, stale-constraint decay, topic-shift reset logic.
**Implements:** Memory abstraction hardening without contract change.

### Phase 5: Production Quality Telemetry and Regression Gates
**Rationale:** Final phase turns behavior rules into enforceable release guardrails.
**Delivers:** Metrics/alerts for grounding mismatch, fallback usage, intent distribution, recommendation acceptance; expanded regression suite.
**Addresses:** Silent regression risk and milestone exit confidence.

### Phase Ordering Rationale

- Intent gating first prevents wasted retrieval/LLM calls and avoids forced recommendations.
- Grounding second prevents hallucinated course mentions before relevance tuning.
- Retrieval/ranking third improves recommendation quality once policy safety is in place.
- Memory fourth reduces drift after core per-turn behavior is stable.
- Observability last formalizes release gates across all prior phases.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** Structured-output reliability under JSON fallback and robust mention validation edge cases.
- **Phase 3:** Ranking fairness calibration across departments/majors and relevance threshold tuning.
- **Phase 4:** Topic-shift detection heuristics versus false resets in real multi-turn usage.

Phases with standard patterns (skip research-phase):
- **Phase 1:** Rule-first intent routing and cadence branching are established API patterns.
- **Phase 5:** Metrics instrumentation and regression gating follow standard backend quality practices.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Uses existing, verified runtime/dependency patterns and avoids migration risk. |
| Features | HIGH | Must-have behavior scope is clear and aligned to milestone goal/constraints. |
| Architecture | HIGH | Modular orchestration pattern directly matches current monolith pain points. |
| Pitfalls | HIGH | Risks map cleanly to known failure modes in current route behavior. |

**Overall confidence:** HIGH

### Gaps to Address

- **Intent quality targets:** define measurable false-positive/false-negative thresholds for recommendation triggering.
- **Grounding acceptance criteria:** define strict pass/fail policy for assistant text mention mismatches.
- **Ranking fairness thresholds:** set department/major skew guardrails before launch sign-off.

## Sources

### Primary (HIGH confidence)
- [PROJECT.md](../PROJECT.md) - milestone v1.2 goal and constraints.
- [STACK.md](./STACK.md) - recommended runtime/dependency strategy.
- [FEATURES.md](./FEATURES.md) - table stakes, differentiators, MVP scope.
- [ARCHITECTURE.md](./ARCHITECTURE.md) - orchestration/module boundaries and flow.
- [PITFALLS.md](./PITFALLS.md) - failure modes, anti-patterns, and phase mapping.

### Secondary (MEDIUM confidence)
- `api/src/routes/ai.ts`, `api/src/services/courseService.ts`, and OpenAI wrapper modules referenced in research docs.

---
*Research completed: 2026-03-05*
*Ready for roadmap: yes*
