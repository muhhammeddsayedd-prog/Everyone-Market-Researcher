import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { tmpdir } from 'node:os';

const modulePath = resolve('scripts/n8n/windows/Foundation-PublicRuntime.ps1');
const windowsOnly = { skip: process.platform !== 'win32' };
const literal = (s) => "'" + s.replaceAll("'", "''") + "'";
const publicEnv = () =>
  Object.fromEntries(
    ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP'].flatMap((name) =>
      process.env[name] === undefined ? [] : [[name, process.env[name]]],
    ),
  );

function powershell(script, root) {
  const wrapper = join(root, 'public-wrapper.ps1');
  writeFileSync(wrapper, script);
  return spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', wrapper], {
    encoding: 'utf8',
    env: publicEnv(),
    windowsHide: true,
    timeout: 20000,
  });
}

function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'emr-foundation-public-test-'));
  const repo = join(root, 'repo');
  mkdirSync(repo);
  try {
    const listResult = powershell(
      `$ErrorActionPreference='Stop'; . ${literal(modulePath)}; Get-M03FoundationPublicSourceFiles | ConvertTo-Json -Compress`,
      root,
    );
    assert.equal(listResult.status, 0, 'public module source-list discovery passes');
    const sources = JSON.parse(listResult.stdout);
    for (const relative of sources) {
      const target = join(repo, relative);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, readFileSync(relative));
    }
    const zod = join(repo, 'node_modules/.pnpm/zod@4.6.7/node_modules/zod');
    mkdirSync(join(zod, 'v4'), { recursive: true });
    writeFileSync(join(zod, 'package.json'), '{"name":"zod","version":"4.6.7","type":"module"}');
    writeFileSync(join(zod, 'index.js'), 'export const publicFixture = true;');
    writeFileSync(join(zod, 'v4/core.js'), 'export const core = true;');
    const shared = join(repo, 'packages/shared/node_modules');
    mkdirSync(shared, { recursive: true });
    symlinkSync(zod, join(shared, 'zod'), 'junction');
    const node = join(root, 'node.exe');
    writeFileSync(node, 'PUBLIC_SYNTHETIC_NODE_IDENTITY_NOT_EXECUTABLE');
    const seal = join(root, 'public-seal.json');
    const prefix = `. ${literal(modulePath)}; $ErrorActionPreference='Stop'; `;
    const built = powershell(
      prefix +
        `New-M03FoundationPublicRuntimeSeal -RepositoryRoot ${literal(repo)} -NodeExecutable ${literal(node)} | ConvertTo-Json -Depth 8 -Compress | Set-Content -LiteralPath ${literal(seal)} -Encoding UTF8; Write-Output 'PUBLIC_ONLY_BUILT'`,
      root,
    );
    assert.equal(built.status, 0, 'synthetic public closure seals without executing Node');
    assert.equal(built.stdout.trim(), 'PUBLIC_ONLY_BUILT');
    const check = (selectedNode = node) =>
      powershell(
        prefix +
          `try {$s=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText(${literal(seal)})); $verified=Assert-M03FoundationPublicRuntimeSeal -RepositoryRoot ${literal(repo)} -Seal $s -SelectedNodeExecutable ${literal(selectedNode)}; if($verified -cne ${literal(node)}){throw 'blocked'}; Write-Output 'PUBLIC_ONLY_READY'; exit 0} catch {Write-Output 'FOUNDATION_PUBLIC_RUNTIME_BLOCKED'; exit 1}`,
        root,
      );
    return run({ root, repo, zod, node, seal, check });
  } finally {
    assert.equal(dirname(root), tmpdir());
    assert.ok(basename(root).startsWith('emr-foundation-public-test-'));
    rmSync(root, { recursive: true, force: true });
  }
}

