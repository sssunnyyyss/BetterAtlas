# Architecture Research

**Domain:** Backend conversational recommendation architecture for Atlas-grounded AI chat
**Researched:** 2026-03-05
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    Transport + Compatibility Layer                          │
├──────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────┐   ┌─────────────────────────────────────┐ │
│  │ `POST /ai/course-...` route  │   │ Contract Adapter (req/res mapping) │ │
│  └───────────────┬──────────────┘   └─────────────────┬───────────────────┘ │
│                  │                                    │                     │
├──────────────────┴────────────────────────────────────┴─────────────────────┤
│                        AI Orchestration Layer                               │
├──────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐  ┌────────────────┐ │
│  │Intent Router│→ │Context Builder│→ │Grounding Policy │→ │LLM Responder   │ │
│  └──────┬──────┘  └──────┬───────┘  └────────┬────────┘  └──────┬─────────┘ │
│         │                │                    │                  │           │
│  ┌──────▼───────┐  ┌─────▼──────────┐  ┌─────▼──────────┐  ┌────▼────────┐  │
│  │Conversation  │  │Candidate        │  │Guardrail       │  │Response      │  │
│  │Memory Store  │  │Retrieval+Rank   │  │Validators      │  │Assembler      │  │
│  └──────────────┘  └─────────────────┘  └────────────────┘  └──────────────┘  │
├──────────────────────────────────────────────────────────────────────────────┤
│                        Data + External Services                              │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐  ┌────────────┐ │
│  │Catalog services│  │Trainer scores  │  │OpenAI chat/json│  │Embeddings  │ │
│  └────────────────┘  └────────────────┘  └────────────────┘  └────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Route + contract adapter | Keep request/response contract stable while delegating logic | Thin Express handler calling one orchestrator function |
| Intent router | Decide conversational vs recommendation path | Rule-first classifier with explicit confidence and reason |
| Candidate retrieval engine | Fetch Atlas-only course candidates under hard filters | Parallel lexical + semantic retrieval + dedupe + capped pool |
| Ranking engine | Reorder candidates using preferences + global scores | Deterministic scoring functions with bounded weights |
| Grounding policy | Enforce “recommend from candidate set only” and filter/exclusion compliance | Validation gates before and after LLM call |
| Response assembler | Build assistant text and recommendation payload from grounded outputs | JSON-schema parse + mention mapping + deterministic fallback |
| Memory/cache subsystem | Maintain short user conversation state and retrieval caches | TTL map abstraction now, swappable backend later |

## Recommended Project Structure

```
api/src/
├── routes/
│   └── ai.ts                              # Keep public endpoint + middleware + adapter
├── ai/
│   ├── orchestrator/
│   │   └── recommendOrchestrator.ts       # End-to-end flow coordinator
│   ├── intent/
│   │   ├── intentRouter.ts                # Course-intent vs conversational routing
│   │   └── intentSignals.ts               # Phrase/code/trivial-greeting heuristics
│   ├── retrieval/
│   │   ├── candidateRetriever.ts          # Lexical+semantic retrieval and merge
│   │   ├── candidateRanker.ts             # Preference/global score ranking
│   │   └── retrievalTypes.ts              # Shared retrieval DTOs
│   ├── grounding/
│   │   ├── groundingPolicy.ts             # Candidate-set enforcement rules
│   │   ├── outputValidator.ts             # JSON + mention/reference checks
│   │   └── fallbackPolicy.ts              # Safe non-grounded fallback behavior
│   ├── response/
│   │   ├── llmResponder.ts                # OpenAI chat/json invocation
│   │   ├── recommendationAssembler.ts     # Recommendations from mentions/fallback
│   │   └── contractMapper.ts              # Maps internal model to existing API schema
│   └── state/
│       ├── aiMemoryStore.ts               # User memory abstraction + TTL
│       └── aiCacheStore.ts                # Departments/candidates/trainer cache abstraction
└── services/
    ├── courseService.ts                   # Existing catalog integration (unchanged)
    └── aiTrainerService.ts                # Existing trainer score integration (unchanged)
```

### Structure Rationale

- **`routes/ai.ts`:** preserves current API compatibility and middleware contract (`optionalAuth`, `aiLimiter`, validation).
- **`ai/orchestrator/`:** centralizes control flow so route files stay thin.
- **`ai/intent`, `ai/retrieval`, `ai/grounding`, `ai/response`:** separates behavior axes that currently live in one large route file.
- **`ai/state/`:** makes in-memory TTL behavior explicit and replaceable (Redis or DB-backed session later).

## Architectural Patterns

### Pattern 1: Intent-First Branching

**What:** Evaluate user turn intent before retrieval/LLM cost.
**When to use:** Every request on `/ai/course-recommendations`.
**Trade-offs:** Rules are transparent but require maintenance; optional model classifier can improve recall later.

**Example:**
```typescript
const intent = intentRouter.classify({ latestUserMessage, history, reset });
if (intent.type === "trivial") return trivialGreetingResponse();
if (intent.type === "conversational") return conversationalReplyFlow();
return recommendationFlow();
```

### Pattern 2: Dual-Path Candidate Retrieval With Deterministic Merge

**What:** Retrieve via semantic and lexical paths, then merge, dedupe, cap, and diversify.
**When to use:** Recommendation path with Atlas-grounded output requirement.
**Trade-offs:** Slightly higher complexity, much better recall and resilience.

