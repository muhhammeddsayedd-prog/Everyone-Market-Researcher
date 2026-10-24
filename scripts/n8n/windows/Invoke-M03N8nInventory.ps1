[CmdletBinding()]
param([switch]$CheckOnly,[switch]$WorkflowBaselineDiagnostic,[switch]$Wf70DiscoveryDiagnostic,[switch]$MachineMetadataDiagnostic)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
$fixedHost = 'muhhammedsayed.app.n8n.cloud'
$projectId = 'pHvQjDmjxVZ3KQLT'
$files = @('scripts/n8n/windows/New-M03N8nApiHandoff.ps1','scripts/n8n/windows/Invoke-M03N8nInventory.ps1','scripts/n8n/inventory.mjs')
$baselineFiles = @('scripts/n8n/foundation-runtime-checkpoint.mjs','n8n/workflows/WF-00.json','scripts/n8n/windows/Dev-CredentialStore.ps1')
$baselineFailureCodes = @('expected_shape','dto_shape','workflow_id','archive_state','activation_state','active_version','version_shape','version_mismatch','owner_project','tags_shape','tags_mismatch','pinned_data','graph_shape','node_shape','graph_name','graph_nodes','graph_connections','graph_settings')
$childTimeoutMs = 75000
$middleDot = [string][char]0x00b7
$credentialCandidates = @(
  [PSCustomObject]@{key='postgres';id='3ZZtc9kMDcminv6w';name="Supabase Postgres $middleDot n8n_writer $middleDot dev";type='postgres'},
  [PSCustomObject]@{key='apify';id='EYmaOt0rd45ysq0J';name='Apify account';type='apifyApi'},
  [PSCustomObject]@{key='openai';id='e04LREfPBELWQQ9D';name='OpenAI account';type='openAiApi'},
  [PSCustomObject]@{key='vimeo';id='HeZBOZhFMeFYOC0N';name='Vimeo Token';type='httpHeaderAuth'},
  [PSCustomObject]@{key='youtube';id='ltvBSloVLGVeUjqV';name='YouTube Data API key';type='httpHeaderAuth'}
)
$workflowNames = @("SUB $middleDot Start run [dev]","SUB $middleDot Finish run [dev]","SUB $middleDot Ingest items [dev]","SUB $middleDot Log cost [dev]","SUB $middleDot Notify [dev]",
  "WF-00 $middleDot Orchestrator [dev]","WF-19 $middleDot Apify run callback [dev]","WF-90 $middleDot Error handler [dev]","WF-91 $middleDot Health & cost [dev]","WF-99 $middleDot Foundation smoke test [dev]",
  "WF-10 $middleDot Vimeo collector [dev]","WF-11 $middleDot Instagram posts/reels collector [dev]","WF-12 $middleDot Instagram stories collector [dev]","WF-13 $middleDot YouTube collector [dev]",
  "WF-18 $middleDot LinkedIn posts collector [dev]","WF-18b $middleDot LinkedIn employees [dev]","WF-21 $middleDot Websites collector [dev]","WF-22 $middleDot News [dev]","WF-23 $middleDot Awards and trade [dev]",
  "WF-30 $middleDot AI extractor [dev]","WF-32 $middleDot Campaign linker [dev]","WF-40 $middleDot Removal check [dev]","WF-50 $middleDot Weekly briefs [dev]","WF-70 $middleDot Publish / revalidate [dev]","WF-80 $middleDot Alerts [dev]")
