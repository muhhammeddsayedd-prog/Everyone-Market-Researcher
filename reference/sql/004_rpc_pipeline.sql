-- everyone. Market Radar — DRAFT schema, part 4: pipeline RPCs used by n8n (role n8n_writer).
-- Reference only (see 001 header). All functions: SECURITY DEFINER in non-exposed schemas (ingest/ops),
-- SET search_path = '', fully-qualified names, EXECUTE revoked from PUBLIC and granted to n8n_writer only.
-- Bodies marked "SKETCH" must be completed and covered by pgTAP tests in the milestone that owns them.

-- ── Runs ────────────────────────────────────────────────────────────────────
create or replace function ops.start_run(p_workflow text, p_platform app.platform, p_mode text, p_env text, p_execution_id text)
returns uuid language sql security definer set search_path = '' as $$
  insert into ops.scrape_runs (workflow, platform, mode, env, n8n_execution_id)
  values (p_workflow, p_platform, p_mode, p_env, p_execution_id) returning id;
$$;

create or replace function ops.finish_run(p_run_id uuid, p_status text, p_error text default null)
returns void language sql security definer set search_path = '' as $$
  update ops.scrape_runs r set
    finished_at = now(), status = p_status, error = p_error,
    accounts_total = s.total, accounts_ok = s.ok, accounts_failed = s.failed,
    items_seen = s.seen, items_new = s.new,
    cost_usd = coalesce((select sum(cost_usd) from ops.cost_ledger l where l.run_id = p_run_id), 0)
  from (select count(*) total, count(*) filter (where status = 'success') ok,
               count(*) filter (where status = 'failed') failed,
               coalesce(sum(items_seen),0) seen, coalesce(sum(items_new),0) new
        from ops.scrape_run_accounts where run_id = p_run_id) s
  where r.id = p_run_id;
$$;

-- ── Due list with claim (FOR UPDATE SKIP LOCKED) ─────────────────────────────
create or replace function ops.get_due_accounts(p_platform app.platform, p_limit int, p_run_id uuid, p_mode text default 'daily')
returns table (account_id uuid, competitor_id uuid, competitor_slug text, handle text, url text, external_id text,
               uploads_playlist_id text, watermark_published_at timestamptz, watermark_external_id text,
               backfill_from date, backfill_cursor jsonb)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
begin
  return query
  with due as (
    select a.id from app.competitor_accounts a
    join app.competitors c on c.id = a.competitor_id
    where a.platform = p_platform
      and a.status in ('active','failing')
      and c.status = 'active'
      and (a.locked_until is null or a.locked_until < now())
      and (case when p_mode = 'backfill' then a.backfill_status in ('pending','running')
                else a.next_due_at <= now() and a.backfill_status in ('done','not_applicable') end)
    order by (case c.priority_tier when 'baseline' then 0 when 'pilot' then 1 when 'next_wave' then 2 else 3 end), a.next_due_at
    limit p_limit
    for update of a skip locked
  )
  update app.competitor_accounts a set locked_until = now() + interval '2 hours', last_run_id = p_run_id,
         backfill_status = case when p_mode = 'backfill' then 'running' else a.backfill_status end
  from due, app.competitors c
  where a.id = due.id and c.id = a.competitor_id
  returning a.id, a.competitor_id, c.slug, a.handle, a.url, a.external_id, a.uploads_playlist_id,
            a.last_item_published_at, a.last_external_id, a.backfill_from, a.backfill_cursor;
end $$;
-- Pilot gating: during the pilot only tiers baseline+pilot are 'active'; others are 'paused' (set in M02/M15).

