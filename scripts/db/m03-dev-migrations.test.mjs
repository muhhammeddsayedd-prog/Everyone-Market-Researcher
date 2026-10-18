import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, describe, it } from 'node:test';

const powershell = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const directories = [];
const creatorPath = resolve('scripts/db/windows/New-M03DevMigrationHandoff.ps1');
const consumerPath = resolve('scripts/db/windows/Invoke-M03DevMigrations.ps1');
const cliRelative =
  'node_modules/.pnpm/@supabase+cli-windows-x64@2.121.0/node_modules/@supabase/cli-windows-x64/bin/supabase.exe';
const versions = [
  '20261017172928',
  '20261017172931',
  '20261017172934',
  '20261017172937',
  '20261017172940',
  '20261017172943',
  '20261017172945',
  '20261018034220',
  '20261018035417',
];
const names = [
  'extensions_schemas_roles',
  'core_tables',
  'auth_rls_views',
  'rpc_pipeline_core',
  'rpc_app_search',
  'storage_cron',
  'seed_taxonomies',
  'rpc_n8n_foundation',
  'price_book_plan',
];
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

function consumerFixture(mode = 'success') {
  const root = mkdtempSync(join(tmpdir(), 'emr-m03-migration-fixture-'));
  directories.push(root);
  const put = (name, content) => {
    const file = join(root, name);
    mkdirSync(resolve(file, '..'), { recursive: true });
    writeFileSync(file, content);
    return file;
  };
  put(
    'scripts/db/windows/Invoke-M03DevMigrations.ps1',
    readFileSync(consumerPath, 'utf8')
      .replace('$queryTimeoutMs = 30000', '$queryTimeoutMs = 500')
      .replace('$pushTimeoutMs = 180000', '$pushTimeoutMs = 500'),
  );
  put('scripts/db/windows/New-M03DevMigrationHandoff.ps1', readFileSync(creatorPath));
  put(
    'scripts/seed/check-tls.mjs',
    "console.log(JSON.stringify({status:'verified',phase:'tls_handshake',code:'TLS_VERIFIED',environment:'dev',projectRef:'zmotjsbzhzjvpelxvxlf',host:'aws-1-eu-central-1.pooler.supabase.com',port:5432,rejectUnauthorized:true,exactServerName:true,scopedCaVerified:true,startupMessageSent:false,authenticationAttempted:false,socketsClosed:true}));",
  );
  for (const name of ['supabase-root-2021.crt', 'supabase-root-2021.json']) {
    put(`scripts/seed/certs/${name}`, readFileSync(resolve(`scripts/seed/certs/${name}`)));
  }
  const migrations = versions.map((version, i) => {
    const file = `supabase/migrations/${version}_${names[i]}.sql`;
    const content = `-- synthetic fixture migration ${version}\nselect ${i};\n`;
    put(file, content);
    return {
      version,
      name: names[i],
      file,
      sha256: sha(content),
      historySha256: sha(`synthetic-ledger-${version}`),
    };
  });
  const identity = (entries) =>
    JSON.stringify([
      {
        receipt: {
          current_user: 'postgres',
          session_user: 'postgres',
          database: 'postgres',
          migrations: entries.map(({ version, name, historySha256 }) => ({ version, name, historySha256 })),
        },
      },
    ]);
  const executable = join(root, cliRelative);
  mkdirSync(resolve(executable, '..'), { recursive: true });
  const nativeDir = resolve(executable, '..');
  const csharp = `using System; using System.IO; using System.Threading;
public class FixtureCli { public static int Main(string[] args) {
 var dir=AppDomain.CurrentDomain.BaseDirectory; var joined=String.Join(" ",args); var version=joined=="--version";
 if(version) { if(Environment.GetEnvironmentVariable("PGPASSWORD")!=null)return 91; Console.WriteLine("2.121.0"); return 0; }
 File.AppendAllText(Path.Combine(dir,"calls.txt"),joined+"\\n");
 if(Environment.GetEnvironmentVariable("PGPASSWORD")!="synthetic-m03-dev-password" || Environment.GetEnvironmentVariable("SUPABASE_ACCESS_TOKEN")!=null || Environment.GetEnvironmentVariable("PGOPTIONS")!=null || Environment.GetEnvironmentVariable("NODE_OPTIONS")!=null) { Console.Error.WriteLine("synthetic-private-error-do-not-emit"); return 92; }
 var mode=File.ReadAllText(Path.Combine(dir,"mode.txt"));
 if(joined.Contains(" query ")) { var n=Path.Combine(dir,"queries.txt"); var count=File.Exists(n)?Int32.Parse(File.ReadAllText(n)):0; File.WriteAllText(n,(count+1).ToString()); Console.WriteLine(File.ReadAllText(Path.Combine(dir,count==0?"before.json":"after.json"))); return 0; }
 if(joined.Contains("--dry-run")) { Console.WriteLine(File.ReadAllText(Path.Combine(dir,"dry.json"))); return 0; }
 if(joined.Contains(" push ")) { if(mode=="timeout")Thread.Sleep(5000); if(mode=="failure"||mode=="partial") { Console.Error.WriteLine("synthetic-private-error-do-not-emit"); Console.WriteLine("synthetic-private-output-do-not-emit"); return 7; } Console.WriteLine(File.ReadAllText(Path.Combine(dir,"push.json"))); return 0; }
 return 93; } }`;
  const sourceFile = put('fixture-cli.cs', csharp);
  const compile = put(
    'compile.ps1',
    `$ErrorActionPreference='Stop'\nAdd-Type -Path '${sourceFile.replaceAll("'", "''")}' -OutputAssembly '${executable.replaceAll("'", "''")}' -OutputType ConsoleApplication\n`,
  );
  const compiled = spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-File', compile], {
    env: osEnvironment(),
    encoding: 'utf8',
    timeout: 20000,
    windowsHide: true,
  });
  assert.equal(compiled.status, 0, compiled.stderr);
  writeFileSync(join(nativeDir, 'mode.txt'), mode);
  writeFileSync(
    join(nativeDir, 'before.json'),
    identity(mode === 'completed' ? migrations : migrations.slice(0, 7)),
  );
  writeFileSync(
    join(nativeDir, 'after.json'),
    identity(mode === 'partial' ? migrations.slice(0, 8) : migrations),
  );
  const migrationFiles = migrations.slice(7).map(({ file }) => file.split('/').at(-1));
  writeFileSync(
    join(nativeDir, 'dry.json'),
    JSON.stringify({
      upToDate: false,
      dryRun: true,
      migrations: mode === 'dryMismatch' ? [migrationFiles[0]] : migrationFiles,
      seeds: [],
      roles: [],
      message: 'Finished supabase db push.',
    }),
  );
  writeFileSync(
    join(nativeDir, 'push.json'),
    JSON.stringify({
      upToDate: false,
      dryRun: false,
      migrations: migrationFiles,
      seeds: [],
      roles: [],
      message: 'Finished supabase db push.',
    }),
  );
  const files = {};
  for (const name of [
    'scripts/db/windows/Invoke-M03DevMigrations.ps1',
    'scripts/db/windows/New-M03DevMigrationHandoff.ps1',
    'scripts/seed/check-tls.mjs',
    'scripts/seed/certs/supabase-root-2021.crt',
    'scripts/seed/certs/supabase-root-2021.json',
    cliRelative,
  ])
    files[name] = sha(readFileSync(join(root, name)));
  const packet = {
    version: 1,
    target: 'zmotjsbzhzjvpelxvxlf',
    approved: true,
    authorizationReference:
      'Owner Proceed with next milestone 2026-10-18 M03 development; nonprod additive foundation',
    cliVersion: '2.121.0',
    baseline: migrations.slice(0, 7),
    pending: migrations.slice(7),
    files,
  };
  const packetFile = put('scripts/db/m03-dev-migration-packet.json', JSON.stringify(packet));
  mkdirSync(join(root, 'private/Temp'), { recursive: true });
  const handoff = join(root, 'private/Temp/emr-m03-dev-migration-password.dpapi');
  const encrypted = put(
    'encrypt.ps1',
    `$s=ConvertTo-SecureString 'synthetic-m03-dev-password' -AsPlainText -Force\ntry { $s|ConvertFrom-SecureString|Set-Content -LiteralPath '${handoff.replaceAll("'", "''")}' -Encoding ASCII } finally { $s.Dispose() }\n`,
  );
  assert.equal(
    spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-File', encrypted], {
      env: osEnvironment(),
      encoding: 'utf8',
      timeout: 10000,
      windowsHide: true,
    }).status,
    0,
  );
  const run = (checkOnly = false) =>
    spawnSync(
      powershell,
      [
        '-NoProfile',
        '-NonInteractive',
        '-File',
        join(root, 'scripts/db/windows/Invoke-M03DevMigrations.ps1'),
        ...(checkOnly ? ['-CheckOnly'] : []),
      ],
      {
        env: {
          ...osEnvironment(),
          LOCALAPPDATA: join(root, 'private'),
          PGPASSWORD: 'unrelated-parent-secret',
          SUPABASE_ACCESS_TOKEN: 'unrelated-parent-token',
          PGOPTIONS: 'unrelated-parent-options',
          NODE_OPTIONS: '--no-warnings',
        },
        encoding: 'utf8',
        timeout: 30000,
        windowsHide: true,
      },
    );
  const result = () =>
    JSON.parse(readFileSync(join(root, 'scripts/db/out/m03-dev-migration-latest.json'), 'utf8'));
  const calls = () =>
    existsSync(join(nativeDir, 'calls.txt')) ? readFileSync(join(nativeDir, 'calls.txt'), 'utf8') : '';
  return { root, put, handoff, packet, packetFile, nativeDir, run, result, calls };
}
const osEnvironment = () =>
  Object.fromEntries(
    ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP', 'LOCALAPPDATA', 'APPDATA', 'USERPROFILE'].flatMap(
      (key) => (process.env[key] === undefined ? [] : [[key, process.env[key]]]),
    ),
  );

