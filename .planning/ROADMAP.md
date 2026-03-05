# Roadmap: BetterAtlas

## Milestones

- ✅ **v1.0 Program Toggle Accuracy** — Phase 1 (2/2 plans, shipped 2026-02-26). Archive: [.planning/milestones/v1.0-ROADMAP.md](./milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 AI Chat Experience Redesign** — Phases 2-4 (9/9 plans, shipped 2026-03-03). Archive: [.planning/milestones/v1.1-ROADMAP.md](./milestones/v1.1-ROADMAP.md)
- 🚧 **v1.2 Conversational Atlas-Grounded Chat** — Phases 5-9 (roadmap defined 2026-03-05)

## Active Milestone: v1.2 Conversational Atlas-Grounded Chat

**Goal:** Deliver a natural conversational AI counselor that recommends accurate BetterAtlas catalog courses when contextually appropriate, without forcing recommendations in every turn.

**Status:** Roadmap ready, phase planning not started  
**Phase range:** 5-9  
**Requirement coverage:** 18/18 mapped (100%)

## Phase Table

| Phase | Name | Requirement IDs | Status |
|-------|------|-----------------|--------|
| 5 | Intent Routing and Conversation Cadence | AIINT-01, AIINT-02, AIINT-03, AIINT-04 | Ready |
| 6 | Atlas Grounding and Recommendation Safety | AIGRD-01, AIGRD-02, AIGRD-03, AIGRD-04 | Ready |
| 7 | Retrieval and Ranking Relevance Calibration | AIREL-01, AIREL-02, AIREL-03, AIREL-04 | Ready |
| 8 | Memory and Multi-Turn Context Reliability | AIMEM-01, AIMEM-02, AIMEM-03 | Ready |
| 9 | Observability and Regression Gates | AIOPS-01, AIOPS-02, AIOPS-03 | Ready |

## Phase Details

### Phase 5: Intent Routing and Conversation Cadence

**Goal:** Ensure recommendation retrieval and generation only happen when user intent warrants it, with clarify-first behavior for ambiguous asks.  
**Depends on:** Existing v1.1 chat contract and request pipeline  
**Mapped requirements:** AIINT-01, AIINT-02, AIINT-03, AIINT-04

**Observable success criteria:**
- Trivial greeting turns return conversational responses without recommendation retrieval.
- Ambiguous recommendation asks produce a concise clarifying follow-up before any course list is returned.
- Intent mode is deterministically one of `conversation`, `clarify`, or `recommend` for repeated equivalent inputs.
- Recommendation retrieval is triggered only in `recommend` mode, not in pure conversational turns.

### Phase 6: Atlas Grounding and Recommendation Safety

**Goal:** Enforce strict catalog grounding and hard safety constraints on recommendation outputs.  
**Depends on:** Phase 5  
**Mapped requirements:** AIGRD-01, AIGRD-02, AIGRD-03, AIGRD-04

**Observable success criteria:**
- Any specific course code/title mentioned in assistant output is present in the active candidate set.
- Session-level excluded/disliked courses are absent from recommended results and assistant specific mentions.
- Grounding validation failures return safe fallback text with no fabricated specific course names.
- Active catalog filters are enforced as hard constraints for all returned recommendations.

### Phase 7: Retrieval and Ranking Relevance Calibration

**Goal:** Improve relevance quality with hybrid retrieval, bounded preference-aware ranking, and low-quality avoidance behavior.  
**Depends on:** Phase 6  
**Mapped requirements:** AIREL-01, AIREL-02, AIREL-03, AIREL-04

**Observable success criteria:**
- Recommendation requests use lexical retrieval plus semantic retrieval when embedding support is available.
- Ranking uses bounded preference and trainer-quality signals without unbounded score amplification.
- Department diversity is maintained in recommendation lists unless query intent/filters require concentration.
- When relevance is insufficient, the assistant gives refinement guidance instead of forcing low-quality recommendations.

### Phase 8: Memory and Multi-Turn Context Reliability

**Goal:** Keep short-term memory reliable, bounded, and responsive to topic shifts so new intent takes priority.  
**Depends on:** Phase 7  
**Mapped requirements:** AIMEM-01, AIMEM-02, AIMEM-03

**Observable success criteria:**
- Memory is isolated by user session, TTL-bounded, and clearable through explicit reset behavior.
- Topic shifts decay or reset stale recommendation constraints before applying new intent.
- Latest-turn intent and constraints are prioritized over older conversational context during recommendation generation.

### Phase 9: Observability and Regression Gates

**Goal:** Add production-safe quality telemetry and release-blocking regression gates for intent, grounding, and relevance safety.  
**Depends on:** Phase 8  
**Mapped requirements:** AIOPS-01, AIOPS-02, AIOPS-03

**Observable success criteria:**
- Production-safe telemetry captures intent mode, retrieval mode, fallback usage, and grounding mismatch indicators.
- Automated regression suites verify intent gating, grounding policy, exclusion handling, and low/empty relevance behavior.
- Non-production diagnostics expose candidate composition, filter enforcement evidence, and ranking-factor breakdowns.

## Next Up

- Plan and execute Phase 5 workstream.

---
*Last updated: 2026-03-05 after defining milestone v1.2 roadmap*
