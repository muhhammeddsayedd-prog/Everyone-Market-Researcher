# everyone. Market Radar web app

This is the internal Next.js app (App Router, React Server Components, Tailwind v4 on the Everyone tokens).
Sign-in is invite-only, through Google and Supabase Auth.

**Status:** an early parallel frontend track. It covers parts of M09, M10 and M11. The
company-browsing journey is built and tested against a real local Supabase stack. No milestone is
complete. Progress and open dependencies are tracked in
`milestones/M09-web-app-foundation/PROGRESS.md`.

## How data is read

The app follows TECHNICAL.md §10, using M09 "Option B" (per-user reads):

- **Who reads:** every read runs in a Server Component through `lib/supabase/server.ts`. That is an
  `@supabase/ssr` client carrying the **signed-in user's** cookies, which calls the HTTPS Data API
  (`app` schema). RLS (`private.is_member()`) decides what is visible.
- **What the server checks:** the session (`getClaims()`) and the membership (`app.me()`), both in
  `lib/auth/viewer.ts`. They are checked in the `(app)` layout and again in every page.
  `proxy.ts` refreshes sessions and redirects signed-out requests.
- **What the browser gets:** rendered HTML, plus the minimal fields passed to client components.
  There are no browser-side database calls. There is no secret key, no `api_agent`, no `n8n_writer`
  and no service role.
- **Caching:** every response is `Cache-Control: private, no-store`. There is no shared cache.
- **Failing closed:** if `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or
  `NEXT_PUBLIC_SITE_URL` is missing or invalid, every route returns a 503 notice. A secret key in
  the publishable slot is rejected.

Source text, URLs and images are treated as untrusted:

- React escapes all text.
- Links must be http(s) with no credentials (`lib/view/safe-url.ts`).
- Logos come only from the project's own Storage paths (`lib/view/logo.ts`, CSP `img-src`).
- Smoke fixtures (C999) are excluded in `lib/data/fixtures.ts`.

## Page and dependency map

| Route | Milestone | State | Real data from | Still needs |
|---|---|---|---|---|
| `/login`, `/auth/callback`, `/no-access` | M09 | Built | Supabase Auth, `app.me()` | MA-19 redirect URLs; owner sign-in on dev |
| App shell (sidebar / rail / bottom nav, ⌘K notice, market switcher, user menu, theme) | M09 | Built | `app.me()` role | Date range and pipeline dot wait for activity data and `app.pipeline_summary` |
| `/competitors` (grid/list, search, tier/category/capability/status, market, 4 sorts, keyset pages) | M10 | Built | `app.competitors` + embedded `competitor_accounts` | Activity sort/sparkline need `stats_daily` / `competitor_overview_v` |
| `/competitors/[slug]` Overview | M10 | Built (facts, notes, sources summary) | `app.competitors`, `competitor_accounts` | KPI tiles and charts need `stats_daily`, `feed_v`, `campaigns_v` |
| `/competitors/[slug]/accounts` (Sources) | M10 | Built | `competitor_accounts` | Admin pause/resume/re-scrape: M11 contracts |
| `/competitors/[slug]/capabilities` | M10 | Built | `competitors.in_house`, `taxonomy_terms` | — |
| `/competitors/[slug]/{campaigns,posts,clients,agencies,people,team,news}` | M10 | Unavailable state | — | M04–M08 collection and AI outputs |
| `/coverage` | M10 | Built | All visible companies and sources | — |
| `/` Pulse, `/feed`, `/campaigns`, `/briefs`, `/news`, `/brands`, `/agencies`, `/people`, `/markets`, `/compare` | M09/M10/M12 | ComingSoon page naming its dependency | — | See `lib/nav/registry.ts` |
| `/search` | M11 | ComingSoon | — | Hybrid search (no embedding calls are made) |
| `/review` (analyst+), `/admin/*` (admin) | M11 | ComingSoon, role-gated (404 otherwise) | — | Review and admin mutation contracts |
| `/settings`, `/docs/api` | M11/M14 | ComingSoon | — | Alert rules and API |

`lib/nav/registry.ts` is the source of this map. The app renders it in navigation and on each
planned page.

## Run it

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter web test                      # unit + component tests (Vitest)
pnpm test:e2e                               # fail-closed suite: build with NO configuration
```

### Against the isolated local stack (authenticated journey)

Docker is required. The script copies `supabase/` into a temporary workdir with its own project id
and ports (613xx). It never touches another local stack and never contacts a hosted project.

1. It applies the migrations, `supabase/seed.sql` and `e2e/fixtures/web-e2e.seed.sql`. That fixture
   file holds 59 labelled "Fixture" companies, plus C999, which the app must exclude.
2. It creates four local identities: member, admin, disabled and outsider. Email/password sign-in
   is enabled only in that temporary copy, so the tests get genuine sessions. The app itself only
   offers Google.

```sh
node apps/web/e2e/support/stack.mjs up
pnpm --filter web test:e2e:auth             # access, journey, profile, layout/a11y at 1440/1024/768/320
node apps/web/e2e/support/stack.mjs down
```

Responsive screenshots are written to `e2e/__screenshots__/`.

### Against dev (`zmotjsbzhzjvpelxvxlf`)

1. Create `apps/web/.env.local` with the three public values (see `.env.example`).
2. Run `pnpm dev`.
3. Sign in with an invited Google account at `http://localhost:3000`.

This needs MA-19: `http://localhost:3000/**` in the dev Auth redirect URLs.

## Fonts

IBM Plex Sans Arabic (OFL) is committed. General Sans is not, because its licence forbids
repository redistribution and this repository is public. See `public/fonts/LICENSES.md`.
