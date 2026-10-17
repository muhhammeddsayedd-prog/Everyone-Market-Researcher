# Independent foundation and documentation review

Date: 17 October 2026. Reviewer: `token_integrity` agent.

No unresolved required source changes remain in the independently reviewed
foundation and documentation scope. No SQL changes were needed in migrations
1–3 or tests 00–03. Hosted schema, machine-role
poolers, OAuth, production and GitHub CI acceptance remain separate gates.

## Scope and independence

Reviewed the schema agent's extensions/schemas/roles, core tables, membership,
RLS, views and search triggers, plus their first four pgTAP suites. Read AGENTS,
the project skill rules, M01, binding decisions, schema/testing contracts and
the local code-review/security/source guidance.

Also reviewed root-authored changes to DATA_SCHEMA, TECHNICAL, DECISIONS and
the Supabase README against the milestone and actual CLI flags. Follow-up
readback confirms root README now states M01 is in progress and describes
the local/hosted boundary accurately.

This reviewer authored the pooler script, CI wrapper and synthetic regressions;
their verification is not independent self-approval. The schema agent's
independent script/CI review is recorded in
`independent-pipeline-security-review.md`. The Data API probe, concurrency probe
and migrations 4–7 are outside this review's source approval.

## Findings and actions

| ID  | Assessment                                                                                                                                                | Action                                                                                                                                                                                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | Required documentation correction: ordinary CLI `link` internally reveals and probes with the elevated API key, contrary to this project's key-use limit. | Use the supported explicit-ref workflow and record a T2 deviation; do not claim a CLI link receipt. Exact source and access choices are in `cli-hosted-access-review.md`. Root owns the README/progress correction. No link was attempted by this reviewer. |
| F2  | Required documentation correction: root README still described M01 as unstarted and Supabase as a placeholder at the reviewed checkpoint.                 | Root owns updating it to the actual local/hosted acceptance state. This is not a SQL defect.                                                                                                                                                                |
| F3  | Informational: the existing targeted secret scanner omits Supabase PAT strings and database URL passwords.                                                | No credential exposure was observed. Add the relevant PAT pattern before scoped-token handling, or retain the explicit limitation and perform the applicable private checks before staging. Never print matching source lines.                              |

F1 and F2 were corrected by root; this reviewer read back both README files.
The hosted workflow uses supported explicit refs and records that no CLI link
receipt exists. Root README describes the current foundation and remaining
hosted gates accurately.

F3 was addressed after the initial review: the scanner now covers Supabase PATs
and password-bearing Postgres URIs, with isolated red/green regressions and a
quality-job step. See `secret-scanner-verification.md`. That extension was
authored by this reviewer. The schema agent's separate final staged-source
readback found no remaining required findings after the two parser fixes;
see `independent-pipeline-security-review.md`. The scanner remains targeted
and its documented limits still apply.

The earlier local unverified-email signup issue was independently reported by
the schema agent and fixed by root. The reviewed README and configuration now
state/disable local email signup. The safe HTTP receipt records signup denied
with no created user. Hosted Google-only configuration still needs verification.

## SQL assessment

- Machine roles are LOGIN/NOINHERIT/NOBYPASSRLS with no committed passwords,
  empty login search paths and bounded statement timeouts. SQL schema/table
  grants restrict writer access to the non-exposed RPC path and reader access
  to the intended read surfaces. Fresh-role assertions additionally reject
  superuser, role-creation and database-creation privileges.
- Table creation enables RLS and clears inherited/default application grants
  before later migrations install the explicit policies. Catalog assertions
  cover all 25 app, one ingest and ten ops tables, all views' invoker settings,
  direct machine writes and usable leading FK indexes.
- Membership helpers/trigger are in `private`, with definer search paths empty,
  fully qualified relations and PUBLIC execution revoked. Authorization comes
  from the invite/allowed-domain records; user metadata supplies display text
  only. Invite consumption locks the invite row. Domain autojoin remains empty.
