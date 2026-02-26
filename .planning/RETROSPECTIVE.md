# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Program Toggle Accuracy

**Shipped:** 2026-02-26
**Phases:** 1 | **Plans:** 2 | **Sessions:** 1

### What Was Built
- Deterministic backend program family matching with strict-first fallback logic.
- Deterministic frontend major/minor selector utilities with URL tab canonicalization.
- Regression test coverage for backend variant logic and catalog program-mode behavior.

### What Worked
- Wave-based execution with small plan sizes kept implementation fast and low-risk.
- Shared selector utilities removed duplicated toggle logic and made behavior easier to test.

### What Was Inefficient
- Summary frontmatter did not include one-liner/task metrics in machine-readable form, which reduced automated milestone stats quality.
- Milestone audit was not run before completion, reducing confidence compared with the intended workflow.

### Patterns Established
- Use strict-family candidate resolution before normalized fallback for catalog variant identity.
- Use deterministic ranking + stable tie-breakers for all program-mode selection flows.

### Key Lessons
1. Add audit as a hard gate before milestone archival to avoid quality blind spots.
2. Keep summary metadata complete (including one-liners/tasks) so milestone rollups are accurate without manual reconstruction.

### Cost Observations
- Model mix: 0% opus, 100% sonnet, 0% haiku
- Sessions: 1
- Notable: Most work completed in one execution pass because plans were narrow and test-oriented.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | 1 | 1 | Added deterministic program-mode contract across API and frontend |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | Added targeted API + frontend regressions | Not measured | 0 |

### Top Lessons (Verified Across Milestones)

1. Keep selection logic centralized and deterministic to prevent UI/API drift.
2. Treat milestone audits as release gates, not optional cleanup.
