# Beta Tester Onboarding & Early Adopter Badge

**Date:** 2026-02-16
**Status:** Draft

---

## Overview

A two-phase onboarding experience for BetterAtlas beta testers: a welcome modal sequence followed by a guided tour of the app. Beta testers receive an "Early Adopter" badge that appears across the app as recognition. Access is gated by invite codes at signup.

---

## 1. Data Model

### New tables

**`badges`**

| Column      | Type                  | Notes                          |
|-------------|-----------------------|--------------------------------|
| id          | uuid, PK              |                                |
| slug        | varchar, unique        | e.g. `"early-adopter"`         |
| name        | text                  | e.g. `"Early Adopter"`         |
| description | text                  | e.g. `"Joined during the BetterAtlas beta"` |
| icon        | text                  | Emoji or icon identifier       |
| createdAt   | timestamp (tz)        | Default now                    |

**`user_badges`**

| Column    | Type                  | Notes                          |
|-----------|-----------------------|--------------------------------|
| id        | uuid, PK              |                                |
| userId    | uuid, FK → users      |                                |
| badgeId   | uuid, FK → badges     |                                |
| awardedAt | timestamp (tz)        | Default now                    |

- Unique constraint on `(userId, badgeId)`

**`invite_codes`**

| Column    | Type                  | Notes                          |
|-----------|-----------------------|--------------------------------|
| id        | uuid, PK              |                                |
| code      | varchar, unique       | e.g. `"BETA-2026"`            |
| badgeSlug | varchar               | Which badge to auto-grant      |
| maxUses   | int, nullable         | Null = unlimited               |
| usedCount | int                   | Default 0                      |
| expiresAt | timestamp (tz), nullable |                              |
| createdAt | timestamp (tz)        | Default now                    |

### Changes to `users` table

| Column                | Type              | Notes                          |
|-----------------------|-------------------|--------------------------------|
| inviteCode            | varchar, nullable | The code used at signup        |
| hasCompletedOnboarding | boolean          | Default false                  |

---

## 2. Invite Code Flow

### Registration changes

1. New "Invite Code" field added to the registration form (above email)
2. During beta, the field is **required** — no code, no signup
3. At public launch, the field becomes optional or is removed

### Backend validation (during `POST /auth/register`)

1. Check code exists in `invite_codes` table
2. Check `expiresAt` is null or in the future
3. Check `usedCount < maxUses` (or `maxUses` is null)
4. If invalid: reject with `"Invalid or expired invite code"`
5. If valid:
   - Create user as normal with `inviteCode` stored on record
   - Increment `usedCount` on the invite code
   - Look up badge by `badgeSlug`, insert into `user_badges`

### Code format

- Short, memorable, uppercase: `BETA-2026`, `EARLY-ACCESS`, `EMORY-FIRST`
- Created manually or via admin panel

### Admin management

- Section in admin panel to create/view/manage invite codes
- Fields: code string, max uses, expiration, associated badge
- Table showing existing codes with usage stats

---

## 3. Welcome Modal Sequence

Triggered on first login when `hasCompletedOnboarding === false`.

### Slide 1 — "Welcome to BetterAtlas"

- Headline: **"You're one of the first."**
- Copy thanking them for joining the beta, explaining they're helping shape the future of course planning at Emory
- Subtle confetti burst or animated background on mount
- "Next" button

### Slide 2 — Badge Reveal

- Early adopter badge animates in (scale-up + glow effect)
- Headline: **"You've earned this."**
- Shows badge icon, name, and description
- Explains visibility: "This tag shows up next to your name on reviews, your profile, and friend lists across the app."
- "Next" button

### Slide 3 — What You're Getting

- Feature grid with icon + one-liner each:
  - AI-powered course recommendations
  - Honest ratings & reviews from students
  - Smart search that understands what you mean
  - Schedule builder
  - Friends & shared wishlists
  - Degree tracking
- "Next" button

### Slide 4 — Tour CTA

- Headline: **"Ready for the tour?"**
- Primary CTA: "Take the tour"
- Secondary (text link): "Skip for now"
- If skipped, `hasCompletedOnboarding` stays false so tour can be retriggered later from profile

### Implementation

- Extends the existing `Modal` component to support multi-step slides
- Transition animations between slides (fade or slide-left)
- Progress dots at the bottom

---

## 4. Guided Tour Overlay

Activates after clicking "Take the tour" from the welcome modal.

### Tour engine behavior

- Floating tooltip highlights UI elements one at a time
- Full-screen semi-transparent backdrop with a cutout "hole" around the target element
- Tooltip positioned dynamically (above/below/left/right) based on element position and viewport
- Progress indicator: "2 of 6" counter
- "Skip tour" link always visible
- On finish or skip: API call sets `hasCompletedOnboarding = true`

### 6 tour stops

| # | Page | Target Element | Tooltip Copy |
|---|------|---------------|--------------|
| 1 | `/catalog` | Search bar + filters | "Search by keyword, course code, or just describe what you're looking for — like 'easy humanities elective.'" |
| 2 | `/catalog` | AI chat entry point | "Meet your AI advisor. Tell it your major, interests, and workload preferences and it'll recommend courses with fit scores." |
| 3 | `/catalog/:id` | Ratings & reviews section | "See what students actually think — quality, difficulty, and workload ratings from your peers." |
| 4 | `/schedule` | Schedule grid | "Build your semester visually. Add courses and see how everything fits together." |
| 5 | `/friends` | Friends list / add friend | "Connect with classmates. See what courses your friends are taking and share wishlists." |
| 6 | `/profile` | Early adopter badge | "Here's your home base. And that badge? It shows up next to your name everywhere — reviews, friend lists, all of it. Thanks for being here early." |