test(
  'public seal accepts fixed source/runtime closure with zero execution, private input or network',
  windowsOnly,
  () =>
    fixture(({ check, seal }) => {
      const result = check();
      assert.equal(result.status, 0);
      assert.equal(result.stdout.trim(), 'PUBLIC_ONLY_READY');
      const parsed = JSON.parse(readFileSync(seal, 'utf8').replace(/^\uFEFF/, ''));
      assert.equal(parsed.version, 2);
      assert.equal(parsed.windowId, 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9');
      assert.equal(parsed.packetSha256, null);
      assert.ok(parsed.files['milestones/M03-n8n-foundation/evidence/sanitizedprobe.json']);
      assert.ok(parsed.files['scripts/n8n/foundation-export.mjs']);
      assert.ok(parsed.files['packages/shared/package.json']);
      assert.ok(parsed.zod.files['v4/core.js']);
    }),
);

for (const [name, mutate] of [
  [
    'a changed project import',
    ({ repo }) => writeFileSync(join(repo, 'scripts/n8n/foundation-all.mjs'), 'public mutation'),
  ],
  [
    'a changed sanitized probe',
    ({ repo }) =>
      writeFileSync(join(repo, 'milestones/M03-n8n-foundation/evidence/sanitizedprobe.json'), '{}'),
  ],
  ['a changed package scope', ({ repo }) => writeFileSync(join(repo, 'packages/shared/package.json'), '{}')],
  [
    'an injected nearer package scope',
    ({ repo }) => writeFileSync(join(repo, 'packages/shared/src/package.json'), '{}'),
  ],
  [
    'an injected nearer bare-import directory',
    ({ repo }) => mkdirSync(join(repo, 'packages/shared/src/node_modules')),
  ],
  [
    'a changed physical runtime dependency',
    ({ zod }) => writeFileSync(join(zod, 'v4/core.js'), 'public mutation'),
  ],
  ['an added physical runtime file', ({ zod }) => writeFileSync(join(zod, 'v4/new.js'), 'public mutation')],
  ['a missing physical runtime file', ({ zod }) => rmSync(join(zod, 'v4/core.js'))],
  ['a changed Node executable', ({ node }) => writeFileSync(node, 'DIFFERENT_PUBLIC_NODE')],
  [
    'a redirected package junction',
    ({ repo, root }) => {
      const other = join(root, 'other-zod');
      mkdirSync(other);
      rmSync(join(repo, 'packages/shared/node_modules/zod'));
      symlinkSync(other, join(repo, 'packages/shared/node_modules/zod'), 'junction');
    },
  ],
  [
    'a nested dependency junction',
    ({ zod, root }) => {
      const other = join(root, 'other-tree');
      mkdirSync(other);
      symlinkSync(other, join(zod, 'nested-link'), 'junction');
    },
  ],
  [
    'unexpected seal keys',
    ({ seal }) => {
      const s = JSON.parse(readFileSync(seal, 'utf8').replace(/^\uFEFF/, ''));
      s.extra = true;
      writeFileSync(seal, JSON.stringify(s));
    },
  ],
  [
    'coercible seal types',
    ({ seal }) => {
      const s = JSON.parse(readFileSync(seal, 'utf8').replace(/^\uFEFF/, ''));
      s.version = '2';
      writeFileSync(seal, JSON.stringify(s));
    },
  ],
]) {
  test(`public CheckOnly blocks ${name}`, windowsOnly, () =>
    fixture((f) => {
      mutate(f);
      const result = f.check();
      assert.equal(result.status, 1);
      assert.equal(result.stdout.trim(), 'FOUNDATION_PUBLIC_RUNTIME_BLOCKED');
      assert.equal(result.stderr, '');
    }),
  );
}

test('public CheckOnly blocks a different selected Node path even with identical bytes', windowsOnly, () =>
  fixture(({ root, node, check }) => {
    const alternate = join(root, 'another-node.exe');
    writeFileSync(alternate, readFileSync(node));
    const result = check(alternate);
    assert.equal(result.status, 1);
    assert.equal(result.stdout.trim(), 'FOUNDATION_PUBLIC_RUNTIME_BLOCKED');
  }),
);

test('explicit public builder requires replacement intent and never executes Node', windowsOnly, () =>
  fixture(({ repo, root }) => {
    const builder = join(repo, 'scripts/n8n/windows/New-M03FoundationPublicSeal.ps1');
    const first = powershell(`& ${literal(builder)}; exit $LASTEXITCODE`, root);
    assert.equal(first.status, 0);
    const receipt = JSON.parse(first.stdout);
    assert.equal(receipt.nodeExecuted, false);
    assert.equal(receipt.privateRead, false);
    assert.equal(receipt.networkRequests, 0);
    const target = join(repo, 'scripts/n8n/foundation-provision-seal.json');
    const before = readFileSync(target);
    const denied = powershell(`& ${literal(builder)}; exit $LASTEXITCODE`, root);
    assert.equal(denied.status, 1);
    assert.equal(denied.stdout.trim(), 'M03_FOUNDATION_PUBLIC_SEAL_BLOCKED');
    assert.equal(Buffer.compare(readFileSync(target), before), 0);
    const replace = powershell(`& ${literal(builder)} -ReplaceReviewedSeal; exit $LASTEXITCODE`, root);
    assert.equal(replace.status, 0);
    assert.equal(JSON.parse(replace.stdout).nodeExecuted, false);
  }),
);
