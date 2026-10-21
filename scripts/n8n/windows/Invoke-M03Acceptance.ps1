[CmdletBinding()]
param([switch]$CheckOnly,[switch]$ResumeZeroSetup)
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
function Invoke-PublicDatabaseCheck([string]$Repository,[bool]$AllowMissing,$OriginalDeadline=$null){
 $process=$null;$info=$null;$running=$false;$done=$true
 try{
  $db=Public-File (Join-Path $Repository 'scripts/db/windows/Invoke-M03FoundationMigrations.ps1')
  $info=[Diagnostics.ProcessStartInfo]::new();$info.FileName=(Join-Path $PSHOME 'powershell.exe')
  $info.Arguments='-NoProfile -NonInteractive -File "'+$db+'" -CheckOnly -PhaseAControl';$info.WorkingDirectory=$Repository
  if($null -ne $OriginalDeadline){if($OriginalDeadline -ne 1792584023481){throw 'blocked'};$info.Arguments+=' -OriginalDeadlineAtMs '+[string]$OriginalDeadline}
  $info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true;$info.EnvironmentVariables.Clear()
  foreach($name in @('SystemRoot','WINDIR','PATH','USERPROFILE','LOCALAPPDATA','APPDATA','TEMP','TMP')){if(Test-Path ('Env:'+ $name)){$info.EnvironmentVariables[$name]=[Environment]::GetEnvironmentVariable($name)}}
  $process=[Diagnostics.Process]::new();$process.StartInfo=$info;$running=$process.Start();$done=$false
  if(-not $running){throw 'blocked'}
  $out=[EmrM03AcceptanceBoundedIo]::Text($process.StandardOutput,16384);$err=[EmrM03AcceptanceBoundedIo]::Text($process.StandardError,1024)
  $done=$process.WaitForExit(30000)
  if(-not $done -or -not [Threading.Tasks.Task]::WhenAll([Threading.Tasks.Task[]]@($out,$err)).Wait(5000) -or $err.Result.Length -ne 0){throw 'blocked'}
  $line=$out.Result.Trim()
  if($process.ExitCode -eq 0 -and $line.StartsWith('M03_FOUNDATION CHECK_ONLY_READY.',[StringComparison]::Ordinal)){return $true}
  if($AllowMissing -and $process.ExitCode -eq 2 -and $line.StartsWith('M03_FOUNDATION HANDOFF_MISSING.',[StringComparison]::Ordinal)){return $false}
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
  if(@(Compare-Object -CaseSensitive @('kind','nonce','action','workflowId'|Sort-Object) @($Value.PSObject.Properties.Name|Sort-Object)).Count -ne 0 -or $Value.nonce -cnotmatch '^[A-Za-z0-9_-]{1,80}$' -or $Value.action -cnotin @('details','start') -or -not $knownWorkflowIds.Contains($Value.workflowId)){throw 'blocked'}
  return $Value|ConvertTo-Json -Compress
 }
 # All other private protocol kinds require the finite CLI's safe projection.
 # Until that exact projection is installed/reviewed, refuse rather than echo.
 if($Value.kind -cnotin @('m03_acceptance_result','m03_acceptance_ready','m03_acceptance_closed')){throw 'blocked'}
 $allowed=@('kind','id','status','code','command','caseId','executionIds','phaseBReady','domainProofReady','businessAcceptanceProven','managementAttempts','controlAttempts','gatewayPreflightAttempts','providerDirectAttempts','nativeExecutions','startedActors','baselineRestored','environmentCleanupVerified','windowClosed','fixtureArchived','remoteWorkSettled','residual','childTransportsClosed','adminChildClosed','approvedHead','sourceCommitSha','deadlineAt')
 if(@($Value.PSObject.Properties.Name|Where-Object{$_ -cnotin $allowed}).Count -ne 0){throw 'blocked'}
 foreach($property in $Value.PSObject.Properties){
  $v=$property.Value
  if($property.Name -cin @('phaseBReady','domainProofReady','businessAcceptanceProven','baselineRestored','environmentCleanupVerified','windowClosed','fixtureArchived','remoteWorkSettled','residual','childTransportsClosed','adminChildClosed')){
   if($v -isnot [bool]){throw 'blocked'}
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
   if($property.Name -cin @('approvedHead','sourceCommitSha') -and $v -cne 'f42930f90c2de43c84f61ad6d966d0ee6074d70e'){throw 'blocked'}
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
 if($ResumeZeroSetup){$resumeDeadlineAt=Invoke-ZeroSetupPublicCheck $node $repo}
 $adminPublicReady=Invoke-PublicDatabaseCheck $repo ([bool]$CheckOnly) $resumeDeadlineAt
 $bindings=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText((Public-File (Join-Path $repo 'n8n/foundation/bindings.dev.json'))))
 foreach($property in $bindings.workflowRefs.PSObject.Properties){$null=$knownWorkflowIds.Add($property.Value.id)}
 if($knownWorkflowIds.Count -ne 25){throw 'blocked'}
 if($CheckOnly){
  [ordered]@{status='check_only_ready';privateRead=$false;networkRequests=0;publicCompositionLoaded=$true;adminPublicInputsVerified=$true;adminHandoffReady=$adminPublicReady;actualMcpPortVerified=$false;windowId=$seal.windowId;managementMaximum=512;controlMaximum=2048}|ConvertTo-Json -Compress
  exit 0
 }
 Confirm-PublicTransport
 $directory=[IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'Temp'))
 $null=Get-M03AcceptancePhysicalPath $directory
 $lockPath=Join-Path $directory 'emr-m03-acceptance-parent.operation.lock'
 $lock=[IO.File]::Open($lockPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
 if($ResumeZeroSetup){$resumeDeadlineAt=Invoke-ZeroSetupPublicCheck $node $repo}
 # Verify retained input provenance before consuming any new lease/ciphertext.
 $old=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText((Public-File (Join-Path $repo 'scripts/n8n/foundation-delivery-packet.json'))))
 $pending=Join-Path $env:LOCALAPPDATA 'Everyone-Market-Radar-Private\foundation\df4f29ec-e2dc-4d82-a276-62a4e695e6f9'
 $metadata=ConvertFrom-Json -InputObject (Read-LockedText (Join-Path $pending 'pending-runtime.json'))
 $machineKeys=@('version','windowId','purpose','audience','sourceCommitSha','credentialId','createdAt')
 if($metadata -isnot [PSCustomObject] -or @(Compare-Object -CaseSensitive @($machineKeys|Sort-Object) @($metadata.PSObject.Properties.Name|Sort-Object)).Count -ne 0 -or $metadata.version -isnot [int] -or $metadata.version -ne 1 -or $metadata.windowId -cne $seal.windowId -or $metadata.purpose -cne 'pending_inactive_m03_runtime_delivery' -or $metadata.credentialId -cne 'EmrM03Machine19' -or $metadata.audience -cne $old.audience -or $metadata.sourceCommitSha -cne $old.sourceCommitSha -or $metadata.createdAt -isnot [string] -or $metadata.createdAt -cnotmatch '^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3,7}(?:Z|\+00:00)$'){throw 'blocked'}
 if([DateTimeOffset]::Parse($metadata.createdAt,[Globalization.CultureInfo]::InvariantCulture) -gt [DateTimeOffset]::UtcNow){throw 'blocked'}
 $machinePath=Public-File (Join-Path $pending 'machine.dpapi')
 $private=@{};$handoffs=@{};$leases=@{};$minimumExpiry=[DateTimeOffset]::UtcNow.AddHours(2)
 foreach($kind in @('Management','Writer','ApifyRead')){
  $stem='emr-m03-acceptance-'+$kind.ToLowerInvariant()
  $handoff=Join-Path $directory ($stem+'.dpapi');$leasePath=Join-Path $directory ($stem+'.lease.json')
  $lease=ConvertFrom-Json -InputObject (Read-LockedText $leasePath)
  $keys=@('version','windowId','purpose','approvedHead','approvedPacketSha256','kind','createdAt','expiresAt')
  if(@(Compare-Object -CaseSensitive @($keys|Sort-Object) @($lease.PSObject.Properties.Name|Sort-Object)).Count -ne 0 -or $lease.version -ne 1 -or $lease.windowId -cne $seal.windowId -or $lease.approvedHead -cne $seal.approvedHead -or $lease.approvedPacketSha256 -cne $seal.approvedPacketSha256 -or $lease.kind -cne $kind -or $lease.purpose -cne ('m03_approved_dev_acceptance_'+$kind.ToLowerInvariant())){throw 'blocked'}
  $created=[DateTimeOffset]::Parse($lease.createdAt,[Globalization.CultureInfo]::InvariantCulture)
  $expiry=[DateTimeOffset]::Parse($lease.expiresAt,[Globalization.CultureInfo]::InvariantCulture)
  if($created -gt [DateTimeOffset]::UtcNow -or $expiry -ne $created.AddHours(2) -or $expiry -lt [DateTimeOffset]::UtcNow.AddMinutes(70)){throw 'blocked'}
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
 if($adminLease -isnot [PSCustomObject] -or @(Compare-Object -CaseSensitive @($adminKeys|Sort-Object) @($adminLease.PSObject.Properties.Name|Sort-Object)).Count -ne 0 -or $adminLease.version -isnot [int] -or $adminLease.version -ne 1 -or $adminLease.environment -cne 'dev' -or $adminLease.projectRef -cne 'zmotjsbzhzjvpelxvxlf' -or $adminLease.purpose -cne 'm03-foundation-phase-a-dev' -or $adminLease.approvalSha -cne $seal.approvedHead -or $adminLease.createdAt -isnot [string] -or $adminLease.expiresAt -isnot [string]){throw 'blocked'}
 $adminCreated=[DateTime]::ParseExact($adminLease.createdAt,'o',[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::RoundtripKind)
 $adminExpiry=[DateTime]::ParseExact($adminLease.expiresAt,'o',[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::RoundtripKind)
 $adminRequiredUntil=if($ResumeZeroSetup){[DateTimeOffset]::FromUnixTimeMilliseconds($resumeDeadlineAt).AddMinutes(15).UtcDateTime}else{[DateTime]::UtcNow.AddMinutes(75)}
 if($adminCreated.Kind -ne [DateTimeKind]::Utc -or $adminExpiry.Kind -ne [DateTimeKind]::Utc -or $adminCreated -gt [DateTime]::UtcNow.AddMinutes(1) -or $adminExpiry -ne $adminCreated.AddHours(2) -or $adminExpiry -le $adminRequiredUntil){throw 'blocked'}
 $bypassFile=Join-Path $directory 'emr-m03-acceptance-protection-bypass.dpapi'
 if(Test-Path -LiteralPath $bypassFile){throw 'blocked'}
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
 $packet=[ordered]@{kind='m03_acceptance_private_input';version=1;approvedHead=$seal.approvedHead;approvedPacketSha256=$seal.approvedPacketSha256;sourceCommitSha=$seal.approvedHead;managementKey=$private.Management;writerPassword=$private.Writer;apifyReadToken=$private.ApifyRead;machineToken=$machine;protectionBypass=$bypass;leaseExpiry=$minimumExpiry.ToUnixTimeMilliseconds()}
 $start=[Diagnostics.ProcessStartInfo]::new();$start.FileName=$node
 $sessionMode=if($ResumeZeroSetup){'SessionResumeZeroSetup'}else{'Session'}
 $start.Arguments='"'+$entry+'" '+$sessionMode;$start.WorkingDirectory=$repo
 $start.UseShellExecute=$false;$start.CreateNoWindow=$true
 $start.RedirectStandardInput=$true;$start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true
 $start.EnvironmentVariables.Clear()
 foreach($name in @('SystemRoot','WINDIR','PATH','USERPROFILE','LOCALAPPDATA','APPDATA','TEMP','TMP')){if(Test-Path ('Env:'+ $name)){$start.EnvironmentVariables[$name]=[Environment]::GetEnvironmentVariable($name)}}
 $child=[Diagnostics.Process]::new();$child.StartInfo=$start
 $started=$child.Start();if(-not $started){throw 'blocked'};$closed=$false
 $childDeadline=if($ResumeZeroSetup){[DateTimeOffset]::FromUnixTimeMilliseconds($resumeDeadlineAt).AddMinutes(10)}else{[DateTimeOffset]::UtcNow.AddMinutes(70)}
 $child.StandardInput.WriteLine(($packet|ConvertTo-Json -Depth 5 -Compress));$child.StandardInput.Flush()
 $packet=$null;$private=$null;$machine=$null;$bypass=$null
 $lineTask=[EmrM03AcceptanceBoundedIo]::Line($child.StandardOutput,65536);$errorBuffer=New-Object char[] 1024;$errorTask=$child.StandardError.ReadAsync($errorBuffer,0,1024);$inputTask=[EmrM03AcceptanceBoundedIo]::Line([Console]::In,262144)
 $until=if($ResumeZeroSetup){[DateTimeOffset]::FromUnixTimeMilliseconds($resumeDeadlineAt).AddMinutes(-10)}else{[DateTimeOffset]::UtcNow.AddMinutes(50)}
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
 $credentialChildrenClosed=(-not $started -or ($closed -and $script:credentialClosureVerified) -or $treeClosed)
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
 # Otherwise preserve the owned encrypted bypass for explicit residual follow-up.
 if(-not $closed -or -not $deleted -or ($started -and -not $script:closureVerified)){$exitCode=1}
}
$receipt|ConvertTo-Json -Compress
exit $exitCode
