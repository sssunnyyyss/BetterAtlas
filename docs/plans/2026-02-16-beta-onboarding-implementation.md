# Beta Tester Onboarding + Early Adopter Badge Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship invite-code-gated beta signup, automatic early-adopter badge grants, first-login onboarding (welcome slides + guided tour), and admin invite-code management.

**Architecture:** Keep source-of-truth onboarding and badge state in PostgreSQL and include it in existing auth/user payloads. Implement onboarding UX as a route-persistent React context (`OnboardingProvider`) that drives modal slides and a selector-based guided tour (`data-tour-id` anchors) across pages. Keep invite-code enforcement behind explicit environment flags so beta/public launch behavior is a config change.

**Tech Stack:** TypeScript, Express, Drizzle ORM, Supabase Auth, React 18, React Router, Tailwind CSS, Vitest, Supertest, React Testing Library.

---

### Task 1: Add Test Harness Baseline (API + Frontend)

**Files:**
- Create: `api/vitest.config.ts`
- Create: `api/src/test/setup.ts`
- Create: `api/src/test/smoke.test.ts`
- Modify: `api/package.json`
- Create: `frontend/vitest.config.ts`
- Create: `frontend/src/test/setup.ts`
- Create: `frontend/src/test/smoke.test.tsx`
- Modify: `frontend/package.json`

**Step 1: Write the failing test**

```ts
// api/src/test/smoke.test.ts
import { describe, expect, it } from "vitest";

describe("api smoke", () => {
  it("runs tests", () => {
    expect(true).toBe(true);
  });
});
```

```tsx
// frontend/src/test/smoke.test.tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Landing from "../pages/Landing.js";

describe("frontend smoke", () => {
  it("renders landing headline", () => {
    render(<Landing />);
    expect(screen.getByText(/betteratlas/i)).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter api test`
Expected: FAIL with missing `test` script (baseline confirms no harness).

Run: `pnpm --filter frontend test`
Expected: FAIL with missing `test` script.

**Step 3: Write minimal implementation**

```json
// api/package.json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

```json
// frontend/package.json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter api test`
Expected: PASS (`api smoke`).

Run: `pnpm --filter frontend test`
Expected: PASS (`frontend smoke`).

**Step 5: Commit**

```bash
git add api/package.json api/vitest.config.ts api/src/test/setup.ts api/src/test/smoke.test.ts frontend/package.json frontend/vitest.config.ts frontend/src/test/setup.ts frontend/src/test/smoke.test.tsx
git commit -m "test: add vitest harness for api and frontend"
```

### Task 2: Add Badge/Invite Schema + Feature Flags

**Files:**
- Modify: `api/src/db/schema.ts`
- Modify: `schema-migration.sql`
- Modify: `api/src/db/seed.ts`
- Modify: `api/src/config/env.ts`
- Modify: `.env.example`
- Modify: `packages/shared/src/types/user.ts`
- Modify: `packages/shared/src/utils/validation.ts`

**Step 1: Write the failing test**

```ts
// api/src/test/invite-code-format.test.ts
import { describe, expect, it } from "vitest";
import { registerSchema } from "@betteratlas/shared";

describe("register invite code", () => {
  it("normalizes invite code to uppercase", () => {
    const parsed = registerSchema.parse({
      email: "test@emory.edu",
      password: "password123",
      fullName: "Test User",
      username: "tester",
      inviteCode: "beta-2026",
    });
    expect(parsed.inviteCode).toBe("BETA-2026");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- src/test/invite-code-format.test.ts`
Expected: FAIL because `inviteCode` is not defined/normalized in schema.

**Step 3: Write minimal implementation**

```ts
// packages/shared/src/utils/validation.ts (registerSchema fragment)
inviteCode: z
  .string()
  .trim()
  .min(3)
  .max(40)
  .transform((v) => v.toUpperCase())
  .optional(),
```

```ts
// api/src/db/schema.ts (new tables + user columns)
export const badges = pgTable("badges", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: varchar("slug", { length: 64 }).unique().notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter api test -- src/test/invite-code-format.test.ts`
Expected: PASS.

