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
  appendFileSync,
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

test('technical13 restore CheckOnly is a separate public no-credential/no-network contract', () => {
  const r = spawnSync(
    process.execPath,
    ['scripts/n8n/foundation-provision-cli.mjs', 'RestoreTechnical13CheckOnly'],
    {
      encoding: 'utf8',
      env: env(),
      timeout: 10000,
      windowsHide: true,
      input: 'SYNTHETIC_PRIVATE_MUST_NOT_BE_READ',
    },
  );
  assert.equal(r.stderr, '');
  const result = JSON.parse(r.stdout);
  assert.equal(result.kind, 'm03_technical13_restoration_public');
  assert.equal(result.privateRead, false);
  assert.equal(result.networkRequests, 0);
  assert.equal(result.maximumRequests, 40);
  assert.equal(result.maximumControlRequests, 50);
  assert.equal(result.executionCount, 0);
  assert.equal(result.actorStarts, 0);
  assert.doesNotMatch(r.stdout, /SYNTHETIC_PRIVATE/);
});

test('technical13 real accounting keeps durable40/50 charges and rejects changed public prefixes', async () => {
  const { createTechnical13RestorationBudget } = await import('./foundation-provision-cli.mjs');
  const { createFoundationControlJournal } = await import('./foundation-control-state.mjs');
  const directory = mkdtempSync(join(tmpdir(), 'emr-technical13-accounting-'));
  try {
    const paths = Object.fromEntries(
      ['management', 'control', 'runtime'].map((name) => [name, join(directory, name + '.jsonl')]),
    );
    const pinned = {
      management: '{"event":"file_header"}\n',
      control: '{"event":"file_header"}\n',
      runtime: '{"event":"file_header"}\n',
    };
    for (const name of Object.keys(paths)) writeFileSync(paths[name], pinned[name]);
    const context = {
      managementAttempts: 486,
      controlAttempts: 791,
      pinned,
      plan: { baseline: [{ id: 'owned-workflow' }] },
    };
    const budget = createTechnical13RestorationBudget({
      context,
      deadlineAt: Date.now() + 60000,
      paths,
      appendManagement: (row) => appendFileSync(paths.management, JSON.stringify(row) + '\n'),
      appendControl: (row) => appendFileSync(paths.control, JSON.stringify(row) + '\n'),
    });
    const control = createFoundationControlJournal({
      previousEvents: [{ event: 'file_header' }],
      durableAppend: (row) => {
        budget.appendControl(row);
      },
    });
    assert.throws(
      () => budget.admitControl({ kind: 'full', workflowId: 'owned-workflow' }, (row) => control.append(row)),
      /FOUNDATION_CHILD_BLOCKED/,
    );
    assert.throws(
      () =>
        budget.admitControl({ kind: 'discovery', workflowId: 'unrelated-workflow' }, (row) =>
          control.append(row),
        ),
      /FOUNDATION_CHILD_BLOCKED/,
    );
    assert.equal(budget.state().controlRequestCount, 0);
    for (let i = 0; i < 40; i++) budget.admitManagement();
    assert.throws(() => budget.admitManagement(), /FOUNDATION_CHILD_BLOCKED/);
    for (let i = 0; i < 50; i++)
      budget.admitControl({ kind: 'discovery', workflowId: 'owned-workflow' }, (row) => control.append(row));
    assert.throws(
      () =>
        budget.admitControl({ kind: 'discovery', workflowId: 'owned-workflow' }, (row) =>
          control.append(row),
        ),
      /FOUNDATION_CHILD_BLOCKED/,
    );
    assert.deepEqual(budget.state(), {
      requestCount: 40,
      controlRequestCount: 50,
      managementAttempts: 526,
      controlAttempts: 841,
      combinedAttempts: 1367,
    });
    const management = readFileSync(paths.management, 'utf8').trimEnd().split('\n').map(JSON.parse);
    const controls = readFileSync(paths.control, 'utf8').trimEnd().split('\n').map(JSON.parse);
    assert.equal(management.length, 41);
    assert.equal(management[1].ordinal, 476);
    assert.equal(management.at(-1).ordinal, 515);
    assert.equal(controls.length, 51);
    assert.equal(controls[1].ordinal, 789);
    assert.equal(controls.at(-1).ordinal, 838);
    budget.assertCurrent();
    assert.equal(readFileSync(paths.runtime, 'utf8'), pinned.runtime);
    appendFileSync(paths.management, '{"event":"unexpected_external_append"}\n');
    assert.throws(() => budget.assertCurrent(), /FOUNDATION_CHILD_BLOCKED/);
  } finally {
    assert.equal(dirname(directory), tmpdir());
    assert.ok(basename(directory).startsWith('emr-technical13-accounting-'));
    rmSync(directory, { recursive: true, force: true });
  }
});

