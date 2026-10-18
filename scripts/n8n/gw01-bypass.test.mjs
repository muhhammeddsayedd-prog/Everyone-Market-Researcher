import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
const roots = [],
  ps = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});
function fixture(kind = 'success') {
  const root = mkdtempSync(join(tmpdir(), 'emr-gw01-bypass-fixture-'));
  roots.push(root);
  const put = (p, s) => {
    const f = join(root, p);
    mkdirSync(dirname(f), { recursive: true });
    let value = s;
    if (p === 'appdata/npm/node_modules/vercel/dist/vc.js' && kind.startsWith('final')) {
      const bad = { id: 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu' };
      if (kind === 'finalNull') bad.protectionBypass = null;
      if (kind === 'finalArray') bad.protectionBypass = [];
      value = value
        .replace('isEnvVar:false', 'isEnvVar:true')
        .replace(
          'process.stdout.write(JSON.stringify(',
          `if(!body&&Object.keys(state).length===0){process.stdout.write(JSON.stringify(${JSON.stringify(bad)}));return;}process.stdout.write(JSON.stringify(`,
        );
    }
    writeFileSync(f, value);
    return f;
  };
  const consumer = put(
    'scripts/n8n/windows/Invoke-M03GW01Bypass.ps1',
    readFileSync('scripts/n8n/windows/Invoke-M03GW01Bypass.ps1', 'utf8').replace(
      'WaitForExit(20000)',
      'WaitForExit(1000)',
    ),
  );
  put(
    'scripts/n8n/gw01-local-privacy.json',
    JSON.stringify({ version: 1, passed: true, consumerReviewed: true, canaryTestsPassed: true }),
  );
  put(
    'scripts/n8n/gw01-cloud-privacy.json',
    JSON.stringify({
      version: 1,
      projectRef: 'zmotjsbzhzjvpelxvxlf',
      instanceHost: 'muhhammedsayed.app.n8n.cloud',
      credentialCanaryVerified: true,
      executionCanaryVerified: true,
      exportCanaryVerified: true,
      passed: false,
      logCanaryVerified: false,
    }),
  );
  const app = join(root, 'appdata'),
    cli = put(
      'appdata/npm/node_modules/vercel/dist/vc.js',
      `const fs=require('node:fs'),path=require('node:path');const statePath=path.join(__dirname,'state.json'),callsPath=path.join(__dirname,'calls.json');let text='';process.stdin.on('data',c=>text+=c);process.stdin.on('end',()=>{const body=text?JSON.parse(text):null;const calls=fs.existsSync(callsPath)?JSON.parse(fs.readFileSync(callsPath)):[];calls.push({argv:process.argv.slice(2),action:body?.generate?'generate':body?.revoke?'revoke':'get'});fs.writeFileSync(callsPath,JSON.stringify(calls));let state=fs.existsSync(statePath)?JSON.parse(fs.readFileSync(statePath)):{DEFAULT_PUBLIC_SYNTHETIC_ENTRY:{scope:'automation-bypass',isEnvVar:true,note:'Unrelated default'}};if(body?.generate){state[body.generate.secret]={scope:'automation-bypass',isEnvVar:${['default', 'ambiguousRevoke'].includes(kind) ? 'true' : 'false'},note:${kind === 'wrongnote' ? "'Unrelated'" : 'body.generate.note'},createdAt:Date.now(),createdBy:'SyntheticOwner'};fs.writeFileSync(statePath,JSON.stringify(state));${kind === 'ambiguous' ? 'process.exit(1);' : ''}}if(body?.revoke){if(body.revoke.regenerate!==false)throw Error('badfixture');delete state[body.revoke.secret];fs.writeFileSync(statePath,JSON.stringify(state));${kind === 'ambiguousRevoke' ? 'process.exit(1);' : ''}}process.stdout.write(JSON.stringify({id:'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',protectionBypass:state}));});`,
    ),
    pkg = put('appdata/npm/node_modules/vercel/package.json', JSON.stringify({ version: '56.5.0' }));
  const paths = [
    'scripts/n8n/windows/Invoke-M03GW01Bypass.ps1',
    'scripts/n8n/gw01-local-privacy.json',
    'scripts/n8n/gw01-cloud-privacy.json',
  ];
  put(
    'scripts/n8n/gw01-bypass-seal.json',
    JSON.stringify({
      version: 1,
      files: Object.fromEntries(
        paths.map((p) => [
          p,
          createHash('sha256')
            .update(readFileSync(join(root, p)))
            .digest('hex'),
        ]),
      ),
      vercelCliSha256: createHash('sha256').update(readFileSync(cli)).digest('hex'),
      vercelPackageSha256: createHash('sha256').update(readFileSync(pkg)).digest('hex'),
    }),
  );
  const local = join(root, 'local');
  mkdirSync(join(local, 'Temp'), { recursive: true });
  const env = Object.fromEntries(
    ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP', 'USERPROFILE'].flatMap((k) =>
      process.env[k] === undefined ? [] : [[k, process.env[k]]],
    ),
  );
  env.APPDATA = app;
  env.LOCALAPPDATA = local;
  return {
    root,
    local,
    run: (mode, extra = []) =>
      spawnSync(ps, ['-NoProfile', '-NonInteractive', '-File', consumer, '-Mode', mode, ...extra], {
        env,
        encoding: 'utf8',
        timeout: 15000,
        windowsHide: true,
      }),
    calls: () => JSON.parse(readFileSync(join(dirname(cli), 'calls.json'))),
    state: () => JSON.parse(readFileSync(join(dirname(cli), 'state.json'))),
    mutateState: (fn) => {
      const file = join(dirname(cli), 'state.json'),
        state = JSON.parse(readFileSync(file));
      fn(state);
      writeFileSync(file, JSON.stringify(state));
    },
    knownCreate: (mutate = () => {}) => {
      const intent = JSON.parse(readFileSync(join(root, 'scripts/n8n/out/gw01-bypass-intent.json'))),
        packet = {
          version: 1,
          windowId: intent.windowId,
          projectId: intent.projectId,
          note: intent.note,
          intentCreatedAt: intent.createdAt,
          originalCli: {
            mode: 'Create',
            nativeExit: 0,
            childClosed: true,
            ownEntryPresent: true,
            status: 'stopped_reconcile',
            code: 'GW01_BYPASS_DEFAULT_UNVERIFIED',
            toolRef: 'synthetic:known-create',
          },
        };
      mutate(packet);
      const p = 'scripts/n8n/gw01-bypass-known-create.json';
      put(p, JSON.stringify(packet));
      const sealPath = join(root, 'scripts/n8n/gw01-bypass-seal.json'),
        seal = JSON.parse(readFileSync(sealPath));
      seal.files[p] = createHash('sha256')
        .update(readFileSync(join(root, p)))
        .digest('hex');
      writeFileSync(sealPath, JSON.stringify(seal));
    },
  };
}

