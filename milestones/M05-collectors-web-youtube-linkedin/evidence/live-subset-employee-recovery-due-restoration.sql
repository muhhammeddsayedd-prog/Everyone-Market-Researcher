-- Concretize the three placeholders ONLY from the known new native run's
-- bounded database readback. The existing Query helper rejects this template.
-- Restores the original due date while retaining the new run, snapshot, status,
-- real watermarks, failures, collected rows and actual cost/history.
do $employee_restore$
declare
 a app.competitor_accounts%rowtype; after_row app.competitor_accounts%rowtype;
 p ops.scrape_runs%rowtype;
 selected uuid[]:=array['df405b78-eb07-4347-af97-6b62522bab8f','3dbf4ea2-3eae-4369-89cb-85df8fcd2e03',
  '21e51070-6857-4dbd-873d-3a9feba72831','22db994a-8b44-4a57-996a-60c80cd7a640','258f2013-1ca6-4794-830c-6f49efbea0b2']::uuid[];
begin
 select * into p from ops.scrape_runs where id='347ad190-4138-4310-88af-62ea48e28928'::uuid for update;
 if not found or p.id='89fdce7a-3566-4148-962d-80c75fd30ccc' or p.env<>'dev'
  or p.workflow<>'WF-18b' or p.platform is distinct from 'linkedin_employees'::app.platform or p.mode<>'weekly'
  or p.status='running' or p.finished_at is null then
  raise exception using errcode='55000',message='known new terminal dev employee parent required';
 end if;
 perform 1 from app.competitors where id='94928d31-8983-403c-bdbd-f5f44613d631'
  and company_code='C000' and status='active' for share;
 if not found then raise exception using errcode='55000',message='exact active baseline company required'; end if;
 select * into a from app.competitor_accounts where id='258f2013-1ca6-4794-830c-6f49efbea0b2' for update;
 if not found or a.competitor_id<>'94928d31-8983-403c-bdbd-f5f44613d631' or a.platform is distinct from 'linkedin_employees'::app.platform
  or a.handle is distinct from 'everyonefilms' or a.url is distinct from 'https://www.linkedin.com/company/everyonefilms/' or a.external_id is distinct from '94868239'
  or a.status not in ('active','failing') or a.backfill_status<>'not_applicable' or a.locked_until is not null
  or a.last_run_id is distinct from p.id or a.next_due_at is distinct from '2026-11-04T14:16:03.582922+00:00'::timestamptz
  or a.updated_at is distinct from '2026-10-28T18:16:03.582922+00:00'::timestamptz then
  raise exception using errcode='55000',message='owned current employee restoration snapshot required';
 end if;
 if exists(select 1 from app.competitor_accounts where id=any(selected) and locked_until>clock_timestamp())
  or exists(select 1 from ops.collector_accounts c join ops.scrape_runs r on r.id=c.run_id where c.account_id=any(selected) and r.status='running')
  or exists(select 1 from ops.apify_runs r where r.account_ids&&selected and r.processed_at is null)
  or exists(select 1 from ops.collector_launches l left join ops.m05_jobs m using(launch_id)
    where l.approval_id='a946c93c-1bf4-4d1d-82c5-ccbe2a44b3c1' and l.account_ids&&selected
      and (l.apify_run_id is null or m.settled is distinct from true or m.retry_pending)) then
  raise exception using errcode='55000',message='selected dev work must be quiescent';
 end if;
 if not exists(select 1 from ops.collector_runs where run_id=p.id and registration_closed)
  or not exists(select 1 from ops.collector_accounts where run_id=p.id and account_id=a.id)
  or not exists(select 1 from ops.scrape_run_accounts where run_id=p.id and account_id=a.id)
  or exists(select 1 from ops.collector_passes where run_id=p.id and status='pending')
  or (select count(*) from ops.collector_launches where run_id=p.id)<>1
  or not exists(select 1 from ops.collector_launches l join ops.apify_runs r on r.apify_run_id=l.apify_run_id
    where l.run_id=p.id and l.actor_id='harvestapi/linkedin-company-employees'
      and l.approval_id='a946c93c-1bf4-4d1d-82c5-ccbe2a44b3c1' and l.account_ids=array[a.id]
      and r.run_id=p.id and r.processed_at is not null) then
  raise exception using errcode='55000',message='owned new employee parent settlement required';
 end if;
 update app.competitor_accounts set next_due_at='2026-10-28T22:58:18.988295Z'::timestamptz
  where id=a.id and last_run_id=a.last_run_id and next_due_at=a.next_due_at and updated_at=a.updated_at and locked_until is null
  returning * into after_row;
 if not found or (to_jsonb(after_row)-'next_due_at') is distinct from (to_jsonb(a)-'next_due_at') then
  raise exception using errcode='55000',message='employee due-only restoration compare-and-set failed';
 end if;
end $employee_restore$;
select jsonb_build_object('account_id',id,'operation','restore_original_employee_due_only','last_run_id',last_run_id,
 'restored_due_at',next_due_at,'updated_at',updated_at,'otherAccountFieldsPreserved',true) as employee_recovery_due_restored
from app.competitor_accounts where id='258f2013-1ca6-4794-830c-6f49efbea0b2';
