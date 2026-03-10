# External Integrations

**Analysis Date:** 2026-02-24

## APIs & External Services

**OpenAI (Generative AI):**
- Service: OpenAI Chat Completions API
- What it's used for: AI course counselor, course recommendations, search enhancement, requirement summarization
- SDK/Client: Native fetch (no SDK), configured in `api/src/lib/openai.ts`
- Auth: Environment variable `OPENAI_API_KEY`
- Model: `OPENAI_MODEL` (default: `gpt-4o-mini`, configurable)
- Details:
  - Uses `https://api.openai.com/v1/chat/completions` endpoint
  - Supports JSON response format mode
  - Configurable temperature and max_tokens parameters
  - Automatic fallback behavior for unsupported model parameters
  - 35-second timeout by default
  - Used in `api/src/routes/ai.ts` and `api/src/services/programService.ts`

**Emory Atlas API:**
- Service: Internal Emory University course catalog system
- What it's used for: Syncing course, section, and instructor data
- Endpoint: `https://atlas.emory.edu/api/?page=fose` (FOSE - Faculty/Offering/Section/Enrollment)
- Auth: None (public API)
- Details:
  - Accessed via native fetch in `api/src/jobs/atlasSync.ts`
  - Nightly sync job with configurable concurrency (default 6)
  - Supports filtering by campus, subjects, term code, and details sampling mode
  - Environment variables: `ATLAS_SUBJECTS`, `ATLAS_CAMPUSES`, `ATLAS_TERM_CODE`, `ATLAS_DETAILS_MODE`, `ATLAS_RATE_DELAY_MS`, `ATLAS_CONCURRENCY`
  - Rate limiting via configurable delay between requests

**Emory Programs Catalog:**
- Service: Web scraping of Emory academic programs pages
- What it's used for: Syncing program information and degree requirements
- Base URL: Inferred from `api/src/jobs/programsSync.ts` - scrapes program detail pages
- Auth: None (web scraping)
- Details:
  - HTML fetching and parsing job in `api/src/jobs/programsSync.ts`
  - Processed with OpenAI for structured requirement extraction
  - 20-second fetch timeout, configurable via environment

## Data Storage

**Databases:**
- PostgreSQL (via Supabase)
  - Connection: `DATABASE_URL` environment variable
  - Primary access: Drizzle ORM with postgres driver
  - Supabase project: `https://atlas.sunworkstudios.com` (from .env.example)
  - Tables: departments, terms, instructors, courses, sections, course_reviews, course_review_summaries, users, schedules, social features, etc.

**File Storage:**
- Not configured - Local filesystem only (no S3, GCS, etc.)

**Caching:**
- React Query (TanStack) on frontend for HTTP response caching
- No server-side caching layer detected (Redis, Memcached, etc.)

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (PostgreSQL-based user management)
  - Implementation: Email/password authentication with JWT sessions
  - User signup/login managed via `api/src/routes/auth.ts`
  - User profiles stored in PostgreSQL `users` table (id synced with Supabase Auth UUID)
  - Token verification via `supabaseAnon` client in middleware `api/src/middleware/auth.ts`

**Configuration:**
- SDK: @supabase/supabase-js 2.95.3
- Supabase URL: `SUPABASE_URL` env var
- Anon Key: `SUPABASE_ANON_KEY` env var (frontend)
- Service Role Key: `SUPABASE_SERVICE_ROLE_KEY` env var (backend)
- Auth disabled: `autoRefreshToken: false`, `persistSession: false` (server-side JWT verification)

## Monitoring & Observability

**Error Tracking:**
- None detected - No Sentry, Datadog, or similar

**Logs:**
- Console logging via `console.log()` and `console.error()`
- Request logging available via middleware hooks in Express

**Health Check:**
- Endpoint: `GET /api/health` returns `{ status: "ok", auth: "supabase" }`

## CI/CD & Deployment

**Hosting:**
- Docker containerization ready (Dockerfiles present for API and frontend)
- Docker Compose for local development
- Production stage with optimized Node.js layers

**CI Pipeline:**
- Not detected in codebase (no GitHub Actions, GitLab CI, etc. configuration files found)

## Environment Configuration

**Required env vars (Backend API):**
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase admin key for auth operations
- `SUPABASE_ANON_KEY` - Supabase anonymous key for token verification
- `DATABASE_URL` - PostgreSQL connection string
- `OPENAI_API_KEY` - OpenAI API key (required for AI features)
- `OPENAI_MODEL` - OpenAI model name (default: gpt-4o-mini)
- `CORS_ORIGIN` - Comma-separated list of allowed origins
- `API_PORT` - Port for API server (default: 3001)
- `NODE_ENV` - Environment (development/production)
- `PROGRAMS_SYNC_SECRET` - Admin secret for triggering programs sync job

**Optional env vars (Sync Jobs):**
- `ATLAS_SUBJECTS` - Comma-separated course subjects to sync (e.g., CS,MATH,ECON or ALL)
- `ATLAS_CAMPUSES` - Comma-separated campus codes (default: ATL@ATLANTA,OXF@OXFORD)
- `ATLAS_TERM_CODE` - Override active term (e.g., 5261)
- `ATLAS_DETAILS_MODE` - Either "sampled" or full (default: sampled)
- `ATLAS_RATE_DELAY_MS` - Milliseconds delay between Atlas API requests (default: 0)
- `ATLAS_CONCURRENCY` - Number of concurrent Atlas API requests (default: 6)

**Required env vars (Frontend):**
- `VITE_SUPABASE_URL` - Supabase URL (must match backend)
- `VITE_SUPABASE_ANON_KEY` - Supabase anon key

**Secrets location:**
- `.env` file in project root (git-ignored)
- `.env.example` provided for reference
- Docker Compose extracts from `.env` for container environment

## Webhooks & Callbacks

**Incoming:**
- None detected - No webhook listeners configured

**Outgoing:**
- None detected - No outbound webhooks configured

## Rate Limiting & Security

**Rate Limiting:**
- Express rate limiter configured in `api/src/middleware/rateLimit.js`
- Auth endpoints: Stricter `authLimiter`
- General endpoints: `generalLimiter` (trust proxy enabled for reverse proxy scenarios)

**Security Headers:**
- Helmet middleware applies security headers (CSP, X-Frame-Options, etc.)

## Job Scheduling

**Background Jobs:**
- `api/src/jobs/atlasSync.ts` - Nightly course/section/instructor sync from Emory Atlas API
  - Runnable via: `pnpm --filter api atlas:sync`
  - Standalone executable with manual or scheduled invocation

- `api/src/jobs/programsSync.ts` - Program catalog sync from Emory programs pages
  - Requires admin secret in `PROGRAMS_SYNC_SECRET`
  - Endpoint: `POST /api/admin/programs/sync` (protected)

**Scheduling Framework:**
- No job queue (Bull, Agenda, etc.) detected
- Jobs are run as standalone scripts via npm/pnpm commands or triggered via HTTP endpoints
- Intended for external cron jobs or scheduled container tasks

---

*Integration audit: 2026-02-24*
