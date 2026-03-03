# BetterAtlas

## What This Is

BetterAtlas is a university course discovery and scheduling platform where students search courses, evaluate reviews, coordinate with friends, and use AI guidance to plan better schedules.

## Core Value

Students can coordinate course planning with friends through shared planning workflows while quickly discovering fitting classes with reliable AI guidance.

## Current State

- **Latest shipped milestone:** v1.1 AI Chat Experience Redesign (2026-03-03)
- **Shipped in v1.1:**
  - Unified AI chat layout and state architecture across standalone and embedded surfaces.
  - Deterministic lifecycle transitions, retry flow, and starter onboarding interactions.
  - Recommendation card redesign with progressive disclosure and explicit detail actions.
  - Accessibility and reduced-motion hardening plus interaction/performance regression coverage.
- **Codebase snapshot:** ~105,967 JS/TS lines across `frontend`, `api`, and `packages/shared`.

## Next Milestone Goals

- Define and prioritize the next milestone via `$gsd-new-milestone`.
- Produce a fresh milestone-scoped `REQUIREMENTS.md` (v1.1 requirements archived).
- Build roadmap phases from new requirements before execution.

## Requirements Status

- v1.1 requirements are fully shipped and archived in [.planning/milestones/v1.1-REQUIREMENTS.md](./milestones/v1.1-REQUIREMENTS.md).
- The active `.planning/REQUIREMENTS.md` file is intentionally reset per milestone workflow.

<details>
<summary>Project History Through v1.1</summary>

## Previous Milestones

- v1.0 Program Toggle Accuracy (shipped 2026-02-26)
- v1.1 AI Chat Experience Redesign (shipped 2026-03-03)

## Archived Context

- Roadmap archive: `.planning/milestones/v1.0-ROADMAP.md`, `.planning/milestones/v1.1-ROADMAP.md`
- Requirements archive: `.planning/milestones/v1.1-REQUIREMENTS.md`
- Milestone records: `.planning/MILESTONES.md`

## Ongoing Product Themes

- Preserve deterministic behavior in planning and recommendation UX.
- Keep accessibility and mobile responsiveness as release-level quality gates.
- Avoid coupling UI milestones to high-risk backend contract changes unless explicitly scoped.

</details>

---
*Last updated: 2026-03-03 after archiving milestone v1.1*
