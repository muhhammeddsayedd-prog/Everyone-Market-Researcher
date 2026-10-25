# M03 price review — 18 October 2026

Owner-reported tier: **Apify Scale**. Public list pricing is separate from an
account invoice, prepaid-credit balance or actual run usage. No actor was run.
The owner clarified that some supplied amounts were examples and tool costs
do not matter. Do not repeat that questionnaire or invent subscription fees.
Use Q-07's USD25/day steady-state alert default. Its hosted value stays150 until
the reviewed plan migration is applied and read back; it is not a spending cap.

The CLI generated `20261018035417_price_book_plan.sql`. It writes17 reviewed dated rows
covering nine approved actors and known start/add-on charges. On the retained
17October database, all17 historic M01 rows stay intact. Fresh replay can seed
those placeholders on18October or a later date, so guarded upserts replace only
recognized old-or-reviewed values at/after the review date; differing operator
prices/units fail closed. This prevents a later CURRENT_DATE placeholder from
shadowing the reviewed price. Seven actual rollback regressions cover retained,
same-day/future replay and price/unit/budget conflicts. No fixed monthly fee is inserted because its
actual amount/currency is unknown. `m03_price_verification` explicitly retains
incomplete fee/provider coverage; AC4 is not fully accepted from these rows.

| Approved actor / event | Scale USD / unit | Official page read |
| --- | ---: | --- |
| Instagram primary result | 1.90 /1k | https://apify.com/apify/instagram-scraper/pricing |
| Data-slayer story result / start | 1.83 /1k; 0.0005 /run | https://apify.com/data-slayer/instagram-stories-scraper/pricing |
| Igview story result / start | 5 /1k; 0.02 /run | https://apify.com/igview-owner/instagram-story-viewer/pricing |
| Louis story profile / start | 18 /1k; 0.08 /run | https://apify.com/louisdeconinck/instagram-story-details-scraper/pricing |
| Dltik Vimeo result / start | 0.50 /1k; 0.00005 /run | https://apify.com/dltik/vimeo-scraper/pricing |
| Website crawler compute | 0.16 /CU | https://apify.com/apify/website-content-crawler/pricing and https://apify.com/pricing |
| LinkedIn post / empty query / start | 1.75 /1k; 1 /1k; 0.00005 /run | https://apify.com/harvestapi/linkedin-company-posts/pricing |
| LinkedIn short/basic profile / query start | 2.50 /1k; 20 /1k queries | https://apify.com/harvestapi/linkedin-company-employees/pricing |
| YouTube video / date-range add-on | 2.60 /1k; 0.80 /1k | https://apify.com/streamers/youtube-scraper/pricing |

Website crawler is pay-per-usage. CU is not its entire bill: storage, data
transfer and any proxy charges can also apply. Capture actual authenticated
`usageTotalUsd`, not a compute estimate, in the smoke receipt. The one-page
Cheerio estimate must use bounded memory/time/retries before its run. No
unbounded timeout, residential proxy, AI/transcript/video-download add-on or
later collector operation is authorized by a price row.

Current list prices differ materially from the initial placeholders, including
Louis profile9→18 and Dltik video2→0.50. The old research remains historical.
The employees input page still names its enum `Short ($4 per 1k)` while its
pricing page lists Scale basic-profile2.50; its description equates Short with
basic information. Preserve the enum until the actual M05 actor schema/test,
and record both query-start and per-result charges. Do not enable Full/email
search. Source: https://apify.com/harvestapi/linkedin-company-employees/input-schema .

Goat's main page says “from0.50/1k”; its pricing subpage was inaccessible to the
reader. That is insufficient to verify its Scale/event/platform charges, so
the old0.55 row remains explicitly unverified. OpenAI model placeholders,
SerpAPI/Firecrawl plan rates and fixed monthly fees also remain unverified.
Later estimates must verify the relevant SKU first. No FX rate or zero-price
assumption is fabricated.

This document is source research. The migration now passed a local apply and
readback; [local database evidence](local-applied-db-20261018.json) is separate
from the research. It establishes no authenticated provider access, hosted
dev/prod migration, charge, paid run, hosted workflow or subscription change.
