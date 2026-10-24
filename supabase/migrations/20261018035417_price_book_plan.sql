-- M03 dev price plan. Created with pinned CLI migration new, 18 October 2026.
-- Owner reports Apify Scale; public prices were read on 18 October 2026.
-- This adds dated prices; it never edits the seven applied M01 migrations.
-- Sources and unresolved fees/models: M03 evidence/price-review-20261018.md.

-- Fresh replay seeds M01 placeholder prices with CURRENT_DATE. If that date is
-- also 18 October, upgrade only the exact known placeholder or verified value.
-- A different operator price is a conflict, never an unconditional overwrite.
do $$
declare
  v record;
begin
  for v in select * from (values
    ('apify/instagram-scraper:result', '1k results', 1.90, 2.30),
    ('data-slayer/instagram-stories-scraper:result', '1k results', 1.83, 2.17),
    ('data-slayer/instagram-stories-scraper:start', 'run', 0.0005, null),
    ('igview-owner/instagram-story-viewer:result', '1k results', 5.00, 5.00),
    ('igview-owner/instagram-story-viewer:start', 'run', 0.02, null),
    ('louisdeconinck/instagram-story-details-scraper:profile', '1k profiles', 18.00, 9.00),
    ('louisdeconinck/instagram-story-details-scraper:start', 'run', 0.08, null),
    ('dltik/vimeo-scraper:video', '1k videos', 0.50, 2.00),
    ('dltik/vimeo-scraper:start', 'run', 0.00005, null),
    ('apify/website-content-crawler:cu', 'compute unit', 0.16, 0.20),
    ('harvestapi/linkedin-company-posts:post', '1k posts', 1.75, 2.00),
    ('harvestapi/linkedin-company-posts:empty_query', '1k queries', 1.00, null),
    ('harvestapi/linkedin-company-posts:start', 'run', 0.00005, null),
    ('harvestapi/linkedin-company-employees:short_profile', '1k profiles', 2.50, 4.00),
    ('harvestapi/linkedin-company-employees:query_start', '1k queries', 20.00, null),
    ('streamers/youtube-scraper:video', '1k videos', 2.60, 3.00),
    ('streamers/youtube-scraper:date_range', '1k videos', 0.80, null)
  ) as prices(sku, unit, usd, old_placeholder_usd) loop
    -- M01 replay on a later CI date must not shadow reviewed prices with its
    -- recognizable placeholders. Refuse every non-placeholder operator value.
    if exists (select 1 from ops.price_book p
      where p.provider = 'apify' and p.sku = v.sku and p.valid_from >= date '2026-10-18'
        and (p.unit <> v.unit or (p.usd_per_unit <> v.usd
          and (v.old_placeholder_usd is null or p.usd_per_unit <> v.old_placeholder_usd)))) then
      raise exception using errcode = '55000', message = 'M03 price conflicts with an operator value; reconcile first';
    end if;
    update ops.price_book set usd_per_unit = v.usd
      where provider = 'apify' and sku = v.sku and unit = v.unit
        and valid_from >= date '2026-10-18' and usd_per_unit = v.old_placeholder_usd;
    insert into ops.price_book as existing (provider, sku, unit, usd_per_unit, valid_from)
      values ('apify', v.sku, v.unit, v.usd, date '2026-10-18')
    on conflict (provider, sku, valid_from) do update
      set usd_per_unit = excluded.usd_per_unit
      where existing.unit = excluded.unit
        and (existing.usd_per_unit = excluded.usd_per_unit
          or existing.usd_per_unit = v.old_placeholder_usd);
    if not found then
      raise exception using errcode = '55000', message = 'M03 price conflicts with an operator value; reconcile first';
    end if;
  end loop;
end;
$$;

-- Q-07 steady-state default after the owner declined a further fee exercise.
-- Fail closed if another operator changed the baseline value meanwhile.
do $$
begin
  if (select value from ops.settings where key = 'daily_budget_usd') is distinct from '150'::jsonb then
    raise exception using errcode = '55000', message = 'daily alert budget changed; reconcile before applying M03 plan';
  end if;
  update ops.settings set value = '25'::jsonb, updated_at = now()
  where key = 'daily_budget_usd';
end;
$$;

-- Unknown fees are never encoded as zero. Remaining M01 prices are explicitly
-- unverified placeholders, not approved spend estimates for later milestones.
insert into ops.settings (key, value) values
  ('m03_price_verification', jsonb_build_object(
    'observed_date', '2026-10-18',
    'apify_plan', 'Scale',
    'plan_provenance', 'owner_reported',
    'verified_apify_actor_count', 9,
    'unverified', jsonb_build_array(
      'goat255/vimeo-scraper:video', 'openai', 'serpapi', 'firecrawl', 'fixed_monthly_fees'
    ),
    'fixed_fee_coverage_complete', false,
    'note', 'Unknown fees omitted; non-Apify placeholders require actual model/plan verification before later spend'
  ));