function soleFixture(kind = 'default') {
  const f = fixture(kind),
    created = f.run('Create');
  assert.equal(created.status, 1);
  assert.equal(JSON.parse(created.stdout).nativeExit, 0);
  f.mutateState((state) => {
    delete state.DEFAULT_PUBLIC_SYNTHETIC_ENTRY;
  });
  rmSync(join(f.root, 'scripts/n8n/out/gw01-bypass-created.json')); // Simulated historical metadata gap inside owned fixture only.
  f.knownCreate();
  return f;
}

test('RecoverSoleCreated performs GET-only, preserves false nondefault and writes separate readback proof idempotently', () => {
  const f = soleFixture(),
    r = f.run('RecoverSoleCreated');
  assert.equal(r.status, 0, r.stdout);
  const v = JSON.parse(r.stdout);
  assert.equal(v.soleOwnedDefaultVerified, true);
  assert.equal(v.nonDefaultVerified, false);
  assert.equal(v.provenance, 'recovered_sole_readback');
  assert.equal(v.createdReceiptRecorded, false);
  assert.equal(existsSync(join(f.root, 'scripts/n8n/out/gw01-bypass-created.json')), false);
  const proofPath = join(f.root, 'scripts/n8n/out/gw01-bypass-recovered-sole.json'),
    before = readFileSync(proofPath, 'utf8');
  assert.equal(f.run('RecoverSoleCreated').status, 0);
  assert.equal(readFileSync(proofPath, 'utf8'), before);
  assert.deepEqual(
    f.calls().map((c) => c.action),
    ['generate', 'get', 'get'],
  );
});

