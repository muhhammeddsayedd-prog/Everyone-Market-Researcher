param([ValidateSet('Database','Providers','Vimeo','YouTube','Storage','All')][string]$Kind = 'All')
$ErrorActionPreference = 'Stop'
$entries = @()
if ($Kind -in @('Database','All')) { $entries += @{ Name='emr-m02-dev-db-password.dpapi'; Prompt='EXISTING emr-dev database password (not prod or an application role)' } }
if ($Kind -in @('Vimeo','Providers','All')) {
  $entries += @{ Name='emr-m02-vimeo-token.dpapi'; Prompt='Vimeo API token with PUBLIC scope only' }
}
if ($Kind -in @('YouTube','Providers','All')) {
  $entries += @{ Name='emr-m02-youtube-api-key.dpapi'; Prompt='YouTube Data API v3 restricted API key' }
}
if ($Kind -in @('Storage','All')) { $entries += @{ Name='emr-m02-dev-storage-key.dpapi'; Prompt='emr-dev Supabase secret key (owner-run logos only)' } }
try {
  foreach ($entry in $entries) {
    $file = Join-Path $env:LOCALAPPDATA ('Temp\' + $entry.Name)
    if (Test-Path -LiteralPath $file) { throw 'Existing handoff preserved; consume or explicitly remove it first.' }
    $secret = Read-Host $entry.Prompt -AsSecureString
    try {
      if ($secret.Length -eq 0) { throw 'No credential entered; no handoff created.' }
      $ciphertext = $secret | ConvertFrom-SecureString
      $stream = $null
      $writer = $null
      try {
        # CreateNew closes the existence-check/write race without replacing another handoff.
        $stream = [IO.File]::Open($file, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
        $writer = New-Object IO.StreamWriter($stream, [Text.Encoding]::ASCII)
        $writer.Write($ciphertext)
        $writer.Flush()
        Write-Output ('M02 encrypted handoff saved: ' + $entry.Name + '. Authentication not tested.')
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
  Write-Output ('M02 encrypted dev handoffs saved: ' + $Kind + '. Close this PowerShell window. Keep your separately saved originals.')
} catch {
  Write-Output 'M02 handoff creation stopped. Any previously created encrypted handoffs were preserved. No credential contents are printed.'
  exit 1
}
