# Emory College Programs (Majors/Minors) Requirements + Catalog Integration (Design)

Date: 2026-02-15

## Summary

Replace the Catalog "Department" filter with a searchable "Program" (major/minor) picker sourced from Emory College Catalog. When a Program is selected, the Catalog page shows:

- Sidebar: program requirements text (rendered from stored blocks), with course codes converted into clickable links.
- Main grid: two tabs, `Required` and `Electives`, both restricted to courses offered in the single active term (and `sections.is_active=true`).

`Required` is the set of explicit course codes found in the requirements section. `Electives` is inferred from "elective" language in the requirements and includes active-term offerings from relevant subject codes, excluding `Required`.

## Goals (v1)

- Support Emory College majors and minors listed on the catalog "Majors & Minors" index page.
- Store program pages, requirements blocks, and extracted course codes in Postgres (Drizzle-managed).
- Expose API endpoints to power a searchable Program picker and program-scoped course browsing.
- Keep "requirements text" as the source of truth (do not attempt full requirement logic).
- List electives in a useful way:
  - Include elective listings even when the requirements describe electives without explicit course codes.
  - Derive elective subject codes from the program requirements (all subjects referenced).
  - Derive elective "level floor" from requirements text (e.g. "300-level electives" => 300+).

## Non-goals (v1)

- Full requirement rule evaluation (choose N of M, track completion, "approved electives" workflows).
- Perfect parsing of all catalog page content and formatting.
- Supporting non-Emory-College schools (Business, Nursing, etc).

## User Experience

### Program Picker

- Location: `frontend/src/components/course/CourseFilters.tsx` replaces the Department dropdown.
- Control: searchable combobox (typeahead) with a combined list of majors and minors.
- Labels: each option shows the program name and a compact variant label (examples: `Major (BA)`, `Major (BS)`, `Minor`).
- URL state: selecting sets `programId=<id>` in the Catalog URL query params; clearing removes `programId`.

### Catalog Behavior When Program Selected

- Sidebar shows:
  - Program title + variant (Major/Minor + degree where applicable).
  - Requirements blocks rendered in order.
  - Any detected course codes are rendered as clickable links; clicking a code sets `q=<code>` and searches within the current tab.
  - A small note that some requirements (e.g., "approved electives") cannot be fully interpreted.
- Main area shows tabs:
  - `Required`: explicit course-code matches extracted from requirements.
  - `Electives`: inferred offerings derived from the requirements' elective language.
- Search bar behavior: `q` searches within the currently selected tab (it does not clear `programId`).

### Active-Term Constraint

For both tabs, only show courses with at least one active section in the single active term:

- `terms.is_active = true` (require exactly one active term for v1)
- `sections.is_active = true`

## Data Model (Postgres / Drizzle)

### New Tables

`programs`

- `id SERIAL PRIMARY KEY`
- `name TEXT NOT NULL` (e.g. "Computer Science")
- `kind TEXT NOT NULL` enum-like: `major` | `minor`
- `degree TEXT NULL` (e.g. "BA", "BS", "BBA")
- `source_url TEXT NOT NULL UNIQUE`
- `hours_to_complete TEXT NULL` (keep as text; pages often contain ranges like "37-45")
- `courses_required TEXT NULL`
- `department_contact TEXT NULL`
- `requirements_hash TEXT NOT NULL` (hash of extracted requirements text blocks)
- `last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `is_active BOOLEAN NOT NULL DEFAULT true`

`program_requirement_nodes`

- `id SERIAL PRIMARY KEY`
- `program_id INT NOT NULL REFERENCES programs(id) ON DELETE CASCADE`
- `ord INT NOT NULL` (stable ordering for rendering)
- `node_type TEXT NOT NULL` enum-like: `heading` | `paragraph` | `list_item`
- `text TEXT NOT NULL`
- `list_level INT NULL` (indent level for list items)

`program_course_codes`

- `program_id INT NOT NULL REFERENCES programs(id) ON DELETE CASCADE`
- `course_code VARCHAR(30) NOT NULL` (canonicalized, e.g. "CS 170", "ANT 205W", "BIOL_OX 141")
- Unique index on `(program_id, course_code)`

### Derived, Stored Fields (optional but recommended)

To avoid recomputing inference on every request, store:

`program_subject_codes`

- `program_id INT NOT NULL REFERENCES programs(id) ON DELETE CASCADE`
- `subject_code VARCHAR(20) NOT NULL` (e.g. "CS", "QTM", "ENGRD", "BIOL_OX")
- Unique index on `(program_id, subject_code)`

`program_elective_rules`

- `program_id INT PRIMARY KEY REFERENCES programs(id) ON DELETE CASCADE`
- `level_floor INT NULL` (e.g. 300 means 300+; null means any level)

These can be recomputed during sync from requirement node text.

## Scraper + Sync Pipeline

### Inputs

- Program index page: `https://catalog.college.emory.edu/academics/concentrations/index.html`
- Program detail pages: linked `BA Major`, `BS Major`, `Minor` pages for each program.

### Job

Add `api/src/jobs/programsSync.ts` that:

1. Fetches the index page.
2. Extracts all program variant links and maps them to rows:
   - `name` comes from the program heading text adjacent to the links.
   - `kind` comes from link label ("Major" or "Minor").
   - `degree` comes from link label prefix ("BA", "BS", "BBA"), if present.
   - `source_url` is the absolute detail-page URL.
3. For each detail page:
   - Extract metadata fields (Hours To Complete, Courses Required, Department Contact) when present.
   - Extract the `## Requirements` section into ordered nodes until the next `##` section (commonly `## Prerequisites`).
   - Normalize nodes into `(node_type, text, list_level, ord)` (lossy but consistent).
   - Extract explicit course codes from node text and canonicalize.
   - Infer elective rules:
     - Detect phrases like `300-level electives` and interpret as `level_floor=300` (meaning 300+).
     - If multiple elective clauses mention different floors, use the minimum floor (so "any-level electives" wins).
   - Infer subject codes:
     - From extracted course codes, add all referenced subject codes (including both sides of crosslists like `ENGRD/QTM 302W`).
4. Upsert into DB:
   - `programs` upsert keyed by `source_url`.
   - Replace nodes, course codes, and derived subject codes for that program in a transaction.
   - Use `requirements_hash` to skip node/code updates when unchanged.

### Parsing Rules (v1)

- HTML parsing: use a real HTML parser (recommended `cheerio`) instead of regexing HTML.
- Course code extraction (conservative):
  - Subject: `A-Z` + optional `_OX` or other underscores (e.g. `BIOL_OX`)
  - Crosslist: allow `SUBJ/SUBJ` forms and expand to multiple codes.
  - Number: 3 digits + optional suffix letters (e.g. `302W`, `380RW`)
- Do not attempt to interpret "approved electives" beyond elective listing by subject/level.

### Refresh

- Nightly cron job runs `node api/dist/jobs/programsSync.js`.
- Manual endpoint triggers a run on-demand (see Security).

## API Design

Add `api/src/routes/programs.ts` mounted at `/api/programs`.

### Endpoints

- `GET /api/programs?q=...`
  - Returns a compact list for the combobox: `{ id, name, kind, degree }`
  - Supports `q` substring match on `name` and optionally on a precomputed display label.

- `GET /api/programs/:id`
  - Returns program metadata + requirement nodes + extracted course codes + inferred subjects and elective floor.

- `GET /api/programs/:id/courses?tab=required|electives&q=&page=&limit=`
  - Returns the same paginated shape as `/api/courses`.
  - `tab=required`: join `program_course_codes`.
  - `tab=electives`: filter by inferred subject codes and inferred `level_floor`.
  - Both tabs:
    - Require at least one section in the single active term: join `sections` + `terms` where `terms.is_active=true` and `sections.is_active=true`.
    - Exclude required course codes from electives.
  - `q` applies full-text search within the tab set (fallback ILIKE), similar to existing `/api/courses/search`.

### Query Implementation Notes

- To implement `level_floor`, parse the numeric part of `courses.code` in SQL and compare:
  - Example: `substring(courses.code from '\\\\d+')::int >= level_floor`.
  - If this becomes a perf issue, add a `course_number INT` column populated at ingest time.

## Frontend Changes

- Add program hooks in `frontend/src/hooks/`:
  - `usePrograms(q)` for combobox search.
  - `useProgram(programId)` for sidebar requirements.
  - `useProgramCourses(programId, tab, params)` for grid data.
- Update `frontend/src/components/course/CourseFilters.tsx`:
  - Replace Department select with combobox.
  - When programId is set, render Requirements section in the sidebar beneath the picker.
- Update `frontend/src/pages/Catalog.tsx`:
  - Add local tab state (`required|electives`) persisted in URL as `programTab`.
  - When `programId` is present, call `useProgramCourses(...)` instead of `useCourses/useCourseSearch`.
  - Make search bar update `q` (as it does today) but scoped to the current program + tab.

## Security

Manual sync endpoint:

- `POST /api/admin/programs/sync`
- Protect with a shared secret header:
  - Env: `PROGRAMS_SYNC_SECRET`
  - Header: `x-programs-sync-secret: <value>`
- Return 401 when missing/incorrect.

This avoids building role-based admin auth in v1 while keeping the endpoint off-limits to normal users.

## Testing Plan

- Unit tests:
  - Index-page parser extracts correct `(name, kind, degree, source_url)` for a representative sample.
  - Requirements extraction finds the correct section boundaries and produces stable nodes.
  - Course-code canonicalization:
    - Handles suffixes (`302W`, `380RW`).
    - Expands crosslists (`ENGRD/QTM 302W` => `ENGRD 302W` and `QTM 302W`).
  - Elective inference:
    - "300-level electives" => floor 300.
    - Multiple clauses => minimum floor.
- Integration tests:
  - Seed a fake program with codes and verify `/api/programs/:id/courses` returns expected required/electives.
  - Verify active-term gating by toggling `terms.is_active` and `sections.is_active`.

## Rollout Notes

- Run the sync once manually to populate `programs` tables before enabling the UI.
- Enable nightly cron only after verifying the parser against a handful of programs.
- Expect occasional catalog HTML changes; keep the parser defensive and log parse failures with `source_url` for triage.

