---
phase: 07-retrieval-and-ranking-relevance-calibration
verified: 2026-03-06T19:43:00Z
status: gaps_found
score: 9/10 must-haves verified
gaps:
  - "Recommend-mode lexical retrieval is conditional on `searchTerms.length > 0`, so explicit recommendation prompts can bypass lexical catalog search entirely."
---

# Phase 7: Retrieval and Ranking Relevance Calibration Verification Report

**Phase Goal:** Improve relevance quality with hybrid retrieval, bounded preference-aware ranking, and low-quality avoidance behavior.  
**Verified:** 2026-03-06T19:43:00Z  
**Status:** gaps_found  
**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths (from plan must_haves)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Recommend-mode lexical retrieval always executes and telemetry reports semantic state (`lexical_only`, `hybrid`, `hybrid_degraded`). | ✗ FAILED | Telemetry contract is wired (`api/src/routes/ai.ts:1133-1146`) and mode policy is explicit (`api/src/ai/relevance/retrievalModePolicy.ts:42-67`), but lexical catalog search is conditional (`if (searchTerms.length > 0)`) so some recommend requests skip lexical retrieval (`api/src/routes/ai.ts:1103-1131`). |
| 2 | Hybrid retrieval behavior is deterministic and observable through retrieval mode contract values. | ✓ VERIFIED | Retrieval mode contract and transitions are deterministic (`api/src/ai/relevance/retrievalModePolicy.ts:50-67`) and route tests assert `hybrid` and `hybrid_degraded` debug outcomes (`api/src/routes/ai.relevance-calibration.test.ts:275-307`). |
| 3 | Low-relevance pools are gated before recommendation assembly and return refine guidance with `recommendations: []`. | ✓ VERIFIED | Relevance gate runs before recommendation assembly (`api/src/routes/ai.ts:1481-1497`) and low-relevance branch returns refine guidance + empty recommendations (`api/src/routes/ai.ts:1506-1510`). Route regression validates behavior (`api/src/routes/ai.relevance-calibration.test.ts:511-566`). |
| 4 | Ranking composes base relevance + preference + trainer signals with bounded non-base contribution limits. | ✓ VERIFIED | Policy clamps preference/trainer contributions (caps 2 and 1) and computes explicit component breakdown (`api/src/ai/relevance/rankingPolicy.ts:3-4`, `api/src/ai/relevance/rankingPolicy.ts:49-68`). Route uses this policy (`api/src/routes/ai.ts:1211-1216`). |
| 5 | Preference/trainer signals improve ordering but cannot dominate through unbounded amplification. | ✓ VERIFIED | Clamp behavior and relevance-led ordering are covered in unit tests (`api/src/ai/relevance/rankingPolicy.test.ts:35-68`) and route regression with extreme trainer/preference signals keeps relevance leader ahead (`api/src/routes/ai.relevance-calibration.test.ts:309-375`). |
| 6 | Final recommendation selection enforces department diversity by default and relaxes only when concentration is explicitly required. | ✓ VERIFIED | Concentration predicate and diversity selector are explicit (`api/src/ai/relevance/diversityPolicy.ts:18-45`, `api/src/ai/relevance/diversityPolicy.ts:48-89`) and route applies them at final card selection (`api/src/routes/ai.ts:1621-1641`). Route regressions cover default diversity and explicit filter concentration (`api/src/routes/ai.relevance-calibration.test.ts:377-509`). |
| 7 | Recommend-mode semantic retrieval is conditional on embedding availability and semantic failures degrade safely without failing the request. | ✓ VERIFIED | Semantic attempt/failure handling is explicit and fail-open (`api/src/routes/ai.ts:1076-1101`), with degraded mode preserved in envelope (`api/src/ai/relevance/retrievalModePolicy.ts:53-58`) and route regression for degraded behavior (`api/src/routes/ai.relevance-calibration.test.ts:293-307`). |
| 8 | Route integration uses all relevance policies (retrieval, ranking, diversity, sufficiency) in a single calibrated pipeline. | ✓ VERIFIED | Direct wiring is present: retrieval envelope (`api/src/routes/ai.ts:1133`), bounded ranking (`api/src/routes/ai.ts:1211`), sufficiency gate (`api/src/routes/ai.ts:1487`), refine guidance (`api/src/routes/ai.ts:1494`), diversity selector (`api/src/routes/ai.ts:1636`). |
| 9 | Route-level automated regressions cover retrieval mode, bounded ranking, diversity guardrails, concentration bypass, and low-relevance fallback. | ✓ VERIFIED | Dedicated suite exists and exercises all listed scenarios (`api/src/routes/ai.relevance-calibration.test.ts:274-567`). |
| 10 | Policy-level automated regressions lock retrieval/sufficiency/ranking/diversity deterministic behavior. | ✓ VERIFIED | Policy suites cover mode transitions + semantic quota (`api/src/ai/relevance/retrievalModePolicy.test.ts:30-117`), sufficiency and deterministic guidance (`api/src/ai/relevance/relevanceSufficiencyPolicy.test.ts:7-56`), bounded ranking (`api/src/ai/relevance/rankingPolicy.test.ts:34-93`), and diversity behavior (`api/src/ai/relevance/diversityPolicy.test.ts:57-151`). |

