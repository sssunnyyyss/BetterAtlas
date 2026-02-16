# BetterAtlas

A course selection platform for universities, inspired by Yale's CourseTable. Students can search courses, write reviews, and see what friends are taking.

## Tech Stack

- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS
- **Backend**: Express + TypeScript
- **Database**: PostgreSQL 16 (with full-text search via `tsvector`)
- **Cache/Sessions**: Redis 7
- **ORM**: Drizzle
- **Monorepo**: pnpm workspaces
- **Containerization**: Docker + docker-compose

## Project Structure

```
BetterAtlas/
├── packages/shared/          # Shared types, Zod schemas, constants
├── api/                      # Express REST API
│   └── src/
│       ├── config/           # Environment config
│       ├── db/               # Drizzle schema, migrations, seed
│       ├── middleware/        # Auth, validation, rate limiting
│       ├── routes/           # auth, courses, reviews, social, users
│       └── services/         # Business logic layer
├── frontend/                 # React SPA
│   └── src/
│       ├── api/              # Fetch wrapper with auth
│       ├── components/       # layout/, course/, review/, social/
│       ├── hooks/            # useCourses, useReviews, useAuth
│       ├── lib/              # Auth context, utilities
│       └── pages/            # Landing, Catalog, CourseDetail, Profile, Friends
├── docker-compose.yml        # Dev environment
└── docker-compose.prod.yml   # Production with Nginx
```

## Prerequisites

- Node.js >= 20
- pnpm (`npm install -g pnpm`)
- Docker & Docker Compose (for database/redis, or run them natively)

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Build the shared package

```bash
pnpm --filter @betteratlas/shared build
```

### 3. Start infrastructure (PostgreSQL + Redis)

```bash
docker-compose up -d postgres redis
```

Or provide your own PostgreSQL and Redis instances.

### 4. Configure environment

```bash
cp .env.example .env
# Edit .env with your database/redis URLs if not using docker defaults
```

### 5. Push the database schema

```bash
pnpm db:push
```

### 6. Seed sample data

```bash
pnpm db:seed
```

This inserts 80+ courses across 10 departments (CS, MATH, ECON, PHYS, ENG, HIST, BIO, CHEM, PSYCH, PHIL) with sections across 3 semesters.

### 7. Run the dev servers

```bash
# Both API and frontend in parallel:
pnpm dev

# Or individually:
pnpm dev:api       # Express on http://localhost:3001
pnpm dev:frontend  # Vite on http://localhost:5173
```

The Vite dev server proxies `/api` requests to the Express backend.

## Docker (Full Stack)

### Development

```bash
docker-compose up
```

Starts PostgreSQL, Redis, API (port 3001), and frontend (port 5173) with hot reload via volume mounts.

### Production

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

This runs `api` in production mode and serves the built frontend on port `80`.

## Database Schema

9 tables managed by Drizzle ORM:

| Table | Purpose |
|-------|---------|
| `departments` | Academic departments (code + name) |
| `instructors` | Faculty members linked to departments |
| `courses` | Course catalog entries (code, title, description, credits) |
| `sections` | Semester-specific offerings with schedule, instructor, enrollment |
| `users` | Student accounts (.edu email, password hash, profile info) |
| `reviews` | Course reviews with quality/difficulty/workload ratings (1-5) |
| `course_ratings` | Cached aggregate ratings per course (auto-refreshed on review changes) |
| `friendships` | Bidirectional friend relationships (pending/accepted) |
| `course_lists` / `course_list_items` | User course worksheets/wishlists |

Full-text search uses PostgreSQL `tsvector` with weighted ranking (course code/title weighted higher than description). An ILIKE fallback handles partial matches.

## API Endpoints

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | No | Register with .edu email |
| POST | `/api/auth/login` | No | Login, creates session cookie |
| POST | `/api/auth/logout` | No | Destroy session |
| GET | `/api/auth/me` | Yes | Current user info |

### Courses
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/courses` | No | List with pagination + filters |
| GET | `/api/courses/search?q=` | No | Full-text search |
| GET | `/api/courses/:id` | No | Course detail with sections + ratings |
| GET | `/api/departments` | No | All departments |

**Filter params** for `/api/courses`: `department`, `semester`, `minRating`, `credits`, `page`, `limit`, `sort` (rating/code/title/difficulty)

### Reviews
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/courses/:id/reviews` | No | Reviews for a course |
| POST | `/api/courses/:id/reviews` | Yes | Submit review (one per course per user) |
| PATCH | `/api/reviews/:id` | Yes | Edit own review |
| DELETE | `/api/reviews/:id` | Yes | Delete own review |

### Social
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/friends` | Yes | List accepted friends |
| GET | `/api/friends/pending` | Yes | Pending requests |
| POST | `/api/friends/request` | Yes | Send friend request |
| POST | `/api/friends/:id/accept` | Yes | Accept request |
| DELETE | `/api/friends/:id` | Yes | Remove friend |
| GET | `/api/friends/:id/courses` | Yes | Friend's public course lists |
| GET | `/api/lists` | Yes | My course lists |
| POST | `/api/lists` | Yes | Create a list |
| POST | `/api/lists/:id/courses` | Yes | Add section to list |
| DELETE | `/api/lists/:id/courses/:itemId` | Yes | Remove from list |

### Users
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/users/me` | Yes | Profile info |
| PATCH | `/api/users/me` | Yes | Update profile |

## Frontend Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | Landing | Hero + login/register form |
| `/catalog` | Catalog | Search bar, sidebar filters, course grid with pagination |
| `/catalog/:id` | CourseDetail | Course info, sections, ratings, reviews, review form |
| `/profile` | Profile | View/edit profile |
| `/friends` | Friends | Friend list, pending requests, friend course viewing |

All routes except `/` require authentication (redirects to Landing if not logged in).

## Security

- Session-based auth stored in Redis (httpOnly cookies, 7-day expiry)
- Passwords hashed with bcrypt (12 rounds)
- Helmet security headers
- CORS restricted to frontend origin
- Rate limiting: 100 req/15min general, 20 req/15min for auth endpoints
- Zod validation on all request bodies and query params
- `.edu` email requirement for registration

## Architecture Decisions

See [docs/architecture-plan.md](docs/architecture-plan.md) for the full architecture plan including rationale for tech stack choices, database schema design, and implementation phasing.
