# MA-09 — actual dev owner review

Environment: emr-dev / `zmotjsbzhzjvpelxvxlf`. Report observed: 2026-10-18T01:53:59.364Z.

285 competitors / 1,754 accounts. Vimeo202/202; YouTube121/128, zero pending, seven failed/invalid. Pilot YouTube10/11; the remaining pilot is **C283 Wonderful Productions**. Logos256/267 source copies plus baseline1; all257 copied objects had actual public-byte verification. No collected content or fixtures.

The raw report has72 reason rows. This list deduplicates them into **41 decisions: seven YouTube,23 website and11 missing-logo rows**. The17 no-source logos use the expected initials tile and are listed separately. Blank decisions remain pending.

Earlier prose incorrectly called C102 the pilot exception. Actual source and hosted tiers agree: C102/C245 are next wave; C283 is pilot. Input hashes, counts, gating code and approved request bounds have not changed.

## Exact owner action

Open this file or `milestones/M02-seed-data/evidence/ma09-owner-review-20261018.csv` in your editor. Fill `owner_decision` for each row, or reply in chat using company code + platform + one of:

- `fix: https://...` — provide the intended public account/page or replacement logo URL. YouTube must use a supported `@handle`, `/channel/UC...`, `/user/...` or `/c/...` form; identities are not guessed.
- `invalid` — mark or confirm the listed account/page invalid. The seven YouTube rows are already invalid; website flags are currently retained active/paused, so choosing invalid for a website requests a change. For C283 this alone does not satisfy the11/11 resolved pilot requirement; explicitly request a documented exception if there is no replacement.
- `ok` — accept the flagged website as retained with its observed reachability error, or accept the missing-logo initials fallback. An ok does not establish a successful HTTP check or YouTube resolution.

Batch replies are accepted, e.g. `All listed website flags: ok; all11 missing logos: ok`, plus a decision for each YouTube row. Read the linked rows first. Expected non-secret result: every row has an explicit decision. Then reply **MA-09 decisions ready**. Codex will record the decisions, apply reviewed overrides where needed and verify affected data; no new credential delivery is requested yet.

C283 needs a correct public YouTube URL to reach the existing pilot criterion. Six other YouTube rows need a correction or invalid decision. Production seeding and PR merge require later separate approval; this review does not start M03 or collection.

## YouTube — seven decisions

| Code / company                    | Platform | Public URL                                                                 | Observed reasons                                                                                                                  | Owner decision |
| --------------------------------- | -------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| C102 MultiVision Media Production | youtube  | https://www.youtube.com/mvmpro                                             | invalid_account; invalid_url: Platform URL/handle failed normalization; retained invalid for owner review; youtube_resolve_failed |                |
| C142 Gearbox Studios              | youtube  | https://www.youtube.com/@gearbox-channel                                   | invalid_account; youtube_resolve_failed; yt_not_found                                                                             |                |
| C218 Action Filmz Productions     | youtube  | https://www.youtube.com/c/actionfilmzstudiodubaiproductions_rentals_events | invalid_account; youtube_resolve_failed; yt_custom_url_unresolved                                                                 |                |
| C231 CityFilms Prod               | youtube  | https://www.youtube.com/user/cityfilmsbeirut                               | invalid_account; youtube_resolve_failed; yt_not_found                                                                             |                |
| C233 Create Production            | youtube  | https://www.youtube.com/@createproductiondxb5110                           | invalid_account; youtube_resolve_failed; yt_not_found                                                                             |                |
| C245 FTEN Productions             | youtube  | https://www.youtube.com/firstandtenproductions                             | invalid_account; invalid_url: Platform URL/handle failed normalization; retained invalid for owner review; youtube_resolve_failed |                |
| C283 Wonderful Productions        | youtube  | https://www.youtube.com/wonderfulprodbeirut                                | invalid_account; invalid_url: Platform URL/handle failed normalization; retained invalid for owner review; youtube_resolve_failed |                |

## Website flags —23 decisions

