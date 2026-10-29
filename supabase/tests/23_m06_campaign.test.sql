begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select extensions.no_plan();
grant n8n_writer,api_agent to postgres with inherit false;
grant n8n_writer,api_agent to postgres with set true;

-- Local synthetic fixtures with a private, inaccessible clock seam. Public
-- launch/tick RPCs always use clock_timestamp(); no runtime clock is injectable.
insert into app.competitors(id,company_code,slug,name,priority_tier)
values('23000000-0000-4000-8000-000000000001','TESTM06CAM','m06-campaign-local','M06 campaign synthetic','pilot');
insert into app.competitor_accounts(id,competitor_id,platform,url,handle,backfill_status,next_due_at)
select ('23000000-0000-4000-8000-'||lpad((100+n)::text,12,'0'))::uuid,'23000000-0000-4000-8000-000000000001',
  'instagram_stories','https://www.instagram.com/m06campaign'||n||'/','m06campaign'||n,'not_applicable',now()-interval '1 day'
from generate_series(1,20) n;
-- Synthetic pre-campaign delivery IDs stand for the13 accepted archived
-- receipts. They remain protected even if their item is observed again.
insert into pgmq.a_media_stories(msg_id,read_ct,enqueued_at,vt,archived_at,message)
select 900000+n,1,now()-interval '1 hour',now()-interval '30 minutes',now(),
  '{"item_id":"23000000-0000-4000-8000-000000000203"}'::jsonb from generate_series(1,13) n;
select set_config('test.m06c.generic',(select encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(q) order by msg_id),'[]')::text,'sha256'),'hex') from pgmq.q_media q),true);
select set_config('test.m06c.day',(clock_timestamp() at time zone 'Africa/Cairo')::date::text,true);
select set_config('test.m06c.at',((current_setting('test.m06c.day')::date+time '06:00') at time zone 'Africa/Cairo')::text,true);
select set_config('test.m06c.ids',(select jsonb_agg(id order by id)::text from app.competitor_accounts where competitor_id='23000000-0000-4000-8000-000000000001'),true);
select set_config('test.m06c.config',jsonb_build_object('campaign_id','23000000-0000-4000-8000-000000000099',
  'starts_on',current_setting('test.m06c.day'),'account_ids',current_setting('test.m06c.ids')::jsonb,
  'groups',jsonb_build_array(jsonb_build_object('group_key','primary','actor_id','data-slayer/instagram-stories-scraper',
    'collection_mode','ingest','account_ids',current_setting('test.m06c.ids')::jsonb,'results_limit',30))
    ||jsonb_build_array(jsonb_build_object('group_key','compare_igview','actor_id','igview-owner/instagram-story-viewer','collection_mode','bakeoff','account_ids',current_setting('test.m06c.ids')::jsonb,'results_limit',50),
      jsonb_build_object('group_key','compare_louis','actor_id','louisdeconinck/instagram-story-details-scraper','collection_mode','bakeoff','account_ids',current_setting('test.m06c.ids')::jsonb,'results_limit',50)),
  'actor_pins',jsonb_build_object('data-slayer/instagram-stories-scraper',jsonb_build_object('build','1.0.32','buildId','LocalDataSlayer23','memoryMbytes',1024,'timeoutSecs',180),
    'igview-owner/instagram-story-viewer',jsonb_build_object('build','1.0.16','buildId','LocalIgview23','memoryMbytes',4096,'timeoutSecs',180),
    'louisdeconinck/instagram-story-details-scraper',jsonb_build_object('build','0.0.10','buildId','LocalLouis23','memoryMbytes',256,'timeoutSecs',180)),
  'max_actor_starts',200,'max_actor_usd',6,'max_total_usd',1200)::text,true);

