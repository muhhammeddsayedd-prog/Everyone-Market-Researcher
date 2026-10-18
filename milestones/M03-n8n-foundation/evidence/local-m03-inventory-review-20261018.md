# M03 read-only inventory review — 18 October 2026

Scope: independent source review of `scripts/n8n/inventory.mjs` and its synthetic
tests. No API key, DPAPI handoff, DNS request, authenticated request, workflow
execution or hosted mutation was used for this review.

The reviewer independently ran `node --test scripts/n8n/inventory.test.mjs`:
native exit0, **13/13 PASS**, no skipped tests. Those tests use local adapters;
they do not establish actual API access or the current hosted response schema.

The fixed instance origin and four GET-only endpoint families prevent a caller
from selecting another destination. Every DNS answer must be public; the native
request pins a screened answer while retaining the fixed hostname for TLS and
certificate verification. Redirects are refused. A single deadline, response-byte
limit and two-page-per-resource ceiling bound the read. The API key stays in the
request header, and errors are reduced to fixed classifications. Response
projection discards workflow nodes/pinned data, credential values and unrelated
names. Canonical credentials/workflows must include the intended project in
their `shared` metadata; duplicate canonical names fail closed.

One P2 confidentiality finding was reproduced and sent to root and the author:
a synthetic canonical credential response whose otherwise valid `id` equals
the supplied synthetic key passed the projection. The resulting JSON contained
that key. The reproduction emitted only `secretReflectedInProjectedOutput:true`,
not the marker or any real secret. **Resolved:** a bounded traversal rejects any
response string reflecting the request key before projection or cursor use.
The fixed failure clears all resource projections/counts and project verification.
The reviewer read this changed path and independently ran the four reflection
regressions plus the canonical-workflow inventory check:
`node --test --test-name-pattern="reflects|all25" scripts/n8n/inventory.test.mjs`
— native exit0, **5/5 PASS**. No unchanged full suite was rerun for that fix.

The earlier ten-name allowlist limitation is also resolved: all 25 canonical
foundation/stub names are now present, with a local cross-check against
`foundationWorkflowNames`. This remains an allowed metadata list, not evidence
those workflows exist. Credential project membership reads the documented
credential `shared[].id`; workflows retain `shared[].projectId`.

Final reviewed SHA256 values:

- `inventory.mjs`: `a964466ab6c33328c42b4e574384b9c7eb50840b24913514f999658a44c855af`.
- `inventory.test.mjs`: `01dca8a37823911319a14e4610013fcf5408f794aa226c838d427d03441295c7`.

No remaining P0/P1/P2 source finding in this inventory checkpoint. The author's
reported full 18-test result remains distinct from the reviewer's historical
13-test run and targeted five changed-path checks.

`authenticationVerified`, project readback, advertised endpoint capability and
actual create/update/run/export permission remain separate claims. In
particular, an advertised POST route is not an executed permission test;
`manualExecutionSupportedByReviewedPublicApi` remains false. A complete metadata
read is not actual workflow or credential acceptance. The new Windows handoff
wrapper is outside this checkpoint and requires its own review before use.