create or replace function ops.report_account_result(p_run_id uuid, p_account_id uuid, p_status text,
  p_items_seen int, p_items_new int, p_error text default null, p_backfill_done boolean default false,
  p_backfill_cursor jsonb default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into ops.scrape_run_accounts (run_id, account_id, status, items_seen, items_new, error)
  values (p_run_id, p_account_id, p_status, p_items_seen, p_items_new, p_error)
  on conflict (run_id, account_id) do update set status = excluded.status, items_seen = excluded.items_seen,
    items_new = excluded.items_new, error = excluded.error, finished_at = now();

  update app.competitor_accounts a set
    locked_until = null,
    last_success_at = case when p_status = 'success' then now() else a.last_success_at end,
    last_error_at   = case when p_status = 'failed'  then now() else a.last_error_at end,
    last_error      = case when p_status = 'failed'  then p_error else null end,
    consecutive_failures = case when p_status = 'failed' then a.consecutive_failures + 1 else 0 end,
    status = case when p_status = 'failed' and a.consecutive_failures + 1 >= 3 then 'failing'
                  when p_status = 'success' and a.status = 'failing' then 'active' else a.status end,
    next_due_at = case when p_status = 'success'
                       then now() + a.cadence - interval '4 hours'   -- due a little before the same slot next cycle, so the next scheduled run always picks it up
                       else now() + interval '6 hours' end,
    backfill_status = case when p_backfill_done then 'done' else a.backfill_status end,
    backfill_cursor = coalesce(p_backfill_cursor, a.backfill_cursor),
    updated_at = now()
  where a.id = p_account_id;
end $$;

-- ── Single writer path for collected items ───────────────────────────────────
-- p_items: jsonb array of normalized items (reference/n8n/normalized_item.schema.json)
create or replace function ingest.upsert_raw_items(p_run_id uuid, p_account_id uuid, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_comp uuid; v_platform app.platform; v_new uuid[]; v_dups int := 0; v_metrics int := 0;
  v_max_pub timestamptz; v_max_ext text;
begin
  select competitor_id, platform into v_comp, v_platform from app.competitor_accounts where id = p_account_id;
  if v_comp is null then raise exception 'unknown account %', p_account_id; end if;

  -- 1) raw store, new only
  with src as (
    select x.* from jsonb_to_recordset(p_items) as x(
      platform text, external_id text, actor text, payload jsonb, url text, item_type text, published_at timestamptz,
      title text, caption text, hashtags text[], mentions text[], tagged_accounts text[], duration_seconds int,
      thumbnail_url text, metrics jsonb, credits_text text, media_urls text[])
  ), ins as (
    insert into ingest.raw_items (platform, external_id, account_id, run_id, actor, payload, normalized, content_hash)
    select s.platform::app.platform, s.external_id, p_account_id, p_run_id, s.actor, s.payload,
           to_jsonb(s) - 'payload',
           encode(extensions.digest(lower(coalesce(s.caption,'')) || '|' || coalesce(s.thumbnail_url,''), 'sha256'), 'hex')
    from src s
    on conflict (platform, external_id) do nothing
    returning platform, external_id, content_hash, normalized
  ), shells as (
    insert into app.items (competitor_id, account_id, platform, item_type, external_id, url, published_at, title,
      caption_original, hashtags, mentions, tagged_accounts, duration_seconds, thumbnail_source_url, metrics,
      metrics_updated_at, content_hash, duplicate_of, ai_status)
    select v_comp, p_account_id, i.platform, (i.normalized->>'item_type')::app.item_type, i.external_id,
           i.normalized->>'url', (i.normalized->>'published_at')::timestamptz, i.normalized->>'title',
           i.normalized->>'caption',
           coalesce(array(select jsonb_array_elements_text(i.normalized->'hashtags')), '{}'),
           coalesce(array(select jsonb_array_elements_text(i.normalized->'mentions')), '{}'),
           coalesce(array(select jsonb_array_elements_text(i.normalized->'tagged_accounts')), '{}'),
           (i.normalized->>'duration_seconds')::int, i.normalized->>'thumbnail_url',
           coalesce(i.normalized->'metrics', '{}'), now(), i.content_hash,
           d.id,
           case when d.id is not null then 'duplicate'::app.ai_status else 'pending'::app.ai_status end
    from ins i
    left join lateral (
      select it.id from app.items it
      where it.competitor_id = v_comp and it.content_hash = i.content_hash
        and it.first_seen_at > now() - interval '30 days' and it.duplicate_of is null
      limit 1) d on true
    on conflict (platform, external_id) do nothing
    returning id, duplicate_of
  )
  select array_agg(id) filter (where duplicate_of is null), count(*) filter (where duplicate_of is not null)
    into v_new, v_dups from shells;

  -- 2) queue AI for genuinely new rows
  if v_new is not null then
    perform pgmq.send_batch('ai_extract', array(select jsonb_build_object('item_id', x) from unnest(v_new) x));
    perform pgmq.send_batch('media',      array(select jsonb_build_object('item_id', x) from unnest(v_new) x));
  end if;

  -- 3) metrics snapshot for already-known items in this batch (no re-queue)
  update app.items it set metrics = x.metrics, metrics_updated_at = now()
  from jsonb_to_recordset(p_items) as x(platform text, external_id text, metrics jsonb)
  where it.platform = x.platform::app.platform and it.external_id = x.external_id
    and x.metrics is not null and it.metrics is distinct from x.metrics
    and (v_new is null or it.id <> all (v_new));
  get diagnostics v_metrics = row_count;

  -- 4) advance watermark
  select max((e->>'published_at')::timestamptz) into v_max_pub from jsonb_array_elements(p_items) e;
  select e->>'external_id' into v_max_ext from jsonb_array_elements(p_items) e
    order by (e->>'published_at')::timestamptz desc nulls last limit 1;
  update app.competitor_accounts set
    last_item_published_at = greatest(coalesce(last_item_published_at, '-infinity'), coalesce(v_max_pub, '-infinity')),
    last_external_id = case when v_max_pub >= coalesce(last_item_published_at, '-infinity') then v_max_ext else last_external_id end,
    items_count = items_count + coalesce(cardinality(v_new), 0),
    updated_at = now()
  where id = p_account_id;

  return jsonb_build_object('inserted', coalesce(cardinality(v_new), 0), 'duplicates', v_dups,
                            'metrics_updated', v_metrics, 'new_item_ids', to_jsonb(coalesce(v_new, '{}')));
