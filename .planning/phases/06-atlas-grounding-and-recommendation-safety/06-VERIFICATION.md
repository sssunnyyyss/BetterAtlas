---
phase: 06-atlas-grounding-and-recommendation-safety
verified: 2026-03-06T18:26:24Z
status: passed
score: 9/9 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 7/9
  gaps_closed:
    - "Specific course mentions in assistant text are accepted only when they map to the active candidate set."
    - "Returned recommendations obey active catalog filters as hard constraints even if upstream retrieval/regression drift occurs."
  gaps_remaining: []
  regressions: []
---

# Phase 6: Atlas Grounding and Recommendation Safety Verification Report

**Phase Goal:** Enforce strict catalog grounding and hard safety constraints on recommendation outputs.  
**Verified:** 2026-03-06T18:26:24Z  
**Status:** passed  
**Re-verification:** Yes - prior gaps re-checked and closed

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Specific course mentions in assistant text are accepted only when they map to the active candidate set. | ✓ VERIFIED | Validator now emits `unknown_mention` for unknown code and unknown title-like mentions (`groundingValidator.ts:255-285`), and route tests assert off-catalog code + title-only fallback (`ai.grounding-safety.test.ts:225-275`). |
| 2 | Grounding violations fail closed to deterministic safe fallback text with no specific catalog names. | ✓ VERIFIED | Route fail-closed branch uses `buildSafeGroundingFallback()` (`ai.ts:1395-1423`), and fallback payload is deterministic/non-specific (`safeGroundingFallback.ts:7-16`). |
| 3 | Grounding validation behavior is deterministic for repeated equivalent assistant outputs. | ✓ VERIFIED | Validation normalizes/sorts deterministically (`groundingValidator.ts:47-61`, `groundingValidator.ts:228-233`, `groundingValidator.ts:287-291`) and deterministic equality is tested (`groundingValidator.test.ts:115-146`). |
| 4 | Excluded/disliked courses are blocked as hard constraints across recommendation stages. | ✓ VERIFIED | Route composes one merged `excludeSet` from request excludes, dislikes, and session blocklist (`ai.ts:1063-1070`), then applies it to candidate and recommendation assembly (`ai.ts:1193`, `ai.ts:1482-1505`). |
| 5 | For authenticated sessions, blocked-course state persists across turns within TTL. | ✓ VERIFIED | TTL-backed per-user state is implemented (`sessionBlocklistState.ts:1-24`, `sessionBlocklistState.ts:40-63`) and validated for TTL/isolation (`sessionBlocklistState.test.ts:35-57`). |
| 6 | Blocked courses are prevented in recommendation cards and assistant grounding acceptance. | ✓ VERIFIED | Blocked IDs are passed into grounding validation (`ai.ts:1386-1390`) and recommendations filter blocked course IDs in mention/fallback paths (`ai.ts:1482-1505`). |
| 7 | Returned recommendations obey active catalog filters as hard constraints even if retrieval drifts. | ✓ VERIFIED | Filter predicates now fail closed on missing required metadata (`filterConstraintGuard.ts:109-113`, `filterConstraintGuard.ts:183-186`, `filterConstraintGuard.ts:196-199`), and route matrix tests cover semester/credits/attributes/instructor/campus/component/instruction filters including missing metadata (`ai.grounding-safety.test.ts:355-517`). |
| 8 | Grounding/filter policy violations trigger safe fallback instead of unsafe leakage. | ✓ VERIFIED | Grounding failure branch and all-dropped filter branch both return deterministic safe fallback (`ai.ts:1395-1463`, `ai.ts:1535-1603`). |
| 9 | Route-level regression tests prove grounding safety for off-catalog mentions, blocked courses, and filter constraints. | ✓ VERIFIED | Route suite includes off-catalog code, unknown title-only mention, same-user blocklist carryover, hard-filter matrix, all-dropped filter fallback, and JSON-fallback safety parity (`ai.grounding-safety.test.ts:224-540`). |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `api/src/ai/grounding/groundingContracts.ts` | Typed grounding interfaces | ✓ VERIFIED | Exports `GroundingValidationInput`, `GroundingValidationResult`, `GroundingViolation` (`groundingContracts.ts:3-18`). |
| `api/src/ai/grounding/groundingValidator.ts` | Deterministic code/title grounding validator | ✓ VERIFIED | Detects unknown code and unknown title-like mentions; rejects blocked mentions (`groundingValidator.ts:236-292`). |
| `api/src/ai/grounding/safeGroundingFallback.ts` | Deterministic safe fallback payload | ✓ VERIFIED | Returns fixed assistant message + empty recommendations (`safeGroundingFallback.ts:7-16`). |
| `api/src/ai/grounding/sessionBlocklistState.ts` | User-scoped TTL blocklist helper | ✓ VERIFIED | Implements get/merge/clear with TTL expiry (`sessionBlocklistState.ts:34-67`). |
| `api/src/ai/grounding/filterConstraintGuard.ts` | Hard filter-constraint guard | ✓ VERIFIED | Enforces all active filters and drops non-verifiable metadata cases (`filterConstraintGuard.ts:105-222`). |
| `api/src/routes/ai.ts` | Integrated route-level safety gate | ✓ VERIFIED | Wires blocklist merge, grounding validation, filter guard, and fail-closed fallback (`ai.ts:1063-1077`, `ai.ts:1386-1396`, `ai.ts:1528-1536`). |
| `api/src/ai/grounding/groundingValidator.test.ts` | Grounding regression coverage | ✓ VERIFIED | Covers pass, unknown code, unknown title-only, blocked mention, deterministic output (`groundingValidator.test.ts:27-166`). |
| `api/src/ai/grounding/sessionBlocklistState.test.ts` | Blocklist TTL/isolation regression coverage | ✓ VERIFIED | Covers merge/dedupe, TTL expiry, user isolation, clear behavior (`sessionBlocklistState.test.ts:24-67`). |
| `api/src/routes/ai.grounding-safety.test.ts` | Route-level grounding/filter safety suite | ✓ VERIFIED | Covers fail-closed paths and hard-filter matrix including missing metadata (`ai.grounding-safety.test.ts:224-540`). |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `groundingContracts.ts` | `groundingValidator.ts` | Typed validator input/output contracts | ✓ WIRED | Validator imports `GroundingValidationInput`/`GroundingValidationResult` (`groundingValidator.ts:2`, `groundingValidator.ts:236-238`). |
| `safeGroundingFallback.ts` | `ai.ts` | Fail-closed response branches | ✓ WIRED | Route calls `buildSafeGroundingFallback()` in grounding and filter-fallback paths (`ai.ts:1396`, `ai.ts:1536`). |
| `sessionBlocklistState.ts` | `ai.ts` | Merge/get/clear blocked IDs by user session | ✓ WIRED | `getSessionBlockedCourseIds`, `mergeSessionBlockedCourseIds`, `clearSessionBlockedCourseIds` used in route flow (`ai.ts:898`, `ai.ts:1068`, `ai.ts:1076`). |
| `filterConstraintGuard.ts` | `ai.ts` | Final recommendation hard-filter enforcement | ✓ WIRED | `enforceRecommendationFilterConstraints(...)` applied before response return (`ai.ts:1528-1533`). |
| `ai.grounding-safety.test.ts` | `ai.ts` | In-process route handler execution | ✓ WIRED | Tests exercise `postRecommendation(...)` against actual route stack (`ai.grounding-safety.test.ts:135-222`, `ai.grounding-safety.test.ts:224-540`). |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| AIGRD-01 | 06-01, 06-04 | Specific course codes/titles must exist in active candidate set before appearing in assistant output | ✓ SATISFIED | Unknown code and unknown title-like mentions are rejected (`groundingValidator.ts:255-285`); route-level title-only hallucination fallback test passes (`ai.grounding-safety.test.ts:251-275`). |
| AIGRD-02 | 06-02 | Excluded/disliked courses must never reappear in same session recommendations | ✓ SATISFIED | Merged blocklist state enforced in route (`ai.ts:1063-1077`, `ai.ts:1482-1505`) and validated across sequential same-user calls (`ai.grounding-safety.test.ts:277-325`). |
| AIGRD-03 | 06-01 | Grounding failure must return safe fallback with no fabricated specific course names | ✓ SATISFIED | Route grounding-failure branch returns deterministic safe fallback payload (`ai.ts:1395-1423`, `safeGroundingFallback.ts:7-16`). |
| AIGRD-04 | 06-03, 06-04 | Active catalog filters must be hard constraints on returned recommendations | ✓ SATISFIED | Route applies output filter guard (`ai.ts:1528-1533`), fails closed if all candidates dropped (`ai.ts:1535-1563`), and route tests cover full filter matrix/missing metadata (`ai.grounding-safety.test.ts:355-517`). |

