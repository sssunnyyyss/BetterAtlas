---
phase: 06-atlas-grounding-and-recommendation-safety
verified: 2026-03-06T18:00:54Z
status: gaps_found
score: 7/9 must-haves verified
gaps:
  - truth: "Specific course mentions in assistant text are accepted only when they map to the active candidate set."
    status: failed
    reason: "Unknown code mentions are rejected, but unknown title-only mentions are not detected by grounding validation."
    artifacts:
      - path: "api/src/ai/grounding/groundingValidator.ts"
        issue: "Validation only marks unknown code mentions; title checks only look for candidate titles and do not detect fabricated non-candidate titles."
      - path: "api/src/routes/ai.grounding-safety.test.ts"
        issue: "Route regression suite tests off-catalog code mentions but not fabricated title-only mentions."
    missing:
      - "Add deterministic detection for unknown title-like course mentions (not only unknown code mentions)."
      - "Add unit and route tests proving title-only fabricated mentions fail closed."
  - truth: "Returned recommendations obey active catalog filters as hard constraints even if upstream retrieval/regression drift occurs."
    status: failed
    reason: "Filter guard treats missing semester/component/instruction metadata as pass-through instead of fail-closed, weakening hard-constraint behavior."
    artifacts:
      - path: "api/src/ai/grounding/filterConstraintGuard.ts"
        issue: "Semester/componentType/instructionMethod predicates return true when values are absent on the course payload."
      - path: "api/src/routes/ai.grounding-safety.test.ts"
        issue: "Route safety tests only assert department hard-filter behavior and do not cover missing-metadata cases for all required filters."
    missing:
      - "Make final output guard fail closed (drop) when an active hard filter cannot be verified from the recommendation payload."
      - "Add route-level tests for semester/credits/attributes/instructor/campus/component/instruction-method hard constraints, including missing metadata paths."
---

# Phase 6: Atlas Grounding and Recommendation Safety Verification Report

**Phase Goal:** Enforce strict catalog grounding and hard safety constraints on recommendation outputs.  
**Verified:** 2026-03-06T18:00:54Z  
**Status:** gaps_found  
**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Specific course mentions in assistant text are accepted only when they map to the active candidate set. | ✗ FAILED | Unknown code mentions are blocked (`groundingValidator.ts:176-180`), but unknown title-only mentions are not explicitly detected. |
| 2 | Grounding violations fail closed to deterministic safe fallback text with no specific catalog names. | ✓ VERIFIED | Route returns `buildSafeGroundingFallback()` when grounding fails (`ai.ts:1395-1463`); fallback text contains no specific course entities (`safeGroundingFallback.ts:7-15`). |
| 3 | Grounding validation behavior is deterministic for repeated equivalent assistant outputs. | ✓ VERIFIED | Pure deterministic validation implementation (`groundingValidator.ts`); explicit deterministic regression test (`groundingValidator.test.ts` "returns deterministic results"). |
| 4 | Excluded/disliked courses are blocked as hard constraints across recommendation stages. | ✓ VERIFIED | Single merged `excludeSet` is used in candidate pool, mention recommendations, and fallback recommendations (`ai.ts:1063-1077`, `ai.ts:1193`, `ai.ts:1482-1505`). |
| 5 | For authenticated sessions, blocked-course state persists across turns within TTL. | ✓ VERIFIED | Per-user TTL helper with merge/get/clear semantics (`sessionBlocklistState.ts:1-67`) + TTL/isolation tests (`sessionBlocklistState.test.ts`). |
| 6 | Blocked courses are prevented in recommendation cards and assistant grounding acceptance. | ✓ VERIFIED | Blocked IDs passed into grounding validator (`ai.ts:1386-1390`) and filtered from recommendation construction (`ai.ts:1482-1505`). |
| 7 | Returned recommendations obey active catalog filters as hard constraints even if retrieval drifts. | ✗ FAILED | Guard allows pass-through on missing semester/component/instruction fields (`filterConstraintGuard.ts:110-113`, `186-189`, `202-205`). |
| 8 | Grounding/filter policy violations trigger safe fallback instead of unsafe leakage. | ✓ VERIFIED | Grounding violation fallback (`ai.ts:1395-1463`) and all-dropped filter fallback (`ai.ts:1535-1603`). |
| 9 | Route-level regression tests prove grounding safety for off-catalog mentions, blocked courses, and filter constraints. | ✓ VERIFIED | Dedicated route suite covers off-catalog code fallback, same-user blocklist carryover, filter enforcement, and JSON fallback path (`ai.grounding-safety.test.ts:220-347`). |

