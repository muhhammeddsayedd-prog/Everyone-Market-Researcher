-- Controlled synthetic extraction responses; no provider/model or hosted IO.
-- All fixtures and queue visibility changes roll back with this transaction.
begin;
set local statement_timeout='30s';
set local lock_timeout='3s';
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select extensions.no_plan();
grant n8n_writer,api_agent to postgres with inherit false;
grant n8n_writer,api_agent to postgres with set true;

create function pg_temp.m07_item(n int) returns uuid language sql immutable as $$
 select ('25000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
$$;
create function pg_temp.m07_attempt(n int) returns uuid language sql stable as $$
 select (m->>'attempt_id')::uuid from jsonb_array_elements(current_setting('test.m07.claim')::jsonb->'messages') m
 where m->>'item_id'=pg_temp.m07_item(n)::text;
$$;
create function pg_temp.m07_meta(n int) returns jsonb language sql stable as $$
 select jsonb_build_object('attempt_id',pg_temp.m07_attempt(n),'owner_id','25000000-0000-4000-8000-000000009001',
 'model','m07-controlled','prompt_version','extract_item.v1','schema_version','item_extraction.v1',
 'provider_response_id','resp_m07_'||n,'input_tokens',1000,'output_tokens',200,'cached_tokens',400,
 'cost_usd',0.0032,'used_vision',false,'latency_ms',17,'accounting_mode','simulated','usage_known',true);
$$;
create function pg_temp.m07_result() returns jsonb language sql immutable as $$
 select '{"is_commercial_work":true,"content_type":"tvc_brand_film",
 "brand":{"name":"Shared Identity","handle":"shared-identity","industry":"telecom","country":"EG"},
 "agency":{"name":"Shared Identity","handle":"shared-identity"},
 "production_house":{"is_posting_competitor":false,"other_name":"Other Production Alias"},
 "credits":[{"person_name":"Controlled Director","role":"director","organization":null}],
 "campaign_title":"Controlled campaign","country":"EG","language":"en","occasion":"ramadan",
 "summary_en":"Synthetic local SQL response.","summary_ar":"Synthetic translation.","caption_en":null,
 "tags":["controlled"],"needs_vision":false,
 "confidence":{"overall":0.94,"is_commercial_work":0.99,"brand":0.95,"agency":0.95,"production_house":0.99,
 "credits":0.9,"content_type":0.95,"country":0.9,"occasion":0.9},
 "evidence":{"brand":"Synthetic handle","agency":"Synthetic agency","credits":"Synthetic credit","production_house":"Synthetic alias"}}'::jsonb;
$$;

insert into app.competitors(id,company_code,slug,name,aliases,priority_tier) values
 ('25000000-0000-4000-8000-000000001001','TEST25','m07-synthetic','M07 Synthetic','{}','pilot'),
 ('25000000-0000-4000-8000-000000001002','TEST25OTHER','m07-other','Other Production',array['Other Production Alias'],'pilot');
insert into app.competitor_accounts(id,competitor_id,platform,url,handle,backfill_status) values
 ('25000000-0000-4000-8000-000000001101','25000000-0000-4000-8000-000000001001','vimeo','https://vimeo.com/m07synthetic','m07synthetic','done');
insert into app.items(id,competitor_id,account_id,platform,item_type,external_id,url,caption_original,title)
 select pg_temp.m07_item(n),'25000000-0000-4000-8000-000000001001','25000000-0000-4000-8000-000000001101',
 'vimeo','video','m07-synthetic-'||n,'https://vimeo.com/m07synthetic/'||n,repeat('x',7000),'Preserved title'
 from generate_series(1,12) n;
insert into ingest.raw_items(platform,external_id,account_id,payload,normalized) values
 ('vimeo','m07-synthetic-1','25000000-0000-4000-8000-000000001101','{"synthetic":true}',
 jsonb_build_object('markdown',repeat('m',7000),'credits_text',repeat('c',7000),'media_urls',jsonb_build_array('https://example.org/public.jpg')));
insert into app.organizations(id,kind,name,slug,status) values
 ('25000000-0000-4000-8000-000000002001','brand','Shared Identity','m07-shared-brand','confirmed'),
 ('25000000-0000-4000-8000-000000002002','agency','Shared Identity','m07-shared-agency','confirmed'),
 ('25000000-0000-4000-8000-000000002003','brand','Retired Brand','m07-retired-brand','merged'),
 ('25000000-0000-4000-8000-000000002004','brand','Canonical Brand','m07-canonical-brand','confirmed');
