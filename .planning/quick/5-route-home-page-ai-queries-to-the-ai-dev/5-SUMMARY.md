---
task: quick
number: 5
title: Route home page AI queries to the AI development placeholder
status: completed
completed: 2026-03-10
commit: fe2ab08
---

# Quick Task Summary

## Outcome

- Updated the home-page Ask AI submit path to land on `/ai` without passing a `prompt` deep-link.
- Empty AI submits from the home page now also land on `/ai` instead of falling back to the catalog.
- Catalog search behavior from the home page remains unchanged.

## Verification

- `pnpm --filter frontend build`
- `pnpm --filter frontend test`

## Code Commit

- `fe2ab08` `fix(frontend): route home ai to dev page`
