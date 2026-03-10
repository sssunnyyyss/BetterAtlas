# Phase 8: Memory and Multi-Turn Context Reliability - Research

**Researched:** 2026-03-06  
**Domain:** Session memory reliability, topic-shift handling, and latest-turn prioritization in `POST /api/ai/course-recommendations`  
**Confidence:** HIGH

## User Constraints

- Only write this file: `.planning/phases/08-memory-and-multi-turn-context-reliability/08-RESEARCH.md`.
- Do not revert or interfere with concurrent edits by other contributors.
- Phase scope is exactly: memory and multi-turn context reliability after Phase 7.
- Must cover requirement IDs: `AIMEM-01`, `AIMEM-02`, `AIMEM-03`.
- Project instruction files are absent: `CLAUDE.md` missing, `.agents/skills/` missing.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AIMEM-01 | User chat memory is isolated per user session, TTL-bounded, and clearable through explicit reset behavior. | Add explicit session keying and a dedicated memory-state module with TTL + bounded history + clear API; wire reset to clear all session-scoped state. |
| AIMEM-02 | User topic shifts cause stale recommendation constraints to decay or reset so new intent is prioritized. | Introduce deterministic topic-shift detection and constraint-decay policy that resets stale inferred constraints when intent/topic changes. |
| AIMEM-03 | User latest-turn intent and constraints are prioritized over older turns during recommendation generation. | Build a context assembly policy where latest turn drives retrieval/constraints and historical context is only soft context after conflict checks. |
</phase_requirements>

## Summary

The codebase already has short-term in-memory state (`memoryByUser` in `api/src/routes/ai.ts`) and reset behavior, but reliability is incomplete for this phase. The largest planning-critical gap is that first-party chat currently sends `messages` on every request from `frontend/src/features/ai-chat/hooks/useChatSession.ts`, which bypasses server memory assembly (`prompt` path) and weakens server-side TTL/session guarantees. There is also no explicit topic-shift detector or stale-constraint decay policy.

Current behavior is close to the desired architecture but needs one consolidation pass: move memory orchestration into a dedicated state helper, key memory by a true chat session identity, and formalize context assembly rules so latest-turn intent/constraints always dominate recommendation generation.

**Primary recommendation:** Implement a dedicated session-context state module and route-level context policy that (1) enforces session-scoped TTL memory, (2) detects topic shifts and clears stale inferred constraints, and (3) always gives latest-turn constraints precedence during recommend-mode retrieval and response assembly.

## Current-State Findings (Planning-Critical)

- `api/src/routes/ai.ts` already has memory primitives:
  - `MEMORY_TTL_MS = 6h`, `MEMORY_MAX_MESSAGES = 6`
  - `getUserMemory`, `setUserMemory`, `clearUserMemory`
- Memory is currently keyed by `userId` only (not explicit chat session), so multiple concurrent sessions for the same authenticated user share one memory bucket.
- Memory is only used when request uses `prompt`; if `messages` is present, route uses those directly and bypasses stored memory.
- First-party chat currently sends `messages` (not `prompt`) each turn, so server memory policy is effectively bypassed in normal UI usage.
- Reset behavior exists (`reset=true`) and clears chat memory plus session blocklist for authenticated users.
- Topic-shift handling does not exist yet: no module tracks inferred constraints with decay/reset logic.
- `classifyIntent` uses `latestUser` and does not currently use `recentMessages` for disambiguation.
- Route tests cover intent/grounding/relevance well, but there is no dedicated route test file for memory isolation, topic shift decay, or latest-turn precedence.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | >=20 | Runtime for in-memory state + route orchestration | Existing project baseline. |
| Express | ^4.21.0 | AI route middleware/orchestration | Current endpoint contract is stable. |
| TypeScript | ^5.5.0 | Typed state contracts and deterministic policies | Needed for safe context-policy extraction. |
| Zod | ^3.23.0 | Request schema extension (`sessionId`, reset contracts) | Existing validation path in route. |
| Vitest | ^2.1.9 | Unit + route regression tests | Existing API regression framework. |

### Supporting

| Module | Purpose | When to Use |
|--------|---------|-------------|
| `api/src/routes/ai.ts` | Primary orchestration integration point | Keep as adapter, move memory logic into helpers. |
| `api/src/ai/grounding/sessionBlocklistState.ts` | TTL state pattern reference | Reuse style for new memory/context state helper. |
| `frontend/src/features/ai-chat/hooks/useChatSession.ts` | First-party request-shape source | Update to send session-scoped prompt requests. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| In-process session state helper (now) | Redis-backed session store | Better cross-instance consistency, but larger scope than Phase 8. |
| Rule-based topic-shift detector | LLM-based topic classification | Higher complexity/cost and less deterministic testability. |
| Back-compat `messages` path for legacy callers | Hard cutover to `prompt` only | Safer compatibility to keep `messages` temporarily, but first-party UI should move to `prompt`. |

## Recommended Approach

### 1. Introduce Explicit Session-Scoped Context State (AIMEM-01)

