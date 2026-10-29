# M06 T1 manual source qualification — 29 October 2026

Owner authorizes these public-only fixture captures and local integration. No hosted ingestion, migration, media queue drain, schedule, email, production or merge.

## Admission and estimate

- Current qualified checkpoint `cf30b39` / CI40795882887, all five jobs and Vercel pass. Its final local progress receipt will be included with this substantive slice. Media component remains accepted/closed; all267 remaining media messages are preserved.
- Actual read-only dev selection: [three story identities](story-account-selection-20261029.json). Everyone is baseline; Good People/Bigfoot are pilot ranks1/2. All story rows are active, history not applicable. No fallback account needed at admission.
- Existing authenticated Apify account: Muhammed Personal; saved subscription **Starter monthly / Bronze** observed29October. Earlier user-reported Scale is not treated as the current billing observation. No upgrade or billing-control change.
- [Actual current public API/OpenAPI contracts](story-source-contracts-20261029.json): all three require only `usernames: string[]`; igview accepts1–50 unique usernames. No login/cookies input. Pin the observed build where native controls permit and verify actual build on completion.
- Target one manual run per actor for `everyone.film`, `goodpeoplefilms`, `bigfootfilms`:3 starts /9 account observations. Each run is finite (target180s, appropriate default memory, no automatic replacement); output read bounded to500 rows/2MiB. If a start is uncertain, reconcile its native run identity before any other start.
- Bronze estimated actor charges: data-slayer USD0.0005/start plus USD0.00217/result; igview USD0.03/start plus USD0.005/result; Louis USD0.09/start plus USD0.019/profile. At20 story rows each for the first two plus3 Louis profiles, nominal actor estimate USD0.3209. Actual counts may be higher/lower, summaries may bill as results, and memory-based startup units can differ. Finite operational charge caps are chosen at launch (Louis provider minimum USD1); these are settings, not new owner approval gates. Infrastructure/proxy/storage/transfer allocation remains unknown until run readback.
- No optional identical repeat merely to buy an unavailable example. A provider error is not no-stories. Stop/exclude any source requiring login, checkpoint, challenge or cookies. Do not download video/media bytes. Retain sanitized data and actual run/cost attribution outside hosted product ingestion.

## Actual captures

All three native runs succeeded and are terminal. The existing Starter subscription allowed Louis without an upgrade. All used the exact INPUT `{"usernames":["everyone.film","goodpeoplefilms","bigfootfilms"]}`. [Run receipt](story-capture-runs-20261029.json) records full timestamps, build IDs, options, billed events and dataset attribution.

| Actor | Native run | Build / build ID | UTC start–finish | Actual USD |
|---|---|---|---|---:|
| data-slayer | `T1A54M5kriDsFKnVM` | `1.0.32` / `LbkXerigrUUa2dxt6` | 01:04:57.479–01:05:07.717 | 0.03088 |
| igview-owner | `b2ORwCMqJZ7z8Ywri` | `1.0.16` / `jhZNplLsVKuGelTTm` | 01:11:13.452–01:11:41.278 | 0.19 |
| louisdeconinck | `a6QclwQACLHDrgGcI` | `0.0.10` / `4QpIiw2A9YDJ2aneN` | 01:15:54.148–01:15:59.929 | 0.109 |

Each run was limited to180 seconds. Native saved options required igview4096MiB (four startup units), Data Slayer1024MiB and Louis256MiB. Public metadata defaults did not establish these runnable native constraints. Charge options acknowledged0.50/0.50/1USD respectively. Provider-derived `maxItems`230/100/null is billing behavior, not an asserted INPUT/output limit.

