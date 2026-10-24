select jsonb_build_object(
  'window_id',$1::uuid,
  'window_exists',exists(select 1 from ops.foundation_gateway_rate_windows where window_id=$1::uuid),
  'observed_at',clock_timestamp(),
  'requests',coalesce((select jsonb_agg(jsonb_build_object(
    'request_id',q.request_id,'operation',q.operation,'state',q.state,
    'read_started',q.read_started,'completed_at',q.completed_at) order by q.request_id)
    from ops.foundation_gateway_requests q where q.window_id=$1::uuid and q.request_id=any($2::uuid[])),'[]'::jsonb),
  'leases',coalesce((select jsonb_agg(jsonb_build_object('slot',l.slot,'request_id',l.request_id,'expires_at',l.expires_at))
    from ops.foundation_gateway_leases l where l.window_id=$1::uuid and l.request_id is not null),'[]'::jsonb),
  'unsettled_requests',(select count(*) from ops.foundation_gateway_requests q where q.window_id=$1::uuid and (q.state='reserved' or q.completed_at is null)),
  'providers',coalesce((select jsonb_agg(jsonb_build_object(
    'execution_id',l.execution_id,'scrape_execution_id',r.n8n_execution_id,
    'run_status',r.status,'run_finished_at',r.finished_at,
    'terminal_cost_match',(select a.usage_usd=round((s->>'usage_usd')::numeric,6)
      from jsonb_array_elements($4::jsonb) s where s->>'apify_run_id'=l.apify_run_id),
    'launch',ops.get_apify_launch(l.launch_id),'registry',to_jsonb(a)) order by l.ordinal)
    from ops.apify_launch_admissions l join ops.scrape_runs r on r.id=l.run_id
    left join ops.apify_runs a on a.apify_run_id=l.apify_run_id
    where l.window_id=$1::uuid and (l.execution_id=any($3::text[]) or r.n8n_execution_id=any($3::text[]))),'[]'::jsonb)
) as settlement;
