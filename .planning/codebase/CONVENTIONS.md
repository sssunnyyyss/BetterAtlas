# Coding Conventions

**Analysis Date:** 2026-02-24

## Naming Patterns

**Files:**
- Services: `{feature}Service.ts` (e.g., `courseService.ts`, `inviteCodeService.ts`)
- Routes: `{feature}.ts` (e.g., `courses.ts`, `auth.ts`, `ai.ts`)
- Middleware: `{type}.ts` (e.g., `auth.ts`, `validate.ts`, `rateLimit.ts`)
- Jobs: `{action}.ts` (e.g., `atlasSync.ts`, `programsSync.ts`, `reviewSummarization.ts`)
- Tests: `{target}.test.ts` or `__tests__/{target}.test.ts` (e.g., `rmpMatching.test.ts`)
- Utility functions: `{noun}.ts` (e.g., `schedule.ts`, `crossListSignatures.ts`)

**Functions:**
- camelCase for all functions
- Action-oriented verbs: `list*`, `get*`, `create*`, `update*`, `delete*`, `search*` (e.g., `listCourses`, `getCourseById`, `createInviteCode`)
- Utility functions use descriptive names: `normalizeName`, `tokenizePersonName`, `scheduleFromMeetings`
- Type guards/validators: prefixed with `is` or `have` (e.g., `hasSectionInstructorsTable`, `isAdminEmail`)
- Pure utility functions: noun-based (e.g., `firstNameSimilarity`, `departmentAcronym`)

**Variables:**
- camelCase for all variables and parameters
- Boolean variables prefixed with `is` or `has` (e.g., `isActive`, `hasError`)
- Collections use plural names (e.g., `meetings`, `instructors`, `courses`)
- Constants use UPPER_SNAKE_CASE (e.g., `TITLE_PREFIXES`, `NICKNAME_GROUPS`, `HYBRID_SEMANTIC_MIN_QUERY_LEN`)
- Private/internal variables: single underscore prefix not used, rely on function scope or module privacy

**Types and Interfaces:**
- PascalCase for all types and interfaces
- Type/interface definitions: descriptive names (e.g., `CourseWithRatings`, `EvaluateInviteCodeInput`, `AdminAppError`)
- Query/schema objects: suffixed with appropriate descriptor (e.g., `courseQuerySchema`, `searchQuerySchema`, `aiFilterSchema`)
- Union types for error results use discriminated union pattern (e.g., `{ ok: true } | { ok: false; reason: "expired" | "maxed" }`)

## Code Style

**Formatting:**
- TypeScript strict mode enabled in `tsconfig.json`
- No formatter configuration detected in `.eslintrc` or `.prettierrc` files
- Default Node.js + TypeScript conventions: 2-space indentation (inferred from code samples)
- Semi-colons required (ES modules with explicit `.js` imports)

**Linting:**
- No `.eslintrc` file detected - no explicit linting rules enforced
- TypeScript compiler used as primary validation tool (`tsc`)

## Import Organization

**Order:**
1. Standard library imports (`path`, `process`, `http`, etc.)
2. External dependencies (`express`, `zod`, `dotenv`, etc.)
3. Database/ORM imports (`drizzle-orm`, schema)
4. Internal routes/services (absolute imports with `.js` extension)
5. Type imports (typically inline with other imports)
6. Library functions from `lib/` directory
7. Middleware
8. Configuration imports

**Path Aliases:**
- No path aliases configured in `tsconfig.json`
- All internal imports use relative paths with explicit `.js` extensions for ES modules
- Workspace imports: `@betteratlas/shared` - shared types and schemas

**Extension Pattern:**
- All imports explicitly include `.js` extension (required for ES modules in Node.js)
- Example: `import { env } from "../config/env.js"`
- Example: `import { validate } from "../middleware/validate.js"`

## Error Handling

**Patterns:**
- Try-catch blocks around async database/external service calls
- Early returns for validation failures (middleware pattern)
- Explicit null/undefined checks: `if (!value)` or `if (value === null)`
- Error propagation to Express error handler (global middleware at bottom of `src/index.ts`)
- Discriminated union types for operation results (e.g., `{ ok: true } | { ok: false; reason: "..." }`)
- Drizzle ORM null-coalescing: `?? null` pattern for optional returns

