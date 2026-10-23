import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const names = [
  'New-M03AcceptanceHandoff.ps1',
  'Acceptance-PublicRuntime.ps1',
  'New-M03AcceptancePublicSeal.ps1',
  'Invoke-M03Acceptance.ps1',
];
const windowsOnly = { skip: process.platform !== 'win32' };
const safeEnvironment = (directory) => ({
  SystemRoot: process.env.SystemRoot,
  WINDIR: process.env.WINDIR,
  PATH: process.env.PATH,
  TEMP: directory,
  TMP: directory,
  LOCALAPPDATA: directory,
});

test(
  'public DB forward profile uses only its reviewed project context and a credential-free native child',
  windowsOnly,
  () => {
    const directory = mkdtempSync(join(tmpdir(), 'emr-forward-public-'));
    try {
      const source = readFileSync(resolve('scripts/n8n/windows/Invoke-M03Acceptance.ps1'), 'utf8');
      const io = source.slice(
        source.indexOf('function Initialize-BoundedIo'),
        source.indexOf('function Invoke-PublicCompositionCheck'),
      );
      const helper = source.slice(
        source.indexOf('function Invoke-PublicDatabaseCheck('),
        source.indexOf('function ', source.indexOf('function Invoke-PublicDatabaseCheck(') + 10),
      );
      const childDirectory = join(directory, 'scripts/db/windows');
      mkdirSync(childDirectory, { recursive: true });
      writeFileSync(
        join(childDirectory, 'Invoke-M03FoundationMigrations.ps1'),
        `param([switch]$CheckOnly,[switch]$PhaseAControl,[switch]$ProjectVerifiedContinuation,[switch]$ForwardWindow)
if(-not $CheckOnly -or -not $PhaseAControl -or -not $ProjectVerifiedContinuation -or -not $ForwardWindow){exit 1}
if(Test-Path Env:EMR_SYNTHETIC_SECRET){exit 1}
Write-Output 'M03_FOUNDATION PUBLIC_INPUTS_READY.'
exit 4
`,
      );
      const script = join(directory, 'forward.ps1');
      writeFileSync(
        script,
        `$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
${io}
${helper}
function Public-File([string]$Path){return $Path}
Initialize-BoundedIo
$ready=Invoke-PublicDatabaseCheck '${directory.replaceAll("'", "''")}' $true $null $false $false $false $false $true $true
if($ready -ne $false){throw 'WRONG_NATIVE_READY'}
$blocked=$false
try{$null=Invoke-PublicDatabaseCheck '${directory.replaceAll("'", "''")}' $true $null $false $false $false $false $false $true}catch{$blocked=$true}
if(-not $blocked){throw 'LEGACY_FORWARD_ALLOWED'}
Write-Output 'NATIVE_FORWARD_PUBLIC_PASS'
`,
      );
      const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', script], {
        env: { ...safeEnvironment(directory), EMR_SYNTHETIC_SECRET: 'SYNTHETIC_ONLY' },
        encoding: 'utf8',
        windowsHide: true,
        timeout: 15000,
      });
      assert.equal(r.status, 0, r.stderr + r.stdout);
      assert.equal(r.stderr, '');
      assert.equal(r.stdout.trim(), 'NATIVE_FORWARD_PUBLIC_PASS');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
);