### Plan Requirement ID Accounting

- Requirement IDs declared in `06-01`..`06-04` PLAN frontmatter: `AIGRD-01`, `AIGRD-02`, `AIGRD-03`, `AIGRD-04`.
- Cross-reference against `.planning/REQUIREMENTS.md`: all four IDs exist and are mapped to Phase 6 (`REQUIREMENTS.md:19-22`, `REQUIREMENTS.md:72-75`).
- Orphaned Phase 6 requirements (in REQUIREMENTS but absent from plan frontmatter): none.

### Anti-Patterns Found

No blocker anti-patterns (`TODO`/`FIXME`/placeholder stubs or unwired phase artifacts) found in Phase 6 grounding/safety files.

### Human Verification Required

None for phase-goal safety closure. Core behaviors are covered by deterministic unit/route regression tests and passed in this verification run.

### Verification Commands Run

- `pnpm --filter api test -- src/ai/grounding/groundingValidator.test.ts src/ai/grounding/sessionBlocklistState.test.ts src/routes/ai.grounding-safety.test.ts` (pass)
- `pnpm --filter api build` (pass)

### Gaps Summary

No remaining gaps tied to Phase 6 goal or mapped requirements.

---

_Verified: 2026-03-06T18:26:24Z_  
_Verifier: Codex (gsd-verifier)_
