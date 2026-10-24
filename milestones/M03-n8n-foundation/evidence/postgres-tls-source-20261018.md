# Postgres credential TLS source check

18 October 2026. Delegated source audit of pinned n8n 2.43.5 / Postgres2.7;
no credential read, connection test, query or configuration change occurred.

The [n8n transport](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/nodes-base/nodes/Postgres/transport/index.ts#L51-L82)
maps SSL Require with Ignore SSL Issues false to boolean `ssl:true` plus
`sslmode:'require'`. It does **not** explicitly set `rejectUnauthorized:true`.
Ignore SSL Issues true instead supplies `{rejectUnauthorized:false}`; that
weaker configuration is excluded from M03.

The pinned dependency chain (pg-promise11.9.1 → pg8.21.0) passes object
configuration to pg.Pool. The [pg connection parameters](https://github.com/brianc/node-postgres/blob/pg%408.21.0/packages/pg/lib/connection-parameters.js#L79-L88)
retain boolean SSL; this is not connection-string sslmode parsing. The
[connection implementation](https://github.com/brianc/node-postgres/blob/pg%408.21.0/packages/pg/lib/connection.js#L75-L91)
supplies the hostname and invokes Node TLS. Its
[ordinary defaults](https://nodejs.org/api/tls.html#tlsconnectoptions-callback)
verify certificates and hostnames. This supports strict verification under
normal defaults; it is not a receipt for the actual Cloud runtime's trust store.

No custom CA/certificate field is exposed or forwarded by the
[Postgres credential](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/nodes-base/credentials/Postgres.credentials.ts),
credential option types or transport. The
[Postgres2.7 declaration](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/nodes-base/nodes/Postgres/v2/actions/versionDescription.ts#L18-L24)
accepts only the `postgres` credential type. SSH private-key fields do not supply
a TLS CA. This agrees with the cancelled empty credential form's lack of a CA
control, including after selecting Require.

The actual restricted-role n8n credential connection test remains pending. A
TLS failure must be diagnosed without enabling Ignore SSL Issues or substituting
an administrator credential. Server `pg_stat_ssl` encryption alone does not
prove client certificate validation. No bridge, alternate architecture, global
trust-store change or lower validation setting is approved or implemented here.
