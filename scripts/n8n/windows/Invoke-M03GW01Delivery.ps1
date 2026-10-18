[CmdletBinding()]
param([ValidateSet('Canary','Runtime','ReconcileCanary','ReconcileRuntime','PrivacyRead','Cleanup')][string]$Mode='Canary',[switch]$CheckOnly)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
$required=@('scripts/n8n/gw01-delivery.mjs','scripts/n8n/gw01-delivery-transport.mjs','scripts/n8n/gw01-credential-ownership.mjs','scripts/n8n/gw01-privacy-read.mjs','scripts/n8n/inventory.mjs','scripts/n8n/windows/New-M03GW01Handoff.ps1','scripts/n8n/windows/Invoke-M03GW01Delivery.ps1','scripts/n8n/gw01-delivery-packet.json','scripts/n8n/gw01-local-privacy.json')
$secretFiles=@{management='emr-m03-gw01-dev-management.dpapi';writer='emr-m03-gw01-dev-writer.dpapi';machine='emr-m03-gw01-dev-machine.dpapi';protection='emr-m03-gw01-dev-protection.dpapi'}
$names=if($Mode -ceq 'Runtime'){@('management','writer','machine','protection')}else{@('management')}
$streams=@{};$values=@{};$secure=$null;$bstr=[IntPtr]::Zero;$start=$null;$child=$null;$started=$false;$closed=$true;$buffer=$null;$memory=$null;$privateInput=$null;$stdout=$null;$stderr=$null;$success=$false;$privateRead=$false
$receipt=[ordered]@{version=1;mode=$Mode;status='preflight_blocked';code=$null;privateRead=$false;rootChildClosed=$true;nativeExit=$null;handoffsRetained=$true;delivery=$null}
function Safe-Path([string]$Path){
  $absolute=[IO.Path]::GetFullPath($Path);$cursor=$absolute
  while($null -ne $cursor){$entry=Get-Item -LiteralPath $cursor -Force -ErrorAction Stop;if(($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'blocked'};$parent=[IO.Directory]::GetParent($cursor);$cursor=if($null -eq $parent){$null}else{$parent.FullName}}
  return $absolute
}
function Read-PublicJson([string]$Relative){$file=Safe-Path (Join-Path $repo $Relative);if((Get-Item -LiteralPath $file).Length -gt 65536){throw 'blocked'};return ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($file)) -ErrorAction Stop}
function Keys($Value,[string[]]$Expected){if($Value -isnot [PSCustomObject] -or @(Compare-Object -ReferenceObject @($Expected|Sort-Object) -DifferenceObject @($Value.PSObject.Properties.Name|Sort-Object)).Count -ne 0){throw 'blocked'}}
function Cloud-Gate{
  $g=Read-PublicJson 'scripts/n8n/gw01-cloud-privacy.json'
  if($g.version -ne 1 -or $g.projectRef -cne 'zmotjsbzhzjvpelxvxlf' -or $g.instanceHost -cne 'muhhammedsayed.app.n8n.cloud'){throw 'blocked'}
  foreach($key in @('passed','credentialCanaryVerified','executionCanaryVerified','exportCanaryVerified','logCanaryVerified')){if($g.$key -isnot [bool] -or $g.$key -ne $true){throw 'blocked'}}
  if($g.ownedWorkflowId -isnot [string] -or $g.ownedWorkflowId -cnotmatch '^[A-Za-z0-9_-]{1,128}$'){throw 'blocked'}
}
try{
  $null=Safe-Path $repo
  $packet=Read-PublicJson 'scripts/n8n/gw01-delivery-packet.json'
  Keys $packet @('version','projectRef','projectId','branch','audience','commitSha','deploymentId')
  if($packet.version -ne 1 -or $packet.projectRef -cne 'zmotjsbzhzjvpelxvxlf' -or $packet.projectId -cne 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu' -or $packet.branch -cne 'm03-n8n-foundation' -or $packet.audience -cnotmatch '^https://everyone-market-researcher-[a-z0-9-]+\.vercel\.app$' -or $packet.commitSha -cnotmatch '^[a-f0-9]{40}$' -or $packet.deploymentId -cnotmatch '^dpl_[A-Za-z0-9]{16,80}$'){throw 'blocked'}
  $local=Read-PublicJson 'scripts/n8n/gw01-local-privacy.json'
  if($local.version -ne 1 -or $local.passed -isnot [bool] -or $local.passed -ne $true -or $local.consumerReviewed -isnot [bool] -or $local.consumerReviewed -ne $true -or $local.canaryTestsPassed -isnot [bool] -or $local.canaryTestsPassed -ne $true){throw 'blocked'}
  if($Mode -ceq 'Runtime'){$required+=@('scripts/n8n/gw01-cloud-privacy.json');Cloud-Gate}
  if($Mode -ceq 'PrivacyRead'){$required+=@('scripts/n8n/gw01-owned-privacy-target.json');$privacyTarget=Read-PublicJson 'scripts/n8n/gw01-owned-privacy-target.json';Keys $privacyTarget @('workflowId','executionId','audience');if($privacyTarget.audience -cne $packet.audience -or $privacyTarget.workflowId -cnotmatch '^[A-Za-z0-9_-]{1,128}$' -or $privacyTarget.executionId -cnotmatch '^[1-9][0-9]{0,31}$'){throw 'blocked'}}
  $seal=Read-PublicJson 'scripts/n8n/gw01-delivery-seal.json'
  Keys $seal @('version','files','vercelCliSha256','vercelPackageSha256')
  if($seal.version -ne 1){throw 'blocked'};Keys $seal.files $required
  foreach($relative in $required){$hash=$seal.files.$relative;if($hash -isnot [string] -or $hash -cnotmatch '^[a-f0-9]{64}$' -or (Get-FileHash -Algorithm SHA256 -LiteralPath (Safe-Path (Join-Path $repo $relative))).Hash.ToLowerInvariant() -cne $hash){throw 'blocked'}}
  if($Mode -ceq 'Runtime'){
    $cli=Safe-Path (Join-Path $env:APPDATA 'npm/node_modules/vercel/dist/vc.js');$package=Safe-Path (Join-Path $env:APPDATA 'npm/node_modules/vercel/package.json')
    if((Get-FileHash -Algorithm SHA256 -LiteralPath $cli).Hash.ToLowerInvariant() -cne $seal.vercelCliSha256 -or (Get-FileHash -Algorithm SHA256 -LiteralPath $package).Hash.ToLowerInvariant() -cne $seal.vercelPackageSha256 -or (ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($package))).version -cne '56.5.0'){throw 'blocked'}
  }
  $runner=Safe-Path (Join-Path $repo 'scripts/n8n/gw01-delivery.mjs');$node=(Get-Command node.exe -CommandType Application -ErrorAction Stop).Source
  $privateDirectory=Safe-Path (Join-Path $env:LOCALAPPDATA 'Temp')
  $leasePath=Safe-Path (Join-Path $privateDirectory 'emr-m03-gw01-dev-management.lease.json')
  if((Get-Item -LiteralPath $leasePath).Length -gt 4096){throw 'blocked'}
  $lease=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($leasePath));Keys $lease @('version','windowId','createdAt','expiresAt')
  $createdAt=[DateTimeOffset]::Parse($lease.createdAt);$expiresAt=[DateTimeOffset]::Parse($lease.expiresAt)
  if($lease.version -ne 1 -or $lease.windowId -cne '76c2ad42-c094-4ba4-9a0b-566e19b97780' -or ($expiresAt-$createdAt).TotalMinutes -ne 120 -or [DateTimeOffset]::UtcNow -lt $createdAt -or [DateTimeOffset]::UtcNow -ge $expiresAt){throw 'blocked'}
  foreach($name in $names){$file=Safe-Path (Join-Path $privateDirectory $secretFiles[$name]);if((Get-Item -LiteralPath $file).Length -gt 65536){throw 'blocked'}}
}catch{Write-Output 'GW01_DELIVERY_PREFLIGHT_BLOCKED. No private file read, decryption, child or network request.';exit 1}
if($CheckOnly){Write-Output 'GW01_DELIVERY_CHECK_ONLY_READY. Public source/target/privacy seals and temporary handoff presence verified; no decryption or network.';exit 0}
try{
  foreach($name in $names){
    $file=Safe-Path (Join-Path $privateDirectory $secretFiles[$name])
    $streams[$name]=[IO.File]::Open($file,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::None)
    $privateRead=$true;$bytes=New-Object byte[] ([int]$streams[$name].Length)
    if($streams[$name].Read($bytes,0,$bytes.Length) -ne $bytes.Length){throw 'blocked'}
    $secure=ConvertTo-SecureString -String ([Text.Encoding]::ASCII.GetString($bytes).Trim()) -ErrorAction Stop
    [Array]::Clear($bytes,0,$bytes.Length);$bstr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $values[$name]=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr);$bstr=[IntPtr]::Zero;$secure.Dispose();$secure=$null
  }
  $config=@{audience=$packet.audience;privacyVerified=($Mode -ceq 'Runtime')};if($Mode -ceq 'PrivacyRead'){$config.privacyTarget=$privacyTarget}
  $privateInput=@{mode=$Mode;secrets=$values;config=$config}|ConvertTo-Json -Depth 6 -Compress
  $start=New-Object Diagnostics.ProcessStartInfo;$start.FileName=$node;$start.Arguments='"'+$runner+'" --private-delivery';$start.WorkingDirectory=$repo;$start.UseShellExecute=$false;$start.CreateNoWindow=$true;$start.RedirectStandardInput=$true;$start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true;$start.EnvironmentVariables.Clear()
  foreach($name in @('SystemRoot','WINDIR','PATH','TEMP','TMP','LOCALAPPDATA','APPDATA','USERPROFILE')){$v=[Environment]::GetEnvironmentVariable($name,'Process');if($null -ne $v){$start.EnvironmentVariables[$name]=$v}}
  $child=New-Object Diagnostics.Process;$child.StartInfo=$start;$started=$child.Start();if(-not $started){throw 'blocked'};$closed=$false;$start.EnvironmentVariables.Clear()
  $buffer=New-Object byte[] 8192;$memory=[IO.MemoryStream]::new([byte[]]$buffer,$true);$stdout=$child.StandardOutput.BaseStream.CopyToAsync($memory);$stderr=$child.StandardError.BaseStream.CopyToAsync([IO.Stream]::Null)
  $child.StandardInput.Write($privateInput);$child.StandardInput.Close();$privateInput=$null
  if(-not $child.WaitForExit(90000)){throw 'blocked'};$closed=$true;$receipt.nativeExit=$child.ExitCode
  if(-not [Threading.Tasks.Task]::WhenAll([Threading.Tasks.Task[]]@($stdout,$stderr)).Wait(5000)){throw 'blocked'}
  $text=[Text.Encoding]::UTF8.GetString($buffer,0,[int]$memory.Position)
  foreach($v in $values.Values){if(-not [string]::IsNullOrEmpty($v) -and $text.Contains($v)){throw 'blocked'}}
  $r=ConvertFrom-Json -InputObject $text
  if($r.status -ceq 'stopped_reconcile'){
    Keys $r @('version','status','privateDetailsWithheld','code')
    if($r.version -ne 1 -or $r.privateDetailsWithheld -isnot [bool] -or -not $r.privateDetailsWithheld -or $r.code -isnot [string] -or $r.code -cnotmatch '^(GW01_DELIVERY_(REJECTED|UNKNOWN|SCOPE_DENIED|RESPONSE_REJECTED|SCHEMA_REJECTED|RECONCILE|OWNERSHIP_UNVERIFIED|CLI_REJECTED)|GW01_CHILD_(START_FAILED|TIMEOUT|CLEANUP_UNVERIFIED|NATIVE_FAILURE)|GW01_TRANSPORT_(DNS|TLS|STATUS|BODY|PARSE|CLOSE))$'){throw 'blocked'}
    $receipt.code=$r.code;throw 'blocked'
  }
  if($Mode -ceq 'PrivacyRead'){
    Keys $r @('version','status','mode','managementRequests','privacy');Keys $r.privacy @('version','status','workflowId','executionId','exportCanaryVerified','executionCanaryVerified','privateDetailsWithheld')
    if($r.privacy.version -ne 1 -or $r.privacy.status -cnotin @('complete','execution_unavailable') -or $r.privacy.workflowId -cne $privacyTarget.workflowId -or $r.privacy.executionId -cne $privacyTarget.executionId){throw 'blocked'}
    foreach($flag in @('exportCanaryVerified','executionCanaryVerified','privateDetailsWithheld')){if($r.privacy.$flag -isnot [bool]){throw 'blocked'}}
    if(-not $r.privacy.exportCanaryVerified -or -not $r.privacy.privateDetailsWithheld -or ($r.privacy.status -ceq 'complete') -ne $r.privacy.executionCanaryVerified){throw 'blocked'}
  }elseif($Mode -ceq 'Cleanup'){
    Keys $r @('version','status','mode','managementRequests','deletedCredentialIds')
    if($r.deletedCredentialIds -isnot [Array] -or $r.deletedCredentialIds.Count -gt 2 -or @($r.deletedCredentialIds|Where-Object{$_ -cnotin @('EmrGw01Canary18','EmrGw01Machine18')}).Count -ne 0){throw 'blocked'}
  }else{
    if($Mode.StartsWith('Reconcile')){
      Keys $r @('version','status','mode','managementRequests','exists','ownershipVerified','credential','projectReadbackVerified','automaticPostRetry')
      foreach($flag in @('exists','ownershipVerified','projectReadbackVerified','automaticPostRetry')){if($r.$flag -isnot [bool]){throw 'blocked'}}
      if($r.projectReadbackVerified -or $r.automaticPostRetry -or (-not $r.exists -and $null -ne $r.credential) -or ($r.ownershipVerified -and -not $r.exists)){throw 'blocked'}
    }else{Keys $r @('version','status','mode','managementRequests','credential','branch','previewOnly');if($r.branch -cne 'm03-n8n-foundation' -or $r.previewOnly -isnot [bool] -or -not $r.previewOnly){throw 'blocked'}}
    $expectedId=if($Mode -cin @('Canary','ReconcileCanary')){'EmrGw01Canary18'}else{'EmrGw01Machine18'};$expectedName=if($Mode -cin @('Canary','ReconcileCanary')){'M03 GW-01 privacy canary [dev]'}else{'M03 GW-01 machine [dev]'}
    if($null -ne $r.credential){Keys $r.credential @('id','name','type','createdAt')
    if($r.credential.id -cne $expectedId -or $r.credential.name -cne $expectedName -or $r.credential.type -cne 'httpCustomAuth' -or $r.credential.createdAt -isnot [string] -or $r.credential.createdAt -cnotmatch '^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$'){throw 'blocked'}
    }
  }
  if($r.version -ne 1 -or $r.status -cne 'complete' -or $r.mode -cne $Mode -or $r.managementRequests -lt 0 -or $r.managementRequests -gt 5 -or $child.ExitCode -ne 0){throw 'blocked'}
  $receipt.delivery=$r;$receipt.status='complete';$success=$true
}catch{
  # Child output/headers/passwords/verifier/errors are never forwarded.
  $receipt.status='stopped_reconcile'
}finally{
  if($bstr -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)}
  if($null -ne $secure){$secure.Dispose()};$privateInput=$null;$values.Clear();$text=$null
  if($null -ne $start){$start.EnvironmentVariables.Clear()}
  if($null -ne $child){if($started -and -not $closed){try{if(-not $child.WaitForExit(0)){$child.Kill()};$closed=$child.WaitForExit(5000)}catch{$closed=$false}};try{$child.Dispose()}catch{$success=$false}}
  foreach($stream in $streams.Values){$stream.Dispose()};$streams.Clear()
  if($null -ne $memory){$memory.Dispose()};if($null -ne $buffer){[Array]::Clear($buffer,0,$buffer.Length)}
  if($privateRead -and ($Mode -ceq 'Cleanup' -or -not $success)){
    $allDeleted=$true
    $retainManagement=$Mode -cne 'Cleanup' -and $closed -and $receipt.code -cmatch '^(GW01_DELIVERY_(UNKNOWN|RECONCILE)|GW01_TRANSPORT_(DNS|TLS|STATUS|BODY|PARSE|CLOSE))$'
    foreach($fileName in @($secretFiles.Values)+@('emr-m03-gw01-dev-management.lease.json')){if($retainManagement -and $fileName -cin @('emr-m03-gw01-dev-management.dpapi','emr-m03-gw01-dev-management.lease.json')){continue};try{$path=Join-Path $privateDirectory $fileName;if(Test-Path -LiteralPath $path){$null=Safe-Path $path;Remove-Item -LiteralPath $path -ErrorAction Stop}}catch{$allDeleted=$false}}
    if(-not $allDeleted){$success=$false}
    $receipt.handoffsRetained=$retainManagement -or -not $allDeleted
  }
  $receipt.privateRead=$privateRead;$receipt.rootChildClosed=$closed
}
Write-Output ($receipt|ConvertTo-Json -Depth 7 -Compress)
if(-not $success -or -not $closed){exit 1};exit 0
