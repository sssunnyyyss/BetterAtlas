# Roadmap: BetterAtlas

## Overview

Improve the catalog program filtering journey so major/minor toggles are accurate and deterministic, then continue milestone feature delivery from a more reliable discovery baseline.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Program and Major Toggle Accuracy** - Fix incorrect major/minor variant switching and stabilize behavior in catalog program mode.

## Phase Details

### Phase 1: Program and Major Toggle Accuracy
**Goal:** Program mode correctly maps and switches major/minor variants for the same program family without inaccurate fallback behavior.
**Depends on:** Nothing (first phase)
**Requirements**: [PRGM-01, PRGM-02, PRGM-03, PRGM-04]
**Success Criteria** (what must be TRUE):
  1. User can select a program and reliably toggle between available major/minor variants.
  2. Variant selection uses deterministic matching rules (including degree preference) instead of arbitrary first-result picks.
  3. Catalog URL state (`programId`, `programTab`) remains valid and produces consistent behavior after refresh.
  4. Automated tests cover toggle selection rules and regression-prone catalog interactions.
**Plans:** 2/2 plans complete

Plans:
- [x] 01-01: Define variant-selection contract and tighten API/frontend matching logic
- [x] 01-02: Wire toggle UI behavior to deterministic selectors and add regression tests

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Program and Major Toggle Accuracy | 2/2 | Complete    | 2026-02-26 |
