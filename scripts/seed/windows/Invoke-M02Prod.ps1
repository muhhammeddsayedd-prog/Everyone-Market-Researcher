param([switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
if ($args.Count -ne 0) { Write-Output 'M02 prod runner rejected unsupported arguments. No private read or authentication attempted.'; exit 1 }
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
$supplementalFiles = @('scripts/package.json','pnpm-lock.yaml','scripts/seed/dev-batch-packet.json',
  'data/competitors.csv','data/competitor_accounts.csv','reference/taxonomies.json',
  'scripts/seed/overrides.csv','assets/brand/everyone-logotype.svg','scripts/seed/certs/supabase-root-2021.crt',
  'scripts/seed/certs/supabase-root-2021.json','scripts/seed/prod-ca.json',
  'scripts/seed/prod-seed-packet.json','scripts/seed/prod-payload.json','scripts/seed/prod-logo-manifest.json','scripts/assert/m02_counts.sql')

function Assert-NoReparsePath([string]$Path) {
  $cursor = [IO.Path]::GetFullPath($Path)
  while ($null -ne $cursor) {
    $entry = Get-Item -LiteralPath $cursor -Force -ErrorAction Stop
    if (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Rejected reparse path' }
    $parent = [IO.Directory]::GetParent($cursor)
    $cursor = if ($null -eq $parent) { $null } else { $parent.FullName }
  }
}
function Assert-ConfinedFile([string]$Relative) {
  if ([IO.Path]::IsPathRooted($Relative) -or $Relative -match '(?:^|/|\\)\.\.(?:/|\\|$)' -or
      ($Relative -notmatch '^(?:scripts/seed/[\w./-]+\.(?:ts|mjs|ps1)|scripts/seed/out/prod-runner-seal\.json|packages/shared/src/[\w./-]+\.(?:ts|mjs|ps1))$' -and $Relative -notin $supplementalFiles)) { throw 'Rejected source path' }
  $absolute = [IO.Path]::GetFullPath((Join-Path $repo $Relative))
  if (-not $absolute.StartsWith($repo + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Rejected source boundary' }
  Assert-NoReparsePath $absolute
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
function New-MinimalNodeStart([string]$Node, [string]$Arguments) {
  $info = New-Object Diagnostics.ProcessStartInfo
  $info.FileName = $Node; $info.WorkingDirectory = Join-Path $repo 'scripts'; $info.Arguments = $Arguments
  $info.UseShellExecute = $false; $info.CreateNoWindow = $true
  $info.RedirectStandardOutput = $true; $info.RedirectStandardError = $true
  $info.EnvironmentVariables.Clear()
  foreach ($name in @('SystemRoot','WINDIR','PATH','TEMP','TMP','LOCALAPPDATA','APPDATA','USERPROFILE')) {
    $value = [Environment]::GetEnvironmentVariable($name, 'Process')
    if ($null -ne $value) { $info.EnvironmentVariables[$name] = $value }
  }
  return $info
}
function Invoke-PublicJson([string]$Node, [string]$Arguments) {
  # Fixed-size public receipt capture; raw stderr is always discarded. No private
  # values are loaded into either preflight process or this inherited environment.
  $start = $null; $child = $null; $memory = $null
  $started = $false; $closed = $false; $receipt = $null; $nativeExit = $null
  try {
    $start = New-MinimalNodeStart $Node $Arguments
    $child = New-Object Diagnostics.Process; $child.StartInfo = $start
    $started = $child.Start()
    if (-not $started) { throw 'Public preflight start failed' }
    $start.EnvironmentVariables.Clear()
    $buffer = New-Object byte[] 4096
    $memory = [IO.MemoryStream]::new([byte[]]$buffer, $true)
    $stdout = $child.StandardOutput.BaseStream.CopyToAsync($memory)
    $stderr = $child.StandardError.BaseStream.CopyToAsync([IO.Stream]::Null)
    if (-not $child.WaitForExit(15000)) { throw 'Public preflight timeout' }
    $closed = $true; $nativeExit = $child.ExitCode
    $drained = [Threading.Tasks.Task]::WhenAll([Threading.Tasks.Task[]]@($stdout,$stderr))
    if (-not $drained.Wait(5000)) { throw 'Public preflight drain timeout' }
    $text = [Text.Encoding]::UTF8.GetString($buffer, 0, [int]$memory.Position)
    $receipt = $text | ConvertFrom-Json -ErrorAction Stop
  } catch { $receipt = $null } finally {
    if ($null -ne $child) {
      if ($started -and -not $closed) {
        try { if (-not $child.WaitForExit(0)) { $child.Kill() }; $closed = $child.WaitForExit(5000) }
        catch { $closed = $false }
      }
      try { $child.Dispose() } catch { $receipt = $null }
    }
    if ($null -ne $start) { $start.EnvironmentVariables.Clear() }
    if ($null -ne $memory) { $memory.Dispose() }
    $buffer = $null; $text = $null; $stdout = $null; $stderr = $null; $drained = $null; $child = $null; $start = $null
  }
  return [PSCustomObject]@{ Receipt=$receipt; NativeExit=$nativeExit; Closed=$closed }
}

# Source inventory, exact prod packet and prebuilt plain-Node artifact are checked
# before private file reads. No compiler, loader or installation sees credentials.
try {
  Assert-NoReparsePath $repo
  $sealPath = Assert-ConfinedFile 'scripts/seed/out/prod-runner-seal.json'
  $runnerPath = Assert-ConfinedFile 'scripts/seed/out/prod-runner.mjs'
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
  $packetPath = Assert-ConfinedFile 'scripts/seed/prod-seed-packet.json'
  if ((Get-Item -LiteralPath $packetPath).Length -gt 65536) { throw 'Invalid packet size' }
  $packet = Get-Content -LiteralPath $packetPath -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
  if ($packet.version -ne 1 -or $packet.target -ne 'hkiafqrcxaafdbcvjlzv' -or $packet.approved -isnot [bool]) { throw 'Invalid prod approval packet' }
  foreach ($name in @('sourceSha256','payloadSha256','logoManifestSha256','baselineSvgSha256')) {
    if ($packet.$name -isnot [string] -or $packet.$name -notmatch '^[a-f0-9]{64}$') { throw 'Invalid packet hash' }
  }
} catch {
  Write-Output 'M02 prod runner/source seal verification failed. No decryption or authentication attempted. Rebuild credential-free after reviewing the change.'
  exit 1
}
$approved = $packet.approved -and $packet.approvalReference -is [string] -and -not [string]::IsNullOrWhiteSpace($packet.approvalReference)
if (-not $approved -and -not $CheckOnly) {
  Write-Output 'M02 production seed approval pending. No decryption or authentication attempted.'
  exit 3
}
foreach ($name in @('prod-seed-admission.json','prod-write-pending.json','prod-seed-manifest.json','prod-logo-manifest.json')) {
  if (Test-Path -LiteralPath (Join-Path $repo ('scripts/seed/out/' + $name))) {
    Write-Output 'M02 prod durable run state already exists; actual-state reconciliation is required. No private read, authentication or automatic replay.'
    exit 5
  }
}
$needed = @{ PGPASSWORD='emr-m02-prod-db-password.dpapi'; SUPABASE_SECRET_KEY='emr-m02-prod-storage-key.dpapi' }
$files = @{}
try {
  $temporaryDirectory = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'Temp'))
  Assert-NoReparsePath $temporaryDirectory
  foreach ($name in $needed.Keys) {
    $files[$name] = Join-Path $temporaryDirectory $needed[$name]
    if (-not (Test-Path -LiteralPath $files[$name] -PathType Leaf)) {
      Write-Output ('M02 required encrypted handoff missing: ' + $needed[$name] + '. No decryption or authentication attempted.')
      exit 2
    }
    Assert-NoReparsePath $files[$name]
    if ((Get-Item -LiteralPath $files[$name]).Length -gt 65536) { throw 'Invalid handoff size' }
  }
} catch {
  Write-Output 'M02 prod handoff file boundary check failed. No private read or authentication attempted; handoffs preserved.'
  exit 2
}
if ($CheckOnly) {
  if (-not $approved) { Write-Output 'M02 production seed approval pending; presence check only.' }
  Write-Output 'M02 prod runner/source seal and required handoff files verified; authentication not tested. No TLS or private read performed.'
  exit 0
}
try {
  $node = (Get-Command node.exe -CommandType Application -ErrorAction Stop).Source
  $preflight = Invoke-PublicJson $node '"seed/out/prod-runner.mjs" preflight'
  $public = $preflight.Receipt
  if (-not $preflight.Closed -or $preflight.NativeExit -ne 0 -or $public.status -ne 'verified' -or
      $public.environment -ne 'prod' -or $public.projectRef -ne 'hkiafqrcxaafdbcvjlzv' -or
      $public.approved -isnot [bool] -or $public.approved -ne $true) { throw 'Prod payload preflight rejected' }
  $tls = Invoke-PublicJson $node '"seed/prod-check-tls.mjs"'
  $public = $tls.Receipt
  foreach ($name in @('rejectUnauthorized','exactServerName','scopedCaVerified','startupMessageSent','authenticationAttempted','socketsClosed')) {
    if ($public.$name -isnot [bool]) { throw 'Invalid public TLS boolean' }
  }
  if (-not $tls.Closed -or $tls.NativeExit -ne 0 -or $public.status -ne 'verified' -or
      $public.environment -ne 'prod' -or $public.projectRef -ne 'hkiafqrcxaafdbcvjlzv' -or
      $public.host -ne 'aws-1-eu-central-1.pooler.supabase.com' -or $public.port -ne 5432 -or
      $public.phase -ne 'tls_handshake' -or $public.code -ne 'TLS_VERIFIED' -or
      $public.rejectUnauthorized -ne $true -or $public.exactServerName -ne $true -or $public.scopedCaVerified -ne $true -or
      $public.startupMessageSent -ne $false -or $public.authenticationAttempted -ne $false -or $public.socketsClosed -ne $true) { throw 'Prod public TLS rejected' }
} catch {
  Write-Output 'M02 prod public payload/TLS preflight did not pass. No decryption or database authentication attempted; all handoffs preserved.'
  exit 4
} finally { $public = $null; $preflight = $null; $tls = $null }
Write-Output 'M02 prod public payload and strict TLS preflights passed. No database authentication attempted by these preflights.'

$child = $null; $start = $null; $childStarted = $false; $childExitConfirmed = $false
$streams = @{}; $consumed = @(); $exitCode = 1
try {
  $start = New-MinimalNodeStart $node '"seed/out/prod-runner.mjs" apply'
  $start.EnvironmentVariables['SEED_DATABASE_URL']='postgresql://postgres.hkiafqrcxaafdbcvjlzv@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require'
  $start.EnvironmentVariables['SUPABASE_URL']='https://hkiafqrcxaafdbcvjlzv.supabase.co'
  foreach ($name in $needed.Keys) {
    $secure = $null; $pointer = [IntPtr]::Zero; $encrypted = $null; $reader = $null
    try {
      Assert-NoReparsePath $files[$name]
      # DeleteOnClose binds cleanup to the actual opened file, not a substituted
      # pathname. FileShare.None holds that exact handoff through child closure.
      $streams[$name] = [IO.FileStream]::new($files[$name], [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::None, 4096, [IO.FileOptions]::DeleteOnClose)
      $consumed += $name
      if ($streams[$name].Length -gt 65536) { throw 'Invalid handoff size' }
      $reader = [IO.StreamReader]::new($streams[$name], [Text.Encoding]::ASCII, $false, 4096, $true)
      $encrypted = $reader.ReadToEnd().Trim()
      $secure = ConvertTo-SecureString -String $encrypted -ErrorAction Stop
      if ($secure.Length -eq 0) { throw 'Empty private handoff' }
      $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
      $start.EnvironmentVariables[$name] = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    } finally {
      if ($null -ne $reader) { $reader.Dispose() }
      if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
      if ($null -ne $secure) { $secure.Dispose() }
      $secure = $null; $encrypted = $null; $reader = $null
    }
  }
  $child = New-Object Diagnostics.Process; $child.StartInfo = $start
  $childStarted = $child.Start()
  if (-not $childStarted) { throw 'Prod child start failed' }
  $start.EnvironmentVariables.Clear()
  $stdout = $child.StandardOutput.BaseStream.CopyToAsync([IO.Stream]::Null)
  $stderr = $child.StandardError.BaseStream.CopyToAsync([IO.Stream]::Null)
  $deadline = [DateTime]::UtcNow.AddMinutes(30)
  $nextProgress = [DateTime]::UtcNow.AddSeconds(30)
  while (-not $child.WaitForExit(1000)) {
    if ([DateTime]::UtcNow -ge $deadline) { throw 'Bounded prod child timeout' }
    if ([DateTime]::UtcNow -ge $nextProgress) {
      Write-Output 'M02 bounded prod child is running; private output remains withheld.'
      $nextProgress = [DateTime]::UtcNow.AddSeconds(30)
    }
  }
  $childExitConfirmed = $true
  $drained = [Threading.Tasks.Task]::WhenAll([Threading.Tasks.Task[]]@($stdout,$stderr))
  if (-not $drained.Wait(5000)) { throw 'Bounded pipe drain timeout' }
  $exitCode = $child.ExitCode
  Write-Output ('M02 prod child native exit: ' + $exitCode + '. Read scripts/seed/out/prod-latest.json for the sanitized receipt. Reconcile actual state before any retry.')
} catch {
  Write-Output 'M02 prod runner stopped; raw error withheld. Inspect only the sanitized receipt. Reconcile actual state before any retry.'
  $exitCode = 1
} finally {
  if ($null -ne $child) {
    if ($childStarted -and -not $childExitConfirmed) {
      try { if (-not $child.WaitForExit(0)) { $child.Kill() }; $childExitConfirmed = $child.WaitForExit(5000) }
      catch { $childExitConfirmed = $false }
    }
    try { $child.Dispose() } catch { $exitCode = 1 }
  }
  if ($null -ne $start) { try { $start.EnvironmentVariables.Clear() } catch { $exitCode = 1 } }
  foreach ($name in $consumed) {
    try {
      $streams[$name].Dispose()
      if (Test-Path -LiteralPath $files[$name]) { throw 'Consumed handoff remains or was replaced; preserved for inspection' }
    }
    catch { Write-Output 'M02 prod consumed encrypted handoff cleanup incomplete; exact remaining filenames must be checked.'; $exitCode = 1 }
  }
  $streams = $null; $stdout = $null; $stderr = $null; $drained = $null; $start = $null; $child = $null
  if ($childStarted -and -not $childExitConfirmed) {
    Write-Output 'M02 prod credential child exit NOT confirmed; stop and inspect the owned process before any retry.'
    $exitCode = 1
  } else {
    Write-Output 'M02 prod credential child closed or never started. Consumed temporary handoffs removed unless cleanup was reported incomplete. Owner-saved originals are retained.'
  }
}
exit $exitCode
