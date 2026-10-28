-- Exact reviewed operational selection only; full-row compare-and-set.
do $m04_operational$
declare entries jsonb:=$m04_616cf1f9211bdf4f$[{"key":"C001:instagram:0","company_code":"C001","account":{"id":"bed82782-753f-4ba9-91ca-691ef36f75c6","url":"https://www.instagram.com/goodpeoplefilms/","handle":"goodpeoplefilms","status":"active","cadence":"1 day","platform":"instagram","created_at":"2026-10-18T01:12:10.339281+00:00","last_error":null,"updated_at":"2026-10-28T01:23:38.754733+00:00","external_id":null,"handle_norm":"goodpeoplefilms","items_count":24,"last_run_id":"8cc7411f-767a-4c7c-bb9a-5b868388d2a3","next_due_at":"2026-10-28T21:23:38.754733+00:00","locked_until":null,"backfill_from":"2024-01-01","competitor_id":"9a0dba8a-b946-45a1-bd53-933216f1fc4d","last_error_at":null,"resolve_status":"not_needed","backfill_cursor":null,"backfill_status":"pending","last_success_at":"2026-10-28T01:23:38.754733+00:00","last_external_id":"DaIxMPasd4-","uploads_playlist_id":null,"consecutive_failures":0,"last_item_published_at":"2026-06-28T16:55:05+00:00"},"owner":{"run_id":"8cc7411f-767a-4c7c-bb9a-5b868388d2a3","execution_id":"31187"},"selection":{}}]$m04_616cf1f9211bdf4f$::jsonb; e jsonb; a app.competitor_accounts%rowtype; r ops.scrape_runs%rowtype;
begin
 if exists(select 1 from app.competitor_accounts where locked_until>clock_timestamp())
  or exists(select 1 from ops.scrape_runs where status='running')
  or exists(select 1 from ops.apify_runs where processed_at is null) then
  raise exception using errcode='55000',message='M04 HC01 global unfinished work changed';
 end if;
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
   if not found or r.env<>'dev' or r.started_at<'2026-10-28T00:43:24Z'::timestamptz or r.workflow is distinct from (case when a.platform='vimeo' then 'WF-10' else 'WF-11' end)
    or r.platform is distinct from a.platform or r.n8n_execution_id is distinct from e->'owner'->>'execution_id'
    or r.status='running' or r.finished_at is null or a.last_run_id is distinct from r.id
    or not exists(select 1 from ops.collector_accounts where run_id=r.id and account_id=a.id)
    or not exists(select 1 from ops.scrape_run_accounts where run_id=r.id and account_id=a.id)
    or not exists(select 1 from ops.collector_runs where run_id=r.id and registration_closed)
    or exists(select 1 from ops.collector_passes where run_id=r.id and status='pending')
    or exists(select 1 from ops.collector_launches where run_id=r.id and (apify_run_id is null or approval_id<>'1cf8406c-1142-445e-a237-6d0fd7a67b22'::uuid))
    or exists(select 1 from ops.apify_runs where run_id=r.id and processed_at is null) then
    raise exception using errcode='55000',message='M04 incremental recorded parent ownership or closure changed';
   end if;
  elsif a.last_run_id is not null and exists(select 1 from ops.scrape_runs where id=a.last_run_id and (status='running' or finished_at is null)) then
   raise exception using errcode='55000',message='M04 incremental baseline parent unfinished';
  end if;
  if e ? 'accepted_vimeo_parent' then
   select * into r from ops.scrape_runs where id='74fae456-a34c-4460-a5ea-6ab66ecec431'::uuid;
   if not found or r.env<>'dev' or r.workflow<>'WF-10' or r.platform<>'vimeo' or r.mode<>'backfill'
    or r.status<>'success' or r.finished_at is null or r.n8n_execution_id<>'31176' or a.last_run_id is distinct from r.id
    or not exists(select 1 from ops.collector_accounts where run_id=r.id and account_id=a.id)
    or not exists(select 1 from ops.scrape_run_accounts where run_id=r.id and account_id=a.id and status='success')
    or not exists(select 1 from ops.collector_runs where run_id=r.id and registration_closed)
    or exists(select 1 from ops.collector_passes where run_id=r.id and status='pending')
    or exists(select 1 from ops.collector_launches where run_id=r.id)
    or exists(select 1 from ops.apify_runs where run_id=r.id) then
    raise exception using errcode='55000',message='M04 HC01 accepted Vimeo parent ownership or closure changed';
   end if;
  end if;
  update app.competitor_accounts set
   
   
   next_due_at=case when e->'selection' ? 'next_due_at' then (e->'selection'->>'next_due_at')::timestamptz else least(a.next_due_at,clock_timestamp()-interval '1 second') end,
   updated_at=clock_timestamp()
   where id=a.id and updated_at=a.updated_at and locked_until is null;
  if not found then raise exception using errcode='55000',message='M04 incremental compare-and-set failed';end if;
 end loop;
