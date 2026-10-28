[CmdletBinding()]
param(
  [ValidateSet('Preflight','Apply','Postcheck','Query')][string]$Phase='Preflight',
  [string]$QueryFile='',
  [string]$QuerySha256='',
  [ValidateSet('Representative','Incremental','HC01','M05')][string]$Scope='Representative',
  [switch]$ReadOnly,
  [switch]$CheckOnly
)

# M04 product database operations, not an acceptance supervisor. The coordinator
# reviews public SQL before Query; only the selected bounded database child
# receives Admin (native CLI for migrations/advisors; pg for transaction bodies).
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
$project='zmotjsbzhzjvpelxvxlf'
$hostName='aws-1-eu-central-1.pooler.supabase.com'
$password=$null;$secret=$null;$cipherBytes=$null;$bstr=[IntPtr]::Zero
$scratch=$null;$lock=$null;$lockPath=$null;$cliPath=$null;$dbUri=$null;$queryRunnerLock=$null
$receipt=[ordered]@{version=1;phase=$Phase;environment='dev';projectRef=$project;host=$hostName;port=5432;
  status='public_preflight_blocked';privateRead=$false;authenticationAttempted=$false;authenticationVerified=$false;
  databaseCommands=0;childrenClosed=$true;persistentAdminPreserved=$true;scratchDeleted=$true;observedAt=$null}
$pending=@(
  [pscustomobject]@{version='20261026013910';name='m04_vimeo_account_resolution';file='supabase/migrations/20261026013910_m04_vimeo_account_resolution.sql';sha256='e2fa1cbf59b2e010b8b76caff6a34c5a752074e1e843071c36463c5a1a9717c1';historySha256='9391ae1b1f029e2ea9aa93b812a80b46f9f5abd8fe6245c05da1703bfcf2b56c'},
  [pscustomobject]@{version='20261027092832';name='m04_collector_product_contracts';file='supabase/migrations/20261027092832_m04_collector_product_contracts.sql';sha256='19eb07af9446189496cde17d1b9a735b99816c5008c37588d38cddbc41e6a05a';historySha256='7f036a391743189b3e8031070aa4f18fbd893df7619aab92b02f6a5996b4db7f'}
)
$hc01Migration=[pscustomobject]@{version='20261027192743';name='m04_recent_instagram_dev_eligibility';file='supabase/migrations/20261027192743_m04_recent_instagram_dev_eligibility.sql';sha256='635b8303d69ab32560d5acda903fee4c4555a9b3f6f35923d4d7b3655513f61d';historySha256=$null}
$m05Migration=[pscustomobject]@{version='20261028020745';name='m05_web_youtube_linkedin';file='supabase/migrations/20261028020745_m05_web_youtube_linkedin.sql';sha256='f3ff025065106733f7c76aec963e465a045270876c642db69e131df72f6d865e';historySha256=$null}

