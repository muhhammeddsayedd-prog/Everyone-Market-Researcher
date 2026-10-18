[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$file = Join-Path $env:LOCALAPPDATA 'Temp\emr-m03-dev-migration-password.dpapi'
$secret = $null
$ciphertext = $null
$stream = $null
$created = $false
$success = $false
try {
  foreach ($directory in @($env:LOCALAPPDATA, (Join-Path $env:LOCALAPPDATA 'Temp'))) {
    $entry = Get-Item -LiteralPath $directory -Force -ErrorAction Stop
    if (-not $entry.PSIsContainer -or ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'blocked' }
  }
  if (Test-Path -LiteralPath $file) { throw 'blocked' }
  $secret = Read-Host 'EXISTING emr-dev database password (not prod or an application role)' -AsSecureString
  if ($secret.Length -eq 0) { throw 'blocked' }
  $ciphertext = ConvertFrom-SecureString -SecureString $secret -ErrorAction Stop
  $stream = [IO.File]::Open($file, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
  $created = $true
  $bytes = [Text.Encoding]::ASCII.GetBytes($ciphertext)
  $stream.Write($bytes, 0, $bytes.Length)
  $stream.Flush($true)
  $success = $true
} catch {
  # Never echo the hidden input, ciphertext or a credential-bearing error.
} finally {
  if ($null -ne $stream) { $stream.Dispose() }
  if ($null -ne $secret) { $secret.Dispose() }
  $secret = $null
  $ciphertext = $null
  if ($created -and -not $success) {
    try { [IO.File]::Delete($file) } catch { }
  }
}
if (-not $success) {
  Write-Output 'M03 dev migration handoff not created. Existing handoffs were preserved; no credential contents are printed.'
  exit 1
}
Write-Output 'M03 dev migration encrypted handoff saved. Authentication not tested. Close this PowerShell window; keep your separately saved password.'
exit 0