test('recovered sole Revoke requires fresh zero-other readback and final empty GET before deleting only its handoff', () => {
  const f = soleFixture();
  assert.equal(f.run('RecoverSoleCreated').status, 0);
  const r = f.run('Revoke');
  assert.equal(r.status, 0, r.stdout);
  const v = JSON.parse(r.stdout);
  assert.equal(v.revocationReadbackVerified, true);
  assert.equal(v.handoffRetained, false);
  assert.deepEqual(
    f.calls().map((c) => c.action),
    ['generate', 'get', 'get', 'revoke', 'get'],
  );
  assert.deepEqual(f.state(), {});
});

for (const [label, mutate] of [
  [
    'unknown original outcome',
    (p) => {
      p.originalCli.nativeExit = 1;
    },
  ],
  [
    'original intent mismatch',
    (p) => {
      p.intentCreatedAt += 1;
    },
  ],
  [
    'wrong original observation',
    (p) => {
      p.originalCli.ownEntryPresent = false;
    },
  ],
])
  test('sole recovery refuses ' + label + ' before any GET or private consumption', () => {
    const f = soleFixture();
    f.knownCreate(mutate);
    const r = f.run('RecoverSoleCreated');
    assert.equal(r.status, 1);
    assert.deepEqual(
      f.calls().map((c) => c.action),
      ['generate'],
    );
    assert.equal(existsSync(join(f.root, 'scripts/n8n/out/gw01-bypass-recovered-sole.json')), false);
  });

for (const drift of ['other entry', 'false flag', 'changed time'])
  test('sole recovery refuses ' + drift + ' without mutation or adoption', () => {
    const f = soleFixture();
    f.mutateState((state) => {
      const own = Object.values(state)[0];
      if (drift === 'other entry') state.UNRELATED = { scope: 'automation-bypass', isEnvVar: true };
      else if (drift === 'false flag') own.isEnvVar = false;
      else own.createdAt += 60000;
    });
    const r = f.run('RecoverSoleCreated');
    assert.equal(r.status, 1);
    assert.deepEqual(
      f.calls().map((c) => c.action),
      ['generate', 'get'],
    );
    assert.equal(existsSync(join(f.root, 'scripts/n8n/out/gw01-bypass-recovered-sole.json')), false);
  });

for (const drift of ['other entry', 'false flag', 'changed time', 'string time'])
  test('recovered sole revoke refuses fresh ' + drift + ' before PATCH', () => {
    const f = soleFixture();
    assert.equal(f.run('RecoverSoleCreated').status, 0);
    f.mutateState((state) => {
      const own = Object.values(state)[0];
      if (drift === 'other entry') state.UNRELATED = { scope: 'integration-automation-bypass' };
      else if (drift === 'false flag') own.isEnvVar = false;
      else if (drift === 'string time') own.createdAt = String(own.createdAt);
      else own.createdAt += 1;
    });
    assert.equal(f.run('Revoke').status, 1);
    assert.deepEqual(
      f.calls().map((c) => c.action),
      ['generate', 'get', 'get'],
    );
    assert.ok(existsSync(join(f.local, 'Temp/emr-m03-gw01-dev-protection.dpapi')));
  });

test('sole default omitted flag remains truthful and eligible only with zero other entries', () => {
  const f = soleFixture();
  f.mutateState((state) => {
    delete Object.values(state)[0].isEnvVar;
  });
  const r = f.run('RecoverSoleCreated'),
    v = JSON.parse(r.stdout);
  assert.equal(r.status, 0, r.stdout);
  assert.equal(v.defaultFlagShape, 'absent');
  assert.equal(v.soleOwnedDefaultVerified, true);
  assert.equal(v.nonDefaultVerified, false);
});

