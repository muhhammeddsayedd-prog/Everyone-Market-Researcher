import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const ps = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const helperPath = 'scripts/n8n/windows/New-M03GW01GatewayPublicSeal.ps1';
const consumerPath = 'scripts/n8n/windows/Invoke-M03GW01Gateway.ps1';
const helperSource = readFileSync(helperPath, 'utf8');
const consumerSource = readFileSync(consumerPath, 'utf8');
const roots = [];
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

// Isolated synthetic fixtures only. Neither source copy executes against the
// actual dependency tree, handoff directory, journal, deployment or network.
function fixture(scenario = 'ok') {
  const root = mkdtempSync(join(tmpdir(), 'emr-gw01-public-seal-'));
  roots.push(root);
  const put = (relative, contents) => {
    const file = join(root, relative);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, contents);
    return file;
  };
  const preview = {
    version: 1,
    projectId: 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
    teamId: 'team_gboXPxTevpCOZuaA8eY9PmR1',
    branch: 'm03-n8n-foundation',
    commitSha: 'a'.repeat(40),
    deploymentId: 'dpl_SyntheticOwnedDeployment123',
    audience: 'https://everyone-market-researcher-synthetic.vercel.app',
    target: 'preview',
    protection: 'all_except_custom_domains',
    routeDisabledVerified: false,
  };
  put('scripts/n8n/gw01-reviewed-preview.json', JSON.stringify(preview));
  put(
    'scripts/n8n/gw01-trial-config.json',
    JSON.stringify({ windowId: '76c2ad42-c094-4ba4-9a0b-566e19b97780', audiences: [preview.audience] }),
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
      ownedWorkflowId: 'SyntheticOwned',
      credentialCanaryVerified: true,
      executionCanaryVerified: true,
      exportCanaryVerified: true,
      passed: false,
      logCanaryVerified: false,
    }),
  );
  put('scripts/n8n/out/gw01/gw01-trial.jsonl', 'SYNTHETIC_PUBLIC_JOURNAL_DO_NOT_REWRITE\n');
  const immutable = [
    'scripts/n8n/gw01-gateway-transport.mjs',
    'scripts/n8n/gw01-gateway-logs.mjs',
    'scripts/n8n/gw01-trial.mjs',
    'packages/shared/src/n8n-worker-contracts.ts',
    'packages/shared/package.json',
    'pnpm-lock.yaml',
    'scripts/n8n/windows/New-M03GW01Handoff.ps1',
    consumerPath,
  ];
  for (const file of immutable) put(file, '// SYNTHETIC PUBLIC SOURCE ONLY.');
  put(consumerPath, consumerSource);
  put(
    'scripts/n8n/gw01-gateway-transport.mjs',
    `// SYNTHETIC PUBLIC PREFLIGHT ONLY; no private or network implementation.
import {existsSync,writeFileSync} from 'node:fs';writeFileSync('synthetic-public-check-ran','true');if(existsSync('synthetic-public-target-rejected'))process.exit(1);
if(process.argv[2]!=='--check-public'||process.env.SYNTHETIC_POISON||process.env.PGPASSWORD)process.exit(1);
let s='';for await(const c of process.stdin)s+=c;
const v=JSON.parse(s);if(v.secrets.protection!=='GW01_PUBLIC_PREFLIGHT_PLACEHOLDER_PROTECTION')process.exit(1);
process.stdout.write(JSON.stringify({version:1,status:'public_ready',networkRequests:0,privateRead:false}));`,
  );
  const pins = Object.fromEntries(immutable.map((p) => [p, sha(readFileSync(join(root, p)))]));
  const makeHelper = (source) =>
    source.replace(
      /# BEGIN REVIEWED PUBLIC SOURCES[\s\S]*?# END REVIEWED PUBLIC SOURCES/,
      `# BEGIN REVIEWED PUBLIC SOURCES\n$reviewed=ConvertFrom-Json -InputObject @'\n${JSON.stringify(pins)}\n'@\n# END REVIEWED PUBLIC SOURCES`,
    );
  const previousSources = ['scripts/n8n/gw01-gateway-transport.mjs', consumerPath];
  put(
    helperPath,
    makeHelper(helperSource).replace(
      /# BEGIN REVIEWED PREVIOUS SOURCES[\s\S]*?# END REVIEWED PREVIOUS SOURCES/,
      `# BEGIN REVIEWED PREVIOUS SOURCES\n$previousSources=@{\n${previousSources.map((p) => ` '${p}'='${pins[p]}'`).join('\n')}\n}\n# END REVIEWED PREVIOUS SOURCES`,
    ),
  );
  const zod = 'node_modules/.pnpm/zod@4.6.7/node_modules/zod';
  put(zod + '/package.json', '{"version":"4.6.7","type":"module"}');
  put(zod + '/index.js', '// synthetic public runtime');
  put(zod + '/v4/core/deep.js', '// synthetic public nested runtime');
  put(zod + '/v4/core/deep.d.ts', '// ignored non-runtime type fixture');
  mkdirSync(join(root, 'packages/shared/node_modules'), { recursive: true });
  symlinkSync(join(root, zod), join(root, 'packages/shared/node_modules/zod'), 'junction');
  const vercel = 'fake-appdata/npm/node_modules/vercel';
  put(vercel + '/package.json', '{"version":"56.5.0"}');
  for (const file of ['dist/index.js', 'dist/nested/chunk.mjs', 'dist/nested/file.wasm'])
    put(vercel + '/' + file, '// synthetic public runtime');
  put(vercel + '/dist/nested/ignored.txt', '// ignored non-runtime fixture');
  const handoff = put(
    'fake-localappdata/Temp/emr-m03-gw01-dev-protection.dpapi',
    'SYNTHETIC_UNREADABLE_NOT_DPAPI_NEVER_DECRYPT',
  );
  const env = Object.fromEntries(
    ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP', 'USERPROFILE'].flatMap((name) =>
      process.env[name] === undefined ? [] : [[name, process.env[name]]],
    ),
  );
  env.APPDATA = join(root, 'fake-appdata');
  env.LOCALAPPDATA = join(root, 'fake-localappdata');
  env.SYNTHETIC_POISON = 'SYNTHETIC_ENV_MUST_NOT_BE_FORWARDED';
  if (scenario === 'missing_handoff') rmSync(handoff);
  return {
    root,
    put,
    handoff,
    refreshReviewed() {
      for (const path of immutable) pins[path] = sha(readFileSync(join(root, path)));
      put(helperPath, makeHelper(readFileSync(join(root, helperPath), 'utf8')));
    },
    seal: join(root, 'scripts/n8n/gw01-gateway-seal.json'),
    run: (args = []) =>
      spawnSync(ps, ['-NoProfile', '-NonInteractive', '-File', join(root, helperPath), ...args], {
        env,
        windowsHide: true,
        encoding: 'utf8',
        timeout: 40000,
      }),
  };
}
function result(f, args = []) {
  const r = f.run(args);
  assert.equal(r.error, undefined);
  assert.equal(r.stderr, '');
  assert.doesNotMatch(r.stdout, /SYNTHETIC_(?:UNREADABLE|ENV)|Exception|At line|https:\/\//);
  return { r, lines: r.stdout.trim().split(/\r?\n/) };
}

function prepareTransition(f, mutate = () => {}) {
  const previous = readFileSync(f.seal),
    publicFiles = ['gw01-reviewed-preview.json', 'gw01-cloud-privacy.json'];
  for (const name of publicFiles) {
    const path = join(f.root, 'scripts/n8n', name),
      value = JSON.parse(readFileSync(path));
    if (name === 'gw01-reviewed-preview.json') value.routeDisabledVerified = true;
    else value.passed = value.logCanaryVerified = true;
    writeFileSync(path, JSON.stringify(value));
  }
  const transition = {
    version: 1,
    windowId: '76c2ad42-c094-4ba4-9a0b-566e19b97780',
    previousSealSha256: sha(previous),
    newFiles: Object.fromEntries(
      publicFiles.map((name) => {
        const path = 'scripts/n8n/' + name;
        return [path, sha(readFileSync(join(f.root, path)))];
      }),
    ),
  };
  mutate(transition);
  f.put('scripts/n8n/gw01-gateway-transition.json', JSON.stringify(transition));
  return { previous, transition };
}

test('reviewed public advancement preserves predecessor and journal while completing CloudB flags', () => {
  const f = fixture();
  assert.equal(result(f).r.status, 0);
  const journal = readFileSync(join(f.root, 'scripts/n8n/out/gw01/gw01-trial.jsonl')),
    { previous, transition } = prepareTransition(f),
    { r } = result(f, ['-AdvanceReviewedConfig']);
  assert.equal(r.status, 0, r.stdout);
  assert.deepEqual(
    readFileSync(join(f.root, 'scripts/n8n/out/gw01/public-seals', transition.previousSealSha256 + '.json')),
    previous,
  );
  assert.deepEqual(readFileSync(join(f.root, 'scripts/n8n/out/gw01/gw01-trial.jsonl')), journal);
  const receipt = JSON.parse(
    readFileSync(
      join(f.root, 'scripts/n8n/out/gw01/public-seals', transition.previousSealSha256 + '.transition.json'),
    ),
  );
  assert.equal(receipt.previousSealSha256, sha(previous));
  assert.equal(receipt.nextSealSha256, sha(readFileSync(f.seal)));
  assert.equal(receipt.windowId, transition.windowId);
  assert.equal(result(f).r.status, 0);
});

for (const [label, change] of [
  [
    'stale predecessor hash',
    (f, t) => {
      t.previousSealSha256 = '0'.repeat(64);
    },
  ],
  [
    'unreviewed public digest',
    (f, t) => {
      t.newFiles['scripts/n8n/gw01-cloud-privacy.json'] = '0'.repeat(64);
    },
  ],
  [
    'unlisted packet path',
    (f, t) => {
      t.newFiles['pnpm-lock.yaml'] = '0'.repeat(64);
    },
  ],
  [
    'trial configuration drift',
    (f) => {
      f.put(
        'scripts/n8n/gw01-trial-config.json',
        JSON.stringify({
          windowId: '76c2ad42-c094-4ba4-9a0b-566e19b97780',
          audiences: ['https://everyone-market-researcher-changed.vercel.app'],
        }),
      );
    },
  ],
  [
    'physical runtime drift',
    (f) => {
      f.put('node_modules/.pnpm/zod@4.6.7/node_modules/zod/index.js', '// changed synthetic runtime');
    },
  ],
  [
    'Vercel runtime drift',
    (f) => {
      f.put('fake-appdata/npm/node_modules/vercel/dist/index.js', '// changed synthetic Vercel runtime');
    },
  ],
  [
    'unlisted source drift',
    (f) => {
      f.put('scripts/n8n/gw01-gateway-logs.mjs', '// changed reviewed source');
      f.refreshReviewed();
    },
  ],
  [
    'partial archive',
    (f, t) => {
      f.put(
        'scripts/n8n/out/gw01/public-seals/' + t.previousSealSha256 + '.json',
        'SYNTHETIC_PARTIAL_ARCHIVE',
      );
    },
  ],
  [
    'unregistered target rejection',
    (f) => {
      f.put('synthetic-public-target-rejected', 'true');
    },
  ],
])
  test('reviewed public advancement rejects ' + label + ' without replacing seal or journal', () => {
    const f = fixture();
    assert.equal(result(f).r.status, 0);
    const before = readFileSync(f.seal),
      journal = readFileSync(join(f.root, 'scripts/n8n/out/gw01/gw01-trial.jsonl'));
    const { transition } = prepareTransition(f, (t) => change(f, t));
    const { r } = result(f, ['-AdvanceReviewedConfig']);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /PUBLIC_SEAL_BLOCKED/);
    assert.deepEqual(readFileSync(f.seal), before);
    assert.deepEqual(readFileSync(join(f.root, 'scripts/n8n/out/gw01/gw01-trial.jsonl')), journal);
    assert.equal(
      existsSync(
        join(f.root, 'scripts/n8n/out/gw01/public-seals', transition.previousSealSha256 + '.transition.json'),
      ),
      false,
    );
  });

