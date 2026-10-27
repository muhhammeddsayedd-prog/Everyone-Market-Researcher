import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { after, test } from 'node:test';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';

const windows = process.platform === 'win32';
const ps = 'C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';
const consumer = resolve('scripts/db/windows/Invoke-M04DevDatabase.ps1');
const directories = [];
const q = (value) => "'" + value.replaceAll("'", "''") + "'";
const publicEnv = Object.fromEntries(
  ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP', 'LOCALAPPDATA', 'APPDATA', 'USERPROFILE']
    .filter((key) => process.env[key] !== undefined)
    .map((key) => [key, process.env[key]]),
);
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'emr-m04-public-test-'));
  directories.push(directory);
  return directory;
}
function run(source, timeout = 20000) {
  const directory = fixture();
  const script = join(directory, 'test.ps1');
  writeFileSync(script, source, 'utf8');
  const result = spawnSync(ps, ['-NoProfile', '-NonInteractive', '-File', script], {
    env: publicEnv,
    encoding: 'utf8',
    timeout,
    windowsHide: true,
    maxBuffer: 100000,
  });
  assert.ifError(result.error);
  return result;
}
function definitions(names) {
  return `$tokens=$null;$errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile(${q(consumer)},[ref]$tokens,[ref]$errors)
if($errors.Count -ne 0){throw 'SYNTAX_ERROR'}
foreach($name in @(${names.map(q).join(',')})){
 $definition=$ast.Find({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq $name},$true)
 if($null -eq $definition){throw 'FUNCTION_MISSING'}
 . ([ScriptBlock]::Create($definition.Extent.Text))
}
`;
}
after(() => {
  for (const directory of directories) {
    assert.equal(resolve(directory).startsWith(resolve(tmpdir()) + '\\'), windows);
    assert.match(basename(directory), /^emr-m04-public-test-/);
    rmSync(directory, { recursive: true, force: true });
  }
});

test('native PowerShell parses the bounded M04 entrypoint', { skip: !windows }, () => {
  const result = run(`${definitions(['Invoke-M04Bounded'])}\n'OK'`);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), 'OK');
});

for (const scope of ['Incremental', 'incremental', 'INCREMENTAL', 'iNcReMeNtAl'])
  test(
    `incremental scope ${scope} refuses migration phases before private access or native commands`,
    { skip: !windows },
    () => {
      const result = spawnSync(
        ps,
        [
          '-NoProfile',
          '-NonInteractive',
          '-File',
          consumer,
          '-Scope',
          scope,
          '-Phase',
          'Apply',
          '-CheckOnly',
        ],
        {
          env: publicEnv,
          encoding: 'utf8',
          timeout: 15000,
          windowsHide: true,
        },
      );
      assert.equal(result.status, 1);
      const value = JSON.parse(result.stdout);
      assert.equal(value.status, 'M04_QUERY_BLOCKED');
      assert.equal(value.privateRead, false);
      assert.equal(value.databaseCommands, 0);
    },
  );

test('read-only Query adds transaction enforcement to either native line ending', { skip: !windows }, () => {
  const source = readFileSync(consumer, 'utf8');
  assert.match(source, /if\(\$ReadOnly\)\{\$identityGuard=\$identityGuard -replace/);
  const result = run(
    `foreach($guard in @("begin;\nselect 1;", "begin;\r\nselect 1;")) {\n $actual=$guard -replace '\\Abegin;\\r?\\n', "begin;\nset transaction read only;\n"\n if($actual -notmatch 'set transaction read only;'){throw 'READONLY_MISSING'}\n}\n'READONLY_ENFORCED'`,
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), 'READONLY_ENFORCED');
});

test('a fresh worktree creates only its owned public output directory', { skip: !windows }, () => {
  const directory = fixture();
  const result = run(`${definitions(['M04-File', 'M04-OutputDirectory'])}
$repo=${q(directory)}
$null=[IO.Directory]::CreateDirectory((Join-Path $repo 'scripts/db'))
if(Test-Path -LiteralPath (Join-Path $repo 'scripts/db/out')){throw 'FIXTURE_ALREADY_PRESENT'}
$path=M04-OutputDirectory
if($path -cne [IO.Path]::GetFullPath((Join-Path $repo 'scripts/db/out'))){throw 'WRONG_OUTPUT'}
$again=M04-OutputDirectory
if($again -cne $path){throw 'NOT_IDEMPOTENT'}
'OUTPUT_READY'
`);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), 'OUTPUT_READY');
});

