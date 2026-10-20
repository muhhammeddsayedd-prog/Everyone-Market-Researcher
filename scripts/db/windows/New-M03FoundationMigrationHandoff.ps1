[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$file = Join-Path $env:LOCALAPPDATA 'Temp\emr-m03-foundation-dev-migration-password.dpapi'
$lease = Join-Path $env:LOCALAPPDATA 'Temp\emr-m03-foundation-dev-migration-password.lease.json'
$secret = $null; $ciphertext = $null; $stream = $null; $bytes = $null
$created = $false; $leaseCreated = $false; $success = $false
try {
  foreach ($directory in @($env:LOCALAPPDATA, (Join-Path $env:LOCALAPPDATA 'Temp'))) {
    $entry = Get-Item -LiteralPath $directory -Force -ErrorAction Stop
    if (-not $entry.PSIsContainer -or ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'blocked' }
    $ancestor=[IO.Directory]::GetParent($directory)
    while($null -ne $ancestor){$parent=Get-Item -LiteralPath $ancestor.FullName -Force -ErrorAction Stop;if(($parent.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'blocked'};$ancestor=$ancestor.Parent}
  }
  if ((Test-Path -LiteralPath $file) -or (Test-Path -LiteralPath $lease)) { throw 'blocked' }
  $secret = Read-Host 'EXISTING emr-dev postgres password for approved Phase A: four migrations, dev readbacks, owned C999 fixture and exact foundation Preview binding only' -AsSecureString
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
if (-not $success) { Write-Output 'M03_FOUNDATION_MIGRATION_HANDOFF_BLOCKED. Existing files preserved; no credential contents printed.'; exit 1 }
Write-Output 'M03_FOUNDATION_MIGRATION_ADMIN_READY. Two-hour encrypted approved Phase-A dev handoff saved; one bounded parent, maximum 70 minutes, no new action after minute 50. Authentication not tested. Close this PowerShell window and retain the existing password.'
exit 0
