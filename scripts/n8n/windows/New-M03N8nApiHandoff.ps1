[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$secret = $null; $stream = $null; $ciphertext = $null; $created = $false; $success = $false
try {
  if ([string]::IsNullOrEmpty($env:LOCALAPPDATA)) { throw 'blocked' }
  foreach ($directory in @($env:LOCALAPPDATA,(Join-Path $env:LOCALAPPDATA 'Temp'))) {
    $entry = Get-Item -LiteralPath $directory -Force -ErrorAction Stop
    if (-not $entry.PSIsContainer -or ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'blocked' }
  }
  $file = Join-Path $env:LOCALAPPDATA 'Temp\emr-m03-n8n-api-key.dpapi'
  if (Test-Path -LiteralPath $file) { throw 'blocked' }
  $secret = Read-Host 'n8n API key for the verified muhhammedsayed instance' -AsSecureString
  if ($secret.Length -eq 0) { throw 'blocked' }
  $ciphertext = ConvertFrom-SecureString -SecureString $secret -ErrorAction Stop
  $stream = [IO.File]::Open($file,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
  $created = $true
  $bytes = [Text.Encoding]::ASCII.GetBytes($ciphertext)
  $stream.Write($bytes,0,$bytes.Length); $stream.Flush($true)
  $success = $true
} catch {
  # Hidden key, DPAPI contents and raw exceptions are never printed.
} finally {
  if ($null -ne $stream) { $stream.Dispose() }
  if ($null -ne $secret) { $secret.Dispose() }
  $secret = $null; $ciphertext = $null
  if ($created -and -not $success) { try { [IO.File]::Delete($file) } catch { } }
}
if (-not $success) { Write-Output 'M03 n8n handoff not created; existing files preserved and no key contents printed.'; exit 1 }
Write-Output 'M03 n8n encrypted handoff saved. Authentication not tested. Close this PowerShell window; keep your separately saved key.'
exit 0