select extensions.ok((select count(*)=2 and bool_and(relrowsecurity) from pg_class where oid in('ops.m06_story_campaigns'::regclass,'ops.m06_story_campaign_slots'::regclass)),'campaign and slots have RLS');
select extensions.ok(not has_table_privilege('n8n_writer','ops.m06_story_campaigns','INSERT,UPDATE,DELETE') and not has_table_privilege('api_agent','ops.m06_story_campaign_slots','SELECT'),'machine roles have no direct campaign table access');
select extensions.ok(not has_function_privilege('n8n_writer','ops.m06_campaign_install(jsonb)','EXECUTE') and not has_function_privilege('n8n_writer','ops.m06_campaign_stop(uuid)','EXECUTE'),'install and stop stay owner-only');
select extensions.ok(has_function_privilege('n8n_writer','ops.m06_campaign_tick(uuid,uuid,text)','EXECUTE') and not has_function_privilege('api_agent','ops.m06_campaign_tick(uuid,uuid,text)','EXECUTE'),'tick is restricted writer RPC');
select extensions.ok(not has_function_privilege('n8n_writer','private.m06_campaign_tick_at(uuid,uuid,text,timestamptz)','EXECUTE')
  and not has_function_privilege('n8n_writer','private.m06_campaign_assert_launch(jsonb,timestamptz)','EXECUTE')
  and not has_function_privilege('n8n_writer','private.m06_execute_v22(uuid,text,jsonb)','EXECUTE'),'clock seam and retained implementation are inaccessible to writer');
select extensions.throws_ok($$select ops.m06_campaign_install(jsonb_set(current_setting('test.m06c.config')::jsonb,'{starts_on}',to_jsonb((current_setting('test.m06c.day')::date-1)::text)))$$,'22023',null,'cannot install fabricated past campaign dates');
select extensions.throws_ok($$select ops.m06_campaign_install(jsonb_set(current_setting('test.m06c.config')::jsonb,'{groups,0,results_limit}','31'))$$,'22023',null,'primary grouping fits native30item envelope');
select extensions.is(ops.m06_campaign_install(current_setting('test.m06c.config')::jsonb)->>'slots','21','one primary plus2comparison groups create21 finite slots');
select extensions.is(ops.m06_campaign_install(current_setting('test.m06c.config')::jsonb)->>'slots','21','exact installation replay creates no slots');
select extensions.is((select cardinality(protected_archive_ids) from ops.m06_story_campaigns where id='23000000-0000-4000-8000-000000000099'),13,'installation protects the13 pre-campaign archived IDs');
select extensions.throws_ok($$select ops.m06_campaign_install(jsonb_set(current_setting('test.m06c.config')::jsonb,'{max_actor_usd}','7'))$$,'55000',null,'admitted campaign settings immutable');
select extensions.is((select count(distinct day)::int from ops.m06_story_campaign_slots),7,'exactly seven consecutive dates');
select extensions.is((select max(day)-min(day) from ops.m06_story_campaign_slots),6,'dates have no artificial extension');
select extensions.is(private.m06_campaign_tick_at(gen_random_uuid(),'23000000-0000-4000-8000-000000000099','230001',current_setting('test.m06c.at')::timestamptz-interval '1 second')->'result'->>'action','idle','no actor before06Cairo');
select extensions.is((select count(*)::int from ops.scrape_runs where n8n_execution_id='230001'),0,'pre-slot tick does not create parent');

