# M02 provider and network source review

Reviewed 18 October 2026 (Cairo). This is documentation and local implementation
evidence. No Vimeo/YouTube account request, competitor reachability check, logo
download, actor, paid provider or collection call was made for this review.

## Vimeo

- [API reference overview](https://developer.vimeo.com/api/reference) identifies
  `https://api.vimeo.com`, `/users/{user_id}`, `/channels/{channel_id}` and
  `/groups/{group_id}`. Its showcase example is
  `/users/{user_id}/albums/{showcase_id}`.
- [Authentication](https://developer.vimeo.com/api/authentication) documents
  `public` for public member data. It distinguishes public-only unauthenticated
  tokens from authenticated tokens with public access. The implementation never
  requests private scopes, cookies or competitor logins.
- [Common formats](https://developer.vimeo.com/api/common-formats) documents bearer
  authorization, versioned Accept headers, field filtering, a custom identifying
  User-Agent and the album resource family `/albums`.
- [Rate limits](https://developer.vimeo.com/guidelines/rate-limiting) documents
  plan-dependent per-minute limits, remaining/reset headers and a datetime reset
  at the next window. No fixed numeric quota is assumed. A 429 stops requests;
  [Vimeo's help guidance](https://help.vimeo.com/hc/en-us/articles/12427783954065-Rate-limits)
  describes a cooldown up to one minute under normal conditions.
- The detailed user/channel/group task pages rendered as JavaScript-only shells;
  the album task page was inaccessible to the web reader. The official
  [Vimeo OpenAPI repository](https://github.com/vimeo/openapi) is archived and
  explicitly warns that its specification is stale. Obtaining the current spec
  requires an authenticated request and was not done during this review.

The implementation retains the milestone's `/users/{handle}` vanity and
`/albums/{id}` showcase request shapes, pending actual authorized public-token
verification. Current documentation does **not** establish those two lookup
forms as accepted. A response only becomes resolved after schema/URI validation;
an API failure is preserved. The numeric public profile form `user123` is mapped
to the documented user-ID endpoint `/users/123`, rather than treating `user123`
as a numeric ID. This is a local normalization correction, not a live provider
receipt. Vanity users stay vanity in the request until a valid canonical
`/users/<numeric-id>` response is returned. Unsupported lookup forms must be
reviewed; no public-page scraping or private endpoint fallback is added.

The resolver uses at most two concurrent Vimeo operations, three retries after
the first attempt, a shared rate cooldown and cancellable waits of at most 60
seconds per chunk. Resets beyond the bounded wait budget defer the account
instead of retrying early. HTTP 401/403, malformed payloads and transient errors
are distinct from a 404; only the latter marks the account invalid.

## YouTube

- [channels.list](https://developers.google.com/youtube/data/reference/rest/v3/channels/list)
  currently documents `GET https://www.googleapis.com/youtube/v3/channels`,
  exactly one identifying filter (`forHandle`, `id` or `forUsername` here),
  optional `@` in `forHandle`, `contentDetails`, a one-unit quota cost and
  `channelNotFound`/`channelForbidden` errors. The page reports an update on
  15 October 2026.
- [Channel implementation guidance](https://developers.google.com/youtube/data/guides/implementation/channels)
  documents the uploads playlist in `contentDetails` and ID/legacy username
  resolution. The script makes no `search.list` request or content listing.
- [Google API key guidance](https://docs.cloud.google.com/docs/authentication/api-keys-use)
  recommends the `x-goog-api-key` header and warns that query parameters expose
  keys in URLs. The implementation therefore uses that header on the single
  fixed Google API origin and refuses redirects, instead of the milestone's
  query-string example. This preserves the same API operation and quota.

A `/c/name` URL makes only the specified `forHandle=@name` attempt. A valid empty
200 response is reported unresolved/invalid; an HTTP failure, absent `items`,
malformed channel ID, missing uploads ID or multiple unexpected items is never
converted into an empty success. Authentication, quota and retryable failure
codes remain distinguishable for the orchestration layer to stop safely.

## Network boundary

[Node 24 HTTPS](https://nodejs.org/docs/latest-v24.x/api/https.html) supports the
native HTTPS request options used here, including a custom lookup. The
[DNS lookup API](https://nodejs.org/docs/latest-v24.x/api/dns.html#dnspromiseslookuphostname-options)
supports retrieving all address records. HTTPS uses the original hostname for
TLS verification while connecting to a validated pinned address. Every new
request/redirect validates every DNS answer, with private, loopback, link-local,
reserved and IPv4-mapped IPv6 addresses rejected. URL credentials, non-HTTPS,
nonstandard ports and cookie headers are refused. Response bytes, elapsed time
and redirects are bounded; errors expose only fixed categories.

The logo adapter may make one anonymous retry after a 403 using its explicitly
provided public competitor website origin as Referer. The network boundary
derives an origin-only header, discards paths/query data, rejects mismatched or
unsafe inputs and strips Referer on any foreign-origin redirect. This does not
introduce cookies, account authentication or a CAPTCHA/paywall workaround.

Website reachability follows only the same exact hostname or its bare/`www`
variant, revalidates each hop and uses HEAD with GET fallback for 405/501. Other
domain redirects are reported, not followed. Instagram and LinkedIn checks are
format-only and make no anonymous social requests. These are security/local
contracts; they do not establish live seed acceptance.