Run: `pnpm db:generate`
Expected: PASS with new migration files for `badges`, `user_badges`, `invite_codes`, and user columns.

**Step 5: Commit**

```bash
git add api/src/db/schema.ts schema-migration.sql api/src/db/seed.ts api/src/config/env.ts .env.example packages/shared/src/types/user.ts packages/shared/src/utils/validation.ts api/src/test/invite-code-format.test.ts
git commit -m "feat: add invite code and badge schema foundations"
```

### Task 3: Implement Invite Code Validation + Badge Grant Services

**Files:**
- Create: `api/src/services/inviteCodeService.ts`
- Create: `api/src/services/badgeService.ts`
- Create: `api/src/services/__tests__/inviteCodeService.test.ts`

**Step 1: Write the failing test**

```ts
// api/src/services/__tests__/inviteCodeService.test.ts
import { describe, expect, it } from "vitest";
import { evaluateInviteCode } from "../inviteCodeService.js";

describe("evaluateInviteCode", () => {
  it("rejects expired code", () => {
    const result = evaluateInviteCode({
      usedCount: 0,
      maxUses: 10,
      expiresAt: new Date("2020-01-01T00:00:00Z"),
    });
    expect(result.ok).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- src/services/__tests__/inviteCodeService.test.ts`
Expected: FAIL with missing `evaluateInviteCode`.

**Step 3: Write minimal implementation**

```ts
// api/src/services/inviteCodeService.ts
export function evaluateInviteCode(input: {
  usedCount: number;
  maxUses: number | null;
  expiresAt: Date | null;
}) {
  const now = Date.now();
  if (input.expiresAt && input.expiresAt.getTime() <= now) return { ok: false as const };
  if (input.maxUses !== null && input.usedCount >= input.maxUses) return { ok: false as const };
  return { ok: true as const };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter api test -- src/services/__tests__/inviteCodeService.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add api/src/services/inviteCodeService.ts api/src/services/badgeService.ts api/src/services/__tests__/inviteCodeService.test.ts
git commit -m "feat: add invite code and badge service layer"
```

### Task 4: Update Registration Flow (`POST /auth/register`)

**Files:**
- Modify: `api/src/routes/auth.ts`
- Modify: `api/src/services/userService.ts`
- Create: `api/src/routes/__tests__/auth.register.invite.test.ts`

**Step 1: Write the failing test**

```ts
// api/src/routes/__tests__/auth.register.invite.test.ts
it("rejects registration without invite code when beta flag is on", async () => {
  const res = await request(app).post("/api/auth/register").send({
    email: "a@emory.edu",
    password: "password123",
    fullName: "A",
    username: "user_a",
  });
  expect(res.status).toBe(400);
  expect(res.body.error).toMatch(/invite code/i);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- src/routes/__tests__/auth.register.invite.test.ts`
Expected: FAIL because route currently allows register without invite code.

**Step 3: Write minimal implementation**

```ts
// api/src/routes/auth.ts (register flow fragment)
if (env.betaRequireInviteCode && !inviteCode) {
  return res.status(400).json({ error: "Invite code is required during beta" });
}
```

```ts
// valid code path
// 1) validate code row
// 2) create auth user
// 3) transaction: insert users row + increment usedCount + insert user_badges
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter api test -- src/routes/__tests__/auth.register.invite.test.ts`
Expected: PASS for required/missing/invalid/valid cases.

**Step 5: Commit**

```bash
git add api/src/routes/auth.ts api/src/services/userService.ts api/src/routes/__tests__/auth.register.invite.test.ts
git commit -m "feat: enforce invite codes and auto-grant badges on registration"
```

### Task 5: Extend User/Auth Payloads + Onboarding Completion APIs

**Files:**
- Modify: `api/src/routes/auth.ts`
- Modify: `api/src/routes/users.ts`
- Modify: `api/src/services/userService.ts`
- Create: `api/src/routes/__tests__/users.onboarding.test.ts`

**Step 1: Write the failing test**

```ts
it("patch /api/users/me/onboarding sets hasCompletedOnboarding=true", async () => {
  const res = await authed.patch("/api/users/me/onboarding").send({});
  expect(res.status).toBe(200);
  expect(res.body.hasCompletedOnboarding).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- src/routes/__tests__/users.onboarding.test.ts`
