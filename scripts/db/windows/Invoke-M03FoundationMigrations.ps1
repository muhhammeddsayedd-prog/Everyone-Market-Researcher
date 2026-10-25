[CmdletBinding()]
param([switch]$CheckOnly,[switch]$InspectOnly,[switch]$WriterClose,[switch]$ArchiveFixture,[switch]$TechnicalResidual13,[switch]$TechnicalResidual16,[switch]$TechnicalResidual19,[switch]$ForwardMigration,[switch]$ForwardWindow,[switch]$PhaseAControl,[long]$OriginalDeadlineAtMs=0,[switch]$ClockAmendment,[switch]$PostcheckContinuation,[switch]$RemainingContinuation,[switch]$StartupReplacement,[switch]$ProjectVerifiedContinuation)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if($TechnicalResidual19 -and (-not $InspectOnly -or $TechnicalResidual13 -or $TechnicalResidual16 -or $ArchiveFixture -or $ForwardMigration -or $ForwardWindow -or $WriterClose -or $PhaseAControl -or $OriginalDeadlineAtMs -ne 0 -or $ClockAmendment -or $PostcheckContinuation -or $RemainingContinuation -or $StartupReplacement -or $ProjectVerifiedContinuation)){Write-Output 'M03_FOUNDATION PREFLIGHT_BLOCKED. Conflicting read-only19 mode; no private access.';exit 1}
if($TechnicalResidual16 -and ($TechnicalResidual13 -or -not ($ArchiveFixture -xor $InspectOnly) -or $ForwardMigration -or $ForwardWindow -or $WriterClose -or $PhaseAControl -or $OriginalDeadlineAtMs -ne 0 -or $ClockAmendment -or $PostcheckContinuation -or $RemainingContinuation -or $StartupReplacement -or $ProjectVerifiedContinuation)){Write-Output 'M03_FOUNDATION PREFLIGHT_BLOCKED. Conflicting residual read/archive modes; no private access.';exit 1}
if($TechnicalResidual13 -and (-not ($ArchiveFixture -xor $InspectOnly) -or $ForwardMigration -or $ForwardWindow -or $WriterClose -or $PhaseAControl -or $OriginalDeadlineAtMs -ne 0 -or $ClockAmendment -or $PostcheckContinuation -or $RemainingContinuation -or $StartupReplacement -or $ProjectVerifiedContinuation)){Write-Output 'M03_FOUNDATION PREFLIGHT_BLOCKED. Conflicting residual read/archive modes; no private access.';exit 1}
# Validate the caller's modes before sharing only the reviewed no-push path.
if(($ForwardWindow -and (-not $PhaseAControl -or -not $ProjectVerifiedContinuation -or $ForwardMigration -or $InspectOnly -or $WriterClose -or $ArchiveFixture -or $OriginalDeadlineAtMs -ne 0 -or $ClockAmendment -or $RemainingContinuation -or $StartupReplacement)) -or ($ForwardMigration -and ($ArchiveFixture -or $WriterClose -or $InspectOnly -or $PhaseAControl -or $OriginalDeadlineAtMs -ne 0 -or $ClockAmendment -or $PostcheckContinuation -or $RemainingContinuation -or $StartupReplacement -or $ProjectVerifiedContinuation)) -or ($ArchiveFixture -and ($WriterClose -or $InspectOnly -or $PhaseAControl -or $OriginalDeadlineAtMs -ne 0 -or $ClockAmendment -or $PostcheckContinuation -or $RemainingContinuation -or $StartupReplacement -or $ProjectVerifiedContinuation)) -or ($WriterClose -and ($InspectOnly -or $PhaseAControl -or $OriginalDeadlineAtMs -ne 0 -or $ClockAmendment -or $PostcheckContinuation -or $RemainingContinuation -or $StartupReplacement -or $ProjectVerifiedContinuation)) -or ($InspectOnly -and ($PhaseAControl -or $OriginalDeadlineAtMs -ne 0 -or $ClockAmendment -or $PostcheckContinuation -or $RemainingContinuation -or $StartupReplacement -or $ProjectVerifiedContinuation)) -or @($ClockAmendment,$PostcheckContinuation,$RemainingContinuation,$StartupReplacement,$ProjectVerifiedContinuation|Where-Object{$_}).Count -gt 1 -or
   (($RemainingContinuation -or $StartupReplacement -or $ProjectVerifiedContinuation) -and (-not $PhaseAControl -or $OriginalDeadlineAtMs -ne 0))){Write-Output 'M03_FOUNDATION PREFLIGHT_BLOCKED. Conflicting continuation modes; no private access.';exit 1}
if($RemainingContinuation -or $StartupReplacement -or $ProjectVerifiedContinuation){$PostcheckContinuation=$true}
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
$requiredFiles+=@('scripts/n8n/foundation-live-startup-replacement.mjs','scripts/assert/m03_smoke_reactivate_startup.sql',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-startup-replacement-checkpoint-20261022.json',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-startup-replacement-packet-20261022.md')
$requiredFiles+=@('scripts/n8n/foundation-live-project-verified-continuation.mjs','scripts/assert/m03_smoke_reactivate_project_verified.sql',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-project-verified-checkpoint-20261022.json',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-project-verified-packet-20261022.md')
$requiredFiles+=@('scripts/db/foundation-inspect.sql','scripts/n8n/windows/Dev-CredentialStore.ps1')
$requiredFiles+=@('milestones/M03-n8n-foundation/evidence/dev-acceptance-technical8-reconciliation-20261024.json',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical9-reconciliation-20261024.json',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical10-reconciliation-20261024.json',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical11-reconciliation-20261024.json',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical12-reconciliation-20261024.json',
  'milestones/M03-n8n-foundation/evidence/machine-metadata-readback-20261024.json',
  'milestones/M03-n8n-foundation/evidence/remaining-allocation-after-runtime-metadata-20261024.md',
  'milestones/M03-n8n-foundation/evidence/remaining-allocation-after-runtime-metadata-approval-20261024.json',
  'milestones/M03-n8n-foundation/evidence/remaining-control-management-allocation-20261024.md',
  'milestones/M03-n8n-foundation/evidence/remaining-control-management-allocation-approval-20261024.json',
  'milestones/M03-n8n-foundation/evidence/remaining-management-after-catalog-20261024.md',
  'milestones/M03-n8n-foundation/evidence/remaining-management-after-catalog-approval-20261024.json')
$forwardSchema=[bool]($ForwardMigration -or $ForwardWindow -or $TechnicalResidual13 -or $TechnicalResidual16 -or $TechnicalResidual19)
$requiredFiles+=@('milestones/M03-n8n-foundation/evidence/dev-acceptance-technical13-reconciliation-20261024.json','milestones/M03-n8n-foundation/evidence/runtime-restoration-20261024.json')
$requiredFiles+=@('milestones/M03-n8n-foundation/evidence/runtime-restoration-fixture-archive-20261024.json','milestones/M03-n8n-foundation/evidence/runtime-restoration-cleanup-20261024.json')
$requiredFiles+=@('milestones/M03-n8n-foundation/evidence/dev-acceptance-technical14-reconciliation-20261024.json','milestones/M03-n8n-foundation/evidence/dev-acceptance-technical14-cleanup-20261024.json')
$requiredFiles+=@('milestones/M03-n8n-foundation/evidence/dev-acceptance-technical15-reconciliation-20261024.json','milestones/M03-n8n-foundation/evidence/dev-acceptance-technical15-cleanup-20261024.json')
$requiredFiles+=@('milestones/M03-n8n-foundation/evidence/wf00-unadmitted-manual-checkpoint-20261024.json','milestones/M03-n8n-foundation/evidence/wf00-unadmitted-db-readback-20261024.json','milestones/M03-n8n-foundation/evidence/wf00-unadmitted-api-readback-20261024.json','milestones/M03-n8n-foundation/evidence/wf00-unadmitted-cleanup-20261024.json')
$requiredFiles+=@('milestones/M03-n8n-foundation/evidence/dev-acceptance-technical16-reconciliation-20261024.json','milestones/M03-n8n-foundation/evidence/dev-acceptance-technical16-cleanup-20261024.json')
$requiredFiles+=@('milestones/M03-n8n-foundation/evidence/technical16-native-settlement-20261024.json')
$requiredFiles+=@('milestones/M03-n8n-foundation/evidence/technical16-fixture-archive-preflight-failure-20261024.json')
$requiredFiles+=@('milestones/M03-n8n-foundation/evidence/technical16-fixture-archive-20261024.json')
if($forwardSchema){$requiredFiles+=@('scripts/db/foundation-forward-postcheck.sql','scripts/db/m03-foundation-dev-migration-packet.json')}
$versions = @('20261017172928','20261017172931','20261017172934','20261017172937','20261017172940','20261017172943','20261017172945','20261018034220','20261018035417','20261018070042','20261018231756','20261018232014','20261018232922','20261018233338')
$names = @('extensions_schemas_roles','core_tables','auth_rls_views','rpc_pipeline_core','rpc_app_search','storage_cron','seed_taxonomies','rpc_n8n_foundation','price_book_plan','n8n_worker_gateway_admission','m03_actor_launch_admission','m03_foundation_gateway','m03_foundation_safety_receipts','m03_foundation_boundary_hardening')
if($forwardSchema){$versions+=@('20261023163755');$names+=@('m03_foundation_window_continuation')}
$queryTimeoutMs = 30000
$pushTimeoutMs = 180000
$runId = [Guid]::NewGuid().ToString()
$scratch = $null
$password = $null
$secret = $null
$bstr = [IntPtr]::Zero
$consumed = $false
$sessionLock = $null
$inspectParentLock=$null;$inspectParentPath=$null;$inspectQueryFile=$null;$inspectMaterialized=$false
$writerInspectFile=$null;$writerCloseFile=$null;$writerPrior=$null
$archiveFile=$null;$archivePrior=$null;$forwardPrior=$null;$forwardCheckFile=$null;$forwardFamilyFile=$null
$leaseExpires = $null
$phaseAStart = $null
$originalPhaseAStart = $null
$clockAmendmentStart = $null
$clockAmendmentSegment = $null
$postcheckContinuationStart = $null
$script:projectVerifiedTechnicalOrdinal = 1
$postcheckContinuationSegment = 'a570212a-634c-444f-90a2-578ae47e8d27'
$continuationOutputStem='m03-foundation-postcheck-continuation-'
if($RemainingContinuation){$postcheckContinuationSegment='e8035391-dba8-48c9-97e0-139ba980d86e';$continuationOutputStem='m03-foundation-remaining-continuation-'}
if($StartupReplacement){$postcheckContinuationSegment='1c69c89e-7807-46d5-b7b8-ca28285ff2b4';$continuationOutputStem='m03-foundation-startup-replacement-'}
if($ProjectVerifiedContinuation){$postcheckContinuationSegment='20275b22-b7fe-4737-a9a4-c50c2feadb74';$continuationOutputStem='m03-foundation-project-verified-continuation-'}
$phaseAControlHardDeadline = $null
$exitCode = 1
$receipt = [ordered]@{version=1;runId=$runId;environment='dev';projectRef=$projectRef;host=$poolerHost;port=5432;
  status='preflight_blocked';authenticationAttempted=$false;authenticationVerified=$false;historyBefore='not_checked';historyAfter='not_checked';
  dryRunMatched=$false;dryRunCheck='not_attempted';dryRunNativeExit=$null;pushAttempted=$false;pushNativeExit=$null;childrenClosed=$true;handoffDeleted=$false;leaseDeleted=$false;scratchDeleted=$true;
  pendingVersions=@('20261018231756','20261018232014','20261018232922','20261018233338');phaseAControl=$false;phaseACommands=0;phaseAClosed=$false;observedAt=$null}
if($PostcheckContinuation){$receipt.pendingVersions=@();$receipt['postcheckContinuation']=$true}
if($RemainingContinuation){$receipt['remainingContinuation']=$true}
if($StartupReplacement){$receipt['startupReplacement']=$true}
if($ProjectVerifiedContinuation){$receipt['projectVerifiedContinuation']=$true}
if($InspectOnly){$receipt.pendingVersions=@();$receipt['inspectOnly']=$true}
if($WriterClose){$receipt.pendingVersions=@();$receipt['writerClose']=$true;$receipt['administratorLoaded']=$false;$receipt['writerCloseAttempted']=$false;$receipt['writerCloseAcknowledged']=$false;$receipt['writerCloseNativeExit']=$null;$receipt['writerRpcClosed']=$false;$receipt['persistentWriterPreserved']=$true}
if($ArchiveFixture){$receipt.pendingVersions=@();$receipt['archiveFixture']=$true;$receipt['archiveAttempted']=$false;$receipt['archiveAcknowledged']=$false;$receipt['archiveNativeExit']=$null;$receipt['fixtureArchived']=$false;$receipt['persistentAdminPreserved']=$true;$receipt['preparationStage']='SESSION_LOCK'}
if($TechnicalResidual13){$receipt['technicalResidual13']=$true;$receipt['activeWindowId']='3c46c791-e140-4eb9-890a-eecfa251f65e'}
if($TechnicalResidual16){$receipt['technicalResidual16']=$true;$receipt['activeWindowId']='4c602549-2c42-4ec3-9328-714d7cb66a77'}
if($TechnicalResidual19){$receipt['technicalResidual19']=$true;$receipt['activeWindowId']='edbc6d11-7c1f-43a7-b745-1ded06deb29f';$receipt['persistentAdminPreserved']=$true}