function creatorFixture({ empty = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'emr-m03-migration-fixture-'));
  directories.push(root);
  mkdirSync(join(root, 'Temp'));
  const file = join(root, 'New-M03DevMigrationHandoff.ps1');
  const source = readFileSync(creatorPath, 'utf8').replace(
    "Read-Host 'EXISTING emr-dev database password (not prod or an application role)' -AsSecureString",
    empty
      ? '[Security.SecureString]::new()'
      : "ConvertTo-SecureString 'synthetic-m03-dev-password' -AsPlainText -Force",
  );
  writeFileSync(file, source);
  const handoff = join(root, 'Temp/emr-m03-dev-migration-password.dpapi');
  const oldHandoff = join(root, 'Temp/emr-m02-dev-db-password.dpapi');
  writeFileSync(oldHandoff, 'unrelated-old-handoff-sentinel');
  const run = () =>
    spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-File', file], {
      env: { ...osEnvironment(), LOCALAPPDATA: root, PGPASSWORD: 'unrelated-parent-sentinel' },
      encoding: 'utf8',
      timeout: 10000,
      windowsHide: true,
    });
  return { root, file, handoff, oldHandoff, run };
}

after(() => {
  for (const directory of directories) rmSync(directory, { recursive: true, force: true });
});

describe(
  'M03 dev migration handoff creator, synthetic isolated Windows fixtures',
  { skip: process.platform !== 'win32' },
  () => {
    it('creates only the new current-user encrypted M03 handoff and suppresses synthetic secret output', () => {
      const fixture = creatorFixture();
      const result = fixture.run();
      assert.equal(result.status, 0);
      assert.equal(result.stderr, '');
      assert.match(result.stdout, /M03 dev migration encrypted handoff saved/);
      assert.doesNotMatch(result.stdout, /synthetic-m03-dev-password|unrelated-parent-sentinel/);
      assert.ok(existsSync(fixture.handoff));
      assert.notEqual(readFileSync(fixture.handoff, 'utf8'), 'synthetic-m03-dev-password');
      assert.equal(readFileSync(fixture.oldHandoff, 'utf8'), 'unrelated-old-handoff-sentinel');
    });
    it('does not overwrite an existing M03 handoff', () => {
      const fixture = creatorFixture();
      writeFileSync(fixture.handoff, 'existing-owned-sentinel');
      const result = fixture.run();
      assert.equal(result.status, 1);
      assert.equal(readFileSync(fixture.handoff, 'utf8'), 'existing-owned-sentinel');
      assert.doesNotMatch(
        result.stdout + result.stderr,
        /existing-owned-sentinel|synthetic-m03-dev-password/,
      );
    });
    it('does not create an encrypted handoff for an empty hidden input', () => {
      const fixture = creatorFixture({ empty: true });
      const result = fixture.run();
      assert.equal(result.status, 1);
      assert.equal(existsSync(fixture.handoff), false);
      assert.equal(readFileSync(fixture.oldHandoff, 'utf8'), 'unrelated-old-handoff-sentinel');
    });
  },
);