test('technical13 uncertain durable append stays charged and blocks another request', async () => {
  const { createTechnical13RestorationBudget } = await import('./foundation-provision-cli.mjs');
  const directory = mkdtempSync(join(tmpdir(), 'emr-technical13-uncertain-'));
  try {
    const paths = Object.fromEntries(
      ['management', 'control', 'runtime'].map((name) => [name, join(directory, name + '.jsonl')]),
    );
    const pinned = Object.fromEntries(Object.keys(paths).map((name) => [name, '{"event":"file_header"}\n']));
    for (const name of Object.keys(paths)) writeFileSync(paths[name], pinned[name]);
    const context = {
      managementAttempts: 486,
      controlAttempts: 791,
      pinned,
      plan: { baseline: [{ id: 'owned-workflow' }] },
    };
    const budget = createTechnical13RestorationBudget({
      context,
      deadlineAt: Date.now() + 60000,
      paths,
      appendManagement(row) {
        appendFileSync(paths.management, JSON.stringify(row) + '\n');
        throw Error('SYNTHETIC_PRIVATE_APPEND_ERROR');
      },
      appendControl() {
        throw Error('SYNTHETIC_PRIVATE_MUST_NOT_RUN');
      },
    });
    assert.throws(() => budget.admitManagement(), { message: 'FOUNDATION_CHILD_BLOCKED' });
    assert.equal(budget.state().managementAttempts, 487);
    assert.equal(budget.state().requestCount, 1);
    assert.throws(() => budget.admitManagement(), { message: 'FOUNDATION_CHILD_BLOCKED' });
    assert.equal(readFileSync(paths.management, 'utf8').trimEnd().split('\n').length, 2);
    assert.equal(budget.state().managementAttempts, 487);
    const expired = createTechnical13RestorationBudget({
      context: { ...context, pinned: { ...pinned, management: readFileSync(paths.management, 'utf8') } },
      deadlineAt: Date.now() - 1,
      paths,
      appendManagement() {
        throw Error('SYNTHETIC_PRIVATE_MUST_NOT_RUN');
      },
      appendControl() {
        throw Error('SYNTHETIC_PRIVATE_MUST_NOT_RUN');
      },
    });
    assert.throws(() => expired.admitManagement(), { message: 'FOUNDATION_CHILD_BLOCKED' });
    assert.equal(expired.state().requestCount, 0);
  } finally {
    assert.equal(dirname(directory), tmpdir());
    assert.ok(basename(directory).startsWith('emr-technical13-uncertain-'));
    rmSync(directory, { recursive: true, force: true });
  }
});

