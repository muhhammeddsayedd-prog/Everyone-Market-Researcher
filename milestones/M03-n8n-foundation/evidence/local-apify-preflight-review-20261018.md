# M03 Apify preflight and native probe export review

Independent local/source review on 2026-10-18. No provider request, actor run,
credential read, workflow execution or hosted mutation was made by this
reviewer. This is not hosted acceptance.

## Source-only callback component

Reviewed SHA256:

| File | SHA256 |
| --- | --- |
| `packages/shared/src/n8n-apify-contracts.ts` | `c9e3bea2dbb45649433638073d109f919a74b169bea21f28dc2744bc4cf6161b` |
| `packages/shared/src/n8n-apify-contracts.test.ts` | `9457ef2590fdc296919370e16ac0a154ffae454c0916b3d93f95b3a906138582` |
| `n8n/foundation/build-apify-preflight.mjs` | `40da75089d9a13fe828f8fc823fac7075a4f63771f5ff7275b45d34fa4559eaa` |
| `n8n/foundation/build-apify-preflight.test.mjs` | `07733608e6aca0286c6f94f9780dfdb75aebc6ce9ef4b464ff69f9355cfcab3a` |

The callback boundary discards all notified context except the bounded run ID.
The native component first calls parameterized `ops.get_apify_run`, requires
the registered approved actor and single account, and stops before HTTP for an
unknown or already processed run. It constructs a fixed Apify run URL, reuses
native credentials, requires the exact trusted run/actor identity and measured
cost, and projects only the terminal contract. It maps wire `TIMED-OUT` to SQL
`TIMED_OUT` explicitly; nonterminal statuses and a missing cost fail closed.
Those fields and statuses agree with the actual M03 SQL processor contract.

The separate settlement validator requires matching samples at least ten
seconds apart, with an explicit upper bound. This is a source-tested heuristic,
not proof of a completed delayed read or a guarantee against later provider
financial adjustments. The native component honestly stops at its first
snapshot with `requiresDelayedReadback: true`.

The launch descriptor uses only the approved actor and owned public one-page
URL. Its POST is async, disables automatic retry/restart and carries explicit
caps/build/webhooks. It remains a descriptor with `spendAdmissionVerified:
false`, not a paid-start implementation. One review finding was corrected:
whitespace-only approval references are now rejected after trimming, with a
negative regression.

Independent checks:

```text
pnpm.cmd --filter @emr/shared exec vitest run src/n8n-apify-contracts.test.ts
25/25 PASS; native0
node --test n8n/foundation/build-apify-preflight.test.mjs
3/3 PASS; native0; no skips
```

Review compared the [current Get run](https://docs.apify.com/api/v2/actor-run-get)
and [async Run Actor](https://docs.apify.com/api/v2/actors-runs-post)
contracts and exact native credential sources recorded in
`native-provider-credential-compatibility-20261018.md`. No remaining P0/P1/P2
finding in this declared source-only slice. It is **not** a runnable WF-19 or
WF-99. Webhook response/audit, durable replay, actual delayed settlement,
dataset/Cloud normalizer execution, atomic persistence/finish, registration-race
recovery and durable spend admission remain expressly unimplemented gates.
Actor build, hosted price book and caps still need actual final-packet evidence.

## Five actual native credential probe exports

Read all five `n8n/workflows/M03-credential-probe-*.dev.json` files. Each has four
expected core nodes at the observed type versions, actual saved workflow ID,
`active: false`, empty `pinData`, no execution payload and credential references
containing only ID/name. Apify uses `apifyApi`, OpenAI uses `openAiApi`, Postgres
uses `postgres`, and Vimeo/YouTube use `httpHeaderAuth`. The HTTP method is
omitted in the actual export and uses the native GET default. The small fixed
metadata endpoints and output projection do not constitute content collection.

The local check found no password/key/token-bearing credential fields or secret
patterns. This is a bounded static check, not a mathematical guarantee that any
arbitrary future export is safe. Raw byte seals were recorded before root
formatting; the following SHA256 values cover `JSON.stringify(parsedExport)`
and therefore preserve semantic review across whitespace/BOM normalization:

| Service | Actual workflow ID | Semantic SHA256 |
| --- | --- | --- |
| Apify | `VWqYfGJiucGk2gmz` | `f69894366d6585d0da2b247d5bdc379f553ca0cf5e62e2035bda7a1a8a706549` |
| OpenAI | `5yarZdD8HDQylXZj` | `54998e70c52129a8c2d9f7427b714dd8e54f0f89bd348030dd712a743deda2b6` |
| Postgres | `nVfNNShAqM4RGE1t` | `c584e00052f905995b23639a4660a4b54392e36b57c724273ae998696d016821` |
| Vimeo | `ZtQiwRkF0Pz2SMf5` | `42d40b432e8c69505e8cac2e54e6164cf85bc8775fe77c9db1a32c823963ac9a` |
| YouTube | `Rk3CyP3tmx3lSxHT` | `2f3263b69f57af58adf1b47e553464ccc10fb1b98bb261ce1def88a6b471767d` |

The actual Postgres export retains its original projection, which missed the
native error's top-level message and returned `identity_rejected`. Its actual
native connection failed strict TLS; the root readback record preserves both
facts. The later local projection regression is not retroactively inserted
into that historical export and no successful Postgres login is inferred from
the workflow reaching its output node. The four provider authentication passes
are root-observed receipts in `credential-readback-20261018.json`, not requests
performed by this reviewer. Native exports are temporary probes, not the M03
foundation workflows or proof of later paid/async acceptance.
