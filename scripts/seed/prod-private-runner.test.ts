import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const directory = dirname(fileURLToPath(import.meta.url));
const consumerPath = join(directory, 'windows/Invoke-M02Prod.ps1');
const creatorPath = join(directory, 'windows/New-M02ProdHandoff.ps1');
const powershell = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const roots: string[] = [];
const hash = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
const safeEnv = () =>
  Object.fromEntries(
    ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP', 'LOCALAPPDATA', 'APPDATA', 'USERPROFILE'].flatMap(
      (name) => (process.env[name] ? [[name, process.env[name]!]] : []),
    ),
  );
const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
function ps(script: string, env = safeEnv()) {
  return spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-Command', script], {
    env,
    encoding: 'utf8',
    timeout: 20_000,
    windowsHide: true,
  });
}
function fixture(
  options: {
    approved?: boolean;
    approvalReference?: string | null;
    runner?: string;
    source?: string;
    preflight?: object | string;
    tls?: object | string;
    tlsExit?: number;
  } = {},
) {
  const root = mkdtempSync(join(tmpdir(), 'emr-m02-prod-runner-test-'));
  roots.push(root);
  const out = join(root, 'scripts/seed/out');
  const local = join(root, 'private-user');
  const temp = join(local, 'Temp');
  const file = join(root, 'scripts/seed/windows/Invoke-M02Prod.ps1');
  mkdirSync(dirname(file), { recursive: true });
  mkdirSync(out, { recursive: true });
  mkdirSync(temp, { recursive: true });
  mkdirSync(join(root, 'packages/shared/src'), { recursive: true });
  const approved = options.approved ?? true;
  const packet = {
    version: 1,
    target: 'hkiafqrcxaafdbcvjlzv',
    approved,
    approvalReference:
      options.approvalReference === undefined
        ? approved
          ? 'synthetic-test-approval'
          : null
        : options.approvalReference,
    sourceSha256: hash('source'),
    payloadSha256: hash('{}'),
    logoManifestSha256: hash('{}'),
    baselineSvgSha256: hash('<svg/>'),
    limits: {
      competitors: 285,
      accounts: 1754,
      logos: 257,
      uploadedBytes: 1560325,
      devPublicGets: 257,
      prodPublicGets: 257,
      storageUploads: 257,
    },
    expectedIncrementalUsd: 0,
    paidProviderCalls: 0,
    externalProviderCalls: 0,
  };
  const tls = options.tls ?? {
    status: 'verified',
    environment: 'prod',
    projectRef: 'hkiafqrcxaafdbcvjlzv',
    host: 'aws-1-eu-central-1.pooler.supabase.com',
    port: 5432,
    phase: 'tls_handshake',
    code: 'TLS_VERIFIED',
    rejectUnauthorized: true,
    exactServerName: true,
    scopedCaVerified: true,
    startupMessageSent: false,
    authenticationAttempted: false,
    socketsClosed: true,
  };
  const preflight = options.preflight ?? {
    status: 'verified',
    environment: 'prod',
    projectRef: 'hkiafqrcxaafdbcvjlzv',
    approved,
  };
  const jsonOutput = (value: object | string) =>
    typeof value === 'string' ? JSON.stringify(value) : `JSON.stringify(${JSON.stringify(value)})`;
  const publicGuard =
    'if(process.env.PGPASSWORD||process.env.SUPABASE_SECRET_KEY||process.env.VIMEO_TOKEN||process.env.YOUTUBE_API_KEY||process.env.NODE_OPTIONS)process.exit(9);';
  const runner = `if(process.argv[2]==='preflight'){${publicGuard}process.stdout.write(${jsonOutput(preflight)});process.exit(0);}if(process.argv[2]!=='apply')process.exit(8);${options.runner ?? "process.stderr.write('synthetic-prod-private-sentinel');process.exit(0);"}`;
  const sources: Record<string, string> = {
    'scripts/seed/windows/Invoke-M02Prod.ps1': options.source ?? readFileSync(consumerPath, 'utf8'),
    'scripts/seed/prod-cli.ts': '// synthetic source',
    'scripts/seed/prod-check-tls.mjs': `${publicGuard}process.stdout.write(${jsonOutput(tls)});process.exit(${options.tlsExit ?? 0});`,
    'scripts/package.json': '{}',
    'pnpm-lock.yaml': '# synthetic',
    'scripts/seed/dev-batch-packet.json': '{}',
    'scripts/seed/prod-seed-packet.json': JSON.stringify(packet),
    'scripts/seed/prod-payload.json': '{}',
    'scripts/seed/prod-logo-manifest.json': '{}',
    'scripts/assert/m02_counts.sql': 'select 1;',
    'scripts/seed/certs/supabase-root-2021.crt': 'synthetic-public-certificate',
    'scripts/seed/certs/supabase-root-2021.json': '{}',
    'scripts/seed/prod-ca.json': '{}',
    'data/competitors.csv': 'company_id,slug\nC000,everyone-films\n',
    'data/competitor_accounts.csv': 'company_id,platform,url\n',
    'reference/taxonomies.json': '{}',
    'scripts/seed/overrides.csv': 'company_id,platform,url,action\n',
    'assets/brand/everyone-logotype.svg': '<svg/>',
  };
  for (const [path, contents] of Object.entries(sources)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), contents);
  }
  writeFileSync(join(out, 'prod-runner.mjs'), runner);
  writeFileSync(
    join(out, 'prod-runner-seal.json'),
    JSON.stringify({
      version: 1,
      runnerSha256: hash(runner),
      files: Object.fromEntries(Object.entries(sources).map(([path, contents]) => [path, hash(contents)])),
    }),
  );
  const database = join(temp, 'emr-m02-prod-db-password.dpapi');
  const storage = join(temp, 'emr-m02-prod-storage-key.dpapi');
  for (const handoff of [database, storage]) {
    const result = ps(
      `ConvertTo-SecureString 'synthetic-prod-private-sentinel' -AsPlainText -Force | ConvertFrom-SecureString | Set-Content -LiteralPath ${quote(handoff)} -Encoding ASCII`,
    );
    expect(result.status).toBe(0);
  }
  const env = { ...safeEnv(), LOCALAPPDATA: local };
  return { root, out, file, database, storage, env };
}
function run(test: ReturnType<typeof fixture>, args: string[] = [], env: Record<string, string> = test.env) {
  return spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-File', test.file, ...args], {
    env,
    encoding: 'utf8',
    timeout: 20_000,
    windowsHide: true,
  });
}
afterAll(() => {
  for (const root of roots) {
    expect(root.startsWith(join(tmpdir(), 'emr-m02-prod-runner-test-'))).toBe(true);
    rmSync(root, { recursive: true, force: true });
  }
});