- Create a dedicated module (for example `api/src/ai/memory/sessionContextState.ts`) with:
  - `getSessionContext(sessionKey)`
  - `upsertSessionContext(sessionKey, patch)`
  - `clearSessionContext(sessionKey)`
- Session record should include:
  - bounded recent messages
  - updatedAt (TTL enforcement)
  - lightweight inferred recommendation constraints (separate from raw messages)
  - topic fingerprint metadata (for decay/reset decisions)
- Add bounded-map hygiene (evict stale entries opportunistically) so inactive keys do not accumulate indefinitely.

### 2. Key Memory by Chat Session, Not Just User (AIMEM-01)

- Add optional request `sessionId` (string, bounded length) to `recommendSchema`.
- Build a stable `sessionKey`:
  - authenticated: `user:${userId}:session:${sessionId}`
  - unauthenticated: `anon:session:${sessionId}`
  - compatibility fallback (no sessionId): existing behavior
- Keep explicit `reset=true` behavior to clear session memory and related session-scoped recommendation state.

### 3. Add Topic-Shift Decay Policy (AIMEM-02)

- Maintain inferred constraints separately from explicit current-turn inputs.
- Detect topic shifts with deterministic heuristics:
  - low token overlap between prior topic fingerprint and latest user turn
  - explicit shift phrases (`actually`, `instead`, `switching`, `different`)
  - contradictory constraint signals (e.g., prior department/semester vs latest)
- On shift:
  - clear or decay inferred constraints from prior topic
  - keep explicit hard exclusions/dislikes behavior from Phase 6 unchanged unless reset
  - preserve only minimal recent conversational context needed for continuity

### 4. Enforce Latest-Turn Priority Contract (AIMEM-03)

- Retrieval query terms, active filters, and recommend-mode constraints must be derived from latest turn + current request first.
- Historical memory should be soft context only when non-conflicting.
- Add explicit precedence rule:
  - current explicit constraints > latest-turn inferred constraints > prior-turn inferred constraints.
- Keep this policy deterministic in code (not prompt-only).

### 5. Align First-Party Chat Request Shape With Server Memory

- Update `useChatSession` to prefer `{ prompt, sessionId, ... }` for turn sends.
- Keep local UI turn history for rendering; do not rely on client message replay for server memory in first-party chat.
- Keep `messages` request support for compatibility callers, but first-party chat should use prompt path so Phase 8 guarantees are enforceable.

## Architecture Patterns

### Pattern 1: Session Context Envelope

**What:** One TTL-bounded object per chat session containing bounded history + inferred constraints.  
**When to use:** On every turn, before intent and retrieval decisions.

```ts
type SessionContext = {
  messages: AiMessage[];
  inferredConstraints: {
    department?: string;
    semester?: string;
    workload?: "easy" | "moderate" | "hard";
  };
  topicFingerprint: string[];
  updatedAt: number;
};
```

### Pattern 2: Topic Shift Gate Before Recommendation Assembly

**What:** Detect shift, then clear stale inferred constraints before building retrieval/query context.  
**When to use:** Recommend-mode and clarify-to-recommend transitions.

```ts
const shift = detectTopicShift(previousContext, latestUser, activeFilters);
const nextContext = shift.detected
  ? clearStaleConstraints(previousContext)
  : previousContext;
```

### Pattern 3: Deterministic Constraint Precedence

**What:** Resolve constraints by explicit priority order.  
**When to use:** Retrieval filters, ranking inputs, and model context text.

```ts
const resolved = {
  ...priorInferredConstraints,
  ...latestInferredConstraints,
  ...explicitRequestConstraints, // highest priority
};
```

### Anti-Patterns to Avoid

- Letting first-party clients bypass server memory policy by always sending full `messages`.
- Persisting only raw message history without structured inferred-constraint state.
- Decaying explicit hard exclusions/dislikes from Phase 6 as part of topic-shift cleanup.
- Implementing topic shifts only through prompt wording without deterministic server policy.

## Don’t Hand-Roll

| Problem | Don’t Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Memory logic spread across route branches | Inline map mutations in `ai.ts` | Dedicated session-context helper module | Keeps TTL/clear/isolation behavior testable and consistent. |
| Ambiguous topic handling in prompt text only | Prompt-only "focus on latest request" instructions | Deterministic topic-shift detector + constraint precedence policy | Requirement demands observable reliability, not best-effort prompting. |
| Ad hoc regression checks | Manual-only validation | Route-level Vitest suites + unit tests for state helper | Prevents drift across future routing/ranking changes. |

## Common Pitfalls

### Pitfall 1: False Session Isolation

**What goes wrong:** Memory appears isolated but is keyed by user only, causing cross-tab/cross-window bleed.  
**How to avoid:** Key by session identity; test same user with two `sessionId`s.

### Pitfall 2: Topic-Shift Over-Reset

**What goes wrong:** Detector resets context too aggressively, losing useful continuity.  
**How to avoid:** Combine lexical overlap + explicit shift cues + contradiction checks; validate with mixed-topic tests.

### Pitfall 3: Topic-Shift Under-Reset