test(
  'budget readiness projection rejects stale counters and untrusted fields before private initialization',
  windowsOnly,
  () => {
    const directory = mkdtempSync(join(tmpdir(), 'emr-budget-readiness-'));
    try {
      const source = readFileSync(resolve('scripts/n8n/windows/Invoke-M03Acceptance.ps1'), 'utf8');
      const start = source.indexOf('function ConvertTo-ProjectVerifiedReadinessBlock(');
      const end = source.indexOf('function Invoke-ClockAmendmentPublic(', start);
      assert.ok(start > 0 && end > start);
      const helper = source.slice(start, end);
      const script = join(directory, 'fixed-projection.ps1');
      writeFileSync(
        script,
        `$ErrorActionPreference='Stop'
${helper}
$valid=[ordered]@{kind='project_verified_continuation_blocked';status='setup_cap_insufficient';segmentId='20275b22-b7fe-4737-a9a4-c50c2feadb74';sourceCommitSha='a5e746736893d5040e93032ae740a0878f748837';windowId='38b3708d-61b0-41d2-8170-5ed91c66b4dc';managementAttempts=98;controlAttempts=301;combinedAttempts=399;gatewayPreflightAttempts=2;setupAttempts=44;setupMaximum=50;minimumNewSetupRequests=32;proposedSetupMaximum=88;privateRead=$false;networkRequests=0}
$null=ConvertTo-ProjectVerifiedReadinessBlock ([pscustomobject]$valid)
foreach($key in @('sourceCommitSha','windowId','managementAttempts','setupAttempts','setupMaximum','privateRead','networkRequests')){
 $copy=[ordered]@{};foreach($name in $valid.Keys){$copy[$name]=$valid[$name]};$copy[$key]='SYNTHETIC_PRIVATE_CANARY';$blocked=$false
 try{$null=ConvertTo-ProjectVerifiedReadinessBlock ([pscustomobject]$copy)}catch{$blocked=$true};if(-not $blocked){throw 'UNTRUSTED_FIELD_ACCEPTED'}
}
$copy=[ordered]@{};foreach($name in $valid.Keys){$copy[$name]=$valid[$name]};$copy['raw']='SYNTHETIC_PRIVATE_CANARY';$blocked=$false
try{$null=ConvertTo-ProjectVerifiedReadinessBlock ([pscustomobject]$copy)}catch{$blocked=$true};if(-not $blocked){throw 'EXTRA_FIELD_ACCEPTED'}
Write-Output 'FIXED_BUDGET_PROJECTION_PASS'
`,
      );
      const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', script], {
        env: safeEnvironment(directory),
        encoding: 'utf8',
        windowsHide: true,
        timeout: 10000,
      });
      assert.equal(r.status, 0);
      assert.equal(r.stderr, '');
      assert.equal(r.stdout.trim(), 'FIXED_BUDGET_PROJECTION_PASS');
      const branch = source.indexOf(
        "if($ProjectVerifiedContinuation -and $publicClock.kind -ceq 'project_verified_continuation_blocked')",
      );
      assert.ok(branch > 0 && branch < source.indexOf(' $adminPublicReady=Invoke-PublicDatabaseCheck'));
      assert.ok(branch < source.indexOf(' Confirm-ProjectVerifiedVercelMetadata $node $repo'));
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
);

const writerPackages = {
  pg: [
    '8.23.1',
    'pg@8.23.1',
    ['pg-connection-string', 'pg-pool', 'pg-protocol', 'pg-types', 'pgpass', 'pg-cloudflare'],
  ],
  'pg-connection-string': ['2.14.1', 'pg-connection-string@2.14.1', []],
  'pg-pool': ['3.14.0', 'pg-pool@3.14.0_pg@8.23.1', ['pg']],
  'pg-protocol': ['1.16.1', 'pg-protocol@1.16.1', []],
  'pg-types': [
    '2.2.0',
    'pg-types@2.2.0',
    ['pg-int8', 'postgres-array', 'postgres-bytea', 'postgres-date', 'postgres-interval'],
  ],
  pgpass: ['1.0.5', 'pgpass@1.0.5', ['split2']],
  'pg-cloudflare': ['1.4.1', 'pg-cloudflare@1.4.1', []],
  'pg-int8': ['1.0.1', 'pg-int8@1.0.1', []],
  'postgres-array': ['2.0.0', 'postgres-array@2.0.0', []],
  'postgres-bytea': ['1.0.1', 'postgres-bytea@1.0.1', []],
  'postgres-date': ['1.0.7', 'postgres-date@1.0.7', []],
  'postgres-interval': ['1.2.0', 'postgres-interval@1.2.0', ['xtend']],
  xtend: ['4.0.2', 'xtend@4.0.2', []],
  split2: ['4.2.0', 'split2@4.2.0', []],
};