Expected: FAIL (`404` route not found).

**Step 3: Write minimal implementation**

```ts
// api/src/routes/users.ts
router.patch("/me/onboarding", requireAuth, async (req, res) => {
  const updated = await markOnboardingComplete(req.user!.id);
  if (!updated) return res.status(404).json({ error: "User not found" });
  res.json(updated);
});
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter api test -- src/routes/__tests__/users.onboarding.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add api/src/routes/auth.ts api/src/routes/users.ts api/src/services/userService.ts api/src/routes/__tests__/users.onboarding.test.ts
git commit -m "feat: expose badges and onboarding completion endpoints"
```

### Task 6: Admin Invite Code Endpoints

**Files:**
- Create: `api/src/routes/inviteCodes.ts`
- Modify: `api/src/index.ts`
- Create: `api/src/routes/__tests__/admin.invite-codes.test.ts`

**Step 1: Write the failing test**

```ts
it("creates an invite code via /api/admin/invite-codes", async () => {
  const res = await adminAuthed.post("/api/admin/invite-codes").send({
    code: "BETA-2026",
    badgeSlug: "early-adopter",
    maxUses: 100,
  });
  expect(res.status).toBe(201);
  expect(res.body.code).toBe("BETA-2026");
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- src/routes/__tests__/admin.invite-codes.test.ts`
Expected: FAIL with `404`.

**Step 3: Write minimal implementation**

```ts
// api/src/index.ts
app.use("/api/admin/invite-codes", inviteCodesRoutes);
```

```ts
// api/src/routes/inviteCodes.ts
router.post("/", requireAuth, requireAdmin, async (req, res) => {
  // validate + insert invite code
});
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter api test -- src/routes/__tests__/admin.invite-codes.test.ts`
Expected: PASS for create/list/delete + admin auth cases.

**Step 5: Commit**

```bash
git add api/src/routes/inviteCodes.ts api/src/index.ts api/src/routes/__tests__/admin.invite-codes.test.ts
git commit -m "feat: add admin invite code management api"
```

### Task 7: Frontend Registration Invite Code + Auth Contract Updates

**Files:**
- Modify: `frontend/src/lib/auth.tsx`
- Modify: `frontend/src/pages/Landing.tsx`
- Modify: `frontend/src/vite-env.d.ts`
- Modify: `.env.example`
- Create: `frontend/src/pages/__tests__/Landing.invite-code.test.tsx`

**Step 1: Write the failing test**

```tsx
it("shows invite code field in register mode and sends inviteCode", async () => {
  render(<Landing />);
  // switch to register
  // fill invite code
  // submit
  expect(mockRegister).toHaveBeenCalledWith(
    expect.objectContaining({ inviteCode: "BETA-2026" })
  );
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter frontend test -- src/pages/__tests__/Landing.invite-code.test.tsx`
Expected: FAIL because field/payload do not exist.

**Step 3: Write minimal implementation**

```tsx
// frontend/src/pages/Landing.tsx (register state fragment)
const [inviteCode, setInviteCode] = useState("");
// include input above email in register mode
// include inviteCode in register payload
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter frontend test -- src/pages/__tests__/Landing.invite-code.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/src/lib/auth.tsx frontend/src/pages/Landing.tsx frontend/src/vite-env.d.ts .env.example frontend/src/pages/__tests__/Landing.invite-code.test.tsx
git commit -m "feat: add invite code field to registration flow"
```

### Task 8: Shared Badge UI + Badge Data in Review/Friends/Profile

**Files:**
- Create: `frontend/src/components/ui/UserBadge.tsx`
- Modify: `frontend/src/components/review/ReviewCard.tsx`
- Modify: `frontend/src/components/social/FriendCard.tsx`
- Modify: `frontend/src/pages/Profile.tsx`
- Modify: `packages/shared/src/types/review.ts`
- Modify: `packages/shared/src/types/social.ts`
- Modify: `api/src/services/reviewService.ts`
- Modify: `api/src/services/socialService.ts`
- Create: `frontend/src/components/ui/__tests__/UserBadge.test.tsx`

