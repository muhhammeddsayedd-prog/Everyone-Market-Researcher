-- M06 local cadence/health slice. No hosted setup, scheduling or account claims.
-- Bounds use transaction time now(): lower edges and now are inclusive.
-- Zero-item observations count preserved removed rows too; this is discovery,
-- not current publication availability. Snapshot/root-only accounts are excluded.
-- Story gap counts active story items with valid observation/publication times;
-- no denominator yields null. Media age uses created_at, not first_seen_at.

create function ops.set_stories_cadence(p_twice_daily boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_target interval;
  v_previous jsonb;
  v_setting_changed boolean;
  v_changes jsonb;
  v_count int;
  v_result jsonb;
begin
  if p_twice_daily is null then
    raise exception using errcode='22023',message='explicit stories cadence choice required';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('emr:stories-cadence',0));
  v_target:=case when p_twice_daily then interval '12 hours' else interval '1 day' end;
  select s.value into v_previous from ops.settings s where s.key='stories_twice_daily' for update;
  v_setting_changed:=v_previous is distinct from to_jsonb(p_twice_daily);
  with targets as materialized (
    select a.id,a.cadence from app.competitor_accounts a
    where a.platform='instagram_stories' and a.cadence is distinct from v_target order by a.id for update
  ), changed as (
    update app.competitor_accounts a set cadence=v_target from targets t where a.id=t.id
    returning a.id,t.cadence previous_cadence
  ) select coalesce(jsonb_agg(jsonb_build_object('account_id',id,'cadence_seconds',extract(epoch from previous_cadence)) order by id),'[]'::jsonb)
    into v_changes from changed;
  v_count:=jsonb_array_length(v_changes);
  if v_setting_changed then
    insert into ops.settings(key,value,updated_at) values('stories_twice_daily',to_jsonb(p_twice_daily),now())
      on conflict(key) do update set value=excluded.value,updated_at=excluded.updated_at;
  end if;
  v_result:=jsonb_build_object('changed',v_setting_changed or v_count>0,'twice_daily',p_twice_daily,
    'cadence_seconds',extract(epoch from v_target),'accounts_changed',v_count);
  if v_setting_changed or v_count>0 then
    insert into ops.audit_log(actor_type,action,entity_type,entity_id,before,after)
      values('n8n','stories_cadence_changed','setting','stories_twice_daily',
        jsonb_build_object('setting',v_previous,'accounts',v_changes),v_result);
  end if;
  return v_result;
end $$;
revoke all on function ops.set_stories_cadence(boolean) from public,anon,authenticated,api_agent;
grant execute on function ops.set_stories_cadence(boolean) to n8n_writer;
comment on function ops.set_stories_cadence(boolean) is
  'M06 atomic stories cadence choice only; preserves due dates, claims, watermarks and account state; exact replay is a no-op.';

-- CREATE OR REPLACE keeps the existing daily_health owner/ACL. All legacy
-- expressions below are retained; only the three M06 health fields are added.
create or replace function ops.daily_health()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_today date := (now() at time zone 'Africa/Cairo')::date;
  v_yesterday date;
  v_month date;
  v_start timestamptz;
  v_end timestamptz;
  v_budget numeric;
  v_total numeric;
  v_mtd numeric;
  v_days numeric;
