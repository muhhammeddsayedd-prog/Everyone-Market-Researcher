# M03 native API contract audit — 19 October 2026

This is a public-source and local-code audit against **n8n 2.43.5**. It is not
another authenticated n8n read, a Cloud save receipt or live acceptance. The
existing `44cc22` result remains the actual partial checkpoint: 25 owned inactive
shells, seven saved tags and one unresolved eighth tag POST. No Machine credential
or complete foundation definitions were saved in that attempt. No credentials,
private store or instance endpoints were read for this audit.

## Native constraints found before further credential delivery

| Operation | Pinned native requirement | Reviewed source response |
| --- | --- | --- |
| Create tags | The persisted tag name is trimmed and has a 1–24 character limit. The public controller maps every save exception to HTTP 409, so the observed status does not establish the exact cause. | Preserve the original 15 journal rows and seven IDs. Keep logical tag keys; use the explicit three native labels below. A complete bounded GET scan precedes a distinct replacement intent. |
| Create Machine credential | Public credential IDs contain at most 16 letters, digits, underscores or hyphens. Credential names have a 3–128 character entity constraint. | Use `EmrM03Machine19`, replacing only the known earlier public metadata ID `EmrFoundationMachine19` before any credential intent. Preserve the same encrypted pending Machine token. |
| Save graph content | The public update query defaults to publishing changed content when a workflow is already published. Its service call uses a forced save. | Every owned graph PUT has literal `?publishIfActive=false`. No activation/publication endpoint is admitted. |
| Save Webhook/Wait nodes | Saving nodes whose type declares webhooks adds a random routing ID when it is absent. Both pinned Webhook 2.2 and Wait 1.1 declare webhooks, including the time-interval Wait configuration. | The final foundation compiler supplies deterministic routing IDs for these two nodes, preserving strict saved-node comparison. |
| Change `settings.errorWorkflow` | A newly changed target must be readable, published, contain an enabled Error Trigger and satisfy its caller policy. Its unpublished draft is insufficient. | Inactive native staging omits only the expected WF-90 reference from 24 graphs. Canonical source retains those references. Saved-stage metadata records both hashes, the deferred target and `canonicalParity:false`. |
| Publish a parent with static database sub-workflows | Enabled Execute Workflow references must point to published targets. Production execution independently enforces this constraint. | Future live approval must cover dependency publication in order, including SUB Notify before WF-90. Current inactive delivery does not publish these dependencies or prove native error routing. |

Explicit native tag labels:

| Logical key | Saved native label |
| --- | --- |
| `platform:instagram_stories` | `platform:ig_stories` |
| `platform:linkedin_employees` | `platform:li_employees` |
| `platform:website_work_page` | `platform:web_work` |

The other ten native names are unchanged. An ambiguous replacement POST is never
replayed. A prior intent is reconciled by GET; an unexpected old long name,
changed saved ID, incomplete scan or unresolved replacement blocks further
mutation. Tags are reused by known label and ID, not renamed or deleted.

## Credential and wire-format compatibility

`httpCustomAuth` is a supported native generic credential type. Its `json` field
contains the private header configuration. The native loader injects the domain
restriction fields into this type before API schema validation: the source uses
`allowedHttpRequestDomains: domains` and the exact selected Preview hostname in
`allowedDomains`. This does not extract or duplicate an existing provider token.
The consumer still checks the actual credential schema before creating the one
owned Machine credential. A metadata GET proves ID/type/time, while the original
scoped create request establishes intended Personal-project provenance.
The pinned credential POST declares HTTP 200 and returns the same allowlisted
public metadata mapper as GET by ID. That mapper includes identity, type, flags
and timestamps, with optional description; it excludes `data`. The consumer's
200-only create check and rejection of any own `data` field match this source
contract rather than assuming a generic HTTP 201 creation response.

Graph PUT bodies contain only `name`, `nodes`, `connections` and `settings`. Tag
bindings use the separate native tag PUT with an array of `{id}` objects. The
source retains the four execution-data retention restrictions, Cairo timezone,
same-project caller policy, `availableInMCP:false`, disabled actor start and
inactive/unpublished readback assertions. No defaults or unsafe behavioral flags
are silently accepted to make saved comparison pass.

The pinned update service merges stored settings, then removes documented
`DEFAULT` values, a timeout equal to the instance default, and an empty credential
resolver ID. Its public GET returns stored settings without adding defaults.
The DTO removes submitted binary-mode/resolver settings; it does not universally
inject binary mode or MCP availability. The actual instance's global timeout is
not established by this source audit. Any unexpected saved-setting difference
still stops at strict comparison rather than being silently normalized.

Local wire-format projection used the actual public workflow references and
**synthetic tag IDs for all 13 tags**. The actual bindings correctly retain only
the seven completed tags, so building from that partial file alone stops at the
missing-reference check. The synthetic static projection passed for 25 graphs
and 277 nodes: maximum workflow name 45 characters, largest staged body 222,607
bytes, and exactly 24 deferred error-workflow references. This is below the
consumer's 480,000-byte body limit and does not establish actual server defaults,
permissions, node execution or saved definitions.

