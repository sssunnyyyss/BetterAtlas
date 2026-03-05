# Feature Research

**Domain:** Conversational AI counselor behavior for BetterAtlas catalog recommendations
**Researched:** 2026-03-05
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Intent-gated response mode (conversation vs recommendations) | Users expect normal chat unless they ask for classes | MEDIUM | Gate recommendation pipeline behind explicit course intent; avoid forced lists on casual turns |
| Atlas-grounded recommendation policy | Students expect suggested classes to exist in their catalog | HIGH | Only recommend from retrieved candidate set; never invent course codes/titles |
| Hard filter adherence | Users expect active filters to be respected | MEDIUM | Treat semester/department/rating/credits/etc. as constraints, not hints |
| Recommendation cadence control | Users expect adaptive depth, not list spam every turn | MEDIUM | Support direct answer first, optional one follow-up question, and recommendations only when useful |
| Exclusion and memory hygiene | Users expect “don’t show this again” and stable context | MEDIUM | Honor `excludeCourseIds`, dislike signals, and resettable per-user memory |
| Explainable recommendation reasons | Users need quick trust signals to act | MEDIUM | Generate concise `why` bullets from catalog facts and preference/query matches |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Mention-anchored recommendation extraction | Ensures rec cards match what assistant actually said | HIGH | Parse assistant output for course mentions and map cards from those mentions first |
| Hybrid retrieval with semantic quota + lexical fallback | Better recall on natural language prompts and specific queries | HIGH | Blend embedding search, keyword search, and filler pools while keeping candidate context bounded |
| Preference + global quality signal ranking | Improves relevance beyond raw text match | HIGH | Combine user liked/disliked examples with aggregate trainer scores for reranking |
| Department diversity controls | Prevents narrow, repetitive rec sets | MEDIUM | Interleave by department and cap per-department dominance |
| Built-in recommendation quality telemetry | Enables fast iteration without UI changes | MEDIUM | Emit debug metrics: candidate counts, semantic coverage, filters, boosted/demoted stats |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| “Always recommend courses on every turn” | Feels more proactive | Breaks natural conversation and produces irrelevant list churn | Intent-gated mode with conversational-first replies |
| Ungrounded suggestions from model prior knowledge | Seems broader/smarter | Hallucinated or non-catalog courses erode trust fast | Strict candidate-list grounding and mention extraction |
| Unlimited conversation memory | Seems more personalized | Increases drift, latency, and privacy risk | Short TTL memory with explicit `reset` and bounded turns |
| Hard-coding CS/tech defaults | Can boost perceived relevance for some users | Biases outputs and harms non-CS students | Major as hint only, with request-driven domain selection |
| Maximal metadata in every recommendation card | Seems “transparent” | Cognitive overload and worse scanability | Short `why` + cautions with progressive detail on demand |

## Feature Dependencies

```
[Intent Detection]
    └──requires──> [Prompt/Message Normalization]
                       └──requires──> [Per-User Memory + Reset Controls]

[Catalog Grounding]
    └──requires──> [Candidate Retrieval (keyword + semantic + filters)]
                       └──requires──> [Embedding Availability + Course Search]

[Recommendation Cadence]
    └──requires──> [Intent Detection]
    └──requires──> [Structured Response Contract (assistant_message + follow_up_question)]

[Quality Signals Ranking]
    └──requires──> [Preference Signal Intake]
    └──requires──> [Global Trainer Scores Cache]
    └──enhances──> [Catalog Grounding]

[Ungrounded Freeform Suggestions] ──conflicts──> [Catalog Grounding]
[Always-On Recommendation Lists] ──conflicts──> [Recommendation Cadence]
```

### Dependency Notes

- **Intent detection requires normalized context:** recommendation gating is only reliable when latest user turn and bounded memory are consistently shaped.
- **Grounding requires retrieval quality first:** if candidate retrieval is weak, downstream ranking and explanations cannot recover.
- **Cadence depends on structured response fields:** separation of assistant answer and optional follow-up enables turn-level control.
- **Quality signal ranking depends on clean feedback data:** liked/disliked examples and trainer scores must be bounded, deduped, and cached.
- **Ungrounded output conflicts with trust goals:** any bypass of candidate constraints introduces high-risk hallucination regressions.

## MVP Definition

### Launch With (v1)

- [ ] Intent-gated behavior that keeps non-course turns conversational and recommendation turns catalog-aware
- [ ] Strict candidate-list grounding for all specific course mentions and recommendation cards
- [ ] Hard-constraint filter enforcement across retrieval and fallback paths
- [ ] Adaptive cadence: direct response first, optional concise follow-up, recommendations only when contextually appropriate
- [ ] Baseline quality reranking using user preference signals and global trainer scores
- [ ] Regression coverage for grounding, intent gating, exclusion handling, and empty-result behavior

### Add After Validation (v1.x)

- [ ] Learned intent classifier replacing phrase heuristics when false positives/negatives exceed target
- [ ] Dynamic cadence policy tuned by conversation state (confidence, ambiguity, prior acceptance/rejection)
- [ ] Quality signal calibration loops (weight tuning, guardrail thresholds, counter-bias checks)
- [ ] Better explanation quality scoring (specificity, non-generic rationale rate)

### Future Consideration (v2+)

- [ ] Multi-turn schedule construction with conflict-aware section selection and tradeoff explanations
- [ ] Program/degree requirement graph integration for requirement-coverage optimization
- [ ] Personalized long-term memory with explicit user controls and auditability
- [ ] Offline evaluation harness with human preference labeling at scale

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Intent-gated recommendation trigger | HIGH | MEDIUM | P1 |
| Catalog-grounded candidate-only recommendations | HIGH | HIGH | P1 |
| Hard filter constraint enforcement | HIGH | MEDIUM | P1 |
| Adaptive recommendation cadence | HIGH | MEDIUM | P1 |
| Preference + trainer-score reranking | HIGH | HIGH | P1 |
| Recommendation explanation quality checks | MEDIUM | MEDIUM | P2 |
| Learned intent model + threshold tuning | MEDIUM | MEDIUM | P2 |
| Full schedule co-planning and requirement optimization | HIGH | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Competitor A | Competitor B | Our Approach |
|---------|--------------|--------------|--------------|
| Recommendation trigger behavior | Generic chat often over-recommends | Rule-based planners under-converse | Intent-gated: conversation-first unless recommendation intent is clear |
| Grounding strategy | Broad web/model prior knowledge | Catalog-only but rigid query UX | Catalog-only grounding with conversational UX and hybrid retrieval |
| Recommendation cadence | Long unstructured text, weak cadence control | Static list output with low adaptivity | Direct answer + optional follow-up + scoped recommendation payload |
| Quality signals | Limited local personalization | Basic filter matching only | Preference examples + global trainer feedback + diversity controls |

## Sources

- BetterAtlas project context: `.planning/PROJECT.md` (v1.2 goals and constraints)
- BetterAtlas implementation context: `api/src/routes/ai.ts` (intent gating, retrieval, grounding, reranking, telemetry)
- Existing BetterAtlas research conventions and template structure

---
*Feature research for: BetterAtlas conversational AI counselor behavior*
*Researched: 2026-03-05*