end $m04_operational$;
select jsonb_build_object('operation','daily-due','preservedContentAndWatermarks',true,'accounts',
 (select jsonb_agg(to_jsonb(a) order by a.id) from app.competitor_accounts a where a.id in
  (select (x->'account'->>'id')::uuid from jsonb_array_elements($m04_616cf1f9211bdf4f$[{"key":"C001:instagram:0","company_code":"C001","account":{"id":"bed82782-753f-4ba9-91ca-691ef36f75c6","url":"https://www.instagram.com/goodpeoplefilms/","handle":"goodpeoplefilms","status":"active","cadence":"1 day","platform":"instagram","created_at":"2026-10-18T01:12:10.339281+00:00","last_error":null,"updated_at":"2026-10-28T01:23:38.754733+00:00","external_id":null,"handle_norm":"goodpeoplefilms","items_count":24,"last_run_id":"8cc7411f-767a-4c7c-bb9a-5b868388d2a3","next_due_at":"2026-10-28T21:23:38.754733+00:00","locked_until":null,"backfill_from":"2024-01-01","competitor_id":"9a0dba8a-b946-45a1-bd53-933216f1fc4d","last_error_at":null,"resolve_status":"not_needed","backfill_cursor":null,"backfill_status":"pending","last_success_at":"2026-10-28T01:23:38.754733+00:00","last_external_id":"DaIxMPasd4-","uploads_playlist_id":null,"consecutive_failures":0,"last_item_published_at":"2026-06-28T16:55:05+00:00"},"owner":{"run_id":"8cc7411f-767a-4c7c-bb9a-5b868388d2a3","execution_id":"31187"},"selection":{}}]$m04_616cf1f9211bdf4f$::jsonb) x))) as incremental_operational;

