[CmdletBinding()]
param([switch]$CheckOnly)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
$projectRef = 'zmotjsbzhzjvpelxvxlf'
$poolerHost = 'aws-1-eu-central-1.pooler.supabase.com'
$cliRelative = 'node_modules/.pnpm/@supabase+cli-windows-x64@2.121.0/node_modules/@supabase/cli-windows-x64/bin/supabase.exe'
$caRelative = 'scripts/seed/certs/supabase-root-2021.crt'
$caHash = '700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7'
$requiredFiles = @('scripts/db/windows/Invoke-M03GW01Migrations.ps1','scripts/n8n/windows/New-M03GW01Handoff.ps1',
  'scripts/seed/check-tls.mjs','scripts/seed/certs/supabase-root-2021.json',$caRelative,$cliRelative)
$versions = @('20261017172928','20261017172931','20261017172934','20261017172937','20261017172940','20261017172943','20261017172945','20261018034220','20261018035417','20261018070042')
$names = @('extensions_schemas_roles','core_tables','auth_rls_views','rpc_pipeline_core','rpc_app_search','storage_cron','seed_taxonomies','rpc_n8n_foundation','price_book_plan','n8n_worker_gateway_admission')
$queryTimeoutMs = 30000
$pushTimeoutMs = 180000
$runId = [Guid]::NewGuid().ToString()
$scratch = $null
$password = $null
$secret = $null
$bstr = [IntPtr]::Zero
$consumed = $false
$sessionLock = $null
$exitCode = 1
$receipt = [ordered]@{version=1;runId=$runId;environment='dev';projectRef=$projectRef;host=$poolerHost;port=5432;
  status='preflight_blocked';authenticationAttempted=$false;authenticationVerified=$false;historyBefore='not_checked';historyAfter='not_checked';
  dryRunMatched=$false;dryRunCheck='not_attempted';dryRunNativeExit=$null;pushAttempted=$false;pushNativeExit=$null;childrenClosed=$true;handoffDeleted=$false;scratchDeleted=$true;
  pendingVersions=@('20261018070042');observedAt=$null}