**Score:** 9/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `api/src/ai/relevance/retrievalModePolicy.ts` | Retrieval envelope + semantic quota helpers | ✓ VERIFIED | Exports `RetrievalMode`, `RetrievalEnvelope`, `buildRetrievalEnvelope`, `enforceSemanticCandidateQuota` (`api/src/ai/relevance/retrievalModePolicy.ts:3-11`, `api/src/ai/relevance/retrievalModePolicy.ts:42-121`). |
| `api/src/ai/relevance/relevanceSufficiencyPolicy.ts` | Deterministic sufficiency gate + refine guidance helper | ✓ VERIFIED | Exports `isRelevanceSufficient` and `buildLowRelevanceRefineGuidance` (`api/src/ai/relevance/relevanceSufficiencyPolicy.ts:47-103`). |
| `api/src/ai/relevance/rankingPolicy.ts` | Bounded composite ranking helper with score breakdown | ✓ VERIFIED | Exports `RankedCandidate`, `rankCandidatesWithBoundedSignals`, `clampContribution` (`api/src/ai/relevance/rankingPolicy.ts:6-78`). |
| `api/src/ai/relevance/diversityPolicy.ts` | Deterministic department diversity selector + concentration predicate | ✓ VERIFIED | Exports `shouldAllowDepartmentConcentration` and `selectWithDepartmentDiversity` (`api/src/ai/relevance/diversityPolicy.ts:18-89`). |
| `api/src/routes/ai.ts` | Integrated relevance-calibration route pipeline | ✓ VERIFIED | Integrates all relevance policies and debug telemetry (`api/src/routes/ai.ts:1133-1146`, `api/src/routes/ai.ts:1211-1216`, `api/src/routes/ai.ts:1481-1555`, `api/src/routes/ai.ts:1621-1641`). |
| `api/src/routes/ai.relevance-calibration.test.ts` | Route-level regression suite for AIREL behaviors | ✓ VERIFIED | Dedicated suite exists with six scenario tests (`api/src/routes/ai.relevance-calibration.test.ts:274-567`). |
| `api/src/ai/relevance/retrievalModePolicy.test.ts` | Retrieval mode/quota regression suite | ✓ VERIFIED | `describe("retrievalModePolicy", ...)` plus transition/quota assertions (`api/src/ai/relevance/retrievalModePolicy.test.ts:30-117`). |
| `api/src/ai/relevance/relevanceSufficiencyPolicy.test.ts` | Sufficiency/refine-guidance regression suite | ✓ VERIFIED | `describe("relevanceSufficiencyPolicy", ...)` plus deterministic guidance assertion (`api/src/ai/relevance/relevanceSufficiencyPolicy.test.ts:7-56`). |
| `api/src/ai/relevance/rankingPolicy.test.ts` | Bounded ranking regression suite | ✓ VERIFIED | `describe("rankingPolicy", ...)` validates clamp and base-dominance behavior (`api/src/ai/relevance/rankingPolicy.test.ts:34-93`). |
| `api/src/ai/relevance/diversityPolicy.test.ts` | Diversity/concentration regression suite | ✓ VERIFIED | `describe("diversityPolicy", ...)` validates caps/backfill/bypass conditions (`api/src/ai/relevance/diversityPolicy.test.ts:57-151`). |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `api/src/routes/ai.ts` | `api/src/ai/relevance/retrievalModePolicy.ts` | retrieval envelope + semantic counters in recommend flow | ✓ WIRED | `buildRetrievalEnvelope(...)` call and debug payload wiring (`api/src/routes/ai.ts:1133-1146`). |
| `api/src/routes/ai.ts` | `api/src/ai/relevance/rankingPolicy.ts` | bounded rank ordering before recommendation assembly | ✓ WIRED | `rankCandidatesWithBoundedSignals(...)` invocation (`api/src/routes/ai.ts:1211-1221`). |
| `api/src/routes/ai.ts` | `api/src/ai/relevance/diversityPolicy.ts` | final-card selection with concentration bypass | ✓ WIRED | `shouldAllowDepartmentConcentration(...)` + `selectWithDepartmentDiversity(...)` (`api/src/routes/ai.ts:1621-1641`). |
| `api/src/routes/ai.ts` | `api/src/ai/relevance/relevanceSufficiencyPolicy.ts` | pre-card sufficiency gate and refine guidance fallback | ✓ WIRED | `isRelevanceSufficient(...)` and `buildLowRelevanceRefineGuidance(...)` (`api/src/routes/ai.ts:1487-1497`). |
| `api/src/ai/relevance/retrievalModePolicy.test.ts` | `api/src/ai/relevance/retrievalModePolicy.ts` | mode-transition + quota regression coverage | ✓ WIRED | Test imports module and asserts lexical/hybrid/degraded envelopes plus quota behavior (`api/src/ai/relevance/retrievalModePolicy.test.ts:3-6`, `api/src/ai/relevance/retrievalModePolicy.test.ts:30-117`). |
| `api/src/ai/relevance/rankingPolicy.test.ts` | `api/src/ai/relevance/rankingPolicy.ts` | bounded score component regressions | ✓ WIRED | Test imports module and asserts component values including `scores.final` (`api/src/ai/relevance/rankingPolicy.test.ts:3-6`, `api/src/ai/relevance/rankingPolicy.test.ts:45-50`). |
| `api/src/routes/ai.relevance-calibration.test.ts` | `api/src/routes/ai.ts` | in-process route execution via `postRecommendation(...)` | ✓ WIRED | Tests invoke route handlers directly and assert calibrated outputs (`api/src/routes/ai.relevance-calibration.test.ts:218-231`, `api/src/routes/ai.relevance-calibration.test.ts:281-567`). |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| AIREL-01 | 07-01, 07-03 | Hybrid retrieval path with lexical + semantic when available | ⚠ PARTIAL | Semantic path and mode telemetry are implemented (`api/src/routes/ai.ts:1076-1146`), but lexical search is conditional on non-empty derived terms (`api/src/routes/ai.ts:1103-1131`) and can be skipped. |
| AIREL-02 | 07-02, 07-03 | Bounded preference/trainer-aware ranking | ✓ SATISFIED | Hard contribution caps and bounded final scoring are implemented (`api/src/ai/relevance/rankingPolicy.ts:3-4`, `api/src/ai/relevance/rankingPolicy.ts:49-68`) and route-level behavior is tested (`api/src/routes/ai.relevance-calibration.test.ts:309-375`). |
| AIREL-03 | 07-02, 07-03 | Diversity by default, concentration only when justified | ✓ SATISFIED | Diversity selector + concentration predicate are integrated (`api/src/ai/relevance/diversityPolicy.ts:18-89`, `api/src/routes/ai.ts:1621-1641`) with route-level assertions for both branches (`api/src/routes/ai.relevance-calibration.test.ts:377-509`). |
| AIREL-04 | 07-01, 07-03 | Low-relevance refine guidance instead of forced weak recommendations | ✓ SATISFIED | Sufficiency gate and refine response branch are integrated (`api/src/routes/ai.ts:1481-1555`) and validated by route regression (`api/src/routes/ai.relevance-calibration.test.ts:511-566`). |

