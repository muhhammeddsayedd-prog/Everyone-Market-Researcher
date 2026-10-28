-- NOT RUNNABLE until exact last owned parent and fresh full account rows exist.
-- Replace __M04_EXPECTED_FINAL_ACCOUNTS_JSON__ with an array of objects:
-- {"expected_run_id":"<one recorded terminal owner>",
--  "expected_execution_id":"<matching recorded native execution>",
--  "account":{<complete raw row>}}.
-- Owner IDs come from actual run receipts, never from substituting last_run_id.
-- Bind __M04_APPROVAL_ID__ to this packet's actual approval UUID.
-- Include only actually touched selected accounts, one to four entries. The
-- unstarted accounts need no restoration. Query supplies the transaction.
-- Use compact JSON, rejecting the literal $m04_expected$ delimiter in values;
-- do not derive expected owners by substituting the current account owner.
do $m04_restore$
declare
  v_expected jsonb:=$m04_expected$__M04_EXPECTED_FINAL_ACCOUNTS_JSON__$m04_expected$::jsonb;
  v_entry jsonb; v_account app.competitor_accounts%rowtype; v_run ops.scrape_runs%rowtype;
begin
  if jsonb_typeof(v_expected)<>'array' or jsonb_array_length(v_expected) not between 1 and 4
    or (select count(distinct x->'account'->>'id') from jsonb_array_elements(v_expected) x)<>jsonb_array_length(v_expected) then
    raise exception using errcode='22023',message='M04 exact touched-account restoration snapshot required';
  end if;
  -- Follow the product lock order: all exact parent rows, then competitors,
  -- then account rows. An arbitrary last_run_id is never an ownership permit.
  perform 1 from ops.scrape_runs where id in (
    select (x->>'expected_run_id')::uuid from jsonb_array_elements(v_expected) x) order by id for update;
  perform 1 from app.competitors where id in (
    '94928d31-8983-403c-bdbd-f5f44613d631','9a0dba8a-b946-45a1-bd53-933216f1fc4d') order by id for share;
  for v_entry in select x from jsonb_array_elements(v_expected) x order by x->'account'->>'id' loop
    if v_entry->'account'->>'id' not in (
      '985a57dd-7934-422d-9d18-4e8ca59fc197','8fefa9a1-3637-43db-843d-97caa9afcc79',
      '962c9c7e-aa0f-46ae-911b-3265859e0577','bed82782-753f-4ba9-91ca-691ef36f75c6') then
      raise exception using errcode='42501',message='M04 restoration account is outside selection';
    end if;
    select * into v_run from ops.scrape_runs where id=(v_entry->>'expected_run_id')::uuid;
    if not found or v_run.env<>'dev' or v_run.workflow not in ('WF-10','WF-11') or v_run.mode<>'backfill'
      or v_run.n8n_execution_id is distinct from v_entry->>'expected_execution_id'
      or v_run.status='running' or v_run.finished_at is null
      or not exists(select 1 from ops.collector_runs where run_id=v_run.id and registration_closed)
      or exists(select 1 from ops.collector_passes where run_id=v_run.id and status='pending')
      or exists(select 1 from ops.collector_launches where run_id=v_run.id and apify_run_id is null)
      or exists(select 1 from ops.collector_launches where run_id=v_run.id
        and approval_id<>'__M04_APPROVAL_ID__'::uuid)
      or exists(select 1 from ops.apify_runs where run_id=v_run.id and processed_at is null) then
      raise exception using errcode='55000',message='M04 exact restoration parent has unfinished work';
    end if;
    select * into v_account from app.competitor_accounts where id=(v_entry->'account'->>'id')::uuid for update;
    if not found or to_jsonb(v_account) is distinct from v_entry->'account'
      or (v_account.id,v_account.competitor_id,v_account.platform::text,v_account.handle,v_account.url) not in (
        ('985a57dd-7934-422d-9d18-4e8ca59fc197'::uuid,'94928d31-8983-403c-bdbd-f5f44613d631'::uuid,'vimeo','everyonefilms','https://vimeo.com/everyonefilms'),
        ('8fefa9a1-3637-43db-843d-97caa9afcc79'::uuid,'9a0dba8a-b946-45a1-bd53-933216f1fc4d'::uuid,'vimeo','goodpeoplefilms','https://vimeo.com/goodpeoplefilms'),
        ('962c9c7e-aa0f-46ae-911b-3265859e0577'::uuid,'94928d31-8983-403c-bdbd-f5f44613d631'::uuid,'instagram','everyone.film','https://www.instagram.com/everyone.film/'),
        ('bed82782-753f-4ba9-91ca-691ef36f75c6'::uuid,'9a0dba8a-b946-45a1-bd53-933216f1fc4d'::uuid,'instagram','goodpeoplefilms','https://www.instagram.com/goodpeoplefilms/'))
      or not exists(select 1 from app.competitors where id=v_account.competitor_id and status='active')
      or v_account.last_run_id is distinct from v_run.id or v_account.locked_until is not null
      or v_account.platform is distinct from v_run.platform
      or (v_account.platform='vimeo' and v_run.workflow<>'WF-10')
      or (v_account.platform='instagram' and v_run.workflow<>'WF-11')
      or not exists(select 1 from ops.collector_accounts where run_id=v_run.id and account_id=v_account.id)
      or not exists(select 1 from ops.scrape_run_accounts where run_id=v_run.id and account_id=v_account.id)
      or exists(select 1 from ops.apify_runs where processed_at is null and v_account.id=any(account_ids))
      or exists(select 1 from ops.collector_accounts ca join ops.scrape_runs r on r.id=ca.run_id
        where ca.account_id=v_account.id and r.status='running') then
      raise exception using errcode='55000',message='M04 restoration ownership or account snapshot changed';
    end if;
    -- Setup changed no status, so preserve actual active/failing/invalid state,
    -- errors/failure counters, successful results, watermarks, content and queues.
    update app.competitor_accounts set backfill_status='pending',backfill_cursor=null,
      next_due_at='2026-10-18T01:12:10.339281+00:00',updated_at=clock_timestamp()
      where id=v_account.id and last_run_id=v_run.id and updated_at=v_account.updated_at and locked_until is null;
    if not found then raise exception using errcode='55000',message='M04 restoration compare-and-set failed';end if;
  end loop;
end $m04_restore$;
select jsonb_build_object('restoredOnlyOperationalSelection',true,'retainedAllData',true,
  'accounts',(select jsonb_agg(to_jsonb(a) order by a.id) from app.competitor_accounts a where a.id in (
    '985a57dd-7934-422d-9d18-4e8ca59fc197','8fefa9a1-3637-43db-843d-97caa9afcc79',
    '962c9c7e-aa0f-46ae-911b-3265859e0577','bed82782-753f-4ba9-91ca-691ef36f75c6'))
) as selected_restoration;
