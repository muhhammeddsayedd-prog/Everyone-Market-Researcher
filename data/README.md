# Seed data

Exported from the competitor master sheet (Google Sheet `1z3q_g0-5hQpNOpdTvVhOR9UWdyOLdnWXpW_7QSfwNy4`, tab "Competitors", rows 7–290) on 2026-10-17. The sheet stays the owner's research workspace. After M02, **Supabase is the source of truth**, and new competitors are added in the app (Admin → Competitors).

| File | Rows | Columns |
|---|---|---|
| `competitors.csv` | 285 (284 competitors + Everyone Films baseline `C000`) | `company_id`, `slug`, `name`, `markets` (pipe-separated), `hq_country_guess`, `is_baseline`, `pilot_rank`, `priority_tier`, `categories` (pipe), `in_house_capabilities` (pipe), `logo_url`, the tracked platform URLs (`website`, `work_url`, `instagram`, `vimeo`, `youtube`, `linkedin`), reference-only URLs (`facebook`, `tiktok`, `behance`, `x_twitter`, `threads`, `snapchat`, `pinterest`, `dribbble`, `link_hub`, `news_blog`), `notes` (research cautions from the sheet), `sheet_row` |
| `competitor_accounts.csv` | 1,272 | `company_id`, `competitor_slug`, `platform` (website, website_work_page, instagram, vimeo, youtube, linkedin), `url`, `handle` (derived; verify in M02), `tracked`, `pilot` |
| `pilot_50.csv` | 50 | The pilot list in rank order (19 EG, 15 KSA, 16 UAE) with main links |
| `test_accounts.csv` | 25 | Five pilot accounts per platform, for dev testing of collectors |

Notes:
- Links the sheet marked "Not verified" are excluded (empty).
- Reference-only platforms are kept for context and are **never scraped** (D-07).
- `hq_country_guess` is the first market listed. The owner can correct it in admin.
- The `notes` column holds the research cautions written during verification (e.g. "Adjacent competitor category…"). Show them on the competitor's admin page.
- The baseline row was added by hand. It is not in the sheet.
- In the sheet, the Logo column (AC) shows `#REF!` until the owner clicks **Allow access** for external images. The logo URLs themselves (AD) are fine, and are what is exported here.