select set_config('test.m06c.tickid',gen_random_uuid()::text,true);
select set_config('test.m06c.tick',private.m06_campaign_tick_at(current_setting('test.m06c.tickid')::uuid,'23000000-0000-4000-8000-000000000099','230002',current_setting('test.m06c.at')::timestamptz)::text,true);
select extensions.is(current_setting('test.m06c.tick')::jsonb->'result'->>'action','launch','first eligible group atomically starts and claims');
select extensions.is(jsonb_array_length(current_setting('test.m06c.tick')::jsonb->'result'->'accounts'),20,'primary group atomically claims the20 verified accounts');
select extensions.is(current_setting('test.m06c.tick')::jsonb->'result'->'selection'->>'results_limit','30','native output envelope is server selected');
select extensions.is(private.m06_campaign_tick_at(current_setting('test.m06c.tickid')::uuid,'23000000-0000-4000-8000-000000000099','230002',current_setting('test.m06c.at')::timestamptz)->'result'->>'action','idle','same tick cannot dispatch another paid launch');
select extensions.is((select count(*)::int from ops.scrape_runs where n8n_execution_id='230002'),1,'replayed tick preserves one parent');
select set_config('test.m06c.run',current_setting('test.m06c.tick')::jsonb->'result'->>'run_id',true);
select set_config('test.m06c.launch',jsonb_build_object('run_id',current_setting('test.m06c.run'),'launch_id','23000000-0000-4000-8000-000000000031',
  'actor_id','data-slayer/instagram-stories-scraper','pass','primary','account_ids',current_setting('test.m06c.tick')::jsonb->'result'->'selection'->'account_ids',
  'purpose','daily','results_limit',30,'actor_input',jsonb_build_object('usernames',(select jsonb_agg(handle order by id) from app.competitor_accounts where competitor_id='23000000-0000-4000-8000-000000000001')),'approval_id','23000000-0000-4000-8000-000000000099',
  'max_actor_starts',200,'max_actor_usd',6,'max_total_usd',1200,'build_id','LocalDataSlayer23','collection_mode','ingest','memory_mbytes',1024,'timeout_secs',180)::text,true);
select extensions.lives_ok($$select private.m06_campaign_assert_launch(current_setting('test.m06c.launch')::jsonb,current_setting('test.m06c.at')::timestamptz)$$,'actual launch guard accepts exact admitted group in fixed local clock');
select extensions.throws_ok($$select private.m06_campaign_assert_launch(current_setting('test.m06c.launch')::jsonb,current_setting('test.m06c.at')::timestamptz+interval '6 hours')$$,'42501',null,'fresh launch blocked at12Cairo independently of scheduler');
select extensions.throws_ok($$select private.m06_campaign_assert_launch(current_setting('test.m06c.launch')::jsonb,current_setting('test.m06c.at')::timestamptz+interval '7 days')$$,'42501',null,'eighth day cannot launch');
select extensions.throws_ok($$select private.m06_campaign_assert_launch(jsonb_set(current_setting('test.m06c.launch')::jsonb,'{build_id}','"WrongBuild"'),current_setting('test.m06c.at')::timestamptz)$$,'42501',null,'changed native build is rejected');
select extensions.throws_ok($$select private.m06_campaign_assert_launch(jsonb_set(current_setting('test.m06c.launch')::jsonb,'{results_limit}','20'),current_setting('test.m06c.at')::timestamptz)$$,'42501',null,'admitted output settings cannot change');
select private.m06_execute_v22(gen_random_uuid(),'m06.launch',current_setting('test.m06c.launch')::jsonb);
select extensions.is(private.m06_campaign_tick_at(gen_random_uuid(),'23000000-0000-4000-8000-000000000099','230003',current_setting('test.m06c.at')::timestamptz+interval '5 minutes')->'result'->>'reason','actor_start_reconciliation_required','unknown actor start blocks without replacement');
select ops.m06_execute(gen_random_uuid(),'m06.register',jsonb_build_object('run_id',current_setting('test.m06c.run'),'launch_id','23000000-0000-4000-8000-000000000031',
  'apify_run_id','LocalCampaignActor23','actor_id','data-slayer/instagram-stories-scraper','pass','primary','account_ids',current_setting('test.m06c.tick')::jsonb->'result'->'selection'->'account_ids','purpose','daily'));
