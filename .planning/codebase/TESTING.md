# Testing Patterns

**Analysis Date:** 2026-02-24

## Test Framework

**Runner:**
- Vitest 2.1.9
- Config: `api/vitest.config.ts`, `frontend/vitest.config.ts`

**Assertion Library:**
- Vitest built-in expect (compatible with Jest assertions)

**Run Commands:**
```bash
npm run test              # Run all tests once
npm run test:watch       # Watch mode - rerun on file changes
```

## Test File Organization

**Location:**
- Co-located pattern: Tests next to source files (`.test.ts` suffix)
- Alternative: `__tests__/` subdirectory within feature directories
- Examples:
  - `api/src/lib/rmpMatching.test.ts` (co-located with `rmpMatching.ts`)
  - `api/src/lib/crossListSignatures.test.ts` (co-located)
  - `api/src/lib/schedule.test.ts` (co-located)
  - `api/src/services/__tests__/inviteCodeService.test.ts` (in subdirectory)
  - `api/src/test/smoke.test.ts` (smoke tests in test directory)

**Naming:**
- Test files: `{module}.test.ts` or `{module}.test.tsx` (React components)
- Matches source filename exactly (except `.test.ts` suffix)

**Structure:**
```
api/
├── src/
│   ├── lib/
│   │   ├── rmpMatching.ts
│   │   ├── rmpMatching.test.ts         # Co-located
│   │   ├── schedule.ts
│   │   └── schedule.test.ts             # Co-located
│   ├── services/
│   │   ├── inviteCodeService.ts
│   │   └── __tests__/
│   │       └── inviteCodeService.test.ts # Subdirectory pattern
│   └── test/
│       ├── setup.ts                      # Shared test setup
│       └── smoke.test.ts                 # Smoke tests
frontend/
├── src/
│   ├── test/
│   │   ├── setup.ts
│   │   └── smoke.test.tsx
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect } from "vitest";

describe("functionName", () => {
  it("should describe expected behavior", () => {
    expect(result).toBe(expected);
  });

  it("handles edge case", () => {
    expect(result).toEqual({ expected: "value" });
  });
});
```

**Patterns:**
- `describe()` blocks group related test cases
- `it()` blocks define individual test cases with readable descriptions
- Inline variable setup within test cases (no beforeEach/afterEach detected)
- Test data created inline or passed as parameters

**Example from `rmpMatching.test.ts`:**
```typescript
describe("matchProfessor", () => {
  const instructors = [
    { id: 1, name: "John Smith", departmentId: 10 },
    { id: 2, name: "Jane Doe", departmentId: 20 },
    { id: 3, name: "John Smyth", departmentId: 10 },
  ];

  it("exact match", () => {
    const result = matchProfessor("John", "Smith", "Computer Science", instructors, new Map([[10, "CS"]]));
    expect(result).toEqual({ instructorId: 1, confidence: "exact" });
  });

  it("fuzzy match", () => {
    const result = matchProfessor("Jon", "Smith", "Computer Science", instructors, new Map([[10, "CS"]]));
    expect(result).not.toBeNull();
    expect(result?.confidence).toBe("fuzzy");
  });

  it("returns null for no match", () => {
    const result = matchProfessor("Completely", "Unknown", "Art", instructors, new Map());
    expect(result).toBeNull();
  });
});
```

## Mocking

**Framework:** Vitest's `vi` module (imported from `"vitest"`)

**Patterns:**
```typescript
import { describe, it, expect, vi } from "vitest";

// Module mocking at test file top level
vi.mock("../../db/index.js", () => ({ db: {} }));

// After mock setup, import the module
import { evaluateInviteCode } from "../inviteCodeService.js";
```

**Location in file:**
- Mocks declared before imports of the module being tested
- Top-level mocking in test file (not within describe blocks)
- Example: `api/src/services/__tests__/inviteCodeService.test.ts`

**What to Mock:**
- Database layer (`db` module) - replaced with empty object `{}`
- External service calls (when needed)
- Module dependencies that are imported

**What NOT to Mock:**
- Pure utility functions (test with real implementations)
- Domain logic being tested
- Type definitions
- Configuration values

**Current Usage:**
Only one mock found in entire codebase: `inviteCodeService.test.ts` mocks the `db` module to test pure logic without database dependency.

## Fixtures and Factories

