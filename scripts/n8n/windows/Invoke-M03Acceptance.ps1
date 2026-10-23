[CmdletBinding()]
param([switch]$CheckOnly,[switch]$ResumeZeroSetup,[switch]$ClockAmendment,[switch]$PostcheckContinuation,[switch]$RemainingContinuation,[switch]$StartupReplacement,[switch]$ProjectVerifiedContinuation)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
$opened=[Collections.Generic.List[IO.FileStream]]::new()
$consumed=[Collections.Generic.List[string]]::new()
$child=$null;$start=$null;$lock=$null;$started=$false;$closed=$true;$exitCode=1
$childDeadline=$null;$closeRequested=$false;$emergency=$false;$treeClosed=$false
$errorDraining=$false;$outputDiscarding=$false;$lineTask=$null;$errorTask=$null;$inputTask=$null
$bypassCreated=$false;$script:closureVerified=$false;$script:credentialClosureVerified=$false
$resumeDeadlineAt=$null
$amendmentClock=$null
$runtimeProcessId=$null
$script:projectVerifiedMetadataClosed=$true
$secret=$null;$bstr=[IntPtr]::Zero;$packet=$null;$private=$null;$machine=$null;$bypass=$null
$needles=[Collections.Generic.List[string]]::new();$knownWorkflowIds=[Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
$receipt=[ordered]@{kind='m03_acceptance_wrapper_closed';childClosed=$true;credentialChildrenClosed=$false;emergencyShutdown=$false;nativeExit=$null;handoffsDeleted=$false;bypassHandoffDeleted=$false;pendingMachinePreserved=$true;privateRead=$false;code='M03_ACCEPTANCE_BLOCKED'}
function Public-File([string]$Path,[int]$Maximum=524288){
 $absolute=[IO.Path]::GetFullPath($Path);$cursor=$absolute
 while($null -ne $cursor){
  $entry=Get-Item -LiteralPath $cursor -Force -ErrorAction Stop
  if(($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'blocked'}
  $parent=[IO.Directory]::GetParent($cursor);$cursor=if($null -eq $parent){$null}else{$parent.FullName}
 }
 $entry=Get-Item -LiteralPath $absolute -Force
 if($entry.PSIsContainer -or $entry.Length -gt $Maximum){throw 'blocked'}
 return $absolute
}
function Read-LockedText([string]$Path,[int]$Maximum=16384){
 $file=Public-File $Path $Maximum
 $stream=[IO.File]::Open($file,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
 $opened.Add($stream)
 $reader=[IO.StreamReader]::new($stream,[Text.Encoding]::UTF8,$true,1024,$true)
 try{return $reader.ReadToEnd()}finally{$reader.Dispose()}
}
function Plain-Dpapi([string]$Cipher){
 $value=$null;$address=[IntPtr]::Zero
 try{
  $value=ConvertTo-SecureString -String $Cipher -ErrorAction Stop
  $address=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($value)
  return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($address)
 }finally{
  if($address -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($address)}
  if($null -ne $value){$value.Dispose()}
 }
}
function Initialize-M03AcceptanceDevCredentials([string]$Repository,[IO.FileStream]$CoordinatorLock){
 # The persistent current-user originals are never handed to this runtime.
 # This small adapter copies only the four purpose-bound encrypted inputs;
 # the administrator copy is decrypted solely by its existing DB child.
 . (Public-File (Join-Path $Repository 'scripts/n8n/windows/Dev-CredentialStore.ps1') 524288)
 foreach($kind in @('Admin','Management','Writer','ApifyRead')){
  Ensure-M03DevRuntimeHandoff -Kind $kind -AdminMode ProjectVerifiedContinuation -CoordinatorLock $CoordinatorLock
 }
}
function Write-M03ProjectVerifiedTechnicalClosure([string]$Repository,$Clock,$Receipt,$RuntimeId,[bool]$Verified){
 if($null -eq $Clock){return}
 $base='scripts/n8n/out/foundation/live/project-verified-continuation-20275b22-b7fe-4737-a9a4-c50c2feadb74'
 $found=$null
 for($ordinal=1;$ordinal -le 1024;$ordinal++){
  $stem=$base+$(if($ordinal -eq 1){''}else{'.technical-'+$ordinal})
  $candidate=Join-Path $Repository ($stem+'.json')
  if(-not (Test-Path -LiteralPath $candidate)){break}
  $candidate=Public-File $candidate 16384
  $admission=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($candidate))
  if($admission.startsAt -eq $Clock.startsAt){$found=[pscustomobject]@{path=$candidate;stem=$stem;parent=$admission.parentProcessId};break}
 }
 if($null -eq $found -or $found.parent -ne $PID){throw 'blocked'}
 $close=[ordered]@{kind='m03_project_verified_technical_closed';version=1;admissionSha256=(Get-FileHash -LiteralPath $found.path -Algorithm SHA256).Hash.ToLowerInvariant();parentProcessId=$PID;runtimeProcessId=$RuntimeId;closedAt=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds();childClosed=$Receipt.childClosed;credentialChildrenClosed=$Receipt.credentialChildrenClosed;emergencyShutdown=$Receipt.emergencyShutdown;pendingMachinePreserved=$Receipt.pendingMachinePreserved;nativeExit=$Receipt.nativeExit;bypassHandoffDeleted=$Receipt.bypassHandoffDeleted;closureVerified=$Verified}
 $path=Join-Path $Repository ($found.stem+'.closed.json')
 $stream=$null;$bytes=$null
 try{
  $stream=[IO.File]::Open($path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
  $bytes=[Text.UTF8Encoding]::new($false).GetBytes(($close|ConvertTo-Json -Compress)+"`n")
  $stream.Write($bytes,0,$bytes.Length);$stream.Flush($true)
 }finally{if($null -ne $stream){$stream.Dispose()};if($null -ne $bytes){[Array]::Clear($bytes,0,$bytes.Length)}}
}
function Initialize-BoundedIo {
 if('EmrM03AcceptanceBoundedIo' -as [type]){throw 'blocked'}
 Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Text;
using System.Threading.Tasks;
public static class EmrM03AcceptanceBoundedIo {
 public static Task<string> Line(TextReader reader, int maximum) {
  // Console.In uses a synchronized reader whose ReadAsync can block before
  // returning its Task. Offload that read so child output and deadlines run.
  return Task.Run(async () => {
  var buffer = new char[1]; var text = new StringBuilder(Math.Min(maximum, 1024));
  while (true) {
   int count = await reader.ReadAsync(buffer, 0, 1).ConfigureAwait(false);
   if (count == 0) return text.Length == 0 ? null : text.ToString();
   if (buffer[0] == '\n') return text.ToString().TrimEnd('\r');
   if (text.Length >= maximum) throw new InvalidDataException("M03_ACCEPTANCE_IO_LIMIT");
   text.Append(buffer[0]);
  }
  });
 }
 public static async Task<string> Text(TextReader reader, int maximum) {
  var buffer = new char[1024]; var text = new StringBuilder(Math.Min(maximum, 1024));
  while (true) {
   int count = await reader.ReadAsync(buffer, 0, buffer.Length).ConfigureAwait(false);
   if (count == 0) return text.ToString();
   if (text.Length > maximum - count) throw new InvalidDataException("M03_ACCEPTANCE_IO_LIMIT");
   text.Append(buffer, 0, count);
  }
 }
}
'@ -ErrorAction Stop | Out-Null
 # Windows Console.In otherwise uses a 256-character console buffer (254
 # payload characters plus CRLF). Keep the existing bounded JSON lines intact
 # in ConPTY without changing console modes or weakening either schema/cap.
 [Console]::SetIn([IO.StreamReader]::new([Console]::OpenStandardInput(262144),[Console]::InputEncoding,$false,262144,$true))
}
function Invoke-PublicCompositionCheck([string]$Node,[string]$Entry,[string]$Repository){
 $process=$null;$info=$null;$running=$false;$done=$true
 try{
  $info=[Diagnostics.ProcessStartInfo]::new();$info.FileName=$Node;$info.Arguments='"'+$Entry+'" CheckOnly';$info.WorkingDirectory=$Repository
  $info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true;$info.EnvironmentVariables.Clear()
  foreach($name in @('SystemRoot','WINDIR','PATH','USERPROFILE','LOCALAPPDATA','APPDATA','TEMP','TMP')){if(Test-Path ('Env:'+ $name)){$info.EnvironmentVariables[$name]=[Environment]::GetEnvironmentVariable($name)}}
  $process=[Diagnostics.Process]::new();$process.StartInfo=$info;$running=$process.Start();$done=$false
  if(-not $running){throw 'blocked'}
  $out=[EmrM03AcceptanceBoundedIo]::Text($process.StandardOutput,16384);$err=[EmrM03AcceptanceBoundedIo]::Text($process.StandardError,1024)
  $done=$process.WaitForExit(10000)
  if(-not $done -or $process.ExitCode -ne 0 -or $out.Result.Length -gt 16384 -or $err.Result.Length -ne 0){throw 'blocked'}
  $result=ConvertFrom-Json -InputObject $out.Result
  if($result.kind -cne 'm03_acceptance_ready' -or $result.status -cne 'check_only_execution_port_required' -or $result.privateRead -isnot [bool] -or $result.privateRead -ne $false -or $result.networkCalls -ne 0 -or $result.knownWorkflows -ne 25 -or $result.managementMaximum -ne 512 -or $result.controlMaximum -ne 2048 -or $result.actualMcpPortVerified -isnot [bool] -or $result.actualMcpPortVerified -ne $false -or $result.concreteVercelCliPresent -ne $true -or $result.concreteAdminHelperPresent -ne $true){throw 'blocked'}
 }finally{
  if($null -ne $process){if($running -and -not $done){try{$process.Kill();$done=$process.WaitForExit(5000)}catch{}};$process.Dispose()}
  if($null -ne $info){$info.EnvironmentVariables.Clear()}
 }
 if(-not $done){throw 'blocked'}
}
function Invoke-PublicDatabaseCheck([string]$Repository,[bool]$AllowMissing,$OriginalDeadline=$null,[bool]$AmendedClock=$false,[bool]$PostcheckClock=$false,[bool]$RemainingClock=$false,[bool]$StartupClock=$false,[bool]$ProjectClock=$false,[bool]$ForwardWindow=$false){
 $process=$null;$info=$null;$running=$false;$done=$true
 try{
  if($ForwardWindow -and (-not $ProjectClock -or $null -ne $OriginalDeadline -or $AmendedClock -or $PostcheckClock -or $RemainingClock -or $StartupClock)){throw 'blocked'}
  $db=Public-File (Join-Path $Repository 'scripts/db/windows/Invoke-M03FoundationMigrations.ps1')
  $info=[Diagnostics.ProcessStartInfo]::new();$info.FileName=(Join-Path $PSHOME 'powershell.exe')
  $info.Arguments='-NoProfile -NonInteractive -File "'+$db+'" -CheckOnly -PhaseAControl';$info.WorkingDirectory=$Repository
  if($null -ne $OriginalDeadline){if($OriginalDeadline -ne 1792584023481){throw 'blocked'};$info.Arguments+=' -OriginalDeadlineAtMs '+[string]$OriginalDeadline}
  if($AmendedClock){if($null -ne $OriginalDeadline){throw 'blocked'};$info.Arguments+=' -ClockAmendment'}
  if($PostcheckClock){if($null -ne $OriginalDeadline -or $AmendedClock){throw 'blocked'};$info.Arguments+=' -PostcheckContinuation'}
  if(@($AmendedClock,$PostcheckClock,$RemainingClock,$StartupClock,$ProjectClock|Where-Object{$_}).Count -gt 1){throw 'blocked'}
  if($RemainingClock){if($null -ne $OriginalDeadline -or $AmendedClock -or $PostcheckClock){throw 'blocked'};$info.Arguments+=' -RemainingContinuation'}
  if($StartupClock){if($null -ne $OriginalDeadline){throw 'blocked'};$info.Arguments+=' -StartupReplacement'}
  if($ProjectClock){if($null -ne $OriginalDeadline){throw 'blocked'};$info.Arguments+=' -ProjectVerifiedContinuation'}
  if($ForwardWindow){$info.Arguments+=' -ForwardWindow'}
  $info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true;$info.EnvironmentVariables.Clear()
  foreach($name in @('SystemRoot','WINDIR','PATH','USERPROFILE','LOCALAPPDATA','APPDATA','TEMP','TMP')){if(Test-Path ('Env:'+ $name)){$info.EnvironmentVariables[$name]=[Environment]::GetEnvironmentVariable($name)}}
  $process=[Diagnostics.Process]::new();$process.StartInfo=$info;$running=$process.Start();$done=$false
  if(-not $running){throw 'blocked'}
  $out=[EmrM03AcceptanceBoundedIo]::Text($process.StandardOutput,16384);$err=[EmrM03AcceptanceBoundedIo]::Text($process.StandardError,1024)
  $done=$process.WaitForExit(30000)
  if(-not $done -or -not [Threading.Tasks.Task]::WhenAll([Threading.Tasks.Task[]]@($out,$err)).Wait(5000) -or $err.Result.Length -ne 0){throw 'blocked'}
  $line=$out.Result.Trim()
  if($ProjectClock -and $process.ExitCode -eq 4 -and $line.StartsWith('M03_FOUNDATION PUBLIC_INPUTS_READY.',[StringComparison]::Ordinal)){return $false}
  if($process.ExitCode -eq 0 -and $line.StartsWith('M03_FOUNDATION CHECK_ONLY_READY.',[StringComparison]::Ordinal)){return $true}
  if($AllowMissing -and $process.ExitCode -eq 2 -and $line.StartsWith('M03_FOUNDATION HANDOFF_MISSING.',[StringComparison]::Ordinal)){return $false}
  if($AllowMissing -and ($AmendedClock -or $PostcheckClock -or $RemainingClock -or $StartupClock) -and $process.ExitCode -eq 2 -and $line.StartsWith('M03_FOUNDATION HANDOFF_LEASE_NOT_READY.',[StringComparison]::Ordinal)){return $false}
  if($AllowMissing -and ($RemainingClock -or $StartupClock -or $ProjectClock) -and $process.ExitCode -eq 3 -and $line.StartsWith('M03_FOUNDATION APPROVAL_REQUIRED.',[StringComparison]::Ordinal)){return $false}
  throw 'blocked'
 }finally{
  if($null -ne $process){if($running -and -not $done){try{$process.Kill();$done=$process.WaitForExit(5000)}catch{}};$process.Dispose()}
  if($null -ne $info){$info.EnvironmentVariables.Clear()}
 }
}
function Invoke-ZeroSetupPublicCheck([string]$Node,[string]$Repository){
 $process=$null;$info=$null;$running=$false;$done=$true
 try{
  $entry=Public-File (Join-Path $Repository 'scripts/n8n/foundation-live-zero-setup.mjs')
  $info=[Diagnostics.ProcessStartInfo]::new();$info.FileName=$Node;$info.Arguments='"'+$entry+'" CheckOnly';$info.WorkingDirectory=$Repository
  $info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true;$info.EnvironmentVariables.Clear()
  foreach($name in @('SystemRoot','WINDIR','PATH','USERPROFILE','LOCALAPPDATA','APPDATA','TEMP','TMP')){if(Test-Path ('Env:'+ $name)){$info.EnvironmentVariables[$name]=[Environment]::GetEnvironmentVariable($name)}}
  $process=[Diagnostics.Process]::new();$process.StartInfo=$info;$running=$process.Start();$done=$false
  if(-not $running){throw 'blocked'}
  $out=[EmrM03AcceptanceBoundedIo]::Text($process.StandardOutput,16384);$err=[EmrM03AcceptanceBoundedIo]::Text($process.StandardError,1024)
  $done=$process.WaitForExit(10000)
  if(-not $done -or $process.ExitCode -ne 0 -or -not [Threading.Tasks.Task]::WhenAll([Threading.Tasks.Task[]]@($out,$err)).Wait(5000) -or $err.Result.Length -ne 0){throw 'blocked'}
  $result=ConvertFrom-Json -InputObject $out.Result
  if($result -isnot [PSCustomObject] -or @(Compare-Object -CaseSensitive @('kind','deadlineAt','sourceCommitSha','windowId','privateRead','networkRequests'|Sort-Object) @($result.PSObject.Properties.Name|Sort-Object)).Count -ne 0 -or $result.kind -cne 'zero_setup_ready' -or $result.deadlineAt -ne 1792584023481 -or $result.sourceCommitSha -cne 'f42930f90c2de43c84f61ad6d966d0ee6074d70e' -or $result.windowId -cne 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9' -or $result.privateRead -isnot [bool] -or $result.privateRead -ne $false -or $result.networkRequests -ne 0){throw 'blocked'}
  return [long]$result.deadlineAt
 }finally{
  if($null -ne $process){if($running -and -not $done){try{$process.Kill();$done=$process.WaitForExit(5000)}catch{}};$process.Dispose()}
  if($null -ne $info){$info.EnvironmentVariables.Clear()}
 }
}
function Get-ProjectVerifiedPublicManagementMaximum($Value,[bool]$ProjectClock,[string]$Mode){
 if($Value -isnot [PSCustomObject]){throw 'blocked'}
 $fields=@('managementMaximum','managementAttempts','controlAttempts','combinedAttempts')
 $present=@($fields|Where-Object{$_ -cin $Value.PSObject.Properties.Name})
 if($present.Count -eq 0){return 512}
 if(-not $ProjectClock -or $Mode -cne 'CheckOnly' -or $present.Count -ne 4 -or
  $Value.kind -cne 'project_verified_continuation_ready' -or $Value.segmentId -cne '20275b22-b7fe-4737-a9a4-c50c2feadb74' -or
  $Value.sourceCommitSha -cne 'a5e746736893d5040e93032ae740a0878f748837' -or $Value.windowId -cne '38b3708d-61b0-41d2-8170-5ed91c66b4dc' -or
  $Value.privateRead -isnot [bool] -or $Value.privateRead -ne $false){throw 'blocked'}
 $expected=@{managementMaximum=576;managementAttempts=152;controlAttempts=384;combinedAttempts=536;networkRequests=0}
 foreach($name in $expected.Keys){if(($Value.$name -isnot [int] -and $Value.$name -isnot [long]) -or $Value.$name -ne $expected[$name]){throw 'blocked'}}
 return 576
}
function ConvertTo-ProjectVerifiedReadinessBlock($Value){
 $keys=@('kind','status','segmentId','sourceCommitSha','windowId','managementAttempts','controlAttempts','combinedAttempts','gatewayPreflightAttempts','setupAttempts','setupMaximum','minimumNewSetupRequests','proposedSetupMaximum','privateRead','networkRequests')
 foreach($name in @('kind','status','segmentId','sourceCommitSha','windowId')){if($Value.$name -isnot [string]){throw 'blocked'}}
 if($Value -isnot [PSCustomObject] -or @(Compare-Object -CaseSensitive @($keys|Sort-Object) @($Value.PSObject.Properties.Name|Sort-Object)).Count -ne 0 -or
   $Value.kind -cne 'project_verified_continuation_blocked' -or $Value.status -cnotin @('setup_cap_insufficient','management_cap_insufficient') -or
   $Value.segmentId -cne '20275b22-b7fe-4737-a9a4-c50c2feadb74' -or $Value.sourceCommitSha -cne 'a5e746736893d5040e93032ae740a0878f748837' -or $Value.windowId -cne '38b3708d-61b0-41d2-8170-5ed91c66b4dc' -or
   $Value.privateRead -isnot [bool] -or $Value.privateRead -ne $false){throw 'blocked'}
 if($Value.status -ceq 'management_cap_insufficient' -and (($Value.controlAttempts -isnot [int] -and $Value.controlAttempts -isnot [long]) -or $Value.controlAttempts -lt 382 -or $Value.controlAttempts -gt 386)){throw 'blocked'}
 $expected=if($Value.status -ceq 'management_cap_insufficient'){@{managementAttempts=152;controlAttempts=$Value.controlAttempts;combinedAttempts=(152+$Value.controlAttempts);gatewayPreflightAttempts=2;setupAttempts=44;setupMaximum=88;minimumNewSetupRequests=32;proposedSetupMaximum=88;networkRequests=0}}else{@{managementAttempts=102;controlAttempts=301;combinedAttempts=403;gatewayPreflightAttempts=2;setupAttempts=44;setupMaximum=50;minimumNewSetupRequests=32;proposedSetupMaximum=88;networkRequests=0}}
 foreach($name in $expected.Keys){if(($Value.$name -isnot [int] -and $Value.$name -isnot [long]) -or $Value.$name -ne $expected[$name]){throw 'blocked'}}
 return $Value
}
function Invoke-ClockAmendmentPublic([string]$Node,[string]$Repository,[string]$Mode,[bool]$PostcheckClock=$false,[bool]$RemainingClock=$false,[bool]$StartupClock=$false,[bool]$ProjectClock=$false){
 $process=$null;$info=$null;$running=$false;$done=$true
 try{
  if($Mode -cnotin @('CheckOnly','Admit','Read')){throw 'blocked'}
  if(@($RemainingClock,$PostcheckClock,$StartupClock|Where-Object{$_}).Count -gt 1){throw 'blocked'}
  $clockRelative=if($ProjectClock){'scripts/n8n/foundation-live-project-verified-continuation.mjs'}elseif($StartupClock){'scripts/n8n/foundation-live-startup-replacement.mjs'}elseif($RemainingClock){'scripts/n8n/foundation-live-remaining-continuation.mjs'}elseif($PostcheckClock){'scripts/n8n/foundation-live-postcheck-continuation.mjs'}else{'scripts/n8n/foundation-live-clock-amendment.mjs'}
  $segmentId=if($ProjectClock){'20275b22-b7fe-4737-a9a4-c50c2feadb74'}elseif($StartupClock){'1c69c89e-7807-46d5-b7b8-ca28285ff2b4'}elseif($RemainingClock){'e8035391-dba8-48c9-97e0-139ba980d86e'}elseif($PostcheckClock){'a570212a-634c-444f-90a2-578ae47e8d27'}else{'30e75d0d-7e4c-46c6-9a07-556f90b63859'}
  $readyKind=if($ProjectClock){'project_verified_continuation_ready'}elseif($StartupClock){'startup_replacement_ready'}elseif($RemainingClock){'remaining_continuation_ready'}elseif($PostcheckClock){'postcheck_continuation_ready'}else{'clock_amendment_ready'}
  $admittedKind=if($ProjectClock){'clock_project_verified_continuation_admitted'}elseif($StartupClock){'clock_startup_replacement_admitted'}elseif($RemainingClock){'clock_remaining_continuation_admitted'}elseif($PostcheckClock){'clock_postcheck_continuation_admitted'}else{'clock_amendment_admitted'}
  $entry=Public-File (Join-Path $Repository $clockRelative)
  $info=[Diagnostics.ProcessStartInfo]::new();$info.FileName=$Node;$info.Arguments='"'+$entry+'" '+$Mode;$info.WorkingDirectory=$Repository
  $info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true;$info.EnvironmentVariables.Clear()
  foreach($name in @('SystemRoot','WINDIR','PATH','USERPROFILE','LOCALAPPDATA','APPDATA','TEMP','TMP')){if(Test-Path ('Env:'+ $name)){$info.EnvironmentVariables[$name]=[Environment]::GetEnvironmentVariable($name)}}
  $process=[Diagnostics.Process]::new();$process.StartInfo=$info;$running=$process.Start();$done=$false
  if(-not $running){throw 'blocked'}
  $out=[EmrM03AcceptanceBoundedIo]::Text($process.StandardOutput,16384);$err=[EmrM03AcceptanceBoundedIo]::Text($process.StandardError,1024)
  $done=$process.WaitForExit(10000)
  if(-not $done -or $process.ExitCode -ne 0 -or -not [Threading.Tasks.Task]::WhenAll([Threading.Tasks.Task[]]@($out,$err)).Wait(5000) -or $err.Result.Length -ne 0){throw 'blocked'}
  $result=ConvertFrom-Json -InputObject $out.Result
  if($ProjectClock -and $Mode -ceq 'CheckOnly' -and $result.kind -ceq 'project_verified_continuation_blocked'){return ConvertTo-ProjectVerifiedReadinessBlock $result}
  $approvalKind=if($ProjectClock){'project_verified_continuation_approval_required'}elseif($StartupClock){'startup_replacement_approval_required'}else{'remaining_continuation_approval_required'}
  if(($RemainingClock -or $StartupClock -or $ProjectClock) -and $Mode -ceq 'CheckOnly' -and $result.kind -ceq $approvalKind){
   $expectedKeys=@('kind','status','approvalRequired','segmentId','sourceCommitSha','windowId','privateRead','networkRequests')
   if($result -isnot [PSCustomObject] -or @(Compare-Object -CaseSensitive @($expectedKeys|Sort-Object) @($result.PSObject.Properties.Name|Sort-Object)).Count -ne 0 -or
      $result.status -cne 'approval_required' -or $result.approvalRequired -isnot [bool] -or $result.approvalRequired -ne $true -or $result.segmentId -cne $segmentId -or
      $result.sourceCommitSha -cne 'f42930f90c2de43c84f61ad6d966d0ee6074d70e' -or $result.windowId -cne 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9' -or $result.privateRead -isnot [bool] -or $result.privateRead -ne $false -or $result.networkRequests -isnot [int] -or $result.networkRequests -ne 0){throw 'blocked'}
   return $result
  }
  $keys=@('kind','segmentId','sourceCommitSha','windowId','privateRead','networkRequests')
  $effectiveManagementMaximum=Get-ProjectVerifiedPublicManagementMaximum $result $ProjectClock $Mode
  if($effectiveManagementMaximum -eq 576){$keys+=@('managementMaximum','managementAttempts','controlAttempts','combinedAttempts')}
  if($Mode -cne 'CheckOnly'){$keys+=@('startsAt','deadlineAt','stopNewAt','hardDeadlineAt')}
  $legacyBinding=$result.sourceCommitSha -ceq 'f42930f90c2de43c84f61ad6d966d0ee6074d70e' -and $result.windowId -ceq 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9'
  $activeBinding=$ProjectClock -and $result.sourceCommitSha -ceq 'a5e746736893d5040e93032ae740a0878f748837' -and $result.windowId -ceq '38b3708d-61b0-41d2-8170-5ed91c66b4dc'
  if($result -isnot [PSCustomObject] -or @(Compare-Object -CaseSensitive @($keys|Sort-Object) @($result.PSObject.Properties.Name|Sort-Object)).Count -ne 0 -or $result.segmentId -cne $segmentId -or -not ($legacyBinding -or $activeBinding) -or $result.privateRead -isnot [bool] -or $result.privateRead -ne $false -or $result.networkRequests -ne 0){throw 'blocked'}
  if($Mode -ceq 'CheckOnly'){
   if($result.kind -cne $readyKind){throw 'blocked'}
  }else{
   foreach($name in @('startsAt','deadlineAt','stopNewAt','hardDeadlineAt')){if(($result.$name -isnot [long] -and $result.$name -isnot [int]) -or $result.$name -lt 0){throw 'blocked'}}
   if($result.kind -cne $admittedKind -or $result.startsAt -gt [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() -or $result.deadlineAt -ne $result.startsAt+3600000 -or $result.stopNewAt -ne $result.startsAt+3000000 -or $result.hardDeadlineAt -ne $result.startsAt+4200000 -or [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() -ge $result.stopNewAt){throw 'blocked'}
  }
  return $result
 }finally{
  if($null -ne $process){if($running -and -not $done){try{$process.Kill();$done=$process.WaitForExit(5000)}catch{}};$process.Dispose()}
  if($null -ne $info){$info.EnvironmentVariables.Clear()}
 }
}
function ConvertTo-ProjectVerifiedVercelMetadata($Value){
 $keys=@('kind','status','metadataValid','unexpired','covers75Minutes','effectiveBackendEstablished','networkRequests','authenticationAttempted','refreshAttempted','configWritten','childClosed')
 if($Value -isnot [PSCustomObject] -or @(Compare-Object -CaseSensitive @($keys|Sort-Object) @($Value.PSObject.Properties.Name|Sort-Object)).Count -ne 0 -or $Value.kind -cne 'm03_vercel_saved_auth_metadata' -or $Value.status -isnot [string] -or $Value.status -cnotin @('metadata_covers_75_minutes','saved_auth_expired','saved_auth_insufficient_coverage','saved_auth_expiry_unavailable','saved_auth_missing','saved_auth_invalid','path_blocked','public_inputs_blocked','child_failed')){throw 'blocked'}
 foreach($key in @('metadataValid','unexpired','covers75Minutes','effectiveBackendEstablished','authenticationAttempted','refreshAttempted','configWritten','childClosed')){if($Value.$key -isnot [bool]){throw 'blocked'}}
 if($Value.effectiveBackendEstablished -ne $false -or $Value.networkRequests -isnot [int] -or $Value.networkRequests -ne 0 -or $Value.authenticationAttempted -ne $false -or $Value.refreshAttempted -ne $false -or $Value.configWritten -ne $false){throw 'blocked'}
 $expected=switch($Value.status){'metadata_covers_75_minutes'{@($true,$true,$true)};'saved_auth_expired'{@($true,$false,$false)};'saved_auth_insufficient_coverage'{@($true,$true,$false)};'saved_auth_expiry_unavailable'{@($true,$false,$false)};default{@($false,$false,$false)}}
 if($Value.metadataValid -ne $expected[0] -or $Value.unexpired -ne $expected[1] -or $Value.covers75Minutes -ne $expected[2]){throw 'blocked'}
 # Construct every public field; never spread untrusted child properties.
 return [ordered]@{kind='m03_acceptance_vercel_metadata';status=$Value.status;metadataValid=$Value.metadataValid;unexpired=$Value.unexpired;covers75Minutes=$Value.covers75Minutes;effectiveBackendEstablished=$false;networkRequests=0;authenticationAttempted=$false;refreshAttempted=$false;configWritten=$false;childClosed=$Value.childClosed}
}
function Read-ProjectVerifiedVercelMetadata([string]$Node,[string]$Repository){
 $process=$null;$info=$null;$running=$false;$done=$true;$valid=$false;$result=$null;$out=$null;$err=$null
 try{
  $entry=Public-File (Join-Path $Repository 'scripts/n8n/foundation-vercel-auth-preflight.mjs')
  $info=[Diagnostics.ProcessStartInfo]::new();$info.FileName=$Node;$info.Arguments='"'+$entry+'" InspectSavedMetadata';$info.WorkingDirectory=$Repository
  $info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true;$info.EnvironmentVariables.Clear()
  foreach($name in @('SystemRoot','WINDIR','PATH','USERPROFILE','LOCALAPPDATA','APPDATA','TEMP','TMP')){if(Test-Path ('Env:'+ $name)){$info.EnvironmentVariables[$name]=[Environment]::GetEnvironmentVariable($name)}}
  $process=[Diagnostics.Process]::new();$process.StartInfo=$info;$running=$process.Start();$done=-not $running
  if(-not $running){throw 'blocked'}
  $out=[EmrM03AcceptanceBoundedIo]::Text($process.StandardOutput,4096);$err=[EmrM03AcceptanceBoundedIo]::Text($process.StandardError,1024)
  $done=$process.WaitForExit(8000)
  if(-not $done -or -not $out.Wait(500) -or -not $err.Wait(500) -or $err.Result.Length -ne 0 -or $process.ExitCode -notin @(0,2)){throw 'blocked'}
  $result=ConvertFrom-Json -InputObject $out.Result -ErrorAction Stop
  $safe=ConvertTo-ProjectVerifiedVercelMetadata $result
  if(($process.ExitCode -eq 0) -ne ($safe.childClosed -and $safe.covers75Minutes)){throw 'blocked'}
  $valid=$true
 }catch{
  # No child exception, stdout/stderr, path or saved value reaches the caller.
 }finally{
  if($null -ne $process){if($running -and -not $done){try{$process.Kill();$done=$process.WaitForExit(1000)}catch{}};try{$process.Dispose()}catch{}}
  if($null -ne $info){$info.EnvironmentVariables.Clear()}
 }
 if($valid -and $done){return $result}
 # Closing the outer process without its validated inner-child receipt does
 # not prove dependent closure. Preserve the parent mutex in that case.
 return [pscustomobject][ordered]@{kind='m03_vercel_saved_auth_metadata';status='child_failed';metadataValid=$false;unexpired=$false;covers75Minutes=$false;effectiveBackendEstablished=$false;networkRequests=0;authenticationAttempted=$false;refreshAttempted=$false;configWritten=$false;childClosed=(-not $running)}
}
function Confirm-ProjectVerifiedVercelMetadata([string]$Node,[string]$Repository){
 $script:projectVerifiedMetadataClosed=$false
 try{
  $value=Read-ProjectVerifiedVercelMetadata $Node $Repository
  $safe=ConvertTo-ProjectVerifiedVercelMetadata $value
 }catch{
  $safe=[ordered]@{kind='m03_acceptance_vercel_metadata';status='child_failed';metadataValid=$false;unexpired=$false;covers75Minutes=$false;effectiveBackendEstablished=$false;networkRequests=0;authenticationAttempted=$false;refreshAttempted=$false;configWritten=$false;childClosed=$false}
 }
 $script:projectVerifiedMetadataClosed=$safe.childClosed
 $safe|ConvertTo-Json -Compress|Write-Output
 if(-not $safe.childClosed -or -not $safe.covers75Minutes){throw 'blocked'}
}
function Confirm-PublicTransport {
 # A live public acknowledgement must arrive before any DPAPI read. In
 # particular a non-interactive tool with already-closed stdin consumes nothing.
 $bytes=New-Object byte[] 16;$rng=[Security.Cryptography.RandomNumberGenerator]::Create()
 try{$rng.GetBytes($bytes);$nonce=([BitConverter]::ToString($bytes)).Replace('-','').ToLowerInvariant()}finally{$rng.Dispose();[Array]::Clear($bytes,0,$bytes.Length)}
 [ordered]@{kind='m03_acceptance_transport_ready';nonce=$nonce;privateRead=$false;networkRequests=0}|ConvertTo-Json -Compress|Write-Output
 $read=[EmrM03AcceptanceBoundedIo]::Line([Console]::In,4096)
 if(-not $read.Wait(30000)){throw 'blocked'}
 $text=$read.GetAwaiter().GetResult()
 if($null -eq $text){throw 'blocked'}
 $ack=ConvertFrom-Json -InputObject $text
 if($ack -isnot [PSCustomObject] -or @(Compare-Object -CaseSensitive @('kind','nonce'|Sort-Object) @($ack.PSObject.Properties.Name|Sort-Object)).Count -ne 0 -or $ack.kind -cne 'm03_acceptance_transport_ack' -or $ack.nonce -isnot [string] -or $ack.nonce -cne $nonce){throw 'blocked'}
}
function Get-OwnedProcessTree($RootProcess){
 if($RootProcess.HasExited){return @()}
 $rootId=[int]$RootProcess.Id;$rootTime=$RootProcess.StartTime.ToUniversalTime()
 $rows=[Collections.Generic.List[object]]::new();$queue=[Collections.Generic.Queue[object]]::new()
 $root=CimCmdlets\Get-CimInstance -ClassName Win32_Process -Filter ('ProcessId='+$rootId) -Property ProcessId,ParentProcessId,CreationDate -ErrorAction Stop
 if($null -eq $root -or [Math]::Abs(($root.CreationDate.ToUniversalTime()-$rootTime).TotalSeconds) -gt 2){throw 'blocked'}
 $queue.Enqueue($root)
 while($queue.Count -gt 0){
  $parent=$queue.Dequeue();$rows.Add($parent);if($rows.Count -gt 64){throw 'blocked'}
  foreach($descendant in @(CimCmdlets\Get-CimInstance -ClassName Win32_Process -Filter ('ParentProcessId='+[int]$parent.ProcessId) -Property ProcessId,ParentProcessId,CreationDate -ErrorAction Stop)){
   if($descendant.CreationDate.ToUniversalTime() -lt $parent.CreationDate.ToUniversalTime() -or @($rows|Where-Object{$_.ProcessId -eq $descendant.ProcessId}).Count -gt 0){throw 'blocked'}
   $queue.Enqueue($descendant)
  }
 }
 return @($rows.ToArray())
}
function Stop-OwnedProcessTree($RootProcess){
 $killer=$null;$info=$null;$done=$true
 try{
  $tree=@(Get-OwnedProcessTree $RootProcess)
  if($tree.Count -eq 0){return $false} # No live root means no verified tree to target.
  foreach($known in $tree){
   $current=CimCmdlets\Get-CimInstance -ClassName Win32_Process -Filter ('ProcessId='+[int]$known.ProcessId) -Property ProcessId,ParentProcessId,CreationDate -ErrorAction Stop
   if($null -eq $current -or $current.CreationDate -ne $known.CreationDate -or $current.ParentProcessId -ne $known.ParentProcessId){throw 'blocked'}
  }
  if($RootProcess.HasExited){return $false}
  $info=[Diagnostics.ProcessStartInfo]::new();$info.FileName=Public-File (Join-Path $env:SystemRoot 'System32/taskkill.exe')
  $info.Arguments='/PID '+[int]$RootProcess.Id+' /T /F';$info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true;$info.EnvironmentVariables.Clear()
  foreach($name in @('SystemRoot','WINDIR','PATH','TEMP','TMP')){if(Test-Path ('Env:'+ $name)){$info.EnvironmentVariables[$name]=[Environment]::GetEnvironmentVariable($name)}}
  $killer=[Diagnostics.Process]::new();$killer.StartInfo=$info;if(-not $killer.Start()){throw 'blocked'};$done=$false
  $out=[EmrM03AcceptanceBoundedIo]::Text($killer.StandardOutput,16384);$err=[EmrM03AcceptanceBoundedIo]::Text($killer.StandardError,16384)
  $done=$killer.WaitForExit(10000)
  if(-not $done -or -not [Threading.Tasks.Task]::WhenAll([Threading.Tasks.Task[]]@($out,$err)).Wait(5000) -or $killer.ExitCode -ne 0 -or -not $RootProcess.WaitForExit(5000)){throw 'blocked'}
  foreach($known in $tree){
   $current=CimCmdlets\Get-CimInstance -ClassName Win32_Process -Filter ('ProcessId='+[int]$known.ProcessId) -Property ProcessId,ParentProcessId,CreationDate -ErrorAction Stop
   if($null -ne $current -and $current.CreationDate -eq $known.CreationDate){throw 'blocked'}
   $children=@(CimCmdlets\Get-CimInstance -ClassName Win32_Process -Filter ('ParentProcessId='+[int]$known.ProcessId) -Property ProcessId,ParentProcessId,CreationDate -ErrorAction Stop)
   if(@($children|Where-Object{$_.CreationDate -ge $known.CreationDate}).Count -gt 0){throw 'blocked'}
  }
  return $true
 }catch{return $false}finally{
  if($null -ne $killer){if(-not $done){try{$killer.Kill();$null=$killer.WaitForExit(5000)}catch{}};$killer.Dispose()}
  if($null -ne $info){$info.EnvironmentVariables.Clear()}
 }
}
function Wait-AcceptanceNormalClose {
 if(-not $started -or $closed){return}
 if($null -eq $lineTask -and -not $outputDiscarding){$script:lineTask=[EmrM03AcceptanceBoundedIo]::Line($child.StandardOutput,65536)}
 if($null -eq $errorTask){$script:errorBuffer=New-Object char[] 1024;$script:errorTask=$child.StandardError.ReadAsync($errorBuffer,0,1024)}
 if(-not $closeRequested){try{$child.StandardInput.WriteLine('{"kind":"m03_acceptance_command","id":"parent_refusal","command":"close"}');$child.StandardInput.Flush();$script:closeRequested=$true}catch{}}
 while(-not $child.HasExited -and [DateTimeOffset]::UtcNow -lt $childDeadline){
  if($null -ne $lineTask -and $lineTask.IsCompleted){
   try{
    $line=$lineTask.GetAwaiter().GetResult()
    if($null -ne $line){Write-Output (Safe-PublicLine (ConvertFrom-Json -InputObject $line))}
    $script:lineTask=if($null -eq $line){$null}else{[EmrM03AcceptanceBoundedIo]::Line($child.StandardOutput,65536)}
   }catch{
    # No unsafe projection is emitted; discard the remaining private bytes so
    # a defective child cannot block its own bounded cleanup on a full pipe.
    try{$child.StandardOutput.DiscardBufferedData();$null=$child.StandardOutput.BaseStream.CopyToAsync([IO.Stream]::Null)}catch{}
    $script:lineTask=$null;$script:outputDiscarding=$true;$script:closureVerified=$false
   }
  }
  if($null -ne $errorTask -and -not $errorDraining -and $errorTask.IsCompleted){
   try{if($errorTask.GetAwaiter().GetResult() -gt 0){$null=$child.StandardError.BaseStream.CopyToAsync([IO.Stream]::Null)}}catch{}
   $script:errorDraining=$true
  }
  if($null -ne $lineTask){$null=[Threading.Tasks.Task]::WaitAny([Threading.Tasks.Task[]]@($lineTask),100)}else{Start-Sleep -Milliseconds 100}
 }
 if($child.HasExited){
  $script:closed=$child.WaitForExit(5000)
  if($closed){Drain-AcceptanceTail}
 }
}
function Drain-AcceptanceTail {
 # A terminated parent alone does not prove EOF if an unexpected descendant
 # inherited its pipe. Every remaining read still has a finite wait/ceiling.
 for($count=0;$count -lt 4096 -and $null -ne $lineTask;$count++){
  if([DateTimeOffset]::UtcNow -ge $childDeadline){$script:closureVerified=$false;return}
  try{
   if(-not $lineTask.Wait(5000)){$script:closureVerified=$false;return}
   $tail=$lineTask.GetAwaiter().GetResult()
   if($null -eq $tail){$script:lineTask=$null;return}
   Write-Output (Safe-PublicLine (ConvertFrom-Json -InputObject $tail))
   $script:lineTask=[EmrM03AcceptanceBoundedIo]::Line($child.StandardOutput,65536)
  }catch{$script:closureVerified=$false;return}
 }
 if($null -ne $lineTask){$script:closureVerified=$false}
}
function Safe-PublicLine($Value){
 # Child source is sealed. Even a defective child cannot echo raw secret/errors.
 if($Value -isnot [PSCustomObject] -or $Value.kind -isnot [string]){throw 'blocked'}
 foreach($property in $Value.PSObject.Properties){
  if($property.Value -is [string]){
   foreach($needle in $needles){if($property.Value.IndexOf($needle,[StringComparison]::Ordinal) -ge 0 -or $property.Value.IndexOf([Uri]::EscapeDataString($needle),[StringComparison]::OrdinalIgnoreCase) -ge 0){throw 'blocked'}}
  }
 }
 if($Value.kind -ceq 'mcp_port_request'){
  if(@(Compare-Object -CaseSensitive @('kind','nonce','action','workflowId'|Sort-Object) @($Value.PSObject.Properties.Name|Sort-Object)).Count -ne 0 -or $Value.nonce -cnotmatch '^[A-Za-z0-9_-]{1,80}$' -or $Value.action -cnotin @('discover','details','start','browser_discover','browser_details','browser_start') -or -not $knownWorkflowIds.Contains($Value.workflowId) -or ($Value.action -cin @('discover','browser_discover') -and $Value.workflowId -cne 'MzimjpsuyPuK7SKe')){throw 'blocked'}
  return $Value|ConvertTo-Json -Compress
 }
 # All other private protocol kinds require the finite CLI's safe projection.
 # Until that exact projection is installed/reviewed, refuse rather than echo.
 if($Value.kind -cnotin @('m03_acceptance_result','m03_acceptance_ready','m03_acceptance_closed')){throw 'blocked'}
 $allowed=@('kind','id','status','code','command','caseId','executionIds','phaseBReady','domainProofReady','businessAcceptanceProven','managementAttempts','controlAttempts','gatewayPreflightAttempts','providerDirectAttempts','nativeExecutions','startedActors','baselineRestored','environmentCleanupVerified','windowClosed','fixtureArchived','remoteWorkSettled','residual','childTransportsClosed','adminChildClosed','approvedHead','sourceCommitSha','deadlineAt','baselineWorkflowKey','baselineFailureCodes','baselineNameEqual','baselineNodesEqual','baselineConnectionsEqual','baselineSettingsEqual','nativeReaderWorkflowKey','nativeReaderStage','nativeReaderHttpStatus')
 if(@($Value.PSObject.Properties.Name|Where-Object{$_ -cnotin $allowed}).Count -ne 0){throw 'blocked'}
 foreach($property in $Value.PSObject.Properties){
  $v=$property.Value
  if($property.Name -cin @('phaseBReady','domainProofReady','businessAcceptanceProven','baselineRestored','environmentCleanupVerified','windowClosed','fixtureArchived','remoteWorkSettled','residual','childTransportsClosed','adminChildClosed','baselineNameEqual','baselineNodesEqual','baselineConnectionsEqual','baselineSettingsEqual')){
   if($v -isnot [bool]){throw 'blocked'}
  }
  elseif($property.Name -cin @('baselineWorkflowKey','nativeReaderWorkflowKey')){
   if($property.Name -ceq 'nativeReaderWorkflowKey' -and $null -eq $v){continue}
   if($v -isnot [string] -or $v -cnotin @('WF-00','WF-10','WF-11','WF-12','WF-13','WF-18','WF-18b','WF-19','WF-21','WF-22','WF-23','WF-30','WF-32','WF-40','WF-50','WF-70','WF-80','WF-90','WF-91','WF-99','SUB-START','SUB-FINISH','SUB-INGEST','SUB-COST','SUB-NOTIFY')){throw 'blocked'}
  }
  elseif($property.Name -ceq 'baselineFailureCodes'){
   $codes=@('expected_shape','dto_shape','workflow_id','archive_state','activation_state','active_version','version_shape','version_mismatch','owner_project','tags_shape','tags_mismatch','pinned_data','graph_shape','node_shape','graph_name','graph_nodes','graph_connections','graph_settings')
   if($v -isnot [Array] -or $v.Count -gt $codes.Count -or @($v|Where-Object{$_ -isnot [string] -or $_ -cnotin $codes}).Count -ne 0){throw 'blocked'}
  }
  elseif($property.Name -ceq 'nativeReaderStage'){
   if($v -isnot [string] -or $v -cnotin @('unknown','admission','request','framing','body','parse','projection','close','http_status')){throw 'blocked'}
  }
  elseif($property.Name -ceq 'nativeReaderHttpStatus'){
   if($null -ne $v -and (($v -isnot [int] -and $v -isnot [long]) -or $v -lt 100 -or $v -gt 599)){throw 'blocked'}
  }
  elseif($property.Name -ceq 'executionIds'){
   if($v -isnot [Array] -or $v.Count -gt 120 -or @($v|Where-Object{$_ -isnot [string] -or $_ -cnotmatch '^[1-9][0-9]{0,31}$'}).Count -ne 0){throw 'blocked'}
   foreach($item in $v){foreach($needle in $needles){if($item.IndexOf($needle,[StringComparison]::Ordinal) -ge 0){throw 'blocked'}}}
  }
  elseif($property.Name -ceq 'deadlineAt'){
   if(($v -isnot [long] -and $v -isnot [int]) -or $v -lt 0 -or $v -gt [DateTimeOffset]::UtcNow.AddMinutes(61).ToUnixTimeMilliseconds()){throw 'blocked'}
  }
  elseif($v -is [string]){
   if($v -cnotmatch '^[A-Za-z0-9_.:-]{1,128}$'){throw 'blocked'}
   if($property.Name -ceq 'approvedHead' -and $v -cne 'f42930f90c2de43c84f61ad6d966d0ee6074d70e'){throw 'blocked'}
   if($property.Name -ceq 'sourceCommitSha' -and $v -cnotin @('f42930f90c2de43c84f61ad6d966d0ee6074d70e','a5e746736893d5040e93032ae740a0878f748837')){throw 'blocked'}
   if($property.Name -ceq 'code' -and $v -cnotmatch '^[A-Z][A-Z0-9_]{1,100}$'){throw 'blocked'}
   if($property.Name -ceq 'status' -and $v -cnotin @('private_child_ready','blocked','dev_runtime_prepared','native_unresolved','cleanup_unresolved','sql_acceptance_unresolved','native_settled_and_cleaned','restoration_verified','restoration_residual','prepared','not_prepared','closed','residual','domain_verified','domain_proof_unresolved','native_domain_denial_and_cleanup_verified')){throw 'blocked'}
  }
  elseif($v -is [bool] -or $null -eq $v){}
  elseif($v -is [int] -or $v -is [long]){if($v -lt 0 -or $v -gt 1000000){throw 'blocked'}}
  else{throw 'blocked'}
 }
 if($Value.kind -ceq 'm03_acceptance_closed'){
  $script:closureVerified=$false;$script:credentialClosureVerified=$false
  $credentialRequired=@('childTransportsClosed','adminChildClosed')
  if(@($credentialRequired|Where-Object{$_ -cnotin $Value.PSObject.Properties.Name}).Count -eq 0){
   $script:credentialClosureVerified=($Value.childTransportsClosed -and $Value.adminChildClosed)
  }
  $required=@('baselineRestored','environmentCleanupVerified','windowClosed','remoteWorkSettled','residual','childTransportsClosed','adminChildClosed')
  if(@($required|Where-Object{$_ -cnotin $Value.PSObject.Properties.Name}).Count -eq 0){
   $script:closureVerified=($Value.status -ceq 'closed' -and -not $Value.residual -and $Value.baselineRestored -and $Value.environmentCleanupVerified -and $Value.windowClosed -and $Value.remoteWorkSettled -and $Value.childTransportsClosed -and $Value.adminChildClosed)
  }
 }
 return $Value|ConvertTo-Json -Compress
}
try{
 if(@($ResumeZeroSetup,$ClockAmendment,$PostcheckContinuation,$RemainingContinuation,$StartupReplacement,$ProjectVerifiedContinuation|Where-Object{$_}).Count -gt 1){throw 'blocked'}
 $admittedClockMode=$ClockAmendment -or $PostcheckContinuation -or $RemainingContinuation -or $StartupReplacement -or $ProjectVerifiedContinuation
 $sealFile=Public-File (Join-Path $repo 'scripts/n8n/foundation-acceptance-seal.json') 2097152
 $seal=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($sealFile))
 $module=Public-File (Join-Path $PSScriptRoot 'Acceptance-PublicRuntime.ps1')
 $expected=$seal.files.'scripts/n8n/windows/Acceptance-PublicRuntime.ps1'
 if($expected -cnotmatch '^[a-f0-9]{64}$' -or (Get-FileHash -LiteralPath $module -Algorithm SHA256).Hash.ToLowerInvariant() -cne $expected){throw 'blocked'}
 . $module
 $node=Assert-M03AcceptancePublicSeal $repo $seal
 $entry=Public-File (Join-Path $repo 'scripts/n8n/foundation-live-runtime-cli.mjs')
 Initialize-BoundedIo
 Invoke-PublicCompositionCheck $node $entry $repo
 if(-not $ResumeZeroSetup -and -not $admittedClockMode -and (Test-Path -LiteralPath (Join-Path $repo 'scripts/n8n/out/foundation/live/management.jsonl'))){throw 'blocked'}
 if($ResumeZeroSetup){$resumeDeadlineAt=Invoke-ZeroSetupPublicCheck $node $repo}
 $remainingAuthorityReady=$true
 if($admittedClockMode){$publicClock=Invoke-ClockAmendmentPublic $node $repo 'CheckOnly' ([bool]$PostcheckContinuation) ([bool]$RemainingContinuation) ([bool]$StartupReplacement) ([bool]$ProjectVerifiedContinuation);if($RemainingContinuation -and $publicClock.kind -ceq 'remaining_continuation_approval_required'){$remainingAuthorityReady=$false;if(-not $CheckOnly){throw 'blocked'}}}
 if($ProjectVerifiedContinuation -and $publicClock.kind -ceq 'project_verified_continuation_blocked'){
  # The current50 subcap is binding. Stop before Admin checks, native-auth
  # metadata, runtime copies, DPAPI, transport admission or hosted operations.
  $publicClock|ConvertTo-Json -Compress|Write-Output
  if($CheckOnly){exit 0}else{exit 1}
 }
 if($ProjectVerifiedContinuation -and $publicClock.kind -ceq 'project_verified_continuation_approval_required'){
  if(-not $CheckOnly){throw 'blocked'}
  [ordered]@{status='project_verified_continuation_approval_required';approvalRequired=$true;privateRead=$false;networkRequests=0;publicCompositionLoaded=$true;adminPublicInputsVerified=$false;adminHandoffReady=$false;actualMcpPortVerified=$false;windowId=$seal.windowId;segmentId='20275b22-b7fe-4737-a9a4-c50c2feadb74';managementMaximum=512;controlMaximum=2048}|ConvertTo-Json -Compress
  exit 0
 }
 # Missing startup approval is a public-only terminal state, before the database helper or any private filename metadata.
 if($StartupReplacement -and $publicClock.kind -ceq 'startup_replacement_approval_required'){
  if(-not $CheckOnly){throw 'blocked'}
  [ordered]@{status='startup_replacement_approval_required';approvalRequired=$true;privateRead=$false;networkRequests=0;publicCompositionLoaded=$true;adminPublicInputsVerified=$false;adminHandoffReady=$false;actualMcpPortVerified=$false;windowId=$seal.windowId;segmentId='1c69c89e-7807-46d5-b7b8-ca28285ff2b4';managementMaximum=512;controlMaximum=2048}|ConvertTo-Json -Compress
  exit 0
 }
 $forwardWindowPublic=$ProjectVerifiedContinuation -and $publicClock.sourceCommitSha -ceq 'a5e746736893d5040e93032ae740a0878f748837' -and $publicClock.windowId -ceq '38b3708d-61b0-41d2-8170-5ed91c66b4dc'
 $adminPublicReady=Invoke-PublicDatabaseCheck $repo ([bool]$CheckOnly) $resumeDeadlineAt ([bool]$ClockAmendment) ([bool]$PostcheckContinuation) ([bool]$RemainingContinuation) ([bool]$StartupReplacement) ([bool]$ProjectVerifiedContinuation) ([bool]$forwardWindowPublic)
 $bindings=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText((Public-File (Join-Path $repo 'n8n/foundation/bindings.dev.json'))))
 foreach($property in $bindings.workflowRefs.PSObject.Properties){$null=$knownWorkflowIds.Add($property.Value.id)}
 if($knownWorkflowIds.Count -ne 25){throw 'blocked'}
 if($CheckOnly){
  $effectiveManagementMaximum=if($ProjectVerifiedContinuation){Get-ProjectVerifiedPublicManagementMaximum $publicClock $true 'CheckOnly'}else{512}
  if($RemainingContinuation -and -not $remainingAuthorityReady){
   [ordered]@{status='approval_required';approvalRequired=$true;privateRead=$false;networkRequests=0;publicCompositionLoaded=$true;adminPublicInputsVerified=$true;adminHandoffReady=$false;actualMcpPortVerified=$false;windowId=$seal.windowId;segmentId='e8035391-dba8-48c9-97e0-139ba980d86e';managementMaximum=512;controlMaximum=2048}|ConvertTo-Json -Compress
   exit 0
  }
  [ordered]@{status='check_only_ready';privateRead=$false;networkRequests=0;publicCompositionLoaded=$true;adminPublicInputsVerified=$true;adminHandoffReady=$adminPublicReady;actualMcpPortVerified=$false;windowId=$seal.windowId;managementMaximum=$effectiveManagementMaximum;controlMaximum=2048}|ConvertTo-Json -Compress
  exit 0
 }
 Confirm-PublicTransport
 $directory=[IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'Temp'))
 $null=Get-M03AcceptancePhysicalPath $directory
 $lockPath=Join-Path $directory 'emr-m03-acceptance-parent.operation.lock'
 $lockShare=if($admittedClockMode){[IO.FileShare]::Read}else{[IO.FileShare]::None}
 $lock=[IO.File]::Open($lockPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,$lockShare)
 if($admittedClockMode){
  $parentSegment=if($ProjectVerifiedContinuation){'20275b22-b7fe-4737-a9a4-c50c2feadb74'}elseif($StartupReplacement){'1c69c89e-7807-46d5-b7b8-ca28285ff2b4'}elseif($RemainingContinuation){'e8035391-dba8-48c9-97e0-139ba980d86e'}elseif($PostcheckContinuation){'a570212a-634c-444f-90a2-578ae47e8d27'}else{'30e75d0d-7e4c-46c6-9a07-556f90b63859'}
  $parentMetadata=[ordered]@{kind='m03_clock_admission_parent';version=1;segmentId=$parentSegment;processId=$PID}
  $parentBytes=[Text.UTF8Encoding]::new($false).GetBytes(($parentMetadata|ConvertTo-Json -Compress))
  $lock.Write($parentBytes,0,$parentBytes.Length);$lock.Flush($true);[Array]::Clear($parentBytes,0,$parentBytes.Length)
  $lockedPublicClock=Invoke-ClockAmendmentPublic $node $repo 'CheckOnly' ([bool]$PostcheckContinuation) ([bool]$RemainingContinuation) ([bool]$StartupReplacement) ([bool]$ProjectVerifiedContinuation)
  if($ProjectVerifiedContinuation -and $lockedPublicClock.kind -cne 'project_verified_continuation_ready'){throw 'blocked'}
 }
 if($ResumeZeroSetup){$resumeDeadlineAt=Invoke-ZeroSetupPublicCheck $node $repo}
 # Project-verified Run checks saved CLI metadata after public approval and
 # mutex/transport checks, before any lease, Machine metadata, DPAPI or Admit.
 # This separate receipt describes saved metadata; privateRead below remains
 # the existing batch-DPAPI indicator, not a claim that no metadata was read.
 if($ProjectVerifiedContinuation){
  $receipt.code='M03_ACCEPTANCE_VERCEL_METADATA_BLOCKED'
  Confirm-ProjectVerifiedVercelMetadata $node $repo
  $receipt.code='M03_ACCEPTANCE_BLOCKED'
 }
 # Verify retained input provenance before consuming any new lease/ciphertext.
 $old=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText((Public-File (Join-Path $repo 'scripts/n8n/foundation-delivery-packet.json'))))
 $pending=Join-Path $env:LOCALAPPDATA 'Everyone-Market-Radar-Private\foundation\df4f29ec-e2dc-4d82-a276-62a4e695e6f9'
 $metadata=ConvertFrom-Json -InputObject (Read-LockedText (Join-Path $pending 'pending-runtime.json'))
 $machineKeys=@('version','windowId','purpose','audience','sourceCommitSha','credentialId','createdAt')
 if($metadata -isnot [PSCustomObject] -or @(Compare-Object -CaseSensitive @($machineKeys|Sort-Object) @($metadata.PSObject.Properties.Name|Sort-Object)).Count -ne 0 -or $metadata.version -isnot [int] -or $metadata.version -ne 1 -or $metadata.windowId -cne $seal.windowId -or $metadata.purpose -cne 'pending_inactive_m03_runtime_delivery' -or $metadata.credentialId -cne 'EmrM03Machine19' -or $metadata.audience -cne $old.audience -or $metadata.sourceCommitSha -cne $old.sourceCommitSha -or $metadata.createdAt -isnot [string] -or $metadata.createdAt -cnotmatch '^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3,7}(?:Z|\+00:00)$'){throw 'blocked'}
 if([DateTimeOffset]::Parse($metadata.createdAt,[Globalization.CultureInfo]::InvariantCulture) -gt [DateTimeOffset]::UtcNow){throw 'blocked'}
 $machinePath=Public-File (Join-Path $pending 'machine.dpapi')
 # Under standing M03 dev authorization, consumed/expired disposable copies
 # are regenerated from retained originals without another credential prompt.
 # Public source/access, mutex and retained Machine provenance already passed.
 if($ProjectVerifiedContinuation){
  Initialize-M03AcceptanceDevCredentials $repo $lock
 }
 $private=@{};$handoffs=@{};$leases=@{};$minimumExpiry=[DateTimeOffset]::UtcNow.AddHours(2)
 foreach($kind in @('Management','Writer','ApifyRead')){
  $stem='emr-m03-acceptance-'+$kind.ToLowerInvariant()
  $handoff=Join-Path $directory ($stem+'.dpapi');$leasePath=Join-Path $directory ($stem+'.lease.json')
  $lease=ConvertFrom-Json -InputObject (Read-LockedText $leasePath)
  $keys=@('version','windowId','purpose','approvedHead','approvedPacketSha256','kind','createdAt','expiresAt')
  if(@(Compare-Object -CaseSensitive @($keys|Sort-Object) @($lease.PSObject.Properties.Name|Sort-Object)).Count -ne 0 -or $lease.version -ne 1 -or $lease.windowId -cne $seal.windowId -or $lease.approvedHead -cne $seal.approvedHead -or $lease.approvedPacketSha256 -cne $seal.approvedPacketSha256 -or $lease.kind -cne $kind -or $lease.purpose -cne ('m03_approved_dev_acceptance_'+$kind.ToLowerInvariant())){throw 'blocked'}
  $created=[DateTimeOffset]::Parse($lease.createdAt,[Globalization.CultureInfo]::InvariantCulture)
  $expiry=[DateTimeOffset]::Parse($lease.expiresAt,[Globalization.CultureInfo]::InvariantCulture)
  $runtimeCoverageMinutes=if($admittedClockMode){75}else{70}
  if($created -gt [DateTimeOffset]::UtcNow -or $expiry -ne $created.AddHours(2) -or $expiry -lt [DateTimeOffset]::UtcNow.AddMinutes($runtimeCoverageMinutes)){throw 'blocked'}
  if($expiry -lt $minimumExpiry){$minimumExpiry=$expiry}
  $null=Public-File $handoff
  $handoffs[$kind]=$handoff;$leases[$kind]=$leasePath
 }
 # The separate sealed administrator child owns its own credential. Verify only
 # its delivery metadata/presence here, before consuming the runtime inputs.
 $adminStem=Join-Path $directory 'emr-m03-foundation-dev-migration-password'
 $null=Public-File ($adminStem+'.dpapi')
 $adminLease=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText((Public-File ($adminStem+'.lease.json') 16384)))
 $adminKeys=@('version','environment','projectRef','purpose','approvalSha','createdAt','expiresAt')
 if($adminLease -isnot [PSCustomObject] -or @(Compare-Object -CaseSensitive @($adminKeys|Sort-Object) @($adminLease.PSObject.Properties.Name|Sort-Object)).Count -ne 0 -or $adminLease.version -isnot [int] -or $adminLease.version -ne 1 -or $adminLease.environment -cne 'dev' -or $adminLease.projectRef -cne 'zmotjsbzhzjvpelxvxlf' -or $adminLease.purpose -cne $(if($ProjectVerifiedContinuation){'m03-foundation-project-verified-continuation-dev:20275b22-b7fe-4737-a9a4-c50c2feadb74'}else{'m03-foundation-phase-a-dev'}) -or $adminLease.approvalSha -cne $seal.approvedHead -or $adminLease.createdAt -isnot [string] -or $adminLease.expiresAt -isnot [string]){throw 'blocked'}
 $adminCreated=[DateTime]::ParseExact($adminLease.createdAt,'o',[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::RoundtripKind)
 $adminExpiry=[DateTime]::ParseExact($adminLease.expiresAt,'o',[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::RoundtripKind)
 $adminRequiredUntil=if($ResumeZeroSetup){[DateTimeOffset]::FromUnixTimeMilliseconds($resumeDeadlineAt).AddMinutes(15).UtcDateTime}else{[DateTime]::UtcNow.AddMinutes(75)}
 if($adminCreated.Kind -ne [DateTimeKind]::Utc -or $adminExpiry.Kind -ne [DateTimeKind]::Utc -or $adminCreated -gt [DateTime]::UtcNow.AddMinutes(1) -or $adminExpiry -ne $adminCreated.AddHours(2) -or $adminExpiry -le $adminRequiredUntil){throw 'blocked'}
 $bypassFile=Join-Path $directory 'emr-m03-acceptance-protection-bypass.dpapi'
 if(Test-Path -LiteralPath $bypassFile){throw 'blocked'}
 if($admittedClockMode){
  # One bounded technical attempt, after source/transport/provenance/lease checks.
  # Standing milestone authority permits only reconciled no-effect retries;
  # every earlier admission, claim and closed clock remains immutable.
  $amendmentClock=Invoke-ClockAmendmentPublic $node $repo 'Admit' ([bool]$PostcheckContinuation) ([bool]$RemainingContinuation) ([bool]$StartupReplacement) ([bool]$ProjectVerifiedContinuation)
  $resumeDeadlineAt=[long]$amendmentClock.deadlineAt
  $amendmentLeaseFloor=[DateTimeOffset]::FromUnixTimeMilliseconds([long]$amendmentClock.startsAt).AddMinutes(75)
  if($minimumExpiry -lt $amendmentLeaseFloor -or $adminExpiry -le $amendmentLeaseFloor.UtcDateTime){throw 'blocked'}
 }
 if($ResumeZeroSetup -and [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() -ge $resumeDeadlineAt-600000){throw 'blocked'}
 $receipt.privateRead=$true
 $machine=Plain-Dpapi (Read-LockedText $machinePath)
 if($machine -cnotmatch '^[A-Za-z0-9_-]{43}$'){throw 'blocked'}
 $needles.Add($machine)
 foreach($kind in @('Management','Writer','ApifyRead')){
  $cipher=Read-LockedText $handoffs[$kind]
  $consumed.Add($handoffs[$kind]);$consumed.Add($leases[$kind])
  $private[$kind]=Plain-Dpapi $cipher;$cipher=$null
  if([string]::IsNullOrEmpty($private[$kind])){throw 'blocked'}
  $needles.Add($private[$kind])
 }
 # New owned bypass is generated privately, never supplied as a CLI argument.
 $rng=[Security.Cryptography.RandomNumberGenerator]::Create();$bytes=New-Object byte[] 96
 $characters='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';$builder=[Text.StringBuilder]::new()
 try{while($builder.Length -lt 32){$rng.GetBytes($bytes);foreach($b in $bytes){if($b -lt 248 -and $builder.Length -lt 32){$null=$builder.Append($characters[$b%62])}}}}finally{$rng.Dispose();[Array]::Clear($bytes,0,$bytes.Length)}
 $bypass=$builder.ToString();$builder=$null
 $needles.Add($bypass)
 $secret=ConvertTo-SecureString -String $bypass -AsPlainText -Force
 $cipher=ConvertFrom-SecureString -SecureString $secret;$secret.Dispose();$secret=$null
 $bypassStream=[IO.File]::Open($bypassFile,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
 $bypassCreated=$true
 try{$bytes=[Text.Encoding]::ASCII.GetBytes($cipher);$bypassStream.Write($bytes,0,$bytes.Length);$bypassStream.Flush($true)}finally{$bypassStream.Dispose();[Array]::Clear($bytes,0,$bytes.Length)}
 $cipher=$null
 $packet=[ordered]@{kind='m03_acceptance_private_input';version=1;approvedHead=$seal.approvedHead;approvedPacketSha256=$seal.approvedPacketSha256;sourceCommitSha=$(if($ProjectVerifiedContinuation){$amendmentClock.sourceCommitSha}else{$seal.approvedHead});managementKey=$private.Management;writerPassword=$private.Writer;apifyReadToken=$private.ApifyRead;machineToken=$machine;protectionBypass=$bypass;leaseExpiry=$minimumExpiry.ToUnixTimeMilliseconds()}
 $start=[Diagnostics.ProcessStartInfo]::new();$start.FileName=$node
 $sessionMode=if($ProjectVerifiedContinuation){'SessionProjectVerifiedContinuation'}elseif($StartupReplacement){'SessionStartupReplacement'}elseif($RemainingContinuation){'SessionRemainingContinuation'}elseif($PostcheckContinuation){'SessionPostcheckContinuation'}elseif($ClockAmendment){'SessionClockAmendment'}elseif($ResumeZeroSetup){'SessionResumeZeroSetup'}else{'Session'}
 $start.Arguments='"'+$entry+'" '+$sessionMode;$start.WorkingDirectory=$repo
 $start.UseShellExecute=$false;$start.CreateNoWindow=$true
 $start.RedirectStandardInput=$true;$start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true
 $start.EnvironmentVariables.Clear()
 foreach($name in @('SystemRoot','WINDIR','PATH','USERPROFILE','LOCALAPPDATA','APPDATA','TEMP','TMP')){if(Test-Path ('Env:'+ $name)){$start.EnvironmentVariables[$name]=[Environment]::GetEnvironmentVariable($name)}}
 $child=[Diagnostics.Process]::new();$child.StartInfo=$start
 $started=$child.Start();if(-not $started){throw 'blocked'};$closed=$false
 $runtimeProcessId=$child.Id
 $childDeadline=if($admittedClockMode -or $ResumeZeroSetup){[DateTimeOffset]::FromUnixTimeMilliseconds($resumeDeadlineAt).AddMinutes(10)}else{[DateTimeOffset]::UtcNow.AddMinutes(70)}
 $child.StandardInput.WriteLine(($packet|ConvertTo-Json -Depth 5 -Compress));$child.StandardInput.Flush()
 $packet=$null;$private=$null;$machine=$null;$bypass=$null
 $lineTask=[EmrM03AcceptanceBoundedIo]::Line($child.StandardOutput,65536);$errorBuffer=New-Object char[] 1024;$errorTask=$child.StandardError.ReadAsync($errorBuffer,0,1024);$inputTask=[EmrM03AcceptanceBoundedIo]::Line([Console]::In,262144)
 $until=if($admittedClockMode -or $ResumeZeroSetup){[DateTimeOffset]::FromUnixTimeMilliseconds($resumeDeadlineAt).AddMinutes(-10)}else{[DateTimeOffset]::UtcNow.AddMinutes(50)}
 while(-not $child.HasExited){
  if([DateTimeOffset]::UtcNow -ge $childDeadline){break}
  if([DateTimeOffset]::UtcNow -ge $until -and -not $closeRequested){
   $child.StandardInput.WriteLine('{"kind":"m03_acceptance_command","id":"stop_new_boundary","command":"close"}');$child.StandardInput.Flush();$closeRequested=$true
  }
  if($errorTask.IsCompleted -and $errorTask.Result -gt 0){throw 'blocked'}
  if($null -ne $lineTask -and $lineTask.IsCompleted){
   $line=$lineTask.Result
   if($null -ne $line){if($line.Length -gt 65536){throw 'blocked'};$value=ConvertFrom-Json -InputObject $line;Write-Output (Safe-PublicLine $value)}
   $lineTask=if($null -eq $line){$null}else{[EmrM03AcceptanceBoundedIo]::Line($child.StandardOutput,65536)}
  }
  if($null -ne $inputTask -and $inputTask.IsCompleted){
   $inputLine=$inputTask.Result
   if($null -eq $inputLine){
    if(-not $closeRequested){$child.StandardInput.WriteLine('{"kind":"m03_acceptance_command","id":"stdin_closed","command":"close"}');$child.StandardInput.Flush();$closeRequested=$true};$inputTask=$null
   }else{
   if($inputLine.Length -gt 262144){throw 'blocked'}
   $inputValue=ConvertFrom-Json -InputObject $inputLine
   if($inputValue.kind -cnotin @('m03_acceptance_command','mcp_port_result')){throw 'blocked'}
   if(-not $closeRequested -or $inputValue.kind -ceq 'mcp_port_result'){$child.StandardInput.WriteLine($inputLine);$child.StandardInput.Flush()}
   if($inputValue.kind -ceq 'm03_acceptance_command' -and $inputValue.command -ceq 'close'){$closeRequested=$true}
   $inputLine=$null;$inputValue=$null
   $inputTask=[EmrM03AcceptanceBoundedIo]::Line([Console]::In,262144)
   }
  }
  $tasks=@(@($lineTask,$inputTask)|Where-Object{$null -ne $_})
  if($tasks.Count -gt 0){$null=[Threading.Tasks.Task]::WaitAny($tasks,100)}else{Start-Sleep -Milliseconds 100}
 }
 $closed=$child.WaitForExit(0);if($closed){$receipt.nativeExit=$child.ExitCode}
 if($closed){
  # Drain the bounded projected tail even when exit won the final read race.
  Drain-AcceptanceTail
  if($errorTask.IsCompleted -and $errorTask.Result -gt 0){throw 'blocked'}
 }
 if($closed -and $child.ExitCode -eq 0){$exitCode=0;$receipt.code='M03_ACCEPTANCE_CHILD_CLOSED'}
} catch {
 # No raw exceptions, decrypted values, child stderr or unprojected stdout escape.
 if($started -and $null -ne $child -and -not $closed){try{Wait-AcceptanceNormalClose}catch{}}
} finally {
 if($null -ne $secret){$secret.Dispose()}
 $packet=$null;$private=$null;$machine=$null;$bypass=$null;$cipher=$null;$line=$null;$value=$null
 if($null -ne $child){
  if($started -and -not $closed){
   try{Wait-AcceptanceNormalClose}catch{}
   if(-not $closed -and -not $child.HasExited){$emergency=$true;$script:closureVerified=$false;$treeClosed=Stop-OwnedProcessTree $child;$closed=$child.WaitForExit(0)}
   elseif($child.HasExited){$closed=$child.WaitForExit(0)}
  }
  if($closed){try{$receipt.nativeExit=$child.ExitCode}catch{}}
  try{$child.Dispose()}catch{$exitCode=1}
 }
 if($null -ne $start){$start.EnvironmentVariables.Clear()}
 foreach($stream in $opened){$stream.Dispose()}
 $needles.Clear()
 if($null -ne (Get-Variable -Name errorBuffer -ErrorAction SilentlyContinue)){[Array]::Clear($errorBuffer,0,$errorBuffer.Length)}
 $deleted=$true
 # Consumed credentials require physical child closure, independently of the
 # remote restoration result. An emergency tree receipt proves only local
 # process closure and must never authorize removal of the residual bypass.
 $credentialChildrenClosed=$script:projectVerifiedMetadataClosed -and (-not $started -or ($closed -and $script:credentialClosureVerified) -or $treeClosed)
 $safeToDeleteCredentials=$closed -and $credentialChildrenClosed
 $safeToDeleteBypass=$closed -and (-not $started -or $script:closureVerified) -and -not $emergency
 if($safeToDeleteCredentials){foreach($path in $consumed){try{$null=Public-File $path;[IO.File]::Delete($path);if(Test-Path -LiteralPath $path){$deleted=$false}}catch{$deleted=$false}}}else{$deleted=$false}
 $receipt.handoffsDeleted=($consumed.Count -gt 0 -and $deleted);$receipt.childClosed=$closed
 $receipt.credentialChildrenClosed=$credentialChildrenClosed;$receipt.emergencyShutdown=$emergency
 if($emergency){$receipt.code='M03_ACCEPTANCE_EMERGENCY_RESIDUAL';$exitCode=1}
 if($null -ne $lock){$lock.Dispose();if($safeToDeleteCredentials){try{[IO.File]::Delete($lockPath)}catch{$exitCode=1}}}
 if($bypassCreated -and $safeToDeleteBypass){
  try{$null=Public-File $bypassFile;[IO.File]::Delete($bypassFile);$receipt.bypassHandoffDeleted=-not (Test-Path -LiteralPath $bypassFile)}catch{$exitCode=1}
 }
 if($ProjectVerifiedContinuation -and $null -ne $amendmentClock){
  try{
   if(-not $bypassCreated){$receipt.bypassHandoffDeleted=-not (Test-Path -LiteralPath (Join-Path $directory 'emr-m03-acceptance-protection-bypass.dpapi'))}
   Write-M03ProjectVerifiedTechnicalClosure $repo $amendmentClock $receipt $runtimeProcessId ([bool](-not $started -or $script:closureVerified))
  }catch{$exitCode=1}
 }
 # Otherwise preserve the owned encrypted bypass for explicit residual follow-up.
 if(-not $closed -or -not $deleted -or ($started -and -not $script:closureVerified)){$exitCode=1}
}
$receipt|ConvertTo-Json -Compress
exit $exitCode
