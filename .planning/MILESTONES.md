# Milestones

## v1.0 Program Toggle Accuracy (Shipped: 2026-02-26)

**Delivered:** Deterministic and test-backed program major/minor toggle behavior in catalog program mode, including stable URL state and AI-summary-informed relevance ordering.

**Phases completed:** 1 phase (2 plans, 6 tasks)

**Key accomplishments:**
- Enforced strict-first program family matching with deterministic fallback rules in the API.
- Added degree-aware variant ordering and active-only deterministic list ordering.
- Centralized frontend variant selection, program option derivation, and tab canonicalization in shared utilities.
- Removed BA-only program option bias and stabilized major/minor round-trip behavior.
- Added regression coverage for backend matching rules, frontend selector logic, and deep-link URL behavior.

**Stats:**
- 13 files changed
- +1324 / -50 lines (net +1274)
- Timeline: ~20 minutes (2026-02-26 08:42 -0800 -> 2026-02-26 09:02 -0800)

**Git range:** `fix(01-program-and-major-toggle-accuracy-01)` -> `docs(phase-1)`

### Known Gaps

- Milestone audit file (`.planning/v1.0-MILESTONE-AUDIT.md`) was not present at completion time.

---