update app.organizations set merged_into='25000000-0000-4000-8000-000000002004' where id='25000000-0000-4000-8000-000000002003';
insert into app.org_aliases(org_id,alias,alias_normalized,source) values
 ('25000000-0000-4000-8000-000000002001','@shared-identity','sharedidentity','human'),
 ('25000000-0000-4000-8000-000000002002','@shared-identity','sharedidentity','seed');
insert into app.people(id,name,slug,status) values
 ('25000000-0000-4000-8000-000000003001','Old Director','m07-old-director','merged'),
 ('25000000-0000-4000-8000-000000003002','Canonical Director','m07-director','confirmed');
update app.people set merged_into='25000000-0000-4000-8000-000000003002' where id='25000000-0000-4000-8000-000000003001';
insert into ops.price_book(provider,sku,unit,usd_per_unit) values
 ('openai','m07-controlled:input','1M tokens',2),('openai','m07-controlled:output','1M tokens',8),
 ('openai','m07-controlled:cached_input','1M tokens',1),
 ('openai','m07-wrong-unit:input','per token',2),('openai','m07-wrong-unit:output','per token',8);

select extensions.is(private.norm_alias('  @Café-Brand #Film!  '),'cafebrandfilm','English normalization removes accents, handles and punctuation');
select extensions.is(private.norm_alias(U&'\0623\064E\062D\0652\0645\064E\062F \0641\062A\0649 \0645\062F\0631\0633\0629'),
 U&'\0627\062D\0645\062F\0641\062A\064A\0645\062F\0631\0633\0647','Arabic diacritics and letter variants normalize');
select extensions.is(private.norm_alias(null),'','null aliases normalize safely');
select extensions.is(private.resolve_org('brand','Retired Brand',null,null,null,0.95,pg_temp.m07_item(1)),
 '25000000-0000-4000-8000-000000002004'::uuid,'organization aliases follow canonical merged target');
select extensions.is(private.resolve_person('Old Director','director',pg_temp.m07_item(1)),
 '25000000-0000-4000-8000-000000003002'::uuid,'people follow canonical merged target');
select extensions.is(private.resolve_org('brand','Shared Identity',null,null,null,0.95,pg_temp.m07_item(1)),
 '25000000-0000-4000-8000-000000002001'::uuid,'kind-safe exact name resolves brand');
select extensions.is(private.resolve_org('agency','Shared Identity',null,null,null,0.95,pg_temp.m07_item(1)),
 '25000000-0000-4000-8000-000000002002'::uuid,'same spelling cannot cross brand/agency kinds');
select extensions.is(private.resolve_org('brand','Canonical Brandd',null,null,null,0.95,pg_temp.m07_item(1)),
 '25000000-0000-4000-8000-000000002004'::uuid,'deterministic trigram fallback resolves a supported misspelling');
select extensions.ok(has_function_privilege('n8n_writer','ops.apply_extraction(uuid,jsonb,jsonb)','EXECUTE')
 and has_function_privilege('n8n_writer','ops.m07_claim_ai(uuid,integer,integer)','EXECUTE'),'writer can use restricted extraction RPCs');
select extensions.ok(not has_function_privilege('api_agent','ops.apply_extraction(uuid,jsonb,jsonb)','EXECUTE')
 and not has_function_privilege('anon','ops.m07_dispatch_ai(uuid,uuid)','EXECUTE')
 and not has_function_privilege('authenticated','ops.m07_ack_ai(uuid,uuid)','EXECUTE'),'agent and exposed roles cannot mutate extraction');
select extensions.ok(not has_table_privilege('n8n_writer','ops.m07_ai_attempts','SELECT,INSERT,UPDATE,DELETE')
 and not has_table_privilege('n8n_writer','ops.ai_extractions','INSERT')
 and not has_function_privilege('n8n_writer','private.resolve_org(app.org_kind,text,text,app.country_code,text,numeric,uuid)','EXECUTE'),
 'writer cannot bypass receipt and resolution boundaries');
