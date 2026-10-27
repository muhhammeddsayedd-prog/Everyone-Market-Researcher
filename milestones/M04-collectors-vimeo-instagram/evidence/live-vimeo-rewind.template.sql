-- NOT RUNNABLE until the coordinator binds the exact actual first Vimeo parent
-- and its two current account rows from a successful metadata readback.
-- Bind __M04_VIMEO_RUN_ID__/__M04_VIMEO_EXECUTION_ID__ from the actual native
-- run receipt, never by substituting a freshly discovered last_run_id.
-- Also replace __M04_EXPECTED_VIMEO_ACCOUNTS_JSON__.
-- The JSON is an array of the complete raw account rows (no extra join fields).
-- Materialization must use compact JSON and reject the literal dollar-quote
-- delimiter $m04_expected$ inside it; bind UUID/digit identities from receipts.
-- Query consumer supplies the transaction; do not add BEGIN/COMMIT.
do $m04_rewind$
declare
  v_run_id uuid:='__M04_VIMEO_RUN_ID__';
  v_expected jsonb:=$m04_expected$__M04_EXPECTED_VIMEO_ACCOUNTS_JSON__$m04_expected$::jsonb;
  v_snapshot jsonb; v_account app.competitor_accounts%rowtype; v_run ops.scrape_runs%rowtype;
begin
  if jsonb_typeof(v_expected)<>'array' or jsonb_array_length(v_expected)<>2
    or (select count(distinct x->>'id') from jsonb_array_elements(v_expected) x)<>2 then
    raise exception using errcode='22023',message='M04 exact two-account rewind snapshot required';
  end if;
  select * into v_run from ops.scrape_runs where id=v_run_id for update;
  if not found or v_run.env<>'dev' or v_run.workflow<>'WF-10' or v_run.platform<>'vimeo'
    or v_run.n8n_execution_id is distinct from '__M04_VIMEO_EXECUTION_ID__'
    or v_run.mode<>'backfill' or v_run.status<>'success' or v_run.finished_at is null
    or not exists(select 1 from ops.collector_runs where run_id=v_run_id and registration_closed)
    or exists(select 1 from ops.collector_passes where run_id=v_run_id and status='pending')
    or exists(select 1 from ops.collector_launches where run_id=v_run_id)
    or (select count(*) from ops.collector_accounts where run_id=v_run_id)<>2 then
    raise exception using errcode='55000',message='M04 exact Vimeo parent is not safely completed';
  end if;
  perform 1 from app.competitors where id in (
    '94928d31-8983-403c-bdbd-f5f44613d631','9a0dba8a-b946-45a1-bd53-933216f1fc4d') order by id for share;
  for v_snapshot in select x from jsonb_array_elements(v_expected) x order by x->>'id' loop
    if v_snapshot->>'id' not in ('985a57dd-7934-422d-9d18-4e8ca59fc197','8fefa9a1-3637-43db-843d-97caa9afcc79') then
      raise exception using errcode='42501',message='M04 rewind account is outside selection';
    end if;
    select * into v_account from app.competitor_accounts where id=(v_snapshot->>'id')::uuid for update;
    if not found or to_jsonb(v_account) is distinct from v_snapshot
      or v_account.platform<>'vimeo' or v_account.status<>'active'
      or (v_account.id,v_account.competitor_id,v_account.handle,v_account.url) not in (
        ('985a57dd-7934-422d-9d18-4e8ca59fc197'::uuid,'94928d31-8983-403c-bdbd-f5f44613d631'::uuid,'everyonefilms','https://vimeo.com/everyonefilms'),
        ('8fefa9a1-3637-43db-843d-97caa9afcc79'::uuid,'9a0dba8a-b946-45a1-bd53-933216f1fc4d'::uuid,'goodpeoplefilms','https://vimeo.com/goodpeoplefilms'))
      or not exists(select 1 from app.competitors where id=v_account.competitor_id and status='active')
      or v_account.last_run_id is distinct from v_run_id or v_account.locked_until is not null
      or not exists(select 1 from ops.collector_accounts where run_id=v_run_id and account_id=v_account.id)
      or not exists(select 1 from ops.scrape_run_accounts where run_id=v_run_id and account_id=v_account.id and status='success')
      or exists(select 1 from ops.apify_runs where processed_at is null and v_account.id=any(account_ids))
      or exists(select 1 from ops.collector_accounts ca join ops.scrape_runs r on r.id=ca.run_id
        where ca.account_id=v_account.id and r.status='running') then
      raise exception using errcode='55000',message='M04 rewind ownership or account snapshot changed';
    end if;
    -- Rewind only the approved first-page operational selection. Preserve the
    -- watermark, all collected rows, exact last_run_id and every source/human field.
    update app.competitor_accounts set backfill_status='pending',backfill_cursor=null,
      next_due_at='2026-10-18T01:12:10.339281+00:00',updated_at=clock_timestamp()
      where id=v_account.id and last_run_id=v_run_id and updated_at=v_account.updated_at and locked_until is null;
    if not found then raise exception using errcode='55000',message='M04 rewind compare-and-set failed';end if;
  end loop;
end $m04_rewind$;
select jsonb_build_object('rewoundOnlyOperationalSelection',true,
  'accounts',(select jsonb_agg(to_jsonb(a) order by a.id) from app.competitor_accounts a
    where a.id in ('985a57dd-7934-422d-9d18-4e8ca59fc197','8fefa9a1-3637-43db-843d-97caa9afcc79'))
) as vimeo_rewind;
