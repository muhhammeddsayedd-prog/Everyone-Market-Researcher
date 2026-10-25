# Native provider credential compatibility — source review

Reviewed 2026-10-18. This is public source and schema evidence, not a successful
provider authentication receipt. No account endpoint, actor, dataset or stored
credential was read by this reviewer.

The reviewed runtime is n8n 2.43.5. Its HTTP Request node supports
`authentication: predefinedCredentialType`, `nodeCredentialType` equal to the
native credential type, and `credentials[thatType]` referring to the existing
credential ID/name. The picker requires the credential's `authenticate` handler.
This reuses n8n's stored credential internally; it does not require copying its
secret into Header Auth, node parameters, Variables or the repository.

Sources: [n8n HTTP Request documentation](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/),
[custom API operations](https://docs.n8n.io/integrations/builtin/custom-api-actions-for-existing-nodes/),
and the [2.43.5 description](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/nodes-base/nodes/HttpRequest/V3/Description.ts).

## Exact installed Apify release

The public npm artifact for `@apify/n8n-nodes-apify@0.6.10` was read in memory,
without installation or executing package code. Its npm SHA512 integrity passed.

| Public artifact fact | Value |
| --- | --- |
| Registry | `https://registry.npmjs.org/@apify/n8n-nodes-apify/0.6.10` |
| Repository commit | `8edec8b87b811c0e85286b6f56e0124c021e26b5` |
| Tarball bytes | 455580 |
| Tarball SHA256 | `2570a5bbd7f3b891918383abb48dbf29ec9384229ce5aa2825a2965d8515f69a` |
| Native credential type | `apifyApi` |
| Native node name/version | `apify` / 1 |

The [release credential source](https://github.com/apify/n8n-nodes-apify/blob/8edec8b87b811c0e85286b6f56e0124c021e26b5/credentials/ApifyApi.credentials.ts)
injects a Bearer header and exposes `authenticate`, so the native credential is
compatible with HTTP Request predefined authentication. The actual inventory's
credential type/ID remains the binding authority. A package-qualified node type
must not be substituted for a credential type.

The release's Legacy **Run actor** operation starts with `waitForFinish=0`, but
its node-level `waitForFinish` defaults to true and polls if left enabled. It
does not expose the ad-hoc webhook or `maxTotalChargeUsd` run options. Its
`customBody` is actor input, not run configuration. Its generic helper retries
429/5xx responses, including POST. Therefore the bounded async smoke should use
HTTP Request with the existing `apifyApi` credential, fixed Apify URLs,
`retryOnFail: false`, explicit async run options and no redirects. **Run actor
and get dataset** is not an async replacement. See the immutable
[actor executor](https://github.com/apify/n8n-nodes-apify/blob/8edec8b87b811c0e85286b6f56e0124c021e26b5/nodes/Apify/resources/executeActor.ts)
and [HTTP helper](https://github.com/apify/n8n-nodes-apify/blob/8edec8b87b811c0e85286b6f56e0124c021e26b5/nodes/Apify/resources/genericFunctions.ts).

## Credential probe safety and T3 deviation

Do not use `GET /v2/users/me` for this proof. Its documented private response
contains `data.proxy.password` in addition to private profile information. A
following Code-node projection would occur after the HTTP node had already
received that credential-bearing response. No such call was made. See the
[private user schema](https://docs.apify.com/api/v2/users-me-get).

Use authenticated `GET https://api.apify.com/v2/users/me/limits` instead. The
complete documented success schema contains only these containers:

- `data.monthlyUsageCycle`: `startAt`, `endAt` date-time strings.
- `data.limits`: numeric monthly usage/compute/transfer/proxy limits, actor
  memory/count/task/concurrency limits, seats and retention; optional schedule
  count.
- `data.current`: numeric usage, actor memory/count/task/active-job counts,
  seats and optional schedule count.

It documents 401 for missing/invalid authentication. The API recommends Bearer
authentication. No token, password, proxy credentials, profile or email field
is present in this response schema. This is a documented schema boundary, not
a guarantee about an unobserved future response. Validate required containers,
dates and finite nonnegative numeric types; expose only fixed authentication
and schema-validity booleans in evidence. Do not export the account's financial
metadata. Read the plan separately from the authorized console, not by private
user-info extraction. This changes the T3 test endpoint while preserving its
authentication purpose. See [Get limits](https://docs.apify.com/api/v2/users-me-limits-get)
and [API authentication](https://docs.apify.com/api/v2#authentication).

## Supported API path and callback boundary

HTTP Request can issue the required GET run, GET dataset items and async POST
actor run with this same credential. Use the documented current
`/v2/actors/{actorId}/runs` prefix; `/v2/acts/` is the supported legacy prefix
used by the installed node. Configure `waitForFinish=0`, explicit timeout,
memory, build, `restartOnError=false`, ad-hoc webhooks and a reviewed
`maxTotalChargeUsd`. Never place a token in the URL. See
[Run Actor](https://docs.apify.com/api/v2/actors-runs-post) and the
[legacy-prefix note](https://docs.apify.com/api/v2#legacy-v2acts-url-prefix).

Trust an authenticated run GET bound to the registered actor/run/account, not
callback-supplied dataset IDs, cost, status or EMR metadata. The wire terminal
status `TIMED-OUT` must be normalized explicitly to the SQL contract's
`TIMED_OUT`; webhook event spelling is not the wire status. Intermediate
statuses are not terminal. The first terminal GET may still contain preliminary
usage/cost. Wait approximately ten seconds, reread the same run, and require
stable final status/dataset/cost before the immutable atomic processing receipt.
No automatic POST retry is permitted after an ambiguous start. See
[Get run](https://docs.apify.com/api/v2/actor-run-get) and
[Get dataset items](https://docs.apify.com/api/v2/dataset-items-get).

## OpenAI and PostgreSQL boundaries

The pinned [OpenAI credential](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/nodes-base/credentials/OpenAiApi.credentials.ts)
has native type `openAiApi` and an authenticate handler. A fixed absolute
`GET https://api.openai.com/v1/models` with that predefined credential is
supported without a duplicated credential or a model invocation. The native
credential can also add an organization header and an optional custom header.
Before use, verify non-secret saved base-URL/custom-header enabled/name metadata
for the intended integration; do not inspect their private values. Disable
redirects and retain certificate verification.

The actual restricted PostgreSQL credential's first connection test failed
with a self-signed-chain TLS error, as reported by the root agent. No successful
PostgreSQL receipt is claimed here. The observed empty n8n PostgreSQL form has
no custom CA field. `SSL Require` plus `Ignore SSL Issues` off remains required;
do not set `rejectUnauthorized=false`, turn Ignore SSL Issues on, remove
hostname validation or use an administrator credential to get a pass. A
supported Cloud trust-chain solution is a separate access gate.