test(
  'actual technical13 PowerShell result guard rejects coerced counters and incomplete cleanup',
  { skip: process.platform !== 'win32' },
  () => {
    const source = readFileSync('scripts/n8n/windows/Invoke-M03FoundationProvision.ps1', 'utf8');
    const start = source.indexOf(
      "if($Mode -ceq 'RestoreTechnical13'){",
      source.indexOf("if($Mode -ceq 'ProtectWf00Backup')"),
    );
    assert.ok(start > 0);
    const branch = source.slice(start, source.indexOf("if($Mode -ceq 'RestoreWF00'){", start));
    const initial = branch.split(/\r?\n/).find((line) => line.startsWith(' $receipt=[ordered]@'));
    const guard = branch.slice(branch.indexOf("  $keys=@('kind'"), branch.indexOf(' }catch'));
    const keysFunction = readFileSync('scripts/n8n/windows/Foundation-PublicRuntime.ps1', 'utf8');
    const match = keysFunction.match(/function Assert-M03FoundationObjectKeys[\s\S]*?\n\}/);
    assert.ok(initial);
    assert.ok(guard.includes('restoration_verified'));
    assert.ok(match);
    const valid = {
      kind: 'm03_technical13_runtime_restoration',
      version: 1,
      environment: 'dev',
      projectRef: 'zmotjsbzhzjvpelxvxlf',
      windowId: '3c46c791-e140-4eb9-890a-eecfa251f65e',
      sourceCommitSha: '7b1837201ac7925591577a1517d7288936ca3464',
      status: 'restoration_verified',
      requestCount: 38,
      controlRequestCount: 50,
      managementAttempts: 524,
      controlAttempts: 841,
      combinedAttempts: 1365,
      baselineRestored: true,
      machineRestored: true,
      remoteWorkSettled: true,
      executionCount: 0,
      actorStarts: 0,
      originalAckUnknown: true,
      mutationReplayAllowed: false,
      oldRuntimeUnchanged: true,
      networkCompletionVerified: true,
    };
    const changes = [
      { managementAttempts: '524' },
      { controlAttempts: '841' },
      { combinedAttempts: '1365' },
      { requestCount: '38' },
      { controlRequestCount: 49, controlAttempts: 840, combinedAttempts: 1364 },
      { remoteWorkSettled: false },
      { machineRestored: false },
      { networkCompletionVerified: false },
      { oldRuntimeUnchanged: false },
      { mutationReplayAllowed: true },
      { originalAckUnknown: false },
      { executionCount: 1 },
      { actorStarts: 1 },
      { unexpected: 'SYNTHETIC_PRIVATE_FIELD' },
    ];
    const cases = [valid, ...changes.map((change) => ({ ...valid, ...change }))];
    const directory = mkdtempSync(join(tmpdir(), 'emr-technical13-native-guard-'));
    try {
      const file = join(directory, 'guard.ps1');
      writeFileSync(
        file,
        match[0] +
          "\n$cases=ConvertFrom-Json -InputObject '" +
          JSON.stringify(cases).replaceAll("'", "''") +
          "';$out=@();foreach($result in $cases){try{" +
          initial +
          ';$receipt.nativeExit=0;$exitCode=1;' +
          guard +
          ";if($exitCode -ne 0){throw 'blocked'};$out+='accepted'}catch{$out+='rejected'}};$out|ConvertTo-Json -Compress",
      );
      const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', file], {
        encoding: 'utf8',
        env: env(),
        timeout: 10000,
        windowsHide: true,
      });
      assert.equal(result.status, 0);
      assert.equal(result.stderr, '');
      assert.deepEqual(JSON.parse(result.stdout), ['accepted', ...changes.map(() => 'rejected')]);
      assert.doesNotMatch(result.stdout, /SYNTHETIC_PRIVATE_FIELD/);
    } finally {
      assert.equal(dirname(directory), tmpdir());
      assert.ok(basename(directory).startsWith('emr-technical13-native-guard-'));
      rmSync(directory, { recursive: true, force: true });
    }
  },
);