-- Exact reviewed operational selection only; full-row compare-and-set.
do $m04_operational$
declare entries jsonb:=$m04_39f4d334f437c377$[{"key":"C130:instagram:0","company_code":"C130","account":{"id":"46149fb9-8905-4b76-9834-4b38f668a2e2","url":"https://www.instagram.com/bigfootfilms/","handle":"bigfootfilms","status":"active","cadence":"1 day","platform":"instagram","created_at":"2026-10-18T01:12:10.339281+00:00","last_error":null,"updated_at":"2026-10-28T01:23:57.361725+00:00","external_id":null,"handle_norm":"bigfootfilms","items_count":74,"last_run_id":"8cc7411f-767a-4c7c-bb9a-5b868388d2a3","next_due_at":"2026-10-28T21:23:57.361725+00:00","locked_until":null,"backfill_from":"2024-01-01","competitor_id":"7ba084a1-52a1-49d5-b3a9-e488289cb504","last_error_at":null,"resolve_status":"not_needed","backfill_cursor":null,"backfill_status":"pending","last_success_at":"2026-10-28T01:23:57.361725+00:00","last_external_id":"DemKsgZtVk2","uploads_playlist_id":null,"consecutive_failures":0,"last_item_published_at":"2026-10-17T13:01:23+00:00"},"owner":{"run_id":"8cc7411f-767a-4c7c-bb9a-5b868388d2a3","execution_id":"31187"},"selection":{}}]$m04_39f4d334f437c377$::jsonb; e jsonb; a app.competitor_accounts%rowtype; r ops.scrape_runs%rowtype;
begin
 if exists(select 1 from app.competitor_accounts where locked_until>clock_timestamp())
  or exists(select 1 from ops.scrape_runs where status='running')
  or exists(select 1 from ops.apify_runs where processed_at is null) then
  raise exception using errcode='55000',message='M04 HC01 global unfinished work changed';
 end if;
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
   if not found or r.env<>'dev' or r.started_at<'2026-10-28T00:43:24Z'::timestamptz or r.workflow is distinct from (case when a.platform='vimeo' then 'WF-10' else 'WF-11' end)
    or r.platform is distinct from a.platform or r.n8n_execution_id is distinct from e->'owner'->>'execution_id'
    or r.status='running' or r.finished_at is null or a.last_run_id is distinct from r.id
    or not exists(select 1 from ops.collector_accounts where run_id=r.id and account_id=a.id)
    or not exists(select 1 from ops.scrape_run_accounts where run_id=r.id and account_id=a.id)
    or not exists(select 1 from ops.collector_runs where run_id=r.id and registration_closed)
    or exists(select 1 from ops.collector_passes where run_id=r.id and status='pending')
    or exists(select 1 from ops.collector_launches where run_id=r.id and (apify_run_id is null or approval_id<>'1cf8406c-1142-445e-a237-6d0fd7a67b22'::uuid))
    or exists(select 1 from ops.apify_runs where run_id=r.id and processed_at is null) then
    raise exception using errcode='55000',message='M04 incremental recorded parent ownership or closure changed';
   end if;
  elsif a.last_run_id is not null and exists(select 1 from ops.scrape_runs where id=a.last_run_id and (status='running' or finished_at is null)) then
   raise exception using errcode='55000',message='M04 incremental baseline parent unfinished';
  end if;
  if e ? 'accepted_vimeo_parent' then
   select * into r from ops.scrape_runs where id='74fae456-a34c-4460-a5ea-6ab66ecec431'::uuid;
   if not found or r.env<>'dev' or r.workflow<>'WF-10' or r.platform<>'vimeo' or r.mode<>'backfill'
    or r.status<>'success' or r.finished_at is null or r.n8n_execution_id<>'31176' or a.last_run_id is distinct from r.id
    or not exists(select 1 from ops.collector_accounts where run_id=r.id and account_id=a.id)
    or not exists(select 1 from ops.scrape_run_accounts where run_id=r.id and account_id=a.id and status='success')
    or not exists(select 1 from ops.collector_runs where run_id=r.id and registration_closed)
    or exists(select 1 from ops.collector_passes where run_id=r.id and status='pending')
    or exists(select 1 from ops.collector_launches where run_id=r.id)
    or exists(select 1 from ops.apify_runs where run_id=r.id) then
    raise exception using errcode='55000',message='M04 HC01 accepted Vimeo parent ownership or closure changed';
   end if;
  end if;
  update app.competitor_accounts set
   
   
   next_due_at=case when e->'selection' ? 'next_due_at' then (e->'selection'->>'next_due_at')::timestamptz else least(a.next_due_at,clock_timestamp()-interval '1 second') end,
   updated_at=clock_timestamp()
   where id=a.id and updated_at=a.updated_at and locked_until is null;
  if not found then raise exception using errcode='55000',message='M04 incremental compare-and-set failed';end if;
 end loop;
end $m04_operational$;
select jsonb_build_object('operation','daily-due','preservedContentAndWatermarks',true,'accounts',
 (select jsonb_agg(to_jsonb(a) order by a.id) from app.competitor_accounts a where a.id in
  (select (x->'account'->>'id')::uuid from jsonb_array_elements($m04_39f4d334f437c377$[{"key":"C130:instagram:0","company_code":"C130","account":{"id":"46149fb9-8905-4b76-9834-4b38f668a2e2","url":"https://www.instagram.com/bigfootfilms/","handle":"bigfootfilms","status":"active","cadence":"1 day","platform":"instagram","created_at":"2026-10-18T01:12:10.339281+00:00","last_error":null,"updated_at":"2026-10-28T01:23:57.361725+00:00","external_id":null,"handle_norm":"bigfootfilms","items_count":74,"last_run_id":"8cc7411f-767a-4c7c-bb9a-5b868388d2a3","next_due_at":"2026-10-28T21:23:57.361725+00:00","locked_until":null,"backfill_from":"2024-01-01","competitor_id":"7ba084a1-52a1-49d5-b3a9-e488289cb504","last_error_at":null,"resolve_status":"not_needed","backfill_cursor":null,"backfill_status":"pending","last_success_at":"2026-10-28T01:23:57.361725+00:00","last_external_id":"DemKsgZtVk2","uploads_playlist_id":null,"consecutive_failures":0,"last_item_published_at":"2026-10-17T13:01:23+00:00"},"owner":{"run_id":"8cc7411f-767a-4c7c-bb9a-5b868388d2a3","execution_id":"31187"},"selection":{}}]$m04_39f4d334f437c377$::jsonb) x))) as incremental_operational;