| Code / company                                    | Platform          | Public URL                                     | Observed reasons    | Owner decision |
| ------------------------------------------------- | ----------------- | ---------------------------------------------- | ------------------- | -------------- |
| C015 Maradona Films                               | website           | https://maradona.film/                         | unreachable_network |                |
| C018 Neutlex Media                                | website           | https://neutlex.com/                           | unreachable_network |                |
| C030 Spinzomedia LLC                              | website_work_page | https://www.spinzomedia.com/portfolio/         | unreachable_timeout |                |
| C036 Xact for Marketing Services                  | website           | https://www.xact-eg.com/                       | unreachable_network |                |
| C057 Al Zawiya Films Production                   | website_work_page | https://zawiyafilms.com/our-works/             | unreachable_timeout |                |
| C065 AWA Agency                                   | website           | https://awaagency.ae/                          | unreachable_network |                |
| C068 Video Panda                                  | website           | https://videopanda.io/                         | unreachable_network |                |
| C072 Social Garage Media Production and Marketing | website           | https://socialgarage.agency/                   | unreachable_network |                |
| C084 MBC Studios                                  | website           | https://www.mbc.net/en/corporate/about-us.html | unreachable_404     |                |
| C085 Arabia Pictures                              | website_work_page | https://arabiapictures.com/projects            | unreachable_404     |                |
| C100 FIVE COLORS inc                              | website           | https://fivecolors.com/en/                     | unreachable_400     |                |
| C104 Immersive Media Production                   | website           | https://www.imm-sa.com/                        | unreachable_network |                |
| C107 DESIGN MATTERS PRODUCTIONS                   | website           | https://dmproductions.tv/                      | unreachable_network |                |
| C113 STUDIOLENS                                   | website           | https://www.studiolens.co/                     | unreachable_network |                |
| C117 Dunia Production                             | website           | https://www.dunia.com.sa/                      | unreachable_network |                |
| C120 Creative Arrow Productions                   | website           | https://www.creativearrow.net/                 | unreachable_network |                |
| C134 CEMA Media Production Studio                 | website_work_page | https://cema.ae/case-studies/                  | unreachable_timeout |                |
| C137 Crow Productions                             | website           | https://www.crowproductions.tv/                | unreachable_network |                |
| C183 Fazaa Production                             | website_work_page | https://www.fazaa.sa/en/projects/              | unreachable_500     |                |
| C203 Proeffect                                    | website_work_page | https://www.proeffect.sa/work                  | unreachable_404     |                |
| C243 Film Dojo                                    | website           | https://www.thefilmdojo.com/                   | unreachable_timeout |                |
| C277 Urban Edge Films                             | website           | https://urbanedgefilms.me/                     | unreachable_404     |                |
| C277 Urban Edge Films                             | website_work_page | https://urbanedgefilms.me/commercials          | unreachable_404     |                |

## Missing source-logo copies —11 decisions

| Code / company                   | Platform | Public URL                                                                                                                              | Observed reasons | Owner decision |
| -------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | -------------- |
| C038 Privè Production House      | logo     | https://graph.facebook.com/PriveProductionHouse/picture                                                                                 | missing_logo     |                |
| C088 Hashtag Social Media Agency | logo     | https://hashtag-me.com/wp-content/uploads/2024/06/hashtag-logo-english.gif                                                              | missing_logo     |                |
| C089 Blackbird Fz-LLC            | logo     | https://blackbird.ae/images/logo-icon.png                                                                                               | missing_logo     |                |
| C106 Filim Productions           | logo     | https://i.vimeocdn.com/portrait/92379499_300x300                                                                                        | missing_logo     |                |
| C113 STUDIOLENS                  | logo     | https://i.vimeocdn.com/portrait/70324326_300x300.jpg                                                                                    | missing_logo     |                |
| C117 Dunia Production            | logo     | https://yt3.googleusercontent.com/Fd_YvjnKK69nj8UDGgBfjTSdzWa9ylCOV1IQZXsQUdecjYDr67DdABjpcHAOpHw7nocU4Er-LA=s900-c-k-c0x00ffffff-no-rj | missing_logo     |                |
| C137 Crow Productions            | logo     | https://i.vimeocdn.com/portrait/9131410_300x300.jpg                                                                                     | missing_logo     |                |
| C157 MTC Films                   | logo     | https://mtc-films.com/apple-touch-icon.png                                                                                              | missing_logo     |                |
| C211 TMP Company                 | logo     | https://tmp.com.sa/icon-192.png                                                                                                         | missing_logo     |                |
| C252 Lejion Media                | logo     | https://lejionmedia.com/wp-content/uploads/2025/05/Logo_Redesign-1.png                                                                  | missing_logo     |                |
| C262 Prodigious Middle East      | logo     | https://publicisproduction.com/wp-content/uploads/2025/09/PP-Logo.png                                                                   | missing_logo     |                |

## Expected initials fallback — no source logo

C008 SIERRA Production House, C013 Top Level Branding, C019 Cairo News Company, C032 Blue Studio for Voice Over & Dubbing, C065 AWA Agency, C066 Street Inc, C068 Video Panda, C075 TG Media Productions LLC, C078 Dubai Sound TV & Cinema Production, C082 Seven Production / NEP Middle East, C086 Muvi Studios, C087 Sirb Productions, C104 Immersive Media Production, C111 Dayim Entertainment, C141 Fixer Egypt, C195 Muthalth, C219 Air3 Creative

These17 entries are existing expected fallbacks, not failed uploads. An owner may provide a new logo later; no logo scraping or automatic retry is authorized by this list.
