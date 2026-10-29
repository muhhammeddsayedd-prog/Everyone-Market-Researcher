begin read only;
set local statement_timeout='20s';
with roster(company_code,handle) as (values
 ('C001','goodpeoplefilms'),('C130','bigfootfilms'),('C270','thetalkies'),
 ('C226','bigkahunafilms'),('C184','filmpudding'),('C150','lobster_films'),
 ('C280','vipfilms'),('C133','cats__films'),('C083','telfaz11'),('C131','butter__films'),
 ('C163','rhinoproductions'),('C173','aflam_productions'),('C139','film.dna'),
 ('C228','camouflage.productions'),('C179','darb.productions'),('C170','yellowduckfilms'),
 ('C186','hekka_sa'),('C149','light_housefilm'),('C235','dejavusocial'),('C015','maradonafilms'))
select jsonb_build_object('observed_at',clock_timestamp(),'cairo_now',clock_timestamp() at time zone 'Africa/Cairo',
 'history_count',(select count(*) from supabase_migrations.schema_migrations),
 'roster',(select jsonb_agg(jsonb_build_object('company_code',r.company_code,'intended_handle',r.handle,
   'account_id',a.id,'competitor_id',c.id,'name',c.name,'handle',a.handle,'status',a.status,
   'cadence',a.cadence::text,'backfill_status',a.backfill_status,'next_due_at',a.next_due_at,
   'last_success_at',a.last_success_at,'locked_until',a.locked_until,
   'identity_matches',a.handle=r.handle and a.platform='instagram_stories') order by r.company_code)
   from roster r left join app.competitors c using(company_code)
     left join app.competitor_accounts a on a.competitor_id=c.id and a.platform='instagram_stories'),
 'running_parents',(select count(*) from ops.scrape_runs where status='running'),
 'unregistered_launches',(select count(*) from ops.collector_launches where apify_run_id is null),
 'unsettled_jobs',(select count(*) from ops.m06_story_jobs where not settled),
 'story_queued',(select count(*) from pgmq.q_media_stories),
 'story_archived',(select count(*) from pgmq.a_media_stories),
 'generic_media',jsonb_build_object('count',(select count(*) from pgmq.q_media),
   'sha256',(select encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(q) order by msg_id),'[]')::text,'sha256'),'hex') from pgmq.q_media q))) as campaign_preflight;
commit;