- Data Slayer:14 rows, comprising12 Good People image stories and two explicit `no_active_stories` summaries for Everyone and Bigfoot. `image_versions.items` and nested `reel_mentions[].user.username` differ from the draft examples.
- Igview:14 rows, the same12 exact Good People story keys plus two explicit successful empty tuples (`mediaType:none`, `storiesCount:0`, `takenAtFormatted:No active stories`). Its current camelCase fields and sticker mentions are retained.
- Louis:12 Good People rows. Everyone and Bigfoot are omitted, so their observations remain **missing/unknown**, not no-stories or provider errors. The exact string `id` is authoritative; its numeric `pk` has already lost precision. The normalizer ignores that alias only when it agrees with the rounded form of the exact ID; other conflicts still fail.
- Combined:40 dataset rows,36 actor-story rows,12 unique story keys, seven verified account observations out of nine requested, four explicit empty observations and two missing observations. All stories are images; real video/duration and external-link examples remain unavailable. No further identical runs were purchased.
- No login, cookies, checkpoint or challenge was requested. Native optional developer-sharing prompts were not accepted. No media bytes were downloaded.

Data Slayer billed1×0.0005 +14×0.00217 =0.03088USD. Igview billed4×0.03 +14×0.005 =0.19USD. Louis billed1×0.09 +1 nonempty-profile result×0.019 =0.109USD. This last observed behavior differs from the draft assumption that every requested empty profile necessarily bills a result; it is not a general guarantee. **Incremental and cumulative M06 collection usage:3 starts /0.32988USD.** Additional read/transfer and shared infrastructure allocation remain unknown. The previously observed product ledger remains58 rows/1.355284USD; these manual fixture runs were not registered or ingested into hosted product history.

## Fixtures, implementation and qualification

The three `real-capture-20261029.json` files under `n8n/normalizers/fixtures/instagram-stories-*` retain public source-contract fields and exact provenance. URL query strings/fragments, credential/session/header fields and unnecessary mentioned-user details are removed. No private credential or media binary is committed. Bounded private provider-read children closed; raw responses were released and existing encrypted originals remain outside Git.

The [offline comparison](story-manual-comparison-report-20261029.md) counts each run's cost once and reports the missing Louis observations. One day/three accounts is **not** the seven-day/20-pilot comparison or an MA-16 actor decision.

Qualified locally:

-70 normalizer tests (53 synthetic and17 retained-real cases),14 comparison-report tests,12 generated native workflow tests and87 affected callback/collector tests.
-18 regular pgTAP suites/809 assertions;9 composed SQL/media cases, including the generated WF-12 → restricted SQL → authoritative callback → twelve story items/media messages path. External HTTP/DNS/Storage are mocked; the real Sharp codec and local PostgreSQL are exercised. Relative-time synthetic clones keep expiry tests deterministic without changing the captured fixture.
-60 focused media tests and19 CI-runner safety cases; complete22-version native generated-type parity; local native security/performance advisors each zero findings. TypeScript, lint and required changed-head CI are recorded in current progress.
- Registration barriers preserve account claims until all registered jobs settle. Callbacks before registration close cannot finish a parent early. Provider identity/options/INPUT and actual cost are verified; known actor IDs alone cannot acknowledge a launch. Replays do not reread providers, add cost/items or wake media.
- New story rows enqueue only in `media_stories`; generic `media` is unchanged. A finite native handoff dispatches WF-31 in batches of five after committed ingestion. Twelve new stories require three local mocked native child calls. Comparison/no-stories/replay paths do not wake it. Hosted routing and bindings remain uninstalled.

Pending migration22 `20261029005731_m06_story_collection_bakeoff.sql`, SHA256 `1811fef97bb381baa928583e4197725d56acc719d36079e54d211afd41fe578f`, is local only. All21 applied hosted versions,280 items and267 generic media messages are preserved. The owned local qualifier was removed and the original local14-version/10-item baseline restored. No hosted story ingestion, migration, upload, Preview/bypass or workflow setup occurred in this slice. Historical WF-12/WF-19 exports and denied M05 files remain unchanged.

The [single next development plan](stories-connected-dev-plan-20261029.md) names the remaining connected/native evidence and comparison operation. It is preparation, not execution authority.
