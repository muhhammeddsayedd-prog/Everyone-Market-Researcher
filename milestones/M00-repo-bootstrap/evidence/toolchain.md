# M00 toolchain evidence

Verified 2026-10-17 (Africa/Cairo). These are bootstrap implementation choices, not acceptance of later services. Exact direct dependencies live in the root, web and shared `package.json` files; transitive resolutions live in `pnpm-lock.yaml`.

## Version pins and compatibility

Registry metadata was queried with `npm view <package>@<version> version peerDependencies deprecated --json` during M00. This reads the public npm registry; it does not install packages. Representative primary metadata: [Next.js 16.4.2](https://registry.npmjs.org/next/16.4.2), [typescript-eslint 8.71.2](https://registry.npmjs.org/typescript-eslint/8.71.2), [ESLint 9.39.5](https://registry.npmjs.org/eslint/9.39.5) and [React lint plugin 7.37.5](https://registry.npmjs.org/eslint-plugin-react/7.37.5).

| Tool / dependency                            | Exact version                              |
| -------------------------------------------- | ------------------------------------------ |
| Node runtime observed locally                | 24.18.0; `.nvmrc` selects the Node 24 line |
| pnpm (`packageManager`)                      | 10.34.7                                    |
| Next.js, create-next-app, eslint-config-next | 16.4.2                                     |
| React, React DOM                             | 19.3.1                                     |
| TypeScript                                   | 6.0.3                                      |
| typescript-eslint                            | 8.71.2                                     |
| ESLint                                       | 9.39.5                                     |
| Prettier                                     | 3.9.10                                     |
| Vitest                                       | 5.0.5                                      |
| Zod                                          | 4.6.7                                      |
| Tailwind CSS, @tailwindcss/postcss           | 4.3.3                                      |
| @playwright/test                             | 1.64.1                                     |
| @axe-core/playwright                         | 4.14.0                                     |
| @vitejs/plugin-react                         | 6.1.2                                      |
| jsdom                                        | 30.1.3                                     |
| @testing-library/dom                         | 10.4.2                                     |
| @testing-library/jest-dom                    | 7.0.1                                      |
| @testing-library/react                       | 16.3.3                                     |
| @types/node                                  | 24.19.2                                    |
| @types/react, @types/react-dom               | 19.3.0                                     |

`typescript-eslint` and its parser declare TypeScript `>=4.8.4 <6.1.0`, so 6.0.3 stays inside the verified peer range. The Next.js lint dependency `eslint-plugin-react@7.37.5` declares ESLint support through `^9.7`; this constrains the toolchain to ESLint 9 even though `eslint-config-next@16.4.2` itself allows `>=9.0.0`. ESLint 9.39.5 is deprecated and its release line reached EOL on 2026-08-06 according to [ESLint version support](https://eslint.org/version-support/). This is an explicit temporary tooling limitation. Recheck plugin support and a supported ESLint upgrade by **2026-10-24**, with lint and the complete quality checks after any change.

## Installation and current framework patterns

`.npmrc` sets `ignore-scripts=true`, `engine-strict=true` and `save-exact=true`. `pnpm-workspace.yaml` has `onlyBuiltDependencies: []`: no dependency lifecycle scripts are authorized in this credential-free bootstrap. These controls remain in effect for frozen installs. Explicit project commands, including the Playwright browser installer, are separate from dependency lifecycle hooks. See [pnpm 10 build-script settings](https://pnpm.io/10.x/settings#onlybuiltdependencies) and [install script controls](https://pnpm.io/cli/install#--ignore-scripts).

The web app was scaffolded with this pinned command after creating its `apps/` parent directory:

```sh
pnpm.cmd dlx create-next-app@16.4.2 apps/web --ts --app --eslint --tailwind --no-src-dir --import-alias "@/*" --use-pnpm --no-react-compiler --no-cache-components --no-agents-md --no-agent-feedback --skip-install --disable-git --yes
```

The current [create-next-app CLI reference](https://nextjs.org/docs/app/api-reference/cli/create-next-app) documents `--no-*` negation, `--skip-install` and `--disable-git`. `--no-src-dir` replaces the handoff's older `--src-dir=false` example. The scaffold did not install dependencies or initialize nested Git. The generated Tailwind Turbopack loader was replaced with the documented Tailwind v4 PostCSS integration; see [web implementation evidence](web-implementation.md) for sources and details.

Root `vitest.config.ts` uses `test.projects`; the old `workspace` setting has been deprecated since Vitest 3.2. Project configs name the web, shared, normalizer and brand-token suites. The normalizers use `.mts` for their ESM config alongside a private CommonJS boundary for the canonical plain-JS helper. These are local tests, not n8n Cloud runtime verification. See [Vitest projects](https://vitest.dev/guide/projects).

## Dependency audit and bounded deferral

The retained [full audit JSON](audit.json) reports **one high** advisory and no critical findings. [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) affects `braces <=3.0.3`; the advisory lists no patched version as of this check. The observed dependency path is:

```text
eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces@3.0.3
```

Reachability assessment: this path belongs to lint tooling. The current checked-in ESLint configuration uses repository-controlled glob patterns and a literal `apps/web/` root; the placeholder has no route accepting user glob patterns or runtime import of this chain. The advisory's deeply nested pattern input is therefore not exposed through the current app runtime. Lint and CI still execute the affected dependency, so the full audit remains non-clean. No forced dependency override or unsupported patch was applied.

The separate [production-only audit JSON](audit-production.json) reports **zero** findings; this does not erase the full-graph finding. Recheck the upstream fix, resolved dependency path and reachability by **2026-10-24**, or sooner when lint configuration/dependencies or user-input handling changes. Re-audit and run relevant quality checks before accepting any remediation.

## Formatting and source preservation

`.prettierignore` excludes the supplied `docs/`, `reference/`, `data/`, `templates/`, project-local skills, skill lock/setup records, operating/design manuals, milestone specifications and later milestone folders. Maintained README, root/M00 progress and implementation files can be formatted within their authorized edits.

The canonical `assets/brand/tokens.css` and its `apps/web/styles/tokens.css` copy are explicitly excluded to preserve their bytes. The repaired token JSON mirror is formatted; that is not a claim that every source asset is excluded. SVG files have no configured Prettier parser and are skipped by the directory format command. Brand equality and token checks have separate evidence. Formatting exclusions preserve handoff content; they do not substitute for application tests or hosted acceptance.