select extensions.ok((select bool_and(relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='ops' and c.relname in('m07_ai_attempts','m07_entity_sightings')),'all new tables enable RLS');
select extensions.ok((select bool_and(prosecdef and proconfig=array['search_path=""']) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='ops' and p.proname in('m07_claim_ai','m07_prepare_ai','m07_dispatch_ai','m07_ai_status','apply_extraction','m07_fail_ai','m07_ack_ai')),
 'restricted RPCs use security definer with empty search path');

-- Temporarily hide existing local deliveries without deleting or settling them.
update pgmq.q_ai_extract set vt=now()+interval '1 day';
select pgmq.send('ai_extract',jsonb_build_object('item_id',pg_temp.m07_item(n),'synthetic',true)) from generate_series(1,12) n;
set local role n8n_writer;
select set_config('test.m07.claim',ops.m07_claim_ai('25000000-0000-4000-8000-000000009001',20,600)::text,true);
select extensions.is(jsonb_array_length(current_setting('test.m07.claim')::jsonb->'messages'),12,'actual restricted claim owns each synthetic queue delivery');
select extensions.is(ops.m07_claim_ai('25000000-0000-4000-8000-000000009001',20,600)->'messages',
 current_setting('test.m07.claim')::jsonb->'messages','same owner replays original attempts without another queue claim');
select extensions.throws_ok($$select ops.m07_prepare_ai(pg_temp.m07_attempt(1),'25000000-0000-4000-8000-000000009002','m07-controlled','extract_item.v1','item_extraction.v1')$$,
 '42501',null,'foreign owner cannot prepare');
select extensions.throws_ok($$select ops.m07_prepare_ai(pg_temp.m07_attempt(1),'25000000-0000-4000-8000-000000009001','no-pricing','extract_item.v1','item_extraction.v1')$$,
 '22023',null,'missing price blocks before provider dispatch');
select extensions.throws_ok($$select ops.m07_prepare_ai(pg_temp.m07_attempt(1),'25000000-0000-4000-8000-000000009001','m07-wrong-unit','extract_item.v1','item_extraction.v1')$$,
 '22023',null,'incompatible billing unit blocks before provider dispatch');
do $$begin for n in 1..12 loop perform ops.m07_prepare_ai(pg_temp.m07_attempt(n),'25000000-0000-4000-8000-000000009001',
 'm07-controlled','extract_item.v1','item_extraction.v1');end loop;end$$;
select extensions.is(length(ops.get_items_for_ai(array[pg_temp.m07_item(1)])#>>'{0,item,caption_original}'),6000,'caption input bounded at6000');
select extensions.is(length(ops.get_items_for_ai(array[pg_temp.m07_item(1)])#>>'{0,item,markdown}'),6000,'website markdown context bounded at6000');
select extensions.is(length(ops.get_items_for_ai(array[pg_temp.m07_item(1)])#>>'{0,item,credits_text}'),6000,'credit context bounded at6000');
select extensions.ok((ops.get_taxonomy_snapshot()->'content_format')?'tvc_brand_film','runtime reads active taxonomy codes');
select extensions.throws_ok($$select ops.m07_prepare_ai(pg_temp.m07_attempt(1),'25000000-0000-4000-8000-000000009001','different-model','extract_item.v1','item_extraction.v1')$$,
 '22023',null,'admitted model configuration is immutable');
select extensions.is(ops.m07_dispatch_ai(pg_temp.m07_attempt(1),'25000000-0000-4000-8000-000000009001')->>'admitted','true','first dispatch is admitted');
select extensions.is(ops.m07_dispatch_ai(pg_temp.m07_attempt(1),'25000000-0000-4000-8000-000000009001')->>'admitted','false','replayed dispatch cannot call model twice');
do $$begin for n in 2..12 loop perform ops.m07_dispatch_ai(pg_temp.m07_attempt(n),'25000000-0000-4000-8000-000000009001');end loop;end$$;
select extensions.throws_ok($$select ops.apply_extraction(pg_temp.m07_item(2),pg_temp.m07_result(),pg_temp.m07_meta(1))$$,
 '42501',null,'provider response cannot cross item ownership');
select extensions.throws_ok($$select ops.apply_extraction(pg_temp.m07_item(1),pg_temp.m07_result(),pg_temp.m07_meta(1)||'{"owner_id":"25000000-0000-4000-8000-000000009002"}')$$,
 '42501',null,'foreign owner cannot settle');
select set_config('test.m07.result',ops.apply_extraction(pg_temp.m07_item(1),pg_temp.m07_result(),pg_temp.m07_meta(1))::text,true);
select extensions.is(current_setting('test.m07.result')::jsonb->>'state','completed','successful settlement returns terminal native receipt');
select extensions.is(current_setting('test.m07.result')::jsonb#>>'{result,ai_status}','published','high-confidence commercial work publishes');
select extensions.is(current_setting('test.m07.result')::jsonb#>>'{result,brand_id}','25000000-0000-4000-8000-000000002001','handle resolution is brand-kind safe');
select extensions.is(current_setting('test.m07.result')::jsonb#>>'{result,agency_id}','25000000-0000-4000-8000-000000002002','handle resolution is agency-kind safe');
select extensions.is(current_setting('test.m07.result')::jsonb#>>'{result,production_competitor_id}','25000000-0000-4000-8000-000000001002','production competitor resolves known alias');
select extensions.is((current_setting('test.m07.result')::jsonb#>>'{result,cost_usd}')::numeric,0.003200::numeric,'cached and uncached usage uses frozen prices at six decimals');
select extensions.is(ops.apply_extraction(pg_temp.m07_item(1),pg_temp.m07_result(),pg_temp.m07_meta(1))->>'replayed','true','exact response replay recovers original result');
select extensions.throws_ok($$select ops.apply_extraction(pg_temp.m07_item(1),pg_temp.m07_result()||'{"summary_en":"changed"}',pg_temp.m07_meta(1))$$,
 '22023',null,'same attempt rejects changed extraction payload');
select extensions.throws_ok($$select ops.apply_extraction(pg_temp.m07_item(1),pg_temp.m07_result(),pg_temp.m07_meta(1)||'{"latency_ms":18}')$$,
 '22023',null,'same attempt rejects changed metadata');
select extensions.is(ops.m07_ack_ai(pg_temp.m07_attempt(1),'25000000-0000-4000-8000-000000009001')->>'acked','true','settled delivery can be durably archived');
select extensions.is(ops.m07_ack_ai(pg_temp.m07_attempt(1),'25000000-0000-4000-8000-000000009001')->>'replayed','true','ACK replay is harmless');
select extensions.is(ops.m07_prepare_ai(pg_temp.m07_attempt(1),'25000000-0000-4000-8000-000000009001','m07-controlled','extract_item.v1','item_extraction.v1')->>'state',
 'completed','completed replay retains prepared native context without redispatch');
reset role;
select extensions.is((select count(*)::int from ops.ai_extractions where attempt_id=pg_temp.m07_attempt(1)),1,'replay adds no extraction row');
select extensions.is((select count(*)::int from ops.cost_ledger where meta->>'ai_attempt_id'=pg_temp.m07_attempt(1)::text),1,'replay charges exactly once');
select extensions.is((select count(*)::int from pgmq.q_embed where message->>'attempt_id'=pg_temp.m07_attempt(1)::text),1,'replay enqueues one embedding follow-up');
select extensions.is((select count(*)::int from app.item_credits where item_id=pg_temp.m07_item(1)),2,'person and production-company credits resolve once');
select extensions.is((select title from app.items where id=pg_temp.m07_item(1)),'Preserved title','unrelated collected fields are preserved');

-- New organization sighting on one item, then another explicit attempt of that
-- same item: attempts/costs are distinct, but entity confirmation is not.
select set_config('test.m07.fresh',(pg_temp.m07_result()||'{"brand":{"name":"Distinct Fresh Brand","handle":"distinctfreshbrand","industry":"telecom","country":"EG"},"agency":null,"credits":[]}')::text,true);
set local role n8n_writer;
select ops.apply_extraction(pg_temp.m07_item(2),current_setting('test.m07.fresh')::jsonb,pg_temp.m07_meta(2));
reset role;
select extensions.is((select seen_count from app.organizations where slug like 'ai-%' and name='Distinct Fresh Brand'),1,'first distinct item increments sighting once');
select extensions.is((select status::text from app.organizations where name='Distinct Fresh Brand'),'unconfirmed','one item does not auto-confirm');
insert into ops.m07_ai_attempts(id,owner_id,item_id,msg_id,read_ct,lease_until)
 select '25000000-0000-4000-8000-000000008002','25000000-0000-4000-8000-000000009003',pg_temp.m07_item(2),msg_id,1,now()+interval '10 minutes'
 from ops.m07_ai_attempts where id=pg_temp.m07_attempt(2);
set local role n8n_writer;
select ops.m07_prepare_ai('25000000-0000-4000-8000-000000008002','25000000-0000-4000-8000-000000009003','m07-controlled','extract_item.v1','item_extraction.v1');
select ops.m07_dispatch_ai('25000000-0000-4000-8000-000000008002','25000000-0000-4000-8000-000000009003');
select ops.apply_extraction(pg_temp.m07_item(2),current_setting('test.m07.fresh')::jsonb,
 pg_temp.m07_meta(2)||'{"attempt_id":"25000000-0000-4000-8000-000000008002","owner_id":"25000000-0000-4000-8000-000000009003","provider_response_id":"resp_m07_2_new"}');
reset role;
select extensions.is((select seen_count from app.organizations where name='Distinct Fresh Brand'),1,'new attempt of same item is not a new entity sighting');
select extensions.is((select count(*)::int from ops.ai_extractions where item_id=pg_temp.m07_item(2)),2,'explicit new attempt has separately attributable receipt');
select extensions.is((select count(*)::int from app.review_tasks where entity_type='organization' and entity_id=(select id::text from app.organizations where name='Distinct Fresh Brand')),1,'attempt replay does not duplicate organization review');
set local role n8n_writer;
select ops.apply_extraction(pg_temp.m07_item(3),current_setting('test.m07.fresh')::jsonb,pg_temp.m07_meta(3));
reset role;
select extensions.is((select seen_count from app.organizations where name='Distinct Fresh Brand'),2,'second distinct item establishes second sighting');
select extensions.is((select status::text from app.organizations where name='Distinct Fresh Brand'),'confirmed','second high-confidence item auto-confirms');
select extensions.is((select status::text from app.review_tasks where entity_type='organization' and entity_id=(select id::text from app.organizations where name='Distinct Fresh Brand')),'approved','auto-confirmation resolves existing review');

set local role n8n_writer;
select extensions.is(ops.apply_extraction(pg_temp.m07_item(4),pg_temp.m07_result()||'{"is_commercial_work":false}',pg_temp.m07_meta(4))#>>'{result,ai_status}',
 'skipped','high-confidence noncommercial item is skipped, not deleted');
select extensions.is(ops.apply_extraction(pg_temp.m07_item(5),jsonb_set(pg_temp.m07_result(),'{confidence,overall}','0.4'),pg_temp.m07_meta(5))#>>'{result,ai_status}',
 'review','low confidence routes to review');
select extensions.is(ops.apply_extraction(pg_temp.m07_item(6),pg_temp.m07_result()||'{"needs_vision":true}',pg_temp.m07_meta(6))#>>'{result,ai_status}',
 'review','text-only slice never auto-publishes required vision');
reset role;
select extensions.is((select reason from app.review_tasks where entity_type='item' and entity_id=pg_temp.m07_item(5)::text),'overall','review identifies lowest confidence field');
select extensions.is((select reason from app.review_tasks where entity_type='item' and entity_id=pg_temp.m07_item(6)::text),'vision_pending','unimplemented vision is explicit review reason');
update app.items set locked_fields=array['brand_id','agency_id','production_competitor_id','ai_status','summary_en','credits','confidence'],
 brand_id='25000000-0000-4000-8000-000000002004',agency_id=null,production_competitor_id=competitor_id,ai_status='review',summary_en='Human summary',confidence=0.7
 where id=pg_temp.m07_item(7);
insert into app.item_credits(item_id,person_name_raw,role,source) values(pg_temp.m07_item(7),'Human Director','director','human');
set local role n8n_writer;
select ops.apply_extraction(pg_temp.m07_item(7),pg_temp.m07_result(),pg_temp.m07_meta(7));
reset role;
select extensions.is((select brand_id from app.items where id=pg_temp.m07_item(7)),'25000000-0000-4000-8000-000000002004'::uuid,'human brand lock survives extraction');
select extensions.ok((select agency_id is null and production_competitor_id=competitor_id from app.items where id=pg_temp.m07_item(7)),'null agency and production locks remain authoritative');
select extensions.is((select ai_status::text from app.items where id=pg_temp.m07_item(7)),'review','human status lock survives extraction');
select extensions.is((select summary_en from app.items where id=pg_temp.m07_item(7)),'Human summary','human text lock survives extraction');
select extensions.is((select confidence from app.items where id=pg_temp.m07_item(7)),0.700::numeric,'human confidence lock survives extraction');
select extensions.is((select count(*)::int from app.item_credits where item_id=pg_temp.m07_item(7)),1,'locked credits are not changed or expanded');
select extensions.is((select source from app.item_credits where item_id=pg_temp.m07_item(7)),'human','human credit provenance is preserved');

set local role n8n_writer;
select extensions.throws_ok($$select ops.apply_extraction(pg_temp.m07_item(10),pg_temp.m07_result(),pg_temp.m07_meta(10)||'{"provider_response_id":"resp_m07_1"}')$$,
 '23505',null,'one provider response cannot be billed or assigned to another attempt');
select extensions.throws_ok($$select ops.apply_extraction(pg_temp.m07_item(11),jsonb_set(pg_temp.m07_result(),'{confidence,overall}','1.1'),pg_temp.m07_meta(11))$$,
 '22023',null,'invalid confidence is rejected by SQL boundary');
select extensions.throws_ok($$select ops.apply_extraction(pg_temp.m07_item(11),pg_temp.m07_result()||'{"extra":true}',pg_temp.m07_meta(11))$$,
 '22023',null,'extra output properties are rejected by SQL boundary');
select extensions.throws_ok($$select ops.apply_extraction(pg_temp.m07_item(11),jsonb_set(pg_temp.m07_result(),'{brand,industry}','17'),pg_temp.m07_meta(11))$$,
 '22023',null,'nested taxonomy values retain strict JSON string types');
select extensions.throws_ok($$select ops.apply_extraction(pg_temp.m07_item(12),pg_temp.m07_result(),pg_temp.m07_meta(12)||'{"raw_provider_payload":"must-not-persist"}')$$,
 '22023',null,'accounting metadata cannot persist undeclared provider/private payloads');
select extensions.throws_ok($$select ops.apply_extraction(pg_temp.m07_item(12),pg_temp.m07_result(),pg_temp.m07_meta(12)||'{"cost_usd":0.004}')$$,
 '22023',null,'SQL recomputes and rejects inconsistent cost');
select extensions.throws_ok($$select ops.apply_extraction(pg_temp.m07_item(12),pg_temp.m07_result(),pg_temp.m07_meta(12)||'{"cached_tokens":1001}')$$,
 '22023',null,'cached usage cannot exceed total input');
select extensions.throws_ok($$select ops.m07_ack_ai(pg_temp.m07_attempt(10),'25000000-0000-4000-8000-000000009001')$$,
 '55000',null,'uncertain or failed settlement cannot ACK delivery');
select extensions.is(ops.m07_fail_ai(pg_temp.m07_attempt(9),'25000000-0000-4000-8000-000000009001','refused',pg_temp.m07_meta(9))->>'state',
 'failed','known refusal records failed terminal attempt');
select extensions.is(ops.m07_fail_ai(pg_temp.m07_attempt(9),'25000000-0000-4000-8000-000000009001','refused',pg_temp.m07_meta(9))->>'replayed',
 'true','known refusal replay does not double charge');
select set_config('test.m07.unknown',(pg_temp.m07_meta(8)||'{"usage_known":false,"provider_response_id":null,"input_tokens":null,"output_tokens":null,"cached_tokens":null,"cost_usd":null}')::text,true);
select extensions.is(ops.m07_fail_ai(pg_temp.m07_attempt(8),'25000000-0000-4000-8000-000000009001','unknown',current_setting('test.m07.unknown')::jsonb)->>'state',
 'unknown','uncertain provider outcome is durably held');
select extensions.is(ops.m07_dispatch_ai(pg_temp.m07_attempt(8),'25000000-0000-4000-8000-000000009001')->>'admitted','false','unknown outcome never admits a replacement call');
select extensions.throws_ok($$select ops.m07_fail_ai(pg_temp.m07_attempt(8),'25000000-0000-4000-8000-000000009001','unknown',current_setting('test.m07.unknown')::jsonb||'{"cost_usd":0}')$$,
 '22023',null,'unknown usage cannot be replaced with fabricated zero');
select extensions.throws_ok($$select ops.m07_ai_status(pg_temp.m07_attempt(8),'25000000-0000-4000-8000-000000009002')$$,
 '42501',null,'foreign owner cannot retrieve receipt');
select extensions.throws_ok($$select ops.fail_ai_items(array[pg_temp.m07_item(8)],array[(current_setting('test.m07.claim')::jsonb#>>'{messages,7,msg_id}')::bigint])$$,
 '42501',null,'retry exhaustion cannot discard an uncertain provider outcome');
reset role;
select extensions.is((select count(*)::int from ops.cost_ledger where meta->>'ai_attempt_id'=pg_temp.m07_attempt(9)::text),1,'refusal usage charges once');
select extensions.is((select ai_status::text from app.items where id=pg_temp.m07_item(9)),'pending','known refusal restores pending status before retry exhaustion');
select extensions.is((select count(*)::int from ops.cost_ledger where meta->>'ai_attempt_id'=pg_temp.m07_attempt(8)::text),0,'unknown outcome creates no fabricated cost row');
select extensions.ok((select result->'cost_usd'='null'::jsonb and not usage_known from ops.m07_ai_attempts where id=pg_temp.m07_attempt(8)),'unknown usage stays null in durable receipt');
select extensions.is((select count(*)::int from ops.ai_extractions where item_id in(pg_temp.m07_item(10),pg_temp.m07_item(11),pg_temp.m07_item(12))),0,'failed identity/schema/cost writes roll back every extraction side effect');
select extensions.is((select count(*)::int from ops.cost_ledger where item_id in(pg_temp.m07_item(10),pg_temp.m07_item(11),pg_temp.m07_item(12)) and category='ai_extract'),0,'failed settlement charges nothing');
select extensions.is((select count(*)::int from pgmq.q_embed where message->>'entity_id' in(pg_temp.m07_item(10)::text,pg_temp.m07_item(11)::text,pg_temp.m07_item(12)::text)),0,'failed settlement schedules no embeddings');
select extensions.ok((select bool_and(acked_at is null) from ops.m07_ai_attempts where item_id in(pg_temp.m07_item(8),pg_temp.m07_item(9),pg_temp.m07_item(10))),'held/failed work remains identifiable and unacknowledged');

-- Known provider failures are terminal receipts, not automatic retry permits.
-- Neither expiry of queue visibility nor a second ordinary delivery may turn
-- them into another paid attempt. Remediation needs explicit fresh intent.
update pgmq.q_ai_extract set vt=now() where msg_id=(select msg_id from ops.m07_ai_attempts where id=pg_temp.m07_attempt(9));
set local role n8n_writer;
select set_config('test.m07.failed_redelivery',ops.m07_claim_ai('25000000-0000-4000-8000-000000009008',1,600)::text,true);
select extensions.is(current_setting('test.m07.failed_redelivery')::jsonb#>>'{messages,0,state}',
 'held','known refusal redelivery cannot implicitly authorize another provider call');
select extensions.is(current_setting('test.m07.failed_redelivery')::jsonb#>>'{messages,0,attempt_id}',
 pg_temp.m07_attempt(9)::text,'failed redelivery preserves original attempt identity');
reset role;
select pgmq.send('ai_extract',jsonb_build_object('item_id',pg_temp.m07_item(9)));
set local role n8n_writer;
select extensions.is(ops.m07_claim_ai('25000000-0000-4000-8000-000000009009',1,600)#>>'{messages,0,state}',
 'held','ordinary duplicate item after refusal also cannot authorize another provider call');
reset role;
select extensions.is((select count(*)::int from ops.m07_ai_attempts where item_id=pg_temp.m07_item(9)),1,'failed redelivery and duplicate keep one charged attempt');
select extensions.is((select count(*)::int from ops.cost_ledger where item_id=pg_temp.m07_item(9) and category='ai_extract'),1,'failed redelivery does not reset or add cost');
select pgmq.send('ai_extract',jsonb_build_object('item_id',pg_temp.m07_item(9),'reextract',true,
 'reextract_nonce','25000000-0000-4000-8000-000000007009'));
set local role n8n_writer;
select extensions.is(ops.m07_claim_ai('25000000-0000-4000-8000-000000009010',1,600)#>>'{messages,0,state}',
 'claimed','explicit new intent can remediate a known failed attempt');
reset role;
select pgmq.send('ai_extract',jsonb_build_object('item_id',pg_temp.m07_item(8),'reextract',true,
 'reextract_nonce','25000000-0000-4000-8000-000000007008'));
set local role n8n_writer;
select extensions.is(ops.m07_claim_ai('25000000-0000-4000-8000-000000009011',1,600)#>>'{messages,0,state}',
 'held','even explicit new intent cannot replace an unresolved provider outcome');
reset role;

-- A duplicate delivery is different from a deliberate, uniquely identified
-- re-extraction request. Neither queue redelivery nor an owner retry grants a
-- second paid start for the original attempt.
select pgmq.send('ai_extract',jsonb_build_object('item_id',pg_temp.m07_item(1)));
set local role n8n_writer;
select extensions.is(ops.m07_claim_ai('25000000-0000-4000-8000-000000009004',1,600)#>>'{messages,0,state}',
 'reconciled','ordinary new delivery of completed item does not create another attempt');
reset role;
select extensions.is((select count(*)::int from ops.m07_ai_attempts where item_id=pg_temp.m07_item(1)),1,'duplicate delivery adds no provider dispatch identity');
select pgmq.send('ai_extract',jsonb_build_object('item_id',pg_temp.m07_item(1),'reextract',true,
 'reextract_nonce','25000000-0000-4000-8000-000000007001'));
set local role n8n_writer;
select set_config('test.m07.intent',ops.m07_claim_ai('25000000-0000-4000-8000-000000009005',1,600)::text,true);
select extensions.is(current_setting('test.m07.intent')::jsonb#>>'{messages,0,state}','claimed','explicit unique re-extraction is separately attributable');
select ops.m07_prepare_ai((current_setting('test.m07.intent')::jsonb#>>'{messages,0,attempt_id}')::uuid,
 '25000000-0000-4000-8000-000000009005','m07-controlled','extract_item.v1','item_extraction.v1');
select ops.m07_dispatch_ai((current_setting('test.m07.intent')::jsonb#>>'{messages,0,attempt_id}')::uuid,
 '25000000-0000-4000-8000-000000009005');
select ops.apply_extraction(pg_temp.m07_item(1),pg_temp.m07_result(),pg_temp.m07_meta(1)||jsonb_build_object(
 'attempt_id',current_setting('test.m07.intent')::jsonb#>>'{messages,0,attempt_id}',
 'owner_id','25000000-0000-4000-8000-000000009005','provider_response_id','resp_m07_intent_1'));
select ops.m07_ack_ai((current_setting('test.m07.intent')::jsonb#>>'{messages,0,attempt_id}')::uuid,
 '25000000-0000-4000-8000-000000009005');
reset role;
select pgmq.send('ai_extract',jsonb_build_object('item_id',pg_temp.m07_item(1),'reextract',true,
 'reextract_nonce','25000000-0000-4000-8000-000000007001'));
set local role n8n_writer;
select extensions.is(ops.m07_claim_ai('25000000-0000-4000-8000-000000009006',1,600)#>>'{messages,0,state}',
 'reconciled','replayed explicit nonce maps to original completed attempt');
reset role;
select extensions.is((select count(*)::int from ops.m07_ai_attempts where item_id=pg_temp.m07_item(1)),2,'same re-extraction nonce creates no third attempt');
select extensions.is((select count(*)::int from ops.cost_ledger where item_id=pg_temp.m07_item(1) and category='ai_extract'),2,'intentional attempt charges separately but duplicate intent does not');
select pgmq.send('ai_extract',jsonb_build_object('item_id',pg_temp.m07_item(1),'reextract',true,
 'reextract_nonce','25000000-0000-4000-8000-000000007002'));
set local role n8n_writer;
select extensions.is(ops.m07_claim_ai('25000000-0000-4000-8000-000000009007',1,600)#>>'{messages,0,state}',
 'claimed','a deliberate new nonce can create a new attempt');
reset role;
select * from extensions.finish();
rollback;
