[CmdletBinding()]
param([switch]$CheckOnly)

# One bounded C142 request admitted only while the original approved run is active.
# The original Invoke-M02Dev parent remains the sole handoff deletion owner.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$originalParentPid = 7492
$originalParentStart = '2026-10-18T01:12:05.0241632Z'
$runId = 'e6a7e79c-4d48-45ef-9139-cd83db362f43'
$sourceHash = '135e6b24c632bb931b54025a09941963b777ada87ba25c58306a430756d32f66'
$projectRef = 'zmotjsbzhzjvpelxvxlf'
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
$out = Join-Path $repo 'scripts\seed\out'
$handoff = Join-Path $env:LOCALAPPDATA 'Temp\emr-m02-youtube-api-key.dpapi'
$attemptPath = Join-Path $out 'youtube-diagnostic-attempt.json'
$exitCode = 1
$status = 'blocked'
$code = 'DIAGNOSTIC_PREFLIGHT_BLOCKED'
$safeDiagnostic = $null
$secure = $null
$bstr = [IntPtr]::Zero
$key = $null
$child = $null
$started = $false
$childClosed = $true
$start = $null
$stdout = $null
$stdoutTask = $null
$stderrTask = $null
$nativeExit = $null
$buffer = $null

function Assert-Leaf([string]$Path, [string]$Root) {
  $absolute = [IO.Path]::GetFullPath($Path)
  $boundary = [IO.Path]::GetFullPath($Root).TrimEnd('\') + '\'
  if (-not $absolute.StartsWith($boundary, [StringComparison]::OrdinalIgnoreCase)) { throw 'blocked' }
  $item = Get-Item -LiteralPath $absolute -Force -ErrorAction Stop
  if ($item.PSIsContainer) { throw 'blocked' }
  if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'blocked' }
  $cursor = $item.Directory
  while ($null -ne $cursor -and $cursor.FullName.Length -ge $boundary.Length - 1) {
    if (($cursor.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'blocked' }
    $cursor = $cursor.Parent
  }
}

function Read-PublicJson([string]$Path) {
  Assert-Leaf $Path $repo
  if ((Get-Item -LiteralPath $Path).Length -gt 262144) { throw 'blocked' }
  return ([IO.File]::ReadAllText($Path) | ConvertFrom-Json -ErrorAction Stop)
}

function Exact-Keys($Value, [string[]]$Keys) {
  if ($null -eq $Value -or $Value -isnot [pscustomobject]) { return $false }
  $actual = @($Value.PSObject.Properties.Name)
  if ($actual.Count -ne $Keys.Count) { return $false }
  foreach ($name in $actual) { if ($Keys -cnotcontains $name) { return $false } }
  return $true
}

function Assert-ActiveRun {
  $pending = Read-PublicJson (Join-Path $out 'dev-write-pending.json')
  if ($pending.target -cne "supabase:${projectRef}:postgres" -or $pending.action -cne 'accept-dev' -or $pending.sourceSha256 -cne $sourceHash -or $pending.runId -cne $runId -or $pending.outcome -cne 'unreconciled') { throw 'blocked' }
  $latest = Read-PublicJson (Join-Path $out 'dev-latest.json')
  if ($latest.environment -cne 'dev' -or $latest.projectRef -cne $projectRef -or $latest.action -cne 'accept-dev' -or $latest.nativeCompletion -cne 'in_progress' -or $latest.databaseAuthentication -cne 'postgres_authenticated_to_verified_dev_pooler') { throw 'blocked' }
  $identity = @($latest.stages | Where-Object { $_.name -ceq 'database_identity' -and $_.status -ceq 'completed' })
  $resolution = @($latest.stages | Where-Object { $_.name -ceq 'resolution' -and $_.status -ceq 'blocked' })
  $logos = @($latest.stages | Where-Object { $_.name -ceq 'logos' -and $_.status -ceq 'running' })
  if ($identity.Count -ne 1 -or $resolution.Count -ne 1 -or $logos.Count -ne 1 -or @($resolution[0].result.blocked) -cnotcontains 'youtube') { throw 'blocked' }
  if ($identity[0].result.current_user -cne 'postgres' -or $identity[0].result.session_user -cne 'postgres' -or $identity[0].result.database -cne 'postgres' -or $identity[0].result.originalMigrations -ne 7) { throw 'blocked' }
  $issue = @($resolution[0].result.issues | Where-Object { $_.company_code -ceq 'C142' -and $_.platform -ceq 'youtube' -and $_.code -ceq 'yt_bad_response' })
  if ($issue.Count -ne 1) { throw 'blocked' }
  $parent = Get-Process -Id $originalParentPid -ErrorAction Stop
  try {
    if ($parent.HasExited -or $parent.StartTime.ToUniversalTime().Ticks -ne [DateTime]::Parse($originalParentStart, [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::RoundtripKind).ToUniversalTime().Ticks -or $parent.Path -ine $node.Source) { throw 'blocked' }
  } finally { $parent.Dispose() }
  try { Assert-Leaf $handoff $env:LOCALAPPDATA }
  catch { $script:code = 'DIAGNOSTIC_HANDOFF_UNAVAILABLE'; throw 'blocked' }
}

function Nullable-Integer($Value, [long]$Minimum, [long]$Maximum) {
  return ($null -eq $Value -or (($Value -is [int] -or $Value -is [long]) -and $Value -ge $Minimum -and $Value -le $Maximum))
}

function Safe-Diagnostic($Value) {
  $keys = @('status','httpStatus','jsonParsed','totalResults','itemCount','shape','requestCount')
  $shapeKeys = @('topLevelObject','itemsPresent','itemsArray','pageInfoPresent','pageInfoObject','totalResultsPresent','totalResultsNonnegativeInteger','firstItemObject','idPresent','idString','idMatchesCurrentPattern','contentDetailsPresent','contentDetailsObject','relatedPlaylistsPresent','relatedPlaylistsObject','uploadsPresent','uploadsString','uploadsMatchesCurrentPattern','uploadsMatchesBoundedOpaquePattern','unexpectedTopLevelFields','unexpectedItemFields','unexpectedContentDetailsFields','unexpectedRelatedPlaylistFields')
  $statuses = @('completed','missing_key','invalid_key','invalid_options','unsafe_dns','timeout','network_failed','redirect_refused','body_too_large','argument_rejected')
  if (-not (Exact-Keys $Value $keys) -or $statuses -cnotcontains $Value.status -or $Value.jsonParsed -isnot [bool] -or -not (Nullable-Integer $Value.httpStatus 100 599) -or -not (Nullable-Integer $Value.totalResults 0 1000000) -or -not (Nullable-Integer $Value.itemCount 0 65536) -or $null -eq $Value.requestCount -or -not (Nullable-Integer $Value.requestCount 0 1) -or -not (Exact-Keys $Value.shape $shapeKeys)) { throw 'invalid' }
  $shape = [ordered]@{}
  foreach ($name in $shapeKeys) { if ($Value.shape.$name -isnot [bool]) { throw 'invalid' }; $shape[$name] = [bool]$Value.shape.$name }
  return [ordered]@{ status = [string]$Value.status; httpStatus = $Value.httpStatus; jsonParsed = [bool]$Value.jsonParsed; totalResults = $Value.totalResults; itemCount = $Value.itemCount; shape = $shape; requestCount = [int]$Value.requestCount }
}

try {
  $node = Get-Command node.exe -CommandType Application -ErrorAction Stop
  $seal = Read-PublicJson (Join-Path $out 'youtube-diagnostic-seal.json')
  if (-not (Exact-Keys $seal @('version','diagnostic','projectRef','runId','parentPid','parentStartTimeUtc','maxRequests','files')) -or $seal.version -ne 1 -or $seal.diagnostic -cne 'c142-youtube-shape-once' -or $seal.projectRef -cne $projectRef -or $seal.runId -cne $runId -or $seal.parentPid -ne $originalParentPid -or $seal.parentStartTimeUtc -cne $originalParentStart -or $seal.maxRequests -ne 1) { throw 'blocked' }
  $files = @('scripts/seed/diagnose-youtube.mjs','scripts/seed/windows/Invoke-M02YouTubeDiagnostic.ps1','scripts/seed/dev-batch-packet.json')
  if (-not (Exact-Keys $seal.files $files)) { throw 'blocked' }
  foreach ($relative in $files) {
    $file = Join-Path $repo $relative
    Assert-Leaf $file $repo
    $expected = $seal.files.$relative
    if ($expected -isnot [string] -or $expected -cnotmatch '^[a-f0-9]{64}$' -or (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -cne $expected) { throw 'blocked' }
  }
  $packet = Read-PublicJson (Join-Path $repo 'scripts/seed/dev-batch-packet.json')
  if ($packet.version -ne 1 -or $packet.target -cne $projectRef -or $packet.approved -isnot [bool] -or -not $packet.approved -or $packet.sourceSha256 -cne $sourceHash -or $packet.expectedIncrementalUsd -ne 0 -or $packet.paidProviderCalls -ne 0) { throw 'blocked' }
  Assert-ActiveRun
  if (Test-Path -LiteralPath $attemptPath) { $code = 'DIAGNOSTIC_ALREADY_ADMITTED'; throw 'blocked' }
  if ($CheckOnly) { $status = 'ready'; $code = 'DIAGNOSTIC_PRESENCE_ONLY'; $exitCode = 0 }
  else {
    # Durable admission precedes any private read; deliberately never removed here.
    $marker = [IO.File]::Open($attemptPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::Read)
    try {
      $bytes = [Text.Encoding]::UTF8.GetBytes(([ordered]@{ version = 1; runId = $runId; parentPid = $originalParentPid; sourceSha256 = $sourceHash; outcome = 'unreconciled'; admittedAt = [DateTime]::UtcNow.ToString('o'); maxRequests = 1 } | ConvertTo-Json -Compress))
      $marker.Write($bytes, 0, $bytes.Length)
      $marker.Flush($true)
    } finally { $marker.Dispose() }
    Assert-ActiveRun
    $status = 'failed'
    $code = 'DIAGNOSTIC_PRIVATE_READ_FAILED'
    # FileShare.Delete lets the original parent delete its handoff independently.
    $privateStream = [IO.File]::Open($handoff, [IO.FileMode]::Open, [IO.FileAccess]::Read, ([IO.FileShare]::Read -bor [IO.FileShare]::Delete))
    try {
      if ($privateStream.Length -gt 65536) { throw 'blocked' }
      $reader = New-Object IO.StreamReader($privateStream, [Text.Encoding]::ASCII)
      try { $encrypted = $reader.ReadToEnd().Trim() } finally { $reader.Dispose() }
    } finally { $privateStream.Dispose() }
    try { $secure = ConvertTo-SecureString -String $encrypted -ErrorAction Stop } finally { $encrypted = $null }
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $key = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    if ([string]::IsNullOrEmpty($key) -or $key.Length -gt 8192 -or $key -match '[\s\x00]') { throw 'blocked' }
    $start = New-Object Diagnostics.ProcessStartInfo
    $start.FileName = $node.Source
    $start.Arguments = '"seed/diagnose-youtube.mjs"'
    $start.WorkingDirectory = Join-Path $repo 'scripts'
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.WindowStyle = [Diagnostics.ProcessWindowStyle]::Hidden
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $start.EnvironmentVariables.Clear()
    foreach ($name in @('SystemRoot','WINDIR','PATH','TEMP','TMP','LOCALAPPDATA','APPDATA','USERPROFILE')) {
      $value = [Environment]::GetEnvironmentVariable($name, 'Process')
      if ($null -ne $value) { $start.EnvironmentVariables[$name] = $value }
    }
    $start.EnvironmentVariables['YOUTUBE_API_KEY'] = $key
    $key = $null
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr); $bstr = [IntPtr]::Zero
    $secure.Dispose(); $secure = $null
    Assert-ActiveRun
    $child = New-Object Diagnostics.Process
    $child.StartInfo = $start
    $code = 'DIAGNOSTIC_START_FAILED'
    try { $started = $child.Start() } finally { $start.EnvironmentVariables.Clear() }
    if (-not $started) { throw 'blocked' }
    $childClosed = $false
    $buffer = New-Object byte[] 8192
    $stdout = New-Object IO.MemoryStream(,$buffer)
    $stdout.SetLength(0)
    $stdoutTask = $child.StandardOutput.BaseStream.CopyToAsync($stdout)
    $stderrTask = $child.StandardError.BaseStream.CopyToAsync([IO.Stream]::Null)
    $deadline = [DateTime]::UtcNow.AddSeconds(15)
    while (-not $child.WaitForExit(100)) { if ([DateTime]::UtcNow -ge $deadline) { $code = 'DIAGNOSTIC_TIMEOUT'; throw 'timeout' } }
    $childClosed = $true
    $nativeExit = $child.ExitCode
    $code = 'DIAGNOSTIC_OUTPUT_INVALID'
    $drainDeadline = [DateTime]::UtcNow.AddSeconds(5)
    while (-not ($stdoutTask.IsCompleted -and $stderrTask.IsCompleted)) { if ([DateTime]::UtcNow -ge $drainDeadline) { throw 'drain' }; Start-Sleep -Milliseconds 20 }
    if ($stdoutTask.IsFaulted -or $stderrTask.IsFaulted) { throw 'drain' }
    $raw = [Text.Encoding]::UTF8.GetString($stdout.ToArray())
    try { $safeDiagnostic = Safe-Diagnostic ($raw | ConvertFrom-Json -ErrorAction Stop) } finally { $raw = $null; [Array]::Clear($buffer, 0, $buffer.Length) }
    if ($nativeExit -eq 0 -and $safeDiagnostic.status -ceq 'completed') { $status = 'completed'; $code = 'DIAGNOSTIC_COMPLETED'; $exitCode = 0 }
    else { $code = 'DIAGNOSTIC_COMPLETED_FAILURE' }
  }
} catch {
  # Raw exception messages, stdout and stderr are never forwarded.
} finally {
  $key = $null
  if ($null -ne $start) { $start.EnvironmentVariables.Clear() }
  if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
  if ($null -ne $secure) { $secure.Dispose() }
  if ($null -ne $child -and $started) {
    try {
      if (-not $child.HasExited) { $child.Kill() }
      $childClosed = $child.WaitForExit(5000)
      if ($childClosed) { $nativeExit = $child.ExitCode }
    } catch { $childClosed = $false }
    $drainDeadline = [DateTime]::UtcNow.AddSeconds(5)
    while (($null -ne $stdoutTask -and -not $stdoutTask.IsCompleted) -or ($null -ne $stderrTask -and -not $stderrTask.IsCompleted)) { if ([DateTime]::UtcNow -ge $drainDeadline) { break }; Start-Sleep -Milliseconds 20 }
  }
  if ($null -ne $child) { $child.Dispose() }
  if ($null -ne $stdout) { $stdout.Dispose() }
  if ($null -ne $buffer) { [Array]::Clear($buffer, 0, $buffer.Length) }
  if (-not $childClosed) { $exitCode = 1; $status = 'failed'; $code = 'DIAGNOSTIC_CHILD_CLOSE_UNCONFIRMED' }
}

[ordered]@{ status = $status; code = $code; childClosed = $childClosed; nativeExit = $nativeExit; handoffDeletionOwner = 'original_parent'; diagnostic = $safeDiagnostic } | ConvertTo-Json -Depth 5 -Compress | Write-Output
exit $exitCode
