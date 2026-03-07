# AI Regression Gate

This runbook defines the release-blocking AI safety and observability gate for BetterAtlas.

## Purpose

The gate ensures AI behavior and observability contracts do not regress before merge or release.

## Canonical Commands

- API scope: `pnpm --filter api run test:ai:gates`
- Workspace alias: `pnpm run test:ai:gates`

Both commands execute the same release gate path.

## Included Test Matrix

The gate runs API build plus the full AI route regression suites:

- `src/routes/ai.intent-routing.test.ts`
- `src/routes/ai.grounding-safety.test.ts`
- `src/routes/ai.relevance-calibration.test.ts`
- `src/routes/ai.memory-context.test.ts`
- `src/routes/ai.observability.test.ts`

## Blocking Policy

Any non-zero exit from `test:ai:gates` is release-blocking. Do not merge or ship until the gate returns success.

## Failure Triage

1. Re-run `pnpm --filter api run test:ai:gates` to confirm reproducibility.
2. Read the failing suite first to identify contract drift:
   - intent/cadence regressions: `ai.intent-routing.test.ts`
   - grounding/safety regressions: `ai.grounding-safety.test.ts`
   - relevance/filter diagnostics regressions: `ai.relevance-calibration.test.ts`
   - memory/session regressions: `ai.memory-context.test.ts`
   - telemetry/debug contract regressions: `ai.observability.test.ts`
3. Fix behavior at the route/policy layer (not by weakening assertions).
4. Re-run `pnpm --filter api run test:ai:gates` until green.

## Observability Contract Notes

`ai.observability.test.ts` explicitly validates:

- telemetry events are emitted for success/fallback/error/reset outcomes
- telemetry snapshots stay production-safe (aggregate counters only)
- debug diagnostics are present in non-production and hidden in production
