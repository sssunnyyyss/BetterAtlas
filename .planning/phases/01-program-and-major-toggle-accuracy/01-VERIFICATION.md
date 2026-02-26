---
phase: 01-program-and-major-toggle-accuracy
verified: 2026-02-26T17:00:59Z
status: passed
score: 4/4 must-haves verified
---

# Phase 1: Program and Major Toggle Accuracy Verification Report

**Phase Goal:** Program mode correctly maps and switches major/minor variants for the same program family without inaccurate fallback behavior.  
**Verified:** 2026-02-26T17:00:59Z  
**Status:** passed  
**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | User can select a program and reliably toggle between available major/minor variants. | ✓ VERIFIED | `buildProgramSearchOptions` is wired into filters and keeps family options (`frontend/src/components/course/CourseFilters.tsx:6`, `:134-137`); toggle uses shared deterministic selector (`frontend/src/pages/Catalog.tsx:257-283`, `:527-555`); regression test covers major→minor→major round trip (`frontend/src/pages/Catalog.program-mode.test.tsx:258-279`). |
| 2 | Variant selection uses deterministic matching rules (including degree preference) instead of arbitrary first-result picks. | ✓ VERIFIED | Backend strict-first + normalized fallback logic is explicit (`api/src/services/programService.ts:459-462`) and sorted with degree-aware tie-breakers (`:86-107`, `:476-477`); frontend selector applies preferred-degree deterministic pick (`frontend/src/lib/programVariantSelection.ts:46-58`, `:98-101`); tests lock behavior (`api/src/services/__tests__/programService.test.ts:36-103`, `frontend/src/lib/programVariantSelection.test.ts:55-89`). |
| 3 | Catalog URL state (`programId`, `programTab`) remains valid and consistent after refresh/deep link. | ✓ VERIFIED | Tab canonicalization is centralized (`frontend/src/lib/programVariantSelection.ts:104-105`) and applied to URL params in Catalog effect (`frontend/src/pages/Catalog.tsx:194-216`), with program queries using canonical tab (`:321`); regression tests verify invalid/missing tab canonicalize to `required` (`frontend/src/pages/Catalog.program-mode.test.tsx:281-303`). |
| 4 | Automated tests cover toggle selection rules and regression-prone catalog interactions. | ✓ VERIFIED | Targeted unit/integration tests exist for service rules, selector rules, and catalog program-mode flow (`api/src/services/__tests__/programService.test.ts`, `frontend/src/lib/programVariantSelection.test.ts`, `frontend/src/pages/Catalog.program-mode.test.tsx`), and all pass in this verification run. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `api/src/services/programService.ts` | Deterministic variant-family selection + ordering | ✓ VERIFIED | Implements strict-first family selection and deterministic degree-aware sorting; `listPrograms` filters active rows and stable ordering (`:134-168`, `:436-478`). |
| `api/src/services/__tests__/programService.test.ts` | Regression tests for strict/fallback + ordering | ✓ VERIFIED | Three focused tests for strict-family preference, normalized fallback, deterministic degree affinity (`:36-103`). |
| `frontend/src/lib/programVariantSelection.ts` | Shared deterministic selector/canonicalization contract | ✓ VERIFIED | Exports `buildProgramSearchOptions`, `selectProgramVariant`, `canonicalizeProgramTab` and deterministic ranking helpers (`:61-105`). |
| `frontend/src/components/course/CourseFilters.tsx` | Program option generation via shared utility | ✓ VERIFIED | Imports and uses `buildProgramSearchOptions` in program options memo (`:6`, `:134-137`). |
| `frontend/src/pages/Catalog.tsx` | Deterministic toggle wiring + URL canonicalization + relevance signal | ✓ VERIFIED | Uses `selectProgramVariant` for toggles, canonicalizes tab in URL, applies AI-summary relevance ordering (`:196-216`, `:257-283`, `:362-369`). |
| `frontend/src/lib/programVariantSelection.test.ts` | Selector/fallback/canonicalization tests | ✓ VERIFIED | Covers family-preserving options, previous-kind restore, preferred-degree fallback, deterministic default, tab canonicalization (`:19-101`). |
| `frontend/src/pages/Catalog.program-mode.test.tsx` | Program-mode URL/toggle/relevance regressions | ✓ VERIFIED | Covers deterministic toggle counterpart selection, deep-link tab canonicalization, and stable AI-summary ordering (`:258-342`). |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `frontend/src/components/course/CourseFilters.tsx` | `frontend/src/lib/programVariantSelection.ts` | `buildProgramSearchOptions` | WIRED | Utility imported and called for program dropdown options (`CourseFilters.tsx:6`, `:134-137`). |
| `frontend/src/pages/Catalog.tsx` | `frontend/src/lib/programVariantSelection.ts` | `selectProgramVariant` | WIRED | Selector imported and used by `handleProgramKindToggle` before writing `programId` (`Catalog.tsx:20`, `:257-283`). |
| `frontend/src/pages/Catalog.tsx` | URL `programTab` search param | tab canonicalization effect | WIRED | Raw tab is canonicalized and written back into URL when invalid/missing in program mode (`Catalog.tsx:194-216`). |
| `api/src/services/programService.ts` | `getProgramVariants` response | strict subset + normalized fallback + deterministic output arrays | WIRED | Candidate set is strict-first with fallback, then majors/minors are sorted deterministically (`programService.ts:459-477`). |
| `api/src/services/programService.ts` | frontend variant consumption (`useProgramVariants` in Catalog) | stable majors/minors payload | WIRED | Catalog consumes variants and renders toggle controls only when both arrays exist (`Catalog.tsx:203`, `:529-555`). |
| `frontend/src/pages/Catalog.tsx` | AI-summary-informed program-mode ordering | `useProgramAiSummary` + `applyProgramRelevanceOrder` | WIRED | Summary hook drives deterministic relevance boost in program mode (`Catalog.tsx:205`, `:117-133`, `:362-369`). |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| PRGM-01 | 01-01, 01-02 | User can search/select a program without losing valid major/minor variants. | ✓ SATISFIED | Family-preserving options in selector utility and filter wiring (`programVariantSelection.ts:61-78`, `CourseFilters.tsx:134-137`), covered by unit test (`programVariantSelection.test.ts:19-37`). |
| PRGM-02 | 01-01, 01-02 | User can toggle major/minor for same normalized program and land on matching variant. | ✓ SATISFIED | Backend normalized family retrieval + strict subset preference (`programService.ts:445-462`), frontend deterministic toggle selection (`Catalog.tsx:257-283`), integration test verifies toggle result IDs (`Catalog.program-mode.test.tsx:258-279`). |
| PRGM-03 | 01-01, 01-02 | Major variant switching (BA/BS/etc.) uses deterministic rules and avoids unrelated fallback. | ✓ SATISFIED | Degree-aware comparator and deterministic tie-breaks (`programService.ts:86-107`), strict/fallback contract tests (`programService.test.ts:36-103`), frontend preferred-degree fallback test (`programVariantSelection.test.ts:68-89`). |
| PRGM-04 | 01-01, 01-02 | Toggle behavior remains stable across URL refresh/deep link with `programId`/`programTab`. | ✓ SATISFIED | Canonicalization helper + URL rewrite effect + canonical tab used in query (`programVariantSelection.ts:104-105`, `Catalog.tsx:194-216`, `:321`), deep-link regression tests (`Catalog.program-mode.test.tsx:281-303`). |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| N/A | N/A | No TODO/FIXME/placeholders, empty stubs, or console-only handlers in scoped phase files. | ℹ️ Info | No blocker anti-patterns detected for phase goal achievement. |

### Human Verification Required

No blocking human checks required for phase-goal acceptance.  
Optional confidence checks: one manual browser pass for real data quality and perceived relevance ordering.

### Gaps Summary

No gaps found. Phase goal is achieved in code and covered by automated regression tests.

### Verification Commands

- `pnpm --filter api test -- src/services/__tests__/programService.test.ts` (pass)
- `pnpm --filter frontend test -- src/lib/programVariantSelection.test.ts` (pass)
- `pnpm --filter frontend test -- src/pages/Catalog.program-mode.test.tsx` (pass)

---

_Verified: 2026-02-26T17:00:59Z_  
_Verifier: Codex (gsd-verifier role)_
