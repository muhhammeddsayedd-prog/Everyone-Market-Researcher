[CmdletBinding()]
param(
 [Parameter(Mandatory=$true)][ValidateSet('Inventory','ProviderMetadata','Setup','Stage','Observe','Probe','Restore')][string]$Task,
 [ValidatePattern('\A[a-z][a-z0-9-]{0,40}\z')][string]$Phase='default',
 [switch]$CheckOnly
)
# One bounded product adapter. Persistent originals are read only; no Admin,
# credential generation, secret environment variables, or delivery leases.
$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Set-StrictMode -Version Latest
$exitCode=1;$stage='phase';$process=$null;$operationLock=$null;$privateInput=$null;$inputJson=$null;$outputJson=$null
$inputBytes=$null;$stateBytes=$null;$stateCipher=$null;$stdoutBytes=$null;$stderrBytes=$null
$stdoutStream=$null;$stderrStream=$null;$stdoutCopy=$null;$stderrCopy=$null;$selected=@{}
try {
 $allowedPhases=switch -CaseSensitive ($Task) {
  'Inventory' {@('default')}
  'ProviderMetadata' {@('default')}
  'Setup' {@('project','prepare','configure','poll','cleanup')}
  'Stage' {@('stage','publish','machine','readback')}
  'Observe' {@('default')}
  'Probe' {@('default','replay','unknown')}
  'Restore' {@('native')}
 }
 if($Phase -cnotin @($allowedPhases)){throw 'M04_TASK_PHASE_BLOCKED'}
 $stage='public_files'
 $repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
 $runner=Join-Path $repo 'scripts\n8n\m04-dev-task.mjs'
 $helper=Join-Path $PSScriptRoot 'Dev-CredentialStore.ps1'
 foreach($file in @($runner,$helper)) {if(-not [IO.File]::Exists($file)){throw 'M04_PUBLIC_FILES_MISSING'}}
 $parseTokens=$null;$parseErrors=$null
 $null=[Management.Automation.Language.Parser]::ParseFile($helper,[ref]$parseTokens,[ref]$parseErrors)
 if($parseErrors.Count -ne 0){throw 'M04_PUBLIC_SYNTAX_BLOCKED'}
 . $helper
 $null=Assert-M03DevPlainPath $runner $false;$null=Assert-M03DevPlainPath $helper $false
 $node=(Get-Command node.exe -CommandType Application -ErrorAction Stop).Source
 $null=Assert-M03DevPlainPath $node $false
 if($CheckOnly) {
  [ordered]@{status='check_only_ready';task=$Task;phase=$Phase;privateRead=$false;networkRequests=0}|ConvertTo-Json -Compress
  $exitCode=0
 } else {
  $kinds=switch -CaseSensitive ($Task) {
   'Inventory' {@('Management')}
   'ProviderMetadata' {@('ApifyRead')}
   'Setup' {if($Phase -ceq 'configure'){@('Writer','ApifyRead','Machine')}elseif($Phase -cin @('project','prepare','poll','cleanup')){@()}else{throw 'M04_TASK_PHASE_BLOCKED'}}
   'Stage' {if($Phase -ceq 'machine'){@('Management','Machine')}else{@('Management')}}
   'Observe' {@('Management')}
   'Probe' {@('Machine')}
   'Restore' {@('Management','Machine')}
  }
  $stage='private_acl'
  if([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)){throw 'M04_PRIVATE_PATH_BLOCKED'}
  $privateRoot=Join-Path $env:LOCALAPPDATA 'Everyone-Market-Radar-Private'
  $null=Assert-M03DevPlainPath $privateRoot $true
  $directory=Join-Path $privateRoot 'm04'
  if(-not (Test-Path -LiteralPath $directory)) {
   $null=[IO.Directory]::CreateDirectory($directory);Set-M03DevPrivateAcl $directory $true
  }
  Assert-M03DevPrivateAcl $directory $true
  $lockPath=Join-Path $directory 'operation.lock'
  if(Test-Path -LiteralPath $lockPath){Assert-M03DevPrivateAcl $lockPath $false}
  $operationLock=[IO.File]::Open($lockPath,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
  Set-M03DevPrivateAcl $lockPath $false
  Add-Type -AssemblyName System.Security
  $statePath=Join-Path $directory 'state.dpapi';$state=[pscustomobject]@{};$stage='state_decrypt'
  if(Test-Path -LiteralPath $statePath) {
   Assert-M03DevPrivateAcl $statePath $false
   $entry=Get-Item -LiteralPath $statePath -Force
   if($entry.Length -lt 20 -or $entry.Length -gt 8388608){throw 'M04_STATE_BLOCKED'}
   $stateCipher=[IO.File]::ReadAllBytes($statePath)
   $stateBytes=[Security.Cryptography.ProtectedData]::Unprotect($stateCipher,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
   if($stateBytes.Length -gt 4194304){throw 'M04_STATE_BLOCKED'}
   $stateText=[Text.UTF8Encoding]::new($false,$true).GetString($stateBytes)
   try{$state=ConvertFrom-Json -InputObject $stateText -ErrorAction Stop}finally{$stateText=$null}
   if($null -eq $state -or $state -isnot [pscustomobject]){throw 'M04_STATE_BLOCKED'}
   [Array]::Clear($stateBytes,0,$stateBytes.Length);$stateBytes=$null
   [Array]::Clear($stateCipher,0,$stateCipher.Length);$stateCipher=$null
  }
  foreach($kind in $kinds) {
   $stage='private_acl'
   if($kind -ceq 'Machine') {
    $source=Join-Path $privateRoot 'foundation\df4f29ec-e2dc-4d82-a276-62a4e695e6f9\machine.dpapi'
   } else {
    $credentialRoot=Get-M03DevCredentialRoot;Assert-M03DevPrivateAcl $credentialRoot $true
    $source=(Get-M03DevCredentialSpec -Kind $kind).Source
   }
   Assert-M03DevPrivateAcl ([IO.Path]::GetDirectoryName($source)) $true
   Assert-M03DevPrivateAcl $source $false
   $cipherBytes=$null;$secure=$null;$pointer=[IntPtr]::Zero
   try {
    $stage='credential_decrypt'
    $entry=Get-Item -LiteralPath $source -Force
    if($entry.Length -gt 65536){throw 'M04_CREDENTIAL_BLOCKED'}
    $cipherBytes=[IO.File]::ReadAllBytes($source);Assert-M03DevCipherFraming $cipherBytes
    $secure=ConvertTo-SecureString -String ([Text.Encoding]::ASCII.GetString($cipherBytes)) -ErrorAction Stop
    $pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $plain=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    if([string]::IsNullOrEmpty($plain)){throw 'M04_CREDENTIAL_BLOCKED'}
    $property=if($kind -ceq 'ApifyRead'){'apifyRead'}else{$kind.ToLowerInvariant()}
    $selected[$property]=$plain;$plain=$null
   } finally {
    if($pointer -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)}
    if($null -ne $secure){$secure.Dispose()}
    if($null -ne $cipherBytes){[Array]::Clear($cipherBytes,0,$cipherBytes.Length)}
   }
  }
  $privateInput=[ordered]@{task=$Task;phase=$Phase;secrets=$selected;state=$state}
  $inputJson=ConvertTo-Json -InputObject $privateInput -Depth 100 -Compress
  $inputBytes=[Text.UTF8Encoding]::new($false).GetBytes($inputJson)
  if($inputBytes.Length -gt 6291456){throw 'M04_INPUT_BLOCKED'}
  $info=[Diagnostics.ProcessStartInfo]::new();$info.FileName=$node
  $info.Arguments='"'+$runner+'"';$info.WorkingDirectory=$repo
  $info.UseShellExecute=$false;$info.CreateNoWindow=$true
  $info.RedirectStandardInput=$true;$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true
  $info.EnvironmentVariables.Clear()
  foreach($name in @('SystemRoot','WINDIR','PATH','TEMP','TMP','LOCALAPPDATA','APPDATA','USERPROFILE')) {
   $value=[Environment]::GetEnvironmentVariable($name,'Process')
   if(-not [string]::IsNullOrEmpty($value)){$info.EnvironmentVariables[$name]=$value}
  }
  $stdoutBytes=[byte[]]::new(8388608);$stderrBytes=[byte[]]::new(65536)
  $stdoutStream=[IO.MemoryStream]::new($stdoutBytes,0,$stdoutBytes.Length,$true,$true);$stdoutStream.SetLength(0)
  $stderrStream=[IO.MemoryStream]::new($stderrBytes,0,$stderrBytes.Length,$true,$true);$stderrStream.SetLength(0)
  $process=[Diagnostics.Process]::new();$process.StartInfo=$info
  $stage='child_start'
  if(-not $process.Start()){throw 'M04_CHILD_BLOCKED'}
  $stage='child_contract'
  $stdoutCopy=$process.StandardOutput.BaseStream.CopyToAsync($stdoutStream)
  $stderrCopy=$process.StandardError.BaseStream.CopyToAsync($stderrStream)
  # Write asynchronously so a child that stops consuming stdin cannot hang the
  # credential-bearing parent outside the same physical shutdown deadline.
  $write=$process.StandardInput.BaseStream.WriteAsync($inputBytes,0,$inputBytes.Length)
  $clock=[Diagnostics.Stopwatch]::StartNew()
  if(-not $write.Wait(10000)){throw 'M04_CHILD_INPUT_BLOCKED'}
  $process.StandardInput.Close()
  $remaining=[Math]::Max(1,120000-[int]$clock.ElapsedMilliseconds)
  if(-not $process.WaitForExit($remaining)){throw 'M04_CHILD_TIMEOUT'}
  if(-not $stdoutCopy.Wait(5000) -or -not $stderrCopy.Wait(5000) -or $stdoutCopy.IsFaulted -or $stderrCopy.IsFaulted){throw 'M04_CHILD_OUTPUT_BLOCKED'}
  if($process.ExitCode -ne 0 -or $stderrStream.Length -ne 0){throw 'M04_CHILD_FAILED'}
  $outputJson=[Text.UTF8Encoding]::new($false,$true).GetString($stdoutBytes,0,[int]$stdoutStream.Length)
  $answer=ConvertFrom-Json -InputObject $outputJson -ErrorAction Stop
  if($null -eq $answer -or $answer -isnot [pscustomobject]){throw 'M04_CHILD_OUTPUT_BLOCKED'}
  $keys=@($answer.PSObject.Properties.Name)
  if($keys -cnotcontains 'public' -or @($keys|Where-Object{$_ -cnotin @('public','private')}).Count -ne 0){throw 'M04_CHILD_OUTPUT_BLOCKED'}
  if($null -eq $answer.public -or $answer.public -isnot [pscustomobject] -or $answer.public.status -cnotin @('completed','blocked')){throw 'M04_CHILD_OUTPUT_BLOCKED'}
  $publicJson=ConvertTo-Json -InputObject $answer.public -Depth 100 -Compress
  foreach($secret in $selected.Values){
   $escaped=ConvertTo-Json -InputObject $secret -Compress
   if($publicJson.Contains($secret) -or $publicJson.Contains($escaped.Substring(1,$escaped.Length-2))){throw 'M04_PUBLIC_PROJECTION_BLOCKED'}
   $escaped=$null
  }
  if($keys -ccontains 'private') {
   if($null -eq $answer.private -or $answer.private -isnot [pscustomobject]){throw 'M04_CHILD_OUTPUT_BLOCKED'}
   $stateText=ConvertTo-Json -InputObject $answer.private -Depth 100 -Compress
   try{$stateBytes=[Text.UTF8Encoding]::new($false).GetBytes($stateText)}finally{$stateText=$null}
   if($stateBytes.Length -gt 4194304){throw 'M04_STATE_BLOCKED'}
   $stateCipher=[Security.Cryptography.ProtectedData]::Protect($stateBytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
   $stage='state_write'
   Write-M03DevPrivateFile -Path $statePath -Bytes $stateCipher -Replace:([IO.File]::Exists($statePath))
  }
  Write-Output $publicJson
  $exitCode=if($answer.public.status -ceq 'blocked'){1}else{0}
 }
} catch {
 # Native errors and child stderr may contain credentials. Only a fixed code
 # leaves this process; previous private state remains intact on invalid output.
 [ordered]@{status='blocked';code='M04_BOUNDED_TASK_BLOCKED';stage=$stage}|ConvertTo-Json -Compress
 $exitCode=1
} finally {
 if($null -ne $process) {
  try {
   if(-not $process.HasExited) {
    # The fixed Node task can own a native Vercel child. Terminate that owned
    # process tree before the parent, so its narrowly scoped input cannot linger.
    $killer=$null
    try {
     $killInfo=[Diagnostics.ProcessStartInfo]::new()
     $killInfo.FileName=Join-Path $env:SystemRoot 'System32\taskkill.exe'
     $killInfo.Arguments='/T /F /PID '+$process.Id
     $killInfo.UseShellExecute=$false;$killInfo.CreateNoWindow=$true
     $killInfo.RedirectStandardOutput=$true;$killInfo.RedirectStandardError=$true
     $killInfo.EnvironmentVariables.Clear()
     $killInfo.EnvironmentVariables['SystemRoot']=$env:SystemRoot
     $killer=[Diagnostics.Process]::new();$killer.StartInfo=$killInfo
     if($killer.Start() -and -not $killer.WaitForExit(5000)){$killer.Kill();$null=$killer.WaitForExit(1000)}
    } finally {if($null -ne $killer){$killer.Dispose()}}
    if(-not $process.WaitForExit(1000)){$process.Kill();$null=$process.WaitForExit(5000)}
   }
  } catch {try{if(-not $process.HasExited){$process.Kill();$null=$process.WaitForExit(5000)}}catch{}}
  $process.Dispose()
 }
 foreach($stream in @($stdoutStream,$stderrStream)){if($null -ne $stream){$stream.Dispose()}}
 foreach($bytes in @($inputBytes,$stateBytes,$stateCipher,$stdoutBytes,$stderrBytes)){if($null -ne $bytes){[Array]::Clear($bytes,0,$bytes.Length)}}
 $privateInput=$null;$inputJson=$null;$outputJson=$null;$selected.Clear();$state=$null;$answer=$null;$publicJson=$null
 if($null -ne $operationLock){$operationLock.Dispose()}
}
exit $exitCode
