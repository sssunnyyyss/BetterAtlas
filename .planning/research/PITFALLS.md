# Pitfalls Research

**Domain:** AI chat UI redesign in production web app
**Researched:** 2026-02-27
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Visual overhaul without interaction reliability

**What goes wrong:** UI looks better but users still encounter confusing pending/error states.

**Why it happens:** Teams optimize static mocks before validating async behavior.

**How to avoid:** Define explicit UX for idle/pending/success/error before styling polish.

**Warning signs:** Loading appears only sometimes, or message order feels inconsistent.

**Phase to address:** Phase 2 (foundation state model)

---

### Pitfall 2: Mobile keyboard and composer collisions

**What goes wrong:** Input is covered by keyboard or jumps during typing.

**Why it happens:** Desktop-first layouts are ported to mobile late.

**How to avoid:** Validate mobile viewport behavior early with sticky input constraints.

**Warning signs:** Textarea or send button becomes inaccessible on smaller devices.

**Phase to address:** Phase 3 (interaction polish)

---

### Pitfall 3: Over-animated UI causing lag

**What goes wrong:** Chat feels slower despite prettier transitions.

**Why it happens:** Too many simultaneous animations and expensive paints.

**How to avoid:** Keep motion subtle, GPU-friendly transforms only, and respect reduced motion.

**Warning signs:** Scroll jank, input latency, noticeable battery drain on mobile.

**Phase to address:** Phase 3 (motion and responsiveness)

---

### Pitfall 4: Recommendation cards become visually dense

**What goes wrong:** Users cannot quickly decide which course to click.

**Why it happens:** Attempt to show every field at once.

**How to avoid:** Prioritize code/title/fit/2 key reasons first; defer extra metadata.

**Warning signs:** Users need to re-read cards or skip them entirely.

**Phase to address:** Phase 4 (card redesign and quality pass)

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Styling directly in one route file | Fast initial edits | Hard to scale redesign and test | Only for tiny one-off tweaks |
| No visual-regression test coverage | Faster merge | Frequent polish regressions | Never for major UI redesign |
| Ignoring reduced-motion support | Less implementation effort | Accessibility complaints, rework later | Never |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| AI mutation hooks | Coupling UI transitions to fragile timing assumptions | Drive transitions from explicit mutation state |
| URL deep-link prompt | Losing `?prompt` onboarding during refactor | Preserve prompt bootstrapping and test it |
| Local preference persistence | Crashing on malformed localStorage | Parse defensively with safe fallbacks |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Re-rendering full message tree per keystroke | Input lag while typing | Isolate composer state from message list where possible | Medium history + mobile |
| Heavy box-shadows/blur layers | Stutter while scrolling | Use restrained shadows and avoid expensive filters | Low-end devices |
| Large unbounded card text | Layout jumps and poor scanability | Clamp lines and prioritize key metadata | Any dense result set |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Rendering unsanitized rich text from API | XSS surface expansion | Keep plain-text rendering and avoid raw HTML injection |
| Leaking auth-only assumptions into public AI route | Unexpected 401/UX regressions | Keep anonymous path explicitly supported and tested |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Placeholder-first empty state with no guidance | Users churn before first query | Provide intent-driven prompt chips and examples |
| Ambiguous “thinking” indicator | Users think app is frozen | Distinct typing/loading indicator with clear rhythm |
| Weak action hierarchy in cards | Lower click-through to course details | Strong primary affordance and concise supporting details |

## "Looks Done But Isn't" Checklist

- [ ] **Composer redesign:** keyboard/mobile safe behavior verified.
- [ ] **Message animation:** reduced-motion fallback verified.
- [ ] **Recommendation cards:** readability verified at narrow mobile widths.
- [ ] **Error states:** network/API failures have clear recovery action.
- [ ] **Public access:** logged-out users can open `/ai` without auth friction.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| State ambiguity after redesign | MEDIUM | Re-introduce explicit UI state map and test matrix |
| Mobile interaction breakage | MEDIUM | Roll back composer-specific change, patch responsive container constraints |
| Animation jank | LOW | Disable heavy transitions and keep transform/opacity only |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Interaction reliability drift | Phase 2 | Loading/error scenarios tested manually and in component tests |
| Mobile keyboard collisions | Phase 3 | Mobile viewport + keyboard interaction checks pass |
| Over-animated lag | Phase 3 | No noticeable jank during message send/render flow |
| Card density overload | Phase 4 | Card scanability checks and user-style acceptance pass |

## Sources

- Existing BetterAtlas AI chat implementation and known behavior
- Common production issues in chat-like React interfaces

---
*Pitfalls research for: AI chat UX redesign*
*Researched: 2026-02-27*
