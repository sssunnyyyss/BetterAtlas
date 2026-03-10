# Architecture

**Analysis Date:** 2026-02-24

## Pattern Overview

**Overall:** Monorepo with decoupled frontend and API backend, monolithic express API with layered service architecture.

**Key Characteristics:**
- Separate git worktrees for API and frontend with shared TypeScript types package (`@betteratlas/shared`)
- pnpm workspace for dependency management across packages
- Supabase for authentication and PostgreSQL database
- Express.js REST API with middleware-based request handling
- React 18 with React Router for frontend, React Query for data fetching
- Drizzle ORM for type-safe database access

## Layers

**Presentation Layer (Frontend):**
- Purpose: React SPA that provides course discovery, professor ratings, schedule management, and AI chat interface
- Location: `frontend/src`
- Contains: React components, pages, hooks, API client
- Depends on: Supabase Auth, backend API endpoints, React Router
- Used by: Browser clients

**API Gateway/Entry Point (Express Application):**
- Purpose: Receives HTTP requests, applies middleware (auth, validation, rate limiting), routes to appropriate handlers
- Location: `api/src/index.ts`
- Contains: Express app setup, middleware configuration, route registration
- Depends on: All route handlers, middleware, Supabase clients
- Used by: Frontend, external integrations (webhooks)

**Route Handler Layer:**
- Purpose: HTTP endpoint definitions that validate input, call services, format responses
- Location: `api/src/routes/`
- Contains: 18+ router modules (auth.ts, courses.ts, reviews.ts, programs.ts, ai.ts, etc.)
- Depends on: Services, middleware, schemas from shared package
- Used by: Express app, error handler middleware
- Pattern: Routes use `validate()` middleware for Zod schema validation before passing to service

**Service Layer:**
- Purpose: Business logic and data access, orchestrates database queries and external API calls
- Location: `api/src/services/`
- Contains: 14 services (courseService, reviewService, userService, programService, feedbackHubService, etc.)
- Depends on: Database client, external APIs (OpenAI, Rate My Professor), utilities
- Used by: Route handlers, jobs, other services
- Examples: `courseService.ts` (62KB) handles complex course filtering with hybrid semantic search; `reviewService.ts` handles user ratings

**Database Layer:**
- Purpose: Schema definition and low-level database access
- Location: `api/src/db/`
- Contains: Schema definition (`schema.ts`), Drizzle ORM client, migrations
- Depends on: Supabase PostgreSQL, Drizzle ORM
- Used by: Services, jobs
- Pattern: Drizzle ORM with PostgreSQL syntax, 20+ tables with indexes and constraints

**Async Job Layer:**
- Purpose: Long-running background tasks and data synchronization
- Location: `api/src/jobs/`
- Contains: 5 job scripts (atlasSync.ts, programsSync.ts, courseEmbeddingsBackfill.ts, reviewSummarization.ts, rmpSeed.ts)
- Depends on: Services, database, external APIs
- Used by: Manual CLI invocation via npm scripts
- Pattern: Standalone TypeScript scripts that use same services/db as API

**Middleware Layer:**
- Purpose: Cross-cutting concerns for request processing
- Location: `api/src/middleware/`
- Contains: Authentication (requireAuth), optional auth (optionalAuth), validation (validate), rate limiting (rateLimit), OAuth auth
- Depends on: Supabase, Zod, express-rate-limit
- Used by: Route handlers
- Pattern: Express middleware functions that either call next() or return error responses

**Utilities & Libraries:**
- Purpose: Shared helper functions and constants
- Location: `api/src/lib/`, `api/src/utils/`
- Contains: Schedule parsing, embeddings generation, cross-list signatures, admin checks, constants
- Examples: `openaiEmbeddings.ts`, `schedule.ts`, `crossListSignatures.ts`
- Used by: Services, routes, jobs

**Shared Types Package:**
- Purpose: Single source of truth for TypeScript types used by both frontend and API
- Location: `packages/shared/src/`
- Contains: Type definitions, validation schemas (Zod), constants
- Files: `types/` (course, professor, review, schedule, user, etc.), `utils/` (validation, constants)
- Used by: Both API and frontend via workspace dependency
- Pattern: Central export via `index.ts`, Zod schemas for runtime validation

