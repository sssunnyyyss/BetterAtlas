# Phase 1: Program and Major Toggle Accuracy - Research

**Researched:** 2026-02-26
**Domain:** Catalog program-mode variant selection and URL-state stability
**Confidence:** MEDIUM-HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Rework the logic behind programs and majors toggle to be more accurate.
- Prioritize correctness over visual redesign.
- Keep scope centered on existing program-mode experience in catalog.

### Claude's Discretion
- Exact matching strategy between program variants (name normalization, degree preference, fallback order).
- Whether selection logic lives in shared utility, hook, component, or API helper.
- Test distribution between frontend and API layers.

### Deferred Ideas (OUT OF SCOPE)
- Full redesign of catalog filters and toggle visuals.
- Program ingestion/sync pipeline changes.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PRGM-01 | User can search and select a program without losing valid major/minor variants. | Remove BA-only dropdown filtering; switch to deterministic family grouping so non-BA families remain selectable. |
| PRGM-02 | User can toggle between major and minor for the same normalized program name and always land on a matching variant. | Add a single deterministic selector contract for cross-kind toggles using same-family candidates and explicit fallback order. |
| PRGM-03 | User can switch major variants (for example BA/BS) using deterministic selection rules that avoid unrelated fallback records. | Preserve/restore degree intent (exact degree first), add strict-first family matching in API variant resolver, and deterministic tie-breaks. |
| PRGM-04 | Program toggle behavior remains stable across URL refresh/deep link with `programId` and `programTab`. | Canonicalize/validate URL params in Catalog program mode and add regression tests for refresh/deep-link behavior. |
</phase_requirements>

## Summary

The phase risk is mostly logic fragmentation: variant matching is split between backend (`getProgramVariants`) and frontend event handlers, and both currently use broad/default behavior that can pick unintended records. The frontend program search currently narrows results to BA majors only, which directly violates PRGM-01 by hiding valid families that have no BA major.

Current program-mode toggles in Catalog choose the first sorted option (major: BA/BS-preferring global sort, minor: lowest id) instead of selecting a counterpart relative to the currently-selected variant. Combined with backend variant grouping that matches by normalized program name only, this can produce incorrect family jumps or degree loss.

Primary recommendation: define one deterministic variant-selection contract (strict-first family match + degree-aware fallback) and use it in both API variant preparation and Catalog toggle handlers, then lock behavior with API+frontend regression tests.

## Current Behavior Baseline

- Program dropdown options are filtered to BA majors only in `CourseFilters` (`p.kind === "major" && degree === "BA"`), then deduped by name.
- Program toggles in `Catalog` pick first sorted major/minor instead of matching from current selection context.
- Variant endpoint groups by `normalizeProgramName` only (`lower + strip non-alnum`) and returns all active matches.
- Program list endpoint does not filter `isActive`; variant endpoint does.
- Program URL state uses `programId`/`programTab`; `programTab` defaults to `required` in UI when absent but is not strongly canonicalized/validated.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.3.1 | Catalog UI + toggle interactions | Existing app standard for stateful UI behavior |
| React Router | 6.26.0 | URL params (`programId`, `programTab`) | Existing source of truth for filter/program mode state |
| @tanstack/react-query | 5.56.0 | Program/program-variant/program-course data fetching | Existing cache + query-key behavior for catalog |
| Express | 4.21.0 | Program endpoints | Existing API layer |
| Drizzle ORM | 0.33.0 | Program variant SQL queries | Existing DB access pattern |
| Zod | 3.23.0 | Query validation (`programCoursesQuerySchema`) | Existing contract guardrail |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | 2.1.9 | Unit/integration regression tests | For selector contract + endpoint behavior |
| Testing Library + jsdom | 6.6.3 / 25.0.1 | Frontend interaction tests | For program toggle + URL round-trip behavior |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Shared selector utility + API helper | Keep logic inline in `Catalog.tsx` click handlers | Faster to patch once, but regressions likely because behavior stays duplicated and implicit |
| Tighten `getProgramVariants` | Only patch frontend sort order | Leaves backend family grouping overly broad; frontend cannot recover from incorrect candidate set |

**Installation:**
```bash
# No new dependencies required for Phase 1.
```

## Architecture Patterns