**Test Data:**
- Inline test data creation (no factory libraries detected)
- Data passed as function parameters
- Example from `rmpMatching.test.ts`:
```typescript
const deptCodeMap = new Map<number, string>([
  [10, "CS"],
  [20, "PSYC"],
  [30, "MKT"],
  [40, "ACT"],
]);

const courses = [
  { id: 1, code: "CS 240", title: "Data Structures", departmentId: 10 },
  { id: 2, code: "PSYC 110", title: "Introduction to Psychology", departmentId: 20 },
  // ... more test data
];
```

**Location:**
- Defined within test file at describe block scope or within individual tests
- Reused across multiple test cases in same describe block
- No separate fixtures directory detected

## Coverage

**Requirements:** None enforced
- No coverage thresholds configured in `vitest.config.ts`
- No code coverage reporting configured

**View Coverage:**
```bash
# Not configured - would need to add vitest coverage option
# Typical command would be:
vitest run --coverage
```

## Test Types

**Unit Tests:**
- Scope: Individual functions and utilities
- Approach: Test function inputs/outputs with various cases (happy path, edge cases, error conditions)
- Examples: `rmpMatching.test.ts`, `crossListSignatures.test.ts`, `schedule.test.ts`, `inviteCodeService.test.ts`
- Isolation: Database mocked when needed

**Integration Tests:**
- Not detected in codebase
- Route handlers not tested end-to-end
- Service layer tested in isolation

**E2E Tests:**
- Not used
- No E2E test framework configured (Cypress, Playwright, etc.)

**Smoke Tests:**
- Basic sanity tests in `api/src/test/smoke.test.ts` and `frontend/src/test/smoke.test.tsx`
- Verify test infrastructure works
- Node.js environment test in API: `expect(true).toBe(true)`
- jsdom environment test in frontend: `document.body.innerHTML` manipulation

## Common Patterns

**Async Testing:**
```typescript
// Async functions tested with await
it("retrieves invite code", async () => {
  const code = await getInviteCodeByCode("TEST-CODE");
  expect(code).not.toBeNull();
});
```
- Not explicitly shown in current tests, but supported by Vitest automatically
- Database queries are async

**Error Testing:**
```typescript
it("returns expired when the code has passed its expiration date", () => {
  const now = new Date("2026-02-16T12:00:00.000Z");
  const expiresAt = new Date("2026-02-16T11:59:59.000Z");

  expect(
    evaluateInviteCode({
      usedCount: 1,
      maxUses: 10,
      expiresAt,
      now,
    })
  ).toEqual({ ok: false, reason: "expired" });
});
```

**Null Handling:**
```typescript
it("returns null for no match", () => {
  const result = matchCourse("Organic Chemistry", 30, courses, deptCodeMap);
  expect(result).toBeNull();
});
```

**Optional Properties:**
```typescript
it("returns null for ambiguous nickname fallback candidates", () => {
  const result = matchProfessor("M.", "Carr", "Mathematics", [...], new Map([[30, "MATH"]]));
  expect(result).toBeNull();
});
```

## Setup Files

**API Setup:** `api/src/test/setup.ts`
```typescript
process.env.NODE_ENV = "test";
```

**Frontend Setup:** `frontend/src/test/setup.ts`
- Configured in vitest but not found in repository

**Vitest Config:**

API (`api/vitest.config.ts`):
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.ts"],
  },
});
```

Frontend (`frontend/vitest.config.ts`):
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.ts?(x)"],
  },
});
```

## Testing Best Practices Used

1. **Describe logical units:** Each `describe` block covers one function with all its cases
2. **Clear test names:** Describe expected behavior and edge cases
3. **Isolated test data:** Each test passes its own data, no shared mutable state
4. **Null safety:** Explicit tests for null returns and optional chaining
5. **Type safety in tests:** Tests are fully typed (no `any` casts)
6. **Focused assertions:** Each test checks one main behavior
7. **Readable assertions:** Uses `.toEqual()`, `.toBeNull()`, `.not.toBeNull()` for clarity

## Coverage Gaps

**Areas Not Tested:**
- Route handlers (middleware, request/response handling)
- Express error handling
- Database integration
- Service functions with database calls
- Async operations beyond simple database returns
- Frontend components
- External API integrations

---

*Testing analysis: 2026-02-24*