## Targeted local verification and independent review

- Routing-ID regression: meaningful RED `3d3874`, then 15/15 graph/completion
  cases passed (`499da5`). Targeted ESLint and diff checks passed (`b92c5a`).
- Updated tag/staging/transport paths: independent read-only review found no
  remaining P1/P2 issue in the frozen patch; 27/27 isolated Node cases passed
  (`245c88`). The local fake API serializes actual generated bodies, enforces the
  native tag-length boundary and exact draft-only graph query, and verifies
  GET-only resume. It is not an authenticated native API test.
- Pending Machine identity correction: independent review and 21/21 isolated
  Windows cases passed (`bfc5f2`). These verify the fixed repository journal,
  exact old metadata binding, unchanged synthetic DPAPI bytes, durable two-row
  transition and fail-closed partial/ambiguous stores. They do not consume the
  real pending Machine store or Management handoff.
- Durable export review caught a P2 before private use: a short write could
  publish incomplete JSON or permit a subsequent mutation after an incomplete
  journal intent. The corrected common full-write loop and flush precede every
  journal return; exports also compare pending bytes before atomic publication.
  Final independent nine-case review passed with no skips (`d35877`); the
  original injected short-write fault now produces complete JSON (`567be0`).
  Actual Windows dangling-link, secret-reflection-before-write, partial export
  and ambiguous-next-PUT preservation checks pass. No P1/P2 remains in that scope.
- Actual public reseal/CheckOnly `f54a68`/`ee76d2` passed native0:33 project
  inputs,840 physical pinned dependency files, no private read/network and no
  Node execution during sealing. This is workstation readiness, not a Cloud
  save, credential authentication or live acceptance.

[Local verification receipt and source hashes](local-native-compatibility-20261019.json)
keep these local checks distinct from the actual partial hosted delivery.

## T5–T10 acceptance qualifications

T5's five SUB graphs, T6's WF-90, T7's WF-19, T8's WF-00/stubs, and T9's WF-91/
WF-99 remain functional **canonical source** with targeted local tests. Inactive
native staging deliberately defers the 24 Error Workflow settings; it is not
complete saved canonical parity, automatic Error Trigger acceptance, callback
acceptance, actor smoke acceptance or health acceptance. T10 exports may claim
only their actual saved staging profile and deferred bindings after verified
native readback. None of these tasks is closed by this source audit.

The final bounded live packet must separately identify the exact published
dependency set/order, install the 24 deferred links while WF-90 is a usable
published target, verify native automatic Error Trigger behavior, and remove the
temporary publications after the approved window. No such action occurred here.
GW-01 remains closed; production, merge and M04 remain untouched.

## Primary sources

All links below are official source pinned to the installed runtime version.

- [Tag entity, persisted length and validation](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/%40n8n/db/src/entities/tag-entity.ts),
  [tag service, trim and entity validation](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/cli/src/services/tag.service.ts),
  [public tags controller, 409 mapping](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/cli/src/public-api/v1/controllers/tags.public.controller.ts).
- [Create credential DTO, ID constraint](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/%40n8n/api-types/src/dto/credentials/credential-public.dto.ts),
  [credential entity, name constraint](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/%40n8n/db/src/entities/credentials-entity.ts),
  [native Custom Auth type](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/nodes-base/credentials/HttpCustomAuth.credentials.ts),
  [domain restriction fields](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/workflow/src/credential-domain-restrictions.ts),
  [native loader injection](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/cli/src/load-nodes-and-credentials.ts#L540).
- [Credential POST200 and secret-free public mapper](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/cli/src/public-api/v1/controllers/credentials.public.controller.ts#L188).
- [Public graph/node/settings DTO](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/%40n8n/api-types/src/dto/workflows/base-workflow-public.dto.ts),
  [graph update query](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/%40n8n/api-types/src/dto/workflows/update-workflow-query.dto.ts),
  [public workflow controller](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/cli/src/public-api/v1/controllers/workflows.public.controller.ts),
  [tag binding DTO](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/%40n8n/api-types/src/dto/workflows/workflow-tags-public.dto.ts).
- [Update settings merge and documented cleanup](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/cli/src/workflows/workflow.service.ts#L627),
  [settings cleanup helper](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/cli/src/workflow-helpers.ts#L209).
- [Webhook-ID save normalization](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/workflow/src/node-helpers.ts#L1175),
  [Webhook description](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/nodes-base/nodes/Webhook/Webhook.node.ts),
  [Wait description](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/nodes-base/nodes/Wait/Wait.node.ts).
- [Error workflow write validation](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/cli/src/workflows/error-workflow-validation.service.ts),
  [published sub-workflow validation](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/cli/src/workflows/workflow-validation.service.ts#L616),
  [same-project caller policy](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/cli/src/executions/pre-execution-checks/subworkflow-policy-checker.ts).
