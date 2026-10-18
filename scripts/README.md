# Scripts

- `check-secrets.mjs`: targeted, redacted scan of Git-tracked index content and environment filenames.
  Prints rule/file/line metadata only; does not inspect ignored files or compressed archives.
- `brand-tokens.test.ts`: M00 regression check for canonical CSS/JSON token parity and the app copy.
- `validate_project_skills.py`: pre-existing project skill integrity validator. Read `SKILLS_SETUP.md`
  before using its optional discovery/setup modes; historical receipts are preserved.
- `db/`: M01 local CI, Data API exposure and manual pooler-role checks. See
  [`db/README.md`](db/README.md) for dependencies, private credential handling and scope.

- `seed/`: M02 owner-run competitor/account seed, public ID resolution, website
  checks, bounded logo copy and environment-labelled reports. Read
  [`seed/README.md`](seed/README.md) for the exact private Windows handoff,
  credential-free runner build, dev packet approval and durable recovery rules.
  The completed dev action stays blocked against replay. The separate production
  runner requires its own exact approved packet; it cannot use the dev approval.
  No content collection or n8n activation is part of these scripts.
- `assert/m02_counts.sql`: read-only count and acceptance
  snapshot. Reported exceptions, idempotency and public logo visibility require
  their separate receipts; a passing count is not owner sign-off. D-27 excludes
  only seven exact owner-reviewed YouTube identities and retains raw denominators.

M07 adds evaluation scripts. M00/M01 evidence remains in the corresponding
milestone records; local checks and hosted/provider results stay distinct.
