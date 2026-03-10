---
task: quick
number: 5
title: Route home page AI queries to the AI development placeholder
status: completed
created: 2026-03-10
---

# Quick Plan

## Task 1

files:
- `frontend/src/pages/Home.tsx`

action:
- Stop the home-page AI query submit path from deep-linking a live prompt into `/ai`, and route that entry point to the under-development AI page instead.

verify:
- Confirm home-page search mode still goes to catalog search while Ask AI always lands on `/ai` without a prompt deep-link.

done:
- Updated the home-page submit handler so AI mode navigates to the standalone `/ai` development page.