**Example:**
```typescript
const [semantic, lexical] = await Promise.all([
  semanticRetriever.search(query, filters),
  lexicalRetriever.search(terms, filters),
]);
const candidates = mergeAndConstrain({
  semantic,
  lexical,
  fillers,
  max: 42,
  minSemantic: 6,
  maxPerDept: 6,
});
```

### Pattern 3: Grounded Generation + Post-Generation Verification

**What:** Constrain prompt to candidate list, then verify mentions map to known candidates.
**When to use:** Any LLM-generated recommendation text.
**Trade-offs:** May drop invalid suggestions; improves trust and policy compliance.

**Example:**
```typescript
const llm = await llmResponder.generateGroundedJson({ context, candidates });
const verified = outputValidator.verifyMentions(llm.assistant_message, candidates);
const recommendations = recommendationAssembler.fromVerifiedMentions(verified, candidates);
```

## Data Flow

### Request Flow

```
[Client prompt/messages + filters + preferences]
    ↓
[Express route + schema validation + auth/limit]
    ↓
[Intent Router]
    ↓
[Conversation path] OR [Recommendation path]
                      ↓
          [Candidate Retrieval (lexical + semantic + fillers)]
                      ↓
          [Ranking (preferences + trainer scores)]
                      ↓
          [Grounded prompt/context assembly]
                      ↓
          [LLM JSON response + fallback handling]
                      ↓
          [Mention verification + recommendation assembly]
                      ↓
[Contract mapper → assistantMessage, followUpQuestion, recommendations]
```

### State Management

```
[Request context]
    ↓
[Memory Store (per-user TTL)] ←→ [Orchestrator]
    ↓
[Cache Store (deps/top-rated/trainer scores TTL)]
```

### Key Data Flows

1. **Intent routing flow:** `prompt/messages` + recent memory become `intent.type` (`trivial`, `conversational`, `recommendation`) and determine downstream cost profile.
2. **Grounded recommendation flow:** filters/preferences/exclusions shape candidate set, then LLM is constrained to candidates and output is post-validated before response mapping.
3. **Compatibility flow:** internal response (`assistant_message`, mentions, debug facts) is mapped back to existing API keys (`assistantMessage`, `recommendations`, optional `debug`) without frontend breakage.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-5k DAU | Keep monolith route contract, extract internal modules, retain in-memory TTL caches |
| 5k-50k DAU | Move memory/cache to Redis, add retrieval timing budgets, add intent and grounding metrics |
| 50k+ DAU | Split AI orchestration into dedicated service/process, add queue/backpressure and model routing policy |

### Scaling Priorities

1. **First bottleneck:** LLM + embedding latency/cost. Add strict intent gating, semantic-call conditions, and timeout/fallback budgets.
2. **Second bottleneck:** Shared in-memory state across instances. Move memory/caches to distributed store and key by user/session.

## Anti-Patterns

### Anti-Pattern 1: Monolithic Route as Business Engine

**What people do:** Keep intent logic, retrieval logic, ranking, prompt building, and response assembly in one route file.
**Why it's wrong:** Hard to test, high regression risk, and fragile concurrent changes.
**Do this instead:** Keep route as adapter; move orchestration and domain logic into bounded modules.

### Anti-Pattern 2: LLM-First Recommendations Without Retrieval Constraints

**What people do:** Ask model for course suggestions before Atlas candidate retrieval.
**Why it's wrong:** Hallucinated or off-catalog recommendations violate grounding policy.
**Do this instead:** Retrieve candidates first, constrain generation to candidate list, and verify mentions post-generation.

### Anti-Pattern 3: Breaking API Contract During Refactor

**What people do:** Rename payload fields or alter response shape while reorganizing backend internals.
**Why it's wrong:** Frontend regressions and hidden production breakage.
**Do this instead:** Preserve `POST /ai/course-recommendations` schema and response keys; use internal contract mapper for transformations.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| OpenAI chat/json | Wrapper module (`openAiChat`, `openAiChatJson`) from responder layer | Keep schema-first JSON call with chat fallback path |
| OpenAI embeddings | Conditional semantic retrieval input | Only run when query length/feature availability thresholds pass |
| Atlas catalog DB via course service | Retrieval + filters + filler candidates | Filters must remain hard constraints for recommendations |
| AI trainer score service | Global reranking signal | Keep bounded weight to avoid overwhelming personal preference signals |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `routes/ai.ts` ↔ `ai/orchestrator` | Direct function call with typed DTO | Route owns HTTP concerns; orchestrator owns behavior |
| `ai/orchestrator` ↔ `ai/intent` | Pure function/classification result | Must return explainable reason for observability |
| `ai/orchestrator` ↔ `ai/retrieval` | Typed retrieval request/response | Retrieval layer must be deterministic and side-effect free |
| `ai/orchestrator` ↔ `ai/grounding` | Policy check interfaces | Guardrails should fail closed for ungrounded recommendations |
| `ai/orchestrator` ↔ `ai/response` | Request/response DTOs | Response layer handles model-specific formatting and parsing only |
| `ai/orchestrator` ↔ `ai/state` | Memory/cache abstractions | Enables swap from in-memory TTL to distributed stores |

## Sources

- `.planning/PROJECT.md`
- `.planning/codebase/ARCHITECTURE.md`
- `api/src/routes/ai.ts`
- `/root/.codex/get-shit-done/templates/research-project/ARCHITECTURE.md`

---
*Architecture research for: BetterAtlas v1.2 conversational Atlas-grounded AI backend*
*Researched: 2026-03-05*
