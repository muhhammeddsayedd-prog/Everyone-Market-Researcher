# everyone. Market Radar web app

M00 is a static internal placeholder: the supplied wordmark, product label and
footer. Authentication and product screens begin in M09. No environment values
or external services are needed for this page.

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm --filter web build
pnpm --filter web test
pnpm --filter web exec playwright install chromium
pnpm test:e2e
```

The development URL is `http://localhost:3000`. Playwright starts a fresh
production build at `http://127.0.0.1:3000`; stop a local server on that port
before running it. Desktop and mobile tests check the title, noindex metadata,
wordmark, runtime errors, page overflow and serious/critical axe violations.
Each run writes a screenshot per viewport into `test-results/` and an HTML
report into `playwright-report/`.

Brand tokens and SVG are exact copies from `assets/brand/`. The SVG's default
black `currentColor` is rendered white with a CSS filter. M00 uses system fonts;
self-hosted General Sans and IBM Plex Sans Arabic arrive in M09. The placeholder
does not request the not-yet-supplied brand fonts.