**Step 1: Write the failing test**

```tsx
it("renders early-adopter with gold treatment", () => {
  render(
    <UserBadge
      badge={{ slug: "early-adopter", name: "Early Adopter", icon: "🌟", description: "", awardedAt: "" }}
    />
  );
  expect(screen.getByText(/early adopter/i)).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter frontend test -- src/components/ui/__tests__/UserBadge.test.tsx`
Expected: FAIL (`UserBadge` missing).

**Step 3: Write minimal implementation**

```tsx
// frontend/src/components/ui/UserBadge.tsx
export default function UserBadge({ badge }: { badge: Badge }) {
  const early = badge.slug === "early-adopter";
  return <span className={early ? "..." : "..."}>{badge.icon} {badge.name}</span>;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter frontend test -- src/components/ui/__tests__/UserBadge.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/src/components/ui/UserBadge.tsx frontend/src/components/review/ReviewCard.tsx frontend/src/components/social/FriendCard.tsx frontend/src/pages/Profile.tsx packages/shared/src/types/review.ts packages/shared/src/types/social.ts api/src/services/reviewService.ts api/src/services/socialService.ts frontend/src/components/ui/__tests__/UserBadge.test.tsx
git commit -m "feat: surface early adopter badges across profile reviews and friends"
```

### Task 9: Welcome Modal + Onboarding Context

**Files:**
- Create: `frontend/src/components/onboarding/OnboardingProvider.tsx`
- Create: `frontend/src/components/onboarding/WelcomeModal.tsx`
- Create: `frontend/src/components/onboarding/BadgeReveal.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/Home.tsx`
- Create: `frontend/src/components/onboarding/__tests__/WelcomeModal.test.tsx`

**Step 1: Write the failing test**

```tsx
it("advances through 4 welcome slides and exposes take-tour callback", async () => {
  render(<WelcomeModal isOpen user={mockUser} onTakeTour={vi.fn()} onSkip={vi.fn()} />);
  await user.click(screen.getByRole("button", { name: /next/i }));
  expect(screen.getByText(/you've earned this/i)).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter frontend test -- src/components/onboarding/__tests__/WelcomeModal.test.tsx`
Expected: FAIL (`WelcomeModal` missing).

**Step 3: Write minimal implementation**

```tsx
// OnboardingProvider: open welcome modal when user.hasCompletedOnboarding === false
// WelcomeModal: 4 slides, progress dots, Next/Take tour/Skip for now actions
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter frontend test -- src/components/onboarding/__tests__/WelcomeModal.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/src/components/onboarding/OnboardingProvider.tsx frontend/src/components/onboarding/WelcomeModal.tsx frontend/src/components/onboarding/BadgeReveal.tsx frontend/src/App.tsx frontend/src/pages/Home.tsx frontend/src/components/onboarding/__tests__/WelcomeModal.test.tsx
git commit -m "feat: add welcome onboarding modal flow"
```

### Task 10: Guided Tour Engine + Route Anchors + Completion API Call

**Files:**
- Create: `frontend/src/components/onboarding/GuidedTour.tsx`
- Create: `frontend/src/components/onboarding/TourTooltip.tsx`
- Create: `frontend/src/components/onboarding/TourOverlay.tsx`
- Modify: `frontend/src/components/onboarding/OnboardingProvider.tsx`
- Modify: `frontend/src/pages/Catalog.tsx`
- Modify: `frontend/src/pages/CourseDetail.tsx`
- Modify: `frontend/src/pages/Schedule.tsx`
- Modify: `frontend/src/pages/Friends.tsx`
- Modify: `frontend/src/pages/Profile.tsx`
- Create: `frontend/src/components/onboarding/__tests__/GuidedTour.test.tsx`

**Step 1: Write the failing test**

```tsx
it("shows stop progress and calls completion endpoint on finish", async () => {
  render(<GuidedTour isActive stops={stops} onFinish={onFinish} onSkip={onSkip} />);
  expect(screen.getByText(/1 of 6/i)).toBeInTheDocument();
  // advance to end...
  expect(onFinish).toHaveBeenCalled();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter frontend test -- src/components/onboarding/__tests__/GuidedTour.test.tsx`