**What goes wrong:** Old constraints persist and override new requests.  
**How to avoid:** Add hard precedence where latest explicit/latest inferred always override prior inferred constraints.

### Pitfall 4: Untested Memory Paths

**What goes wrong:** TTL/reset/session behavior regresses silently while intent/grounding tests still pass.  
**How to avoid:** Add dedicated memory-context route tests and unit tests for state helpers.

## Code Examples

### Session Key Resolution

```ts
function resolveSessionKey(input: { userId?: string | null; sessionId?: string | null }) {
  const sid = (input.sessionId ?? "").trim();
  if (!sid) return input.userId ? `user:${input.userId}` : null;
  return input.userId ? `user:${input.userId}:session:${sid}` : `anon:session:${sid}`;
}
```

### Latest-Turn-First Context Build

```ts
const latestUser = getLatestUserTurn(effectiveMessages);
const latestConstraints = inferConstraintsFromTurn(latestUser);
const resolvedConstraints = resolveConstraints({
  priorInferred: context.inferredConstraints,
  latestInferred: latestConstraints,
  explicit: normalizeAiFilters(filters),
});
```

### Topic-Shift Reset Hook

```ts
if (detectTopicShift({ previous: context.topicFingerprint, latestUser, resolvedConstraints }).detected) {
  context.inferredConstraints = {};
  context.messages = context.messages.slice(-2);
}
```

## State of the Art (Project-Specific)

| Current State | Phase 8 Target | Impact |
|---------------|----------------|--------|
| Memory map exists with TTL and max-message bounds but is keyed by user and partly bypassed by client `messages` payloads. | Session-scoped context state with explicit keying, bounded TTL, and first-party prompt-based usage. | Satisfies AIMEM-01 with observable isolation and reset behavior. |
| No deterministic topic-shift detector or stale-constraint decay policy. | Deterministic topic-shift handling that clears stale inferred constraints before recommendation generation. | Satisfies AIMEM-02 and reduces drift. |
| Latest user turn drives intent classification and retrieval query, but older messages can still dominate prompt context. | Explicit latest-turn precedence policy for resolved constraints and model context assembly. | Satisfies AIMEM-03 and stabilizes multi-turn intent behavior. |

## Test Strategy for Planning

### Unit Tests

- `sessionContextState`:
  - TTL expiry boundary
  - bounded history trimming
  - per-session isolation
  - explicit clear/reset
- `topicShiftPolicy`:
  - clear shift detection cases
  - no-shift continuity cases
  - contradiction-driven shift cases

### Route Tests (`POST /ai/course-recommendations`)

- Same user, two session IDs: no memory bleed.
- Reset on one session key does not clear another session for same user.
- Topic shift from old domain to new domain clears stale inferred constraints.
- Latest-turn explicit constraints override previous-turn inferred constraints.
- Backward compatibility path (`messages`) remains valid but does not break prompt-session policy.

### Commands

- `pnpm --filter api test -- src/ai/memory/sessionContextState.test.ts`
- `pnpm --filter api test -- src/ai/memory/topicShiftPolicy.test.ts`
- `pnpm --filter api test -- src/routes/ai.memory-context.test.ts`
- `pnpm --filter api test`

## Open Questions

1. Should `sessionId` be request-body field, header, or both for compatibility?
2. Should Phase 8 migrate session blocklist storage to the same session key (from user-only) now, or defer to follow-up hardening?
3. What shift threshold should be used initially to balance false resets vs stale-context carryover?

## Sources

### Primary (HIGH confidence)

- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- `.planning/ROADMAP.md`
- `.planning/research/SUMMARY.md`
- `.planning/research/FEATURES.md`
- `.planning/research/ARCHITECTURE.md`
- `.planning/research/PITFALLS.md`
- `.planning/codebase/CONCERNS.md`
- `api/src/routes/ai.ts`
- `api/src/ai/intent/intentRouter.ts`
- `api/src/ai/grounding/sessionBlocklistState.ts`
- `api/src/ai/grounding/sessionBlocklistState.test.ts`
- `api/src/routes/ai.intent-routing.test.ts`
- `api/src/routes/ai.grounding-safety.test.ts`
- `api/src/routes/ai.relevance-calibration.test.ts`
- `frontend/src/features/ai-chat/hooks/useChatSession.ts`
- `frontend/src/hooks/useAi.ts`
- `api/package.json`
- `.planning/config.json`

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH (directly verified from repo dependencies and active modules).
- Architecture: HIGH (rooted in current route behavior and proven phase patterns).
- Pitfalls/topic-shift policy: MEDIUM-HIGH (gaps are clear; threshold tuning still needs implementation calibration).

**Research date:** 2026-03-06  
**Valid until:** 2026-04-05

## RESEARCH COMPLETE

- Phase 8 is primarily a server-side context-policy hardening phase plus first-party request-shape alignment.
- The key hidden gap is current first-party `messages` payload usage, which bypasses server memory guarantees.
- Planning should prioritize: session-keyed state module, topic-shift decay policy, latest-turn precedence contract, and dedicated memory regression tests.
