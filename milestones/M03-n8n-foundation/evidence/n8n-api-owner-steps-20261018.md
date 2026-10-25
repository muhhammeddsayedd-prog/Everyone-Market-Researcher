# MA-11 — bounded n8n API inventory

The browser session is signed in and the upgraded 50,000 execution allowance is
verified. One project-list call after that changed state still returned MCP
`-32603 Internal error`. No password rejection or cause is established. Do not
repeat sign-in, change account security or reinstall MCP.

M03 T2 allows the official public API as the alternative connection. The new
consumer is read-only: at most **seven GET requests**, only to
`https://muhhammedsayed.app.n8n.cloud`, with strict TLS, public-address DNS pinning,
no redirects and a 60-second overall deadline. It projects canonical Market
Radar names/IDs and unrelated counts, never workflow bodies, credential values
or raw errors. It does not create, update, publish, run, test or delete anything.
Incremental provider spend is USD0; no provider endpoints are contacted.

## Current result — no new API-key action requested

The owner supplied the existing management key through the reviewed handoff.
The first attempt stopped before HTTP at DNS. A source-reviewed OS-resolver
correction passed a credential-free strict-TLS401/socket-close check. The next
keyed attempt authenticated: discovery and the actual Personal project list
returned200. The later workflow-list request failed at transport, so the full
inventory and credential-list resource remain unaccepted. Both consumed
handoffs were deleted and children closed. [Actual receipts](n8n-api-attempt-20261018.json)
and [DNS diagnosis](n8n-dns-boundary-20261018.json) preserve the distinction.
Do not ask for another key, login or credential recreation to rediscover that
unresolved transport failure. The four native provider probes and browser
credential metadata are separate, successful evidence.

## Existing helper reference — only when a reviewed continuation needs it

1. Open <https://muhhammedsayed.app.n8n.cloud/settings/api> (**Settings → n8n
   API**). The actual page shows **Create API key**. If you already have a valid
   API key saved for this exact instance, reuse that original; no rotation or
   reset is needed.
2. Otherwise choose **Create API key**, label **Market Radar M03 temporary**,
   set a short expiry (one day if offered; otherwise seven days), and create
   it privately. Save the original in your password manager. On the observed
   Pro plan, n8n keys are account-wide; the checked-in consumer constrains this
   operation to the fixed read-only inventory. Enterprise-only key scopes are
   not claimed. Do not send the key in chat or put it in a URL/config file.
3. In **Windows PowerShell under the same Windows account**, run:

   ```powershell
   & 'D:\Everyone\everyone Market Research\everyone-market-radar\scripts\n8n\windows\New-M03N8nApiHandoff.ps1'
   ```

4. Enter that **n8n API key** at the hidden prompt, not a database/provider
   password or token. Expected result starts **M03 n8n encrypted handoff saved.**
   Close the PowerShell window and reply **M03 n8n API handoff ready**. Keep your
   saved original; do not share ciphertext, keys or raw errors.

The helper writes only the new temporary same-account DPAPI file
`%LOCALAPPDATA%\Temp\emr-m03-n8n-api-key.dpapi` and refuses overwrite. After
public source-seal verification, a bounded child receives the key privately.
The consumer deletes consumed ciphertext and closes the child even on failure.
Only fixed projected receipts are returned. File presence is not authentication.
Earlier public seal checks found it absent. Later presence and actual private
consumption results are recorded above; do not overwrite those receipts with
the earlier absence claim.

## Reviewed boundaries

The local implementation passed 18 Node tests and 11 Windows synthetic process
tests, 29 total. Source review caught and fixed a response-reflected-key leak
and a version-specific credential project-reference mismatch before any real
key use. Root reran the six affected confidentiality/ownership/name-map tests:
all passed. The [local receipt](local-n8n-inventory-consumer-20261018.json) keeps
these results separate from actual API acceptance.

The source seal is `scripts/n8n/m03-inventory-seal.json`. A project-list 403 is
reported as its own capability result; it is not silently converted into a
successful project check or a password failure. Pagination is bounded and an
unfinished page set remains incomplete.

The reviewed 2.43.5 public API exposes workflow creation/update and publication,
but no manual workflow-execute route. This read-only step establishes available
capabilities and actual metadata only. Any later write consumer needs its own
reviewed packet, and live execution still needs the verified editor or a working
connector. No workflow activation or other-project access is inferred here.

Current official sources:

- [API authentication and key scope availability](https://docs.n8n.io/connect/n8n-api/authentication.md).
- [Pinned 2.43.5 public API implementation](https://github.com/n8n-io/n8n/tree/n8n%402.43.5/packages/cli/src/public-api/v1).
- [Pinned credential shared-project representation](https://github.com/n8n-io/n8n/blob/n8n%402.43.5/packages/cli/src/public-api/v1/handlers/credentials/credentials.utils.ts).