### Recommended Project Structure
```text
frontend/src/
├── lib/programVariantSelection.ts       # deterministic client-side pick rules
├── pages/Catalog.tsx                    # calls selector utility, not inline sort
└── components/course/CourseFilters.tsx  # deterministic program option grouping

api/src/
├── services/programService.ts           # strict-first family matching + stable ordering
└── services/__tests__/programService.test.ts

frontend/src/
└── pages/__tests__/Catalog.program-mode.test.tsx
```

### Pattern 1: Single Deterministic Toggle Selector
**What:** One utility that selects a target variant for `major`/`minor` toggle using explicit priority rules.
**When to use:** Any program-kind toggle or restoration from URL state.
**Example:**
```typescript
// Source: frontend/src/pages/Catalog.tsx + research recommendation
pickVariant({
  current,
  targetKind: "major" | "minor",
  candidates,
  preferredDegree: current.degree,
  previousByKind,
});
// Priority: exact degree -> previous selection for target kind -> ranked fallback -> id tie-break
```

### Pattern 2: Strict-First Family Matching in API
**What:** Build candidate variants from normalized-name group, but prefer exact trimmed-name subset when it contains both kinds.
**When to use:** `GET /programs/:id/variants` candidate construction.
**Example:**
```typescript
// Source: api/src/services/programService.ts (enhancement target)
const base = rowsByNormalizedName;
const strict = base.filter((r) => lowerTrim(r.name) === lowerTrim(anchor.name));
const chosen = hasBothKinds(strict) ? strict : base;
```

### Pattern 3: URL Canonicalization Guard
**What:** Normalize invalid/missing `programTab` and keep URL/state in sync on deep link/refresh.
**When to use:** Catalog mount and param-change handling in program mode.
**Example:**
```typescript
// Source: frontend/src/pages/Catalog.tsx (enhancement target)
const safeTab = tab === "required" || tab === "electives" ? tab : "required";
if (searchParams.get("programTab") !== safeTab) setSearchParams(...);
```

### Anti-Patterns to Avoid
- **Inline ad-hoc sorting in button handlers:** hides business rules and encourages drift.
- **BA-only search filtering:** drops valid variants and violates PRGM-01.
- **Name-normalization-only trust without fallback contract:** can over-include variants with no quality gate.
- **Non-deterministic tie breaks:** sorting without full tie-break chain creates unstable behavior.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toggle target selection | Per-click inline sort snippets | Shared deterministic selector utility | Centralized, testable, prevents logic divergence |
| Variant family gating | One-off frontend filters over raw variants | API-provided strict-first family candidate set | Frontend should not infer family correctness from incomplete data |
| URL robustness | Implicit casts (`as ProgramTab`) only | Explicit tab validation/canonicalization | Prevents invalid deep-link behavior and silent errors |

**Key insight:** The correctness bug is contract drift, not missing UI controls. Fixing requires one explicit selection contract across API and frontend.

## Common Pitfalls

### Pitfall 1: BA-Only Program Option Bias
**What goes wrong:** Program families without BA major never appear in dropdown.
**Why it happens:** Hard-coded `major + BA` filter in `CourseFilters`.
**How to avoid:** Group all program results by family and choose deterministic representative.
**Warning signs:** Search results show "No programs found" for known non-BA offerings.

### Pitfall 2: Losing Degree Intent on Kind Toggle
**What goes wrong:** User on BS major toggles away/back and lands on BA (or arbitrary) major.
**Why it happens:** Toggle chooses first sorted candidate, not degree-aware counterpart.
**How to avoid:** Keep `previousByKind` + exact-degree-first rule.
**Warning signs:** Program id changes to a different degree after round-trip toggle.

### Pitfall 3: Over-Broad Family Match
**What goes wrong:** Variant set includes same-normalized but weakly related entries.
**Why it happens:** Backend grouping relies only on stripped normalized name.
**How to avoid:** strict-name subset first; normalized fallback only when strict set is insufficient.
**Warning signs:** Major/minor toggle lands on a variant with unexpected label lineage.

### Pitfall 4: URL Tab Drift
**What goes wrong:** `programTab` missing/invalid causes inconsistent behavior across refresh/deep links.
**Why it happens:** Cast-based tab handling without canonicalization loop.
**How to avoid:** Validate tab and write canonical value into URL.
**Warning signs:** API 400s or apparent empty results after manual/deep link navigation.

## Code Examples

Verified current patterns and planned replacement points:

### Current BA-only dropdown gate (replace)
```typescript
// Source: frontend/src/components/course/CourseFilters.tsx
const majorsOnly = (programResults ?? []).filter(
  (p) => p.kind === "major" && (p.degree || "").toUpperCase() === "BA"
);
```

### Current first-result toggle pick (replace)
```typescript
// Source: frontend/src/pages/Catalog.tsx
const pick = [...variants.majors].sort(/* BA/BS rank */)[0];
// and
const pick = [...variants.minors].sort((a, b) => a.id - b.id)[0];
```

### Current normalized-name grouping in API (tighten)
```typescript
// Source: api/src/services/programService.ts
const norm = normalizeProgramName(p.name);
.where(and(eq(programs.isActive, true), sql`${normExpr} = ${norm}`))
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Variant picked by first sorted item | Deterministic context-aware selector contract | Phase 1 target | Stable major/minor/degree behavior |
| Program search narrowed to BA majors | Family-preserving search representation | Phase 1 target | PRGM-01 coverage |
| Normalized-name-only family set | Strict-first + normalized fallback | Phase 1 target | Lower risk of unrelated fallback |

**Deprecated/outdated:**
- BA-only option filtering for program search in catalog filters.
- Per-handler sorting as implicit business logic.

## Test Strategy for Planning

| Req ID | Coverage Focus | Recommended Test Type | Command |
|--------|----------------|-----------------------|---------|
| PRGM-01 | Program search option generation keeps non-BA families | Frontend unit (selector/options utility) | `pnpm --filter frontend test -- programVariantSelection` |
| PRGM-02 | Major/minor toggle returns matching counterpart | Frontend unit + Catalog interaction test | `pnpm --filter frontend test -- Catalog.program-mode` |
| PRGM-03 | Degree-aware deterministic fallback and no unrelated picks | API service unit + frontend selector unit | `pnpm --filter api test -- programService` |
| PRGM-04 | URL deep-link/refresh stability for `programId`/`programTab` | Frontend integration-style jsdom test | `pnpm --filter frontend test -- Catalog.program-mode` |

Baseline test commands:
```bash
pnpm --filter api test
pnpm --filter frontend test
```

## Open Questions

1. **Degree precedence policy when exact counterpart is missing**
   - What we know: Current implicit preference is BA -> BS -> others.
   - What's unclear: Whether policy should remain BA-first globally or prefer last-selected degree per family.
   - Recommendation: Lock explicit precedence in plan acceptance criteria before implementation.

2. **How aggressive strict-family filtering should be in API**
   - What we know: Normalized-name-only match is too broad for reported issues.
   - What's unclear: Whether strict trimmed-name subset may exclude legitimate punctuation variants in real data.
   - Recommendation: Add tests covering punctuation/case variants and only fallback when strict set cannot satisfy both kinds.

3. **Should program dropdown display degree label in Phase 1**
   - What we know: `programLabel()` currently hides degree, and PRGM-05 (explicit degree picker) is out of scope.
   - What's unclear: Whether Phase 1 needs passive degree disambiguation text (without new control) to reduce confusion.
   - Recommendation: Keep UI minimal unless tests show ambiguous selection remains after logic fix.

## Sources

### Primary (HIGH confidence)
- `frontend/src/components/course/CourseFilters.tsx` - program search option filtering and selection behavior.
- `frontend/src/pages/Catalog.tsx` - program mode toggle logic, URL state handling.
- `frontend/src/hooks/usePrograms.ts` - query contracts for program/program variants/courses.
- `api/src/services/programService.ts` - program list and variant matching implementation.
- `api/src/routes/programs.ts` - endpoint wiring.
- `packages/shared/src/types/program.ts` - shared response contracts.
- `packages/shared/src/utils/validation.ts` - query schema constraints (`programsQuerySchema`, `programCoursesQuerySchema`).
- `api/package.json`, `frontend/package.json` - stack versions.
- `api/vitest.config.ts`, `frontend/vitest.config.ts` - test framework/config.

### Secondary (MEDIUM confidence)
- `api/src/jobs/programsSync.ts` - ingestion shape for `name/kind/degree/sourceUrl`, used to assess matching constraints.
- `api/src/db/schema.ts` - program table/index constraints.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - directly verified from package manifests and configs.
- Architecture: MEDIUM-HIGH - grounded in current code paths; some behavior depends on live program data distribution.
- Pitfalls: HIGH - directly observed in current implementation.

**Research date:** 2026-02-26
**Valid until:** 2026-03-28
