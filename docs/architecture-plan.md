# BetterAtlas - Architecture & Implementation Plan

## Context
Building a course selection website for a specific large university (~5k-15k courses), inspired by Yale's CourseTable. The platform lets students search courses, write reviews, and see what friends are taking. Self-hosted on school infrastructure with Docker.

---

## Tech Stack Decisions

| Layer | Choice | Why |
|-------|--------|-----|
| Monorepo | **pnpm workspaces** | Simpler than Turborepo, no extra tooling |
| Frontend | **React + Vite + TypeScript** | Fast dev server, simple config, no SSR needed for a student portal |
| Backend | **Express + TypeScript** | Proven, huge ecosystem, easy to self-host |
| ORM | **Drizzle** | Type-safe, lightweight, SQL-like (same as CourseTable) |
| Database | **PostgreSQL** | Robust, great full-text search built-in |
| Search | **PostgreSQL `tsvector`** | Handles 15k courses easily without a separate search engine |
| Cache | **Redis** | Session store + query caching for hot paths |
| Auth | **Passport.js + express-session** | Session-based auth stored in Redis. Simpler than JWT for a server-rendered student app |
| API Style | **REST** | Simpler to build and debug than GraphQL for this scale |
| Styling | **Tailwind CSS** | Fast prototyping, consistent design |
| Containerization | **Docker + docker-compose** | Dev and prod parity on school servers |

---

## Monorepo Structure

```
BetterAtlas/
├── package.json              # Root workspace config
├── pnpm-workspace.yaml
├── docker-compose.yml        # Dev environment (postgres, redis, api, frontend)
├── docker-compose.prod.yml   # Production overrides
├── .env.example
├── packages/
│   └── shared/               # Shared types & utilities
│       ├── package.json
│       └── src/
│           ├── types/
│           │   ├── course.ts     # Course, Section, Instructor types
│           │   ├── user.ts       # User, Profile types
│           │   ├── review.ts     # Review, Rating types
│           │   └── social.ts     # Friendship, CourseList types
│           └── utils/
│               ├── validation.ts # Shared Zod schemas
│               └── constants.ts  # Departments, semesters, etc.
├── api/
│   ├── package.json
│   ├── Dockerfile
│   ├── drizzle.config.ts
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts              # Express app entry
│       ├── config/
│       │   └── env.ts            # Environment variable config
│       ├── db/
│       │   ├── schema.ts         # Drizzle schema (all tables)
│       │   ├── migrations/       # Generated SQL migrations
│       │   └── seed.ts           # Sample data seeder
│       ├── middleware/
│       │   ├── auth.ts           # Session auth middleware
│       │   ├── rateLimit.ts      # Rate limiting
│       │   └── validate.ts       # Zod request validation
│       ├── routes/
│       │   ├── auth.ts           # POST /auth/register, /auth/login, /auth/logout
│       │   ├── courses.ts        # GET /courses, /courses/:id, /courses/search
│       │   ├── reviews.ts        # GET/POST /reviews, PATCH /reviews/:id
│       │   ├── users.ts          # GET /users/me, PATCH /users/me
│       │   └── social.ts         # friends, course lists
│       └── services/
│           ├── courseService.ts
│           ├── reviewService.ts
│           ├── userService.ts
│           └── socialService.ts
└── frontend/
    ├── package.json
    ├── Dockerfile
    ├── vite.config.ts
    ├── tsconfig.json
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx               # Router setup
        ├── api/
        │   └── client.ts         # Fetch wrapper with auth
        ├── hooks/
        │   ├── useCourses.ts     # Course data fetching
        │   ├── useAuth.ts        # Auth state
        │   └── useReviews.ts     # Review operations
        ├── pages/
        │   ├── Landing.tsx       # Hero + login/register
        │   ├── Catalog.tsx       # Main search + browse page
        │   ├── CourseDetail.tsx   # Single course with reviews
        │   ├── Profile.tsx       # User profile + settings
        │   └── Friends.tsx       # Friend list + their courses
        ├── components/
        │   ├── layout/
        │   │   ├── Navbar.tsx
        │   │   ├── Sidebar.tsx
        │   │   └── Footer.tsx
        │   ├── course/
        │   │   ├── CourseCard.tsx
        │   │   ├── CourseFilters.tsx
        │   │   ├── CourseGrid.tsx
        │   │   └── RatingBadge.tsx
        │   ├── review/
        │   │   ├── ReviewForm.tsx
        │   │   ├── ReviewCard.tsx
        │   │   └── RatingStars.tsx
        │   └── social/
        │       ├── FriendCard.tsx
        │       └── CourseListCard.tsx
        └── lib/
            ├── auth.tsx          # Auth context provider
            └── utils.ts          # Frontend utilities
```

---

## Database Schema (PostgreSQL + Drizzle)

### Core Tables