- Member reads require active membership, admin-only tables use the admin
  helper, and saved-view CRUD requires the caller's UID on both existing and
  proposed rows. Disabled members lose reads and writes. Agent policies avoid
  private membership tables; nested read views preserve caller RLS.
- Search-vector triggers qualify extension calls and avoid definer exposure.
  Schema/catalog checks, invited/noninvited/disabled membership, member and
  nonmember reads, saved-view ownership, anonymous denials and agent grants are
  exercised after actual SET ROLE, rather than under a superuser identity.
- The first four test plans total 109 assertions (21 + 15 + 63 + 10). Temporary
  pgTAP/schema/test-role grants occur inside rollback transactions. The scope
  helper assertion tests both missing and supplied scope. No placeholder test
  or skipped assertion was found in this reviewed scope.

## Docs and CI assessment

The schema/RPC milestone-label and scheduling changes reconcile the specific
M01 requirements with older general drafts. The root docs correctly keep local
fixtures out of hosted pushes, separate local types from hosted deployment,
retain owner approval for production and preserve future M02/M09/M11 scope.
The first-write-wins account-result limit is explicitly documented.

The CI diff preserves existing quality/unit/build/browser gates and adds an
isolated Ubuntu DB job using an exact official setup-action SHA and CLI pin.
Frozen dependency installation retains blocked lifecycle scripts. The DB wrapper
captures raw start/status-capable tool output privately and uses local reset,
tests and advisors. The synthetic safety suite checks failure propagation and
prevents zero/incomplete pgTAP results from passing. Data API and concurrency
commands are wired after the database checks. No hosted credential is supplied
to the job. This source assessment is distinct from an actual green CI receipt.

## Evidence readback and limits

Personally inspected these root-run local receipts; did not rerun them:

- `pgtap-final.log`: ten suites, 242 assertions, all successful, `Result: PASS`.
- `local-inventory.json`: PostgreSQL 17.11; exact seven migration versions;
  25/1/10 tables; zero project tables without RLS; zero non-invoker views;
  zero exposed definers; both bounded roles; 120 terms, 13 settings, 17 price
  placeholders; three queues, two housekeeping jobs and the media bucket.
- `local-data-api.json`: member/nonmember app requests both 200 with the
  expected differing row visibility, all four hidden schemas 406, cleanup OK.
- `rls-mutation.log`: root's rolled-back RLS predicate inversion failed eleven
  of 35 assertions, including positive member and negative nonmember cases.
  This proves the affected access checks are sensitive to that mutation; it was
  not performed by this reviewer and is not a mutation score for all SQL.

No source condition was modified by this review. No local reset, hosted query,
stored-credential lookup, real pooler login, OAuth exchange or production action
was performed by this reviewer. The final engineer must verify required docs
corrections, current quality checks and the remaining hosted/owner gates.

## Reviewed source hashes (SHA-256)

```text
478c9272e785b6bbe76824077fb2c6f574caaa2bd7f58d1941af051ce778080d  20261017172928_extensions_schemas_roles.sql
4f1be3f6191885add916b164975ba10a8697069a0373a05df4e03fa53ea7cba3  20261017172931_core_tables.sql
8986d801f5a85ea40a620911cd59c88ac44414a1b7fde11fd469b6bff96282f9  20261017172934_auth_rls_views.sql
8c36670656bf5cdfdc2657c89cc47c95eb17e6dcbf0aea26055d1fd37a3d3baa  00_schema.test.sql
e7a6ec49252d4a41e97c86c44b6df4cb4f372abff2d7785727cdf560f48c46ee  01_membership.test.sql
064b3af45eec5351351b3496d8a55129ea514098855c67de731dc5dc024f0007  02_rls_members.test.sql
e24b227f658ba04362a4f42162ecb83b118e8e6805d31f16420bf12e10da0c96  03_api_agent.test.sql
```