**Score:** 7/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `api/src/routes/ai.ts` | Final orchestration safety gate and fallback behavior | ✓ VERIFIED | Grounding validator + filter guard + fail-closed branches are wired before response return. |
| `api/src/ai/grounding/groundingValidator.ts` | Deterministic grounding validator for assistant mentions | ⚠️ PARTIAL | Deterministic and blocked-code coverage are present, but unknown title-only mention detection is missing. |
| `api/src/ai/grounding/sessionBlocklistState.ts` | User-scoped TTL blocked-course state | ✓ VERIFIED | Get/merge/clear with TTL and per-user isolation present. |
| `api/src/ai/grounding/filterConstraintGuard.ts` | Hard output filter constraints | ⚠️ PARTIAL | Filters implemented, but some active-filter checks pass when recommendation metadata is missing. |
| `api/src/routes/ai.grounding-safety.test.ts` | Route regression safety suite | ⚠️ PARTIAL | Good core coverage; missing title-only grounding failure and full hard-filter matrix edge cases. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `api/src/routes/ai.ts` | `api/src/ai/grounding/groundingValidator.ts` | `validateAssistantGrounding(...)` | ✓ WIRED | Called before recommendation response assembly and before fallback decisions. |
| `api/src/routes/ai.ts` | `api/src/ai/grounding/sessionBlocklistState.ts` | `getSessionBlockedCourseIds(...)`, `mergeSessionBlockedCourseIds(...)`, `clearSessionBlockedCourseIds(...)` | ✓ WIRED | Request/session blocked IDs merged and persisted; reset clears state. |
| `api/src/routes/ai.ts` | `api/src/ai/grounding/filterConstraintGuard.ts` | `enforceRecommendationFilterConstraints(...)` | ✓ WIRED | Final recommendation list constrained immediately before response return. |
| `api/src/routes/ai.ts` | `api/src/ai/grounding/safeGroundingFallback.ts` | `buildSafeGroundingFallback(...)` | ✓ WIRED | Used on grounding failures and all-dropped filter-constraint path. |
| `api/src/routes/ai.grounding-safety.test.ts` | `api/src/routes/ai.ts` | In-process POST handler execution | ✓ WIRED | Route-level behavior is asserted through handler stack execution. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| AIGRD-01 | 06-01 | Specific course codes/titles must exist in active candidate set before appearing in assistant output | ✗ BLOCKED | Unknown code mentions are caught, but unknown title-only mentions are not explicitly rejected. |
| AIGRD-02 | 06-02 | Excluded/disliked courses must never reappear in same session recommendations | ✓ SATISFIED | Merged request/session blocklist enforcement in route + sequential same-user route test. |
| AIGRD-03 | 06-01 | Grounding failure must return safe fallback with no fabricated specific course names | ✓ SATISFIED | Grounding fail-closed branch returns deterministic safe fallback payload with empty recommendations. |
| AIGRD-04 | 06-03 | Active catalog filters must be hard constraints on returned recommendations | ✗ BLOCKED | Output guard does not fail closed when some required filter metadata is missing on recommendation payloads. |

### Anti-Patterns Found

No blocker anti-patterns (`TODO` stubs/placeholders/missing wiring) found in the verified Phase 6 implementation files.

### Gaps Summary

Phase 6 materially improves recommendation safety and closes most must-haves, but strict-goal achievement is incomplete due to two gaps:
1. Grounding enforcement does not fully cover fabricated title-only specific mentions.
2. Filter hard-constraint enforcement is not fail-closed for some active filters when metadata is missing.

Because these are directly tied to the phase goal and requirement contract, phase status is `gaps_found`.

---

_Verified: 2026-03-06T18:00:54Z_  
_Verifier: Codex (gsd-verifier)_