**Error Response Pattern:**
```typescript
if (!authHeader?.startsWith("Bearer ")) {
  return res.status(401).json({ error: "Authentication required" });
}
```

## Logging

**Framework:** `console` object (no dedicated logging library)

**Patterns:**
- `console.error()` for errors and warnings
- `console.log()` for debug/timing information
- Error logging includes context: `console.error("Feature description:", err.message)`
- Timing logs in route handlers (e.g., `console.log("ai/course-recommendations timings", {...})`)
- In-memory error recording for admin dashboard (see `recordAdminAppError` in `api/src/routes/adminPrograms.ts`)

**Examples:**
- `console.error("Failed to list OAuth clients:", err);`
- `console.log("API server running on port ${env.port}");`
- `console.warn("WARNING: ADMIN_EMAILS is not configured...")`

## Comments

**When to Comment:**
- Algorithm explanation: Used for complex matching logic (e.g., `rmpMatching.ts` has nickname group logic)
- Business rule clarification: Comments explain department signal detection, cross-list signatures
- Data transformation: Comments explain aggregation logic (e.g., "Class score = average of professor-wide scores...")
- Workarounds/technical decisions: Comments explain why certain approaches are used

**JSDoc/TSDoc:**
- Not used extensively in the codebase
- Type definitions provide sufficient documentation (no comment blocks above exports)
- Business logic comments are inline, not doc-style

**Example from codebase:**
```typescript
// "Class" score = average of professor scores for instructors teaching the course.
// Uses DISTINCT to avoid overweighting instructors with multiple sections.
return sql`avg(DISTINCT ${instructorRatings.avgQuality})`;
```

## Function Design

**Size:** Functions are focused and single-purpose
- Service functions: 10-50 lines typically
- Route handlers: 5-30 lines (logic delegated to services)
- Utility functions: 2-20 lines
- Complex algorithms: 50-150 lines (e.g., `matchProfessor`, `matchCourse` in `rmpMatching.ts`)

**Parameters:**
- Prefer object parameters for multiple arguments (destructuring)
- Example: `createInviteCode(input: { code: string; badgeSlug: string; maxUses: number | null; expiresAt: Date | null })`
- Primitive parameters used for single values
- Middleware uses Express Request/Response/NextFunction signature

**Return Values:**
- Explicit types annotated on all exported functions
- Service functions return database entities or null
- Route handlers use `res.json()` and `res.status()`
- Utility functions return typed primitives or custom types
- Async functions always return Promise (TypeScript inferred)

## Module Design

**Exports:**
- Named exports used throughout (no default exports except route modules)
- Services export multiple related functions
- Each file exports only related functionality
- Type exports use `export type` syntax when available

**Barrel Files:**
- Used in `packages/shared/src/types/index.ts` for type re-exports
- Not used in API `src/` directory (each file imports directly)
- Pattern: `export * from "./course"` re-exports all course types

**Example from `packages/shared/src/index.ts`:**
```typescript
export * from "./types/index.js"
```

## Middleware Pattern

**Express Middleware:**
- Standard Express middleware signature: `(req, res, next) => void`
- Middleware functions are async for operations needing database access
- Validation middleware uses Zod schemas
- Authentication extends Express Request type with `declare global`

**Example:**
```typescript
export function validate(schema: ZodSchema, source: "body" | "query" = "body") {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: result.error.flatten().fieldErrors,
      });
    }
    // Attach validated data to request
    if (source === "body") {
      req.body = result.data;
    } else {
      (req as any).validatedQuery = result.data;
    }
    next();
  };
}
```

## Database Patterns

**ORM:** Drizzle ORM with SQL-first approach

**Query Pattern:**
- Schema objects defined in `db/schema.ts`
- Query builder: `db.select().from(table).where(...).limit(1)`
- Column selection with objects: `const inviteCodeSelect = { id: inviteCodes.id, code: ... }`
- Raw SQL when necessary: `sql` tagged template for complex aggregations
- Returning after mutations: `.returning(selectObject)`

**Null Handling:**
- Database columns explicitly nullable with `| null` types
- Service functions return `entity ?? null` (always null or entity, never undefined)
- Query results accessed by destructuring/indexing with null coalescing

---

*Convention analysis: 2026-02-24*
