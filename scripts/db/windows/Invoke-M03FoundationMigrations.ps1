[CmdletBinding()]
param([switch]$CheckOnly,[switch]$PhaseAControl,[long]$OriginalDeadlineAtMs=0,[switch]$ClockAmendment,[switch]$PostcheckContinuation,[switch]$RemainingContinuation)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
# Validate the caller's modes before sharing only the reviewed no-push path.
if(@($ClockAmendment,$PostcheckContinuation,$RemainingContinuation|Where-Object{$_}).Count -gt 1 -or
   ($RemainingContinuation -and (-not $PhaseAControl -or $OriginalDeadlineAtMs -ne 0))){Write-Output 'M03_FOUNDATION PREFLIGHT_BLOCKED. Conflicting continuation modes; no private access.';exit 1}
if($RemainingContinuation){$PostcheckContinuation=$true}
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
$projectRef = 'zmotjsbzhzjvpelxvxlf'
$poolerHost = 'aws-1-eu-central-1.pooler.supabase.com'
$cliRelative = 'node_modules/.pnpm/@supabase+cli-windows-x64@2.121.0/node_modules/@supabase/cli-windows-x64/bin/supabase.exe'
$caRelative = 'scripts/seed/certs/supabase-root-2021.crt'
$caHash = '700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7'
$requiredFiles = @('scripts/db/windows/Invoke-M03FoundationMigrations.ps1','scripts/db/windows/New-M03FoundationMigrationHandoff.ps1',
  'scripts/db/windows/Foundation-AdminControl.ps1','scripts/db/foundation-settlement.sql','scripts/db/foundation-postcheck.sql','scripts/db/foundation-replay-snapshot.sql',
  'scripts/db/check-foundation-types.mjs','packages/shared/src/db.types.ts','node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/lib/typescript.js',
  'scripts/assert/m03_smoke_setup.sql','scripts/assert/m03_smoke_teardown.sql','scripts/assert/m03_smoke_assert.sql',
  'scripts/seed/check-tls.mjs','scripts/seed/certs/supabase-root-2021.json',$caRelative,$cliRelative)
$requiredFiles+=@('scripts/n8n/foundation-live-clock-amendment.mjs','scripts/n8n/foundation-live-zero-setup.mjs','scripts/n8n/foundation-control-state.mjs','scripts/n8n/foundation-runtime-checkpoint.mjs',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-clock-approval-20261021.json','milestones/M03-n8n-foundation/evidence/dev-acceptance-zero-setup-20261021.json',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-clock-amendment-20261021.md','milestones/M03-n8n-foundation/evidence/dev-acceptance-late-delivery-20261021.json')
$requiredFiles+=@('scripts/n8n/foundation-live-postcheck-continuation.mjs',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-postcheck-approval-20261021.json',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-postcheck-checkpoint-20261021.json',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-postcheck-continuation-20261021.md',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-amended-attempt-20261021.json')
$requiredFiles+=@('scripts/n8n/foundation-live-remaining-continuation.mjs','scripts/assert/m03_smoke_reactivate.sql',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-remaining-checkpoint-20261022.json',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-remaining-packet-20261022.md',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-postcheck-attempt-20261021.json',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-vercel-postlogin-actual-20261022.json')
$versions = @('20261017172928','20261017172931','20261017172934','20261017172937','20261017172940','20261017172943','20261017172945','20261018034220','20261018035417','20261018070042','20261018231756','20261018232014','20261018232922','20261018233338')
$names = @('extensions_schemas_roles','core_tables','auth_rls_views','rpc_pipeline_core','rpc_app_search','storage_cron','seed_taxonomies','rpc_n8n_foundation','price_book_plan','n8n_worker_gateway_admission','m03_actor_launch_admission','m03_foundation_gateway','m03_foundation_safety_receipts','m03_foundation_boundary_hardening')
$queryTimeoutMs = 30000
$pushTimeoutMs = 180000
$runId = [Guid]::NewGuid().ToString()
$scratch = $null
$password = $null
$secret = $null
$bstr = [IntPtr]::Zero
$consumed = $false
$sessionLock = $null
$leaseExpires = $null
$phaseAStart = $null
$originalPhaseAStart = $null
$clockAmendmentStart = $null
$clockAmendmentSegment = $null
$postcheckContinuationStart = $null
$postcheckContinuationSegment = 'a570212a-634c-444f-90a2-578ae47e8d27'
$continuationOutputStem='m03-foundation-postcheck-continuation-'
if($RemainingContinuation){$postcheckContinuationSegment='e8035391-dba8-48c9-97e0-139ba980d86e';$continuationOutputStem='m03-foundation-remaining-continuation-'}
$phaseAControlHardDeadline = $null
$exitCode = 1
$receipt = [ordered]@{version=1;runId=$runId;environment='dev';projectRef=$projectRef;host=$poolerHost;port=5432;
  status='preflight_blocked';authenticationAttempted=$false;authenticationVerified=$false;historyBefore='not_checked';historyAfter='not_checked';
  dryRunMatched=$false;dryRunCheck='not_attempted';dryRunNativeExit=$null;pushAttempted=$false;pushNativeExit=$null;childrenClosed=$true;handoffDeleted=$false;leaseDeleted=$false;scratchDeleted=$true;
  pendingVersions=@('20261018231756','20261018232014','20261018232922','20261018233338');phaseAControl=$false;phaseACommands=0;phaseAClosed=$false;observedAt=$null}
if($PostcheckContinuation){$receipt.pendingVersions=@();$receipt['postcheckContinuation']=$true}
if($RemainingContinuation){$receipt['remainingContinuation']=$true}

