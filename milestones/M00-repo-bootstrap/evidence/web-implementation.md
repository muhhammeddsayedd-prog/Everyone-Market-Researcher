# M00 web implementation evidence

Date: 2026-10-17 (Africa/Cairo). Scope: M00 T3 and the web parts of T6.

## Sources checked before implementation

- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation):
  App Router layout, scripts and minimum Node version; docs displayed 16.4.2.
- [create-next-app CLI](https://nextjs.org/docs/app/api-reference/cli/create-next-app):
  explicit TypeScript, App Router, Tailwind, no src directory, skip install and
  disable Git options.
- [Next.js Vitest setup](https://nextjs.org/docs/app/guides/testing/vitest):
  jsdom, React Testing Library and React transform; the placeholder is a
  synchronous Server Component, supported by the documented unit-test scope.
- [Next.js metadata](https://nextjs.org/docs/app/api-reference/functions/generate-metadata):
  static metadata export for title and robots.
- [Next.js Image](https://nextjs.org/docs/app/api-reference/components/image):
  the Next 16 `preload` property for the sole above-fold brand image.
- [Tailwind with Next.js](https://tailwindcss.com/docs/installation/framework-guides/nextjs)
  and [theme variables](https://tailwindcss.com/docs/theme): Tailwind v4 PostCSS
  installation and inline mapping to the supplied variables.
- [Playwright webServer](https://playwright.dev/docs/test-webserver) and
  [accessibility testing](https://playwright.dev/docs/accessibility-testing):
  fresh production server and axe analysis.

Registry versions were queried with `npm view` before installation. Next and
React runtime versions are exact pins. TypeScript uses 6.0.3 because the chosen
typescript-eslint release requires a version below 6.1; latest TypeScript 7 is
outside that peer range.

## Implementation decisions

- The CLI first failed because `apps/` did not exist. Creating that parent
  directory and rerunning the same CLI succeeded. No policy/approval block
  occurred and the scaffold did not install dependencies or initialize Git.
- The current CLI template supplied a Tailwind Turbopack loader. The app uses
  the official documented PostCSS v4 integration instead, with no custom
  bundler configuration.
- `styles/tokens.css`, `public/brand/everyone-logotype.svg` and `.env.example`
  were copied without editing from their canonical files. The stylesheet and
  SVG SHA-256 values match exactly:
  - tokens: `f6123e51e1fe327083a22f0d00209ef0ed38795a8fc88d4b283e771591ba6780`
  - SVG: `956befb784a4499230bcb2162660665d95e8e00aa7aa0ba95e2a1bc4cf8d1f4d`
- The supplied external SVG uses `currentColor`, whose isolated default is
  black. A CSS filter makes its existing paths white without rewriting them.
- M00 uses the token stack's system fallback via `--font-placeholder`. The
  canonical stylesheet contains declarations for M09 brand font files, so the
  placeholder does not select those unavailable faces or request their URLs.
- The visible label uses the exact M00 14px uppercase specification with
  token tracking. The footer reads `Internal · everyone.`. No product UI,
  authentication, collection or service connection was added.

## Checks run by the web implementation agent

- `pnpm --filter web test` against the original CLI page: expected RED, unable
  to find the Market Radar heading. See `web-unit-red.log`.
- Same command after implementing the placeholder: GREEN, 1 test passed.
  See `web-unit-green.log` (2.91 seconds).
- `pnpm --filter web typecheck`: passed. See `web-typecheck.log`.
- Prettier applied to owned app source/config files; canonical token and brand
  copies excluded from formatting.

The root agent runs integrated quality/build/browser verification. Playwright
is configured for Chromium at 320, 768, 1024 and 1440 CSS-pixel widths. Each
run starts a fresh built app on port 3000, checks title/robots/language, image
loading and white treatment, black background, console/page/network errors,
horizontal overflow and serious/critical axe findings, then saves a screenshot.
The initial production run passed all four tests in 19.9 seconds. Its receipt
is retained as `web-e2e-initial.log`. Environment-only NO_COLOR/FORCE_COLOR
warnings appeared in the runner output; the browser runtime/console/network
assertions passed.

## Development smoke and generated instruction fix

The separate `pnpm --filter web dev --hostname 127.0.0.1 --port 3000` smoke
revealed that Next.js 16.3+ generates app-local agent instructions on startup
even when the scaffold uses `--no-agents-md`.
[The current agentRules documentation](https://nextjs.org/docs/app/api-reference/config/next-config-js/agentRules)
and the installed 16.4.2 docs confirm the separate `agentRules: false` setting.
That setting was added, and only the newly generated `apps/web/AGENTS.md` was
removed. The project's existing root instructions were preserved.

After the config restart, the dev page passed HTTP/title/heading/image/robots
and runtime checks. See `web-dev-smoke.json`, `web-dev-process.json` and
`web-dev-desktop.png`. The process receipt identifies the reviewed owned CLI
and listener. Stopping the CLI also closed its listener; port 3000 was verified
closed. The dev process's termination exit code is from intentional shutdown,
not an application failure. The final production rerun after this config
adjustment passed all four Playwright/axe tests in 16.1 seconds; see
`web-e2e.log`. The fresh final screenshots have identical hashes to the
visually reviewed initial screenshots (`web-screenshot-hashes.json`), and
were copied to the evidence paths. Port 3000 was confirmed closed afterward.

## Screenshot critique

ROUND 1

Seen in one second: the white everyone. wordmark.

Idea: identify the internal Market Radar app using the specified quiet black
brand stage.

Live thing: none; this milestone intentionally contains only the placeholder.

Layout words by section: main = centered brand group / footer = quiet close.

Scores within the M00 placeholder scope: design 8, usability 8, creativity 5,
content 9; weighted score 7.5. This is a visual review, not a product-readiness
or marketing-site rating. The project adaptation excludes marketing media,
motion and action quotas.

Viewed `web-desktop.png`, `web-laptop.png`, `web-tablet.png` and
`web-mobile.png` at 1440, 1024, 768 and 320 CSS-pixel widths. All four show
the correct white, proportionate wordmark above the gray uppercase label,
with the footer near the lower edge. There are no collisions, clipped
elements, accidental wrapping or horizontal overflow. The desktop's empty
field and the phone's larger relative mark are the specified placeholder
composition. No visual correction is needed for the authorized scope.

The development screenshot was also opened and reviewed. It visually matches
the production placeholder; no error overlay appeared.