describe.runIf(process.platform === 'win32')('bounded production Windows credential handoff', () => {
  it('parses both production helpers under actual Windows PowerShell without executing them', () => {
    for (const file of [consumerPath, creatorPath]) {
      const result = ps(
        `$tokens=$null;$errors=$null;$null=[System.Management.Automation.Language.Parser]::ParseFile(${quote(file)},[ref]$tokens,[ref]$errors);if($errors.Count){exit 1};Write-Output 'PS5 parser OK'`,
      );
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('PS5 parser OK');
    }
  });
  it('offers only production Database, Storage and All prompts and never reuses M01/dev names', () => {
    const creator = readFileSync(creatorPath, 'utf8');
    expect(creator).toContain("[ValidateSet('Database','Storage','All')]");
    expect(creator).toContain('emr-m02-prod-db-password.dpapi');
    expect(creator).toContain('emr-m02-prod-storage-key.dpapi');
    expect(creator).toContain('[IO.FileMode]::CreateNew');
    expect(creator).not.toMatch(/emr-m01-|emr-m02-dev-|VIMEO_TOKEN|YOUTUBE_API_KEY/);
  });
  it('creates only two new encrypted synthetic prod handoffs without emitting their contents', () => {
    const test = fixture();
    rmSync(test.database);
    rmSync(test.storage);
    const result = ps(
      `function Read-Host { param([string]$Prompt,[switch]$AsSecureString) ConvertTo-SecureString 'synthetic-prod-private-sentinel' -AsPlainText -Force }; & ${quote(creatorPath)} -Kind All`,
      test.env,
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('M02 encrypted prod handoffs saved: All.');
    expect(result.stdout + result.stderr).not.toContain('synthetic-prod-private-sentinel');
    expect(existsSync(test.database) && existsSync(test.storage)).toBe(true);
    expect(readFileSync(test.database, 'utf8')).not.toContain('synthetic-prod-private-sentinel');
  });
  it('preserves an existing encrypted fixture instead of overwriting or prompting for a reset', () => {
    const test = fixture();
    const before = readFileSync(test.database);
    const result = ps(
      `function Read-Host { throw 'must not prompt when existing handoff is present' }; & ${quote(creatorPath)} -Kind Database`,
      test.env,
    );
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Previously created encrypted handoffs were preserved');
    expect(readFileSync(test.database).equals(before)).toBe(true);
    expect(existsSync(test.storage)).toBe(true);
  });
  it('runs sealed plain Node with fixed prod identity, minimal environment, withheld output and consumed-file cleanup', () => {
    const test = fixture({
      runner: `if(process.env.PGPASSWORD!=='synthetic-prod-private-sentinel'||process.env.SUPABASE_SECRET_KEY!=='synthetic-prod-private-sentinel'||process.env.SEED_DATABASE_URL!=='postgresql://postgres.hkiafqrcxaafdbcvjlzv@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require'||process.env.SUPABASE_URL!=='https://hkiafqrcxaafdbcvjlzv.supabase.co'||process.env.NODE_OPTIONS||process.env.VIMEO_TOKEN||process.env.YOUTUBE_API_KEY||process.env.SUPABASE_ACCESS_TOKEN)process.exit(3);process.stdout.write('synthetic-prod-private-sentinel');process.stderr.write('synthetic-prod-private-sentinel');`,
    });
    const result = run(test, [], {
      ...test.env,
      NODE_OPTIONS: '--invalid-inherited-hook',
      VIMEO_TOKEN: 'unrelated-sentinel',
      SUPABASE_ACCESS_TOKEN: 'unrelated-sentinel',
    });
    expect(result.status).toBe(0);
    expect(result.stdout + result.stderr).not.toContain('synthetic-prod-private-sentinel');
    expect(result.stdout).toContain('credential child closed');
    expect(result.stdout).toContain('native exit: 0');
    expect(existsSync(test.database)).toBe(false);
    expect(existsSync(test.storage)).toBe(false);
  });
  it('blocks an unapproved production packet before any private read', () => {
    const test = fixture({ approved: false });
    const result = run(test);
    expect(result.status).toBe(3);
    expect(result.stdout).toContain('approval pending');
    expect(existsSync(test.database) && existsSync(test.storage)).toBe(true);
  });
  it.each([null, '', '   '])(
    'requires a nonempty recorded approval reference before any private read %#',
    (approvalReference) => {
      const test = fixture({ approved: true, approvalReference });
      const result = run(test);
      expect(result.status).toBe(3);
      expect(result.stdout).toContain('approval pending');
      expect(existsSync(test.database) && existsSync(test.storage)).toBe(true);
    },
  );
  it('allows sealed presence-only checking without claiming approval, TLS or authentication', () => {
    const test = fixture({ approved: false, tls: 'must not run' });
    const result = run(test, ['-CheckOnly']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('approval pending');
    expect(result.stdout).toContain('authentication not tested');
    expect(existsSync(test.database) && existsSync(test.storage)).toBe(true);
  });
  it('requires both new production handoffs before consuming either', () => {
    const test = fixture();
    rmSync(test.storage);
    const result = run(test);
    expect(result.status).toBe(2);
    expect(result.stdout).toContain('emr-m02-prod-storage-key.dpapi');
    expect(existsSync(test.database)).toBe(true);
  });
  it('rejects unsupported action or target arguments instead of silently applying production', () => {
    const test = fixture();
    const result = run(test, ['-Action', 'report', '-Target', 'dev']);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('unsupported arguments');
    expect(existsSync(test.database) && existsSync(test.storage)).toBe(true);
    const created = ps(
      `function Read-Host { throw 'must not prompt' }; & ${quote(creatorPath)} -Kind Database -Target dev`,
      test.env,
    );
    expect(created.status).toBe(1);
    expect(created.stdout).toContain('unsupported arguments');
    expect(existsSync(test.database) && existsSync(test.storage)).toBe(true);
  });
  it.each([
    'prod-seed-admission.json',
    'prod-write-pending.json',
    'prod-seed-manifest.json',
    'prod-logo-manifest.json',
  ])('preserves handoffs when durable %s requires reconciliation rather than replay', (name) => {
    const test = fixture();
    writeFileSync(join(test.out, name), '{}');
    const result = run(test);
    expect(result.status).toBe(5);
    expect(result.stdout).toContain('reconciliation');
    expect(existsSync(test.database) && existsSync(test.storage)).toBe(true);
  });
  it.each([
    'scripts/seed/prod-cli.ts',
    'scripts/seed/prod-payload.json',
    'scripts/seed/prod-logo-manifest.json',
  ])('rejects changed sealed %s before consuming either handoff', (path) => {
    const test = fixture();
    writeFileSync(join(test.root, path), '// changed after build');
    expect(run(test).status).toBe(1);
    expect(existsSync(test.database) && existsSync(test.storage)).toBe(true);
  });
  it('rejects new unsealed source and parent-traversal seal entries', () => {
    for (const mode of ['new-source', 'traversal']) {
      const test = fixture();
      if (mode === 'new-source') writeFileSync(join(test.root, 'scripts/seed/unsealed.ts'), '// unsealed');
      else {
        const seal = JSON.parse(readFileSync(join(test.out, 'prod-runner-seal.json'), 'utf8'));
        seal.files['../outside.txt'] = hash('outside');
        writeFileSync(join(test.out, 'prod-runner-seal.json'), JSON.stringify(seal));
      }
      expect(run(test).status).toBe(1);
      expect(existsSync(test.database) && existsSync(test.storage)).toBe(true);
    }
  });
  it.each([
    'invalid-json',
    { status: 'verified', environment: 'dev', projectRef: 'zmotjsbzhzjvpelxvxlf', approved: true },
    { status: 'verified', environment: 'prod', projectRef: 'hkiafqrcxaafdbcvjlzv', approved: false },
    { status: 'verified', environment: 'prod', projectRef: 'hkiafqrcxaafdbcvjlzv', approved: 'True' },
  ])('fails closed on invalid preflight readback %#', (preflight) => {
    const test = fixture({ preflight });
    expect(run(test).status).toBe(4);
    expect(existsSync(test.database) && existsSync(test.storage)).toBe(true);
  });
  it.each([
    'invalid-json',
    {
      status: 'failed',
      environment: 'prod',
      projectRef: 'hkiafqrcxaafdbcvjlzv',
      code: 'SELF_SIGNED_CERT_IN_CHAIN',
    },
  ])('fails closed before private reads on public TLS failure %#', (tls) => {
    const test = fixture({ tls });
    const result = run(test);
    expect(result.status).toBe(4);
    expect(result.stdout).toContain('No decryption');
    expect(existsSync(test.database) && existsSync(test.storage)).toBe(true);
  });
  it('requires successful TLS native completion even with a valid-looking receipt', () => {
    const test = fixture({ tlsExit: 1 });
    expect(run(test).status).toBe(4);
    expect(existsSync(test.database) && existsSync(test.storage)).toBe(true);
  });
  it('rejects string-shaped TLS booleans without private reads', () => {
    const test = fixture({
      tls: {
        status: 'verified',
        environment: 'prod',
        projectRef: 'hkiafqrcxaafdbcvjlzv',
        host: 'aws-1-eu-central-1.pooler.supabase.com',
        port: 5432,
        phase: 'tls_handshake',
        code: 'TLS_VERIFIED',
        rejectUnauthorized: 'True',
        exactServerName: true,
        scopedCaVerified: true,
        startupMessageSent: false,
        authenticationAttempted: false,
        socketsClosed: true,
      },
    });
    expect(run(test).status).toBe(4);
    expect(existsSync(test.database) && existsSync(test.storage)).toBe(true);
  });
  it('rejects a reparse-point handoff directory before reading or deleting either fixture', () => {
    const test = fixture();
    const temp = dirname(test.database);
    const retained = join(test.root, 'retained-fixture-handoffs');
    const moved = ps(
      `Move-Item -LiteralPath ${quote(temp)} -Destination ${quote(retained)} -ErrorAction Stop;New-Item -ItemType Junction -Path ${quote(temp)} -Target ${quote(retained)} -ErrorAction Stop | Out-Null`,
    );
    expect(moved.status).toBe(0);
    const result = run(test);
    expect(result.status).toBe(2);
    expect(result.stdout).toContain('file boundary check failed');
    expect(existsSync(join(retained, 'emr-m02-prod-db-password.dpapi'))).toBe(true);
    expect(existsSync(join(retained, 'emr-m02-prod-storage-key.dpapi'))).toBe(true);
  });
  it('cleans already-consumed fixture handoffs if the private child cannot start', () => {
    const source = readFileSync(consumerPath, 'utf8').replace(
      '$child = New-Object Diagnostics.Process; $child.StartInfo = $start\n  $childStarted',
      "$start.FileName = 'C:\\emr-test-nonexistent\\node.exe'\n  $child = New-Object Diagnostics.Process; $child.StartInfo = $start\n  $childStarted",
    );
    expect(source).not.toBe(readFileSync(consumerPath, 'utf8'));
    const test = fixture({ source });
    const result = run(test);
    expect(result.status).toBe(1);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('credential child closed or never started');
    expect(existsSync(test.database) || existsSync(test.storage)).toBe(false);
  });
  it('withholds raw child errors and records nonzero native completion without retrying', () => {
    const test = fixture({
      runner: "process.stderr.write('synthetic-prod-private-sentinel');process.exit(7);",
    });
    const result = run(test);
    expect(result.status).toBe(7);
    expect(result.stdout + result.stderr).not.toContain('synthetic-prod-private-sentinel');
    expect(result.stdout).toContain('native exit: 7');
    expect(existsSync(test.database) || existsSync(test.storage)).toBe(false);
  });
  it('bounds owned-child lifetime, confirms closure and deletes only consumed fixture handoffs', () => {
    const source = readFileSync(consumerPath, 'utf8').replace(
      '[DateTime]::UtcNow.AddMinutes(30)',
      '[DateTime]::UtcNow.AddSeconds(0)',
    );
    const test = fixture({
      source,
      runner:
        "import{writeFileSync}from'node:fs';writeFileSync('seed/out/fixture.pid',String(process.pid));setInterval(()=>{},1000);",
    });
    const other = join(dirname(test.database), 'unrelated.dpapi');
    writeFileSync(other, 'synthetic unrelated file');
    const result = run(test);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('credential child closed');
    expect(existsSync(test.database) || existsSync(test.storage)).toBe(false);
    expect(existsSync(other)).toBe(true);
    const pid = Number(readFileSync(join(test.out, 'fixture.pid'), 'utf8'));
    expect(() => process.kill(pid, 0)).toThrow();
  });
});
