-- NOT RUNNABLE until exact last owned parent and fresh full account rows exist.
-- Replace [{"expected_run_id":"f468793d-5bae-430b-909e-a6aed4de7e26","expected_execution_id":"31163","account":{"id":"8fefa9a1-3637-43db-843d-97caa9afcc79","url":"https://vimeo.com/goodpeoplefilms","handle":"goodpeoplefilms","status":"active","cadence":"1 day","platform":"vimeo","created_at":"2026-10-18T01:12:10.339281+00:00","last_error":null,"updated_at":"2026-10-27T13:47:53.212108+00:00","external_id":"49236950","handle_norm":"goodpeoplefilms","items_count":5,"last_run_id":"f468793d-5bae-430b-909e-a6aed4de7e26","next_due_at":"2026-10-28T09:47:53.212108+00:00","locked_until":null,"backfill_from":"2024-01-01","competitor_id":"9a0dba8a-b946-45a1-bd53-933216f1fc4d","last_error_at":null,"resolve_status":"resolved","backfill_cursor":{"page":2,"endpoint":"users","resourcePath":"/users/49236950"},"backfill_status":"running","last_success_at":"2026-10-27T13:47:53.212108+00:00","last_external_id":"981277189","uploads_playlist_id":null,"consecutive_failures":0,"last_item_published_at":"2024-07-09T12:14:00+00:00"}},{"expected_run_id":"d0c86952-df68-48ff-8f41-132500e2e90b","expected_execution_id":"31159","account":{"id":"962c9c7e-aa0f-46ae-911b-3265859e0577","url":"https://www.instagram.com/everyone.film/","handle":"everyone.film","status":"active","cadence":"1 day","platform":"instagram","created_at":"2026-10-18T01:12:10.339281+00:00","last_error":null,"updated_at":"2026-10-27T13:47:37.549203+00:00","external_id":null,"handle_norm":"everyone.film","items_count":6,"last_run_id":"d0c86952-df68-48ff-8f41-132500e2e90b","next_due_at":"2026-10-28T09:47:37.549203+00:00","locked_until":null,"backfill_from":"2024-01-01","competitor_id":"94928d31-8983-403c-bdbd-f5f44613d631","last_error_at":null,"resolve_status":"not_needed","backfill_cursor":{"posts":{"full_waves":0},"reels":{"full_waves":0,"oldest_seen":"2026-09-10T17:24:24+00:00"}},"backfill_status":"running","last_success_at":"2026-10-27T13:47:37.549203+00:00","last_external_id":"DeZgi_rDHGi","uploads_playlist_id":null,"consecutive_failures":0,"last_item_published_at":"2026-10-12T15:01:56+00:00"}},{"expected_run_id":"f468793d-5bae-430b-909e-a6aed4de7e26","expected_execution_id":"31163","account":{"id":"985a57dd-7934-422d-9d18-4e8ca59fc197","url":"https://vimeo.com/everyonefilms","handle":"everyonefilms","status":"active","cadence":"1 day","platform":"vimeo","created_at":"2026-10-18T01:12:10.339281+00:00","last_error":null,"updated_at":"2026-10-27T13:47:54.079492+00:00","external_id":"157330576","handle_norm":"everyonefilms","items_count":5,"last_run_id":"f468793d-5bae-430b-909e-a6aed4de7e26","next_due_at":"2026-10-28T09:47:54.079492+00:00","locked_until":null,"backfill_from":"2024-01-01","competitor_id":"94928d31-8983-403c-bdbd-f5f44613d631","last_error_at":null,"resolve_status":"resolved","backfill_cursor":{"page":2,"endpoint":"users","resourcePath":"/users/157330576"},"backfill_status":"running","last_success_at":"2026-10-27T13:47:54.079492+00:00","last_external_id":"1236174183","uploads_playlist_id":null,"consecutive_failures":0,"last_item_published_at":"2026-10-15T11:11:11+00:00"}},{"expected_run_id":"d0c86952-df68-48ff-8f41-132500e2e90b","expected_execution_id":"31159","account":{"id":"bed82782-753f-4ba9-91ca-691ef36f75c6","url":"https://www.instagram.com/goodpeoplefilms/","handle":"goodpeoplefilms","status":"active","cadence":"1 day","platform":"instagram","created_at":"2026-10-18T01:12:10.339281+00:00","last_error":null,"updated_at":"2026-10-27T13:47:37.549203+00:00","external_id":null,"handle_norm":"goodpeoplefilms","items_count":5,"last_run_id":"d0c86952-df68-48ff-8f41-132500e2e90b","next_due_at":"2026-10-28T09:47:37.549203+00:00","locked_until":null,"backfill_from":"2024-01-01","competitor_id":"9a0dba8a-b946-45a1-bd53-933216f1fc4d","last_error_at":null,"resolve_status":"not_needed","backfill_cursor":{"posts":{"full_waves":0},"reels":{"full_waves":1,"oldest_seen":"2026-06-28T16:53:39+00:00"}},"backfill_status":"running","last_success_at":"2026-10-27T13:47:37.549203+00:00","last_external_id":"DaIxMPasd4-","uploads_playlist_id":null,"consecutive_failures":0,"last_item_published_at":"2026-06-28T16:55:05+00:00"}}] with an array of objects:
-- {"expected_run_id":"<one recorded terminal owner>",
--  "expected_execution_id":"<matching recorded native execution>",
--  "account":{<complete raw row>}}.
-- Owner IDs come from actual run receipts, never from substituting last_run_id.
-- Bind 3f3aed72-4f14-4cc4-aefe-4999038efe27 to this packet's actual approval UUID.
-- Include only actually touched selected accounts, one to four entries. The
-- unstarted accounts need no restoration. Query supplies the transaction.
-- Use compact JSON, rejecting the literal $m04_expected$ delimiter in values;
-- do not derive expected owners by substituting the current account owner.
do $m04_restore$
declare
  v_expected jsonb:=$m04_expected$[{"expected_run_id":"f468793d-5bae-430b-909e-a6aed4de7e26","expected_execution_id":"31163","account":{"id":"8fefa9a1-3637-43db-843d-97caa9afcc79","url":"https://vimeo.com/goodpeoplefilms","handle":"goodpeoplefilms","status":"active","cadence":"1 day","platform":"vimeo","created_at":"2026-10-18T01:12:10.339281+00:00","last_error":null,"updated_at":"2026-10-27T13:47:53.212108+00:00","external_id":"49236950","handle_norm":"goodpeoplefilms","items_count":5,"last_run_id":"f468793d-5bae-430b-909e-a6aed4de7e26","next_due_at":"2026-10-28T09:47:53.212108+00:00","locked_until":null,"backfill_from":"2024-01-01","competitor_id":"9a0dba8a-b946-45a1-bd53-933216f1fc4d","last_error_at":null,"resolve_status":"resolved","backfill_cursor":{"page":2,"endpoint":"users","resourcePath":"/users/49236950"},"backfill_status":"running","last_success_at":"2026-10-27T13:47:53.212108+00:00","last_external_id":"981277189","uploads_playlist_id":null,"consecutive_failures":0,"last_item_published_at":"2024-07-09T12:14:00+00:00"}},{"expected_run_id":"d0c86952-df68-48ff-8f41-132500e2e90b","expected_execution_id":"31159","account":{"id":"962c9c7e-aa0f-46ae-911b-3265859e0577","url":"https://www.instagram.com/everyone.film/","handle":"everyone.film","status":"active","cadence":"1 day","platform":"instagram","created_at":"2026-10-18T01:12:10.339281+00:00","last_error":null,"updated_at":"2026-10-27T13:47:37.549203+00:00","external_id":null,"handle_norm":"everyone.film","items_count":6,"last_run_id":"d0c86952-df68-48ff-8f41-132500e2e90b","next_due_at":"2026-10-28T09:47:37.549203+00:00","locked_until":null,"backfill_from":"2024-01-01","competitor_id":"94928d31-8983-403c-bdbd-f5f44613d631","last_error_at":null,"resolve_status":"not_needed","backfill_cursor":{"posts":{"full_waves":0},"reels":{"full_waves":0,"oldest_seen":"2026-09-10T17:24:24+00:00"}},"backfill_status":"running","last_success_at":"2026-10-27T13:47:37.549203+00:00","last_external_id":"DeZgi_rDHGi","uploads_playlist_id":null,"consecutive_failures":0,"last_item_published_at":"2026-10-12T15:01:56+00:00"}},{"expected_run_id":"f468793d-5bae-430b-909e-a6aed4de7e26","expected_execution_id":"31163","account":{"id":"985a57dd-7934-422d-9d18-4e8ca59fc197","url":"https://vimeo.com/everyonefilms","handle":"everyonefilms","status":"active","cadence":"1 day","platform":"vimeo","created_at":"2026-10-18T01:12:10.339281+00:00","last_error":null,"updated_at":"2026-10-27T13:47:54.079492+00:00","external_id":"157330576","handle_norm":"everyonefilms","items_count":5,"last_run_id":"f468793d-5bae-430b-909e-a6aed4de7e26","next_due_at":"2026-10-28T09:47:54.079492+00:00","locked_until":null,"backfill_from":"2024-01-01","competitor_id":"94928d31-8983-403c-bdbd-f5f44613d631","last_error_at":null,"resolve_status":"resolved","backfill_cursor":{"page":2,"endpoint":"users","resourcePath":"/users/157330576"},"backfill_status":"running","last_success_at":"2026-10-27T13:47:54.079492+00:00","last_external_id":"1236174183","uploads_playlist_id":null,"consecutive_failures":0,"last_item_published_at":"2026-10-15T11:11:11+00:00"}},{"expected_run_id":"d0c86952-df68-48ff-8f41-132500e2e90b","expected_execution_id":"31159","account":{"id":"bed82782-753f-4ba9-91ca-691ef36f75c6","url":"https://www.instagram.com/goodpeoplefilms/","handle":"goodpeoplefilms","status":"active","cadence":"1 day","platform":"instagram","created_at":"2026-10-18T01:12:10.339281+00:00","last_error":null,"updated_at":"2026-10-27T13:47:37.549203+00:00","external_id":null,"handle_norm":"goodpeoplefilms","items_count":5,"last_run_id":"d0c86952-df68-48ff-8f41-132500e2e90b","next_due_at":"2026-10-28T09:47:37.549203+00:00","locked_until":null,"backfill_from":"2024-01-01","competitor_id":"9a0dba8a-b946-45a1-bd53-933216f1fc4d","last_error_at":null,"resolve_status":"not_needed","backfill_cursor":{"posts":{"full_waves":0},"reels":{"full_waves":1,"oldest_seen":"2026-06-28T16:53:39+00:00"}},"backfill_status":"running","last_success_at":"2026-10-27T13:47:37.549203+00:00","last_external_id":"DaIxMPasd4-","uploads_playlist_id":null,"consecutive_failures":0,"last_item_published_at":"2026-06-28T16:55:05+00:00"}}]$m04_expected$::jsonb;
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
        and approval_id<>'3f3aed72-4f14-4cc4-aefe-4999038efe27'::uuid)
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
