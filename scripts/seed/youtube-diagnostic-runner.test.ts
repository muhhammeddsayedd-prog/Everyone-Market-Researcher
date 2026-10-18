import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const source = resolve('seed/windows/Invoke-M02YouTubeDiagnostic.ps1');
const powershell = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const roots: string[] = [];
const runId = 'e6a7e79c-4d48-45ef-9139-cd83db362f43';
const sourceSha256 = '135e6b24c632bb931b54025a09941963b777ada87ba25c58306a430756d32f66';
const projectRef = 'zmotjsbzhzjvpelxvxlf';
// Relevant unchanged fields transcribed from the actual sanitized public live
// receipt at 2026-10-18T01:12:05.595Z, rather than a helper-shaped surrogate.
const activeReceipt = {
  environment: 'dev',
  projectRef,
  observedAt: '2026-10-18T01:12:05.595Z',
  action: 'accept-dev',
  databaseAuthentication: 'postgres_authenticated_to_verified_dev_pooler',
  stages: [
    {
      name: 'database_identity',
      status: 'completed',
      result: {
        current_user: 'postgres',
        session_user: 'postgres',
        database: 'postgres',
        originalMigrations: 7,
      },
    },
    {
      name: 'seed_and_idempotency',
      status: 'completed',
      result: {
        sourceSha256,
        first: {
          competitorsInserted: 285,
          competitorsUpdated: 0,
          accountsInserted: 1754,
          accountsUpdated: 0,
        },
        second: { competitorsInserted: 0, competitorsUpdated: 0, accountsInserted: 0, accountsUpdated: 0 },
        issues: 3,
      },
    },
    {
      name: 'resolution',
      status: 'blocked',
      code: 'M02_REQUIRED_CONFIGURATION_PENDING',
      result: {
        attempted: 272,
        updated: 202,
        unchanged: 0,
        preserved: 0,
        skipped: 3,
        blocked: ['youtube'],
        issues: [{ company_code: 'C142', platform: 'youtube', code: 'yt_bad_response' }],
      },
    },
    { name: 'website_and_format_checks', status: 'completed' },
    { name: 'logos', status: 'running' },
  ],
  nativeCompletion: 'in_progress',
};
const shapeKeys = [
  'topLevelObject',
  'itemsPresent',
  'itemsArray',
  'pageInfoPresent',
  'pageInfoObject',
  'totalResultsPresent',
  'totalResultsNonnegativeInteger',
  'firstItemObject',
  'idPresent',
  'idString',
  'idMatchesCurrentPattern',
  'contentDetailsPresent',
  'contentDetailsObject',
  'relatedPlaylistsPresent',
  'relatedPlaylistsObject',
  'uploadsPresent',
  'uploadsString',
  'uploadsMatchesCurrentPattern',
  'uploadsMatchesBoundedOpaquePattern',
  'unexpectedTopLevelFields',
  'unexpectedItemFields',
  'unexpectedContentDetailsFields',
  'unexpectedRelatedPlaylistFields',
];
const safeResult = {
  status: 'completed',
  httpStatus: 200,
  jsonParsed: true,
  totalResults: 1,
  itemCount: 1,
  shape: Object.fromEntries(shapeKeys.map((key) => [key, false])),
  requestCount: 1,
};
const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const publicEnv = () =>
  Object.fromEntries(
    ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP', 'LOCALAPPDATA', 'APPDATA', 'USERPROFILE'].flatMap(
      (key) => (process.env[key] === undefined ? [] : [[key, process.env[key]]]),
    ),
  ) as NodeJS.ProcessEnv;

