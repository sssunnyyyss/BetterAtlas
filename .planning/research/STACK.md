# Stack Research

**Domain:** AI chat UX redesign inside an existing React web app
**Researched:** 2026-02-27
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| React | 18.x (existing) | UI composition and state-driven rendering | Already in production and well-suited to complex interactive chat surfaces |
| TypeScript | 5.x (existing) | UI/API type safety | Prevents regressions during broad UI refactors |
| Tailwind CSS | 3.x (existing) | Fast iterative styling and responsive layouts | Existing design system and utility patterns already rely on it |
| TanStack React Query | 5.x (existing) | Mutation/loading/error state for AI requests | Existing AI flow already uses React Query; avoids state duplication |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-router-dom | 6.x (existing) | Route-level UX and deep-link behavior (`/ai?prompt=`) | Keep deep-link-to-first-message behavior stable |
| Web Animations/CSS transitions | Browser-native | Message/cell transitions and polish | Prefer lightweight motion over heavy JS animation dependencies |
| `prefers-reduced-motion` media query | Browser-native | Accessibility-safe motion controls | Apply globally to avoid motion discomfort |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vitest + Testing Library | Component and route regression tests | Add interaction tests for chat states and recommendation rendering |
| Vite build | Fast feedback during redesign iteration | Keep chunk-size warnings in mind when adding visual assets |

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| CSS transitions + selective keyframes | Framer Motion | Use only if choreography becomes complex across many coordinated elements |
| Tailwind utility-driven styling | New component UI framework | Avoid for this milestone to prevent visual-system reset and migration cost |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Full frontend framework migration | High risk, low direct user value for this milestone | Redesign within current React/Tailwind stack |
| Heavy runtime animation libraries by default | Performance and bundle-size cost for mobile | Native CSS/WAAPI with reduced-motion support |
| Backend API contract churn for visual-only work | Introduces unnecessary cross-layer risk | Keep `/api/ai/course-recommendations` compatible |

## Stack Patterns by Variant

**If adding smooth transitions to message list:**
- Use opacity/transform transitions with small durations and stagger.
- Because this gives perceived smoothness with minimal layout thrash.

**If redesigning recommendation cards:**
- Use composable subcomponents and shared tokens (`spacing`, `radius`, `surface`).
- Because card consistency is the primary determinant of perceived polish.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| React 18.x | React Router 6.x, React Query 5.x | Existing project alignment is already proven |
| Tailwind 3.x | Vite 5.x | Existing build pipeline already supports this |

## Sources

- BetterAtlas repository (`frontend/src/pages/AiChat.tsx`, related hooks/components)
- Existing package manifests and build/test configuration in this repo
- Established web accessibility and responsive interaction conventions

---
*Stack research for: AI chat UI redesign*
*Researched: 2026-02-27*