select extensions.is(private.m06_campaign_tick_at(gen_random_uuid(),'23000000-0000-4000-8000-000000000099','230004',current_setting('test.m06c.at')::timestamptz+interval '5 minutes')->'result'->>'action','recover','known registered actor gets bounded callback recovery');
select extensions.ok((select registration_closed from ops.collector_runs where run_id=current_setting('test.m06c.run')::uuid),'tick closes completed registration barrier after native interruption');
select extensions.is(private.m06_campaign_tick_at(gen_random_uuid(),'23000000-0000-4000-8000-000000000099','230005',current_setting('test.m06c.at')::timestamptz+interval '10 minutes')->'result'->>'action','recover','one second known callback recovery is permitted');
select extensions.is(private.m06_campaign_tick_at(gen_random_uuid(),'23000000-0000-4000-8000-000000000099','230006',current_setting('test.m06c.at')::timestamptz+interval '15 minutes')->'result'->>'reason','callback_recovery_exhausted','bounded recovery cannot loop forever');
select extensions.throws_ok($$select private.m06_campaign_assert_launch(jsonb_set(current_setting('test.m06c.launch')::jsonb,'{launch_id}','"23000000-0000-4000-8000-000000000032"'),current_setting('test.m06c.at')::timestamptz)$$,'42501',null,'new execution cannot issue a second launch for consumed slot');
select extensions.lives_ok($$select private.m06_campaign_assert_launch(current_setting('test.m06c.launch')::jsonb,current_setting('test.m06c.at')::timestamptz+interval '7 days')$$,'existing allocation remains available for reconciliation after cutoff');
select ops.m06_execute(gen_random_uuid(),'m06.settle',jsonb_build_object('apify_run_id','LocalCampaignActor23','status','SUCCEEDED','dataset_id','LocalCampaignDataset23','usage_usd',0.001,'observed_at',clock_timestamp(),
  'groups',(select jsonb_agg(jsonb_build_object('account_id',x,'status','success','error',null,'items','[]'::jsonb,'bakeoff_rows','[]'::jsonb,'observation','no_stories','source_evidence',true)) from jsonb_array_elements_text(current_setting('test.m06c.ids')::jsonb) x)));
select extensions.is((select status from ops.scrape_runs where id=current_setting('test.m06c.run')::uuid),'success','existing settlement finishes recovered campaign parent');
select extensions.is((select count(*)::int from ops.bakeoff_observations where apify_run_id='LocalCampaignActor23' and status='no_stories'),20,'explicit empty remains source evidence not a provider failure');
select extensions.is((select count(*)::int from ops.cost_ledger where meta->>'apify_run_id'='LocalCampaignActor23'),20,'campaign uses existing exact per-account cost-once accounting');
select extensions.is(jsonb_array_length(ops.m06_campaign_snapshot('23000000-0000-4000-8000-000000000099')->'observations'),20,'snapshot is scoped to actual campaign run IDs');
select extensions.is(jsonb_array_length(ops.m06_campaign_snapshot('23000000-0000-4000-8000-000000000099')->'thumbnail_items'),0,'no-stories does not manufacture thumbnail evidence');

-- Synthetic captured-item/report and interrupted media boundaries. There is no
-- HTTP request or real provider/Storage upload in this rollback fixture.
insert into app.items(id,competitor_id,account_id,platform,item_type,external_id,url,published_at,first_seen_at,thumbnail_source_url)
values('23000000-0000-4000-8000-000000000201','23000000-0000-4000-8000-000000000001','23000000-0000-4000-8000-000000000101',
 'instagram_stories','story','230023001','https://www.instagram.com/stories/m06campaign1/230023001/',now()-interval '1 hour',now(),'https://images.example.com/campaign-missing.jpg'),
 ('23000000-0000-4000-8000-000000000202','23000000-0000-4000-8000-000000000001','23000000-0000-4000-8000-000000000101',
 'instagram_stories','story','230023002','https://www.instagram.com/stories/m06campaign1/230023002/',now()-interval '9 hours',now()-interval '8 hours','https://images.example.com/campaign-late.jpg'),
 ('23000000-0000-4000-8000-000000000203','23000000-0000-4000-8000-000000000001','23000000-0000-4000-8000-000000000101',
 'instagram_stories','story','230023003','https://www.instagram.com/stories/m06campaign1/230023003/',now()-interval '1 hour',now(),'https://images.example.com/campaign-safe.jpg');
