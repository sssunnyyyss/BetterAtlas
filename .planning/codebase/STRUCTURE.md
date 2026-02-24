# Codebase Structure

**Analysis Date:** 2026-02-24

## Directory Layout

```
BetterAtlas/
├── api/                       # Node.js Express API backend
│   ├── src/
│   │   ├── index.ts          # Express app entry point
│   │   ├── bootstrap.ts       # Idempotent johndoe demo user setup
│   │   ├── config/
│   │   │   └── env.ts        # Environment configuration (Supabase, ports, etc.)
│   │   ├── db/
│   │   │   ├── index.ts      # Drizzle ORM client and Supabase clients
│   │   │   ├── schema.ts     # Database schema definitions (20+ tables)
│   │   │   ├── seed.ts       # Database seeding script
│   │   │   ├── migrations/   # Drizzle migrations directory
│   │   │   └── applySchemaMigration.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts       # requireAuth middleware (Bearer token verification)
│   │   │   ├── optionalAuth.ts
│   │   │   ├── oauthAuth.ts
│   │   │   ├── validate.ts   # Zod schema validation middleware
│   │   │   └── rateLimit.ts  # express-rate-limit configuration
│   │   ├── routes/           # 18+ route modules
│   │   │   ├── auth.ts       # Login, register, verification, /auth/me
│   │   │   ├── courses.ts    # GET /api/courses, /api/courses/:id, /api/departments
│   │   │   ├── instructors.ts # GET /api/instructors
│   │   │   ├── reviews.ts    # POST/GET reviews endpoint
│   │   │   ├── social.ts     # Friend lists, follows
│   │   │   ├── schedule.ts   # Schedule endpoints
│   │   │   ├── feedback.ts   # Feedback submission
│   │   │   ├── feedbackHub.ts # Roadmap/feature request board
│   │   │   ├── programs.ts   # Program/major data
│   │   │   ├── ai.ts         # AI chat endpoint (46KB, complex)
│   │   │   ├── aiTrainer.ts  # Admin AI training endpoints
│   │   │   ├── adminPrograms.ts # Admin program sync (49KB)
│   │   │   ├── adminOAuth.ts # OAuth client management
│   │   │   ├── oauth.ts      # OAuth token/authorization endpoints
│   │   │   ├── cannySso.ts   # Canny feedback tool integration
│   │   │   ├── inviteCodes.ts # Beta invite code management
│   │   │   └── users.ts      # User profile endpoints
│   │   ├── services/         # 14 service modules
│   │   │   ├── courseService.ts    # (62KB) Course queries, search, filtering
│   │   │   ├── reviewService.ts    # (18KB) Review CRUD, summaries
│   │   │   ├── userService.ts      # User profile operations
│   │   │   ├── instructorService.ts # TODO: Not found yet
│   │   │   ├── feedbackHubService.ts # (32KB) Roadmap/feature board
│   │   │   ├── programService.ts    # (18KB) Major/program data
│   │   │   ├── scheduleService.ts   # (9KB) Schedule management
│   │   │   ├── socialService.ts     # (11KB) Friends, follows
│   │   │   ├── badgeService.ts      # User badges/achievements
│   │   │   ├── inviteCodeService.ts # Invite code validation
│   │   │   ├── oauthService.ts      # OAuth operations
│   │   │   ├── aiTrainerService.ts  # AI model training
│   │   │   ├── feedbackService.ts   # Simple feedback form
│   │   │   └── __tests__/
│   │   ├── jobs/             # 5 async task scripts
│   │   │   ├── atlasSync.ts  # (62KB) Sync courses from external Atlas API
│   │   │   ├── programsSync.ts # (14KB) Sync major/program data
│   │   │   ├── rmpSeed.ts    # (56KB) Import Rate My Professor data
│   │   │   ├── courseEmbeddingsBackfill.ts # (11KB) Generate OpenAI embeddings
│   │   │   └── reviewSummarization.ts # (6KB) Summarize reviews with LLM
│   │   ├── lib/              # Utility libraries
│   │   │   ├── openaiEmbeddings.ts # OpenAI embedding generation
│   │   │   ├── schedule.ts   # Parse meeting times to calendar format
│   │   │   ├── crossListSignatures.ts # Identify cross-listed courses
│   │   │   └── (other utilities)
│   │   ├── utils/
│   │   │   └── admin.ts      # Admin check utilities
│   │   ├── types/            # Local type definitions (if any)
│   │   └── test/             # Test utilities
│   ├── dist/                 # Compiled JavaScript (post-build)
│   ├── package.json          # npm scripts, dependencies
│   ├── tsconfig.json         # TypeScript config
│   └── vite.config.ts        # (if applicable to API)
│
├── frontend/                 # React SPA (Vite)
│   ├── src/
│   │   ├── main.tsx          # React app entry point (mounts to #root)
│   │   ├── App.tsx           # Router setup, route definitions, auth guards
│   │   ├── index.css         # Tailwind + global styles
│   │   ├── vite-env.d.ts     # Vite type declarations
│   │   ├── api/
│   │   │   └── client.ts     # Centralized API client with auth header injection
│   │   ├── lib/
│   │   │   ├── auth.tsx      # AuthProvider context, useAuth() hook
│   │   │   ├── supabase.ts   # Supabase client initialization
│   │   │   ├── courseTopics.ts # Course topic/area definitions
│   │   │   ├── grade.ts      # Grade conversion utilities
│   │   │   ├── time.ts       # Time formatting
│   │   │   ├── calendarLayout.ts # Schedule calendar helpers
│   │   │   └── utils.ts      # Misc utilities
│   │   ├── pages/            # One component per route
│   │   │   ├── Landing.tsx   # Login page (unauthenticated)
│   │   │   ├── Home.tsx      # Home/dashboard (authenticated)
│   │   │   ├── Catalog.tsx   # Course search/browse
│   │   │   ├── CourseDetail.tsx # Individual course view with reviews
│   │   │   ├── ProfessorDetail.tsx # Instructor profile
│   │   │   ├── Profile.tsx   # User profile/settings
│   │   │   ├── Friends.tsx   # Social network
│   │   │   ├── Schedule.tsx  # Calendar view
│   │   │   ├── AiChat.tsx    # AI assistant chat
│   │   │   ├── PrivacyPolicy.tsx # Legal pages
│   │   │   ├── FAQ.tsx
│   │   │   ├── AboutUs.tsx
│   │   │   ├── admin/        # Admin section (requires isAdmin flag)
│   │   │   │   ├── AdminLayout.tsx # Admin sidebar + outlet
│   │   │   │   ├── AdminSync.tsx # Course/program data sync UI
│   │   │   │   ├── AdminAiTrainer.tsx # AI model training interface
│   │   │   │   ├── AdminSystem.tsx # System configuration
│   │   │   │   ├── AdminStats.tsx # Analytics/metrics
│   │   │   │   ├── AdminUsers.tsx # User management
│   │   │   │   ├── AdminLogs.tsx # Error logs
│   │   │   │   ├── AdminFeedback.tsx # User feedback review
│   │   │   │   └── AdminInviteCodes.tsx # Invite code management
│   │   │   └── feedbackHub/  # Feature request board (Canny integration)
│   │   │       ├── FeedbackHubLayout.tsx
│   │   │       ├── FeedbackHubRoadmap.tsx
│   │   │       ├── FeedbackHubBoard.tsx
│   │   │       ├── FeedbackHubPostDetail.tsx
│   │   │       └── FeedbackHubChangelog.tsx
│   │   ├── components/       # Reusable components (domain-organized)
│   │   │   ├── layout/
│   │   │   │   ├── Navbar.tsx
│   │   │   │   ├── Footer.tsx
│   │   │   │   └── Sidebar.tsx
│   │   │   ├── course/       # Course-related components
│   │   │   │   ├── CourseCard.tsx
│   │   │   │   ├── CourseGrid.tsx
│   │   │   │   ├── CourseFilters.tsx
│   │   │   │   ├── RatingBadge.tsx
│   │   │   │   └── GerPills.tsx
│   │   │   ├── review/       # Review UI components
│   │   │   │   ├── ReviewCard.tsx
│   │   │   │   ├── ReviewForm.tsx
│   │   │   │   ├── RatingStars.tsx
│   │   │   │   └── EditReviewModal.tsx
│   │   │   ├── social/       # Social/friend components
│   │   │   │   ├── CourseListCard.tsx
│   │   │   │   ├── FriendCard.tsx
│   │   │   │   └── (others)
│   │   │   ├── ui/           # Generic UI components
│   │   │   │   └── (buttons, modals, etc.)
│   │   │   └── onboarding/   # Onboarding flow
│   │   │       ├── OnboardingProvider.tsx
│   │   │       ├── WelcomeModal.tsx
│   │   │       ├── GuidedTour.tsx
│   │   │       ├── TourTooltip.tsx
│   │   │       ├── TourOverlay.tsx
│   │   │       └── BadgeReveal.tsx
│   │   ├── hooks/            # Custom React hooks
│   │   │   ├── useAuth.ts    # Re-exports useAuth from AuthProvider
│   │   │   ├── useCourses.ts # Fetch courses list with React Query
│   │   │   ├── useReviews.ts # Fetch/manage reviews
│   │   │   ├── useInstructors.ts # Fetch instructor data
│   │   │   ├── usePrograms.ts # Fetch major/program data
│   │   │   ├── useSchedule.ts # Schedule operations
│   │   │   ├── useFeedback.ts # Feedback submission
│   │   │   ├── useFeedbackHub.ts # Roadmap board data
│   │   │   └── useAi.ts      # AI chat operations
│   │   └── test/             # Test utilities and setup
│   ├── public/               # Static assets (icons, favicon, manifest)
│   ├── dist/                 # Compiled output (post-build)
│   ├── package.json          # npm scripts, dependencies
│   ├── tsconfig.json         # TypeScript config
│   ├── vite.config.ts        # Vite bundler config (PWA, proxy, etc.)
│   └── index.html            # HTML entry point
│
├── packages/                 # Shared workspace packages
│   └── shared/               # @betteratlas/shared package
│       ├── src/
│       │   ├── index.ts      # Barrel export (re-exports all)
│       │   ├── types/
│       │   │   ├── index.ts  # Barrel export for types
│       │   │   ├── course.ts # Course, Section, Department types
│       │   │   ├── professor.ts # Instructor/Professor types
│       │   │   ├── review.ts # Review, Rating types
│       │   │   ├── user.ts   # User, Badge types
│       │   │   ├── schedule.ts # Schedule, Meeting types
│       │   │   ├── social.ts # Friend, Follow types
│       │   │   ├── program.ts # Program/Major types
│       │   │   ├── feedback.ts # Feedback form types
│       │   │   └── feedbackHub.ts # Roadmap board types
│       │   └── utils/
│       │       ├── validation.ts # Zod schemas (registerSchema, loginSchema, courseQuerySchema, etc.)
│       │       └── constants.ts # Shared constants
│       ├── dist/             # Compiled output
│       ├── package.json      # Workspace package definition
│       └── tsconfig.json     # TypeScript config
│
├── .worktrees/               # Git worktree for multi-branch workflow
│   └── programs/             # Alternative checkout of same repo at different ref
│
├── docs/                     # Documentation
│   ├── plans/                # Implementation plans (from /gsd:plan-phase)
│   └── (architecture, etc.)
│
├── .planning/                # GSD output directory
│   └── codebase/             # This analysis output
│       ├── ARCHITECTURE.md
│       └── STRUCTURE.md
│
├── scripts/                  # Utility scripts
├── adapters/                 # Custom integrations/adapters
├── docker-compose.yml        # Local development (API + Postgres + Supabase)
├── docker-compose.prod.yml   # Production deployment
├── pnpm-workspace.yaml       # pnpm workspace config
├── pnpm-lock.yaml            # Locked dependency versions
├── package.json              # Root workspace package.json
├── tsconfig.json             # Root TypeScript config
└── README.md                 # Project overview
```