test('actual public CheckOnly runs before private access and starts no child', { skip: !windows }, () => {
  const result = spawnSync(ps, ['-NoProfile', '-NonInteractive', '-File', consumer, '-CheckOnly'], {
    env: publicEnv,
    encoding: 'utf8',
    timeout: 30000,
    windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr);
  const receipt = JSON.parse(result.stdout);
  assert.equal(receipt.status, 'public_ready');
  assert.equal(receipt.privateRead, false);
  assert.equal(receipt.authenticationAttempted, false);
  assert.equal(receipt.databaseCommands, 0);
  assert.equal(receipt.childrenClosed, true);
  assert.deepEqual(receipt.pendingVersions, ['20261026013910', '20261027092832']);
});

test('Query rejects an external path or wrong hash before decryption', { skip: !windows }, () => {
  for (const path of [consumer, resolve('milestones/M04-collectors-vimeo-instagram/evidence/no-such.sql')]) {
    const result = spawnSync(
      ps,
      [
        '-NoProfile',
        '-NonInteractive',
        '-File',
        consumer,
        '-Phase',
        'Query',
        '-QueryFile',
        path,
        '-QuerySha256',
        '0'.repeat(64),
        '-CheckOnly',
      ],
      { env: publicEnv, encoding: 'utf8', timeout: 15000, windowsHide: true },
    );
    assert.equal(result.status, 1);
    const receipt = JSON.parse(result.stdout);
    assert.equal(receipt.privateRead, false);
    assert.equal(receipt.databaseCommands, 0);
  }
});

test(
  'native CLI contracts keep query formatter distinct from push and scope private input',
  { skip: !windows },
  () => {
    const result = run(`${definitions(['Invoke-M04Cli'])}
$Phase='Apply';$historyFile='history.sql';$catalogFile='catalog.sql';$queryCopy='reviewed.sql'
$cliPath='fixed-cli';$scratch='fixed-scratch';$dbUri='postgresql://postgres.dev@fixed:5432/postgres?sslmode=verify-full';$password='local-synthetic-only'
$receipt=@{databaseCommands=0;childrenClosed=$true;authenticationAttempted=$false};$calls=[Collections.Generic.List[object]]::new()
function Invoke-M04Bounded($Executable,$Arguments,$WorkingDirectory,$TimeoutMs,$PrivatePassword){
 $calls.Add([pscustomobject]@{args=$Arguments;privateInputMatched=($PrivatePassword -ceq 'local-synthetic-only');parentPasswordAbsent=($null -eq $env:PGPASSWORD)})
 return [pscustomobject]@{ok=$true;started=$true;closed=$true;nativeExit=0;text='{}'}
}
$null=Invoke-M04Cli @('db','query','--file',$historyFile)
$null=Invoke-M04Cli @('db','push','--dry-run','--skip-vault')
$null=Invoke-M04Cli @('db','push','--skip-vault','--yes')
$null=Invoke-M04Cli @('db','advisors','--type','security','--level','warn','--fail-on','warn')
Write-Output (ConvertTo-Json -InputObject @($calls.ToArray()) -Depth 6 -Compress)
`);
    assert.equal(result.status, 0, result.stderr);
    const calls = JSON.parse(result.stdout);
    assert.equal(calls.length, 4);
    for (const call of calls) {
      assert.equal(call.privateInputMatched, true);
      assert.equal(call.parentPasswordAbsent, true);
      assert.ok(call.args.includes('--output-format'));
      assert.ok(call.args.includes('--agent'));
      assert.ok(!call.args.some((arg) => arg.includes('local-synthetic-only')));
    }
    assert.ok(calls[0].args.includes('--output'));
    assert.ok(!calls[1].args.includes('--output'));
    assert.ok(!calls[2].args.includes('--output'));
  },
);

test('non-Apply push and unreviewed query paths never reach native transport', { skip: !windows }, () => {
  const result = run(`${definitions(['Invoke-M04Cli'])}
$Phase='Query';$historyFile='history.sql';$catalogFile='catalog.sql';$queryCopy='reviewed.sql';$calls=0
function Invoke-M04Bounded { $script:calls++;throw 'UNEXPECTED_CHILD' }
foreach($arguments in @(@('db','push','--skip-vault','--yes'),@('db','query','--file','unreviewed.sql'),@('db','query','--sql','select 1'))){
 try{$null=Invoke-M04Cli $arguments;throw 'EXPECTED_DENIAL'}catch{if($_.Exception.Message -cne 'M04_COMMAND_BLOCKED'){throw}}
}
Write-Output $calls
`);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), '0');
});

