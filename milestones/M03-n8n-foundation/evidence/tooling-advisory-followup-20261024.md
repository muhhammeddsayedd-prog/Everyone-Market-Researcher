# Tooling advisory and ESLint compatibility follow-up — 24 October 2026

The scheduled advisory recheck is complete. GitHub withdrew **GHSA-vfj7-8cjw-p6xm / CVE-2026-93687 on 23 October 2026**, stating that the issue is not practically exploitable. Its historical range remains `braces <=3.0.3`, with no patched version listed. No dependency override or upgrade is needed solely to remediate this withdrawn advisory. The original M00 audit remains historical evidence; this is not a new full-audit-clean claim. [Official advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).

## Current repository graph

Read-only `pnpm why braces --recursive --json` completed native0 (`91f164`) and returned exactly this root `devDependencies` chain:

```text
eslint-config-next@16.4.2
→ @next/eslint-plugin-next@16.4.2
→ fast-glob@3.3.1
→ micromatch@4.0.8
→ braces@3.0.3
```

The same query with `--prod` completed native0 and returned `[]` (`3c79f3`). Static source inspection found no direct import of `braces`, `micromatch` or `fast-glob` under `apps/`, `packages/` or `scripts/`, excluding generated output and dependencies (`608664`). The checked-in ESLint configuration uses literal repository globs and `apps/web/`. These establish the present tooling path and static input boundary, rather than a fresh application execution or comprehensive dependency audit.

## Separate ESLint support limitation

Root `package.json` and `pnpm-lock.yaml` still pin ESLint **9.39.5**, Next lint configuration **16.4.2** and typescript-eslint **8.71.2**. ESLint's official support table confirms that v9 reached EOL on **6 August 2026**; v10 is current. The advisory withdrawal does not resolve that maintenance limitation. [Official version support](https://eslint.org/version-support/).

Public npm metadata was read without installation or package lifecycle execution (`d6a119`, `59fcec`):

| Package | Latest published version observed | Declared ESLint peer support |
| --- | --- | --- |
| `eslint` | `10.13.0` | Not applicable; Node24 satisfies its engine range |
| `eslint-plugin-react` | `7.37.5` | Through `^9.7`; excludes10 |
| `eslint-plugin-jsx-a11y` | `6.10.2` | Through `^9`; excludes10 |
| `eslint-plugin-import` | `2.32.0` | Through `^9`; excludes10 |

Primary metadata: [ESLint](https://registry.npmjs.org/eslint/latest), [React plugin](https://registry.npmjs.org/eslint-plugin-react/latest), [accessibility plugin](https://registry.npmjs.org/eslint-plugin-jsx-a11y/latest), [import plugin](https://registry.npmjs.org/eslint-plugin-import/latest). These `latest` URLs may change; the table records the versions actually observed on24October. The web reader could not open the registry responses, so a bounded credential-free HTTPS JSON read projected only versions, peers, engines and deprecation fields.

A single-package ESLint10 bump would violate three current plugin peer ranges. No compatible minimal version-only fix was established for the current lint graph. Retain the existing pin and its open EOL limitation; reassess a supported lint-stack change when compatible upstream releases are available. Do not force peer ranges, remove rules or purchase extended support as part of this follow-up.

## Scope and disposition

- GHSA recheck: complete; upstream advisory withdrawn. Preserve the original audit and its dated deferral.
- ESLint compatibility review: complete for the current published peers; maintenance limitation remains open. Any future change needs its own concrete dependency diff and affected lint/quality verification.
- No dependency, lockfile, ESLint configuration, existing progress record or CI-recovery record was changed. No install, upgrade, test suite, fresh audit, credential access or hosted application operation was performed. M03 acceptance and later milestones are unaffected.
