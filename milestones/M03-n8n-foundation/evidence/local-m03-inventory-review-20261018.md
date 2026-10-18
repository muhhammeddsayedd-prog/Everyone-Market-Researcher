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

## Native credential reuse delta — independent follow-up

The later owner-authorized native credential mapping was independently reviewed
at these exact SHA256 values:

- `inventory.mjs`: `43279581d017003ff9deacdafe9914139aa9dcb2da1edb5aff1736e501539d01`.
- `windows/Invoke-M03N8nInventory.ps1`: `86d63ccf1707e34853bd5527d4a4f53630f65b61b067c315e8e42e337556e805`.
- `m03-inventory-seal.json`: `41a1fa59b7c55aa7b7e1624ea77cd92d391d1b678bd3161358b341ceea6dc405`.

Both layers select only the five explicitly authorized IDs and require their
exact observed name/type. JavaScript also requires the intended Personal share;
the PowerShell consumer validates the resulting fixed projection. The existing
native `apifyApi` and `openAiApi` credentials are not renamed, copied or treated
as generic Header Auth. An unrelated same-name ID remains unreported except in
the unknown count. Duplicate selected IDs, wrong type, wrong name or wrong
project fail closed. The fixed endpoint, GET ceiling, TLS/redirect safeguards,
private child environment, key-reflection rejection and cleanup are unchanged.

Independent targeted commands, all isolated synthetic responses/DPAPI only:

```text
node --test --test-name-pattern='known credential|authorized ID|duplicate authorized' scripts/n8n/inventory.test.mjs
3/3 PASS; native0; no skips
node --test --test-name-pattern='allfive|wrongNativeType|wrongCandidateName|wrongCandidateId' scripts/n8n/private-inventory.test.mjs
4/4 PASS; native0; no skips
```

No remaining P0/P1/P2 finding in this delta. These seven local checks do not
establish actual API authentication or provider credential acceptance. No real
API key, handoff, hosted request or credential value was used by this reviewer.

## OS DNS correction and public transport diagnostic

Independently reviewed `inventory.mjs` SHA256
`46b36ece01e294e221cb851c62127b720196fc3c82a560c9416ecb3aa5958acc`
and tests SHA256
`bae781d687b40e851f7731070b66ece1e51c3734f09be03e06c8de3b7b361709`.
The author's credential-free diagnosis observed c-ares resolution refused
while OS lookup succeeded in the same sparse environment. This establishes a
resolution-path difference, not the underlying DNS-server/firewall cause or a
bad API key. The prior keyed attempt issued zero HTTP requests.

The new fixed-host OS lookup requests all addresses and checks every returned
address against the existing public-address policy. Abort settles the local
wrapper and removes its listener; a late callback cannot settle it again or
start HTTPS. The OS getaddrinfo operation itself is not claimed cancellable.
The existing Windows consumer owns the process's outer lifetime. The native
request pins the first screened address, retains fixed hostname verification,
rejects unauthorized certificates, disables connection reuse and follows no
redirects.

The credential-free diagnostic shares that native request but has no API-key
header or private-file read. It returns only HTTP status, strict TLS verified
and socket-closed booleans, waiting for close rather than claiming it from
response completion. Its operation deadline is at most ten seconds plus at
most five seconds of close wait. An actual diagnostic subprocess also needs a
hard outer lifetime for uncancellable OS lookup. It does not establish API
authentication or workflow permission.

```text
node --test --test-name-pattern='M03 OS DNS adapter|M03 unauthenticated fixed discovery transport' scripts/n8n/inventory.test.mjs
11/11 PASS; native0; no skips; synthetic callbacks/HTTPS only
```

No remaining P0/P1/P2 finding in this change. No real lookup or HTTPS request
was performed by this reviewer. The separately authorized one unauthenticated
GET, if performed by the author, must be recorded as its own actual receipt.
See [Node 24 DNS semantics](https://nodejs.org/docs/latest-v24.x/api/dns.html#implementation-considerations)
for the OS lookup versus network resolver distinction.