-- Exact reviewed operational selection only; full-row compare-and-set.
do $m04_operational$
declare entries jsonb:=$m04_f1c5e989bf645939$[{"key":"C270:instagram:0","company_code":"C270","account":{"id":"2d42d451-ac9a-42ac-a879-8760d63c8108","url":"https://www.instagram.com/thetalkies/","handle":"thetalkies","status":"active","cadence":"1 day","platform":"instagram","created_at":"2026-10-18T01:12:10.339281+00:00","last_error":null,"updated_at":"2026-10-28T01:22:34.657964+00:00","external_id":null,"handle_norm":"thetalkies","items_count":22,"last_run_id":"8cc7411f-767a-4c7c-bb9a-5b868388d2a3","next_due_at":"2026-10-28T21:22:34.657964+00:00","locked_until":null,"backfill_from":"2024-01-01","competitor_id":"db652794-e33e-4723-ab48-cf75e0b8ae68","last_error_at":null,"resolve_status":"not_needed","backfill_cursor":null,"backfill_status":"pending","last_success_at":"2026-10-28T01:22:34.657964+00:00","last_external_id":"De__YlMobVD","uploads_playlist_id":null,"consecutive_failures":0,"last_item_published_at":"2026-10-27T14:03:28+00:00"},"owner":{"run_id":"8cc7411f-767a-4c7c-bb9a-5b868388d2a3","execution_id":"31187"},"selection":{}}]$m04_f1c5e989bf645939$::jsonb; e jsonb; a app.competitor_accounts%rowtype; r ops.scrape_runs%rowtype;
begin
 if exists(select 1 from app.competitor_accounts where locked_until>clock_timestamp())
  or exists(select 1 from ops.scrape_runs where status='running')
  or exists(select 1 from ops.apify_runs where processed_at is null) then
  raise exception using errcode='55000',message='M04 HC01 global unfinished work changed';
 end if;
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
   if not found or r.env<>'dev' or r.started_at<'2026-10-28T00:43:24Z'::timestamptz or r.workflow is distinct from (case when a.platform='vimeo' then 'WF-10' else 'WF-11' end)
    or r.platform is distinct from a.platform or r.n8n_execution_id is distinct from e->'owner'->>'execution_id'
    or r.status='running' or r.finished_at is null or a.last_run_id is distinct from r.id
    or not exists(select 1 from ops.collector_accounts where run_id=r.id and account_id=a.id)
    or not exists(select 1 from ops.scrape_run_accounts where run_id=r.id and account_id=a.id)
    or not exists(select 1 from ops.collector_runs where run_id=r.id and registration_closed)
    or exists(select 1 from ops.collector_passes where run_id=r.id and status='pending')
    or exists(select 1 from ops.collector_launches where run_id=r.id and (apify_run_id is null or approval_id<>'1cf8406c-1142-445e-a237-6d0fd7a67b22'::uuid))
    or exists(select 1 from ops.apify_runs where run_id=r.id and processed_at is null) then
    raise exception using errcode='55000',message='M04 incremental recorded parent ownership or closure changed';
   end if;
  elsif a.last_run_id is not null and exists(select 1 from ops.scrape_runs where id=a.last_run_id and (status='running' or finished_at is null)) then
   raise exception using errcode='55000',message='M04 incremental baseline parent unfinished';
  end if;
  if e ? 'accepted_vimeo_parent' then
   select * into r from ops.scrape_runs where id='74fae456-a34c-4460-a5ea-6ab66ecec431'::uuid;
   if not found or r.env<>'dev' or r.workflow<>'WF-10' or r.platform<>'vimeo' or r.mode<>'backfill'
    or r.status<>'success' or r.finished_at is null or r.n8n_execution_id<>'31176' or a.last_run_id is distinct from r.id
    or not exists(select 1 from ops.collector_accounts where run_id=r.id and account_id=a.id)
    or not exists(select 1 from ops.scrape_run_accounts where run_id=r.id and account_id=a.id and status='success')
    or not exists(select 1 from ops.collector_runs where run_id=r.id and registration_closed)
    or exists(select 1 from ops.collector_passes where run_id=r.id and status='pending')
    or exists(select 1 from ops.collector_launches where run_id=r.id)
    or exists(select 1 from ops.apify_runs where run_id=r.id) then
    raise exception using errcode='55000',message='M04 HC01 accepted Vimeo parent ownership or closure changed';
   end if;
  end if;
  update app.competitor_accounts set
   
   
   next_due_at=case when e->'selection' ? 'next_due_at' then (e->'selection'->>'next_due_at')::timestamptz else least(a.next_due_at,clock_timestamp()-interval '1 second') end,
   updated_at=clock_timestamp()
   where id=a.id and updated_at=a.updated_at and locked_until is null;
  if not found then raise exception using errcode='55000',message='M04 incremental compare-and-set failed';end if;
 end loop;
