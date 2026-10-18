[CmdletBinding()]
param(
  [ValidateSet('Probe','Request')][string]$Mode='Probe',
  [ValidateSet('ordinary','denial','status','shutdown')][string]$Kind='ordinary',
  [ValidateSet('machine','synthetic','missing')][string]$Authorization='machine',
  [ValidateSet('none','before_send_abort','after_headers_cancel')][string]$Fault='none',
  [switch]$CheckOnly
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
$receipt=[ordered]@{version=1;mode=$Mode;status='preflight_blocked';privateRead=$false;rootChildClosed=$true;nativeExit=$null;handoffsRetained=$true;result=$null}
$streams=@{};$values=@{};$secure=$null;$bstr=[IntPtr]::Zero;$bytes=$null;$privateInput=$null;$text=$null
function Safe-Path([string]$Path){
  $absolute=[IO.Path]::GetFullPath($Path);$cursor=$absolute
  while($null -ne $cursor){$entry=Get-Item -LiteralPath $cursor -Force -ErrorAction Stop;if(($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'blocked'};$parent=[IO.Directory]::GetParent($cursor);$cursor=if($null -eq $parent){$null}else{$parent.FullName}}
  return $absolute
}
function Keys($Value,[string[]]$Expected){if($Value -isnot [PSCustomObject] -or @(Compare-Object -ReferenceObject @($Expected|Sort-Object) -DifferenceObject @($Value.PSObject.Properties.Name|Sort-Object)).Count -ne 0){throw 'blocked'}}
function Json([string]$Relative){$file=Safe-Path (Join-Path $repo $Relative);$entry=Get-Item -LiteralPath $file -Force;if($entry.PSIsContainer -or $entry.Length -gt 524288){throw 'blocked'};return ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($file)) -ErrorAction Stop}
function Run([string]$Flag,[string]$InputText,[bool]$Private){
  $start=$null;$child=$null;$started=$false;$closed=$true;$buffer=$null;$memory=$null;$stdout=$null;$stderr=$null;$text=$null;$native=$null
  try{
    $start=New-Object Diagnostics.ProcessStartInfo;$start.FileName=$node;$start.Arguments='"'+$runner+'" '+$Flag;$start.WorkingDirectory=$repo;$start.UseShellExecute=$false;$start.CreateNoWindow=$true;$start.RedirectStandardInput=$true;$start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true;$start.EnvironmentVariables.Clear()
    foreach($name in @('SystemRoot','WINDIR','PATH','TEMP','TMP','LOCALAPPDATA','APPDATA','USERPROFILE')){$v=[Environment]::GetEnvironmentVariable($name,'Process');if($null -ne $v){$start.EnvironmentVariables[$name]=$v}}
    $child=New-Object Diagnostics.Process;$child.StartInfo=$start;$started=$child.Start();if(-not $started){throw 'blocked'};$closed=$false;$start.EnvironmentVariables.Clear()
    $buffer=New-Object byte[] 1048576;$memory=[IO.MemoryStream]::new([byte[]]$buffer,$true);$stdout=$child.StandardOutput.BaseStream.CopyToAsync($memory);$stderr=$child.StandardError.BaseStream.CopyToAsync([IO.Stream]::Null)
    $child.StandardInput.Write($InputText);$child.StandardInput.Close();$InputText=$null
    if($Private){if($Mode -ceq 'Probe'){if(-not $child.WaitForExit(60000)){throw 'blocked'}}elseif(-not $child.WaitForExit(35000)){throw 'blocked'}}else{if(-not $child.WaitForExit(10000)){throw 'blocked'}}
    $closed=$true;$native=$child.ExitCode
    if(-not [Threading.Tasks.Task]::WhenAll([Threading.Tasks.Task[]]@($stdout,$stderr)).Wait(5000)){throw 'blocked'}
    $text=[Text.Encoding]::UTF8.GetString($buffer,0,[int]$memory.Position)
  }catch{$text=$null}finally{
    $InputText=$null;if($null -ne $start){$start.EnvironmentVariables.Clear()}
    if($null -ne $child){if($started -and -not $closed){try{if(-not $child.WaitForExit(0)){$child.Kill()};$closed=$child.WaitForExit(5000)}catch{$closed=$false}};$child.Dispose()}
    if($null -ne $memory){$memory.Dispose()};if($null -ne $buffer){[Array]::Clear($buffer,0,$buffer.Length)}
  }
  return [PSCustomObject]@{closed=$closed;native=$native;text=$text}
}
try{
  $null=Safe-Path $repo
  $preview=Json 'scripts/n8n/gw01-reviewed-preview.json';Keys $preview @('version','projectId','teamId','branch','commitSha','deploymentId','audience','target','protection','routeDisabledVerified')
  if($preview.version -ne 1 -or $preview.projectId -cne 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu' -or $preview.teamId -cne 'team_gboXPxTevpCOZuaA8eY9PmR1' -or $preview.branch -cne 'm03-n8n-foundation' -or $preview.commitSha -cnotmatch '^[a-f0-9]{40}$' -or $preview.deploymentId -cnotmatch '^dpl_[A-Za-z0-9]{16,80}$' -or $preview.audience -cnotmatch '^https://everyone-market-researcher-[a-z0-9-]+\.vercel\.app$' -or $preview.target -cne 'preview' -or $preview.protection -cne 'all_except_custom_domains' -or $preview.routeDisabledVerified -isnot [bool]){throw 'blocked'}
  # Request readiness is checked by the sealed public runtime-phase validator
  # below. A new enabled deployment must not inherit the old disabled-route flag.
  $local=Json 'scripts/n8n/gw01-local-privacy.json';if($local.version -ne 1){throw 'blocked'};foreach($name in @('passed','consumerReviewed','canaryTestsPassed')){if($local.$name -isnot [bool] -or -not $local.$name){throw 'blocked'}}
  $cloud=Json 'scripts/n8n/gw01-cloud-privacy.json'
  if($cloud.version -ne 1 -or $cloud.projectRef -cne 'zmotjsbzhzjvpelxvxlf' -or $cloud.instanceHost -cne 'muhhammedsayed.app.n8n.cloud' -or $cloud.ownedWorkflowId -cnotmatch '^[A-Za-z0-9_-]{1,128}$'){throw 'blocked'}
  foreach($name in @('credentialCanaryVerified','executionCanaryVerified','exportCanaryVerified')){if($cloud.$name -isnot [bool] -or -not $cloud.$name){throw 'blocked'}}
  foreach($name in @('passed','logCanaryVerified')){if($cloud.$name -isnot [bool] -or ($Mode -ceq 'Request' -and -not $cloud.$name)){throw 'blocked'}}
  $required=@('scripts/n8n/gw01-gateway-transport.mjs','scripts/n8n/gw01-gateway-logs.mjs','scripts/n8n/gw01-trial.mjs','packages/shared/src/n8n-worker-contracts.ts','packages/shared/package.json','pnpm-lock.yaml','scripts/n8n/windows/New-M03GW01Handoff.ps1','scripts/n8n/windows/Invoke-M03GW01Gateway.ps1','scripts/n8n/gw01-reviewed-preview.json','scripts/n8n/gw01-trial-config.json','scripts/n8n/gw01-local-privacy.json','scripts/n8n/gw01-cloud-privacy.json')
  # Seal the actual physical dependency runtime, not a pnpm symlink or just its
  # version label. Added runtime JavaScript is detected before private reading.
  $zodRelative='node_modules/.pnpm/zod@4.6.7/node_modules/zod';$zodRoot=Safe-Path (Join-Path $repo $zodRelative)
  $sharedModules=Safe-Path (Join-Path $repo 'packages/shared/node_modules');$zodLink=Get-Item -LiteralPath (Join-Path $sharedModules 'zod') -Force
  if(($zodLink.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0 -or @($zodLink.Target).Count -ne 1){throw 'blocked'}
  $target=@($zodLink.Target)[0];$resolvedTarget=[IO.Path]::GetFullPath([IO.Path]::Combine($sharedModules,$target))
  if(-not $resolvedTarget.Equals($zodRoot,[StringComparison]::OrdinalIgnoreCase)){throw 'blocked'}
  $package=Json ($zodRelative+'/package.json');if($package.version -cne '4.6.7'){throw 'blocked'}
  $required+=($zodRelative+'/package.json');$queue=New-Object 'Collections.Generic.Queue[string]';$queue.Enqueue($zodRoot)
  while($queue.Count -gt 0){
    foreach($entry in Get-ChildItem -LiteralPath $queue.Dequeue() -Force){
      if(($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'blocked'}
      if($entry.PSIsContainer){$queue.Enqueue($entry.FullName)}elseif($entry.Extension -ceq '.js'){
        if(-not $entry.FullName.StartsWith($repo+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'blocked'}
        $required+=$entry.FullName.Substring($repo.Length+1).Replace('\','/')
        if($required.Count -gt 2000){throw 'blocked'}
      }
    }
  }
  $seal=Json 'scripts/n8n/gw01-gateway-seal.json';Keys $seal @('version','files','vercelFiles');if($seal.version -ne 1){throw 'blocked'};Keys $seal.files $required
  foreach($relative in $required){$hash=$seal.files.$relative;if($hash -isnot [string] -or $hash -cnotmatch '^[a-f0-9]{64}$' -or (Get-FileHash -LiteralPath (Safe-Path (Join-Path $repo $relative)) -Algorithm SHA256).Hash.ToLowerInvariant() -cne $hash){throw 'blocked'}}
  $vercelRoot=Safe-Path (Join-Path $env:APPDATA 'npm/node_modules/vercel');$vercelPackage=Safe-Path (Join-Path $vercelRoot 'package.json')
  if((ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($vercelPackage))).version -cne '56.5.0'){throw 'blocked'}
  $vercelRequired=@('package.json');$queue=New-Object 'Collections.Generic.Queue[string]';$queue.Enqueue((Safe-Path (Join-Path $vercelRoot 'dist')))
  while($queue.Count -gt 0){foreach($entry in Get-ChildItem -LiteralPath $queue.Dequeue() -Force){
    if(($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'blocked'}
    if($entry.PSIsContainer){$queue.Enqueue($entry.FullName)}elseif($entry.Extension -cin @('.js','.mjs','.cjs','.json','.wasm')){
      if(-not $entry.FullName.StartsWith($vercelRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'blocked'}
      $vercelRequired+=$entry.FullName.Substring($vercelRoot.Length+1).Replace('\','/');if($vercelRequired.Count -gt 2000){throw 'blocked'}
    }
  }}
  if('dist/index.js' -cnotin $vercelRequired){throw 'blocked'};Keys $seal.vercelFiles $vercelRequired
  foreach($relative in $vercelRequired){$hash=$seal.vercelFiles.$relative;if($hash -isnot [string] -or $hash -cnotmatch '^[a-f0-9]{64}$' -or (Get-FileHash -LiteralPath (Safe-Path (Join-Path $vercelRoot $relative)) -Algorithm SHA256).Hash.ToLowerInvariant() -cne $hash){throw 'blocked'}}
  $config=Json 'scripts/n8n/gw01-trial-config.json';Keys $config @('windowId','audiences');if($config.windowId -cne '76c2ad42-c094-4ba4-9a0b-566e19b97780'){throw 'blocked'}
  $journal=Safe-Path (Join-Path $repo 'scripts/n8n/out/gw01/gw01-trial.jsonl');if((Get-Item -LiteralPath $journal).Length -gt 1048576){throw 'blocked'}
  if($Mode -ceq 'Probe'){
    $request=[PSCustomObject]@{version=1;requestId=[Guid]::NewGuid().ToString();operation='identity.read';args=[PSCustomObject]@{}};$actualKind='preflight';$actualAuth='synthetic';$actualFault='none';$names=@('protection')
  }else{
    $request=Json 'scripts/n8n/out/gw01/request.json';Keys $request @('version','requestId','operation','args');$actualKind=$Kind;$actualAuth=$Authorization;$actualFault=$Fault;$names=@('protection','machine')
  }
  $privateDirectory=Safe-Path (Join-Path $env:LOCALAPPDATA 'Temp');$secretFiles=@{protection='emr-m03-gw01-dev-protection.dpapi';machine='emr-m03-gw01-dev-machine.dpapi'}
  foreach($name in $names){$file=Safe-Path (Join-Path $privateDirectory $secretFiles[$name]);$entry=Get-Item -LiteralPath $file -Force;if($entry.PSIsContainer -or $entry.Length -gt 65536){throw 'blocked'}}
  $node=(Get-Command node.exe -CommandType Application -ErrorAction Stop).Source;$runner=Safe-Path (Join-Path $repo 'scripts/n8n/gw01-gateway-transport.mjs')
  $publicSecrets=@{protection='GW01_PUBLIC_PREFLIGHT_PLACEHOLDER_PROTECTION'};if($Mode -ceq 'Request'){$publicSecrets.machine='GW01_PUBLIC_PREFLIGHT_PLACEHOLDER_MACHINE'}
  $publicInput=@{mode=$Mode;preview=$preview;request=$request;kind=$actualKind;authorization=$actualAuth;fault=$actualFault;secrets=$publicSecrets}|ConvertTo-Json -Depth 7 -Compress
  $p=Run '--check-public' $publicInput $false;$publicInput=$null;$receipt.rootChildClosed=$p.closed
  if(-not $p.closed -or $p.native -ne 0 -or $null -eq $p.text){throw 'blocked'};$v=ConvertFrom-Json -InputObject $p.text;Keys $v @('version','status','networkRequests','privateRead')
  if($v.version -ne 1 -or $v.status -cne 'public_ready' -or $v.networkRequests -ne 0 -or $v.privateRead -isnot [bool] -or $v.privateRead){throw 'blocked'}
}catch{Write-Output ($receipt|ConvertTo-Json -Depth 3 -Compress);exit 1}
if($CheckOnly){$receipt.status='check_only_ready';Write-Output ($receipt|ConvertTo-Json -Depth 3 -Compress);exit 0}
try{
  foreach($name in $names){
    $file=Safe-Path (Join-Path $privateDirectory $secretFiles[$name]);$streams[$name]=[IO.File]::Open($file,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::None)
    $receipt.privateRead=$true;$bytes=New-Object byte[] ([int]$streams[$name].Length);if($streams[$name].Read($bytes,0,$bytes.Length) -ne $bytes.Length){throw 'blocked'}
    $secure=ConvertTo-SecureString -String ([Text.Encoding]::ASCII.GetString($bytes).Trim()) -ErrorAction Stop;[Array]::Clear($bytes,0,$bytes.Length)
    $bstr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure);$values[$name]=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr);[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr);$bstr=[IntPtr]::Zero;$secure.Dispose();$secure=$null
  }
  $privateInput=@{mode=$Mode;preview=$preview;request=$request;kind=$actualKind;authorization=$actualAuth;fault=$actualFault;secrets=$values}|ConvertTo-Json -Depth 7 -Compress
  $r=Run '--private-gateway' $privateInput $true;$privateInput=$null;$receipt.rootChildClosed=$r.closed;$receipt.nativeExit=$r.native
  if(-not $r.closed -or $null -eq $r.text){throw 'blocked'};$text=$r.text
  foreach($value in $values.Values){if(-not [string]::IsNullOrEmpty($value) -and $text.Contains($value)){throw 'blocked'}}
  $v=ConvertFrom-Json -InputObject $text;Keys $v @('version','mode','status','code','requestId','operation','kind','attemptRecorded','httpStatus','tlsVerified','headersReceived','socketsClosed','disabledRouteVerified','identityVerified','response','logScan')
  if($v.version -ne 1 -or $v.mode -cne $Mode -or $v.status -cnotin @('complete','stopped_reconcile') -or ($null -ne $v.requestId -and $v.requestId -cne $request.requestId) -or ($null -ne $v.operation -and $v.operation -cne $request.operation) -or ($null -ne $v.kind -and $v.kind -cne $actualKind)){throw 'blocked'}
  foreach($flag in @('attemptRecorded','tlsVerified','headersReceived','socketsClosed','disabledRouteVerified','identityVerified')){if($v.$flag -isnot [bool]){throw 'blocked'}}
  if(($null -ne $v.httpStatus -and ($v.httpStatus -isnot [int] -or $v.httpStatus -lt 100 -or $v.httpStatus -gt 599)) -or ($null -ne $v.code -and $v.code -cnotmatch '^(GW01_GATEWAY_(INPUT|DNS|TLS|STATUS|BODY|PARSE|REDIRECT|AFTER_HEADERS_CANCELLED|BEFORE_SEND_ABORT|TIMEOUT|CLOSE|RESPONSE|PROBE_RESULT|JOURNAL|REDACTED)|GW01_(INPUT_REJECTED|STATE_REJECTED|LOCKED_RECONCILE|CLOCK_REJECTED|NOT_STARTED|EXPIRED|ATTEMPT_LIMIT|CLOSED|CLOSURE_RESERVE|PARALLEL_LIMIT))$')){throw 'blocked'}
  if($v.status -ceq 'complete'){
    if($null -ne $v.code -or -not $v.attemptRecorded -or -not $v.tlsVerified -or -not $v.headersReceived -or -not $v.socketsClosed -or $null -eq $v.response){throw 'blocked'}
    if($Mode -ceq 'Probe'){
      Keys $v.response @('requestId','error');Keys $v.response.error @('code')
      if($v.httpStatus -ne 503 -or -not $v.disabledRouteVerified -or $v.identityVerified -or $null -ne $v.response.requestId -or $v.response.error.code -cne 'unavailable'){throw 'blocked'}
      Keys $v.logScan @('version','status','code','capturedMatchingRequest','logsScanned','publicAuthMarkerFound','requestBodyMarkerFound','ownBypassFound','truncated','childClosed','observedAt')
      if($v.logScan.version -ne 1 -or $v.logScan.status -cnotin @('verified','unverified') -or $v.logScan.logsScanned -isnot [int] -or $v.logScan.logsScanned -lt 0 -or $v.logScan.logsScanned -gt 100 -or ($null -ne $v.logScan.observedAt -and $v.logScan.observedAt -cnotmatch '^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$') -or ($null -ne $v.logScan.code -and $v.logScan.code -cnotmatch '^GW01_LOGS_(INPUT|NATIVE|TIMEOUT|CLOSE|RESPONSE|TRUNCATED|NO_CAPTURE|REFLECTION)$')){throw 'blocked'}
      foreach($flag in @('capturedMatchingRequest','publicAuthMarkerFound','requestBodyMarkerFound','ownBypassFound','truncated','childClosed')){if($v.logScan.$flag -isnot [bool]){throw 'blocked'}}
      if($v.logScan.status -ceq 'verified'){
        if($r.native -ne 0 -or $null -ne $v.logScan.code -or -not $v.logScan.capturedMatchingRequest -or $v.logScan.logsScanned -lt 1 -or -not $v.logScan.childClosed -or $null -eq $v.logScan.observedAt -or $v.logScan.publicAuthMarkerFound -or $v.logScan.requestBodyMarkerFound -or $v.logScan.ownBypassFound -or $v.logScan.truncated){throw 'blocked'}
      }elseif($r.native -ne 1 -or $null -eq $v.logScan.code){throw 'blocked'}
    }elseif($v.disabledRouteVerified -or $null -ne $v.logScan -or $r.native -ne 0){throw 'blocked'}
  }elseif($null -ne $v.response -or $v.identityVerified -or $v.disabledRouteVerified -or $r.native -eq 0){throw 'blocked'}
  $receipt.result=$v;$receipt.status=$v.status
  if($Mode -ceq 'Probe' -and $v.status -ceq 'complete' -and $v.logScan.status -ceq 'unverified'){$receipt.status='privacy_pending'}
}catch{$receipt.status='stopped_reconcile'}finally{
  if($bstr -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)};if($null -ne $secure){$secure.Dispose()};if($null -ne $bytes){[Array]::Clear($bytes,0,$bytes.Length)}
  $privateInput=$null;$values.Clear();$text=$null;$v=$null;$r=$null;foreach($stream in $streams.Values){$stream.Dispose()};$streams.Clear()
}
Write-Output ($receipt|ConvertTo-Json -Depth 20 -Compress)
if($receipt.status -cne 'complete' -or -not $receipt.rootChildClosed){exit 1};exit 0
