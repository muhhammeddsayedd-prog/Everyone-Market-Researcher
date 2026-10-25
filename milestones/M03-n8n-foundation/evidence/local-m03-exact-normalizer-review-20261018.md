# M03 exact-page normalizer review

Independent source/local review on 2026-10-18. No browser execution, provider
request, fixture capture, database write or credential access was performed by
this reviewer.

The root's actual Cloud probe found the general normalizer's `URL` dependency
unavailable while crypto and the common helpers worked. This is a reported
actual-runtime boundary, not something inferred from local tests. The general
parser is preserved; the new adapter supports only the owned M03 smoke page.
Current [n8n Code documentation](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.code/#external-libraries)
documents crypto and moment in Cloud, rather than arbitrary module imports.
No parser shim, new dependency, module enablement or security setting is added.

Reviewed SHA256:

| File | SHA256 |
| --- | --- |
| `n8n/normalizers/smoke_website_stub.js` | `e68644fb2d5634f61152a01a132e61d97951c7fa46aa354a0f71a44a0f9adf50` |
| `n8n/normalizers/smoke_website_m03.js` | `fad4505d4a3ed21a879800c07d4ca2c86c6ef3c140dda0b9a17b773a44c6cbdf` |
| `n8n/normalizers/smoke-website-m03.test.ts` | `521531cdeeeb7ae461c256536e75c877b40f6ed41467d7e51ce0d4a22e6ddc51` |

The new factory binds the three trusted shared helpers explicitly. It validates
the existing row shape, then accepts `row.url` only when it is exactly
`https://everyone.film/about-everyone`. Associated loaded/referrer/canonical
URLs may be absent, null, empty, or one of these three literal values:

- `https://everyone.film`
- `https://everyone.film/`
- `https://everyone.film/about-everyone`

Every other value fails before snapshot construction. Therefore a query,
fragment, userinfo, port, whitespace/control, encoding, host/path case change,
alternate domain or trailing about-page slash cannot become an alternate
identity through parsing or normalization. There is no broad fallback URL
grammar. The associated URL fields never replace the requested identity.

The general canonicalizer body and validation order are unchanged. Its row
guard and snapshot mapper were factored into named pure helpers; the adapter
uses the identical bounded Unicode title/Markdown logic, crypto SHA256 identity,
ten required normalized keys including `metrics: {}`, and minimal public payload.
These agree with the actual M03 atomic SQL processor's exact about-page/hash
checks. No request/header/cookie/unknown actor fields enter the snapshot.
The existing generic synthetic fixture is unchanged; the new tests override
its query-bearing requested URL in memory for the narrower contract.

Independent command:

```text
pnpm.cmd exec vitest run --project normalizers n8n/normalizers/smoke-website-m03.test.ts
21/21 PASS; native0
```

This includes the actual pasted function-declaration composition in a VM
without URL/module globals and with only crypto access. The relative CommonJS
import/export block is excluded from that Cloud composition. The author's
reported retained 103 generic checks also passed, for 124 total, but those are
separate from this reviewer's 21 targeted checks. No unchanged full suite was
rerun by this reviewer.

No remaining P0/P1/P2 finding within this exact-page adapter. The reviewed source
is suitable for the separately authorized single non-network Cloud Code check.
That future receipt must remain distinct from these local results. Passing this
adapter does not establish generic URL parsing, `prepare_ingest_groups` Cloud
support, real actor-output capture, ingestion, callback replay or full WF-19 /
WF-99 acceptance. The general ingest helper still depends on `URL`; no claim
that this small adapter resolves that separate boundary is made.