end $$;

-- ── Queues ──────────────────────────────────────────────────────────────────
create or replace function ops.claim_queue_batch(p_queue text, p_n int, p_vt_seconds int default 600)
returns table (msg_id bigint, read_ct int, message jsonb)
language sql security definer set search_path = '' as $$
  select msg_id, read_ct, message from pgmq.read(p_queue, p_vt_seconds, p_n);
$$;

create or replace function ops.ack_queue(p_queue text, p_msg_ids bigint[])
returns void language sql security definer set search_path = '' as $$
  select pgmq.archive(p_queue, p_msg_ids);
$$;
-- Messages with read_ct > 3 → WF-30 sets item ai_status='failed', archives, and logs to WF-90.

-- ── AI context + apply (SKETCH: complete in M07) ────────────────────────────
create or replace function ops.get_items_for_ai(p_item_ids uuid[])
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'item', to_jsonb(i) - 'search_tsv',
    'competitor', jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug, 'markets', c.markets, 'categories', c.categories),
    'account', jsonb_build_object('platform', a.platform, 'handle', a.handle),
    'alias_hints', (select coalesce(jsonb_agg(distinct jsonb_build_object('alias', oa.alias, 'org_id', oa.org_id, 'kind', o.kind, 'name', o.name)), '[]')
                    from app.org_aliases oa join app.organizations o on o.id = oa.org_id
                    where oa.alias_normalized = any (
                      select private.norm(m) from unnest(i.mentions || i.tagged_accounts || i.hashtags) m))
  )), '[]')
  from app.items i
  join app.competitors c on c.id = i.competitor_id
  left join app.competitor_accounts a on a.id = i.account_id
  where i.id = any (p_item_ids);
$$;

