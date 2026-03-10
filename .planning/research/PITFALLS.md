# Pitfalls Research

**Domain:** Conversational AI + Atlas-grounded course recommendations (BetterAtlas v1.2)
**Researched:** 2026-03-05
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Over-recommending on conversational turns

**What goes wrong:**
The assistant returns course lists when the user is asking a non-recommendation question (policy clarification, planning strategy, stress/friction discussion, etc.).

**Why it happens:**
Intent routing is keyword-heavy and broad (`course`, `class`, `professor`, etc.), so conversational turns are misclassified as recommendation requests.

**How to avoid:**
Add a dedicated intent classifier with at least three modes: `conversation`, `clarify`, `recommend`. Only run retrieval/ranking in `recommend` mode; in `clarify`, ask one focused question first.

**Warning signs:**
Recommendation payloads appear on turns where user language has no explicit "suggest/recommend/find classes" intent; high recommendation rate per session regardless of turn type.

**Phase to address:**
Phase 1 - Intent classification and recommendation cadence gating.

---

### Pitfall 2: Off-catalog hallucinations in assistant text

**What goes wrong:**
`assistantMessage` names courses that are not in BetterAtlas candidates, while returned recommendation cards are catalog-valid. Users see contradictory outputs and lose trust.

**Why it happens:**
Prompt-level grounding alone is not sufficient; free-form generation can still invent course references, especially when JSON-schema fallback is used.

**How to avoid:**
Post-validate `assistantMessage` against candidate IDs/codes before response. If mismatch is detected, auto-rewrite the message from selected recommendations or return a clarifying reply with no specific course names.

**Warning signs:**
Frequent mismatch between mentioned codes in text vs. `recommendations[]`; support reports of "I can’t find the class the AI mentioned."

**Phase to address:**
Phase 2 - Grounding enforcement and response validation.

---

### Pitfall 3: Stale-memory drift across multi-turn sessions

**What goes wrong:**
Older context dominates newer requests, so recommendations drift away from current user intent (changed semester, requirement, workload tolerance).

**Why it happens:**
Per-user memory is short and raw (last messages only), has no intent-aware summarization, and relies on manual reset behavior.

**How to avoid:**
Store structured session state (active constraints, rejected options, confirmed goals) separate from raw chat history; decay or clear stale constraints automatically on intent/topic shift.

**Warning signs:**
User says "not that anymore" or repeats new constraints; response still reflects earlier preferences. Reset endpoint usage climbs.

**Phase to address:**
Phase 4 - Memory lifecycle, topic-shift detection, and reset UX.

---

### Pitfall 4: Retrieval mismatch from lossy query decomposition

**What goes wrong:**
Candidate pool is weakly related to user intent, then filler courses dominate final suggestions.

**Why it happens:**
Query-term derivation drops nuance, semantic retrieval may be unavailable/empty, and fallback uses top-rated/major-biased fillers that can dilute relevance.

**How to avoid:**
Use hybrid retrieval with explicit constraint channels (GER, time, instructor, workload) and minimum relevance thresholds before fillers are allowed. If relevance is low, ask a clarifying question instead of forcing recommendations.

**Warning signs:**
Low overlap between user constraints and course metadata; high fallback usage; repeated "these don’t match what I asked" feedback.

**Phase to address:**
Phase 3 - Retrieval quality calibration and low-relevance fallback policy.

---

### Pitfall 5: Ranking bias toward globally popular courses

**What goes wrong:**
Recommendations over-index on globally boosted/popular courses and under-serve niche majors, newer courses, or under-reviewed departments.

**Why it happens:**
Global trainer scores and top-rated fillers can overpower contextual relevance and personal signals; fixed weights are not calibrated per intent segment.

**How to avoid:**
Introduce fairness-aware ranking constraints: cap global-bias impact, require contextual relevance floor, and run counterfactual evaluation across majors/departments.

**Warning signs:**
Department concentration rises despite diverse prompts; repeated appearance of same course set across different users.

**Phase to address:**
Phase 3 - Ranking calibration, fairness checks, and bias guardrails.

---

### Pitfall 6: Lack of production observability for grounding quality

**What goes wrong:**
Grounding regressions ship silently; teams detect problems only through user complaints.

**Why it happens:**
Most rich debug diagnostics are non-production only, and production logs emphasize latency over recommendation quality/grounding integrity.

**How to avoid:**
Add production-safe telemetry for: intent mode, candidate counts, grounding mismatch rate, fallback rate, recommendation acceptance, and dissatisfaction signals. Create alerts for drift thresholds.

**Warning signs:**
No dashboard for hallucination/mismatch metrics; inability to answer "how often are recommendations grounded and relevant?" within minutes.

**Phase to address:**
Phase 5 - Observability, quality metrics, and alerting.

---

### Pitfall 7: Recommendation/text desynchronization

**What goes wrong:**
Natural-language explanation and card reasons diverge, causing "why" bullets to feel generic or inconsistent with the conversation.

**Why it happens:**
Recommendations are partially reconstructed post-generation from mention extraction and fallback ranking, not directly generated as a fully coherent structured plan.

**How to avoid:**
Move to a single structured model output for both narrative and recommendation rationale, with strict server validation and deterministic formatting.

**Warning signs:**
User asks "why this class?" immediately after recommendation; reason bullets rely on generic catalog text rather than user-stated constraints.

