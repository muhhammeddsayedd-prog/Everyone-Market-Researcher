-- LOCAL WEB E2E FIXTURES ONLY. Labelled test data for the isolated web e2e stack
-- (apps/web/e2e/support/stack.mjs). Never applied to dev or production. Company names say
-- "Fixture" so screenshots can never be mistaken for business records.

-- Invites: the auth trigger turns these into memberships when the test users are created.
insert into app.member_invites (email, role) values
  ('member@e2e.test', 'viewer'),
  ('admin@e2e.test', 'admin'),
  ('disabled@e2e.test', 'viewer');

-- Baseline (pinned first) with a stored logo uploaded by the stack script.
insert into app.competitors (id, company_code, slug, name, name_ar, markets, hq_country, categories, in_house,
  logo_path, website_url, priority_tier, is_baseline, notes)
values ('e2e00000-0000-0000-0000-000000000000', 'C000', 'fixture-baseline', 'Fixture Baseline Films',
  'أفلام التجربة', '{EG,KSA,UAE}', 'EG', '{production,film_and_tv}',
  '{directors_roster,line_production,editing,colour_grading,social_media_management,not_stated_on_own_site}',
  'logos/fixture-baseline.svg', 'https://example.com/fixture-baseline', 'baseline', true,
  'Fixture note: local test record for the web e2e suite.');

-- Edge cases for search, quoting and keyset ties.
insert into app.competitors (id, company_code, slug, name, markets, hq_country, categories, in_house,
  priority_tier, pilot_rank, status, website_url)
values
  ('e2e00000-0000-0000-0000-000000000102', 'C102', 'fixture-exclusion-studio', 'Fixture Exclusion Studio',
    '{KSA}', 'KSA', '{production}', '{casting}', 'pilot', 3, 'active', 'https://example.com/exclusion'),
  ('e2e00000-0000-0000-0000-000000000901', 'C901', 'fixture-comma-parens', 'Fixture, Comma (Parens) Films',
    '{EG}', 'EG', '{vfx_cgi}', '{vfx_cgi,3d_and_animation}', 'pilot', 4, 'active', 'https://example.com/comma'),
  ('e2e00000-0000-0000-0000-000000000902', 'C902', 'fixture-quote-studio', 'Fixture "Quote" Studio',
    '{UAE}', 'UAE', '{post_production}', '{editing}', 'next_wave', null, 'active', null),
  ('e2e00000-0000-0000-0000-000000000903', 'C903', 'fixture-twin-a', 'Fixture Twin Studio',
    '{EG}', 'EG', '{photography}', '{photography}', 'adjacent', null, 'active', null),
  ('e2e00000-0000-0000-0000-000000000904', 'C904', 'fixture-twin-b', 'Fixture Twin Studio',
    '{KSA}', 'KSA', '{photography}', '{drone_aerial}', 'adjacent', null, 'active', null),
  ('e2e00000-0000-0000-0000-000000000905', 'C905', 'fixture-paused-house', 'Fixture Paused House',
    '{EG}', 'EG', '{production_services}', '{}', 'next_wave', null, 'paused', 'javascript:alert(1)');

-- Bulk rows so pagination spans three pages.
insert into app.competitors (id, company_code, slug, name, markets, hq_country, categories, in_house,
  priority_tier, pilot_rank, website_url)
select
  ('e2e00000-0000-0000-0000-' || lpad((1000 + n)::text, 12, '0'))::uuid,
  'C' || (910 + n),
  'fixture-house-' || lpad(n::text, 2, '0'),
  'Fixture House ' || lpad(n::text, 2, '0'),
  (case n % 4 when 0 then '{EG}' when 1 then '{KSA}' when 2 then '{UAE}' else '{EG,KSA}' end)::app.country_code[],
  (array['EG','KSA','UAE','EG'])[1 + n % 4]::app.country_code,
  array[(array['production','film_and_tv','post_production','animation_motion','digital_and_social'])[1 + n % 5]],
  array[(array['editing','casting','studio_soundstage','motion_graphics','film_distribution'])[1 + n % 5]],
  (array['pilot','next_wave','adjacent'])[1 + n % 3]::app.priority_tier,
  case when n % 3 = 0 then 5 + n / 3 else null end,
  'https://example.com/house-' || n
from generate_series(1, 52) n;

-- Sources: shared profiles (posts + stories), resolution states, flags and a reviewed exclusion.
insert into app.competitor_accounts (competitor_id, platform, handle, url, resolve_status, status,
  last_success_at, last_error, last_error_at, consecutive_failures, items_count, last_item_published_at,
  backfill_status, external_id)
values
  ('e2e00000-0000-0000-0000-000000000000', 'instagram', 'fixturebaseline', 'https://www.instagram.com/fixturebaseline/',
    'not_needed', 'active', '2026-10-17T06:42:00Z', null, null, 0, 42, '2026-10-16T18:00:00Z', 'done', null),
  ('e2e00000-0000-0000-0000-000000000000', 'instagram_stories', 'fixturebaseline', 'https://www.instagram.com/fixturebaseline/',
    'not_needed', 'active', null, null, null, 0, 0, null, 'not_applicable', null),
  ('e2e00000-0000-0000-0000-000000000000', 'vimeo', 'fixturebaseline', 'https://vimeo.com/fixturebaseline',
    'resolved', 'active', null, null, null, 0, 0, null, 'pending', '123456'),
  ('e2e00000-0000-0000-0000-000000000000', 'website', 'example.com', 'https://example.com/fixture-baseline',
    'not_needed', 'paused', null, null, null, 0, 0, null, 'pending', null),
  ('e2e00000-0000-0000-0000-000000000102', 'youtube', '@fixtureexclusion', 'https://www.youtube.com/@fixtureexclusion',
    'failed', 'invalid', null, 'yt_not_found', null, 0, 0, null, 'pending', null),
  ('e2e00000-0000-0000-0000-000000000102', 'website_work_page', 'https://example.com/exclusion/work', 'https://example.com/exclusion/work',
    'not_needed', 'active', null, 'unreachable_timeout', '2026-10-17T05:00:00Z', 2, 0, null, 'pending', null),
  ('e2e00000-0000-0000-0000-000000000901', 'linkedin', 'fixture-comma', 'https://www.linkedin.com/company/fixture-comma/',
    'not_needed', 'failing', null, 'Upstream returned an unexpected page', '2026-10-17T05:30:00Z', 3, 0, null, 'failed', null),
  ('e2e00000-0000-0000-0000-000000000901', 'linkedin_employees', 'fixture-comma', 'https://www.linkedin.com/company/fixture-comma/',
    'not_needed', 'paused', null, null, null, 0, 0, null, 'not_applicable', null),
  ('e2e00000-0000-0000-0000-000000000905', 'instagram', 'fixturepaused', 'javascript:alert(1)',
    'not_needed', 'paused', null, null, null, 0, 0, null, 'pending', null);

insert into app.competitor_accounts (competitor_id, platform, handle, url, resolve_status, status, backfill_status)
select c.id, 'instagram', 'fixturehouse' || right(c.slug, 2), 'https://www.instagram.com/fixturehouse' || right(c.slug, 2) || '/',
  'not_needed', case when c.priority_tier = 'pilot' then 'active' else 'paused' end::app.account_status, 'pending'
from app.competitors c where c.slug like 'fixture-house-%';