$capabilityNames = @('workflowList','workflowRead','workflowCreate','workflowUpdate','workflowPublish','workflowUnpublish','credentialList','credentialRead','credentialTest','projectList')
function Assert-Keys($Value,[string[]]$Expected) {
  if ($Value -isnot [PSCustomObject] -or @(Compare-Object -ReferenceObject @($Expected | Sort-Object) -DifferenceObject @($Value.PSObject.Properties.Name | Sort-Object)).Count -ne 0) { throw 'blocked' }
}
function Confined-File([string]$Root,[string]$Relative) {
  $rootEntry = Get-Item -LiteralPath $Root -Force
  if (-not $rootEntry.PSIsContainer -or ($rootEntry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
      [IO.Path]::IsPathRooted($Relative) -or $Relative -match '(?:^|[/\\])\.\.(?:[/\\]|$)|[:\x00]') { throw 'blocked' }
  $file = [IO.Path]::GetFullPath((Join-Path $Root $Relative))
  if (-not $file.StartsWith($Root + '\',[StringComparison]::OrdinalIgnoreCase)) { throw 'blocked' }
  $cursor = $Root
  foreach ($segment in ($Relative -split '[/\\]')) {
    $cursor = Join-Path $cursor $segment
    $entry = Get-Item -LiteralPath $cursor -Force
    if (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'blocked' }
  }
  if ($entry.PSIsContainer) { throw 'blocked' }
  return $file
}
function Validate-Diagnostics($Value,[int]$RequestCount,[string[]]$AllowedResources=@('discover','projects','workflows','credentials'),[bool]$AllowUnissued=$false) {
  Assert-Keys $Value @('version','dns','requests')
  if ($Value.version -ne 1 -or $Value.dns -cnotin @('not_attempted','resolving','complete','failed','timeout') -or
      $Value.requests -isnot [Array] -or ((-not $AllowUnissued -and $Value.requests.Count -ne $RequestCount) -or $Value.requests.Count -gt $RequestCount) -or $Value.requests.Count -gt 7) { throw 'blocked' }
  foreach ($row in $Value.requests) {
    Assert-Keys $row @('resource','page','tcpConnected','tlsVerified','httpStatus','bodyRead','jsonParsed','schemaValidated','socketClosed','failureStage','failureCode')
    if ($row.resource -cnotin $AllowedResources -or $row.page -isnot [int] -or $row.page -lt 1 -or $row.page -gt 2 -or
        ($null -ne $row.tcpConnected -and $row.tcpConnected -isnot [bool]) -or ($null -ne $row.tlsVerified -and $row.tlsVerified -isnot [bool]) -or
        ($null -ne $row.httpStatus -and ($row.httpStatus -isnot [int] -or $row.httpStatus -lt 100 -or $row.httpStatus -gt 599)) -or
        $row.bodyRead -cnotin @('not_observed','reading','complete','aborted','truncated','failed','too_large','timed_out') -or
        $row.jsonParsed -isnot [bool] -or $row.schemaValidated -isnot [bool] -or $row.socketClosed -isnot [bool] -or
        $row.failureStage -cnotin @('none','unknown','connect','tls','status','body_read','parse','schema') -or
        $row.failureCode -cnotin @('none','connection_refused','connection_reset','timeout','tls_untrusted','tls_expired','tls_hostname','network_failed','body_too_large','body_failed','body_aborted','body_truncated','invalid_json','invalid_schema','redirect_refused','unauthorized','http_failed','confidentiality_rejected') -or
        ($row.schemaValidated -and (-not $row.jsonParsed -or $row.httpStatus -ne 200)) -or ($row.jsonParsed -and $row.bodyRead -cne 'complete')) { throw 'blocked' }
  }
}
function Validate-Wf70Discovery($Value) {
  Assert-Keys $Value @('version','environment','host','projectId','workflowKey','status','transportAdapter','requestCount','maximumRequests','authenticationVerified','paginationComplete','candidateCount','adoptionProven','drainProven','readerFailure','networkCompletionVerified','diagnostics')
  if($Value.version -ne 1 -or $Value.environment -cne 'dev' -or $Value.host -cne $fixedHost -or $Value.projectId -cne $projectId -or $Value.workflowKey -cne 'WF-70' -or $Value.status -cnotin @('discovery_complete','discovery_failed','missing_key','invalid_key','invalid_options') -or $Value.transportAdapter -cne 'inventory_bounded_get_adapter' -or $Value.maximumRequests -ne 4 -or $Value.requestCount -isnot [int] -or $Value.requestCount -lt 0 -or $Value.requestCount -gt 4 -or ($null -ne $Value.candidateCount -and ($Value.candidateCount -isnot [int] -or $Value.candidateCount -lt 0 -or $Value.candidateCount -gt 480))){throw 'blocked'}
  foreach($name in @('authenticationVerified','paginationComplete','adoptionProven','drainProven','networkCompletionVerified')){if($Value.$name -isnot [bool]){throw 'blocked'}}
  if($Value.adoptionProven -or $Value.drainProven){throw 'blocked'}
  Validate-Diagnostics $Value.diagnostics $Value.requestCount @('executions') $true
  if($Value.authenticationVerified -and @($Value.diagnostics.requests|Where-Object{$_.httpStatus -eq 200 -and $_.tlsVerified -eq $true}).Count -eq 0){throw 'blocked'}
  if($Value.status -ceq 'discovery_complete' -and (-not $Value.paginationComplete -or $null -eq $Value.candidateCount -or $null -ne $Value.readerFailure -or -not $Value.networkCompletionVerified -or $Value.requestCount -lt 2 -or $Value.diagnostics.requests.Count -ne $Value.requestCount)){throw 'blocked'}
  if($null -ne $Value.readerFailure){
    $f=$Value.readerFailure;Assert-Keys $f @('version','workflowKey','operation','stage','classification','code','httpStatus')
    $codes=@('ADMISSION','DEADLINE','REJECTED','TRANSPORT_SHAPE','FRAMING','RESPONSE_LIMIT','STREAM','TRUNCATED','JSON','NATIVE_SIZE_LIMIT','SENSITIVE_REFLECTION','STRUCTURE','CLOSE','DISCOVERY','METADATA','TIMES','DISCOVERY_CHANGED','DISCOVERY_CURSOR','DISCOVERY_INCOMPLETE')
    if($f.version -ne 1 -or $f.workflowKey -cne 'WF-70' -or $f.operation -cne 'discovery' -or $f.stage -cnotin @('unknown','admission','request','framing','body','parse','projection','close','http_status') -or $f.classification -cnotin @('unknown','contract','http','timeout','closure','confidentiality','parse','framing') -or $f.code -cnotin $codes -or ($null -ne $f.httpStatus -and ($f.httpStatus -isnot [int] -or $f.httpStatus -lt 100 -or $f.httpStatus -gt 599))){throw 'blocked'}
  }
}
function Assert-Wf70DiscoveryPublic {
  $relative='milestones/M03-n8n-foundation/evidence/dev-acceptance-technical6-reconciliation-20261024.json'
  $path=Confined-File $repo $relative
  if((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -cne '258a6c7d15c59323f4e95c5315d42d839f735ea40d70834b8aa171ff00b9ca66'){throw 'blocked'}
  $actual=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($path))
  if($actual.usage.management -ne 152 -or $actual.usage.control -ne 382 -or $actual.usage.combined -ne 534 -or $actual.usage.control+4 -gt 2048 -or $actual.usage.combined+4 -gt 2560 -or -not $actual.actualCleanup.bothProcessesDead -or -not $actual.actualCleanup.parentLockAbsent -or -not $actual.actualCleanup.persistentOriginalsUntouched){throw 'blocked'}
  foreach($name in @('management','control','setup','preflight','runtime')){
    $expected=$actual.actualPublicJournals.$name
    if($expected.path -cne ('scripts/n8n/out/foundation/live/'+$name+'.jsonl')){throw 'blocked'}
    $journal=Confined-File $repo $expected.path
    if((Get-FileHash -LiteralPath $journal -Algorithm SHA256).Hash.ToLowerInvariant() -cne $expected.sha256){throw 'blocked'}
  }
  $closed=Confined-File $repo $actual.immutableTechnicalRecords.closed.path
  if((Get-FileHash -LiteralPath $closed -Algorithm SHA256).Hash.ToLowerInvariant() -cne $actual.immutableTechnicalRecords.closed.sha256){throw 'blocked'}
  if(Test-Path -LiteralPath (Join-Path $repo 'scripts/n8n/out/foundation/wf70-discovery-diagnostic-20261024.jsonl')){throw 'blocked'}
  # Reuse the reviewed executable closure, including Zod/native-reader imports;
  # no builder or private metadata is run to obtain it.
  $acceptance=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText((Confined-File $repo 'scripts/n8n/foundation-acceptance-seal.json')))
  $module=Confined-File $repo 'scripts/n8n/windows/Acceptance-PublicRuntime.ps1'
  if((Get-FileHash -LiteralPath $module -Algorithm SHA256).Hash.ToLowerInvariant() -cne $acceptance.files.'scripts/n8n/windows/Acceptance-PublicRuntime.ps1'){throw 'blocked'}
  . $module
  return Assert-M03AcceptancePublicSeal $repo $acceptance
}
function New-Wf70DiscoveryBudget {
  $path=Join-Path $repo 'scripts/n8n/out/foundation/wf70-discovery-diagnostic-20261024.jsonl'
  $header=[ordered]@{kind='m03_wf70_discovery_budget';version=1;receiptSha256='258a6c7d15c59323f4e95c5315d42d839f735ea40d70834b8aa171ff00b9ca66';managementAttempts=152;controlAttempts=382;combinedAttempts=534;maximumRequests=4;parentProcessId=$PID}
  $stream=$null;$bytes=$null
  try{$stream=[IO.File]::Open($path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read);$bytes=[Text.UTF8Encoding]::new($false).GetBytes(($header|ConvertTo-Json -Compress)+"`n");$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true)}finally{if($null -ne $stream){$stream.Dispose()};if($null -ne $bytes){[Array]::Clear($bytes,0,$bytes.Length)}}
}
function Validate-Inventory($Value) {
  Assert-Keys $Value @('version','environment','host','projectId','status','requestCount','authenticationVerified','projectVerified','capabilities','manualExecutionSupportedByReviewedPublicApi','resources','diagnostics')
  if ($Value.version -ne 1 -or $Value.environment -cne 'dev' -or $Value.host -cne $fixedHost -or $Value.projectId -cne $projectId -or
      $Value.status -cnotin @('complete','partial','missing_key','invalid_key','invalid_options','unsafe_dns','timeout','unauthorized','redirect_refused','response_rejected','network_failed','http_failed','body_too_large','confidentiality_rejected') -or
      $Value.requestCount -isnot [int] -or $Value.requestCount -lt 0 -or $Value.requestCount -gt 7 -or $Value.authenticationVerified -isnot [bool] -or $Value.projectVerified -isnot [bool] -or
      $Value.manualExecutionSupportedByReviewedPublicApi -isnot [bool] -or $Value.manualExecutionSupportedByReviewedPublicApi) { throw 'blocked' }
  Validate-Diagnostics $Value.diagnostics $Value.requestCount
  Assert-Keys $Value.capabilities $capabilityNames
  foreach ($name in $capabilityNames) { if ($Value.capabilities.$name -isnot [bool]) { throw 'blocked' } }
  Assert-Keys $Value.resources @('projects','workflows','credentials')
  foreach ($resource in @('projects','workflows','credentials')) {
    $section = $Value.resources.$resource
    Assert-Keys $section @('status','httpStatus','count','unknownCount','known')
    if ($section.status -cnotin @('not_attempted','complete','forbidden','http_failed','response_rejected','page_limit') -or
        ($null -ne $section.httpStatus -and ($section.httpStatus -isnot [int] -or $section.httpStatus -lt 100 -or $section.httpStatus -gt 599)) -or
        $section.count -isnot [int] -or $section.count -lt 0 -or $section.count -gt 200 -or $section.unknownCount -isnot [int] -or $section.unknownCount -lt 0 -or $section.unknownCount -gt 200 -or
        $section.known -isnot [Array] -or $section.known.Count -gt 25) { throw 'blocked' }
    $seen = @{}
    foreach ($row in $section.known) {
      if ($row.id -isnot [string] -or $row.id -cnotmatch '^[A-Za-z0-9_-]{1,128}$' -or $seen.ContainsKey($row.id)) { throw 'blocked' }
      $seen[$row.id] = $true
      if ($resource -eq 'projects') {
        Assert-Keys $row @('id','type')
        if ($row.id -cne $projectId -or $row.type -cne 'personal') { throw 'blocked' }
      } elseif ($resource -eq 'credentials') {
        Assert-Keys $row @('name','id','type')
        $candidate = @($credentialCandidates | Where-Object { $_.id -ceq $row.id })
        if ($candidate.Count -ne 1 -or $row.name -cne $candidate[0].name -or $row.type -cne $candidate[0].type) { throw 'blocked' }
      } else {
        Assert-Keys $row @('name','id','active','archived')
        if ($row.name -cnotin $workflowNames -or $row.active -isnot [bool] -or $row.archived -isnot [bool]) { throw 'blocked' }
      }
    }
  }
}
function Validate-BaselineDiagnostic($Value) {
  Assert-Keys $Value @('version','environment','host','projectId','status','requestCount','authenticationVerified','projectVerified','workflowKey','baseline','forensics','diagnostics')
  if($Value.version -ne 1 -or $Value.environment -cne 'dev' -or $Value.host -cne $fixedHost -or $Value.projectId -cne $projectId -or $Value.workflowKey -cne 'WF-00' -or $Value.status -cnotin @('matching_baseline','baseline_mismatch','missing_key','invalid_key','invalid_options','unsafe_dns','timeout','unauthorized','redirect_refused','response_rejected','network_failed','http_failed','body_too_large','confidentiality_rejected') -or $Value.requestCount -isnot [int] -or $Value.requestCount -lt 0 -or $Value.requestCount -gt 1 -or $Value.authenticationVerified -isnot [bool] -or $Value.projectVerified -isnot [bool]){throw 'blocked'}
  Validate-Diagnostics $Value.diagnostics $Value.requestCount
  foreach($row in $Value.diagnostics.requests){if($row.resource -cne 'workflows' -or $row.page -ne 1){throw 'blocked'}}
  if($Value.status -cin @('matching_baseline','baseline_mismatch')){
    if($Value.requestCount -ne 1 -or -not $Value.authenticationVerified -or -not $Value.diagnostics.requests[0].socketClosed){throw 'blocked'}
    Assert-Keys $Value.baseline @('version','workflowKey','failedChecks','components')
    if($Value.baseline.version -ne 1 -or $Value.baseline.workflowKey -cne 'WF-00' -or $Value.baseline.failedChecks -isnot [Array] -or $Value.baseline.failedChecks.Count -gt $baselineFailureCodes.Count){throw 'blocked'}
    $seen=@{}
    foreach($code in $Value.baseline.failedChecks){if($code -isnot [string] -or $code -cnotin $baselineFailureCodes -or $seen.ContainsKey($code)){throw 'blocked'};$seen[$code]=$true}
    Assert-Keys $Value.baseline.components @('nameEqual','nodesEqual','connectionsEqual','settingsEqual')
    foreach($name in @('nameEqual','nodesEqual','connectionsEqual','settingsEqual')){if($Value.baseline.components.$name -isnot [bool]){throw 'blocked'}}
    if(($Value.status -ceq 'matching_baseline') -ne ($Value.baseline.failedChecks.Count -eq 0)){throw 'blocked'}
    if($Value.status -ceq 'matching_baseline' -and (-not $Value.projectVerified -or @($Value.baseline.components.PSObject.Properties.Value | Where-Object {$_ -ne $true}).Count -gt 0)){throw 'blocked'}
    if($null -ne $Value.forensics){
      Assert-Keys $Value.forensics @('nodeCategories','settingsCategories','knownVariants')
      Assert-Keys $Value.forensics.nodeCategories @('identityEqual','parametersEqual','credentialsEqual','behaviorEqual','layoutEqual','annotationsEqual')
      Assert-Keys $Value.forensics.settingsCategories @('retentionEqual','mcpVisibilityEqual','errorRoutingEqual','otherEqual')
      Assert-Keys $Value.forensics.knownVariants @('c01RetentionSettingsEqual','c01RuntimeSettingsEqual','c01ManualSettingsEqual','stagingMcpSettingsEqual','stagingManualSettingsEqual','schedulesDisabledNodesEqual','c01RetentionGraphEqual','stagedManualGraphEqual','stagedC01ManualGraphEqual')
      foreach($group in $Value.forensics.PSObject.Properties.Value){foreach($property in $group.PSObject.Properties){if($property.Value -isnot [bool]){throw 'blocked'}}}
    }elseif($Value.status -ceq 'matching_baseline'){throw 'blocked'}
  }elseif($null -ne $Value.baseline -or $null -ne $Value.forensics){throw 'blocked'}
}
function Assert-NoKeyReflection($Value,[string]$PrivateKey) {
  if ($Value -is [string]) { if ($Value.Contains($PrivateKey)) { throw 'blocked' }; return }
  if ($Value -is [Array]) { foreach ($item in $Value) { Assert-NoKeyReflection $item $PrivateKey }; return }
  if ($Value -is [PSCustomObject]) { foreach ($property in $Value.PSObject.Properties) { Assert-NoKeyReflection $property.Value $PrivateKey } }
}
function Validate-MachineMetadataDiagnostic($Value) {
  Assert-Keys $Value @('version','environment','host','projectId','credentialId','expectedCreatedAt','status','requestCount','httpStatus','authenticationVerified','networkCompletionVerified','metadata','diagnostics')
  if($Value.version -ne 1 -or $Value.environment -cne 'dev' -or $Value.host -cne $fixedHost -or $Value.projectId -cne $projectId -or $Value.credentialId -cne 'EmrM03Machine19' -or $Value.expectedCreatedAt -cne '2026-10-19T00:25:21.669Z' -or $Value.status -cnotin @('metadata_observed','missing_key','invalid_key','invalid_options','budget_blocked','unsafe_dns','timeout','unauthorized','redirect_refused','response_rejected','network_failed','http_failed','body_too_large') -or $Value.requestCount -isnot [int] -or $Value.requestCount -lt 0 -or $Value.requestCount -gt 1 -or $Value.authenticationVerified -isnot [bool] -or $Value.networkCompletionVerified -isnot [bool] -or ($null -ne $Value.httpStatus -and ($Value.httpStatus -isnot [int] -or $Value.httpStatus -lt 100 -or $Value.httpStatus -gt 599))){throw 'blocked'}
  Validate-Diagnostics $Value.diagnostics $Value.requestCount @('credentials')
  if($Value.requestCount -eq 1){$d=$Value.diagnostics.requests[0];if($d.page -ne 1 -or $d.httpStatus -ne $Value.httpStatus -or $d.socketClosed -ne $Value.networkCompletionVerified){throw 'blocked'}}
  if($Value.authenticationVerified -and ($Value.httpStatus -ne 200 -or $Value.requestCount -ne 1 -or $Value.diagnostics.requests[0].tlsVerified -ne $true)){throw 'blocked'}
  if($Value.status -ceq 'metadata_observed'){
    if($Value.requestCount -ne 1 -or $Value.httpStatus -ne 200 -or -not $Value.authenticationVerified -or -not $Value.networkCompletionVerified -or -not $Value.diagnostics.requests[0].jsonParsed){throw 'blocked'}
    Assert-Keys $Value.metadata @('objectShape','dataPresent','idMatches','nameMatches','typeMatches','createdAtMatches','updatedAtValid','flagsCompatible','resolverCompatible','updatedAtMatchesCreatedAt')
    foreach($property in $Value.metadata.PSObject.Properties){if($property.Value -isnot [bool]){throw 'blocked'}}
  }elseif($null -ne $Value.metadata){throw 'blocked'}
}
try {
  if(@($WorkflowBaselineDiagnostic,$Wf70DiscoveryDiagnostic,$MachineMetadataDiagnostic|Where-Object{$_}).Count -gt 1){throw 'blocked'}
  $sealPath = Confined-File $repo 'scripts/n8n/m03-inventory-seal.json'
  if ((Get-Item -LiteralPath $sealPath).Length -gt 32768) { throw 'blocked' }
  $seal = ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($sealPath)) -ErrorAction Stop
  if($null -ne $seal.PSObject.Properties['baselineFiles']){Assert-Keys $seal @('version','host','projectId','files','baselineFiles')}else{Assert-Keys $seal @('version','host','projectId','files')}
  if ($seal.version -ne 1 -or $seal.host -cne $fixedHost -or $seal.projectId -cne $projectId) { throw 'blocked' }
  Assert-Keys $seal.files $files
  foreach ($name in $files) {
    if ($seal.files.$name -isnot [string] -or $seal.files.$name -cnotmatch '^[a-f0-9]{64}$' -or
        (Get-FileHash -LiteralPath (Confined-File $repo $name) -Algorithm SHA256).Hash.ToLowerInvariant() -cne $seal.files.$name) { throw 'blocked' }
  }
  if($WorkflowBaselineDiagnostic -or $MachineMetadataDiagnostic){
    Assert-Keys $seal.baselineFiles $baselineFiles
    foreach($name in $baselineFiles){if($seal.baselineFiles.$name -isnot [string] -or $seal.baselineFiles.$name -cnotmatch '^[a-f0-9]{64}$' -or (Get-FileHash -LiteralPath (Confined-File $repo $name) -Algorithm SHA256).Hash.ToLowerInvariant() -cne $seal.baselineFiles.$name){throw 'blocked'}}
  }
  $node = (Get-Command node.exe -CommandType Application -ErrorAction Stop).Source
  if($Wf70DiscoveryDiagnostic){$node=Assert-Wf70DiscoveryPublic}
  $runner = Confined-File $repo 'scripts/n8n/inventory.mjs'
} catch { Write-Output 'M03 N8N_PREFLIGHT_BLOCKED. No private file read, decryption or API request.'; exit 1 }
$readOnlyLock=$null;$readOnlyLockPath=$null;$readOnlyLockOwned=$false;$readOnlyHandoffPrepared=$false
if($WorkflowBaselineDiagnostic -and $CheckOnly){Write-Output 'M03 N8N_BASELINE_CHECK_ONLY_READY. One fixed owned WF-00 GET; public sources verified. No private read, decryption, runtime admission or network.';exit 0}
if($Wf70DiscoveryDiagnostic -and $CheckOnly){Write-Output 'M03 N8N_WF70_CHECK_ONLY_READY. Fixed WF-70 metadata discovery, at most four charged GETs; public scope, cumulative budget and sources verified. No private read, decryption or network.';exit 0}
if($MachineMetadataDiagnostic -and $CheckOnly){Write-Output 'M03 N8N_MACHINE_METADATA_CHECK_ONLY_READY. One fixed owned Machine metadata GET; public sources verified. No private read, decryption, ledger debit, runtime admission or network.';exit 0}
try {
  if($Wf70DiscoveryDiagnostic){New-Wf70DiscoveryBudget}
  if ([string]::IsNullOrEmpty($env:LOCALAPPDATA)) { throw 'blocked' }
  $privateRoot = [IO.Path]::GetFullPath($env:LOCALAPPDATA)
  if($WorkflowBaselineDiagnostic -or $Wf70DiscoveryDiagnostic -or $MachineMetadataDiagnostic){
    . (Confined-File $repo 'scripts/n8n/windows/Dev-CredentialStore.ps1')
    $null=Assert-M03DevPlainPath (Join-Path $privateRoot 'Temp') $true
    $readOnlyLockPath=Join-Path $privateRoot 'Temp/emr-m03-acceptance-parent.operation.lock'
    $readOnlyLock=[IO.File]::Open($readOnlyLockPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read);$readOnlyLockOwned=$true
    $lockBytes=[Text.UTF8Encoding]::new($false).GetBytes((([ordered]@{kind='m03_read_only_inspect_parent';version=1;processId=$PID})|ConvertTo-Json -Compress))
    $readOnlyLock.Write($lockBytes,0,$lockBytes.Length);$readOnlyLock.Flush($true)
    Ensure-M03DevReadOnlyHandoff -Kind Management -CoordinatorLock $readOnlyLock
    $readOnlyHandoffPrepared=$true
  }
  $handoff = Join-Path $privateRoot 'Temp/emr-m03-n8n-api-key.dpapi'
  if (-not (Test-Path -LiteralPath $handoff -PathType Leaf)) { Write-Output 'M03 N8N_HANDOFF_MISSING. No private file read, decryption or API request.'; exit 2 }
  $handoff = Confined-File $privateRoot 'Temp/emr-m03-n8n-api-key.dpapi'
  if ((Get-Item -LiteralPath $handoff).Length -gt 32768) { throw 'blocked' }
} catch {
  if($readOnlyHandoffPrepared){try{[IO.File]::Delete((Join-Path $privateRoot 'Temp/emr-m03-n8n-api-key.dpapi'))}catch{}}
  if($null -ne $readOnlyLock){$readOnlyLock.Dispose();$readOnlyLock=$null}
  if($readOnlyLockOwned){try{[IO.File]::Delete($readOnlyLockPath)}catch{}}
  Write-Output 'M03 N8N_HANDOFF_PATH_BLOCKED. No decryption or API request.'; exit 1
}
if ($CheckOnly) { Write-Output 'M03 N8N_CHECK_ONLY_READY. Fixed instance/Personal project, public seals and encrypted handoff presence verified. Authentication not tested; no decryption or network.'; exit 0 }