## Directory Purposes

**`api/src`** - Express.js REST API backend
- Routes handle HTTP requests and delegate to services
- Services contain business logic and database access
- Middleware applies cross-cutting concerns (auth, validation, rate limiting)
- Jobs are standalone scripts for background data sync

**`frontend/src`** - React SPA user interface
- Pages implement one route each (Landing, Home, Catalog, etc.)
- Components are reusable UI elements organized by domain
- Hooks encapsulate data fetching with React Query
- Lib contains auth context and utility functions

**`packages/shared/src`** - Shared TypeScript types and validation
- Types used by both API and frontend (prevents duplication)
- Validation schemas (Zod) for runtime checking and type inference
- Imported via workspace dependency: `import { Course, reviewSchema } from "@betteratlas/shared"`

**`api/src/db`** - Database schema and ORM client
- Schema defines all 20+ tables with indexes, constraints, relationships
- Drizzle ORM client connects to Supabase PostgreSQL
- Migrations tracked in `migrations/` directory

**`api/src/routes`** - HTTP endpoint definitions
- One module per logical grouping (auth, courses, reviews, etc.)
- Each route validates input → calls service → returns JSON
- Middleware applied per-route (e.g., `router.get(path, validate(schema), handler)`)

**`api/src/services`** - Reusable business logic
- Each service focuses on one domain (courses, reviews, users, etc.)
- Query database via Drizzle ORM
- Called by routes and jobs
- Examples: courseService (search, filter, ratings), reviewService (CRUD)

