# Technology Stack

**Analysis Date:** 2026-02-24

## Languages

**Primary:**
- TypeScript 5.5.0 - Used across all packages (API, frontend, shared)
- JavaScript (JSX/TSX) - React components in frontend

**Secondary:**
- SQL - PostgreSQL database schema and migrations
- Shell/Bash - Scripts and Docker configuration

## Runtime

**Environment:**
- Node.js 20+ (specified in `package.json` engines)
- Alpine Linux (Docker base image: `node:20-alpine`)

**Package Manager:**
- pnpm - Monorepo package manager with workspace support
- Lockfile: `pnpm-lock.yaml` (v9.0) - Present and committed

## Frameworks

**Core Backend:**
- Express 4.21.0 - RESTful API server at port 3001
- Drizzle ORM 0.33.0 - Type-safe PostgreSQL ORM with migrations

**Core Frontend:**
- React 18.3.1 - UI framework
- React Router DOM 6.26.0 - Client-side routing
- Vite 5.4.3 - Frontend build tool and dev server (port 5173)

**Database:**
- PostgreSQL - Primary database backend via Supabase
- Drizzle Kit 0.24.0 - Migration generation and schema management

**Data Fetching & State:**
- TanStack React Query 5.56.0 - Server state management and caching
- @supabase/supabase-js 2.95.3 - Supabase client for auth and database access

**Build & Development:**
- TypeScript Compiler (tsc) - Type checking and transpilation
- tsx 4.19.0 - Execute TypeScript files directly (used for jobs and scripts)
- PostCSS 8.4.45 - CSS transformation
- Tailwind CSS 3.4.10 - Utility-first CSS framework
- Autoprefixer 10.4.20 - CSS vendor prefixing

**Styling:**
- Tailwind CSS 3.4.10 - Utility-first CSS framework
- PostCSS 8.4.45 - CSS processor configuration

## Key Dependencies

**Critical Backend:**
- postgres 3.4.4 - PostgreSQL driver (used by Drizzle ORM)
- drizzle-orm 0.33.0 - Type-safe ORM with PostgreSQL dialect support
- @supabase/supabase-js 2.95.3 - Supabase authentication and client

**Security & Middleware:**
- express-rate-limit 7.4.0 - Rate limiting middleware for API endpoints
- helmet 7.1.0 - Security headers middleware (CORS, CSP, etc.)
- cors 2.8.5 - Cross-origin resource sharing middleware
- dotenv 17.3.0 - Environment variable management

**Validation:**
- zod 3.23.0 - Schema validation library (used for API request/response validation)

**Infrastructure:**
- None detected - No cloud SDKs beyond Supabase

## Configuration

**Environment:**
- Configuration loaded via `dotenv` from `.env` file in `src/config/env.ts`
- Environment variables are parsed and exported as strongly-typed object

**Build:**
- **API:** `tsconfig.json` (extends root) with Node.js ESM module output (`outDir: "./dist"`)
- **Frontend:** `tsconfig.json` with React JSX support (`jsx: "react-jsx"`)
- **Root:** `tsconfig.json` - Base configuration with ES2022 target
- **Vite Config:** `vite.config.ts` at port 5173 with React plugin and API proxy to `http://api:3001`
- **Drizzle Config:** `drizzle.config.ts` with PostgreSQL dialect, schema location `src/db/schema.ts`, migrations in `src/db/migrations`

## Key Files

**Entry Points:**
- Backend: `api/src/index.ts` - Express server initialization
- Frontend: `frontend/src/main.tsx` (inferred from Vite setup)

**Configuration Files:**
- `api/src/config/env.ts` - Centralized environment variable definitions
- `tsconfig.json` - Root TypeScript configuration
- `pnpm-workspace.yaml` - Monorepo workspace definition with packages and ignoredBuiltDependencies
- `.env` - Environment file (note: `.env.example` present for documentation)

**Database:**
- `api/src/db/schema.ts` - Drizzle ORM table definitions
- `api/src/db/index.ts` - Database client initialization (Drizzle + Supabase)
- `api/src/db/migrations/` - Auto-generated database migrations

## Platform Requirements

**Development:**
- Node.js 20+
- pnpm package manager
- Docker & Docker Compose (optional, for containerized dev)

**Production:**
- Node.js 20+ runtime
- PostgreSQL database (via Supabase)
- Environment variables for Supabase credentials and API keys

---

*Stack analysis: 2026-02-24*
