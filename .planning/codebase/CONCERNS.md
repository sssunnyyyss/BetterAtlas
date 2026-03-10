# Codebase Concerns

**Analysis Date:** 2026-02-24

## Tech Debt

**Type Safety Gaps (any/as):**
- Issue: Multiple locations use `any` type assertions and `as any` casts instead of proper TypeScript types
- Files: `api/src/db/applySchemaMigration.ts`, `api/src/jobs/atlasSync.ts`, `api/src/jobs/courseEmbeddingsBackfill.ts`, `api/src/jobs/programsSync.ts`, `api/src/jobs/reviewSummarization.ts`, `api/src/jobs/rmpSeed.ts`, `api/src/lib/openai.ts`
- Impact: Runtime type errors possible, IDE intellisense incomplete, harder to refactor safely
- Fix approach: Define proper TypeScript interfaces for database query results, API responses, and create strict parsing layer for unsafe SQL queries in `api/src/db/applySchemaMigration.ts`

**Large, Monolithic Job Files:**
- Issue: Complex sync jobs exceed 1800 lines (atlasSync.ts: 1844L, rmpSeed.ts: 1817L)
- Files: `api/src/jobs/atlasSync.ts`, `api/src/jobs/rmpSeed.ts`, `api/src/routes/adminPrograms.ts` (1656L)
- Impact: Hard to test, maintain, and understand control flow; difficult to isolate failure points during sync operations
- Fix approach: Extract parsing, validation, and data transformation into separate service modules; keep job files for orchestration only

**In-Memory Caching Without Bounds:**
- Issue: Memory caches lack TTL cleanup for expired entries (`memoryByUser`, `majorRatedCacheByDept`, `instructorIdCacheByName/Email`)
- Files: `api/src/routes/ai.ts` (lines 315, 336-347), `api/src/jobs/atlasSync.ts` (line 68-70)
- Impact: Long-running processes accumulate stale cache entries; memory leak in production AI route after extended uptime
- Fix approach: Implement LRU cache or periodic cleanup; consider external cache (Redis) for distributed deployment

**Loose Error Handling in Data Sync:**
- Issue: Try-catch blocks catch all errors generically, swallowing specifics that would help debugging
- Files: `api/src/jobs/programsSync.ts` (line 35: `catch (err: any)`), multiple job files
- Impact: Difficult to distinguish between API failures, parsing errors, and data consistency issues; retry logic can't be intelligent
- Fix approach: Create custom error classes for different failure types; log structured error metadata before catch

**Deprecated RMP API Usage:**
- Issue: RateMyProfessor integration uses RMP GraphQL API which may change without notice; headers hardcoded (User-Agent, Authorization: Basic "test:test")
- Files: `api/src/jobs/rmpSeed.ts` (lines 64-78)
- Impact: Sync can break silently if RMP changes API; hardcoded auth suggests either placeholder or unsecured; no fallback if RMP is unavailable
- Fix approach: Add RMP API version detection; implement feature flag to disable RMP sync if API unreachable; monitor RMP deprecation notices

## Known Bugs

**Memory State Accumulation in AI Route:**
- Symptoms: AI chat conversation memory persists in memory Maps across requests; old conversations never garbage-collected
- Files: `api/src/routes/ai.ts` (line 315: `memoryByUser`)
- Trigger: User with same ID makes multiple requests over many hours; memory map grows unbounded
- Workaround: Server restart clears all chat memory; users lose context after server reboot

**RMP Matching May Create Duplicate Instructors:**
- Symptoms: Same instructor matched multiple times with slight name variations, creating duplicate records
- Files: `api/src/lib/rmpMatching.ts`, `api/src/jobs/rmpSeed.ts` (matching logic lines 1-200)
- Trigger: Instructor names with titles (Dr., Prof.) or inconsistent formatting in RMP vs. Atlas
- Workaround: Manual database cleanup of duplicate instructor records; match threshold tuning

**JSON.parse Without Error Handling:**
- Symptoms: Silent failures when database columns contain malformed JSON
- Files: `api/src/services/courseService.ts` (lines 426, 442, 463), `api/src/jobs/rmpSeed.ts` (line 952), `api/src/jobs/atlasSync.ts` (lines 846, 961), `frontend/src/pages/AiChat.tsx` (line 53)
- Trigger: Corrupted data in database jsonb columns or localStorage
- Workaround: Restart API; check database integrity; clear browser localStorage

