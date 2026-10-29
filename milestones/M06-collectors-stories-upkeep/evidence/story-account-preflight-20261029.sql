begin read only;
set local statement_timeout='20s';
set local lock_timeout='2s';
select jsonb_build_object('observed_at',clock_timestamp(),'accounts',(select jsonb_agg(jsonb_build_object(
 'company_code',c.company_code,'competitor_id',c.id,'name',c.name,'slug',c.slug,'baseline',c.is_baseline,
 'pilot_rank',c.pilot_rank,'priority_tier',c.priority_tier,'competitor_status',c.status,
 'account_id',a.id,'platform',a.platform,'handle',a.handle,'url',a.url,'status',a.status,
 'backfill_status',a.backfill_status,'cadence',a.cadence) order by c.company_code,a.platform)
 from app.competitors c join app.competitor_accounts a on a.competitor_id=c.id
 where c.company_code in ('C000','C001','C130') and a.platform in ('instagram','instagram_stories')),
 'media_queue',(select count(*) from pgmq.q_media),'items',(select count(*) from app.items),
 'cost_rows',(select count(*) from ops.cost_ledger),'cost_usd',(select sum(cost_usd) from ops.cost_ledger)
) as story_preflight;
commit;
