# Dot-sourced only after the NEW public packet verifies this exact file.
# No command accepts SQL, filenames, role changes or arbitrary CLI arguments.
function Invoke-FoundationQuery([string]$Sql,[string]$Field) {
  $file = Join-Path $scratch 'foundation-control.sql'
  [IO.File]::WriteAllText($file,$Sql,[Text.UTF8Encoding]::new($false))
  $answer = Invoke-Cli @('db','query','--file',$file) $queryTimeoutMs
  try {
    if (-not $answer.ok -or -not $answer.closed -or $null -eq $answer.text -or $answer.text.Contains($password)) { throw 'blocked' }
    $parsed = ConvertFrom-Json -InputObject $answer.text -ErrorAction Stop
    if ($parsed -isnot [Array] -or $parsed.Count -ne 1) { throw 'blocked' }
    Assert-Keys $parsed[0] @($Field)
    return $parsed[0].$Field
  } finally { $answer.text=$null }
}
function Foundation-Literal([string]$Value) { return "'" + $Value.Replace("'","''") + "'" }
function Foundation-Json($Value) { return (Foundation-Literal (ConvertTo-Json -InputObject $Value -Depth 40 -Compress)) + '::jsonb' }
function Invoke-FoundationMutation([string]$Sql) {
  $file=Join-Path $scratch 'foundation-mutation.sql'
  [IO.File]::WriteAllText($file,$Sql,[Text.UTF8Encoding]::new($false))
  $answer=Invoke-Cli @('db','query','--file',$file) $queryTimeoutMs
  try { return [ordered]@{nativeExit=$answer.nativeExit;childrenClosed=$answer.closed;acknowledged=($answer.ok -and $answer.closed)} } finally {$answer.text=$null}
}
function Foundation-FixtureSql([string]$Name) {
  $source = [IO.File]::ReadAllText((Assert-Path $repo ('scripts/assert/'+$Name)))
  # Exactly the reviewed psql wrapper is removed. The owner guard, transaction,
  # identity/baseline/ownership assertions and mutation body stay byte-for-byte.
  $tag=if($Name -ceq 'm03_smoke_setup.sql'){'smoke_setup'}else{'smoke_teardown'}
  $start = $source.IndexOf('do $'+$tag+'$')
  $end = $source.IndexOf('$'+$tag+'$;',$start)
  if ($start -lt 0 -or $end -le $start) { throw 'blocked' }
  $body=$source.Substring($start,$end-$start+($tag.Length+3))
  # db query is one prepared statement: DO is its own implicit transaction.
  # Only its fixed local settings move inside the unchanged reviewed body.
  $needle="begin`r`n";if(-not $body.Contains($needle)){$needle="begin`n"}
  $settings="begin`n  perform pg_catalog.set_config('emr.smoke_project_ref','zmotjsbzhzjvpelxvxlf',true);`n  perform pg_catalog.set_config('emr.smoke_rollback','false',true);`n  perform pg_catalog.set_config('lock_timeout','5s',true);`n  perform pg_catalog.set_config('statement_timeout','30s',true);`n"
  return $body.Replace($needle,$settings)
}
function Read-FoundationFixture([bool]$Archived=$false) {
  if($Archived){return Invoke-FoundationQuery "select jsonb_build_object('result','M03_SMOKE_FIXTURE_ARCHIVED','company_code',c.company_code,'competitor_id',c.id,'account_id',a.id,'competitor_status',c.status,'account_status',a.status,'retained_items',(select count(*) from app.items i where i.account_id=a.id)) as fixture from app.competitors c join app.competitor_accounts a on a.competitor_id=c.id where c.company_code='C999' and c.slug='emr-smoke-test';" 'fixture'}
  return Invoke-FoundationQuery "select jsonb_build_object('result','M03_SMOKE_FIXTURE_READY','company_code',c.company_code,'competitor_id',c.id,'account_id',a.id,'platform',a.platform,'url',a.url,'competitor_status',c.status,'account_status',a.status) as fixture from app.competitors c join app.competitor_accounts a on a.competitor_id=c.id where c.company_code='C999' and c.slug='emr-smoke-test' and c.status='active' and a.status in ('active','failing') and a.url='https://everyone.film/about-everyone';" 'fixture'
}
function Foundation-SmokeAssertSql($Packet) {
  $source=[IO.File]::ReadAllText((Assert-Path $repo 'scripts/assert/m03_smoke_assert.sql'))
  $start=$source.IndexOf('do $smoke_assert$');$end=$source.IndexOf('$smoke_assert$;',$start)
  if($start -lt 0 -or $end -le $start){throw 'blocked'}
  $body=$source.Substring($start,$end-$start+14)
  $needle="begin`r`n";if(-not $body.Contains($needle)){$needle="begin`n"}
  $settings="begin`n  perform pg_catalog.set_config('emr.smoke_project_ref','zmotjsbzhzjvpelxvxlf',true);`n  perform pg_catalog.set_config('emr.smoke_run_id',$(Foundation-Literal $Packet.runId),true);`n  perform pg_catalog.set_config('emr.smoke_apify_run_id',$(Foundation-Literal $Packet.apifyRunId),true);`n  perform pg_catalog.set_config('emr.smoke_expected_items_new',$(Foundation-Literal ([string]$Packet.expectedItemsNew)),true);`n  perform pg_catalog.set_config('statement_timeout','30s',true);`n"
  return $body.Replace($needle,$settings)
}
function Close-FoundationOwnedWindow($Binding) {
  $window='df4f29ec-e2dc-4d82-a276-62a4e695e6f9'
  $audience=Foundation-Literal $Binding.audience;$sha=Foundation-Literal $Binding.commitSha;$deployment=Foundation-Literal $Binding.deploymentId
  $owned=Invoke-FoundationQuery "select jsonb_build_object('owned',bound_audience=$audience and bound_commit_sha=$sha and bound_deployment_id=$deployment) as ownership from ops.foundation_gateway_rate_windows where window_id='$window';" 'ownership'
  if($owned.owned -ne $true){throw 'blocked'}
  $answer=Invoke-FoundationQuery "select ops.foundation_gateway_admit('$window','00000000-0000-4000-8000-000000000021','identity.read','{}','close') as closed;" 'closed'
  if($answer.state -cne 'closed' -or $answer.window.closed -ne $true){throw 'blocked'}
  $verified=Invoke-FoundationQuery "select jsonb_build_object('closed',w.closed_at is not null and w.close_count=1 and exists(select 1 from ops.apify_launch_approvals a where a.window_id=w.window_id and a.closed_at is not null) and not exists(select 1 from ops.foundation_gateway_leases l where l.window_id=w.window_id and l.request_id is not null) and not exists(select 1 from ops.foundation_gateway_requests r where r.window_id=w.window_id and r.state='reserved')) as closure from ops.foundation_gateway_rate_windows w where w.window_id='$window';" 'closure'
  if($verified.closed -ne $true){throw 'blocked'}
  return $answer
}
function Invoke-FoundationPostcheck {
  $proof = Invoke-FoundationQuery ([IO.File]::ReadAllText((Assert-Path $repo 'scripts/db/foundation-postcheck.sql'))) 'postcheck'
  Assert-Keys $proof @('identity','tables_rls','no_machine_table_grants','rpc_shape','owner_control_restricted','all_project_tables_rls','all_views_invoker','gw01_closed','domain_auto_join_off','baseline_counts','schemas')
  foreach ($key in @('identity','tables_rls','no_machine_table_grants','rpc_shape','owner_control_restricted','all_project_tables_rls','all_views_invoker','gw01_closed','domain_auto_join_off','baseline_counts')) { if ($proof.$key -isnot [bool] -or -not $proof.$key) { throw 'blocked' } }
  $advisors = [ordered]@{}
  foreach ($kind in @('security','performance')) {
    $result=Invoke-Cli @('db','advisors','--type',$kind,'--level','warn','--fail-on','warn') 60000
    try {
      if (-not $result.ok -or -not $result.closed -or $null -eq $result.text -or $result.text.Contains($password)) { throw 'blocked' }
      $value=ConvertFrom-Json -InputObject $result.text -ErrorAction Stop
      Assert-Keys $value @('results','message')
      if ($value.message -cne 'db advisors' -or $value.results -isnot [Array] -or $value.results.Count -ne 0) { throw 'blocked' }
      $advisors[$kind]=[ordered]@{nativeExit=0;warnings=0;errors=0;childrenClosed=$true}
    } finally { $result.text=$null }
  }
  $types=Invoke-Cli @('gen','types','--lang','typescript','--schema','app,api,ops,ingest') 60000
  try {
    if (-not $types.ok -or -not $types.closed -or $null -eq $types.text -or $types.text.Contains($password) -or $types.text.Length -lt 1000) { throw 'blocked' }
    $candidate=Join-Path $out 'm03-foundation-hosted-db.types.ts'
    if (Test-Path -LiteralPath $candidate) { throw 'blocked' }
    $stream=$null
    try { $bytes=[Text.UTF8Encoding]::new($false).GetBytes($types.text);$stream=[IO.File]::Open($candidate,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true) } finally { if($null -ne $stream){$stream.Dispose()} }
    $checked=Invoke-Bounded $node @((Assert-Path $repo 'scripts/db/check-foundation-types.mjs')) $repo 15000
    if(-not $checked.ok -or -not $checked.closed){throw 'blocked'}
    $coverage=ConvertFrom-Json -InputObject $checked.text -ErrorAction Stop
    Assert-Keys $coverage @('status','schemas','foundationTables','foundationFunctions','astEquivalent')
    if($coverage.status -cne 'types_coverage_verified' -or $coverage.schemas -ne 4 -or $coverage.foundationTables -ne 6 -or $coverage.foundationFunctions -ne 9 -or $coverage.astEquivalent -ne $true){throw 'blocked'}
    return [ordered]@{projectRef=$projectRef;migrationCount=14;catalog=$proof;advisors=$advisors;typesGenerated=$true;typesSchemaAndFoundationSymbols=$true;typesAstEquivalent=$true;typesCandidate='scripts/db/out/m03-foundation-hosted-db.types.ts';ready=$true}
  } finally { $types.text=$null }
}
function Read-FoundationCommand([DateTime]$Deadline) {
  $builder=[Text.StringBuilder]::new();$chars=New-Object char[] 1
  while($true){
    $remaining=[int][Math]::Min(60000,($Deadline-[DateTime]::UtcNow).TotalMilliseconds)
    if($remaining -le 0){throw 'blocked'}
    $task=[Console]::In.ReadAsync($chars,0,1)
    while(-not $task.Wait($remaining)){
      $remaining=[int][Math]::Min(60000,($Deadline-[DateTime]::UtcNow).TotalMilliseconds)
      if($remaining -le 0){throw 'blocked'}
    }
    if($task.Result -eq 0){return $null}
    if($chars[0] -eq "`n"){break}
    if($chars[0] -ne "`r"){$null=$builder.Append($chars[0])}
    if($builder.Length -gt 131072){throw 'blocked'}
  }
  return ConvertFrom-Json -InputObject $builder.ToString() -ErrorAction Stop
}
function Invoke-FoundationAdminControl {
  $hardDeadline=$phaseAStart.AddMinutes(70);$actionDeadline=$phaseAStart.AddMinutes(60);$stopNewAt=$phaseAStart.AddMinutes(50)
  $postchecked=$false;$fixtureReady=$false;$provisionAttempted=$false;$provisioned=$false;$closed=$false;$queryCount=0;$provisionPacket=$null
  $script:phaseAControlHardDeadline=$hardDeadline
  $window='df4f29ec-e2dc-4d82-a276-62a4e695e6f9'
  Write-Output (([ordered]@{type='foundation_admin_ready';runId=$runId;historyAfter='complete';projectRef=$projectRef;hardDeadline=$hardDeadline.ToString('o');actionDeadline=$actionDeadline.ToString('o');stopNewAt=$stopNewAt.ToString('o');postchecksVerified=$false}) | ConvertTo-Json -Compress)
  try { while($true){
    # Reserve the final two minutes for Close/physical child cleanup. This
    # neither extends the60-minute action window nor authorizes new work.
    $command=Read-FoundationCommand ($hardDeadline.AddMinutes(-2))
    if($null -eq $command){throw 'blocked'}
    Assert-Keys $command @('id','kind','args')
    if($command.id -isnot [string] -or $command.id -cnotmatch '^[a-f0-9-]{36}$' -or $command.kind -isnot [string]){throw 'blocked'}
    $kind=$command.kind;$args=$command.args;$value=$null
    if($kind -cnotin @('postcheck','preflight','fixture','provision','settlement','unknownCallbackAbsent','firstOriginalContext','verifyAtomicInput','replaySnapshot','smokeAssert','close','archive','end')){throw 'blocked'}
    if($receipt.phaseACommands -ge 512){throw 'blocked'}
    if($kind -cin @('postcheck','fixture','provision') -and [DateTime]::UtcNow -ge $stopNewAt){throw 'blocked'}
    $receipt.phaseACommands++
    if($kind -ceq 'end'){
      Assert-Keys $args @()
      if($provisionAttempted -and -not $closed){throw 'blocked'}
      Write-Output (([ordered]@{type='foundation_admin_result';id=$command.id;kind=$kind;ok=$true;result=[ordered]@{ended=$true;windowClosed=$closed}})|ConvertTo-Json -Compress)
      return
    }
    if($kind -ceq 'postcheck'){
      Assert-Keys $args @();if($postchecked){throw 'blocked'}
      $value=Invoke-FoundationPostcheck;$postchecked=$true
    } elseif($kind -ceq 'preflight'){
      Assert-Keys $args @();if(-not $postchecked){throw 'blocked'}
      $value=Invoke-FoundationQuery "select jsonb_build_object('projectRef','zmotjsbzhzjvpelxvxlf','priceBook',ops.get_price_book(),'dailyBudgetUsd',ops.get_setting('daily_budget_usd'),'statsDailyEnabled',ops.get_setting('stats_daily_enabled'),'errorCount24h',ops.error_count_24h('WF-19',false),'notificationCooldownClear',not exists(select 1 from ops.audit_log a where a.actor_type='n8n' and a.entity_type='workflow' and a.entity_id='WF-19' and a.action in ('notify_logged','workflow_notify_claimed') and a.created_at>=now()-interval '6 hours'),'observedAt',clock_timestamp()) as preflight;" 'preflight'
    } elseif($kind -ceq 'fixture'){
      Assert-Keys $args @();if(-not $postchecked -or $fixtureReady){throw 'blocked'}
      $mutation=Invoke-FoundationMutation (Foundation-FixtureSql 'm03_smoke_setup.sql')
      if(-not $mutation.acknowledged){throw 'blocked'}
      $value=Read-FoundationFixture;$fixtureReady=$true
    } elseif($kind -ceq 'provision'){
      Assert-Keys $args @('audience','commitSha','deploymentId')
      if(-not $postchecked -or -not $fixtureReady -or $provisionAttempted -or $args.audience -isnot [string] -or $args.audience -cnotmatch '^https://everyone-market-researcher-[a-z0-9-]+\.vercel\.app$' -or $args.commitSha -isnot [string] -or $args.commitSha -cnotmatch '^[a-f0-9]{40}$' -or $args.deploymentId -isnot [string] -or $args.deploymentId -cnotmatch '^dpl_[A-Za-z0-9_-]{1,100}$'){throw 'blocked'}
      $packet=[ordered]@{audience=$args.audience;commitSha=$args.commitSha;deploymentId=$args.deploymentId;actorBuild='0.3.99';approvalReference='M03-A-D-f42930f-20261021';maxTotalChargeUsd=1;batchMaxUsd=2}
      $intent=Join-Path $out 'm03-foundation-owner-provision-attempt.json'
      Write-NewJson $intent ([ordered]@{version=1;runId=$runId;windowId=$window;packet=$packet;createdAt=[DateTime]::UtcNow.ToString('o')})
      $provisionPacket=$packet;$provisionAttempted=$true
      $json=Foundation-Json $packet
      # Atomic insert cannot be replayed. Ambiguous native output leaves its durable intent.
      $mutation=Invoke-FoundationMutation ("select ops.foundation_gateway_provision($json);")
      if(-not $mutation.childrenClosed){throw 'blocked'}
      $value=Invoke-FoundationQuery ("select jsonb_build_object('windowId',window_id,'boundAudience',bound_audience,'boundCommitSha',bound_commit_sha,'boundDeploymentId',bound_deployment_id,'started',starts_at is not null,'closed',closed_at is not null,'totalAdmitted',admitted_count,'approvalCount',(select count(*) from ops.apify_launch_approvals where window_id=w.window_id)) as provision from ops.foundation_gateway_rate_windows w where window_id='$window';") 'provision'
      if($value.started -ne $false -or $value.closed -ne $false -or $value.totalAdmitted -ne 0 -or $value.approvalCount -ne 1 -or $value.boundAudience -cne $args.audience -or $value.boundCommitSha -cne $args.commitSha -or $value.boundDeploymentId -cne $args.deploymentId){throw 'blocked'}
      $provisioned=$true
    } elseif($kind -ceq 'settlement'){
      Assert-Keys $args @('windowId','requestIds','nativeIds','terminalCosts')
      if(-not $provisioned -or $args.windowId -cne $window -or $args.requestIds -isnot [Array] -or $args.requestIds.Count -gt 256 -or $args.nativeIds -isnot [Array] -or $args.nativeIds.Count -gt 120 -or $args.terminalCosts -isnot [Array] -or $args.terminalCosts.Count -gt 2){throw 'blocked'}
      foreach($id in $args.requestIds){if($id -isnot [string] -or $id -cnotmatch '^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'){throw 'blocked'}}
      foreach($id in $args.nativeIds){if($id -isnot [string] -or $id -cnotmatch '^[1-9][0-9]{0,14}$'){throw 'blocked'}}
      foreach($entry in $args.terminalCosts){
        Assert-Keys $entry @('apify_run_id','usage_usd')
        $cost=$entry.usage_usd
        $validCost=($cost -is [string] -and $cost -cmatch '^[0-9]{1,9}(\.[0-9]{1,12})?$') -or (($cost -is [int] -or $cost -is [long] -or $cost -is [double] -or $cost -is [decimal]) -and $cost -ge 0 -and $cost -le 999999999)
        if($entry.apify_run_id -isnot [string] -or $entry.apify_run_id -cnotmatch '^[A-Za-z0-9_-]{1,128}$' -or -not $validCost){throw 'blocked'}
      }
      $sql=[IO.File]::ReadAllText((Assert-Path $repo 'scripts/db/foundation-settlement.sql'))
      $requestSql='array['+(@($args.requestIds|ForEach-Object{Foundation-Literal $_}) -join ',')+']::uuid[]'
      $nativeSql='array['+(@($args.nativeIds|ForEach-Object{Foundation-Literal $_}) -join ',')+']::text[]'
      $sql=$sql.Replace('$1',(Foundation-Literal $window)).Replace('$2',$requestSql).Replace('$3',$nativeSql).Replace('$4',(Foundation-Json -Value $args.terminalCosts))
      $value=Invoke-FoundationQuery $sql 'settlement'
    } elseif($kind -ceq 'unknownCallbackAbsent'){
      Assert-Keys $args @();if(-not $postchecked){throw 'blocked'}
      $value=Invoke-FoundationQuery "select jsonb_build_object('apify_run_id','M03AcceptanceUnknown0001','registry_absent',not exists(select 1 from ops.apify_runs where apify_run_id='M03AcceptanceUnknown0001'),'launch_absent',not exists(select 1 from ops.apify_launch_admissions where apify_run_id='M03AcceptanceUnknown0001'),'observed_at',clock_timestamp()) as unknown_callback;" 'unknown_callback'
    } elseif($kind -ceq 'firstOriginalContext'){
      Assert-Keys $args @();if(-not $provisioned){throw 'blocked'}
      $sql=@'
select jsonb_build_object('launch',jsonb_build_object('window_id',l.window_id,'launch_id',l.launch_id,'ordinal',l.ordinal,'actor_id',l.actor_id,'actor_build',l.actor_build,'run_id',l.run_id,'account_id',l.account_id,'apify_run_id',l.apify_run_id),
 'registered',jsonb_build_object('apify_run_id',a.apify_run_id,'actor_id',a.actor_id,'run_id',a.run_id,'account_ids',a.account_ids,'purpose',a.purpose,'status',a.status,'dataset_id',a.dataset_id,'usage_usd',a.usage_usd,'processed_at',a.processed_at,'processing_result',a.processing_result),
 'readRequestId',d.request_id,'datasetRead',d.result,'costEntry',(select jsonb_build_object('provider',c.provider,'category',c.category,'unit',c.unit,'quantity',c.quantity,'cost_usd',c.cost_usd,'run_id',c.run_id,'competitor_id',c.competitor_id,'platform',c.platform,'meta',c.meta) from ops.cost_ledger c where c.run_id=l.run_id and c.meta->>'apify_run_id'=l.apify_run_id)) as original
from ops.apify_launch_admissions l join ops.apify_runs a using(apify_run_id) join lateral(select q.request_id,q.result from ops.foundation_gateway_requests q where q.window_id=l.window_id and q.operation='apify.dataset.read' and q.state='completed' and q.result->'terminal'->>'apifyRunId'=l.apify_run_id order by q.completed_at,q.request_id limit 1) d on true
where l.window_id='df4f29ec-e2dc-4d82-a276-62a4e695e6f9' and l.ordinal=1 and a.processed_at is not null and a.status='SUCCEEDED';
'@
      $value=Invoke-FoundationQuery $sql 'original'
    } elseif($kind -ceq 'verifyAtomicInput'){
      Assert-Keys $args @('atomicInput');if(-not $provisioned){throw 'blocked'}
      Assert-Keys $args.atomicInput @('p_apify_run_id','p_status','p_dataset_id','p_usage_usd','p_groups')
      $json=Foundation-Json $args.atomicInput
      if($json.Length -gt 65536){throw 'blocked'}
      $value=Invoke-FoundationQuery ("with p as(select $json as j) select jsonb_build_object('matched',coalesce((select j->>'p_apify_run_id'=a.apify_run_id and j->>'p_status'=a.status and j->>'p_dataset_id'=a.dataset_id and (j->>'p_usage_usd')::numeric=a.usage_usd and encode(extensions.digest((j->'p_groups')::text,'sha256'),'hex')=a.processing_result->>'groups_sha256' from p,ops.apify_launch_admissions l join ops.apify_runs a using(apify_run_id) where l.window_id='$window' and l.ordinal=1 and a.processed_at is not null),false)) as verified;") 'verified'
    } elseif($kind -ceq 'replaySnapshot'){
      Assert-Keys $args @();if(-not $fixtureReady){throw 'blocked'}
      $value=Invoke-FoundationQuery ([IO.File]::ReadAllText((Assert-Path $repo 'scripts/db/foundation-replay-snapshot.sql'))) 'snapshot'
    } elseif($kind -ceq 'smokeAssert'){
      Assert-Keys $args @('runId','apifyRunId','expectedItemsNew')
      if(-not $provisioned -or $args.runId -isnot [string] -or $args.runId -cnotmatch '^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' -or $args.apifyRunId -isnot [string] -or $args.apifyRunId -cnotmatch '^[A-Za-z0-9_-]{1,128}$' -or $args.expectedItemsNew -isnot [int] -or $args.expectedItemsNew -notin @(0,1)){throw 'blocked'}
      $mutation=Invoke-FoundationMutation (Foundation-SmokeAssertSql $args)
      if(-not $mutation.acknowledged){throw 'blocked'}
      $value=[ordered]@{result='M03_SMOKE_SQL_STATE_PASS';run_id=$args.runId;apify_run_id=$args.apifyRunId;expected_items_new=$args.expectedItemsNew;webhook_delivery_or_replay_proven=$false}
    } elseif($kind -ceq 'close'){
      Assert-Keys $args @();if(-not $provisionAttempted){throw 'blocked'}
      $value=Close-FoundationOwnedWindow $provisionPacket
      $closed=$true;$receipt.phaseAClosed=$true
    } elseif($kind -ceq 'archive'){
      Assert-Keys $args @();if(-not $closed -or -not $fixtureReady){throw 'blocked'}
      $mutation=Invoke-FoundationMutation (Foundation-FixtureSql 'm03_smoke_teardown.sql');if(-not $mutation.acknowledged){throw 'blocked'}
      $value=Read-FoundationFixture $true
    }
    $queryCount++;if($queryCount -gt 512){throw 'blocked'}
    Write-Output (([ordered]@{type='foundation_admin_result';id=$command.id;kind=$kind;ok=$true;result=$value}) | ConvertTo-Json -Depth 50 -Compress)
  } } finally {
    # A failed command, EOF or lost response cannot silently drop the only
    # administrator context while this owned ingress might remain open.
    if($provisionAttempted -and -not $closed){
      try{$null=Close-FoundationOwnedWindow $provisionPacket;$closed=$true;$receipt.phaseAClosed=$true}catch{$receipt.phaseAClosed=$false}
    }
  }
}
