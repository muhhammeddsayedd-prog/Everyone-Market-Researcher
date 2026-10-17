# Open questions and working assumptions

Questions the owner hasn't answered yet. Each has a **default** that Codex follows until the owner decides; the default never blocks work. When the owner answers, move the answer to `docs/DECISIONS.md` → Changes and strike the row here.

| # | Question | Default Codex uses | Needed by |
|---|---|---|---|
| Q-01 | Should any `@everyone.film` Google account be able to join as viewer, or invite-only? | Invite-only (domain switch off) | M09 |
| Q-02 | Arabic UI locale in v1? | English UI, Arabic-ready content; Arabic UI is a later option (FR-W18) | M15 |
| Q-03 | Email provider: Resend or Google Workspace SMTP? | Resend with a verified subdomain | M13 |
| Q-04 | Production domain (e.g. `radar.everyone.film`)? | Vercel default domain until set | M15 |
| Q-05 | Which LinkedIn employee data is acceptable to store? | Public name, headline/title, location, public identifier only; no photos, emails or contact data; `profileScraperMode` Short | M05 |
| Q-06 | "Big launch" rule for instant alerts | A pilot-tier competitor + `tvc_brand_film` or `digital_film_online_video` + a confirmed brand with ≥ 2 items in 7 days, or any baseline-competitor client poached (brand last seen with Everyone Films) | M13 |
| Q-07 | Daily budget limit for the budget alert | USD 150/day during backfill, USD 25/day steady state (matches `docs/SCRAPING_SOURCES.md` §8; owner to confirm) | M03 |
| Q-08 | Stories cadence: once or twice a day? | Twice a day if the pilot shows that the 24h window misses stories; else once | M06 |
| Q-09 | Run Instagram `reels` as a separate daily run in addition to `posts`? | Yes during the pilot; drop it if overlap with posts is ≥ 95% | M04 / M12 |
| Q-10 | Should competitor logos be copied into Storage (stable) or hot-linked from their sites? | Copy into Storage in M02 (thumbnail-size), keep the source URL | M02 |
| Q-11 | Who besides the owner gets the weekly brief email? | Owner only until invited users opt in under Settings → Alerts | M13 |
| Q-12 | Supabase region | Same region for dev and prod, closest to Cairo/Riyadh offered by Supabase (check `me-central-1`, else `eu-central-1`) | M01 |
