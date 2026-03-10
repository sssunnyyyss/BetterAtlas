---
task: quick
number: 3
title: Restore mobile schedule UI without reintroducing navbar or global CSS changes
status: completed
completed: 2026-03-10
commit: 64c023e
---

# Quick Task Summary

## Outcome

- Restored the mobile schedule agenda view on the schedule page only.
- Brought back the responsive schedule controls and friend chip layout improvements for smaller screens.
- Left the desktop navbar rollback intact and did not reintroduce the global mobile menu styling changes.

## Verification

- `pnpm --filter frontend build`
- `pnpm --filter frontend test`

## Code Commit

- `64c023e` `feat(frontend): restore mobile schedule layout`