### Plan Requirement ID Accounting

- Requirement IDs declared in PLAN frontmatter:
  - `07-01-PLAN.md`: `AIREL-01`, `AIREL-04`
  - `07-02-PLAN.md`: `AIREL-02`, `AIREL-03`
  - `07-03-PLAN.md`: `AIREL-01`, `AIREL-02`, `AIREL-03`, `AIREL-04`
- Unique ID set from plans: `AIREL-01`, `AIREL-02`, `AIREL-03`, `AIREL-04`
- Cross-reference against `.planning/REQUIREMENTS.md`: all four IDs exist and are mapped to Phase 7 (`.planning/REQUIREMENTS.md:26-29`, `.planning/REQUIREMENTS.md:76-79`).
- Missing IDs from REQUIREMENTS: none.
- Extra Phase 7 IDs in REQUIREMENTS not present in plan frontmatter: none.

### Anti-Patterns Found

No `TODO`/`FIXME`/placeholder markers were found in the verified phase-07 relevance files.

### Verification Commands Run

- `pnpm --filter api test -- src/ai/relevance/retrievalModePolicy.test.ts src/ai/relevance/relevanceSufficiencyPolicy.test.ts src/ai/relevance/rankingPolicy.test.ts src/ai/relevance/diversityPolicy.test.ts src/routes/ai.relevance-calibration.test.ts` (pass)
- `pnpm --filter api build` (pass)

### Gaps Summary

1. Lexical retrieval is not guaranteed for every recommend-mode request because search execution is gated by non-empty derived keyword terms.
2. This leaves an AIREL-01 edge case where recommendation prompts composed mainly of stopwords (for example, generic “recommend classes please”) can bypass lexical catalog retrieval.

---

_Verified: 2026-03-06T19:43:00Z_  
_Verifier: Codex (gsd-verifier)_