end $m04_operational$;
select jsonb_build_object('operation','daily-due','preservedContentAndWatermarks',true,'accounts',
 (select jsonb_agg(to_jsonb(a) order by a.id) from app.competitor_accounts a where a.id in
  (select (x->'account'->>'id')::uuid from jsonb_array_elements($m04_f1c5e989bf645939$[{"key":"C270:instagram:0","company_code":"C270","account":{"id":"2d42d451-ac9a-42ac-a879-8760d63c8108","url":"https://www.instagram.com/thetalkies/","handle":"thetalkies","status":"active","cadence":"1 day","platform":"instagram","created_at":"2026-10-18T01:12:10.339281+00:00","last_error":null,"updated_at":"2026-10-28T01:22:34.657964+00:00","external_id":null,"handle_norm":"thetalkies","items_count":22,"last_run_id":"8cc7411f-767a-4c7c-bb9a-5b868388d2a3","next_due_at":"2026-10-28T21:22:34.657964+00:00","locked_until":null,"backfill_from":"2024-01-01","competitor_id":"db652794-e33e-4723-ab48-cf75e0b8ae68","last_error_at":null,"resolve_status":"not_needed","backfill_cursor":null,"backfill_status":"pending","last_success_at":"2026-10-28T01:22:34.657964+00:00","last_external_id":"De__YlMobVD","uploads_playlist_id":null,"consecutive_failures":0,"last_item_published_at":"2026-10-27T14:03:28+00:00"},"owner":{"run_id":"8cc7411f-767a-4c7c-bb9a-5b868388d2a3","execution_id":"31187"},"selection":{}}]$m04_f1c5e989bf645939$::jsonb) x))) as incremental_operational;