test(
  'the public closure seals the actual forward packet, postcheck and sole new migration',
  windowsOnly,
  () => {
    const directory = mkdtempSync(join(tmpdir(), 'emr-forward-closure-'));
    try {
      const script = join(directory, 'closure.ps1');
      writeFileSync(
        script,
        `$ErrorActionPreference='Stop'
. '${resolve('scripts/n8n/windows/Acceptance-PublicRuntime.ps1').replaceAll("'", "''")}'
$paths=@(Get-M03AcceptancePublicFiles '${resolve('.').replaceAll("'", "''")}')
foreach($required in @('scripts/db/m03-foundation-forward-dev-migration-packet.json','scripts/db/foundation-forward-postcheck.sql','supabase/migrations/20261023163755_m03_foundation_window_continuation.sql')){if($paths -cnotcontains $required){throw 'FORWARD_SOURCE_NOT_SEALED'}}
Write-Output 'FORWARD_CLOSURE_PASS'
`,
      );
      const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', script], {
        env: safeEnvironment(directory),
        encoding: 'utf8',
        windowsHide: true,
        timeout: 20000,
      });
      assert.equal(result.status, 0, result.stderr + result.stdout);
      assert.equal(result.stderr, '');
      assert.equal(result.stdout.trim(), 'FORWARD_CLOSURE_PASS');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
);
function writerClosureFixture(directory) {
  const root = join(directory, 'fixture');
  const physical = (name) => join(root, 'node_modules/.pnpm', writerPackages[name][1], 'node_modules', name);
  for (const [name, [, folder]] of Object.entries(writerPackages)) {
    const from = resolve('node_modules/.pnpm', folder, 'node_modules', name);
    cpSync(from, physical(name), { recursive: true });
  }
  for (const [name, [, , deps]] of Object.entries(writerPackages))
    for (const dep of deps) symlinkSync(physical(dep), join(physical(name), '..', dep), 'junction');
  mkdirSync(join(root, 'apps/web/node_modules'), { recursive: true });
  symlinkSync(physical('pg'), join(root, 'apps/web/node_modules/pg'), 'junction');
  const module = join(directory, 'Acceptance-PublicRuntime.ps1');
  cpSync(resolve('scripts/n8n/windows/Acceptance-PublicRuntime.ps1'), module);
  return { root, module, physical };
}