insert into ingest.raw_items(platform,external_id,account_id,run_id,actor,payload,normalized)
select platform,external_id,account_id,current_setting('test.m06c.run')::uuid,'data-slayer/instagram-stories-scraper','{}','{}'
from app.items where id in ('23000000-0000-4000-8000-000000000201','23000000-0000-4000-8000-000000000202','23000000-0000-4000-8000-000000000203');
select ops.save_media_asset('23000000-0000-4000-8000-000000000202','thumbnail','m06-campaign-local/instagram_stories/230023002/thumb.jpg','https://images.example.com/campaign-late.jpg',640,480);
update app.media_assets set created_at=now()-interval '1 hour' where item_id='23000000-0000-4000-8000-000000000202';
select extensions.is(jsonb_array_length(ops.m06_campaign_snapshot('23000000-0000-4000-8000-000000000099')->'thumbnail_items'),3,'LEFT JOIN retains all captured stories including missing thumbnail');
select extensions.is((select count(*)::int from jsonb_array_elements(ops.m06_campaign_snapshot('23000000-0000-4000-8000-000000000099')->'thumbnail_items') x
  where x->>'within_six_hours'='false'),3,'missing and late thumbnails count as failures');
select pgmq.send('media_stories','{"item_id":"23000000-0000-4000-8000-000000000203"}'::jsonb);
select pg_advisory_lock(73106,31);
select set_config('test.m06c.claim',ops.claim_story_media_batch('230031',1)::text,true);
select pg_advisory_unlock(73106,31);
select extensions.is(private.m06_campaign_tick_at(gen_random_uuid(),'23000000-0000-4000-8000-000000000099','230010',clock_timestamp())->'result'->>'reason','media_in_progress','recent child is in progress not a fabricated failure');
update ops.audit_log set created_at=current_setting('test.m06c.at')::timestamptz-interval '11 minutes'
  where action='story_media_batch_claim' and entity_id='230031';
select extensions.is(private.m06_campaign_tick_at(gen_random_uuid(),'23000000-0000-4000-8000-000000000099','230011',current_setting('test.m06c.at')::timestamptz+interval '20 minutes')->'result'->>'reason','media_reconciliation_required','missing durable outcome never assumes no upload occurred');
select extensions.is((select count(*)::int from ops.audit_log where action='story_media_message_ack' and after->>'execution_id'='230031'),0,'ambiguous interrupted work is not ACKed');
select ops.save_media_asset('23000000-0000-4000-8000-000000000203','thumbnail','m06-campaign-local/instagram_stories/230023003/thumb.jpg','https://images.example.com/campaign-safe.jpg',640,480);
insert into storage.objects(bucket_id,name,metadata) values('media','m06-campaign-local/instagram_stories/230023003/thumb.jpg','{"mimetype":"image/jpeg","size":1000}');
select pg_advisory_lock(73106,31);
select ops.record_story_media_outcome('230031',jsonb_build_object('item_id','23000000-0000-4000-8000-000000000203',
  'msg_ids',jsonb_build_array(current_setting('test.m06c.claim')::jsonb->'messages'->0->>'msg_id'),'outcome','stored','code','thumbnail_saved','bytes',1000,'cost_usd',null));