test(
  'fixed hosted catalog coverage matches the reviewed local-generated M04 Row types',
  { skip: !windows },
  () => {
    const result = run(`${definitions(['Get-M04ExpectedColumns'])}
Write-Output ((Get-M04ExpectedColumns)|ConvertTo-Json -Depth 5 -Compress)
`);
    assert.equal(result.status, 0, result.stderr);
    const mapping = JSON.parse(result.stdout);
    const ts = createRequire(import.meta.url)(
      resolve('node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/lib/typescript.js'),
    );
    const source = ts.createSourceFile(
      'db.types.ts',
      readFileSync(resolve('packages/shared/src/db.types.ts'), 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const database = source.statements.find(
      (node) => ts.isTypeAliasDeclaration(node) && node.name.text === 'Database',
    );
    const member = (type, name) => type.members.find((node) => node.name?.text === name).type;
    const tables = member(member(database.type, 'ops'), 'Tables');
    const sqlTypes = {
      uuid: 'string',
      text: 'string',
      'timestamp with time zone': 'string',
      'uuid[]': 'string[]',
      integer: 'number',
      numeric: 'number',
      boolean: 'boolean',
      jsonb: 'Json',
    };
    for (const [table, columns] of Object.entries(mapping)) {
      const row = member(member(tables, table), 'Row');
      const actual = Object.fromEntries(
        row.members.map((node) => [node.name.text, node.type.getText(source)]),
      );
      const expected = Object.fromEntries(
        columns.map((entry) => {
          const [name, type, nullable] = entry.split(':');
          return [
            name,
            type === 'jsonb' && nullable === 'false'
              ? 'NonNullable<Json>'
              : sqlTypes[type] + (nullable === 'true' ? ' | null' : ''),
          ];
        }),
      );
      assert.deepEqual(actual, expected, table);
    }
  },
);

test(
  'catalog postcheck rejects changed schema, direct writer grants and exposed definers',
  { skip: !windows },
  () => {
    const result = run(`${definitions(['M04-Catalog', 'M04-Json', 'Get-M04ExpectedColumns'])}
$mapping=Get-M04ExpectedColumns;$tables=@();$columns=@()
foreach($name in $mapping.Keys){
 $tables+=[pscustomobject]@{name=$name;rls=$true;writerTableGrant=$false}
 foreach($entry in $mapping[$name]){$parts=$entry.Split(':');$columns+=[pscustomobject]@{table=$name;name=$parts[0];type=$parts[1];nullable=($parts[2] -ceq 'true')}}
}
$functions=@(
 [pscustomobject]@{name='collector_execute';identityArgs='p_request_id uuid, p_operation text, p_args jsonb';returns='jsonb';defaultsCount=0;writerExecute=$true;definer=$true;config=@('search_path=""');browserExecute=$false;anonExecute=$false;agentExecute=$false},
 [pscustomobject]@{name='collector_finalize';identityArgs='p_run_id uuid';returns='jsonb';defaultsCount=0;writerExecute=$false;definer=$true;config=@('search_path=""');browserExecute=$false;anonExecute=$false;agentExecute=$false},
 [pscustomobject]@{name='set_account_external_id';identityArgs='p_account_id uuid, p_external_id text, p_uploads_playlist_id text';returns='void';defaultsCount=1;writerExecute=$true;definer=$true;config=@('search_path=""');browserExecute=$false;anonExecute=$false;agentExecute=$false}
)
$catalog=@{identity=$true;tables=$tables;columns=$columns;functions=$functions}
function Make-Result {return [pscustomobject]@{text=(ConvertTo-Json -InputObject @(@{catalog=$catalog}) -Depth 10 -Compress)}}
$null=M04-Catalog (Make-Result)
$saved=$columns[0].type;$columns[0].type='text_changed'
try{$null=M04-Catalog (Make-Result);throw 'EXPECTED_DENIAL'}catch{if($_.Exception.Message -cne 'M04_CATALOG_BLOCKED'){throw}}
$columns[0].type=$saved;$tables[0].writerTableGrant=$true
try{$null=M04-Catalog (Make-Result);throw 'EXPECTED_DENIAL'}catch{if($_.Exception.Message -cne 'M04_CATALOG_BLOCKED'){throw}}
$tables[0].writerTableGrant=$false;$functions[0].anonExecute=$true
try{$null=M04-Catalog (Make-Result);throw 'EXPECTED_DENIAL'}catch{if($_.Exception.Message -cne 'M04_CATALOG_BLOCKED'){throw}}
'CATALOG_VERIFIED'
`);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), 'CATALOG_VERIFIED');
  },
);

