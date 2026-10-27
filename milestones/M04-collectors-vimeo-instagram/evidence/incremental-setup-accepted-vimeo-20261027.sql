-- Exact reviewed operational selection only; full-row compare-and-set.
do $m04_operational$
declare entries jsonb:=$m04_5b3e956933e41321$[{"key":"C000:vimeo:0","company_code":"C000","account":{"id":"985a57dd-7934-422d-9d18-4e8ca59fc197","url":"https://vimeo.com/everyonefilms","handle":"everyonefilms","status":"active","cadence":"1 day","platform":"vimeo","created_at":"2026-10-18T01:12:10.339281+00:00","last_error":null,"updated_at":"2026-10-27T13:55:13.580745+00:00","external_id":"157330576","handle_norm":"everyonefilms","items_count":5,"last_run_id":"f468793d-5bae-430b-909e-a6aed4de7e26","next_due_at":"2026-10-18T01:12:10.339281+00:00","locked_until":null,"backfill_from":"2024-01-01","competitor_id":"94928d31-8983-403c-bdbd-f5f44613d631","last_error_at":null,"resolve_status":"resolved","backfill_cursor":null,"backfill_status":"pending","last_success_at":"2026-10-27T13:47:54.079492+00:00","last_external_id":"1236174183","uploads_playlist_id":null,"consecutive_failures":0,"last_item_published_at":"2026-10-15T11:11:11+00:00"},"selection":{"backfill_status":"pending","backfill_cursor":{"page":2,"endpoint":"users","resourcePath":"/users/157330576","page_size":5}}},{"key":"C001:vimeo:0","company_code":"C001","account":{"id":"8fefa9a1-3637-43db-843d-97caa9afcc79","url":"https://vimeo.com/goodpeoplefilms","handle":"goodpeoplefilms","status":"active","cadence":"1 day","platform":"vimeo","created_at":"2026-10-18T01:12:10.339281+00:00","last_error":null,"updated_at":"2026-10-27T13:55:13.57849+00:00","external_id":"49236950","handle_norm":"goodpeoplefilms","items_count":5,"last_run_id":"f468793d-5bae-430b-909e-a6aed4de7e26","next_due_at":"2026-10-18T01:12:10.339281+00:00","locked_until":null,"backfill_from":"2024-01-01","competitor_id":"9a0dba8a-b946-45a1-bd53-933216f1fc4d","last_error_at":null,"resolve_status":"resolved","backfill_cursor":null,"backfill_status":"pending","last_success_at":"2026-10-27T13:47:53.212108+00:00","last_external_id":"981277189","uploads_playlist_id":null,"consecutive_failures":0,"last_item_published_at":"2024-07-09T12:14:00+00:00"},"selection":{"backfill_status":"pending","backfill_cursor":{"page":2,"endpoint":"users","resourcePath":"/users/49236950","page_size":5}}}]$m04_5b3e956933e41321$::jsonb; e jsonb; a app.competitor_accounts%rowtype; r ops.scrape_runs%rowtype;
begin
 perform 1 from ops.scrape_runs where id in (select coalesce(x->'owner'->>'run_id',x->'account'->>'last_run_id')::uuid from jsonb_array_elements(entries) x) order by id for update;
 perform 1 from app.competitors where id in (select (x->'account'->>'competitor_id')::uuid from jsonb_array_elements(entries) x) order by id for share;
 for e in select x from jsonb_array_elements(entries) x order by x->'account'->>'id' loop
  select * into a from app.competitor_accounts where id=(e->'account'->>'id')::uuid for update;
  if not found or to_jsonb(a) is distinct from e->'account' or a.locked_until is not null
   or not exists(select 1 from app.competitors c where c.id=a.competitor_id and c.company_code=e->>'company_code' and c.status='active')
   or exists(select 1 from ops.collector_accounts ca join ops.scrape_runs p on p.id=ca.run_id where ca.account_id=a.id and p.status='running')
   or exists(select 1 from ops.apify_runs p where p.processed_at is null and a.id=any(p.account_ids)) then
   raise exception using errcode='55000',message='M04 incremental account snapshot or unfinished work changed';
  end if;
  if e ? 'setup_account' and (to_jsonb(a) is distinct from e->'setup_account'
   or a.last_run_id is distinct from (e->>'baseline_run_id')::uuid) then
   raise exception using errcode='55000',message='M04 incremental unstarted setup ownership changed';
  end if;
  if e ? 'owner' then
   select * into r from ops.scrape_runs where id=(e->'owner'->>'run_id')::uuid;
   if not found or r.env<>'dev' or r.started_at<'2026-10-27T15:24:25.740Z'::timestamptz or r.workflow is distinct from (case when a.platform='vimeo' then 'WF-10' else 'WF-11' end)
    or r.platform is distinct from a.platform or r.n8n_execution_id is distinct from e->'owner'->>'execution_id'
    or r.status='running' or r.finished_at is null or a.last_run_id is distinct from r.id
    or not exists(select 1 from ops.collector_accounts where run_id=r.id and account_id=a.id)
    or not exists(select 1 from ops.scrape_run_accounts where run_id=r.id and account_id=a.id)
    or not exists(select 1 from ops.collector_runs where run_id=r.id and registration_closed)
    or exists(select 1 from ops.collector_passes where run_id=r.id and status='pending')
    or exists(select 1 from ops.collector_launches where run_id=r.id and (apify_run_id is null or approval_id<>'123e88b6-5920-4e54-832a-ad6d87c22675'::uuid))
    or exists(select 1 from ops.apify_runs where run_id=r.id and processed_at is null) then
    raise exception using errcode='55000',message='M04 incremental recorded parent ownership or closure changed';
   end if;
  elsif a.last_run_id is not null and exists(select 1 from ops.scrape_runs where id=a.last_run_id and (status='running' or finished_at is null)) then
   raise exception using errcode='55000',message='M04 incremental baseline parent unfinished';
  end if;
  update app.competitor_accounts set
   backfill_status=coalesce((e->'selection'->>'backfill_status')::app.backfill_status,a.backfill_status),
   backfill_cursor=case when e->'selection' ? 'backfill_cursor' then nullif(e->'selection'->'backfill_cursor','null'::jsonb) else a.backfill_cursor end,
   next_due_at=case when e->'selection' ? 'next_due_at' then (e->'selection'->>'next_due_at')::timestamptz else least(a.next_due_at,clock_timestamp()-interval '1 second') end,
   updated_at=clock_timestamp()
   where id=a.id and updated_at=a.updated_at and locked_until is null;
  if not found then raise exception using errcode='55000',message='M04 incremental compare-and-set failed';end if;
 end loop;
