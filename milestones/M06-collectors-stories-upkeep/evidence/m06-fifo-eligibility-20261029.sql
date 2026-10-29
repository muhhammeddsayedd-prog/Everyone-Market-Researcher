-- One approved read-only look-ahead; no queue visibility, read count or order changes.
begin read only;
set local statement_timeout='15s';
set local lock_timeout='2s';
with visible as (
 select q.msg_id,q.read_ct,q.message,
 case when q.message->>'item_id' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
 then (q.message->>'item_id')::uuid end item_id from pgmq.q_media q where q.vt<=now()
), projected as (
 select q.msg_id,q.read_ct,i.id item_id,c.company_code,i.platform,i.external_id,
 c.slug||'/'||i.platform::text||'/'||i.external_id||'/thumb.jpg' expected_path,
 i.thumbnail_source_url is not null and btrim(i.thumbnail_source_url)<>'' source_present,
 i.thumbnail_source_url ~ '^https://' source_https,
 case when i.thumbnail_source_url ~ '^https://[A-Za-z0-9.-]+(:443)?([/?#]|$)'
 then lower(substring(i.thumbnail_source_url from '^https://([A-Za-z0-9.-]+)')) end source_host,
 i.thumbnail_path is not null has_thumbnail,'thumbnail_path'=any(i.locked_fields) thumbnail_locked,
 r.run_id,s.workflow,s.status run_status,s.env,
 coalesce(c.company_code<>'C999' and c.company_code ~ '^C[0-9]{3}$' and c.status='active' and i.status='active'
 and a.competitor_id=i.competitor_id and a.platform=i.platform and r.id is not null
 and s.env='dev' and s.status in ('success','partial') and s.workflow in ('WF-10','WF-11','WF-13','WF-18')
 and r.fetched_at>='2026-10-26T00:00:00Z' and i.thumbnail_source_url ~ '^https://'
 and length(i.thumbnail_source_url)<=8192 and i.thumbnail_path is null and not('thumbnail_path'=any(i.locked_fields))
 and q.read_ct between 0 and 2,false) real_candidate
 from visible q left join app.items i on i.id=q.item_id left join app.competitors c on c.id=i.competitor_id
 left join app.competitor_accounts a on a.id=i.account_id
 left join ingest.raw_items r on r.platform=i.platform and r.external_id=i.external_id and r.account_id=i.account_id
 left join ops.scrape_runs s on s.id=r.run_id
), candidate as (select * from projected where real_candidate order by msg_id limit 1)
select jsonb_build_object('observed_at',clock_timestamp(),'visible_messages',(select count(*) from visible),
 'first_ten',(select jsonb_agg(to_jsonb(x) order by x.msg_id) from(select * from projected order by msg_id limit 10)x),
 'earliest_real_candidate',(select to_jsonb(c) from candidate c),
 'preceding_count',(select count(*) from projected p where p.msg_id<(select msg_id from candidate)),
 'preceding',(select coalesce(jsonb_agg(to_jsonb(p) order by p.msg_id),'[]'::jsonb) from projected p where p.msg_id<(select msg_id from candidate)),
 'source_present_count',(select count(*) from projected where source_present),
 'real_candidate_count',(select count(*) from projected where real_candidate)) as queue_resolution;
commit;