**Section Instructor Sync Assumes Table Exists:**
- Symptoms: Sync may fail silently if `section_instructors` table hasn't been migrated
- Files: `api/src/jobs/atlasSync.ts` (lines 72-83), `api/src/services/courseService.ts` (lines 26-41)
- Trigger: Partial migration or rollback leaving old schema
- Workaround: Ensure database migrations are applied before running sync jobs; manual schema check required

## Security Considerations

**In-Memory User Session Storage:**
- Risk: User conversation memory stored in plain JavaScript Map without encryption; contents accessible to any code with module access
- Files: `api/src/routes/ai.ts` (line 315)
- Current mitigation: Bounded to server memory only (not persisted to disk or cache)
- Recommendations: Use authenticated session storage (Redis); audit chat history access; implement session timeout with explicit logout

**RMP API Basic Auth Hardcoded:**
- Risk: RMP GraphQL endpoint accepts `Authorization: Basic dGVzdDp0ZXN0` (test:test in base64); this appears to be public/unsecured credential
- Files: `api/src/jobs/rmpSeed.ts` (line 73)
- Current mitigation: None; credentials are hardcoded and public
- Recommendations: Confirm RMP API security model with RMP; if this is shared public auth, document; if not, use environment variable; add rate limiting per RMP IP block

**Unsanitized User-Supplied Content in AI Prompts:**
- Risk: User message content directly included in OpenAI system prompts without sanitization; potential prompt injection
- Files: `api/src/routes/ai.ts` (lines 1086-1123 counselorContextText includes user preferences/filters)
- Current mitigation: Zod validation on message length (max 4000 chars) and schema validation of preferences
- Recommendations: Add prompt injection detection; sanitize user text before concatenation; use OpenAI function calling instead of raw prompt concatenation

**Database Credentials in Schema Inspection:**
- Risk: Functions attempt to query system catalog (`to_regclass`) which may expose auth issues if queries fail
- Files: `api/src/jobs/atlasSync.ts` (lines 75-77), `api/src/services/courseService.ts` (lines 32-34)
- Current mitigation: Errors caught and default to false, but error logs may contain sensitive context
- Recommendations: Add explicit schema migration checks; avoid runtime table existence probes; migrate to explicit feature flags

**Missing CSRF/CORS Validation on Feedback Hub:**
- Risk: Feedback posts/votes accept user submissions without explicit origin validation
- Files: `api/src/routes/feedbackHub.ts`, `api/src/services/feedbackHubService.ts`
- Current mitigation: Helmet is configured; authentication required
- Recommendations: Add double-submit cookie CSRF tokens; audit cors configuration in `api/src/middleware`

## Performance Bottlenecks

**AI Route Concatenates 40+ Course Objects as JSON:**
- Problem: Candidates list serialized as JSON string inside LLM prompt (lines 1036-1052, 1121-1122); copying large course objects 10+ times through filters
- Files: `api/src/routes/ai.ts`
- Cause: No streaming; entire result set marshaled into single prompt before sending to OpenAI
- Improvement path: Reduce candidate detail fields sent to LLM; implement streaming responses; pre-compute candidate summaries

**N+1 Queries in Course Listings:**
- Problem: Course queries fetch instructors/ratings/GER separately without joins/aggregation in single query
- Files: `api/src/services/courseService.ts` (lines 91-180 avgGradePointsByCourseIds loops over results)
- Cause: Drizzle ORM relational queries not optimized; separate queries for each dimension
- Improvement path: Batch queries with `inArray`; use window functions for per-course aggregations; consider materialized views for ratings

**Embedding Search Regenerated on Every Request:**
- Problem: Course embeddings recalculated if OpenAI embeddings unavailable; no cache for computed embeddings
- Files: `api/src/routes/ai.ts` (lines 891-910), `api/src/services/courseService.ts`
- Cause: Embeddings table may be empty; fallback to lexical search generates no embeddings
- Improvement path: Ensure embeddings backfill job completes before enabling semantic search; add embedding cache TTL; pre-compute popular query embeddings

**Memory Leak in RMP Sync Progress Tracking:**
- Problem: Checkpoint file read/written per iteration; large instructor cache maps not cleared between pages
- Files: `api/src/jobs/rmpSeed.ts` (lines 68-70 caches, line 952 checkpoint parsing)
- Cause: Caches intended for within-run dedup but never cleared
- Improvement path: Scope caches to page; use database for resume state instead of file; batch write checkpoints

