-- Validation happens before a window is created or its clock/counters can move.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select extensions.no_plan();
select extensions.is((select count(*)::int from ops.foundation_gateway_rate_windows),0,'boundary tests require no active foundation window');
create function pg_temp.boundary(p_operation text,p_args jsonb)
returns jsonb language sql as $$
  select ops.foundation_gateway_admit('df4f29ec-e2dc-4d82-a276-62a4e695e6f9','50000000-0000-4000-8000-000000000001',p_operation,p_args,'admit');
$$;
set local session authorization n8n_writer;
select extensions.throws_ok(format('select pg_temp.boundary(%L,%L::jsonb)',operation,args::text),'22023',null,label)
from (values
  ('callback.reject','{"executionId":123,"apifyRunId":"Unknown","reason":"unregistered"}'::jsonb,'callback execution identity must be JSON string'),
  ('callback.reject','{"executionId":"one","apifyRunId":123,"reason":"unregistered"}'::jsonb,'callback provider identity must be JSON string'),
  ('callback.reject','{"executionId":"one","apifyRunId":"Unknown","reason":true}'::jsonb,'callback reason must be a fixed JSON string'),
  ('error.log','{"entry":{"kind":"error","workflow":"WF-99","execution_id":123,"node":"Workflow","message":"workflow_failed"}}'::jsonb,'error execution identity must be JSON string'),
  ('error.log','{"entry":{"kind":"error","workflow":"WF-99","execution_id":"one","node":["Workflow"],"message":"workflow_failed"}}'::jsonb,'error node must be JSON string'),
  ('error.log','{"entry":{"kind":"error","workflow":"WF-99","execution_id":"one","node":"Workflow","message":"workflow_failed","raw":{"Authorization":"synthetic"}}}'::jsonb,'error context cannot add raw fields'),
  ('launch.reconcile','{"launchId":"50000000-0000-4000-8000-000000000001","apifyRunId":"Unknown","launch":{}}'::jsonb,'launch recovery accepts IDs only, never caller metadata'),
  ('apify.process','{"apifyRunId":"Unknown","status":"SUCCEEDED","datasetId":"dataset","usageUsd":"0.01","groups":[]}'::jsonb,'usage amount must be numeric'),
  ('cost.log','{"entries":[{"provider":"other","category":"scrape","quantity":1,"unit":"result","cost_usd":0.01,"run_id":"50000000-0000-4000-8000-000000000001","meta":{"cost_key":"other"}}]}'::jsonb,'cost replay cannot invent another provider charge'),
  ('cost.log','{"entries":[{"provider":"apify","category":"scrape","quantity":1,"unit":"result","cost_usd":0.01,"run_id":"50000000-0000-4000-8000-000000000001","meta":{"cost_key":"apify:Unknown:50000000-0000-4000-8000-000000000002"}}]}'::jsonb,'cost replay requires all registered attribution metadata'),
  ('cost.log','{"entries":[{"provider":"apify","category":"scrape","quantity":"1","unit":"result","cost_usd":0.01,"run_id":"50000000-0000-4000-8000-000000000001","meta":{"actor":"apify/website-content-crawler","apify_run_id":"Unknown","account_id":"50000000-0000-4000-8000-000000000002","cost_key":"apify:Unknown:50000000-0000-4000-8000-000000000002"}}]}'::jsonb,'cost quantity must be numeric'),
  ('cost.log','{"entries":[{"provider":"apify","category":"scrape","quantity":2,"unit":"result","cost_usd":0.01,"run_id":"50000000-0000-4000-8000-000000000001","meta":{"actor":"apify/website-content-crawler","apify_run_id":"Unknown","account_id":"50000000-0000-4000-8000-000000000002","cost_key":"apify:Unknown:50000000-0000-4000-8000-000000000002"}}]}'::jsonb,'one-page cost cannot claim two results'),
  ('cost.log','{"entries":[{}, {}, {}]}'::jsonb,'cost batch is bounded to two receipts'),
  ('run.start','{"workflow":"WF-99","platform":null,"mode":"manual","env":"dev","executionId":123}'::jsonb,'start execution identity must be JSON string'),
  ('run.finish','{"runId":"50000000-0000-4000-8000-000000000001","status":"success","error":"unclassified raw failure","apifyRunId":null}'::jsonb,'finish accepts only fixed error classes'),
  ('apify.dataset.read','{"apifyRunId":"Unknown","url":"https://example.test"}'::jsonb,'dataset cannot choose another host or URL')
) cases(operation,args,label);
reset session authorization;
select extensions.is((select count(*)::int from ops.foundation_gateway_rate_windows),0,'invalid requests create no window or clock');
select extensions.is((select count(*)::int from ops.foundation_gateway_requests),0,'invalid requests create no request reservations');
select * from extensions.finish();
rollback;
