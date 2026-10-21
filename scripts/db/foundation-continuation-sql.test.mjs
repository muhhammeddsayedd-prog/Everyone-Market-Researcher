import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const powershell = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const environment = () =>
  Object.fromEntries(
    ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP', 'LOCALAPPDATA', 'APPDATA', 'USERPROFILE'].flatMap((k) =>
      process.env[k] === undefined ? [] : [[k, process.env[k]]],
    ),
  );

test(
  'actual owned local PostgreSQL compiles the generated fresh-only DO and rolls back without adopting existing C999',
  { skip: process.platform !== 'win32' || process.env.EMR_M03_LOCAL_SQL_TEST !== 'true' },
  () => {
    const source = readFileSync('scripts/assert/m03_smoke_setup.sql');
    const ps = `$ErrorActionPreference='Stop';Set-StrictMode -Version Latest
$repo='${resolve('.').replaceAll("'", "''")}';$PostcheckContinuation=$true
function Assert-Path($Root,$Relative){return Join-Path $Root $Relative}
. (Join-Path $repo 'scripts/db/windows/Foundation-AdminControl.ps1')
Write-Output (Foundation-FixtureSql 'm03_smoke_setup.sql')
`;
    const generated = spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-Command', '-'], {
      input: ps,
      env: environment(),
      encoding: 'utf8',
      timeout: 10000,
      windowsHide: true,
    });
    assert.equal(generated.status, 0, 'LOCAL_SQL_GENERATION_BLOCKED');
    assert.equal(generated.stderr, '');
    const body = generated.stdout.trim();
    assert.ok(body.startsWith('do $smoke_setup$'));
    const guard =
      "if exists(select 1 from app.competitors where company_code='C999' or slug='emr-smoke-test') then";
    assert.ok(body.indexOf('pg_advisory_xact_lock') < body.indexOf(guard));
    assert.ok(body.indexOf(guard) < body.indexOf('select c.* into v_comp'));
    assert.equal((body.match(/M03_CONTINUATION_FIXTURE_NOT_VACANT/g) || []).length, 2);
    assert.ok(
      body.includes(
        "if found then\n    raise exception using errcode='55000', message='M03_CONTINUATION_FIXTURE_NOT_VACANT';",
      ),
    );
    const snapshot = `select jsonb_build_object('database',current_database(),'identity',current_user,'fixtureRows',(select count(*) from app.competitors where company_code='C999' or slug='emr-smoke-test'),'competitors',(select count(*) from app.competitors),'accounts',(select count(*) from app.competitor_accounts),'items',(select count(*) from app.items),'fixtureDigest',encode(extensions.digest((select coalesce(jsonb_agg(to_jsonb(c) order by c.id),'[]'::jsonb)::text from app.competitors c where c.company_code='C999' or c.slug='emr-smoke-test'),'sha256'),'hex'));`;
    assert.equal(body.includes('$generated_continuation$'), false);
    const sql = `begin;set local statement_timeout='15s';set local lock_timeout='2s';${snapshot}
do $verify$ begin
  begin
    execute $generated_continuation$${body}$generated_continuation$;
    raise exception 'LOCAL_EXPECTED_VACANCY_REJECTION';
  exception when sqlstate '55000' then
    if SQLERRM<>'M03_CONTINUATION_FIXTURE_NOT_VACANT' then raise exception 'LOCAL_UNEXPECTED_GUARD'; end if;
  end;
end; $verify$;
${snapshot}rollback;`;
    const checked = spawnSync(
      'docker',
      [
        'exec',
        '-i',
        'supabase_db_everyone-market-radar',
        'psql',
        '-X',
        '-U',
        'postgres',
        '-d',
        'postgres',
        '-qAt',
        '-v',
        'ON_ERROR_STOP=1',
      ],
      { input: sql, env: environment(), encoding: 'utf8', timeout: 25000, windowsHide: true },
    );
    assert.equal(checked.status, 0, 'LOCAL_GENERATED_DO_BLOCKED');
    const rows = checked.stdout.trim().split(/\r?\n/).map(JSON.parse);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].database, 'postgres');
    assert.equal(rows[0].identity, 'postgres');
    assert.equal(rows[0].fixtureRows, 1);
    assert.deepEqual(rows[1], rows[0]);
    assert.deepEqual(readFileSync('scripts/assert/m03_smoke_setup.sql'), source);
  },
);
