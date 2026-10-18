-- M02 read-only acceptance snapshot. Run against the explicitly selected project.
-- The original CSV baseline is intentional. A failed count is not silently accepted:
-- document the exact overrides/deviation before changing an expected count.
-- AC7 needs a second-run write receipt; MA-09 and production approval are never inferred.
-- AC8 storage metadata is not proof of public HTTP visibility.
-- 2026-10-18 MA-09: the owner excluded these seven unavailable/unverified listed
-- YouTube sources from collection. This does not prove that a company has no channel.
-- Raw CSV totals stay 128 / 11 pilot; only these exact invalid identities are exempt.
with
owner_exclusions(company_code, platform, handle_norm, url, expected_pilot) as (
  values
    ('C102', 'youtube', 'mvmpro', 'https://www.youtube.com/mvmpro', false),
    ('C142', 'youtube', '@gearbox-channel', 'https://www.youtube.com/@gearbox-channel', false),
    ('C218', 'youtube', 'c/actionfilmzstudiodubaiproductions_rentals_events',
      'https://www.youtube.com/c/actionfilmzstudiodubaiproductions_rentals_events', false),
    ('C231', 'youtube', 'user/cityfilmsbeirut', 'https://www.youtube.com/user/cityfilmsbeirut', false),
    ('C233', 'youtube', '@createproductiondxb5110', 'https://www.youtube.com/@createproductiondxb5110', false),
    ('C245', 'youtube', 'firstandtenproductions', 'https://www.youtube.com/firstandtenproductions', false),
    ('C283', 'youtube', 'wonderfulprodbeirut', 'https://www.youtube.com/wonderfulprodbeirut', true)
),
expected_platforms(platform, expected_count, is_primary, expected_active) as (
  values
    ('website', 261, true, 11),
    ('website_work_page', 199, true, 38),
    ('instagram', 256, true, 49),
    ('vimeo', 202, true, 48),
    ('youtube', 128, true, 11),
    ('linkedin', 226, true, 42),
    ('instagram_stories', 256, false, 49),
    ('linkedin_employees', 226, false, 42)
),
platform_counts as (
  select e.platform, e.expected_count, e.is_primary, e.expected_active,
    count(a.id)::integer as actual_count,
    count(a.id) filter (where a.status = 'active')::integer as actual_active
  from expected_platforms e
  left join app.competitor_accounts a on a.platform::text = e.platform
  group by e.platform, e.expected_count, e.is_primary, e.expected_active
),
company_counts as (
  select count(*)::integer as total,
    count(*) filter (where priority_tier = 'pilot')::integer as pilot,
    count(*) filter (where priority_tier = 'next_wave')::integer as next_wave,
    count(*) filter (where priority_tier = 'adjacent')::integer as adjacent,
    count(*) filter (where priority_tier = 'baseline')::integer as baseline,
    count(*) filter (where is_baseline)::integer as baseline_flags,
    count(*) filter (where is_baseline and company_code = 'C000' and slug = 'everyone-films')::integer as everyone_baseline
  from app.competitors
),
account_scope as (
  select a.*, c.company_code, c.priority_tier,
    c.priority_tier in ('pilot', 'baseline') as pilot_or_baseline,
    e.company_code is not null as owner_excluded,
    e.expected_pilot as approved_exclusion_pilot,
    exists (
      select 1 from app.competitor_accounts work
      where work.competitor_id = a.competitor_id and work.platform = 'website_work_page'
    ) as has_work_page,
    case
      when a.platform = 'vimeo' then
        coalesce(a.external_id, '') <> '0'
        and coalesce(a.external_id, '') ~ case
          when a.handle ~ '^(channels|showcase|groups)/' then '^[A-Za-z0-9_-]+$'
          else '^[1-9][0-9]*$'
        end
      when a.platform = 'youtube' then
        coalesce(a.external_id, '') ~ '^UC[A-Za-z0-9_-]{22}$'
        and coalesce(a.uploads_playlist_id, '') ~ '^UU[A-Za-z0-9_-]{22}$'
      else true
    end as identifiers_valid
  from app.competitor_accounts a
  join app.competitors c on c.id = a.competitor_id
  left join owner_exclusions e on e.company_code = c.company_code
    and e.platform = a.platform::text and e.handle_norm = a.handle_norm and e.url = a.url
),
owner_exclusion_counts as (
  select (select count(*)::integer from owner_exclusions) as approved_sources,
    (select count(*)::integer from owner_exclusions where expected_pilot) as approved_pilot_sources,
    count(*) filter (where owner_excluded)::integer as matched_sources,
    count(distinct company_code) filter (where owner_excluded)::integer as matched_companies,
    count(*) filter (where owner_excluded and status = 'invalid' and resolve_status = 'failed'
      and external_id is null and uploads_playlist_id is null
      and pilot_or_baseline = approved_exclusion_pilot)::integer as valid_excluded_sources,
    count(*) filter (where owner_excluded and pilot_or_baseline)::integer as matched_pilot_sources,
    count(*) filter (where platform = 'youtube' and not owner_excluded
      and status not in ('active', 'paused'))::integer as unexpected_ineligible_sources
  from account_scope
),
owner_policy as (
  select p.*, (approved_sources = 7 and approved_pilot_sources = 1
    and matched_sources = 7 and matched_companies = 7 and valid_excluded_sources = 7
    and matched_pilot_sources = 1 and unexpected_ineligible_sources = 0) as passed
  from owner_exclusion_counts p
),
resolution as (
  select platform::text as platform,
    count(*)::integer as total,
    count(*) filter (where resolve_status = 'resolved' and identifiers_valid)::integer as resolved,
    count(*) filter (where pilot_or_baseline)::integer as pilot_total,
    count(*) filter (where pilot_or_baseline and resolve_status = 'resolved' and identifiers_valid)::integer as pilot_resolved,
    count(*) filter (where owner_excluded)::integer as owner_excluded,
    count(*) filter (where owner_excluded and pilot_or_baseline)::integer as owner_excluded_pilot,
    count(*) filter (where not owner_excluded)::integer as eligible_total,
    count(*) filter (where not owner_excluded and resolve_status = 'resolved' and identifiers_valid)::integer as eligible_resolved,
    count(*) filter (where not owner_excluded and pilot_or_baseline)::integer as eligible_pilot_total,
    count(*) filter (where not owner_excluded and pilot_or_baseline
      and resolve_status = 'resolved' and identifiers_valid)::integer as eligible_pilot_resolved,
    count(*) filter (where resolve_status = 'pending')::integer as pending,
    count(*) filter (where resolve_status = 'resolved' and not identifiers_valid)::integer as bad_resolved
  from account_scope where platform in ('vimeo', 'youtube')
  group by platform
),
gating as (
  select count(*) filter (where
    (not pilot_or_baseline and status not in ('paused', 'invalid'))
    or (status = 'active' and not pilot_or_baseline)
    or (platform = 'website' and has_work_page and status not in ('paused', 'invalid'))
  )::integer as violations
  from account_scope
),
backfill as (
  select count(*) filter (where
    (platform in ('vimeo', 'instagram', 'youtube', 'linkedin', 'website_work_page', 'website')
      and (backfill_status <> 'pending' or backfill_from <> date '2024-01-01'))
    or (platform in ('instagram_stories', 'linkedin_employees') and backfill_status <> 'not_applicable')
    or (platform = 'linkedin_employees' and cadence <> interval '7 days')
    or (platform <> 'linkedin_employees' and cadence <> interval '1 day')
  )::integer as violations
  from account_scope
),
logo_scope as (
  select c.*,
    c.logo_url is not null and c.logo_url <> '' as has_source,
    c.logo_path is not null and c.logo_path <> ''
      and exists (select 1 from app.media_assets m
        where m.kind = 'logo' and m.competitor_id = c.id and m.storage_path = c.logo_path)
      and exists (select 1 from storage.objects o
        where o.bucket_id = 'media' and o.name = c.logo_path) as stored_with_metadata
  from app.competitors c
),
logos as (
  select count(*) filter (where has_source)::integer as source_total,
    count(*) filter (where has_source and stored_with_metadata)::integer as source_stored,
    count(*) filter (where is_baseline)::integer as baseline_total,
    count(*) filter (where is_baseline and stored_with_metadata)::integer as baseline_stored
  from logo_scope
),
results as (
  select 'AC1_competitors_and_tiers'::text as criterion,
    to_jsonb(c) as actual,
    jsonb_build_object('total', 285, 'pilot', 50, 'next_wave', 174, 'adjacent', 60, 'baseline', 1,
      'baseline_flags', 1, 'everyone_baseline', 1) as expected,
    (total = 285 and pilot = 50 and next_wave = 174 and adjacent = 60 and baseline = 1
      and baseline_flags = 1 and everyone_baseline = 1) as passed,
    'Original CSV baseline; any override-driven count change needs an explicit documented deviation.'::text as evidence_limit
  from company_counts c
  union all
  select 'AC2_primary_' || platform, to_jsonb(actual_count), to_jsonb(expected_count),
    actual_count = expected_count, 'Per-platform original CSV count; no cross-owner duplicate is silently merged.'
  from platform_counts where is_primary
  union all
  select 'AC3_derived_' || platform, to_jsonb(actual_count), to_jsonb(expected_count),
    actual_count = expected_count, 'Derived identities remain separate platform rows.'
  from platform_counts where not is_primary
  union all
  select 'AC3_total_accounts', to_jsonb(count(*)::integer), to_jsonb(1754), count(*) = 1754,
    'Original total; a committed override/deviation must explain every difference.'
  from app.competitor_accounts
  union all
  select 'AC4_pilot_gating_violations', to_jsonb(violations), to_jsonb(0), violations = 0,
    'Only pilot/baseline may be active; roots with a work page stay paused or explicitly invalid.'
  from gating
  union all
  select 'AC4_active_' || platform,
    case when platform = 'youtube' then jsonb_build_object('active', actual_active,
      'owner_excluded_pilot', p.matched_pilot_sources) else to_jsonb(actual_active) end,
    case when platform = 'youtube' then jsonb_build_object('original_active_target', expected_active,
      'eligible_active_target', expected_active - p.approved_pilot_sources) else to_jsonb(expected_active) end,
    case when platform = 'youtube' then p.passed and actual_active = expected_active - p.approved_pilot_sources
      else actual_active = expected_active end,
    'Original targets retained. YouTube has one specifically approved invalid pilot exclusion; exact identity/state guard must pass.'
  from platform_counts cross join owner_policy p
  union all
  select 'AC5_vimeo_pilot_resolution',
    coalesce((select to_jsonb(r) from resolution r where platform = 'vimeo'), '{}'::jsonb),
    jsonb_build_object('pilot_minimum_rate', 0.95, 'pending', 0, 'bad_resolved', 0),
    coalesce((select pilot_total > 0 and pilot_resolved >= ceil(pilot_total * 0.95)
      and pending = 0 and bad_resolved = 0 from resolution where platform = 'vimeo'), false),
    'Valid numeric user/resource IDs required; failed/transient/zero-ID rows do not count as resolved.'
  union all
  select 'AC5_youtube_owner_exclusions', to_jsonb(p) - 'passed',
    jsonb_build_object('approved_sources', 7, 'approved_pilot_sources', 1, 'matched_sources', 7,
      'matched_companies', 7, 'valid_excluded_sources', 7, 'matched_pilot_sources', 1,
      'unexpected_ineligible_sources', 0), p.passed,
    'MA-09 approved seven exact listed sources as invalid/failed, with null IDs and no collection. No company-wide absence claim or blanket invalid-account exemption.'
  from owner_policy p
  union all
  select 'AC5_youtube_resolution',
    coalesce((select to_jsonb(r) from resolution r where platform = 'youtube'), '{}'::jsonb),
    jsonb_build_object('original_total', 128, 'original_pilot_total', 11, 'owner_excluded', 7,
      'owner_excluded_pilot', 1, 'eligible_total', 121, 'eligible_pilot_total', 10,
      'eligible_resolution_rate', 1.0, 'all_original_minimum_rate', 0.90, 'pending', 0, 'bad_resolved', 0),
    coalesce((select p.passed and total = 128 and pilot_total = 11
      and owner_excluded = 7 and owner_excluded_pilot = 1
      and eligible_total = 121 and eligible_resolved = eligible_total
      and eligible_pilot_total = 10 and eligible_pilot_resolved = eligible_pilot_total
      and resolved >= ceil(total * 0.90) and pending = 0 and bad_resolved = 0
      from resolution cross join owner_policy p where platform = 'youtube'), false),
    'Raw 121/128 and 10/11 remain visible. Eligible 121/121 and 10/10 require the exact seven owner exclusions and valid UC/UU identifiers; no guessed resolution.'
  union all
  select 'AC6_backfill_and_cadence_violations', to_jsonb(violations), to_jsonb(0), violations = 0,
    'Primary rows pending from 2024-01-01; stories/employees not_applicable; employee cadence seven days.'
  from backfill
  union all
  select 'AC7_idempotency_requires_second_run', 'null'::jsonb,
    jsonb_build_object('second_run_inserted', 0, 'second_run_updated', 0), null::boolean,
    'Cannot be established from one SELECT snapshot. Attach the real second-run receipt and unchanged counts.'
  union all
  select 'AC8_logo_storage_metadata', to_jsonb(l),
    jsonb_build_object('source_minimum_rate', 0.95, 'baseline_total', 1, 'baseline_stored', 1),
    source_total > 0 and source_stored >= ceil(source_total * 0.95)
      and baseline_total = 1 and baseline_stored = 1,
    'Partial AC8 evidence only: public Storage HTTP visibility is a separate live verification.'
  from logos l
  union all
  select 'fixture_exclusions', to_jsonb(count(*)::integer), to_jsonb(0), count(*) = 0,
    'C999 and test-house are not M02 production/dev seed competitors.'
  from app.competitors where company_code = 'C999' or slug = 'test-house'
)
select criterion, actual, expected, passed, evidence_limit from results order by criterion;