function fixture(mode: 'normal' | 'start-failed' | 'timeout' | 'unsafe-output' | 'stale-parent' = 'normal') {
  const root = mkdtempSync(join(tmpdir(), 'emr-m02-yt-diagnostic-fixture-'));
  roots.push(root);
  const out = join(root, 'scripts/seed/out');
  const local = join(root, 'private-fixture');
  mkdirSync(out, { recursive: true });
  mkdirSync(join(local, 'Temp'), { recursive: true });
  mkdirSync(join(root, 'scripts/seed/windows'), { recursive: true });
  const env = {
    ...publicEnv(),
    LOCALAPPDATA: local,
    PGPASSWORD: 'synthetic-unrelated-password',
    SUPABASE_SECRET_KEY: 'synthetic-unrelated-key',
    NODE_OPTIONS: '--no-warnings',
  };
  const identity = spawnSync(
    powershell,
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `(Get-Process -Id ${process.pid} -ErrorAction Stop).StartTime.ToUniversalTime().ToString('o')`,
    ],
    { env: publicEnv(), encoding: 'utf8', windowsHide: true },
  );
  expect(identity.status).toBe(0);
  const parentStartTimeUtc =
    mode === 'stale-parent' ? '2020-01-01T00:00:00.0000000Z' : identity.stdout.trim();
  let consumer = readFileSync(source, 'utf8')
    .replace('$originalParentPid = 7492', `$originalParentPid = ${process.pid}`)
    .replace('2026-10-18T01:12:05.0241632Z', parentStartTimeUtc);
  if (mode === 'start-failed')
    consumer = consumer.replace(
      '$start.FileName = $node.Source',
      "$start.FileName = 'C:\\emr-fixture-no-such-node.exe'",
    );
  if (mode === 'timeout')
    consumer = consumer.replace(
      '[DateTime]::UtcNow.AddSeconds(15)',
      '[DateTime]::UtcNow.AddMilliseconds(200)',
    );
  const file = join(root, 'scripts/seed/windows/Invoke-M02YouTubeDiagnostic.ps1');
  writeFileSync(file, consumer);
  const module = join(root, 'scripts/seed/diagnose-youtube.mjs');
  const ordinary = `import{writeFileSync}from'node:fs';writeFileSync('seed/out/fixture.pid',String(process.pid));if(process.env.YOUTUBE_API_KEY!=='synthetic-youtube-key'||process.env.PGPASSWORD||process.env.SUPABASE_SECRET_KEY||process.env.NODE_OPTIONS){process.stderr.write('synthetic-raw-credential-error');process.exit(8)}process.stderr.write('synthetic-raw-credential-error');process.stdout.write(${JSON.stringify(JSON.stringify(safeResult))});`;
  writeFileSync(
    module,
    mode === 'timeout'
      ? "import{writeFileSync}from'node:fs';writeFileSync('seed/out/fixture.pid',String(process.pid));setInterval(()=>{},1000);"
      : mode === 'unsafe-output'
        ? "process.stdout.write(JSON.stringify({credential:'synthetic-must-not-escape'}));process.stderr.write('synthetic-raw-credential-error');"
        : ordinary,
  );
  const packet = join(root, 'scripts/seed/dev-batch-packet.json');
  writeFileSync(
    packet,
    JSON.stringify({
      version: 1,
      target: projectRef,
      approved: true,
      sourceSha256,
      expectedIncrementalUsd: 0,
      paidProviderCalls: 0,
    }),
  );
  writeFileSync(
    join(out, 'dev-write-pending.json'),
    JSON.stringify({
      target: `supabase:${projectRef}:postgres`,
      action: 'accept-dev',
      sourceSha256,
      runId,
      outcome: 'unreconciled',
    }),
  );
  writeFileSync(join(out, 'dev-latest.json'), JSON.stringify(activeReceipt));
  const files = Object.fromEntries(
    [
      'scripts/seed/diagnose-youtube.mjs',
      'scripts/seed/windows/Invoke-M02YouTubeDiagnostic.ps1',
      'scripts/seed/dev-batch-packet.json',
    ].map((path) => [path, hash(join(root, path))]),
  );
  writeFileSync(
    join(out, 'youtube-diagnostic-seal.json'),
    JSON.stringify({
      version: 1,
      diagnostic: 'c142-youtube-shape-once',
      projectRef,
      runId,
      parentPid: process.pid,
      parentStartTimeUtc,
      maxRequests: 1,
      files,
    }),
  );
  const handoff = join(local, 'Temp/emr-m02-youtube-api-key.dpapi');
  const encrypted = spawnSync(
    powershell,
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `$s = ConvertTo-SecureString 'synthetic-youtube-key' -AsPlainText -Force; try { $s | ConvertFrom-SecureString | Set-Content -LiteralPath '${handoff.replaceAll("'", "''")}' -Encoding ASCII } finally { $s.Dispose() }`,
    ],
    { env: publicEnv(), encoding: 'utf8', windowsHide: true },
  );
  expect(encrypted.status).toBe(0);
  return {
    root,
    file,
    out,
    handoff,
    env,
    run: (checkOnly = false) =>
      spawnSync(
        powershell,
        ['-NoProfile', '-NonInteractive', '-File', file, ...(checkOnly ? ['-CheckOnly'] : [])],
        { env, encoding: 'utf8', timeout: 25_000, windowsHide: true },
      ),
  };
}

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