**`frontend/src/pages`** - Route components (one per URL path)
- Correspond 1:1 with routes defined in App.tsx
- May use multiple smaller components from `components/`
- Call hooks to fetch data, manage state

**`frontend/src/components`** - Reusable UI components
- Organized by domain (course/, review/, social/, layout/, etc.)
- Receive props from pages or other components
- May use hooks from `hooks/` for data

**`frontend/src/hooks`** - Custom React hooks
- Encapsulate React Query queries with Zod validation
- Example: `useCourses()` → returns `{ data: Course[], isLoading, error }`
- Simplify component logic

**`api/src/lib`** - Utility libraries
- Schedule parsing, embeddings, search algorithms
- Reusable across services

**`api/src/utils`** - Helper functions
- Admin checks, constants, type guards
- Small, focused utilities

## Key File Locations

**Entry Points:**

- API server: `api/src/index.ts` - Creates Express app, applies middleware, registers routes
- Frontend app: `frontend/src/main.tsx` - Mounts React app to DOM, wraps with providers
- Frontend routing: `frontend/src/App.tsx` - Defines all routes and guards

**Configuration:**

- Environment variables: `api/src/config/env.ts` - Loads .env, parses/validates config
- Database: `api/src/db/index.ts` - Creates Drizzle ORM client + Supabase clients
- Frontend API: `frontend/src/api/client.ts` - Centralized HTTP client with auth
- Vite config: `frontend/vite.config.ts` - Build settings, dev server proxy to /api

