# Requirements: BetterAtlas v1.2 Conversational Atlas-Grounded Chat

**Defined:** 2026-03-05
**Core Value:** Students can coordinate course planning with friends through shared planning workflows while quickly discovering fitting classes with reliable AI guidance.

## v1 Requirements

Requirements for milestone v1.2. Each requirement must map to exactly one roadmap phase.

### Intent Routing and Conversation Cadence

- [x] **AIINT-01**: User can have normal conversational turns without receiving forced course recommendations unless recommendation intent is explicit.
- [x] **AIINT-02**: User with an ambiguous recommendation request receives a concise clarifying follow-up question before course suggestions are returned.
- [x] **AIINT-03**: User turn intent is classified into deterministic modes (`conversation`, `clarify`, `recommend`) that consistently control retrieval and response behavior.
- [x] **AIINT-04**: User sending trivial greetings gets a fast conversational reply without unnecessary recommendation retrieval.

### Atlas Grounding and Recommendation Safety

- [ ] **AIGRD-01**: User sees specific course codes/titles in assistant replies only when those courses exist in the active BetterAtlas candidate set.
- [ ] **AIGRD-02**: User never receives recommendations for excluded or explicitly disliked courses in the same session.
- [ ] **AIGRD-03**: User receives a safe fallback response (no fabricated specific course names) whenever grounding validation fails.
- [ ] **AIGRD-04**: User receives recommendations that obey active catalog filters (semester/department/rating/credits/attribute/instructor/campus/component/instruction method) as hard constraints.

### Retrieval and Ranking Relevance

- [ ] **AIREL-01**: User recommendation requests use a hybrid retrieval path (lexical + semantic when available) that improves match quality for natural-language prompts.
- [ ] **AIREL-02**: User receives recommendations ranked with bounded preference signals (liked/disliked examples) and trainer quality signals.
- [ ] **AIREL-03**: User recommendation lists maintain department diversity unless the request or filters clearly demand concentration.
- [ ] **AIREL-04**: User receives refinement guidance instead of low-quality forced recommendations when relevant candidates are insufficient.

### Memory and Multi-Turn Context Reliability

- [ ] **AIMEM-01**: User chat memory is isolated per user session, TTL-bounded, and clearable through explicit reset behavior.
- [ ] **AIMEM-02**: User topic shifts cause stale recommendation constraints to decay or reset so new intent is prioritized.
- [ ] **AIMEM-03**: User latest-turn intent and constraints are prioritized over older turns during recommendation generation.

### Observability and Regression Gates

- [ ] **AIOPS-01**: Team can monitor production-safe AI quality telemetry including intent mode, retrieval mode, fallback usage, and grounding mismatch indicators.
- [ ] **AIOPS-02**: Team has automated regression tests that verify intent gating, Atlas grounding, exclusion handling, and empty/low-relevance behaviors.
- [ ] **AIOPS-03**: Team can inspect non-production debug diagnostics for candidate composition, filter enforcement, and ranking factors.

## v2 Requirements

Deferred to future milestones.

### Advanced Recommendation Intelligence

- **AIV2-04**: User benefits from a learned intent classifier calibrated from real conversation outcomes.
- **AIV2-05**: User gets dynamic recommendation cadence tuned by confidence and conversation state.
- **AIV2-06**: User receives deeper requirement-aware schedule optimization across multiple courses/sections.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full AI schedule auto-builder with section-time conflict resolution | Larger product scope than behavior hardening milestone |
| New frontend chat redesign surfaces | v1.1 completed major UX redesign; v1.2 prioritizes behavior correctness |
| Non-Atlas external course recommendation sources | Violates strict grounding objective for this milestone |
| Long-term permanent memory profiles | Requires separate consent/privacy architecture and broader product decision |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AIINT-01 | Phase 5 | Mapped |
| AIINT-02 | Phase 5 | Mapped |
| AIINT-03 | Phase 5 | Mapped |
| AIINT-04 | Phase 5 | Mapped |
| AIGRD-01 | Phase 6 | Mapped |
| AIGRD-02 | Phase 6 | Mapped |
| AIGRD-03 | Phase 6 | Mapped |
| AIGRD-04 | Phase 6 | Mapped |
| AIREL-01 | Phase 7 | Mapped |
| AIREL-02 | Phase 7 | Mapped |
| AIREL-03 | Phase 7 | Mapped |
| AIREL-04 | Phase 7 | Mapped |
| AIMEM-01 | Phase 8 | Mapped |
| AIMEM-02 | Phase 8 | Mapped |
| AIMEM-03 | Phase 8 | Mapped |
| AIOPS-01 | Phase 9 | Mapped |
| AIOPS-02 | Phase 9 | Mapped |
| AIOPS-03 | Phase 9 | Mapped |

**Coverage:**
- v1 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0 ✓
- Phase 5 coverage: 4 requirements
- Phase 6 coverage: 4 requirements
- Phase 7 coverage: 4 requirements
- Phase 8 coverage: 3 requirements
- Phase 9 coverage: 3 requirements

---
*Requirements defined: 2026-03-05*
*Last updated: 2026-03-05 after completing Phase 5 Plan 03*