### Navigation between stops

- Tour navigates the user to the correct page for each stop
- Short delay after navigation to let the page render before positioning the tooltip
- If the tour crosses pages, the tour state is managed in a React context that persists across routes

### Replay

- "Restart tour" button on the Profile page allows replaying anytime

---

## 5. Badge Visibility

The "Beta Tester" flair appears across the app — present but not obnoxious.

### Where it shows

| Location | Treatment |
|----------|-----------|
| **Profile page** | Badge displayed below display name — icon + "Early Adopter" label with gold/amber border. Dedicated badges section for future growth. |
| **Reviews** | Small pill next to username: `@sunny` `Beta Tester` in muted gold. Same on course detail pages and review lists. |
| **Friend lists** | Tag next to name in friend cards and search results. Visible to other users. |
| **AI chat** | Tag next to username in chat header (if username is shown). |

### Implementation

- `User` and `UserProfile` types gain a `badges: Badge[]` array field
- API attaches badges via a join on `user_badges` when returning user objects
- Shared `<UserBadge badge={badge} />` component renders the pill consistently
- `early-adopter` slug renders with gold styling; future badges get their own color/icon
- Badge data is lightweight (slug, name, icon) — negligible cost on user responses

### Badge type

```typescript
export interface Badge {
  slug: string;
  name: string;
  description: string;
  icon: string;
  awardedAt: string;
}
```

---

## 6. API Changes Summary

### New endpoints

| Method | Path | Purpose |
|--------|------|---------|
| PATCH  | `/api/users/me/onboarding` | Set `hasCompletedOnboarding = true` |
| GET    | `/api/users/:id/badges` | Get badges for a user |
| POST   | `/api/admin/invite-codes` | Create an invite code |
| GET    | `/api/admin/invite-codes` | List all invite codes |
| DELETE | `/api/admin/invite-codes/:id` | Delete an invite code |

### Modified endpoints

| Method | Path | Change |
|--------|------|--------|
| POST   | `/auth/register` | Accept + validate `inviteCode` field, auto-grant badge |
| GET    | `/auth/me` | Include `badges` array and `hasCompletedOnboarding` in response |
| GET    | `/api/users/:id` | Include `badges` array in response |

---

## 7. New Frontend Components

| Component            | Purpose                                                   |
| -------------------- | --------------------------------------------------------- |
| `WelcomeModal`       | Multi-slide welcome sequence (4 slides)                   |
| `GuidedTour`         | Tour engine — manages stops, overlay, tooltip positioning |
| `TourTooltip`        | The floating tooltip with copy, next/skip buttons         |
| `TourOverlay`        | Dimmed backdrop with cutout hole around target            |
| `UserBadge`          | Shared pill component for rendering badge flair           |
| `BadgeReveal`        | Animated badge display for slide 2 of welcome modal       |
| `OnboardingProvider` | React context managing tour state across routes           |
| `InviteCodeAdmin`    | Admin panel section for managing invite codes             |

---

## 8. Key Files to Modify

### Backend
- `api/src/db/schema.ts` — New tables + user column additions
- `api/src/routes/auth.ts` — Invite code validation at registration
- `api/src/routes/users.ts` — Onboarding completion endpoint, badge joins
- `api/src/services/userService.ts` — Badge queries
- `packages/shared/src/types/user.ts` — Badge type, updated User type

### Frontend
- `frontend/src/pages/Landing.tsx` — Invite code field on registration
- `frontend/src/App.tsx` — OnboardingProvider wrapper, tour integration
- `frontend/src/pages/Profile.tsx` — Badge display, restart tour button
- `frontend/src/components/ui/Modal.tsx` — Extend for multi-step support (or new component)
- `frontend/src/pages/admin/` — Invite code management page

### New files
- `api/src/routes/inviteCodes.ts` — Admin invite code endpoints
- `api/src/services/badgeService.ts` — Badge CRUD operations
- `frontend/src/components/onboarding/WelcomeModal.tsx`
- `frontend/src/components/onboarding/GuidedTour.tsx`
- `frontend/src/components/onboarding/TourTooltip.tsx`
- `frontend/src/components/onboarding/TourOverlay.tsx`
- `frontend/src/components/onboarding/OnboardingProvider.tsx`
- `frontend/src/components/ui/UserBadge.tsx`
- `frontend/src/pages/admin/AdminInviteCodes.tsx`

---

## 9. Rollout Verification Checklist

Set both flags during beta rollout:

- `BETA_REQUIRE_INVITE_CODE=true`
- `VITE_BETA_REQUIRE_INVITE_CODE=true`

Verification steps:

- Signup without an invite code returns `400` when beta invite gate is enabled.
- Signup with a valid invite code stores `users.invite_code` and grants `early-adopter`.
- First login for users with `hasCompletedOnboarding=false` opens the welcome modal.
- Selecting `Take the tour` and completing (or skipping) the tour sets `hasCompletedOnboarding=true`.
- Selecting `Skip for now` in the welcome modal leaves `hasCompletedOnboarding=false`.
- `Profile` page `Restart tour` action can replay the guided tour.