**Core Logic:**

- Service examples: `api/src/services/courseService.ts` (62KB, complex search), `api/src/services/reviewService.ts`
- Database schema: `api/src/db/schema.ts` (30KB, 20+ tables)
- Routes: `api/src/routes/auth.ts`, `courses.ts`, `ai.ts`
- Shared types: `packages/shared/src/types/course.ts`, `user.ts`, etc.

**Testing:**

- API tests: `api/src/services/__tests__/`
- Frontend tests: `frontend/src/test/`
- Config: `vitest.config.ts` in respective packages

**Authentication:**

- Supabase client: `frontend/src/lib/supabase.ts` - Just initializes client
- Auth provider: `frontend/src/lib/auth.tsx` - Manages session, provides useAuth() hook
- API middleware: `api/src/middleware/auth.ts` - Verifies Bearer token

## Naming Conventions

**Files:**

- React components: PascalCase (.tsx) - `CourseCard.tsx`, `ReviewForm.tsx`
- Services: camelCase + "Service" (.ts) - `courseService.ts`, `reviewService.ts`
- Routes: camelCase + ".ts" - `courses.ts`, `reviews.ts`
- Middleware: camelCase (.ts) - `auth.ts`, `validate.ts`
- Hooks: camelCase + "use" prefix (.ts) - `useCourses.ts`, `useAuth.ts`
- Utilities: camelCase (.ts) - `admin.ts`, `constants.ts`
- Types: camelCase with domain prefix (.ts) - `course.ts`, `professor.ts`

**Directories:**

- Feature domains: lowercase plural - `courses/`, `reviews/`, `social/`
- Organizational groups: lowercase - `lib/`, `utils/`, `middleware/`, `services/`
- Routes/pages: match logical grouping - `admin/`, `feedbackHub/`