function Assert-Keys($Value, [string[]]$Expected) {
  if ($Value -isnot [PSCustomObject] -or @(Compare-Object -ReferenceObject @($Expected | Sort-Object) -DifferenceObject @($Value.PSObject.Properties.Name | Sort-Object)).Count -ne 0) { throw 'blocked' }
}
function Assert-Path([string]$Root, [string]$Relative, [switch]$Directory) {
  $rootEntry = Get-Item -LiteralPath $Root -Force -ErrorAction Stop
  if (-not $rootEntry.PSIsContainer -or ($rootEntry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'blocked' }
  if ([IO.Path]::IsPathRooted($Relative) -or $Relative -match '(?:^|[/\\])\.\.(?:[/\\]|$)' -or $Relative -match '[:\x00]') { throw 'blocked' }
  $absolute = [IO.Path]::GetFullPath((Join-Path $Root $Relative))
  if (-not $absolute.StartsWith($Root + [IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'blocked' }
  $cursor = $Root
  foreach ($segment in ($Relative -split '[/\\]')) {
    $cursor = Join-Path $cursor $segment
    $entry = Get-Item -LiteralPath $cursor -Force -ErrorAction Stop
    if (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'blocked' }
  }
  if ($Directory) { if (-not $entry.PSIsContainer) { throw 'blocked' } }
  elseif ($entry.PSIsContainer) { throw 'blocked' }
  return $absolute
}
function Read-Json([string]$File, [long]$Maximum = 131072) {
  if ((Get-Item -LiteralPath $File).Length -gt $Maximum) { throw 'blocked' }
  return ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($File)) -ErrorAction Stop
}
function File-Hash([string]$File) { return (Get-FileHash -LiteralPath $File -Algorithm SHA256).Hash.ToLowerInvariant() }
function Write-NewJson([string]$File, $Value) {
  $stream = $null
  try {
    $bytes = [Text.Encoding]::UTF8.GetBytes(($Value | ConvertTo-Json -Depth 12 -Compress))
    $stream = [IO.File]::Open($File,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
    $stream.Write($bytes,0,$bytes.Length); $stream.Flush($true)
  } finally { if ($null -ne $stream) { $stream.Dispose() } }
}

# Every native child gets a fresh OS-only environment. Only reviewed CLI database
# operations receive PGPASSWORD. No shell, loader, compiler or install is launched.
function Invoke-Bounded([string]$Executable, [string[]]$Arguments, [string]$WorkingDirectory, [int]$TimeoutMs, [string]$PrivatePassword = $null) {
  $start = $null; $child = $null; $memory = $null; $buffer = $null
  $started = $false; $closed = $true; $nativeExit = $null; $valid = $false; $text = $null
  $stdout = $null; $stderr = $null
  try {
    $quoted = foreach ($argument in $Arguments) {
      if ($argument -match '["\r\n\x00]' -or $argument.EndsWith('\')) { throw 'blocked' }
      '"' + $argument + '"'
    }
    $start = New-Object Diagnostics.ProcessStartInfo
    $start.FileName = $Executable; $start.Arguments = $quoted -join ' '; $start.WorkingDirectory = $WorkingDirectory
    $start.UseShellExecute = $false; $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true; $start.RedirectStandardError = $true
    $start.EnvironmentVariables.Clear()
    foreach ($name in @('SystemRoot','WINDIR','PATH','TEMP','TMP','LOCALAPPDATA','APPDATA','USERPROFILE')) {
      $value = [Environment]::GetEnvironmentVariable($name,'Process')
      if ($null -ne $value) { $start.EnvironmentVariables[$name] = $value }
    }
    if (-not [string]::IsNullOrEmpty($PrivatePassword)) { $start.EnvironmentVariables['PGPASSWORD'] = $PrivatePassword }
    $child = New-Object Diagnostics.Process
    $child.StartInfo = $start
    $started = $child.Start()
    if (-not $started) { throw 'blocked' }
    $closed = $false
    $start.EnvironmentVariables.Clear()
    $buffer = New-Object byte[] 131072
    $memory = [IO.MemoryStream]::new([byte[]]$buffer,$true)
    $stdout = $child.StandardOutput.BaseStream.CopyToAsync($memory)
    $stderr = $child.StandardError.BaseStream.CopyToAsync([IO.Stream]::Null)
    if (-not $child.WaitForExit($TimeoutMs)) { throw 'blocked' }
    $closed = $true; $nativeExit = $child.ExitCode
    $drained = [Threading.Tasks.Task]::WhenAll([Threading.Tasks.Task[]]@($stdout,$stderr))
    if (-not $drained.Wait(5000)) { throw 'blocked' }
    $text = [Text.Encoding]::UTF8.GetString($buffer,0,[int]$memory.Position)
    $valid = $nativeExit -eq 0
  } catch {
    # Raw stdout/stderr and exception messages can contain database credentials.
    $valid = $false
  } finally {
    if ($null -ne $start) { $start.EnvironmentVariables.Clear() }
    if ($null -ne $child) {
      if ($started -and -not $closed) {
        try {
          if (-not $child.WaitForExit(0)) { $child.Kill() }
          $closed = $child.WaitForExit(5000)
          if ($closed) { $nativeExit = $child.ExitCode }
        } catch { $closed = $false }
      }
      try { $child.Dispose() } catch { $valid = $false }
    }
    if ($null -ne $stdout -and $null -ne $stderr) {
      try { $null = [Threading.Tasks.Task]::WhenAll([Threading.Tasks.Task[]]@($stdout,$stderr)).Wait(5000) } catch { $valid = $false }
    }
    if ($null -ne $memory) { $memory.Dispose() }
    if ($null -ne $buffer) { [Array]::Clear($buffer,0,$buffer.Length) }
    $PrivatePassword = $null
  }
  return [PSCustomObject]@{ok=$valid;started=$started;closed=$closed;nativeExit=$nativeExit;text=$text}
}
function Invoke-Cli([string[]]$Arguments, [int]$TimeoutMs) {
  if ($Arguments.Count -lt 2 -or $Arguments[0] -cne 'db' -or $Arguments[1] -cnotin @('query','push')) { throw 'blocked' }
  # CLI2.121.0 gives legacy --output json precedence over --output-format and
  # selects a text layer. Query has its own legacy formatter; push does not.
  $outputFlags = @('--output-format','json')
  if ($Arguments[1] -ceq 'query') { $outputFlags += @('--output','json') }
  $result = Invoke-Bounded $cliPath ($Arguments + @('--workdir',$scratch,'--db-url',$dbUri,'--agent','no') + $outputFlags) $scratch $TimeoutMs $password
  if (-not $result.closed) { $receipt.childrenClosed = $false }
  return $result
}
function History-State($Result) {
  if (-not $Result.ok -or -not $Result.closed -or $Result.text -notmatch '^\s*\[') { return 'rejected' }
  try {
    $rows = ConvertFrom-Json -InputObject $Result.text -ErrorAction Stop
    if ($rows -isnot [Array] -or $rows.Count -ne 1) { throw 'blocked' }
    Assert-Keys $rows[0] @('receipt')
    $snapshot = $rows[0].receipt
    Assert-Keys $snapshot @('current_user','session_user','database','migrations')
    if ($snapshot.current_user -cne 'postgres' -or $snapshot.session_user -cne 'postgres' -or $snapshot.database -cne 'postgres' -or $snapshot.migrations -isnot [Array]) { throw 'blocked' }
    $history = @($snapshot.migrations)
    if ($history.Count -notin @(9,10)) { throw 'blocked' }
    for ($i=0; $i -lt $history.Count; $i++) {
      Assert-Keys $history[$i] @('version','name','historySha256')
      if ($history[$i].version -cne $migrations[$i].version -or $history[$i].name -cne $migrations[$i].name -or $history[$i].historySha256 -cne $migrations[$i].historySha256) { throw 'blocked' }
    }
    if ($history.Count -eq 10) { return 'complete' }
    return 'baseline'
  } catch { return 'rejected' }
}
function Push-Check($Result,[bool]$DryRun) {
  # This finite public classification never returns CLI errors, output, filenames
  # or credentials. Native failure and a contract mismatch are different gates.
  if (-not $Result.started) { return 'child_not_started' }
  if (-not $Result.closed) { return 'child_not_closed' }
  if ($Result.nativeExit -ne 0) { return 'native_failure' }
  if (-not $Result.ok) { return 'output_unavailable' }
  try { $value = ConvertFrom-Json -InputObject $Result.text -ErrorAction Stop }
  catch { return 'invalid_json' }
  try {
    Assert-Keys $value @('upToDate','dryRun','migrations','seeds','roles','message')
    if ($value.upToDate -isnot [bool] -or $value.upToDate -ne $false -or $value.dryRun -isnot [bool] -or $value.dryRun -ne $DryRun -or
        $value.message -cne 'Finished supabase db push.' -or $value.migrations -isnot [Array] -or $value.seeds -isnot [Array] -or $value.roles -isnot [Array] -or
        $value.seeds.Count -ne 0 -or $value.roles.Count -ne 0) { throw 'blocked' }
  } catch { return 'invalid_shape' }
  if ($value.migrations.Count -ne 1) { return 'pending_mismatch' }
  for ($i=0; $i -lt 1; $i++) { if ($value.migrations[$i] -isnot [string] -or $value.migrations[$i] -cne [IO.Path]::GetFileName($packet.pending[$i].file)) { return 'pending_mismatch' } }
  return 'matched'
}
function Push-Matches($Result,[bool]$DryRun) {
  return (Push-Check $Result $DryRun) -ceq 'matched'
}

# All preflight checks are public and precede any DPAPI read/decryption.
try {
  $repoEntry = Get-Item -LiteralPath $repo -Force
  if (($repoEntry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'blocked' }
  $packet = Read-Json (Assert-Path $repo 'scripts/db/gw01-dev-migration-packet.json')
  Assert-Keys $packet @('version','target','approved','authorizationReference','cliVersion','baseline','pending','files')
  if ($packet.version -ne 1 -or $packet.target -cne $projectRef -or $packet.approved -isnot [bool] -or -not $packet.approved -or
      $packet.cliVersion -cne '2.121.0' -or $packet.authorizationReference -cne 'Owner GW-01 dev packet 100290a approved 2026-10-18' -or
      $packet.baseline -isnot [Array] -or $packet.pending -isnot [Array] -or $packet.baseline.Count -ne 9 -or $packet.pending.Count -ne 1) { throw 'blocked' }
  Assert-Keys $packet.files $requiredFiles
  foreach ($property in $packet.files.PSObject.Properties) {
    if ($property.Value -isnot [string] -or $property.Value -cnotmatch '^[a-f0-9]{64}$' -or (File-Hash (Assert-Path $repo $property.Name)) -cne $property.Value) { throw 'blocked' }
  }
  $migrations = @($packet.baseline) + @($packet.pending)
  for ($i=0; $i -lt 10; $i++) {
    $migration = $migrations[$i]
    Assert-Keys $migration @('version','name','file','sha256','historySha256')
    $expectedFile = 'supabase/migrations/' + $versions[$i] + '_' + $names[$i] + '.sql'
    if ($migration.version -cne $versions[$i] -or $migration.name -cne $names[$i] -or $migration.file -cne $expectedFile -or
        $migration.sha256 -cnotmatch '^[a-f0-9]{64}$' -or $migration.historySha256 -cnotmatch '^[a-f0-9]{64}$' -or
        (File-Hash (Assert-Path $repo $expectedFile)) -cne $migration.sha256) { throw 'blocked' }
  }
  $actualMigrations = @(Get-ChildItem -LiteralPath (Assert-Path $repo 'supabase/migrations' -Directory) -Force)
  if ($actualMigrations.Count -ne 10) { throw 'blocked' }
  foreach ($entry in $actualMigrations) {
    if ($entry.PSIsContainer -or ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or $entry.Name -cnotin @($migrations | ForEach-Object { [IO.Path]::GetFileName($_.file) })) { throw 'blocked' }
  }
  $caPath = Assert-Path $repo $caRelative
  if ((File-Hash $caPath) -cne $caHash) { throw 'blocked' }
  $pin = Read-Json (Assert-Path $repo 'scripts/seed/certs/supabase-root-2021.json')
  Assert-Keys $pin @('version','projectRef','host','sourceUrl','sha256')
  if ($pin.version -ne 1 -or $pin.projectRef -cne $projectRef -or $pin.host -cne $poolerHost -or $pin.sha256 -cne $caHash -or $pin.sourceUrl -cne 'https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt') { throw 'blocked' }
  $cliPath = Assert-Path $repo $cliRelative
  $cliVersion = Invoke-Bounded $cliPath @('--version') $repo 10000
  if (-not $cliVersion.ok -or -not $cliVersion.closed -or $cliVersion.text.Trim() -cne '2.121.0') { throw 'blocked' }
  $out = Join-Path $repo 'scripts/db/out'
  if (-not (Test-Path -LiteralPath $out)) { $null = New-Item -ItemType Directory -Path $out }
  $out = Assert-Path $repo 'scripts/db/out' -Directory
  $attemptFile = Join-Path $out 'gw01-dev-migration-attempt.json'
  $latestFile = Join-Path $out 'gw01-dev-migration-latest.json'
  if (Test-Path -LiteralPath $attemptFile) {
    if ($CheckOnly) {
      $admission = Read-Json (Assert-Path $repo 'scripts/db/out/gw01-dev-migration-attempt.json')
      Assert-Keys $admission @('version','runId','projectRef','pending','createdAt')
      $prior = Read-Json (Assert-Path $repo 'scripts/db/out/gw01-dev-migration-latest.json')
      if ($admission.version -ne 1 -or $admission.projectRef -cne $projectRef -or $admission.pending -isnot [Array] -or $admission.pending.Count -ne 1) { throw 'blocked' }
      for ($i=0; $i -lt 1; $i++) {
        Assert-Keys $admission.pending[$i] @('version','name','file','sha256','historySha256')
        foreach ($field in @('version','name','file','sha256','historySha256')) { if ($admission.pending[$i].$field -cne $packet.pending[$i].$field) { throw 'blocked' } }
      }
      if ($prior.version -eq 1 -and $prior.runId -ceq $admission.runId -and $prior.projectRef -ceq $projectRef -and
          $prior.status -ceq 'complete' -and $prior.historyAfter -ceq 'complete' -and $prior.authenticationVerified -eq $true -and
          $prior.childrenClosed -eq $true -and $prior.handoffDeleted -eq $true -and $prior.scratchDeleted -eq $true) {
        Write-Output 'GW01 RECORDED_COMPLETE. The matching prior public completion receipt is verified; no handoff needed, decryption, connection or replay. Hosted state was not refreshed.'
        exit 0
      }
    }
    Write-Output 'GW01 ATTEMPT_ALREADY_RECORDED. No decryption or automatic replay. Reconcile the existing public receipt/history before any separately reviewed continuation.'
    exit 1
  }
} catch {
  Write-Output 'GW01 PREFLIGHT_BLOCKED. Public packet/seal/target/CLI verification failed; no decryption or authentication attempted.'
  exit 1
}
try {
  if ([string]::IsNullOrEmpty($env:LOCALAPPDATA)) { throw 'blocked' }
  $handoff = Join-Path ([IO.Path]::GetFullPath($env:LOCALAPPDATA)) 'Temp/emr-m03-gw01-dev-admin.dpapi'
  if (-not (Test-Path -LiteralPath $handoff -PathType Leaf)) {
    Write-Output 'GW01 HANDOFF_MISSING. No decryption or authentication attempted.'; exit 2
  }
  $handoff = Assert-Path ([IO.Path]::GetFullPath($env:LOCALAPPDATA)) 'Temp/emr-m03-gw01-dev-admin.dpapi'
  if ((Get-Item -LiteralPath $handoff).Length -gt 32768) { throw 'blocked' }
} catch { Write-Output 'GW01 HANDOFF_PATH_BLOCKED. No private file read, decryption or authentication attempted.'; exit 1 }
if ($CheckOnly) { Write-Output 'GW01 CHECK_ONLY_READY. Exact dev target, public seals and encrypted handoff presence verified; no decryption, TCP connection or authentication attempted.'; exit 0 }

try {
  $lockPath = Join-Path $out 'gw01-dev-migration-session.lock'
  if (Test-Path -LiteralPath $lockPath) { $null = Assert-Path $repo 'scripts/db/out/gw01-dev-migration-session.lock' }
  $sessionLock = [IO.File]::Open($lockPath,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
  if (Test-Path -LiteralPath $attemptFile) { throw 'blocked' }
  $node = (Get-Command node.exe -CommandType Application -ErrorAction Stop).Source
  $tls = Invoke-Bounded $node @((Assert-Path $repo 'scripts/seed/check-tls.mjs')) $repo 15000
  if (-not $tls.closed) { $receipt.childrenClosed = $false }
  if (-not $tls.ok -or -not $tls.closed) { throw 'blocked' }
  $tlsValue = ConvertFrom-Json -InputObject $tls.text -ErrorAction Stop
  if ($tlsValue.status -cne 'verified' -or $tlsValue.phase -cne 'tls_handshake' -or $tlsValue.code -cne 'TLS_VERIFIED' -or
      $tlsValue.environment -cne 'dev' -or $tlsValue.projectRef -cne $projectRef -or $tlsValue.host -cne $poolerHost -or $tlsValue.port -ne 5432 -or
      $tlsValue.rejectUnauthorized -ne $true -or $tlsValue.exactServerName -ne $true -or $tlsValue.scopedCaVerified -ne $true -or
      $tlsValue.startupMessageSent -ne $false -or $tlsValue.authenticationAttempted -ne $false -or $tlsValue.socketsClosed -ne $true) { throw 'blocked' }

  $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')
  $tempEntry = Get-Item -LiteralPath $tempRoot -Force
  if (($tempEntry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'blocked' }
  $scratch = Join-Path $tempRoot ('emr-m03-gw01-dev-migrations-' + $runId)
  $null = New-Item -ItemType Directory -Path $scratch -ErrorAction Stop
  $receipt.scratchDeleted = $false
  Write-NewJson (Join-Path $scratch 'owned.json') ([ordered]@{runId=$runId;projectRef=$projectRef})
  $null = New-Item -ItemType Directory -Path (Join-Path $scratch 'supabase/migrations') -Force
  [IO.File]::WriteAllText((Join-Path $scratch 'supabase/config.toml'),"project_id = `"emr-m03-gw01-dev-migration`"`n[db.seed]`nenabled = false`nsql_paths = []`n")
  foreach ($migration in $migrations) { [IO.File]::Copy((Assert-Path $repo $migration.file),(Join-Path $scratch $migration.file),$false) }
  $scratchCa = Join-Path $scratch 'supabase-root-2021.crt'
  [IO.File]::Copy($caPath,$scratchCa,$false)
  if ((File-Hash $scratchCa) -cne $caHash) { throw 'blocked' }
  foreach ($migration in $migrations) { if ((File-Hash (Assert-Path $scratch $migration.file)) -cne $migration.sha256) { throw 'blocked' } }
  $historySql = @'
select jsonb_build_object('current_user',current_user,'session_user',session_user,'database',current_database(),'migrations',(select coalesce(jsonb_agg(jsonb_build_object('version',version,'name',name,'historySha256',encode(extensions.digest(array_to_string(statements,E'\n'),'sha256'),'hex')) order by version),'[]'::jsonb) from supabase_migrations.schema_migrations)) as receipt;
'@
  $queryFile = Join-Path $scratch 'history.sql'
  [IO.File]::WriteAllText($queryFile,$historySql)
  $dbUri = 'postgresql://postgres.' + $projectRef + '@' + $poolerHost + ':5432/postgres?sslmode=verify-full&sslrootcert=' + [Uri]::EscapeDataString($scratchCa)

  # The only private read is the new GW01 DPAPI file. No old administrator,
  # writer, provider or production credential is opened or used.
  $null = Assert-Path ([IO.Path]::GetFullPath($env:LOCALAPPDATA)) 'Temp/emr-m03-gw01-dev-admin.dpapi'
  $consumed = $true
  $secret = ConvertTo-SecureString -String ([IO.File]::ReadAllText($handoff).Trim()) -ErrorAction Stop
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
  $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr); $bstr = [IntPtr]::Zero
  $secret.Dispose(); $secret = $null
  if ([string]::IsNullOrEmpty($password)) { throw 'blocked' }
  $before = Invoke-Cli @('db','query','--file',$queryFile) $queryTimeoutMs
  # A launched command with a failed/ambiguous response does not prove either
  # authentication or its absence. Only validated identity/history proves it.
  if ($before.started) { $receipt.authenticationAttempted = $null }
  $receipt.historyBefore = History-State $before
  if ($receipt.historyBefore -in @('baseline','complete')) { $receipt.authenticationAttempted = $true; $receipt.authenticationVerified = $true }
  $before.text = $null
  if ($receipt.historyBefore -eq 'complete') { $receipt.status = 'already_complete'; $receipt.historyAfter = 'complete'; $exitCode = 0 }
  elseif ($receipt.historyBefore -ne 'baseline') { $receipt.status = 'history_rejected' }
  else {
    $dry = Invoke-Cli @('db','push','--dry-run','--skip-vault') 60000
    $receipt.dryRunNativeExit = $dry.nativeExit
    $receipt.dryRunCheck = Push-Check $dry $true
    $receipt.dryRunMatched = $receipt.dryRunCheck -ceq 'matched'
    $dry.text = $null
    if (-not $receipt.dryRunMatched) { $receipt.status = 'dry_run_rejected' }
    else {
      # This durable, public admission is NEVER automatically deleted. A crash or
      # ambiguous response cannot authorize replay of a successful migration.
      Write-NewJson $attemptFile ([ordered]@{version=1;runId=$runId;projectRef=$projectRef;pending=$packet.pending;createdAt=[DateTime]::UtcNow.ToString('o')})
      $receipt.pushAttempted = $true
      $push = Invoke-Cli @('db','push','--skip-vault','--yes') $pushTimeoutMs
      $receipt.pushNativeExit = $push.nativeExit
      $pushMatched = Push-Matches $push $false
      $push.text = $null
      if (-not $push.closed) { $receipt.status = 'child_cleanup_incomplete' }
      else {
        $after = Invoke-Cli @('db','query','--file',$queryFile) $queryTimeoutMs
        $receipt.historyAfter = History-State $after
        $after.text = $null
        if ($receipt.historyAfter -ne 'complete') { $receipt.status = 'reconciliation_required' }
        elseif (-not $pushMatched) { $receipt.status = 'reconciled_complete_after_failure' }
        else { $receipt.status = 'complete'; $exitCode = 0 }
      }
    }
  }
} catch {
  if ($receipt.pushAttempted) { $receipt.status = 'reconciliation_required' }
  elseif ($consumed) { $receipt.status = 'private_operation_failed' }
  else { $receipt.status = 'public_preflight_failed' }
} finally {
  if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
  if ($null -ne $secret) { $secret.Dispose() }
  $password = $null; $secret = $null; $dbUri = $null
  if ($consumed) {
    try { [IO.File]::Delete($handoff); $receipt.handoffDeleted = -not (Test-Path -LiteralPath $handoff) } catch { $receipt.handoffDeleted = $false }
  }
  if ($null -ne $scratch -and $receipt.childrenClosed) {
    try {
      $resolvedScratch = [IO.Path]::GetFullPath($scratch)
      if ($resolvedScratch -cne (Join-Path $tempRoot ('emr-m03-gw01-dev-migrations-' + $runId)) -or -not $resolvedScratch.StartsWith($tempRoot + '\',[StringComparison]::OrdinalIgnoreCase)) { throw 'blocked' }
      $owner = Read-Json (Assert-Path $resolvedScratch 'owned.json')
      Assert-Keys $owner @('runId','projectRef')
      if ($owner.runId -cne $runId -or $owner.projectRef -cne $projectRef) { throw 'blocked' }
      foreach ($entry in @(Get-Item -LiteralPath $resolvedScratch -Force) + @(Get-ChildItem -LiteralPath $resolvedScratch -Recurse -Force)) {
        if (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'blocked' }
      }
      Remove-Item -LiteralPath $resolvedScratch -Recurse -Force -ErrorAction Stop
      $receipt.scratchDeleted = -not (Test-Path -LiteralPath $resolvedScratch)
    } catch { $receipt.scratchDeleted = $false }
  }
  if ($null -ne $sessionLock) { try { $sessionLock.Dispose() } catch { $exitCode = 1 } }
  if (-not $receipt.childrenClosed -or ($consumed -and -not $receipt.handoffDeleted) -or -not $receipt.scratchDeleted) { $exitCode = 1 }
  $receipt.observedAt = [DateTime]::UtcNow.ToString('o')
  try {
    if (Test-Path -LiteralPath $latestFile) { $null = Assert-Path $repo 'scripts/db/out/gw01-dev-migration-latest.json' }
    [IO.File]::WriteAllText($latestFile,($receipt | ConvertTo-Json -Depth 8))
  } catch { $exitCode = 1 }
}
Write-Output ($receipt | ConvertTo-Json -Depth 8 -Compress)
exit $exitCode
