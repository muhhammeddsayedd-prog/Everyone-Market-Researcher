with fixture as(select a.id as account_id from app.competitors c join app.competitor_accounts a on a.competitor_id=c.id where c.company_code='C999' and c.slug='emr-smoke-test'),
 original as(select run_id from ops.apify_launch_admissions where window_id='df4f29ec-e2dc-4d82-a276-62a4e695e6f9' and ordinal=1),
 items as(select i.* from app.items i join fixture f on f.account_id=i.account_id),
 raw as(select r.* from ingest.raw_items r join fixture f on f.account_id=r.account_id),
 costs as(select c.* from ops.cost_ledger c join original o on o.run_id=c.run_id),
 queues as(select 'ai_extract' as queue,to_jsonb(q) as row from pgmq.q_ai_extract q where q.message->>'item_id' in(select id::text from items)
 union all select 'embed',to_jsonb(q) from pgmq.q_embed q where q.message->>'item_id' in(select id::text from items)
 union all select 'media',to_jsonb(q) from pgmq.q_media q where q.message->>'item_id' in(select id::text from items))
select jsonb_build_object('items',(select count(*) from items),'rawSnapshots',(select count(*) from raw),
 'aiExtractQueue',(select count(*) from queues where queue='ai_extract'),'embedQueue',(select count(*) from queues where queue='embed'),'mediaQueue',(select count(*) from queues where queue='media'),
 'costEntries',(select count(*) from costs),
 'itemsSha256',encode(extensions.digest((select coalesce(jsonb_agg(to_jsonb(i) order by id),'[]'::jsonb)::text from items i),'sha256'),'hex'),
 'rawSnapshotsSha256',encode(extensions.digest((select coalesce(jsonb_agg(to_jsonb(r) order by id),'[]'::jsonb)::text from raw r),'sha256'),'hex'),
 'queuesSha256',encode(extensions.digest((select coalesce(jsonb_agg(to_jsonb(q) order by queue,row->>'msg_id'),'[]'::jsonb)::text from queues q),'sha256'),'hex'),
 'costsSha256',encode(extensions.digest((select coalesce(jsonb_agg(to_jsonb(c) order by id),'[]'::jsonb)::text from costs c),'sha256'),'hex')) as snapshot;
