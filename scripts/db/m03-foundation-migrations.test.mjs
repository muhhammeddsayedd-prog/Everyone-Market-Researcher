import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, describe, it } from 'node:test';

const powershell = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const directories = [];
const creatorPath = resolve('scripts/db/windows/New-M03FoundationMigrationHandoff.ps1');
const consumerPath = resolve('scripts/db/windows/Invoke-M03FoundationMigrations.ps1');
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
  '20261018070042',
  '20261018231756',
  '20261018232014',
  '20261018232922',
  '20261018233338',
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
  'n8n_worker_gateway_admission',
  'm03_actor_launch_admission',
  'm03_foundation_gateway',
  'm03_foundation_safety_receipts',
  'm03_foundation_boundary_hardening',
];
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const clockPublicFiles = [
  'scripts/n8n/foundation-live-clock-amendment.mjs',
  'scripts/n8n/foundation-live-zero-setup.mjs',
  'scripts/n8n/foundation-control-state.mjs',
  'scripts/n8n/foundation-runtime-checkpoint.mjs',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-clock-approval-20261021.json',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-zero-setup-20261021.json',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-clock-amendment-20261021.md',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-late-delivery-20261021.json',
  'scripts/n8n/foundation-live-postcheck-continuation.mjs',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-postcheck-approval-20261021.json',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-postcheck-checkpoint-20261021.json',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-postcheck-continuation-20261021.md',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-amended-attempt-20261021.json',
  'scripts/n8n/foundation-live-remaining-continuation.mjs',
  'scripts/assert/m03_smoke_reactivate.sql',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-remaining-checkpoint-20261022.json',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-remaining-packet-20261022.md',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-postcheck-attempt-20261021.json',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-vercel-postlogin-actual-20261022.json',
  'scripts/n8n/foundation-live-startup-replacement.mjs',
  'scripts/assert/m03_smoke_reactivate_startup.sql',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-startup-replacement-checkpoint-20261022.json',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-startup-replacement-packet-20261022.md',
  'scripts/n8n/foundation-live-project-verified-continuation.mjs',
  'scripts/assert/m03_smoke_reactivate_project_verified.sql',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-project-verified-checkpoint-20261022.json',
  'milestones/M03-n8n-foundation/evidence/dev-acceptance-project-verified-packet-20261022.md',
  'scripts/db/foundation-inspect.sql',
  'scripts/n8n/windows/Dev-CredentialStore.ps1',
];

