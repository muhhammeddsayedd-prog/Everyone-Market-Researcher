# Taxonomies

The lists the AI must choose from and the app filters by. Stored in `app.taxonomy_terms` (seed: `reference/sql/006_seed_taxonomies_settings.sql`, JSON: `reference/taxonomies.json`). Admins edit them in **Admin → Taxonomies**; WF-30 loads active terms at the start of every batch, so the next AI runs follow the new lists.

Rules:
- `code` is stable (snake_case) and is what the database stores; labels can change.
- The AI returns codes only. A value that fits nothing maps to `other`; the free text goes to `tags`.
- Arabic labels: a few are pre-filled; the rest are added in admin.

## industry

Client (brand) industry. Stored on `app.organizations.industry` for brands; items inherit it through the brand.

| code | label |
|---|---|
| `telecom` | Telecom |
| `banking_and_fintech` | Banking & Fintech |
| `insurance` | Insurance |
| `real_estate_and_construction` | Real Estate & Construction |
| `fmcg_food` | FMCG — Food |
| `fmcg_beverages` | FMCG — Beverages |
| `fmcg_home_and_personal_care` | FMCG — Home & Personal Care |
| `retail_and_e_commerce` | Retail & E-commerce |
| `automotive` | Automotive |
| `travel_airlines_and_tourism` | Travel, Airlines & Tourism |
| `hospitality_and_fandb_qsr` | Hospitality & F&B / QSR |
| `healthcare_and_pharma` | Healthcare & Pharma |
| `energy_and_utilities` | Energy & Utilities |
| `government_and_public_sector` | Government & Public Sector |
| `giga_projects_and_destinations` | Giga-projects & Destinations |
| `media_and_entertainment` | Media & Entertainment |
| `sports` | Sports |
| `technology_and_apps` | Technology & Apps |
| `education` | Education |
| `fashion_beauty_and_luxury` | Fashion, Beauty & Luxury |
| `logistics_and_delivery` | Logistics & Delivery |
| `ngo_and_charity` | NGO & Charity |
| `other` | Other |

## content_format

What kind of piece an item is. `app.items.content_type`.

| code | label |
|---|---|
| `tvc_brand_film` | TVC / brand film |
| `digital_film_online_video` | Digital film / online video |
| `social_reel_short_form` | Social reel / short-form |
| `story` | Story |
| `static_post_carousel` | Static post / carousel |
| `behind_the_scenes` | Behind the scenes |
| `corporate_documentary` | Corporate / documentary |
| `music_video` | Music video |
| `event_coverage` | Event coverage |
| `series_tv_feature` | Series / TV / feature |
| `animation_cgi_vfx_piece` | Animation / CGI / VFX piece |
| `ai_generated_piece` | AI-generated piece |
| `showreel` | Showreel |
| `hiring_company_news` | Hiring / company news |
| `other` | Other |

## occasion

Seasonal or campaign occasion. `app.items.occasion`, `app.campaigns.occasion`.

| code | label |
|---|---|
| `ramadan` | Ramadan |
| `eid` | Eid |
| `saudi_national_day` | Saudi National Day |
| `saudi_founding_day` | Saudi Founding Day |
| `uae_national_day` | UAE National Day |
| `egyptian_national_occasions` | Egyptian national occasions |
| `back_to_school` | Back to school |
| `summer` | Summer |
| `product_launch` | Product launch |
| `always_on` | Always-on |
| `other` | Other |

## competitor_category

What a competitor does (multi-select, from the sheet column "Category"). `app.competitors.categories`.

| code | label |
|---|---|
| `production` | Production |
| `film_and_tv` | Film & TV |
| `post_production` | Post-production |
| `vfx_cgi` | VFX / CGI |
| `animation_motion` | Animation / Motion |
| `photography` | Photography |
| `digital_and_social` | Digital & Social |
| `production_services` | Production services |
| `events_and_experiential` | Events & Experiential |
| `creative_agency` | Creative agency |
| `equipment_and_studio_rental` | Equipment & Studio rental |
| `ai_production` | AI production |
| `sound_and_music` | Sound & Music |

## credit_role

Role of a credited person or company. `app.item_credits.role`.

| code | label |
|---|---|
| `director` | Director |
| `co_director` | Co-director |
| `executive_producer` | Executive producer |
| `producer` | Producer |
| `line_producer` | Line producer |
| `production_company` | Production company |
| `service_company` | Service company |
| `director_of_photography` | Director of photography |
| `editor` | Editor |
| `colourist` | Colourist |
| `vfx_supervisor` | VFX supervisor |
| `vfx_cgi_studio` | VFX / CGI studio |
| `post_production_house` | Post-production house |
| `sound_design_and_mix` | Sound design & mix |
| `music_composer` | Music / composer |
| `production_designer` | Production designer |
| `art_director` | Art director |
| `stylist` | Stylist |
| `make_up_and_hair` | Make-up & hair |
| `casting` | Casting |
| `talent_cast` | Talent / cast |
| `choreographer` | Choreographer |
| `animator_motion_designer` | Animator / motion designer |
| `ai_artist` | AI artist |
| `photographer` | Photographer |
| `agency` | Agency |
| `creative_director` | Creative director |
| `copywriter` | Copywriter |
| `agency_producer` | Agency producer |
| `client_brand` | Client / brand |
| `other` | Other |

## in_house_capability

What a competitor has in house (sheet column "In-house capabilities"). `app.competitors.in_house`. One-off values in the sheet (e.g. "Podcast studios", "Drone pilot training") are mapped to the closest code during seeding, or to `other` with the original text kept in `app.competitors.notes`.

| code | label |
|---|---|
| `creative_and_scriptwriting` | Creative & scriptwriting |
| `directors_roster` | Directors roster |
| `line_production` | Line production |
| `casting` | Casting |
| `locations_and_permits` | Locations & permits |
| `camera_and_lighting_kit` | Camera & lighting kit |
| `studio_soundstage` | Studio / soundstage |
| `drone_aerial` | Drone / aerial |
| `set_design_and_art_dept` | Set design & art dept |
| `editing` | Editing |
| `colour_grading` | Colour grading |
| `vfx_cgi` | VFX / CGI |
| `3d_and_animation` | 3D & animation |
| `motion_graphics` | Motion graphics |
| `sound_design_and_mix` | Sound design & mix |
| `music_composition` | Music composition |
| `voice_over_dubbing` | Voice-over / dubbing |
| `subtitling_and_localisation` | Subtitling & localisation |
| `ai_generation` | AI generation |
| `virtual_production_led` | Virtual production / LED |
| `photography` | Photography |
| `live_streaming_broadcast` | Live streaming / broadcast |
| `social_media_management` | Social media management |
| `media_buying_distribution` | Media buying / distribution |
| `film_distribution` | Film distribution |
| `other` | Other |
| `not_stated_on_own_site` | Not stated on own site |

## Fixed enums (database types, not editable in admin)

| Type | Values |
|---|---|
| platform | vimeo, instagram, instagram_stories, website, website_work_page, linkedin, linkedin_employees, youtube, news |
| country | EG, KSA, UAE, OTHER (briefs count OTHER as EG — D-06) |
| item_type | video, post, reel, carousel, story, project_page, linkedin_post, news_article, award_entry |
| priority_tier | baseline, pilot, next_wave, adjacent (sheet: Baseline, A · Pilot, B · Next wave, C · Adjacent) |
| org kind | brand, agency, post_house, media, other |
| ai_status | pending, processing, published, review, skipped, failed, duplicate |
