# Phase 02 Layout QA Checklist (`02-03`)

Use this checklist to validate chat layout structure before closing Phase 2.

## Scope

- Route mode: `/ai`
- Embedded mode: `/catalog` -> switch segmented control to `AI`
- Breakpoints:
  - `390x844` (mobile portrait)
  - `768x1024` (tablet portrait)
  - `1280x800` (desktop/laptop)

## Setup

1. Start app locally (`pnpm --filter frontend dev`).
2. Open browser devtools and enable responsive viewport controls.
3. Use each target viewport exactly as listed above.

## Checklist Matrix

For each viewport and each mode (`/ai`, embedded catalog AI), verify all items:

- Header zone is visible at top, not clipped, and reset button (when shown) stays inside bounds.
- Feed zone is the scroll container (`overflow-y`) and can scroll without shifting header/composer off-screen.
- Composer zone remains visible and interactive while feed content grows.
- No header/feed/composer overlap at initial render or after adding multiple messages.
- No horizontal clipping/overflow from message bubbles or assistant cards.
- Transitioning between catalog `Catalog` and `AI` segments preserves layout boundaries.

## Message/State Spot Checks

At each viewport, run these quick state checks:

1. Empty chat:
- Welcome view is centered inside feed without clipping.

2. Sending state:
- Submit a prompt and confirm sending status appears without pushing composer out of view.

3. Success state:
- Assistant response appears in feed; header/composer remain fixed in their zones.

4. Error state:
- Error status appears clearly in feed with no overlap into composer/footer.

## Defect Logging

If any check fails, record it before phase completion in:

- `.planning/STATE.md` under `Blockers/Concerns` with:
  - mode (`/ai` or embedded),
  - viewport (`390x844`, `768x1024`, or `1280x800`),
  - exact reproduction steps,
  - observed overlap/clipping behavior.

Also add a follow-up plan/todo reference in `.planning/ROADMAP.md` notes if the defect blocks phase closure.