test('ambiguous sole revocation never replays PATCH; GET-only absence reconciliation closes cleanup', () => {
  const f = soleFixture('ambiguousRevoke');
  assert.equal(f.run('RecoverSoleCreated').status, 0);
  const first = f.run('Revoke');
  assert.equal(first.status, 1);
  assert.equal(JSON.parse(first.stdout).handoffRetained, true);
  const before = f.calls().length;
  assert.equal(f.run('Revoke').status, 1);
  assert.equal(f.calls().length, before);
  const reconciled = f.run('ReconcileRevoked');
  assert.equal(reconciled.status, 0, reconciled.stdout);
  assert.equal(JSON.parse(reconciled.stdout).revocationReadbackVerified, true);
  assert.equal(existsSync(join(f.local, 'Temp/emr-m03-gw01-dev-protection.dpapi')), false);
  assert.deepEqual(
    f.calls().map((c) => c.action),
    ['generate', 'get', 'get', 'revoke', 'get'],
  );
});
for (const kind of ['finalMissing', 'finalNull', 'finalArray'])
  test('sole cleanup requires explicit empty object readback, rejects ' + kind, () => {
    const f = soleFixture(kind);
    assert.equal(f.run('RecoverSoleCreated').status, 0);
    const r = f.run('Revoke');
    assert.equal(r.status, 1);
    const v = JSON.parse(r.stdout);
    assert.equal(v.revocationReadbackVerified, false);
    assert.equal(v.handoffRetained, true);
    assert.ok(existsSync(join(f.local, 'Temp/emr-m03-gw01-dev-protection.dpapi')));
    const before = f.calls().length;
    assert.equal(f.run('Revoke').status, 1);
    assert.equal(f.calls().length, before);
  });
test('dedicated bypass Create/Reconcile/Revoke privately usesfixedstdinAPI and preserves unrelateddefault', () => {
  const f = fixture(),
    create = f.run('Create');
  assert.equal(create.status, 0, create.stdout);
  const c = JSON.parse(create.stdout);
  assert.equal(c.nonDefaultVerified, true);
  assert.equal(c.childClosed, true);
  assert.ok(existsSync(join(f.local, 'Temp/emr-m03-gw01-dev-protection.dpapi')));
  assert.equal(f.run('Reconcile').status, 0);
  const revoke = f.run('Revoke');
  assert.equal(revoke.status, 0, revoke.stdout);
  assert.equal(JSON.parse(revoke.stdout).handoffRetained, false);
  assert.deepEqual(Object.keys(f.state()), ['DEFAULT_PUBLIC_SYNTHETIC_ENTRY']);
  assert.deepEqual(
    f.calls().map((x) => x.action),
    ['generate', 'get', 'get', 'revoke'],
  );
  for (const call of f.calls()) {
    assert.ok(call.argv.includes('--raw'));
    assert.ok(!call.argv.includes('--token'));
    assert.ok(!JSON.stringify(call.argv).includes('DEFAULT_PUBLIC_SYNTHETIC_ENTRY'));
  }
});
test('existingintent blocksrepeatCreate and native unknownresponse hasGET-only continuation', () => {
  const f = fixture('ambiguous'),
    a = f.run('Create');
  assert.equal(a.status, 1);
  assert.equal(JSON.parse(a.stdout).code, 'GW01_BYPASS_NATIVE_FAILURE');
  assert.equal(f.run('Create').status, 1);
  assert.equal(f.calls().length, 1);
  const r = f.run('Reconcile');
  assert.equal(r.status, 1, r.stdout);
  assert.equal(JSON.parse(r.stdout).code, 'GW01_BYPASS_OWNERSHIP_UNVERIFIED');
  assert.equal(existsSync(join(f.root, 'scripts/n8n/out/gw01-bypass-created.json')), false);
  assert.deepEqual(
    f.calls().map((c) => c.action),
    ['generate', 'get'],
  );
});
test('default or unknown ownership metadata is neveraccepted as dedicatednondefault credential', () => {
  for (const kind of ['default', 'wrongnote']) {
    const f = fixture(kind),
      r = f.run('Create');
    assert.equal(r.status, 1);
    assert.equal(JSON.parse(r.stdout).nonDefaultVerified, false);
    assert.equal(existsSync(join(f.root, 'scripts/n8n/out/gw01-bypass-created.json')), kind === 'default');
    assert.equal(f.run('Revoke').status, 1);
    assert.equal(f.calls().length, kind === 'default' ? 2 : 1);
  }
});
test('bypass CheckOnly nevergenerates token orlaunchesAPIchild', () => {
  const f = fixture(),
    r = f.run('Create', ['-CheckOnly']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /CHECK_ONLY_READY/);
  assert.equal(existsSync(join(f.local, 'Temp/emr-m03-gw01-dev-protection.dpapi')), false);
});
for (const drift of ['default', 'note', 'createdAt'])
  test('revoke refuses changed ' + drift + ' metadata before PATCH', () => {
    const f = fixture();
    assert.equal(f.run('Create').status, 0);
    f.mutateState((state) => {
      const own = Object.entries(state).find(([key]) => key !== 'DEFAULT_PUBLIC_SYNTHETIC_ENTRY')[1];
      if (drift === 'default') own.isEnvVar = true;
      else if (drift === 'note') own.note = 'Unrelated changed';
      else own.createdAt += 1;
    });
    const r = f.run('Revoke');
    assert.equal(r.status, 1);
    assert.deepEqual(
      f.calls().map((c) => c.action),
      ['generate', 'get'],
    );
    assert.ok(existsSync(join(f.local, 'Temp/emr-m03-gw01-dev-protection.dpapi')));
  });

