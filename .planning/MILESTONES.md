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

## v1.1 AI Chat Experience Redesign (Shipped: 2026-03-03)

**Delivered:** A full AI chat UX redesign with clearer layout hierarchy, deterministic interaction lifecycle behavior, recommendation-card decision support improvements, and accessibility/performance hardening.

**Phases completed:** 3 phases (9 plans, 27 tasks)

**Key accomplishments:**
- Unified standalone `/ai` and embedded chat rendering under a shared shell/feed/composer contract.
- Added deterministic `idle -> sending -> success/error -> idle` lifecycle behavior with intent-aware scrolling and retry recovery.
- Implemented keyboard-safe mobile composer ergonomics with `VisualViewport`-driven inset behavior.
- Shipped redesigned recommendation cards with scan-first hierarchy, progressive disclosure, and explicit course-detail actions.
- Added accessibility and reduced-motion parity checks plus recommendation-render performance regression coverage.

**Stats:**
- 44 files changed
- +5357 / -498 lines (net +4859)
- Timeline: ~4 days (2026-02-26 19:05 -0800 -> 2026-03-02 22:13 -0800)
- Codebase size at ship: ~105,967 JS/TS lines (`frontend`, `api`, `packages/shared`)

**Git range:** `feat(02-01)` -> `docs(04-03)`

### Known Gaps

- Milestone audit file (`.planning/v1.1-MILESTONE-AUDIT.md`) was not present at completion time.
- GSD utility closeout commands required manual metadata correction during archive prep.

---

## v1.2 Conversational Atlas-Grounded Chat (Shipped: 2026-03-07)

**Delivered:** A conversational, atlas-grounded AI counseling milestone with deterministic intent routing, strict grounding safety, bounded relevance calibration, session-scoped memory reliability, and release-blocking AI observability gates.

**Phases completed:** 5 phases (17 plans, 50 tasks)

**Key accomplishments:**
- Enforced deterministic `conversation`/`clarify`/`recommend` intent routing and clarify-first recommendation cadence.
- Added strict grounding safety gates with fail-closed fallback behavior and hard filter enforcement over catalog-backed candidates.
- Shipped bounded hybrid retrieval + ranking/diversity calibration with low-relevance refine-first fallback behavior.
- Introduced session-scoped memory/topic-shift reliability across API + first-party chat payload contracts.
- Packaged production-safe telemetry and a single release-blocking `test:ai:gates` command with observability regressions and runbook.

**Stats:**
- 83 files changed
- +12637 / -377 lines (net +12260)
- Timeline: ~1 day (2026-03-05 14:34 -0800 -> 2026-03-06 18:38 -0800)
- Codebase size at ship: ~121,099 JS/TS lines (`frontend`, `api`, `packages`)

**Git range:** `feat(05-01)` -> `docs(phase-9)`

### Known Gaps

- Milestone audit file (`.planning/v1.2-MILESTONE-AUDIT.md`) was not present at completion time.

---
