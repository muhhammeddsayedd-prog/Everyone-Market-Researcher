# Story source-contract fixtures

The three `instagram-stories-*/synthetic-contract.json` files are **synthetic
local contracts**, not actor captures. They exercise identity, timestamp,
privacy, ownership and ingest behavior; they prove no live story availability,
actor reliability or history. No credentials, actor starts, storage uploads or
seven-day comparison were used to create those synthetic files. Actual capture
files retain their own explicit actor/run/build/time provenance.

## Current input contracts — 29 October 2026

The current public API/OpenAPI build readbacks in
[`story-source-contracts-20261029.json`](../../../milestones/M06-collectors-stories-upkeep/evidence/story-source-contracts-20261029.json)
expose `usernames: string[]` for all three actors. The igview input accepts1–50
usernames. This supersedes the older singular-input README example below;
neither an example nor an input schema alone proves a successful source capture.
Actual fixture provenance, output shape, per-account attribution and source
limitations must come from the authorized manual captures. Synthetic files stay
labelled synthetic and never become native observations.

## Qualified real output — 29 October 2026

[`data-slayer/real-capture-20261029.json`](instagram-stories-data-slayer/real-capture-20261029.json)
records actual public run `T1A54M5kriDsFKnVM`, build1.0.32, for the three verified
story accounts. It contains12 Good People stories and explicit zero-story
summaries for Everyone and Bigfoot. The summary rows use `username`,
`status:no_active_stories`, `stories_count:0` and no story ID. Story rows use
`creator_username`; the summary-only username exception never repairs a story
whose authoritative owner field is absent. Actual nested mentions are
`reel_mentions[].user.username`, and `image_versions.items[]` is a real thumbnail
fallback shape. The normalizers preserve those public fields without full
mentioned profiles, video URLs or invented engagement metrics.

The capture is sanitized: CDN query strings/signatures were removed. These
fixtures qualify source contracts and attribution; they are not unexpired media
download capabilities or proof of hosted story ingestion. Actual source cost and
run timestamps remain in each fixture's provenance. Other actors and naturally
unavailable examples remain distinct evidence gaps until their own captures are
qualified.

[`Louis/real-capture-20261029.json`](instagram-stories-louisdeconinck/real-capture-20261029.json)
records actual public run `a6QclwQACLHDrgGcI`, build0.0.10. All12 returned Good
People story IDs match the other two captures. Its numeric `pk` values exceed
JavaScript's safe integer range, while `id` contains an exact string media ID.
The adapter derives identity only from that validated string. It ignores the
unsafe numeric alias only when its rounded bucket agrees, exposes
`unsafe_numeric_pk_alias_ignored_for_exact_string_id`, preserves original input,
and still rejects conflicting exact aliases, another numeric bucket or a missing
exact string ID. No precision is recovered from the lossy field. Louis returned
no explicit rows for Everyone or Bigfoot; both remain missing account evidence,
not accepted no-stories results. Its synthetic empty-row example remains
synthetic and is not proof that the live actor emits that shape.

[`igview/real-capture-20261029.json`](instagram-stories-igview/real-capture-20261029.json)
records actual public run `b2ORwCMqJZ7z8Ywri`, build1.0.16. Its12 Good People
story keys match the Data Slayer capture. It uses camelCase `storyId`, `takenAt`,
`takenAtISO`, `imageUrl`, `allImages` and
`storyBloksStickers[].mentionUsername`, rather than the legacy README's snake-case
projection. Its two observed empty rows use the complete tuple
`success:true`, `mediaType:none`, `storiesCount:0`,
`takenAtFormatted:No active stories`, an attributable `username` and no story ID.
The adapter accepts that exact success shape, rejects failed/private/error rows,
and rejects conflicting legacy/current ID or timestamp aliases. Both captures
contain image stories with mentions; no real video-duration or external-link
example has been established by these two runs.

## Historical public-page review — 28 October 2026

- [Data Slayer](https://apify.com/data-slayer/instagram-stories-scraper) claims
  public live-story collection without login/cookies. Detailed fields are from
  the checked-in17 October research and M06 specification; the public output page
  was not retrievable. Exact real output and no-stories summary remain pending.
- [igview](https://apify.com/igview-owner/instagram-story-viewer) documents a
  singular `username` input and a public story object. This conflicts with the
  earlier array-input specification; no launch INPUT is implemented or silently
  assumed here. Its displayed epoch/ISO timestamp example disagrees. Synthetic
  fixtures use consistent dates; supplied conflicting aliases fail closed.
- [Louis](https://apify.com/louisdeconinck/instagram-story-details-scraper/input-schema)
  documents a `usernames` array and claims no login. The raw-media field shape is
  from checked-in research/specification because current detailed output was not
  available. Plan suitability and native examples remain unproved.

`prepareStories*Results(rows, {accounts, now})` requires exact registered story
account UUID, competitor UUID, platform and handle. It rejects foreign or
conflicting ownership, invalid/future dates, source/login/challenge errors and
conflicting duplicate content. A missing row is not empty-success evidence. The
deliberately explicit `status:no_stories` plus `stories_count:0` synthetic summary
and the observed Data Slayer zero-story shape above qualify as zero-item successes
only for their attributable owner. A provider error, empty dataset or missing
account row does not become a no-stories observation.

Normalizers preserve the input object without mutation but persist only an
allowlisted **public story projection** in `payload`. This narrows the generic
schema's descriptive untouched-payload convention: full profile objects, private
fields and video download URLs are not retained. Projected items keep `metrics:{}`
and `media_urls:[]`. Thumbnail URLs are limited lexically to HTTPS Instagram CDN
hosts; an actual downloader must still enforce public DNS, bounded bytes and no
redirects. Normalization never downloads media.

Numeric media PKs remain strings and share a cross-actor key. Missing numeric PKs
use the specified account/minute fallback, explicitly marked as collision-prone.
`bakeoff_rows` are comparison projections only: the registered callback must
attach the owned run ID and capture day before any bake-off RPC. These pure
normalizers do not execute callbacks, schedules or comparison runs.
