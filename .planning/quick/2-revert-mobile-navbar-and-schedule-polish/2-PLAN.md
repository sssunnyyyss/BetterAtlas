---
task: quick
number: 2
title: Revert mobile navbar and schedule polish while restoring desktop liquid nav behavior
status: completed
created: 2026-03-10
---

# Quick Plan

## Task 1

files:
- `frontend/src/components/layout/Navbar.tsx`
- `frontend/src/index.css`

action:
- Restore the pre-polish navbar behavior so desktop retains its existing retracting/following interaction and remove the mobile-specific navbar glass overrides.

verify:
- Confirm the shared navbar shell returns to the prior positioning behavior and the temporary mobile-only CSS block is gone.

done:
- Reverted the navbar shell/menu positioning changes and removed the added mobile-only navbar/menu styling overrides.

## Task 2

files:
- `frontend/src/pages/Schedule.tsx`

action:
- Revert the schedule page back to the prior layout, removing the mobile agenda rewrite and related control/chip restyling.

verify:
- Confirm the schedule page uses the existing weekly calendar layout and original control/friend-filter presentation again.

done:
- Removed the mobile agenda path and restored the previous schedule page layout while keeping the separate green palette update.