test('private native output is blocked before JSON projection', { skip: !windows }, () => {
  const result = run(`${definitions(['Invoke-M04Cli'])}
$Phase='Preflight';$historyFile='history.sql';$catalogFile='catalog.sql';$queryCopy='reviewed.sql';$password='local-synthetic-only'
$receipt=@{databaseCommands=0;childrenClosed=$true;authenticationAttempted=$false};$cliPath='cli';$scratch='scratch';$dbUri='no-password'
function Invoke-M04Bounded { return [pscustomobject]@{ok=$true;started=$true;closed=$true;nativeExit=0;text='prefix local-synthetic-only suffix'} }
try{$null=Invoke-M04Cli @('db','query','--file','history.sql');throw 'EXPECTED_DENIAL'}catch{if($_.Exception.Message -cne 'M04_NATIVE_OUTPUT_BLOCKED'){throw};'OUTPUT_BLOCKED'}
`);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), 'OUTPUT_BLOCKED');
  assert.ok(!result.stdout.includes('local-synthetic-only'));
});

test('exact baseline fingerprints and actual native identity are required', { skip: !windows }, () => {
  const result = run(`${definitions(['M04-History', 'M04-Json'])}
$old=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText(${q(resolve('scripts/db/m03-foundation-forward-dev-migration-packet.json'))}))
$baseline=@($old.baseline)+@($old.pending);$receipt=@{authenticationVerified=$false}
$pending=@(
 [pscustomobject]@{version='20261026013910';name='m04_vimeo_account_resolution';historySha256='9391ae1b1f029e2ea9aa93b812a80b46f9f5abd8fe6245c05da1703bfcf2b56c'},
 [pscustomobject]@{version='20261027092832';name='m04_collector_product_contracts';historySha256='7f036a391743189b3e8031070aa4f18fbd893df7619aab92b02f6a5996b4db7f'}
)
$history=@($baseline|ForEach-Object{[pscustomobject]@{version=$_.version;name=$_.name;historySha256=$_.historySha256}})
function Make-Result($User){return [pscustomobject]@{text=(ConvertTo-Json -InputObject @([ordered]@{receipt=@{current_user=$User;session_user=$User;database='postgres';migrations=$history}}) -Depth 8 -Compress)}}
$good=@(M04-History (Make-Result 'postgres'));if($good.Count -ne 15 -or -not $receipt.authenticationVerified){throw 'GOOD_HISTORY_FAILED'}
try{$null=M04-History (Make-Result 'n8n_writer');throw 'EXPECTED_DENIAL'}catch{if($_.Exception.Message -cne 'M04_IDENTITY_BLOCKED'){throw}}
$history+=@($pending|ForEach-Object{[pscustomobject]@{version=$_.version;name=$_.name;historySha256=$_.historySha256}})
if(@(M04-History (Make-Result 'postgres')).Count -ne 17){throw 'COMPLETE_HISTORY_FAILED'}
foreach($index in @(15,16)){
 $saved=$history[$index].historySha256;$history[$index].historySha256='0'*64
 try{$null=M04-History (Make-Result 'postgres');throw 'EXPECTED_DENIAL'}catch{if($_.Exception.Message -cne 'M04_HISTORY_BLOCKED'){throw}}
 $history[$index].historySha256=$saved
}
$history[4].historySha256='0'*64
try{$null=M04-History (Make-Result 'postgres');throw 'EXPECTED_DENIAL'}catch{if($_.Exception.Message -cne 'M04_HISTORY_BLOCKED'){throw}}
'HISTORY_VERIFIED'
`);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), 'HISTORY_VERIFIED');
});

