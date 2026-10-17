# Scripts

- `check-secrets.mjs`: targeted, redacted scan of Git-tracked index content and environment filenames.
  Prints rule/file/line metadata only; does not inspect ignored files or compressed archives.
- `brand-tokens.test.ts`: M00 regression check for canonical CSS/JSON token parity and the app copy.
- `validate_project_skills.py`: pre-existing project skill integrity validator. Read `SKILLS_SETUP.md`
  before using its optional discovery/setup modes; historical receipts are preserved.

M02 adds seed/account-resolution scripts. M07 adds evaluation scripts. No provider calls run here in M00.