```sql
-- Departments
departments (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(10) UNIQUE NOT NULL,  -- "CS", "MATH", "ECON"
  name        TEXT NOT NULL                  -- "Computer Science"
)

-- Instructors
instructors (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT,
  department_id INT REFERENCES departments(id)
)

-- Courses (the catalog entry, not a specific semester offering)
courses (
  id              SERIAL PRIMARY KEY,
  code            VARCHAR(20) NOT NULL,       -- "CS 201"
  title           TEXT NOT NULL,               -- "Data Structures"
  description     TEXT,
  credits         SMALLINT,
  department_id   INT REFERENCES departments(id),
  -- Full-text search column
  search_vector   TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(code, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) STORED,
  UNIQUE(code)
)
-- GIN index on search_vector for fast full-text search

-- Sections (a specific offering of a course in a semester)
sections (
  id              SERIAL PRIMARY KEY,
  course_id       INT REFERENCES courses(id),
  semester        VARCHAR(20) NOT NULL,       -- "Fall 2025", "Spring 2026"
  section_number  VARCHAR(10),                -- "001", "L01"
  instructor_id   INT REFERENCES instructors(id),
  schedule        JSONB,                      -- { "days": ["M","W","F"], "start": "10:00", "end": "10:50", "location": "Room 305" }
  enrollment_cap  INT,
  enrollment_cur  INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
)

-- Users
users (
  id              SERIAL PRIMARY KEY,
  email           TEXT UNIQUE NOT NULL,       -- must be .edu
  password_hash   TEXT NOT NULL,
  display_name    TEXT NOT NULL,
  graduation_year SMALLINT,
  major           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
)

-- Reviews
reviews (
  id              SERIAL PRIMARY KEY,
  user_id         INT REFERENCES users(id),
  course_id       INT REFERENCES courses(id),
  semester        VARCHAR(20),                -- which semester they took it
  rating_quality  SMALLINT CHECK (1 <= rating_quality AND rating_quality <= 5),
  rating_difficulty SMALLINT CHECK (1 <= rating_difficulty AND rating_difficulty <= 5),
  rating_workload SMALLINT CHECK (1 <= rating_workload AND rating_workload <= 5),
  comment         TEXT,
  is_anonymous    BOOLEAN DEFAULT true,       -- mixed anonymous/named
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, course_id)                  -- one review per course per user
)

-- Aggregate ratings (materialized/cached)
course_ratings (
  course_id       INT PRIMARY KEY REFERENCES courses(id),
  avg_quality     NUMERIC(3,2),
  avg_difficulty  NUMERIC(3,2),
  avg_workload    NUMERIC(3,2),
  review_count    INT DEFAULT 0,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
)

-- Friendships (bidirectional)
friendships (
  id              SERIAL PRIMARY KEY,
  requester_id    INT REFERENCES users(id),
  addressee_id    INT REFERENCES users(id),
  status          VARCHAR(10) DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(requester_id, addressee_id)
)

-- Course Lists (what courses a user is interested in / taking)
course_lists (
  id              SERIAL PRIMARY KEY,
  user_id         INT REFERENCES users(id),
  semester        VARCHAR(20) NOT NULL,
  name            TEXT DEFAULT 'My Courses',  -- "Worksheet", "Wishlist"
  is_public       BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW()
)

course_list_items (
  id              SERIAL PRIMARY KEY,
  list_id         INT REFERENCES course_lists(id) ON DELETE CASCADE,
  section_id      INT REFERENCES sections(id),
  color           VARCHAR(7),                 -- hex color for UI
  added_at        TIMESTAMPTZ DEFAULT NOW()
)
```

### Key Indexes
```sql
CREATE INDEX idx_courses_search ON courses USING GIN(search_vector);
CREATE INDEX idx_courses_dept ON courses(department_id);
CREATE INDEX idx_sections_course ON sections(course_id);
CREATE INDEX idx_sections_semester ON sections(semester);
CREATE INDEX idx_reviews_course ON reviews(course_id);
CREATE INDEX idx_friendships_users ON friendships(requester_id, addressee_id);
```

---

## API Endpoints

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register with .edu email + password |
| POST | `/api/auth/login` | Login, creates session |
| POST | `/api/auth/logout` | Destroy session |
| GET | `/api/auth/me` | Current user info |

### Courses
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/courses` | List courses with pagination + filters |
| GET | `/api/courses/search?q=` | Full-text search |
| GET | `/api/courses/:id` | Single course with sections & aggregated ratings |
| GET | `/api/departments` | List all departments |

**Query params for `/api/courses`:**
- `department` - filter by department code
- `semester` - filter by semester
- `minRating` - minimum avg quality rating
- `credits` - filter by credit count
- `page`, `limit` - pagination (default 20 per page)
- `sort` - `rating`, `code`, `title`, `difficulty`

### Reviews
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/courses/:id/reviews` | Reviews for a course |
| POST | `/api/courses/:id/reviews` | Submit a review (auth required) |
| PATCH | `/api/reviews/:id` | Edit own review |
| DELETE | `/api/reviews/:id` | Delete own review |

