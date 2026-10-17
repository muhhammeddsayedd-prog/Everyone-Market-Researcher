# n8n-skills installation pending

Reviewed 17 October 2026. This directory is an integrity receipt, not an installed skill. `SKILL.reference.md` preserves the actual release manifest without enabling skill discovery.

Source: `haunchen/n8n-skills`, release `v2.22.0`, commit `1fe379099249d905e9bd7dfa212e65c8832153a8`. The unchanged 530,228-byte ZIP has SHA-256 `898eb84f09bc8f59535ee0d6b365e97b61a050ff9cfb77ce313a23ff890e4a6e`, matching GitHub's asset digest. The release documents n8n `v2.36.8`; this does not establish the owner's actual n8n Cloud runtime.

Before installation, M03 T1 must record the actual Cloud instance version and relevant node schemas/typeVersions and verify Cloud restrictions. Follow `milestones/M03-n8n-foundation/MILESTONE.md` and the existing MA-11 access procedure. Live schemas and restrictions take precedence over this static pack. Review and record any runtime/reference mismatch before promotion to `.agents/skills/n8n-skills`. This receipt grants no authority to query or modify a hosted instance, install community nodes, run workflows, or execute paid providers.

Static checks found 126 Markdown files, no executable/script/hook files, safe archive paths, and resolving main-manifest resource links. Four template links use bare YouTube video IDs and must be repaired or explicitly excluded from future installed-reference validation: `laHIzhsz12E`, `ROgf5dVqYPQ`, `PAmgrwYnzWs`, and `AzOgpdn8ngY`. Their precise files are recorded in `static-review.json`; replacing each destination with `https://www.youtube.com/watch?v=<ID>` is a future reviewable portability patch. The archive is unchanged.

The ZIP omits LICENSE and ATTRIBUTIONS.md. Both supplemental files here were fetched from the pinned commit. Templates contain examples involving platforms, media operations, messaging, community packages, and endpoints outside Market Radar's approved scope; retaining documentation does not authorize using those examples. One tutorial contains a JWT-shaped signed metadata fingerprint; the review identified it as template metadata, not a project credential, and did not print its value.

No generated application dependency, discoverable n8n skill, community node package, hosted workflow, schedule, provider call, or runtime-verification result was created by this receipt. See `n8n-review-summary.json` for the evidence boundary and hashes.