test(
  'technical13 native public child filters inherited credentials and bounds fixed stdout/stderr',
  { skip: process.platform !== 'win32' },
  () => {
    const source = readFileSync('scripts/n8n/windows/Invoke-M03FoundationProvision.ps1', 'utf8');
    const publicFunction = source.match(/function Invoke-M03Technical13Public[\s\S]*?\n\}/)?.[0];
    const keys = readFileSync('scripts/n8n/windows/Foundation-PublicRuntime.ps1', 'utf8').match(
      /function Assert-M03FoundationObjectKeys[\s\S]*?\n\}/,
    )?.[0];
    assert.ok(publicFunction);
    assert.ok(keys);
    const valid = {
      kind: 'm03_technical13_restoration_public',
      version: 1,
      status: 'technical13_restore_public_ready',
      windowId: '3c46c791-e140-4eb9-890a-eecfa251f65e',
      privateRead: false,
      networkRequests: 0,
      maximumRequests: 40,
      maximumControlRequests: 50,
      executionCount: 0,
      actorStarts: 0,
    };
    const directory = mkdtempSync(join(tmpdir(), 'emr-technical13-public-child-'));
    try {
      const modes = [{ ...valid }, { ...valid, networkRequests: '0' }, 'stderr', 'overflow', 'nonzero'];
      const paths = modes.map((mode, index) => {
        const path = join(directory, 'fake-' + index + '.cjs');
        const body =
          mode === 'stderr'
            ? "process.stderr.write('SYNTHETIC_PRIVATE_ERROR');"
            : mode === 'overflow'
              ? "process.stdout.write('X'.repeat(8192));"
              : mode === 'nonzero'
                ? 'process.exitCode=1;'
                : "if(process.env.PGPASSWORD||process.env.UNRELATED_SECRET||process.env.NODE_OPTIONS)throw Error('SYNTHETIC_PRIVATE_ENV');process.stdout.write(" +
                  JSON.stringify(JSON.stringify(mode)) +
                  ');';
        writeFileSync(path, body);
        return path;
      });
      const file = join(directory, 'native-public.ps1');
      writeFileSync(
        file,
        "Set-StrictMode -Version Latest;$ErrorActionPreference='Stop';\n" +
          keys +
          '\n' +
          publicFunction +
          "\n$repo='" +
          directory.replaceAll("'", "''") +
          "';$paths=ConvertFrom-Json -InputObject '" +
          JSON.stringify(paths).replaceAll("'", "''") +
          "';$out=@();foreach($path in $paths){try{$result=Invoke-M03Technical13Public '" +
          process.execPath.replaceAll("'", "''") +
          "' $path;$out+='accepted'}catch{$out+='rejected'}};$out|ConvertTo-Json -Compress",
      );
      const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', file], {
        encoding: 'utf8',
        env: {
          ...env(),
          PGPASSWORD: 'SYNTHETIC_PRIVATE_PASSWORD',
          UNRELATED_SECRET: 'SYNTHETIC_PRIVATE_OTHER',
          NODE_OPTIONS: '--invalid-inherited-option',
        },
        timeout: 15000,
        windowsHide: true,
      });
      assert.equal(result.status, 0);
      assert.equal(result.stderr, '');
      assert.deepEqual(JSON.parse(result.stdout), [
        'accepted',
        'rejected',
        'rejected',
        'rejected',
        'rejected',
      ]);
      assert.doesNotMatch(result.stdout, /SYNTHETIC_PRIVATE/);
    } finally {
      assert.equal(dirname(directory), tmpdir());
      assert.ok(basename(directory).startsWith('emr-technical13-public-child-'));
      rmSync(directory, { recursive: true, force: true });
    }
  },
);

