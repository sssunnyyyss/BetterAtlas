# Phase 1: Program and Major Toggle Accuracy - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning
**Source:** User request via `$gsd-plan-phase`

<domain>
## Phase Boundary

Fix accuracy of the programs/majors toggle logic in catalog program mode. Focus on selection and switching behavior, not full catalog redesign.

</domain>

<decisions>
## Decisions

### Locked Decisions
- Rework the logic behind programs and majors toggle to be more accurate.
- Prioritize correctness over visual redesign.
- Keep scope centered on existing program-mode experience in catalog.

### Claude's Discretion
- Exact matching strategy between program variants (name normalization, degree preference, fallback order).
- Whether selection logic lives in shared utility, hook, component, or API helper.
- Test distribution between frontend and API layers.
- Whether and how to use existing program AI summaries as a relevance signal for course display in program mode.

</decisions>

<specifics>
## Specific Ideas

- Current implementation likely mis-selects variants because it picks first sorted major/minor match.
- Current filter list constrains selection to BA majors in the search dropdown, which may hide valid variants.
- Behavior should remain stable with URL params (`programId`, `programTab`).
- Existing `useProgramAiSummary` data should be evaluated as an input signal for course display ordering/selection in program mode.

</specifics>

<deferred>
## Deferred Ideas

- Full redesign of catalog filters and toggle visuals.
- Program ingestion/sync pipeline changes.

</deferred>

---

*Phase: 01-program-and-major-toggle-accuracy*
*Context gathered: 2026-02-26 via user request*
