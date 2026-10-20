import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { dirname, basename, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const modulePath = resolve('scripts/n8n/windows/Acceptance-PublicRuntime.ps1');
const actualRoot = 'C:\\Users\\iway\\AppData\\Roaming\\npm\\node_modules\\vercel';
const literal = (s) => "'" + s.replaceAll("'", "''") + "'";
function fixture(run) {
  const directory = mkdtempSync(join(tmpdir(), 'emr-acceptance-cli-public-'));
  const root = join(directory, 'vercel');
  for (const [path, content] of Object.entries({
    'package.json': '{"name":"vercel","version":"56.5.0"}',
    'dist/index.js': 'import "@vercel/cli-config";',
    'node_modules/@vercel/cli-config/package.json': '{"name":"@vercel/cli-config","main":"dist/index.js"}',
    'node_modules/@vercel/cli-config/dist/index.js': 'module.exports=require("zod");',
    'node_modules/zod/package.json': '{"name":"zod","main":"index.js"}',
    'node_modules/zod/index.js': 'module.exports={public:true};',
  })) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  const module = join(directory, 'module.ps1');
  writeFileSync(module, readFileSync(modulePath, 'utf8').replaceAll(actualRoot, root));
  function powershell(source) {
    const script = join(directory, 'check.ps1');
    writeFileSync(script, `$ErrorActionPreference='Stop'; . ${literal(module)}; ${source}`);
    return spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', script], {
      windowsHide: true,
      encoding: 'utf8',
      timeout: 15000,
      env: Object.fromEntries(
        ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP'].flatMap((k) =>
          process.env[k] === undefined ? [] : [[k, process.env[k]]],
        ),
      ),
    });
  }
  try {
    return run({ root, directory, powershell });
  } finally {
    assert.equal(dirname(directory), tmpdir());
    assert.ok(basename(directory).startsWith('emr-acceptance-cli-public-'));
    rmSync(directory, { recursive: true, force: true });
  }
}
const windowsOnly = { skip: process.platform !== 'win32' };
test('public .NET physical guard rejects an owned junction and a file below that junction', windowsOnly, () =>
  fixture(({ root, directory, powershell }) => {
    const target = join(directory, 'owned-public-junction-target');
    const link = join(root, 'node_modules', 'injected-junction');
    mkdirSync(target);
    writeFileSync(join(target, 'index.js'), 'PUBLIC_FIXTURE_ONLY');
    symlinkSync(target, link, 'junction');
    for (const source of [
      `Get-M03AcceptancePhysicalPath ${literal(join(link, 'index.js'))} -File`,
      `New-M03AcceptanceVercelClosure ${literal(root)}`,
    ]) {
      const result = powershell(
        `try{$null=${source};Write-Output 'READY';exit 0}catch{Write-Output 'BLOCKED';exit 1}`,
      );
      assert.equal(result.status, 1);
      assert.equal(result.stdout.trim(), 'BLOCKED');
    }
  }),
);
test(
  'public CLI seal rejects the former dist-only map when external executable dependencies exist',
  windowsOnly,
  () =>
    fixture(({ root, powershell }) => {
      const r = powershell(
        `$f=[ordered]@{};foreach($p in @('package.json','dist/index.js')){$f[$p]=(Get-FileHash -LiteralPath (Join-Path ${literal(root)} $p)).Hash.ToLowerInvariant()};$v=[PSCustomObject]@{root=${literal(root)};files=[PSCustomObject]$f};try{Assert-M03AcceptanceVercelClosure $v;Write-Output 'READY';exit 0}catch{Write-Output 'BLOCKED';exit 1}`,
      );
      assert.equal(r.status, 1);
      assert.equal(r.stdout.trim(), 'BLOCKED');
    }),
);
test(
  'public CLI closure covers transitive code and resolution manifests and blocks each mutation',
  windowsOnly,
  () =>
    fixture(({ root, directory, powershell }) => {
      const seal = join(directory, 'closure.json');
      const build = powershell(
        `New-M03AcceptanceVercelClosure ${literal(root)} | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath ${literal(seal)} -Encoding UTF8;Write-Output 'BUILT'`,
      );
      assert.equal(build.status, 0, build.stderr);
      const map = JSON.parse(readFileSync(seal, 'utf8').replace(/^\uFEFF/, '')).files;
      assert.equal(Object.keys(map).length, 6);
      assert.equal(typeof map['node_modules/zod/index.js'], 'string');
      const check = () =>
        powershell(
          `$v=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText(${literal(seal)}));try{Assert-M03AcceptanceVercelClosure $v;Write-Output 'READY';exit 0}catch{Write-Output 'BLOCKED';exit 1}`,
        );
      assert.equal(check().status, 0);
      for (const path of ['node_modules/zod/index.js', 'node_modules/@vercel/cli-config/package.json']) {
        const file = join(root, path),
          original = readFileSync(file);
        writeFileSync(file, 'CHANGED_PUBLIC_INPUT');
        assert.equal(check().status, 1);
        writeFileSync(file, original);
      }
      writeFileSync(join(root, 'node_modules/zod/injected.js'), 'NEW_CODE');
      assert.equal(check().status, 1);
    }),
);