function consumerFixture(mode = 'success') {
  const root = mkdtempSync(join(tmpdir(), 'emr-m03-foundation-migration-fixture-'));
  directories.push(root);
  const put = (name, content) => {
    const file = join(root, name);
    mkdirSync(resolve(file, '..'), { recursive: true });
    writeFileSync(file, content);
    return file;
  };
  put(
    'scripts/db/windows/Invoke-M03FoundationMigrations.ps1',
    readFileSync(consumerPath, 'utf8')
      .replace('$queryTimeoutMs = 30000', '$queryTimeoutMs = 500')
      .replace('$pushTimeoutMs = 180000', '$pushTimeoutMs = 500'),
  );
  put('scripts/db/windows/New-M03FoundationMigrationHandoff.ps1', readFileSync(creatorPath));
  for (const name of [
    'scripts/db/windows/Foundation-AdminControl.ps1',
    'scripts/db/foundation-settlement.sql',
    'scripts/db/foundation-postcheck.sql',
    'scripts/db/foundation-replay-snapshot.sql',
    'scripts/assert/m03_smoke_setup.sql',
    'scripts/assert/m03_smoke_teardown.sql',
    'scripts/assert/m03_smoke_assert.sql',
    'scripts/db/check-foundation-types.mjs',
    'packages/shared/src/db.types.ts',
    'node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/lib/typescript.js',
    ...clockPublicFiles,
  ])
    put(
      name,
      existsSync(resolve(name)) ? readFileSync(resolve(name)) : '// synthetic pending public module\n',
    );
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
 if(Environment.GetEnvironmentVariable("PGPASSWORD")!="synthetic-m03-foundation-dev-password" || Environment.GetEnvironmentVariable("SUPABASE_ACCESS_TOKEN")!=null || Environment.GetEnvironmentVariable("PGOPTIONS")!=null || Environment.GetEnvironmentVariable("NODE_OPTIONS")!=null) { Console.Error.WriteLine("synthetic-private-error-do-not-emit"); return 92; }
 var mode=File.ReadAllText(Path.Combine(dir,"mode.txt"));
 if(joined.Contains("gen types")) { Console.WriteLine(File.ReadAllText(Path.Combine(dir,"types.ts"))); return 0; }
 if(joined.Contains(" advisors ")) { Console.WriteLine("{\\"results\\":[],\\"message\\":\\"db advisors\\"}"); return 0; }
 if(joined.Contains(" query ")) {
  var file=Array.IndexOf(args,"--file");var sql=File.ReadAllText(args[file+1]);
  if(!sql.Contains("supabase_migrations.schema_migrations")){
   File.AppendAllText(Path.Combine(dir,"control-sql.txt"),sql+"\\n--NEXT\\n");
   if(sql.StartsWith("do ")) { if(sql.Contains("do $smoke_teardown$") && File.Exists(Path.Combine(dir,"fixture-mode.txt")) && File.ReadAllText(Path.Combine(dir,"fixture-mode.txt"))=="archive-failure") {Console.Error.WriteLine("synthetic-private-archive-error");return 7;}Console.WriteLine("DO");return 0; }
   var key=sql.Contains(" as continuation_fixture_absence;")?"continuation_fixture_absence":sql.Contains(" as continuation_preflight;")?"continuation_preflight":sql.Contains(" as postcheck;")?"postcheck":sql.Contains(" as preflight;")?"preflight":sql.Contains(" as provision ")?"provision":sql.Contains("'retained_items'")?"fixture_archived":sql.Contains(" as fixture ")?"fixture":sql.Contains(" as ownership ")?"ownership":sql.Contains(" as closure ")?"closure":sql.Contains(" as closed;")?"close":sql.Contains(" as unknown_callback;")?"unknown":sql.Contains(" as settlement;")?"settlement":sql.Contains(" as original")?"original":sql.Contains(" as verified;")?"verified":sql.Contains(" as snapshot;")?"snapshot":null;
   var fixtureMode=File.Exists(Path.Combine(dir,"fixture-mode.txt"))?File.ReadAllText(Path.Combine(dir,"fixture-mode.txt")):"none";
   if(key=="continuation_fixture_absence") {var countFile=Path.Combine(dir,"absence-queries.txt");var absenceCount=File.Exists(countFile)?Int32.Parse(File.ReadAllText(countFile)):0;File.WriteAllText(countFile,(absenceCount+1).ToString());if(fixtureMode=="startup" || (fixtureMode=="pre-fixture" && absenceCount>=1))key="fixture_absence_present";}
   if(key=="fixture") {var countFile=Path.Combine(dir,"fixture-reads.txt");var fixtureCount=File.Exists(countFile)?Int32.Parse(File.ReadAllText(countFile)):0;File.WriteAllText(countFile,(fixtureCount+1).ToString());if(fixtureMode=="changed" && fixtureCount>=1)key="fixture_changed";if(fixtureMode=="legacy-intent" && fixtureCount==0)File.WriteAllText(File.ReadAllText(Path.Combine(dir,"legacy-intent-path.txt")),"contradictory-provision-intent");}
   if(key!=null){Console.WriteLine(File.ReadAllText(Path.Combine(dir,key+".json")));return 0;}
   if(sql.StartsWith("select ops.foundation_gateway_provision(")){Console.WriteLine("[]");return 0;}
   Console.Error.WriteLine("synthetic-private-unknown-sql");return 98;
  }
  var n=Path.Combine(dir,"queries.txt"); var count=File.Exists(n)?Int32.Parse(File.ReadAllText(n)):0; File.WriteAllText(n,(count+1).ToString()); Console.WriteLine(File.ReadAllText(Path.Combine(dir,count==0?"before.json":"after.json"))); return 0;
 }
  // CLI2.121.0 root.ts gives legacy --output json precedence over --output-format json.
  // Push uses the selected text output layer; query instead writes its own JSON.
  if(joined.Contains(" push ") && joined.Contains("--output json")) { Console.WriteLine("Finished supabase db push."); return 0; }
  if(joined.Contains("--dry-run")) { if(mode=="dryNativeFailure") { Console.Error.WriteLine("synthetic-private-error-do-not-emit"); Console.WriteLine("synthetic-private-output-do-not-emit"); return 7; } Console.WriteLine(File.ReadAllText(Path.Combine(dir,"dry.json"))); return 0; }
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
  writeFileSync(join(nativeDir, 'types.ts'), readFileSync(resolve('packages/shared/src/db.types.ts')));
  const fixtureResult = {
    result: 'M03_SMOKE_FIXTURE_READY',
    company_code: 'C999',
    competitor_id: '90000000-0000-4000-8000-000000000001',
    account_id: '90000000-0000-4000-8000-000000000002',
    platform: 'website_work_page',
    url: 'https://everyone.film/about-everyone',
    competitor_status: 'active',
    account_status: 'active',
  };
  const controlRows = {
    continuation_fixture_absence: { continuation_fixture_absence: { conflictingCompetitors: 0 } },
    fixture_absence_present: { continuation_fixture_absence: { conflictingCompetitors: 1 } },
    fixture_changed: { fixture: { ...fixtureResult, account_id: '90000000-0000-4000-8000-000000000099' } },
    fixture_archived: {
      fixture: {
        result: 'M03_SMOKE_FIXTURE_ARCHIVED',
        company_code: 'C999',
        competitor_id: fixtureResult.competitor_id,
        account_id: fixtureResult.account_id,
        competitor_status: 'archived',
        account_status: 'paused',
        retained_items: 0,
      },
    },
    continuation_preflight: {
      continuation_preflight: {
        windowId: 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9',
        windows: 0,
        approvals: 0,
        launches: 0,
        requests: 0,
        bindings: 0,
        leases: 0,
      },
    },
    postcheck: {
      postcheck: {
        identity: true,
        tables_rls: true,
        no_machine_table_grants: true,
        rpc_shape: true,
        owner_control_restricted: true,
        all_project_tables_rls: true,
        all_views_invoker: true,
        gw01_closed: true,
        domain_auto_join_off: true,
        baseline_counts: true,
        schemas: ['app', 'api', 'ops', 'ingest'],
      },
    },
    preflight: {
      preflight: {
        projectRef: 'zmotjsbzhzjvpelxvxlf',
        priceBook: [],
        dailyBudgetUsd: 25,
        statsDailyEnabled: false,
        errorCount24h: 0,
        notificationCooldownClear: true,
        observedAt: new Date().toISOString(),
      },
    },
    fixture: { fixture: fixtureResult },
    provision: {
      provision: {
        windowId: 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9',
        boundAudience: 'https://everyone-market-researcher-fixture.vercel.app',
        boundCommitSha: 'f'.repeat(40),
        boundDeploymentId: 'dpl_Fixture',
        started: false,
        closed: false,
        totalAdmitted: 0,
        approvalCount: 1,
      },
    },
    close: { closed: { state: 'closed', window: { closed: true } } },
    ownership: { ownership: { owned: true } },
    closure: { closure: { closed: true } },
    unknown: {
      unknown_callback: {
        apify_run_id: 'M03AcceptanceUnknown0001',
        registry_absent: true,
        launch_absent: true,
      },
    },
    settlement: { settlement: { requests: [], leases: [], providers: [] } },
    original: { original: { original: true } },
    verified: { verified: { matched: true } },
    snapshot: { snapshot: { items: 0 } },
  };
  for (const [name, row] of Object.entries(controlRows))
    writeFileSync(join(nativeDir, name + '.json'), JSON.stringify([row]));
  writeFileSync(
    join(nativeDir, 'before.json'),
    identity(mode === 'completed' ? migrations : migrations.slice(0, 10)),
  );
  writeFileSync(
    join(nativeDir, 'after.json'),
    identity(mode === 'partial' ? migrations.slice(0, 11) : migrations),
  );
  const migrationFiles = migrations.slice(10).map(({ file }) => file.split('/').at(-1));
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
    'scripts/db/windows/Invoke-M03FoundationMigrations.ps1',
    'scripts/db/windows/New-M03FoundationMigrationHandoff.ps1',
    'scripts/db/windows/Foundation-AdminControl.ps1',
    'scripts/db/foundation-settlement.sql',
    'scripts/db/foundation-postcheck.sql',
    'scripts/db/foundation-replay-snapshot.sql',
    'scripts/assert/m03_smoke_setup.sql',
    'scripts/assert/m03_smoke_teardown.sql',
    'scripts/assert/m03_smoke_assert.sql',
    'scripts/db/check-foundation-types.mjs',
    'packages/shared/src/db.types.ts',
    'node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/lib/typescript.js',
    'scripts/seed/check-tls.mjs',
    'scripts/seed/certs/supabase-root-2021.crt',
    'scripts/seed/certs/supabase-root-2021.json',
    cliRelative,
    ...clockPublicFiles,
  ])
    files[name] = sha(readFileSync(join(root, name)));
  const packet = {
    version: 1,
    target: 'zmotjsbzhzjvpelxvxlf',
    approved: true,
    authorizationReference:
      'Owner approved M03 A-D dev acceptance at f42930f90c2de43c84f61ad6d966d0ee6074d70e on 2026-10-21',
    cliVersion: '2.121.0',
    baseline: migrations.slice(0, 10),
    pending: migrations.slice(10),
    files,
    node: { path: process.execPath, sha256: sha(readFileSync(process.execPath)) },
  };
  const packetFile = put('scripts/db/m03-foundation-dev-migration-packet.json', JSON.stringify(packet));
  mkdirSync(join(root, 'private/Temp'), { recursive: true });
  const handoff = join(root, 'private/Temp/emr-m03-foundation-dev-migration-password.dpapi');
  const encrypted = put(
    'encrypt.ps1',
    `$s=ConvertTo-SecureString 'synthetic-m03-foundation-dev-password' -AsPlainText -Force\ntry { $s|ConvertFrom-SecureString|Set-Content -LiteralPath '${handoff.replaceAll("'", "''")}' -Encoding ASCII } finally { $s.Dispose() }\n`,
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
  const leaseCreatedAt = Date.now();
  const leaseFile = put(
    'private/Temp/emr-m03-foundation-dev-migration-password.lease.json',
    JSON.stringify({
      version: 1,
      environment: 'dev',
      projectRef: 'zmotjsbzhzjvpelxvxlf',
      purpose: 'm03-foundation-phase-a-dev',
      approvalSha: 'f42930f90c2de43c84f61ad6d966d0ee6074d70e',
      createdAt: new Date(leaseCreatedAt).toISOString().replace('Z', '0000Z'),
      expiresAt: new Date(leaseCreatedAt + 2 * 3600000).toISOString().replace('Z', '0000Z'),
    }),
  );
  const run = (
    checkOnly = false,
    controlInput = null,
    amended = false,
    continuation = false,
    remaining = false,
  ) =>
    spawnSync(
      powershell,
      [
        '-NoProfile',
        '-NonInteractive',
        '-File',
        join(root, 'scripts/db/windows/Invoke-M03FoundationMigrations.ps1'),
        ...(checkOnly ? ['-CheckOnly'] : []),
        ...(controlInput === null && !amended && !continuation && !remaining ? [] : ['-PhaseAControl']),
        ...(amended ? ['-ClockAmendment'] : []),
        ...(continuation ? ['-PostcheckContinuation'] : []),
        ...(remaining ? ['-RemainingContinuation'] : []),
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
        input: controlInput,
        timeout: 30000,
        windowsHide: true,
      },
    );
  const result = (continuation = false) =>
    JSON.parse(
      readFileSync(
        join(
          root,
          continuation
            ? 'scripts/db/out/m03-foundation-postcheck-continuation-a570212a-634c-444f-90a2-578ae47e8d27-latest.json'
            : 'scripts/db/out/m03-foundation-dev-migration-latest.json',
        ),
        'utf8',
      ),
    );
  const calls = () =>
    existsSync(join(nativeDir, 'calls.txt')) ? readFileSync(join(nativeDir, 'calls.txt'), 'utf8') : '';
  return { root, put, handoff, leaseFile, packet, packetFile, nativeDir, run, result, calls };
}
const commandLines = (entries) =>
  entries
    .map(([kind, args = {}], index) =>
      JSON.stringify({ id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, kind, args }),
    )
    .join('\n') + '\n';
