import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync, spawn } from 'node:child_process';
import { gunzipSync } from 'node:zlib';

// This vertical custody fixture uses the actual Windows wrapper and public
// module with its fixed Vercel root rebound to an isolated public fixture,
// synthetic DPAPI values, a scripted CLI and a scripted DB check. The base
// dependency validator is a fixture stub. This is neither actual
// dependency-closure verification nor hosted/provider/native acceptance.
const head = 'f42930f90c2de43c84f61ad6d966d0ee6074d70e';
const packetHash = '009415eccce00939fe5731e846d006728295522fd90849555c197b931ad6a712';
const windowId = 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9';
const quoted = (v) => "'" + v.replaceAll("'", "''") + "'";
const secretValues = ['SyntheticManagement47', 'SyntheticWriter58', 'SyntheticApifyRead69'];
async function runFixture(variant) {
  const continuation = variant.startsWith('postcheck_');
  const amended = variant.startsWith('clock_') || continuation;
  const mode = variant.replace(/^(?:clock_|postcheck_)/, '');
  const root = mkdtempSync(join(tmpdir(), 'emr-acceptance-custody-'));
  const put = (name, text) => {
    const path = join(root, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
  };
  const environment = {
    SystemRoot: process.env.SystemRoot,
    WINDIR: process.env.WINDIR,
    PATH: process.env.PATH,
    TEMP: root,
    TMP: root,
    LOCALAPPDATA: root,
    PGPASSWORD: 'SyntheticParentPasswordMustNotReachChild',
  };
  try {
    mkdirSync(join(root, 'Temp'));
    mkdirSync(join(root, 'n8n/workflows'), { recursive: true });
    const fixtureVercelRoot = join(root, 'public-vercel-fixture');
    const publicModule = readFileSync(
      resolve('scripts/n8n/windows/Acceptance-PublicRuntime.ps1'),
      'utf8',
    ).replaceAll('C:\\Users\\iway\\AppData\\Roaming\\npm\\node_modules\\vercel', fixtureVercelRoot);
    put('public-vercel-fixture/package.json', JSON.stringify({ name: 'vercel', version: '56.5.0' }));
    put('public-vercel-fixture/dist/index.js', '// synthetic public fixture\n');
    put('public-vercel-fixture/node_modules/fixture-dependency/index.js', '// synthetic dependency\n');
    const files = [...publicModule.matchAll(/^  '([^']+)'/gm)].map((m) => m[1]);
    for (const name of files) put(name, '// scripted public fixture\n');
    for (const name of [
      'Acceptance-PublicRuntime.ps1',
      'Invoke-M03Acceptance.ps1',
      'New-M03AcceptanceHandoff.ps1',
    ])
      put('scripts/n8n/windows/' + name, readFileSync(resolve('scripts/n8n/windows', name)));
    put('scripts/n8n/windows/Acceptance-PublicRuntime.ps1', publicModule);
    put(
      'scripts/n8n/windows/Foundation-PublicRuntime.ps1',
      `function Assert-M03FoundationPublicRuntimeSeal { param($RepositoryRoot,$Seal,$SelectedNodeExecutable) return $SelectedNodeExecutable }\n`,
    );
    put(
      'scripts/db/windows/Invoke-M03FoundationMigrations.ps1',
      `param([switch]$CheckOnly,[switch]$PhaseAControl,[switch]$ClockAmendment,[switch]$PostcheckContinuation)\nif(-not $CheckOnly -or -not $PhaseAControl${continuation ? ' -or -not $PostcheckContinuation -or $ClockAmendment' : ''}){exit 1}\n${mode === 'public_stale' ? "Write-Output 'M03_FOUNDATION HANDOFF_LEASE_NOT_READY. Synthetic public fixture only.';exit 2" : "Write-Output 'M03_FOUNDATION CHECK_ONLY_READY. Synthetic public fixture only.';exit 0"}\n`,
    );
    for (const name of ['n8n/foundation/bindings.dev.json', 'scripts/n8n/foundation-delivery-packet.json'])
      put(name, readFileSync(resolve(name)));
    if (amended) {
      for (const name of [
        'scripts/n8n/foundation-live-clock-amendment.mjs',
        'scripts/n8n/foundation-live-zero-setup.mjs',
        'scripts/n8n/foundation-control-state.mjs',
        'scripts/n8n/foundation-runtime-checkpoint.mjs',
        'milestones/M03-n8n-foundation/evidence/dev-acceptance-clock-approval-20261021.json',
        'milestones/M03-n8n-foundation/evidence/dev-acceptance-clock-amendment-20261021.md',
        'milestones/M03-n8n-foundation/evidence/dev-acceptance-late-delivery-20261021.json',
        'milestones/M03-n8n-foundation/evidence/dev-acceptance-zero-setup-20261021.json',
      ])
        put(name, readFileSync(resolve(name)));
      put(
        'scripts/n8n/out/foundation/live/management.jsonl',
        JSON.stringify({
          event: 'management_header',
          version: 1,
          sourceCommitSha: head,
          deadlineAt: 1792584023481,
        }) + '\n',
      );
    }
    if (continuation) {
      for (const name of [
        'milestones/M03-n8n-foundation/evidence/dev-acceptance-postcheck-approval-20261021.json',
        'milestones/M03-n8n-foundation/evidence/dev-acceptance-postcheck-checkpoint-20261021.json',
        'milestones/M03-n8n-foundation/evidence/dev-acceptance-postcheck-continuation-20261021.md',
        'milestones/M03-n8n-foundation/evidence/dev-acceptance-amended-attempt-20261021.json',
      ])
        put(name, readFileSync(resolve(name)));
      const snapshot = JSON.parse(
        readFileSync(
          resolve('milestones/M03-n8n-foundation/evidence/dev-acceptance-postcheck-checkpoint-20261021.json'),
          'utf8',
        ),
      );
      for (const [name, record] of Object.entries(snapshot.retainedFiles))
        put(
          name,
          record.text ??
            gunzipSync(readFileSync(resolve('scripts/n8n/fixtures/foundation-hosted-types-20261021.ts.gz'))),
        );
      // The prior-PID query is an explicit synthetic port in this copied fixture;
      // an unrelated future OS PID reuse must not make custody tests nondeterministic.
      const moduleName = 'scripts/n8n/foundation-live-postcheck-continuation.mjs',
        actual = readFileSync(resolve(moduleName), 'utf8'),
        isolated = actual.replace(/process\.kill\(pid, 0\);\s*return true;/, 'return false;');
      assert.notEqual(isolated, actual);
      put(moduleName, isolated);
    }
    put(
      'scripts/n8n/foundation-live-runtime-cli.mjs',
      `import assert from 'node:assert/strict';
import {createInterface} from 'node:readline';
${continuation ? "import {readFoundationPostcheckContinuation,claimFoundationPostcheckContinuation} from './foundation-live-postcheck-continuation.mjs';" : amended ? "import {readFoundationClockAmendment,claimFoundationClockAmendment} from './foundation-live-clock-amendment.mjs';" : ''}
const send=(v)=>process.stdout.write(JSON.stringify(v)+'\\n');
if(process.argv[2]==='CheckOnly') {send({kind:'m03_acceptance_ready',status:'check_only_execution_port_required',privateRead:false,networkCalls:0,knownWorkflows:25,managementMaximum:512,controlMaximum:2048,actualMcpPortVerified:false,concreteVercelCliPresent:true,concreteAdminHelperPresent:true});}
else if(process.argv[2]==='${continuation ? 'SessionPostcheckContinuation' : amended ? 'SessionClockAmendment' : 'Session'}') {
 ${continuation ? 'const clock=claimFoundationPostcheckContinuation(readFoundationPostcheckContinuation());assert.equal(clock.deadlineAt-clock.startsAt,3600000);' : amended ? 'const clock=claimFoundationClockAmendment(readFoundationClockAmendment());assert.equal(clock.deadlineAt-clock.startsAt,3600000);' : ''}
 const lines=createInterface({input:process.stdin});let initialized=false;
 for await(const line of lines){const v=JSON.parse(line);if(!initialized){
  assert.equal(v.managementKey,${JSON.stringify(secretValues[0])});assert.equal(v.writerPassword,${JSON.stringify(secretValues[1])});assert.equal(v.apifyReadToken,${JSON.stringify(secretValues[2])});
  assert.equal(v.machineToken,'Z'.repeat(43));assert.match(v.protectionBypass,/^[A-Za-z0-9]{32}$/);assert.equal(process.env.PGPASSWORD,undefined);
  assert.equal(v.approvedHead,'${head}');assert.equal(v.sourceCommitSha,'${head}');initialized=true;
  send({kind:'m03_acceptance_ready',status:'private_child_ready'});
 }else if(v.command==='close'){
  send({kind:'m03_acceptance_closed',status:'${mode === 'residual' ? 'residual' : 'closed'}',baselineRestored:true,environmentCleanupVerified:${mode !== 'residual'},windowClosed:true,remoteWorkSettled:true,residual:${mode === 'residual'},childTransportsClosed:true,adminChildClosed:true});lines.close();process.stdin.pause();break;
 }else throw Error('SYNTHETIC_PROTOCOL_REFUSED');}
}else process.exitCode=1;
`,
    );
    const setup = join(root, 'prepare-fixture.ps1');
    writeFileSync(
      setup,
      `$ErrorActionPreference='Stop'
$root=${quoted(root)}
$global:fixturePosition=0
function Read-Host { param($Prompt,[switch]$AsSecureString) $items=@(${secretValues.map(quoted).join(',')});$value=$items[$global:fixturePosition];$global:fixturePosition++;return ConvertTo-SecureString -String $value -AsPlainText -Force }
& (Join-Path $root 'scripts/n8n/windows/New-M03AcceptanceHandoff.ps1') -Kind All
if($LASTEXITCODE -ne 0){exit 1}
$pending=Join-Path $root 'Everyone-Market-Radar-Private/foundation/${windowId}'
$null=New-Item -ItemType Directory -Path $pending -Force
$machine=ConvertTo-SecureString -String ('Z'*43) -AsPlainText -Force
try{[IO.File]::WriteAllText((Join-Path $pending 'machine.dpapi'),(ConvertFrom-SecureString -SecureString $machine))}finally{$machine.Dispose()}
$old=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText((Join-Path $root 'scripts/n8n/foundation-delivery-packet.json')))
$metadata=@{version=1;windowId='${windowId}';purpose='pending_inactive_m03_runtime_delivery';credentialId='EmrM03Machine19';audience=$old.audience;sourceCommitSha=$old.sourceCommitSha;createdAt=[DateTime]::UtcNow.ToString('o')}
[IO.File]::WriteAllText((Join-Path $pending 'pending-runtime.json'),($metadata|ConvertTo-Json -Compress))
$now=[DateTime]::UtcNow${mode === 'short_lease' ? '.AddMinutes(-49)' : ''}
$lease=@{version=1;environment='dev';projectRef='zmotjsbzhzjvpelxvxlf';purpose='m03-foundation-phase-a-dev';approvalSha='${head}';createdAt=$now.ToString('o');expiresAt=$now.AddHours(2).ToString('o')}
${mode === 'extra_lease' ? "$lease['unexpected']='refuse'" : ''}
[IO.File]::WriteAllText((Join-Path $root 'Temp/emr-m03-foundation-dev-migration-password.lease.json'),($lease|ConvertTo-Json -Compress))
[IO.File]::WriteAllText((Join-Path $root 'Temp/emr-m03-foundation-dev-migration-password.dpapi'),'synthetic_admin_never_decrypted')
. (Join-Path $root 'scripts/n8n/windows/Acceptance-PublicRuntime.ps1')
$files=[ordered]@{};foreach($name in (Get-M03AcceptancePublicFiles $root)){$files[$name]=(Get-FileHash -LiteralPath (Join-Path $root $name) -Algorithm SHA256).Hash.ToLowerInvariant()}
$baseFile='scripts/n8n/windows/Foundation-PublicRuntime.ps1'
$seal=@{version=1;windowId='${windowId}';approvedHead='${head}';approvedPacketSha256='${packetHash}';files=$files;base=@{node=@{path=${quoted(process.execPath)}};files=@{$baseFile=$files[$baseFile]}};vercel=(New-M03AcceptanceVercelClosure ${quoted(fixtureVercelRoot)})}
[IO.File]::WriteAllText((Join-Path $root 'scripts/n8n/foundation-acceptance-seal.json'),($seal|ConvertTo-Json -Depth 12))
Write-Output 'SYNTHETIC_CUSTODY_PREPARED'
`,
    );
    const prepared = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', setup], {
      env: environment,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 15000,
    });
    assert.equal(prepared.status, 0, prepared.stderr || prepared.stdout);
    assert.match(prepared.stdout, /SYNTHETIC_CUSTODY_PREPARED/);
    const result = await new Promise((done, reject) => {
      const child = spawn(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-File',
          join(root, 'scripts/n8n/windows/Invoke-M03Acceptance.ps1'),
          ...(continuation ? ['-PostcheckContinuation'] : amended ? ['-ClockAmendment'] : []),
          ...(mode === 'conflicting_modes' ? ['-ClockAmendment'] : []),
          ...(mode === 'public_stale' ? ['-CheckOnly'] : []),
        ],
        {
          env: environment,
          windowsHide: true,
          stdio: ['pipe', 'pipe', 'pipe'],
        },
      );
      let stdout = '',
        stderr = '',
        buffer = '',
        lastPublicKind = 'none';
      const timer = setTimeout(() => {
        child.stdin.end();
        spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
          windowsHide: true,
          stdio: 'ignore',
        });
        reject(Error('SYNTHETIC_WRAPPER_TIMEOUT ' + lastPublicKind));
      }, 35000);
      child.on('error', reject);
      child.stdout.on('data', (chunk) => {
        stdout += chunk;
        buffer += chunk;
        while (buffer.includes('\n')) {
          const at = buffer.indexOf('\n'),
            line = buffer.slice(0, at).trim();
          buffer = buffer.slice(at + 1);
          if (!line) continue;
          const value = JSON.parse(line);
          lastPublicKind = value.kind;
          if (value.kind === 'm03_acceptance_transport_ready') {
            if (mode === 'transport_eof') child.stdin.end();
            else if (mode !== 'transport_silent')
              child.stdin.write(
                JSON.stringify({ kind: 'm03_acceptance_transport_ack', nonce: value.nonce }) + '\n',
              );
          }
          if (value.kind === 'm03_acceptance_ready')
            child.stdin.write(
              JSON.stringify({ kind: 'm03_acceptance_command', id: 'fixture_close', command: 'close' }) +
                '\n',
            );
        }
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk;
      });
      child.on('close', (status) => {
        clearTimeout(timer);
        done({ status, stdout, stderr });
      });
    });
    assert.equal(result.stderr, '');
    for (const value of [...secretValues, 'Z'.repeat(43), 'SyntheticParentPasswordMustNotReachChild'])
      assert.equal((result.stdout + result.stderr).includes(value), false);
    const rows = result.stdout
      .trim()
      .split(/\r?\n/)
      .map((line) => JSON.parse(line));
    const receipt = rows.at(-1);
    if (mode === 'public_stale') {
      assert.equal(result.status, 0);
      assert.equal(receipt.status, 'check_only_ready');
      assert.equal(receipt.adminPublicInputsVerified, true);
      assert.equal(receipt.adminHandoffReady, false);
      assert.equal(receipt.privateRead, false);
      for (const kind of ['management', 'writer', 'apifyread'])
        assert.equal(existsSync(join(root, 'Temp', `emr-m03-acceptance-${kind}.dpapi`)), true);
    } else if (
      mode === 'short_lease' ||
      mode === 'extra_lease' ||
      mode === 'conflicting_modes' ||
      mode === 'transport_eof' ||
      mode === 'transport_silent'
    ) {
      assert.equal(result.status, 1);
      assert.equal(receipt.privateRead, false);
      assert.equal(receipt.handoffsDeleted, false);
      for (const kind of ['management', 'writer', 'apifyread'])
        assert.equal(existsSync(join(root, 'Temp', `emr-m03-acceptance-${kind}.dpapi`)), true);
    } else {
      assert.equal(result.status, mode === 'residual' ? 1 : 0);
      assert.equal(rows.find((row) => row.kind === 'm03_acceptance_ready').status, 'private_child_ready');
      assert.equal(receipt.childClosed, true);
      assert.equal(receipt.handoffsDeleted, true);
      assert.equal(receipt.pendingMachinePreserved, true);
      assert.equal(receipt.bypassHandoffDeleted, mode !== 'residual');
      for (const kind of ['management', 'writer', 'apifyread'])
        for (const suffix of ['dpapi', 'lease.json'])
          assert.equal(existsSync(join(root, 'Temp', `emr-m03-acceptance-${kind}.${suffix}`)), false);
    }
    assert.equal(
      existsSync(join(root, 'Everyone-Market-Radar-Private/foundation', windowId, 'machine.dpapi')),
      true,
    );
    assert.equal(existsSync(join(root, 'Temp/emr-m03-foundation-dev-migration-password.dpapi')), true);
    assert.equal(
      existsSync(join(root, 'Temp/emr-m03-acceptance-protection-bypass.dpapi')),
      mode === 'residual',
    );
    if (amended) {
      const live = join(root, 'scripts/n8n/out/foundation/live');
      assert.equal(
        readFileSync(join(live, 'management.jsonl'), 'utf8'),
        JSON.stringify({
          event: 'management_header',
          version: 1,
          sourceCommitSha: head,
          deadlineAt: 1792584023481,
        }) + '\n',
      );
      const stem = continuation
        ? 'postcheck-continuation-a570212a-634c-444f-90a2-578ae47e8d27'
        : 'clock-amendment-30e75d0d-7e4c-46c6-9a07-556f90b63859';
      const admitted = existsSync(join(live, stem + '.json'));
      assert.equal(admitted, mode === 'complete');
      assert.equal(existsSync(join(live, stem + '.runtime-claim.json')), mode === 'complete');
      if (continuation) {
        const checkpoint = JSON.parse(
          readFileSync(
            resolve(
              'milestones/M03-n8n-foundation/evidence/dev-acceptance-postcheck-checkpoint-20261021.json',
            ),
            'utf8',
          ),
        );
        for (const [name, record] of Object.entries(checkpoint.retainedFiles)) {
          const text =
            record.text ??
            gunzipSync(
              readFileSync(resolve('scripts/n8n/fixtures/foundation-hosted-types-20261021.ts.gz')),
            ).toString('utf8');
          assert.equal(readFileSync(join(root, name), 'utf8'), text);
        }
      }
    }
  } finally {
    assert.ok(resolve(root).startsWith(resolve(tmpdir()) + '\\emr-acceptance-custody-'));
    rmSync(root, { recursive: true, force: true });
  }
}
for (const mode of [
  'complete',
  'residual',
  'short_lease',
  'extra_lease',
  'transport_eof',
  'transport_silent',
  'clock_complete',
  'clock_short_lease',
  'clock_transport_eof',
  'clock_public_stale',
  'postcheck_complete',
  'postcheck_short_lease',
  'postcheck_transport_eof',
  'postcheck_public_stale',
  'postcheck_conflicting_modes',
])
  test(
    `actual Windows custody wrapper with scripted private child: ${mode}`,
    { skip: process.platform !== 'win32' },
    () => runFixture(mode),
  );