for (const shape of ['absent', 'true', 'false', 'not_boolean'])
  test('fixed default flag shape is projected without flag values: ' + shape, () => {
    const f = fixture();
    assert.equal(f.run('Create').status, 0);
    f.mutateState((state) => {
      const own = Object.entries(state).find(([key]) => key !== 'DEFAULT_PUBLIC_SYNTHETIC_ENTRY')[1];
      if (shape === 'absent') delete own.isEnvVar;
      else own.isEnvVar = shape === 'not_boolean' ? 'SYNTHETIC_PRIVATE_FLAG' : shape === 'true';
    });
    const r = f.run('Reconcile'),
      v = JSON.parse(r.stdout);
    assert.equal(v.defaultFlagShape, shape);
    assert.equal(v.ownershipMetadataVerified, true);
    assert.equal(v.createdReceiptRecorded, true);
    assert.equal(r.status, shape === 'false' ? 0 : 1);
    assert.equal(v.nonDefaultVerified, shape === 'false');
    assert.doesNotMatch(r.stdout + r.stderr, /SYNTHETIC_PRIVATE_FLAG/);
    assert.deepEqual(
      f.calls().map((c) => c.action),
      ['generate', 'get'],
    );
  });

test('successful Create records valid ownership before rejecting a default flag, without accepting or revoking it', () => {
  const f = fixture('default'),
    r = f.run('Create'),
    v = JSON.parse(r.stdout);
  assert.equal(r.status, 1);
  assert.equal(v.code, 'GW01_BYPASS_DEFAULT_UNVERIFIED');
  assert.equal(v.defaultFlagShape, 'true');
  assert.equal(v.createdReceiptRecorded, true);
  const recorded = JSON.parse(readFileSync(join(f.root, 'scripts/n8n/out/gw01-bypass-created.json')));
  assert.deepEqual(Object.keys(recorded), ['version', 'projectId', 'note', 'createdAt']);
  assert.equal(f.run('Create').status, 1);
  assert.deepEqual(
    f.calls().map((c) => c.action),
    ['generate'],
  );
});

test('other bypass metadata projects counts only, including omitted default flag and unknown flag type', () => {
  const f = fixture();
  assert.equal(f.run('Create').status, 0);
  f.mutateState((state) => {
    delete state.DEFAULT_PUBLIC_SYNTHETIC_ENTRY.isEnvVar;
    state.SYNTHETIC_OTHER_INTEGRATION = { scope: 'integration-automation-bypass' };
    state.SYNTHETIC_OTHER_UNKNOWN = { scope: 'automation-bypass', isEnvVar: 'SYNTHETIC_PRIVATE_FLAG' };
  });
  const r = f.run('Reconcile'),
    v = JSON.parse(r.stdout);
  assert.equal(r.status, 0);
  assert.equal(v.otherEntryCount, 3);
  assert.equal(v.otherAutomationCount, 2);
  assert.equal(v.otherSelectedDefaultCount, 1);
  assert.equal(v.unknownOtherFlagCount, 1);
  assert.doesNotMatch(
    r.stdout + r.stderr,
    /SYNTHETIC_OTHER|SYNTHETIC_PRIVATE_FLAG|DEFAULT_PUBLIC_SYNTHETIC_ENTRY/,
  );
});