const preview = {
  audience: 'https://everyone-market-researcher-fixture.vercel.app',
  commitSha: 'f'.repeat(40),
  deploymentId: 'dpl_Fixture',
};
const osEnvironment = () =>
  Object.fromEntries(
    ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP', 'LOCALAPPDATA', 'APPDATA', 'USERPROFILE'].flatMap(
      (key) => (process.env[key] === undefined ? [] : [[key, process.env[key]]]),
    ),
  );

// Scripted public-proof producer in an isolated repository, not an actual
// admission or credential. Genuine claimed brands are covered by client tests.
function preparePostcheckContinuation(f) {
  const relative = 'scripts/n8n/foundation-live-postcheck-continuation.mjs';
  const start = Date.now();
  f.put(
    relative,
    `const admitted=${JSON.stringify({ kind: 'clock_postcheck_continuation_admitted', segmentId: 'a570212a-634c-444f-90a2-578ae47e8d27', sourceCommitSha: 'f42930f90c2de43c84f61ad6d966d0ee6074d70e', windowId: 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9', startsAt: start, deadlineAt: start + 3600000, stopNewAt: start + 3000000, hardDeadlineAt: start + 4200000, privateRead: false, networkRequests: 0 })};if(process.argv[2]==='CheckOnly'){const {startsAt,deadlineAt,stopNewAt,hardDeadlineAt,...ready}=admitted;console.log(JSON.stringify({...ready,kind:'postcheck_continuation_ready'}));}else if(process.argv[2]==='ReadClaimed') console.log(JSON.stringify(admitted));else process.exitCode=1;`,
  );
  f.packet.files[relative] = sha(readFileSync(join(f.root, relative)));
  writeFileSync(f.packetFile, JSON.stringify(f.packet));
  const preserved = new Map();
  for (const name of [
    'm03-foundation-dev-migration-attempt.json',
    'm03-foundation-dev-migration-latest.json',
    'm03-foundation-hosted-db.types.ts',
  ]) {
    const path = f.put('scripts/db/out/' + name, `preserved-${name}\n`);
    preserved.set(path, readFileSync(path));
  }
  return {
    start,
    preserved,
    assertPreserved() {
      for (const [path, bytes] of preserved) assert.deepEqual(readFileSync(path), bytes);
    },
  };
}

function creatorFixture({ empty = false, postcheckContinuation = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'emr-m03-foundation-migration-fixture-'));
  directories.push(root);
  mkdirSync(join(root, 'Temp'));
  const creator = join(root, 'scripts/db/windows/New-M03FoundationMigrationHandoff.ps1');
  const adapter = join(root, 'scripts/n8n/windows/Dev-CredentialStore.ps1');
  mkdirSync(resolve(creator, '..'), { recursive: true });
  mkdirSync(resolve(adapter, '..'), { recursive: true });
  writeFileSync(creator, readFileSync(creatorPath));
  writeFileSync(adapter, readFileSync('scripts/n8n/windows/Dev-CredentialStore.ps1'));
  const file = join(root, 'synthetic-owner-setup.ps1');
  writeFileSync(
    file,
    `$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue'
. '${adapter.replaceAll("'", "''")}'
function Read-Host {param($Prompt,[switch]$AsSecureString) ${empty ? '[Security.SecureString]::new()' : "ConvertTo-SecureString 'synthetic-m03-foundation-dev-password' -AsPlainText -Force"}}
try{Initialize-M03DevCredentials -Action Initialize -Kind Admin}catch{Write-Output 'M03_DEV_ACCESS_BLOCKED';exit 1}
& '${creator.replaceAll("'", "''")}' ${postcheckContinuation ? '-PostcheckContinuation' : ''}
exit $LASTEXITCODE
`,
  );
  const handoff = join(root, 'Temp/emr-m03-foundation-dev-migration-password.dpapi');
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
  'remaining no-authority boundary, isolated real PowerShell consumer',
  { skip: process.platform !== 'win32' },
  () => {
    it('verifies every public input then reports approval_required without opening its synthetic handoff or creating receipts', () => {
      const f = consumerFixture('completed');
      const relative = 'scripts/n8n/foundation-live-remaining-continuation.mjs';
      f.put(
        relative,
        `console.log(JSON.stringify({kind:'remaining_continuation_approval_required',status:'approval_required',approvalRequired:true,segmentId:'e8035391-dba8-48c9-97e0-139ba980d86e',sourceCommitSha:'f42930f90c2de43c84f61ad6d966d0ee6074d70e',windowId:'df4f29ec-e2dc-4d82-a276-62a4e695e6f9',privateRead:false,networkRequests:0}));`,
      );
      f.packet.files[relative] = sha(readFileSync(join(f.root, relative)));
      writeFileSync(f.packetFile, JSON.stringify(f.packet));
      const handoff = readFileSync(f.handoff),
        lease = readFileSync(f.leaseFile);
      const check = f.run(true, null, false, false, true);
      assert.equal(check.status, 3, check.stdout + check.stderr);
      assert.match(check.stdout, /APPROVAL_REQUIRED/);
      assert.deepEqual(readFileSync(f.handoff), handoff);
      assert.deepEqual(readFileSync(f.leaseFile), lease);
      assert.equal(f.calls(), '');
      const denied = f.run(false, null, false, false, true);
      assert.equal(denied.status, 1);
      assert.match(denied.stdout, /PREFLIGHT_BLOCKED/);
      assert.deepEqual(readFileSync(f.handoff), handoff);
      assert.equal(f.calls(), '');
      assert.equal(
        existsSync(
          join(
            f.root,
            'scripts/db/out/m03-foundation-remaining-continuation-e8035391-dba8-48c9-97e0-139ba980d86e-attempt.json',
          ),
        ),
        false,
      );
    });
  },
);