select pg_advisory_unlock(73106,31);
-- Expired visibility is renewed only after unchanged read_ct and durable safe
-- ownership/object proof; the existing guarded ACK/finish produce the receipt.
update pgmq.q_media_stories set vt=now()-interval '1 second' where msg_id=(current_setting('test.m06c.claim')::jsonb->'messages'->0->>'msg_id')::bigint;
select private.m06_campaign_tick_at(gen_random_uuid(),'23000000-0000-4000-8000-000000000099','230012',current_setting('test.m06c.at')::timestamptz+interval '6 hours');
select extensions.is((select after->>'state' from ops.audit_log where action='story_media_batch_finish' and entity_id='230031'),'completed','only known safe persisted media is reconciled through guarded finish');
select extensions.is((select count(*)::int from ops.audit_log where action='story_media_message_ack' and after->>'execution_id'='230031'),1,'safe recovery ACKs exactly once');
select extensions.is((select count(*)::int from pgmq.q_media_stories),0,'safe recovery leaves no silently stranded story message');
select extensions.is((select count(*)::int from ops.audit_log where action='m06_campaign_media_recovery' and entity_id='230031'),1,'safe recovery has durable bounded attempt evidence');
select extensions.is((select count(*)::int from jsonb_array_elements(ops.m06_campaign_snapshot('23000000-0000-4000-8000-000000000099')->'thumbnail_items') x
  where x->>'within_six_hours'='true'),1,'timely receipt is counted separately from missing and late');
select extensions.is(ops.m06_campaign_housekeeping('23000000-0000-4000-8000-000000000099')->>'deleted','0','campaign archives retained through shutdown plus30days');
select extensions.is(private.m06_campaign_tick_at(gen_random_uuid(),'23000000-0000-4000-8000-000000000099','230007',current_setting('test.m06c.at')::timestamptz+interval '6 hours')->'result'->>'action','idle','missed afternoon slots cannot become paid observations');
select extensions.is((select count(*)::int from ops.m06_story_campaign_slots where campaign_id='23000000-0000-4000-8000-000000000099' and day=current_setting('test.m06c.day')::date and state='skipped'),2,'missed2comparison groups recorded honestly');
select extensions.is(private.m06_campaign_tick_at(gen_random_uuid(),'23000000-0000-4000-8000-000000000099','230008',current_setting('test.m06c.at')::timestamptz+interval '7 days')->'result'->>'action','closed','day8 is closed without extending dates');
-- Advance only this synthetic fixture's retained campaign dates to exercise
-- the30day housekeeping boundary. Runtime writers cannot alter this policy.
update ops.m06_story_campaigns set starts_on=current_setting('test.m06c.day')::date-50,
  ends_on=current_setting('test.m06c.day')::date-44,
  stop_new_at=((current_setting('test.m06c.day')::date-44)+time '12:00') at time zone 'Africa/Cairo',
  shutdown_at=(((current_setting('test.m06c.day')::date-44)+time '18:00') at time zone 'Africa/Cairo')+interval '24 hours'
where id='23000000-0000-4000-8000-000000000099';
update pgmq.a_media_stories set archived_at=now()-interval '45 days';
select extensions.is(ops.m06_campaign_housekeeping('23000000-0000-4000-8000-000000000099')->>'deleted','1','housekeeping removes only one owned expired operational archive');
select extensions.is((select count(*)::int from pgmq.a_media_stories where msg_id between 900001 and 900013),13,'all13 pre-campaign archived deliveries remain even for a recaptured item');
select extensions.is((select count(*)::int from app.items where competitor_id='23000000-0000-4000-8000-000000000001'),3,'housekeeping preserves every collected story');
select extensions.is((select count(*)::int from ingest.raw_items where run_id=current_setting('test.m06c.run')::uuid),3,'housekeeping preserves every raw row');
select extensions.ok(exists(select 1 from ops.audit_log where action='story_media_message_ack' and after->>'execution_id'='230031'),'housekeeping preserves media audit evidence');

-- Exercise the actual20x30 maximum SQL settlement/queue contract, without HTTP
-- or a provider. Only these synthetic accounts are made due in this rollback.
update app.competitor_accounts set next_due_at=now()-interval '1 day'
  where competitor_id='23000000-0000-4000-8000-000000000001';