test(
  'push receipts require exactly the two pending files and exclude seeds or roles',
  { skip: !windows },
  () => {
    const result = run(`${definitions(['M04-PushMatches', 'M04-Json'])}
$pending=@([pscustomobject]@{file='supabase/migrations/20261026013910_m04_vimeo_account_resolution.sql'},[pscustomobject]@{file='supabase/migrations/20261027092832_m04_collector_product_contracts.sql'})
$value=@{upToDate=$false;dryRun=$true;message='Finished supabase db push.';seeds=@();roles=@();migrations=@('20261026013910_m04_vimeo_account_resolution.sql','20261027092832_m04_collector_product_contracts.sql')}
function Make-Result {return [pscustomobject]@{text=($value|ConvertTo-Json -Compress)}}
M04-PushMatches (Make-Result) $true
$value.seeds=@('seed.sql')
try{M04-PushMatches (Make-Result) $true;throw 'EXPECTED_DENIAL'}catch{if($_.Exception.Message -cne 'M04_PENDING_BLOCKED'){throw}}
$value.seeds=@();$value.migrations=@('wrong.sql','20261027092832_m04_collector_product_contracts.sql')
try{M04-PushMatches (Make-Result) $true;throw 'EXPECTED_DENIAL'}catch{if($_.Exception.Message -cne 'M04_PENDING_BLOCKED'){throw}}
'PENDING_VERIFIED'
`);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), 'PENDING_VERIFIED');
  },
);

test(
  'native transport removes inherited secrets and passes only synthetic PGPASSWORD',
  { skip: !windows },
  () => {
    const directory = fixture();
    const child = join(directory, 'child.ps1');
    writeFileSync(
      child,
      `Write-Output (@{passwordMatched=($env:PGPASSWORD -ceq 'local-synthetic-only');unrelatedAbsent=($null -eq $env:EMR_UNRELATED_SECRET)}|ConvertTo-Json -Compress)`,
      'utf8',
    );
    const result = run(`${definitions(['Invoke-M04Bounded'])}
$env:EMR_UNRELATED_SECRET='local-unrelated-only'
$r=Invoke-M04Bounded ${q(ps)} @('-NoProfile','-NonInteractive','-File',${q(child)}) ${q(directory)} 5000 'local-synthetic-only'
if(-not $r.ok -or -not $r.closed -or $r.nativeExit -ne 0){throw 'CHILD_FAILED'}
$value=ConvertFrom-Json $r.text
Write-Output (@{closed=$r.closed;passwordMatched=$value.passwordMatched;unrelatedAbsent=$value.unrelatedAbsent;parentPasswordAbsent=($null -eq $env:PGPASSWORD)}|ConvertTo-Json -Compress)
`);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {
      parentPasswordAbsent: true,
      closed: true,
      passwordMatched: true,
      unrelatedAbsent: true,
    });
  },
);

test('native failure suppresses credential-bearing stderr and stdout', { skip: !windows }, () => {
  const directory = fixture();
  const child = join(directory, 'fail.ps1');
  writeFileSync(
    child,
    `[Console]::Error.WriteLine('local-synthetic-only');Write-Output 'local-synthetic-only';exit 7`,
    'utf8',
  );
  const result = run(`${definitions(['Invoke-M04Bounded'])}
$r=Invoke-M04Bounded ${q(ps)} @('-NoProfile','-NonInteractive','-File',${q(child)}) ${q(directory)} 5000 'local-synthetic-only'
Write-Output (@{ok=$r.ok;closed=$r.closed;nativeExit=$r.nativeExit;noText=($null -eq $r.text)}|ConvertTo-Json -Compress)
`);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { ok: false, closed: true, nativeExit: 7, noText: true });
  assert.ok(!result.stdout.includes('local-synthetic-only'));
  assert.ok(!result.stderr.includes('local-synthetic-only'));
});