Expected: FAIL (`GuidedTour` missing).

**Step 3: Write minimal implementation**

```tsx
// GuidedTour responsibilities:
// - navigate route for each stop
// - wait for target element via data-tour-id
// - render overlay cutout + tooltip
// - on finish/skip call PATCH /api/users/me/onboarding
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter frontend test -- src/components/onboarding/__tests__/GuidedTour.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/src/components/onboarding/GuidedTour.tsx frontend/src/components/onboarding/TourTooltip.tsx frontend/src/components/onboarding/TourOverlay.tsx frontend/src/components/onboarding/OnboardingProvider.tsx frontend/src/pages/Catalog.tsx frontend/src/pages/CourseDetail.tsx frontend/src/pages/Schedule.tsx frontend/src/pages/Friends.tsx frontend/src/pages/Profile.tsx frontend/src/components/onboarding/__tests__/GuidedTour.test.tsx
git commit -m "feat: implement cross-route guided onboarding tour"
```

### Task 11: Admin Invite Codes UI + Profile Replay Entry Point

**Files:**
- Create: `frontend/src/pages/admin/AdminInviteCodes.tsx`
- Modify: `frontend/src/pages/admin/AdminLayout.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/Profile.tsx`
- Create: `frontend/src/pages/admin/__tests__/AdminInviteCodes.test.tsx`

**Step 1: Write the failing test**

```tsx
it("lists invite codes and shows create form", async () => {
  render(<AdminInviteCodes />);
  expect(await screen.findByText(/invite codes/i)).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter frontend test -- src/pages/admin/__tests__/AdminInviteCodes.test.tsx`
Expected: FAIL (`AdminInviteCodes` missing).

**Step 3: Write minimal implementation**

```tsx
// AdminInviteCodes.tsx:
// - GET /api/admin/invite-codes table (code, badge, used/max, expires)
// - create form (code, badgeSlug, maxUses, expiresAt)
// - delete action per row
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter frontend test -- src/pages/admin/__tests__/AdminInviteCodes.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/src/pages/admin/AdminInviteCodes.tsx frontend/src/pages/admin/AdminLayout.tsx frontend/src/App.tsx frontend/src/pages/Profile.tsx frontend/src/pages/admin/__tests__/AdminInviteCodes.test.tsx
git commit -m "feat: add admin invite code management UI and tour replay action"
```

### Task 12: End-to-End Verification + Rollout Checklist

**Files:**
- Modify: `README.md`
- Modify: `docs/plans/2026-02-16-beta-onboarding-design.md`

**Step 1: Write the failing test**

```md
# Verification checklist (must be executed)
- Beta signup without invite code returns 400 when `BETA_REQUIRE_INVITE_CODE=true`
- Beta signup with valid code grants `early-adopter`
- First login shows welcome modal
- Take tour: completion sets `hasCompletedOnboarding=true`
- Skip for now: completion remains false
- Restart tour works from profile
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @betteratlas/shared build && pnpm --filter api build && pnpm --filter frontend build`
Expected: FAIL if any type mismatches remain after cross-package contract changes.

**Step 3: Write minimal implementation**

```md
Use @verification-before-completion before claiming done.
Document new env vars:
- BETA_REQUIRE_INVITE_CODE
- VITE_BETA_REQUIRE_INVITE_CODE
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @betteratlas/shared build`
Expected: PASS.

Run: `pnpm --filter api test && pnpm --filter frontend test`
Expected: PASS.

Run: `pnpm --filter api build && pnpm --filter frontend build`
Expected: PASS.

**Step 5: Commit**

```bash
git add README.md docs/plans/2026-02-16-beta-onboarding-design.md
git commit -m "docs: add onboarding rollout and verification checklist"
```

---

**Execution Notes**
- Use `@verification-before-completion` immediately before final success claims.
- Keep each commit scoped exactly to one task.
- Prefer server-side joins for badges to avoid extra client round-trips.
- Use `data-tour-id` selectors (not brittle class selectors) for all tour stops.
- Preserve existing admin auth pattern (`requireAuth` + admin-email allowlist).
