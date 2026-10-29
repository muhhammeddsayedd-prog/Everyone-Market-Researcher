-- Controlled local responses. No model, hosted queue, campaign or schedule IO.
begin;
set local statement_timeout='30s';
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select extensions.no_plan();
grant n8n_writer,api_agent to postgres with inherit false;
grant n8n_writer,api_agent to postgres with set true;

create function pg_temp.e(n int) returns uuid language sql immutable as $$
  select ('26000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
$$;
create function pg_temp.b(n int) returns uuid language sql stable as $$
  select current_setting('test.embed.batch'||n)::uuid;
$$;
create function pg_temp.h(n int) returns text language sql stable as $$
  select current_setting('test.embed.hash'||n);
$$;
create function pg_temp.settings() returns jsonb language sql immutable as $$
  select '{"max_input_bytes":4096,"max_total_bytes":12000,"accounting_mode":"simulated"}'::jsonb;
$$;
create function pg_temp.selection() returns jsonb language sql immutable as $$
  select jsonb_build_array(jsonb_build_object('entity_type','item','entity_id',pg_temp.e(1)),
    jsonb_build_object('entity_type','competitor','entity_id',pg_temp.e(100)),
    jsonb_build_object('entity_type','organization','entity_id',pg_temp.e(200)));
$$;
create function pg_temp.response(n int,tokens int default 900,model text default 'controlled-embed') returns jsonb
language sql immutable as $$
  select jsonb_build_object('object','list','model',model,'usage',jsonb_build_object('prompt_tokens',tokens,'total_tokens',tokens),
    'data',(select coalesce(jsonb_agg(jsonb_build_object('object','embedding','index',i,
      'embedding',to_jsonb(array[(i+1)::numeric,0.12345678912345678::numeric]||array_fill(0::numeric,array[1534]))) order by i desc),'[]'::jsonb)
      from generate_series(0,n-1) i));
$$;

select extensions.ok((select bool_and(relrowsecurity) from pg_class where oid=any(array[
  'ops.m07_ai_snapshots'::regclass,'ops.m07_embed_batches'::regclass,'ops.m07_embed_members'::regclass])),
  'all new private tables enable RLS');
select extensions.ok(not has_table_privilege('n8n_writer','ops.m07_embed_batches','INSERT,UPDATE,DELETE')
  and not has_table_privilege('api_agent','ops.m07_ai_snapshots','SELECT'),'machines have no direct snapshot/state grants');
select extensions.ok(not has_function_privilege('anon','ops.m07_settle_embed(uuid,uuid,jsonb,text,text)','EXECUTE')
  and has_function_privilege('n8n_writer','ops.m07_settle_embed(uuid,uuid,jsonb,text,text)','EXECUTE'),
  'settlement is restricted to writer RPC');
select extensions.ok(not has_function_privilege('n8n_writer','private.m07_embedding_input(text,uuid,integer)','EXECUTE'),
  'text internals are not machine entry points');
select extensions.is((select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='ops' and p.proname in('m07_freeze_ai','m07_frozen_ai','m07_dispatch_frozen_ai','m07_apply_frozen_ai',
    'm07_fail_frozen_ai','m07_claim_embed','m07_prepare_embed','m07_dispatch_embed','m07_settle_embed','m07_ack_embed')
  and (not p.prosecdef or not p.proconfig@>array['search_path=""'])),0,'new RPCs are private definers with empty search path');

update pgmq.q_embed set vt=now()+interval '1 day';
update pgmq.q_ai_extract set vt=now()+interval '1 day';
insert into app.competitors(id,company_code,slug,name,priority_tier,categories,in_house)
values(pg_temp.e(100),'M07E26','m07-e26','Controlled embedding studio','pilot',array['z-category','a-category'],array['edit','camera']);
insert into app.competitor_accounts(id,competitor_id,platform,handle,url)
values(pg_temp.e(101),pg_temp.e(100),'vimeo','m07-e26','https://vimeo.com/m07-e26');
insert into app.organizations(id,kind,name,slug,industry)
values(pg_temp.e(200),'brand','Controlled embedding brand','m07-e26-brand','telecom');
insert into app.org_aliases(org_id,alias,alias_normalized,source)
values(pg_temp.e(200),'Zed','zed','human'),(pg_temp.e(200),'Alpha','alpha','human');
insert into app.items(id,competitor_id,account_id,platform,item_type,external_id,url,title,summary_en,caption_original,
  published_at,tags,brand_id,ai_status)
select pg_temp.e(i),pg_temp.e(100),pg_temp.e(101),'vimeo','video','M07E26-'||i,'https://vimeo.com/'||i,
  'Title '||i,'Summary '||i,'Caption '||i,'2026-10-01Z'::timestamptz+make_interval(days=>i),array['z','a'],pg_temp.e(200),'published'
from generate_series(1,21) i;
update app.items set caption_en='' where id=pg_temp.e(1);
insert into ops.price_book(provider,sku,unit,usd_per_unit) values
 ('openai','controlled-embed','1M tokens',0.02),('openai','controlled-alternate','1M tokens',0.03),
 ('openai','controlled-extract:input','1M tokens',2),('openai','controlled-extract:cached_input','1M tokens',0.5),
 ('openai','controlled-extract:output','1M tokens',8);

select extensions.is(private.m07_embedding_input('item',pg_temp.e(1),4096)->>'text',
 E'Title 1\nSummary 1\nCaption 1\nControlled embedding brand\nControlled embedding studio\na, z',
 'item input uses stable ordering and original caption when translation is empty');
select extensions.is(private.m07_embedding_input('organization',pg_temp.e(200),4096)->>'text',
 E'Controlled embedding brand\ntelecom\nAlpha\nZed','organization aliases have stable ordering');
select extensions.ok(position('Summary 21' in(private.m07_embedding_input('competitor',pg_temp.e(100),4096)->>'text'))
  <position('Summary 20' in(private.m07_embedding_input('competitor',pg_temp.e(100),4096)->>'text')),
  'competitor summaries are newest first');
select extensions.ok((private.m07_embedding_input('competitor',pg_temp.e(100),4096)->>'text')!~'Summary 1($|\n)',
  'competitor text uses last20 item summaries, not a later campaign dependency');
select extensions.ok(octet_length(private.m07_utf8_prefix(repeat(U&'\0645\062D\0645\0648\062F',30),17))<=17,
  'UTF8 byte limit preserves valid Arabic text');
select extensions.is(private.m07_embedding_input('campaign',pg_temp.e(201),4096)->>'reason','deferred_entity_type',
  'campaign inputs are explicitly deferred');

-- Selected extraction claim cannot touch unrelated queue work.
select pgmq.send('ai_extract',jsonb_build_object('item_id',pg_temp.e(2)));
select set_config('test.ai.unrelated',(select to_jsonb(q)::text from pgmq.q_ai_extract q where message->>'item_id'=pg_temp.e(2)::text),true);
select pgmq.send('ai_extract',jsonb_build_object('item_id',pg_temp.e(1)));
set local role n8n_writer;
select set_config('test.ai.claim',ops.m07_claim_ai_selected(pg_temp.e(1001),array[pg_temp.e(1)],1,600)::text,true);
select extensions.is(current_setting('test.ai.claim')::jsonb#>>'{messages,0,item_id}',pg_temp.e(1)::text,'selected AI claim chooses exact allowed item');
select set_config('test.ai.id',current_setting('test.ai.claim')::jsonb#>>'{messages,0,attempt_id}',true);
select set_config('test.ai.prepared',ops.m07_prepare_ai(current_setting('test.ai.id')::uuid,pg_temp.e(1001),
  'controlled-extract','extract_item.v1','item_extraction.v1')::text,true);
reset role;
select extensions.is((select to_jsonb(q) from pgmq.q_ai_extract q where message->>'item_id'=pg_temp.e(2)::text),
  current_setting('test.ai.unrelated')::jsonb,'selected claim preserves unrelated AI visibility and read counter');
select set_config('test.ai.snapshot',jsonb_build_object('version',1,'kind','extraction',
  'provider_request',jsonb_build_object('model','controlled-extract','input',jsonb_build_array(),
    'max_output_tokens',1000,'store',false,'stream',false,'text',jsonb_build_object('format',jsonb_build_object('type','json_schema','strict',true,'schema','{"type":"object"}'::jsonb))),
  'context',current_setting('test.ai.prepared')::jsonb->'context','taxonomy',current_setting('test.ai.prepared')::jsonb->'taxonomy',
  'prompt',jsonb_build_object('version','extract_item.v1','content','Controlled prompt'),
  'schema',jsonb_build_object('version','item_extraction.v1','content','{"type":"object"}'::jsonb),
  'config',jsonb_build_object('model','controlled-extract','max_output_tokens',1000,'accounting_mode','simulated'),
  'prices',current_setting('test.ai.prepared')::jsonb->'prices')::text,true);
set local role n8n_writer;
select set_config('test.ai.frozen',ops.m07_freeze_ai(current_setting('test.ai.id')::uuid,pg_temp.e(1001),current_setting('test.ai.snapshot')::jsonb)::text,true);
select extensions.ok(current_setting('test.ai.frozen')::jsonb->>'request_hash'~'^[a-f0-9]{64}$','SQL records canonical immutable AI snapshot hash');
select extensions.is(current_setting('test.ai.frozen')::jsonb#>>'{snapshot,routing,auto_publish_threshold}','0.80','routing threshold is admitted by SQL');
reset role;
update app.items set caption_original='Changed after preparation' where id=pg_temp.e(1);
update app.taxonomy_terms set active=false where taxonomy='content_format' and code='tvc_brand_film';
update ops.settings set value='0.99' where key='auto_publish_threshold';
update ops.price_book set usd_per_unit=99 where provider='openai' and sku='controlled-extract:input';
set local role n8n_writer;
select extensions.is(ops.m07_freeze_ai(current_setting('test.ai.id')::uuid,pg_temp.e(1001),
  jsonb_set(current_setting('test.ai.snapshot')::jsonb,'{config,max_output_tokens}','4000'))->'snapshot',
  current_setting('test.ai.frozen')::jsonb->'snapshot','preparation replay returns admitted context/config/taxonomy/price');
select extensions.throws_ok($$select ops.m07_dispatch_frozen_ai(current_setting('test.ai.id')::uuid,pg_temp.e(1001),'wrong')$$,
  '42501',null,'dispatch rejects mismatched request hash');
select extensions.is(ops.m07_dispatch_frozen_ai(current_setting('test.ai.id')::uuid,pg_temp.e(1001),
  current_setting('test.ai.frozen')::jsonb->>'request_hash')->>'admitted','true','frozen extraction dispatches exactly once');
select extensions.is(ops.m07_dispatch_frozen_ai(current_setting('test.ai.id')::uuid,pg_temp.e(1001),
  current_setting('test.ai.frozen')::jsonb->>'request_hash')->>'admitted','false','same extraction snapshot cannot redispatch');
reset role;
-- Fixture output is inserted below by the test source, not generated by a model.
select set_config('test.ai.result','{"is_commercial_work":true,"content_type":"tvc_brand_film","brand":null,"agency":null,"production_house":{"is_posting_competitor":true,"other_name":null},"credits":[],"campaign_title":null,"country":"EG","language":"en","occasion":null,"summary_en":"Controlled response","summary_ar":"Controlled response","caption_en":null,"tags":[],"needs_vision":false,"confidence":{"overall":0.94,"is_commercial_work":0.99,"brand":0.9,"agency":0.9,"production_house":0.99,"credits":0.9,"content_type":0.95,"country":0.9,"occasion":0.9},"evidence":{"brand":null,"agency":null,"credits":null,"production_house":"Controlled"}}',true);
select set_config('test.ai.meta',jsonb_build_object('attempt_id',current_setting('test.ai.id'),'owner_id',pg_temp.e(1001),
  'model','controlled-extract','prompt_version','extract_item.v1','schema_version','item_extraction.v1','provider_response_id','resp_frozen26',
  'input_tokens',1000,'output_tokens',200,'cached_tokens',400,'cost_usd',0.003,'usage_known',true,'used_vision',false,
  'latency_ms',0,'accounting_mode','simulated')::text,true);
set local role n8n_writer;
select extensions.is(ops.m07_apply_frozen_ai(pg_temp.e(1),current_setting('test.ai.result')::jsonb,current_setting('test.ai.meta')::jsonb,
  current_setting('test.ai.frozen')::jsonb->>'request_hash')#>>'{result,ai_status}','published',
  'settlement honors admitted taxonomy and threshold after both changed');
select extensions.is(ops.m07_apply_frozen_ai(pg_temp.e(1),current_setting('test.ai.result')::jsonb,current_setting('test.ai.meta')::jsonb,
  current_setting('test.ai.frozen')::jsonb->>'request_hash')->>'replayed','true','frozen extraction replay is still cost-once');
reset role;
select extensions.is((select count(*)::int from ops.cost_ledger where meta->>'ai_attempt_id'=current_setting('test.ai.id')),1,'immutable extraction ledger has one entry');
-- Restore this controlled item's embedding text before preparing its vectors.
update app.items set title='Title 1',summary_en='Summary 1',caption_original='Caption 1',caption_en=null,
  brand_id=pg_temp.e(200),content_type=null,occasion=null,tags=array['z','a'] where id=pg_temp.e(1);
-- The extraction produced an embed delivery; use that actual queue row plus
-- another duplicate, then competitor and organization mappings in one request.
select pgmq.send('embed',jsonb_build_object('entity_type','item','entity_id',pg_temp.e(1)));
select pgmq.send('embed',jsonb_build_object('entity_type','competitor','entity_id',pg_temp.e(100)));
select pgmq.send('embed',jsonb_build_object('entity_type','organization','entity_id',pg_temp.e(200)));
select pgmq.send('embed',jsonb_build_object('entity_type','campaign','entity_id',pg_temp.e(201)));
select set_config('test.embed.unrelated',(select to_jsonb(q)::text from pgmq.q_embed q where message->>'entity_type'='campaign' and message->>'entity_id'=pg_temp.e(201)::text),true);
set local role n8n_writer;
select set_config('test.embed.claim1',ops.m07_claim_embed(pg_temp.e(1101),20,600,pg_temp.selection())::text,true);
select set_config('test.embed.batch1',current_setting('test.embed.claim1')::jsonb->>'batch_id',true);
select extensions.is(jsonb_array_length(current_setting('test.embed.claim1')::jsonb->'messages'),4,'four selected deliveries claimed without unrelated campaign work');
select extensions.is(ops.m07_claim_embed(pg_temp.e(1102),20,600,pg_temp.selection())->>'state','held','another owner cannot overlap an unsettled provider batch');
select extensions.is(ops.m07_claim_embed(pg_temp.e(1101),20,600,pg_temp.selection())->>'batch_id',pg_temp.b(1)::text,'same owner claim replays its original batch');
select set_config('test.embed.prepared1',ops.m07_prepare_embed(pg_temp.b(1),pg_temp.e(1101),'controlled-embed',1536,'embedding_input.v1',pg_temp.settings())::text,true);
select set_config('test.embed.hash1',current_setting('test.embed.prepared1')::jsonb->>'request_hash',true);
select extensions.is(jsonb_array_length(current_setting('test.embed.prepared1')::jsonb#>'{snapshot,mapping}'),3,'duplicate item deliveries map to one provider input');
select extensions.is(jsonb_array_length(current_setting('test.embed.prepared1')::jsonb#>'{snapshot,provider_request,input}'),3,'one request contains three distinct input texts');
select extensions.is(current_setting('test.embed.prepared1')::jsonb#>>'{snapshot,price_source_sku}','controlled-embed','existing unsuffixed embedding price SKU is admitted');
select extensions.is(current_setting('test.embed.prepared1')::jsonb#>>'{snapshot,provider_request,dimensions}','1536','request preserves1536-dimensional database contract');
select extensions.throws_ok($$select ops.m07_dispatch_embed(pg_temp.b(1),pg_temp.e(1101),'wrong')$$,'42501',null,'embedding dispatch rejects a changed snapshot hash');
reset role;
update app.items set caption_original='Changed while request pending' where id=pg_temp.e(1);
set local role n8n_writer;
select extensions.is(ops.m07_prepare_embed(pg_temp.b(1),pg_temp.e(1101),'controlled-alternate',1536,'embedding_input.v1',
  pg_temp.settings()||'{"max_input_bytes":1024}')#>'{snapshot,provider_request}',current_setting('test.embed.prepared1')::jsonb#>'{snapshot,provider_request}',
  'changed environment/settings/source cannot alter prepared embedding input');
select extensions.is(ops.m07_dispatch_embed(pg_temp.b(1),pg_temp.e(1101),pg_temp.h(1))->>'admitted','true','immutable embedding request dispatch admitted once');
select extensions.is(ops.m07_dispatch_embed(pg_temp.b(1),pg_temp.e(1101),pg_temp.h(1))->>'admitted','false','embedding dispatch replay cannot start a second request');
select set_config('test.embed.settled1',ops.m07_settle_embed(pg_temp.b(1),pg_temp.e(1101),
  jsonb_set(jsonb_set(pg_temp.response(3)||'{"diagnostic":"not retained"}',
    '{data,0,not_in_contract}','true'),'{usage,unrelated}','123'),'simulated',pg_temp.h(1))::text,true);
select extensions.is(current_setting('test.embed.settled1')::jsonb->>'state','completed','valid reversed-index output settles');
select extensions.is(current_setting('test.embed.settled1')::jsonb#>>'{result,stored}','2','changed item is stale while current competitor and org vectors store');
select extensions.is(jsonb_array_length(current_setting('test.embed.settled1')::jsonb#>'{result,stale}'),1,'stale source result is durably identified');
select extensions.is(ops.m07_settle_embed(pg_temp.b(1),pg_temp.e(1101),pg_temp.response(3),'simulated',pg_temp.h(1))->>'replayed','true','lost settlement response is recovered without another charge');
select extensions.throws_ok($$select ops.m07_settle_embed(pg_temp.b(1),pg_temp.e(1101),pg_temp.response(3,901),'simulated',pg_temp.h(1))$$,
  '22023',null,'settlement replay cannot replace aggregate usage');
reset role;
select extensions.ok((select accepted_response=pg_temp.response(3) from ops.m07_embed_batches where id=pg_temp.b(1))
  and not(ops.m07_embed_status(pg_temp.b(1),pg_temp.e(1101)) ? 'accepted_response')
  and not has_column_privilege('n8n_writer','ops.m07_embed_batches','accepted_response','SELECT'),
  'durable accepted body is a closed private projection, never a runtime receipt');
select extensions.ok((select (accepted_response#>>'{data,0,embedding,1}')::numeric=0.12345678912345678::numeric
    from ops.m07_embed_batches where id=pg_temp.b(1))
  and (select (embedding::real[])[2]::numeric<>0.12345678912345678::numeric from app.embeddings
    where entity_type='organization' and entity_id=pg_temp.e(200)),
  'accepted JSON precision survives independently from float32 vector storage');
select set_config('test.embed.accepted1',(select accepted_response::text from ops.m07_embed_batches where id=pg_temp.b(1)),true);
set local role n8n_writer;
select extensions.is(ops.m07_settle_embed(pg_temp.b(1),pg_temp.e(1101),current_setting('test.embed.accepted1')::jsonb,
  'simulated',pg_temp.h(1))->>'replayed','true','exact durable projection can replay a closed provider response');
reset role;
select extensions.is((select (embedding::real[])[1] from app.embeddings where entity_type='organization' and entity_id=pg_temp.e(200)),3::real,
  'response index maps vector to entity despite reversed response-array order');
select extensions.is((select count(*)::int from app.embeddings where entity_type='item' and entity_id=pg_temp.e(1)),0,'stale vector does not overwrite current content');
select extensions.is((select count(*)::int from ops.cost_ledger where meta->>'embed_batch_id'=pg_temp.b(1)::text),1,'one provider batch has one aggregate ledger entry');
select extensions.is((select quantity from ops.cost_ledger where meta->>'embed_batch_id'=pg_temp.b(1)::text),900::numeric,'batch usage is not charged once per vector');
select extensions.is((select cost_usd from ops.cost_ledger where meta->>'embed_batch_id'=pg_temp.b(1)::text),0.000018::numeric,'aggregate tokens use admitted price exactly once');
select extensions.ok((select item_id is null and meta->>'accounting_mode'='simulated' from ops.cost_ledger where meta->>'embed_batch_id'=pg_temp.b(1)::text),
  'no invented per-item usage; simulated accounting remains labeled');
select extensions.is((select to_jsonb(q) from pgmq.q_embed q where message->>'entity_type'='campaign' and message->>'entity_id'=pg_temp.e(201)::text),
  current_setting('test.embed.unrelated')::jsonb,'selection preserves unrelated queue message, visibility and read count');

-- A completed delivery may be reconciled by another owner after visibility
-- expires. Its original owner can still ACK the matching archive durably.
update pgmq.q_embed set vt=now() where msg_id in(select msg_id from ops.m07_embed_members where batch_id=pg_temp.b(1));
set local role n8n_writer;
select set_config('test.embed.batch2',ops.m07_claim_embed(pg_temp.e(1102),20,600,pg_temp.selection())->>'batch_id',true);
select set_config('test.embed.prepared2',ops.m07_prepare_embed(pg_temp.b(2),pg_temp.e(1102),'controlled-embed',1536,'embedding_input.v1',pg_temp.settings())::text,true);
select extensions.is(current_setting('test.embed.prepared2')::jsonb->>'state','completed','completed-delivery replay needs no provider request');
select extensions.is(jsonb_array_length(current_setting('test.embed.prepared2')::jsonb#>'{snapshot,mapping}'),0,'completed-delivery replay has no input mapping');
select extensions.is(ops.m07_ack_embed(pg_temp.b(2),pg_temp.e(1102))->>'acked','true','reconciled delivery archives through owned ACK');
select extensions.is(ops.m07_ack_embed(pg_temp.b(1),pg_temp.e(1101))->>'acked','true','original completed owner recognizes exact archived delivery');
select extensions.is(ops.m07_ack_embed(pg_temp.b(1),pg_temp.e(1101))->>'replayed','true','ACK replay is idempotent');
reset role;

-- Unchanged skip includes model/dimensions/input-contract identity.
select pgmq.send('embed',jsonb_build_object('entity_type','organization','entity_id',pg_temp.e(200)));
set local role n8n_writer;
select set_config('test.embed.batch3',ops.m07_claim_embed(pg_temp.e(1103),20,600,pg_temp.selection())->>'batch_id',true);
select set_config('test.embed.prepared3',ops.m07_prepare_embed(pg_temp.b(3),pg_temp.e(1103),'controlled-embed',1536,'embedding_input.v1',pg_temp.settings())::text,true);
select extensions.is(current_setting('test.embed.prepared3')::jsonb->>'state','completed','unchanged model/version skips provider entirely');
select extensions.is(current_setting('test.embed.prepared3')::jsonb#>>'{result,skipped,0,reason}','unchanged','unchanged decision is durable');
select extensions.is(ops.m07_ack_embed(pg_temp.b(3),pg_temp.e(1103))->>'acked','true','unchanged skip ACK requires no provider I/O');
reset role;
select extensions.is((select count(*)::int from ops.cost_ledger where meta->>'embed_batch_id'=pg_temp.b(3)::text),0,'skip-only batch invents no zero-cost provider usage');
select pgmq.send('embed',jsonb_build_object('entity_type','organization','entity_id',pg_temp.e(200)));
set local role n8n_writer;
select set_config('test.embed.batch4',ops.m07_claim_embed(pg_temp.e(1104),20,600,pg_temp.selection())->>'batch_id',true);
select set_config('test.embed.prepared4',ops.m07_prepare_embed(pg_temp.b(4),pg_temp.e(1104),'controlled-alternate',1536,'embedding_input.v1',pg_temp.settings())::text,true);
select set_config('test.embed.hash4',current_setting('test.embed.prepared4')::jsonb->>'request_hash',true);
select extensions.is(current_setting('test.embed.prepared4')::jsonb->>'state','prepared','same text under a different model does not skip');
select ops.m07_dispatch_embed(pg_temp.b(4),pg_temp.e(1104),pg_temp.h(4));
select extensions.is(ops.m07_unknown_embed(pg_temp.b(4),pg_temp.e(1104),pg_temp.h(4))->>'state','unknown','uncertain provider outcome is held');
select extensions.is(ops.m07_dispatch_embed(pg_temp.b(4),pg_temp.e(1104),pg_temp.h(4))->>'admitted','false','uncertainty never grants another embedding start');
select extensions.throws_ok($$select ops.m07_ack_embed(pg_temp.b(4),pg_temp.e(1104))$$,'55000',null,'unknown usage cannot ACK');
select extensions.is(ops.m07_claim_embed(pg_temp.e(1199),20,600,pg_temp.selection())->>'state','held','unknown request blocks a replacement batch');
select extensions.is(ops.m07_settle_embed(pg_temp.b(4),pg_temp.e(1104),pg_temp.response(1,50,'controlled-alternate'),'simulated',pg_temp.h(4))->>'state',
  'completed','known late response reconciles original batch');
select ops.m07_ack_embed(pg_temp.b(4),pg_temp.e(1104));
reset role;
select extensions.is((select count(*)::int from ops.cost_ledger where meta->>'embed_batch_id'=pg_temp.b(4)::text),1,'reconciled original request settles cost once');

-- Incomplete vectors still settle known aggregate usage exactly once.
update app.organizations set name='Changed brand' where id=pg_temp.e(200);
select pgmq.send('embed',jsonb_build_object('entity_type','organization','entity_id',pg_temp.e(200)));
set local role n8n_writer;
select set_config('test.embed.batch5',ops.m07_claim_embed(pg_temp.e(1105),20,600,pg_temp.selection())->>'batch_id',true);
select set_config('test.embed.hash5',ops.m07_prepare_embed(pg_temp.b(5),pg_temp.e(1105),'controlled-alternate',1536,'embedding_input.v1',pg_temp.settings())->>'request_hash',true);
select ops.m07_dispatch_embed(pg_temp.b(5),pg_temp.e(1105),pg_temp.h(5));
select extensions.is(ops.m07_settle_embed(pg_temp.b(5),pg_temp.e(1105),pg_temp.response(0,10,'controlled-alternate'),'simulated',pg_temp.h(5))->>'state',
  'failed','missing vector fails without discarding known usage');
select extensions.is(ops.m07_settle_embed(pg_temp.b(5),pg_temp.e(1105),pg_temp.response(0,10,'controlled-alternate'),'simulated',pg_temp.h(5))->>'replayed',
  'true','known failed-output replay is cost-once');
select extensions.throws_ok($$select ops.m07_ack_embed(pg_temp.b(5),pg_temp.e(1105))$$,'55000',null,'failed vectors cannot acknowledge successful ingestion');
reset role;
select extensions.is((select count(*)::int from ops.cost_ledger where meta->>'embed_batch_id'=pg_temp.b(5)::text),1,'invalid output still has exactly one known-cost receipt');
select extensions.is((select model from app.embeddings where entity_type='organization' and entity_id=pg_temp.e(200)),'controlled-alternate','failed result did not replace prior embedding');

-- Existing similarity APIs compare only compatible models/contracts. Query
-- vectors must carry explicit filter metadata; keyword paths stay unchanged.
select extensions.is((select count(*)::int from app.search('',('[1,'||repeat('0,',1534)||'0]')::extensions.vector,array['organization'])),0,
  'unlabelled semantic query has no silently assumed model');
select extensions.is((select count(*)::int from app.search('',('[1,'||repeat('0,',1534)||'0]')::extensions.vector,array['organization'],
  '{"embedding_model":"wrong-model","embedding_dimensions":1536,"embedding_input_version":"embedding_input.v1"}')),0,'query model mismatch excludes vectors');
select extensions.is((select count(*)::int from app.search('',('[1,'||repeat('0,',1534)||'0]')::extensions.vector,array['organization'],
  '{"embedding_model":"controlled-alternate","embedding_dimensions":1536,"embedding_input_version":"embedding_input.v1"}')),1,'matching query metadata permits compatible vector');
insert into app.embeddings(entity_type,entity_id,model,content_hash,embedding,input_contract_version)
values('organization',pg_temp.e(201),'incompatible','fixture',('[1,'||repeat('0,',1534)||'0]')::extensions.vector,'embedding_input.v1');
insert into app.organizations(id,kind,name,slug) values(pg_temp.e(201),'brand','Different model brand','m07-other-model');
select extensions.is((select count(*)::int from app.similar('organization',pg_temp.e(200))),0,'similar excludes a vector from another model');
update app.embeddings set model='controlled-alternate',input_contract_version='legacy' where entity_id=pg_temp.e(201);
select extensions.is((select count(*)::int from app.similar('organization',pg_temp.e(200))),0,'similar excludes incompatible input contracts');
update app.embeddings set input_contract_version='embedding_input.v1' where entity_id=pg_temp.e(201);
select extensions.is((select count(*)::int from app.similar('organization',pg_temp.e(200))),1,'compatible similar vector remains accessible');

-- A delayed request must not replace a newer embedding, even when a legacy
-- writer supplied only updated_at rather than the new source timestamp.
insert into app.items(id,competitor_id,account_id,platform,item_type,external_id,url,title,published_at,ai_status)
select pg_temp.e(i),pg_temp.e(100),pg_temp.e(101),'vimeo','video','M07E26-'||i,'https://vimeo.com/'||i,
 'Newer vector fixture '||i,'2000-01-01Z','published' from generate_series(22,23)i;
select pgmq.send('embed',jsonb_build_object('entity_type','item','entity_id',pg_temp.e(22)));
set local role n8n_writer;
select set_config('test.embed.batch6',ops.m07_claim_embed(pg_temp.e(1106),20,600,
 jsonb_build_array(jsonb_build_object('entity_type','item','entity_id',pg_temp.e(22))))->>'batch_id',true);
select set_config('test.embed.hash6',ops.m07_prepare_embed(pg_temp.b(6),pg_temp.e(1106),'controlled-embed',1536,'embedding_input.v1',pg_temp.settings())->>'request_hash',true);
select ops.m07_dispatch_embed(pg_temp.b(6),pg_temp.e(1106),pg_temp.h(6));
reset role;
insert into app.embeddings(entity_type,entity_id,model,content_hash,embedding,updated_at)
values('item',pg_temp.e(22),'newer-model','newer-hash',('[1,'||repeat('0,',1534)||'0]')::extensions.vector,clock_timestamp()+interval '1 second');
set local role n8n_writer;
select extensions.is(jsonb_array_length(ops.m07_settle_embed(pg_temp.b(6),pg_temp.e(1106),pg_temp.response(1),'simulated',pg_temp.h(6))#>'{result,stale}'),1,
  'newer legacy updated_at prevents delayed embedding overwrite');
select ops.m07_ack_embed(pg_temp.b(6),pg_temp.e(1106));
reset role;
select extensions.is((select model from app.embeddings where entity_type='item' and entity_id=pg_temp.e(22)),'newer-model',
  'newer incompatible embedding remains intact');
select pgmq.send('embed',jsonb_build_object('entity_type','item','entity_id',pg_temp.e(22)));
select pgmq.send('embed',jsonb_build_object('entity_type','item','entity_id',pg_temp.e(23)));
set local role n8n_writer;
select set_config('test.embed.batch7',ops.m07_claim_embed(pg_temp.e(1107),20,600,
 jsonb_build_array(jsonb_build_object('entity_type','item','entity_id',pg_temp.e(22)),
 jsonb_build_object('entity_type','item','entity_id',pg_temp.e(23))))->>'batch_id',true);
select set_config('test.embed.hash7',ops.m07_prepare_embed(pg_temp.b(7),pg_temp.e(1107),'controlled-embed',1536,'embedding_input.v1',pg_temp.settings())->>'request_hash',true);
select ops.m07_dispatch_embed(pg_temp.b(7),pg_temp.e(1107),pg_temp.h(7));
select extensions.is(ops.m07_settle_embed(pg_temp.b(7),pg_temp.e(1107),jsonb_set(pg_temp.response(2),'{data,0,index}','0'),
  'simulated',pg_temp.h(7))->>'state','failed','duplicate response indexes cannot assign a vector twice');
reset role;
select extensions.is((select count(*)::int from app.embeddings where entity_type='item' and entity_id=pg_temp.e(23)),0,
  'invalid index mapping writes no partial vectors');

create function pg_temp.bad_vector_case(n int,p_embedding jsonb) returns jsonb language plpgsql as $$
declare bid uuid; h text; response jsonb;
begin
  perform pgmq.send('embed',jsonb_build_object('entity_type','item','entity_id',pg_temp.e(22)));
  bid:=(ops.m07_claim_embed(pg_temp.e(1200+n),20,600,
    jsonb_build_array(jsonb_build_object('entity_type','item','entity_id',pg_temp.e(22))))->>'batch_id')::uuid;
  h:=ops.m07_prepare_embed(bid,pg_temp.e(1200+n),'controlled-embed',1536,'embedding_input.v1',pg_temp.settings())->>'request_hash';
  perform ops.m07_dispatch_embed(bid,pg_temp.e(1200+n),h);
  response:=jsonb_set(pg_temp.response(1),'{data,0,embedding}',p_embedding);
  return ops.m07_settle_embed(bid,pg_temp.e(1200+n),response,'simulated',h);
end $$;
select extensions.is(pg_temp.bad_vector_case(1,to_jsonb(array_fill(0,array[1536])))->>'state','failed','zero vector is invalid for cosine storage');
select extensions.is(pg_temp.bad_vector_case(2,to_jsonb(array_fill(1e-300::numeric,array[1536])))->>'state','failed','float4 underflow cannot admit a zero-norm vector');
select extensions.is(pg_temp.bad_vector_case(3,to_jsonb(array_fill(1e100::numeric,array[1536])))->>'state','failed','float4 overflow is rejected before writes');
select extensions.is(pg_temp.bad_vector_case(4,'["NaN"]'::jsonb||to_jsonb(array_fill(0,array[1535])))->>'state','failed','non-numeric vector member is rejected');
select extensions.is((select count(*)::int from ops.cost_ledger where meta->>'embed_batch_id' in
  (select id::text from ops.m07_embed_batches where owner_id=any(array[pg_temp.e(1201),pg_temp.e(1202),pg_temp.e(1203),pg_temp.e(1204)]))),4,
  'storage-incompatible outputs preserve each known aggregate usage exactly once');

select set_config('test.enqueue.before',(select count(*)::text from pgmq.q_embed),true);
set local role n8n_writer;
select set_config('test.enqueue.first',ops.enqueue_competitor_embeddings()::text,true);
select extensions.ok((current_setting('test.enqueue.first')::jsonb->>'enqueued')::int>=1,'explicit refresh enqueues active competitors');
select extensions.is(ops.enqueue_competitor_embeddings()->>'enqueued','0','refresh enqueue replay adds no pending duplicates');
select extensions.throws_ok($$select ops.m07_embed_status(pg_temp.b(1),pg_temp.e(1198))$$,'42501',null,'batch status is owner-bound');
reset role;
select extensions.is((select count(*)::int from cron.job where jobname like '%m07%'),0,'migration activates no M07 schedule');
select * from extensions.finish();
rollback;
