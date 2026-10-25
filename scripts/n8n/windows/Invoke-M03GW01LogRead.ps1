[CmdletBinding()]
param([switch]$CheckOnly)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
$receipt=[ordered]@{version=1;status='preflight_blocked';code='GW01_LOG_READ_PREFLIGHT';privateRead=$false;rootChildClosed=$true;nativeExit=$null;handoffRetained=$true;result=$null}
$stream=$null;$secure=$null;$bstr=[IntPtr]::Zero;$bytes=$null;$protection=$null;$privateInput=$null;$text=$null;$cleanupVerified=$true
$required=@('scripts/n8n/gw01-log-read.mjs','scripts/n8n/windows/Invoke-M03GW01LogRead.ps1','scripts/n8n/gw01-log-read-packet.json','scripts/n8n/gw01-gateway-seal.json','scripts/n8n/gw01-gateway-logs.mjs','scripts/n8n/gw01-trial.mjs','scripts/n8n/gw01-reviewed-preview.json','scripts/n8n/gw01-trial-config.json')
function Safe-Path([string]$Path){
  $absolute=[IO.Path]::GetFullPath($Path);$cursor=$absolute
  while($null -ne $cursor){$entry=Get-Item -LiteralPath $cursor -Force -ErrorAction Stop;if(($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'blocked'};$parent=[IO.Directory]::GetParent($cursor);$cursor=if($null -eq $parent){$null}else{$parent.FullName}}
  return $absolute
}
function Keys($Value,[string[]]$Expected){if($Value -isnot [PSCustomObject] -or @(Compare-Object -CaseSensitive -ReferenceObject @($Expected|Sort-Object) -DifferenceObject @($Value.PSObject.Properties.Name|Sort-Object)).Count -ne 0){throw 'blocked'}}
function Json([string]$Relative){$file=Safe-Path (Join-Path $repo $Relative);$entry=Get-Item -LiteralPath $file -Force;if($entry.PSIsContainer -or $entry.Length -gt 524288){throw 'blocked'};return ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($file)) -ErrorAction Stop}
function Hash([string]$Path){$file=Safe-Path $Path;if((Get-Item -LiteralPath $file -Force).PSIsContainer){throw 'blocked'};return (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()}
function Run([string]$Flag,[string]$InputText,[bool]$Private){
  $start=$null;$child=$null;$started=$false;$closed=$true;$buffer=$null;$memory=$null;$native=$null;$output=$null
  try{
    $start=New-Object Diagnostics.ProcessStartInfo;$start.FileName=$node;$start.Arguments='"'+$runner+'" '+$Flag;$start.WorkingDirectory=$repo;$start.UseShellExecute=$false;$start.CreateNoWindow=$true;$start.RedirectStandardInput=$true;$start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true;$start.EnvironmentVariables.Clear()
    foreach($name in @('SystemRoot','WINDIR','PATH','TEMP','TMP','LOCALAPPDATA','APPDATA','USERPROFILE')){$v=[Environment]::GetEnvironmentVariable($name,'Process');if($null -ne $v){$start.EnvironmentVariables[$name]=$v}}
    $child=New-Object Diagnostics.Process;$child.StartInfo=$start;$started=$child.Start();if(-not $started){throw 'blocked'};$closed=$false;$start.EnvironmentVariables.Clear()
    $buffer=New-Object byte[] 32768;$memory=[IO.MemoryStream]::new([byte[]]$buffer,$true);$stdout=$child.StandardOutput.BaseStream.CopyToAsync($memory);$stderr=$child.StandardError.BaseStream.CopyToAsync([IO.Stream]::Null)
    $child.StandardInput.Write($InputText);$child.StandardInput.Close();$InputText=$null
    if($Private){if(-not $child.WaitForExit(30000)){throw 'blocked'}}elseif(-not $child.WaitForExit(10000)){throw 'blocked'}
    $closed=$true;$native=$child.ExitCode
    if(-not [Threading.Tasks.Task]::WhenAll([Threading.Tasks.Task[]]@($stdout,$stderr)).Wait(5000)){throw 'blocked'}
    $output=[Text.Encoding]::UTF8.GetString($buffer,0,[int]$memory.Position)
  }catch{$output=$null}finally{
    $InputText=$null;if($null -ne $start){$start.EnvironmentVariables.Clear()}
    if($null -ne $child){if($started -and -not $closed){try{if(-not $child.WaitForExit(0)){$child.Kill()};$closed=$child.WaitForExit(5000)}catch{$closed=$false}};try{$child.Dispose()}catch{$closed=$false;$output=$null}}
    if($null -ne $memory){try{$memory.Dispose()}catch{$closed=$false;$output=$null}};if($null -ne $buffer){try{[Array]::Clear($buffer,0,$buffer.Length)}catch{$closed=$false;$output=$null}}
  }
  return [PSCustomObject]@{closed=$closed;native=$native;text=$output}
}
try{
  $null=Safe-Path $repo
  $seal=Json 'scripts/n8n/gw01-log-read-seal.json';Keys $seal @('version','files');if($seal.version -isnot [int] -or $seal.version -ne 1){throw 'blocked'};Keys $seal.files $required
  foreach($relative in $required){$hash=$seal.files.$relative;if($hash -isnot [string] -or $hash -cnotmatch '^[a-f0-9]{64}$' -or (Hash (Join-Path $repo $relative)) -cne $hash){throw 'blocked'}}
  $oldSeal=Json 'scripts/n8n/gw01-gateway-seal.json';Keys $oldSeal @('version','files','vercelFiles');if($oldSeal.version -isnot [int] -or $oldSeal.version -ne 1 -or $oldSeal.files -isnot [PSCustomObject] -or $oldSeal.vercelFiles -isnot [PSCustomObject]){throw 'blocked'}
  foreach($relative in @('scripts/n8n/gw01-gateway-logs.mjs','scripts/n8n/gw01-trial.mjs','scripts/n8n/gw01-reviewed-preview.json','scripts/n8n/gw01-trial-config.json')){$oldHash=$oldSeal.files.$relative;if($oldHash -isnot [string] -or $oldHash -cnotmatch '^[a-f0-9]{64}$' -or $oldHash -cne $seal.files.$relative){throw 'blocked'}}
  $preview=Json 'scripts/n8n/gw01-reviewed-preview.json';Keys $preview @('version','projectId','teamId','branch','commitSha','deploymentId','audience','target','protection','routeDisabledVerified')
  foreach($name in @('projectId','teamId','branch','commitSha','deploymentId','audience','target','protection')){if($preview.$name -isnot [string]){throw 'blocked'}}
  if($preview.version -isnot [int] -or $preview.version -ne 1 -or $preview.projectId -cne 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu' -or $preview.teamId -cne 'team_gboXPxTevpCOZuaA8eY9PmR1' -or $preview.branch -cne 'm03-n8n-foundation' -or $preview.commitSha -cnotmatch '^[a-f0-9]{40}$' -or $preview.deploymentId -cnotmatch '^dpl_[A-Za-z0-9]{16,80}$' -or $preview.audience -cnotmatch '^https://everyone-market-researcher-[a-z0-9-]+\.vercel\.app$' -or $preview.target -cne 'preview' -or $preview.protection -cne 'all_except_custom_domains' -or $preview.routeDisabledVerified -isnot [bool] -or $preview.routeDisabledVerified){throw 'blocked'}
  $packet=Json 'scripts/n8n/gw01-log-read-packet.json';Keys $packet @('version','windowId','requestId','attemptId','reservedAt','finishedAt','httpStatus')
  foreach($name in @('windowId','requestId','attemptId')){if($packet.$name -isnot [string]){throw 'blocked'}}
  if($packet.version -isnot [int] -or $packet.version -ne 1 -or $packet.windowId -cne '76c2ad42-c094-4ba4-9a0b-566e19b97780' -or $packet.requestId -cne '80162039-6088-4011-bdf1-a2a7b5ec11cb' -or $packet.attemptId -cne '66233386-4962-44fe-b499-df973fde25c9' -or $packet.reservedAt -isnot [long] -or $packet.reservedAt -ne 1792313741664 -or $packet.finishedAt -isnot [long] -or $packet.finishedAt -ne 1792313742950 -or $packet.httpStatus -isnot [int] -or $packet.httpStatus -ne 503){throw 'blocked'}
  $journal=Safe-Path (Join-Path $repo 'scripts/n8n/out/gw01/gw01-trial.jsonl');if((Get-Item -LiteralPath $journal -Force).Length -gt 1048576){throw 'blocked'}
  # Read-only reuse of the successful public gateway seal's physical CLI inventory.
  $vercelRoot=Safe-Path (Join-Path $env:APPDATA 'npm/node_modules/vercel');$package=Safe-Path (Join-Path $vercelRoot 'package.json')
  $runtimePackage=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($package));if($runtimePackage.version -isnot [string] -or $runtimePackage.version -cne '56.5.0'){throw 'blocked'}
  $runtime=@('package.json');$queue=New-Object 'Collections.Generic.Queue[string]';$queue.Enqueue((Safe-Path (Join-Path $vercelRoot 'dist')));$count=0
  while($queue.Count -gt 0){foreach($entry in Get-ChildItem -LiteralPath $queue.Dequeue() -Force){
    $count++;if($count -gt 10000 -or ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'blocked'}
    if(-not $entry.FullName.StartsWith($vercelRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'blocked'}
    if($entry.PSIsContainer){$queue.Enqueue($entry.FullName)}elseif($entry.Extension -cin @('.js','.mjs','.cjs','.json','.wasm')){$runtime+=$entry.FullName.Substring($vercelRoot.Length+1).Replace('\','/');if($runtime.Count -gt 2000){throw 'blocked'}}
  }}
  if('dist/index.js' -cnotin $runtime){throw 'blocked'};Keys $oldSeal.vercelFiles $runtime
  foreach($relative in $runtime){$hash=$oldSeal.vercelFiles.$relative;if($hash -isnot [string] -or $hash -cnotmatch '^[a-f0-9]{64}$' -or (Hash (Join-Path $vercelRoot $relative)) -cne $hash){throw 'blocked'}}
  $privateFile=Safe-Path (Join-Path $env:LOCALAPPDATA 'Temp/emr-m03-gw01-dev-protection.dpapi');$entry=Get-Item -LiteralPath $privateFile -Force;if($entry.PSIsContainer -or $entry.Length -lt 1 -or $entry.Length -gt 65536){throw 'blocked'}
  $node=(Get-Command node.exe -CommandType Application -ErrorAction Stop).Source;$runner=Safe-Path (Join-Path $repo 'scripts/n8n/gw01-log-read.mjs')
  $r=Run '--check-public' '{"protection":"GW01_PUBLIC_LOG_READ_PLACEHOLDER_PROTECTION"}' $false;$receipt.rootChildClosed=$r.closed
  if(-not $r.closed -or $r.native -ne 0 -or $null -eq $r.text){throw 'blocked'};$v=ConvertFrom-Json -InputObject $r.text;Keys $v @('version','status','gatewayRequests','logCliInvocations','privateRead')
  if($v.version -isnot [int] -or $v.version -ne 1 -or $v.status -isnot [string] -or $v.status -cne 'public_ready' -or $v.gatewayRequests -isnot [int] -or $v.gatewayRequests -ne 0 -or $v.logCliInvocations -isnot [int] -or $v.logCliInvocations -ne 0 -or $v.privateRead -isnot [bool] -or $v.privateRead){throw 'blocked'}
}catch{Write-Output ($receipt|ConvertTo-Json -Depth 3 -Compress);exit 1}
if($CheckOnly){$receipt.status='check_only_ready';$receipt.code=$null;Write-Output ($receipt|ConvertTo-Json -Depth 3 -Compress);exit 0}
try{
  $stream=[IO.File]::Open($privateFile,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::None);$receipt.privateRead=$true;$bytes=New-Object byte[] ([int]$stream.Length)
  if($stream.Read($bytes,0,$bytes.Length) -ne $bytes.Length){throw 'blocked'}
  $secure=ConvertTo-SecureString -String ([Text.Encoding]::ASCII.GetString($bytes).Trim()) -ErrorAction Stop;[Array]::Clear($bytes,0,$bytes.Length)
  $bstr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure);$protection=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr);[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr);$bstr=[IntPtr]::Zero;$secure.Dispose();$secure=$null
  if($protection -cnotmatch '^[A-Za-z0-9_-]{32,512}$'){throw 'blocked'}
  $privateInput=@{protection=$protection}|ConvertTo-Json -Compress;$r=Run '--private-log-read' $privateInput $true;$privateInput=$null;$receipt.rootChildClosed=$r.closed;$receipt.nativeExit=$r.native
  if(-not $r.closed -or $null -eq $r.text -or $r.text.Contains($protection)){throw 'blocked'};$v=ConvertFrom-Json -InputObject $r.text
  Keys $v @('version','status','code','requestId','attemptId','since','until','gatewayRequests','logCliInvocations','logScan')
  foreach($name in @('status','requestId','attemptId','since','until')){if($v.$name -isnot [string]){throw 'blocked'}}
  if($null -ne $v.code -and $v.code -isnot [string]){throw 'blocked'}
  if($v.version -isnot [int] -or $v.version -ne 1 -or $v.status -cnotin @('verified','unverified') -or $v.requestId -cne $packet.requestId -or $v.attemptId -cne $packet.attemptId -or $v.since -cne '2026-10-18T08:55:36.664Z' -or $v.until -cne '2026-10-18T08:55:47.950Z' -or $v.gatewayRequests -isnot [int] -or $v.gatewayRequests -ne 0 -or $v.logCliInvocations -isnot [int] -or $v.logCliInvocations -ne 1 -or ($null -ne $v.code -and $v.code -cnotmatch '^GW01_LOGS_(INPUT|NATIVE|TIMEOUT|CLOSE|RESPONSE|TRUNCATED|NO_CAPTURE|REFLECTION)$')){throw 'blocked'}
  Keys $v.logScan @('version','status','code','capturedMatchingRequest','logsScanned','publicAuthMarkerFound','requestBodyMarkerFound','ownBypassFound','truncated','childClosed','observedAt')
  $s=$v.logScan
  if($s.status -isnot [string] -or ($null -ne $s.code -and $s.code -isnot [string])){throw 'blocked'}
  if($s.version -isnot [int] -or $s.version -ne 1 -or $s.status -cne $v.status -or $s.code -cne $v.code -or $s.logsScanned -isnot [int] -or $s.logsScanned -lt 0 -or $s.logsScanned -gt 100 -or ($null -ne $s.observedAt -and ($s.observedAt -isnot [string] -or $s.observedAt -cnotmatch '^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$'))){throw 'blocked'}
  foreach($flag in @('capturedMatchingRequest','publicAuthMarkerFound','requestBodyMarkerFound','ownBypassFound','truncated','childClosed')){if($s.$flag -isnot [bool]){throw 'blocked'}}
  if($v.status -ceq 'verified'){if($r.native -ne 0 -or $null -ne $s.code -or -not $s.capturedMatchingRequest -or $s.logsScanned -lt 1 -or -not $s.childClosed -or $null -eq $s.observedAt -or $s.publicAuthMarkerFound -or $s.requestBodyMarkerFound -or $s.ownBypassFound -or $s.truncated){throw 'blocked'}}elseif($r.native -ne 1 -or $null -eq $s.code){throw 'blocked'}
  $receipt.status=$v.status;$receipt.code=$v.code;$receipt.result=$v
}catch{$receipt.status='stopped_reconcile';$receipt.code='GW01_LOG_READ_RESPONSE';$receipt.result=$null}finally{
  if($bstr -ne [IntPtr]::Zero){try{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)}catch{$cleanupVerified=$false}};if($null -ne $secure){try{$secure.Dispose()}catch{$cleanupVerified=$false}};if($null -ne $bytes){try{[Array]::Clear($bytes,0,$bytes.Length)}catch{$cleanupVerified=$false}}
  $privateInput=$null;$protection=$null;$text=$null;$v=$null;$r=$null;if($null -ne $stream){try{$stream.Dispose()}catch{$cleanupVerified=$false}}
}
if(-not $receipt.rootChildClosed -or -not $cleanupVerified){$receipt.status='stopped_reconcile';$receipt.code='GW01_LOG_READ_CLEANUP';$receipt.result=$null}
Write-Output ($receipt|ConvertTo-Json -Depth 8 -Compress)
if($receipt.status -cne 'verified' -or -not $receipt.rootChildClosed){exit 1};exit 0
