# M03 — reuse existing dev credentials

Current result: four actual provider metadata GETs pass; writer saved port5432
is correct but strict native TLS fails. Both approved dev migrations are now
applied and verified; no further DB handoff or replay. Management API key
authenticated/Personal list200, then workflow transport failed; no new key
requested. All five credential probes were exported and recoverably archived.
The owner declined the researched contact path; do not request it again.

18 October 2026. Instance: https://muhhammedsayed.app.n8n.cloud ; Personal project `pHvQjDmjxVZ3KQLT`. Browser access, runtime2.43.5 and50K allowance are already verified. The owner's reuse instruction supersedes the earlier create-five instructions. Do not recreate, rename, rotate, duplicate or change shared credentials.

| Logical binding | Existing display name | Actual ID | Compatible type |
| --- | --- | --- | --- |
| Dev writer | Supabase Postgres · n8n_writer · dev | `3ZZtc9kMDcminv6w` | `postgres` |
| Apify | Apify account | `EYmaOt0rd45ysq0J` | `apifyApi` |
| OpenAI | OpenAI account | `e04LREfPBELWQQ9D` | `openAiApi` |
| Vimeo | Vimeo Token | `HeZBOZhFMeFYOC0N` | `httpHeaderAuth` |
| YouTube | YouTube Data API key | `ltvBSloVLGVeUjqV` | `httpHeaderAuth` |

IDs, names and Personal ownership were observed in the authenticated browser inventory/drawers. Native type strings are verified by actual saved probe exports and pinned source; the API credential-list resource was not attempted. Apify/OpenAI each show nine existing workflow references. Their saved secret fields were not revealed or copied.

## Postgres saved state

The actual saved credential has host `aws-1-eu-central-1.pooler.supabase.com`, database `postgres`, user `n8n_writer.zmotjsbzhzjvpelxvxlf`, port **5432**, maximum connections5, SSL **Require**, Ignore SSL Issues **off**, SSH **off**. No field/password was changed by Codex. One bounded Retry failed; private More details readback classified a **self-signed certificate-chain error**, without an observed network/endpoint or authentication rejection. This does not prove login identity. The actual native-node identity attempt is recorded separately in current credential evidence.

Preserve the writer password and security settings. No administrator/service credential, password reset or Ignore SSL workaround is permitted. The observed credential has no custom CA input. See [pinned TLS source review](postgres-tls-source-20261018.md); a Cloud trust-store resolution must preserve certificate/hostname verification and use the public Supabase root CA. No new password handoff is needed for this TLS problem.

## Provider compatibility and tests

Use HTTP Request4.5 **Predefined Credential Type** with `apifyApi` and `openAiApi`, whose pinned sources implement authentication. Never relabel native credentials as Header Auth or extract their tokens. Vimeo's public saved header name is `Authorization`; YouTube's is `X-Goog-Api-Key`. OpenAI's base URL is `https://api.openai.com/v1`, organization empty, Add Custom Header off. Shared Allowed HTTP Request Domains currently shows All; leave it unchanged and constrain Market Radar nodes to fixed HTTPS origins/no redirects.

Tests are bounded metadata GETs only: no actor, inference or embeddings. Apify `/v2/users/me` includes `proxy.password`, so the reviewed limits endpoint replaces it (explicit T3 deviation); projecting later would still expose a secret in the HTTP node's stored output. Keep saved configuration, actual endpoint success, account identity and budget evidence distinct. OpenAI access does not establish a project spend cap. Apify Scale is already owner-reported. Unknown fees stay unknown; preserve the documented USD25/day alert default and do not restart the billing questionnaire.

## Separate temporary handoffs

Both new M03 handoffs were present in fresh independent CheckOnly calls; provider credentials did not establish this.

- [Dev migration packet/helper](dev-migration-packet-20261018.md): two failures were reconciled; source-reproduced flag conflict fixed/reviewed. The corrected third attempt completed native0, exact nine-version parity and postchecks pass. All consumed handoffs deleted. Do not replay or request another DB password.
- [n8n API helper/GET-only bounds](n8n-api-owner-steps-20261018.md): DNS correction reviewed; actual key authentication/discovery and Personal list200 pass, later workflow transport remains incomplete. Both consumed key handoffs were deleted. Do not request another key or repeat a discovery/login loop without a reviewed reason.

Current results and genuine remaining actions belong in M03 PROGRESS. No sign-in, credential creation, old M01/M02 handoff, production, paid run or later integration is requested. Firecrawl, SerpAPI/email, app internal secret and prod credentials remain deferred. Notify remains log-only. Never send secrets or credential exports in chat.