### Social
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/friends` | List friends |
| POST | `/api/friends/request` | Send friend request |
| POST | `/api/friends/:id/accept` | Accept friend request |
| DELETE | `/api/friends/:id` | Remove friend |
| GET | `/api/friends/:id/courses` | See friend's public course lists |
| GET | `/api/lists` | My course lists |
| POST | `/api/lists` | Create a course list |
| POST | `/api/lists/:id/courses` | Add course to list |
| DELETE | `/api/lists/:id/courses/:courseId` | Remove from list |

---

## Frontend Pages & Routing

```
/                   -> Landing (hero, features, login/register)
/catalog            -> Catalog (search bar, filters sidebar, course grid)
/catalog/:id        -> CourseDetail (info, sections, reviews, add to list)
/profile            -> Profile (edit info, my reviews, my lists)
/friends            -> Friends (friend list, pending requests, friend courses)
```

### State Management
- **React Context** for auth state (lightweight, no Redux needed)
- **TanStack Query (React Query)** for server state - handles caching, refetching, pagination
- URL search params for filter/search state (shareable URLs)

### Key UI Patterns
- **Catalog page**: Sidebar filters + grid of CourseCards. Search bar triggers debounced API call. Infinite scroll or pagination.
- **CourseDetail page**: Course info header, sections accordion, tabbed reviews section with sort/filter, review form at bottom.
- **Rating badges**: Color-coded (green/yellow/red) average ratings displayed on CourseCards.

---

## Docker Setup

### docker-compose.yml (Development)
```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: betteratlas
      POSTGRES_USER: betteratlas
      POSTGRES_PASSWORD: dev_password
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  api:
    build: ./api
    ports: ["3001:3001"]
    depends_on: [postgres, redis]
    environment:
      DATABASE_URL: postgres://betteratlas:dev_password@postgres:5432/betteratlas
      REDIS_URL: redis://redis:6379
      SESSION_SECRET: dev_secret
    volumes: ["./api/src:/app/src"]  # hot reload

  frontend:
    build: ./frontend
    ports: ["5173:5173"]
    depends_on: [api]
    volumes: ["./frontend/src:/app/src"]  # hot reload

volumes:
  pgdata:
```

---

## Data Ingestion Pipeline

Even though the scraper is out of scope, the API needs a way to load course data:

1. **`POST /api/admin/import/courses`** - Accepts a JSON file matching a defined schema
2. **`api/src/db/seed.ts`** - Seeder script that loads sample/real data from a JSON file
3. **Schema**: Standardized JSON format for course imports:
```json
{
  "semester": "Fall 2025",
  "courses": [
    {
      "code": "CS 201",
      "title": "Data Structures",
      "description": "...",
      "credits": 3,
      "department": "CS",
      "sections": [
        {
          "number": "001",
          "instructor": "Dr. Smith",
          "schedule": { "days": ["M","W","F"], "start": "10:00", "end": "10:50", "location": "Hall 305" },
          "capacity": 30
        }
      ]
    }
  ]
}
```

---

## Implementation Order (Build Sequence)

### Phase 1: Foundation
1. Initialize monorepo (pnpm workspace, root package.json, tsconfig)
2. Set up `packages/shared` with types and Zod validation schemas
3. Set up `api/` with Express, Drizzle, PostgreSQL connection
4. Write database schema in Drizzle and generate initial migration
5. Create docker-compose.yml for postgres + redis
6. Seed database with sample course data (~100 courses for dev)

### Phase 2: Core API
7. Auth routes (register, login, logout, session middleware)
8. Course routes (list, detail, search with full-text)
9. Review routes (CRUD with anonymous toggle)
10. Social routes (friends, course lists)

### Phase 3: Frontend Shell
11. Vite + React + Tailwind setup
12. Auth context + login/register pages
13. API client with session cookie handling
14. Layout components (Navbar, Sidebar)

### Phase 4: Feature Pages
15. Catalog page with search + filters
16. CourseDetail page with reviews
17. ReviewForm component
18. Profile page
19. Friends page with friend course viewing

### Phase 5: Polish & Deploy
20. Rate limiting, input sanitization, CORS
21. Production docker-compose with Nginx reverse proxy
22. Database backup script
23. Error handling and loading states throughout

---

## Verification Plan

After each phase, verify by:
- **Phase 1**: `docker-compose up` starts postgres + redis. `pnpm drizzle-kit push` creates tables.
- **Phase 2**: Hit each endpoint with curl/Postman. Verify search returns relevant results.
- **Phase 3**: Frontend loads, login/register flow works end-to-end.
- **Phase 4**: Full user journey: search -> view course -> read reviews -> write review -> add friend -> see friend's courses.
- **Phase 5**: `docker-compose -f docker-compose.prod.yml up` serves the full app behind Nginx.

---

## Sources
- [CourseTable GitHub](https://github.com/coursetable)
- [CourseTable - Yale Daily News](https://yaledailynews.com/blog/2024/01/31/coursetable-grows-in-popularity-adds-new-features/)
- [Yale Computer Society Blog](https://yalecomputersociety.org/blog/spring24)