test('technical13 restoration composes the real adoption and restore ports without replaying the unknown settings PUT', async () => {
  const { fixture } = await import('./foundation-live-runtime-fixtures.mjs');
  const { createFoundationRuntimePlan } = await import('./foundation-runtime-plan.mjs');
  const runtime = await import('./foundation-runtime-control.mjs');
  const { prepareFoundationRuntimeMachinePatch } = await import('./foundation-runtime-machine.mjs');
  const { restoreTechnical13WithPorts } = await import('./foundation-provision-cli.mjs');
  const f = fixture();
  try {
    const plan = createFoundationRuntimePlan({
      ...f.input,
      activeWindowId: '3c46c791-e140-4eb9-890a-eecfa251f65e',
    });
    const source = runtime.createFoundationRuntimeJournal(plan, [], () => {});
    let lost = false,
      freshCalls = 0;
    const observedCalls = [];
    const send = async (method, path, body) => {
      observedCalls.push({ method, path, body: structuredClone(body) });
      const before = f.workflows.get('tiEhU3dXrMifOnTL')?.versionId;
      const response = await f.dependencies.send(method, path, body);
      if (
        !lost &&
        method === 'PUT' &&
        path.includes('/tiEhU3dXrMifOnTL?') &&
        body.settings.errorWorkflow === 'S9NHRkKFUIiXX2wv'
      ) {
        lost = true;
        f.workflows.get('tiEhU3dXrMifOnTL').versionId = before;
        throw Error('SYNTHETIC_PRIVATE_UNKNOWN_ACK');
      }
      return response;
    };
    const prepareMachinePatch = ({ audience, restore }) =>
      prepareFoundationRuntimeMachinePatch({
        audience,
        restore,
        machineToken: f.input.machineToken,
        ...(restore ? {} : { protectionBypass: f.input.protectionBypass }),
      });
    assert.equal(
      (
        await runtime.runFoundationRuntimeSetup(plan, {
          journal: source,
          send,
          prepareMachinePatch,
          admitManagementAttempt() {},
        })
      ).status,
      'reconciliation_required',
    );
    const old = source.rows
      .filter((row) => row.event !== 'request' || row.number > 25)
      .map((row) => {
        const copy = structuredClone(row);
        if (copy.event === 'request') copy.number -= 25;
        if (copy.event === 'intent' && copy.sequence === 7) copy.target.versionId = null;
        return copy;
      });
    const untouched = JSON.stringify(old),
      fresh = [];
    const journal = runtime.createFoundationRuntimeJournal(plan, old, (row) => {
      fresh.push(row);
    });
    assert.equal(lost, true);
    assert.equal(runtime.foundationRuntimeState(plan, journal).requestCount, 22);
    assert.equal(runtime.foundationRuntimeState(plan, journal).pending.sequence, 7);
    const start = observedCalls.length;
    const result = await restoreTechnical13WithPorts(plan, {
      journal,
      send,
      prepareMachinePatch,
      admitManagementAttempt() {
        if (++freshCalls > 40) throw Error('SYNTHETIC_LIMIT');
      },
    });
    assert.equal(result.adoption.originalAcknowledgementVerified, false);
    assert.equal(result.adoption.mutationReplayAllowed, false);
    assert.equal(result.adoption.requestCount, 23);
    assert.equal(result.adoption.status, 'settings_save_readback_verified_original_ack_unknown');
    assert.equal(result.restoration.status, 'exact_staging_restored_unpublished');
    assert.equal(freshCalls, 38);
    assert.equal(JSON.stringify(old), untouched);
    assert.equal(fresh[0].event, 'request');
    assert.equal(fresh[0].number, 23);
    const calls = observedCalls.slice(start);
    assert.equal(calls.filter((c) => c.method === 'PUT').length, 2);
    assert.equal(calls.filter((c) => c.method === 'PATCH').length, 1);
    assert.equal(calls.filter((c) => c.method === 'POST').length, 1);
    assert.equal(
      calls.some((c) => /\/publish$/.test(c.path)),
      false,
    );
    assert.equal(
      calls.filter((c) => c.method === 'PUT' && c.body.settings.errorWorkflow === 'S9NHRkKFUIiXX2wv').length,
      0,
    );
    assert.equal(runtime.foundationRuntimeState(plan, journal).machineRebound, false);
  } finally {
    f.cleanup();
  }
});
test(
  'actual technical13 credential loop distinguishes ACL, framing and successful synthetic decryption',
  { skip: process.platform !== 'win32' },
  () => {
    const source = readFileSync('scripts/n8n/windows/Invoke-M03FoundationProvision.ps1', 'utf8');
    const start = source.indexOf('  foreach($privateFile in @($source,$machineSource)){');
    const end = source.indexOf("  $receipt.diagnosticStage='child_configuration'", start);
    assert.ok(start > 0);
    assert.ok(end > start);
    const loop = source.slice(start, end);
    assert.equal(loop.includes('Set-M03DevPrivateAcl'), false, 'retained stores are not silently adopted');
    const directory = mkdtempSync(join(tmpdir(), 'emr-technical13-credential-stage-'));
    try {
      const file = join(directory, 'stage.ps1');
      const literal = (value) => "'" + value.replaceAll("'", "''") + "'";
      writeFileSync(
        file,
        "$ErrorActionPreference='Stop';Set-StrictMode -Version Latest;. " +
          literal(resolve('scripts/n8n/windows/Dev-CredentialStore.ps1')) +
          ';$root=' +
          literal(directory) +
          ";$mgmt=Join-Path $root 'management';$legacy=Join-Path $root 'legacy-machine';[IO.Directory]::CreateDirectory($mgmt)|Out-Null;[IO.Directory]::CreateDirectory($legacy)|Out-Null;Set-M03DevPrivateAcl $mgmt $true;$source=Join-Path $mgmt 'management.dpapi';$machineSource=Join-Path $legacy 'machine.dpapi';$s=ConvertTo-SecureString 'SYNTHETIC_PRIVATE_ONLY' -AsPlainText -Force;try{$native=ConvertFrom-SecureString $s}finally{$s.Dispose()};[IO.File]::WriteAllText($source,$native,[Text.Encoding]::ASCII);Set-M03DevPrivateAcl $source $false;[IO.File]::WriteAllText($machineSource,'SYNTHETIC_PRIVATE_NOT_DPAPI',[Text.Encoding]::ASCII);$out=@();foreach($mode in @('directory_acl','file_acl','framing','success')){if($mode -ceq 'file_acl'){Set-M03DevPrivateAcl $legacy $true};if($mode -ceq 'framing'){Set-M03DevPrivateAcl $machineSource $false};if($mode -ceq 'success'){[IO.File]::WriteAllText($machineSource,$native,[Text.Encoding]::ASCII)};$receipt=[ordered]@{privateRead=$false;diagnosticStage='not_attempted';diagnosticCode='not_attempted'};$key=$null;$machine=$null;$secret=$null;$cipher=$null;$bstr=[IntPtr]::Zero;try{\n" +
          loop +
          "\n$receipt.diagnosticCode='none'}catch{$receipt.diagnosticCode='local_boundary_blocked'}finally{if($bstr -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)};if($null -ne $secret){$secret.Dispose()};if($null -ne $cipher){[Array]::Clear($cipher,0,$cipher.Length)};$key=$null;$machine=$null;$value=$null};$out+=[pscustomobject]$receipt};$native=$null;$out|ConvertTo-Json -Compress",
      );
      const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', file], {
        encoding: 'utf8',
        env: env(),
        timeout: 10000,
        windowsHide: true,
      });
      assert.equal(result.status, 0);
      assert.equal(result.stderr, '');
      assert.deepEqual(JSON.parse(result.stdout), [
        {
          privateRead: true,
          diagnosticStage: 'machine_directory_acl',
          diagnosticCode: 'local_boundary_blocked',
        },
        { privateRead: true, diagnosticStage: 'machine_file_acl', diagnosticCode: 'local_boundary_blocked' },
        { privateRead: true, diagnosticStage: 'machine_framing', diagnosticCode: 'local_boundary_blocked' },
        { privateRead: true, diagnosticStage: 'machine_plaintext', diagnosticCode: 'none' },
      ]);
      assert.doesNotMatch(result.stdout, /SYNTHETIC_PRIVATE/);
    } finally {
      assert.equal(dirname(directory), tmpdir());
      assert.ok(basename(directory).startsWith('emr-technical13-credential-stage-'));
      rmSync(directory, { recursive: true, force: true });
    }
  },
);