select ops.m06_campaign_install(jsonb_set(current_setting('test.m06c.config')::jsonb,'{campaign_id}','"23000000-0000-4000-8000-000000000098"'));
select set_config('test.m06c.bulk',private.m06_campaign_tick_at(gen_random_uuid(),'23000000-0000-4000-8000-000000000098','230020',current_setting('test.m06c.at')::timestamptz)::text,true);
select set_config('test.m06c.bulk_run',current_setting('test.m06c.bulk')::jsonb->'result'->>'run_id',true);
select private.m06_execute_v22(gen_random_uuid(),'m06.launch',current_setting('test.m06c.launch')::jsonb||jsonb_build_object(
  'run_id',current_setting('test.m06c.bulk_run'),'launch_id','23000000-0000-4000-8000-000000000032','approval_id','23000000-0000-4000-8000-000000000098'));
select ops.m06_execute(gen_random_uuid(),'m06.register',jsonb_build_object('run_id',current_setting('test.m06c.bulk_run'),'launch_id','23000000-0000-4000-8000-000000000032',
  'apify_run_id','LocalCampaignBulk23','actor_id','data-slayer/instagram-stories-scraper','pass','primary','account_ids',current_setting('test.m06c.ids')::jsonb,'purpose','daily'));
select ops.m06_execute(gen_random_uuid(),'m06.close_registration',jsonb_build_object('run_id',current_setting('test.m06c.bulk_run')));
select set_config('test.m06c.bulk_settle',jsonb_build_object('apify_run_id','LocalCampaignBulk23','status','SUCCEEDED','dataset_id','LocalCampaignBulkData23','usage_usd',0.12,
  'observed_at',clock_timestamp(),'groups',(select jsonb_agg(jsonb_build_object('account_id',a.id,'status','success','error',null,
    'observation','stories','source_evidence',true,
    'items',(select jsonb_agg(jsonb_build_object('platform','instagram_stories','external_id','2309'||right(a.id::text,3)||lpad(n::text,2,'0'),
      'actor','data-slayer/instagram-stories-scraper','item_type','story','url','https://www.instagram.com/stories/'||a.handle||'/2309'||right(a.id::text,3)||lpad(n::text,2,'0')||'/',
      'published_at',now()-interval '1 hour','title',null,'caption','Synthetic maximum campaign row','hashtags','[]'::jsonb,'mentions','[]'::jsonb,
      'tagged_accounts','[]'::jsonb,'duration_seconds',null,'thumbnail_url','https://images.example.com/'||right(a.id::text,3)||'-'||n||'.jpg',
      'metrics','{}'::jsonb,'media_urls','[]'::jsonb,'payload','{"synthetic":true}'::jsonb) order by n) from generate_series(1,30) n),
    'bakeoff_rows',(select jsonb_agg(jsonb_build_object('actor','data-slayer/instagram-stories-scraper','account_id',a.id,
      'story_key','2309'||right(a.id::text,3)||lpad(n::text,2,'0'),'raw_id','2309'||right(a.id::text,3)||lpad(n::text,2,'0'),
      'taken_at',now()-interval '1 hour','has_thumbnail',true,'has_mentions',false,'has_link',false) order by n) from generate_series(1,30) n)) order by a.id)
    from app.competitor_accounts a where a.competitor_id='23000000-0000-4000-8000-000000000001'))::text,true);