test(
  'public Writer closure enumerates installed executable/manifests without Node or credential access',
  windowsOnly,
  () => {
    const directory = mkdtempSync(join(tmpdir(), 'emr-writer-public-'));
    try {
      const f = writerClosureFixture(directory);
      const script = join(directory, 'public.ps1');
      writeFileSync(
        script,
        `$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
. '${f.module.replaceAll("'", "''")}'
$paths=@(Get-M03AcceptancePgPublicFiles '${f.root.replaceAll("'", "''")}')
if($paths.Count -lt 50 -or $paths -cnotcontains 'node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/client.js' -or $paths -cnotcontains 'node_modules/.pnpm/pg-cloudflare@1.4.1/node_modules/pg-cloudflare/package.json'){exit 1}
Write-Output 'PG_PUBLIC_ENUMERATION_PASS'
`,
      );
      const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', script], {
        env: safeEnvironment(directory),
        encoding: 'utf8',
        windowsHide: true,
        timeout: 20000,
      });
      assert.equal(r.status, 0, r.stderr + r.stdout);
      assert.equal(r.stderr, '');
      assert.equal(r.stdout.trim(), 'PG_PUBLIC_ENUMERATION_PASS');
      const source = readFileSync(f.module, 'utf8');
      assert.match(source, /'scripts\/n8n\/gw01-writer\.mjs'/);
      assert.match(source, /'apps\/web\/package\.json'/);
      assert.match(source, /'scripts\/seed\/certs\/supabase-root-2021\.crt'/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
);

test(
  'public Writer closure refuses retargeted resolution and changed executable bytes before private use',
  windowsOnly,
  () => {
    const directory = mkdtempSync(join(tmpdir(), 'emr-writer-public-deny-'));
    try {
      const f = writerClosureFixture(directory);
      const script = join(directory, 'public-deny.ps1');
      writeFileSync(
        script,
        `$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
. '${f.module.replaceAll("'", "''")}'
$root='${f.root.replaceAll("'", "''")}'
$paths=@(Get-M03AcceptancePgPublicFiles $root);$files=[ordered]@{}
foreach($path in $paths){$files[$path]=(Get-FileHash -LiteralPath (Join-Path $root $path) -Algorithm SHA256).Hash.ToLowerInvariant()}
function Get-M03AcceptancePublicFiles($Root){return Get-M03AcceptancePgPublicFiles $Root}
function Import-M03AcceptanceFoundationPublicModule { return '${join(directory, 'tail.ps1').replaceAll("'", "''")}' }
[IO.File]::WriteAllText('${join(directory, 'tail.ps1').replaceAll("'", "''")}', 'function Assert-M03FoundationPublicRuntimeSeal { return "synthetic-node" }; function Assert-M03AcceptanceVercelClosure {}')
$seal=[PSCustomObject]@{version=1;windowId='df4f29ec-e2dc-4d82-a276-62a4e695e6f9';approvedHead='f42930f90c2de43c84f61ad6d966d0ee6074d70e';approvedPacketSha256='009415eccce00939fe5731e846d006728295522fd90849555c197b931ad6a712';files=[PSCustomObject]$files;base=[PSCustomObject]@{node=[PSCustomObject]@{path='synthetic-node'}};vercel=[PSCustomObject]@{}}
$null=Assert-M03AcceptancePublicSeal $root $seal
$code=Join-Path $root 'node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/client.js'
$original=[IO.File]::ReadAllText($code);[IO.File]::WriteAllText($code,$original+'// public synthetic drift')
try{$null=Assert-M03AcceptancePublicSeal $root $seal;exit 1}catch{if($_.Exception.Message -cne 'M03_ACCEPTANCE_SOURCE_BLOCKED'){exit 1}}
[IO.File]::WriteAllText($code,$original)
$link=Join-Path $root 'apps/web/node_modules/pg';[IO.Directory]::Delete($link)
$null=New-Item -ItemType Junction -Path $link -Target (Join-Path $root 'node_modules/.pnpm/pg-types@2.2.0/node_modules/pg-types')
try{$null=Get-M03AcceptancePgPublicFiles $root;exit 1}catch{if($_.Exception.Message -cne 'M03_ACCEPTANCE_SOURCE_BLOCKED'){exit 1}}
Write-Output 'PG_PUBLIC_DRIFT_REFUSED'
`,
      );
      const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', script], {
        env: safeEnvironment(directory),
        encoding: 'utf8',
        windowsHide: true,
        timeout: 30000,
      });
      assert.equal(r.status, 0, r.stderr + r.stdout);
      assert.equal(r.stderr, '');
      assert.equal(r.stdout.trim(), 'PG_PUBLIC_DRIFT_REFUSED');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
);

test(
  'public Writer closure rejects transitive/native/shadow resolution and omits unresolvable optional code',
  windowsOnly,
  () => {
    const directory = mkdtempSync(join(tmpdir(), 'emr-writer-transitive-deny-'));
    try {
      const f = writerClosureFixture(directory);
      const script = join(directory, 'transitive-deny.ps1');
      writeFileSync(
        script,
        `$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
. '${f.module.replaceAll("'", "''")}'
$root='${f.root.replaceAll("'", "''")}'
$before=@(Get-M03AcceptancePgPublicFiles $root)
$modules=Join-Path $root 'node_modules/.pnpm/pg-types@2.2.0/node_modules'
$link=Join-Path $modules 'postgres-array';[IO.Directory]::Delete($link)
$null=New-Item -ItemType Junction -Path $link -Target (Join-Path $root 'node_modules/.pnpm/postgres-bytea@1.0.1/node_modules/postgres-bytea')
try{$null=Get-M03AcceptancePgPublicFiles $root;exit 1}catch{if($_.Exception.Message -cne 'M03_ACCEPTANCE_SOURCE_BLOCKED'){exit 1}}
[IO.Directory]::Delete($link);$null=New-Item -ItemType Junction -Path $link -Target (Join-Path $root 'node_modules/.pnpm/postgres-array@2.0.0/node_modules/postgres-array')
$native=Join-Path $root 'node_modules/pg-native';$null=New-Item -ItemType Directory -Path $native
try{$null=Get-M03AcceptancePgPublicFiles $root;exit 1}catch{if($_.Exception.Message -cne 'M03_ACCEPTANCE_SOURCE_BLOCKED'){exit 1}}
[IO.Directory]::Delete($native)
$shadow=Join-Path $root 'node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/node_modules';$null=New-Item -ItemType Directory -Path $shadow
try{$null=Get-M03AcceptancePgPublicFiles $root;exit 1}catch{if($_.Exception.Message -cne 'M03_ACCEPTANCE_SOURCE_BLOCKED'){exit 1}}
[IO.Directory]::Delete($shadow)
[IO.Directory]::Delete((Join-Path $root 'node_modules/.pnpm/pg@8.23.1/node_modules/pg-cloudflare'))
$withoutOptional=@(Get-M03AcceptancePgPublicFiles $root)
if($withoutOptional.Count -ge $before.Count -or @($withoutOptional|Where-Object {$_ -like '*/pg-cloudflare/*'}).Count -ne 0){exit 1}
Write-Output 'PG_TRANSITIVE_RESOLUTION_PASS'
`,
      );
      const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', script], {
        env: safeEnvironment(directory),
        encoding: 'utf8',
        windowsHide: true,
        timeout: 30000,
      });
      assert.equal(r.status, 0, r.stderr + r.stdout);
      assert.equal(r.stderr, '');
      assert.equal(r.stdout.trim(), 'PG_TRANSITIVE_RESOLUTION_PASS');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
);

test('public helper syntax is parsed without running a private consumer', windowsOnly, () => {
  const directory = mkdtempSync(join(tmpdir(), 'emr-acceptance-syntax-'));
  try {
    const script = join(directory, 'syntax.ps1');
    const paths = names
      .map((name) => "'" + resolve('scripts/n8n/windows', name).replaceAll("'", "''") + "'")
      .join(',');
    writeFileSync(
      script,
      `$ErrorActionPreference='Stop'
foreach($path in @(${paths})){
 $tokens=$null;$errors=$null
 $null=[Management.Automation.Language.Parser]::ParseFile($path,[ref]$tokens,[ref]$errors)
 if($errors.Count -ne 0){Write-Output 'PUBLIC_SYNTAX_FAILED';exit 1}
}
Write-Output 'PUBLIC_SYNTAX_PASS: 4'
`,
    );
    const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', script], {
      env: safeEnvironment(directory),
      encoding: 'utf8',
      windowsHide: true,
      timeout: 10000,
    });
    assert.equal(r.status, 0);
    assert.equal(r.stderr, '');
    assert.equal(r.stdout.trim(), 'PUBLIC_SYNTAX_PASS: 4');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test(
  'missing public seal refuses before any private read and preserves synthetic handoffs',
  windowsOnly,
  () => {
    const directory = mkdtempSync(join(tmpdir(), 'emr-acceptance-source-guard-'));
    try {
      const scripts = join(directory, 'scripts', 'n8n', 'windows');
      mkdirSync(scripts, { recursive: true });
      mkdirSync(join(directory, 'Temp'));
      const script = join(scripts, 'Invoke-M03Acceptance.ps1');
      writeFileSync(script, readFileSync(resolve('scripts/n8n/windows/Invoke-M03Acceptance.ps1')));
      const canaryPath = join(directory, 'Temp', 'emr-m03-acceptance-management.dpapi');
      const canary = 'synthetic-not-a-real-ciphertext';
      writeFileSync(canaryPath, canary);
      const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', script], {
        env: safeEnvironment(directory),
        encoding: 'utf8',
        windowsHide: true,
        timeout: 10000,
      });
      assert.equal(r.status, 1);
      assert.equal(r.stderr, '');
      const receipt = JSON.parse(r.stdout);
      assert.equal(receipt.code, 'M03_ACCEPTANCE_BLOCKED');
      assert.equal(receipt.privateRead, false);
      assert.equal(receipt.childClosed, true);
      assert.equal(readFileSync(canaryPath, 'utf8'), canary);
      assert.doesNotMatch(r.stdout, /synthetic-not-a-real-ciphertext/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
);

test('private wrapper does not auto-build seals, reveal child stderr or set password arguments', () => {
  const source = readFileSync(resolve('scripts/n8n/windows/Invoke-M03Acceptance.ps1'), 'utf8');
  assert.match(source, /Assert-M03AcceptancePublicSeal/);
  assert.match(source, /EnvironmentVariables\.Clear\(\)/);
  assert.match(source, /StandardInput\.WriteLine\(\(\$packet/);
  assert.match(source, /SecureStringToBSTR/);
  assert.match(source, /ZeroFreeBSTR/);
  assert.doesNotMatch(source, /New-M03AcceptancePublicSeal|New-M03FoundationPublicRuntimeSeal/);
  assert.doesNotMatch(
    source,
    /Write-(Output|Host|Error).*\$(private|packet|cipher|bypass|machine|errorTask)/,
  );
  assert.doesNotMatch(source, /Arguments\s*=.*\$(private|packet|cipher|bypass|machine)/);
});

test(
  'private output projection refuses actual secret reflections and unknown workflow IDs',
  windowsOnly,
  () => {
    const directory = mkdtempSync(join(tmpdir(), 'emr-acceptance-output-'));
    try {
      const source = readFileSync(resolve('scripts/n8n/windows/Invoke-M03Acceptance.ps1'), 'utf8');
      const start = source.indexOf('function Safe-PublicLine');
      const end = source.indexOf('\ntry{', start);
      assert.ok(start > 0 && end > start);
      const cases = [
        { kind: 'm03_acceptance_result', id: 'local1', status: 'blocked', residual: true },
        { kind: 'm03_acceptance_result', id: 'sql1', status: 'sql_acceptance_unresolved', residual: true },
        { kind: 'm03_acceptance_result', id: 'PrivateKeyAlpha47', status: 'blocked' },
        { kind: 'mcp_port_request', nonce: 'fixtureNonce', action: 'details', workflowId: 'FixtureWFID' },
        { kind: 'mcp_port_request', nonce: 'fixtureNonce', action: 'details', workflowId: 'OtherWorkflow' },
        {
          kind: 'mcp_port_request',
          nonce: 'PrivateKeyAlpha47',
          action: 'details',
          workflowId: 'FixtureWFID',
        },
        { kind: 'm03_acceptance_result', status: 'blocked', rawError: 'PrivateKeyAlpha47' },
        { kind: 'm03_acceptance_result', status: 'blocked', residual: 'false' },
        { kind: 'm03_acceptance_result', status: 'blocked', executionIds: ['123456'] },
        { kind: 'm03_acceptance_result', status: 'sql_acceptance_unresolved', residual: true },
        {
          kind: 'm03_acceptance_result',
          status: 'blocked',
          baselineWorkflowKey: 'WF-00',
          baselineFailureCodes: ['version_mismatch'],
          baselineNameEqual: true,
          baselineNodesEqual: true,
          baselineConnectionsEqual: true,
          baselineSettingsEqual: true,
        },
        { kind: 'm03_acceptance_result', status: 'blocked', baselineFailureCodes: ['PrivateKeyAlpha47'] },
        { kind: 'm03_acceptance_result', status: 'blocked', baselineWorkflowKey: 'Foreign' },
        { kind: 'm03_acceptance_result', status: 'blocked', baselineNameEqual: 'true' },
        {
          kind: 'm03_acceptance_result',
          status: 'prepared',
          approvedHead: 'f42930f90c2de43c84f61ad6d966d0ee6074d70e',
          sourceCommitSha: 'a5e746736893d5040e93032ae740a0878f748837',
        },
        {
          kind: 'm03_acceptance_result',
          status: 'prepared',
          approvedHead: 'a5e746736893d5040e93032ae740a0878f748837',
          sourceCommitSha: 'a5e746736893d5040e93032ae740a0878f748837',
        },
        {
          kind: 'm03_acceptance_result',
          status: 'prepared',
          approvedHead: 'f42930f90c2de43c84f61ad6d966d0ee6074d70e',
          sourceCommitSha: 'c'.repeat(40),
        },
      ];
      const script = join(directory, 'projection.ps1');
      writeFileSync(
        script,
        `$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$script:closureVerified=$false
$needles=[Collections.Generic.List[string]]::new();$needles.Add('PrivateKeyAlpha47');$needles.Add('123456')
$knownWorkflowIds=[Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal);$null=$knownWorkflowIds.Add('FixtureWFID')
${source.slice(start, end)}
$cases=ConvertFrom-Json -InputObject '${JSON.stringify(cases).replaceAll("'", "''")}'
$out=@();foreach($value in $cases){try{$null=Safe-PublicLine $value;$out+='accepted'}catch{$out+='rejected'}}
$out|ConvertTo-Json -Compress
`,
      );
      const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', script], {
        env: safeEnvironment(directory),
        encoding: 'utf8',
        windowsHide: true,
        timeout: 10000,
      });
      assert.equal(r.status, 0);
      assert.equal(r.stderr, '');
      assert.deepEqual(JSON.parse(r.stdout), [
        'accepted',
        'accepted',
        'rejected',
        'accepted',
        'rejected',
        'rejected',
        'rejected',
        'rejected',
        'rejected',
        'accepted',
        'accepted',
        'rejected',
        'rejected',
        'rejected',
        'accepted',
        'rejected',
        'rejected',
      ]);
      assert.doesNotMatch(r.stdout, /PrivateKeyAlpha47/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
);

test(
  'public protocol IO refuses oversized lines and text before appending beyond its cap',
  windowsOnly,
  () => {
    const directory = mkdtempSync(join(tmpdir(), 'emr-acceptance-io-'));
    try {
      const source = readFileSync(resolve('scripts/n8n/windows/Invoke-M03Acceptance.ps1'), 'utf8');
      const start = source.indexOf('function Initialize-BoundedIo');
      const end = source.indexOf('function Invoke-PublicCompositionCheck', start);
      const script = join(directory, 'io.ps1');
      writeFileSync(
        script,
        `$ErrorActionPreference='Stop'
${source.slice(start, end)}
Initialize-BoundedIo
$out=@()
$r=[IO.StringReader]::new("safe\nnext")
if([EmrM03AcceptanceBoundedIo]::Line($r,4).GetAwaiter().GetResult() -cne 'safe'){exit 1}
if([EmrM03AcceptanceBoundedIo]::Line($r,4).GetAwaiter().GetResult() -cne 'next'){exit 1}
$r.Dispose();$out+='bounded_line_pass'
try{$r=[IO.StringReader]::new('oversize');$null=[EmrM03AcceptanceBoundedIo]::Line($r,4).GetAwaiter().GetResult();exit 1}catch{$out+='line_refused'}finally{$r.Dispose()}
try{$r=[IO.StringReader]::new('oversize');$null=[EmrM03AcceptanceBoundedIo]::Text($r,4).GetAwaiter().GetResult();exit 1}catch{$out+='text_refused'}finally{$r.Dispose()}
$out|ConvertTo-Json -Compress
`,
      );
      const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', script], {
        env: safeEnvironment(directory),
        encoding: 'utf8',
        windowsHide: true,
        timeout: 15000,
      });
      assert.equal(r.status, 0);
      assert.equal(r.stderr, '');
      assert.deepEqual(JSON.parse(r.stdout), ['bounded_line_pass', 'line_refused', 'text_refused']);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
);
