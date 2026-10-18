# Strict PostgreSQL TLS in n8n Cloud

Public source review, 2026-10-18. No credential retry, trust-store change,
external support message, database connection or hosted setting change was
performed by this reviewer.

The root agent's actual native PostgreSQL credential test failed with a
self-signed-chain error. Its intended session-pooler port remains 5432. That
failure does not establish a password rejection or a successful restricted
connection. Keep the existing saved credential and password; recreating them
does not install a trusted root.

The observed native credential form has no CA field. The exact
[n8n 2.43.5 credential schema](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/nodes-base/credentials/Postgres.credentials.ts)
confirms that omission. Its
[Postgres transport](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/nodes-base/nodes/Postgres/transport/index.ts)
uses the saved host/database/user/password and SSL settings; it has no
per-credential CA input. Ignore SSL Issues true explicitly sets
`rejectUnauthorized: false`, which is not an acceptable resolution.

n8n's documented [custom CA mechanism](https://docs.n8n.io/deploy/host-n8n/configure-n8n/basic-configuration/configuration-examples/configure-custom-ssl-certificate-authorities)
requires a container-mounted public PEM under `/opt/custom-certificates`. It is
documented for hosted infrastructure controlled by the operator. No supported
self-service Cloud control for this CA was found. This absence does not prove
that n8n support cannot offer a managed solution. The official
[credential documentation](https://docs.n8n.io/integrations/builtin/credentials/postgres)
does not provide a Cloud CA upload alternative.

Supabase recommends certificate and hostname validation with its downloadable
CA; changing server SSL enforcement is not a client trust fix and can restart
the database. See [SSL enforcement and verification](https://supabase.com/docs/guides/platform/ssl-enforcement).
The current [changelog](https://supabase.com/changelog.md) and
[debugging index](https://supabase.com/docs/guides/monitoring-and-debugging)
were read; no applicable documented trust-control change was found in this
review. The existing project public certificate is already pinned:

```text
scripts/seed/certs/supabase-root-2021.crt
SHA256 700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7
```

## Researched contact path — owner declined

The owner replied **“Skip this contact path, not needed.”** No support/forum
contact is requested or will be sent. The public research below is retained as
historical context. Strict TLS remains a technical acceptance gate; declining
contact does not authorize changing SSL/Ignore SSL settings or prove identity.

Application: n8n Cloud, intended instance
`https://muhhammedsayed.app.n8n.cloud`, actual runtime 2.43.5. The official
[support guide](https://docs.n8n.io/contribute/where-to-get-help)
directs non-Enterprise technical questions to `https://community.n8n.io/`.
The declined, unperformed proposal would have used these public details:

> Can n8n Cloud configure a trusted public CA for an external PostgreSQL
> credential while keeping certificate-chain and hostname verification enabled?
> On runtime 2.43.5, our native Postgres credential uses SSL Require and Ignore
> SSL Issues off. Its session pooler is
> aws-1-eu-central-1.pooler.supabase.com:5432. The connection test reports a
> self-signed certificate in the chain. There is no CA field in the native
> credential. Supabase's official public CA is
> https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt
> with SHA256
> 700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7.
> Please provide a supported Cloud trust configuration or confirm that this is
> unavailable. We cannot disable certificate validation or share our password.

Historical expected non-secret result: documented Cloud instructions/support confirmation
for a strict trust configuration, followed by a fresh successful restricted
native connection with `current_user = n8n_writer` and
`session_user = n8n_writer` against the verified dev project. This is no longer
an owner action or readiness request. A support ticket alone would not close
AC2. No user message has been sent by this reviewer.

Do not turn Ignore SSL Issues on, use SSL Allow/Disable, change role passwords,
change the database's SSL policy, copy an administrator credential, expose the
private ops schema, or introduce a service-key HTTP bridge to bypass this gate.
A different connection architecture would be a separately reviewed change,
not equivalent acceptance of the current restricted Postgres credential.