set local statement_timeout='8s';
select set_config('test.m06c.bulk_started',clock_timestamp()::text,true);
select extensions.lives_ok($$select ops.m06_execute(gen_random_uuid(),'m06.settle',current_setting('test.m06c.bulk_settle')::jsonb)$$,'actual600row settlement fits the gateway8second SQL deadline locally');
select extensions.ok(clock_timestamp()-current_setting('test.m06c.bulk_started')::timestamptz<interval '8 seconds','observed600row contract duration remains below8seconds');
select extensions.is((select count(*)::int from ingest.raw_items where run_id=current_setting('test.m06c.bulk_run')::uuid),600,'all600raw rows persisted through actual upsert');
select extensions.is((select count(*)::int from pgmq.q_media_stories),600,'all600stories remain durable for finite media continuation');
select extensions.is(jsonb_array_length(ops.m06_campaign_snapshot('23000000-0000-4000-8000-000000000098')->'thumbnail_items'),600,'campaign report LEFTJOINdenominator includesall600missing thumbnails');
select extensions.is(private.m06_campaign_tick_at(gen_random_uuid(),'23000000-0000-4000-8000-000000000098','230021',current_setting('test.m06c.at')::timestamptz+interval '5 minutes')->'result'->>'action','media','next tick continuesdurablemedia before another actor group');
select extensions.is(private.m06_campaign_tick_at(gen_random_uuid(),'23000000-0000-4000-8000-000000000098','230022',current_setting('test.m06c.at')::timestamptz+interval '10 minutes')->'result'->>'max_batches','6','each media continuation hasfinite6child bound');
select extensions.is(ops.m06_execute(gen_random_uuid(),'m06.settle',current_setting('test.m06c.bulk_settle')::jsonb)->'result'->>'updated','false','settled600row callback replay performsno media ingest');
select extensions.is((select count(*)::int from pgmq.q_media_stories),600,'replay leavesqueue600 withoutduplicatework');
select extensions.is((select sum(cost_usd) from ops.cost_ledger where meta->>'apify_run_id'='LocalCampaignBulk23'),0.12::numeric,'measuredbulkcost remains exactonce');
select set_config('test.m06c.conflict_at',clock_timestamp()::text,true);
select extensions.ok(has_function_privilege('n8n_writer','ops.m06_campaign_conflict(uuid,text,text,timestamptz)','EXECUTE')
  and not has_function_privilege('anon','ops.m06_campaign_conflict(uuid,text,text,timestamptz)','EXECUTE'),'pause-only verified event RPC is restricted writer');
select extensions.is(ops.m06_campaign_conflict('23000000-0000-4000-8000-000000000098','LocalEvent23','dpl_LocalProduction23',current_setting('test.m06c.conflict_at')::timestamptz)->>'paused','true','verified Production conflict pauses only owned development campaign');
select extensions.is(ops.m06_campaign_conflict('23000000-0000-4000-8000-000000000098','LocalEvent23','dpl_LocalProduction23',current_setting('test.m06c.conflict_at')::timestamptz)->>'paused','true','duplicate verified event is idempotent');
select extensions.is((select count(*)::int from ops.audit_log where action='m06_campaign_production_conflict' and after->>'event_id'='LocalEvent23'),1,'conflict event has one durable audit receipt');
select extensions.is(private.m06_campaign_tick_at(gen_random_uuid(),'23000000-0000-4000-8000-000000000098','230023',current_setting('test.m06c.at')::timestamptz)->'result'->>'action','closed','paused campaign cannot launch from a later tick');
select extensions.throws_ok($$select ops.m06_campaign_conflict('23000000-0000-4000-8000-000000000098','LocalEvent23','dpl_Different23',current_setting('test.m06c.conflict_at')::timestamptz)$$,'55000',null,'same event cannot change deployment identity');
select extensions.throws_ok($$select ops.m06_campaign_conflict('23000000-0000-4000-8000-000000000098','LocalOldEvent23','dpl_LocalProduction23',current_setting('test.m06c.conflict_at')::timestamptz-interval '1 day')$$,'42501',null,'stale event cannot be substituted into campaign lifetime');
select extensions.is((select encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(q) order by msg_id),'[]')::text,'sha256'),'hex') from pgmq.q_media q),current_setting('test.m06c.generic'),'generic media backlog is byte-for-byte untouched');
select extensions.ok((select bool_and(prosecdef and proconfig=array['search_path=""']) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('ops','private') and p.proname like 'm06_campaign%'),'all campaign definers use empty search_path');
select * from extensions.finish();
rollback;