**Phase to address:**
Phase 2 - Structured response contract and rationale grounding.

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keyword-only intent detection | Fast implementation | Persistent over-recommending and misroutes | Only for initial prototype, never for milestone exit |
| Treating JSON fallback as "good enough" | Prevents hard failures | More ungrounded text and format drift | Acceptable only with strict post-validation |
| In-process memory map only | Low infra complexity | Cross-instance inconsistency, stale context bugs | Acceptable for low-traffic dev only |
| Fixed global bias weight (`2.0`) | Simple tuning | Hidden ranking skew across cohorts | Only until offline calibration harness is available |
| Filler-heavy candidate strategy | Keeps non-empty response rate high | Relevance erosion and popularity lock-in | Only when fallback is explicitly labeled and user-confirmed |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| OpenAI JSON response mode | Assuming schema mode always succeeds | Track fallback frequency and apply server-side grounding validation on both paths |
| Embedding retrieval service | Silent failure downgrades to lexical/filler flow without quality guard | Emit explicit retrieval-mode telemetry and quality gates by mode |
| Catalog search API | Using decomposed keywords without preserving hard constraints | Pass structured filters and preserve original intent text for reranking |
| AI trainer score service | Applying stale/global scores without recency controls | TTL + versioned score snapshots + rollback switch |
| Client memory reset UX | Relying on users to manually clear drift | Add auto-reset on detected topic shift and expose clear state indicators |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Multi-query retrieval fan-out per turn | P95 latency spikes on recommendation turns | Budgeted retrieval plan with early-exit and async cancellation | Noticeable around moderate concurrent chat traffic |
| Embedding call on every recommendation-seeking turn | Higher cost and intermittent latency spikes | Cache embeddings for near-duplicate prompts in-session | Becomes expensive at sustained multi-turn usage |
| Large candidate payload context to model | Token cost growth and slower completions | Trim low-signal fields, prioritize high-relevance candidates only | Long sessions + high candidate count |
| Observability only on slow requests | Fast failures/regressions remain invisible | Capture quality telemetry on all requests, sample deeply if needed | Immediately, regardless of scale |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Accepting prompt-level grounding as sole control | Prompt injection can push off-policy content in `assistantMessage` | Enforce server-side whitelist validation against candidate catalog entities |
| Emitting sensitive debug context in shared non-prod environments | Exposure of user preference patterns and profile hints | Redact/aggregate user context fields and gate debug access by role |
| Retaining conversational memory without explicit governance | Privacy and compliance risk for educational preference data | Define retention limits, explicit deletion controls, and auditable memory policy |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Forced recommendations when user wants advice only | Feels pushy and low-trust | Intent-aware cadence with optional recommendations |
| Unexplained relevance rationale | Users cannot evaluate tradeoffs | Constraint-linked "why this" explanations tied to user-stated goals |
| Inconsistent behavior after session drift | Users repeat themselves and abandon flow | Visible memory state and clear "reset context" affordance |
| No transparent fallback messaging | Users cannot tell when AI is guessing from weak matches | Brief disclosure + clarifying question when relevance is below threshold |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Intent gating:** validated on conversational, ambiguous, and recommendation-seeking utterances with confusion matrix.
- [ ] **Grounding:** every course code in `assistantMessage` is validated against returned candidate set.
- [ ] **Retrieval quality:** low-relevance queries trigger clarification, not forced top-rated filler recommendations.
- [ ] **Ranking fairness:** recommendation distribution monitored across departments/majors with guardrail thresholds.
- [ ] **Memory behavior:** topic-shift handling tested; stale constraints are dropped or confirmed.
- [ ] **Observability:** production dashboard tracks hallucination proxy, fallback rate, and acceptance signals.

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Over-recommending | MEDIUM | Hotfix intent threshold/route rules, add clarification-first policy, replay recent prompts to verify reduction |
| Off-catalog hallucination | HIGH | Enable strict post-response entity validation, block/auto-rewrite invalid responses, run incident review on leaked cases |
| Stale-memory drift | MEDIUM | Force session memory reset for affected users, deploy topic-shift detector, notify users of context reset behavior |
| Retrieval mismatch | MEDIUM | Reduce filler influence, enable relevance floor, patch retrieval query builder, backtest with recent failed prompts |
| Ranking bias | HIGH | Lower global score weight, add per-department diversity constraints, rerun offline bias evaluation before re-enable |
| Observability gap | MEDIUM | Add emergency telemetry fields, backfill logs from API traces if available, establish alert thresholds and on-call playbook |
| Text/recommendation desync | LOW | Temporarily generate narrative from finalized recommendation objects until structured output path is complete |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Over-recommending | Phase 1 - Intent/cadence gating | Offline labeled-intent eval and staged production false-positive tracking |
| Off-catalog hallucination | Phase 2 - Grounding enforcement | Automated check: all referenced course entities exist in candidate set |
| Stale-memory drift | Phase 4 - Memory lifecycle controls | Multi-turn tests for topic change, reset behavior, and constraint carry-over |
| Retrieval mismatch | Phase 3 - Retrieval quality hardening | Relevance benchmark suite across vague, constrained, and edge-case prompts |
| Ranking bias | Phase 3 - Ranking calibration and fairness | Distribution and outcome parity checks across major/department cohorts |
| Lack of observability | Phase 5 - Metrics/alerting instrumentation | Dashboard + alert runbook verified with synthetic regression injection |
| Text/recommendation desync | Phase 2 - Structured response contract | Contract tests ensure rationale references only returned recommendation set |

## Sources

- `.planning/PROJECT.md` (v1.2 milestone goal and constraints)
- `api/src/routes/ai.ts` (intent gating, memory model, retrieval/ranking path, response shaping, debug telemetry)
- Existing BetterAtlas research baseline in `.planning/research/` (for formatting and continuity only)

---
*Pitfalls research for: conversational AI with grounded course recommendations*
*Researched: 2026-03-05*