**Frontend React Architecture:**
- Routing: `App.tsx` uses React Router with protected routes (ProtectedRoute, AdminRoute)
- State Management: React Query for server state, Context API for auth (AuthProvider via `lib/auth.tsx`)
- Data Layer: Centralized API client (`src/api/client.ts`) with Bearer token from Supabase session
- Pages: One page per route (Catalog, CourseDetail, Profile, Schedule, AiChat, etc.)
- Components: Domain-organized (course/, layout/, review/, social/, onboarding/)
- Hooks: Custom hooks for data fetching (useCourses, useReviews, usePrograms, etc.)

## Data Flow

**Course Discovery Flow:**

1. User navigates to `/catalog` (ProtectedRoute checks auth)
2. `Catalog.tsx` component mounts, calls `useCourses()` hook
3. Hook uses `api.get('/api/courses')` → sends Bearer token from Supabase
4. API middleware stack: requireAuth → general rate limiter
5. Route handler `GET /api/courses` (routes/courses.ts)
6. Validates query with `courseQuerySchema` via `validate()` middleware
7. Calls `courseService.listCourses()` with validated parameters
8. Service executes complex Drizzle query joining courses, sections, instructors, ratings tables
9. Returns paginated results with ratings, enrollment info, instructor details
10. Route returns JSON response to frontend
11. React Query caches result (5 min stale time), UI renders CourseGrid

**Review Submission Flow:**

1. User submits review form in CourseDetail page
2. ReviewForm component calls `api.post('/api/reviews', reviewData)`
3. API auth middleware validates Supabase token
4. Route handler `POST /api/reviews` receives request
5. Validates body with Zod schema via middleware
6. Calls `reviewService.createReview()`
7. Service inserts record into reviews table with user ID, course ID, ratings
8. Service triggers optional async job for review summarization
9. Returns created review record (with ID, timestamp)
10. Frontend invalidates React Query cache for course detail
11. UI re-fetches course with updated review count/ratings

**Data Sync Job Flow (Example: atlasSync):**

1. Triggered manually: `npm run atlas:sync`
2. Script `jobs/atlasSync.ts` connects to database
3. Fetches course/section data from external Atlas API
4. Uses `courseService` functions to upsert courses and sections
5. Updates terms, instructors, section details
6. Manages soft deletes (isActive flag)
7. Tracks last sync timestamp
8. Logs progress and errors

**Authentication Flow:**

1. User visits `/login` (unauthenticated) → sees Landing
2. User submits registration form with email/password/profile
3. Frontend calls `api.post('/api/auth/register', data)`
4. API route handler calls Supabase to create auth user
5. Creates user record in database
6. Returns session tokens (access + refresh)
7. Frontend uses Supabase SDK to set session with tokens
8. AuthProvider context listens to auth state change
9. Fetches user profile via `api.get('/auth/me')`
10. Stores user in context state
11. Route guards check `useAuth().user` → allow/redirect
12. Subsequent requests include Bearer token in Authorization header

**Admin Operations Flow:**

1. Admin user navigates to `/admin` (AdminRoute checks isAdmin flag)
2. Admin pages load various admin-only endpoints
3. Example: AdminAiTrainer uploads training data via `api.post('/api/admin/ai-trainer/...')`
4. Route handler in `routes/adminPrograms.ts` or `routes/aiTrainer.ts`
5. Middleware checks Supabase token + isAdminEmail check via `isAdminEmail()` util
6. Executes privileged operation (data import, system config, etc.)
7. Logs action to `admin_app_logs` table via `recordAdminAppError()`
8. Returns result to frontend admin panel

**State Management:**

- **Server State:** React Query manages API responses (cache, invalidation, refetch)
- **Auth State:** AuthProvider (Context API) holds current user, tokens, login/logout functions
- **UI State:** Component local state via useState, form state via form handlers
- **Sync State:** No client state syncing; each endpoint is authoritative

## Key Abstractions

**Validation Schema (Zod):**
- Purpose: Runtime validation for API inputs (request body/query)
- Examples: `courseQuerySchema`, `loginSchema`, `registerSchema` in shared package
- Pattern: Define schema in shared package, use `validate(schema)` middleware in routes
- Location: `packages/shared/src/utils/validation.ts`