**Course Ratings Aggregation Query Complexity:**
- Problem: Course ratings cache updated on every review; no batch update strategy
- Files: `api/src/services/reviewService.ts`, `api/src/routes/reviews.ts`
- Cause: Per-review rating recalculation instead of batched updates
- Improvement path: Implement review batch processing; defer rating recalc until after batch completes

## Fragile Areas

**Atlas FOSE API Integration:**
- Files: `api/src/jobs/atlasSync.ts` (lines 64-850)
- Why fragile: Scraping HTML/JSON from undocumented browser API; data shape assumptions hardcoded (field names, nesting); no schema validation on response structure
- Safe modification: Add comprehensive response schema validation with Zod; create abstraction layer for field extraction; add logging for unexpected response shapes
- Test coverage: Limited; only 62 TypeScript test files total across repo, RMP matching and schedule tests exist but atlas sync integration not tested

**RMP Matching Algorithm:**
- Files: `api/src/lib/rmpMatching.ts` (496 lines), `api/src/jobs/rmpSeed.ts` (matching logic lines 700-1200)
- Why fragile: Complex heuristics for name/department matching; multiple threshold tunings; nickname groups hardcoded; no feedback loop to verify correctness
- Safe modification: Extract matching strategy to pluggable interface; log match confidence scores; add ability to accept/reject matches interactively
- Test coverage: Unit tests exist (`api/src/lib/rmpMatching.test.ts`) but integration tests missing; no test data for edge cases (special characters, non-English names, duplicate instructors)

**Program Requirements HTML Parsing:**
- Files: `api/src/jobs/programsSync.ts` (lines 145-350)
- Why fragile: Regex-based parsing of HTML course lists; assumption that H2 headers separate sections; no validation that parsed structure matches expected schema
- Safe modification: Validate parsed program structure against schema; add explicit section header markers; implement fallback parsing strategies
- Test coverage: No tests for program parsing logic; only job orchestration

**Invoice/Feedback Hub Cascade Logic:**
- Files: `api/src/services/feedbackHubService.ts` (1065 lines), `api/src/db/schema.ts` (cascade rules)
- Why fragile: Complex cascade delete rules across 6 related tables; no explicit transaction boundaries; status transitions not fully enumerated
- Safe modification: Add explicit state machine for feedback post lifecycle; validate status transitions before updates; test cascade scenarios explicitly
- Test coverage: Minimal; inviteCodeService tested but feedbackHub has no dedicated tests

**OpenAI Integration Error Recovery:**
- Files: `api/src/lib/openai.ts`, `api/src/routes/ai.ts` (lines 1138-1161)
- Why fragile: No retry logic for transient OpenAI failures; JSON schema validation fails entire response if format wrong; timeout handling not consistent
- Safe modification: Add exponential backoff retries; implement graceful degradation (return best-effort response); validate JSON schema before sending to model
- Test coverage: No unit tests for openai.ts; route tests don't cover failure scenarios

## Scaling Limits

**In-Memory Course Embeddings Cache:**
- Current capacity: ~3000-5000 courses in memory after backfill
- Limit: Single process can't handle 10k+ courses; embedding search becomes slow as memory pressure increases
- Scaling path: Move embeddings to pgvector extension in PostgreSQL; implement Redis caching layer; shard by department

**AI Route Memory State Accumulation:**
- Current capacity: ~100 concurrent user conversations stored in memory
- Limit: Each conversation = ~12 messages × 4KB = 50KB; 1000 users = 50MB; grows unbounded
- Scaling path: Implement session cleanup at TTL expiry; use Redis for distributed session storage; implement conversation archival to database

**RMP Sync Job Blocking:**
- Current capacity: Processes ~100 instructors/minute; Emory has ~2000 faculty
- Limit: Full sync takes 20+ minutes; any failure requires restart from checkpoint; can't handle incremental updates
- Scaling path: Implement parallel instructor fetching (10-20 concurrent); add incremental update mode (check only updated profiles); use background job queue (Bull, p-queue)

**Single-Process Section Instructor Sync:**
- Current capacity: ~1000 sections processed per batch
- Limit: Large term synchronizations block API route handlers
- Scaling path: Move sync to background worker; implement progress WebSocket updates; allow partial syncs

## Dependencies at Risk

**rate-my-professor-api-ts (^1.0.5):**
- Risk: Third-party RMP API wrapper; unmaintained or outdated if RMP API changes
- Impact: Entire RMP import breaks if RMP GraphQL schema changes
- Migration plan: Fork/vendorize RMP GraphQL queries; implement direct GraphQL client (Apollo or graphql-request); add RMP API monitoring

