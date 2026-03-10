# Stack Research

**Domain:** v1.2 conversational AI behavior + Atlas-grounded course recommendations (API)
**Researched:** 2026-03-05
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | 20.x LTS (repo requires `>=20`) | Runtime for API route, native `fetch`, `AbortController`, and low-latency I/O | Already required by repo and fully compatible with current OpenAI + Express code paths |
| Express | 4.21.x (existing `^4.21.0`) | `/ai/course-recommendations` endpoint orchestration and middleware composition | Current route is already stable on this stack and supports incremental behavior upgrades without contract churn |
| TypeScript + Zod | TS 5.5.x + Zod 3.23.x | Request/response safety for prompt/messages/filters/preferences payloads | Zod-backed runtime constraints are critical for safe conversational inputs and deterministic fallback handling |
| OpenAI Chat Completions API | Use current `OPENAI_MODEL` default `gpt-4o-mini`; keep model configurable | Conversational response generation + strict JSON-schema response mode (with graceful fallback) | Existing `openAiChat/openAiChatJson` wrappers already implement retries and unsupported-parameter degradation paths |
| OpenAI Embeddings API | `text-embedding-3-small` (existing default) | Semantic recall for catalog-grounded candidate retrieval | Matches current hybrid lexical+semantic search pipeline and latency/cost profile for course lookup |
| PostgreSQL + pgvector/pg_trgm + Drizzle | Postgres 15/16 + Drizzle ORM 0.33.x (`^0.33.0`) | Atlas-grounded candidate set, filter enforcement, and vector similarity search | Keeps retrieval in the primary catalog DB; avoids external data drift and infra expansion for v1.2 |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `postgres` | 3.4.x (`^3.4.4`) | SQL transport for Drizzle and raw vector queries | Keep as the single DB client for both lexical and semantic retrieval paths |
| `express-rate-limit` | 7.4.x (`^7.4.0`) | Protect AI route from abuse/spikes | Apply to all high-cost AI entrypoints, including retries and “generate more” flows |
| `@betteratlas/shared` | workspace package | Shared `CourseWithRatings` and query shape alignment | Use for recommendation payload stability between API and frontend |
| Vitest | 2.1.x (`^2.1.9`) | Regression coverage for intent gating, grounding, and ranking behavior | Use for route/service tests that assert no hallucinated courses and correct filter behavior |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `pnpm --filter api embeddings:backfill` | Keep `course_embeddings` synchronized with catalog changes | Run after major catalog syncs or embedding model changes |
| Route timing/debug payloads in `ai.ts` | Latency and retrieval observability during milestone tuning | Preserve existing `debug` fields in non-production for ranking/grounding diagnostics |
| `.env` model toggles (`OPENAI_MODEL`, `OPENAI_EMBEDDING_MODEL`) | Safe runtime model iteration without code changes | Use config flips for A/B evaluation before changing defaults |

## Installation

```bash
# v1.2 recommendation: no mandatory new runtime dependencies.
# Keep current API stack and upgrade only within existing major lines.
pnpm --filter api up express@^4.21.0 zod@^3.23.0 drizzle-orm@^0.33.0 postgres@^3.4.4 vitest@^2.1.9
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Chat Completions + JSON-schema fallback in existing wrappers | Responses API migration | Use only when milestone scope includes full API-client migration and parity testing for structured outputs |
| Postgres `pgvector` retrieval in primary DB | Dedicated vector DB (Pinecone/Weaviate/etc.) | Use only if catalog size/traffic materially exceeds Postgres latency SLOs |
| Heuristic intent gate (`isCourseSuggestionIntent`) + conversational branch | Separate intent-classifier model | Use only if measured false-positive/false-negative rates remain high after heuristic tuning |
| In-process per-user short-term memory (6h TTL) | Redis-backed shared memory | Use only when running multiple API instances where memory consistency becomes user-visible |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| New agent frameworks (LangChain/LlamaIndex) for v1.2 | Adds orchestration complexity and hidden behavior drift; low value for one route | Keep explicit prompting + deterministic post-processing in `api/src/routes/ai.ts` |
| Non-Atlas knowledge retrieval for course recommendations | Violates milestone grounding requirement and introduces hallucinated catalog entries | Restrict recommendations to `searchCourses`/`semanticSearchCoursesByEmbedding` candidates only |
| External vector infra in this milestone | Extra ops burden and migration risk with no clear near-term need | Keep embeddings in `course_embeddings` table with existing SQL path |
| Frontend/API contract rewrites | Conflicts with compatibility constraint for existing clients | Preserve `/ai/course-recommendations` response shape and evolve internals only |

## Stack Patterns by Variant

**If user turn is conversational (no recommendation intent):**
- Use lightweight chat generation path only (`openAiChat`) with no course retrieval.
- Because v1.2 requires natural conversation without forcing recommendations on every turn.

**If user asks for course help/recommendations:**
- Use hybrid retrieval (filters + lexical + semantic + preference/global reranking), then generate assistant text from bounded candidate context.
- Because this maintains strict Atlas grounding and improves relevance under sparse or vague prompts.

**If candidate set is empty after hard filters:**
- Return explicit filter-relaxation guidance and no fabricated suggestions.
- Because correctness/grounding is higher priority than always returning recommendations.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `node@20.x` | `express@4.21.x`, native `fetch` usage in OpenAI wrappers | Node 20+ is required for current API implementation style |
| `drizzle-orm@0.33.x` | `postgres@3.4.x`, `drizzle-kit@0.24.x` | Keep Drizzle and migration tooling in compatible minor lines |
| `text-embedding-3-small` | `course_embeddings` vector schema | Embedding dimension must match table definition; model swaps require re-backfill |
| `zod@3.23.x` | current validate middleware + strict response parsing | Keep schema limits aligned with frontend payload sizes to avoid silent truncation regressions |
| `OPENAI_MODEL=gpt-4o-mini` (default) | current `chat/completions` + JSON-schema fallback logic | Some models vary on `response_format`/`temperature`; existing fallback behavior should remain intact |

## Sources

- `.planning/PROJECT.md` (milestone v1.2 goal/constraints)
- `api/src/routes/ai.ts` (intent gating, memory, retrieval, grounding, response shaping)
- `api/src/services/courseService.ts` (hybrid lexical+semantic retrieval, pgvector usage)
- `api/src/lib/openai.ts` and `api/src/lib/openaiEmbeddings.ts` (OpenAI integration behavior)
- `api/package.json` and root `package.json` (actual dependency and runtime versions)

---
*Stack research for: BetterAtlas v1.2 conversational Atlas-grounded chat*
*Researched: 2026-03-05*
