[CmdletBinding()]
param([switch]$PostcheckContinuation,[switch]$RemainingContinuation,[switch]$StartupReplacement)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$file = $null; $lease = $null
$secret = $null; $ciphertext = $null; $stream = $null; $bytes = $null
$created = $false; $leaseCreated = $false; $success = $false; $approvalRequired = $false
try {
  if(@($PostcheckContinuation,$RemainingContinuation,$StartupReplacement|Where-Object{$_}).Count -gt 1){throw 'blocked'}
  if($StartupReplacement){
    # Public approval verification must precede even private filename metadata.
    $repository=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
    $entry=Join-Path $repository 'scripts/n8n/foundation-live-startup-replacement.mjs'
    $cursor=Get-Item -LiteralPath $entry -Force -ErrorAction Stop
    if($cursor.PSIsContainer -or ($cursor.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'blocked'}
    $ancestor=$cursor.Directory
    while($null -ne $ancestor){if(($ancestor.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'blocked'};$ancestor=$ancestor.Parent}
    $publicProcess=$null;$publicInfo=$null;$publicStarted=$false;$publicClosed=$true
    try{
      $publicInfo=[Diagnostics.ProcessStartInfo]::new();$publicInfo.FileName=(Get-Command node.exe -CommandType Application -ErrorAction Stop).Source
      $publicInfo.Arguments='"'+$entry+'" CheckOnly';$publicInfo.WorkingDirectory=$repository
      $publicInfo.UseShellExecute=$false;$publicInfo.CreateNoWindow=$true;$publicInfo.RedirectStandardOutput=$true;$publicInfo.RedirectStandardError=$true;$publicInfo.EnvironmentVariables.Clear()
      foreach($name in @('SystemRoot','WINDIR','PATH','USERPROFILE','LOCALAPPDATA','APPDATA','TEMP','TMP')){if(Test-Path ('Env:'+ $name)){$publicInfo.EnvironmentVariables[$name]=[Environment]::GetEnvironmentVariable($name)}}
      $publicProcess=[Diagnostics.Process]::new();$publicProcess.StartInfo=$publicInfo;$publicStarted=$publicProcess.Start();$publicClosed=$false
      if(-not $publicStarted){throw 'blocked'}
      $publicOut=$publicProcess.StandardOutput.ReadToEndAsync();$publicErr=$publicProcess.StandardError.ReadToEndAsync()
      $publicClosed=$publicProcess.WaitForExit(10000)
      if(-not $publicClosed -or -not [Threading.Tasks.Task]::WhenAll([Threading.Tasks.Task[]]@($publicOut,$publicErr)).Wait(5000) -or $publicProcess.ExitCode -ne 0 -or $publicErr.Result.Length -ne 0 -or $publicOut.Result.Length -gt 4096){throw 'blocked'}
      $public=ConvertFrom-Json -InputObject $publicOut.Result -ErrorAction Stop
      $publicKeys=@('kind','segmentId','sourceCommitSha','windowId','privateRead','networkRequests')
      if($public.kind -ceq 'startup_replacement_approval_required'){$publicKeys+=@('status','approvalRequired');$approvalRequired=$true}
      if($public -isnot [PSCustomObject] -or @(Compare-Object -CaseSensitive @($publicKeys|Sort-Object) @($public.PSObject.Properties.Name|Sort-Object)).Count -ne 0 -or
         $public.segmentId -cne '1c69c89e-7807-46d5-b7b8-ca28285ff2b4' -or $public.sourceCommitSha -cne 'f42930f90c2de43c84f61ad6d966d0ee6074d70e' -or
         $public.windowId -cne 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9' -or $public.privateRead -isnot [bool] -or $public.privateRead -or $public.networkRequests -isnot [int] -or $public.networkRequests -ne 0){$approvalRequired=$false;throw 'blocked'}
      if($approvalRequired){if($public.status -cne 'approval_required' -or $public.approvalRequired -isnot [bool] -or $public.approvalRequired -ne $true){$approvalRequired=$false};throw 'blocked'}
      if($public.kind -cne 'startup_replacement_ready'){throw 'blocked'}
    }finally{
      if($null -ne $publicProcess){if($publicStarted -and -not $publicClosed){try{$publicProcess.Kill();$publicClosed=$publicProcess.WaitForExit(5000)}catch{}};$publicProcess.Dispose()}
      if($null -ne $publicInfo){$publicInfo.EnvironmentVariables.Clear()}
    }
  }
  $file = Join-Path $env:LOCALAPPDATA 'Temp\emr-m03-foundation-dev-migration-password.dpapi'
  $lease = Join-Path $env:LOCALAPPDATA 'Temp\emr-m03-foundation-dev-migration-password.lease.json'
  foreach ($directory in @($env:LOCALAPPDATA, (Join-Path $env:LOCALAPPDATA 'Temp'))) {
    $entry = Get-Item -LiteralPath $directory -Force -ErrorAction Stop
    if (-not $entry.PSIsContainer -or ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'blocked' }
    $ancestor=[IO.Directory]::GetParent($directory)
    while($null -ne $ancestor){$parent=Get-Item -LiteralPath $ancestor.FullName -Force -ErrorAction Stop;if(($parent.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'blocked'};$ancestor=$ancestor.Parent}
  }
  if ((Test-Path -LiteralPath $file) -or (Test-Path -LiteralPath $lease)) { throw 'blocked' }
  $secret = if($StartupReplacement){
    Read-Host 'EXISTING emr-dev postgres password for separately approved startup replacement: fourteen-version/catalog/global-vacancy readbacks, exact archived C999 reactivation, exact Preview binding and Close only; no migrations, advisor rerun or type regeneration' -AsSecureString
  }elseif($RemainingContinuation){
    Read-Host 'EXISTING emr-dev postgres password for separately approved remaining acceptance: fourteen-version/critical catalog readbacks, exact archived C999 reactivation, exact Preview binding and Close only; no migrations, advisor rerun or type regeneration' -AsSecureString
  }elseif($PostcheckContinuation){
    Read-Host 'EXISTING emr-dev postgres password for approved postcheck continuation: readbacks, owned C999 fixture and exact Preview binding only; no migration push' -AsSecureString
  }else{
    Read-Host 'EXISTING emr-dev postgres password for approved Phase A: four migrations, dev readbacks, owned C999 fixture and exact foundation Preview binding only' -AsSecureString
  }
  if ($secret.Length -eq 0) { throw 'blocked' }
  $ciphertext = ConvertFrom-SecureString -SecureString $secret -ErrorAction Stop
  $bytes = [Text.Encoding]::ASCII.GetBytes($ciphertext)
  $stream = [IO.File]::Open($file,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
  $created = $true
  $stream.Write($bytes,0,$bytes.Length); $stream.Flush($true); $stream.Dispose(); $stream = $null
  [Array]::Clear($bytes,0,$bytes.Length); $bytes = $null
  $now = [DateTime]::UtcNow
  $metadata = [ordered]@{version=1;environment='dev';projectRef='zmotjsbzhzjvpelxvxlf';purpose='m03-foundation-phase-a-dev';approvalSha='f42930f90c2de43c84f61ad6d966d0ee6074d70e';createdAt=$now.ToString('o');expiresAt=$now.AddHours(2).ToString('o')}
  $bytes = [Text.Encoding]::UTF8.GetBytes(($metadata | ConvertTo-Json -Compress))
  $stream = [IO.File]::Open($lease,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
  $leaseCreated = $true
  $stream.Write($bytes,0,$bytes.Length); $stream.Flush($true)
  $success = $true
} catch {
  # Hidden input, DPAPI contents and native errors never reach output.
} finally {
  if ($null -ne $stream) { $stream.Dispose() }
  if ($null -ne $bytes) { [Array]::Clear($bytes,0,$bytes.Length) }
  if ($null -ne $secret) { $secret.Dispose() }
  $secret = $null; $ciphertext = $null
  if (-not $success) {
    if ($created) { try { [IO.File]::Delete($file) } catch {} }
    if ($leaseCreated) { try { [IO.File]::Delete($lease) } catch {} }
  }
}
if($approvalRequired){Write-Output 'M03_FOUNDATION_MIGRATION_HANDOFF_APPROVAL_REQUIRED. Startup replacement has no owner time authority; no credential metadata, private contents or authentication read.';exit 3}
if (-not $success) { Write-Output 'M03_FOUNDATION_MIGRATION_HANDOFF_BLOCKED. Existing files preserved; no credential contents printed.'; exit 1 }
Write-Output 'M03_FOUNDATION_MIGRATION_ADMIN_READY. Two-hour encrypted approved Phase-A dev handoff saved; one bounded parent, maximum 70 minutes, no new action after minute 50. Authentication not tested. Close this PowerShell window and retain the existing password.'
exit 0