describe.runIf(process.platform === 'win32')(
  'one-use YouTube diagnostic consumer, isolated synthetic handoffs only',
  () => {
    it('confirms public gates and presence without decrypting or admitting an attempt', () => {
      const f = fixture();
      const result = f.run(true);
      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout).status).toBe('ready');
      expect(existsSync(join(f.out, 'youtube-diagnostic-attempt.json'))).toBe(false);
      expect(existsSync(f.handoff)).toBe(true);
    });
    it('passes only the YouTube key, suppresses raw stderr and leaves main-parent cleanup ownership', () => {
      const f = fixture();
      const result = f.run();
      expect(result.status).toBe(0);
      const receipt = JSON.parse(result.stdout);
      expect(receipt.diagnostic).toEqual(safeResult);
      expect(receipt.childClosed).toBe(true);
      expect(result.stdout + result.stderr).not.toContain('synthetic-');
      expect(existsSync(f.handoff)).toBe(true);
      expect(existsSync(join(f.out, 'youtube-diagnostic-attempt.json'))).toBe(true);
      expect(f.run().status).not.toBe(0);
    });
    it.each([
      'missing-pending',
      'finished-logos',
      'wrong-issue',
      'wrong-identity',
      'wrong-migrations',
      'bad-seal',
      'missing-handoff',
    ] as const)('rejects %s before admission/decrypt/start and preserves the handoff', (kind) => {
      const f = fixture();
      if (kind === 'missing-pending') rmSync(join(f.out, 'dev-write-pending.json'));
      if (['finished-logos', 'wrong-issue', 'wrong-identity', 'wrong-migrations'].includes(kind)) {
        const path = join(f.out, 'dev-latest.json');
        const value = JSON.parse(readFileSync(path, 'utf8'));
        if (kind === 'finished-logos') value.stages[4].status = 'completed';
        else if (kind === 'wrong-issue') value.stages[2].result.issues[0].company_code = 'C999';
        else if (kind === 'wrong-identity') value.stages[0].result.current_user = 'api_agent';
        else value.stages[0].result.originalMigrations = 0;
        writeFileSync(path, JSON.stringify(value));
      }
      if (kind === 'bad-seal')
        writeFileSync(join(f.root, 'scripts/seed/diagnose-youtube.mjs'), "throw Error('not sealed')");
      if (kind === 'missing-handoff') rmSync(f.handoff);
      const result = f.run();
      expect(result.status).toBe(1);
      expect(JSON.parse(result.stdout).status).toBe('blocked');
      if (kind === 'missing-handoff')
        expect(JSON.parse(result.stdout).code).toBe('DIAGNOSTIC_HANDOFF_UNAVAILABLE');
      expect(existsSync(join(f.out, 'fixture.pid'))).toBe(false);
      expect(existsSync(join(f.out, 'youtube-diagnostic-attempt.json'))).toBe(false);
      expect(existsSync(f.handoff)).toBe(kind !== 'missing-handoff');
    });
    it('rejects a reused PID with a different original start time before admission', () => {
      const f = fixture('stale-parent');
      const result = f.run();
      expect(result.status).toBe(1);
      expect(JSON.parse(result.stdout).status).toBe('blocked');
      expect(existsSync(join(f.out, 'youtube-diagnostic-attempt.json'))).toBe(false);
      expect(existsSync(f.handoff)).toBe(true);
    });
    it('handles failed native Start without HasExited on an unstarted process or removing the handoff', () => {
      const f = fixture('start-failed');
      const result = f.run();
      expect(result.status).toBe(1);
      const receipt = JSON.parse(result.stdout);
      expect(receipt.childClosed).toBe(true);
      expect(receipt.code).toBe('DIAGNOSTIC_START_FAILED');
      expect(result.stderr).toBe('');
      expect(existsSync(f.handoff)).toBe(true);
    });
    it('bounds timeout, closes the owned child and retains admission and parent-owned handoff', () => {
      const f = fixture('timeout');
      const result = f.run();
      expect(result.status).toBe(1);
      const receipt = JSON.parse(result.stdout);
      expect(receipt.childClosed).toBe(true);
      expect(receipt.code).toBe('DIAGNOSTIC_TIMEOUT');
      expect(existsSync(f.handoff)).toBe(true);
      expect(existsSync(join(f.out, 'youtube-diagnostic-attempt.json'))).toBe(true);
      const pid = Number(readFileSync(join(f.out, 'fixture.pid'), 'utf8'));
      expect(() => process.kill(pid, 0)).toThrow();
    });
    it('rejects nonallowlisted stdout without forwarding it or credential-bearing stderr', () => {
      const f = fixture('unsafe-output');
      const result = f.run();
      expect(result.status).toBe(1);
      expect(JSON.parse(result.stdout).code).toBe('DIAGNOSTIC_OUTPUT_INVALID');
      expect(result.stdout + result.stderr).not.toContain('synthetic-');
      expect(existsSync(f.handoff)).toBe(true);
    });
  },
);