test('reviewed public advancement permits only the two compiled runtime-phase and Duplicate2 predecessor source updates', () => {
  const f = fixture();
  assert.equal(result(f).r.status, 0);
  const { previous, transition } = prepareTransition(f);
  for (const path of ['scripts/n8n/gw01-gateway-transport.mjs', consumerPath])
    f.put(path, readFileSync(join(f.root, path), 'utf8') + '\n// SYNTHETIC REVIEWED SOURCE UPDATE\n');
  f.refreshReviewed();
  const { r } = result(f, ['-AdvanceReviewedConfig']);
  assert.equal(r.status, 0, r.stdout);
  assert.deepEqual(
    readFileSync(join(f.root, 'scripts/n8n/out/gw01/public-seals', transition.previousSealSha256 + '.json')),
    previous,
  );
  const receipt = JSON.parse(
    readFileSync(
      join(f.root, 'scripts/n8n/out/gw01/public-seals', transition.previousSealSha256 + '.transition.json'),
    ),
  );
  assert.deepEqual(
    receipt.sourceUpdates.sort(),
    ['scripts/n8n/gw01-gateway-transport.mjs', consumerPath].sort(),
  );
});
test('compiled runtime-phase and Duplicate2 pins match reviewed sources while predecessors remain the actual installed pair', () => {
  const pins = JSON.parse(
    helperSource.match(/# BEGIN REVIEWED PUBLIC SOURCES[\s\S]*?@'\r?\n([\s\S]*?)\r?\n'@/)[1],
  );
  for (const file of ['scripts/n8n/gw01-gateway-transport.mjs', consumerPath])
    assert.equal(pins[file], sha(readFileSync(file)));
  assert.match(
    helperSource,
    /'scripts\/n8n\/gw01-gateway-transport\.mjs'='738502f9ba6268ba255751700ccf738f0d828effc35001d5fd60b9fbb8e2df3f'/,
  );
  assert.match(
    helperSource,
    /'scripts\/n8n\/windows\/Invoke-M03GW01Gateway\.ps1'='4f650df56fe689ad5fac4220d9e4663c03185bf7d08ec1e6a9b95bfb478a6297'/,
  );
});

test('reviewed public advancement rejects changed dependency runtime before launching any public Node checker', () => {
  const f = fixture();
  assert.equal(result(f).r.status, 0);
  const before = readFileSync(f.seal);
  prepareTransition(f);
  rmSync(join(f.root, 'synthetic-public-check-ran'));
  f.put('node_modules/.pnpm/zod@4.6.7/node_modules/zod/index.js', '// SYNTHETIC UNREVIEWED RUNTIME');
  const { r } = result(f, ['-AdvanceReviewedConfig']);
  assert.equal(r.status, 1);
  assert.equal(existsSync(join(f.root, 'synthetic-public-check-ran')), false);
  assert.deepEqual(readFileSync(f.seal), before);
});

for (const bad of [true, ['a'.repeat(64)]])
  test(
    'reviewed public advancement rejects non-string predecessor digest before public runtime execution: ' +
      typeof bad,
    () => {
      const f = fixture();
      assert.equal(result(f).r.status, 0);
      const old = JSON.parse(readFileSync(f.seal));
      old.files['node_modules/.pnpm/zod@4.6.7/node_modules/zod/index.js'] = bad;
      writeFileSync(f.seal, JSON.stringify(old));
      const before = readFileSync(f.seal);
      prepareTransition(f);
      rmSync(join(f.root, 'synthetic-public-check-ran'));
      const { r } = result(f, ['-AdvanceReviewedConfig']);
      assert.equal(r.status, 1);
      assert.equal(existsSync(join(f.root, 'synthetic-public-check-ran')), false);
      assert.deepEqual(readFileSync(f.seal), before);
    },
  );

test('reviewed public advancement stops on concurrently changed predecessor and retains immutable archive intent', () => {
  const f = fixture();
  assert.equal(result(f).r.status, 0);
  const { previous, transition } = prepareTransition(f),
    path = join(f.root, helperPath),
    marker = 'SYNTHETIC_CONCURRENT_PUBLIC_SEAL',
    needle = 'if((Hash $sealPath) -cne $transition.previousSealSha256 -or';
  const source = readFileSync(path, 'utf8');
  assert.equal(source.split(needle).length, 2);
  writeFileSync(path, source.replace(needle, `[IO.File]::WriteAllText($sealPath,'${marker}');${needle}`));
  const { r } = result(f, ['-AdvanceReviewedConfig']);
  assert.equal(r.status, 1);
  assert.equal(readFileSync(f.seal, 'utf8'), marker);
  assert.deepEqual(
    readFileSync(join(f.root, 'scripts/n8n/out/gw01/public-seals', transition.previousSealSha256 + '.json')),
    previous,
  );
  assert.equal(
    existsSync(
      join(f.root, 'scripts/n8n/out/gw01/public-seals', transition.previousSealSha256 + '.transition.json'),
    ),
    true,
  );
  assert.equal(
    existsSync(
      join(
        f.root,
        'scripts/n8n/out/gw01/public-seals',
        transition.previousSealSha256 + '.replace-backup.json',
      ),
    ),
    false,
  );
});
function expectBlocked(f, code = 'PUBLIC_SEAL_BLOCKED') {
  const { r, lines } = result(f);
  assert.equal(r.status, 1);
  assert.equal(lines.at(-1), code);
}

test('owner-only sealer derives exact runtime inventory then runs public CheckOnly with no private read', () => {
  const f = fixture(),
    journal = readFileSync(join(f.root, 'scripts/n8n/out/gw01/gw01-trial.jsonl')),
    { r, lines } = result(f);
  assert.equal(r.status, 0, lines.join(' '));
  assert.equal(lines[0], 'PUBLIC_SEAL_READY');
  assert.deepEqual(JSON.parse(lines[1]), {
    version: 1,
    mode: 'Probe',
    status: 'check_only_ready',
    privateRead: false,
    rootChildClosed: true,
    nativeExit: null,
    handoffsRetained: true,
    result: null,
  });
  const seal = JSON.parse(readFileSync(f.seal));
  assert.deepEqual(Object.keys(seal).sort(), ['files', 'vercelFiles', 'version']);
  assert.equal(Object.keys(seal.files).length, 15);
  assert.ok(seal.files['node_modules/.pnpm/zod@4.6.7/node_modules/zod/v4/core/deep.js']);
  assert.equal(
    Object.keys(seal.files).some((p) => p.endsWith('.d.ts')),
    false,
  );
  assert.deepEqual(Object.keys(seal.vercelFiles).sort(), [
    'dist/index.js',
    'dist/nested/chunk.mjs',
    'dist/nested/file.wasm',
    'package.json',
  ]);
  assert.equal(readFileSync(f.handoff, 'utf8'), 'SYNTHETIC_UNREADABLE_NOT_DPAPI_NEVER_DECRYPT');
  assert.deepEqual(readFileSync(join(f.root, 'scripts/n8n/out/gw01/gw01-trial.jsonl')), journal);
});
test('identical public seal is reused without rewriting it', () => {
  const f = fixture();
  assert.equal(result(f).r.status, 0);
  const before = statSync(f.seal).mtimeMs;
  assert.equal(result(f).r.status, 0);
  assert.equal(statSync(f.seal).mtimeMs, before);
});
test('existing differing seal is preserved and never replaced', () => {
  const f = fixture();
  f.put('scripts/n8n/gw01-gateway-seal.json', '{"version":1,"unreviewed":true}');
  expectBlocked(f);
  assert.equal(readFileSync(f.seal, 'utf8'), '{"version":1,"unreviewed":true}');
});
for (const file of [consumerPath, 'scripts/n8n/gw01-gateway-transport.mjs', 'pnpm-lock.yaml'])
  test('reviewed immutable source drift blocks before sealing: ' + file, () => {
    const f = fixture();
    f.put(file, '// synthetic unreviewed drift');
    expectBlocked(f);
    assert.equal(existsSync(f.seal), false);
  });
for (const [file, update] of [
  ['gw01-reviewed-preview.json', (v) => ({ ...v, projectId: 'prj_UnapprovedProject' })],
  ['gw01-trial-config.json', (v) => ({ ...v, windowId: '00000000-0000-4000-8000-000000000000' })],
  ['gw01-cloud-privacy.json', (v) => ({ ...v, projectRef: 'hkiafqrcxaafdbcvjlzv' })],
  ['gw01-cloud-privacy.json', (v) => ({ ...v, executionCanaryVerified: false })],
])
  test('missing or wrong public prerequisite is not fabricated: ' + file + update.toString(), () => {
    const f = fixture();
    const path = join(f.root, 'scripts/n8n', file);
    f.put('scripts/n8n/' + file, JSON.stringify(update(JSON.parse(readFileSync(path)))));
    expectBlocked(f);
    assert.equal(existsSync(f.seal), false);
  });
test('wrong dependency junction target fails closed without creating a seal', () => {
  const f = fixture();
  rmSync(join(f.root, 'packages/shared/node_modules/zod'));
  mkdirSync(join(f.root, 'synthetic-wrong-zod'));
  symlinkSync(
    join(f.root, 'synthetic-wrong-zod'),
    join(f.root, 'packages/shared/node_modules/zod'),
    'junction',
  );
  expectBlocked(f);
  assert.equal(existsSync(f.seal), false);
});
test('nested dependency runtime reparse directory is rejected rather than traversed', () => {
  const f = fixture();
  mkdirSync(join(f.root, 'synthetic-outside-runtime'));
  symlinkSync(
    join(f.root, 'synthetic-outside-runtime'),
    join(f.root, 'node_modules/.pnpm/zod@4.6.7/node_modules/zod/escape'),
    'junction',
  );
  expectBlocked(f);
  assert.equal(existsSync(f.seal), false);
});
test('post-seal added runtime JavaScript causes drift instead of silently resealing', () => {
  const f = fixture();
  assert.equal(result(f).r.status, 0);
  const before = readFileSync(f.seal);
  f.put('node_modules/.pnpm/zod@4.6.7/node_modules/zod/unreviewed.js', '// added synthetic runtime');
  expectBlocked(f);
  assert.deepEqual(readFileSync(f.seal), before);
});
test('missing Protection handoff leaves public seal but returns blocked CheckOnly, not readiness', () => {
  const f = fixture('missing_handoff'),
    { r, lines } = result(f);
  assert.equal(r.status, 1);
  assert.equal(lines[0], 'PUBLIC_SEAL_READY');
  assert.equal(lines[1], 'PUBLIC_CHECK_ONLY_BLOCKED');
  assert.equal(existsSync(f.handoff), false);
  assert.ok(existsSync(f.seal));
});