-- Exact reviewed operational selection only; full-row compare-and-set.
do $m04_operational$
declare entries jsonb:=$m04_2acc9c08f8930e48$[{"key":"C226:instagram:0","company_code":"C226","account":{"id":"3ca3befa-abe6-4540-a389-0cf16115c581","url":"https://www.instagram.com/bigkahunafilms/","handle":"bigkahunafilms","status":"active","cadence":"1 day","platform":"instagram","created_at":"2026-10-18T01:12:10.339281+00:00","last_error":null,"updated_at":"2026-10-28T01:23:47.094537+00:00","external_id":null,"handle_norm":"bigkahunafilms","items_count":19,"last_run_id":"8cc7411f-767a-4c7c-bb9a-5b868388d2a3","next_due_at":"2026-10-28T21:23:47.094537+00:00","locked_until":null,"backfill_from":"2024-01-01","competitor_id":"1cd50dba-b2de-4740-b28c-6d53ebd2b08d","last_error_at":null,"resolve_status":"not_needed","backfill_cursor":null,"backfill_status":"pending","last_success_at":"2026-10-28T01:23:47.094537+00:00","last_external_id":"Da7-FRXtqGp","uploads_playlist_id":null,"consecutive_failures":0,"last_item_published_at":"2026-07-18T14:10:39+00:00"},"owner":{"run_id":"8cc7411f-767a-4c7c-bb9a-5b868388d2a3","execution_id":"31187"},"selection":{}}]$m04_2acc9c08f8930e48$::jsonb; e jsonb; a app.competitor_accounts%rowtype; r ops.scrape_runs%rowtype;
begin
 if exists(select 1 from app.competitor_accounts where locked_until>clock_timestamp())
  or exists(select 1 from ops.scrape_runs where status='running')
  or exists(select 1 from ops.apify_runs where processed_at is null) then
  raise exception using errcode='55000',message='M04 HC01 global unfinished work changed';
 end if;
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
   if not found or r.env<>'dev' or r.started_at<'2026-10-28T00:43:24Z'::timestamptz or r.workflow is distinct from (case when a.platform='vimeo' then 'WF-10' else 'WF-11' end)
    or r.platform is distinct from a.platform or r.n8n_execution_id is distinct from e->'owner'->>'execution_id'
    or r.status='running' or r.finished_at is null or a.last_run_id is distinct from r.id
    or not exists(select 1 from ops.collector_accounts where run_id=r.id and account_id=a.id)
    or not exists(select 1 from ops.scrape_run_accounts where run_id=r.id and account_id=a.id)
    or not exists(select 1 from ops.collector_runs where run_id=r.id and registration_closed)
    or exists(select 1 from ops.collector_passes where run_id=r.id and status='pending')
    or exists(select 1 from ops.collector_launches where run_id=r.id and (apify_run_id is null or approval_id<>'1cf8406c-1142-445e-a237-6d0fd7a67b22'::uuid))
    or exists(select 1 from ops.apify_runs where run_id=r.id and processed_at is null) then
    raise exception using errcode='55000',message='M04 incremental recorded parent ownership or closure changed';
   end if;
  elsif a.last_run_id is not null and exists(select 1 from ops.scrape_runs where id=a.last_run_id and (status='running' or finished_at is null)) then
   raise exception using errcode='55000',message='M04 incremental baseline parent unfinished';
  end if;
  if e ? 'accepted_vimeo_parent' then
   select * into r from ops.scrape_runs where id='74fae456-a34c-4460-a5ea-6ab66ecec431'::uuid;
   if not found or r.env<>'dev' or r.workflow<>'WF-10' or r.platform<>'vimeo' or r.mode<>'backfill'
    or r.status<>'success' or r.finished_at is null or r.n8n_execution_id<>'31176' or a.last_run_id is distinct from r.id
    or not exists(select 1 from ops.collector_accounts where run_id=r.id and account_id=a.id)
    or not exists(select 1 from ops.scrape_run_accounts where run_id=r.id and account_id=a.id and status='success')
    or not exists(select 1 from ops.collector_runs where run_id=r.id and registration_closed)
    or exists(select 1 from ops.collector_passes where run_id=r.id and status='pending')
    or exists(select 1 from ops.collector_launches where run_id=r.id)
    or exists(select 1 from ops.apify_runs where run_id=r.id) then
    raise exception using errcode='55000',message='M04 HC01 accepted Vimeo parent ownership or closure changed';
   end if;
  end if;
  update app.competitor_accounts set
   
   
   next_due_at=case when e->'selection' ? 'next_due_at' then (e->'selection'->>'next_due_at')::timestamptz else least(a.next_due_at,clock_timestamp()-interval '1 second') end,
   updated_at=clock_timestamp()
   where id=a.id and updated_at=a.updated_at and locked_until is null;
  if not found then raise exception using errcode='55000',message='M04 incremental compare-and-set failed';end if;
 end loop;
end $m04_operational$;
select jsonb_build_object('operation','daily-due','preservedContentAndWatermarks',true,'accounts',
 (select jsonb_agg(to_jsonb(a) order by a.id) from app.competitor_accounts a where a.id in
  (select (x->'account'->>'id')::uuid from jsonb_array_elements($m04_2acc9c08f8930e48$[{"key":"C226:instagram:0","company_code":"C226","account":{"id":"3ca3befa-abe6-4540-a389-0cf16115c581","url":"https://www.instagram.com/bigkahunafilms/","handle":"bigkahunafilms","status":"active","cadence":"1 day","platform":"instagram","created_at":"2026-10-18T01:12:10.339281+00:00","last_error":null,"updated_at":"2026-10-28T01:23:47.094537+00:00","external_id":null,"handle_norm":"bigkahunafilms","items_count":19,"last_run_id":"8cc7411f-767a-4c7c-bb9a-5b868388d2a3","next_due_at":"2026-10-28T21:23:47.094537+00:00","locked_until":null,"backfill_from":"2024-01-01","competitor_id":"1cd50dba-b2de-4740-b28c-6d53ebd2b08d","last_error_at":null,"resolve_status":"not_needed","backfill_cursor":null,"backfill_status":"pending","last_success_at":"2026-10-28T01:23:47.094537+00:00","last_external_id":"Da7-FRXtqGp","uploads_playlist_id":null,"consecutive_failures":0,"last_item_published_at":"2026-07-18T14:10:39+00:00"},"owner":{"run_id":"8cc7411f-767a-4c7c-bb9a-5b868388d2a3","execution_id":"31187"},"selection":{}}]$m04_2acc9c08f8930e48$::jsonb) x))) as incremental_operational;
