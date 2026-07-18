# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Next.js dev server with Turbopack. Runs `predev` (profile validation) first; will fail if `.cursorrules` is missing or out of sync with the active profile.
- `npm run build` — production build. `prebuild` cleans `.next`, `node_modules/.cache`, `.turbo` first. ESLint is disabled during builds via `next.config.ts` (`eslint.ignoreDuringBuilds: true`); run `npm run lint` separately.
- `npm start` — serves the built app on port **8080** (not 3000).
- `npm run lint` / `npm run lint:fix`
- `npm run type-check` — `tsc --noEmit`. Note: `tsconfig.json` has `strict: false` and most strictness rules relaxed.
- `npm run fresh` — clean + reinstall + dev. Use when caches get weird.
- `npm run deploy` — runs `deploy.sh`: requires clean tree, pulls `release`, `npm ci`, builds, restarts PM2 app `${PM2_APP_NAME:-nextjs-app}`. The default branch is `release` (not `main`).

There is no test framework configured.

## Cursor Profile System (predev gate)

Two mutually exclusive profiles live under `.cursor/profiles/`:
- `default` — flexible, "rapid development" mode.
- `joveo-ai-dashboard` — strict Joveo design-system mode (currently active).

The active profile is determined by `.cursorrules` at the repo root, which **must be a byte-for-byte copy** of the chosen profile's `.cursorrules`. `.cursor/validate-profile.sh` (run by `predev`) compares them with `cmp -s` and fails the dev server if they diverge. To switch:

```
npm run profile:joveo     # or profile:default
npm run profile:status    # show currently active profile
```

`scripts/apply-profile.js` rewrites `.cursor/project-context.md` flags as a side effect of switching. The Joveo profile's rules in `.cursor/profiles/joveo-ai-dashboard/rules/*.mdc` are the authoritative spec for design tokens, components, data-grid, charts, and metrics — consult them before introducing UI patterns.

## Architecture

**Stack:** Next.js 15 App Router (React 19, TypeScript, Tailwind v4, shadcn/ui "new-york" style, TanStack Query + Table, Radix primitives, recharts). Path alias `@/*` → `./src/*`.

### Auth flow (production only)

`src/app/layout.tsx` wraps every route in `<AuthenticatedRoute>` inside a `<QueryClientProvider>`. In `NODE_ENV !== "production"` the guard short-circuits and renders children immediately — auth is fully bypassed in dev. In production, `AuthenticatedRoute` (`src/components/AuthenticatedRoute.tsx`):

1. Migrates `refreshToken` / `email` / `identityProvider` from cookies (set by the Accounts app redirect) into `localStorage`.
2. Calls `fetchAndSaveAccessToken()` → POSTs to `/user/v1/account/token`.
3. Fetches `/user/v1/profile` and caches under `localStorage.profile`.
4. On failure, redirects to `https://accounts.joveo.com/validate?redirect=...&productId=CODER`.

**Heimdall proxy:** `next.config.ts` rewrites `/user/v1/:path*` → `http://fna-heimdall.prod.joveo.com:8080/user/v1/:path*`. This is why `src/utils/authHelper.ts` uses a relative `baseURL` of `/user/v1` — to dodge browser CORS. Use the exported clients rather than raw fetch:

- `heimdalClient` — for `/user/v1/*`; auto-attaches `accessToken` header.
- `apiClient` — for other external APIs; auto-attaches `Authorization: Bearer`.
- `authFetch` — wrapper around `fetch` for internal `/api/*` routes.

All three handle 401 by calling `logoutAndValidate()` (clears storage, redirects to Accounts). `middleware.ts` is currently a no-op pass-through.

> `src/components/AuthenticatedRoute.tsx` is **protected** (see `.cursor/profiles/joveo-ai-dashboard/rules/protected-files.mdc`). Do not edit unless the user explicitly asks for a "custom authentication setup" or to "edit AuthenticatedRoute".

### Secrets / AWS

`src/lib/secrets-manager.ts` is a server-only singleton over AWS Secrets Manager with a 1-hour in-memory cache. It reads the secret named in `SECRET_NAME` (env var, no fallback — throws if missing at runtime). `src/lib/startup.ts` initializes it lazily and **skips initialization during builds** and when `SECRET_NAME` is not set; in production it `process.exit(1)` on init failure (fail-fast). `src/lib/aws-proxy.ts` exposes a similar API for ad-hoc lookups. Never import either of these from a client component.

Key conventions:
- Google Sheets credentials: full service-account JSON stored under secret key `SPREADSHEET_SECRET`; service account is `coder-536@jaas-282904.iam.gserviceaccount.com`. Sheets must be shared with that email.
- Cache-refresh endpoint: `POST /api/secrets-manager-cache-refresh`.

### App structure

- `src/app/` — App Router (`layout.tsx`, `providers.tsx`, `page.tsx`, plus `api/{chart-data,sheet-data,secrets-manager-cache-refresh}/route.ts`).
- `src/components/` — top-level shared components; `Header`, `Sidebar`, `AuthenticatedRoute`, `AppLoader`, `Footer`, `JoveoLogoIcon`, `UserAvatar`.
- `src/components/ui/` — shadcn-generated primitives plus Joveo-specific overlays: `JoveoButton`, `JoveoTable`, `data-table.tsx` (TanStack Table + dnd-kit), `charts/` (Joveo bar/pie/combination/spend-by-channel), `metrics/` (MetricCard variants and grid).
- `src/lib/joveo-design-tokens.ts` — hardcoded brand colors, typography, spacing. This is the single source of truth for chart/dashboard styling under the Joveo profile.
- `src/lib/design-tokens.ts` — re-exports tokens from `.cursor/profiles/joveo-ai-dashboard/design.json`.
- `src/lib/chart-*` — chart data processing, types, and examples; consumed by `src/components/ui/charts/`.
- `src/utils/authHelper.ts` — all auth/token/cookie/redirect helpers (one file).
- `src/lib/localStorage-polyfill.ts` — imported **first** in `layout.tsx` to prevent SSR errors.

### Environment notes

- `next.config.ts` ignores ESLint during builds — keep CI lint as a separate step.
- `tsconfig.json` runs with `strict: false`; do not assume strict-mode null checks.
- `package.json` sets `start` to port 8080; deploys assume PM2 manages this process.
- `.cursorrules` is generated, not hand-edited — modify the profile's source `.cursorrules` instead and re-run `npm run profile:<name>`.
