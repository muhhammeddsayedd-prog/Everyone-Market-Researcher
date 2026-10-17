# Shared normalizers

Actor and API normalization begins in M04–M06. The executable plain JavaScript
helpers live in `n8n/normalizers/_common.js`, matching `docs/N8N_WORKFLOWS.md` §7,
so n8n Code nodes and the fixture tests exercise the same code.

Add shared TypeScript contracts here when those milestones need them. Actor
fixtures belong in `n8n/normalizers/fixtures/<actor>/`; M00 has no captured actor
outputs and performs no collection.
