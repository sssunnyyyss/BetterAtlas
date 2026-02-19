# Security Assessment Report

**Date:** 2026-02-17
**Scope:** Full codebase review of BetterAtlas (API + Frontend)

---

## Vulnerabilities Fixed in Code

| # | Severity | Issue | Fix |
|---|----------|-------|-----|
| 1 | **Medium** | No rate limiting on review endpoints | Added `reviewLimiter` (30 req/15min) to POST/PATCH/DELETE review routes |
| 2 | **Medium** | No password strength validation on admin user creation | Added minimum 8-character requirement |
| 3 | **Medium** | Raw Supabase/DB error messages exposed to clients | Sanitized error responses in admin routes and user update |
| 4 | **Medium** | Helmet using defaults without explicit CSP | Configured explicit Content-Security-Policy, frame-ancestors, object-src |
| 5 | **Low** | No warning when ADMIN_EMAILS is unconfigured in production | Added startup warning log |

### Details

#### 1. Review Rate Limiting (`api/src/middleware/rateLimit.ts`, `api/src/routes/reviews.ts`)

Added a `reviewLimiter` middleware (30 requests per 15 minutes in production) applied to all state-changing review endpoints (POST, PATCH, DELETE). Prevents review spam, rating manipulation, and DoS via review flooding.

#### 2. Password Strength Validation (`api/src/routes/adminPrograms.ts`)

The `POST /admin/users` endpoint now requires passwords to be at least 8 characters. Previously, any non-empty string was accepted.

#### 3. Error Message Sanitization (`api/src/routes/adminPrograms.ts`, `api/src/routes/users.ts`)

Raw Supabase error messages were being passed directly to API responses, potentially exposing internal system details. Errors are now logged server-side and replaced with generic user-facing messages.

#### 4. Helmet Security Headers (`api/src/index.ts`)

Replaced `helmet()` defaults with explicit configuration including:
- `Content-Security-Policy` with restrictive `default-src`, `script-src`, `object-src`, `frame-ancestors`
- All standard helmet protections (X-Content-Type-Options, X-Frame-Options, HSTS, etc.)

#### 5. Admin Email Warning (`api/src/index.ts`)

Added a startup warning when `ADMIN_EMAILS` is empty in production, making misconfiguration immediately visible in logs.

---

## Remaining Items Requiring Manual Action

### Critical

#### API Key Rotation

**Location:** `api/.env`

The `.env` file contains credentials for Supabase (anon + service role keys), OpenAI, Cloudflare Turnstile, and PostgreSQL. While `.env` is in `.gitignore` and not committed, all keys should be rotated if this file was ever shared, committed to git history, or exposed.

**Action:**
- Rotate Supabase anon and service role keys in the Supabase dashboard
- Rotate the OpenAI API key at platform.openai.com
- Rotate the Cloudflare Turnstile secret key
- Change the PostgreSQL password
- Consider using a secrets manager (e.g., Docker secrets, Vault) for production

### High

#### Supabase Row-Level Security (RLS)

**Location:** Supabase dashboard / database

No RLS policies were found on user-owned tables. Authorization is handled entirely at the application layer. If the service role key is compromised, all data is accessible.

**Action:** Add RLS policies to these tables:
```sql
-- Reviews
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_reviews ON reviews FOR ALL USING (auth.uid() = user_id);

-- Friendships
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_friendships ON friendships FOR ALL
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Course Lists
ALTER TABLE course_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_lists ON course_lists FOR ALL USING (auth.uid() = user_id);
```

#### Verify ADMIN_EMAILS in Production

**Location:** Production environment variables

Ensure `ADMIN_EMAILS` is set to actual admin email addresses in production. When empty, no users have admin access (confirmed safe — empty list means no admins, not all admins).

### Low

#### Audit Logging

No audit trail exists for admin actions (user creation, banning, deletion, sync triggers). Consider adding an `audit_logs` table to track sensitive operations.

#### Hardcoded Test User

**Location:** `api/src/bootstrap.ts`

`ensureJohnDoe()` runs on every server start, creating a test user. Consider making this conditional:
```typescript
if (env.nodeEnv !== "production") {
  ensureJohnDoe().catch(...);
}
```

---

## Positive Findings (Already Secure)

| Area                 | Status                                                               |
| -------------------- | -------------------------------------------------------------------- |
| SQL Injection        | Protected — Drizzle ORM uses parameterized queries throughout        |
| XSS                  | Protected — No `dangerouslySetInnerHTML` in React frontend           |
| Input Validation     | Zod schema validation applied on route handlers                      |
| Auth Rate Limiting   | `authLimiter` already configured (20 req/15min in production)        |
| AI Rate Limiting     | `aiLimiter` already configured (30 req/15min in production)          |
| Secrets in Git       | `.env` is in `.gitignore`                                            |
| Authentication       | Supabase token-based auth with proper Bearer token validation        |
| Password Storage     | Delegated to Supabase Auth (not stored in application code)          |
| Global Rate Limiting | `generalLimiter` applied to all routes (100 req/15min in production) |
| Error Handler        | Global error handler returns generic "Internal server error" message |
