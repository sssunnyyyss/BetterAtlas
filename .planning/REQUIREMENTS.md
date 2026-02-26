# Requirements: BetterAtlas

**Defined:** 2026-02-26
**Core Value:** Students can coordinate course planning with friends through a shared wishlist and flexibly adjust schedules, while discovering courses through accurate program/major filters.

## v1.1 Requirements

### Program Discovery Accuracy

- [x] **PRGM-01**: User can search and select a program without losing valid major/minor variants.
- [x] **PRGM-02**: User can toggle between major and minor for the same normalized program name and always land on a matching variant.
- [x] **PRGM-03**: User can switch major variants (for example BA/BS) using deterministic selection rules that avoid unrelated fallback records.
- [x] **PRGM-04**: Program toggle behavior remains stable across URL refresh/deep link with `programId` and `programTab`.

## v2 Requirements

### Program UX Enhancements

- **PRGM-05**: User can explicitly choose degree variant (BA/BS/etc.) from the UI.
- **PRGM-06**: User sees explanatory hints when a selected major/minor has no matching counterpart.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Redesign of all catalog filters | This phase targets correctness, not full UI overhaul |
| Program requirements data ingestion changes | Sync pipeline is not required to fix toggle logic |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PRGM-01 | Phase 1 | Complete |
| PRGM-02 | Phase 1 | Complete |
| PRGM-03 | Phase 1 | Complete |
| PRGM-04 | Phase 1 | Complete |

**Coverage:**
- v1.1 requirements: 4 total
- Mapped to phases: 4
- Unmapped: 0

---
*Requirements defined: 2026-02-26*
*Last updated: 2026-02-26 after toggle-accuracy planning request*
