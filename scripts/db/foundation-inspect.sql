-- Fixed SELECT-only dev reconciliation. No RPC invocation, payload/result read,
-- role/default change, clock admission, repair, close or archive operation.
select jsonb_build_object(
  'kind','m03_foundation_inspection','windowId','df4f29ec-e2dc-4d82-a276-62a4e695e6f9',
  'identity',current_user='postgres' and session_user='postgres' and current_database()='postgres',
  'window',(select jsonb_build_object('id',w.window_id,'audience',w.bound_audience,
    'commitSha',w.bound_commit_sha,'deploymentId',w.bound_deployment_id,'startsAt',w.starts_at,
    'expiresAt',w.expires_at,'closedAt',w.closed_at,'admittedCount',w.admitted_count,'closeCount',w.close_count)
    from ops.foundation_gateway_rate_windows w where w.window_id='df4f29ec-e2dc-4d82-a276-62a4e695e6f9'),
  'requestCount',(select count(*) from ops.foundation_gateway_requests where window_id='df4f29ec-e2dc-4d82-a276-62a4e695e6f9'),
  'reservedRequests',(select count(*) from ops.foundation_gateway_requests where window_id='df4f29ec-e2dc-4d82-a276-62a4e695e6f9' and state='reserved'),
  'incompleteRequests',(select count(*) from ops.foundation_gateway_requests where window_id='df4f29ec-e2dc-4d82-a276-62a4e695e6f9' and completed_at is null),
  'activeLeaseCount',(select count(*) from ops.foundation_gateway_leases where window_id='df4f29ec-e2dc-4d82-a276-62a4e695e6f9' and request_id is not null),
  'approval',(select jsonb_build_object('closed',a.closed_at is not null,'expiresAt',a.expires_at,
    'actorBuild',a.actor_build,'maxChargeUsd',a.max_total_charge_usd,'batchMaxUsd',a.batch_max_usd)
    from ops.apify_launch_approvals a where a.window_id='df4f29ec-e2dc-4d82-a276-62a4e695e6f9'),
  'launchCount',(select count(*) from ops.apify_launch_admissions where window_id='df4f29ec-e2dc-4d82-a276-62a4e695e6f9'),
  'actorRunCount',(select count(*) from ops.apify_runs),
  'scrapeRunCount',(select count(*) from ops.scrape_runs),
  'costEntryCount',(select count(*) from ops.cost_ledger),
  'costUsd',(select coalesce(sum(cost_usd),0) from ops.cost_ledger),
  'collectedItemCount',(select count(*) from app.items),
  'fixture',(select jsonb_build_object('competitorId',c.id,'accountId',a.id,
    'competitorArchived',c.status='archived','competitorActive',c.status='active',
    'accountPaused',a.status='paused','accountActive',a.status='active',
    'itemsCount',a.items_count,'locked',a.locked_until is not null,
    'progressPresent',a.last_run_id is not null or a.last_success_at is not null or a.items_count<>0)
    from app.competitors c join app.competitor_accounts a on a.competitor_id=c.id
    where c.id='d51a39f6-fe87-4d17-aee9-3070c45693aa' and c.company_code='C999' and c.slug='emr-smoke-test'
      and a.id='bd23314c-591f-4fb7-92fd-b7450634eeb6' and a.platform='website_work_page'
      and a.url='https://everyone.film/about-everyone'),
  'audits',jsonb_build_object(
    'creationCount',(select count(*) from ops.audit_log where actor_type='system' and actor_id='m03_smoke_setup.v1'
      and action='m03_smoke_fixture_created' and entity_type='competitor' and entity_id='d51a39f6-fe87-4d17-aee9-3070c45693aa'),
    'startupCount',(select count(*) from ops.audit_log where actor_id='m03_smoke_reactivate.v1:1c69c89e-7807-46d5-b7b8-ca28285ff2b4'),
    'originalCount',(select count(*) from ops.audit_log where actor_id='m03_smoke_reactivate.v1:20275b22-b7fe-4737-a9a4-c50c2feadb74'),
    'technical2Count',(select count(*) from ops.audit_log where actor_id='m03_smoke_reactivate.v1:20275b22-b7fe-4737-a9a4-c50c2feadb74:technical-2'),
    'technical2Exact',exists(select 1 from ops.audit_log l join ops.audit_log o on o.id::text=l.after->>'original_creation_audit_id'
      where l.actor_type='system' and l.actor_id='m03_smoke_reactivate.v1:20275b22-b7fe-4737-a9a4-c50c2feadb74:technical-2'
      and l.action='m03_smoke_fixture_reactivated' and l.entity_type='competitor' and l.entity_id='d51a39f6-fe87-4d17-aee9-3070c45693aa'
      and l.before=jsonb_build_object('competitor_status','archived','account_status','paused')
      and l.after=jsonb_build_object('fixture_version',1,'project_ref','zmotjsbzhzjvpelxvxlf',
        'segment_id','20275b22-b7fe-4737-a9a4-c50c2feadb74:technical-2','competitor_id','d51a39f6-fe87-4d17-aee9-3070c45693aa',
        'account_id','bd23314c-591f-4fb7-92fd-b7450634eeb6','competitor_status','active','account_status','active','original_creation_audit_id',o.id)
      and o.actor_type='system' and o.actor_id='m03_smoke_setup.v1' and o.action='m03_smoke_fixture_created'
      and o.entity_type='competitor' and o.entity_id='d51a39f6-fe87-4d17-aee9-3070c45693aa')
  )
) as inspection;