**fastset-levenshtein (^1.0.16):**
- Risk: Single-maintainer string matching library; used in critical RMP matching path
- Impact: If maintainer abandons or library has security issue, matching quality degrades
- Migration plan: Implement Levenshtein as internal utility (simple algorithm); reduce coupling to external dependency

**Drizzle-ORM (^0.33.0):**
- Risk: Rapidly evolving ORM; multiple versions of Drizzle used across monorepo (.worktrees uses older version)
- Impact: Type mismatches; migration path required when major version updates
- Migration plan: Standardize Drizzle version across all packages; test migrations in staging environment before production

**OpenAI API (@ts not explicitly versioned):**
- Risk: OpenAI API deprecated models (gpt-3.5-turbo, gpt-4-turbo); cost controls not implemented
- Impact: Model deprecation will break AI features; cost runaway if prompt size grows
- Migration plan: Add OpenAI model upgrade path; implement token counting middleware; add cost monitoring/alerting

**Supabase Auth (^2.95.3):**
- Risk: Dependency on Supabase hosted authentication; no local fallback
- Impact: If Supabase outage occurs, entire app login broken
- Migration plan: Evaluate self-hosted authentication options; consider OAuth2 proxy layer

## Missing Critical Features

**Lack of Comprehensive Logging:**
- Problem: Console.log used for debugging; no structured logging framework; difficult to trace errors in production
- Blocks: Production observability; root cause analysis of sync failures
- Impact: When sync fails, no audit trail of what was processed; when AI route errors, hard to debug

**No Backup/Recovery Strategy:**
- Problem: Database has no automated backups; sync jobs can overwrite stale data with empty results if API fails
- Blocks: Disaster recovery if database corrupted; prevents safe experimentation with sync logic
- Impact: Single API outage + bad sync could wipe course data

**Missing Test Infrastructure for Jobs:**
- Problem: Long-running sync jobs untested; only 5 test files exist for entire codebase
- Blocks: Safe refactoring of RMP/Atlas sync; regression testing of complex parsing logic
- Impact: Each sync job change risks breaking production; hard to verify data integrity after changes

**No Data Validation Schema Enforcement:**
- Problem: Database operations accept any data shape; no runtime validation that incoming data matches expected format
- Blocks: Early error detection; impossible to track when malformed data entered system
- Impact: Corruption cascades silently; hard to identify which sync run introduced bad data

**Missing Admin Dashboard for Sync Management:**
- Problem: Sync jobs must be run via CLI; no way to view progress, retry, or rollback
- Blocks: Non-technical team members can't manage data; no visibility into why sync failed
- Impact: Operational burden; slow incident response

## Test Coverage Gaps

**Atlas Sync Integration Untested:**
- What's not tested: FOSE API response parsing, section/instructor upsert logic, enrollment status transitions
- Files: `api/src/jobs/atlasSync.ts` (all 1844 lines)
- Risk: Broken sync silently produces incomplete/corrupted course data; discovered only when students report missing courses
- Priority: High

**RMP Matching Integration Untested:**
- What's not tested: End-to-end matching of 2000+ Emory instructors; edge cases (special characters, name variations, null values)
- Files: `api/src/jobs/rmpSeed.ts` (1817 lines), `api/src/lib/rmpMatching.ts` (unit tests exist but no integration tests)
- Risk: Large batch of instructors matched incorrectly; false positives create wrong RMP links
- Priority: High

**Program Sync Parsing Untested:**
- What's not tested: HTML parsing for major requirements; validation that parsed structure matches schema
- Files: `api/src/jobs/programsSync.ts` (430 lines)
- Risk: Malformed program requirements silently stored; students get incomplete major information
- Priority: Medium

**AI Route Multi-User Memory Untested:**
- What's not tested: User memory isolation; TTL cleanup; concurrent requests from same user
- Files: `api/src/routes/ai.ts` (1312 lines; heavy use of in-memory state)
- Risk: User memory leaks between sessions; conversations bleed between users
- Priority: Medium

**Feedback Hub Cascade Delete Untested:**
- What's not tested: Deletion of feedback post cascades correctly through votes, comments, status history
- Files: `api/src/services/feedbackHubService.ts` (1065 lines)
- Risk: Orphaned records remain after post deletion; data consistency issues
- Priority: Medium

---

*Concerns audit: 2026-02-24*
