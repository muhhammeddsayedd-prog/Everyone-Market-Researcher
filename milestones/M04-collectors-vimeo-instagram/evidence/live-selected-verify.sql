-- Transaction body for Invoke-M04DevDatabase -Phase Query. No mutation.
-- The four IDs are from the actual 27 October dev preflight snapshot.
do $m04_selected$
begin
  if (select count(*) from app.competitor_accounts a join app.competitors c on c.id=a.competitor_id
      where (a.id,a.platform::text,c.company_code,a.handle,a.url) in (
        ('985a57dd-7934-422d-9d18-4e8ca59fc197'::uuid,'vimeo','C000','everyonefilms','https://vimeo.com/everyonefilms'),
        ('8fefa9a1-3637-43db-843d-97caa9afcc79'::uuid,'vimeo','C001','goodpeoplefilms','https://vimeo.com/goodpeoplefilms'),
        ('962c9c7e-aa0f-46ae-911b-3265859e0577'::uuid,'instagram','C000','everyone.film','https://www.instagram.com/everyone.film/'),
        ('bed82782-753f-4ba9-91ca-691ef36f75c6'::uuid,'instagram','C001','goodpeoplefilms','https://www.instagram.com/goodpeoplefilms/'))
        and c.status='active' and a.status='active' and a.backfill_status='pending'
        and a.backfill_from=date '2024-01-01' and a.backfill_cursor is null
        and a.locked_until is null and a.last_run_id is null and a.next_due_at<=clock_timestamp())<>4 then
    raise exception using errcode='55000',message='M04 exact selected first-page eligibility changed';
  end if;
  if exists(select 1 from ops.apify_runs r where r.processed_at is null and r.account_ids && array[
      '985a57dd-7934-422d-9d18-4e8ca59fc197','8fefa9a1-3637-43db-843d-97caa9afcc79',
      '962c9c7e-aa0f-46ae-911b-3265859e0577','bed82782-753f-4ba9-91ca-691ef36f75c6']::uuid[])
    or exists(select 1 from ops.collector_accounts ca join ops.scrape_runs r on r.id=ca.run_id
      where r.status='running' and ca.account_id in (
        '985a57dd-7934-422d-9d18-4e8ca59fc197','8fefa9a1-3637-43db-843d-97caa9afcc79',
        '962c9c7e-aa0f-46ae-911b-3265859e0577','bed82782-753f-4ba9-91ca-691ef36f75c6')) then
    raise exception using errcode='55000',message='M04 selected account has unfinished work';
  end if;
end $m04_selected$;
select jsonb_build_object('verified',true,'mutations',0,
  'accounts',(select jsonb_agg(to_jsonb(a) order by a.id) from app.competitor_accounts a where a.id in (
    '985a57dd-7934-422d-9d18-4e8ca59fc197','8fefa9a1-3637-43db-843d-97caa9afcc79',
    '962c9c7e-aa0f-46ae-911b-3265859e0577','bed82782-753f-4ba9-91ca-691ef36f75c6')),
  'selectedItems',(select count(*) from app.items where account_id in (
    '985a57dd-7934-422d-9d18-4e8ca59fc197','8fefa9a1-3637-43db-843d-97caa9afcc79',
    '962c9c7e-aa0f-46ae-911b-3265859e0577','bed82782-753f-4ba9-91ca-691ef36f75c6'))
) as selected_verification;