**Functions:**

- Async functions: descriptive verb phrases - `listCourses()`, `searchCourses()`, `getCourseById()`
- Boolean functions: "is" or "has" prefix - `isAdminEmail()`, `hasAuth()`, `hasSectionInstructorsTable()`
- Utility functions: verb or descriptor - `classScoreExpr()`, `toRoundedPercent()`
- Middleware: verb + "Auth" or domain - `requireAuth()`, `optionalAuth()`, `validate()`

**Types/Schemas:**

- Type names: PascalCase - `Course`, `Review`, `User`, `CourseWithRatings`
- Zod schemas: camelCase + "Schema" - `courseQuerySchema`, `loginSchema`, `reviewSchema`

## Where to Add New Code

**New Feature (e.g., user wishlists):**

1. **Shared package** (`packages/shared/src/`):
   - Add type: `types/wishlist.ts` with `Wishlist` type
   - Add validation schema: include in `utils/validation.ts`

2. **Database schema** (`api/src/db/schema.ts`):
   - Define `wishlists` and `wishlistItems` tables with proper indexes
   - Add migration file: `db/migrations/`

3. **Backend service** (`api/src/services/wishlistService.ts`):
   - `createWishlist(userId, name)`
   - `addItemToWishlist(wishlistId, courseId)`
   - `getWishlist(id)`
   - `listWishlists(userId)`
   - `deleteWishlist(id)`

4. **Routes** (`api/src/routes/wishlists.ts`):
   - `POST /api/wishlists` - create, requires auth
   - `GET /api/wishlists` - list user's wishlists
   - `GET /api/wishlists/:id` - get detail
   - `POST /api/wishlists/:id/items` - add course
   - `DELETE /api/wishlists/:id` - delete
   - Import service, apply validate middleware

5. **Register route** (`api/src/index.ts`):
   - Add: `app.use("/api/wishlists", wishlistRoutes);`

6. **Frontend hook** (`frontend/src/hooks/useWishlists.ts`):
   - Use React Query to fetch wishlists
   - Provide mutations for create/add/delete

7. **Frontend page** (`frontend/src/pages/Wishlists.tsx`):
   - Display list of user's wishlists
   - Use hook from step 6

8. **Frontend component** (`frontend/src/components/social/WishlistCard.tsx`):
   - Card display for single wishlist
   - Add to wishlist button on CourseCard

**New Component:**

Location depends on scope:
- **Page-level:** `frontend/src/pages/NewFeature.tsx` → add route in `App.tsx`
- **Feature-specific:** `frontend/src/components/domain/ComponentName.tsx`
- **Reusable UI:** `frontend/src/components/ui/Button.tsx`, `Modal.tsx`

Apply naming: PascalCase .tsx, export default, use typed props, include JSDoc

**New Utility:**

- Small single-function utilities: `frontend/src/lib/utils.ts` or add to existing
- Self-contained utils: `api/src/lib/newUtility.ts`
- Constants: `packages/shared/src/utils/constants.ts` if shared, else local

**Tests:**

- Unit tests for services: `api/src/services/__tests__/newService.test.ts`
- Component tests: `frontend/src/components/course/__tests__/CourseCard.test.tsx`
- Use vitest (configured in both api and frontend)

## Special Directories

**`.planning/codebase/`:**
- Purpose: GSD codebase analysis output
- Generated: By `/gsd:map-codebase` command
- Committed: Yes (consumed by `/gsd:plan-phase`)
- Contents: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, etc.

**`dist/`:**
- Purpose: Compiled output
- Generated: Yes (during build)
- Committed: No (.gitignore'd)
- Generated by: `npm run build` (TypeScript → JavaScript)

**`node_modules/`:**
- Purpose: Installed dependencies
- Generated: Yes (pnpm install)
- Committed: No (.gitignore'd)
- Managed by: pnpm workspace

**`db/migrations/`:**
- Purpose: Track database schema changes
- Generated: Yes (drizzle-kit generate)
- Committed: Yes (SQL migration files)

**`docs/plans/`:**
- Purpose: Implementation plans from /gsd:plan-phase
- Generated: Yes (by planning agent)
- Committed: Yes (reference for execution)

---

*Structure analysis: 2026-02-24*