test('native timeout closes the synthetic child before returning', { skip: !windows }, () => {
  const directory = fixture();
  const child = join(directory, 'wait.ps1');
  writeFileSync(child, 'Start-Sleep -Seconds 15', 'utf8');
  const result = run(`${definitions(['Invoke-M04Bounded'])}
$r=Invoke-M04Bounded ${q(ps)} @('-NoProfile','-NonInteractive','-File',${q(child)}) ${q(directory)} 200 'local-synthetic-only'
Write-Output (@{ok=$r.ok;closed=$r.closed;noText=($null -eq $r.text)}|ConvertTo-Json -Compress)
`);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { ok: false, closed: true, noText: true });
});

test(
  'postcheck completes its bookkeeping using the preserved actual public receipt offline',
  { skip: !windows },
  () => {
    const receiptFile = resolve(
      'milestones/M04-collectors-vimeo-instagram/evidence/live-db-postcheck-20261027.json',
    );
    const result = run(`${definitions(['M04-Catalog', 'M04-Json', 'Get-M04ExpectedColumns'])}
$ErrorActionPreference='Stop'
$actual=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText(${q(receiptFile)}))
$history=@($actual.historyBefore);$receipt=[ordered]@{status='not_completed'};$catalogFile='catalog.sql';$calls=0
function Invoke-M04Cli($Arguments,$TimeoutMs){
 $script:calls++
 if($Arguments[1] -ceq 'query'){return [pscustomobject]@{text=(ConvertTo-Json -InputObject @(@{catalog=$actual.catalog}) -Depth 15 -Compress)}}
 if($Arguments[1] -ceq 'advisors'){return [pscustomobject]@{text='{"message":"db advisors","results":[]}'}}
 throw 'UNEXPECTED_COMMAND'
}
$branch=$null
$ifs=$ast.FindAll({param($node) $node -is [Management.Automation.Language.IfStatementAst]},$true)
foreach($statement in $ifs){foreach($clause in $statement.Clauses){if($clause.Item1.Extent.Text -ceq '$Phase -ceq ''Postcheck'''){$branch=$clause.Item2.Extent.Text}}}
if($null -eq $branch){throw 'POSTCHECK_BRANCH_MISSING'}
. ([ScriptBlock]::Create($branch.Substring(1,$branch.Length-2)))
if($calls -ne 3){throw 'WRONG_COMMAND_COUNT'}
Write-Output ($receipt|ConvertTo-Json -Depth 15 -Compress)
`);
    assert.equal(result.status, 0, result.stderr);
    const receipt = JSON.parse(result.stdout);
    assert.equal(receipt.status, 'postcheck_readbacks_complete');
    assert.equal(receipt.hostedGeneratedTypesCandidate, false);
    assert.equal(receipt.hostedTypesGeneration, 'not_attempted_native_descendant_contract_unverified');
    assert.equal(receipt.securityAdvisors.nativeExit, 0);
    assert.equal(receipt.performanceAdvisors.nativeExit, 0);
  },
);

test(
  'a correctly hashed unbound public mutation template is refused before private access',
  { skip: !windows },
  () => {
    const path = resolve('milestones/M04-collectors-vimeo-instagram/evidence/live-vimeo-rewind.template.sql');
    const hash = createHash('sha256').update(readFileSync(path)).digest('hex');
    const result = spawnSync(
      ps,
      [
        '-NoProfile',
        '-NonInteractive',
        '-File',
        consumer,
        '-Phase',
        'Query',
        '-QueryFile',
        path,
        '-QuerySha256',
        hash,
        '-CheckOnly',
      ],
      { env: publicEnv, encoding: 'utf8', timeout: 15000, windowsHide: true },
    );
    assert.equal(result.status, 1);
    const receipt = JSON.parse(result.stdout);
    assert.equal(receipt.status, 'M04_QUERY_BLOCKED');
    assert.equal(receipt.privateRead, false);
    assert.equal(receipt.databaseCommands, 0);
  },
);