-- ops.apply_extraction(p_item_id uuid, p_result jsonb, p_meta jsonb) returns jsonb   -- SKETCH
--   1. insert ops.ai_extractions (model, prompt/schema version, tokens, cost, output, confidence)
--   2. resolve brand/agency: private.resolve_org(kind, name, handle_hints[], embedding?) →
--        exact alias → trigram ≥ ops.settings.alias_trgm_min → (optional) embedding ≥ alias_embedding_min → else create 'unconfirmed' org
--        + review_task('new_brand'|'new_agency'); always add the seen spelling to org_aliases
--   3. resolve people per credit (same cascade on person_aliases) → app.item_credits
--   4. update app.items: AI fields EXCEPT those in locked_fields; ai_status = 'published' if confidence ≥ threshold
--        and is_commercial_work is not null, else 'review' (+ review_task 'item_low_confidence'); non-commercial → 'skipped'
--        is allowed for obvious non-work (greetings, hiring posts) but still keeps summary
--   5. pgmq.send('embed', {entity_type:'item', entity_id})
--   6. insert ops.cost_ledger (provider 'openai', category 'ai_extract')
--   returns {ai_status, brand_id, agency_id, review_task_ids[]}

-- ── Websites ────────────────────────────────────────────────────────────────
create or replace function ops.diff_website_urls(p_account_id uuid, p_urls text[])
returns text[] language plpgsql security definer set search_path = '' as $$
declare v_comp uuid; v_new text[];
begin
  select competitor_id into v_comp from app.competitor_accounts where id = p_account_id;
  update app.website_pages set last_seen_at = now() where account_id = p_account_id and url = any (p_urls);
  with ins as (
    insert into app.website_pages (account_id, competitor_id, url)
    select p_account_id, v_comp, u from unnest(p_urls) u
    on conflict (url) do nothing returning url)
  select array_agg(url) into v_new from ins;
  return coalesce(v_new, '{}');
end $$;

-- ── Other writers (SKETCH signatures; implement in the owning milestone) ────
-- ops.mark_website_page(p_url text, p_status text, p_item_id uuid)                     -- M05
-- ops.save_employee_snapshot(p_account_id uuid, p_snapshot_date date, p_people jsonb)  -- M05: computes joined/left vs previous
-- ops.mark_removed(p_account_id uuid, p_seen_external_ids text[], p_since date)        -- M06: marks active items published >= p_since that were not seen
-- ops.register_apify_run(p_apify_run_id text, p_actor_id text, p_run_id uuid, p_account_ids uuid[], p_purpose text)  -- M03
-- ops.complete_apify_run(p_apify_run_id text, p_status text, p_dataset_id text, p_usage_usd numeric)               -- M03
-- ops.log_cost(p_entries jsonb)                                                        -- M03
-- ops.save_media_asset(p_item_id uuid, p_kind text, p_path text, p_source_url text, p_w int, p_h int)  -- M06 (media v1)
-- ops.upsert_embeddings(p_rows jsonb)                                                  -- M07 (skips when content_hash unchanged)
-- ops.campaign_candidates(p_item_ids uuid[]) returns jsonb                             -- M08
-- ops.attach_to_campaign(p_item_id uuid, p_campaign_id uuid, p_new_campaign jsonb, p_similarity numeric) -- M08
-- ops.upsert_news(p_articles jsonb)                                                    -- M13
-- ops.save_brief(p_week_start date, p_scope text, p_brief jsonb)                       -- M13
-- ops.get_digest(p_since timestamptz) returns jsonb                                    -- M13
-- ops.daily_health() returns jsonb                                                     -- M03 (extended later)
-- ops.accrue_fixed_costs(p_day date)                                                   -- M03
-- ops.refresh_stats_daily(p_from date)                                                 -- M10

-- ── Grants ──────────────────────────────────────────────────────────────────
revoke execute on all functions in schema ops, ingest from public;
grant execute on all functions in schema ops, ingest to n8n_writer;
-- Re-run these two lines in every migration that adds functions (or use ALTER DEFAULT PRIVILEGES).