$receipt = [ordered]@{version=1;host=$fixedHost;projectId=$projectId;status='private_process_failed';nativeExit=$null;childClosed=$true;handoffDeleted=$false;inventory=$null}
$secret = $null; $key = $null; $bstr = [IntPtr]::Zero; $consumed = $false
$start = $null; $child = $null; $started = $false; $closed = $true; $memory = $null; $buffer = $null; $stdout = $null; $stderr = $null
$exitCode = 1
try {
  $null = Confined-File $privateRoot 'Temp/emr-m03-n8n-api-key.dpapi'
  $consumed = $true
  $secret = ConvertTo-SecureString -String ([IO.File]::ReadAllText($handoff).Trim()) -ErrorAction Stop
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
  $key = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr); $bstr = [IntPtr]::Zero
  $secret.Dispose(); $secret = $null
  if ([string]::IsNullOrEmpty($key) -or $key.Length -gt 4096 -or $key -cmatch '[^\x21-\x7e]') { throw 'blocked' }
  if ($runner -match '["\r\n\x00]') { throw 'blocked' }
  $start = New-Object Diagnostics.ProcessStartInfo
  $start.FileName = $node; $start.Arguments = '"' + $runner + '"'; $start.WorkingDirectory = $repo
  if($WorkflowBaselineDiagnostic){$start.Arguments+=' --workflow-baseline-diagnostic'}
  if($Wf70DiscoveryDiagnostic){$start.Arguments+=' --wf70-discovery-diagnostic'}
  if($MachineMetadataDiagnostic){$start.Arguments+=' --machine-metadata-diagnostic'}
  $start.UseShellExecute = $false; $start.CreateNoWindow = $true; $start.RedirectStandardOutput = $true; $start.RedirectStandardError = $true
  $start.EnvironmentVariables.Clear()
  foreach ($name in @('SystemRoot','WINDIR','PATH','TEMP','TMP','LOCALAPPDATA','APPDATA','USERPROFILE')) {
    $value = [Environment]::GetEnvironmentVariable($name,'Process')
    if ($null -ne $value) { $start.EnvironmentVariables[$name] = $value }
  }
  $start.EnvironmentVariables['M03_N8N_API_KEY'] = $key
  $child = New-Object Diagnostics.Process; $child.StartInfo = $start
  $started = $child.Start()
  if (-not $started) { throw 'blocked' }
  $closed = $false; $start.EnvironmentVariables.Clear()
  $buffer = New-Object byte[] 32768; $memory = [IO.MemoryStream]::new([byte[]]$buffer,$true)
  $stdout = $child.StandardOutput.BaseStream.CopyToAsync($memory)
  $stderr = $child.StandardError.BaseStream.CopyToAsync([IO.Stream]::Null)
  if (-not $child.WaitForExit($childTimeoutMs)) { throw 'blocked' }
  $closed = $true; $receipt.nativeExit = $child.ExitCode
  if (-not [Threading.Tasks.Task]::WhenAll([Threading.Tasks.Task[]]@($stdout,$stderr)).Wait(5000)) { throw 'blocked' }
  $text = [Text.Encoding]::UTF8.GetString($buffer,0,[int]$memory.Position)
  $inventory = ConvertFrom-Json -InputObject $text -ErrorAction Stop
  Assert-NoKeyReflection $inventory $key
  if($MachineMetadataDiagnostic){Validate-MachineMetadataDiagnostic $inventory}elseif($Wf70DiscoveryDiagnostic){Validate-Wf70Discovery $inventory}elseif($WorkflowBaselineDiagnostic){Validate-BaselineDiagnostic $inventory}else{Validate-Inventory $inventory}
  if (($receipt.nativeExit -eq 0) -ne ($inventory.status -in @('complete','partial','matching_baseline','baseline_mismatch','discovery_complete','metadata_observed'))) { throw 'blocked' }
  $receipt.inventory = $inventory
  $receipt.status = 'inventory_failed'
  if ($receipt.nativeExit -eq 0) { $receipt.status = 'complete'; $exitCode = 0 }
} catch {
  # Never print raw child output, private exceptions or credential values.
} finally {
  if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
  if ($null -ne $secret) { $secret.Dispose() }
  $secret = $null; $key = $null; $text = $null; $inventory = $null
  if ($null -ne $start) { $start.EnvironmentVariables.Clear() }
  if ($null -ne $child) {
    if ($started -and -not $closed) {
      try { if (-not $child.WaitForExit(0)) { $child.Kill() }; $closed = $child.WaitForExit(5000); if ($closed) { $receipt.nativeExit = $child.ExitCode } } catch { $closed = $false }
    }
    try { $child.Dispose() } catch { $exitCode = 1 }
  }
  if ($null -ne $stdout -and $null -ne $stderr) { try { $null = [Threading.Tasks.Task]::WhenAll([Threading.Tasks.Task[]]@($stdout,$stderr)).Wait(5000) } catch { $exitCode = 1 } }
  if ($null -ne $memory) { $memory.Dispose() }
  if ($null -ne $buffer) { [Array]::Clear($buffer,0,$buffer.Length) }
  $receipt.childClosed = $closed
  if ($consumed -and $closed) { try { [IO.File]::Delete($handoff); $receipt.handoffDeleted = -not (Test-Path -LiteralPath $handoff) } catch { $receipt.handoffDeleted = $false } }
  if (-not $closed -or ($consumed -and -not $receipt.handoffDeleted)) { $exitCode = 1 }
  if($null -ne $readOnlyLock){$readOnlyLock.Dispose();$readOnlyLock=$null}
  # Retain the marker and encrypted runtime copy when native closure is unknown.
  # A future coordinator must reconcile that child; it may not overlap it.
  if($readOnlyLockOwned -and $closed){try{[IO.File]::Delete($readOnlyLockPath);if(Test-Path -LiteralPath $readOnlyLockPath){$exitCode=1}}catch{$exitCode=1}}
}
Write-Output ($receipt | ConvertTo-Json -Depth 12 -Compress)
exit $exitCode