begin
  v_yesterday := v_today-1;
  v_month := date_trunc('month',v_today::timestamp)::date;
  v_start := v_yesterday::timestamp at time zone 'Africa/Cairo';
  v_end := v_today::timestamp at time zone 'Africa/Cairo';
  if jsonb_typeof(ops.get_setting('daily_budget_usd'))='number' then
    v_budget := (ops.get_setting('daily_budget_usd')#>>'{}')::numeric;
  end if;
  select coalesce(sum(l.cost_usd),0) into v_total from ops.cost_ledger l where l.day=v_yesterday;
  select coalesce(sum(l.cost_usd),0) into v_mtd from ops.cost_ledger l where l.day>=v_month and l.day<=v_today;
  v_days := extract(day from (date_trunc('month',v_today::timestamp)+interval '1 month - 1 day'));
  return jsonb_build_object(
    'failing_accounts',coalesce((select jsonb_agg(jsonb_build_object('account_id',a.id,'competitor',c.name,'platform',a.platform,
      'handle',a.handle,'last_error',a.last_error,'consecutive_failures',a.consecutive_failures) order by a.id)
      from app.competitor_accounts a join app.competitors c on c.id=a.competitor_id where a.status='failing' and c.status='active'),'[]'::jsonb),
    'stale_accounts',coalesce((select jsonb_agg(jsonb_build_object('account_id',a.id,'competitor',c.name,'platform',a.platform,
      'handle',a.handle,'last_success_at',a.last_success_at) order by a.id)
      from app.competitor_accounts a join app.competitors c on c.id=a.competitor_id where a.status='active' and c.status='active'
      and a.backfill_status in ('done','not_applicable') and coalesce(a.last_success_at,a.created_at)<now()-
        case when a.cadence>=interval '7 days' then interval '9 days' else interval '48 hours' end),'[]'::jsonb),
    'queues',jsonb_build_object('ai_extract',(select queue_length from pgmq.metrics('ai_extract')),
      'embed',(select queue_length from pgmq.metrics('embed')),'media',(select queue_length from pgmq.metrics('media'))),
    'items_new_yesterday',coalesce((select jsonb_object_agg(platform,n) from (select i.platform,count(*) n from app.items i
      where i.first_seen_at>=v_start and i.first_seen_at<v_end group by i.platform) counts),'{}'::jsonb),
    'cost_yesterday',jsonb_build_object('total',v_total,'by_provider',coalesce((select jsonb_object_agg(provider,n) from
      (select l.provider,sum(l.cost_usd) n from ops.cost_ledger l where l.day=v_yesterday group by l.provider) costs),'{}'::jsonb)),
    'budget',jsonb_build_object('daily_budget_usd',v_budget,'over_budget',coalesce(v_total>v_budget,false)),
    'month_to_date_usd',v_mtd,'forecast_month_usd',round(v_mtd/extract(day from v_today)*v_days,6),
    'workflow_errors_24h',coalesce((select jsonb_object_agg(entity_id,n) from (select a.entity_id,count(*) n from ops.audit_log a
      where a.actor_type='n8n' and a.entity_type='workflow' and a.action='workflow_error' and a.created_at>=now()-interval '24 hours'
      group by a.entity_id) errors),'{}'::jsonb),
    'zero_item_streaks',coalesce((select jsonb_agg(jsonb_build_object('account_id',a.id,'competitor',c.name,
      'platform',a.platform,'handle',a.handle,'last_success_at',a.last_success_at) order by a.id)
      from app.competitor_accounts a join app.competitors c on c.id=a.competitor_id
      where a.status='active' and c.status='active' and a.backfill_status in ('done','not_applicable')
        and a.created_at<=now()-interval '30 days'
        and a.platform in ('vimeo','instagram','youtube','linkedin','website_work_page','news')
        and not exists(select 1 from app.items i where i.account_id=a.id
          and i.first_seen_at>=now()-interval '30 days' and i.first_seen_at<=now())
        and exists(select 1 from app.items i where i.competitor_id=a.competitor_id and i.platform<>a.platform
          and i.platform in ('vimeo','instagram','instagram_stories','youtube','linkedin','website_work_page','news')
          and i.first_seen_at>=now()-interval '30 days' and i.first_seen_at<=now())),'[]'::jsonb),
    'story_capture_gap',(select avg((i.first_seen_at-i.published_at>interval '18 hours')::int)
      from app.items i join app.competitors c on c.id=i.competitor_id
      where i.platform='instagram_stories' and i.item_type='story' and i.status='active' and c.status='active'
        and i.first_seen_at>=now()-interval '7 days' and i.first_seen_at<=now()
        and i.published_at is not null and i.published_at<=i.first_seen_at),
    'media_missing_24h',(select count(*)::int from app.items i join app.competitors c on c.id=i.competitor_id
      where i.created_at>=now()-interval '24 hours' and i.created_at<=now() and i.status='active' and c.status='active'
        and nullif(btrim(i.thumbnail_source_url),'') is not null and nullif(btrim(i.thumbnail_path),'') is null));
end;
$$;