describe(
  'postcheck-only continuation, isolated Windows native protocol',
  { skip: process.platform !== 'win32' },
  () => {
    it('preserves old attempts/types and completes fresh14 readback and new postchecks without migration commands', () => {
      const f = consumerFixture('completed'),
        p = preparePostcheckContinuation(f);
      const r = f.run(
        false,
        commandLines([['postcheck'], ['fixture'], ['provision', preview], ['close'], ['end']]),
        false,
        true,
      );
      assert.equal(r.status, 0, r.stdout + r.stderr);
      const receipt = f.result(true);
      assert.equal(receipt.postcheckContinuation, true);
      assert.equal(receipt.historyBefore, 'complete');
      assert.equal(receipt.historyAfter, 'complete');
      assert.equal(receipt.pushAttempted, false);
      assert.equal(receipt.dryRunCheck, 'not_attempted');
      assert.equal(receipt.phaseAClosed, true);
      assert.deepEqual(receipt.pendingVersions, []);
      assert.doesNotMatch(f.calls(), / push |--dry-run| reset |migration repair/);
      assert.equal(
        f
          .calls()
          .split('\n')
          .filter((l) => l.includes('history.sql')).length,
        3,
      );
      assert.equal(receipt.postcheckStage, 'complete');
      const rows = r.stdout.trim().split(/\r?\n/).map(JSON.parse),
        post = rows.find((row) => row.kind === 'postcheck').result;
      assert.match(
        post.typesCandidate,
        new RegExp(`^scripts/db/out/m03-foundation-continuation-${receipt.runId}-db\\.types\\.ts$`),
      );
      assert.equal(rows[0].postcheckContinuation, true);
      assert.equal(Date.parse(rows[0].actionDeadline), p.start + 3600000);
      assert.equal(existsSync(join(f.root, post.typesCandidate)), true);
      p.assertPreserved();
      const sql = readFileSync(join(f.nativeDir, 'control-sql.txt'), 'utf8');
      assert.ok(sql.indexOf('as continuation_preflight;') < sql.indexOf('do $smoke_setup$'));
      assert.equal((sql.match(/as continuation_preflight;/g) || []).length, 3);
      assert.equal(existsSync(f.handoff), false);
      const latestPath = join(
          f.root,
          'scripts/db/out/m03-foundation-postcheck-continuation-a570212a-634c-444f-90a2-578ae47e8d27-latest.json',
        ),
        latestBytes = readFileSync(latestPath),
        priorCalls = f.calls();
      const replay = f.run(true, null, false, true);
      assert.equal(replay.status, 1);
      assert.match(replay.stdout, /CONTINUATION_ALREADY_RECORDED/);
      assert.deepEqual(readFileSync(latestPath), latestBytes);
      assert.equal(f.calls(), priorCalls);
    });
    it('rejects baseline10 instead of falling back to dry-run or push and retains prior receipts', () => {
      const f = consumerFixture(),
        p = preparePostcheckContinuation(f);
      const r = f.run(false, commandLines([['fixture']]), false, true);
      assert.equal(r.status, 1, r.stdout + r.stderr);
      assert.equal(f.result(true).status, 'history_rejected');
      assert.doesNotMatch(f.calls(), / push |--dry-run/);
      assert.equal(existsSync(join(f.nativeDir, 'control-sql.txt')), false);
      p.assertPreserved();
    });
    it('rejects an existing logical window before fixture or provisioning mutation', () => {
      const f = consumerFixture('completed'),
        p = preparePostcheckContinuation(f);
      writeFileSync(
        join(f.nativeDir, 'continuation_preflight.json'),
        JSON.stringify([
          {
            continuation_preflight: {
              windowId: 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9',
              windows: 1,
              approvals: 0,
              launches: 0,
              requests: 0,
              bindings: 0,
              leases: 0,
            },
          },
        ]),
      );
      const r = f.run(false, commandLines([['postcheck'], ['fixture']]), false, true);
      assert.equal(r.status, 1, r.stdout + r.stderr);
      assert.doesNotMatch(
        readFileSync(join(f.nativeDir, 'control-sql.txt'), 'utf8'),
        /do \$smoke_setup\$|select ops\.foundation_gateway_provision\(/,
      );
      assert.doesNotMatch(f.calls(), / push |--dry-run/);
      p.assertPreserved();
    });
    it('refuses an existing C999 or smoke-slug fixture at startup without adopting it', () => {
      const f = consumerFixture('completed'),
        p = preparePostcheckContinuation(f);
      writeFileSync(join(f.nativeDir, 'fixture-mode.txt'), 'startup');
      const r = f.run(false, commandLines([['postcheck'], ['fixture'], ['end']]), false, true);
      assert.equal(r.status, 1, r.stdout + r.stderr);
      const sql = readFileSync(join(f.nativeDir, 'control-sql.txt'), 'utf8');
      assert.doesNotMatch(sql, /do \$smoke_setup\$|select ops\.foundation_gateway_provision\(/);
      assert.ok(sql.includes("company_code='C999' or slug='emr-smoke-test'"));
      assert.doesNotMatch(f.calls(), / push |--dry-run/);
      p.assertPreserved();
    });
    it('refuses a C999 introduced after postcheck before fixture mutation', () => {
      const f = consumerFixture('completed'),
        p = preparePostcheckContinuation(f);
      writeFileSync(join(f.nativeDir, 'fixture-mode.txt'), 'pre-fixture');
      const r = f.run(false, commandLines([['postcheck'], ['fixture'], ['end']]), false, true);
      assert.equal(r.status, 1, r.stdout + r.stderr);
      assert.equal(f.result(true).postcheckStage, 'complete');
      const sql = readFileSync(join(f.nativeDir, 'control-sql.txt'), 'utf8');
      assert.equal((sql.match(/as continuation_fixture_absence;/g) || []).length, 2);
      assert.doesNotMatch(sql, /do \$smoke_setup\$|select ops\.foundation_gateway_provision\(/);
      p.assertPreserved();
    });
    it('refuses a changed fixture before provisioning instead of accepting a different returned account', () => {
      const f = consumerFixture('completed'),
        p = preparePostcheckContinuation(f);
      writeFileSync(join(f.nativeDir, 'fixture-mode.txt'), 'changed');
      const r = f.run(
        false,
        commandLines([['postcheck'], ['fixture'], ['provision', preview], ['close'], ['end']]),
        false,
        true,
      );
      assert.equal(r.status, 1, r.stdout + r.stderr);
      const sql = readFileSync(join(f.nativeDir, 'control-sql.txt'), 'utf8');
      assert.equal((sql.match(/do \$smoke_setup\$/g) || []).length, 1);
      assert.doesNotMatch(sql, /select ops\.foundation_gateway_provision\(/);
      assert.equal(f.result(true).phaseAClosed, false);
      p.assertPreserved();
    });
    it('archives only this child unprovisioned fixture without claiming window closure and fences another attempt', () => {
      const f = consumerFixture('completed'),
        p = preparePostcheckContinuation(f);
      const r = f.run(
        false,
        commandLines([['postcheck'], ['fixture'], ['archiveUnprovisioned'], ['end']]),
        false,
        true,
      );
      assert.equal(r.status, 0, r.stdout + r.stderr);
      const rows = r.stdout.trim().split(/\r?\n/).map(JSON.parse),
        archived = rows.find((row) => row.kind === 'archiveUnprovisioned').result;
      assert.equal(archived.result, 'M03_SMOKE_FIXTURE_ARCHIVED');
      assert.equal(archived.competitor_status, 'archived');
      assert.equal(archived.account_status, 'paused');
      assert.equal(f.result(true).phaseAClosed, false);
      assert.equal(f.result(true).unprovisionedFixtureArchived, true);
      const sql = readFileSync(join(f.nativeDir, 'control-sql.txt'), 'utf8');
      assert.equal((sql.match(/do \$smoke_teardown\$/g) || []).length, 1);
      assert.ok(
        sql.includes(
          "if v_comp.id is distinct from '90000000-0000-4000-8000-000000000001'::uuid or v_account.id is distinct from '90000000-0000-4000-8000-000000000002'::uuid then",
        ),
      );
      assert.ok(
        sql.indexOf('M03_CONTINUATION_FIXTURE_ID_CHANGED') <
          sql.indexOf("update app.competitors set status='archived'"),
      );
      assert.doesNotMatch(sql, /select ops\.foundation_gateway_provision\(/);
      assert.doesNotMatch(f.calls(), / push |--dry-run/);
      p.assertPreserved();
    });
    it('preserves a newly appearing legacy provision intent and refuses unprovisioned archive', () => {
      const f = consumerFixture('completed'),
        p = preparePostcheckContinuation(f);
      const legacy = join(f.root, 'scripts/db/out/m03-foundation-owner-provision-attempt.json');
      writeFileSync(join(f.nativeDir, 'fixture-mode.txt'), 'legacy-intent');
      writeFileSync(join(f.nativeDir, 'legacy-intent-path.txt'), legacy);
      const r = f.run(
        false,
        commandLines([['postcheck'], ['fixture'], ['archiveUnprovisioned'], ['end']]),
        false,
        true,
      );
      assert.equal(r.status, 1, r.stdout + r.stderr);
      assert.equal(f.result(true).unprovisionedFixtureArchived, false);
      const sql = readFileSync(join(f.nativeDir, 'control-sql.txt'), 'utf8');
      assert.equal((sql.match(/do \$smoke_setup\$/g) || []).length, 1);
      assert.doesNotMatch(sql, /do \$smoke_teardown\$/);
      assert.equal(readFileSync(legacy, 'utf8'), 'contradictory-provision-intent');
      p.assertPreserved();
    });
    it('archives its unprovisioned fixture on EOF while preserving failure and no-window flags', () => {
      const f = consumerFixture('completed'),
        p = preparePostcheckContinuation(f);
      const r = f.run(false, commandLines([['postcheck'], ['fixture']]), false, true);
      assert.equal(r.status, 1, r.stdout + r.stderr);
      assert.equal(f.result(true).status, 'phase_a_control_failed');
      assert.equal(f.result(true).unprovisionedFixtureArchived, true);
      assert.equal(f.result(true).phaseAClosed, false);
      const sql = readFileSync(join(f.nativeDir, 'control-sql.txt'), 'utf8');
      assert.equal((sql.match(/do \$smoke_teardown\$/g) || []).length, 1);
      assert.doesNotMatch(sql, /select ops\.foundation_gateway_provision\(/);
      p.assertPreserved();
    });
    it('never retries an unprovisioned archive after ambiguous acknowledgement or a second command', () => {
      for (const mode of ['archive-failure', 'none']) {
        const f = consumerFixture('completed'),
          p = preparePostcheckContinuation(f);
        writeFileSync(join(f.nativeDir, 'fixture-mode.txt'), mode);
        const r = f.run(
          false,
          commandLines([['postcheck'], ['fixture'], ['archiveUnprovisioned'], ['archiveUnprovisioned']]),
          false,
          true,
        );
        assert.equal(r.status, 1, r.stdout + r.stderr);
        const sql = readFileSync(join(f.nativeDir, 'control-sql.txt'), 'utf8');
        assert.equal((sql.match(/do \$smoke_teardown\$/g) || []).length, 1);
        assert.equal(
          existsSync(
            join(
              f.root,
              'scripts/db/out/m03-foundation-postcheck-continuation-a570212a-634c-444f-90a2-578ae47e8d27-unprovisioned-archive-attempt.json',
            ),
          ),
          true,
        );
        assert.equal(f.result(true).unprovisionedFixtureArchived, mode === 'none');
        assert.equal(f.result(true).phaseAClosed, false);
        assert.doesNotMatch(r.stdout + r.stderr, /synthetic-private-archive-error/);
        p.assertPreserved();
      }
    });
    it('refuses early or post-provision unprovisioned-archive commands without teardown', () => {
      for (const sequence of [
        [['postcheck'], ['archiveUnprovisioned']],
        [['postcheck'], ['fixture'], ['provision', preview], ['archiveUnprovisioned']],
      ]) {
        const f = consumerFixture('completed'),
          p = preparePostcheckContinuation(f);
        const r = f.run(false, commandLines(sequence), false, true);
        assert.equal(r.status, 1, r.stdout + r.stderr);
        const sql = readFileSync(join(f.nativeDir, 'control-sql.txt'), 'utf8');
        assert.doesNotMatch(sql, /do \$smoke_teardown\$/);
        p.assertPreserved();
      }
    });
    it('rejects partial14 parity before control and rejects mixed clock modes before any private authentication', () => {
      const f = consumerFixture('completed'),
        p = preparePostcheckContinuation(f);
      const rows = JSON.parse(readFileSync(join(f.nativeDir, 'before.json'), 'utf8'));
      rows[0].receipt.migrations.splice(11);
      writeFileSync(join(f.nativeDir, 'before.json'), JSON.stringify(rows));
      const mixed = f.run(true, null, true, true);
      assert.equal(mixed.status, 1);
      assert.match(mixed.stdout, /PREFLIGHT_BLOCKED/);
      assert.equal(f.calls(), '');
      assert.equal(existsSync(f.handoff), true);
      const r = f.run(false, commandLines([['postcheck'], ['fixture']]), false, true);
      assert.equal(r.status, 1, r.stdout + r.stderr);
      assert.equal(f.result(true).status, 'history_rejected');
      assert.equal(existsSync(join(f.nativeDir, 'control-sql.txt')), false);
      assert.doesNotMatch(f.calls(), / push |--dry-run/);
      p.assertPreserved();
    });
    it('retains a fresh failed types candidate and stops before fixture instead of reusing the old candidate', () => {
      const f = consumerFixture('completed'),
        p = preparePostcheckContinuation(f);
      writeFileSync(
        join(f.nativeDir, 'types.ts'),
        readFileSync(join(f.nativeDir, 'types.ts'), 'utf8').replace(
          'body_md: string | null',
          'body_md: number | null',
        ),
      );
      const r = f.run(false, commandLines([['postcheck'], ['fixture']]), false, true);
      assert.equal(r.status, 1, r.stdout + r.stderr);
      const receipt = f.result(true);
      assert.equal(receipt.postcheckStage, 'types_ast');
      assert.equal(existsSync(join(f.root, receipt.postcheckCandidate)), true);
      assert.doesNotMatch(
        readFileSync(join(f.nativeDir, 'control-sql.txt'), 'utf8'),
        /do \$smoke_setup\$|select ops\.foundation_gateway_provision\(/,
      );
      p.assertPreserved();
      assert.doesNotMatch(f.calls(), / push |--dry-run/);
    });
    it('freshly rechecks14 history after postcheck and blocks fixture when it changed', () => {
      const f = consumerFixture('completed'),
        p = preparePostcheckContinuation(f);
      const rows = JSON.parse(readFileSync(join(f.nativeDir, 'after.json'), 'utf8'));
      rows[0].receipt.migrations[13].historySha256 = '0'.repeat(64);
      writeFileSync(join(f.nativeDir, 'after.json'), JSON.stringify(rows));
      const r = f.run(false, commandLines([['postcheck'], ['fixture']]), false, true);
      assert.equal(r.status, 1, r.stdout + r.stderr);
      assert.equal(f.result(true).postcheckStage, 'complete');
      assert.equal(
        f
          .calls()
          .split('\n')
          .filter((line) => line.includes('history.sql')).length,
        2,
      );
      assert.doesNotMatch(
        readFileSync(join(f.nativeDir, 'control-sql.txt'), 'utf8'),
        /do \$smoke_setup\$|select ops\.foundation_gateway_provision\(/,
      );
      assert.doesNotMatch(f.calls(), / push |--dry-run/);
      p.assertPreserved();
    });
    it('public continuation guard requires exact claimed native clocks before private access', () => {
      const root = mkdtempSync(join(tmpdir(), 'emr-foundation-postcheck-clock-'));
      directories.push(root);
      const module = join(root, 'scripts/n8n/foundation-live-postcheck-continuation.mjs');
      mkdirSync(resolve(module, '..'), { recursive: true });
      writeFileSync(module, '// isolated scripted public producer\n');
      const source = readFileSync(consumerPath, 'utf8'),
        start = source.indexOf('function Assert-Keys'),
        end = source.indexOf('# Every native child');
      const script = join(root, 'guard.ps1');
      writeFileSync(
        script,
        `$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$repo='${root.replaceAll("'", "''")}';$PhaseAControl=$true;$OriginalDeadlineAtMs=0;$ClockAmendment=$false;$PostcheckContinuation=$true;$postcheckContinuationStart=$null;$postcheckContinuationSegment='a570212a-634c-444f-90a2-578ae47e8d27';$node='synthetic-node.exe'
${source.slice(start, end)}
$script:mode=$null;$script:extra=$false;$script:wrong=$false;$script:closed=$true;$script:shift=$false
$admittedAt=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()-1000
function Invoke-Bounded($Executable,$Arguments,$WorkingDirectory,$Timeout){
 $script:mode=$Arguments[1]
 $v=[ordered]@{kind='postcheck_continuation_ready';segmentId='a570212a-634c-444f-90a2-578ae47e8d27';sourceCommitSha='f42930f90c2de43c84f61ad6d966d0ee6074d70e';windowId='df4f29ec-e2dc-4d82-a276-62a4e695e6f9';privateRead=$false;networkRequests=0}
 if($Arguments[1] -ceq 'ReadClaimed'){$v.kind='clock_postcheck_continuation_admitted';$v.startsAt=$admittedAt;$v.deadlineAt=$admittedAt+3600000;$v.stopNewAt=$admittedAt+3000000;$v.hardDeadlineAt=$admittedAt+4200000}
 if($script:extra){$v.extra=$true};if($script:wrong){$v.segmentId='30e75d0d-7e4c-46c6-9a07-556f90b63859'};if($script:shift){$v.deadlineAt++}
 return [PSCustomObject]@{ok=$true;closed=$script:closed;text=($v|ConvertTo-Json -Compress)}
}
$CheckOnly=$true
if($null -ne (Read-FoundationPostcheckContinuation) -or $script:mode -cne 'CheckOnly'){exit 1}
$CheckOnly=$false;$proof=Read-FoundationPostcheckContinuation
if($script:mode -cne 'ReadClaimed' -or $proof.startsAt -ne $admittedAt){exit 1}
$postcheckContinuationStart=[DateTimeOffset]::FromUnixTimeMilliseconds($proof.startsAt).UtcDateTime
if((Get-FoundationLeaseFloor) -ne $postcheckContinuationStart.AddMinutes(75)){exit 1}
$script:extra=$true;try{$null=Read-FoundationPostcheckContinuation;exit 1}catch{};$script:extra=$false
$script:wrong=$true;try{$null=Read-FoundationPostcheckContinuation;exit 1}catch{};$script:wrong=$false
$script:closed=$false;try{$null=Read-FoundationPostcheckContinuation;exit 1}catch{};$script:closed=$true
$script:shift=$true;try{$null=Read-FoundationPostcheckContinuation;exit 1}catch{};$script:shift=$false
$ClockAmendment=$true;try{$null=Read-FoundationPostcheckContinuation;exit 1}catch{}
Write-Output 'POSTCHECK_CLOCK_GUARD_PASS'
`,
      );
      const r = spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-File', script], {
        env: osEnvironment(),
        encoding: 'utf8',
        timeout: 10000,
        windowsHide: true,
      });
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.equal(r.stderr, '');
      assert.equal(r.stdout.trim(), 'POSTCHECK_CLOCK_GUARD_PASS');
      assert.ok(
        source.indexOf('$clock=Read-FoundationPostcheckContinuation') < source.indexOf('$consumed = $true'),
      );
    });
  },
);

describe(
  'M03 dev migration handoff creator, synthetic isolated Windows fixtures',
  { skip: process.platform !== 'win32' },
  () => {
    it('creates only the selected disposable admin copy from a persistent current-user original', () => {
      const fixture = creatorFixture();
      const result = fixture.run();
      assert.equal(result.status, 0);
      assert.equal(result.stderr, '');
      assert.match(result.stdout, /M03_FOUNDATION_MIGRATION_ADMIN_READY/);
      assert.doesNotMatch(result.stdout, /synthetic-m03-foundation-dev-password|unrelated-parent-sentinel/);
      assert.ok(existsSync(fixture.handoff));
      assert.notEqual(readFileSync(fixture.handoff, 'utf8'), 'synthetic-m03-foundation-dev-password');
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
        /existing-owned-sentinel|synthetic-m03-foundation-dev-password/,
      );
    });
    it('reuses the persistent admin original for the explicit no-push continuation mode', () => {
      const fixture = creatorFixture({ postcheckContinuation: true });
      const result = fixture.run();
      assert.equal(result.status, 0, result.stdout + result.stderr);
      const lease = JSON.parse(readFileSync(fixture.handoff.replace(/\.dpapi$/, '.lease.json'), 'utf8'));
      assert.equal(lease.purpose, 'm03-foundation-phase-a-dev');
      assert.equal(Date.parse(lease.expiresAt) - Date.parse(lease.createdAt), 7200000);
      assert.doesNotMatch(result.stdout + result.stderr, /synthetic-m03-foundation-dev-password/);
      assert.equal(readFileSync(fixture.oldHandoff, 'utf8'), 'unrelated-old-handoff-sentinel');
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
  'fixed original Phase-A clock, public-only isolated Windows guard',
  { skip: process.platform !== 'win32' },
  () => {
    it('inherits only the original header clock, preserves attempts and rejects clock reset before private use', () => {
      const root = mkdtempSync(join(tmpdir(), 'emr-foundation-original-clock-'));
      directories.push(root);
      const journal = join(root, 'scripts/n8n/out/foundation/live/management.jsonl');
      mkdirSync(resolve(journal, '..'), { recursive: true });
      const source = readFileSync(consumerPath, 'utf8'),
        start = source.indexOf('function Assert-Keys'),
        end = source.indexOf('# Every native child');
      const header =
        JSON.stringify({
          event: 'management_header',
          version: 1,
          sourceCommitSha: 'f42930f90c2de43c84f61ad6d966d0ee6074d70e',
          deadlineAt: 1792584023481,
        }) + '\n';
      const script = join(root, 'guard.ps1');
      writeFileSync(
        script,
        `$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$repo='${root.replaceAll("'", "''")}';$PhaseAControl=$true;$OriginalDeadlineAtMs=0;$ClockAmendment=$false;$clockAmendmentStart=$null;$PostcheckContinuation=$false;$postcheckContinuationStart=$null
${source.slice(start, end)}
$path='${journal.replaceAll("'", "''")}'
$header='${header.replaceAll("'", "''")}'
$deadline=[DateTimeOffset]::FromUnixTimeMilliseconds(1792584023481).UtcDateTime
$now=$deadline.AddMinutes(-30)
[IO.File]::WriteAllText($path,$header)
$before=[IO.File]::ReadAllText($path)
if((Read-FoundationOriginalStart 1792584023481 $now) -ne $deadline.AddMinutes(-60)){exit 1}
if((Get-FoundationLeaseFloor $now) -ne $now.AddMinutes(75)){exit 1}
$OriginalDeadlineAtMs=1792584023481
if((Get-FoundationLeaseFloor $now) -ne $deadline.AddMinutes(15)){exit 1}
$OriginalDeadlineAtMs=0
if([IO.File]::ReadAllText($path) -cne $before){exit 1}
[IO.File]::AppendAllText($path,'{"event":"management_attempt","ordinal":1}'+"\n")
if((Read-FoundationOriginalStart 1792584023481 $now) -ne $deadline.AddMinutes(-60)){exit 1}
try{$null=Read-FoundationOriginalStart 1792584023482 $now;exit 1}catch{}
try{$null=Read-FoundationOriginalStart 1792584023481 $deadline.AddMinutes(-10);exit 1}catch{}
$PhaseAControl=$false
try{$null=Read-FoundationOriginalStart 1792584023481 $now;exit 1}catch{}
$PhaseAControl=$true
[IO.File]::WriteAllText($path,$header.Replace('1792584023481','1792584023482'))
try{$null=Read-FoundationOriginalStart 1792584023481 $now;exit 1}catch{}
Write-Output 'ORIGINAL_CLOCK_GUARD_PASS'
`,
      );
      const r = spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-File', script], {
        env: osEnvironment(),
        encoding: 'utf8',
        timeout: 10000,
        windowsHide: true,
      });
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.equal(r.stderr, '');
      assert.equal(r.stdout.trim(), 'ORIGINAL_CLOCK_GUARD_PASS');
      assert.match(source, /if\(\$OriginalDeadlineAtMs -ne 0\).*Read-FoundationOriginalStart/);
      assert.ok(
        source.indexOf('Read-FoundationOriginalStart $OriginalDeadlineAtMs') <
          source.indexOf('$consumed = $true'),
      );
      assert.match(source, /\$phaseAStart = if\(\$null -ne \$originalPhaseAStart\)/);
    });
  },
);

describe(
  'approved amended clock, public-only isolated Windows guard',
  { skip: process.platform !== 'win32' },
  () => {
    it('clock amendment precheck never admits and actual read requires exact admitted segment before private access', () => {
      const root = mkdtempSync(join(tmpdir(), 'emr-foundation-amended-clock-'));
      directories.push(root);
      const module = join(root, 'scripts/n8n/foundation-live-clock-amendment.mjs');
      mkdirSync(resolve(module, '..'), { recursive: true });
      writeFileSync(module, '// synthetic fixed public reader\n');
      const source = readFileSync(consumerPath, 'utf8'),
        start = source.indexOf('function Assert-Keys'),
        end = source.indexOf('# Every native child');
      const script = join(root, 'guard.ps1');
      writeFileSync(
        script,
        `$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$repo='${root.replaceAll("'", "''")}';$PhaseAControl=$true;$OriginalDeadlineAtMs=0;$ClockAmendment=$true;$clockAmendmentStart=$null;$PostcheckContinuation=$false;$postcheckContinuationStart=$null;$node='synthetic-node.exe'
${source.slice(start, end)}
$script:mode=$null;$script:closed=$true;$script:extra=$false;$script:wrong=$false
$admittedAt=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()-1000
function Invoke-Bounded($Executable,$Arguments,$WorkingDirectory,$Timeout){
 if($Executable -cne 'synthetic-node.exe' -or $Arguments.Count -ne 2 -or $Timeout -ne 10000){throw 'fixed_only'}
 $script:mode=$Arguments[1]
 $v=[ordered]@{kind='clock_amendment_ready';segmentId='30e75d0d-7e4c-46c6-9a07-556f90b63859';sourceCommitSha='f42930f90c2de43c84f61ad6d966d0ee6074d70e';windowId='df4f29ec-e2dc-4d82-a276-62a4e695e6f9';privateRead=$false;networkRequests=0}
 if($Arguments[1] -ceq 'ReadClaimed'){$v.kind='clock_amendment_admitted';$v.startsAt=$admittedAt;$v.deadlineAt=$admittedAt+3600000;$v.stopNewAt=$admittedAt+3000000;$v.hardDeadlineAt=$admittedAt+4200000}
 if($script:extra){$v['extra']=$true};if($script:wrong){$v.segmentId='00000000-0000-4000-8000-000000000000'}
 return [ordered]@{ok=$true;closed=$script:closed;text=($v|ConvertTo-Json -Compress)}
}
$CheckOnly=$true
if($null -ne (Read-FoundationClockAmendment) -or $script:mode -cne 'CheckOnly'){exit 1}
$CheckOnly=$false
$proof=Read-FoundationClockAmendment
if($script:mode -cne 'ReadClaimed' -or $proof.startsAt -ne $admittedAt -or $proof.deadlineAt -ne $admittedAt+3600000){exit 1}
$clockAmendmentStart=[DateTimeOffset]::FromUnixTimeMilliseconds($proof.startsAt).UtcDateTime
if((Get-FoundationLeaseFloor) -ne $clockAmendmentStart.AddMinutes(75)){exit 1}
$script:extra=$true;try{$null=Read-FoundationClockAmendment;exit 1}catch{};$script:extra=$false
$script:wrong=$true;try{$null=Read-FoundationClockAmendment;exit 1}catch{};$script:wrong=$false
$script:closed=$false;try{$null=Read-FoundationClockAmendment;exit 1}catch{};$script:closed=$true
$OriginalDeadlineAtMs=1792584023481;try{$null=Read-FoundationClockAmendment;exit 1}catch{}
Write-Output 'AMENDED_CLOCK_GUARD_PASS'
`,
      );
      const r = spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-File', script], {
        env: osEnvironment(),
        encoding: 'utf8',
        timeout: 10000,
        windowsHide: true,
      });
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.equal(r.stderr, '');
      assert.equal(r.stdout.trim(), 'AMENDED_CLOCK_GUARD_PASS');
      assert.ok(source.indexOf('$clock=Read-FoundationClockAmendment') < source.indexOf('$consumed = $true'));
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
    it('rejects an expired or wrong-purpose lease without consuming credentials or authenticating', () => {
      const f = consumerFixture();
      const lease = JSON.parse(readFileSync(f.leaseFile, 'utf8'));
      lease.purpose = 'unrelated-admin-purpose';
      writeFileSync(f.leaseFile, JSON.stringify(lease));
      assert.equal(f.run(true).status, 1);
      assert.equal(f.calls(), '');
      assert.ok(existsSync(f.handoff));
      lease.purpose = 'm03-foundation-phase-a-dev';
      lease.createdAt = '2026-01-01T00:00:00.0000000Z';
      lease.expiresAt = '2026-01-01T02:00:00.0000000Z';
      writeFileSync(f.leaseFile, JSON.stringify(lease));
      assert.equal(f.run(true).status, 1);
      assert.equal(f.calls(), '');
      assert.ok(existsSync(f.handoff));
    });
    it('amended public CheckOnly reports only an otherwise-valid stale lease as a readiness gap without private reads', () => {
      const f = consumerFixture();
      f.put(
        'scripts/n8n/out/foundation/live/management.jsonl',
        JSON.stringify({
          event: 'management_header',
          version: 1,
          sourceCommitSha: 'f42930f90c2de43c84f61ad6d966d0ee6074d70e',
          deadlineAt: 1792584023481,
        }) + '\n',
      );
      const lease = JSON.parse(readFileSync(f.leaseFile, 'utf8')),
        created = Date.now() - 3 * 3600000;
      lease.createdAt = new Date(created).toISOString().replace('Z', '0000Z');
      lease.expiresAt = new Date(created + 2 * 3600000).toISOString().replace('Z', '0000Z');
      writeFileSync(f.leaseFile, JSON.stringify(lease));
      const r = f.run(true, null, true);
      assert.equal(r.status, 2, r.stdout + r.stderr);
      assert.match(r.stdout, /M03_FOUNDATION HANDOFF_LEASE_NOT_READY\./);
      assert.equal(f.calls(), '');
      assert.ok(existsSync(f.handoff));
      assert.ok(existsSync(f.leaseFile));
      assert.equal(
        existsSync(join(f.root, 'scripts/db/out/m03-foundation-dev-migration-latest.json')),
        false,
      );
      assert.equal(f.run(true).status, 1);
      lease.purpose = 'unrelated-purpose';
      writeFileSync(f.leaseFile, JSON.stringify(lease));
      const wrong = f.run(true, null, true);
      assert.equal(wrong.status, 1);
      assert.doesNotMatch(wrong.stdout, /HANDOFF_LEASE_NOT_READY/);
      assert.ok(existsSync(f.handoff));
    });
    it('rejects a partial handoff pair or modified Node pin before any private read', () => {
      const f = consumerFixture();
      rmSync(f.leaseFile);
      assert.equal(f.run(true).status, 1);
      assert.equal(f.calls(), '');
      assert.ok(existsSync(f.handoff));
      f.packet.node.sha256 = '0'.repeat(64);
      writeFileSync(f.packetFile, JSON.stringify(f.packet));
      assert.equal(f.run(true).status, 1);
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
      assert.equal(f.result().dryRunNativeExit, 0);
      assert.equal(f.result().dryRunCheck, 'pending_mismatch');
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
    it('records a dry-run native failure without echoing private output or admitting a push', () => {
      const f = consumerFixture('dryNativeFailure');
      const r = f.run();
      assert.equal(r.status, 1);
      const receipt = f.result();
      assert.equal(receipt.authenticationVerified, true);
      assert.equal(receipt.status, 'dry_run_rejected');
      assert.equal(receipt.dryRunNativeExit, 7);
      assert.equal(receipt.dryRunCheck, 'native_failure');
      assert.equal(receipt.pushAttempted, false);
      assert.equal(
        existsSync(join(f.root, 'scripts/db/out/m03-foundation-dev-migration-attempt.json')),
        false,
      );
      assert.equal(receipt.childrenClosed, true);
      assert.equal(receipt.handoffDeleted, true);
      assert.equal(receipt.leaseDeleted, true);
      assert.equal(receipt.scratchDeleted, true);
      assert.doesNotMatch(r.stdout + r.stderr + JSON.stringify(receipt), /synthetic-private/);
    });
    it('distinguishes malformed dry-run JSON from pending migration mismatch without admitting a push', () => {
      const f = consumerFixture();
      writeFileSync(join(f.nativeDir, 'dry.json'), 'synthetic-private-malformed-json');
      const r = f.run();
      assert.equal(r.status, 1);
      const receipt = f.result();
      assert.equal(receipt.status, 'dry_run_rejected');
      assert.equal(receipt.dryRunNativeExit, 0);
      assert.equal(receipt.dryRunCheck, 'invalid_json');
      assert.equal(receipt.pushAttempted, false);
      assert.equal(
        existsSync(join(f.root, 'scripts/db/out/m03-foundation-dev-migration-attempt.json')),
        false,
      );
      assert.doesNotMatch(r.stdout + r.stderr + JSON.stringify(receipt), /synthetic-private/);
    });
    it('uses only the dev child password, clean public workdir and strict TLS then records exact completion', () => {
      const f = consumerFixture();
      const r = f.run();
      assert.equal(r.status, 0, r.stdout + r.stderr);
      const receipt = f.result();
      assert.equal(receipt.status, 'complete');
      assert.equal(receipt.dryRunNativeExit, 0);
      assert.equal(receipt.dryRunCheck, 'matched');
      assert.equal(receipt.historyBefore, 'baseline');
      assert.equal(receipt.historyAfter, 'complete');
      assert.equal(receipt.childrenClosed, true);
      assert.equal(receipt.handoffDeleted, true);
      assert.equal(receipt.scratchDeleted, true);
      assert.equal(existsSync(f.handoff), false);
      assert.equal(existsSync(f.leaseFile), false);
      assert.doesNotMatch(
        r.stdout + r.stderr,
        /synthetic-m03-foundation-dev-password|unrelated-parent-secret|synthetic-private/,
      );
      assert.match(f.calls(), /sslmode=verify-full/);
      assert.match(f.calls(), /sslrootcert=/);
      assert.doesNotMatch(f.calls(), /--linked|--include-seed|--include-roles/);
      assert.equal(
        existsSync(join(f.root, 'scripts/db/out/m03-foundation-dev-migration-attempt.json')),
        true,
      );
    });
    it('uses command-specific output modes so legacy JSON never changes push stdout to human text', () => {
      const f = consumerFixture();
      const r = f.run();
      assert.equal(r.status, 0, r.stdout + r.stderr);
      const receipt = f.result();
      assert.equal(receipt.dryRunCheck, 'matched');
      assert.equal(receipt.dryRunNativeExit, 0);
      assert.equal(receipt.status, 'complete');
      const commands = f.calls().trim().split('\n');
      const queries = commands.filter((command) => command.includes(' query '));
      const pushes = commands.filter((command) => command.includes(' push '));
      assert.equal(queries.length, 2);
      assert.equal(pushes.length, 2);
      for (const query of queries) assert.match(query, /--output json(?: |$)/);
      for (const push of pushes) {
        assert.match(push, /--output-format json(?: |$)/);
        assert.doesNotMatch(push, /--output json(?: |$)/);
      }
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
      assert.ok(existsSync(join(f.root, 'scripts/db/out/m03-foundation-dev-migration-attempt.json')));
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
      assert.doesNotMatch(r.stdout + r.stderr, /synthetic-m03-foundation-dev-password/);
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
    it('keeps one bounded Phase-A admin child through actual-shaped postchecks, fixture, Preview binding and permanent close', () => {
      const f = consumerFixture();
      const input = commandLines([
        ['postcheck'],
        ['preflight'],
        ['fixture'],
        ['provision', preview],
        [
          'settlement',
          {
            windowId: 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9',
            requestIds: [],
            nativeIds: [],
            terminalCosts: [],
          },
        ],
        [
          'settlement',
          {
            windowId: 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9',
            requestIds: [],
            nativeIds: [],
            terminalCosts: [{ apify_run_id: 'Original', usage_usd: 0.125 }],
          },
        ],
        ['unknownCallbackAbsent'],
        ['firstOriginalContext'],
        [
          'verifyAtomicInput',
          {
            atomicInput: {
              p_apify_run_id: 'Original',
              p_status: 'SUCCEEDED',
              p_dataset_id: 'Dataset',
              p_usage_usd: 0.1,
              p_groups: [],
            },
          },
        ],
        ['replaySnapshot'],
        [
          'smokeAssert',
          { runId: '90000000-0000-4000-8000-000000000001', apifyRunId: 'Original', expectedItemsNew: 1 },
        ],
        ['close'],
        ['end'],
      ]);
      const r = f.run(false, input);
      assert.equal(r.status, 0, r.stdout + r.stderr);
      const lines = r.stdout
        .trim()
        .split(/\r?\n/)
        .map((line) => JSON.parse(line));
      assert.equal(lines[0].type, 'foundation_admin_ready');
      const post = lines.find((row) => row.kind === 'postcheck').result;
      assert.equal(post.ready, true);
      assert.equal(post.typesAstEquivalent, true);
      assert.equal(post.advisors.security.nativeExit, 0);
      assert.equal(lines.find((row) => row.kind === 'fixture').result.company_code, 'C999');
      assert.equal(f.result().phaseAClosed, true);
      assert.equal(f.result().leaseDeleted, true);
      assert.equal(f.result().phaseACommands, 13);
      const sql = readFileSync(join(f.nativeDir, 'control-sql.txt'), 'utf8');
      assert.ok(sql.includes("from jsonb_array_elements('[]'::jsonb::jsonb)"));
      assert.ok(sql.includes('"usage_usd":0.125'));
      assert.equal((sql.match(/select ops\.foundation_gateway_provision\(/g) || []).length, 1);
      assert.ok(sql.includes("set_config('emr.smoke_project_ref','zmotjsbzhzjvpelxvxlf',true)"));
      assert.doesNotMatch(sql, /\\set|\\if|begin read only|begin;select/);
      assert.doesNotMatch(
        r.stdout + r.stderr,
        /synthetic-private|synthetic-m03-foundation-dev-password|unrelated-parent/,
      );
      assert.equal(existsSync(f.handoff), false);
      assert.equal(existsSync(f.leaseFile), false);
    });
    it('uses real public ReadClaimed and carries only the admitted amended segment through the bounded admin protocol', () => {
      const f = consumerFixture(),
        start = Date.now(),
        segmentId = '30e75d0d-7e4c-46c6-9a07-556f90b63859';
      f.put(
        'scripts/n8n/out/foundation/live/management.jsonl',
        JSON.stringify({
          event: 'management_header',
          version: 1,
          sourceCommitSha: 'f42930f90c2de43c84f61ad6d966d0ee6074d70e',
          deadlineAt: 1792584023481,
        }) + '\n',
      );
      f.put(
        'private/Temp/emr-m03-acceptance-parent.operation.lock',
        JSON.stringify({ kind: 'm03_clock_admission_parent', version: 1, segmentId, processId: 90210 }),
      );
      const admission = {
        kind: 'm03_clock_amendment_admission',
        version: 1,
        segmentId,
        sourceCommitSha: 'f42930f90c2de43c84f61ad6d966d0ee6074d70e',
        windowId: 'df4f29ec-e2dc-4d82-a276-62a4e695e6f9',
        approvalSha256: '3d2346715e08edfc9eef4fab04c9c1b7be55d450660c862235b92195976bed31',
        startsAt: start,
        deadlineAt: start + 3600000,
        stopNewAt: start + 3000000,
        hardDeadlineAt: start + 4200000,
        parentProcessId: 90210,
      };
      const text = JSON.stringify(admission) + '\n';
      f.put('scripts/n8n/out/foundation/live/clock-amendment-' + segmentId + '.json', text);
      f.put(
        'scripts/n8n/out/foundation/live/clock-amendment-' + segmentId + '.runtime-claim.json',
        JSON.stringify({
          kind: 'm03_clock_amendment_runtime_claim',
          version: 1,
          segmentId,
          admissionSha256: sha(text),
          processId: 90211,
          parentProcessId: 90210,
        }) + '\n',
      );
      const r = f.run(
        false,
        commandLines([['postcheck'], ['fixture'], ['provision', preview], ['close'], ['end']]),
        true,
      );
      assert.equal(r.status, 0, r.stdout + r.stderr);
      const rows = r.stdout.trim().split(/\r?\n/).map(JSON.parse),
        ready = rows[0];
      assert.equal(ready.type, 'foundation_admin_ready');
      assert.equal(ready.clockSegmentId, segmentId);
      assert.equal(Date.parse(ready.stopNewAt), start + 3000000);
      assert.equal(Date.parse(ready.actionDeadline), start + 3600000);
      assert.equal(Date.parse(ready.hardDeadline), start + 4200000);
      assert.equal(f.result().phaseAClosed, true);
      assert.equal(f.result().clockSegmentId, segmentId);
      assert.equal(f.result().childrenClosed, true);
      assert.equal(f.result().handoffDeleted, true);
      assert.equal(
        readFileSync(join(f.root, 'scripts/n8n/out/foundation/live/management.jsonl'), 'utf8'),
        JSON.stringify({
          event: 'management_header',
          version: 1,
          sourceCommitSha: 'f42930f90c2de43c84f61ad6d966d0ee6074d70e',
          deadlineAt: 1792584023481,
        }) + '\n',
      );
    });
    it('refuses fixture before actual postchecks and never treats EOF as successful Phase-A closure', () => {
      const f = consumerFixture();
      const r = f.run(false, commandLines([['fixture']]));
      assert.equal(r.status, 1);
      assert.equal(f.result().status, 'phase_a_control_failed');
      assert.equal(f.result().handoffDeleted, true);
      assert.equal(existsSync(join(f.nativeDir, 'control-sql.txt')), false);
    });
    it('retains one provision intent and rejects a repeated owner-provision command without another mutation', () => {
      const f = consumerFixture();
      const r = f.run(
        false,
        commandLines([['postcheck'], ['fixture'], ['provision', preview], ['provision', preview]]),
      );
      assert.equal(r.status, 1);
      const sql = readFileSync(join(f.nativeDir, 'control-sql.txt'), 'utf8');
      assert.equal((sql.match(/select ops\.foundation_gateway_provision\(/g) || []).length, 1);
      assert.ok(existsSync(join(f.root, 'scripts/db/out/m03-foundation-owner-provision-attempt.json')));
      assert.equal(f.result().status, 'phase_a_control_failed');
      assert.equal(f.result().childrenClosed, true);
      assert.equal(f.result().phaseAClosed, true);
    });
  },
);