test('isolated All without a public delivery packet blocks before stdin/private read on every platform', () => {
  const root = mkdtempSync(join(tmpdir(), 'emr-foundation-absent-packet-test-'));
  try {
    const list = readFileSync('scripts/n8n/windows/Foundation-PublicRuntime.ps1', 'utf8');
    const relatives = [...list.matchAll(/^  '([^']+)'/gm)].map((x) => x[1]);
    assert.equal(relatives.length, 82);
    assert.equal(new Set(relatives).size, 82);
    const seen = new Set(),
      pending = ['scripts/n8n/foundation-provision-cli.mjs'];
    while (pending.length) {
      const relative = pending.shift();
      if (seen.has(relative)) continue;
      seen.add(relative);
      assert.ok(relatives.includes(relative), 'seal must cover actual import ' + relative);
      for (const match of readFileSync(relative, 'utf8').matchAll(
        /(?:from\s*|import\s*\()\s*['"]([^'"]+)['"]/g,
      )) {
        if (!match[1].startsWith('.')) continue;
        let target = resolve(dirname(relative), match[1]);
        if (!existsSync(target) && existsSync(target + '.ts')) target += '.ts';
        assert.ok(existsSync(target));
        const imported = target.slice(resolve('.').length + 1).replaceAll('\\', '/');
        if (!seen.has(imported)) pending.push(imported);
      }
    }
    const bindings = JSON.parse(readFileSync('n8n/foundation/bindings.dev.json', 'utf8'));
    assert.equal(Object.keys(bindings.workflowRefs).length, 25);
    for (const key of Object.keys(bindings.workflowRefs))
      assert.ok(relatives.includes('n8n/workflows/' + key + '.json'));
    for (const relative of [
      'n8n/foundation/transport.dev.json',
      'milestones/M03-n8n-foundation/evidence/dev-acceptance-technical13-reconciliation-20261024.json',
      'milestones/M03-n8n-foundation/evidence/runtime-reconciliation-readback-20261024.json',
    ])
      assert.ok(relatives.includes(relative));
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