test('persistent originals are only read and are never materialized or deleted', () => {
  const source = readFileSync(consumer, 'utf8');
  assert.match(source, /ReadAllBytes\(\$spec\.Source\)/);
  assert.doesNotMatch(source, /(?:Delete|WriteAll\w*|Copy|Move)\([^\r\n]*\$spec\.Source/);
  assert.doesNotMatch(source, /Ensure-M03Dev(?:Runtime|ReadOnly)Handoff/);
  assert.doesNotMatch(source, /Invoke-M03FoundationMigrations/);
  assert.match(source, /if\(\$CheckOnly\).*public_ready/);
  assert.ok(
    source.indexOf('M04-QueryPath $QueryFile $QuerySha256') < source.indexOf('$receipt.privateRead=$true'),
  );
  assert.ok(source.indexOf('(M04-Hash $queryCopy)') < source.indexOf('$receipt.privateRead=$true'));
  assert.match(source, /if\(\$Phase -cne 'Query'\)\{\s*\$before=Invoke-M04Cli/);
  assert.match(
    source,
    /current_user<>'postgres' or session_user<>'postgres' or current_database\(\)<>'postgres'/,
  );
  assert.match(source, /if\(\$null -ne \$scratch -and \$receipt\.childrenClosed\)/);
  assert.ok(existsSync(consumer));
});

test(
  'Query uses one bounded Node child with SQL path/hash and no credential arguments',
  { skip: !windows },
  () => {
    const result = run(`${definitions(['Invoke-M04NativeQuery', 'M04-Json'])}
$Phase='Query';$queryRunner='runner.mjs';$queryRunnerHash='public-hash';$queryCopy='reviewed.sql';$wrappedQueryHash='public-hash'
$nodePath='fixed-node';$repo='fixed-repo';$password='local-synthetic-only';$receipt=@{databaseCommands=0;childrenClosed=$true;authenticationAttempted=$false}
$call=$null
function M04-Hash {return 'public-hash'}
function Invoke-M04Bounded($Executable,$Arguments,$WorkingDirectory,$TimeoutMs,$PrivatePassword){
 $script:call=[pscustomobject]@{executable=$Executable;args=$Arguments;privateInputMatched=($PrivatePassword -ceq 'local-synthetic-only');parentPasswordAbsent=($null -eq $env:PGPASSWORD)}
 return [pscustomobject]@{ok=$true;started=$true;closed=$true;nativeExit=0;text='{"status":"query_complete","sqlstate":null,"clientClosed":true,"rows":[{"proof":true}]}'}
}
$value=Invoke-M04NativeQuery
Write-Output (@{call=$call;commands=$receipt.databaseCommands;clientClosed=$receipt.databaseClientClosed;rows=$value.rows}|ConvertTo-Json -Depth 6 -Compress)
`);
    assert.equal(result.status, 0, result.stderr);
    const value = JSON.parse(result.stdout);
    assert.equal(value.commands, 1);
    assert.equal(value.clientClosed, true);
    assert.equal(value.call.executable, 'fixed-node');
    assert.deepEqual(value.call.args, ['runner.mjs', 'reviewed.sql', 'public-hash']);
    assert.equal(value.call.privateInputMatched, true);
    assert.equal(value.call.parentPasswordAbsent, true);
    assert.deepEqual(value.rows, [{ proof: true }]);
  },
);

test('Query cannot fall back to the twice-failed CLI transaction mechanism', { skip: !windows }, () => {
  const result = run(`${definitions(['Invoke-M04Cli'])}
$Phase='Query';$historyFile='history.sql';$catalogFile='catalog.sql';$queryCopy='reviewed.sql';$calls=0
function Invoke-M04Bounded {$script:calls++;throw 'UNEXPECTED_CHILD'}
try{$null=Invoke-M04Cli @('db','query','--file','reviewed.sql');throw 'EXPECTED_DENIAL'}catch{if($_.Exception.Message -cne 'M04_COMMAND_BLOCKED'){throw}}
Write-Output $calls
`);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), '0');
});