function Assert-Keys($Value, [string[]]$Expected) {
  if ($Value -isnot [PSCustomObject]) { throw 'blocked' }
  $actual=@($Value.PSObject.Properties | ForEach-Object {$_.Name})
  $wanted=@($Expected | ForEach-Object {$_})
  if($actual.Count -ne $wanted.Count){throw 'blocked'}
  if($wanted.Count -gt 0 -and @(Compare-Object -ReferenceObject @($wanted | Sort-Object) -DifferenceObject @($actual | Sort-Object)).Count -ne 0){throw 'blocked'}
}
function Assert-Path([string]$Root, [string]$Relative, [switch]$Directory) {
  $rootEntry = Get-Item -LiteralPath $Root -Force -ErrorAction Stop
  if (-not $rootEntry.PSIsContainer -or ($rootEntry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'blocked' }
  $rootAncestor=[IO.Directory]::GetParent($Root)
  while($null -ne $rootAncestor){$rootParent=Get-Item -LiteralPath $rootAncestor.FullName -Force -ErrorAction Stop;if(($rootParent.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'blocked'};$rootAncestor=$rootAncestor.Parent}
  if ([IO.Path]::IsPathRooted($Relative) -or $Relative -match '(?:^|[/\\])\.\.(?:[/\\]|$)' -or $Relative -match '[:\x00]') { throw 'blocked' }
  $absolute = [IO.Path]::GetFullPath((Join-Path $Root $Relative))
  if (-not $absolute.StartsWith($Root + [IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'blocked' }
  $cursor = $Root
  foreach ($segment in ($Relative -split '[/\\]')) {
    $cursor = Join-Path $cursor $segment
    $entry = Get-Item -LiteralPath $cursor -Force -ErrorAction Stop
    if (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'blocked' }
  }
  if ($Directory) { if (-not $entry.PSIsContainer) { throw 'blocked' } }
  elseif ($entry.PSIsContainer) { throw 'blocked' }
  return $absolute
}
function Read-Json([string]$File, [long]$Maximum = 131072) {
  if ((Get-Item -LiteralPath $File).Length -gt $Maximum) { throw 'blocked' }
  return ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($File)) -ErrorAction Stop
}
function File-Hash([string]$File) { return (Get-FileHash -LiteralPath $File -Algorithm SHA256).Hash.ToLowerInvariant() }
function Write-NewJson([string]$File, $Value) {
  $stream = $null
  try {
    $bytes = [Text.Encoding]::UTF8.GetBytes(($Value | ConvertTo-Json -Depth 12 -Compress))
    $stream = [IO.File]::Open($File,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
    $stream.Write($bytes,0,$bytes.Length); $stream.Flush($true)
  } finally { if ($null -ne $stream) { $stream.Dispose() } }
}
function Read-FoundationOriginalStart([long]$Value,[DateTime]$Now=[DateTime]::UtcNow) {
  if(-not $PhaseAControl -or $Value -ne 1792584023481){throw 'blocked'}
  $path=Assert-Path $repo 'scripts/n8n/out/foundation/live/management.jsonl'
  if((Get-Item -LiteralPath $path).Length -gt 131072){throw 'blocked'}
  $text=[IO.File]::ReadAllText($path)
  if(-not $text.EndsWith("`n")){throw 'blocked'}
  $lines=@($text.Substring(0,$text.Length-1) -split "`r?`n")
  if($lines.Count -lt 1 -or $lines.Count -gt 513){throw 'blocked'}
  $header=ConvertFrom-Json -InputObject $lines[0] -ErrorAction Stop
  Assert-Keys $header @('event','version','sourceCommitSha','deadlineAt')
  if($header.event -cne 'management_header' -or $header.version -isnot [int] -or $header.version -ne 1 -or $header.sourceCommitSha -cne 'f42930f90c2de43c84f61ad6d966d0ee6074d70e' -or
      $header.deadlineAt -isnot [long] -or $header.deadlineAt -ne $Value){throw 'blocked'}
  for($index=1;$index -lt $lines.Count;$index++){
    $row=ConvertFrom-Json -InputObject $lines[$index] -ErrorAction Stop
    Assert-Keys $row @('event','ordinal')
    if($row.event -cne 'management_attempt' -or $row.ordinal -isnot [int] -or $row.ordinal -ne $index){throw 'blocked'}
  }
  $deadline=[DateTimeOffset]::FromUnixTimeMilliseconds($Value).UtcDateTime
  if($Now -ge $deadline.AddMinutes(-10)){throw 'blocked'}
  return $deadline.AddMinutes(-60)
}
function Get-FoundationLeaseFloor([DateTime]$Now=[DateTime]::UtcNow) {
  if($PostcheckContinuation){
    if(-not $PhaseAControl -or $ClockAmendment -or $OriginalDeadlineAtMs -ne 0){throw 'blocked'}
    if($null -ne $postcheckContinuationStart){return $postcheckContinuationStart.AddMinutes(75)}
    return $Now.AddMinutes(75)
  }
  if($ClockAmendment){
    if(-not $PhaseAControl -or $OriginalDeadlineAtMs -ne 0){throw 'blocked'}
    if($null -ne $clockAmendmentStart){return $clockAmendmentStart.AddMinutes(75)}
    return $Now.AddMinutes(75)
  }
  if($OriginalDeadlineAtMs -ne 0){
    if(-not $PhaseAControl -or $OriginalDeadlineAtMs -ne 1792584023481){throw 'blocked'}
    # Same original physical minute70 ceiling plus five minutes; no new lease
    # or action window is created by a later continuation process.
    return [DateTimeOffset]::FromUnixTimeMilliseconds($OriginalDeadlineAtMs).UtcDateTime.AddMinutes(15)
  }
  return $Now.AddMinutes($(if($PhaseAControl){75}else{10}))
}
function Read-FoundationClockAmendment {
  if(-not $PhaseAControl -or -not $ClockAmendment -or $OriginalDeadlineAtMs -ne 0){throw 'blocked'}
  $mode=if($CheckOnly){'CheckOnly'}else{'ReadClaimed'}
  $module=Assert-Path $repo 'scripts/n8n/foundation-live-clock-amendment.mjs'
  $answer=Invoke-Bounded $node @($module,$mode) $repo 10000
  try{
    if(-not $answer.ok -or -not $answer.closed){throw 'blocked'}
    $value=ConvertFrom-Json -InputObject $answer.text -ErrorAction Stop
    $keys=@('kind','segmentId','sourceCommitSha','windowId','privateRead','networkRequests')
    if(-not $CheckOnly){$keys+=@('startsAt','deadlineAt','stopNewAt','hardDeadlineAt')}
    Assert-Keys $value $keys
    $expected=if($CheckOnly){'clock_amendment_ready'}else{'clock_amendment_admitted'}
    if($value.kind -cne $expected -or $value.segmentId -cne '30e75d0d-7e4c-46c6-9a07-556f90b63859' -or
       $value.sourceCommitSha -cne 'f42930f90c2de43c84f61ad6d966d0ee6074d70e' -or $value.windowId -cne 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9' -or
       $value.privateRead -isnot [bool] -or $value.privateRead -or $value.networkRequests -isnot [int] -or $value.networkRequests -ne 0){throw 'blocked'}
    if($CheckOnly){return $null}
    foreach($field in @('startsAt','deadlineAt','stopNewAt','hardDeadlineAt')){if($value.$field -isnot [long]){throw 'blocked'}}
    $nowMs=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    if($value.startsAt -le 0 -or $value.startsAt -gt $nowMs+1000 -or $nowMs -ge $value.stopNewAt -or
       $value.deadlineAt-$value.startsAt -ne 3600000 -or $value.stopNewAt-$value.startsAt -ne 3000000 -or
       $value.hardDeadlineAt-$value.startsAt -ne 4200000){throw 'blocked'}
    return $value
  }finally{$answer.text=$null}
}
function Read-FoundationPostcheckContinuation {
  if(-not $PhaseAControl -or -not $PostcheckContinuation -or $ClockAmendment -or $OriginalDeadlineAtMs -ne 0){throw 'blocked'}
  $remainingMode=[bool](Get-Variable -Name RemainingContinuation -ValueOnly -ErrorAction SilentlyContinue)
  $mode=if($CheckOnly){'CheckOnly'}else{'ReadClaimed'}
  $module=Assert-Path $repo $(if($remainingMode){'scripts/n8n/foundation-live-remaining-continuation.mjs'}else{'scripts/n8n/foundation-live-postcheck-continuation.mjs'})
  $answer=Invoke-Bounded $node @($module,$mode) $repo 10000
  try{
    if(-not $answer.ok -or -not $answer.closed){throw 'blocked'}
    $value=ConvertFrom-Json -InputObject $answer.text -ErrorAction Stop
    if($CheckOnly -and $remainingMode -and $value.kind -ceq 'remaining_continuation_approval_required'){
      Assert-Keys $value @('kind','status','approvalRequired','segmentId','sourceCommitSha','windowId','privateRead','networkRequests')
      if($value.status -cne 'approval_required' -or $value.approvalRequired -isnot [bool] -or $value.approvalRequired -ne $true -or $value.privateRead -isnot [bool] -or $value.privateRead -ne $false -or $value.networkRequests -isnot [int] -or $value.networkRequests -ne 0 -or $value.segmentId -cne $postcheckContinuationSegment -or $value.sourceCommitSha -cne 'f42930f90c2de43c84f61ad6d966d0ee6074d70e' -or $value.windowId -cne 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9'){throw 'blocked'}
      Write-Output 'M03_FOUNDATION APPROVAL_REQUIRED. New remaining segment has no owner time authority; no credential metadata, private contents or authentication read.';exit 3
    }
    $keys=@('kind','segmentId','sourceCommitSha','windowId','privateRead','networkRequests')
    if(-not $CheckOnly){$keys+=@('startsAt','deadlineAt','stopNewAt','hardDeadlineAt')}
    Assert-Keys $value $keys
    $expected=if($remainingMode){if($CheckOnly){'remaining_continuation_ready'}else{'clock_remaining_continuation_admitted'}}elseif($CheckOnly){'postcheck_continuation_ready'}else{'clock_postcheck_continuation_admitted'}
    if($value.kind -cne $expected -or $value.segmentId -cne $postcheckContinuationSegment -or
       $value.sourceCommitSha -cne 'f42930f90c2de43c84f61ad6d966d0ee6074d70e' -or $value.windowId -cne 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9' -or
       $value.privateRead -isnot [bool] -or $value.privateRead -or $value.networkRequests -isnot [int] -or $value.networkRequests -ne 0){throw 'blocked'}
    if($CheckOnly){return $null}
    foreach($field in @('startsAt','deadlineAt','stopNewAt','hardDeadlineAt')){if($value.$field -isnot [long]){throw 'blocked'}}
    $nowMs=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    if($value.startsAt -le 0 -or $value.startsAt -gt $nowMs+1000 -or $nowMs -ge $value.stopNewAt -or
       $value.deadlineAt-$value.startsAt -ne 3600000 -or $value.stopNewAt-$value.startsAt -ne 3000000 -or
       $value.hardDeadlineAt-$value.startsAt -ne 4200000){throw 'blocked'}
    return $value
  }finally{$answer.text=$null}
}
function Read-FoundationKernelProcess([long]$ProcessId) {
  if($ProcessId -le 0){throw 'blocked'}
  # Projection is deliberate: never retrieve CommandLine, ExecutablePath or
  # environment/credential-bearing fields from another process.
  $values=@(Get-CimInstance -ClassName Win32_Process -Filter ('ProcessId = '+$ProcessId) -Property ProcessId,ParentProcessId,CreationDate -ErrorAction Stop)
  if($values.Count -ne 1 -or $values[0].CreationDate -isnot [DateTime]){throw 'blocked'}
  return [pscustomobject]@{processId=[long]$values[0].ProcessId;parentProcessId=[long]$values[0].ParentProcessId;createdAt=$values[0].CreationDate.ToUniversalTime()}
}
function Read-FoundationParentLock([string]$File) {
  # Only this public metadata reader permits the incumbent wrapper's write
  # access. The wrapper keeps FileShare.Read, denying other writers/deletion.
  if([IO.Path]::GetFileName($File) -cne 'emr-m03-acceptance-parent.operation.lock'){throw 'blocked'}
  $stream=$null;$buffer=$null
  try{
    $stream=[IO.File]::Open($File,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::ReadWrite)
    $length=$stream.Length;if($length -le 0 -or $length -gt 4096){throw 'blocked'}
    $buffer=New-Object byte[] 4097;$position=0
    while($position -lt $buffer.Length){$count=$stream.Read($buffer,$position,$buffer.Length-$position);if($count -eq 0){break};$position+=$count}
    if($position -ne $length -or $stream.Length -ne $length){throw 'blocked'}
    $text=[Text.UTF8Encoding]::new($false,$true).GetString($buffer,0,$position)
    $value=ConvertFrom-Json -InputObject $text -ErrorAction Stop
    Assert-Keys $value @('kind','version','segmentId','processId')
    return $value
  }finally{if($null -ne $buffer){[Array]::Clear($buffer,0,$buffer.Length)};if($null -ne $stream){$stream.Dispose()}}
}
function Assert-FoundationRemainingProcessAncestry($Clock) {
  if(-not $RemainingContinuation -or $CheckOnly -or $Clock.segmentId -cne 'e8035391-dba8-48c9-97e0-139ba980d86e' -or
     [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() -ge $Clock.stopNewAt){throw 'blocked'}
  $stem='scripts/n8n/out/foundation/live/remaining-continuation-e8035391-dba8-48c9-97e0-139ba980d86e'
  $admissionPath=Assert-Path $repo ($stem+'.json');$claimPath=Assert-Path $repo ($stem+'.runtime-claim.json')
  $admission=Read-Json $admissionPath;$claim=Read-Json $claimPath
  Assert-Keys $claim @('kind','version','segmentId','admissionSha256','processId','parentProcessId','claimedAt')
  if($claim.kind -cne 'm03_remaining_continuation_runtime_claim' -or $claim.version -ne 1 -or $claim.segmentId -cne $Clock.segmentId -or
     $claim.admissionSha256 -cne (File-Hash $admissionPath) -or $claim.processId -le 0 -or $claim.parentProcessId -le 0 -or
     $claim.claimedAt -isnot [long] -or $claim.claimedAt -lt $Clock.startsAt -or $claim.claimedAt -gt [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() -or
     $admission.kind -cne 'm03_remaining_continuation_admission' -or $admission.segmentId -cne $Clock.segmentId -or $admission.startsAt -ne $Clock.startsAt -or $admission.parentProcessId -ne $claim.parentProcessId){throw 'blocked'}
  $parentPath=Assert-Path ([IO.Path]::GetFullPath($env:LOCALAPPDATA)) 'Temp/emr-m03-acceptance-parent.operation.lock'
  $parent=Read-FoundationParentLock $parentPath
  Assert-Keys $parent @('kind','version','segmentId','processId')
  if($parent.kind -cne 'm03_clock_admission_parent' -or $parent.version -ne 1 -or $parent.segmentId -cne $Clock.segmentId -or $parent.processId -ne $claim.parentProcessId){throw 'blocked'}
  $admin=Read-FoundationKernelProcess $PID;$runtime=Read-FoundationKernelProcess $claim.processId;$wrapper=Read-FoundationKernelProcess $claim.parentProcessId
  # Native CreationDate has finer precision than the immutable Date.now() clock.
  # Compare its Unix millisecond projection, preserving the same clock boundary.
  $runtimeCreatedMs=([DateTimeOffset]$runtime.createdAt).ToUnixTimeMilliseconds();$wrapperCreatedMs=([DateTimeOffset]$wrapper.createdAt).ToUnixTimeMilliseconds()
  if($admin.processId -ne $PID -or $admin.parentProcessId -ne $claim.processId -or $runtime.processId -ne $claim.processId -or
     $runtime.parentProcessId -ne $claim.parentProcessId -or $wrapper.processId -ne $claim.parentProcessId -or
     $wrapperCreatedMs -gt $Clock.startsAt -or $runtimeCreatedMs -lt $Clock.startsAt -or $runtimeCreatedMs -gt $claim.claimedAt -or
     $admin.createdAt -lt $runtime.createdAt -or $admin.createdAt -gt [DateTime]::UtcNow){throw 'blocked'}
  return $true
}

# Every native child gets a fresh OS-only environment. Only reviewed CLI database
# operations receive PGPASSWORD. No shell, loader, compiler or install is launched.
function Invoke-Bounded([string]$Executable, [string[]]$Arguments, [string]$WorkingDirectory, [int]$TimeoutMs, [string]$PrivatePassword = $null) {
  $start = $null; $child = $null; $memory = $null; $buffer = $null
  $started = $false; $closed = $true; $nativeExit = $null; $valid = $false; $text = $null
  $stdout = $null; $stderr = $null
  try {
    $quoted = foreach ($argument in $Arguments) {
      if ($argument -match '["\r\n\x00]' -or $argument.EndsWith('\')) { throw 'blocked' }
      '"' + $argument + '"'
    }
    $start = New-Object Diagnostics.ProcessStartInfo
    $start.FileName = $Executable; $start.Arguments = $quoted -join ' '; $start.WorkingDirectory = $WorkingDirectory
    $start.UseShellExecute = $false; $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true; $start.RedirectStandardError = $true
    $start.EnvironmentVariables.Clear()
    foreach ($name in @('SystemRoot','WINDIR','PATH','TEMP','TMP','LOCALAPPDATA','APPDATA','USERPROFILE')) {
      $value = [Environment]::GetEnvironmentVariable($name,'Process')
      if ($null -ne $value) { $start.EnvironmentVariables[$name] = $value }
    }
    if (-not [string]::IsNullOrEmpty($PrivatePassword)) { $start.EnvironmentVariables['PGPASSWORD'] = $PrivatePassword }
    $child = New-Object Diagnostics.Process
    $child.StartInfo = $start
    $started = $child.Start()
    if (-not $started) { throw 'blocked' }
    $closed = $false
    $start.EnvironmentVariables.Clear()
    $buffer = New-Object byte[] 131072
    $memory = [IO.MemoryStream]::new([byte[]]$buffer,$true)
    $stdout = $child.StandardOutput.BaseStream.CopyToAsync($memory)
    $stderr = $child.StandardError.BaseStream.CopyToAsync([IO.Stream]::Null)
    if (-not $child.WaitForExit($TimeoutMs)) { throw 'blocked' }
    $closed = $true; $nativeExit = $child.ExitCode
    $drained = [Threading.Tasks.Task]::WhenAll([Threading.Tasks.Task[]]@($stdout,$stderr))
    if (-not $drained.Wait(5000)) { throw 'blocked' }
    $text = [Text.Encoding]::UTF8.GetString($buffer,0,[int]$memory.Position)
    $valid = $nativeExit -eq 0
  } catch {
    # Raw stdout/stderr and exception messages can contain database credentials.
    $valid = $false
  } finally {
    if ($null -ne $start) { $start.EnvironmentVariables.Clear() }
    if ($null -ne $child) {
      if ($started -and -not $closed) {
        try {
          if (-not $child.WaitForExit(0)) { $child.Kill() }
          $closed = $child.WaitForExit(5000)
          if ($closed) { $nativeExit = $child.ExitCode }
        } catch { $closed = $false }
      }
      try { $child.Dispose() } catch { $valid = $false }
    }
    if ($null -ne $stdout -and $null -ne $stderr) {
      try { $null = [Threading.Tasks.Task]::WhenAll([Threading.Tasks.Task[]]@($stdout,$stderr)).Wait(5000) } catch { $valid = $false }
    }
    if ($null -ne $memory) { $memory.Dispose() }
    if ($null -ne $buffer) { [Array]::Clear($buffer,0,$buffer.Length) }
    $PrivatePassword = $null
  }
  return [PSCustomObject]@{ok=$valid;started=$started;closed=$closed;nativeExit=$nativeExit;text=$text}
}
function Invoke-Cli([string[]]$Arguments, [int]$TimeoutMs) {
  if ($null -eq $leaseExpires -or [DateTime]::UtcNow -ge $leaseExpires) { throw 'blocked' }
  if($null -ne $phaseAControlHardDeadline){
    $remaining=[int](($phaseAControlHardDeadline-[DateTime]::UtcNow).TotalMilliseconds-15000)
    if($remaining -le 0){throw 'blocked'}
    $TimeoutMs=[Math]::Min($TimeoutMs,$remaining)
  }
  if ($Arguments.Count -lt 2 -or -not (($Arguments[0] -ceq 'db' -and $Arguments[1] -cin @('query','push','advisors')) -or ($Arguments[0] -ceq 'gen' -and $Arguments[1] -ceq 'types'))) { throw 'blocked' }
  # The continuation cannot reach a migration write even if another branch is
  # accidentally changed later. Its scratch workdir contains no migrations.
  if($PostcheckContinuation -and $Arguments[1] -ceq 'push'){throw 'blocked'}
  if($RemainingContinuation -and ($Arguments[0] -cne 'db' -or $Arguments[1] -cne 'query')){throw 'blocked'}
  # CLI2.121.0 gives legacy --output json precedence over --output-format and
  # selects a text layer. Query has its own legacy formatter; push does not.
  $outputFlags = @('--output-format','json')
  if ($Arguments[1] -ceq 'query') { $outputFlags += @('--output','json') }
  $result = Invoke-Bounded $cliPath ($Arguments + @('--workdir',$scratch,'--db-url',$dbUri,'--agent','no') + $outputFlags) $scratch $TimeoutMs $password
  if (-not $result.closed) { $receipt.childrenClosed = $false }
  return $result
}
function History-State($Result) {
  if (-not $Result.ok -or -not $Result.closed -or $Result.text -notmatch '^\s*\[') { return 'rejected' }
  try {
    $rows = ConvertFrom-Json -InputObject $Result.text -ErrorAction Stop
    if ($rows -isnot [Array] -or $rows.Count -ne 1) { throw 'blocked' }
    Assert-Keys $rows[0] @('receipt')
    $snapshot = $rows[0].receipt
    Assert-Keys $snapshot @('current_user','session_user','database','migrations')
    if ($snapshot.current_user -cne 'postgres' -or $snapshot.session_user -cne 'postgres' -or $snapshot.database -cne 'postgres' -or $snapshot.migrations -isnot [Array]) { throw 'blocked' }
    $history = @($snapshot.migrations)
    if ($history.Count -notin @(10,14)) { throw 'blocked' }
    for ($i=0; $i -lt $history.Count; $i++) {
      Assert-Keys $history[$i] @('version','name','historySha256')
      if ($history[$i].version -cne $migrations[$i].version -or $history[$i].name -cne $migrations[$i].name -or $history[$i].historySha256 -cne $migrations[$i].historySha256) { throw 'blocked' }
    }
    if ($history.Count -eq 14) { return 'complete' }
    return 'baseline'
  } catch { return 'rejected' }
}
function Push-Check($Result,[bool]$DryRun) {
  # This finite public classification never returns CLI errors, output, filenames
  # or credentials. Native failure and a contract mismatch are different gates.
  if (-not $Result.started) { return 'child_not_started' }
  if (-not $Result.closed) { return 'child_not_closed' }
  if ($Result.nativeExit -ne 0) { return 'native_failure' }
  if (-not $Result.ok) { return 'output_unavailable' }
  try { $value = ConvertFrom-Json -InputObject $Result.text -ErrorAction Stop }
  catch { return 'invalid_json' }
  try {
    Assert-Keys $value @('upToDate','dryRun','migrations','seeds','roles','message')
    if ($value.upToDate -isnot [bool] -or $value.upToDate -ne $false -or $value.dryRun -isnot [bool] -or $value.dryRun -ne $DryRun -or
        $value.message -cne 'Finished supabase db push.' -or $value.migrations -isnot [Array] -or $value.seeds -isnot [Array] -or $value.roles -isnot [Array] -or
        $value.seeds.Count -ne 0 -or $value.roles.Count -ne 0) { throw 'blocked' }
  } catch { return 'invalid_shape' }
  if ($value.migrations.Count -ne 4) { return 'pending_mismatch' }
  for ($i=0; $i -lt 4; $i++) { if ($value.migrations[$i] -isnot [string] -or $value.migrations[$i] -cne [IO.Path]::GetFileName($packet.pending[$i].file)) { return 'pending_mismatch' } }
  return 'matched'
}
function Push-Matches($Result,[bool]$DryRun) {
  return (Push-Check $Result $DryRun) -ceq 'matched'
}

# All preflight checks are public and precede any DPAPI read/decryption.
try {
  if($PostcheckContinuation -and (-not $PhaseAControl -or $ClockAmendment -or $OriginalDeadlineAtMs -ne 0)){throw 'blocked'}
  if($ClockAmendment -and (-not $PhaseAControl -or $OriginalDeadlineAtMs -ne 0)){throw 'blocked'}
  $repoEntry = Get-Item -LiteralPath $repo -Force
  if (($repoEntry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'blocked' }
  $packet = Read-Json (Assert-Path $repo 'scripts/db/m03-foundation-dev-migration-packet.json')
  Assert-Keys $packet @('version','target','approved','authorizationReference','cliVersion','baseline','pending','files','node')
  if ($packet.version -ne 1 -or $packet.target -cne $projectRef -or $packet.approved -isnot [bool] -or -not $packet.approved -or
      $packet.cliVersion -cne '2.121.0' -or $packet.authorizationReference -cne 'Owner approved M03 A-D dev acceptance at f42930f90c2de43c84f61ad6d966d0ee6074d70e on 2026-10-21' -or
      $packet.baseline -isnot [Array] -or $packet.pending -isnot [Array] -or $packet.baseline.Count -ne 10 -or $packet.pending.Count -ne 4) { throw 'blocked' }
  Assert-Keys $packet.files $requiredFiles
  foreach ($property in $packet.files.PSObject.Properties) {
    if ($property.Value -isnot [string] -or $property.Value -cnotmatch '^[a-f0-9]{64}$' -or (File-Hash (Assert-Path $repo $property.Name)) -cne $property.Value) { throw 'blocked' }
  }
  . (Assert-Path $repo 'scripts/db/windows/Foundation-AdminControl.ps1')
  Assert-Keys $packet.node @('path','sha256')
  $node = (Get-Command node.exe -CommandType Application -ErrorAction Stop).Source
  if ($packet.node.path -isnot [string] -or $node -cne $packet.node.path -or $packet.node.sha256 -cnotmatch '^[a-f0-9]{64}$') { throw 'blocked' }
  $nodeEntry = Get-Item -LiteralPath $node -Force
  if ($nodeEntry.PSIsContainer -or ($nodeEntry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or (File-Hash $node) -cne $packet.node.sha256) { throw 'blocked' }
  $nodeCursor=[IO.Directory]::GetParent($node)
  while($null -ne $nodeCursor){$nodeParent=Get-Item -LiteralPath $nodeCursor.FullName -Force;if(($nodeParent.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'blocked'};$nodeCursor=$nodeCursor.Parent}
  $migrations = @($packet.baseline) + @($packet.pending)
  for ($i=0; $i -lt 14; $i++) {
    $migration = $migrations[$i]
    Assert-Keys $migration @('version','name','file','sha256','historySha256')
    $expectedFile = 'supabase/migrations/' + $versions[$i] + '_' + $names[$i] + '.sql'
    if ($migration.version -cne $versions[$i] -or $migration.name -cne $names[$i] -or $migration.file -cne $expectedFile -or
        $migration.sha256 -cnotmatch '^[a-f0-9]{64}$' -or $migration.historySha256 -cnotmatch '^[a-f0-9]{64}$' -or
        (File-Hash (Assert-Path $repo $expectedFile)) -cne $migration.sha256) { throw 'blocked' }
  }
  $actualMigrations = @(Get-ChildItem -LiteralPath (Assert-Path $repo 'supabase/migrations' -Directory) -Force)
  if ($actualMigrations.Count -ne 14) { throw 'blocked' }
  foreach ($entry in $actualMigrations) {
    if ($entry.PSIsContainer -or ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or $entry.Name -cnotin @($migrations | ForEach-Object { [IO.Path]::GetFileName($_.file) })) { throw 'blocked' }
  }
  $caPath = Assert-Path $repo $caRelative
  if ((File-Hash $caPath) -cne $caHash) { throw 'blocked' }
  $pin = Read-Json (Assert-Path $repo 'scripts/seed/certs/supabase-root-2021.json')
  Assert-Keys $pin @('version','projectRef','host','sourceUrl','sha256')
  if ($pin.version -ne 1 -or $pin.projectRef -cne $projectRef -or $pin.host -cne $poolerHost -or $pin.sha256 -cne $caHash -or $pin.sourceUrl -cne 'https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt') { throw 'blocked' }
  $cliPath = Assert-Path $repo $cliRelative
  $cliVersion = Invoke-Bounded $cliPath @('--version') $repo 10000
  if (-not $cliVersion.ok -or -not $cliVersion.closed -or $cliVersion.text.Trim() -cne '2.121.0') { throw 'blocked' }
  if($OriginalDeadlineAtMs -ne 0){$originalPhaseAStart=Read-FoundationOriginalStart $OriginalDeadlineAtMs;$phaseAControlHardDeadline=$originalPhaseAStart.AddMinutes(70)}
  if($ClockAmendment){
    $clock=Read-FoundationClockAmendment
    if($null -ne $clock){
      $clockAmendmentStart=[DateTimeOffset]::FromUnixTimeMilliseconds($clock.startsAt).UtcDateTime
      $clockAmendmentSegment=$clock.segmentId;$phaseAControlHardDeadline=$clockAmendmentStart.AddMinutes(70)
      $receipt['clockSegmentId']=$clockAmendmentSegment
    }
  }
  if($PostcheckContinuation){
    $clock=Read-FoundationPostcheckContinuation
    if($null -ne $clock){
      if($RemainingContinuation){$null=Assert-FoundationRemainingProcessAncestry $clock}
      $postcheckContinuationStart=[DateTimeOffset]::FromUnixTimeMilliseconds($clock.startsAt).UtcDateTime
      $phaseAControlHardDeadline=$postcheckContinuationStart.AddMinutes(70)
      $receipt['clockSegmentId']=$postcheckContinuationSegment
    }
  }
  $out = Join-Path $repo 'scripts/db/out'
  if (-not (Test-Path -LiteralPath $out)) { $null = New-Item -ItemType Directory -Path $out }
  $out = Assert-Path $repo 'scripts/db/out' -Directory
  $attemptFile = Join-Path $out 'm03-foundation-dev-migration-attempt.json'
  $latestFile = Join-Path $out 'm03-foundation-dev-migration-latest.json'
  if($PostcheckContinuation){
    $attemptFile=Join-Path $out ($continuationOutputStem+$postcheckContinuationSegment+'-attempt.json')
    $latestFile=Join-Path $out ($continuationOutputStem+$postcheckContinuationSegment+'-latest.json')
    if((Test-Path -LiteralPath $attemptFile) -or (Test-Path -LiteralPath $latestFile)){
      Write-Output 'M03_FOUNDATION CONTINUATION_ALREADY_RECORDED. No decryption, migration operation or automatic replay. Preserve and reconcile the separate continuation receipts.';exit 1
    }
  }
  if (Test-Path -LiteralPath $attemptFile) {
    if ($CheckOnly) {
      $admission = Read-Json (Assert-Path $repo 'scripts/db/out/m03-foundation-dev-migration-attempt.json')
      Assert-Keys $admission @('version','runId','projectRef','pending','createdAt')
      $prior = Read-Json (Assert-Path $repo 'scripts/db/out/m03-foundation-dev-migration-latest.json')
      if ($admission.version -ne 1 -or $admission.projectRef -cne $projectRef -or $admission.pending -isnot [Array] -or $admission.pending.Count -ne 4) { throw 'blocked' }
      for ($i=0; $i -lt 4; $i++) {
        Assert-Keys $admission.pending[$i] @('version','name','file','sha256','historySha256')
        foreach ($field in @('version','name','file','sha256','historySha256')) { if ($admission.pending[$i].$field -cne $packet.pending[$i].$field) { throw 'blocked' } }
      }
      if ($prior.version -eq 1 -and $prior.runId -ceq $admission.runId -and $prior.projectRef -ceq $projectRef -and
          $prior.status -ceq 'complete' -and $prior.historyAfter -ceq 'complete' -and $prior.authenticationVerified -eq $true -and
          $prior.childrenClosed -eq $true -and $prior.handoffDeleted -eq $true -and $prior.leaseDeleted -eq $true -and $prior.scratchDeleted -eq $true) {
        Write-Output 'M03_FOUNDATION RECORDED_COMPLETE. The matching prior public completion receipt is verified; no handoff needed, decryption, connection or replay. Hosted state was not refreshed.'
        exit 0
      }
    }
    Write-Output 'M03_FOUNDATION ATTEMPT_ALREADY_RECORDED. No decryption or automatic replay. Reconcile the existing public receipt/history before any separately reviewed continuation.'
    exit 1
  }
} catch {
  Write-Output 'M03_FOUNDATION PREFLIGHT_BLOCKED. Public packet/seal/target/CLI verification failed; no decryption or authentication attempted.'
  exit 1
}
try {
  if ([string]::IsNullOrEmpty($env:LOCALAPPDATA)) { throw 'blocked' }
  $handoff = Join-Path ([IO.Path]::GetFullPath($env:LOCALAPPDATA)) 'Temp/emr-m03-foundation-dev-migration-password.dpapi'
  if (-not (Test-Path -LiteralPath $handoff -PathType Leaf)) {
    Write-Output 'M03_FOUNDATION HANDOFF_MISSING. No decryption or authentication attempted.'; exit 2
  }
  $handoff = Assert-Path ([IO.Path]::GetFullPath($env:LOCALAPPDATA)) 'Temp/emr-m03-foundation-dev-migration-password.dpapi'
  if ((Get-Item -LiteralPath $handoff).Length -gt 32768) { throw 'blocked' }
  $leaseFile = Assert-Path ([IO.Path]::GetFullPath($env:LOCALAPPDATA)) 'Temp/emr-m03-foundation-dev-migration-password.lease.json'
  $lease = Read-Json $leaseFile 4096
  Assert-Keys $lease @('version','environment','projectRef','purpose','approvalSha','createdAt','expiresAt')
  if ($lease.version -ne 1 -or $lease.environment -cne 'dev' -or $lease.projectRef -cne $projectRef -or
      $lease.purpose -cne 'm03-foundation-phase-a-dev' -or $lease.approvalSha -cne 'f42930f90c2de43c84f61ad6d966d0ee6074d70e' -or
      $lease.createdAt -isnot [string] -or $lease.expiresAt -isnot [string]) { throw 'blocked' }
  $leaseCreated = [DateTime]::ParseExact($lease.createdAt,'o',[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::RoundtripKind)
  $leaseExpires = [DateTime]::ParseExact($lease.expiresAt,'o',[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::RoundtripKind)
  if ($leaseCreated.Kind -ne [DateTimeKind]::Utc -or $leaseExpires.Kind -ne [DateTimeKind]::Utc -or
      $leaseCreated -gt [DateTime]::UtcNow.AddMinutes(1) -or $leaseExpires -ne $leaseCreated.AddHours(2)) { throw 'blocked' }
  if($leaseExpires -le (Get-FoundationLeaseFloor)){
    if($CheckOnly -and ($ClockAmendment -or $PostcheckContinuation)){Write-Output 'M03_FOUNDATION HANDOFF_LEASE_NOT_READY. Public inputs verified; the unchanged two-hour admin lease does not cover this admission. No private file read, decryption or authentication attempted.';exit 2}
    throw 'blocked'
  }
} catch { Write-Output 'M03_FOUNDATION HANDOFF_PATH_BLOCKED. No private file read, decryption or authentication attempted.'; exit 1 }
if ($CheckOnly) { Write-Output 'M03_FOUNDATION CHECK_ONLY_READY. Exact dev target, public seals and encrypted handoff presence verified; no decryption, TCP connection or authentication attempted.'; exit 0 }

try {
  $lockPath = Join-Path $out 'm03-foundation-dev-migration-session.lock'
  if (Test-Path -LiteralPath $lockPath) { $null = Assert-Path $repo 'scripts/db/out/m03-foundation-dev-migration-session.lock' }
  $sessionLock = [IO.File]::Open($lockPath,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
  if (Test-Path -LiteralPath $attemptFile) { throw 'blocked' }
  if ((File-Hash $node) -cne $packet.node.sha256) { throw 'blocked' }
  $tls = Invoke-Bounded $node @((Assert-Path $repo 'scripts/seed/check-tls.mjs')) $repo 15000
  if (-not $tls.closed) { $receipt.childrenClosed = $false }
  if (-not $tls.ok -or -not $tls.closed) { throw 'blocked' }
  $tlsValue = ConvertFrom-Json -InputObject $tls.text -ErrorAction Stop
  if ($tlsValue.status -cne 'verified' -or $tlsValue.phase -cne 'tls_handshake' -or $tlsValue.code -cne 'TLS_VERIFIED' -or
      $tlsValue.environment -cne 'dev' -or $tlsValue.projectRef -cne $projectRef -or $tlsValue.host -cne $poolerHost -or $tlsValue.port -ne 5432 -or
      $tlsValue.rejectUnauthorized -ne $true -or $tlsValue.exactServerName -ne $true -or $tlsValue.scopedCaVerified -ne $true -or
      $tlsValue.startupMessageSent -ne $false -or $tlsValue.authenticationAttempted -ne $false -or $tlsValue.socketsClosed -ne $true) { throw 'blocked' }

  $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')
  $tempEntry = Get-Item -LiteralPath $tempRoot -Force
  if (($tempEntry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'blocked' }
  $scratch = Join-Path $tempRoot ('emr-m03-foundation-dev-migrations-' + $runId)
  $null = New-Item -ItemType Directory -Path $scratch -ErrorAction Stop
  $receipt.scratchDeleted = $false
  Write-NewJson (Join-Path $scratch 'owned.json') ([ordered]@{runId=$runId;projectRef=$projectRef})
  $null = New-Item -ItemType Directory -Path (Join-Path $scratch 'supabase/migrations') -Force
  [IO.File]::WriteAllText((Join-Path $scratch 'supabase/config.toml'),"project_id = `"emr-m03-foundation-dev-migration`"`n[db.seed]`nenabled = false`nsql_paths = []`n")
  if(-not $PostcheckContinuation){foreach ($migration in $migrations) { [IO.File]::Copy((Assert-Path $repo $migration.file),(Join-Path $scratch $migration.file),$false) }}
  $scratchCa = Join-Path $scratch 'supabase-root-2021.crt'
  [IO.File]::Copy($caPath,$scratchCa,$false)
  if ((File-Hash $scratchCa) -cne $caHash) { throw 'blocked' }
  if(-not $PostcheckContinuation){foreach ($migration in $migrations) { if ((File-Hash (Assert-Path $scratch $migration.file)) -cne $migration.sha256) { throw 'blocked' } }}
  $historySql = @'
select jsonb_build_object('current_user',current_user,'session_user',session_user,'database',current_database(),'migrations',(select coalesce(jsonb_agg(jsonb_build_object('version',version,'name',name,'historySha256',encode(extensions.digest(array_to_string(statements,E'\n'),'sha256'),'hex')) order by version),'[]'::jsonb) from supabase_migrations.schema_migrations)) as receipt;
'@
  $queryFile = Join-Path $scratch 'history.sql'
  [IO.File]::WriteAllText($queryFile,$historySql)
  $dbUri = 'postgresql://postgres.' + $projectRef + '@' + $poolerHost + ':5432/postgres?sslmode=verify-full&sslrootcert=' + [Uri]::EscapeDataString($scratchCa)

  # The only private read is the new purpose-bound foundation DPAPI file. No old administrator,
  # writer, provider or production credential is opened or used.
  $null = Assert-Path ([IO.Path]::GetFullPath($env:LOCALAPPDATA)) 'Temp/emr-m03-foundation-dev-migration-password.dpapi'
  if($null -ne $originalPhaseAStart -and [DateTime]::UtcNow -ge $originalPhaseAStart.AddMinutes(50)){throw 'blocked'}
  if($null -ne $clockAmendmentStart -and [DateTime]::UtcNow -ge $clockAmendmentStart.AddMinutes(50)){throw 'blocked'}
  if($null -ne $postcheckContinuationStart -and [DateTime]::UtcNow -ge $postcheckContinuationStart.AddMinutes(50)){throw 'blocked'}
  if($RemainingContinuation){$null=Assert-FoundationRemainingProcessAncestry $clock}
  $consumed = $true
  $phaseAStart = if($null -ne $originalPhaseAStart){$originalPhaseAStart}elseif($null -ne $clockAmendmentStart){$clockAmendmentStart}elseif($null -ne $postcheckContinuationStart){$postcheckContinuationStart}else{[DateTime]::UtcNow}
  $secret = ConvertTo-SecureString -String ([IO.File]::ReadAllText($handoff).Trim()) -ErrorAction Stop
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
  $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr); $bstr = [IntPtr]::Zero
  $secret.Dispose(); $secret = $null
  if ([string]::IsNullOrEmpty($password)) { throw 'blocked' }
  $before = Invoke-Cli @('db','query','--file',$queryFile) $queryTimeoutMs
  # A launched command with a failed/ambiguous response does not prove either
  # authentication or its absence. Only validated identity/history proves it.
  if ($before.started) { $receipt.authenticationAttempted = $null }
  $receipt.historyBefore = History-State $before
  if ($receipt.historyBefore -in @('baseline','complete')) { $receipt.authenticationAttempted = $true; $receipt.authenticationVerified = $true }
  $before.text = $null
  if($PostcheckContinuation){
    if($receipt.historyBefore -cne 'complete'){$receipt.status='history_rejected'}
    else{
      Write-NewJson $attemptFile ([ordered]@{version=1;runId=$runId;projectRef=$projectRef;segmentId=$postcheckContinuationSegment;purpose='postcheck-only-continuation';createdAt=[DateTime]::UtcNow.ToString('o')})
      $receipt.status='continuation_history_verified';$receipt.historyAfter='complete';$exitCode=0
    }
  }
  elseif ($receipt.historyBefore -eq 'complete') { $receipt.status = 'already_complete'; $receipt.historyAfter = 'complete'; $exitCode = 0 }
  elseif ($receipt.historyBefore -ne 'baseline') { $receipt.status = 'history_rejected' }
  else {
    $dry = Invoke-Cli @('db','push','--dry-run','--skip-vault') 60000
    $receipt.dryRunNativeExit = $dry.nativeExit
    $receipt.dryRunCheck = Push-Check $dry $true
    $receipt.dryRunMatched = $receipt.dryRunCheck -ceq 'matched'
    $dry.text = $null
    if (-not $receipt.dryRunMatched) { $receipt.status = 'dry_run_rejected' }
    else {
      # This durable, public admission is NEVER automatically deleted. A crash or
      # ambiguous response cannot authorize replay of a successful migration.
      Write-NewJson $attemptFile ([ordered]@{version=1;runId=$runId;projectRef=$projectRef;pending=$packet.pending;createdAt=[DateTime]::UtcNow.ToString('o')})
      $receipt.pushAttempted = $true
      $push = Invoke-Cli @('db','push','--skip-vault','--yes') $pushTimeoutMs
      $receipt.pushNativeExit = $push.nativeExit
      $pushMatched = Push-Matches $push $false
      $push.text = $null
      if (-not $push.closed) { $receipt.status = 'child_cleanup_incomplete' }
      else {
        $after = Invoke-Cli @('db','query','--file',$queryFile) $queryTimeoutMs
        $receipt.historyAfter = History-State $after
        $after.text = $null
        if ($receipt.historyAfter -ne 'complete') { $receipt.status = 'reconciliation_required' }
        elseif (-not $pushMatched) { $receipt.status = 'reconciled_complete_after_failure' }
        else { $receipt.status = 'complete'; $exitCode = 0 }
      }
    }
  }
  if ($PhaseAControl -and $exitCode -eq 0 -and $receipt.historyAfter -ceq 'complete') {
    $receipt.phaseAControl = $true
    Invoke-FoundationAdminControl
  }
} catch {
  $exitCode=1
  if ($receipt.phaseAControl) { $receipt.status = 'phase_a_control_failed' }
  elseif ($receipt.pushAttempted) { $receipt.status = 'reconciliation_required' }
  elseif ($consumed) { $receipt.status = 'private_operation_failed' }
  else { $receipt.status = 'public_preflight_failed' }
} finally {
  if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
  if ($null -ne $secret) { $secret.Dispose() }
  $password = $null; $secret = $null; $dbUri = $null
  if ($consumed) {
    try { [IO.File]::Delete($handoff); $receipt.handoffDeleted = -not (Test-Path -LiteralPath $handoff) } catch { $receipt.handoffDeleted = $false }
    try { [IO.File]::Delete($leaseFile); $receipt.leaseDeleted = -not (Test-Path -LiteralPath $leaseFile) } catch { $receipt.leaseDeleted = $false }
  }
  if ($null -ne $scratch -and $receipt.childrenClosed) {
    try {
      $resolvedScratch = [IO.Path]::GetFullPath($scratch)
      if ($resolvedScratch -cne (Join-Path $tempRoot ('emr-m03-foundation-dev-migrations-' + $runId)) -or -not $resolvedScratch.StartsWith($tempRoot + '\',[StringComparison]::OrdinalIgnoreCase)) { throw 'blocked' }
      $owner = Read-Json (Assert-Path $resolvedScratch 'owned.json')
      Assert-Keys $owner @('runId','projectRef')
      if ($owner.runId -cne $runId -or $owner.projectRef -cne $projectRef) { throw 'blocked' }
      foreach ($entry in @(Get-Item -LiteralPath $resolvedScratch -Force) + @(Get-ChildItem -LiteralPath $resolvedScratch -Recurse -Force)) {
        if (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'blocked' }
      }
      Remove-Item -LiteralPath $resolvedScratch -Recurse -Force -ErrorAction Stop
      $receipt.scratchDeleted = -not (Test-Path -LiteralPath $resolvedScratch)
    } catch { $receipt.scratchDeleted = $false }
  }
  if ($null -ne $sessionLock) { try { $sessionLock.Dispose() } catch { $exitCode = 1 } }
  if (-not $receipt.childrenClosed -or ($consumed -and (-not $receipt.handoffDeleted -or -not $receipt.leaseDeleted)) -or -not $receipt.scratchDeleted) { $exitCode = 1 }
  $receipt.observedAt = [DateTime]::UtcNow.ToString('o')
  try {
    if($PostcheckContinuation){Write-NewJson $latestFile $receipt}
    else{
      if (Test-Path -LiteralPath $latestFile) { $null = Assert-Path $repo 'scripts/db/out/m03-foundation-dev-migration-latest.json' }
      [IO.File]::WriteAllText($latestFile,($receipt | ConvertTo-Json -Depth 8))
    }
  } catch { $exitCode = 1 }
}
Write-Output ($receipt | ConvertTo-Json -Depth 8 -Compress)
exit $exitCode