**Service Functions:**
- Purpose: Reusable business logic that can be called from routes or jobs
- Examples: `courseService.searchCourses()`, `reviewService.createReview()`, `userService.getUserProfile()`
- Pattern: Take validated input, query database via Drizzle, return typed result
- Error Handling: Throw errors (caught by Express error handler) or return null

**Drizzle Relations:**
- Purpose: Type-safe database queries with auto-completion
- Examples: Joins between courses, sections, instructors, reviews, ratings tables
- Pattern: Use `eq()`, `and()`, `sql` helpers for conditions; select specific columns to avoid N+1
- Location: Defined in `api/src/db/schema.ts` with table definitions and indexes

**Middleware Composition:**
- Purpose: Request processing pipeline
- Pattern: `router.get(path, middleware1, middleware2, handler)`
- Examples: `validate(schema)`, `requireAuth`, `optionalAuth`, `authLimiter`
- Location: `api/src/middleware/`

**API Client (Frontend):**
- Purpose: Centralized HTTP request handling with auth token injection
- Pattern: `api.get/post/put/patch/delete(path, body?)` → returns T
- Handles: Token fetching, error mapping, JSON serialization
- Location: `frontend/src/api/client.ts`

**React Context (AuthProvider):**
- Purpose: Global auth state for entire app
- Pattern: Wraps App in main.tsx, provides `useAuth()` hook
- State: user, isLoading, functions (login, register, logout, refresh)
- Location: `frontend/src/lib/auth.tsx`

**Custom Hooks:**
- Purpose: Encapsulate data fetching logic with React Query
- Pattern: `useX()` returns `{ data, isLoading, error }`
- Examples: `useCourses()`, `useReviews()`, `usePrograms()`
- Location: `frontend/src/hooks/`

## Entry Points

**API Server:**
- Location: `api/src/index.ts`
- Triggers: npm script `dev` or `start`
- Responsibilities: Express app initialization, middleware setup, route registration, error handling, Bootstrap demo user
- Listens on: `env.port` (default 3001)

**Frontend App:**
- Location: `frontend/src/main.tsx`
- Triggers: npm script `dev` (Vite) or bundled via build
- Responsibilities: React app initialization, QueryClient setup, AuthProvider wrapping, root DOM mount
- Serves on: `5173` (dev) via Vite

**CLI Jobs:**
- `npm run atlas:sync` → `jobs/atlasSync.ts`
- `npm run programs:sync` → `jobs/programsSync.ts`
- `npm run embeddings:backfill` → `jobs/courseEmbeddingsBackfill.ts`
- `npm run rmp:seed` → `jobs/rmpSeed.ts`

## Error Handling

**Strategy:** Centralized Express error handler with logging to admin_app_logs table.

**Patterns:**

- **Route Handlers:** Return early with `res.status(code).json({ error: "message" })` for validation/auth errors
- **Services:** Throw Error objects (caught by global handler) or return null for not-found
- **Middleware:** Return error response or call `next()` to continue
- **Global Handler:** Express 4-arg error middleware catches all uncaught errors, logs to admin table, returns 500

**Example Error Path:**
```
Route throws → Express error handler catches
→ recordAdminAppError() logs to admin_app_logs table
→ Response: { error: "Internal server error" }
```

**Frontend Error Handling:**
- API client throws ApiError (with status and message)
- Caught in async handlers with try/catch
- Display error toast/modal or fallback to error state

## Cross-Cutting Concerns

**Logging:** Console.log for development, admin_app_logs table for unhandled errors (tracks method, path, status, message, stack, userId)

**Validation:** Zod schemas in shared package, validate() middleware on routes, client-side form validation

**Authentication:** Supabase Auth tokens (Bearer header), JWT verification via supabaseAnon client, req.user context, admin check via isAdminEmail()

**Rate Limiting:** express-rate-limit with generalLimiter (15 req/min) and authLimiter (stricter for auth endpoints), uses trust proxy for reverse proxies

**CORS:** Configured in index.ts, allows origins from env.corsOrigins with credentials

**Caching:** React Query (client-side, 5 min stale time), no server-side caching layer

**Search:** Hybrid semantic+lexical search in courseService using OpenAI embeddings + Postgres full-text search

---

*Architecture analysis: 2026-02-24*
