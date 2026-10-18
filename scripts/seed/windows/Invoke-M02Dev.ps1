param(
  [ValidateSet('seed','probe','resolve','websites','logos','report','accept-dev')][string]$Action = 'accept-dev',
  [switch]$CheckOnly
)
$ErrorActionPreference = 'Stop'
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
$supplementalFiles = @('scripts/package.json','pnpm-lock.yaml','scripts/seed/dev-batch-packet.json',
  'data/competitors.csv','data/competitor_accounts.csv','reference/taxonomies.json',
  'scripts/seed/overrides.csv','assets/brand/everyone-logotype.svg','scripts/seed/certs/supabase-root-2021.crt','scripts/seed/certs/supabase-root-2021.json')

function Assert-ConfinedFile([string]$Relative) {
  if ([IO.Path]::IsPathRooted($Relative) -or $Relative -match '(?:^|/|\\)\.\.(?:/|\\|$)' -or
      ($Relative -notmatch '^(?:scripts/seed/[\w./-]+\.(?:ts|mjs|ps1)|scripts/seed/out/runner-seal\.json|packages/shared/src/[\w./-]+\.(?:ts|mjs|ps1))$' -and $Relative -notin $supplementalFiles)) {
    throw 'Rejected source path'
  }
  $absolute = [IO.Path]::GetFullPath((Join-Path $repo $Relative))
  if (-not $absolute.StartsWith($repo + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Rejected source boundary' }
  $cursor = $repo
  foreach ($segment in ($Relative -split '[/\\]')) {
    $cursor = Join-Path $cursor $segment
    $entry = Get-Item -LiteralPath $cursor -Force -ErrorAction Stop
    if (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Rejected reparse path' }
  }
  if (-not (Test-Path -LiteralPath $absolute -PathType Leaf)) { throw 'Source file missing' }
  return $absolute
}

function Get-SealedSourcePaths([string]$Directory) {
  foreach ($entry in (Get-ChildItem -LiteralPath $Directory -Force -ErrorAction Stop)) {
    if ($entry.Name -in @('out','node_modules')) { continue }
    if (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Rejected source reparse point' }
    if ($entry.PSIsContainer) { Get-SealedSourcePaths $entry.FullName }
    elseif ($entry.Name -notmatch '\.(?:test|integration)\.' -and $entry.Extension -in @('.ts','.mjs','.ps1')) {
      $entry.FullName.Substring($repo.Length + 1).Replace('\','/')
    }
  }
}

# Verify the prebuilt plain-Node artifact and the complete source inventory before
# reading any private file. No loader/compiler/install process receives credentials.
try {
  $repoEntry = Get-Item -LiteralPath $repo -Force -ErrorAction Stop
  if (($repoEntry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Rejected repository reparse point' }
  $sealPath = Assert-ConfinedFile 'scripts/seed/out/runner-seal.json'
  $runnerPath = Assert-ConfinedFile 'scripts/seed/out/runner.mjs'
  if ((Get-Item -LiteralPath $sealPath).Length -gt 2097152) { throw 'Invalid source seal' }
  $seal = Get-Content -LiteralPath $sealPath -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
  if ($seal.version -ne 1 -or $seal.runnerSha256 -notmatch '^[a-f0-9]{64}$' -or $seal.files -isnot [PSCustomObject]) { throw 'Invalid source seal' }
  if ((Get-FileHash -LiteralPath $runnerPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $seal.runnerSha256) { throw 'Runner seal mismatch' }
  $sealedNames = @($seal.files.PSObject.Properties.Name)
  if ($sealedNames.Count -lt 1 -or $sealedNames.Count -gt 2000) { throw 'Invalid source inventory' }
  foreach ($property in $seal.files.PSObject.Properties) {
    if ($property.Value -isnot [string] -or $property.Value -notmatch '^[a-f0-9]{64}$') { throw 'Invalid source hash' }
    $sourcePath = Assert-ConfinedFile $property.Name
    if ((Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $property.Value) { throw 'Source seal mismatch' }
  }
  $actualNames = @((Get-SealedSourcePaths (Join-Path $repo 'scripts/seed')); (Get-SealedSourcePaths (Join-Path $repo 'packages/shared/src')); $supplementalFiles)
  if (@(Compare-Object -ReferenceObject $sealedNames -DifferenceObject $actualNames).Count -ne 0) { throw 'Source inventory mismatch' }
  $packetPath = Assert-ConfinedFile 'scripts/seed/dev-batch-packet.json'
  $packet = Get-Content -LiteralPath $packetPath -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
  if ($packet.version -ne 1 -or $packet.target -ne 'zmotjsbzhzjvpelxvxlf' -or $packet.approved -isnot [bool]) { throw 'Invalid batch approval packet' }
} catch {
  Write-Output 'M02 runner/source seal verification failed. No decryption or authentication attempted. Rebuild in a credential-free process after reviewing the change.'
  exit 1
}
if ($Action -ne 'report' -and -not $packet.approved -and -not $CheckOnly) {
  Write-Output 'M02 dev batch approval pending. No decryption or authentication attempted.'
  exit 3
}

$needed = @{ PGPASSWORD='emr-m02-dev-db-password.dpapi' }
if ($Action -eq 'resolve') {
  # The reviewed post-batch continuation uses only YouTube. Do not load a stale
  # Vimeo or Storage handoff, and stop before decrypting DB if the key is absent.
  $needed.YOUTUBE_API_KEY='emr-m02-youtube-api-key.dpapi'
}
if ($Action -in @('probe','accept-dev')) {
  $providers = @{ VIMEO_TOKEN='emr-m02-vimeo-token.dpapi'; YOUTUBE_API_KEY='emr-m02-youtube-api-key.dpapi' }
  foreach ($name in $providers.Keys) {
    $providerFile = Join-Path $env:LOCALAPPDATA ('Temp\' + $providers[$name])
    $present = Test-Path -LiteralPath $providerFile -PathType Leaf
    Write-Output ('M02 optional provider handoff presence: ' + $providers[$name] + ' = ' + $present + '. Authentication not tested.')
    if ($present) { $needed[$name] = $providers[$name] }
  }
}
if ($Action -eq 'logos') { $needed.SUPABASE_SECRET_KEY='emr-m02-dev-storage-key.dpapi' }
if ($Action -eq 'accept-dev') {
  $storageFile = Join-Path $env:LOCALAPPDATA 'Temp\emr-m02-dev-storage-key.dpapi'
  $present = Test-Path -LiteralPath $storageFile -PathType Leaf
  Write-Output ('M02 optional storage handoff presence: emr-m02-dev-storage-key.dpapi = ' + $present + '. Authentication not tested.')
  if ($present) { $needed.SUPABASE_SECRET_KEY='emr-m02-dev-storage-key.dpapi' }
}
$files = @{}
foreach ($name in $needed.Keys) {
  $files[$name] = Join-Path $env:LOCALAPPDATA ('Temp\' + $needed[$name])
  if (-not (Test-Path -LiteralPath $files[$name] -PathType Leaf)) {
    Write-Output ('M02 required encrypted handoff missing: ' + $needed[$name] + '. No decryption or authentication attempted.')
    exit 2
  }
}
if ($CheckOnly) {
  if ($Action -ne 'report' -and -not $packet.approved) { Write-Output 'M02 dev batch approval pending; presence check only.' }
  Write-Output 'M02 runner/source seal and required handoff files verified; authentication not tested.'
  exit 0
}

# Public SSLRequest/TLS only, before any private handoff read. A missing or invalid
# scoped CA must not consume another credential handoff or reach database login.
$tlsStart = $null; $tlsChild = $null; $tlsMemory = $null
$tlsStarted = $false; $tlsExited = $false; $tlsVerified = $false
$tlsPhase = 'preflight_process'; $tlsCode = 'TLS_PREFLIGHT_FAILED'
try {
  $tlsNode = (Get-Command node.exe -CommandType Application -ErrorAction Stop).Source
  $tlsStart = New-Object Diagnostics.ProcessStartInfo
  $tlsStart.FileName = $tlsNode
  $tlsStart.WorkingDirectory = Join-Path $repo 'scripts'
  $tlsStart.Arguments = '"seed/check-tls.mjs"'
  $tlsStart.UseShellExecute = $false; $tlsStart.CreateNoWindow = $true
  $tlsStart.RedirectStandardOutput = $true; $tlsStart.RedirectStandardError = $true
  $tlsStart.EnvironmentVariables.Clear()
  foreach ($name in @('SystemRoot','WINDIR','PATH','TEMP','TMP','LOCALAPPDATA','APPDATA','USERPROFILE')) {
    $value = [Environment]::GetEnvironmentVariable($name, 'Process')
    if ($null -ne $value) { $tlsStart.EnvironmentVariables[$name] = $value }
  }
  $tlsChild = New-Object Diagnostics.Process
  $tlsChild.StartInfo = $tlsStart
  $tlsStarted = $tlsChild.Start()
  if (-not $tlsStarted) { throw 'TLS preflight start failed' }
  $tlsStart.EnvironmentVariables.Clear()
  $tlsBuffer = New-Object byte[] 4096
  $tlsMemory = [IO.MemoryStream]::new([byte[]]$tlsBuffer, $true)
  $tlsStdout = $tlsChild.StandardOutput.BaseStream.CopyToAsync($tlsMemory)
  $tlsStderr = $tlsChild.StandardError.BaseStream.CopyToAsync([IO.Stream]::Null)
  if (-not $tlsChild.WaitForExit(15000)) { throw 'TLS preflight timeout' }
  $tlsExited = $true
  $tlsDrained = [Threading.Tasks.Task]::WhenAll([Threading.Tasks.Task[]]@($tlsStdout,$tlsStderr))
  if (-not $tlsDrained.Wait(5000)) { throw 'TLS preflight drain timeout' }
  $tlsText = [Text.Encoding]::UTF8.GetString($tlsBuffer, 0, [int]$tlsMemory.Position)
  $tlsReceipt = $tlsText | ConvertFrom-Json -ErrorAction Stop
  if ($tlsReceipt.phase -in @('tcp_connect','ssl_request','tls_handshake','ca_load')) { $tlsPhase = $tlsReceipt.phase }
  if ($tlsReceipt.code -in @('TLS_VERIFIED','TLS_UNAUTHORIZED','TLS_ERROR','TLS_CLEANUP_INCOMPLETE','NETWORK_ERROR','TIMEOUT','CONNECTION_CLOSED','SSL_NOT_SUPPORTED','SSL_RESPONSE_REJECTED','PUBLIC_CA_UNAVAILABLE_OR_INVALID','SELF_SIGNED_CERT_IN_CHAIN','DEPTH_ZERO_SELF_SIGNED_CERT','UNABLE_TO_VERIFY_LEAF_SIGNATURE','UNABLE_TO_GET_ISSUER_CERT','UNABLE_TO_GET_ISSUER_CERT_LOCALLY','CERT_HAS_EXPIRED','CERT_NOT_YET_VALID','ERR_TLS_CERT_ALTNAME_INVALID','ECONNRESET','ECONNREFUSED','ENOTFOUND','EAI_AGAIN','EHOSTUNREACH','ENETUNREACH','ETIMEDOUT')) { $tlsCode = $tlsReceipt.code }
  $tlsVerified = $tlsChild.ExitCode -eq 0 -and $tlsReceipt.status -eq 'verified' -and
    $tlsReceipt.phase -eq 'tls_handshake' -and $tlsReceipt.code -eq 'TLS_VERIFIED' -and
    $tlsReceipt.environment -eq 'dev' -and $tlsReceipt.projectRef -eq 'zmotjsbzhzjvpelxvxlf' -and
    $tlsReceipt.host -eq 'aws-1-eu-central-1.pooler.supabase.com' -and $tlsReceipt.port -eq 5432 -and
    $tlsReceipt.rejectUnauthorized -eq $true -and $tlsReceipt.exactServerName -eq $true -and
    $tlsReceipt.scopedCaVerified -eq $true -and
    $tlsReceipt.startupMessageSent -eq $false -and $tlsReceipt.authenticationAttempted -eq $false -and
    $tlsReceipt.socketsClosed -eq $true
} catch { $tlsVerified = $false } finally {
  if ($null -ne $tlsChild) {
    if ($tlsStarted -and -not $tlsExited) {
      try {
        if (-not $tlsChild.WaitForExit(0)) { $tlsChild.Kill() }
        $tlsExited = $tlsChild.WaitForExit(5000)
      } catch { $tlsExited = $false }
    }
    try { $tlsChild.Dispose() } catch { $tlsVerified = $false }
  }
  if ($null -ne $tlsStart) { $tlsStart.EnvironmentVariables.Clear() }
  if ($null -ne $tlsMemory) { $tlsMemory.Dispose() }
  $tlsBuffer = $null; $tlsText = $null; $tlsReceipt = $null
  $tlsStdout = $null; $tlsStderr = $null; $tlsDrained = $null; $tlsStart = $null; $tlsChild = $null
}
Write-Output ('M02 public TLS preflight: ' + $tlsPhase + ' / ' + $tlsCode + '. Database authentication not attempted by this preflight.')
if (-not $tlsVerified -or ($tlsStarted -and -not $tlsExited)) {
  Write-Output 'M02 public TLS preflight did not pass. No decryption or database authentication attempted; all handoffs preserved.'
  exit 4
}

$child = $null; $start = $null
$childStarted = $false; $childExitConfirmed = $false
$stdout = $null; $stderr = $null
$consumed = @(); $exitCode = 1
try {
  $node = (Get-Command node.exe -CommandType Application -ErrorAction Stop).Source
  $start = New-Object System.Diagnostics.ProcessStartInfo
  $start.FileName = $node
  $start.WorkingDirectory = Join-Path $repo 'scripts'
  $apply = if ($Action -in @('seed','resolve','websites','logos','accept-dev')) { ' --apply' } else { '' }
  $start.Arguments = '"seed/out/runner.mjs" ' + $Action + ' --target dev' + $apply
  $start.UseShellExecute = $false; $start.CreateNoWindow = $true
  $start.RedirectStandardOutput = $true; $start.RedirectStandardError = $true
  $start.EnvironmentVariables.Clear()
  foreach ($name in @('SystemRoot','WINDIR','PATH','TEMP','TMP','LOCALAPPDATA','APPDATA','USERPROFILE')) {
    $value = [Environment]::GetEnvironmentVariable($name, 'Process')
    if ($null -ne $value) { $start.EnvironmentVariables[$name] = $value }
  }
  $start.EnvironmentVariables['SEED_DATABASE_URL']='postgresql://postgres.zmotjsbzhzjvpelxvxlf@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require'
  $start.EnvironmentVariables['SUPABASE_URL']='https://zmotjsbzhzjvpelxvxlf.supabase.co'
  foreach ($name in $needed.Keys) {
    $secure = $null; $pointer = [IntPtr]::Zero; $encrypted = $null
    try {
      $encrypted = (Get-Content -LiteralPath $files[$name] -Raw -ErrorAction Stop).Trim()
      $secure = ConvertTo-SecureString -String $encrypted -ErrorAction Stop
      $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
      $start.EnvironmentVariables[$name] = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
      $consumed += $files[$name]
    } finally {
      if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
      if ($null -ne $secure) { $secure.Dispose() }
      $secure = $null; $encrypted = $null
    }
  }
  $child = New-Object System.Diagnostics.Process
  $child.StartInfo = $start
  $childStarted = $child.Start()
  if (-not $childStarted) { throw 'Child start failed' }
  $start.EnvironmentVariables.Clear()
  # Discard raw output in constant memory; the CLI alone writes the sanitized receipt.
  $stdout = $child.StandardOutput.BaseStream.CopyToAsync([IO.Stream]::Null)
  $stderr = $child.StandardError.BaseStream.CopyToAsync([IO.Stream]::Null)
  $deadline = [DateTime]::UtcNow.AddMinutes(45)
  $nextProgress = [DateTime]::UtcNow.AddSeconds(30)
  while (-not $child.WaitForExit(1000)) {
    if ([DateTime]::UtcNow -ge $deadline) { throw 'Bounded child timeout' }
    if ([DateTime]::UtcNow -ge $nextProgress) {
      Write-Output 'M02 bounded dev child is running; private output remains withheld.'
      $nextProgress = [DateTime]::UtcNow.AddSeconds(30)
    }
  }
  $childExitConfirmed = $true
  $drained = [Threading.Tasks.Task]::WhenAll([Threading.Tasks.Task[]]@($stdout,$stderr))
  if (-not $drained.Wait(5000)) { throw 'Bounded pipe drain timeout' }
  $exitCode = $child.ExitCode
  Write-Output ('M02 dev child native exit: ' + $exitCode + '. Read scripts/seed/out/dev-latest.json for the sanitized receipt.')
} catch {
  Write-Output 'M02 dev runner stopped; raw error withheld. Inspect only the sanitized receipt. Reconcile actual state before any retry.'
  $exitCode = 1
} finally {
  if ($null -ne $child) {
    if ($childStarted -and -not $childExitConfirmed) {
      try {
        if (-not $child.WaitForExit(0)) { $child.Kill() }
        $childExitConfirmed = $child.WaitForExit(5000)
      } catch { $childExitConfirmed = $false }
    }
    try { $child.Dispose() } catch { $exitCode = 1 }
  }
  if ($null -ne $start) {
    try { $start.EnvironmentVariables.Clear() } catch { $exitCode = 1 }
  }
  $stdout = $null; $stderr = $null; $drained = $null; $start = $null; $child = $null
  foreach ($file in $consumed) {
    try { Remove-Item -LiteralPath $file -ErrorAction Stop }
    catch { Write-Output 'M02 consumed encrypted handoff cleanup incomplete; exact remaining filenames must be checked.'; $exitCode = 1 }
  }
  if ($childStarted -and -not $childExitConfirmed) {
    Write-Output 'M02 credential child exit NOT confirmed; stop and inspect the owned process before any retry.'
    $exitCode = 1
  } else {
    Write-Output 'M02 credential child closed or never started. Consumed temporary handoffs removed unless cleanup was reported incomplete. Owner-saved originals are retained.'
  }
}
exit $exitCode
