# BetterAtlas

## What This Is

BetterAtlas is a university course discovery and scheduling platform where students search courses, evaluate reviews, coordinate with friends, and use AI guidance to plan better schedules.

## Core Value

Students can coordinate course planning with friends through shared planning workflows while quickly discovering fitting classes with reliable AI guidance.

## Current State

- **Latest shipped milestone:** v1.2 Conversational Atlas-Grounded Chat (2026-03-07)
- **Shipped in v1.2:**
  - Deterministic intent routing and clarify-first recommendation cadence.
  - Strict atlas-grounded recommendation safety with fail-closed fallback behavior.
  - Bounded hybrid retrieval/ranking/diversity calibration with low-relevance refine fallback.
  - Session-scoped memory reliability across API and first-party chat payload contracts.
  - Production-safe AI telemetry plus release-blocking AI regression gate packaging (`test:ai:gates`).
- **Codebase snapshot:** ~121,099 JS/TS lines across `frontend`, `api`, and `packages`.

## Next Milestone Goals

- Define the next shipped outcome and requirement set via `$gsd-new-milestone`.
- Choose whether to continue AI quality/ops hardening or prioritize broader product workflows outside the v1.2 scope.
- Preserve deterministic, test-backed behavior as a release gate for all future AI changes.

## Milestone Constraints

- Preserve AI endpoint compatibility for existing frontend clients where feasible.
- Keep recommendations constrained to available BetterAtlas catalog data.
- Prioritize behavior correctness and grounding over adding new UI surface area.

## Requirements Status

- v1.1 requirements are fully shipped and archived in [.planning/milestones/v1.1-REQUIREMENTS.md](./milestones/v1.1-REQUIREMENTS.md).
- v1.2 requirements are fully shipped and archived in [.planning/milestones/v1.2-REQUIREMENTS.md](./milestones/v1.2-REQUIREMENTS.md).
- The next milestone starts with a fresh `.planning/REQUIREMENTS.md` generated via `$gsd-new-milestone`.

<details>
<summary>Project History Through v1.2</summary>

## Previous Milestones

- v1.0 Program Toggle Accuracy (shipped 2026-02-26)
- v1.1 AI Chat Experience Redesign (shipped 2026-03-03)
- v1.2 Conversational Atlas-Grounded Chat (shipped 2026-03-07)

## Archived Context

- Roadmap archive: `.planning/milestones/v1.0-ROADMAP.md`, `.planning/milestones/v1.1-ROADMAP.md`, `.planning/milestones/v1.2-ROADMAP.md`
- Requirements archive: `.planning/milestones/v1.0-REQUIREMENTS.md`, `.planning/milestones/v1.1-REQUIREMENTS.md`, `.planning/milestones/v1.2-REQUIREMENTS.md`
- Milestone records: `.planning/MILESTONES.md`

## Ongoing Product Themes

- Preserve deterministic behavior in planning and recommendation UX.
- Keep accessibility and mobile responsiveness as release-level quality gates.
- Avoid coupling UI milestones to high-risk backend contract changes unless explicitly scoped.

</details>

---
*Last updated: 2026-03-07 after completing milestone v1.2*
