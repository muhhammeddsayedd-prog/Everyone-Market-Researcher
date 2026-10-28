# Story source-contract fixtures

These three `instagram-stories-*` fixtures are **synthetic local contracts**, not
actor captures. They exercise identity, timestamp, privacy, ownership and ingest
behavior; they prove no live story availability, actor reliability or history.
No credentials, actor starts, storage uploads or seven-day comparison were used.

Current public source pages checked on 28 October 2026:

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
conflicting duplicate content. A missing row is not empty-success evidence. Only
the deliberately explicit `status:no_stories` plus `stories_count:0` synthetic
summary qualifies as a zero-item success; a real summary shape must be observed
and qualified before future live integration relies on it.

Normalizers preserve the input object without mutation but persist only an
allowlisted **public story projection** in `payload`. This narrows the generic
schema's descriptive untouched-payload convention: full profile objects, private
fields and video download URLs are not retained. Projected items keep `metrics:{}`
and `media_urls:[]`. Thumbnail URLs are limited lexically to HTTPS Instagram CDN
hosts; an actual downloader must still enforce public DNS, bounded bytes and no
redirects. Normalization never downloads media.

Numeric media PKs remain strings and share a cross-actor key. Missing numeric PKs
use the specified account/minute fallback, explicitly marked as collision-prone.
`bakeoff_rows` are comparison projections only: the future registered callback
must attach the owned run ID and capture day before any bake-off RPC. This local
slice does not implement shared callbacks, schedules or comparison execution.
