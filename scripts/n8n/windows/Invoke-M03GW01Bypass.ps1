[CmdletBinding()]
param([ValidateSet('Create','Reconcile','RecoverSoleCreated','Revoke','ReconcileRevoked')][string]$Mode='Create',[switch]$CheckOnly)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
$project='prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu';$team='team_gboXPxTevpCOZuaA8eY9PmR1';$note='M03 GW-01 dev trial 76c2ad42'
$endpoint='/v1/projects/'+$project+'/protection-bypass?teamId='+$team
$required=@('scripts/n8n/windows/Invoke-M03GW01Bypass.ps1','scripts/n8n/gw01-local-privacy.json','scripts/n8n/gw01-cloud-privacy.json','scripts/n8n/gw01-vercel-no-retry.mjs','scripts/n8n/gw01-gateway-seal.json')
$secret=$null;$secure=$null;$bstr=[IntPtr]::Zero;$random=$null;$rng=$null;$stream=$null;$child=$null;$start=$null;$memory=$null;$buffer=$null;$started=$false;$closed=$true;$sensitiveRead=$false;$privateInput=$null;$raw=$null;$response=$null
$receipt=[ordered]@{version=1;mode=$Mode;status='preflight_blocked';code=$null;nativeExit=$null;childClosed=$true;handoffRetained=$true;ownEntryPresent=$null;defaultFlagShape=$null;ownershipMetadataVerified=$false;createdReceiptRecorded=$false;recoveredReadbackRecorded=$false;provenance='none';soleOwnedDefaultVerified=$false;revocationReadbackVerified=$false;nonDefaultVerified=$false;otherEntryCount=$null;otherAutomationCount=$null;otherSelectedDefaultCount=$null;unknownOtherFlagCount=$null;otherEntriesRequested=$false}
$soleRecovery=$false;$known=$null;$recovered=$null;$revokeIntent=$null
function Safe([string]$Path){$p=[IO.Path]::GetFullPath($Path);$c=$p;while($null -ne $c){$e=Get-Item -LiteralPath $c -Force;if(($e.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'blocked'};$parent=[IO.Directory]::GetParent($c);$c=if($null -eq $parent){$null}else{$parent.FullName}};return $p}
function Read-Json([string]$Path){$p=Safe $Path;if((Get-Item -LiteralPath $p).Length -gt 65536){throw 'blocked'};return ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($p))}
function Keys($Value,[string[]]$Expected){if($Value -isnot [PSCustomObject] -or @(Compare-Object -ReferenceObject @($Expected|Sort-Object) -DifferenceObject @($Value.PSObject.Properties.Name|Sort-Object)).Count -ne 0){throw 'blocked'}}
function New-Json([string]$Path,$Value){$s=$null;try{$data=[Text.Encoding]::UTF8.GetBytes(($Value|ConvertTo-Json -Compress));$s=[IO.File]::Open($Path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);$s.Write($data,0,$data.Length);$s.Flush($true)}finally{if($null -ne $s){$s.Dispose()}}}
function Default-FlagShape($Value){$property=$Value.PSObject.Properties['isEnvVar'];if($null -eq $property){return 'absent'};if($property.Value -isnot [bool]){return 'not_boolean'};if($property.Value){return 'true'};return 'false'}
function Verify-VercelRuntime([string]$Runtime){
 $gateway=Read-Json (Join-Path $repo 'scripts/n8n/gw01-gateway-seal.json');Keys $gateway @('version','files','vercelFiles')
 if($gateway.version -isnot [int] -or $gateway.version -ne 1 -or $gateway.files -isnot [PSCustomObject] -or $gateway.vercelFiles -isnot [PSCustomObject]){throw 'blocked'}
 $runtime=Safe $Runtime;$expected=@('package.json');$queue=New-Object 'Collections.Generic.Queue[string]';$queue.Enqueue((Safe (Join-Path $runtime 'dist')));$seen=0
 while($queue.Count -gt 0){foreach($entry in Get-ChildItem -LiteralPath $queue.Dequeue() -Force){
  $seen+=1;if($seen -gt 10000 -or ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'blocked'}
  if($entry.PSIsContainer){$queue.Enqueue($entry.FullName)}elseif($entry.Extension -cin @('.js','.mjs','.cjs','.json','.wasm')){
   if(-not $entry.FullName.StartsWith($runtime+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'blocked'}
   $expected+=$entry.FullName.Substring($runtime.Length+1).Replace('\','/');if($expected.Count -gt 2000){throw 'blocked'}
  }
 }}
 if('dist/index.js' -cnotin $expected){throw 'blocked'};Keys $gateway.vercelFiles $expected
 foreach($relative in $expected){$digest=$gateway.vercelFiles.$relative;if($digest -isnot [string] -or $digest -cnotmatch '^[a-f0-9]{64}$' -or (Get-FileHash -LiteralPath (Safe (Join-Path $runtime $relative)) -Algorithm SHA256).Hash.ToLowerInvariant() -cne $digest){throw 'blocked'}}
}
function Known-Create($Owner){
 $k=Read-Json $knownFile;Keys $k @('version','windowId','projectId','note','intentCreatedAt','originalCli');Keys $k.originalCli @('mode','nativeExit','childClosed','ownEntryPresent','status','code','toolRef')
 if($k.version -isnot [int] -or $k.version -ne 1 -or $k.windowId -cne $Owner.windowId -or $k.projectId -cne $project -or $k.note -cne $note -or $k.intentCreatedAt -isnot [long] -or $k.intentCreatedAt -ne $Owner.createdAt -or $k.originalCli.mode -cne 'Create' -or $k.originalCli.nativeExit -isnot [int] -or $k.originalCli.nativeExit -ne 0 -or $k.originalCli.childClosed -isnot [bool] -or -not $k.originalCli.childClosed -or $k.originalCli.ownEntryPresent -isnot [bool] -or -not $k.originalCli.ownEntryPresent -or $k.originalCli.status -cne 'stopped_reconcile' -or $k.originalCli.code -cne 'GW01_BYPASS_DEFAULT_UNVERIFIED' -or $k.originalCli.toolRef -isnot [string] -or $k.originalCli.toolRef -cnotmatch '^[A-Za-z0-9_./: -]{1,200}$'){throw 'blocked'}
 return $k
}
function Read-Recovered($Owner,$Known){
 $p=Read-Json $recoveredFile;Keys $p @('version','windowId','projectId','note','intentCreatedAt','entryCreatedAt','knownCreateToolRef','provenance','observedAt')
 if($p.version -isnot [int] -or $p.version -ne 1 -or $p.windowId -cne $Owner.windowId -or $p.projectId -cne $project -or $p.note -cne $note -or $p.intentCreatedAt -isnot [long] -or $p.intentCreatedAt -ne $Owner.createdAt -or $p.entryCreatedAt -isnot [long] -or $p.entryCreatedAt -lt ($Owner.createdAt-5000) -or $p.entryCreatedAt -gt ($Owner.createdAt+30000) -or $p.knownCreateToolRef -cne $Known.originalCli.toolRef -or $p.provenance -cne 'recovered_sole_readback' -or $p.observedAt -isnot [long] -or $p.observedAt -lt ($Owner.createdAt-5000) -or $p.observedAt -gt ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()+5000)){throw 'blocked'}
 return $p
}
try{
 $null=Safe $repo;$local=Read-Json (Join-Path $repo 'scripts/n8n/gw01-local-privacy.json');foreach($key in @('passed','consumerReviewed','canaryTestsPassed')){if($local.$key -isnot [bool] -or -not $local.$key){throw 'blocked'}}
 $cloud=Read-Json (Join-Path $repo 'scripts/n8n/gw01-cloud-privacy.json');if($cloud.projectRef -cne 'zmotjsbzhzjvpelxvxlf' -or $cloud.instanceHost -cne 'muhhammedsayed.app.n8n.cloud'){throw 'blocked'};foreach($key in @('credentialCanaryVerified','executionCanaryVerified','exportCanaryVerified')){if($cloud.$key -isnot [bool] -or -not $cloud.$key){throw 'blocked'}}
 $knownRelative='scripts/n8n/gw01-bypass-known-create.json';$knownFile=Join-Path $repo $knownRelative;if((Test-Path -LiteralPath $knownFile) -or $Mode -cin @('RecoverSoleCreated','ReconcileRevoked')){$required+=@($knownRelative)}
 $seal=Read-Json (Join-Path $repo 'scripts/n8n/gw01-bypass-seal.json');Keys $seal @('version','files','vercelCliSha256','vercelPackageSha256');if($seal.version -ne 1){throw 'blocked'};Keys $seal.files $required
 foreach($relative in $required){$hash=$seal.files.$relative;if($hash -isnot [string] -or $hash -cnotmatch '^[a-f0-9]{64}$' -or (Get-FileHash -LiteralPath (Safe (Join-Path $repo $relative)) -Algorithm SHA256).Hash.ToLowerInvariant() -cne $hash){throw 'blocked'}}
 $cli=Safe (Join-Path $env:APPDATA 'npm/node_modules/vercel/dist/index.js');$package=Safe (Join-Path $env:APPDATA 'npm/node_modules/vercel/package.json');$preloadUri=([Uri](Safe (Join-Path $repo 'scripts/n8n/gw01-vercel-no-retry.mjs'))).AbsoluteUri
 if((Get-FileHash -LiteralPath $cli -Algorithm SHA256).Hash.ToLowerInvariant() -cne $seal.vercelCliSha256 -or (Get-FileHash -LiteralPath $package -Algorithm SHA256).Hash.ToLowerInvariant() -cne $seal.vercelPackageSha256 -or (Read-Json $package).version -cne '56.5.0'){throw 'blocked'}
 Verify-VercelRuntime (Join-Path $env:APPDATA 'npm/node_modules/vercel')
 $node=(Get-Command node.exe -CommandType Application).Source;$temp=Safe (Join-Path $env:LOCALAPPDATA 'Temp');$handoff=Join-Path $temp 'emr-m03-gw01-dev-protection.dpapi'
 $out=Join-Path $repo 'scripts/n8n/out';if(-not (Test-Path -LiteralPath $out)){$null=New-Item -ItemType Directory -Path $out};$out=Safe $out;$intent=Join-Path $out 'gw01-bypass-intent.json';$createdFile=Join-Path $out 'gw01-bypass-created.json';$recoveredFile=Join-Path $out 'gw01-bypass-recovered-sole.json';$revokeIntentFile=Join-Path $out 'gw01-bypass-revoke-intent.json'
 if($Mode -ceq 'Create'){if((Test-Path -LiteralPath $handoff) -or (Test-Path -LiteralPath $intent) -or (Test-Path -LiteralPath $createdFile) -or (Test-Path -LiteralPath $recoveredFile) -or (Test-Path -LiteralPath $revokeIntentFile) -or (Test-Path -LiteralPath $knownFile)){throw 'blocked'}}else{
  $owner=Read-Json $intent;Keys $owner @('version','windowId','projectId','note','createdAt');if($owner.version -ne 1 -or $owner.windowId -cne '76c2ad42-c094-4ba4-9a0b-566e19b97780' -or $owner.projectId -cne $project -or $owner.note -cne $note -or $owner.createdAt -isnot [long]){throw 'blocked'};$null=Safe $handoff;if((Get-Item -LiteralPath $handoff).Length -gt 65536){throw 'blocked'}
  if($Mode -ceq 'RecoverSoleCreated'){$known=Known-Create $owner;if(Test-Path -LiteralPath $revokeIntentFile){throw 'blocked'};if(Test-Path -LiteralPath $recoveredFile){$recovered=Read-Recovered $owner $known}}
  if($Mode -cin @('Revoke','ReconcileRevoked')){
   if(Test-Path -LiteralPath $recoveredFile){$known=Known-Create $owner;$recovered=Read-Recovered $owner $known;$soleRecovery=$true
    if($Mode -ceq 'Revoke' -and (Test-Path -LiteralPath $revokeIntentFile)){throw 'blocked'}
    if($Mode -ceq 'ReconcileRevoked'){$revokeIntent=Read-Json $revokeIntentFile;Keys $revokeIntent @('version','windowId','projectId','note','entryCreatedAt','provenance','requestedAt');if($revokeIntent.version -isnot [int] -or $revokeIntent.version -ne 1 -or $revokeIntent.windowId -cne $owner.windowId -or $revokeIntent.projectId -cne $project -or $revokeIntent.note -cne $note -or $revokeIntent.entryCreatedAt -isnot [long] -or $revokeIntent.entryCreatedAt -ne $recovered.entryCreatedAt -or $revokeIntent.provenance -cne 'recovered_sole_readback' -or $revokeIntent.requestedAt -isnot [long] -or $revokeIntent.requestedAt -lt $recovered.observedAt -or $revokeIntent.requestedAt -gt ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()+5000)){throw 'blocked'}}
   }elseif($Mode -ceq 'ReconcileRevoked'){throw 'blocked'}else{$created=Read-Json $createdFile;Keys $created @('version','projectId','note','createdAt');if($created.version -ne 1 -or $created.projectId -cne $project -or $created.note -cne $note -or $created.createdAt -lt ($owner.createdAt-5000)){throw 'blocked'}}
  }
 }
}catch{Write-Output 'GW01_BYPASS_PREFLIGHT_BLOCKED. No credential read, generation, child or API request.';exit 1}
if($CheckOnly){Write-Output 'GW01_BYPASS_CHECK_ONLY_READY. No credential read, generation, child or API request.';exit 0}
try{
 if($Mode -ceq 'Create'){
  $random=New-Object byte[] 16;$rng=[Security.Cryptography.RandomNumberGenerator]::Create();$rng.GetBytes($random);$secret=[BitConverter]::ToString($random).Replace('-','').ToLowerInvariant();[Array]::Clear($random,0,$random.Length)
  $secure=ConvertTo-SecureString -String $secret -AsPlainText -Force;$encoded=ConvertFrom-SecureString $secure;$stream=[IO.File]::Open($handoff,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);$bytes=[Text.Encoding]::ASCII.GetBytes($encoded);$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true);[Array]::Clear($bytes,0,$bytes.Length);$stream.Dispose();$stream=$null;$encoded=$null
  $owner=[PSCustomObject]@{version=1;windowId='76c2ad42-c094-4ba4-9a0b-566e19b97780';projectId=$project;note=$note;createdAt=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()};New-Json $intent $owner
 }else{
  $stream=[IO.File]::Open((Safe $handoff),[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::None);$bytes=New-Object byte[] ([int]$stream.Length);if($stream.Read($bytes,0,$bytes.Length) -ne $bytes.Length){throw 'blocked'};$secure=ConvertTo-SecureString -String ([Text.Encoding]::ASCII.GetString($bytes).Trim());[Array]::Clear($bytes,0,$bytes.Length);$bstr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure);$secret=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr);[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr);$bstr=[IntPtr]::Zero
 }
 $sensitiveRead=$true;if($secret -cnotmatch '^[a-zA-Z0-9]{32}$'){throw 'blocked'}
 $phases=if($Mode -ceq 'Revoke' -and $soleRecovery){@('InspectBeforeRevoke','Revoke','VerifyAfterRevoke')}elseif($Mode -ceq 'Revoke'){@('InspectBeforeRevoke','Revoke')}else{@($Mode)}
 foreach($phase in $phases){
 $method='PATCH';$path=$endpoint;$started=$false;$closed=$true
 if($phase -ceq 'Create'){$privateInput=@{generate=@{secret=$secret;note=$note}}|ConvertTo-Json -Compress}
 elseif($phase -ceq 'Revoke'){if($soleRecovery){New-Json $revokeIntentFile ([ordered]@{version=1;windowId=$owner.windowId;projectId=$project;note=$note;entryCreatedAt=$recovered.entryCreatedAt;provenance='recovered_sole_readback';requestedAt=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()})};$privateInput=@{revoke=@{secret=$secret;regenerate=$false}}|ConvertTo-Json -Compress}
 else{$method='GET';$path='/v9/projects/'+$project+'?teamId='+$team}
 $arguments=@('--import',$preloadUri,$cli,'api',$path,'--method',$method,'--raw','--scope','muhammed-abdelrahman','--non-interactive','--no-color');if($method -ceq 'PATCH'){$arguments+=@('--input','-')}
 $start=New-Object Diagnostics.ProcessStartInfo;$start.FileName=$node;$start.Arguments=(@($arguments|ForEach-Object{if($_ -match '["\r\n\x00]'){throw 'blocked'};'"'+$_+'"'}) -join ' ');$start.WorkingDirectory=$repo;$start.UseShellExecute=$false;$start.CreateNoWindow=$true;$start.RedirectStandardInput=$true;$start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true;$start.EnvironmentVariables.Clear();foreach($name in @('SystemRoot','WINDIR','PATH','TEMP','TMP','LOCALAPPDATA','APPDATA','USERPROFILE')){$v=[Environment]::GetEnvironmentVariable($name,'Process');if($null -ne $v){$start.EnvironmentVariables[$name]=$v}}
 $child=New-Object Diagnostics.Process;$child.StartInfo=$start;$started=$child.Start();if(-not $started){throw 'blocked'};$closed=$false;$start.EnvironmentVariables.Clear();$buffer=New-Object byte[] 65536;$memory=[IO.MemoryStream]::new([byte[]]$buffer,$true);$stdout=$child.StandardOutput.BaseStream.CopyToAsync($memory);$stderr=$child.StandardError.BaseStream.CopyToAsync([IO.Stream]::Null);if($null -ne $privateInput){$child.StandardInput.Write($privateInput)};$child.StandardInput.Close();$privateInput=$null
 if(-not $child.WaitForExit(20000)){throw 'blocked'};$closed=$true;$receipt.nativeExit=$child.ExitCode;if(-not [Threading.Tasks.Task]::WhenAll([Threading.Tasks.Task[]]@($stdout,$stderr)).Wait(5000)){throw 'blocked'}
 if($child.ExitCode -ne 0){$receipt.code='GW01_BYPASS_NATIVE_FAILURE';throw 'blocked'};$raw=[Text.Encoding]::UTF8.GetString($buffer,0,[int]$memory.Position);$response=ConvertFrom-Json -InputObject $raw;$raw=$null
 if($method -ceq 'GET' -and $response.id -cne $project){throw 'blocked'}
 $map=$response.PSObject.Properties['protectionBypass'];if($null -ne $map -and $null -ne $map.Value -and $map.Value -isnot [PSCustomObject]){throw 'blocked'};$entry=if($null -ne $map -and $null -ne $map.Value){$map.Value.PSObject.Properties[$secret]}else{$null};$receipt.ownEntryPresent=$null -ne $entry
 $counts=@{otherEntryCount=0;otherAutomationCount=0;otherSelectedDefaultCount=0;unknownOtherFlagCount=0}
 if($null -ne $map -and $null -ne $map.Value){foreach($other in $map.Value.PSObject.Properties){if($other.Name -ceq $secret){continue};$counts.otherEntryCount+=1
  if($other.Value -isnot [PSCustomObject]){throw 'blocked'};$otherScope=$other.Value.PSObject.Properties['scope'];if($null -eq $otherScope -or $otherScope.Value -cnotin @('automation-bypass','integration-automation-bypass')){throw 'blocked'}
  if($otherScope.Value -ceq 'automation-bypass'){$counts.otherAutomationCount+=1;$shape=Default-FlagShape $other.Value;if($shape -cin @('absent','true')){$counts.otherSelectedDefaultCount+=1}elseif($shape -ceq 'not_boolean'){$counts.unknownOtherFlagCount+=1}}
 }}
 foreach($countName in $counts.Keys){$receipt[$countName]=$counts[$countName]};$other=$null;$otherScope=$null;$shape=$null
 if($phase -ceq 'InspectBeforeRevoke'){
  $expectedCreatedAt=if($soleRecovery){$recovered.entryCreatedAt}else{$created.createdAt}
  if($null -eq $entry -or $entry.Value.scope -cne 'automation-bypass' -or $entry.Value.note -cne $note -or $entry.Value.createdAt -isnot [long] -or $entry.Value.createdAt -ne $expectedCreatedAt){throw 'blocked'}
  $receipt.ownershipMetadataVerified=$true;$receipt.defaultFlagShape=Default-FlagShape $entry.Value
  if($soleRecovery){if($receipt.defaultFlagShape -cnotin @('absent','true') -or $receipt.otherEntryCount -ne 0){throw 'blocked'};$receipt.soleOwnedDefaultVerified=$true;$receipt.recoveredReadbackRecorded=$true;$receipt.provenance='recovered_sole_readback'}
  else{$receipt.createdReceiptRecorded=$true;$receipt.provenance='successful_create_response';if($receipt.defaultFlagShape -cne 'false'){$receipt.code='GW01_BYPASS_DEFAULT_UNVERIFIED';throw 'blocked'};$receipt.nonDefaultVerified=$true}
  $response=$null;$entry=$null;$map=$null;$child.Dispose();$child=$null;$memory.Dispose();$memory=$null;[Array]::Clear($buffer,0,$buffer.Length);$buffer=$null;continue
 }elseif($phase -ceq 'Revoke'){
  if($null -ne $entry){throw 'blocked'};if(-not $soleRecovery){$stream.Dispose();$stream=$null;Remove-Item -LiteralPath (Safe $handoff) -ErrorAction Stop;$receipt.handoffRetained=Test-Path -LiteralPath $handoff;if($receipt.handoffRetained){throw 'blocked'};$receipt.status='complete'}
 }elseif($phase -cin @('VerifyAfterRevoke','ReconcileRevoked')){
  if(-not $soleRecovery -or $null -eq $map -or $map.Value -isnot [PSCustomObject] -or $null -ne $entry -or $receipt.otherEntryCount -ne 0){throw 'blocked'};$receipt.provenance='recovered_sole_readback';$receipt.recoveredReadbackRecorded=$true;$receipt.soleOwnedDefaultVerified=$false;$receipt.revocationReadbackVerified=$true
  $stream.Dispose();$stream=$null;Remove-Item -LiteralPath (Safe $handoff) -ErrorAction Stop;$receipt.handoffRetained=Test-Path -LiteralPath $handoff;if($receipt.handoffRetained){throw 'blocked'};$receipt.status='complete'
 }else{
  if($null -eq $entry -or $entry.Value.scope -cne 'automation-bypass' -or $entry.Value.note -cne $note){throw 'blocked'}
  $receipt.defaultFlagShape=Default-FlagShape $entry.Value
  if($entry.Value.createdAt -isnot [long] -or $entry.Value.createdAt -lt ($owner.createdAt-5000) -or $entry.Value.createdAt -gt ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()+5000)){throw 'blocked'}
  $receipt.ownershipMetadataVerified=$true
  if(Test-Path -LiteralPath $createdFile){$created=Read-Json $createdFile;Keys $created @('version','projectId','note','createdAt');if($created.version -ne 1 -or $created.projectId -cne $project -or $created.note -cne $note -or $created.createdAt -ne $entry.Value.createdAt){throw 'blocked'};$receipt.createdReceiptRecorded=$true}
  elseif($phase -ceq 'Create'){New-Json $createdFile ([ordered]@{version=1;projectId=$project;note=$note;createdAt=$entry.Value.createdAt});$receipt.createdReceiptRecorded=$true}
  if($Mode -ceq 'RecoverSoleCreated'){
   if($receipt.defaultFlagShape -cnotin @('absent','true') -or $receipt.otherEntryCount -ne 0 -or $entry.Value.createdAt -gt ($owner.createdAt+30000)){throw 'blocked'}
   if($null -ne $recovered){if($recovered.entryCreatedAt -ne $entry.Value.createdAt){throw 'blocked'}}else{New-Json $recoveredFile ([ordered]@{version=1;windowId=$owner.windowId;projectId=$project;note=$note;intentCreatedAt=$owner.createdAt;entryCreatedAt=$entry.Value.createdAt;knownCreateToolRef=$known.originalCli.toolRef;provenance='recovered_sole_readback';observedAt=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()})}
   $receipt.recoveredReadbackRecorded=$true;$receipt.provenance='recovered_sole_readback';$receipt.soleOwnedDefaultVerified=$true;$receipt.status='complete'
  }else{if($receipt.defaultFlagShape -cne 'false'){$receipt.code='GW01_BYPASS_DEFAULT_UNVERIFIED';throw 'blocked'};$receipt.nonDefaultVerified=$true
   if(-not $receipt.createdReceiptRecorded){$receipt.code='GW01_BYPASS_OWNERSHIP_UNVERIFIED';throw 'blocked'};$receipt.provenance='successful_create_response';$receipt.status='complete'}
 }
 }
}catch{if($null -eq $receipt.code){$receipt.code='GW01_BYPASS_RECONCILE_REQUIRED'};$receipt.status='stopped_reconcile'}finally{
 $secret=$null;$privateInput=$null;$raw=$null;$response=$null;$entry=$null;$map=$null;if($bstr -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)};if($null -ne $secure){$secure.Dispose()};if($null -ne $rng){$rng.Dispose()};if($null -ne $random){[Array]::Clear($random,0,$random.Length)};if($null -ne $stream){$stream.Dispose()};if($null -ne $start){$start.EnvironmentVariables.Clear()}
 if($null -ne $child){if($started -and -not $closed){try{if(-not $child.WaitForExit(0)){$child.Kill()};$closed=$child.WaitForExit(5000)}catch{$closed=$false}};$child.Dispose()};if($null -ne $memory){$memory.Dispose()};if($null -ne $buffer){[Array]::Clear($buffer,0,$buffer.Length)};$receipt.childClosed=$closed
 if(-not $closed){$receipt.status='stopped_reconcile';$receipt.code='GW01_BYPASS_CHILD_CLEANUP_UNVERIFIED'}
}
Write-Output ($receipt|ConvertTo-Json -Compress)
if($receipt.status -cne 'complete'){exit 1};exit 0
