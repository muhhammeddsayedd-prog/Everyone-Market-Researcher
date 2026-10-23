import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  cpSync,
} from 'node:fs';
import { resolve, join, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';
const env = () =>
  Object.fromEntries(
    ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP', 'LOCALAPPDATA', 'APPDATA', 'USERPROFILE'].flatMap((k) =>
      process.env[k] === undefined ? [] : [[k, process.env[k]]],
    ),
  );
test('credential-free CheckOnly never reads stdin or invokes network; source stays distinct from GW-01', () => {
  const r = spawnSync(process.execPath, ['scripts/n8n/foundation-provision-cli.mjs', 'CheckOnly'], {
    encoding: 'utf8',
    env: env(),
    timeout: 10000,
    windowsHide: true,
  });
  assert.equal(r.status, 0);
  assert.equal(r.stderr, '');
  const p = JSON.parse(r.stdout);
  assert.equal(p.privateRead, false);
  assert.equal(p.networkRequests, 0);
  assert.equal(p.maximumCreates, 25);
  assert.equal(p.finalBindingReady, existsSync('scripts/n8n/foundation-delivery-packet.json'));
  assert.equal(p.windowId, 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9');
});
test('isolated All without a public delivery packet blocks before stdin/private read on every platform', () => {
  const root = mkdtempSync(join(tmpdir(), 'emr-foundation-absent-packet-test-'));
  try {
    const list = readFileSync('scripts/n8n/windows/Foundation-PublicRuntime.ps1', 'utf8');
    const relatives = [...list.matchAll(/^  '([^']+)'/gm)].map((x) => x[1]);
    assert.equal(relatives.length, 39);
    for (const relative of relatives) {
      const target = join(root, relative);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, readFileSync(relative));
    }
    const physical = join(root, 'node_modules/.pnpm/zod@4.6.7/node_modules/zod');
    mkdirSync(dirname(physical), { recursive: true });
    cpSync(resolve('node_modules/.pnpm/zod@4.6.7/node_modules/zod'), physical, { recursive: true });
    const shared = join(root, 'packages/shared/node_modules');
    mkdirSync(shared, { recursive: true });
    symlinkSync(physical, join(shared, 'zod'), process.platform === 'win32' ? 'junction' : 'dir');
    const r = spawnSync(process.execPath, [join(root, 'scripts/n8n/foundation-provision-cli.mjs'), 'All'], {
      encoding: 'utf8',
      env: env(),
      cwd: root,
      input: 'PUBLIC_SYNTHETIC_NEVER_READ',
      timeout: 10000,
      windowsHide: true,
    });
    assert.equal(r.status, 1);
    assert.equal(r.stderr, '');
    const p = JSON.parse(r.stdout);
    assert.equal(p.privateReadAttempted, false);
    assert.equal(p.completionVerified, false);
  } finally {
    assert.equal(dirname(root), tmpdir());
    assert.ok(basename(root).startsWith('emr-foundation-absent-packet-test-'));
    rmSync(root, { recursive: true, force: true });
  }
});