end $m04_operational$;
select jsonb_build_object('operation','setup-accepted-vimeo','preservedContentAndWatermarks',true,'accounts',
 (select jsonb_agg(to_jsonb(a) order by a.id) from app.competitor_accounts a where a.id in
  (select (x->'account'->>'id')::uuid from jsonb_array_elements($m04_5b3e956933e41321$[{"key":"C000:vimeo:0","company_code":"C000","account":{"id":"985a57dd-7934-422d-9d18-4e8ca59fc197","url":"https://vimeo.com/everyonefilms","handle":"everyonefilms","status":"active","cadence":"1 day","platform":"vimeo","created_at":"2026-10-18T01:12:10.339281+00:00","last_error":null,"updated_at":"2026-10-27T13:55:13.580745+00:00","external_id":"157330576","handle_norm":"everyonefilms","items_count":5,"last_run_id":"f468793d-5bae-430b-909e-a6aed4de7e26","next_due_at":"2026-10-18T01:12:10.339281+00:00","locked_until":null,"backfill_from":"2024-01-01","competitor_id":"94928d31-8983-403c-bdbd-f5f44613d631","last_error_at":null,"resolve_status":"resolved","backfill_cursor":null,"backfill_status":"pending","last_success_at":"2026-10-27T13:47:54.079492+00:00","last_external_id":"1236174183","uploads_playlist_id":null,"consecutive_failures":0,"last_item_published_at":"2026-10-15T11:11:11+00:00"},"selection":{"backfill_status":"pending","backfill_cursor":{"page":2,"endpoint":"users","resourcePath":"/users/157330576","page_size":5}}},{"key":"C001:vimeo:0","company_code":"C001","account":{"id":"8fefa9a1-3637-43db-843d-97caa9afcc79","url":"https://vimeo.com/goodpeoplefilms","handle":"goodpeoplefilms","status":"active","cadence":"1 day","platform":"vimeo","created_at":"2026-10-18T01:12:10.339281+00:00","last_error":null,"updated_at":"2026-10-27T13:55:13.57849+00:00","external_id":"49236950","handle_norm":"goodpeoplefilms","items_count":5,"last_run_id":"f468793d-5bae-430b-909e-a6aed4de7e26","next_due_at":"2026-10-18T01:12:10.339281+00:00","locked_until":null,"backfill_from":"2024-01-01","competitor_id":"9a0dba8a-b946-45a1-bd53-933216f1fc4d","last_error_at":null,"resolve_status":"resolved","backfill_cursor":null,"backfill_status":"pending","last_success_at":"2026-10-27T13:47:53.212108+00:00","last_external_id":"981277189","uploads_playlist_id":null,"consecutive_failures":0,"last_item_published_at":"2024-07-09T12:14:00+00:00"},"selection":{"backfill_status":"pending","backfill_cursor":{"page":2,"endpoint":"users","resourcePath":"/users/49236950","page_size":5}}}]$m04_5b3e956933e41321$::jsonb) x))) as incremental_operational;
