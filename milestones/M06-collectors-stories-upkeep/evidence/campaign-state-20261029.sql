-- Read-only state for the one installed seven-day development campaign.
-- No claims, tick, actor call, queue read/ACK, schedule or source mutation.
-- SQL identity is not proof of the pooler/project/TLS transport; the caller
-- separately verifies the exact emr-dev endpoint before this administrative read.
begin read only;
set local statement_timeout='20s';
set local lock_timeout='2s';
with campaign as materialized (
  select * from ops.m06_story_campaigns where id='451d4e89-d32f-412a-84f7-ddb5528f4539'
), slots as materialized (
  select s.* from ops.m06_story_campaign_slots s join campaign c on c.id=s.campaign_id
), parents as materialized (
  select r.* from ops.scrape_runs r join slots s on s.run_id=r.id
), actors as materialized (
  select a.* from ops.apify_runs a join parents p on p.id=a.run_id
), launches as materialized (
  select l.* from ops.collector_launches l join parents p on p.id=l.run_id
), jobs as materialized (
  select j.* from ops.m06_story_jobs j join launches l using(launch_id)
), costs as materialized (
  select x.* from ops.cost_ledger x where x.provider='apify' and exists(
    select 1 from actors a where a.run_id=x.run_id and x.meta->>'apify_run_id'=a.apify_run_id)
), captured_items as materialized (
  select distinct i.id from app.items i join ingest.raw_items raw on raw.platform=i.platform
    and raw.account_id=i.account_id and raw.external_id=i.external_id join parents p on p.id=raw.run_id
), media_batches as materialized (
  select a.* from ops.audit_log a where a.action='story_media_batch_claim' and exists(
    select 1 from jsonb_array_elements(a.after->'messages') x join captured_items i on i.id::text=x->'message'->>'item_id')
)
select jsonb_build_object(
  'observed_at',clock_timestamp(),'cairo_now',clock_timestamp() at time zone 'Africa/Cairo',
  'target',jsonb_build_object('expected_project_ref','zmotjsbzhzjvpelxvxlf','database',current_database(),
    'current_user',current_user,'session_user',session_user,'transport_identity_required',true),
  'history',jsonb_build_object('count',(select count(*) from supabase_migrations.schema_migrations),
    'latest',(select jsonb_build_object('version',version,'name',name) from supabase_migrations.schema_migrations order by version desc limit 1)),
  'campaign',(select jsonb_build_object('campaign_id',c.id,'starts_on',c.starts_on,'ends_on',c.ends_on,'timezone','Africa/Cairo',
    'scheduled_local_time','06:00','stop_new_at',c.stop_new_at,'shutdown_at',c.shutdown_at,'stopped_at',c.stopped_at,
    'observation_dates',(select jsonb_agg(d::date order by d) from generate_series(c.starts_on,c.ends_on,interval '1 day') d),
    'groups',(select jsonb_agg(jsonb_build_object('ordinal',n,'group_key',g->>'group_key','actor_id',g->>'actor_id',
      'collection_mode',g->>'collection_mode','account_ids',g->'account_ids','results_limit',g->'results_limit') order by n)
      from jsonb_array_elements(c.configuration->'groups') with ordinality as x(g,n)),
    'roster',(select jsonb_agg(jsonb_build_object('account_id',a.id,'competitor_id',a.competitor_id,'company_code',co.company_code,
      'name',co.name,'handle',a.handle,'platform',a.platform,'status',a.status,'backfill_status',a.backfill_status,
      'next_due_at',a.next_due_at,'last_success_at',a.last_success_at,'locked_until',a.locked_until) order by co.company_code)
      from app.competitor_accounts a join app.competitors co on co.id=a.competitor_id
      where a.id=any(array(select x::uuid from jsonb_array_elements_text(c.configuration->'account_ids') x))),
    'protected_story_archive_ids',c.protected_archive_ids,
    'protected_story_archive_retained',(select count(*) from pgmq.a_media_stories q where q.msg_id=any(c.protected_archive_ids))) from campaign c),
  'slots',(select coalesce(jsonb_agg(jsonb_build_object('day',s.day,'ordinal',s.ordinal,'group_key',s.group_key,
    'state',s.state,'error_code',s.error_code,'run_id',s.run_id,'allocated_at',s.allocated_at) order by s.day,s.ordinal),'[]') from slots s),
  'parents',(select coalesce(jsonb_agg(jsonb_build_object('run_id',p.id,'n8n_execution_id',p.n8n_execution_id,'status',p.status,
    'started_at',p.started_at,'finished_at',p.finished_at,'registration_closed',(select registration_closed from ops.collector_runs r where r.run_id=p.id)) order by p.started_at),'[]') from parents p),
  'actors',(select coalesce(jsonb_agg(jsonb_build_object('apify_run_id',a.apify_run_id,'run_id',a.run_id,'actor_id',a.actor_id,
    'status',a.status,'usage_usd',a.usage_usd,'processed_at',a.processed_at,'finished_at',a.finished_at) order by a.apify_run_id),'[]') from actors a),
  'counts',jsonb_build_object('campaign_rows',(select count(*) from campaign),'roster_accounts',(select jsonb_array_length(configuration->'account_ids') from campaign),
    'observation_days',(select count(distinct day) from slots),'slots',(select count(*) from slots),
    'planned_slots',(select count(*) from slots where state='planned'),'allocated_slots',(select count(*) from slots where run_id is not null),
    'missed_slots',(select count(*) from slots where state='skipped'),'failed_slots',(select count(*) from slots where state='failed'),
    'parents',(select count(*) from parents),'launches',(select count(*) from launches),'registered_actors',(select count(*) from actors),
    'jobs',(select count(*) from jobs),'settled_jobs',(select count(*) from jobs where settled),
    'account_observations',(select count(*) from ops.bakeoff_observations o join actors a using(apify_run_id)),
    'captured_items',(select count(*) from captured_items),'cost_rows',(select count(*) from costs),
    'measured_actor_usd',(select coalesce(sum(usage_usd),0) from actors),'recorded_cost_usd',(select coalesce(sum(cost_usd),0) from costs),
    'unknown_actor_costs',(select count(*) from actors where usage_usd is null),'infrastructure_cost_usd',null),
  'queues',jsonb_build_object('story_queued',(select count(*) from pgmq.q_media_stories),
    'story_archived',(select count(*) from pgmq.a_media_stories),'protected_archives_missing',
      (select count(*) from campaign c cross join unnest(c.protected_archive_ids) x where not exists(select 1 from pgmq.a_media_stories a where a.msg_id=x)),
    'generic_media_count',(select count(*) from pgmq.q_media),
    'generic_identity_sha256',(select encode(extensions.digest(coalesce(jsonb_agg(jsonb_build_array(msg_id,message) order by msg_id),'[]')::text,'sha256'),'hex') from pgmq.q_media),
    'generic_delivery_sha256',(select encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(q) order by msg_id),'[]')::text,'sha256'),'hex') from pgmq.q_media q),
    'accepted_generic_delivery_unchanged',(select encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(q) order by msg_id),'[]')::text,'sha256'),'hex')
      ='72eac5883b5e49c9d4e4d379c68d2bca37073a7d03193fad0b2178c8a37c7ada' from pgmq.q_media q)),
  'quiescence',jsonb_build_object('campaign_running_parents',(select count(*) from parents where status='running'),
    'campaign_unregistered_launches',(select count(*) from launches where apify_run_id is null),
    'campaign_unsettled_jobs',(select count(*) from jobs where not settled),
    'campaign_unprocessed_actors',(select count(*) from actors where processed_at is null),
    'campaign_live_account_claims',(select count(*) from app.competitor_accounts a where a.last_run_id in(select id from parents) and a.locked_until>clock_timestamp()),
    'campaign_unfinished_media_batches',(select count(*) from media_batches b where not exists(select 1 from ops.audit_log f where f.action='story_media_batch_finish' and f.entity_id=b.entity_id)),
    'global_media_session_locks',(select count(*) from pg_catalog.pg_locks where locktype='advisory' and classid=73106 and objid=31 and objsubid=2 and granted),
    'active_m06_sessions',(select count(*) from pg_stat_activity where pid<>pg_backend_pid() and application_name in ('emr-m06-media-dev','emr-m06-collectors-dev') and state<>'idle'))
) as campaign_state;
commit;