test('handoff and bounded consumer use only distinct purpose/paths; no key in argv or child environment', () => {
  const h = readFileSync('scripts/n8n/windows/New-M03FoundationHandoff.ps1', 'utf8'),
    c = readFileSync('scripts/n8n/windows/Invoke-M03FoundationProvision.ps1', 'utf8');
  for (const source of [h, c]) {
    assert.ok(source.includes('emr-m03-foundation-management.dpapi'));
    assert.equal(source.includes('emr-m03-gw01-'), false);
    assert.equal(source.includes('PGPASSWORD'), false);
    assert.equal(source.includes('SUPABASE'), false);
  }
  assert.ok(c.includes('$child.StandardInput.Write'));
  assert.equal(c.includes("EnvironmentVariables['M03_N8N_API_KEY']"), false);
  assert.ok(c.includes('$child.Kill()'));
  assert.ok(c.includes('[IO.File]::Delete($handoff)'));
});
test(
  'actual PowerShell staging-success guard rejects incomplete or canonical-routing claims without private reads',
  { skip: process.platform !== 'win32' },
  () => {
    const source = readFileSync('scripts/n8n/windows/Invoke-M03FoundationProvision.ps1', 'utf8');
    const statement = source
      .split(/\r?\n/)
      .find((line) =>
        line.includes("$Mode -ceq 'All' -and $result.status -ceq 'inactive_foundation_staged'"),
      );
    assert.ok(statement, 'exercise the actual consumer guard rather than a duplicate validator');
    const valid = {
      status: 'inactive_foundation_staged',
      verifiedWorkflows: 25,
      inactiveDefinitionsSaved: true,
      deferredErrorWorkflowCount: 24,
      persistedExports: 25,
      finalGraphsBound: false,
      errorRoutingAccepted: false,
    };
    const cases = [
      valid,
      ...[
        { verifiedWorkflows: 24 },
        { persistedExports: 24 },
        { deferredErrorWorkflowCount: 23 },
        { inactiveDefinitionsSaved: false },
        { finalGraphsBound: true },
        { errorRoutingAccepted: true },
      ].map((change) => ({ ...valid, ...change })),
    ];
    const root = mkdtempSync(join(tmpdir(), 'emr-foundation-stage-guard-'));
    try {
      const wrapper = join(root, 'public-guard.ps1');
      writeFileSync(
        wrapper,
        "$Mode='All';$cases=ConvertFrom-Json -InputObject '" +
          JSON.stringify(cases).replaceAll("'", "''") +
          "';$out=@();foreach($result in $cases){try{" +
          statement +
          ";$out+='accepted'}catch{$out+='rejected'}};$out|ConvertTo-Json -Compress",
      );
      const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', wrapper], {
        encoding: 'utf8',
        env: env(),
        timeout: 10000,
        windowsHide: true,
      });
      assert.equal(r.status, 0);
      assert.equal(r.stderr, '');
      assert.deepEqual(JSON.parse(r.stdout), ['accepted', ...Array(6).fill('rejected')]);
    } finally {
      assert.equal(dirname(root), tmpdir());
      assert.ok(basename(root).startsWith('emr-foundation-stage-guard-'));
      rmSync(root, { recursive: true, force: true });
    }
  },
);
test(
  'Windows hidden-prompt helper creates only fake isolated DPAPI+lease and preserves a preexisting handoff',
  { skip: process.platform !== 'win32' },
  () => {
    const root = mkdtempSync(join(tmpdir(), 'emr-foundation-handoff-test-'));
    mkdirSync(join(root, 'Temp'));
    try {
      const helper = resolve('scripts/n8n/windows/New-M03FoundationHandoff.ps1');
      const script =
        "function Read-Host { param([string]$Prompt,[switch]$AsSecureString) ConvertTo-SecureString -String 'PUBLIC_SYNTHETIC_NON_SECRET' -AsPlainText -Force }; & '" +
        helper.replaceAll("'", "''") +
        "'; exit $LASTEXITCODE";
      const wrapper = join(root, 'public-synthetic-wrapper.ps1');
      writeFileSync(wrapper, script);
      const e = { ...env(), LOCALAPPDATA: root };
      const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', wrapper], {
        encoding: 'utf8',
        env: e,
        timeout: 15000,
        windowsHide: true,
      });
      assert.equal(r.status, 0);
      assert.ok(r.stdout.includes('M03_FOUNDATION_MANAGEMENT_READY'));
      assert.equal(r.stdout.includes('PUBLIC_SYNTHETIC_NON_SECRET'), false);
      const file = join(root, 'Temp/emr-m03-foundation-management.dpapi'),
        lease = JSON.parse(
          readFileSync(join(root, 'Temp/emr-m03-foundation-management.lease.json'), 'utf8').replace(
            /^\uFEFF/,
            '',
          ),
        );
      assert.equal(existsSync(file), true);
      assert.equal(lease.purpose, 'm03_owned_inactive_provision');
      assert.equal(Date.parse(lease.expiresAt) - Date.parse(lease.createdAt), 7200000);
      const before = readFileSync(file),
        r2 = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', wrapper], {
          encoding: 'utf8',
          env: e,
          timeout: 15000,
          windowsHide: true,
        });
      assert.equal(r2.status, 1);
      assert.equal(Buffer.compare(readFileSync(file), before) === 0, true);
    } finally {
      assert.equal(dirname(root), tmpdir());
      assert.ok(basename(root).startsWith('emr-foundation-handoff-test-'));
      rmSync(root, { recursive: true, force: true });
    }
  },
);
test(
  'Windows All child protocol consumes only fake Management and retains generated pending Machine store',
  { skip: process.platform !== 'win32' },
  async () => {
    const root = mkdtempSync(join(tmpdir(), 'emr-foundation-protocol-test-')),
      repo = join(root, 'fixture-repo');
    mkdirSync(join(root, 'Temp'));
    mkdirSync(repo);
    try {
      const source = readFileSync('scripts/n8n/windows/Foundation-PublicRuntime.ps1', 'utf8');
      const relatives = [...source.matchAll(/^  '([^']+)'/gm)].map((x) => x[1]);
      for (const relative of relatives) {
        const target = join(repo, relative);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, readFileSync(relative));
      }
      const fixtureJournal = join(repo, 'scripts/n8n/out/foundation/binding-intents.jsonl');
      mkdirSync(dirname(fixtureJournal), { recursive: true });
      writeFileSync(
        fixtureJournal,
        JSON.stringify({
          version: 1,
          windowId: 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9',
          kind: 'inactive_binding_intents',
        }) + '\n',
      );
      const cli = join(repo, 'scripts/n8n/foundation-provision-cli.mjs');
      writeFileSync(
        cli,
        `import{readFileSync}from'node:fs';const p=JSON.parse(readFileSync(0,'utf8'));if(p.key!=='PUBLIC_SYNTHETIC_NON_SECRET'||!/^[A-Za-z0-9_-]{43}$/.test(p.machine))process.exit(1);process.stdout.write(JSON.stringify({version:1,windowId:'df4f29ec-e2dc-4d82-a276-62a4e695e6f9',host:'muhhammedsayed.app.n8n.cloud',projectId:'pHvQjDmjxVZ3KQLT',status:'inactive_foundation_staged',phase:'complete',requestCount:0,verifiedWorkflows:25,executionCount:0,credentialsCreated:1,gatewayWindowStarted:false,finalGraphsBound:false,inactiveDefinitionsSaved:true,deferredErrorWorkflowCount:24,errorRoutingAccepted:false,persistedExports:25,networkCompletionVerified:true,diagnostics:{lastMethod:'GET',lastResource:'owned_workflows',httpStatus:200,transportCode:'FOUNDATION_TRANSPORT_BODY',transportReason:'body_declared_limit'}})+'\\n');`,
      );
      const publicPacket = {
        version: 1,
        windowId: 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9',
        audience: 'https://everyone-market-researcher-synthetic-preview.vercel.app',
        sourceCommitSha: 'a'.repeat(40),
        deploymentId: 'dpl_SYNTHETIC',
        environment: 'preview',
        activationAuthorized: false,
      };
      const packetBytes = JSON.stringify(publicPacket);
      writeFileSync(join(repo, 'scripts/n8n/foundation-delivery-packet.json'), packetBytes);
      const physicalZod = join(repo, 'node_modules/.pnpm/zod@4.6.7/node_modules/zod');
      mkdirSync(physicalZod, { recursive: true });
      writeFileSync(join(physicalZod, 'package.json'), '{"name":"zod","version":"4.6.7","type":"module"}');
      writeFileSync(join(physicalZod, 'index.js'), 'export const publicFixture=true;');
      const sharedModules = join(repo, 'packages/shared/node_modules');
      mkdirSync(sharedModules, { recursive: true });
      symlinkSync(physicalZod, join(sharedModules, 'zod'), 'junction');
      const reseal = () => {
        const r = spawnSync(
          'powershell.exe',
          [
            '-NoProfile',
            '-NonInteractive',
            '-File',
            join(repo, 'scripts/n8n/windows/New-M03FoundationPublicSeal.ps1'),
            '-ReplaceReviewedSeal',
          ],
          { encoding: 'utf8', env: env(), timeout: 20000, windowsHide: true },
        );
        assert.equal(r.status, 0, 'isolated public fixture seal');
      };
      reseal();
      const literal = (p) => "'" + p.replaceAll("'", "''") + "'",
        wrapper = join(root, 'protocol-wrapper.ps1');
      writeFileSync(
        wrapper,
        "function Read-Host { param([string]$Prompt,[switch]$AsSecureString) ConvertTo-SecureString -String 'PUBLIC_SYNTHETIC_NON_SECRET' -AsPlainText -Force }; & " +
          literal(join(repo, 'scripts/n8n/windows/New-M03FoundationHandoff.ps1')) +
          '; if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}; & ' +
          literal(join(repo, 'scripts/n8n/windows/Invoke-M03FoundationProvision.ps1')) +
          ' -Mode All; exit $LASTEXITCODE',
      );
      const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', wrapper], {
        encoding: 'utf8',
        env: { ...env(), LOCALAPPDATA: root },
        timeout: 20000,
        windowsHide: true,
      });
      assert.equal(r.status, 0);
      assert.equal(r.stdout.includes('PUBLIC_SYNTHETIC_NON_SECRET'), false);
      const receipt = JSON.parse(r.stdout.trim().split(/\r?\n/).at(-1));
      assert.equal(receipt.childClosed, true);
      assert.equal(receipt.finalBindingReady, false);
      assert.equal(receipt.inactiveDefinitionsSaved, true);
      assert.equal(receipt.deferredErrorWorkflowCount, 24);
      assert.equal(receipt.errorRoutingAccepted, false);
      assert.deepEqual(receipt.diagnostics, {
        lastMethod: 'GET',
        lastResource: 'owned_workflows',
        httpStatus: 200,
        transportCode: 'FOUNDATION_TRANSPORT_BODY',
        transportReason: 'body_declared_limit',
      });
      assert.equal(JSON.stringify(receipt.diagnostics).includes('PUBLIC_SYNTHETIC_NON_SECRET'), false);
      assert.equal(receipt.handoffDeleted, true);
      assert.equal(receipt.leaseDeleted, true);
      assert.equal(receipt.pendingMachineStoreRetained, true);
      assert.equal(existsSync(join(root, 'Temp/emr-m03-foundation-management.dpapi')), false);
      assert.equal(
        existsSync(
          join(
            root,
            'Everyone-Market-Radar-Private/foundation/df4f29ec-e2dc-4d82-a276-62a4e695e6f9/machine.dpapi',
          ),
        ),
        true,
      );
      const stored = join(
          root,
          'Everyone-Market-Radar-Private/foundation/df4f29ec-e2dc-4d82-a276-62a4e695e6f9/machine.dpapi',
        ),
        before = readFileSync(stored);
      const again = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', wrapper], {
        encoding: 'utf8',
        env: { ...env(), LOCALAPPDATA: root },
        timeout: 20000,
        windowsHide: true,
      });
      assert.equal(again.status, 0);
      assert.equal(Buffer.compare(readFileSync(stored), before) === 0, true);
      const invokeOnly = join(root, 'invoke-only.ps1');
      writeFileSync(
        invokeOnly,
        '& ' +
          literal(join(repo, 'scripts/n8n/windows/Invoke-M03FoundationProvision.ps1')) +
          ' -Mode All; exit $LASTEXITCODE',
      );
      const helperOnly = join(root, 'helper-only.ps1');
      writeFileSync(
        helperOnly,
        "function Read-Host { param([string]$Prompt,[switch]$AsSecureString) ConvertTo-SecureString -String 'PUBLIC_SYNTHETIC_NON_SECRET' -AsPlainText -Force }; & " +
          literal(join(repo, 'scripts/n8n/windows/New-M03FoundationHandoff.ps1')) +
          '; exit $LASTEXITCODE',
      );
      const runFile = (file, args = []) =>
        spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', file, ...args], {
          encoding: 'utf8',
          env: { ...env(), LOCALAPPDATA: root },
          timeout: 20000,
          windowsHide: true,
        });
      const ready = runFile(helperOnly);
      assert.equal(ready.status, 0);
      const leasePath = join(root, 'Temp/emr-m03-foundation-management.lease.json');
      const nearLease = JSON.parse(readFileSync(leasePath, 'utf8').replace(/^\uFEFF/, ''));
      const nearExpiry = Date.now() + 30000;
      nearLease.expiresAt = new Date(nearExpiry).toISOString();
      nearLease.createdAt = new Date(nearExpiry - 7200000).toISOString();
      writeFileSync(leasePath, JSON.stringify(nearLease));
      const near = runFile(invokeOnly);
      assert.equal(near.status, 1);
      const nearReceipt = JSON.parse(near.stdout.trim());
      assert.equal(nearReceipt.privateRead, false);
      assert.equal(nearReceipt.handoffDeleted, false);
      assert.equal(nearReceipt.operationLockAcquired, true);
      rmSync(join(root, 'Temp/emr-m03-foundation-management.dpapi'));
      rmSync(leasePath);
      for (const malformedPacket of [
        { ...publicPacket, activationAuthorized: 0 },
        { ...publicPacket, audience: [publicPacket.audience] },
        { ...publicPacket, version: true },
      ]) {
        writeFileSync(
          join(repo, 'scripts/n8n/foundation-delivery-packet.json'),
          JSON.stringify(malformedPacket),
        );
        reseal();
        const strict = runFile(join(repo, 'scripts/n8n/windows/Invoke-M03FoundationProvision.ps1'), [
          '-CheckOnly',
        ]);
        assert.equal(strict.status, 1);
        assert.equal(
          strict.stdout.trim(),
          'M03_FOUNDATION_PUBLIC_PREFLIGHT_BLOCKED. No private read/decryption/network.',
        );
      }
      writeFileSync(join(repo, 'scripts/n8n/foundation-delivery-packet.json'), packetBytes);
      const childEntered = join(root, 'public-synthetic-child-entered');
      writeFileSync(
        cli,
        readFileSync(cli, 'utf8')
          .replace('import{readFileSync}', 'import{readFileSync,writeFileSync}')
          .replace(
            'const p=JSON.parse',
            `writeFileSync(${JSON.stringify(childEntered)},'PUBLIC_SYNTHETIC_CHILD_ENTERED');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,3000);const p=JSON.parse`,
          ),
      );
      reseal();
      assert.equal(runFile(helperOnly).status, 0);
      const launch = () =>
        new Promise((resolve) => {
          const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', invokeOnly], {
            env: { ...env(), LOCALAPPDATA: root },
            windowsHide: true,
          });
          let stdout = '',
            stderr = '';
          child.stdout.setEncoding('utf8');
          child.stderr.setEncoding('utf8');
          child.stdout.on('data', (b) => (stdout += b));
          child.stderr.on('data', (b) => (stderr += b));
          child.on('close', (status) => resolve({ status, stdout, stderr }));
        });
      const first = launch();
      for (let poll = 0; poll < 200 && !existsSync(childEntered); poll++)
        await new Promise((resolve) => setTimeout(resolve, 50));
      assert.equal(existsSync(childEntered), true, 'first owned child is running while lock is held');
      const second = launch();
      const concurrent = await Promise.all([first, second]);
      assert.deepEqual(concurrent.map((x) => x.status).sort(), [0, 1]);
      const blocked = concurrent.find((x) => x.status === 1);
      assert.equal(blocked.stderr, '');
      const blockedReceipt = JSON.parse(blocked.stdout.trim());
      assert.equal(blockedReceipt.operationLockAcquired, false);
      assert.equal(blockedReceipt.privateRead, false);
      assert.equal(blockedReceipt.handoffDeleted, false);
      assert.equal(Buffer.compare(readFileSync(stored), before) === 0, true);
    } finally {
      assert.equal(dirname(root), tmpdir());
      assert.ok(basename(root).startsWith('emr-foundation-protocol-test-'));
      rmSync(root, { recursive: true, force: true });
    }
  },
);
