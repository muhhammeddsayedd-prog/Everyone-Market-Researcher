# Dot-sourced only after the NEW public packet verifies this exact file.
# No command accepts SQL, filenames, role changes or arbitrary CLI arguments.
function Foundation-ProjectVerifiedTechnicalIdentity {
  if(-not $ProjectVerifiedContinuation){throw 'blocked'}
  # Derived only by the native admission/claim/process-chain verifier. It is
  # never an owner input, command argument or runtime request property.
  $ordinal=Get-Variable -Name projectVerifiedTechnicalOrdinal -ValueOnly -ErrorAction SilentlyContinue
  if($null -eq $ordinal){$ordinal=1}
  if($ordinal -isnot [int] -or $ordinal -lt 1 -or $ordinal -gt 1023){throw 'blocked'}
  $segment='20275b22-b7fe-4737-a9a4-c50c2feadb74'
  return [pscustomobject]@{ordinal=$ordinal;outputSegment=($segment+$(if($ordinal -gt 1){'-technical-'+$ordinal}else{''}));auditSegment=($segment+$(if($ordinal -gt 1){':technical-'+$ordinal}else{''}))}
}
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
function Foundation-FixtureSql([string]$Name,$ExpectedFixture=$null) {
  $startupMode=[bool](Get-Variable -Name StartupReplacement -ValueOnly -ErrorAction SilentlyContinue)
  $projectMode=[bool](Get-Variable -Name ProjectVerifiedContinuation -ValueOnly -ErrorAction SilentlyContinue)
  if($projectMode -and $Name -cnotin @('m03_smoke_reactivate_project_verified.sql','m03_smoke_teardown.sql')){throw 'blocked'}
  if($Name -ceq 'm03_smoke_reactivate_project_verified.sql' -and -not $projectMode){throw 'blocked'}
  if($startupMode -and $Name -cnotin @('m03_smoke_reactivate_startup.sql','m03_smoke_teardown.sql')){throw 'blocked'}
  if($Name -ceq 'm03_smoke_reactivate_startup.sql' -and -not $startupMode){throw 'blocked'}
  $source = [IO.File]::ReadAllText((Assert-Path $repo ('scripts/assert/'+$Name)))
  # Exactly the reviewed psql wrapper is removed. The owner guard, transaction,
  # identity/baseline/ownership assertions and mutation body stay byte-for-byte.
  # Continuation adds only fixed fresh-fixture preconditions below.
  $tag=if($Name -ceq 'm03_smoke_setup.sql'){'smoke_setup'}elseif(($Name -ceq 'm03_smoke_reactivate.sql' -and $RemainingContinuation) -or ($Name -ceq 'm03_smoke_reactivate_startup.sql' -and $startupMode) -or ($Name -ceq 'm03_smoke_reactivate_project_verified.sql' -and $projectMode)){'smoke_reactivate'}else{'smoke_teardown'}
  $start = $source.IndexOf('do $'+$tag+'$')
  $end = $source.IndexOf('$'+$tag+'$;',$start)
  if ($start -lt 0 -or $end -le $start) { throw 'blocked' }
  $body=$source.Substring($start,$end-$start+($tag.Length+3))
  # db query is one prepared statement: DO is its own implicit transaction.
  # Only its fixed local settings move inside the unchanged reviewed body.
  $needle="begin`r`n";if(-not $body.Contains($needle)){$needle="begin`n"}
  $settings="begin`n  perform pg_catalog.set_config('emr.smoke_project_ref','zmotjsbzhzjvpelxvxlf',true);`n  perform pg_catalog.set_config('emr.smoke_rollback','false',true);`n  perform pg_catalog.set_config('lock_timeout','5s',true);`n  perform pg_catalog.set_config('statement_timeout','30s',true);`n"
  if($Name -ceq 'm03_smoke_reactivate.sql'){
    if(-not $RemainingContinuation){throw 'blocked'}
    $settings+="  perform pg_catalog.set_config('emr.smoke_reactivation_segment','e8035391-dba8-48c9-97e0-139ba980d86e',true);`n"
  }
  if($Name -ceq 'm03_smoke_reactivate_startup.sql'){
    if(-not $startupMode){throw 'blocked'}
    $settings+="  perform pg_catalog.set_config('emr.smoke_reactivation_segment','1c69c89e-7807-46d5-b7b8-ca28285ff2b4',true);`n"
  }
  if($Name -ceq 'm03_smoke_reactivate_project_verified.sql'){
    if(-not $projectMode){throw 'blocked'}
    $settings+="  perform pg_catalog.set_config('emr.smoke_reactivation_segment','20275b22-b7fe-4737-a9a4-c50c2feadb74',true);`n"
    $technical=Foundation-ProjectVerifiedTechnicalIdentity
    $settings+="  perform pg_catalog.set_config('emr.smoke_technical_ordinal','"+$technical.ordinal+"',true);`n"
  }
  $body=$body.Replace($needle,$settings)
  if($PostcheckContinuation -and $Name -ceq 'm03_smoke_setup.sql'){
    $advisory="perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('emr-m03-smoke-fixture-v1',0));"
    $found='if found then'
    if([regex]::Matches($body,[regex]::Escape($advisory)).Count -ne 1 -or [regex]::Matches($body,[regex]::Escape($found)).Count -ne 1){throw 'blocked'}
    $absence="`n  if exists(select 1 from app.competitors where company_code='C999' or slug='emr-smoke-test') then`n    raise exception using errcode='55000', message='M03_CONTINUATION_FIXTURE_NOT_VACANT';`n  end if;"
    $body=$body.Replace($advisory,$advisory+$absence)
    # A concurrent uncooperative insert seen by the following SELECT must also
    # fail, never enter the legacy adoption branch. Unique constraints reject
    # a still-later conflicting INSERT; no unknown fixture is modified.
    $body=$body.Replace($found,"if found then`n    raise exception using errcode='55000', message='M03_CONTINUATION_FIXTURE_NOT_VACANT';")
  }
  if($PostcheckContinuation -and $Name -ceq 'm03_smoke_teardown.sql' -and $null -ne $ExpectedFixture){
    Assert-FoundationContinuationFixture $ExpectedFixture
    $update="update app.competitors set status='archived' where id=v_comp.id and status<>'archived';"
    if([regex]::Matches($body,[regex]::Escape($update)).Count -ne 1){throw 'blocked'}
    $owned="if v_comp.id is distinct from '"+$ExpectedFixture.competitor_id+"'::uuid or v_account.id is distinct from '"+$ExpectedFixture.account_id+"'::uuid then`n    raise exception using errcode='55000', message='M03_CONTINUATION_FIXTURE_ID_CHANGED';`n  end if;`n  "
    $body=$body.Replace($update,$owned+$update)
  }
  return $body
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
function Foundation-ForwardWindowId {
  # Only Read-FoundationPostcheckContinuation sets these after its sealed,
  # exact source/window and public-counter checks. Absent state is legacy only.
  $selected=Get-Variable -Name projectVerifiedForwardWindowId -ValueOnly -ErrorAction SilentlyContinue
  if($null -eq $selected){return '38b3708d-61b0-41d2-8170-5ed91c66b4dc'}
  $source=Get-Variable -Name projectVerifiedForwardSource -ValueOnly -ErrorAction SilentlyContinue
  if(($selected -ceq '38b3708d-61b0-41d2-8170-5ed91c66b4dc' -and $source -ceq 'a5e746736893d5040e93032ae740a0878f748837') -or
     ($selected -ceq 'eda4fae1-1e19-47db-81b8-beac1a4ed883' -and $source -ceq 'aff94f2b2d8055cf93b5405e6b11d4e7d9c86803')){return $selected}
  throw 'blocked'
}
function Close-FoundationOwnedWindow($Binding) {
  $window=if([bool](Get-Variable -Name ForwardWindow -ValueOnly -ErrorAction SilentlyContinue)){Foundation-ForwardWindowId}else{'df4f29ec-e2dc-4d82-a276-62a4e695e6f9'}
  $audience=Foundation-Literal $Binding.audience;$sha=Foundation-Literal $Binding.commitSha;$deployment=Foundation-Literal $Binding.deploymentId
  $owned=Invoke-FoundationQuery "select jsonb_build_object('owned',bound_audience=$audience and bound_commit_sha=$sha and bound_deployment_id=$deployment) as ownership from ops.foundation_gateway_rate_windows where window_id='$window';" 'ownership'
  if($owned.owned -ne $true){throw 'blocked'}
  # The runtime must close through its actual restricted Writer connection.
  # postgres cannot impersonate that session_user. This owner path only proves
  # the resulting closure; it never repeats the writer mutation on cleanup.
  $verified=Invoke-FoundationQuery "select jsonb_build_object('closed',w.closed_at is not null and w.close_count=1 and exists(select 1 from ops.apify_launch_approvals a where a.window_id=w.window_id and a.closed_at is not null) and not exists(select 1 from ops.foundation_gateway_leases l where l.window_id=w.window_id and l.request_id is not null) and not exists(select 1 from ops.foundation_gateway_requests r where r.window_id=w.window_id and r.state='reserved')) as closure from ops.foundation_gateway_rate_windows w where w.window_id='$window';" 'closure'
  if($verified.closed -ne $true){throw 'blocked'}
  return [ordered]@{state='closed';window=[ordered]@{id=$window;closed=$true}}
}
function Assert-FoundationContinuationVacant([switch]$RefreshHistory) {
  $startupMode=[bool](Get-Variable -Name StartupReplacement -ValueOnly -ErrorAction SilentlyContinue)
  $projectMode=[bool](Get-Variable -Name ProjectVerifiedContinuation -ValueOnly -ErrorAction SilentlyContinue)
  if($RefreshHistory){
    $history=Invoke-Cli @('db','query','--file',$queryFile) $queryTimeoutMs
    try{if((History-State $history) -cne 'complete'){throw 'blocked'}}finally{$history.text=$null}
  }
  if([bool](Get-Variable -Name ForwardWindow -ValueOnly -ErrorAction SilentlyContinue)){
    Assert-FoundationForwardWindowState ([bool](Get-Variable -Name forwardWindowPrepared -ValueOnly -ErrorAction SilentlyContinue))
    return
  }
  $vacancySql=@'
select jsonb_build_object('windowId','df4f29ec-e2dc-4d82-a276-62a4e695e6f9',
 'windows',(select count(*) from ops.foundation_gateway_rate_windows where window_id='df4f29ec-e2dc-4d82-a276-62a4e695e6f9'),
 'approvals',(select count(*) from ops.apify_launch_approvals where window_id='df4f29ec-e2dc-4d82-a276-62a4e695e6f9'),
 'launches',(select count(*) from ops.apify_launch_admissions where window_id='df4f29ec-e2dc-4d82-a276-62a4e695e6f9'),
 'requests',(select count(*) from ops.foundation_gateway_requests where window_id='df4f29ec-e2dc-4d82-a276-62a4e695e6f9'),
 'bindings',(select count(*) from ops.foundation_gateway_run_bindings where window_id='df4f29ec-e2dc-4d82-a276-62a4e695e6f9'),
 'leases',(select count(*) from ops.foundation_gateway_leases where window_id='df4f29ec-e2dc-4d82-a276-62a4e695e6f9')) as continuation_preflight;
'@
  if($RemainingContinuation -or $startupMode -or $projectMode){$vacancySql=$vacancySql.Replace(" where window_id='df4f29ec-e2dc-4d82-a276-62a4e695e6f9'",'')}
  $value=Invoke-FoundationQuery $vacancySql 'continuation_preflight'
  Assert-Keys $value @('windowId','windows','approvals','launches','requests','bindings','leases')
  if($value.windowId -cne 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9'){throw 'blocked'}
  foreach($key in @('windows','approvals','launches','requests','bindings','leases')){
    if(($value.$key -isnot [int] -and $value.$key -isnot [long]) -or $value.$key -ne 0){throw 'blocked'}
  }
  $outputSegment=if($projectMode){(Foundation-ProjectVerifiedTechnicalIdentity).outputSegment}else{$postcheckContinuationSegment}
  $priorIntents=@('scripts/db/out/m03-foundation-owner-provision-attempt.json','scripts/db/out/m03-foundation-postcheck-continuation-a570212a-634c-444f-90a2-578ae47e8d27-owner-provision-attempt.json',$(if($startupMode -or $projectMode){'scripts/db/out/m03-foundation-remaining-continuation-e8035391-dba8-48c9-97e0-139ba980d86e-owner-provision-attempt.json'}else{'scripts/db/out/m03-foundation-owner-provision-attempt.json'}),('scripts/db/out/'+$continuationOutputStem+$outputSegment+'-owner-provision-attempt.json'))
  if($projectMode){$priorIntents+='scripts/db/out/m03-foundation-startup-replacement-1c69c89e-7807-46d5-b7b8-ca28285ff2b4-owner-provision-attempt.json'}
  if($projectMode){for($technicalOrdinal=1;$technicalOrdinal -lt (Foundation-ProjectVerifiedTechnicalIdentity).ordinal;$technicalOrdinal++){$priorSegment=$postcheckContinuationSegment+$(if($technicalOrdinal -gt 1){'-technical-'+$technicalOrdinal}else{''});$priorIntents+=('scripts/db/out/'+$continuationOutputStem+$priorSegment+'-owner-provision-attempt.json')}}
  foreach($relative in $priorIntents){
    if(Test-Path -LiteralPath (Join-Path $repo $relative)){throw 'blocked'}
  }
}
function Assert-FoundationForwardWindowState([bool]$Prepared) {
  if(-not [bool](Get-Variable -Name ForwardWindow -ValueOnly -ErrorAction SilentlyContinue) -or -not $ProjectVerifiedContinuation){throw 'blocked'}
  $null=Read-FoundationForwardPrior
  $window=Foundation-ForwardWindowId
  $fresh=$window -ceq 'eda4fae1-1e19-47db-81b8-beac1a4ed883'
  $stateSql=@'
select jsonb_build_object(
 'identity',current_user='postgres' and session_user='postgres' and current_database()='postgres',
 'legacyClosed',(select count(*)=1 and bool_and(closed_at='2026-10-23T16:25:54.94722+00:00'::timestamptz and close_count=1 and admitted_count=2 and bound_commit_sha='f42930f90c2de43c84f61ad6d966d0ee6074d70e') from ops.foundation_gateway_rate_windows where window_id='df4f29ec-e2dc-4d82-a276-62a4e695e6f9'),
 'windows',(select count(*) from ops.foundation_gateway_rate_windows),
 'freshWindows',(select count(*) from ops.foundation_gateway_rate_windows where window_id='38b3708d-61b0-41d2-8170-5ed91c66b4dc'),
 'freshPrepared',(select count(*)=1 and bool_and(closed_at is null and starts_at is null and expires_at is null and admitted_count=0 and close_count=0 and namespace='m03-foundation-dev' and environment='dev' and project_ref='zmotjsbzhzjvpelxvxlf' and bound_commit_sha='a5e746736893d5040e93032ae740a0878f748837') from ops.foundation_gateway_rate_windows where window_id='38b3708d-61b0-41d2-8170-5ed91c66b4dc'),
 'globalAdmitted',(select coalesce(sum(admitted_count),0) from ops.foundation_gateway_rate_windows),
 'requests',(select count(*) from ops.foundation_gateway_requests),
 'activeLeases',(select count(*) from ops.foundation_gateway_leases where request_id is not null),
 'launches',(select count(*) from ops.apify_launch_admissions),
 'bindings',(select count(*) from ops.foundation_gateway_run_bindings),
 'progress',(select count(*) from app.items)+(select count(*) from ops.scrape_runs)+(select count(*) from ops.apify_runs)+(select count(*) from ops.cost_ledger)) as registered_preflight;
'@
  if($fresh){
    $stateSql=$stateSql.Replace('38b3708d-61b0-41d2-8170-5ed91c66b4dc',$window).Replace('a5e746736893d5040e93032ae740a0878f748837','aff94f2b2d8055cf93b5405e6b11d4e7d9c86803')
    $prior="'intermediateClosed',(select count(*)=1 and bool_and(w.closed_at is not null and w.close_count=1 and w.admitted_count=1 and w.starts_at is null and w.bound_commit_sha='a5e746736893d5040e93032ae740a0878f748837' and w.bound_deployment_id='dpl_HPq8ot1nNvBZRLTyAoEnXHXuhTPF' and w.bound_audience='https://everyone-market-researcher-j94yqflt0-muhammed-abdelrahman.vercel.app' and exists(select 1 from ops.apify_launch_approvals a where a.window_id=w.window_id and a.closed_at is not null and a.actor_build='0.3.99' and a.max_total_charge_usd=1 and a.batch_max_usd=2 and a.approval_reference='M03-A-D-f42930f-20261021')) from ops.foundation_gateway_rate_windows w where w.window_id='38b3708d-61b0-41d2-8170-5ed91c66b4dc'),`n 'windows'"
    $stateSql=$stateSql.Replace("'windows'",$prior)
  }
  $value=Invoke-FoundationQuery $stateSql 'registered_preflight'
  $keys=@('identity','legacyClosed','windows','freshWindows','freshPrepared','globalAdmitted','requests','activeLeases','launches','bindings','progress')
  $booleans=@('identity','legacyClosed','freshPrepared')
  if($fresh){$keys+='intermediateClosed';$booleans+='intermediateClosed'}
  Assert-Keys $value $keys
  foreach($key in $booleans){if($value.$key -isnot [bool]){throw 'blocked'}}
  foreach($key in @('windows','freshWindows','globalAdmitted','requests','activeLeases','launches','bindings','progress')){if(($value.$key -isnot [int] -and $value.$key -isnot [long]) -or $value.$key -lt 0){throw 'blocked'}}
  $priorWindows=if($fresh){2}else{1};$priorAdmitted=if($fresh){3}else{2}
  if($value.identity -ne $true -or $value.legacyClosed -ne $true -or ($fresh -and $value.intermediateClosed -ne $true) -or $value.windows -ne ($priorWindows+$(if($Prepared){1}else{0})) -or $value.freshWindows -ne $(if($Prepared){1}else{0}) -or
     $value.globalAdmitted -ne $priorAdmitted -or $value.requests -ne 1 -or $value.activeLeases -ne 0 -or $value.launches -ne 0 -or $value.bindings -ne 0 -or $value.progress -ne 0 -or ($Prepared -and $value.freshPrepared -ne $true)){throw 'blocked'}
  # Later settled actor/item progress needs its own engineering reconciliation;
  # this branch never resets/removes it or blindly repeats a paid start.
  if($Prepared){
    $binding=Get-Variable -Name forwardWindowBinding -ValueOnly -ErrorAction SilentlyContinue
    if($null -eq $binding){throw 'blocked'}
    $audience=Foundation-Literal $binding.audience;$deployment=Foundation-Literal $binding.deploymentId
    $owned=Invoke-FoundationQuery "select jsonb_build_object('owned',w.bound_audience=$audience and w.bound_deployment_id=$deployment and (select count(*)=1 from ops.apify_launch_approvals a where a.window_id=w.window_id and a.closed_at is null and a.actor_build='0.3.99' and a.max_total_charge_usd=1 and a.batch_max_usd=2 and a.approval_reference='M03-A-D-f42930f-20261021' and a.expires_at>clock_timestamp()) and (select count(*)=2 and bool_and(l.request_id is null) from ops.foundation_gateway_leases l where l.window_id=w.window_id)) as ownership from ops.foundation_gateway_rate_windows w where w.window_id='$window';" 'ownership'
    Assert-Keys $owned @('owned');if($owned.owned -ne $true){throw 'blocked'}
  }
  $identity=Foundation-ProjectVerifiedTechnicalIdentity
  $currentIntent=Join-Path $out ($continuationOutputStem+$identity.outputSegment+'-owner-provision-attempt.json')
  if(-not $Prepared -and (Test-Path -LiteralPath $currentIntent)){throw 'blocked'}
}
function Assert-FoundationContinuationFixtureAbsent {
  $value=Invoke-FoundationQuery "select jsonb_build_object('conflictingCompetitors',(select count(*) from app.competitors where company_code='C999' or slug='emr-smoke-test')) as continuation_fixture_absence;" 'continuation_fixture_absence'
  Assert-Keys $value @('conflictingCompetitors')
  if(($value.conflictingCompetitors -isnot [int] -and $value.conflictingCompetitors -isnot [long]) -or $value.conflictingCompetitors -ne 0){throw 'blocked'}
}
function Assert-FoundationContinuationFixture($Value,$Expected=$null) {
  $keys=@('result','company_code','competitor_id','account_id','platform','url','competitor_status','account_status')
  Assert-Keys $Value $keys
  foreach($key in $keys){if($Value.$key -isnot [string]){throw 'blocked'}}
  if($Value.result -cne 'M03_SMOKE_FIXTURE_READY' -or $Value.company_code -cne 'C999' -or $Value.platform -cne 'website_work_page' -or
     $Value.url -cne 'https://everyone.film/about-everyone' -or $Value.competitor_status -cne 'active' -or $Value.account_status -cne 'active'){throw 'blocked'}
  foreach($key in @('competitor_id','account_id')){if($Value.$key -cnotmatch '^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'){throw 'blocked'}}
  if($Value.competitor_id -ceq $Value.account_id){throw 'blocked'}
  if($null -ne $Expected){foreach($key in $keys){if($Value.$key -cne $Expected.$key){throw 'blocked'}}}
}
function Archive-FoundationUnprovisionedFixture($Expected) {
  $startupMode=[bool](Get-Variable -Name StartupReplacement -ValueOnly -ErrorAction SilentlyContinue)
  $projectMode=[bool](Get-Variable -Name ProjectVerifiedContinuation -ValueOnly -ErrorAction SilentlyContinue)
  if(-not $PostcheckContinuation -or $null -eq $Expected){throw 'blocked'}
  Assert-FoundationContinuationVacant -RefreshHistory
  $current=if($projectMode){Read-FoundationProjectVerifiedContinuationReactivatedFixture}elseif($startupMode){Read-FoundationStartupReplacementReactivatedFixture}elseif($RemainingContinuation){Read-FoundationRemainingReactivatedFixture}else{Read-FoundationFixture};Assert-FoundationContinuationFixture $current $Expected
  $outputSegment=if($projectMode){(Foundation-ProjectVerifiedTechnicalIdentity).outputSegment}else{$postcheckContinuationSegment}
  $priorIntents=@('m03-foundation-owner-provision-attempt.json','m03-foundation-postcheck-continuation-a570212a-634c-444f-90a2-578ae47e8d27-owner-provision-attempt.json',$(if($startupMode -or $projectMode){'m03-foundation-remaining-continuation-e8035391-dba8-48c9-97e0-139ba980d86e-owner-provision-attempt.json'}else{'m03-foundation-owner-provision-attempt.json'}),($continuationOutputStem+$outputSegment+'-owner-provision-attempt.json'))
  if($projectMode){$priorIntents+='m03-foundation-startup-replacement-1c69c89e-7807-46d5-b7b8-ca28285ff2b4-owner-provision-attempt.json'}
  if($projectMode){for($technicalOrdinal=1;$technicalOrdinal -lt (Foundation-ProjectVerifiedTechnicalIdentity).ordinal;$technicalOrdinal++){$priorSegment=$postcheckContinuationSegment+$(if($technicalOrdinal -gt 1){'-technical-'+$technicalOrdinal}else{''});$priorIntents+=($continuationOutputStem+$priorSegment+'-owner-provision-attempt.json')}}
  foreach($name in $priorIntents){
    if(Test-Path -LiteralPath (Join-Path $out $name)){throw 'blocked'}
  }
  $intent=Join-Path $out ($continuationOutputStem+$outputSegment+'-unprovisioned-archive-attempt.json')
  Write-NewJson $intent ([ordered]@{version=1;runId=$runId;segmentId=$postcheckContinuationSegment;competitorId=$Expected.competitor_id;accountId=$Expected.account_id;createdAt=[DateTime]::UtcNow.ToString('o')})
  # The durable one-attempt intent precedes the unchanged reviewed teardown.
  # An ambiguous native result cannot authorize another mutation.
  $mutation=Invoke-FoundationMutation (Foundation-FixtureSql 'm03_smoke_teardown.sql' $Expected)
  if(-not $mutation.acknowledged){throw 'blocked'}
  $value=Read-FoundationFixture $true
  Assert-Keys $value @('result','company_code','competitor_id','account_id','competitor_status','account_status','retained_items')
  foreach($key in @('result','company_code','competitor_id','account_id','competitor_status','account_status')){if($value.$key -isnot [string]){throw 'blocked'}}
  if($value.result -cne 'M03_SMOKE_FIXTURE_ARCHIVED' -or $value.company_code -cne 'C999' -or $value.competitor_id -cne $Expected.competitor_id -or $value.account_id -cne $Expected.account_id -or
     $value.competitor_status -cne 'archived' -or $value.account_status -cne 'paused' -or
     ($value.retained_items -isnot [int] -and $value.retained_items -isnot [long]) -or $value.retained_items -lt 0){throw 'blocked'}
  return $value
}
function Assert-FoundationRemainingPriorPostcheck {
  $checkpointPath=Assert-Path $repo 'milestones/M03-n8n-foundation/evidence/dev-acceptance-remaining-checkpoint-20261022.json'
  if((File-Hash $checkpointPath) -cne '2954a33504376de123c2ca1638b11f3356d94fd274d35a7f62591642da463404'){throw 'blocked'}
  $checkpoint=Read-Json $checkpointPath
  $actualPath=Assert-Path $repo 'milestones/M03-n8n-foundation/evidence/dev-acceptance-postcheck-attempt-20261021.json'
  if((File-Hash $actualPath) -cne 'b984ec79c857468822e9299dd59fc2b26d71a26bb6b324dd90ecbaa7f39d1fcd'){throw 'blocked'}
  $actual=Read-Json $actualPath
  $latestRelative='scripts/db/out/m03-foundation-postcheck-continuation-a570212a-634c-444f-90a2-578ae47e8d27-latest.json'
  $typesRelative='scripts/db/out/m03-foundation-continuation-3860e4ad-eac9-4b19-a08f-6dce4c79a372-db.types.ts'
  foreach($relative in @($latestRelative,$typesRelative)){
    if((File-Hash (Assert-Path $repo $relative)) -cne $checkpoint.preserved.$relative){throw 'blocked'}
  }
  $latest=Read-Json (Assert-Path $repo $latestRelative)
  if($actual.database.runId -cne '3860e4ad-eac9-4b19-a08f-6dce4c79a372' -or $actual.database.postcheckStage -cne 'complete' -or
     $actual.database.historyAfter -cne 'complete' -or $actual.database.migrationCount -ne 14 -or $actual.database.authenticationVerified -ne $true -or
     $actual.database.pushAttempted -ne $false -or $actual.database.typesSha256 -cne 'baa632751cc0f74543be52ae0405934f7fe8254b55ddf5e171ea6e1b3a3f1ed8' -or
     $latest.runId -cne $actual.database.runId -or $latest.postcheckStage -cne 'complete' -or $latest.historyAfter -cne 'complete' -or
     $latest.childrenClosed -ne $true -or $latest.handoffDeleted -ne $true -or $latest.leaseDeleted -ne $true -or $latest.scratchDeleted -ne $true){throw 'blocked'}
  return [ordered]@{reused=$true;observedAt=$actual.database.observedAtUtc;runId=$actual.database.runId;typesCandidate=$typesRelative;typesAstEquivalent=$true;advisorsSourceOrdered=$true;checkpointSha256='2954a33504376de123c2ca1638b11f3356d94fd274d35a7f62591642da463404'}
}
function Assert-FoundationRemainingArchivedFixture {
  $value=Invoke-FoundationQuery "select jsonb_build_object('result','M03_SMOKE_FIXTURE_ARCHIVED','company_code',c.company_code,'competitor_id',c.id,'account_id',a.id,'platform',a.platform,'url',a.url,'competitor_status',c.status,'account_status',a.status) as fixture from app.competitors c join app.competitor_accounts a on a.competitor_id=c.id where c.company_code='C999' or c.slug='emr-smoke-test';" 'fixture'
  Assert-Keys $value @('result','company_code','competitor_id','account_id','platform','url','competitor_status','account_status')
  if($value.result -cne 'M03_SMOKE_FIXTURE_ARCHIVED' -or $value.company_code -cne 'C999' -or
     $value.competitor_id -cne 'd51a39f6-fe87-4d17-aee9-3070c45693aa' -or $value.account_id -cne 'bd23314c-591f-4fb7-92fd-b7450634eeb6' -or
     $value.platform -cne 'website_work_page' -or $value.url -cne 'https://everyone.film/about-everyone' -or $value.competitor_status -cne 'archived' -or $value.account_status -cne 'paused'){throw 'blocked'}
  return $value
}
function Reactivate-FoundationRemainingFixture {
  if(-not $RemainingContinuation){throw 'blocked'}
  Assert-FoundationContinuationVacant -RefreshHistory
  $null=Assert-FoundationRemainingArchivedFixture
  $intent=Join-Path $out ($continuationOutputStem+$postcheckContinuationSegment+'-reactivation-attempt.json')
  Write-NewJson $intent ([ordered]@{version=1;runId=$runId;segmentId=$postcheckContinuationSegment;competitorId='d51a39f6-fe87-4d17-aee9-3070c45693aa';accountId='bd23314c-591f-4fb7-92fd-b7450634eeb6';createdAt=[DateTime]::UtcNow.ToString('o')})
  if([DateTime]::UtcNow -ge $phaseAStart.AddMinutes(50)){throw 'blocked'}
  $receipt['reactivationState']='attempted'
  $mutation=Invoke-FoundationMutation (Foundation-FixtureSql 'm03_smoke_reactivate.sql')
  if(-not $mutation.childrenClosed){$receipt['reactivationState']='unknown';throw 'blocked'}
  try{$value=Read-FoundationRemainingReactivatedFixture}catch{$receipt['reactivationState']='unknown';throw 'blocked'}
  # Only the new segment's exact system audit and exact active IDs establish
  # ownership after a lost ACK. Cache it for finally's once-only archive even
  # though this failed command stops preparation; never replay reactivation.
  $script:remainingOwnedFixture=$value.PSObject.Copy()
  $receipt['reactivationState']=if($mutation.acknowledged){'acknowledged_and_verified'}else{'committed_after_unknown_ack'}
  if(-not $mutation.acknowledged){throw 'blocked'}
  return $value
}
function Read-FoundationRemainingReactivatedFixture {
  $value=Invoke-FoundationQuery @'
select jsonb_build_object('result','M03_SMOKE_FIXTURE_READY','company_code',c.company_code,'competitor_id',c.id,'account_id',a.id,'platform',a.platform,'url',a.url,'competitor_status',c.status,'account_status',a.status) as fixture
from app.competitors c join app.competitor_accounts a on a.competitor_id=c.id
where c.id='d51a39f6-fe87-4d17-aee9-3070c45693aa' and c.company_code='C999' and c.slug='emr-smoke-test' and c.status='active'
and a.id='bd23314c-591f-4fb7-92fd-b7450634eeb6' and a.status='active' and a.platform='website_work_page' and a.url='https://everyone.film/about-everyone'
and (select count(*) from ops.audit_log l join ops.audit_log o on o.id::text=l.after->>'original_creation_audit_id'
 where l.actor_type='system' and l.actor_id='m03_smoke_reactivate.v1:e8035391-dba8-48c9-97e0-139ba980d86e'
 and l.action='m03_smoke_fixture_reactivated' and l.entity_type='competitor' and l.entity_id=c.id::text
 and l.before=jsonb_build_object('competitor_status','archived','account_status','paused')
 and l.after->>'fixture_version'='1' and l.after->>'project_ref'='zmotjsbzhzjvpelxvxlf' and l.after->>'segment_id'='e8035391-dba8-48c9-97e0-139ba980d86e'
 and l.after->>'competitor_id'=c.id::text and l.after->>'account_id'=a.id::text and l.after->>'competitor_status'='active' and l.after->>'account_status'='active'
 and (select count(*) from pg_catalog.jsonb_object_keys(l.after))=8
 and o.actor_type='system' and o.actor_id='m03_smoke_setup.v1' and o.action='m03_smoke_fixture_created' and o.entity_type='competitor' and o.entity_id=c.id::text
 and o.after->>'competitor_id'=c.id::text and o.after->>'account_id'=a.id::text)=1;
'@ 'fixture'
  Assert-FoundationContinuationFixture $value
  if($value.competitor_id -cne 'd51a39f6-fe87-4d17-aee9-3070c45693aa' -or $value.account_id -cne 'bd23314c-591f-4fb7-92fd-b7450634eeb6'){throw 'blocked'}
  return $value
}
function Reactivate-FoundationStartupReplacementFixture {
  if(-not $StartupReplacement){throw 'blocked'}
  Assert-FoundationContinuationVacant -RefreshHistory
  $null=Assert-FoundationRemainingArchivedFixture
  $intent=Join-Path $out ($continuationOutputStem+$postcheckContinuationSegment+'-reactivation-attempt.json')
  Write-NewJson $intent ([ordered]@{version=1;runId=$runId;segmentId=$postcheckContinuationSegment;competitorId='d51a39f6-fe87-4d17-aee9-3070c45693aa';accountId='bd23314c-591f-4fb7-92fd-b7450634eeb6';createdAt=[DateTime]::UtcNow.ToString('o')})
  if([DateTime]::UtcNow -ge $phaseAStart.AddMinutes(50)){throw 'blocked'}
  $receipt['reactivationState']='attempted'
  $mutation=Invoke-FoundationMutation (Foundation-FixtureSql 'm03_smoke_reactivate_startup.sql')
  if(-not $mutation.childrenClosed){$receipt['reactivationState']='unknown';throw 'blocked'}
  try{$value=Read-FoundationStartupReplacementReactivatedFixture}catch{$receipt['reactivationState']='unknown';throw 'blocked'}
  # Only the new segment's exact system audit and exact active IDs establish
  # ownership after a lost ACK. Cache it for finally's once-only archive even
  # though this failed command stops preparation; never replay reactivation.
  $script:remainingOwnedFixture=$value.PSObject.Copy()
  $receipt['reactivationState']=if($mutation.acknowledged){'acknowledged_and_verified'}else{'committed_after_unknown_ack'}
  if(-not $mutation.acknowledged){throw 'blocked'}
  return $value
}
function Read-FoundationStartupReplacementReactivatedFixture {
  $value=Invoke-FoundationQuery @'
select jsonb_build_object('result','M03_SMOKE_FIXTURE_READY','company_code',c.company_code,'competitor_id',c.id,'account_id',a.id,'platform',a.platform,'url',a.url,'competitor_status',c.status,'account_status',a.status) as fixture
from app.competitors c join app.competitor_accounts a on a.competitor_id=c.id
where c.id='d51a39f6-fe87-4d17-aee9-3070c45693aa' and c.company_code='C999' and c.slug='emr-smoke-test' and c.status='active'
and a.id='bd23314c-591f-4fb7-92fd-b7450634eeb6' and a.status='active' and a.platform='website_work_page' and a.url='https://everyone.film/about-everyone'
and (select count(*) from ops.audit_log l join ops.audit_log o on o.id::text=l.after->>'original_creation_audit_id'
 where l.actor_type='system' and l.actor_id='m03_smoke_reactivate.v1:1c69c89e-7807-46d5-b7b8-ca28285ff2b4'
 and l.action='m03_smoke_fixture_reactivated' and l.entity_type='competitor' and l.entity_id=c.id::text
 and l.before=jsonb_build_object('competitor_status','archived','account_status','paused')
 and l.after->>'fixture_version'='1' and l.after->>'project_ref'='zmotjsbzhzjvpelxvxlf' and l.after->>'segment_id'='1c69c89e-7807-46d5-b7b8-ca28285ff2b4'
 and l.after->>'competitor_id'=c.id::text and l.after->>'account_id'=a.id::text and l.after->>'competitor_status'='active' and l.after->>'account_status'='active'
 and (select count(*) from pg_catalog.jsonb_object_keys(l.after))=8
 and o.actor_type='system' and o.actor_id='m03_smoke_setup.v1' and o.action='m03_smoke_fixture_created' and o.entity_type='competitor' and o.entity_id=c.id::text
 and o.after->>'competitor_id'=c.id::text and o.after->>'account_id'=a.id::text)=1;
'@ 'fixture'
  Assert-FoundationContinuationFixture $value
  if($value.competitor_id -cne 'd51a39f6-fe87-4d17-aee9-3070c45693aa' -or $value.account_id -cne 'bd23314c-591f-4fb7-92fd-b7450634eeb6'){throw 'blocked'}
  return $value
}
function Reactivate-FoundationProjectVerifiedContinuationFixture {
  if(-not $ProjectVerifiedContinuation){throw 'blocked'}
  Assert-FoundationContinuationVacant -RefreshHistory
  $null=Assert-FoundationRemainingArchivedFixture
  $technical=Foundation-ProjectVerifiedTechnicalIdentity
  $intent=Join-Path $out ($continuationOutputStem+$technical.outputSegment+'-reactivation-attempt.json')
  Write-NewJson $intent ([ordered]@{version=1;runId=$runId;segmentId=$postcheckContinuationSegment;competitorId='d51a39f6-fe87-4d17-aee9-3070c45693aa';accountId='bd23314c-591f-4fb7-92fd-b7450634eeb6';createdAt=[DateTime]::UtcNow.ToString('o')})
  if([DateTime]::UtcNow -ge $phaseAStart.AddMinutes(50)){throw 'blocked'}
  $receipt['reactivationState']='attempted'
  $mutation=Invoke-FoundationMutation (Foundation-FixtureSql 'm03_smoke_reactivate_project_verified.sql')
  if(-not $mutation.childrenClosed){$receipt['reactivationState']='unknown';throw 'blocked'}
  try{$value=Read-FoundationProjectVerifiedContinuationReactivatedFixture}catch{$receipt['reactivationState']='unknown';throw 'blocked'}
  # Only the new segment's exact system audit and exact active IDs establish
  # ownership after a lost ACK. Cache it for finally's once-only archive even
  # though this failed command stops preparation; never replay reactivation.
  $script:remainingOwnedFixture=$value.PSObject.Copy()
  $receipt['reactivationState']=if($mutation.acknowledged){'acknowledged_and_verified'}else{'committed_after_unknown_ack'}
  if(-not $mutation.acknowledged){throw 'blocked'}
  return $value
}
function Read-FoundationProjectVerifiedContinuationReactivatedFixture {
  $technical=Foundation-ProjectVerifiedTechnicalIdentity
  $sql=@'
select jsonb_build_object('result','M03_SMOKE_FIXTURE_READY','company_code',c.company_code,'competitor_id',c.id,'account_id',a.id,'platform',a.platform,'url',a.url,'competitor_status',c.status,'account_status',a.status) as fixture
from app.competitors c join app.competitor_accounts a on a.competitor_id=c.id
where c.id='d51a39f6-fe87-4d17-aee9-3070c45693aa' and c.company_code='C999' and c.slug='emr-smoke-test' and c.status='active'
and a.id='bd23314c-591f-4fb7-92fd-b7450634eeb6' and a.status='active' and a.platform='website_work_page' and a.url='https://everyone.film/about-everyone'
and (select count(*) from ops.audit_log l join ops.audit_log o on o.id::text=l.after->>'original_creation_audit_id'
 where l.actor_type='system' and l.actor_id='m03_smoke_reactivate.v1:20275b22-b7fe-4737-a9a4-c50c2feadb74'
 and l.action='m03_smoke_fixture_reactivated' and l.entity_type='competitor' and l.entity_id=c.id::text
 and l.before=jsonb_build_object('competitor_status','archived','account_status','paused')
 and l.after->>'fixture_version'='1' and l.after->>'project_ref'='zmotjsbzhzjvpelxvxlf' and l.after->>'segment_id'='20275b22-b7fe-4737-a9a4-c50c2feadb74'
 and l.after->>'competitor_id'=c.id::text and l.after->>'account_id'=a.id::text and l.after->>'competitor_status'='active' and l.after->>'account_status'='active'
 and (select count(*) from pg_catalog.jsonb_object_keys(l.after))=8
 and o.actor_type='system' and o.actor_id='m03_smoke_setup.v1' and o.action='m03_smoke_fixture_created' and o.entity_type='competitor' and o.entity_id=c.id::text
 and o.after->>'competitor_id'=c.id::text and o.after->>'account_id'=a.id::text)=1;
'@
  $sql=$sql.Replace('20275b22-b7fe-4737-a9a4-c50c2feadb74',$technical.auditSegment)
  $value=Invoke-FoundationQuery $sql 'fixture'
  Assert-FoundationContinuationFixture $value
  if($value.competitor_id -cne 'd51a39f6-fe87-4d17-aee9-3070c45693aa' -or $value.account_id -cne 'bd23314c-591f-4fb7-92fd-b7450634eeb6'){throw 'blocked'}
  return $value
}
function Invoke-FoundationPostcheck {
  if([bool](Get-Variable -Name ForwardWindow -ValueOnly -ErrorAction SilentlyContinue)){return Invoke-FoundationForwardPostcheck}
  $startupMode=[bool](Get-Variable -Name StartupReplacement -ValueOnly -ErrorAction SilentlyContinue)
  $projectMode=[bool](Get-Variable -Name ProjectVerifiedContinuation -ValueOnly -ErrorAction SilentlyContinue)
  if($RemainingContinuation -or $startupMode -or $projectMode){return Invoke-FoundationRemainingPostcheck}
  $receipt['postcheckStage']='catalog'
  $proof = Invoke-FoundationQuery ([IO.File]::ReadAllText((Assert-Path $repo 'scripts/db/foundation-postcheck.sql'))) 'postcheck'
  Assert-Keys $proof @('identity','tables_rls','no_machine_table_grants','rpc_shape','owner_control_restricted','all_project_tables_rls','all_views_invoker','gw01_closed','domain_auto_join_off','baseline_counts','schemas')
  foreach ($key in @('identity','tables_rls','no_machine_table_grants','rpc_shape','owner_control_restricted','all_project_tables_rls','all_views_invoker','gw01_closed','domain_auto_join_off','baseline_counts')) { if ($proof.$key -isnot [bool] -or -not $proof.$key) { throw 'blocked' } }
  $advisors = [ordered]@{}
  foreach ($kind in @('security','performance')) {
    $receipt.postcheckStage='advisors_'+$kind
    $result=Invoke-Cli @('db','advisors','--type',$kind,'--level','warn','--fail-on','warn') 60000
    try {
      if (-not $result.ok -or -not $result.closed -or $null -eq $result.text -or $result.text.Contains($password)) { throw 'blocked' }
      $value=ConvertFrom-Json -InputObject $result.text -ErrorAction Stop
      Assert-Keys $value @('results','message')
      if ($value.message -cne 'db advisors' -or $value.results -isnot [Array] -or $value.results.Count -ne 0) { throw 'blocked' }
      $advisors[$kind]=[ordered]@{nativeExit=0;warnings=0;errors=0;childrenClosed=$true}
    } finally { $result.text=$null }
  }
  $receipt.postcheckStage='types_generate'
  $types=Invoke-Cli @('gen','types','--lang','typescript','--schema','app,api,ops,ingest') 60000
  try {
    if (-not $types.ok -or -not $types.closed -or $null -eq $types.text -or $types.text.Contains($password) -or $types.text.Length -lt 1000) { throw 'blocked' }
    $candidateRelative=if($PostcheckContinuation){'scripts/db/out/m03-foundation-continuation-'+$runId+'-db.types.ts'}else{'scripts/db/out/m03-foundation-hosted-db.types.ts'}
    $candidate=Join-Path $repo $candidateRelative
    $receipt.postcheckStage='types_write'
    if (Test-Path -LiteralPath $candidate) { throw 'blocked' }
    $stream=$null
    try { $bytes=[Text.UTF8Encoding]::new($false).GetBytes($types.text);$stream=[IO.File]::Open($candidate,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true) } finally { if($null -ne $stream){$stream.Dispose()} }
    $receipt['postcheckCandidate']=$candidateRelative;$receipt.postcheckStage='types_ast'
    $checkerArguments=@((Assert-Path $repo 'scripts/db/check-foundation-types.mjs'))
    if($PostcheckContinuation){$checkerArguments+=@('Continuation',$runId)}
    $checked=Invoke-Bounded $node $checkerArguments $repo 15000
    if(-not $checked.ok -or -not $checked.closed){throw 'blocked'}
    $coverage=ConvertFrom-Json -InputObject $checked.text -ErrorAction Stop
    Assert-Keys $coverage @('status','schemas','foundationTables','foundationFunctions','astEquivalent')
    if($coverage.status -cne 'types_coverage_verified' -or $coverage.schemas -ne 4 -or $coverage.foundationTables -ne 6 -or $coverage.foundationFunctions -ne 9 -or $coverage.astEquivalent -ne $true){throw 'blocked'}
    $receipt.postcheckStage='complete'
    return [ordered]@{projectRef=$projectRef;migrationCount=14;catalog=$proof;advisors=$advisors;typesGenerated=$true;typesSchemaAndFoundationSymbols=$true;typesAstEquivalent=$true;typesCandidate=$candidateRelative;ready=$true}
  } finally { $types.text=$null }
}
function Invoke-FoundationRemainingPostcheck {
  $prior=Assert-FoundationRemainingPriorPostcheck
  Assert-FoundationContinuationVacant -RefreshHistory
  $null=Assert-FoundationRemainingArchivedFixture
  $proof=Invoke-FoundationQuery ([IO.File]::ReadAllText((Assert-Path $repo 'scripts/db/foundation-postcheck.sql'))) 'postcheck'
  Assert-Keys $proof @('identity','tables_rls','no_machine_table_grants','rpc_shape','owner_control_restricted','all_project_tables_rls','all_views_invoker','gw01_closed','domain_auto_join_off','baseline_counts','schemas')
  foreach($key in @('identity','tables_rls','no_machine_table_grants','rpc_shape','owner_control_restricted','all_project_tables_rls','all_views_invoker','gw01_closed','domain_auto_join_off','baseline_counts')){if($proof.$key -isnot [bool] -or -not $proof.$key){throw 'blocked'}}
  $receipt['postcheckStage']='complete';$receipt['postchecksReused']=$prior
  return [ordered]@{projectRef=$projectRef;migrationCount=14;catalog=$proof;advisors=$prior;typesGenerated=$false;typesSchemaAndFoundationSymbols=$true;typesAstEquivalent=$true;typesCandidate=$prior.typesCandidate;reusedCompletedPostcheck=$true;ready=$true}
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
  $startupMode=[bool](Get-Variable -Name StartupReplacement -ValueOnly -ErrorAction SilentlyContinue)
  $projectMode=[bool](Get-Variable -Name ProjectVerifiedContinuation -ValueOnly -ErrorAction SilentlyContinue)
  $forwardMode=[bool](Get-Variable -Name ForwardWindow -ValueOnly -ErrorAction SilentlyContinue)
  $script:forwardWindowPrepared=$false;$script:forwardWindowBinding=$null
  $hardDeadline=$phaseAStart.AddMinutes(70);$actionDeadline=$phaseAStart.AddMinutes(60);$stopNewAt=$phaseAStart.AddMinutes(50)
  $postchecked=$false;$fixtureReady=$false;$provisionAttempted=$false;$provisioned=$false;$closed=$false;$queryCount=0;$provisionPacket=$null;$createdFixture=$null;$unprovisionedArchiveAttempted=$false
  $script:remainingOwnedFixture=$null
  $script:phaseAControlHardDeadline=$hardDeadline
  $window=if($forwardMode){Foundation-ForwardWindowId}else{'df4f29ec-e2dc-4d82-a276-62a4e695e6f9'}
  if($PostcheckContinuation){$receipt['unprovisionedFixtureArchived']=$false}
  $readyEnvelope=[ordered]@{type='foundation_admin_ready';runId=$runId;historyAfter='complete';projectRef=$projectRef;hardDeadline=$hardDeadline.ToString('o');actionDeadline=$actionDeadline.ToString('o');stopNewAt=$stopNewAt.ToString('o');postchecksVerified=$false}
  if($ClockAmendment){$readyEnvelope['clockSegmentId']=$clockAmendmentSegment}
  if($PostcheckContinuation){Assert-FoundationContinuationVacant;if($RemainingContinuation -or $startupMode -or $projectMode){$null=Assert-FoundationRemainingArchivedFixture;if(-not $forwardMode){$null=Assert-FoundationRemainingPriorPostcheck};if($projectMode){$readyEnvelope['projectVerifiedContinuation']=$true}elseif($startupMode){$readyEnvelope['startupReplacement']=$true}else{$readyEnvelope['remainingContinuation']=$true}}else{Assert-FoundationContinuationFixtureAbsent};$readyEnvelope['clockSegmentId']=$postcheckContinuationSegment;$readyEnvelope['postcheckContinuation']=$true}
  Write-Output ($readyEnvelope | ConvertTo-Json -Compress)
  try { while($true){
    # Reserve the final two minutes for Close/physical child cleanup. This
    # neither extends the60-minute action window nor authorizes new work.
    $command=Read-FoundationCommand ($hardDeadline.AddMinutes(-2))
    if($null -eq $command){throw 'blocked'}
    Assert-Keys $command @('id','kind','args')
    if($command.id -isnot [string] -or $command.id -cnotmatch '^[a-f0-9-]{36}$' -or $command.kind -isnot [string]){throw 'blocked'}
    $kind=$command.kind;$args=$command.args;$value=$null
    if($kind -cnotin @('postcheck','preflight','fixture','provision','settlement','unknownCallbackAbsent','firstOriginalContext','verifyAtomicInput','replaySnapshot','smokeAssert','close','archive','archiveUnprovisioned','end')){throw 'blocked'}
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
      Assert-Keys $args @();if(-not $postchecked -or $fixtureReady -or ($forwardMode -and -not $provisioned)){throw 'blocked'}
      if($PostcheckContinuation -and -not ($RemainingContinuation -or $startupMode -or $projectMode)){Assert-FoundationContinuationVacant -RefreshHistory;Assert-FoundationContinuationFixtureAbsent}
      if([DateTime]::UtcNow -ge $stopNewAt){throw 'blocked'}
      if($projectMode){$value=Reactivate-FoundationProjectVerifiedContinuationFixture}elseif($startupMode){$value=Reactivate-FoundationStartupReplacementFixture}elseif($RemainingContinuation){$value=Reactivate-FoundationRemainingFixture}else{
        $mutation=Invoke-FoundationMutation (Foundation-FixtureSql 'm03_smoke_setup.sql')
        if(-not $mutation.acknowledged){throw 'blocked'}
        $value=Read-FoundationFixture
      }
      if($PostcheckContinuation){Assert-FoundationContinuationFixture $value;$createdFixture=$value.PSObject.Copy()}
      $fixtureReady=$true
    } elseif($kind -ceq 'provision'){
      Assert-Keys $args @('audience','commitSha','deploymentId')
      if(-not $postchecked -or ((-not $forwardMode -and -not $fixtureReady) -or ($forwardMode -and $fixtureReady)) -or $provisionAttempted -or $unprovisionedArchiveAttempted -or $args.audience -isnot [string] -or $args.audience -cnotmatch '^https://everyone-market-researcher-[a-z0-9-]+\.vercel\.app$' -or $args.commitSha -isnot [string] -or $args.commitSha -cnotmatch '^[a-f0-9]{40}$' -or $args.deploymentId -isnot [string] -or $args.deploymentId -cnotmatch '^dpl_[A-Za-z0-9_-]{1,100}$'){throw 'blocked'}
      if($forwardMode -and $args.commitSha -cne 'a5e746736893d5040e93032ae740a0878f748837'){throw 'blocked'}
      $packet=[ordered]@{audience=$args.audience;commitSha=$args.commitSha;deploymentId=$args.deploymentId;actorBuild='0.3.99';approvalReference='M03-A-D-f42930f-20261021';maxTotalChargeUsd=1;batchMaxUsd=2}
      if($PostcheckContinuation){
        Assert-FoundationContinuationVacant -RefreshHistory
        if($forwardMode){$null=Assert-FoundationRemainingArchivedFixture}else{
        if($null -eq $createdFixture){throw 'blocked'}
        $currentFixture=if($projectMode){Read-FoundationProjectVerifiedContinuationReactivatedFixture}elseif($startupMode){Read-FoundationStartupReplacementReactivatedFixture}elseif($RemainingContinuation){Read-FoundationRemainingReactivatedFixture}else{Read-FoundationFixture};Assert-FoundationContinuationFixture $currentFixture $createdFixture
        }
      }
      if([DateTime]::UtcNow -ge $stopNewAt){throw 'blocked'}
      $intent=Join-Path $out 'm03-foundation-owner-provision-attempt.json'
      if($PostcheckContinuation){$outputSegment=if($projectMode){(Foundation-ProjectVerifiedTechnicalIdentity).outputSegment}else{$postcheckContinuationSegment};$intent=Join-Path $out ($continuationOutputStem+$outputSegment+'-owner-provision-attempt.json')}
      Write-NewJson $intent ([ordered]@{version=1;runId=$runId;windowId=$window;packet=$packet;createdAt=[DateTime]::UtcNow.ToString('o')})
      $provisionPacket=$packet;$provisionAttempted=$true
      $json=Foundation-Json $packet
      # Atomic insert cannot be replayed. Ambiguous native output leaves its durable intent.
      if([DateTime]::UtcNow -ge $stopNewAt){throw 'blocked'}
      $provisionSql=if($forwardMode){"select ops.foundation_gateway_provision('$window'::uuid,$json);"}else{"select ops.foundation_gateway_provision($json);"}
      $mutation=Invoke-FoundationMutation $provisionSql
      if(-not $mutation.childrenClosed){throw 'blocked'}
      $value=Invoke-FoundationQuery ("select jsonb_build_object('windowId',window_id,'boundAudience',bound_audience,'boundCommitSha',bound_commit_sha,'boundDeploymentId',bound_deployment_id,'started',starts_at is not null,'closed',closed_at is not null,'totalAdmitted',admitted_count,'approvalCount',(select count(*) from ops.apify_launch_approvals where window_id=w.window_id)) as provision from ops.foundation_gateway_rate_windows w where window_id='$window';") 'provision'
      if($value.started -ne $false -or $value.closed -ne $false -or $value.totalAdmitted -ne 0 -or $value.approvalCount -ne 1 -or $value.boundAudience -cne $args.audience -or $value.boundCommitSha -cne $args.commitSha -or $value.boundDeploymentId -cne $args.deploymentId){throw 'blocked'}
      $provisioned=$true
      if($forwardMode){$script:forwardWindowPrepared=$true;$script:forwardWindowBinding=$packet;Assert-FoundationForwardWindowState $true}
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
      if($forwardMode){$sql=$sql.Replace('df4f29ec-e2dc-4d82-a276-62a4e695e6f9',$window)}
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
      $mutation=Invoke-FoundationMutation (Foundation-FixtureSql 'm03_smoke_teardown.sql' $createdFixture);if(-not $mutation.acknowledged){throw 'blocked'}
      $value=Read-FoundationFixture $true
    } elseif($kind -ceq 'archiveUnprovisioned'){
      Assert-Keys $args @()
      if(-not $PostcheckContinuation -or -not $fixtureReady -or $null -eq $createdFixture -or $provisionAttempted -or $unprovisionedArchiveAttempted){throw 'blocked'}
      $unprovisionedArchiveAttempted=$true
      $value=Archive-FoundationUnprovisionedFixture $createdFixture
      $receipt['unprovisionedFixtureArchived']=$true
    }
    $queryCount++;if($queryCount -gt 512){throw 'blocked'}
    Write-Output (([ordered]@{type='foundation_admin_result';id=$command.id;kind=$kind;ok=$true;result=$value}) | ConvertTo-Json -Depth 50 -Compress)
  } } finally {
    if(($RemainingContinuation -or $startupMode -or $projectMode) -and $null -ne $script:remainingOwnedFixture -and $null -eq $createdFixture){$createdFixture=$script:remainingOwnedFixture;$fixtureReady=$true}
    # A failed command, EOF or lost response cannot silently drop the only
    # administrator context while this owned ingress might remain open.
    if($provisionAttempted -and -not $closed){
      try{$null=Close-FoundationOwnedWindow $provisionPacket;$closed=$true;$receipt.phaseAClosed=$true}catch{$receipt.phaseAClosed=$false}
    }elseif($PostcheckContinuation -and $fixtureReady -and $null -ne $createdFixture -and -not $provisionAttempted -and -not $unprovisionedArchiveAttempted){
      # The child still owns its administrator context on EOF/command failure.
      # Use the same durable once fence as the explicit cleanup API. This does
      # not fabricate closure of a window that was never provisioned.
      $unprovisionedArchiveAttempted=$true
      try{$null=Archive-FoundationUnprovisionedFixture $createdFixture;$receipt['unprovisionedFixtureArchived']=$true}catch{$receipt['unprovisionedFixtureArchived']=$false}
    }
  }
}