if($ForwardWindow){$receipt['forwardWindow']=$true;$receipt['activeWindowId']='38b3708d-61b0-41d2-8170-5ed91c66b4dc'}
if($ForwardMigration){$receipt.pendingVersions=@('20261023163755');$receipt['forwardMigration']=$true;$receipt['persistentAdminPreserved']=$true}

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
function Assert-FoundationHistoricalIdentityAbsent($ProcessId,$TrustedObservedBound) {
  # Call only after the caller has validated its immutable PID links, history
  # and closure/cleanup evidence. This proves absence of that OLD identity;
  # it never proves remote settlement or authorizes a current active process.
  # closedAt is a closure bound. A pinned once.at instead
  # bounds when the old identity already existed, NOT when it was closed.
  if(($ProcessId -isnot [int] -and $ProcessId -isnot [long]) -or $ProcessId -le 0 -or $ProcessId -gt [int]::MaxValue){throw 'blocked'}
  $now=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds();$bound=0L
  if($TrustedObservedBound -is [int] -or $TrustedObservedBound -is [long]){$bound=[long]$TrustedObservedBound}
  elseif($TrustedObservedBound -is [string] -and $TrustedObservedBound -cmatch '^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,7})?Z$'){
    [DateTimeOffset]$parsed=[DateTimeOffset]::MinValue
    if(-not [DateTimeOffset]::TryParse($TrustedObservedBound,[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::None,[ref]$parsed)){throw 'blocked'}
    $bound=$parsed.ToUnixTimeMilliseconds()
  }else{throw 'blocked'}
  if($bound -le 0 -or $bound -gt $now){throw 'blocked'}
  $filter='ProcessId = '+$ProcessId
  $prior=$null
  foreach($read in 1..2){
    # Deliberately exclude command lines, executable paths and environments.
    $rows=@(Get-CimInstance -ClassName Win32_Process -Filter $filter -Property ProcessId,ParentProcessId,CreationDate -ErrorAction Stop)
    if($rows.Count -gt 1){throw 'blocked'}
    $snapshot=@{}
    foreach($row in $rows){
      foreach($key in @('ProcessId','ParentProcessId')){if(($row.$key -isnot [int] -and $row.$key -isnot [long] -and $row.$key -isnot [uint32]) -or $row.$key -lt 0 -or $row.$key -gt [int]::MaxValue){throw 'blocked'}}
      if($row.ProcessId -ne $ProcessId -or $row.CreationDate -isnot [DateTime] -or $row.CreationDate.Kind -eq [DateTimeKind]::Unspecified){throw 'blocked'}
      $born=([DateTimeOffset]$row.CreationDate.ToUniversalTime()).ToUnixTimeMilliseconds()
      if($born -le $bound -or $born -gt [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() -or $snapshot.ContainsKey([string]$row.ProcessId)){throw 'blocked'}
      $snapshot[[string]$row.ProcessId]=[pscustomobject]@{parent=[long]$row.ParentProcessId;ticks=$row.CreationDate.ToUniversalTime().Ticks}
    }
    if($null -ne $prior){
      if($prior.Count -ne $snapshot.Count){throw 'blocked'}
      foreach($key in $prior.Keys){if(-not $snapshot.ContainsKey($key) -or $prior[$key].parent -ne $snapshot[$key].parent -or $prior[$key].ticks -ne $snapshot[$key].ticks){throw 'blocked'}}
    }
    $prior=$snapshot
  }
  return $true
}
function Assert-FoundationInspectClosed {
  if([bool](Get-Variable -Name TechnicalResidual19 -ValueOnly -ErrorAction SilentlyContinue)){return Read-FoundationTechnical19Closed}
  if([bool](Get-Variable -Name TechnicalResidual16 -ValueOnly -ErrorAction SilentlyContinue)){return Read-FoundationTechnical16Closed}
  if($TechnicalResidual13){return Read-FoundationTechnical13Closed}
  # This mode reconciles remote residuals, so physical closure is required but
  # closureVerified/phaseAClosed/archive are deliberately not assumed true.
  $stem='scripts/n8n/out/foundation/live/project-verified-continuation-20275b22-b7fe-4737-a9a4-c50c2feadb74.technical-2'
  $admissionPath=Assert-Path $repo ($stem+'.json')
  $admission=Read-Json $admissionPath
  $claim=Read-Json (Assert-Path $repo ($stem+'.runtime-claim.json'))
  $closed=Read-Json (Assert-Path $repo ($stem+'.closed.json'))
  Assert-Keys $admission @('kind','version','segmentId','sourceCommitSha','windowId','approvalSha256','startsAt','deadlineAt','stopNewAt','hardDeadlineAt','parentProcessId')
  Assert-Keys $claim @('kind','version','segmentId','admissionSha256','processId','parentProcessId','claimedAt')
  Assert-Keys $closed @('kind','version','admissionSha256','parentProcessId','runtimeProcessId','closedAt','childClosed','credentialChildrenClosed','emergencyShutdown','pendingMachinePreserved','nativeExit','bypassHandoffDeleted','closureVerified')
  if($admission.kind -cne 'm03_project_verified_continuation_admission' -or $admission.version -ne 1 -or $admission.segmentId -cne '20275b22-b7fe-4737-a9a4-c50c2feadb74' -or
     $admission.sourceCommitSha -cne 'f42930f90c2de43c84f61ad6d966d0ee6074d70e' -or $admission.windowId -cne 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9' -or
     $claim.kind -cne 'm03_project_verified_continuation_runtime_claim' -or $claim.version -ne 1 -or $claim.segmentId -cne $admission.segmentId -or $claim.admissionSha256 -cne (File-Hash $admissionPath) -or
     $closed.kind -cne 'm03_project_verified_technical_closed' -or $closed.version -ne 1 -or $closed.admissionSha256 -cne $claim.admissionSha256 -or
     $admission.parentProcessId -isnot [int] -or $admission.parentProcessId -le 0 -or $claim.processId -isnot [int] -or $claim.processId -le 0 -or
     $claim.parentProcessId -ne $admission.parentProcessId -or $closed.parentProcessId -ne $admission.parentProcessId -or $closed.runtimeProcessId -ne $claim.processId -or
     $closed.childClosed -isnot [bool] -or -not $closed.childClosed -or $closed.credentialChildrenClosed -isnot [bool] -or -not $closed.credentialChildrenClosed -or
     $closed.emergencyShutdown -isnot [bool] -or $closed.emergencyShutdown -or $closed.pendingMachinePreserved -isnot [bool] -or -not $closed.pendingMachinePreserved -or $closed.nativeExit -isnot [int]){throw 'blocked'}
  foreach($key in @('startsAt','deadlineAt','stopNewAt','hardDeadlineAt')){if($admission.$key -isnot [long]){throw 'blocked'}}
  if($admission.approvalSha256 -cne '5eb38cbe8740ed9a9f72d2356de3fa2e9ce77c8de3710020a7d3de7a6ebdd610' -or
     $admission.deadlineAt-$admission.startsAt -ne 3600000 -or $admission.stopNewAt-$admission.startsAt -ne 3000000 -or $admission.hardDeadlineAt-$admission.startsAt -ne 4200000 -or
     $claim.claimedAt -isnot [long] -or $closed.closedAt -isnot [long] -or $claim.claimedAt -lt $admission.startsAt -or $closed.closedAt -lt $claim.claimedAt -or $closed.closedAt -gt [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()+1000){throw 'blocked'}
  foreach($name in @('.technical-3.json','.technical-3.runtime-claim.json','.technical-3.closed.json')){
    if(Test-Path -LiteralPath (Join-Path $repo ($stem.Replace('.technical-2','')+$name))){throw 'blocked'}
  }
  $dbStem='scripts/db/out/m03-foundation-project-verified-continuation-20275b22-b7fe-4737-a9a4-c50c2feadb74-technical-2'
  $latest=Read-Json (Assert-Path $repo ($dbStem+'-latest.json'))
  $provision=Read-Json (Assert-Path $repo ($dbStem+'-owner-provision-attempt.json'))
  Assert-Keys $provision @('version','runId','windowId','packet','createdAt')
  Assert-Keys $provision.packet @('audience','commitSha','deploymentId','actorBuild','approvalReference','maxTotalChargeUsd','batchMaxUsd')
  if($latest.runId -cne '52cd6a97-a23a-4061-a694-00c50c700b00' -or $latest.runId -cne $provision.runId -or $latest.environment -cne 'dev' -or $latest.projectRef -cne 'zmotjsbzhzjvpelxvxlf' -or
     $latest.authenticationVerified -ne $true -or $latest.historyBefore -cne 'complete' -or $latest.historyAfter -cne 'complete' -or $latest.pushAttempted -ne $false -or
     $latest.childrenClosed -ne $true -or $latest.handoffDeleted -ne $true -or $latest.leaseDeleted -ne $true -or $latest.scratchDeleted -ne $true -or $latest.technicalAttemptOrdinal -ne 2 -or
     $latest.status -cne 'phase_a_control_failed' -or $latest.reactivationState -cne 'acknowledged_and_verified' -or $latest.phaseAClosed -ne $false -or
     $provision.version -ne 1 -or $provision.windowId -cne $admission.windowId -or $provision.packet.commitSha -cne $admission.sourceCommitSha -or
     $provision.packet.audience -cnotmatch '^https://everyone-market-researcher-[a-z0-9-]+\.vercel\.app$' -or $provision.packet.deploymentId -cnotmatch '^dpl_[A-Za-z0-9_-]{1,100}$' -or
     $provision.packet.actorBuild -cne '0.3.99' -or $provision.packet.approvalReference -cne 'M03-A-D-f42930f-20261021' -or $provision.packet.maxTotalChargeUsd -ne 1 -or $provision.packet.batchMaxUsd -ne 2){throw 'blocked'}
  foreach($processId in @($admission.parentProcessId,$claim.processId)){$null=Assert-FoundationHistoricalIdentityAbsent $processId $closed.closedAt}
  return $provision.packet
}
function Read-FoundationInspection($Result) {
  $residual16=[bool](Get-Variable -Name TechnicalResidual16 -ValueOnly -ErrorAction SilentlyContinue)
  $residual19=[bool](Get-Variable -Name TechnicalResidual19 -ValueOnly -ErrorAction SilentlyContinue)
  if(-not $Result.ok -or -not $Result.closed -or $Result.text -notmatch '^\s*\['){throw 'blocked'}
  $rows=ConvertFrom-Json -InputObject $Result.text -ErrorAction Stop
  if($rows -isnot [Array] -or $rows.Count -ne 1){throw 'blocked'}
  Assert-Keys $rows[0] @('inspection');$value=$rows[0].inspection
  $keys=@('kind','windowId','identity','window','requestCount','reservedRequests','incompleteRequests','activeLeaseCount','approval','launchCount','actorRunCount','scrapeRunCount','costEntryCount','costUsd','collectedItemCount','fixture','audits')
  if($TechnicalResidual13 -or $residual16 -or $residual19){$keys+=@('familyClosed','fixtureAuditCount','technical12Exact','technical13Exact')}
  if($residual16 -or $residual19){$keys+=@('technical16Exact','familyWindowCount','globalAdmittedCount','globalRequestCount','globalLaunchCount')}
  if($residual19){$keys+='technical19Exact'}
  $currentReadOnly=[bool](Get-Variable -Name InspectOnly -ValueOnly -ErrorAction SilentlyContinue) -and $TechnicalResidual13
  if($currentReadOnly){$keys+=@('globalLaunchCount')}
  Assert-Keys $value $keys
  $expectedWindow=if($residual19){'edbc6d11-7c1f-43a7-b745-1ded06deb29f'}elseif($residual16){'4c602549-2c42-4ec3-9328-714d7cb66a77'}elseif($TechnicalResidual13){'3c46c791-e140-4eb9-890a-eecfa251f65e'}else{'df4f29ec-e2dc-4d82-a276-62a4e695e6f9'}
  if($value.kind -cne 'm03_foundation_inspection' -or $value.windowId -cne $expectedWindow -or $value.identity -isnot [bool] -or -not $value.identity){throw 'blocked'}
  if($TechnicalResidual13 -or $residual16 -or $residual19){
    foreach($key in @('familyClosed','technical12Exact','technical13Exact')){if($value.$key -isnot [bool] -or -not $value.$key){throw 'blocked'}}
    if(($value.fixtureAuditCount -isnot [int] -and $value.fixtureAuditCount -isnot [long]) -or $value.fixtureAuditCount -ne $(if($residual19){8}elseif($residual16){7}else{6})){throw 'blocked'}
  }
  if($residual16){
    if($value.technical16Exact -isnot [bool] -or -not $value.technical16Exact){throw 'blocked'}
    foreach($entry in @(@('familyWindowCount',5),@('globalAdmittedCount',9),@('globalRequestCount',4),@('globalLaunchCount',0))){if(($value.($entry[0]) -isnot [int] -and $value.($entry[0]) -isnot [long]) -or $value.($entry[0]) -ne $entry[1]){throw 'blocked'}}
  }
  if($residual19){
    foreach($key in @('technical16Exact','technical19Exact')){if($value.$key -isnot [bool] -or -not $value.$key){throw 'blocked'}}
    foreach($entry in @(@('familyWindowCount',6),@('globalAdmittedCount',11),@('globalRequestCount',5),@('globalLaunchCount',0))){if(($value.($entry[0]) -isnot [int] -and $value.($entry[0]) -isnot [long]) -or $value.($entry[0]) -ne $entry[1]){throw 'blocked'}}
  }
  foreach($key in @('requestCount','reservedRequests','incompleteRequests','activeLeaseCount','launchCount','actorRunCount','scrapeRunCount','costEntryCount','collectedItemCount')){
    if(($value.$key -isnot [int] -and $value.$key -isnot [long]) -or $value.$key -lt 0){throw 'blocked'}
  }
  if($currentReadOnly -and (($value.globalLaunchCount -isnot [int] -and $value.globalLaunchCount -isnot [long]) -or $value.globalLaunchCount -ne 0)){throw 'blocked'}
  if(($value.costUsd -isnot [int] -and $value.costUsd -isnot [long] -and $value.costUsd -isnot [double] -and $value.costUsd -isnot [decimal]) -or $value.costUsd -lt 0 -or $value.costUsd -gt 999999999){throw 'blocked'}
  if($null -ne $value.window){
    Assert-Keys $value.window @('id','audience','commitSha','deploymentId','startsAt','expiresAt','closedAt','admittedCount','closeCount')
    if($value.window.id -cne $value.windowId -or $value.window.audience -cnotmatch '^https://everyone-market-researcher-[a-z0-9-]+\.vercel\.app$' -or $value.window.commitSha -cnotmatch '^[a-f0-9]{40}$' -or $value.window.deploymentId -cnotmatch '^dpl_[A-Za-z0-9_-]{1,100}$'){throw 'blocked'}
    foreach($key in @('admittedCount','closeCount')){if($value.window.$key -isnot [int] -or $value.window.$key -lt 0 -or $value.window.$key -gt 256){throw 'blocked'}}
    foreach($key in @('startsAt','expiresAt','closedAt')){if($null -ne $value.window.$key -and ($value.window.$key -isnot [string] -or $value.window.$key -cnotmatch '^\d{4}-\d\d-\d\d[T ]\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d(?::?\d\d)?)$')){throw 'blocked'}}
  }
  if($null -ne $value.approval){
    Assert-Keys $value.approval @('closed','expiresAt','actorBuild','maxChargeUsd','batchMaxUsd')
    if($value.approval.closed -isnot [bool] -or $value.approval.actorBuild -cne '0.3.99' -or $value.approval.maxChargeUsd -ne 1 -or $value.approval.batchMaxUsd -ne 2 -or $value.approval.expiresAt -isnot [string] -or $value.approval.expiresAt -cnotmatch '^\d{4}-\d\d-\d\d[T ]\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d(?::?\d\d)?)$'){throw 'blocked'}
  }
  if($null -ne $value.fixture){
    Assert-Keys $value.fixture @('competitorId','accountId','competitorArchived','competitorActive','accountPaused','accountActive','itemsCount','locked','progressPresent')
    if($value.fixture.competitorId -cne 'd51a39f6-fe87-4d17-aee9-3070c45693aa' -or $value.fixture.accountId -cne 'bd23314c-591f-4fb7-92fd-b7450634eeb6' -or ($value.fixture.itemsCount -isnot [int] -and $value.fixture.itemsCount -isnot [long]) -or $value.fixture.itemsCount -lt 0){throw 'blocked'}
    foreach($key in @('competitorArchived','competitorActive','accountPaused','accountActive','locked','progressPresent')){if($value.fixture.$key -isnot [bool]){throw 'blocked'}}
  }
  Assert-Keys $value.audits @('creationCount','startupCount','originalCount','technical2Count','technical2Exact')
  foreach($key in @('creationCount','startupCount','originalCount','technical2Count')){if(($value.audits.$key -isnot [int] -and $value.audits.$key -isnot [long]) -or $value.audits.$key -lt 0){throw 'blocked'}}
  if($value.audits.technical2Exact -isnot [bool]){throw 'blocked'}
  return $value
}
function Read-FoundationWriterClosePrior {
  $binding=Assert-FoundationInspectClosed
  $path=Assert-Path $repo 'scripts/db/out/m03-foundation-inspect-12b99879-b66c-4aeb-ac22-93b2c2a6eee5-latest.json'
  if((File-Hash $path) -cne '44b354fed26b910c2ffc9e41ec0cc726e39251175bb15b7d513a63f642b7ff2f'){throw 'blocked'}
  $prior=Read-Json $path
  if($prior.runId -cne '12b99879-b66c-4aeb-ac22-93b2c2a6eee5' -or $prior.status -cne 'inspection_verified' -or $prior.environment -cne 'dev' -or $prior.projectRef -cne 'zmotjsbzhzjvpelxvxlf' -or
     $prior.authenticationVerified -ne $true -or $prior.historyBefore -cne 'complete' -or $prior.historyAfter -cne 'complete' -or $prior.pushAttempted -ne $false -or $prior.bindingMatchesPriorProvision -ne $true -or
     $prior.childrenClosed -ne $true -or $prior.handoffDeleted -ne $true -or $prior.leaseDeleted -ne $true -or $prior.scratchDeleted -ne $true -or $prior.inspectParentLockDeleted -ne $true){throw 'blocked'}
  $value=Read-FoundationInspection ([pscustomobject]@{ok=$true;closed=$true;text=('[{"inspection":'+($prior.inspection|ConvertTo-Json -Depth 12 -Compress)+'}]')})
  foreach($key in @('reservedRequests','incompleteRequests','activeLeaseCount','launchCount','actorRunCount','scrapeRunCount','costEntryCount','costUsd','collectedItemCount')){if($value.$key -ne 0){throw 'blocked'}}
  if($null -eq $value.window -or $value.window.closedAt -ne $null -or $value.window.closeCount -ne 0 -or $value.window.admittedCount -ne 1 -or $value.requestCount -ne 1 -or
     $value.window.audience -cne $binding.audience -or $value.window.commitSha -cne $binding.commitSha -or $value.window.deploymentId -cne $binding.deploymentId -or $null -eq $value.window.startsAt -or $null -eq $value.window.expiresAt -or
     $null -eq $value.approval -or $value.approval.closed -ne $false -or $null -eq $value.fixture -or $value.fixture.competitorActive -ne $true -or $value.fixture.accountActive -ne $true -or $value.fixture.itemsCount -ne 0 -or $value.fixture.locked -ne $false -or $value.fixture.progressPresent -ne $false){throw 'blocked'}
  foreach($key in @('creationCount','startupCount','originalCount','technical2Count')){if($value.audits.$key -ne 1){throw 'blocked'}}
  if($value.audits.technical2Exact -ne $true){throw 'blocked'}
  return $value.window
}
function Read-FoundationWriterControl($Result,$Expected,[bool]$Closed) {
  if(-not $Result.ok -or -not $Result.closed -or $Result.text -notmatch '^\s*\['){throw 'blocked'}
  $rows=ConvertFrom-Json -InputObject $Result.text -ErrorAction Stop
  if($rows -isnot [Array] -or $rows.Count -ne 1){throw 'blocked'}
  Assert-Keys $rows[0] @('writer_receipt');$value=$rows[0].writer_receipt
  Assert-Keys $value @('currentUser','sessionUser','database','control')
  if($value.currentUser -cne 'n8n_writer' -or $value.sessionUser -cne 'n8n_writer' -or $value.database -cne 'postgres'){throw 'blocked'}
  Assert-Keys $value.control @('state','code','result','replayed','operation','window')
  if($value.control.result -ne $null -or $value.control.replayed -isnot [bool] -or $value.control.replayed -or $value.control.operation -cne 'identity.read'){throw 'blocked'}
  $window=$value.control.window
  Assert-Keys $window @('id','startsAt','expiresAt','closed','totalAdmitted','boundAudience','boundCommitSha','boundDeploymentId')
  if($window.id -cne 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9' -or $window.startsAt -cne $Expected.startsAt -or $window.expiresAt -cne $Expected.expiresAt -or
     $window.boundAudience -cne $Expected.audience -or $window.boundCommitSha -cne $Expected.commitSha -or $window.boundDeploymentId -cne $Expected.deploymentId -or
     $window.closed -isnot [bool] -or $window.totalAdmitted -isnot [int]){throw 'blocked'}
  if($Closed){
    if($value.control.state -cne 'closed' -or $value.control.code -cne 'window_closed' -or -not $window.closed -or $window.totalAdmitted -ne $Expected.admittedCount+1){throw 'blocked'}
  }else{
    if($window.totalAdmitted -ne $Expected.admittedCount -or -not (($value.control.state -ceq 'admitted' -and $value.control.code -eq $null -and -not $window.closed) -or ($value.control.state -ceq 'closed' -and $value.control.code -ceq 'window_expired' -and $window.closed))){throw 'blocked'}
  }
  return [ordered]@{currentUser='n8n_writer';sessionUser='n8n_writer';bindingVerified=$true;closed=$window.closed;totalAdmitted=$window.totalAdmitted;state=$value.control.state;code=$value.control.code}
}
function Assert-FoundationArchiveInspection($Value,$Expected,[bool]$Archived) {
  $residual16=[bool](Get-Variable -Name TechnicalResidual16 -ValueOnly -ErrorAction SilentlyContinue)
  $residual19=[bool](Get-Variable -Name TechnicalResidual19 -ValueOnly -ErrorAction SilentlyContinue)
  foreach($key in @('reservedRequests','incompleteRequests','activeLeaseCount','launchCount','actorRunCount','scrapeRunCount','costEntryCount','costUsd','collectedItemCount')){if($Value.$key -ne 0){throw 'blocked'}}
  if($null -eq $Value.window -or $null -eq $Value.window.closedAt -or $Value.window.closeCount -ne 1 -or $Value.window.admittedCount -ne 2 -or $Value.requestCount -ne 1 -or $null -eq $Value.approval -or $Value.approval.closed -ne $true){throw 'blocked'}
  $bindingKeys=if($TechnicalResidual13 -or $residual16 -or $residual19){@('id','audience','commitSha','deploymentId')}else{@('id','audience','commitSha','deploymentId','startsAt','expiresAt','closedAt')}
  foreach($key in $bindingKeys){if($Value.window.$key -cne $Expected.$key){throw 'blocked'}}
  if($TechnicalResidual13 -or $residual16 -or $residual19){
    if($TechnicalResidual13 -and [bool](Get-Variable -Name InspectOnly -ValueOnly -ErrorAction SilentlyContinue) -and ($Value.globalLaunchCount -ne 0 -or -not $Archived)){throw 'blocked'}
    foreach($key in @('startsAt','expiresAt','closedAt')){if($null -eq $Value.window.$key){throw 'blocked'}}
    if([DateTimeOffset]::Parse($Value.window.expiresAt) -le [DateTimeOffset]::Parse($Value.window.startsAt) -or [DateTimeOffset]::Parse($Value.window.closedAt) -lt [DateTimeOffset]::Parse($Value.window.startsAt) -or [DateTimeOffset]::Parse($Value.window.closedAt) -gt [DateTimeOffset]::UtcNow.AddSeconds(5)){throw 'blocked'}
    if(-not $Value.familyClosed -or -not $Value.technical12Exact -or -not $Value.technical13Exact -or $Value.fixtureAuditCount -ne $(if($residual19){8}elseif($residual16){7}else{6})){throw 'blocked'}
    if($residual16 -and (-not $Value.technical16Exact -or $Value.familyWindowCount -ne 5 -or $Value.globalAdmittedCount -ne 9 -or $Value.globalRequestCount -ne 4 -or $Value.globalLaunchCount -ne 0)){throw 'blocked'}
    if($residual19 -and (-not $Archived -or -not $Value.technical16Exact -or -not $Value.technical19Exact -or $Value.familyWindowCount -ne 6 -or $Value.globalAdmittedCount -ne 11 -or $Value.globalRequestCount -ne 5 -or $Value.globalLaunchCount -ne 0)){throw 'blocked'}
  }
  if($null -eq $Value.fixture -or $Value.fixture.itemsCount -ne 0 -or $Value.fixture.locked -ne $false -or $Value.fixture.progressPresent -ne $false -or $Value.fixture.competitorArchived -ne $Archived -or $Value.fixture.accountPaused -ne $Archived -or $Value.fixture.competitorActive -eq $Archived -or $Value.fixture.accountActive -eq $Archived){throw 'blocked'}
  foreach($key in @('creationCount','startupCount','originalCount','technical2Count')){if($Value.audits.$key -ne 1){throw 'blocked'}}
  if($Value.audits.technical2Exact -ne $true){throw 'blocked'}
}
function Read-FoundationTechnical13Closed {
  $relative='milestones/M03-n8n-foundation/evidence/dev-acceptance-technical13-reconciliation-20261024.json'
  $path=Assert-Path $repo $relative
  if((File-Hash $path) -cne '226ed15257e8fb5ac2c81f454631bcf11773f67ce9fdc15d6048184389260983'){throw 'blocked'}
  $actual=Read-Json $path
  foreach($pin in $actual.pins.PSObject.Properties){
    $pinnedPath=Assert-Path $repo $pin.Name
    if($pin.Name -cmatch '^scripts/n8n/out/foundation/live/(management|control|setup|preflight)\.jsonl$'){
      $journalName=$Matches[1];$text=[IO.File]::ReadAllText($pinnedPath)
      if(-not $text.EndsWith("`n") -or $text.Length -gt 2097152){throw 'blocked'}
      $lines=@($text.Substring(0,$text.Length-1) -split "`n");$count=$actual.journalCounts.$journalName
      if($count -isnot [int] -or $count -le 0 -or $lines.Count -lt $count){throw 'blocked'}
      $digest=[Security.Cryptography.SHA256]::Create()
      try{$prefix=[Text.Encoding]::UTF8.GetBytes((($lines[0..($count-1)] -join "`n")+"`n"));$value=([BitConverter]::ToString($digest.ComputeHash($prefix))).Replace('-','').ToLowerInvariant()}finally{$digest.Dispose()}
      if($value -cne $pin.Value){throw 'blocked'}
    }elseif((File-Hash $pinnedPath) -cne $pin.Value){throw 'blocked'}
  }
  if($actual.kind -cne 'm03_technical13_runtime_setup_reconciliation' -or $actual.environment -cne 'dev' -or $actual.projectRef -cne $projectRef -or $actual.attempt.technicalAttempt -ne 13 -or $actual.attempt.windowId -cne '3c46c791-e140-4eb9-890a-eecfa251f65e' -or $actual.attempt.actorStarts -ne 0 -or $actual.attempt.nativeExecutions -ne 0 -or $actual.source.applicationSource -cne '7b1837201ac7925591577a1517d7288936ca3464'){throw 'blocked'}
  $closed=Read-Json (Assert-Path $repo 'scripts/n8n/out/foundation/live/project-verified-continuation-20275b22-b7fe-4737-a9a4-c50c2feadb74.technical-13.closed.json')
  if(-not $closed.childClosed -or -not $closed.credentialChildrenClosed -or $closed.emergencyShutdown -or $closed.nativeExit -ne 1){throw 'blocked'}
  # This separate, public-packet-pinned result must exist before Admin access.
  # The failed attempt's false flags are never rewritten by later restoration.
  $restored=Read-Json (Assert-Path $repo 'milestones/M03-n8n-foundation/evidence/runtime-restoration-20261024.json')
  if($restored.kind -cne 'm03_technical13_runtime_restoration' -or $restored.version -ne 1 -or $restored.environment -cne 'dev' -or $restored.projectRef -cne $projectRef -or $restored.windowId -cne $actual.attempt.windowId -or $restored.sourceCommitSha -cne $actual.source.applicationSource -or $restored.status -cne 'restoration_verified' -or $restored.nativeExit -ne 0 -or $restored.executionCount -ne 0 -or $restored.actorStarts -ne 0){throw 'blocked'}
  foreach($key in @('childClosed','credentialChildrenClosed','baselineRestored','machineRestored','remoteWorkSettled','originalAckUnknown')){if($restored.$key -isnot [bool] -or -not $restored.$key){throw 'blocked'}}
  if($restored.mutationReplayAllowed -isnot [bool] -or $restored.mutationReplayAllowed){throw 'blocked'}
  $provision=Read-Json (Assert-Path $repo 'scripts/db/out/m03-foundation-project-verified-continuation-20275b22-b7fe-4737-a9a4-c50c2feadb74-technical-13-owner-provision-attempt.json')
  if($provision.windowId -cne $actual.attempt.windowId -or $provision.packet.audience -cne 'https://everyone-market-researcher-7fcbxykan-muhammed-abdelrahman.vercel.app' -or $provision.packet.commitSha -cne $actual.source.applicationSource -or $provision.packet.deploymentId -cne 'dpl_4hzfdXHd2F9B2Q89RiK2wVftzg25'){throw 'blocked'}
  foreach($processId in @($closed.parentProcessId,$closed.runtimeProcessId)){$null=Assert-FoundationHistoricalIdentityAbsent $processId $closed.closedAt}
  return [pscustomobject]@{id=$provision.windowId;audience=$provision.packet.audience;commitSha=$provision.packet.commitSha;deploymentId=$provision.packet.deploymentId}
}
function Read-FoundationTechnical16Closed {
  # Actual16 remains a failed acceptance attempt. Physical closure permits a
  # SELECT-only inspection, not adoption of its false settlement/archive flags.
  $relative='milestones/M03-n8n-foundation/evidence/dev-acceptance-technical16-reconciliation-20261024.json'
  $path=Assert-Path $repo $relative
  if((File-Hash $path) -cne 'd6097e43d5e060bdc6a950d9e2cee8edd7718249f845a5e021f8368f401924eb'){throw 'blocked'}
  $actual=Read-Json $path
  if($actual.kind -cne 'm03_technical16_native_reader_reconciliation' -or $actual.version -ne 1 -or $actual.environment -cne 'dev' -or $actual.projectRef -cne $projectRef -or $actual.attempt.technicalAttempt -ne 16 -or $actual.attempt.windowId -cne '4c602549-2c42-4ec3-9328-714d7cb66a77' -or $actual.attempt.nativeExit -ne 1 -or $actual.attempt.actorStarts -ne 0 -or $actual.source.applicationSource -cne '5087d4d93d2f6ffdca0bc0096b365723005446fc'){throw 'blocked'}
  foreach($pin in $actual.pins.PSObject.Properties){
    $pinnedPath=Assert-Path $repo $pin.Name
    if($pin.Name -cmatch '^scripts/n8n/out/foundation/live/(management|control|setup|preflight)\.jsonl$'){
      $journalName=$Matches[1]+'.jsonl';$text=[IO.File]::ReadAllText($pinnedPath);$count=$actual.journalCounts.$journalName
      if(-not $text.EndsWith("`n") -or $text.Length -gt 2097152 -or $count -isnot [int] -or $count -le 0){throw 'blocked'}
      $lines=@($text.Substring(0,$text.Length-1) -split "`n");if($lines.Count -lt $count){throw 'blocked'}
      $digest=[Security.Cryptography.SHA256]::Create()
      try{$prefix=[Text.Encoding]::UTF8.GetBytes((($lines[0..($count-1)] -join "`n")+"`n"));$hash=([BitConverter]::ToString($digest.ComputeHash($prefix))).Replace('-','').ToLowerInvariant()}finally{$digest.Dispose()}
      if($hash -cne $pin.Value){throw 'blocked'}
    }elseif((File-Hash $pinnedPath) -cne $pin.Value){throw 'blocked'}
  }
  $closed=$actual.rawTechnicalClose
  foreach($key in @('childClosed','credentialChildrenClosed')){if($closed.$key -isnot [bool] -or -not $closed.$key){throw 'blocked'}}
  if($closed.nativeExit -ne 1 -or $closed.emergencyShutdown -ne $false -or $actual.rawRestore.baselineRestored -ne $true -or $actual.rawRestore.environmentCleanupVerified -ne $true -or $actual.rawRestore.windowClosed -ne $true -or $actual.rawRestore.fixtureArchived -ne $false -or $actual.rawRestore.remoteWorkSettled -ne $false){throw 'blocked'}
  $cleanupPath=Assert-Path $repo 'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical16-cleanup-20261024.json'
  if((File-Hash $cleanupPath) -cne '49192237b29231f20f67595fdc7522b49926f10c8e278bea3871cf75a9788b57'){throw 'blocked'}
  $cleanup=Read-Json $cleanupPath
  if($cleanup.kind -cne 'm03_technical16_local_cleanup' -or $cleanup.version -ne 1 -or $cleanup.environment -cne 'dev' -or $cleanup.projectRef -cne $projectRef -or $cleanup.technicalAttempt -ne 16 -or $cleanup.nativeExit -ne 0 -or $cleanup.attemptReceiptSha256 -cne (File-Hash $path) -or $cleanup.privateContentsRead -ne $false -or $cleanup.networkRequests -ne 0 -or $cleanup.fixtureArchiveVerified -ne $false -or $cleanup.remoteSettlementVerified -ne $false){throw 'blocked'}
  foreach($key in @('allTenDisposableLeavesAbsent','parentProcessAbsent','runtimeProcessAbsent','parentLockAbsent','runtimeLockAbsent','persistentOriginalsRetained','machineRetained','originalFailedAttemptPreserved')){if($cleanup.$key -isnot [bool] -or -not $cleanup.$key){throw 'blocked'}}
  $stem='scripts/db/out/m03-foundation-project-verified-continuation-20275b22-b7fe-4737-a9a4-c50c2feadb74-technical-16'
  $dbPath=Assert-Path $repo ($stem+'-latest.json');$provisionPath=Assert-Path $repo ($stem+'-owner-provision-attempt.json');$reactivationPath=Assert-Path $repo ($stem+'-reactivation-attempt.json')
  if((File-Hash $dbPath) -cne '518e18fb98f7694ebb8d833a3f116bfcf4c476a45e763797c56bd7426a6c00c1' -or (File-Hash $provisionPath) -cne '6c535f66cb3a7e2ff10493ddec1455c0235d16320b830cdaf990a07fca9ff70f' -or (File-Hash $reactivationPath) -cne '37ced3c64a06da14fa0fb4a52fa5f62a8efcf0e1ebf9d9dce6c1094b40a1bf10'){throw 'blocked'}
  $db=Read-Json $dbPath;$provision=Read-Json $provisionPath
  if($db.runId -cne '3412e032-4833-43c9-9342-19ea25d50275' -or $db.status -cne 'continuation_history_verified' -or $db.historyBefore -cne 'complete' -or $db.historyAfter -cne 'complete' -or $db.pushAttempted -ne $false -or $db.phaseAClosed -ne $true -or $db.reactivationState -cne 'acknowledged_and_verified' -or $provision.runId -cne $db.runId -or $provision.windowId -cne $actual.attempt.windowId -or $provision.packet.audience -cne 'https://everyone-market-researcher-13wnnoywv-muhammed-abdelrahman.vercel.app' -or $provision.packet.commitSha -cne $actual.source.applicationSource -or $provision.packet.deploymentId -cne 'dpl_Hqcn7hxpuEUz6Bbq9tTtmQs5MdYd'){throw 'blocked'}
  foreach($processId in @($actual.attempt.parentProcessId,$actual.attempt.runtimeProcessId)){$null=Assert-FoundationHistoricalIdentityAbsent $processId $closed.closedAt}
  return [pscustomobject]@{id=$provision.windowId;audience=$provision.packet.audience;commitSha=$provision.packet.commitSha;deploymentId=$provision.packet.deploymentId}
}
function Assert-FoundationTechnical16Settled($Expected) {
  # Qualify only the separately reviewed actual result and immutable bytes.
  # The validator below checks evidence; it never performs a network operation.
  $settlementSha256='56b05930af80343cc66d4cb95891f6e59d50c7a3bbe536450e775a9bea6c584d'
  if($settlementSha256 -isnot [string] -or $settlementSha256 -cnotmatch '^[a-f0-9]{64}$'){throw 'blocked'}
  $path=Assert-Path $repo 'milestones/M03-n8n-foundation/evidence/technical16-native-settlement-20261024.json'
  if((File-Hash $path) -cne $settlementSha256){throw 'blocked'}
  $value=Read-Json $path
  Assert-Keys $value @('kind','version','environment','projectRef','technicalAttempt','windowId','sourceCommitSha','originalAttemptSha256','resolutionSha256','outerNativeExit','rawResult','cleanup','pins','usage')
  foreach($key in @('kind','environment','projectRef','windowId','sourceCommitSha','originalAttemptSha256','resolutionSha256')){if($value.$key -isnot [string]){throw 'blocked'}}
  foreach($key in @('version','technicalAttempt','outerNativeExit')){if($value.$key -isnot [int]){throw 'blocked'}}
  if($value.kind -cne 'm03_technical16_native_settlement' -or $value.version -ne 1 -or $value.environment -cne 'dev' -or $value.projectRef -cne $projectRef -or $value.technicalAttempt -ne 16 -or $value.windowId -cne '4c602549-2c42-4ec3-9328-714d7cb66a77' -or $Expected.id -cne $value.windowId -or $Expected.commitSha -cne '5087d4d93d2f6ffdca0bc0096b365723005446fc' -or $value.sourceCommitSha -cne $Expected.commitSha -or $value.outerNativeExit -ne 0 -or $value.originalAttemptSha256 -cne 'd6097e43d5e060bdc6a950d9e2cee8edd7718249f845a5e021f8368f401924eb' -or $value.resolutionSha256 -cne 'e0c919ab2a12aa9306be3d2b3656b7d0c43d97c21ddc6376ffa12bbfbb89d07b'){throw 'blocked'}
  $original='milestones/M03-n8n-foundation/evidence/dev-acceptance-technical16-reconciliation-20261024.json'
  $resolution='milestones/M03-n8n-foundation/evidence/technical16-executed-parameters-resolution-20261024.json'
  $attempt='scripts/n8n/out/foundation/technical16-native-cleanup-attempt7.json'
  $journal='scripts/n8n/out/foundation/technical16-native-cleanup-attempt7.jsonl'
  $result='scripts/n8n/out/foundation/technical16-native-cleanup-attempt7-result.json'
  # Every spent cleanup record and durable artifact remains bound independently;
  # success7 cannot refund failed reads, WF32 or either public diagnostic.
  $priorPins=[ordered]@{
    'milestones/M03-n8n-foundation/evidence/technical16-native-cleanup-attempt1-20261024.json'='4f0697080d9bd1ff728b48d9c159f4cbe6f61ebaa04d19ec295da14c3e297960'
    'scripts/n8n/out/foundation/technical16-native-cleanup-attempt.json'='1e165ea75442200af05e57206c32cd0edc07c248571a1405ae8025e31588e66e'
    'scripts/n8n/out/foundation/technical16-native-cleanup.jsonl'='4fccea19e19a162ca2d7b912c200a0cb1fc857b9ea54d4bdf5b6f97f76dd71d7'
    'scripts/n8n/out/foundation/technical16-native-cleanup-attempt1.provision-seal.json'='9aade5d3ae4c4a0a3aace8da74c38e3b0c9f1da672d7187c7ff1b14aeee9ca1b'
    'scripts/n8n/out/foundation/technical16-native-cleanup-attempt1.runtime-lock'='b5a81828a126cc10a3e2cbba03ceca56e0b9b466436b7025937e20fd115c6b1f'
    'milestones/M03-n8n-foundation/evidence/technical16-native-cleanup-attempt2-20261024.json'='5b2f8e590876f37d89aad2a35151e07489c4601111af09c27b01268f43df0c57'
    'scripts/n8n/out/foundation/technical16-native-cleanup-attempt2.json'='86e74f0c574384e33c28721b345899476d198d49e91501c3f37d8a27f9361639'
    'scripts/n8n/out/foundation/technical16-native-cleanup-attempt2.jsonl'='bac9e865ea04c6f083dc836e2e71e0cd37a58dc542a5f03af7ed06767b66ee17'
    'scripts/n8n/out/foundation/technical16-native-cleanup-attempt2-result.json'='efa7b2812baf34f520eac9bea4337b5197bfc680244acaaabe6fcead8a55c137'
    'scripts/n8n/out/foundation/technical16-native-cleanup-attempt2.provision-seal.json'='45a924660d94d87a5fc9eab45307c550a74288b6556873633c39b571c37b62be'
    'scripts/n8n/out/foundation/technical16-native-cleanup-attempt2.runtime-lock'='b5a81828a126cc10a3e2cbba03ceca56e0b9b466436b7025937e20fd115c6b1f'
    'milestones/M03-n8n-foundation/evidence/technical16-native-cleanup-attempt3-20261024.json'='886da0004471f526d0767c3e60a5c1474bb38f439f022ab3edd162efdeb412ae'
    'scripts/n8n/out/foundation/technical16-native-cleanup-attempt3.json'='6319abe719e5fb40d0e77e83376ef39a625c341e9195f055255b435029016a61'
    'scripts/n8n/out/foundation/technical16-native-cleanup-attempt3.jsonl'='0e6c97a10ee2aca0c1171f09a63dcc4b536a8df58e3061cb804d7fac98ab6f27'
    'scripts/n8n/out/foundation/technical16-native-cleanup-attempt3-result.json'='5609476a03848f524398f3e72ca614d1a5e6390cc8b9e287ac1bc9ff95c972c5'
    'scripts/n8n/out/foundation/technical16-native-cleanup-attempt3.provision-seal.json'='0e7051051f4e605b42da8da40261237f9682f492860d1c05ace19a5b79b90af5'
    'scripts/n8n/out/foundation/technical16-native-cleanup-attempt3.runtime-lock'='b5a81828a126cc10a3e2cbba03ceca56e0b9b466436b7025937e20fd115c6b1f'
    'milestones/M03-n8n-foundation/evidence/technical16-native-cleanup-attempt4-20261024.json'='68fecd32ceda855b5f522bf9448f5fa94c1411dc4bd4950ea6d7a3979602bc72'
    'scripts/n8n/out/foundation/technical16-native-cleanup-attempt4.json'='9c5a07ff9c23ebf14cabf96c245ec8fe4d0eeca4a2b13c2c50e918a90a84b7de'
    'scripts/n8n/out/foundation/technical16-native-cleanup-attempt4.jsonl'='76d3b6b1fa4367e9a2ecfa79eab0fd4f2dbfd26402f8bd224a0945541aa7f62d'
    'scripts/n8n/out/foundation/technical16-native-cleanup-attempt4-result.json'='7c4f4923a985842d4286c603810449c08ec305a7a0c721a689b9e040cd739ebf'
    'scripts/n8n/out/foundation/technical16-native-cleanup-attempt4.provision-seal.json'='41a6afc82524105adb2f522c78abc63a9e6dddcec4898969d11facefe193cab7'
    'scripts/n8n/out/foundation/technical16-native-cleanup-attempt4.runtime-lock'='b5a81828a126cc10a3e2cbba03ceca56e0b9b466436b7025937e20fd115c6b1f'
    'milestones/M03-n8n-foundation/evidence/technical16-wf32-discovery-readback-20261024.json'='9a6463326e06719dc0a4123145df96f49ebcf9f4125be81f727f496f5f635c39'
    'scripts/n8n/out/foundation/wf32-discovery-diagnostic-20261024.jsonl'='54f2981b2d0faaa4b71793de2d5eaa59d22161657a449c4244ad3ceddbdb10f2'
    'scripts/n8n/out/foundation/wf32-discovery-diagnostic-20261024.inventory-seal.json'='985fb551e12a66e106c267a2fd43e4fb8a15194d76f50fd35d828c2474809cc4'
    'scripts/n8n/out/foundation/wf32-discovery-diagnostic-20261024.foundation-seal.json'='12575579756a116397b7e0249e7ed37d99398fe7fd211056ac2007b885b8387e'
    'milestones/M03-n8n-foundation/evidence/technical16-native-cleanup-attempt5-20261024.json'='7aa4ab07f9be3f837a49cbc69dbedc2c19720493740e05157ff852b9161ced55'
    'scripts/n8n/out/foundation/technical16-native-cleanup-attempt5.json'='ab3ad645c29b1d21db2a1df3b9f5b968b8c0c6774a2f79a0eabeabf70ffa36bb'
    'scripts/n8n/out/foundation/technical16-native-cleanup-attempt5.jsonl'='8c3e54a720e0d9488a7e8026c88c95103430d790d9cb5caecd71cbf018a2b970'
    'scripts/n8n/out/foundation/technical16-native-cleanup-attempt5-result.json'='199e4499e30e362a5a72048846e782dd08a25afb444bd43aaf9467ffeb38d02a'
    'scripts/n8n/out/foundation/technical16-native-cleanup-attempt5.provision-seal.json'='968943a6f5de2322a48ab6cbfe514d6a80e750ea0356978448d82b843e50dfc3'
    'scripts/n8n/out/foundation/technical16-native-cleanup-attempt5.runtime-lock'='b5a81828a126cc10a3e2cbba03ceca56e0b9b466436b7025937e20fd115c6b1f'
    'milestones/M03-n8n-foundation/evidence/technical16-native-cleanup-attempt6-20261024.json'='1bf2243210b417b8ea7d2ed360adc3c026796a57271c7488f664acc145673a7d'
    'scripts/n8n/out/foundation/technical16-native-cleanup-attempt6.json'='2a814ff7c93f2734322796b1214c806cdd8580420933de52f44862024fb54927'
    'scripts/n8n/out/foundation/technical16-native-cleanup-attempt6.jsonl'='59a30c4ec18a34c2c49773a61534e4e2149d4bdc73bf8fd45976b06eb7d801e4'
    'scripts/n8n/out/foundation/technical16-native-cleanup-attempt6-result.json'='85982e616aaac3b37654e70e4c562410e44449ed65944a6d93aacae4c369cc19'
    'scripts/n8n/out/foundation/technical16-native-cleanup-attempt6.provision-seal.json'='162ae09e991e6a18b8c6969663e0c9f71d1b7d7661ba7dc10ec1d41f9f8e7d22'
    'scripts/n8n/out/foundation/technical16-native-cleanup-attempt6.runtime-lock'='b5a81828a126cc10a3e2cbba03ceca56e0b9b466436b7025937e20fd115c6b1f'
    'milestones/M03-n8n-foundation/evidence/technical16-public-transport-diagnostics-20261024.json'='6185e8af680ebd245a63b33e5fbd8390bd6804e71a994d9fe30db190016789bc'
    'scripts/n8n/out/foundation/technical16-public-transport-diagnostic-20261024.jsonl'='db7a307dff3cf2b357bdacdba093614f75a7d371f064ae630ca40f384693b797'
    'scripts/n8n/out/foundation/technical16-native-public-transport-diagnostic-20261024.jsonl'='693802c29a5ce12e3ca290e4c80ea3d0d0790394e24eb93e1629c3e9d7100767'
    'scripts/n8n/out/foundation/technical16-native-public-transport-diagnostic-20261024-result.json'='822d47f80da7e71ca512463d69fbf6f358f5d45a21a245cb2f8d00d0fcffd287'
    'scripts/n8n/out/foundation/technical16-public-tls-timing-20261024.json'='d33f411b5cf69f3b95bb96b0178b721946672530f05c3ec10a632b8b0b01dd2b'
  }
  $priorFailed='milestones/M03-n8n-foundation/evidence/technical16-native-cleanup-attempt6-20261024.json'
  $priorOnce='scripts/n8n/out/foundation/technical16-native-cleanup-attempt6.json'
  $priorJournal='scripts/n8n/out/foundation/technical16-native-cleanup-attempt6.jsonl'
  Assert-Keys $value.pins (@($original,$resolution,$attempt,$journal,$result)+@($priorPins.Keys))
  foreach($pin in $value.pins.PSObject.Properties){if($pin.Value -isnot [string] -or $pin.Value -cnotmatch '^[a-f0-9]{64}$' -or (File-Hash (Assert-Path $repo $pin.Name)) -cne $pin.Value){throw 'blocked'}}
  if($value.pins.$original -cne $value.originalAttemptSha256 -or $value.pins.$resolution -cne $value.resolutionSha256){throw 'blocked'}
  foreach($pin in $priorPins.GetEnumerator()){if($value.pins.($pin.Key) -cne $pin.Value){throw 'blocked'}}
  $raw=$value.rawResult
  $innerKeys=@('kind','version','environment','projectRef','windowId','sourceCommitSha','status','requestCount','controlRequestCount','managementAttempts','controlAttempts','combinedAttempts','canonicalWorkflowsVerified','qualifiedSideEffects','recordsDeleted','deleteAcknowledged','absenceVerified','remoteWorkSettled','networkCompletionVerified','originalPublicRecordsUnchanged','nativeAcceptanceProven','originalMaskedFirstFailureRecovered','executionCount','actorStarts','workflowWrites','credentialWrites','migrationOperations','diagnosticStage','diagnosticCode')
  Assert-Keys $raw ($innerKeys+@('nativeExit','childClosed','credentialChildrenClosed','parentLockDeleted','privateRead','persistentManagementRetained'))
  foreach($key in @('kind','environment','projectRef','windowId','sourceCommitSha','status','diagnosticStage','diagnosticCode')){if($raw.$key -isnot [string]){throw 'blocked'}}
  foreach($key in @('version','requestCount','controlRequestCount','managementAttempts','controlAttempts','combinedAttempts','canonicalWorkflowsVerified','recordsDeleted','executionCount','actorStarts','workflowWrites','credentialWrites','migrationOperations','nativeExit')){if($raw.$key -isnot [int]){throw 'blocked'}}
  $n=$raw.requestCount
  if($n -lt 85 -or $n -gt 109 -or $raw.kind -cne 'm03_technical16_native_cleanup' -or $raw.version -ne 1 -or $raw.environment -cne 'dev' -or $raw.projectRef -cne $projectRef -or $raw.windowId -cne $value.windowId -or $raw.sourceCommitSha -cne $value.sourceCommitSha -or $raw.status -cne 'native_cleanup_verified' -or $raw.controlRequestCount -ne $n -or $raw.managementAttempts -ne 878+$n -or $raw.controlAttempts -ne 1009+$n -or $raw.combinedAttempts -ne 1887+2*$n -or $raw.canonicalWorkflowsVerified -ne 25 -or $raw.recordsDeleted -ne 2 -or $raw.nativeExit -ne 0 -or $raw.diagnosticStage -cne 'complete' -or $raw.diagnosticCode -cne 'none'){throw 'blocked'}
  foreach($key in @('executionCount','actorStarts','workflowWrites','credentialWrites','migrationOperations')){if($raw.$key -ne 0){throw 'blocked'}}
  foreach($key in @('qualifiedSideEffects','deleteAcknowledged','absenceVerified','remoteWorkSettled','networkCompletionVerified','originalPublicRecordsUnchanged','childClosed','credentialChildrenClosed','parentLockDeleted','privateRead','persistentManagementRetained')){if($raw.$key -isnot [bool] -or $raw.$key -ne $true){throw 'blocked'}}
  foreach($key in @('nativeAcceptanceProven','originalMaskedFirstFailureRecovered')){if($raw.$key -isnot [bool] -or $raw.$key -ne $false){throw 'blocked'}}
  $inner=Read-Json (Assert-Path $repo $result);Assert-Keys $inner $innerKeys
  foreach($key in $innerKeys){if($inner.$key.GetType() -ne $raw.$key.GetType() -or $inner.$key -cne $raw.$key){throw 'blocked'}}
  Assert-Keys $value.cleanup @('parentAbsent','childAbsent','parentLockAbsent','runtimeLockAbsent','persistentManagementRetained','privateContentsRead','networkRequests')
  foreach($key in @('parentAbsent','childAbsent','parentLockAbsent','runtimeLockAbsent','persistentManagementRetained')){if($value.cleanup.$key -isnot [bool] -or $value.cleanup.$key -ne $true){throw 'blocked'}}
  if($value.cleanup.privateContentsRead -isnot [bool] -or $value.cleanup.privateContentsRead -ne $false -or $value.cleanup.networkRequests -isnot [int] -or $value.cleanup.networkRequests -ne 0){throw 'blocked'}
  Assert-Keys $value.usage @('management','control','combined','vercel','nativeExecutionsReserved','actorStarts','providerReads')
  foreach($key in @('management','control','combined','vercel','nativeExecutionsReserved','actorStarts','providerReads')){if($value.usage.$key -isnot [int]){throw 'blocked'}}
  if($value.usage.management -ne $raw.managementAttempts -or $value.usage.control -ne $raw.controlAttempts -or $value.usage.combined -ne $raw.combinedAttempts -or $value.usage.vercel -ne 184 -or $value.usage.nativeExecutionsReserved -ne 3 -or $value.usage.actorStarts -ne 0 -or $value.usage.providerReads -ne 0){throw 'blocked'}
  $once=Read-Json (Assert-Path $repo $attempt)
  Assert-Keys $once @('kind','version','cleanupAttempt','priorFailedAttemptSha256','priorOnceSha256','priorJournalSha256','resolutionSha256','executionIds','processId','parentProcessId','usage','maximumRequests','maximumControlRequests','at')
  if($once.cleanupAttempt -isnot [int] -or $once.cleanupAttempt -ne 7){throw 'blocked'}
  foreach($key in @('priorFailedAttemptSha256','priorOnceSha256','priorJournalSha256')){if($once.$key -isnot [string]){throw 'blocked'}}
  if($once.priorFailedAttemptSha256 -cne $value.pins.$priorFailed -or $once.priorOnceSha256 -cne $value.pins.$priorOnce -or $once.priorJournalSha256 -cne $value.pins.$priorJournal){throw 'blocked'}
  foreach($key in @('kind','resolutionSha256','at')){if($once.$key -isnot [string]){throw 'blocked'}}
  if($once.executionIds -isnot [Array] -or @($once.executionIds|Where-Object{$_ -isnot [string]}).Count -ne 0){throw 'blocked'}
  if($once.kind -cne 'm03_technical16_cleanup_once' -or $once.version -isnot [int] -or $once.version -ne 1 -or $once.resolutionSha256 -cne $value.resolutionSha256 -or $once.executionIds -isnot [Array] -or ($once.executionIds -join ',') -cne '31131,31130' -or $once.maximumRequests -isnot [int] -or $once.maximumRequests -ne 109 -or $once.maximumControlRequests -isnot [int] -or $once.maximumControlRequests -ne 109){throw 'blocked'}
  foreach($key in @('processId','parentProcessId')){if($once.$key -isnot [int] -or $once.$key -le 0){throw 'blocked'}}
  if($once.usage.management -isnot [int] -or $once.usage.management -ne 878 -or $once.usage.control -isnot [int] -or $once.usage.control -ne 1009 -or $once.usage.combined -isnot [int] -or $once.usage.combined -ne 1887){throw 'blocked'}
  $text=[IO.File]::ReadAllText((Assert-Path $repo $journal))
  if(-not $text.EndsWith("`n") -or $text.Length -gt 1048576){throw 'blocked'}
  $rows=@($text.TrimEnd("`n") -split "`n"|ForEach-Object{ConvertFrom-Json -InputObject $_})
  foreach($row in $rows){if($row.event -isnot [string] -or ($row.event -cne 'technical16_http_intent' -and $null -ne $row.PSObject.Properties['retryOf'])){throw 'blocked'}}
  $header=$rows[0];Assert-Keys $header @('event','version','cleanupAttempt','priorFailedAttemptSha256','priorOnceSha256','priorJournalSha256','resolutionSha256','originalAttemptSha256')
  if($header.cleanupAttempt -isnot [int] -or $header.cleanupAttempt -ne 7){throw 'blocked'}
  foreach($key in @('priorFailedAttemptSha256','priorOnceSha256','priorJournalSha256')){if($header.$key -isnot [string] -or $header.$key -cne $once.$key){throw 'blocked'}}
  if($header.event -cne 'technical16_cleanup_header' -or $header.version -isnot [int] -or $header.version -ne 1 -or $header.resolutionSha256 -cne $value.resolutionSha256 -or $header.originalAttemptSha256 -cne $value.originalAttemptSha256){throw 'blocked'}
  if(@($rows|Where-Object{$_.event -cnotin @('technical16_cleanup_header','technical16_http_intent','native_cleanup_evidence','native_cleanup_intent','native_cleanup_absence_intent','native_cleanup_result')}).Count -ne 0){throw 'blocked'}
  $http=@($rows|Where-Object{$_.event -ceq 'technical16_http_intent'})
  if($http.Count -ne $n -or $rows.Count -ne $n+9 -or @($rows|Where-Object{$_.event -ceq 'technical16_cleanup_header'}).Count -ne 1 -or @($rows|Where-Object{$_.event -ceq 'native_cleanup_evidence'}).Count -ne 2){throw 'blocked'}
  $bindingsPath=Assert-Path $repo 'n8n/foundation/bindings.dev.json'
  if((File-Hash $bindingsPath) -cne '89081f429a25e454dd098365debacc681b2a65d7c3d2b60f372e87be8897a3f3'){throw 'blocked'}
  $bindings=Read-Json $bindingsPath;$knownWorkflowIds=@($bindings.workflowRefs.PSObject.Properties|ForEach-Object{$_.Value.id})
  if($knownWorkflowIds.Count -ne 25 -or @($knownWorkflowIds|Select-Object -Unique).Count -ne 25){throw 'blocked'}
  for($i=0;$i -lt $n;$i++){
    $row=$http[$i];$keys=@('event','ordinal','kind','workflowId','managementAttempts','controlAttempts','at');if($null -ne $row.PSObject.Properties['executionId']){$keys+='executionId'};if($null -ne $row.PSObject.Properties['retryOf']){$keys+='retryOf'};Assert-Keys $row $keys
    foreach($key in @('kind','workflowId','at')){if($row.$key -isnot [string]){throw 'blocked'}}
    foreach($key in @('ordinal','managementAttempts','controlAttempts')){if($row.$key -isnot [int]){throw 'blocked'}}
    if($row.ordinal -ne $i+1 -or $row.managementAttempts -ne 879+$i -or $row.controlAttempts -ne 1010+$i -or $row.kind -cnotin @('workflow','metadata','full','discovery','delete','absence') -or $row.workflowId -isnot [string] -or $row.workflowId -cnotin $knownWorkflowIds){throw 'blocked'}
    if($row.kind -cin @('metadata','full','delete','absence')){if($row.executionId -isnot [string] -or ($row.executionId -ceq '31130' -and $row.workflowId -cne 'MzimjpsuyPuK7SKe') -or ($row.executionId -ceq '31131' -and $row.workflowId -cne '4JMHLDBSdgGxhPlk') -or $row.executionId -cnotin @('31130','31131')){throw 'blocked'}}elseif($null -ne $row.PSObject.Properties['executionId']){throw 'blocked'}
    if($null -ne $row.PSObject.Properties['retryOf']){
      if($i -eq 0 -or $row.retryOf -isnot [int] -or $row.retryOf -ne $i -or $row.kind -cnotin @('workflow','metadata','full','discovery')){throw 'blocked'}
      $previous=$http[$i-1]
      if($null -ne $previous.PSObject.Properties['retryOf'] -or $row.kind -cne $previous.kind -or $row.workflowId -cne $previous.workflowId){throw 'blocked'}
      if(($null -ne $row.PSObject.Properties['executionId']) -ne ($null -ne $previous.PSObject.Properties['executionId'])){throw 'blocked'}
      if($null -ne $row.PSObject.Properties['executionId'] -and $row.executionId -cne $previous.executionId){throw 'blocked'}
    }
  }
  # Retry links qualify only the duplicate GET shape. Every raw attempt remains
  # charged above; only logical operation cardinalities exclude linked retries.
  $logical=@($http|Where-Object{$null -eq $_.PSObject.Properties['retryOf']})
  $canonical=@($logical|Where-Object{$_.kind -ceq 'workflow'});$discovery=@($logical|Where-Object{$_.kind -ceq 'discovery'})
  if($canonical.Count -ne 25 -or @($canonical.workflowId|Select-Object -Unique).Count -ne 25 -or $discovery.Count -lt 50 -or $discovery.Count -gt 100 -or @($http|Where-Object{$_.kind -ceq 'discovery'}).Count -gt 100 -or @($discovery.workflowId|Select-Object -Unique).Count -ne 25 -or @($logical|Where-Object{$_.kind -ceq 'metadata'}).Count -ne 4 -or @($logical|Where-Object{$_.kind -ceq 'full'}).Count -ne 2){throw 'blocked'}
  foreach($kind in @('native_cleanup_intent','native_cleanup_absence_intent','native_cleanup_result')){
    $entries=@($rows|Where-Object{$_.event -ceq $kind});if($entries.Count -ne 2){throw 'blocked'}
    for($i=0;$i -lt 2;$i++){
      $row=$entries[$i];$id=@('31131','31130')[$i];$workflow=@('4JMHLDBSdgGxhPlk','MzimjpsuyPuK7SKe')[$i]
      foreach($key in @('executionId','workflowId','batchId','caseId')){if($row.$key -isnot [string]){throw 'blocked'}}
      if($row.executionId -cne $id -or $row.workflowId -cne $workflow -or $row.batchId -cne 'technical16-postclose-native-cleanup' -or $row.caseId -cne 'dispatch.vimeo-reconciliation'){throw 'blocked'}
      if($kind -ceq 'native_cleanup_result'){
        if($row.state -cne 'native_record_deleted'){throw 'blocked'}
        foreach($key in @('deleteAcknowledged','absenceVerified')){if($row.$key -isnot [bool] -or -not $row.$key){throw 'blocked'}}
        if($row.residual -isnot [bool] -or $row.residual){throw 'blocked'}
      }elseif($row.ordinal -isnot [int] -or $row.ordinal -ne $i+1){throw 'blocked'}
    }
  }
  $writes=@($http|Where-Object{$_.kind -cin @('delete','absence')})
  if($writes.Count -ne 4){throw 'blocked'}
  for($i=0;$i -lt 4;$i++){if($writes[$i].kind -cne @('delete','absence','delete','absence')[$i] -or $writes[$i].executionId -cne @('31131','31131','31130','31130')[$i] -or $writes[$i].workflowId -cne @('4JMHLDBSdgGxhPlk','4JMHLDBSdgGxhPlk','MzimjpsuyPuK7SKe','MzimjpsuyPuK7SKe')[$i]){throw 'blocked'}}
  # The native producer wrote process.pid / process.ppid before once.at.
  # That pinned observation identifies the old processes; it is not a close.
  foreach($key in @('processId','parentProcessId')){$null=Assert-FoundationHistoricalIdentityAbsent $once.$key $once.at}
  return $value
}
function Read-FoundationTechnical19Closed {
  $relative='milestones/M03-n8n-foundation/evidence/dev-acceptance-technical19-restored-20261025.json'
  $path=Assert-Path $repo $relative
  if((File-Hash $path) -cne '567de4bcc54962c57afb88846fd4c8a75dbfa465623aad3578aab51c4eab41dc'){throw 'blocked'}
  $actual=Read-Json $path
  if($actual.kind -cne 'm03_technical19_restored_attempt' -or $actual.version -ne 1 -or $actual.environment -cne 'dev' -or $actual.projectRef -cne 'zmotjsbzhzjvpelxvxlf' -or $actual.attempt.technicalAttempt -ne 19){throw 'blocked'}
  foreach($pin in $actual.pins.PSObject.Properties){
    $pinned=Assert-Path $repo $pin.Name
    if($pin.Name -cmatch '^scripts/n8n/out/foundation/live/(management|control|setup|preflight)\.jsonl$'){
      $prefix=$actual.journalPrefixes.($Matches[1]);$bytes=[IO.File]::ReadAllBytes($pinned)
      if($prefix.bytes -isnot [int] -or $prefix.bytes -le 0 -or $bytes.Length -lt $prefix.bytes -or $bytes.Length -gt 2097152 -or $prefix.sha256 -cne $pin.Value){throw 'blocked'}
      $digest=[Security.Cryptography.SHA256]::Create()
      try{$hash=([BitConverter]::ToString($digest.ComputeHash($bytes,0,$prefix.bytes))).Replace('-','').ToLowerInvariant()}finally{$digest.Dispose()}
      if($hash -cne $pin.Value){throw 'blocked'}
    }elseif((File-Hash $pinned) -cne $pin.Value){throw 'blocked'}
  }
  $closed=$actual.attempt.rawTechnicalClose;$claim=$actual.attempt.rawRuntimeClaim;$admission=$actual.attempt.rawAdmission
  if($closed.childClosed -isnot [bool] -or -not $closed.childClosed -or $closed.credentialChildrenClosed -isnot [bool] -or -not $closed.credentialChildrenClosed -or $closed.closureVerified -isnot [bool] -or -not $closed.closureVerified -or $closed.emergencyShutdown -isnot [bool] -or $closed.emergencyShutdown -or $closed.parentProcessId -ne $admission.parentProcessId -or $closed.runtimeProcessId -ne $claim.processId -or $claim.parentProcessId -ne $admission.parentProcessId -or $actual.database.actualAdminResult.phaseAClosed -ne $true -or $actual.database.actualAdminResult.reactivationState -cne 'acknowledged_and_verified' -or $actual.database.archiveEvidence.coordinatorFixtureArchived -ne $true){throw 'blocked'}
  foreach($processId in @($admission.parentProcessId,$claim.processId)){$null=Assert-FoundationHistoricalIdentityAbsent $processId $closed.closedAt}
  return [pscustomobject]@{id='edbc6d11-7c1f-43a7-b745-1ded06deb29f';audience='https://everyone-market-researcher-punvhefs2-muhammed-abdelrahman.vercel.app';commitSha='effa3de9e1fee6c3f3c08fc347a5e3175db14c80';deploymentId='dpl_8Qy4Ywx8aEZ6j3ueVm3TaAP7LB3Y'}
}
function Read-FoundationTechnical19Database {
  $path=Assert-Path $repo 'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical19-database-readback-20261025.json'
  if((File-Hash $path) -cne 'a44ccc8aaf5366cd3cbe5bb6d76b69c0dd327d74935c40c4a7e28f4b2cf232fd'){throw 'blocked'}
  $record=Read-Json $path
  if($record.kind -cne 'm03_technical19_database_readback' -or $record.version -ne 1 -or $record.environment -cne 'dev' -or $record.projectRef -cne 'zmotjsbzhzjvpelxvxlf' -or $record.nativeExit -ne 0 -or $record.technical19ReceiptSha256 -cne '567de4bcc54962c57afb88846fd4c8a75dbfa465623aad3578aab51c4eab41dc'){throw 'blocked'}
  foreach($pin in $record.pins.PSObject.Properties){if((File-Hash (Assert-Path $repo $pin.Name)) -cne $pin.Value){throw 'blocked'}}
  $native=$record.actualNativeResult
  foreach($key in @('authenticationVerified','childrenClosed','handoffDeleted','leaseDeleted','scratchDeleted','inspectOnly','technicalResidual19','persistentAdminPreserved','bindingMatchesPriorProvision','inspectParentLockDeleted')){if($native.$key -isnot [bool] -or -not $native.$key){throw 'blocked'}}
  if($native.status -cne 'inspection_verified' -or $native.historyBefore -cne 'complete' -or $native.historyAfter -cne 'complete' -or $native.pushAttempted -isnot [bool] -or $native.pushAttempted -or $native.runId -cne '8c90a6f5-63c0-4a06-b260-877fefc9a233'){throw 'blocked'}
  $actual=Read-Json (Assert-Path $repo ('scripts/db/out/m03-foundation-inspect-'+$native.runId+'-latest.json'))
  if((ConvertTo-Json -InputObject $actual -Depth 60 -Compress) -cne (ConvertTo-Json -InputObject $native -Depth 60 -Compress)){throw 'blocked'}
  # The claimed Node proof validates the complete historical19 chain. This
  # native projection additionally pins its independent SELECT-only readback.
  $TechnicalResidual19=$true;$TechnicalResidual16=$false;$TechnicalResidual13=$false
  $result=[pscustomobject]@{ok=$true;closed=$true;text=(ConvertTo-Json -InputObject @([pscustomobject]@{inspection=$native.inspection}) -Depth 60 -Compress)}
  $value=Read-FoundationInspection $result
  $expected=[pscustomobject]@{id='edbc6d11-7c1f-43a7-b745-1ded06deb29f';audience='https://everyone-market-researcher-punvhefs2-muhammed-abdelrahman.vercel.app';commitSha='effa3de9e1fee6c3f3c08fc347a5e3175db14c80';deploymentId='dpl_8Qy4Ywx8aEZ6j3ueVm3TaAP7LB3Y'}
  Assert-FoundationArchiveInspection $value $expected $true
  return $value
}
function Foundation-Technical19FamilyPredicate {
  $prior=Foundation-Technical16FamilyPredicate
  $needle="(window_id='4c602549-2c42-4ec3-9328-714d7cb66a77' and admitted_count=2 and bound_commit_sha='5087d4d93d2f6ffdca0bc0096b365723005446fc')"
  if([regex]::Matches($prior,[regex]::Escape($needle)).Count -ne 1){throw 'blocked'}
  $current="(window_id='edbc6d11-7c1f-43a7-b745-1ded06deb29f' and admitted_count=2 and starts_at is not null and expires_at is not null and bound_commit_sha='effa3de9e1fee6c3f3c08fc347a5e3175db14c80' and bound_deployment_id='dpl_8Qy4Ywx8aEZ6j3ueVm3TaAP7LB3Y' and bound_audience='https://everyone-market-researcher-punvhefs2-muhammed-abdelrahman.vercel.app')"
  return $prior.Replace($needle,$needle+' or '+$current).Replace('count(*)=5','count(*)=6').Replace('sum(admitted_count),0)=9','sum(admitted_count),0)=11').Replace('count(*)=4','count(*)=5')
}
function Foundation-Technical16FamilyPredicate {
  return @'
((select count(*)=5 and bool_and(namespace='m03-foundation-dev' and project_ref='zmotjsbzhzjvpelxvxlf' and environment='dev' and closed_at is not null and close_count=1 and
 ((window_id='df4f29ec-e2dc-4d82-a276-62a4e695e6f9' and admitted_count=2 and bound_commit_sha='f42930f90c2de43c84f61ad6d966d0ee6074d70e') or
  (window_id='38b3708d-61b0-41d2-8170-5ed91c66b4dc' and admitted_count=1 and starts_at is null and bound_commit_sha='a5e746736893d5040e93032ae740a0878f748837') or
  (window_id='eda4fae1-1e19-47db-81b8-beac1a4ed883' and admitted_count=2 and bound_commit_sha='aff94f2b2d8055cf93b5405e6b11d4e7d9c86803') or
  (window_id='3c46c791-e140-4eb9-890a-eecfa251f65e' and admitted_count=2 and bound_commit_sha='7b1837201ac7925591577a1517d7288936ca3464') or
  (window_id='4c602549-2c42-4ec3-9328-714d7cb66a77' and admitted_count=2 and bound_commit_sha='5087d4d93d2f6ffdca0bc0096b365723005446fc'))) from ops.foundation_gateway_rate_windows)
 and (select coalesce(sum(admitted_count),0)=9 from ops.foundation_gateway_rate_windows)
 and (select count(*)=4 and bool_and(state<>'reserved' and completed_at is not null) from ops.foundation_gateway_requests)
 and not exists(select 1 from ops.foundation_gateway_leases where request_id is not null)
 and not exists(select 1 from ops.foundation_gateway_run_bindings)
 and (select count(*)=5 and bool_and(closed_at is not null and actor_build='0.3.99' and max_total_charge_usd=1 and batch_max_usd=2 and approval_reference='M03-A-D-f42930f-20261021') from ops.apify_launch_approvals))
'@
}
function Foundation-Technical13FamilyPredicate {
  return @'
((select count(*)=4 and bool_and(namespace='m03-foundation-dev' and closed_at is not null and close_count=1 and
 ((window_id='df4f29ec-e2dc-4d82-a276-62a4e695e6f9' and admitted_count=2 and bound_commit_sha='f42930f90c2de43c84f61ad6d966d0ee6074d70e') or
  (window_id='38b3708d-61b0-41d2-8170-5ed91c66b4dc' and admitted_count=1 and starts_at is null and bound_commit_sha='a5e746736893d5040e93032ae740a0878f748837') or
  (window_id='eda4fae1-1e19-47db-81b8-beac1a4ed883' and admitted_count=2 and bound_commit_sha='aff94f2b2d8055cf93b5405e6b11d4e7d9c86803') or
  (window_id='3c46c791-e140-4eb9-890a-eecfa251f65e' and admitted_count=2 and bound_commit_sha='7b1837201ac7925591577a1517d7288936ca3464'))) from ops.foundation_gateway_rate_windows)
 and (select coalesce(sum(admitted_count),0)=7 from ops.foundation_gateway_rate_windows)
 and (select count(*)=3 and bool_and(state<>'reserved' and completed_at is not null) from ops.foundation_gateway_requests)
 and not exists(select 1 from ops.foundation_gateway_leases where request_id is not null)
 and (select count(*)=4 and bool_and(closed_at is not null and actor_build='0.3.99' and max_total_charge_usd=1 and batch_max_usd=2 and approval_reference='M03-A-D-f42930f-20261021') from ops.apify_launch_approvals))
'@
}
function Foundation-Technical13AuditPredicate([int]$Ordinal) {
  if($Ordinal -notin @(12,13,16,19)){throw 'blocked'}
  $segment='20275b22-b7fe-4737-a9a4-c50c2feadb74:technical-'+$Ordinal
  return @"
(select count(*)=1 from ops.audit_log l join ops.audit_log o on o.id::text=l.after->>'original_creation_audit_id'
 where l.actor_type='system' and l.actor_id='m03_smoke_reactivate.v1:$segment' and l.action='m03_smoke_fixture_reactivated' and l.entity_type='competitor' and l.entity_id='d51a39f6-fe87-4d17-aee9-3070c45693aa'
 and l.before=jsonb_build_object('competitor_status','archived','account_status','paused')
 and l.after=jsonb_build_object('fixture_version',1,'project_ref','zmotjsbzhzjvpelxvxlf','segment_id','$segment','competitor_id','d51a39f6-fe87-4d17-aee9-3070c45693aa','account_id','bd23314c-591f-4fb7-92fd-b7450634eeb6','competitor_status','active','account_status','active','original_creation_audit_id',o.id)
 and o.actor_type='system' and o.actor_id='m03_smoke_setup.v1' and o.action='m03_smoke_fixture_created' and o.entity_type='competitor' and o.entity_id=l.entity_id)
"@
}
function Foundation-Technical13InspectionSql([bool]$ReadOnlyCurrent=$false,[bool]$Technical16=$false,[bool]$Technical19=$false) {
  if($Technical19 -and ($Technical16 -or $ReadOnlyCurrent)){throw 'blocked'}
  $sql=[IO.File]::ReadAllText((Assert-Path $repo 'scripts/db/foundation-inspect.sql')).Replace('df4f29ec-e2dc-4d82-a276-62a4e695e6f9','3c46c791-e140-4eb9-890a-eecfa251f65e')
  $needle="'audits',jsonb_build_object("
  if([regex]::Matches($sql,[regex]::Escape($needle)).Count -ne 1){throw 'blocked'}
  $extra="'familyClosed',$(Foundation-Technical13FamilyPredicate),`n 'fixtureAuditCount',(select count(*) from ops.audit_log where entity_id in ('d51a39f6-fe87-4d17-aee9-3070c45693aa','bd23314c-591f-4fb7-92fd-b7450634eeb6')),`n 'technical12Exact',$(Foundation-Technical13AuditPredicate 12),`n 'technical13Exact',$(Foundation-Technical13AuditPredicate 13),`n "
  if($ReadOnlyCurrent){$extra="'globalLaunchCount',(select count(*) from ops.apify_launch_admissions),`n "+$extra}
  if($Technical16 -or $Technical19){
    $sql=$sql.Replace('3c46c791-e140-4eb9-890a-eecfa251f65e','4c602549-2c42-4ec3-9328-714d7cb66a77')
    $extra=$extra.Replace((Foundation-Technical13FamilyPredicate),(Foundation-Technical16FamilyPredicate))
    $extra="'technical16Exact',$(Foundation-Technical13AuditPredicate 16),'familyWindowCount',(select count(*) from ops.foundation_gateway_rate_windows),'globalAdmittedCount',(select coalesce(sum(admitted_count),0) from ops.foundation_gateway_rate_windows),'globalRequestCount',(select count(*) from ops.foundation_gateway_requests),'globalLaunchCount',(select count(*) from ops.apify_launch_admissions),`n "+$extra
  }
  if($Technical19){
    $sql=$sql.Replace('4c602549-2c42-4ec3-9328-714d7cb66a77','edbc6d11-7c1f-43a7-b745-1ded06deb29f')
    $extra=$extra.Replace((Foundation-Technical16FamilyPredicate),(Foundation-Technical19FamilyPredicate))
    $extra="'technical19Exact',$(Foundation-Technical13AuditPredicate 19),`n "+$extra
  }
  return $sql.Replace($needle,$extra+$needle)
}
function Foundation-Technical13ArchiveSql($Expected,[bool]$Technical16=$false) {
  $body=Foundation-FixtureSql 'm03_smoke_teardown.sql'
  $update="update app.competitors set status='archived' where id=v_comp.id and status<>'archived';"
  if([regex]::Matches($body,[regex]::Escape($update)).Count -ne 1){throw 'blocked'}
  $audience=Foundation-Literal $Expected.audience;$sha=Foundation-Literal $Expected.commitSha;$deployment=Foundation-Literal $Expected.deploymentId
  $guard=@"
lock table ops.audit_log in share mode;
  if v_comp.id is distinct from 'd51a39f6-fe87-4d17-aee9-3070c45693aa'::uuid or v_account.id is distinct from 'bd23314c-591f-4fb7-92fd-b7450634eeb6'::uuid
    or v_comp.status<>'active' or v_account.status<>'active' or v_account.locked_until is not null or v_account.last_run_id is not null or v_account.last_success_at is not null or v_account.items_count<>0
    or not $(Foundation-Technical13FamilyPredicate)
    or not exists(select 1 from ops.foundation_gateway_rate_windows where window_id='3c46c791-e140-4eb9-890a-eecfa251f65e' and bound_audience=$audience and bound_commit_sha=$sha and bound_deployment_id=$deployment and closed_at is not null and close_count=1 and admitted_count=2)
    or exists(select 1 from ops.apify_launch_admissions) or exists(select 1 from ops.apify_runs) or exists(select 1 from ops.scrape_runs) or exists(select 1 from ops.cost_ledger) or exists(select 1 from app.items)
    or (select count(*) from ops.audit_log where entity_id in ('d51a39f6-fe87-4d17-aee9-3070c45693aa','bd23314c-591f-4fb7-92fd-b7450634eeb6'))<>6
    or not $(Foundation-Technical13AuditPredicate 12) or not $(Foundation-Technical13AuditPredicate 13) then
    raise exception using errcode='55000',message='M03_ARCHIVE_OWNERSHIP_OR_QUIESCENCE_CHANGED';
  end if;

"@
  if($Technical16){
    $guard=$guard.Replace((Foundation-Technical13FamilyPredicate),(Foundation-Technical16FamilyPredicate)).Replace("window_id='3c46c791-e140-4eb9-890a-eecfa251f65e' and bound_audience=", "window_id='4c602549-2c42-4ec3-9328-714d7cb66a77' and bound_audience=").Replace('))<>6', '))<>7').Replace(" or not $(Foundation-Technical13AuditPredicate 13) then", " or not $(Foundation-Technical13AuditPredicate 13) or not $(Foundation-Technical13AuditPredicate 16) then")
    $guard=$guard.Replace('lock table ops.audit_log in share mode;', 'lock table ops.audit_log,ops.foundation_gateway_rate_windows,ops.foundation_gateway_requests,ops.foundation_gateway_leases,ops.foundation_gateway_run_bindings,ops.apify_launch_approvals,ops.apify_launch_admissions,ops.apify_runs,ops.scrape_runs,ops.cost_ledger,app.items in share mode;')
  }
  return $body.Replace($update,$guard+$update)
}
function Read-FoundationArchivePrior {
  if([bool](Get-Variable -Name TechnicalResidual16 -ValueOnly -ErrorAction SilentlyContinue)){$expected=Read-FoundationTechnical16Closed;$null=Assert-FoundationTechnical16Settled $expected;return $expected}
  if($TechnicalResidual13){return Read-FoundationTechnical13Closed}
  $binding=Assert-FoundationInspectClosed
  $writerPath=Assert-Path $repo 'scripts/db/out/m03-foundation-writer-close-df4f29ec-e2dc-4d82-a276-62a4e695e6f9-latest.json'
  $inspectPath=Assert-Path $repo 'scripts/db/out/m03-foundation-inspect-82f55b86-3bc8-42bd-95b4-82039af7b9fc-latest.json'
  if((File-Hash $writerPath) -cne '78e718069962421d1b88f1b2d794a7b691ec7ab1efb0ad6940e4e45e472d4c6e' -or (File-Hash $inspectPath) -cne '3e8972d1e27ac0d829b506878753c305202c5acc0cc5ffff23965586c3108437'){throw 'blocked'}
  $writer=Read-Json $writerPath;$prior=Read-Json $inspectPath
  if($writer.runId -cne '5a23a5b9-88f1-44bb-8a21-79d07d068885' -or $writer.status -cne 'writer_close_verified' -or $writer.authenticationVerified -ne $true -or $writer.administratorLoaded -ne $false -or $writer.writerRpcClosed -ne $true -or $writer.childrenClosed -ne $true -or $writer.scratchDeleted -ne $true -or $writer.persistentWriterPreserved -ne $true -or $writer.inspectParentLockDeleted -ne $true -or
     $prior.runId -cne '82f55b86-3bc8-42bd-95b4-82039af7b9fc' -or $prior.status -cne 'inspection_verified' -or $prior.projectRef -cne 'zmotjsbzhzjvpelxvxlf' -or $prior.environment -cne 'dev' -or $prior.authenticationVerified -ne $true -or $prior.historyBefore -cne 'complete' -or $prior.historyAfter -cne 'complete' -or $prior.pushAttempted -ne $false -or $prior.bindingMatchesPriorProvision -ne $true -or $prior.childrenClosed -ne $true -or $prior.handoffDeleted -ne $true -or $prior.leaseDeleted -ne $true -or $prior.scratchDeleted -ne $true -or $prior.inspectParentLockDeleted -ne $true){throw 'blocked'}
  $value=Read-FoundationInspection ([pscustomobject]@{ok=$true;closed=$true;text=('[{"inspection":'+($prior.inspection|ConvertTo-Json -Depth 12 -Compress)+'}]')})
  if($value.window.audience -cne $binding.audience -or $value.window.commitSha -cne $binding.commitSha -or $value.window.deploymentId -cne $binding.deploymentId){throw 'blocked'}
  Assert-FoundationArchiveInspection $value $value.window $false
  return $value.window
}
function Assert-FoundationArchivePreflightContinuation([bool]$RequireLocks=$false) {
  if(-not $ArchiveFixture -or -not [bool](Get-Variable -Name TechnicalResidual16 -ValueOnly -ErrorAction SilentlyContinue)){throw 'blocked'}
  $failureHash='635736c1bff404046d3805e356a6640bf8e5e2148434404a29bc85bc0095901d'
  $base='scripts/db/out/m03-foundation-archive-4c602549-2c42-4ec3-9328-714d7cb66a77'
  $copy=Assert-Path $repo 'milestones/M03-n8n-foundation/evidence/technical16-fixture-archive-preflight-failure-20261024.json'
  $old=Assert-Path $repo ($base+'-latest.json')
  foreach($path in @($copy,$old)){
    $entry=Get-Item -LiteralPath $path -Force
    if($entry.PSIsContainer -or $entry.Length -gt 65536 -or ($null -ne $entry.PSObject.Properties['LinkType'] -and $entry.LinkType -ceq 'HardLink') -or (File-Hash $path) -cne $failureHash){throw 'blocked'}
  }
  $failed=Read-Json $copy
  if($failed.version -isnot [int] -or $failed.version -ne 1 -or $failed.runId -cne '698498b3-bdbe-448a-b991-3a9eaee17197' -or $failed.environment -cne 'dev' -or $failed.projectRef -cne 'zmotjsbzhzjvpelxvxlf' -or $failed.host -cne 'aws-1-eu-central-1.pooler.supabase.com' -or $failed.port -isnot [int] -or $failed.port -ne 5432 -or $failed.status -cne 'public_preflight_failed' -or $failed.historyBefore -cne 'not_checked' -or $failed.historyAfter -cne 'not_checked' -or $failed.activeWindowId -cne '4c602549-2c42-4ec3-9328-714d7cb66a77'){throw 'blocked'}
  foreach($key in @('authenticationAttempted','authenticationVerified','pushAttempted','archiveAttempted','archiveAcknowledged','fixtureArchived','phaseAControl','phaseAClosed')){if($failed.$key -isnot [bool] -or $failed.$key){throw 'blocked'}}
  foreach($key in @('childrenClosed','scratchDeleted','persistentAdminPreserved','archiveFixture','technicalResidual16','inspectParentLockDeleted')){if($failed.$key -isnot [bool] -or -not $failed.$key){throw 'blocked'}}
  if($failed.phaseACommands -isnot [int] -or $failed.phaseACommands -ne 0 -or $failed.pendingVersions -isnot [Array] -or $failed.pendingVersions.Count -ne 0 -or $null -ne $failed.archiveNativeExit -or $null -ne $failed.pushNativeExit){throw 'blocked'}
  $next=$base+'-after-preflight-698498b3'
  foreach($relative in @(($base+'-attempt.json'),($next+'-attempt.json'),($next+'-latest.json'))){if(Test-Path -LiteralPath (Join-Path $repo $relative)){throw 'blocked'}}
  $oldScratch=Join-Path ([IO.Path]::GetTempPath()) 'emr-m03-foundation-dev-migrations-698498b3-bdbe-448a-b991-3a9eaee17197'
  if((Test-Path -LiteralPath $oldScratch) -or @(Get-CimInstance -ClassName Win32_Process -Filter 'ProcessId = 22664 OR ParentProcessId = 22664' -Property ProcessId,ParentProcessId -ErrorAction Stop).Count -ne 0){throw 'blocked'}
  if($RequireLocks){
    $sessionPath=[IO.Path]::GetFullPath((Join-Path $repo 'scripts/db/out/m03-foundation-dev-migration-session.lock'))
    $parentPath=[IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'Temp/emr-m03-acceptance-parent.operation.lock'))
    foreach($pair in @(@($sessionLock,$sessionPath),@($inspectParentLock,$parentPath))){
      if($pair[0] -isnot [IO.FileStream] -or -not $pair[0].CanRead -or -not $pair[0].CanWrite -or $pair[0].SafeFileHandle.IsClosed -or -not $pair[0].Name.Equals($pair[1],[StringComparison]::OrdinalIgnoreCase)){throw 'blocked'}
    }
    $position=$inspectParentLock.Position;$buffer=$null
    try{
      $length=$inspectParentLock.Length;if($length -le 0 -or $length -gt 4096){throw 'blocked'}
      $inspectParentLock.Position=0;$buffer=New-Object byte[] ([int]$length);$read=0
      while($read -lt $length){$count=$inspectParentLock.Read($buffer,$read,([int]$length-$read));if($count -le 0){throw 'blocked'};$read+=$count}
      $parent=ConvertFrom-Json -InputObject ([Text.UTF8Encoding]::new($false,$true).GetString($buffer))
      Assert-Keys $parent @('kind','version','processId')
      if($parent.kind -cne 'm03_archive_parent' -or $parent.version -isnot [int] -or $parent.version -ne 1 -or $parent.processId -isnot [int] -or $parent.processId -ne $PID){throw 'blocked'}
    }finally{$inspectParentLock.Position=$position;if($null -ne $buffer){[Array]::Clear($buffer,0,$buffer.Length)}}
    $self='scripts/db/windows/Invoke-M03FoundationMigrations.ps1'
    if($packet.files.$self -isnot [string] -or (File-Hash (Assert-Path $repo $self)) -cne $packet.files.$self){throw 'blocked'}
  }
  return [pscustomobject]@{attemptFile=(Join-Path $repo ($next+'-attempt.json'));latestFile=(Join-Path $repo ($next+'-latest.json'))}
}
function Read-FoundationTechnical14NoAdmin([int]$Ordinal=14) {
  # Preserve the original14 entry point. Only the separately pinned15 failure
  # can extend this fixed no-Admin chain; no arbitrary ordinal/path is accepted.
  if($Ordinal -notin @(14,15)){throw 'blocked'}
  if($Ordinal -eq 15){$null=Read-FoundationTechnical14NoAdmin}
  $expected=if($Ordinal -eq 15){'59bed1a8b06484542ceefc6d010cce25f7b3014b8821589f9240aa5e88af5bbd'}else{'6df34613f0155ae7e7f6517cf4604d9e6e85b7b63fe2159591d1ee32580c3960'}
  $cleanupExpected=if($Ordinal -eq 15){'21d4d3c897b67189999ae502906dac4cfeb33e187011a8958913bb6fba705b29'}else{'aabddbc205c3582ba51beb16ca734c35378cf6caa79c288184aaa13c08c4406c'}
  $control=if($Ordinal -eq 15){843}else{842};$combined=524+$control
  $path=Assert-Path $repo ('milestones/M03-n8n-foundation/evidence/dev-acceptance-technical'+$Ordinal+'-reconciliation-20261024.json')
  if((File-Hash $path) -cne $expected){throw 'blocked'}
  $value=Read-Json $path
  if($value.kind -cne ('m03_technical'+$Ordinal+'_browser_discovery_reconciliation') -or $value.version -ne 1 -or $value.environment -cne 'dev' -or $value.projectRef -cne 'zmotjsbzhzjvpelxvxlf' -or $value.source.applicationSource -cne '5087d4d93d2f6ffdca0bc0096b365723005446fc' -or
     $value.attempt.technicalAttempt -ne $Ordinal -or $value.attempt.segmentId -cne '20275b22-b7fe-4737-a9a4-c50c2feadb74' -or $value.attempt.windowId -cne '4c602549-2c42-4ec3-9328-714d7cb66a77' -or $value.attempt.nativeExit -ne 1 -or
     $value.attempt.newManagementRequests -ne 0 -or $value.attempt.newControlRequests -ne 1 -or $value.attempt.baselineDefinitionGets -ne 0 -or $value.attempt.executionDiscoveryGets -ne 0 -or $value.attempt.nativeExecutions -ne 0 -or $value.attempt.actorStarts -ne 0){throw 'blocked'}
  foreach($key in @('adminChildStarted','databaseAuthenticationAttempted','sqlWindowProvisionAttempted','fixtureReactivationAttempted','previewAttempted','workflowWriteAttempted','migrationOperationAttempted')){if($value.attempt.$key -isnot [bool] -or $value.attempt.$key){throw 'blocked'}}
  if($value.usage.management -ne 524 -or $value.usage.control -ne $control -or $value.usage.combined -ne $combined -or $value.usage.vercel -ne 149 -or $value.usage.managementMaximum -ne 1024 -or $value.usage.controlMaximum -ne 2048 -or $value.usage.combinedMaximum -ne 2560 -or $value.usage.vercelMaximum -ne 224 -or $value.usage.allowancesReplenished -ne $false){throw 'blocked'}
  foreach($pin in $value.pins.PSObject.Properties){
    $pinned=Assert-Path $repo $pin.Name
    if($pin.Name -cmatch '^scripts/n8n/out/foundation/live/(management|control|setup|preflight)\.jsonl$'){
      $name=$Matches[1];$text=[IO.File]::ReadAllText($pinned);$count=$value.journalCounts.$name
      if(-not $text.EndsWith("`n") -or $text.Length -gt 2097152 -or $count -isnot [int] -or $count -le 0){throw 'blocked'}
      $lines=@($text.Substring(0,$text.Length-1) -split "`n");if($lines.Count -lt $count){throw 'blocked'}
      $digest=[Security.Cryptography.SHA256]::Create()
      try{$prefix=[Text.Encoding]::UTF8.GetBytes((($lines[0..($count-1)] -join "`n")+"`n"));$hash=([BitConverter]::ToString($digest.ComputeHash($prefix))).Replace('-','').ToLowerInvariant()}finally{$digest.Dispose()}
      if($hash -cne $pin.Value){throw 'blocked'}
    }elseif((File-Hash $pinned) -cne $pin.Value){throw 'blocked'}
  }
  $closed=Read-Json (Assert-Path $repo ('scripts/n8n/out/foundation/live/project-verified-continuation-20275b22-b7fe-4737-a9a4-c50c2feadb74.technical-'+$Ordinal+'.closed.json'))
  if($closed.nativeExit -ne 1 -or $closed.childClosed -ne $true -or $closed.credentialChildrenClosed -ne $true -or $closed.emergencyShutdown -ne $false -or $closed.closureVerified -ne $false -or $closed.parentProcessId -ne $value.attempt.parentProcessId -or $closed.runtimeProcessId -ne $value.attempt.runtimeProcessId){throw 'blocked'}
  $stem='scripts/db/out/m03-foundation-project-verified-continuation-20275b22-b7fe-4737-a9a4-c50c2feadb74-technical-'+$Ordinal
  $absent=@(($stem+'-attempt.json'),($stem+'-latest.json'),($stem+'-owner-provision-attempt.json'),($stem+'-reactivation-attempt.json'),('scripts/n8n/out/foundation/live/runtime.technical-'+$Ordinal+'.jsonl'))
  if($value.absentOutputs -isnot [Array] -or $value.absentOutputs.Count -ne $absent.Count){throw 'blocked'}
  for($index=0;$index -lt $absent.Count;$index++){if($value.absentOutputs[$index] -cne $absent[$index] -or (Test-Path -LiteralPath (Join-Path $repo $absent[$index]))){throw 'blocked'}}
  $cleanupPath=Assert-Path $repo ('milestones/M03-n8n-foundation/evidence/dev-acceptance-technical'+$Ordinal+'-cleanup-20261024.json')
  if((File-Hash $cleanupPath) -cne $cleanupExpected){throw 'blocked'}
  $cleanup=Read-Json $cleanupPath
  if($cleanup.kind -cne ('m03_technical'+$Ordinal+'_local_cleanup') -or $cleanup.version -ne 1 -or $cleanup.environment -cne 'dev' -or $cleanup.projectRef -cne 'zmotjsbzhzjvpelxvxlf' -or $cleanup.technicalAttempt -ne $Ordinal -or $cleanup.nativeExit -ne 0 -or $cleanup.attemptReceiptSha256 -cne $expected -or $cleanup.privateContentsRead -ne $false -or $cleanup.networkRequests -ne 0 -or $cleanup.managementAttempts -ne 524 -or $cleanup.controlAttempts -ne $control -or $cleanup.combinedAttempts -ne $combined -or $cleanup.vercelAttempts -ne 149 -or $cleanup.actorStarts -ne 0){throw 'blocked'}
  foreach($key in @('allTenDisposableLeavesAbsent','parentProcessAbsent','runtimeProcessAbsent','parentLockAbsent','runtimeLockAbsent','persistentOriginalsRetained','machineRetained','originalFailedAttemptPreserved')){if($cleanup.$key -isnot [bool] -or -not $cleanup.$key){throw 'blocked'}}
  foreach($processId in @($closed.parentProcessId,$closed.runtimeProcessId)){$null=Assert-FoundationHistoricalIdentityAbsent $processId $closed.closedAt}
  return $expected
}
function Foundation-ArchiveFixtureSql($Expected) {
  if([bool](Get-Variable -Name TechnicalResidual16 -ValueOnly -ErrorAction SilentlyContinue)){return Foundation-Technical13ArchiveSql $Expected -Technical16 $true}
  if($TechnicalResidual13){return Foundation-Technical13ArchiveSql $Expected}
  $body=Foundation-FixtureSql 'm03_smoke_teardown.sql'
  $update="update app.competitors set status='archived' where id=v_comp.id and status<>'archived';"
  if([regex]::Matches($body,[regex]::Escape($update)).Count -ne 1){throw 'blocked'}
  $audience=Foundation-Literal $Expected.audience;$sha=Foundation-Literal $Expected.commitSha;$deployment=Foundation-Literal $Expected.deploymentId;$closedAt=Foundation-Literal $Expected.closedAt
  $guard=@"
lock table ops.audit_log in share mode;
  if v_comp.id is distinct from 'd51a39f6-fe87-4d17-aee9-3070c45693aa'::uuid or v_account.id is distinct from 'bd23314c-591f-4fb7-92fd-b7450634eeb6'::uuid
    or v_comp.status<>'active' or v_account.status<>'active' or v_account.locked_until is not null or v_account.last_run_id is not null or v_account.last_success_at is not null or v_account.items_count<>0
    or not exists(select 1 from ops.foundation_gateway_rate_windows w join ops.apify_launch_approvals a using(window_id)
      where w.window_id='df4f29ec-e2dc-4d82-a276-62a4e695e6f9' and w.bound_audience=$audience and w.bound_commit_sha=$sha and w.bound_deployment_id=$deployment
        and w.closed_at=${closedAt}::timestamptz and w.close_count=1 and w.admitted_count=2 and a.closed_at is not null and a.actor_build='0.3.99' and a.max_total_charge_usd=1 and a.batch_max_usd=2)
    or (select count(*) from ops.foundation_gateway_requests where window_id='df4f29ec-e2dc-4d82-a276-62a4e695e6f9')<>1
    or exists(select 1 from ops.foundation_gateway_requests where window_id='df4f29ec-e2dc-4d82-a276-62a4e695e6f9' and (state='reserved' or completed_at is null))
    or exists(select 1 from ops.foundation_gateway_leases where window_id='df4f29ec-e2dc-4d82-a276-62a4e695e6f9' and request_id is not null)
    or exists(select 1 from ops.apify_launch_admissions) or exists(select 1 from ops.apify_runs) or exists(select 1 from ops.scrape_runs) or exists(select 1 from ops.cost_ledger) or exists(select 1 from app.items)
    or (select count(*) from ops.audit_log where entity_id in ('d51a39f6-fe87-4d17-aee9-3070c45693aa','bd23314c-591f-4fb7-92fd-b7450634eeb6'))<>4
    or (select count(*) from ops.audit_log l where l.actor_type='system' and l.actor_id='m03_smoke_reactivate.v1:20275b22-b7fe-4737-a9a4-c50c2feadb74:technical-2'
      and l.action='m03_smoke_fixture_reactivated' and l.entity_type='competitor' and l.entity_id=v_comp.id::text
      and l.before=jsonb_build_object('competitor_status','archived','account_status','paused')
      and l.after=jsonb_build_object('fixture_version',1,'project_ref','zmotjsbzhzjvpelxvxlf','segment_id','20275b22-b7fe-4737-a9a4-c50c2feadb74:technical-2',
        'competitor_id',v_comp.id,'account_id',v_account.id,'competitor_status','active','account_status','active','original_creation_audit_id',v_marker.id))<>1 then
    raise exception using errcode='55000',message='M03_ARCHIVE_OWNERSHIP_OR_QUIESCENCE_CHANGED';
  end if;

"@
  return $body.Replace($update,$guard+$update)
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
  $startupMode=[bool](Get-Variable -Name StartupReplacement -ValueOnly -ErrorAction SilentlyContinue)
  $projectMode=[bool](Get-Variable -Name ProjectVerifiedContinuation -ValueOnly -ErrorAction SilentlyContinue)
  $forwardMode=[bool](Get-Variable -Name ForwardWindow -ValueOnly -ErrorAction SilentlyContinue)
  $expectedSource=if($forwardMode){'a5e746736893d5040e93032ae740a0878f748837'}else{'f42930f90c2de43c84f61ad6d966d0ee6074d70e'}
  $expectedWindow=if($forwardMode){'38b3708d-61b0-41d2-8170-5ed91c66b4dc'}else{'df4f29ec-e2dc-4d82-a276-62a4e695e6f9'}
  $mode=if($CheckOnly){'CheckOnly'}else{'ReadClaimed'}
  $module=Assert-Path $repo $(if($projectMode){'scripts/n8n/foundation-live-project-verified-continuation.mjs'}elseif($startupMode){'scripts/n8n/foundation-live-startup-replacement.mjs'}elseif($remainingMode){'scripts/n8n/foundation-live-remaining-continuation.mjs'}else{'scripts/n8n/foundation-live-postcheck-continuation.mjs'})
  $script:publicPreflightStage='CLAIMED_PROCESS_GATE'
  $answer=Invoke-Bounded $node @($module,$mode) $repo 10000
  try{
    if(-not $answer.ok -or -not $answer.closed){throw 'blocked'}
    $script:publicPreflightStage='CLAIMED_DTO'
    $value=ConvertFrom-Json -InputObject $answer.text -ErrorAction Stop
    $approvalKind=if($projectMode){'project_verified_continuation_approval_required'}elseif($startupMode){'startup_replacement_approval_required'}else{'remaining_continuation_approval_required'}
    $freshMode=$forwardMode -and $projectMode -and $value.windowId -ceq 'eda4fae1-1e19-47db-81b8-beac1a4ed883'
    $nextMode=$forwardMode -and $projectMode -and $value.windowId -ceq '3c46c791-e140-4eb9-890a-eecfa251f65e'
    $restoredMode=$forwardMode -and $projectMode -and $value.windowId -ceq '4c602549-2c42-4ec3-9328-714d7cb66a77'
    $settledMode=$forwardMode -and $projectMode -and $value.windowId -ceq 'edbc6d11-7c1f-43a7-b745-1ded06deb29f'
    $successorMode=$forwardMode -and $projectMode -and $value.windowId -ceq 'e2be1a67-f6db-4c90-bfd2-671c5db9b90a'
    if($freshMode){$expectedSource='aff94f2b2d8055cf93b5405e6b11d4e7d9c86803';$expectedWindow='eda4fae1-1e19-47db-81b8-beac1a4ed883'}
    if($nextMode){$expectedSource='7b1837201ac7925591577a1517d7288936ca3464';$expectedWindow='3c46c791-e140-4eb9-890a-eecfa251f65e'}
    if($restoredMode){$expectedSource='5087d4d93d2f6ffdca0bc0096b365723005446fc';$expectedWindow='4c602549-2c42-4ec3-9328-714d7cb66a77'}
    if($settledMode){$expectedSource='effa3de9e1fee6c3f3c08fc347a5e3175db14c80';$expectedWindow='edbc6d11-7c1f-43a7-b745-1ded06deb29f'}
    if($successorMode){$expectedSource='5f256ce915f930481b0d31ac38b919c0a7692cd1';$expectedWindow='e2be1a67-f6db-4c90-bfd2-671c5db9b90a'}
    if($CheckOnly -and ($remainingMode -or $startupMode -or $projectMode) -and $value.kind -ceq $approvalKind){
      Assert-Keys $value @('kind','status','approvalRequired','segmentId','sourceCommitSha','windowId','privateRead','networkRequests')
      if($value.status -cne 'approval_required' -or $value.approvalRequired -isnot [bool] -or $value.approvalRequired -ne $true -or $value.privateRead -isnot [bool] -or $value.privateRead -ne $false -or $value.networkRequests -isnot [int] -or $value.networkRequests -ne 0 -or $value.segmentId -cne $postcheckContinuationSegment -or $value.sourceCommitSha -cne $expectedSource -or $value.windowId -cne $expectedWindow){throw 'blocked'}
      if($projectMode){Write-Output 'M03_FOUNDATION APPROVAL_REQUIRED. New project-verified continuation has no owner time authority; no credential metadata, private contents or authentication read.'}elseif($startupMode){Write-Output 'M03_FOUNDATION APPROVAL_REQUIRED. New startup replacement has no owner time authority; no credential metadata, private contents or authentication read.'}else{Write-Output 'M03_FOUNDATION APPROVAL_REQUIRED. New remaining segment has no owner time authority; no credential metadata, private contents or authentication read.'};exit 3
    }
    $keys=@('kind','segmentId','sourceCommitSha','windowId','privateRead','networkRequests')
    $managementFields=@('managementMaximum','managementAttempts','controlAttempts','combinedAttempts')
    $managementPresent=@($managementFields|Where-Object{$_ -cin $value.PSObject.Properties.Name})
    if($CheckOnly -and ($freshMode -or $nextMode -or $restoredMode -or $settledMode -or $successorMode) -and $managementPresent.Count -ne 4){throw 'blocked'}
    if($managementPresent.Count -gt 0){
      if(-not $CheckOnly -or -not $projectMode -or -not $forwardMode -or $managementPresent.Count -ne 4){throw 'blocked'}
      # Exact known read-only reconciliation, never a replenished allowance.
      $managementExpected=if($restoredMode -and $value.controlAttempts -eq 846){@{managementMaximum=1024;managementAttempts=527;controlAttempts=846;combinedAttempts=1373}}elseif($restoredMode -and $value.controlAttempts -eq 843){@{managementMaximum=1024;managementAttempts=524;controlAttempts=843;combinedAttempts=1367}}elseif($restoredMode -and $value.controlAttempts -eq 842){@{managementMaximum=1024;managementAttempts=524;controlAttempts=842;combinedAttempts=1366}}elseif($restoredMode){@{managementMaximum=1024;managementAttempts=524;controlAttempts=841;combinedAttempts=1365}}elseif($nextMode){@{managementMaximum=832;managementAttempts=401;controlAttempts=740;combinedAttempts=1141}}elseif($freshMode -and $value.managementAttempts -eq 313){@{managementMaximum=704;managementAttempts=313;controlAttempts=639;combinedAttempts=952}}elseif($freshMode -and $value.managementAttempts -eq 288){@{managementMaximum=704;managementAttempts=288;controlAttempts=588;combinedAttempts=876}}elseif($freshMode -and $value.managementAttempts -eq 263){@{managementMaximum=640;managementAttempts=263;controlAttempts=537;combinedAttempts=800}}elseif($freshMode){@{managementMaximum=640;managementAttempts=237;controlAttempts=486;combinedAttempts=723}}elseif($value.managementAttempts -eq 177){@{managementMaximum=576;managementAttempts=177;controlAttempts=435;combinedAttempts=612}}else{@{managementMaximum=576;managementAttempts=152;controlAttempts=384;combinedAttempts=536}}
      if($settledMode){
        # The exact independently pinned settlement supplies N; caller numbers
        # never select a new charge or capacity profile.
        $settledUsage=(Assert-FoundationTechnical16Settled (Read-FoundationTechnical16Closed)).usage
        if($value.managementMaximum -eq 1408 -and $value.managementAttempts -eq 1023 -and $value.controlAttempts -eq 1145 -and $value.combinedAttempts -eq 2168){
          $null=Read-FoundationTechnical18NoReactivation
          $settledUsage=(Read-Json (Assert-Path $repo 'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical18-preparation-reconciliation-20261025.json')).usage
        }
        $managementExpected=@{managementMaximum=1408;managementAttempts=$settledUsage.management;controlAttempts=$settledUsage.control;combinedAttempts=$settledUsage.combined}
      }
      if($successorMode){
        $null=Read-FoundationTechnical19Database
        $retainedUsage=(Read-Json (Assert-Path $repo 'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical19-restored-20261025.json')).usage
        $managementExpected=@{managementMaximum=1728;managementAttempts=$retainedUsage.management;controlAttempts=$retainedUsage.control;combinedAttempts=$retainedUsage.combined}
      }
      foreach($field in $managementExpected.Keys){if(($value.$field -isnot [int] -and $value.$field -isnot [long]) -or $value.$field -ne $managementExpected[$field]){throw 'blocked'}}
      if($restoredMode -and $value.controlAttempts -eq 842){$null=Read-FoundationTechnical14NoAdmin}
      if($restoredMode -and $value.controlAttempts -in @(843,846)){$null=Read-FoundationTechnical14NoAdmin -Ordinal 15}
      $keys+=$managementFields
    }
    if(-not $CheckOnly){$keys+=@('startsAt','deadlineAt','stopNewAt','hardDeadlineAt')}
    Assert-Keys $value $keys
    $expected=if($projectMode){if($CheckOnly){'project_verified_continuation_ready'}else{'clock_project_verified_continuation_admitted'}}elseif($startupMode){if($CheckOnly){'startup_replacement_ready'}else{'clock_startup_replacement_admitted'}}elseif($remainingMode){if($CheckOnly){'remaining_continuation_ready'}else{'clock_remaining_continuation_admitted'}}elseif($CheckOnly){'postcheck_continuation_ready'}else{'clock_postcheck_continuation_admitted'}
    if($value.kind -cne $expected -or $value.segmentId -cne $postcheckContinuationSegment -or
       $value.sourceCommitSha -cne $expectedSource -or $value.windowId -cne $expectedWindow -or
       $value.privateRead -isnot [bool] -or $value.privateRead -or $value.networkRequests -isnot [int] -or $value.networkRequests -ne 0){throw 'blocked'}
    if($forwardMode){$script:projectVerifiedForwardWindowId=$expectedWindow;$script:projectVerifiedForwardSource=$expectedSource}
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

function Assert-FoundationStartupReplacementProcessAncestry($Clock) {
  if(-not $StartupReplacement -or $CheckOnly -or $Clock.segmentId -cne '1c69c89e-7807-46d5-b7b8-ca28285ff2b4' -or
     [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() -ge $Clock.stopNewAt){throw 'blocked'}
  $stem='scripts/n8n/out/foundation/live/startup-replacement-1c69c89e-7807-46d5-b7b8-ca28285ff2b4'
  $admissionPath=Assert-Path $repo ($stem+'.json');$claimPath=Assert-Path $repo ($stem+'.runtime-claim.json')
  $admission=Read-Json $admissionPath;$claim=Read-Json $claimPath
  Assert-Keys $claim @('kind','version','segmentId','admissionSha256','processId','parentProcessId','claimedAt')
  if($claim.kind -cne 'm03_startup_replacement_runtime_claim' -or $claim.version -ne 1 -or $claim.segmentId -cne $Clock.segmentId -or
     $claim.admissionSha256 -cne (File-Hash $admissionPath) -or $claim.processId -le 0 -or $claim.parentProcessId -le 0 -or
     $claim.claimedAt -isnot [long] -or $claim.claimedAt -lt $Clock.startsAt -or $claim.claimedAt -gt [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() -or
     $admission.kind -cne 'm03_startup_replacement_admission' -or $admission.segmentId -cne $Clock.segmentId -or $admission.startsAt -ne $Clock.startsAt -or $admission.parentProcessId -ne $claim.parentProcessId){throw 'blocked'}
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

function Resolve-FoundationProjectVerifiedTechnicalPaths {
  $base='scripts/n8n/out/foundation/live/project-verified-continuation-20275b22-b7fe-4737-a9a4-c50c2feadb74'
  $stem=$base;$selectedOrdinal=1
  for($ordinal=2;$ordinal -le 1024;$ordinal++){
    $next=$base+'.technical-'+$ordinal
    if(-not (Test-Path -LiteralPath (Join-Path $repo ($next+'.json')))){
      if((Test-Path -LiteralPath (Join-Path $repo ($next+'.runtime-claim.json'))) -or (Test-Path -LiteralPath (Join-Path $repo ($next+'.closed.json')))){throw 'blocked'}
      return [pscustomobject]@{admission=(Assert-Path $repo ($stem+'.json'));claim=(Assert-Path $repo ($stem+'.runtime-claim.json'));technicalOrdinal=$selectedOrdinal}
    }
    $stem=$next;$selectedOrdinal=$ordinal
  }
  throw 'blocked'
}
function Assert-FoundationProjectVerifiedContinuationProcessAncestry($Clock) {
  if(-not $ProjectVerifiedContinuation -or $CheckOnly -or $Clock.segmentId -cne '20275b22-b7fe-4737-a9a4-c50c2feadb74' -or
     [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() -ge $Clock.stopNewAt){throw 'blocked'}
  # The existing JS ReadClaimed gate verified the immutable technical chain.
  # Select that same active sibling; never alter an earlier admission or claim.
  $paths=Resolve-FoundationProjectVerifiedTechnicalPaths
  $admissionPath=$paths.admission;$claimPath=$paths.claim
  $admission=Read-Json $admissionPath;$claim=Read-Json $claimPath
  Assert-Keys $claim @('kind','version','segmentId','admissionSha256','processId','parentProcessId','claimedAt')
  if($claim.kind -cne 'm03_project_verified_continuation_runtime_claim' -or $claim.version -ne 1 -or $claim.segmentId -cne $Clock.segmentId -or
     $claim.admissionSha256 -cne (File-Hash $admissionPath) -or $claim.processId -le 0 -or $claim.parentProcessId -le 0 -or
     $claim.claimedAt -isnot [long] -or $claim.claimedAt -lt $Clock.startsAt -or $claim.claimedAt -gt [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() -or
     $admission.kind -cne 'm03_project_verified_continuation_admission' -or $admission.segmentId -cne $Clock.segmentId -or $admission.startsAt -ne $Clock.startsAt -or $admission.parentProcessId -ne $claim.parentProcessId -or
     ([bool](Get-Variable -Name ForwardWindow -ValueOnly -ErrorAction SilentlyContinue) -and ($admission.sourceCommitSha -cne $Clock.sourceCommitSha -or $admission.windowId -cne $Clock.windowId))){throw 'blocked'}
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
  $script:projectVerifiedTechnicalOrdinal=$paths.technicalOrdinal
  if([bool](Get-Variable -Name ForwardWindow -ValueOnly -ErrorAction SilentlyContinue) -and $Clock.windowId -ceq '4c602549-2c42-4ec3-9328-714d7cb66a77' -and $paths.technicalOrdinal -eq 15){$null=Read-FoundationTechnical14NoAdmin}
  if([bool](Get-Variable -Name ForwardWindow -ValueOnly -ErrorAction SilentlyContinue) -and $Clock.windowId -ceq '4c602549-2c42-4ec3-9328-714d7cb66a77' -and $paths.technicalOrdinal -eq 16){$null=Read-FoundationTechnical14NoAdmin -Ordinal 15}
  if([bool](Get-Variable -Name ForwardWindow -ValueOnly -ErrorAction SilentlyContinue) -and $Clock.windowId -ceq 'edbc6d11-7c1f-43a7-b745-1ded06deb29f'){
    # ReadClaimed qualifies the fixed no-command17 receipt before18 can exist;
    # the kernel ancestry below still selects this exact active sibling.
    if($paths.technicalOrdinal -notin @(17,18,19)){throw 'blocked'}
    $null=Read-FoundationForwardPrior
  }
  if([bool](Get-Variable -Name ForwardWindow -ValueOnly -ErrorAction SilentlyContinue) -and $Clock.windowId -ceq 'e2be1a67-f6db-4c90-bfd2-671c5db9b90a'){
    if($paths.technicalOrdinal -notin @(20,21)){throw 'blocked'}
    $null=Read-FoundationForwardPrior
  }
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
  if([bool](Get-Variable -Name InspectOnly -ValueOnly -ErrorAction SilentlyContinue)){
    # Fixed sealed SELECT sources only. The pinned CLI has no read-only query
    # option; this does not assert a hosted transaction_read_only setting.
    if($Arguments.Count -ne 4 -or $Arguments[0] -cne 'db' -or $Arguments[1] -cne 'query' -or $Arguments[2] -cne '--file' -or $Arguments[3] -cnotin @($queryFile,$inspectQueryFile)){throw 'blocked'}
  }
  if([bool](Get-Variable -Name WriterClose -ValueOnly -ErrorAction SilentlyContinue)){
    if($Arguments.Count -ne 4 -or $Arguments[0] -cne 'db' -or $Arguments[1] -cne 'query' -or $Arguments[2] -cne '--file' -or $Arguments[3] -cnotin @($writerInspectFile,$writerCloseFile)){throw 'blocked'}
  }
  if([bool](Get-Variable -Name ArchiveFixture -ValueOnly -ErrorAction SilentlyContinue)){
    if($Arguments.Count -ne 4 -or $Arguments[0] -cne 'db' -or $Arguments[1] -cne 'query' -or $Arguments[2] -cne '--file' -or $Arguments[3] -cnotin @($queryFile,$inspectQueryFile,$archiveFile)){throw 'blocked'}
  }
  if([bool](Get-Variable -Name ForwardMigration -ValueOnly -ErrorAction SilentlyContinue)){
    $permitted=$false
    if($Arguments.Count -eq 4 -and $Arguments[0] -ceq 'db' -and $Arguments[1] -ceq 'query' -and $Arguments[2] -ceq '--file' -and $Arguments[3] -cin @($queryFile,$inspectQueryFile,$forwardCheckFile,$forwardFamilyFile)){$permitted=$true}
    if(($Arguments -join '|') -cin @('db|push|--dry-run|--skip-vault','db|push|--skip-vault|--yes','db|advisors|--type|security|--level|warn|--fail-on|warn','db|advisors|--type|performance|--level|warn|--fail-on|warn','gen|types|--lang|typescript|--schema|app,api,ops,ingest')){$permitted=$true}
    if(-not $permitted){throw 'blocked'}
  }
  # The continuation cannot reach a migration write even if another branch is
  # accidentally changed later. Its scratch workdir contains no migrations.
  if($PostcheckContinuation -and $Arguments[1] -ceq 'push'){throw 'blocked'}
  if(($RemainingContinuation -or $StartupReplacement -or ($ProjectVerifiedContinuation -and -not [bool](Get-Variable -Name ForwardWindow -ValueOnly -ErrorAction SilentlyContinue))) -and ($Arguments[0] -cne 'db' -or $Arguments[1] -cne 'query')){throw 'blocked'}
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
    if ($history.Count -notin $(if([bool](Get-Variable -Name ForwardMigration -ValueOnly -ErrorAction SilentlyContinue) -or [bool](Get-Variable -Name ForwardWindow -ValueOnly -ErrorAction SilentlyContinue) -or [bool](Get-Variable -Name TechnicalResidual13 -ValueOnly -ErrorAction SilentlyContinue) -or [bool](Get-Variable -Name TechnicalResidual16 -ValueOnly -ErrorAction SilentlyContinue) -or [bool](Get-Variable -Name TechnicalResidual19 -ValueOnly -ErrorAction SilentlyContinue)){@(14,15)}else{@(10,14)})) { throw 'blocked' }
    for ($i=0; $i -lt $history.Count; $i++) {
      Assert-Keys $history[$i] @('version','name','historySha256')
      if ($history[$i].version -cne $migrations[$i].version -or $history[$i].name -cne $migrations[$i].name -or $history[$i].historySha256 -cne $migrations[$i].historySha256) { throw 'blocked' }
    }
    if ($history.Count -eq $(if([bool](Get-Variable -Name ForwardMigration -ValueOnly -ErrorAction SilentlyContinue) -or [bool](Get-Variable -Name ForwardWindow -ValueOnly -ErrorAction SilentlyContinue) -or [bool](Get-Variable -Name TechnicalResidual13 -ValueOnly -ErrorAction SilentlyContinue) -or [bool](Get-Variable -Name TechnicalResidual16 -ValueOnly -ErrorAction SilentlyContinue) -or [bool](Get-Variable -Name TechnicalResidual19 -ValueOnly -ErrorAction SilentlyContinue)){15}else{14})) { return 'complete' }
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
  if ($value.migrations.Count -ne $packet.pending.Count) { return 'pending_mismatch' }
  for ($i=0; $i -lt $packet.pending.Count; $i++) { if ($value.migrations[$i] -isnot [string] -or $value.migrations[$i] -cne [IO.Path]::GetFileName($packet.pending[$i].file)) { return 'pending_mismatch' } }
  return 'matched'
}
function Push-Matches($Result,[bool]$DryRun) {
  return (Push-Check $Result $DryRun) -ceq 'matched'
}

function Read-FoundationTechnical18NoReactivation {
  # ReadClaimed validates typed18's closure/readback before the current child.
  # Pin that same immutable receipt before19 may omit its nonexistent SQL audit.
  $technical18Sha256='92a5976dbce66210abbdd76655afaf71a98c9c48f29c8c15422831a85f3737d9'
  $path=Assert-Path $repo 'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical18-preparation-reconciliation-20261025.json'
  if((File-Hash $path) -cne $technical18Sha256){throw 'blocked'}
  return $technical18Sha256
}
function Read-FoundationTechnical20NoReactivation {
  # The sealed ReadClaimed gate qualifies the failed pre-Ready20 chain and its
  # independent physical cleanup. Preserve the raw false closure flags; only21
  # may omit the SQL audit that20 never created.
  $technical20Sha256='d5f4353439ff6a3254f71609048ff43aa1d453308b5708bd968182ce959bf983'
  $path=Assert-Path $repo 'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical20-pre-ready-reconciliation-20261025.json'
  if((File-Hash $path) -cne $technical20Sha256){throw 'blocked'}
  return $technical20Sha256
}
function Read-FoundationForwardPrior {
  # ForwardWindow already passed the sealed current ReadClaimed/native ancestry
  # gate, which verifies the immutable prior closure while allowing its new sibling.
  if(-not [bool](Get-Variable -Name ForwardWindow -ValueOnly -ErrorAction SilentlyContinue)){$null=Assert-FoundationInspectClosed}
  if([bool](Get-Variable -Name ForwardWindow -ValueOnly -ErrorAction SilentlyContinue) -and (Foundation-ForwardWindowId) -ceq 'e2be1a67-f6db-4c90-bfd2-671c5db9b90a'){
    $technical=Foundation-ProjectVerifiedTechnicalIdentity
    if($technical.ordinal -notin @(20,21)){throw 'blocked'}
    if($technical.ordinal -eq 21){$null=Read-FoundationTechnical20NoReactivation}
    return Read-FoundationTechnical19Database
  }
  if([bool](Get-Variable -Name ForwardWindow -ValueOnly -ErrorAction SilentlyContinue) -and (Foundation-ForwardWindowId) -ceq 'edbc6d11-7c1f-43a7-b745-1ded06deb29f'){
    $technical=Foundation-ProjectVerifiedTechnicalIdentity
    if($technical.ordinal -notin @(17,18,19)){throw 'blocked'}
    if($technical.ordinal -eq 19){$null=Read-FoundationTechnical18NoReactivation}
    # The separately captured and independently verified native archive qualifies
    # only this fixed successor; preserve the original zero-auth failed output.
    $archiveSha256='d8177cbc39dd0805b831cfddbf0f0d25ab8ce749243b1eab0a0fdf0e4ccae97d'
    if($archiveSha256 -isnot [string] -or $archiveSha256 -cnotmatch '^[a-f0-9]{64}$'){throw 'blocked'}
    $TechnicalResidual16=$true
    $expected=Read-FoundationTechnical16Closed
    $settlement=Assert-FoundationTechnical16Settled $expected
    $path=Assert-Path $repo 'milestones/M03-n8n-foundation/evidence/technical16-fixture-archive-20261024.json'
    if((File-Hash $path) -cne $archiveSha256){throw 'blocked'}
    $archive=Read-Json $path
    Assert-Keys $archive @('kind','version','environment','projectRef','outerNativeExit','settlementSha256','rawResult','cleanup','pins')
    if($archive.kind -cne 'm03_technical16_fixture_archive' -or $archive.version -isnot [int] -or $archive.version -ne 1 -or $archive.environment -cne 'dev' -or $archive.projectRef -cne 'zmotjsbzhzjvpelxvxlf' -or $archive.outerNativeExit -isnot [int] -or $archive.outerNativeExit -ne 0){throw 'blocked'}
    $settlementRelative='milestones/M03-n8n-foundation/evidence/technical16-native-settlement-20261024.json'
    $base='scripts/db/out/m03-foundation-archive-4c602549-2c42-4ec3-9328-714d7cb66a77-after-preflight-698498b3'
    Assert-Keys $archive.pins @($settlementRelative,($base+'-attempt.json'),($base+'-latest.json'))
    foreach($pin in $archive.pins.PSObject.Properties){if($pin.Value -isnot [string] -or $pin.Value -cnotmatch '^[a-f0-9]{64}$' -or (File-Hash (Assert-Path $repo $pin.Name)) -cne $pin.Value){throw 'blocked'}}
    if($archive.settlementSha256 -isnot [string] -or $archive.settlementSha256 -cne $archive.pins.$settlementRelative){throw 'blocked'}
    $prior=$archive.rawResult
    if($prior.status -cne 'archive_verified' -or $prior.environment -cne 'dev' -or $prior.projectRef -cne 'zmotjsbzhzjvpelxvxlf' -or $prior.historyBefore -cne 'complete' -or $prior.historyAfter -cne 'complete' -or $prior.archiveNativeExit -isnot [int] -or $prior.archiveNativeExit -ne 0){throw 'blocked'}
    foreach($key in @('authenticationVerified','archiveFixture','archiveAttempted','archiveAcknowledged','fixtureArchived','childrenClosed','scratchDeleted','persistentAdminPreserved','inspectParentLockDeleted')){if($prior.$key -isnot [bool] -or -not $prior.$key){throw 'blocked'}}
    if($prior.pushAttempted -isnot [bool] -or $prior.pushAttempted){throw 'blocked'}
    $native=Read-Json (Assert-Path $repo ($base+'-latest.json'))
    if((ConvertTo-Json -InputObject $native -Depth 60 -Compress) -cne (ConvertTo-Json -InputObject $prior -Depth 60 -Compress)){throw 'blocked'}
    Assert-FoundationArchiveInspection $prior.archiveBefore $expected $false
    Assert-FoundationArchiveInspection $prior.archiveAfter $expected $true
    Assert-Keys $archive.cleanup @('parentAbsent','childAbsent','parentLockAbsent','persistentAdminRetained','privateContentsRead','networkRequests')
    foreach($key in @('parentAbsent','childAbsent','parentLockAbsent','persistentAdminRetained')){if($archive.cleanup.$key -isnot [bool] -or -not $archive.cleanup.$key){throw 'blocked'}}
    if($archive.cleanup.privateContentsRead -isnot [bool] -or $archive.cleanup.privateContentsRead -or $archive.cleanup.networkRequests -isnot [int] -or $archive.cleanup.networkRequests -ne 0){throw 'blocked'}
    return $prior.archiveAfter
  }
  if([bool](Get-Variable -Name ForwardWindow -ValueOnly -ErrorAction SilentlyContinue) -and (Foundation-ForwardWindowId) -ceq '4c602549-2c42-4ec3-9328-714d7cb66a77'){
    # Current continuation uses the actual four-window archived baseline. Keep
    # the older migration/profile receipt and the failed13 record unchanged.
    $TechnicalResidual13=$true
    $technical=Foundation-ProjectVerifiedTechnicalIdentity
    if($technical.ordinal -notin @(14,15,16)){throw 'blocked'}
    if($technical.ordinal -eq 15){$null=Read-FoundationTechnical14NoAdmin}
    if($technical.ordinal -eq 16){$null=Read-FoundationTechnical14NoAdmin -Ordinal 15}
    $expected=Read-FoundationTechnical13Closed
    $path=Assert-Path $repo 'milestones/M03-n8n-foundation/evidence/runtime-restoration-fixture-archive-20261024.json'
    if((File-Hash $path) -cne '37c3f0dc518799700cde6c56f18569634c33b919ba26b4bbac1e6d2d09baa656'){throw 'blocked'}
    $archive=Read-Json $path;$prior=$archive.actualNativeResult
    if($archive.kind -cne 'actual_m03_technical13_fixture_archive' -or $archive.version -ne 1 -or $archive.nativeExit -ne 0 -or $prior.status -cne 'archive_verified' -or $prior.runId -cne 'bcc59dcd-3e17-468e-85d9-c1e0e3f15c8e' -or
       $prior.projectRef -cne 'zmotjsbzhzjvpelxvxlf' -or $prior.environment -cne 'dev' -or $prior.authenticationVerified -ne $true -or $prior.historyBefore -cne 'complete' -or $prior.historyAfter -cne 'complete' -or $prior.pushAttempted -ne $false -or $prior.fixtureArchived -ne $true -or
       $prior.childrenClosed -ne $true -or $prior.scratchDeleted -ne $true -or $prior.inspectParentLockDeleted -ne $true -or $prior.persistentAdminPreserved -ne $true){throw 'blocked'}
    $nativePath=Assert-Path $repo 'scripts/db/out/m03-foundation-archive-3c46c791-e140-4eb9-890a-eecfa251f65e-latest.json'
    if((File-Hash $nativePath) -cne '05cf944a0f3a04aa7c87d8e1cdce4f27e0644d30f7dcf6cf849e06529556e8e3'){throw 'blocked'}
    $cleanupPath=Assert-Path $repo 'milestones/M03-n8n-foundation/evidence/runtime-restoration-cleanup-20261024.json'
    if((File-Hash $cleanupPath) -cne '50b274b1f6e26d6ba34b602c2cae45136aea19353073d185a1b25ba4b9cc016a'){throw 'blocked'}
    $cleanup=Read-Json $cleanupPath
    if($cleanup.kind -cne 'actual_m03_technical13_cleanup_completion' -or $cleanup.nativeExit -ne 0 -or $cleanup.actualNativeResult.status -cne 'local_cleanup_verified' -or $cleanup.runtimeRestorationReceiptSha256 -cne '365c8bb069e6f7246c89261fb543b8fa9dbd8f38587500da64d5f4d38e065946' -or $cleanup.fixtureArchiveReceiptSha256 -cne (File-Hash $path)){throw 'blocked'}
    Assert-FoundationArchiveInspection $prior.archiveAfter $expected $true
    return $prior.archiveAfter
  }
  $path=Assert-Path $repo 'scripts/db/out/m03-foundation-archive-df4f29ec-e2dc-4d82-a276-62a4e695e6f9-latest.json'
  if((File-Hash $path) -cne 'c2d67c19b2a449f020b6d944ef1e0f6ec3a1e5bff3e4c4083b36162352596de1'){throw 'blocked'}
  $prior=Read-Json $path
  if($prior.runId -cne 'e9a3477a-c07c-4bdb-b394-5dc25462dabf' -or $prior.environment -cne 'dev' -or $prior.projectRef -cne 'zmotjsbzhzjvpelxvxlf' -or
    $prior.status -cne 'archive_verified' -or $prior.authenticationVerified -ne $true -or $prior.historyBefore -cne 'complete' -or $prior.historyAfter -cne 'complete' -or
    $prior.pushAttempted -ne $false -or $prior.fixtureArchived -ne $true -or $prior.childrenClosed -ne $true -or $prior.scratchDeleted -ne $true -or $prior.persistentAdminPreserved -ne $true -or $prior.inspectParentLockDeleted -ne $true){throw 'blocked'}
  Assert-FoundationArchiveInspection $prior.archiveAfter $prior.archiveAfter.window $true
  return $prior.archiveAfter
}
function Assert-FoundationForwardIntent($Value) {
  Assert-Keys $Value @('version','runId','projectRef','purpose','pending','archiveRunId','createdAt')
  if($Value.version -ne 1 -or $Value.projectRef -cne 'zmotjsbzhzjvpelxvxlf' -or $Value.purpose -cne 'exact-fifteenth-dev-migration' -or
    $Value.runId -cnotmatch '^[a-f0-9-]{36}$' -or $Value.archiveRunId -cne 'e9a3477a-c07c-4bdb-b394-5dc25462dabf' -or $Value.pending -isnot [Array] -or $Value.pending.Count -ne 1){throw 'blocked'}
  Assert-Keys $Value.pending[0] @('version','name','file','sha256','historySha256')
  foreach($field in @('version','name','file','sha256','historySha256')){if($Value.pending[0].$field -cne $packet.pending[0].$field){throw 'blocked'}}
}
function Assert-FoundationForwardBaseline {
  $read=Invoke-Cli @('db','query','--file',$inspectQueryFile) $queryTimeoutMs
  try{$value=Read-FoundationInspection $read;Assert-FoundationArchiveInspection $value $forwardPrior.window $true;$receipt['preservedClosedArchive']=$value}finally{$read.text=$null}
  $read=Invoke-Cli @('db','query','--file',$forwardFamilyFile) $queryTimeoutMs
  try{
    if(-not $read.ok -or -not $read.closed){throw 'blocked'}
    $rows=ConvertFrom-Json -InputObject $read.text -ErrorAction Stop
    if($rows -isnot [Array] -or $rows.Count -ne 1){throw 'blocked'}
    Assert-Keys $rows[0] @('forward_baseline');$value=$rows[0].forward_baseline
    Assert-Keys $value @('identity','soleClosedFamily','globalAdmitted','launches','reservedUsd')
    if($value.identity -ne $true -or $value.soleClosedFamily -ne $true -or $value.globalAdmitted -ne 2 -or $value.launches -ne 0 -or $value.reservedUsd -ne 0){throw 'blocked'}
  }finally{$read.text=$null}
}
function Invoke-FoundationForwardPostcheck {
  $receipt['postcheckStage']='catalog'
  $read=$null
  try{
    if([bool](Get-Variable -Name ForwardWindow -ValueOnly -ErrorAction SilentlyContinue)){
      $window=Foundation-ForwardWindowId
      Assert-FoundationForwardWindowState $false
      $sql=[IO.File]::ReadAllText($forwardCheckFile)
      if($window -cin @('eda4fae1-1e19-47db-81b8-beac1a4ed883','3c46c791-e140-4eb9-890a-eecfa251f65e','4c602549-2c42-4ec3-9328-714d7cb66a77','edbc6d11-7c1f-43a7-b745-1ded06deb29f','e2be1a67-f6db-4c90-bfd2-671c5db9b90a')){
        # The migration-time catalog deliberately required the sole legacy
        # window. Acceptance now has two immutable closed predecessors and
        # must still prove the current window absent before provisioning.
        $needle="'no_new_window',(select count(*)=1 and bool_and(window_id='df4f29ec-e2dc-4d82-a276-62a4e695e6f9' and closed_at is not null and close_count=1 and admitted_count=2) from ops.foundation_gateway_rate_windows)"
        if($sql.IndexOf($needle) -lt 0 -or $sql.IndexOf($needle) -ne $sql.LastIndexOf($needle)){throw 'blocked'}
        $replacement="'no_new_window',(select count(*)=2 and bool_and(closed_at is not null and close_count=1 and ((window_id='df4f29ec-e2dc-4d82-a276-62a4e695e6f9' and admitted_count=2 and bound_commit_sha='f42930f90c2de43c84f61ad6d966d0ee6074d70e') or (window_id='38b3708d-61b0-41d2-8170-5ed91c66b4dc' and admitted_count=1 and starts_at is null and bound_commit_sha='a5e746736893d5040e93032ae740a0878f748837'))) from ops.foundation_gateway_rate_windows) and not exists(select 1 from ops.foundation_gateway_rate_windows where window_id='eda4fae1-1e19-47db-81b8-beac1a4ed883')"
        if($window -ceq '3c46c791-e140-4eb9-890a-eecfa251f65e'){
          $replacement="'no_new_window',(select count(*)=3 and bool_and(closed_at is not null and close_count=1 and ((window_id='df4f29ec-e2dc-4d82-a276-62a4e695e6f9' and admitted_count=2 and bound_commit_sha='f42930f90c2de43c84f61ad6d966d0ee6074d70e') or (window_id='38b3708d-61b0-41d2-8170-5ed91c66b4dc' and admitted_count=1 and starts_at is null and bound_commit_sha='a5e746736893d5040e93032ae740a0878f748837') or (window_id='eda4fae1-1e19-47db-81b8-beac1a4ed883' and admitted_count=2 and starts_at is not null and bound_commit_sha='aff94f2b2d8055cf93b5405e6b11d4e7d9c86803'))) from ops.foundation_gateway_rate_windows) and not exists(select 1 from ops.foundation_gateway_rate_windows where window_id='3c46c791-e140-4eb9-890a-eecfa251f65e')"
        }
        if($window -ceq '4c602549-2c42-4ec3-9328-714d7cb66a77'){
          $replacement="'no_new_window',$(Foundation-Technical13FamilyPredicate) and not exists(select 1 from ops.foundation_gateway_rate_windows where window_id='4c602549-2c42-4ec3-9328-714d7cb66a77')"
        }
        if($window -ceq 'edbc6d11-7c1f-43a7-b745-1ded06deb29f'){
          $replacement="'no_new_window',$(Foundation-Technical16FamilyPredicate) and not exists(select 1 from ops.foundation_gateway_rate_windows where window_id='edbc6d11-7c1f-43a7-b745-1ded06deb29f')"
        }
        if($window -ceq 'e2be1a67-f6db-4c90-bfd2-671c5db9b90a'){
          $replacement="'no_new_window',$(Foundation-Technical19FamilyPredicate) and not exists(select 1 from ops.foundation_gateway_rate_windows where window_id='e2be1a67-f6db-4c90-bfd2-671c5db9b90a')"
        }
        $sql=$sql.Replace($needle,$replacement)
      }
      $proof=Invoke-FoundationQuery $sql 'postcheck'
    }else{
      $read=Invoke-Cli @('db','query','--file',$forwardCheckFile) $queryTimeoutMs
      if(-not $read.ok -or -not $read.closed){throw 'blocked'}
      $rows=ConvertFrom-Json -InputObject $read.text -ErrorAction Stop
      if($rows -isnot [Array] -or $rows.Count -ne 1){throw 'blocked'}
      Assert-Keys $rows[0] @('postcheck');$proof=$rows[0].postcheck
    }
    $checks=@('identity','tables_rls','no_machine_table_grants','rpc_shape','owner_control_restricted','all_project_tables_rls','all_views_invoker','gw01_closed','domain_auto_join_off','baseline_counts','forward_primary_key','forward_signatures','forward_namespace','no_new_window')
    $receipt.postcheckStage='catalog_shape'
    Assert-Keys $proof ($checks+@('schemas'))
    $flags=[ordered]@{}
    foreach($key in $checks){if($proof.$key -isnot [bool]){$receipt.postcheckStage='catalog_'+$key;throw 'blocked'};$flags[$key]=$proof.$key}
    $receipt['catalogChecks']=$flags
    foreach($key in $checks){if(-not $proof.$key){$receipt.postcheckStage='catalog_'+$key;throw 'blocked'}}
    if(($proof.schemas -join '|') -cne 'app|api|ops|ingest'){$receipt.postcheckStage='catalog_schemas';throw 'blocked'}
  }finally{if($null -ne $read){$read.text=$null}}
  $advisors=[ordered]@{}
  foreach($kind in @('security','performance')){
    $receipt.postcheckStage='advisors_'+$kind
    $read=Invoke-Cli @('db','advisors','--type',$kind,'--level','warn','--fail-on','warn') 60000
    try{
      if(-not $read.ok -or -not $read.closed -or $null -eq $read.text -or $read.text.Contains($password)){throw 'blocked'}
      $value=ConvertFrom-Json -InputObject $read.text -ErrorAction Stop;Assert-Keys $value @('results','message')
      if($value.message -cne 'db advisors' -or $value.results -isnot [Array] -or $value.results.Count -ne 0){throw 'blocked'}
      $advisors[$kind]=[ordered]@{nativeExit=0;warnings=0;errors=0;childrenClosed=$true}
    }finally{$read.text=$null}
  }
  $receipt.postcheckStage='types_generate'
  $read=Invoke-Cli @('gen','types','--lang','typescript','--schema','app,api,ops,ingest') 60000
  try{
    if(-not $read.ok -or -not $read.closed -or $null -eq $read.text -or $read.text.Contains($password) -or $read.text.Length -lt 1000){throw 'blocked'}
    $candidateRelative='scripts/db/out/m03-foundation-continuation-'+$runId+'-db.types.ts';$candidate=Join-Path $repo $candidateRelative
    $bytes=[Text.UTF8Encoding]::new($false).GetBytes($read.text);$stream=$null
    try{$stream=[IO.File]::Open($candidate,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true)}finally{if($null -ne $stream){$stream.Dispose()}}
    $receipt['postcheckCandidate']=$candidateRelative;$receipt.postcheckStage='types_ast'
    $checked=Invoke-Bounded $node @((Assert-Path $repo 'scripts/db/check-foundation-types.mjs'),'Continuation',$runId) $repo 15000
    if(-not $checked.ok -or -not $checked.closed){throw 'blocked'}
    $coverage=ConvertFrom-Json -InputObject $checked.text -ErrorAction Stop
    Assert-Keys $coverage @('status','schemas','foundationTables','foundationFunctions','astEquivalent')
    if($coverage.status -cne 'types_coverage_verified' -or $coverage.schemas -ne 4 -or $coverage.foundationTables -ne 6 -or $coverage.foundationFunctions -ne 9 -or $coverage.astEquivalent -ne $true){throw 'blocked'}
    $receipt.postcheckStage='complete'
    return [ordered]@{projectRef=$projectRef;migrationCount=15;catalog=$proof;advisors=$advisors;typesGenerated=$true;typesAstEquivalent=$true;typesCandidate=$candidateRelative;ready=$true}
  }finally{$read.text=$null}
}
function Invoke-FoundationForwardMigration {
  if($receipt.historyBefore -cnotin @('baseline','complete')){$receipt.status='history_rejected';return}
  Assert-FoundationForwardBaseline
  if($receipt.historyBefore -ceq 'complete'){
    $receipt.historyAfter='complete';$receipt.status='forward_already_complete'
  }elseif(Test-Path -LiteralPath $attemptFile){
    # A prior once-only push intent always forces read-only reconciliation.
    # Fourteen versions do not establish that the old child made no changes.
    $receipt.status='reconciliation_required';return
  }else{
    $dry=Invoke-Cli @('db','push','--dry-run','--skip-vault') 60000
    $receipt.dryRunNativeExit=$dry.nativeExit;$receipt.dryRunCheck=Push-Check $dry $true;$receipt.dryRunMatched=$receipt.dryRunCheck -ceq 'matched';$dry.text=$null
    if(-not $receipt.dryRunMatched){$receipt.status='dry_run_rejected';return}
    # Recheck actual history and immutable closed/archive state immediately
    # before the one durable intent. No fixture or window operation is run.
    $read=Invoke-Cli @('db','query','--file',$queryFile) $queryTimeoutMs
    try{if((History-State $read) -cne 'baseline'){throw 'blocked'}}finally{$read.text=$null}
    Assert-FoundationForwardBaseline
    Write-NewJson $attemptFile ([ordered]@{version=1;runId=$runId;projectRef=$projectRef;purpose='exact-fifteenth-dev-migration';pending=$packet.pending;archiveRunId='e9a3477a-c07c-4bdb-b394-5dc25462dabf';createdAt=[DateTime]::UtcNow.ToString('o')})
    $receipt.pushAttempted=$true;$push=Invoke-Cli @('db','push','--skip-vault','--yes') $pushTimeoutMs
    $receipt.pushNativeExit=$push.nativeExit;$matched=Push-Matches $push $false;$push.text=$null
    if(-not $push.closed){$receipt.status='child_cleanup_incomplete';return}
    $read=Invoke-Cli @('db','query','--file',$queryFile) $queryTimeoutMs
    try{$receipt.historyAfter=History-State $read}finally{$read.text=$null}
    if($receipt.historyAfter -cne 'complete'){$receipt.status='reconciliation_required';return}
    $receipt.status=if($matched){'forward_complete'}else{'forward_reconciled_complete_after_failure'}
  }
  Assert-FoundationForwardBaseline
  $receipt['postcheck']=Invoke-FoundationForwardPostcheck
  $script:exitCode=0
}

# All preflight checks are public and precede any DPAPI read/decryption.
$script:publicPreflightStage='PUBLIC_CONTEXT'
try {
  if($PostcheckContinuation -and (-not $PhaseAControl -or $ClockAmendment -or $OriginalDeadlineAtMs -ne 0)){throw 'blocked'}
  if($ClockAmendment -and (-not $PhaseAControl -or $OriginalDeadlineAtMs -ne 0)){throw 'blocked'}
  $repoEntry = Get-Item -LiteralPath $repo -Force
  if (($repoEntry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'blocked' }
  $script:publicPreflightStage='PUBLIC_PACKET'
  $packet = Read-Json (Assert-Path $repo $(if($forwardSchema){'scripts/db/m03-foundation-forward-dev-migration-packet.json'}else{'scripts/db/m03-foundation-dev-migration-packet.json'}))
  Assert-Keys $packet @('version','target','approved','authorizationReference','cliVersion','baseline','pending','files','node')
  if ($packet.version -ne 1 -or $packet.target -cne $projectRef -or $packet.approved -isnot [bool] -or -not $packet.approved -or
      $packet.cliVersion -cne '2.121.0' -or $packet.authorizationReference -cne $(if($forwardSchema){'M03 standing development autonomy reset on 2026-10-23; preserve prior attempts and aggregate allowances'}else{'Owner approved M03 A-D dev acceptance at f42930f90c2de43c84f61ad6d966d0ee6074d70e on 2026-10-21'}) -or
      $packet.baseline -isnot [Array] -or $packet.pending -isnot [Array] -or $packet.baseline.Count -ne $(if($forwardSchema){14}else{10}) -or $packet.pending.Count -ne $(if($forwardSchema){1}else{4})) { throw 'blocked' }
  $script:publicPreflightStage='PUBLIC_SOURCE_HASHES'
  Assert-Keys $packet.files $requiredFiles
  foreach ($property in $packet.files.PSObject.Properties) {
    if ($property.Value -isnot [string] -or $property.Value -cnotmatch '^[a-f0-9]{64}$' -or (File-Hash (Assert-Path $repo $property.Name)) -cne $property.Value) { throw 'blocked' }
  }
  . (Assert-Path $repo 'scripts/db/windows/Foundation-AdminControl.ps1')
  $script:publicPreflightStage='NODE_PIN'
  Assert-Keys $packet.node @('path','sha256')
  $node = (Get-Command node.exe -CommandType Application -ErrorAction Stop).Source
  if ($packet.node.path -isnot [string] -or $node -cne $packet.node.path -or $packet.node.sha256 -cnotmatch '^[a-f0-9]{64}$') { throw 'blocked' }
  $nodeEntry = Get-Item -LiteralPath $node -Force
  if ($nodeEntry.PSIsContainer -or ($nodeEntry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or (File-Hash $node) -cne $packet.node.sha256) { throw 'blocked' }
  $nodeCursor=[IO.Directory]::GetParent($node)
  while($null -ne $nodeCursor){$nodeParent=Get-Item -LiteralPath $nodeCursor.FullName -Force;if(($nodeParent.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'blocked'};$nodeCursor=$nodeCursor.Parent}
  $script:publicPreflightStage='MIGRATION_FILES'
  $migrations = @($packet.baseline) + @($packet.pending)
  if($forwardSchema){
    $originalPacket=Read-Json (Assert-Path $repo 'scripts/db/m03-foundation-dev-migration-packet.json')
    $originalMigrations=@($originalPacket.baseline)+@($originalPacket.pending)
    if($originalMigrations.Count -ne 14){throw 'blocked'}
    for($i=0;$i -lt 14;$i++){
      foreach($field in @('version','name','file','sha256','historySha256')){if($migrations[$i].$field -cne $originalMigrations[$i].$field){throw 'blocked'}}
    }
  }
  for ($i=0; $i -lt $versions.Count; $i++) {
    $migration = $migrations[$i]
    Assert-Keys $migration @('version','name','file','sha256','historySha256')
    $expectedFile = 'supabase/migrations/' + $versions[$i] + '_' + $names[$i] + '.sql'
    if ($migration.version -cne $versions[$i] -or $migration.name -cne $names[$i] -or $migration.file -cne $expectedFile -or
        $migration.sha256 -cnotmatch '^[a-f0-9]{64}$' -or $migration.historySha256 -cnotmatch '^[a-f0-9]{64}$' -or
        (File-Hash (Assert-Path $repo $expectedFile)) -cne $migration.sha256) { throw 'blocked' }
  }
  $actualMigrations = @(Get-ChildItem -LiteralPath (Assert-Path $repo 'supabase/migrations' -Directory) -Force)
  if ($actualMigrations.Count -ne $versions.Count) { throw 'blocked' }
  foreach ($entry in $actualMigrations) {
    if ($entry.PSIsContainer -or ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or $entry.Name -cnotin @($migrations | ForEach-Object { [IO.Path]::GetFileName($_.file) })) { throw 'blocked' }
  }
  $script:publicPreflightStage='CA_PIN'
  $caPath = Assert-Path $repo $caRelative
  if ((File-Hash $caPath) -cne $caHash) { throw 'blocked' }
  $pin = Read-Json (Assert-Path $repo 'scripts/seed/certs/supabase-root-2021.json')
  Assert-Keys $pin @('version','projectRef','host','sourceUrl','sha256')
  if ($pin.version -ne 1 -or $pin.projectRef -cne $projectRef -or $pin.host -cne $poolerHost -or $pin.sha256 -cne $caHash -or $pin.sourceUrl -cne 'https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt') { throw 'blocked' }
  $script:publicPreflightStage='CLI_VERSION'
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
    if($ForwardWindow){$receipt['activeWindowId']=$script:projectVerifiedForwardWindowId}
    if($null -ne $clock){
      $script:publicPreflightStage='KERNEL_ANCESTRY'
      if($RemainingContinuation){$null=Assert-FoundationRemainingProcessAncestry $clock}
      if($StartupReplacement){$null=Assert-FoundationStartupReplacementProcessAncestry $clock}
      if($ProjectVerifiedContinuation){$null=Assert-FoundationProjectVerifiedContinuationProcessAncestry $clock}
      $postcheckContinuationStart=[DateTimeOffset]::FromUnixTimeMilliseconds($clock.startsAt).UtcDateTime
      $phaseAControlHardDeadline=$postcheckContinuationStart.AddMinutes(70)
      $receipt['clockSegmentId']=$postcheckContinuationSegment
    }elseif($ProjectVerifiedContinuation -and $CheckOnly){
      # JS CheckOnly already verified the immutable closed chain/receipts.
      # Predict only the next public output names; Run must instead derive the
      # active ordinal from ReadClaimed and the actual native process ancestry.
      $firstAdmission='scripts/n8n/out/foundation/live/project-verified-continuation-20275b22-b7fe-4737-a9a4-c50c2feadb74.json'
      if(Test-Path -LiteralPath (Join-Path $repo $firstAdmission)){
        $script:projectVerifiedTechnicalOrdinal=(Resolve-FoundationProjectVerifiedTechnicalPaths).technicalOrdinal+1
      }
    }
  }
  $script:publicPreflightStage='OUTPUT_PATHS'
  $out = Join-Path $repo 'scripts/db/out'
  if (-not (Test-Path -LiteralPath $out)) { $null = New-Item -ItemType Directory -Path $out }
  $out = Assert-Path $repo 'scripts/db/out' -Directory
  $attemptFile = Join-Path $out 'm03-foundation-dev-migration-attempt.json'
  $latestFile = Join-Path $out 'm03-foundation-dev-migration-latest.json'
  if($ForwardMigration){
    $forwardPrior=Read-FoundationForwardPrior
    $attemptFile=Join-Path $out 'm03-foundation-forward-20261023163755-attempt.json'
    $latestFile=Join-Path $out ('m03-foundation-forward-20261023163755-'+$runId+'-latest.json')
    if(Test-Path -LiteralPath $attemptFile){Assert-FoundationForwardIntent (Read-Json (Assert-Path $repo 'scripts/db/out/m03-foundation-forward-20261023163755-attempt.json'))}
  }
  if($InspectOnly){
    $inspectExpectedBinding=if($TechnicalResidual13){Read-FoundationTechnical13Closed}else{Assert-FoundationInspectClosed}
    $attemptFile=Join-Path $out ('m03-foundation-inspect-'+$runId+'-attempt.json')
    $latestFile=Join-Path $out ('m03-foundation-inspect-'+$runId+'-latest.json')
  }
  if($WriterClose){
    $writerPrior=Read-FoundationWriterClosePrior
    $attemptFile=Join-Path $out 'm03-foundation-writer-close-df4f29ec-e2dc-4d82-a276-62a4e695e6f9-attempt.json'
    $latestFile=Join-Path $out 'm03-foundation-writer-close-df4f29ec-e2dc-4d82-a276-62a4e695e6f9-latest.json'
    if((Test-Path -LiteralPath $attemptFile) -or (Test-Path -LiteralPath $latestFile)){Write-Output 'M03_FOUNDATION WRITER_CLOSE_RECORDED. Reconcile the existing fixed Close receipt; no credential read or automatic replay.';exit 1}
  }
  if($ArchiveFixture){
    $archivePrior=Read-FoundationArchivePrior
    if($TechnicalResidual16){if($archivePrior -isnot [PSCustomObject]){throw 'blocked'};Assert-Keys $archivePrior @('id','audience','commitSha','deploymentId')}
    $archiveWindow=if($TechnicalResidual16){'4c602549-2c42-4ec3-9328-714d7cb66a77'}elseif($TechnicalResidual13){'3c46c791-e140-4eb9-890a-eecfa251f65e'}else{'df4f29ec-e2dc-4d82-a276-62a4e695e6f9'}
    $attemptFile=Join-Path $out ('m03-foundation-archive-'+$archiveWindow+'-attempt.json')
    $latestFile=Join-Path $out ('m03-foundation-archive-'+$archiveWindow+'-latest.json')
    if($TechnicalResidual16){$archiveSuccessor=Assert-FoundationArchivePreflightContinuation;$attemptFile=$archiveSuccessor.attemptFile;$latestFile=$archiveSuccessor.latestFile}
    elseif((Test-Path -LiteralPath $attemptFile) -or (Test-Path -LiteralPath $latestFile)){Write-Output 'M03_FOUNDATION ARCHIVE_RECORDED. Reconcile the existing fixed archive receipt; no credential read or automatic replay.';exit 1}
  }
  if($PostcheckContinuation){
    $outputSegment=if($ProjectVerifiedContinuation){(Foundation-ProjectVerifiedTechnicalIdentity).outputSegment}else{$postcheckContinuationSegment}
    if($ProjectVerifiedContinuation){$receipt['technicalAttemptOrdinal']=(Foundation-ProjectVerifiedTechnicalIdentity).ordinal}
    $attemptFile=Join-Path $out ($continuationOutputStem+$outputSegment+'-attempt.json')
    $latestFile=Join-Path $out ($continuationOutputStem+$outputSegment+'-latest.json')
    if((Test-Path -LiteralPath $attemptFile) -or (Test-Path -LiteralPath $latestFile)){
      Write-Output 'M03_FOUNDATION CONTINUATION_ALREADY_RECORDED. No decryption, migration operation or automatic replay. Preserve and reconcile the separate continuation receipts.';exit 1
    }
  }
  $script:publicPreflightStage='PRIOR_RECEIPT'
  if (-not $ForwardMigration -and (Test-Path -LiteralPath $attemptFile)) {
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
  $stage=if($script:publicPreflightStage -cin @('PUBLIC_CONTEXT','PUBLIC_PACKET','PUBLIC_SOURCE_HASHES','NODE_PIN','MIGRATION_FILES','CA_PIN','CLI_VERSION','CLAIMED_PROCESS_GATE','CLAIMED_DTO','KERNEL_ANCESTRY','OUTPUT_PATHS','PRIOR_RECEIPT')){$script:publicPreflightStage}else{'PUBLIC_CONTEXT'}
  Write-Output ('M03_FOUNDATION PREFLIGHT_BLOCKED. Stage='+$stage+'; no private file read, decryption or authentication attempted.')
  exit 1
}
if($CheckOnly -and $ForwardMigration){Write-Output 'M03_FOUNDATION PUBLIC_INPUTS_READY. Exact fifteenth dev migration, prior closed/archive proof and public seals checked; no credential metadata, private contents or authentication read.';exit 4}
if($CheckOnly -and $ProjectVerifiedContinuation){Write-Output 'M03_FOUNDATION PUBLIC_INPUTS_READY. Project-verified public sources and approval checked; no credential metadata, private contents or authentication read.';exit 4}
if($CheckOnly -and $InspectOnly){Write-Output 'M03_FOUNDATION PUBLIC_INPUTS_READY. Exact dev public sources and physical closed-chain prerequisites checked; no credential metadata, private contents or authentication read.';exit 4}
if($CheckOnly -and $WriterClose){Write-Output 'M03_FOUNDATION PUBLIC_INPUTS_READY. Fixed writer Close and actual inspection prerequisites checked; no credential metadata, private contents or authentication read.';exit 4}
if($CheckOnly -and $ArchiveFixture){Write-Output 'M03_FOUNDATION PUBLIC_INPUTS_READY. Fixed archive and actual independent closed-window inspection checked; no credential metadata, private contents or authentication read.';exit 4}
try {
  if ([string]::IsNullOrEmpty($env:LOCALAPPDATA)) { throw 'blocked' }
  if($InspectOnly -or $WriterClose -or $ArchiveFixture -or $ForwardMigration){
    $null=Assert-Path ([IO.Path]::GetFullPath($env:LOCALAPPDATA)) 'Temp' -Directory
    $inspectParentPath=Join-Path ([IO.Path]::GetFullPath($env:LOCALAPPDATA)) 'Temp/emr-m03-acceptance-parent.operation.lock'
    $inspectParentLock=[IO.File]::Open($inspectParentPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::ReadWrite,[IO.FileShare]::Read)
    $lockBytes=[Text.Encoding]::UTF8.GetBytes(([ordered]@{kind=$(if($WriterClose){'m03_writer_close_parent'}elseif($ArchiveFixture){'m03_archive_parent'}elseif($ForwardMigration){'m03_forward_migration_parent'}else{'m03_read_only_inspect_parent'});version=1;processId=$PID}|ConvertTo-Json -Compress))
    $inspectParentLock.Write($lockBytes,0,$lockBytes.Length);$inspectParentLock.Flush($true)
    $inspectExpectedBinding=Assert-FoundationInspectClosed
    . (Assert-Path $repo 'scripts/n8n/windows/Dev-CredentialStore.ps1')
    if($InspectOnly){Ensure-M03DevReadOnlyHandoff -Kind Admin -CoordinatorLock $inspectParentLock;$inspectMaterialized=$true}
  }
  if($WriterClose -or $ArchiveFixture -or $ForwardMigration){
    if($WriterClose){$writerPrior=Read-FoundationWriterClosePrior}elseif($ForwardMigration){$forwardPrior=Read-FoundationForwardPrior}else{$archivePrior=Read-FoundationArchivePrior}
    if($WriterClose){$writerSpec=Get-M03DevCredentialSpec -Kind Writer}else{$writerSpec=Get-M03DevCredentialSpec -Kind Admin}
    Assert-M03DevPrivateAcl (Get-M03DevCredentialRoot) $true
    Assert-M03DevPrivateAcl ([IO.Path]::GetDirectoryName($writerSpec.Source)) $true
    Assert-M03DevPrivateAcl $writerSpec.Source $false
    $handoff=$writerSpec.Source;$leaseExpires=[DateTime]::UtcNow.AddMinutes($(if($ForwardMigration){10}else{5}))
  }else{
  $handoff = Join-Path ([IO.Path]::GetFullPath($env:LOCALAPPDATA)) 'Temp/emr-m03-foundation-dev-migration-password.dpapi'
  if (-not (Test-Path -LiteralPath $handoff -PathType Leaf)) {
    if($InspectOnly){throw 'blocked'}
    Write-Output 'M03_FOUNDATION HANDOFF_MISSING. No decryption or authentication attempted.'; exit 2
  }
  $handoff = Assert-Path ([IO.Path]::GetFullPath($env:LOCALAPPDATA)) 'Temp/emr-m03-foundation-dev-migration-password.dpapi'
  if ((Get-Item -LiteralPath $handoff).Length -gt 32768) { throw 'blocked' }
  $leaseFile = Assert-Path ([IO.Path]::GetFullPath($env:LOCALAPPDATA)) 'Temp/emr-m03-foundation-dev-migration-password.lease.json'
  $lease = Read-Json $leaseFile 4096
  Assert-Keys $lease @('version','environment','projectRef','purpose','approvalSha','createdAt','expiresAt')
  if ($lease.version -ne 1 -or $lease.environment -cne 'dev' -or $lease.projectRef -cne $projectRef -or
      $lease.purpose -cne $(if($InspectOnly){'m03-foundation-inspect-only-dev'}elseif($ProjectVerifiedContinuation){'m03-foundation-project-verified-continuation-dev:20275b22-b7fe-4737-a9a4-c50c2feadb74'}else{'m03-foundation-phase-a-dev'}) -or $lease.approvalSha -cne 'f42930f90c2de43c84f61ad6d966d0ee6074d70e' -or
      $lease.createdAt -isnot [string] -or $lease.expiresAt -isnot [string]) { throw 'blocked' }
  $leaseCreated = [DateTime]::ParseExact($lease.createdAt,'o',[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::RoundtripKind)
  $leaseExpires = [DateTime]::ParseExact($lease.expiresAt,'o',[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::RoundtripKind)
  if ($leaseCreated.Kind -ne [DateTimeKind]::Utc -or $leaseExpires.Kind -ne [DateTimeKind]::Utc -or
      $leaseCreated -gt [DateTime]::UtcNow.AddMinutes(1) -or $leaseExpires -ne $leaseCreated.AddHours(2)) { throw 'blocked' }
  if($leaseExpires -le (Get-FoundationLeaseFloor)){
    if($CheckOnly -and ($ClockAmendment -or $PostcheckContinuation)){Write-Output 'M03_FOUNDATION HANDOFF_LEASE_NOT_READY. Public inputs verified; the unchanged two-hour admin lease does not cover this admission. No private file read, decryption or authentication attempted.';exit 2}
    throw 'blocked'
  }
  }
} catch {
  if(($InspectOnly -or $WriterClose -or $ArchiveFixture -or $ForwardMigration) -and $null -ne $inspectParentLock){
    if($inspectMaterialized){foreach($name in @('emr-m03-foundation-dev-migration-password.dpapi','emr-m03-foundation-dev-migration-password.lease.json')){try{[IO.File]::Delete((Join-Path ([IO.Path]::GetFullPath($env:LOCALAPPDATA)) ('Temp/'+$name)))}catch{}}}
    try{$inspectParentLock.Dispose();[IO.File]::Delete($inspectParentPath)}catch{}
  }
  Write-Output 'M03_FOUNDATION HANDOFF_PATH_BLOCKED. No private file read, decryption or authentication attempted.'; exit 1
}
if ($CheckOnly) { Write-Output 'M03_FOUNDATION CHECK_ONLY_READY. Exact dev target, public seals and encrypted handoff presence verified; no decryption, TCP connection or authentication attempted.'; exit 0 }

try {
  if($ArchiveFixture){$receipt['preparationStage']='SESSION_LOCK'}
  $lockPath = Join-Path $out 'm03-foundation-dev-migration-session.lock'
  if (Test-Path -LiteralPath $lockPath) { $null = Assert-Path $repo 'scripts/db/out/m03-foundation-dev-migration-session.lock' }
  $sessionLock = [IO.File]::Open($lockPath,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
  if($ArchiveFixture -and $TechnicalResidual16){$null=Assert-FoundationArchivePreflightContinuation $true}
  if (-not $ForwardMigration -and (Test-Path -LiteralPath $attemptFile)) { throw 'blocked' }
  if($ArchiveFixture){$receipt['preparationStage']='NODE_PIN'}
  if ((File-Hash $node) -cne $packet.node.sha256) { throw 'blocked' }
  if($ArchiveFixture){$receipt['preparationStage']='TLS_PROBE'}
  $tls = Invoke-Bounded $node @((Assert-Path $repo 'scripts/seed/check-tls.mjs')) $repo 15000
  if (-not $tls.closed) { $receipt.childrenClosed = $false }
  if (-not $tls.ok -or -not $tls.closed) { throw 'blocked' }
  if($ArchiveFixture){$receipt['preparationStage']='TLS_RECEIPT'}
  $tlsValue = ConvertFrom-Json -InputObject $tls.text -ErrorAction Stop
  if ($tlsValue.status -cne 'verified' -or $tlsValue.phase -cne 'tls_handshake' -or $tlsValue.code -cne 'TLS_VERIFIED' -or
      $tlsValue.environment -cne 'dev' -or $tlsValue.projectRef -cne $projectRef -or $tlsValue.host -cne $poolerHost -or $tlsValue.port -ne 5432 -or
      $tlsValue.rejectUnauthorized -ne $true -or $tlsValue.exactServerName -ne $true -or $tlsValue.scopedCaVerified -ne $true -or
      $tlsValue.startupMessageSent -ne $false -or $tlsValue.authenticationAttempted -ne $false -or $tlsValue.socketsClosed -ne $true) { throw 'blocked' }

  if($ArchiveFixture){$receipt['preparationStage']='SCRATCH_SETUP'}
  $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')
  $tempEntry = Get-Item -LiteralPath $tempRoot -Force
  if (($tempEntry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'blocked' }
  $scratch = Join-Path $tempRoot ('emr-m03-foundation-dev-migrations-' + $runId)
  $null = New-Item -ItemType Directory -Path $scratch -ErrorAction Stop
  $receipt.scratchDeleted = $false
  Write-NewJson (Join-Path $scratch 'owned.json') ([ordered]@{runId=$runId;projectRef=$projectRef})
  $null = New-Item -ItemType Directory -Path (Join-Path $scratch 'supabase/migrations') -Force
  [IO.File]::WriteAllText((Join-Path $scratch 'supabase/config.toml'),"project_id = `"emr-m03-foundation-dev-migration`"`n[db.seed]`nenabled = false`nsql_paths = []`n")
  if(-not $PostcheckContinuation -and -not $InspectOnly -and -not $WriterClose -and -not $ArchiveFixture){foreach ($migration in $migrations) { [IO.File]::Copy((Assert-Path $repo $migration.file),(Join-Path $scratch $migration.file),$false) }}
  $scratchCa = Join-Path $scratch 'supabase-root-2021.crt'
  [IO.File]::Copy($caPath,$scratchCa,$false)
  if ((File-Hash $scratchCa) -cne $caHash) { throw 'blocked' }
  if(-not $PostcheckContinuation -and -not $InspectOnly -and -not $WriterClose -and -not $ArchiveFixture){foreach ($migration in $migrations) { if ((File-Hash (Assert-Path $scratch $migration.file)) -cne $migration.sha256) { throw 'blocked' } }}
  if($ArchiveFixture){$receipt['preparationStage']='READBACK_SQL'}
  $historySql = @'
select jsonb_build_object('current_user',current_user,'session_user',session_user,'database',current_database(),'migrations',(select coalesce(jsonb_agg(jsonb_build_object('version',version,'name',name,'historySha256',encode(extensions.digest(array_to_string(statements,E'\n'),'sha256'),'hex')) order by version),'[]'::jsonb) from supabase_migrations.schema_migrations)) as receipt;
'@
  $queryFile = Join-Path $scratch 'history.sql'
  [IO.File]::WriteAllText($queryFile,$historySql)
  if($InspectOnly -or $ArchiveFixture -or $ForwardMigration){
    $inspectQueryFile=Join-Path $scratch 'inspect.sql'
    [IO.File]::Copy((Assert-Path $repo 'scripts/db/foundation-inspect.sql'),$inspectQueryFile,$false)
    if((File-Hash $inspectQueryFile) -cne $packet.files.'scripts/db/foundation-inspect.sql'){throw 'blocked'}
    if($TechnicalResidual19){[IO.File]::WriteAllText($inspectQueryFile,(Foundation-Technical13InspectionSql -Technical19 $true))}elseif($TechnicalResidual16){[IO.File]::WriteAllText($inspectQueryFile,(Foundation-Technical13InspectionSql -Technical16 $true))}elseif($TechnicalResidual13){[IO.File]::WriteAllText($inspectQueryFile,(Foundation-Technical13InspectionSql -ReadOnlyCurrent ([bool]$InspectOnly)))}
  }
  if($forwardSchema){
    $forwardCheckFile=Join-Path $scratch 'forward-postcheck.sql';$forwardFamilyFile=Join-Path $scratch 'forward-family.sql'
    [IO.File]::Copy((Assert-Path $repo 'scripts/db/foundation-forward-postcheck.sql'),$forwardCheckFile,$false)
    if((File-Hash $forwardCheckFile) -cne $packet.files.'scripts/db/foundation-forward-postcheck.sql'){throw 'blocked'}
    [IO.File]::WriteAllText($forwardFamilyFile,"select jsonb_build_object('identity',current_user='postgres' and session_user='postgres' and current_database()='postgres','soleClosedFamily',(select count(*)=1 and bool_and(window_id='df4f29ec-e2dc-4d82-a276-62a4e695e6f9' and closed_at is not null and close_count=1) from ops.foundation_gateway_rate_windows where namespace='m03-foundation-dev'),'globalAdmitted',(select coalesce(sum(admitted_count),0) from ops.foundation_gateway_rate_windows where namespace='m03-foundation-dev'),'launches',(select count(*) from ops.apify_launch_admissions),'reservedUsd',(select coalesce(sum(max_total_charge_usd),0) from ops.apify_launch_admissions)) as forward_baseline;")
  }
  if($ArchiveFixture){$receipt['preparationStage']='ARCHIVE_SQL';$archiveFile=Join-Path $scratch 'archive.sql';[IO.File]::WriteAllText($archiveFile,(Foundation-ArchiveFixtureSql $archivePrior))}
  if($WriterClose){
    $writerInspectFile=Join-Path $scratch 'writer-inspect.sql';$writerCloseFile=Join-Path $scratch 'writer-close.sql'
    $writerSql="select jsonb_build_object('currentUser',current_user,'sessionUser',session_user,'database',current_database(),'control',ops.foundation_gateway_admit('df4f29ec-e2dc-4d82-a276-62a4e695e6f9','00000000-0000-4000-8000-000000000021','identity.read','{}','__MODE__')) as writer_receipt;"
    [IO.File]::WriteAllText($writerInspectFile,$writerSql.Replace('__MODE__','inspect'));[IO.File]::WriteAllText($writerCloseFile,$writerSql.Replace('__MODE__','close'))
  }
  $dbUri = 'postgresql://' + $(if($WriterClose){'n8n_writer.'}else{'postgres.'}) + $projectRef + '@' + $poolerHost + ':5432/postgres?sslmode=verify-full&sslrootcert=' + [Uri]::EscapeDataString($scratchCa)

  # The only private read is the new purpose-bound foundation DPAPI file. No old administrator,
  # writer, provider or production credential is opened or used.
  if($ArchiveFixture){$receipt['preparationStage']='PRIVATE_METADATA'}
  if($WriterClose -or $ArchiveFixture -or $ForwardMigration){Assert-M03DevPrivateAcl $handoff $false}else{$null = Assert-Path ([IO.Path]::GetFullPath($env:LOCALAPPDATA)) 'Temp/emr-m03-foundation-dev-migration-password.dpapi'}
  if($null -ne $originalPhaseAStart -and [DateTime]::UtcNow -ge $originalPhaseAStart.AddMinutes(50)){throw 'blocked'}
  if($null -ne $clockAmendmentStart -and [DateTime]::UtcNow -ge $clockAmendmentStart.AddMinutes(50)){throw 'blocked'}
  if($null -ne $postcheckContinuationStart -and [DateTime]::UtcNow -ge $postcheckContinuationStart.AddMinutes(50)){throw 'blocked'}
  if($RemainingContinuation){$null=Assert-FoundationRemainingProcessAncestry $clock}
      if($StartupReplacement){$null=Assert-FoundationStartupReplacementProcessAncestry $clock}
      if($ProjectVerifiedContinuation){$null=Assert-FoundationProjectVerifiedContinuationProcessAncestry $clock}
  $consumed = $true
  $phaseAStart = if($null -ne $originalPhaseAStart){$originalPhaseAStart}elseif($null -ne $clockAmendmentStart){$clockAmendmentStart}elseif($null -ne $postcheckContinuationStart){$postcheckContinuationStart}else{[DateTime]::UtcNow}
  if($WriterClose -or $ArchiveFixture -or $ForwardMigration){$cipherBytes=[IO.File]::ReadAllBytes($handoff);try{Assert-M03DevCipherFraming $cipherBytes;$secret=ConvertTo-SecureString -String ([Text.Encoding]::ASCII.GetString($cipherBytes)) -ErrorAction Stop}finally{[Array]::Clear($cipherBytes,0,$cipherBytes.Length);$cipherBytes=$null}}
  else{$secret = ConvertTo-SecureString -String ([IO.File]::ReadAllText($handoff).Trim()) -ErrorAction Stop}
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
  $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr); $bstr = [IntPtr]::Zero
  $secret.Dispose(); $secret = $null
  if ([string]::IsNullOrEmpty($password)) { throw 'blocked' }
  if($WriterClose){
    $read=Invoke-Cli @('db','query','--file',$writerInspectFile) $queryTimeoutMs
    if($read.started){$receipt.authenticationAttempted=$null}
    try{$receipt['writerBefore']=Read-FoundationWriterControl $read $writerPrior $false}finally{$read.text=$null}
    $receipt.authenticationAttempted=$true;$receipt.authenticationVerified=$true
    $receipt['historyReusedFromInspection']='12b99879-b66c-4aeb-ac22-93b2c2a6eee5'
    Write-NewJson $attemptFile ([ordered]@{version=1;runId=$runId;projectRef=$projectRef;windowId='df4f29ec-e2dc-4d82-a276-62a4e695e6f9';requestId='00000000-0000-4000-8000-000000000021';purpose='restricted-writer-owned-window-close';priorInspectionRunId='12b99879-b66c-4aeb-ac22-93b2c2a6eee5';createdAt=[DateTime]::UtcNow.ToString('o')})
    $receipt.writerCloseAttempted=$true
    $close=Invoke-Cli @('db','query','--file',$writerCloseFile) $queryTimeoutMs
    $receipt.writerCloseNativeExit=$close.nativeExit
    try{$null=Read-FoundationWriterControl $close $writerPrior $true;$receipt.writerCloseAcknowledged=$true}catch{}finally{$close.text=$null}
    if(-not $close.closed){throw 'blocked'}
    # Read-only reconciliation is safe even when the one Close ACK was lost.
    # The durable intent is never removed and forbids a second mutation child.
    $after=Invoke-Cli @('db','query','--file',$writerInspectFile) $queryTimeoutMs
    try{$receipt['writerAfter']=Read-FoundationWriterControl $after $writerPrior $true}finally{$after.text=$null}
    $receipt.writerRpcClosed=$true;$receipt.status=if($receipt.writerCloseAcknowledged){'writer_close_verified'}else{'writer_close_reconciled'};$exitCode=0
  }else{
  $before = Invoke-Cli @('db','query','--file',$queryFile) $queryTimeoutMs
  # A launched command with a failed/ambiguous response does not prove either
  # authentication or its absence. Only validated identity/history proves it.
  if ($before.started) { $receipt.authenticationAttempted = $null }
  $receipt.historyBefore = History-State $before
  if ($receipt.historyBefore -in @('baseline','complete')) { $receipt.authenticationAttempted = $true; $receipt.authenticationVerified = $true }
  $before.text = $null
  if($ForwardMigration){
    Invoke-FoundationForwardMigration
  }
  elseif($ArchiveFixture){
    if($receipt.historyBefore -cne 'complete'){$receipt.status='history_rejected'}
    else{
      $read=Invoke-Cli @('db','query','--file',$inspectQueryFile) $queryTimeoutMs
      try{$beforeArchive=Read-FoundationInspection $read;Assert-FoundationArchiveInspection $beforeArchive $archivePrior $false;$receipt['archiveBefore']=$beforeArchive}finally{$read.text=$null}
      Write-NewJson $attemptFile ([ordered]@{version=1;runId=$runId;projectRef=$projectRef;windowId=$archiveWindow;competitorId='d51a39f6-fe87-4d17-aee9-3070c45693aa';accountId='bd23314c-591f-4fb7-92fd-b7450634eeb6';purpose='exact-owned-fixture-archive-after-independent-close';priorInspectionRunId=$(if($TechnicalResidual16){'technical-16-closed-and-native-settled'}elseif($TechnicalResidual13){'technical-13-closed-and-runtime-restored'}else{'82f55b86-3bc8-42bd-95b4-82039af7b9fc'});createdAt=[DateTime]::UtcNow.ToString('o')})
      $receipt.archiveAttempted=$true;$archive=Invoke-Cli @('db','query','--file',$archiveFile) $queryTimeoutMs
      $receipt.archiveNativeExit=$archive.nativeExit;$receipt.archiveAcknowledged=$archive.ok -and $archive.closed;$archive.text=$null
      if(-not $archive.closed){throw 'blocked'}
      $read=Invoke-Cli @('db','query','--file',$inspectQueryFile) $queryTimeoutMs
      try{$afterArchive=Read-FoundationInspection $read;Assert-FoundationArchiveInspection $afterArchive $archivePrior $true;$receipt['archiveAfter']=$afterArchive}finally{$read.text=$null}
      $receipt.fixtureArchived=$true;$receipt.historyAfter='complete';$receipt.status=if($receipt.archiveAcknowledged){'archive_verified'}else{'archive_reconciled'};$receipt['preparationStage']='complete';$exitCode=0
    }
  }
  elseif($InspectOnly){
    if($receipt.historyBefore -cne 'complete'){$receipt.status='history_rejected'}
    else{
      Write-NewJson $attemptFile ([ordered]@{version=1;runId=$runId;projectRef=$projectRef;purpose='fixed-read-only-reconciliation';priorRunId=$(if($TechnicalResidual19){'fd9e28cc-25ed-4332-ae29-e1dfdf135a36'}elseif($TechnicalResidual16){'3412e032-4833-43c9-9342-19ea25d50275'}else{'52cd6a97-a23a-4061-a694-00c50c700b00'});createdAt=[DateTime]::UtcNow.ToString('o')})
      $inspection=Invoke-Cli @('db','query','--file',$inspectQueryFile) $queryTimeoutMs
      try{$receipt['inspection']=Read-FoundationInspection $inspection}finally{$inspection.text=$null}
      if($TechnicalResidual19){Assert-FoundationArchiveInspection $receipt.inspection $inspectExpectedBinding $true}elseif($TechnicalResidual16){Assert-FoundationArchiveInspection $receipt.inspection $inspectExpectedBinding $false}elseif($TechnicalResidual13){Assert-FoundationArchiveInspection $receipt.inspection $inspectExpectedBinding $true}
      $receipt['bindingMatchesPriorProvision']=$null
      if($null -ne $receipt.inspection.window){$receipt.bindingMatchesPriorProvision=$receipt.inspection.window.audience -ceq $inspectExpectedBinding.audience -and $receipt.inspection.window.commitSha -ceq $inspectExpectedBinding.commitSha -and $receipt.inspection.window.deploymentId -ceq $inspectExpectedBinding.deploymentId}
      $receipt.status='inspection_verified';$receipt.historyAfter='complete';$exitCode=0
    }
  }
  elseif($PostcheckContinuation){
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
  if (-not $WriterClose -and -not $ArchiveFixture -and -not $ForwardMigration -and ($consumed -or $inspectMaterialized) -and (-not $InspectOnly -or $receipt.childrenClosed)) {
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
  if($null -ne $inspectParentLock){
    try{$inspectParentLock.Dispose();if($receipt.childrenClosed -and $receipt.scratchDeleted -and ($WriterClose -or $ArchiveFixture -or $ForwardMigration -or ($receipt.handoffDeleted -and $receipt.leaseDeleted))){[IO.File]::Delete($inspectParentPath)}}catch{$exitCode=1}
    $receipt['inspectParentLockDeleted']=-not(Test-Path -LiteralPath $inspectParentPath)
  }
  if($WriterClose){$receipt.persistentWriterPreserved=Test-Path -LiteralPath $handoff}
  if($ArchiveFixture -or $ForwardMigration){$receipt.persistentAdminPreserved=Test-Path -LiteralPath $handoff}
  if (-not $receipt.childrenClosed -or (-not $WriterClose -and -not $ArchiveFixture -and -not $ForwardMigration -and $consumed -and (-not $receipt.handoffDeleted -or -not $receipt.leaseDeleted)) -or -not $receipt.scratchDeleted) { $exitCode = 1 }
  $receipt.observedAt = [DateTime]::UtcNow.ToString('o')
  try {
    if($PostcheckContinuation -or $InspectOnly -or $WriterClose -or $ArchiveFixture -or $ForwardMigration){Write-NewJson $latestFile $receipt}
    else{
      if (Test-Path -LiteralPath $latestFile) { $null = Assert-Path $repo 'scripts/db/out/m03-foundation-dev-migration-latest.json' }
      [IO.File]::WriteAllText($latestFile,($receipt | ConvertTo-Json -Depth 8))
    }
  } catch { $exitCode = 1 }
}
Write-Output ($receipt | ConvertTo-Json -Depth 8 -Compress)
exit $exitCode
