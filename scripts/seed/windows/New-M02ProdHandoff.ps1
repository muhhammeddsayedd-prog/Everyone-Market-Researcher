param([ValidateSet('Database','Storage','All')][string]$Kind = 'All')
$ErrorActionPreference = 'Stop'
if ($args.Count -ne 0) { Write-Output 'M02 prod handoff creator rejected unsupported arguments. No private prompt or file operation performed.'; exit 1 }
$entries = @()
if ($Kind -in @('Database','All')) { $entries += @{ Name='emr-m02-prod-db-password.dpapi'; Prompt='EXISTING emr-prod database password (not dev or an application role)' } }
if ($Kind -in @('Storage','All')) { $entries += @{ Name='emr-m02-prod-storage-key.dpapi'; Prompt='emr-prod Supabase secret key (owner-run approved M02 logos only)' } }
try {
  $temporaryDirectory = Join-Path $env:LOCALAPPDATA 'Temp'
  $cursor = [IO.Path]::GetFullPath($temporaryDirectory)
  while ($null -ne $cursor) {
    $entry = Get-Item -LiteralPath $cursor -Force -ErrorAction Stop
    if (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Rejected handoff reparse path' }
    $parent = [IO.Directory]::GetParent($cursor)
    $cursor = if ($null -eq $parent) { $null } else { $parent.FullName }
  }
  foreach ($entry in $entries) {
    $file = Join-Path $temporaryDirectory $entry.Name
    if (Test-Path -LiteralPath $file) { throw 'Existing handoff preserved; consume or explicitly remove it first.' }
    $secret = Read-Host $entry.Prompt -AsSecureString
    try {
      if ($secret.Length -eq 0) { throw 'No credential entered; no handoff created.' }
      $ciphertext = $secret | ConvertFrom-SecureString
      $stream = $null; $writer = $null
      try {
        $stream = [IO.File]::Open($file, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
        $writer = New-Object IO.StreamWriter($stream, [Text.Encoding]::ASCII)
        $writer.Write($ciphertext)
        $writer.Flush()
        Write-Output ('M02 encrypted prod handoff saved: ' + $entry.Name + '. Authentication not tested.')
      } finally {
        if ($null -ne $writer) { $writer.Dispose() }
        elseif ($null -ne $stream) { $stream.Dispose() }
        $ciphertext = $null
      }
    } finally {
      if ($null -ne $secret) { $secret.Dispose() }
      $secret = $null
    }
  }
  Write-Output ('M02 encrypted prod handoffs saved: ' + $Kind + '. Close this PowerShell window. Keep your separately saved originals. Production approval remains separate.')
} catch {
  Write-Output 'M02 prod handoff creation stopped. Previously created encrypted handoffs were preserved. No credential contents are printed.'
  exit 1
}