function M04-File([string]$Path,[bool]$Directory=$false,[bool]$PinnedExecutable=$false) {
  $absolute=[IO.Path]::GetFullPath($Path)
  $entry=Get-Item -LiteralPath $absolute -Force -ErrorAction Stop
  if($entry.PSIsContainer -ne $Directory -or ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'M04_PATH_BLOCKED'}
  if(-not $Directory -and -not $PinnedExecutable -and $null -ne $entry.PSObject.Properties['LinkType'] -and $entry.LinkType -ceq 'HardLink'){throw 'M04_PATH_BLOCKED'}
  $parent=if($Directory){$entry.Parent}else{$entry.Directory}
  while($null -ne $parent){if(($parent.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'M04_PATH_BLOCKED'};$parent=$parent.Parent}
  return $absolute
}
function M04-Hash([string]$Path){return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()}
function M04-OutputDirectory {
  $null=M04-File (Join-Path $repo 'scripts/db') $true
  $path=Join-Path $repo 'scripts/db/out'
  if(-not (Test-Path -LiteralPath $path)){[IO.Directory]::CreateDirectory($path)|Out-Null}
  return M04-File $path $true
}
function M04-QueryPath([string]$Path,[string]$Hash) {
  if($Hash -cnotmatch '^[a-f0-9]{64}$' -or [string]::IsNullOrWhiteSpace($Path)){throw 'M04_QUERY_BLOCKED'}
  $evidence=if($Scope -eq 'M05'){'milestones/M05-collectors-web-youtube-linkedin/evidence'}else{'milestones/M04-collectors-vimeo-instagram/evidence'}
  $root=[IO.Path]::GetFullPath((Join-Path $repo $evidence)).TrimEnd('\')+'\'
  $absolute=[IO.Path]::GetFullPath($Path)
  if(-not $absolute.StartsWith($root,[StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetExtension($absolute) -cne '.sql'){throw 'M04_QUERY_BLOCKED'}
  $null=M04-File $absolute
  if((Get-Item -LiteralPath $absolute).Length -gt 131072 -or (M04-Hash $absolute) -cne $Hash){throw 'M04_QUERY_BLOCKED'}
  if([IO.File]::ReadAllText($absolute) -cmatch '__(?:M04|M05)_[A-Z0-9_]+__'){throw 'M04_QUERY_BLOCKED'}
  return $absolute
}

# Reuses the existing bounded native transport: cleared OS-only environment,
# password only in child environment, private capture, no native error printing.
function Invoke-M04Bounded([string]$Executable,[string[]]$Arguments,[string]$WorkingDirectory,[int]$TimeoutMs,[string]$PrivatePassword=$null) {
  $start=$null;$child=$null;$stdout=$null;$stderr=$null;$buffer=$null;$memory=$null
  $started=$false;$closed=$true;$nativeExit=$null;$text=$null;$valid=$false
  try{
    $quoted=foreach($argument in $Arguments){if($argument -match '["\r\n\x00]' -or $argument.EndsWith('\')){throw 'M04_ARGUMENT_BLOCKED'};'"'+$argument+'"'}
    $start=[Diagnostics.ProcessStartInfo]::new();$start.FileName=$Executable;$start.Arguments=$quoted -join ' '
    $start.WorkingDirectory=$WorkingDirectory;$start.UseShellExecute=$false;$start.CreateNoWindow=$true
    $start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true;$start.EnvironmentVariables.Clear()
    foreach($name in @('SystemRoot','WINDIR','PATH','TEMP','TMP','LOCALAPPDATA','APPDATA','USERPROFILE')){
      $value=[Environment]::GetEnvironmentVariable($name,'Process');if($null -ne $value){$start.EnvironmentVariables[$name]=$value}
    }
    if(-not [string]::IsNullOrEmpty($PrivatePassword)){$start.EnvironmentVariables['PGPASSWORD']=$PrivatePassword}
    $child=[Diagnostics.Process]::new();$child.StartInfo=$start;$started=$child.Start()
    if(-not $started){throw 'M04_CHILD_BLOCKED'}
    $closed=$false;$start.EnvironmentVariables.Clear()
    $buffer=New-Object byte[] 2097152;$memory=[IO.MemoryStream]::new([byte[]]$buffer,$true)
    $stdout=$child.StandardOutput.BaseStream.CopyToAsync($memory)
    $stderr=$child.StandardError.BaseStream.CopyToAsync([IO.Stream]::Null)
    if(-not $child.WaitForExit($TimeoutMs)){throw 'M04_CHILD_TIMEOUT'}
    $closed=$true;$nativeExit=$child.ExitCode
    if(-not ([Threading.Tasks.Task]::WhenAll([Threading.Tasks.Task[]]@($stdout,$stderr))).Wait(5000)){throw 'M04_CHILD_DRAIN_BLOCKED'}
    if($nativeExit -eq 0){$text=[Text.Encoding]::UTF8.GetString($buffer,0,[int]$memory.Position);$valid=$true}
  }catch{$valid=$false;$text=$null}
  finally{
    if($null -ne $start){$start.EnvironmentVariables.Clear()}
    if($null -ne $child){
      if($started -and -not $closed){try{if(-not $child.WaitForExit(0)){$child.Kill()};$closed=$child.WaitForExit(5000);if($closed){$nativeExit=$child.ExitCode}}catch{$closed=$false}}
      try{$child.Dispose()}catch{$valid=$false;$text=$null}
    }
    if($null -ne $stdout -and $null -ne $stderr){try{$null=([Threading.Tasks.Task]::WhenAll([Threading.Tasks.Task[]]@($stdout,$stderr))).Wait(5000)}catch{$valid=$false;$text=$null}}
    if($null -ne $memory){$memory.Dispose()};if($null -ne $buffer){[Array]::Clear($buffer,0,$buffer.Length)};$PrivatePassword=$null
  }
  return [pscustomobject]@{ok=$valid;started=$started;closed=$closed;nativeExit=$nativeExit;text=$text}
}
function Invoke-M04Cli([string[]]$Arguments,[int]$TimeoutMs=30000) {
  if($Phase -ceq 'Query'){throw 'M04_COMMAND_BLOCKED'}
  $key=$Arguments -join '|'
  $allowed=$key -cin @('db|push|--dry-run|--skip-vault','db|push|--skip-vault|--yes',
    'db|advisors|--type|security|--level|warn|--fail-on|warn',
    'db|advisors|--type|performance|--level|warn|--fail-on|warn')
  if($Arguments.Count -eq 4 -and $Arguments[0] -ceq 'db' -and $Arguments[1] -ceq 'query' -and $Arguments[2] -ceq '--file' -and $Arguments[3] -cin @($historyFile,$catalogFile,$queryCopy)){$allowed=$true}
  if(-not $allowed -or ($Arguments[1] -ceq 'push' -and $Phase -cne 'Apply')){throw 'M04_COMMAND_BLOCKED'}
  $flags=@('--output-format','json');if($Arguments[0] -ceq 'db' -and $Arguments[1] -ceq 'query'){$flags+=@('--output','json')}
  $receipt.databaseCommands++
  $result=Invoke-M04Bounded $cliPath ($Arguments+@('--workdir',$scratch,'--db-url',$dbUri,'--agent','no')+$flags) $scratch $TimeoutMs $password
  if($result.started){$receipt.authenticationAttempted=$true}
  if(-not $result.closed){$receipt.childrenClosed=$false}
  $receipt['lastNativeExit']=$result.nativeExit
  if(-not $result.ok -or -not $result.closed){throw 'M04_NATIVE_FAILURE'}
  if($null -ne $password -and $password.Length -gt 0 -and $result.text.Contains($password)){$result.text=$null;throw 'M04_NATIVE_OUTPUT_BLOCKED'}
  return $result
}
function Invoke-M04NativeQuery {
  if($Phase -cne 'Query' -or (M04-Hash $queryRunner) -cne $queryRunnerHash -or (M04-Hash $queryCopy) -cne $wrappedQueryHash){throw 'M04_QUERY_BLOCKED'}
  $receipt.databaseCommands++
  $result=Invoke-M04Bounded $nodePath @($queryRunner,$queryCopy,$wrappedQueryHash) $repo 40000 $password
  if($result.started){$receipt.authenticationAttempted=$true}
  if(-not $result.closed){$receipt.childrenClosed=$false}
  $receipt['lastNativeExit']=$result.nativeExit
  if(-not $result.ok -or -not $result.closed){throw 'M04_NATIVE_FAILURE'}
  try{
    if($null -ne $password -and $password.Length -gt 0 -and $result.text.Contains($password)){throw 'M04_NATIVE_OUTPUT_BLOCKED'}
    $value=M04-Json $result
    if($value.status -cnotin @('query_complete','query_failed','query_input_blocked','query_closure_unverified') -or
      $value.clientClosed -isnot [bool] -or $value.rows -isnot [Array] -or
      ($null -ne $value.sqlstate -and $value.sqlstate -cnotmatch '^[0-9A-Z]{5}$')){throw 'M04_QUERY_PROTOCOL_BLOCKED'}
    $receipt['databaseClientClosed']=$value.clientClosed;$receipt['querySqlState']=$value.sqlstate
    if(-not $value.clientClosed){throw 'M04_QUERY_CLOSURE_UNVERIFIED'}
    if($value.status -cne 'query_complete'){throw 'M04_QUERY_FAILED'}
    return $value
  }finally{$result.text=$null}
}
function M04-Json($Result) {
  try{
    $parsed=ConvertFrom-Json -InputObject $Result.text -ErrorAction Stop
    # Windows PowerShell5.1 preserves a JSON root array as one pipeline object.
    # Enumerate it explicitly so callers' @(...) produces database rows.
    if($parsed -is [Array]){foreach($row in $parsed){Write-Output $row}}else{Write-Output $parsed}
  }catch{throw 'M04_JSON_BLOCKED'}
}
function M04-History($Result) {
  $rows=@(M04-Json $Result)
  if($rows.Count -ne 1 -or $null -eq $rows[0].PSObject.Properties['receipt']){throw 'M04_HISTORY_BLOCKED'}
  $value=$rows[0].receipt
  if($value.current_user -cne 'postgres' -or $value.session_user -cne 'postgres' -or $value.database -cne 'postgres') {throw 'M04_IDENTITY_BLOCKED'}
  $history=@($value.migrations)
  if($history.Count -lt $baseline.Count -or $history.Count -gt ($baseline.Count+$pending.Count)){throw 'M04_HISTORY_BLOCKED'}
  for($i=0;$i -lt $baseline.Count;$i++){
    foreach($key in @('version','name','historySha256')){if($history[$i].$key -cne $baseline[$i].$key){throw 'M04_HISTORY_BLOCKED'}}
  }
  for($i=$baseline.Count;$i -lt $history.Count;$i++){
    $expected=$pending[$i-$baseline.Count]
    foreach($key in @('version','name')){if($history[$i].$key -cne $expected.$key){throw 'M04_HISTORY_BLOCKED'}}
    if($null -ne $expected.historySha256){if($history[$i].historySha256 -cne $expected.historySha256){throw 'M04_HISTORY_BLOCKED'}}
    elseif($history[$i].historySha256 -cnotmatch '^[a-f0-9]{64}$'){throw 'M04_HISTORY_BLOCKED'}
  }
  $receipt.authenticationVerified=$true
  return $history
}
function M04-PushMatches($Result,[bool]$DryRun) {
  $value=M04-Json $Result
  if($value.upToDate -isnot [bool] -or $value.upToDate -ne $false -or $value.dryRun -isnot [bool] -or $value.dryRun -ne $DryRun -or $value.message -cne 'Finished supabase db push.' -or
    @($value.seeds).Count -ne 0 -or @($value.roles).Count -ne 0 -or @($value.migrations).Count -ne $pending.Count){throw 'M04_PENDING_BLOCKED'}
  for($i=0;$i -lt $pending.Count;$i++){if($value.migrations[$i] -cne [IO.Path]::GetFileName($pending[$i].file)){throw 'M04_PENDING_BLOCKED'}}
}
function M04-Catalog($Result) {
  $rows=@(M04-Json $Result)
  if($rows.Count -ne 1){throw 'M04_CATALOG_BLOCKED'}
  $catalog=$rows[0].catalog
  if($catalog.identity -ne $true -or @($catalog.tables).Count -ne 6 -or @($catalog.functions).Count -ne 3){throw 'M04_CATALOG_BLOCKED'}
  if($Scope -in @('HC01','M05') -and $catalog.collectorDefinitionMd5 -cne '9d65ad95661ffd77d1d9effc3e52fa83'){throw 'M04_CATALOG_BLOCKED'}
  $tableNames=@('collector_runs','collector_accounts','collector_launches','collector_passes','collector_pages','collector_requests')
  if(@(Compare-Object -CaseSensitive @($tableNames|Sort-Object) @($catalog.tables.name|Sort-Object)).Count -ne 0){throw 'M04_CATALOG_BLOCKED'}
  foreach($table in $catalog.tables){if($table.rls -ne $true -or $table.writerTableGrant -ne $false){throw 'M04_CATALOG_BLOCKED'}}
  $functionNames=@('collector_execute','collector_finalize','set_account_external_id')
  if(@(Compare-Object -CaseSensitive @($functionNames|Sort-Object) @($catalog.functions.name|Sort-Object)).Count -ne 0){throw 'M04_CATALOG_BLOCKED'}
  foreach($function in $catalog.functions){
    if($function.definer -ne $true -or @($function.config) -cnotcontains 'search_path=""' -or
      $function.browserExecute -ne $false -or $function.anonExecute -ne $false -or $function.agentExecute -ne $false -or
      $function.writerExecute -ne ($function.name -cne 'collector_finalize')){throw 'M04_CATALOG_BLOCKED'}
  }
  $signatures=@{
    collector_execute=@('p_request_id uuid, p_operation text, p_args jsonb','jsonb',0)
    collector_finalize=@('p_run_id uuid','jsonb',0)
    set_account_external_id=@('p_account_id uuid, p_external_id text, p_uploads_playlist_id text','void',1)
  }
  foreach($function in $catalog.functions){
    $expected=$signatures[$function.name]
    if($function.identityArgs -cne $expected[0] -or $function.returns -cne $expected[1] -or $function.defaultsCount -ne $expected[2]){throw 'M04_CATALOG_BLOCKED'}
  }
  $expectedColumns=Get-M04ExpectedColumns
  foreach($table in $catalog.tables){
    $actual=@($catalog.columns|Where-Object{$_.table -ceq $table.name}|ForEach-Object{$_.name+':'+$_.type+':'+$_.nullable.ToString().ToLowerInvariant()}|Sort-Object)
    if(@(Compare-Object -CaseSensitive @($expectedColumns[$table.name]|Sort-Object) $actual).Count -ne 0){throw 'M04_CATALOG_BLOCKED'}
  }
  if($Scope -eq 'M05'){$null=M05-Catalog $catalog.m05}
  return $catalog
}
function Get-M04ExpectedColumns {
  # Same reviewed columns represented in the actual local-generated Row types.
  # Focused tests compare this fixed M04 mapping to those checked-in AST members.
  return @{
    collector_runs=@('run_id:uuid:false','registration_closed:boolean:false','created_at:timestamp with time zone:false')
    collector_accounts=@('run_id:uuid:false','account_id:uuid:false','context:jsonb:false')
    collector_launches=@('launch_id:uuid:false','run_id:uuid:false','actor_id:text:false','pass:text:false','account_ids:uuid[]:false','purpose:text:false','results_limit:integer:false','approval_id:uuid:false','max_actor_starts:integer:false','max_actor_usd:numeric:false','max_total_usd:numeric:false','apify_run_id:text:true','next_offset:integer:false','dataset_complete:boolean:false','created_at:timestamp with time zone:false')
    collector_pages=@('launch_id:uuid:false','page_offset:integer:false','args_sha256:text:false','result:jsonb:false')
    collector_passes=@('run_id:uuid:false','account_id:uuid:false','pass:text:false','launch_id:uuid:true','status:text:false','items_seen:integer:false','items_new:integer:false','stage_status:text:false','source_evidence:boolean:false','error:text:true','backfill_done:boolean:false','backfill_cursor:jsonb:true')
    collector_requests=@('request_id:uuid:false','operation:text:false','args_sha256:text:false','result:jsonb:false','created_at:timestamp with time zone:false')
  }
}

function Get-M05ExpectedColumns {
  return @{
    m05_jobs=@('launch_id:uuid:false','actor_input:jsonb:false','urls:text[]:false','crawler_type:text:true','snapshot_date:date:true','retry_of:uuid:true','max_website_urls_per_account:integer:false','settled:boolean:false','retry_pending:boolean:false','result:jsonb:true')
    m05_quota=@('quota_day:date:false','used_units:integer:false')
  }
}
function M05-Catalog($Catalog) {
  if($null -eq $Catalog -or @($Catalog.tables).Count -ne 2 -or @($Catalog.functions).Count -ne 6){throw 'M04_CATALOG_BLOCKED'}
  $mapping=Get-M05ExpectedColumns
  if(@(Compare-Object -CaseSensitive @($mapping.Keys|Sort-Object) @($Catalog.tables.name|Sort-Object)).Count){throw 'M04_CATALOG_BLOCKED'}
  foreach($table in $Catalog.tables){
    if($table.rls -ne $true -or $table.directGrant -ne $false){throw 'M04_CATALOG_BLOCKED'}
    $actual=@($Catalog.columns|Where-Object{$_.table -ceq $table.name}|ForEach-Object{$_.name+':'+$_.type+':'+$_.nullable.ToString().ToLowerInvariant()}|Sort-Object)
    if(@(Compare-Object -CaseSensitive @($mapping[$table.name]|Sort-Object) $actual).Count){throw 'M04_CATALOG_BLOCKED'}
  }
  $signatures=@{
    m05_assert_claim=@('p_run_id uuid, p_account_id uuid','app.competitor_accounts',0,$false)
    mark_website_page=@('p_url text, p_status text, p_item_id uuid','void',1,$true)
    save_employee_snapshot=@('p_account_id uuid, p_snapshot_date date, p_people jsonb, p_coverage jsonb','jsonb',1,$true)
    m05_resolve_youtube=@('p_account_id uuid, p_external_id text, p_uploads_playlist_id text','void',0,$false)
    m05_finalize=@('p_run_id uuid','jsonb',0,$false)
    m05_execute=@('p_request_id uuid, p_operation text, p_args jsonb','jsonb',0,$true)
  }
  if(@(Compare-Object -CaseSensitive @($signatures.Keys|Sort-Object) @($Catalog.functions.name|Sort-Object)).Count){throw 'M04_CATALOG_BLOCKED'}
  foreach($function in $Catalog.functions){
    $expected=$signatures[$function.name]
    if($function.definer -ne $true -or @($function.config) -cnotcontains 'search_path=""' -or
      $function.publicExecute -ne $false -or $function.browserExecute -ne $false -or $function.anonExecute -ne $false -or $function.agentExecute -ne $false -or
      $function.writerExecute -ne $expected[3] -or $function.identityArgs -cne $expected[0] -or $function.returns -cne $expected[1] -or $function.defaultsCount -ne $expected[2]){throw 'M04_CATALOG_BLOCKED'}
  }
  if($Catalog.coverage.type -cne 'jsonb' -or $Catalog.coverage.nullable -ne $false -or $Catalog.coverage.hasDefault -ne $true -or
    $Catalog.launchStartsConstraint -cne 'CHECK ((max_actor_starts > 0))'){throw 'M04_CATALOG_BLOCKED'}
  return $Catalog
}

$exitCode=1;$historyFile=$null;$catalogFile=$null;$queryCopy=$null
try{
  $null=M04-File $repo $true
  if(($Scope -eq 'Incremental' -or $ReadOnly) -and $Phase -cne 'Query'){throw 'M04_QUERY_BLOCKED'}
  if($Scope -eq 'Incremental'){$receipt['scope']='incremental';$receipt['readOnly']=$ReadOnly.IsPresent}
  if($Scope -eq 'HC01'){$receipt['scope']='hc01';$receipt['readOnly']=$ReadOnly.IsPresent}
  if($Scope -eq 'M05'){$receipt['scope']='m05';$receipt['readOnly']=$ReadOnly.IsPresent}
  if(($Phase -ceq 'Query') -ne (-not [string]::IsNullOrEmpty($QueryFile) -and -not [string]::IsNullOrEmpty($QuerySha256))){throw 'M04_QUERY_BLOCKED'}
  if($Phase -cne 'Query' -and ($QueryFile -or $QuerySha256)){throw 'M04_QUERY_BLOCKED'}
  $queryOriginal=if($Phase -ceq 'Query'){M04-QueryPath $QueryFile $QuerySha256}else{$null}
  if($Phase -ceq 'Query'){
    $nodePath=M04-File 'C:/Program Files/nodejs/node.exe'
    if((M04-Hash $nodePath) -cne '9a4eb5f1c29c6a2e93852ead46b999e284a6a5ca8bab4d4e241d587d025a52de'){throw 'M04_SOURCE_BLOCKED'}
    $queryRunner=M04-File (Join-Path $repo 'scripts/db/m04-query.mjs');$queryRunnerHash=M04-Hash $queryRunner
    $pgPackage=M04-File (Join-Path $repo 'node_modules/.pnpm/pg@8.23.1/node_modules/pg/package.json') $false $true
    if((M04-Hash $pgPackage) -cne 'b1e53333a3d0c2c47c49a5cb919d221135dc03145df740925b899bc2baacc435'){throw 'M04_SOURCE_BLOCKED'}
  }
  $preflightOriginal=$null
  if($Phase -ceq 'Preflight' -and $Scope -ne 'M05'){
    $preflightOriginal=M04-File (Join-Path $repo 'milestones/M04-collectors-vimeo-instagram/evidence/live-preflight.sql')
    if((M04-Hash $preflightOriginal) -cne '9d87a26cb1ae60a1d511794329ef8cbe64153aa6e26fce7c3dad22197e779eed'){throw 'M04_SOURCE_BLOCKED'}
  }
  # pnpm's content-addressed executable is a legitimate hardlink. Require the
  # exact reviewed hash, then copy/recheck a private regular executable below.
  $cliPath=M04-File (Join-Path $repo 'node_modules/.pnpm/@supabase+cli-windows-x64@2.121.0/node_modules/@supabase/cli-windows-x64/bin/supabase.exe') $false $true
  if((M04-Hash $cliPath) -cne 'aed2aedd9e367549307d038b770e505b288225958e2e81bfe5db53fa6a01c148'){throw 'M04_CLI_BLOCKED'}
  $ca=M04-File (Join-Path $repo 'scripts/seed/certs/supabase-root-2021.crt')
  if((M04-Hash $ca) -cne '700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7'){throw 'M04_CA_BLOCKED'}
  $packetFile=M04-File (Join-Path $repo 'scripts/db/m03-foundation-forward-dev-migration-packet.json')
  if((M04-Hash $packetFile) -cne '91265ad652b9bc3026238b890c5abd11eb07d9a1ddde650fd5e1aa57266631f0'){throw 'M04_BASELINE_BLOCKED'}
  $old=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($packetFile));$baseline=@($old.baseline)+@($old.pending)
  if($baseline.Count -ne 15 -or $old.target -cne $project){throw 'M04_BASELINE_BLOCKED'}
  $sourceAll=@($baseline)+@($pending)+@($hc01Migration)
  $sourceCount=@(Get-ChildItem -LiteralPath (Join-Path $repo 'supabase/migrations') -Force).Count
  if($sourceCount -notin @(18,19) -or ($Scope -eq 'M05' -and $sourceCount -ne 19)){throw 'M04_SOURCE_BLOCKED'}
  if($sourceCount -eq 19){$sourceAll+=@($m05Migration)}
  foreach($migration in $sourceAll){$file=M04-File (Join-Path $repo $migration.file);if((M04-Hash $file) -cne $migration.sha256){throw 'M04_SOURCE_BLOCKED'}}
  if($Scope -eq 'HC01'){
    $approvalPath=M04-File (Join-Path $repo 'milestones/M04-collectors-vimeo-instagram/evidence/hc01-dev-approval-20261028.json')
    $approval=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($approvalPath))
    if($approval.approval_kind -cne 'hc01' -or $approval.approval_id -cne '1cf8406c-1142-445e-a237-6d0fd7a67b22' -or $approval.projectRef -cne $project -or $approval.environment -cne 'dev'){throw 'M04_BASELINE_BLOCKED'}
    $baseline=@($baseline)+@($pending);$pending=@($hc01Migration)
  }
  if($Scope -eq 'M05'){
    $hc01Migration.historySha256='4d2d43165f9159354a8ef5c5c34214b9d880b134fec45edbe2a22f63d65c0f72'
    $baseline=@($baseline)+@($pending)+@($hc01Migration);$pending=@($m05Migration)
  }
  $all=@($baseline)+@($pending)
  # No private state, decryption, network, native process or copy in CheckOnly.
  if($CheckOnly){$receipt.status='public_ready';$receipt['pendingVersions']=@($pending.version);if($Scope -eq 'M05'){$receipt['baselineVersions']=@($baseline.version);$receipt['pendingSourceSha256']=$m05Migration.sha256};$exitCode=0}
  else{
    $receipt['preparationStage']='persistent_admin_metadata'
    . (Join-Path $repo 'scripts/n8n/windows/Dev-CredentialStore.ps1')
    $spec=Get-M03DevCredentialSpec -Kind Admin
    $root=Get-M03DevCredentialRoot
    Assert-M03DevPrivateAcl $root $true;Assert-M03DevPrivateAcl ([IO.Path]::GetDirectoryName($spec.Source)) $true;Assert-M03DevPrivateAcl $spec.Source $false
    if((Get-Item -LiteralPath $spec.Source).Length -lt 80 -or (Get-Item -LiteralPath $spec.Source).Length -gt 65536){throw 'M04_INPUT_BLOCKED'}
    $receipt['preparationStage']='public_output_directory'
    $out=M04-OutputDirectory
    $receipt['preparationStage']='exclusive_operation_lock'
    $lockPath=Join-Path $out 'm04-dev-database.operation.lock'
    $lock=[IO.File]::Open($lockPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
    $temp=[IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\');$null=M04-File $temp $true
    $scratch=Join-Path $temp ('emr-m04-db-'+[Guid]::NewGuid().ToString('N'))
    [IO.Directory]::CreateDirectory($scratch)|Out-Null;$receipt.scratchDeleted=$false
    $receipt['preparationStage']='public_scratch_inputs'
    Set-M03DevPrivateAcl $scratch $true
    $scratchCli=Join-Path $scratch 'supabase.exe';[IO.File]::Copy($cliPath,$scratchCli,$false)
    $null=M04-File $scratchCli
    if((M04-Hash $scratchCli) -cne 'aed2aedd9e367549307d038b770e505b288225958e2e81bfe5db53fa6a01c148'){throw 'M04_CLI_BLOCKED'}
    $cliPath=$scratchCli
    $null=[IO.Directory]::CreateDirectory((Join-Path $scratch 'supabase/migrations'))
    [IO.File]::WriteAllText((Join-Path $scratch 'supabase/config.toml'),"project_id = `"emr-m04-dev-operations`"`n[db.seed]`nenabled = false`nsql_paths = []`n")
    foreach($migration in $all){$destination=Join-Path $scratch $migration.file;[IO.File]::Copy((Join-Path $repo $migration.file),$destination,$false);if((M04-Hash $destination) -cne $migration.sha256){throw 'M04_SOURCE_BLOCKED'}}
    $scratchCa=Join-Path $scratch 'supabase-root-2021.crt';[IO.File]::Copy($ca,$scratchCa,$false)
    if((M04-Hash $scratchCa) -cne '700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7'){throw 'M04_CA_BLOCKED'}
    $dbUri='postgresql://postgres.'+$project+'@'+$hostName+':5432/postgres?sslmode=verify-full&sslrootcert='+[Uri]::EscapeDataString($scratchCa)
    $historyFile=Join-Path $scratch 'history.sql'
    [IO.File]::WriteAllText($historyFile,"select jsonb_build_object('current_user',current_user,'session_user',session_user,'database',current_database(),'migrations',(select coalesce(jsonb_agg(jsonb_build_object('version',version,'name',name,'historySha256',encode(extensions.digest(array_to_string(statements,E'\n'),'sha256'),'hex')) order by version),'[]'::jsonb) from supabase_migrations.schema_migrations)) as receipt;")
    if($Phase -ceq 'Preflight' -and $Scope -ne 'M05'){
      [IO.File]::Copy($preflightOriginal,$historyFile,$true)
      if((M04-Hash $historyFile) -cne '9d87a26cb1ae60a1d511794329ef8cbe64153aa6e26fce7c3dad22197e779eed'){throw 'M04_SOURCE_BLOCKED'}
    }
    $catalogFile=Join-Path $scratch 'catalog.sql'
    [IO.File]::WriteAllText($catalogFile,@'
select jsonb_build_object('identity',current_user='postgres' and session_user='postgres' and current_database()='postgres',
 'collectorDefinitionMd5',md5(pg_get_functiondef('ops.collector_execute(uuid,text,jsonb)'::regprocedure)),
 'tables',(select jsonb_agg(jsonb_build_object('name',c.relname,'rls',c.relrowsecurity,'writerTableGrant',has_table_privilege('n8n_writer',c.oid,'SELECT,INSERT,UPDATE,DELETE')) order by c.relname)
   from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='ops' and c.relname in ('collector_runs','collector_accounts','collector_launches','collector_passes','collector_pages','collector_requests')),
 'functions',(select jsonb_agg(jsonb_build_object('name',p.proname,'definer',p.prosecdef,'config',p.proconfig,'writerExecute',has_function_privilege('n8n_writer',p.oid,'EXECUTE'),'browserExecute',has_function_privilege('authenticated',p.oid,'EXECUTE'),'anonExecute',has_function_privilege('anon',p.oid,'EXECUTE'),'agentExecute',has_function_privilege('api_agent',p.oid,'EXECUTE'),'identityArgs',pg_get_function_identity_arguments(p.oid),'returns',pg_get_function_result(p.oid),'defaultsCount',p.pronargdefaults) order by p.proname)
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='ops' and p.proname in ('collector_execute','collector_finalize','set_account_external_id')),
 'columns',(select jsonb_agg(jsonb_build_object('table',c.relname,'name',a.attname,'type',format_type(a.atttypid,null),'nullable',not a.attnotnull) order by c.relname,a.attname)
   from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='ops' and c.relname in ('collector_runs','collector_accounts','collector_launches','collector_passes','collector_pages','collector_requests') and a.attnum>0 and not a.attisdropped)) as catalog;
'@)
    if($Scope -eq 'M05'){
      $sidecar=@'
 || jsonb_build_object('m05',jsonb_build_object(
 'tables',(select jsonb_agg(jsonb_build_object('name',c.relname,'rls',c.relrowsecurity,
   'directGrant',has_table_privilege('n8n_writer',c.oid,'SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('api_agent',c.oid,'SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') or exists(select 1 from aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) acl where acl.grantee=0)) order by c.relname)
   from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='ops' and c.relname in ('m05_jobs','m05_quota')),
 'columns',(select jsonb_agg(jsonb_build_object('table',c.relname,'name',a.attname,'type',format_type(a.atttypid,null),'nullable',not a.attnotnull) order by c.relname,a.attname)
   from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='ops' and c.relname in ('m05_jobs','m05_quota') and a.attnum>0 and not a.attisdropped),
 'functions',(select jsonb_agg(jsonb_build_object('name',p.proname,'definer',p.prosecdef,'config',p.proconfig,
   'publicExecute',exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl where acl.grantee=0 and acl.privilege_type='EXECUTE'),
   'writerExecute',has_function_privilege('n8n_writer',p.oid,'EXECUTE'),'browserExecute',has_function_privilege('authenticated',p.oid,'EXECUTE'),'anonExecute',has_function_privilege('anon',p.oid,'EXECUTE'),'agentExecute',has_function_privilege('api_agent',p.oid,'EXECUTE'),
   'identityArgs',pg_get_function_identity_arguments(p.oid),'returns',pg_get_function_result(p.oid),'defaultsCount',p.pronargdefaults) order by p.proname)
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='ops' and p.proname in ('m05_assert_claim','mark_website_page','save_employee_snapshot','m05_resolve_youtube','m05_finalize','m05_execute')),
 'coverage',(select jsonb_build_object('type',format_type(a.atttypid,null),'nullable',not a.attnotnull,'hasDefault',a.atthasdef) from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='app' and c.relname='employee_snapshots' and a.attname='coverage' and not a.attisdropped),
 'launchStartsConstraint',(select pg_get_constraintdef(oid) from pg_constraint where conrelid='ops.collector_launches'::regclass and conname='collector_launches_max_actor_starts_check'))) as catalog;
'@
      [IO.File]::WriteAllText($catalogFile,([IO.File]::ReadAllText($catalogFile)).Replace(' as catalog;',$sidecar))
    }
    if($Phase -ceq 'Query'){
      $queryCopy=Join-Path $scratch 'reviewed.sql';[IO.File]::Copy($queryOriginal,$queryCopy,$false)
      if((M04-Hash $queryCopy) -cne $QuerySha256){throw 'M04_QUERY_BLOCKED'}
      $identityGuard=@'
begin;
set local lock_timeout='5s';
set local statement_timeout='25s';
do $m04_identity$ begin
 if current_user<>'postgres' or session_user<>'postgres' or current_database()<>'postgres' then
  raise exception using errcode='42501',message='M04 owner identity required';
 end if;
end $m04_identity$;
'@
      if($ReadOnly){$identityGuard=$identityGuard -replace '\Abegin;\r?\n', "begin;`nset transaction read only;`n"}
      # Reviewed public Query files are transaction bodies, without top-level
      # BEGIN/COMMIT/ROLLBACK. The one native command owns the transaction.
      [IO.File]::WriteAllText($queryCopy,$identityGuard+"`n"+[IO.File]::ReadAllText($queryCopy)+"`ncommit;`n")
      $wrappedQueryHash=M04-Hash $queryCopy
      $queryRunnerLock=[IO.File]::Open($queryRunner,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
    }
    $receipt['preparationStage']='persistent_admin_decrypt'
    $receipt.privateRead=$true;$cipherBytes=[IO.File]::ReadAllBytes($spec.Source);Assert-M03DevCipherFraming $cipherBytes
    $secret=ConvertTo-SecureString -String ([Text.Encoding]::ASCII.GetString($cipherBytes)) -ErrorAction Stop
    [Array]::Clear($cipherBytes,0,$cipherBytes.Length);$cipherBytes=$null
    $bstr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret);$password=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr);$bstr=[IntPtr]::Zero;$secret.Dispose();$secret=$null
    if([string]::IsNullOrEmpty($password)){throw 'M04_INPUT_BLOCKED'}
    $receipt['preparationStage']='bounded_database_command'
    if($Phase -cne 'Query'){
      $before=Invoke-M04Cli @('db','query','--file',$historyFile)
      try{
        $history=@(M04-History $before);$receipt['historyBefore']=$history
        if($Phase -ceq 'Preflight'){$receipt['preflight']=@(M04-Json $before)[0].receipt}
      }finally{$before.text=$null}
    }
    if($Phase -ceq 'Preflight'){
      $receipt.status='preflight_verified';$receipt['newHistorySourceParity']=$true
    }
    elseif($Phase -ceq 'Apply'){
      $intentName=if($Scope -eq 'M05'){'m05-dev-migration-intent.json'}elseif($Scope -eq 'HC01'){'m04-hc01-dev-migration-intent.json'}else{'m04-dev-migration-intent.json'}
      $intentPath=Join-Path $out $intentName
      # An existing intent means a possibly successful push, never a new permit.
      if(Test-Path -LiteralPath $intentPath){throw 'M04_APPLY_RECONCILIATION_REQUIRED'}
      if($history.Count -ne $baseline.Count){throw 'M04_APPLY_RECONCILIATION_REQUIRED'}
      $dry=Invoke-M04Cli @('db','push','--dry-run','--skip-vault') 60000
      try{M04-PushMatches $dry $true;$receipt['dryRunMatched']=$true}finally{$dry.text=$null}
      $intent=[ordered]@{version=1;projectRef=$project;pending=$pending;historyBefore=$history;createdAt=[DateTime]::UtcNow.ToString('o')}
      $bytes=[Text.UTF8Encoding]::new($false).GetBytes(($intent|ConvertTo-Json -Depth 10 -Compress));$stream=$null
      try{$stream=[IO.File]::Open($intentPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true)}finally{if($null -ne $stream){$stream.Dispose()}}
      $receipt['pushAttempted']=$true
      $push=Invoke-M04Cli @('db','push','--skip-vault','--yes') 180000
      try{M04-PushMatches $push $false;$receipt['pushAcknowledged']=$true}finally{$push.text=$null}
      $after=Invoke-M04Cli @('db','query','--file',$historyFile)
      try{$historyAfter=@(M04-History $after);if($historyAfter.Count -ne $all.Count){throw 'M04_APPLY_RECONCILIATION_REQUIRED'};$receipt['historyAfter']=$historyAfter}finally{$after.text=$null}
      $receipt.status='migrations_applied_verified'
    }
    elseif($Phase -ceq 'Postcheck'){
      if($history.Count -ne $all.Count){throw 'M04_POSTCHECK_HISTORY_BLOCKED'}
      $catalog=Invoke-M04Cli @('db','query','--file',$catalogFile)
      try{$receipt['catalog']=M04-Catalog $catalog}finally{$catalog.text=$null}
      foreach($type in @('security','performance')){
        $advisor=Invoke-M04Cli @('db','advisors','--type',$type,'--level','warn','--fail-on','warn') 60000
        try{
          $value=M04-Json $advisor
          if($value.message -cne 'db advisors' -or @($value.results).Count -ne 0){throw 'M04_ADVISORS_BLOCKED'}
          $receipt[$type+'Advisors']=[ordered]@{nativeExit=0;warnings=0;errors=0;childrenClosed=$true}
        }finally{$advisor.text=$null}
      }
      $receipt['schemaCoverage']='fixed_catalog_compared_to_reviewed_local_generated_contract'
      $receipt['hostedGeneratedTypesCandidate']=$false
      $receipt['hostedTypesGeneration']='not_attempted_native_descendant_contract_unverified'
      $receipt.status='postcheck_readbacks_complete'
    }
    else{
      $value=Invoke-M04NativeQuery
      $receipt['queryResult']=@($value.rows);$receipt['querySha256']=$QuerySha256;$receipt.authenticationVerified=$true
      $receipt.status='reviewed_query_complete'
    }
    $exitCode=0
  }
}catch{
  $allowed=@('M04_PATH_BLOCKED','M04_QUERY_BLOCKED','M04_CLI_BLOCKED','M04_CA_BLOCKED','M04_BASELINE_BLOCKED','M04_SOURCE_BLOCKED','M04_COMMAND_BLOCKED','M04_NATIVE_FAILURE','M04_NATIVE_OUTPUT_BLOCKED','M04_JSON_BLOCKED','M04_HISTORY_BLOCKED','M04_IDENTITY_BLOCKED','M04_PENDING_BLOCKED','M04_INPUT_BLOCKED','M04_APPLY_RECONCILIATION_REQUIRED','M04_POSTCHECK_HISTORY_BLOCKED','M04_QUERY_HISTORY_BLOCKED','M04_TYPES_BLOCKED','M04_ADVISORS_BLOCKED','M04_CATALOG_BLOCKED','M04_QUERY_PROTOCOL_BLOCKED','M04_QUERY_CLOSURE_UNVERIFIED','M04_QUERY_FAILED')
  $receipt.status=if($_.Exception.Message -cin $allowed){$_.Exception.Message}else{'M04_OPERATION_BLOCKED'}
}finally{
  $password=$null;if($null -ne $secret){$secret.Dispose()};if($bstr -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)}
  if($null -ne $cipherBytes){[Array]::Clear($cipherBytes,0,$cipherBytes.Length)}
  if($null -ne $queryRunnerLock){$queryRunnerLock.Dispose()}
  if($null -ne $scratch -and $receipt.childrenClosed){
    try{
      $resolved=[IO.Path]::GetFullPath($scratch);$prefix=[IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')+'\emr-m04-db-'
      if(-not $resolved.StartsWith($prefix,[StringComparison]::OrdinalIgnoreCase) -or $resolved -cne $scratch){throw 'M04_CLEANUP_BLOCKED'}
      [IO.Directory]::Delete($resolved,$true);$receipt.scratchDeleted=$true
    }catch{$receipt.status='M04_SCRATCH_CLEANUP_BLOCKED';$exitCode=1}
  }
  if($null -ne $lock){$lock.Dispose();if($receipt.childrenClosed){try{[IO.File]::Delete($lockPath)}catch{$receipt.status='M04_LOCK_CLEANUP_BLOCKED';$exitCode=1}}}
  if(-not $receipt.childrenClosed){$receipt.status='M04_CHILD_CLOSURE_UNVERIFIED';$exitCode=1}
  $receipt.observedAt=[DateTime]::UtcNow.ToString('o')
}
Write-Output ($receipt|ConvertTo-Json -Depth 18 -Compress)
exit $exitCode
