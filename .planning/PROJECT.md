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

## Current Milestone: v1.2 Conversational Atlas-Grounded Chat

**Goal:** Deliver a natural conversational AI counselor that recommends accurate BetterAtlas catalog courses when contextually appropriate, without forcing recommendations in every turn.

**Target features:**
- Intent-aware chat behavior that distinguishes conversational turns from recommendation-seeking turns.
- Strict Atlas-grounded recommendation policy that references only catalog-backed course candidates.
- Adaptive recommendation cadence that asks clarifying follow-ups when useful instead of always returning lists.
- Stronger ranking alignment with student preferences, filters, and prior feedback signals.
- Regression coverage for grounding, intent gating, and recommendation relevance quality.

## Milestone Constraints

- Preserve AI endpoint compatibility for existing frontend clients where feasible.
- Keep recommendations constrained to available BetterAtlas catalog data.
- Prioritize behavior correctness and grounding over adding new UI surface area.

## Requirements Status

- v1.1 requirements are fully shipped and archived in [.planning/milestones/v1.1-REQUIREMENTS.md](./milestones/v1.1-REQUIREMENTS.md).
- v1.2 requirements will be defined in a fresh `.planning/REQUIREMENTS.md` during this milestone kickoff.

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
*Last updated: 2026-03-05 after starting milestone v1.2*
