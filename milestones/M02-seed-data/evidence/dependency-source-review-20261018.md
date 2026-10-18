# M02 owner-run script dependencies and source checks

Reviewed18October2026Cairo. Versions were read from the npm registry and pinned:
`postgres3.4.9`, `csv-parse7.0.3`, `sharp0.35.5`, `@supabase/supabase-js2.118.0`,
`tsx4.23.15`, `esbuild0.28.2`. They are project-workspace dependencies, not global
tool installs. `pnpm install --ignore-scripts` completed natively0; existing
installation-hook restrictions remain. No credentials were passed to installation
or build processes. The existing braces development-tool advisory / ESLint
peer/support follow-up remains due24October; this is not a fresh clean audit.

- [Postgres.js official source](https://github.com/porsager/postgres): parameterized
  values, transaction-bound connections and rollback semantics. Native errors can
  contain query/parameter details, so the runtime emits fixed safe codes only.
  Actual local PostgreSQL tests cover arrays, CAS, precision, rollback and no-op
  behavior rather than asserting SQL strings alone.
- [Postgres.js issue1261](https://github.com/porsager/postgres/issues/1261) describes
  `end()` hanging with a reserved connection released after shutdown starts. It
  does not establish a transaction-atomicity failure. This runtime does not
  manually reserve connections; it awaits active operations before bounded
  `sql.end({timeout:5})`. The outer process also has a deadline/exit check.
- [csv-parse sync API](https://csv.js.org/parse/api/sync/) and
  [BOM option](https://csv.js.org/parse/options/bom/): BOM-aware parsing followed by
  strict boundary validation; source URLs are screened before raw-plan output.
- [Sharp constructor](https://sharp.pixelplumbing.com/api-constructor/) and
  [resize](https://sharp.pixelplumbing.com/api-resize/): explicit image/pixel limits,
  warning failure mode, rotation, max256 dimensions without enlargement. SVGs use
  a conservative static allowlist and preserve accepted original bytes.
- [Supabase upload reference](https://supabase.com/docs/reference/javascript/storage-from-upload)
  and [standard uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads):
  create-only objects, no blind `upsert`, followed by actual public byte/hash and
  metadata ownership checks. The pinned SDK is exercised with a fake transport
  to verify the restricted POST upload shape without an HTTP request. SDK fetch
  rejects redirects and any foreign origin/path before keys can be forwarded.
- [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys):
  secret key is confined to this owner-run seed, with no browser/session use.
- [esbuild API](https://esbuild.github.io/api/): own TS/shared sources bundle to a
  plain Node artifact before loading credentials. The build rejects credential
  environment variables; the private consumer verifies the code/data/packet seal
  and starts no compiler, loader or installer with secrets.
- [Supabase changelog](https://supabase.com/changelog.md): fresh HTTP200 fetch on
 18October. Its12October TLS notice schedules old TLS1.2 cipher retirement for
 10November. The Node24 client keeps certificate validation enabled; no security
  setting was relaxed.

Vimeo/YouTube/public-network details and unresolved source limitations are kept
separately in [provider-source-review-20261018.md](provider-source-review-20261018.md).
These documentation/local checks do not establish live provider or seeded-data
acceptance. No database schema/migration/type change was introduced in M02.
