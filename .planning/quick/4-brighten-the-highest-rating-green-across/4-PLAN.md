---
task: quick
number: 4
title: Brighten the highest rating green across shared frontend color helpers
status: completed
created: 2026-03-10
---

# Quick Plan

## Task 1

files:
- `frontend/src/lib/utils.ts`
- `frontend/src/lib/grade.ts`
- `packages/shared/src/utils/constants.ts`
- `frontend/src/pages/Schedule.tsx`
- `frontend/src/pages/CourseDetail.tsx`

action:
- Shift the top-end green used for ratings, grades, and matching shared palette entries to a brighter, greener shade while keeping the rest of the scale intact.

verify:
- Confirm the highest rating/grade green and matching palette entries all use the updated accent consistently.

done:
- Replaced the top green accent with a brighter green in the shared helpers and matching palette arrays.