describe(
  'M03 dev migration bounded consumer, synthetic native CLI and isolated DPAPI only',
  { skip: process.platform !== 'win32' },
  () => {
    it('checks public seals and presence without decrypting or connecting', () => {
      const f = consumerFixture();
      const r = f.run(true);
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.match(r.stdout, /CHECK_ONLY_READY/);
      assert.equal(f.calls(), '');
      assert.ok(existsSync(f.handoff));
    });
    it('rejects modified migration bytes before consuming the handoff', () => {
      const f = consumerFixture();
      f.put(f.packet.pending[0].file, 'modified');
      const r = f.run();
      assert.equal(r.status, 1);
      assert.ok(existsSync(f.handoff));
      assert.equal(f.calls(), '');
    });
    it('rejects an unknown extra local migration before consuming the handoff', () => {
      const f = consumerFixture();
      f.put('supabase/migrations/20261019000000_extra.sql', 'select 1;');
      const r = f.run();
      assert.equal(r.status, 1);
      assert.ok(existsSync(f.handoff));
      assert.equal(f.calls(), '');
    });
    it('does not treat handoff presence as authentication and handles a missing handoff privately', () => {
      const f = consumerFixture();
      rmSync(f.handoff);
      const r = f.run(true);
      assert.equal(r.status, 2);
      assert.match(r.stdout, /HANDOFF_MISSING/);
      assert.equal(f.calls(), '');
    });
    it('reports a broken public seal before missing credential delivery', () => {
      const f = consumerFixture();
      f.put(f.packet.pending[0].file, 'modified public migration');
      rmSync(f.handoff);
      const r = f.run(true);
      assert.equal(r.status, 1);
      assert.match(r.stdout, /PREFLIGHT_BLOCKED/);
      assert.doesNotMatch(r.stdout, /HANDOFF_MISSING/);
      assert.equal(f.calls(), '');
    });
    it('preserves completed baseline history and never reapplies already-completed M03 versions', () => {
      const f = consumerFixture('completed');
      const r = f.run();
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.equal(f.result().status, 'already_complete');
      assert.doesNotMatch(f.calls(), / push /);
      assert.equal(existsSync(f.handoff), false);
    });
    it('requires exact dry-run migrations with no seeds/roles before pushing', () => {
      const f = consumerFixture('dryMismatch');
      const r = f.run();
      assert.equal(r.status, 1);
      assert.equal(f.result().status, 'dry_run_rejected');
      assert.equal(f.calls().includes('--dry-run'), true);
      assert.equal(
        f
          .calls()
          .split('\n')
          .filter((x) => x.includes(' push ') && !x.includes('--dry-run')).length,
        0,
      );
      assert.equal(existsSync(f.handoff), false);
    });
    it('uses only the dev child password, clean public workdir and strict TLS then records exact completion', () => {
      const f = consumerFixture();
      const r = f.run();
      assert.equal(r.status, 0, r.stdout + r.stderr);
      const receipt = f.result();
      assert.equal(receipt.status, 'complete');
      assert.equal(receipt.historyBefore, 'baseline');
      assert.equal(receipt.historyAfter, 'complete');
      assert.equal(receipt.childrenClosed, true);
      assert.equal(receipt.handoffDeleted, true);
      assert.equal(receipt.scratchDeleted, true);
      assert.equal(existsSync(f.handoff), false);
      assert.doesNotMatch(
        r.stdout + r.stderr,
        /synthetic-m03-dev-password|unrelated-parent-secret|synthetic-private/,
      );
      assert.match(f.calls(), /sslmode=verify-full/);
      assert.match(f.calls(), /sslrootcert=/);
      assert.doesNotMatch(f.calls(), /--linked|--include-seed|--include-roles/);
      assert.equal(existsSync(join(f.root, 'scripts/db/out/m03-dev-migration-attempt.json')), true);
    });
    it('reconciles a failed push without replaying it, suppresses private errors and retains admission', () => {
      const f = consumerFixture('failure');
      const r = f.run();
      assert.equal(r.status, 1);
      assert.equal(f.result().status, 'reconciled_complete_after_failure');
      assert.equal(
        f
          .calls()
          .split('\n')
          .filter((x) => x.includes(' push ') && !x.includes('--dry-run')).length,
        1,
      );
      assert.equal(
        f
          .calls()
          .split('\n')
          .filter((x) => x.includes(' query ')).length,
        2,
      );
      assert.doesNotMatch(r.stdout + r.stderr, /synthetic-private/);
      assert.ok(existsSync(join(f.root, 'scripts/db/out/m03-dev-migration-attempt.json')));
      const retry = f.run();
      assert.equal(retry.status, 1);
      assert.match(retry.stdout, /ATTEMPT_ALREADY_RECORDED/);
    });
    it('retains an ambiguous partial history and never auto-retries successful portions', () => {
      const f = consumerFixture('partial');
      const r = f.run();
      assert.equal(r.status, 1);
      assert.equal(f.result().status, 'reconciliation_required');
      assert.equal(f.result().historyAfter, 'rejected');
      assert.equal(existsSync(f.handoff), false);
      assert.equal(
        f
          .calls()
          .split('\n')
          .filter((x) => x.includes(' push ') && !x.includes('--dry-run')).length,
        1,
      );
    });
    it('kills a timed-out credential child before read-only reconciliation and cleanup', () => {
      const f = consumerFixture('timeout');
      const r = f.run();
      assert.equal(r.status, 1);
      assert.equal(f.result().status, 'reconciled_complete_after_failure');
      assert.equal(f.result().childrenClosed, true);
      assert.equal(f.result().pushNativeExit, -1);
      assert.equal(existsSync(f.handoff), false);
      assert.doesNotMatch(r.stdout + r.stderr, /synthetic-m03-dev-password/);
    });
    it('allows presence-free CheckOnly readback of the exact successful admission receipt without replay', () => {
      const f = consumerFixture();
      assert.equal(f.run().status, 0);
      const count = f.calls();
      const r = f.run(true);
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.match(r.stdout, /RECORDED_COMPLETE/);
      assert.equal(f.calls(), count);
      assert.equal(existsSync(f.handoff), false);
    });
    it('preserves the handoff if public TLS verification fails before any login', () => {
      const f = consumerFixture();
      f.put('scripts/seed/check-tls.mjs', "console.log('{}');process.exitCode=1;");
      f.packet.files['scripts/seed/check-tls.mjs'] = sha(
        readFileSync(join(f.root, 'scripts/seed/check-tls.mjs')),
      );
      writeFileSync(f.packetFile, JSON.stringify(f.packet));
      const r = f.run();
      assert.equal(r.status, 1);
      assert.equal(f.result().authenticationAttempted, false);
      assert.equal(f.calls(), '');
      assert.ok(existsSync(f.handoff));
    });
    it('rejects a mismatched original hosted ledger fingerprint without dry-run or push', () => {
      const f = consumerFixture();
      const before = JSON.parse(readFileSync(join(f.nativeDir, 'before.json'), 'utf8'));
      before[0].receipt.migrations[0].historySha256 = '0'.repeat(64);
      writeFileSync(join(f.nativeDir, 'before.json'), JSON.stringify(before));
      const r = f.run();
      assert.equal(r.status, 1);
      assert.equal(f.result().status, 'history_rejected');
      assert.doesNotMatch(f.calls(), / push /);
      assert.equal(existsSync(f.handoff), false);
    });
  },
);
