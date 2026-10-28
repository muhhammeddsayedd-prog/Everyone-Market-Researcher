-- Read-only assertions for an approved dev run. Supply exact run IDs through
-- the supported administrative/readback path; never treat local fixtures as
-- hosted acceptance. A zero-row directory baseline remains valid.
select r.id,r.workflow,r.status,r.accounts_total,r.accounts_ok,r.accounts_failed,r.items_seen,r.items_new,r.cost_usd
from ops.scrape_runs r where r.env='dev' and r.workflow in ('WF-21','WF-13','WF-18','WF-18b')
order by r.started_at desc limit 30;
select a.platform,p.status,count(*) from app.website_pages p
join app.competitor_accounts a on a.id=p.account_id group by a.platform,p.status;
select competitor_id,snapshot_date,count(*) from app.employee_snapshots
group by competitor_id,snapshot_date having count(*)>1;
select count(*) as forbidden_employee_fields from app.employee_snapshots s,
lateral jsonb_array_elements(s.people) p where p ?| array['email','photo','about','skills','experience','picture'];
select count(*) as unfinished_registered_jobs from ops.m05_jobs j join ops.collector_launches l using(launch_id)
where not j.settled or j.retry_pending;
select count(*) as terminal_pending_passes from ops.collector_passes p join ops.scrape_runs r on r.id=p.run_id
where r.workflow in ('WF-21','WF-13','WF-18','WF-18b') and r.status<>'running' and p.status='pending';
select l.apify_run_id,a.usage_usd,coalesce(sum(c.cost_usd),0) ledger_usd
from ops.collector_launches l join ops.m05_jobs j using(launch_id)
join ops.apify_runs a on a.apify_run_id=l.apify_run_id
left join ops.cost_ledger c on c.provider='apify' and c.meta->>'apify_run_id'=l.apify_run_id
where j.settled group by l.apify_run_id,a.usage_usd having a.usage_usd is distinct from coalesce(sum(c.cost_usd),0);
