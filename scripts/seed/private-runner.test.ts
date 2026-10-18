import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const directory = dirname(fileURLToPath(import.meta.url));
const consumerPath = join(directory, 'windows/Invoke-M02Dev.ps1');
const creatorPath = join(directory, 'windows/New-M02DevHandoff.ps1');
const consumer = readFileSync(consumerPath, 'utf8');
const creator = readFileSync(creatorPath, 'utf8');
const powershell = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const roots: string[] = [];
const hash = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
const safeEnv = () =>
  Object.fromEntries(
    ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP', 'LOCALAPPDATA', 'APPDATA', 'USERPROFILE'].flatMap(
      (name) => (process.env[name] ? [[name, process.env[name]!]] : []),
    ),
  );
function ps(script: string, env = safeEnv()) {
  return spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-Command', script], {
    env,
    encoding: 'utf8',
    timeout: 20_000,
    windowsHide: true,
  });
}
function quote(path: string) {
  return `'${path.replaceAll("'", "''")}'`;
}

function fixture(
  source = consumer,
  runner = "process.stderr.write('test-only-private-sentinel'); process.exit(0);",
  approved = true,
) {
  const root = mkdtempSync(join(tmpdir(), 'emr-m02-runner-test-'));
  roots.push(root);
  const windows = join(root, 'scripts/seed/windows');
  const out = join(root, 'scripts/seed/out');
  const local = join(root, 'private-user');
  const temp = join(local, 'Temp');
  mkdirSync(windows, { recursive: true });
  mkdirSync(out, { recursive: true });
  mkdirSync(temp, { recursive: true });
  const file = join(windows, 'Invoke-M02Dev.ps1');
  writeFileSync(file, source);
  writeFileSync(join(root, 'scripts/seed/cli.ts'), '// non-secret test fixture');
  mkdirSync(join(root, 'packages/shared/src'), { recursive: true });
  writeFileSync(join(root, 'scripts/package.json'), '{}');
  writeFileSync(join(root, 'pnpm-lock.yaml'), '# fixture');
  const supplemental = {
    'scripts/seed/dev-batch-packet.json': JSON.stringify({
      version: 1,
      target: 'zmotjsbzhzjvpelxvxlf',
      approved,
    }),
    'data/competitors.csv': 'company_id,slug\nC000,everyone-films\n',
    'data/competitor_accounts.csv': 'company_id,platform,url\n',
    'reference/taxonomies.json': '{}',
    'scripts/seed/overrides.csv': 'company_id,platform,url,action\n',
    'assets/brand/everyone-logotype.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>',
  };
  for (const [path, contents] of Object.entries(supplemental)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), contents);
  }
  writeFileSync(join(out, 'runner.mjs'), runner);
  const files: Record<string, string> = {};
  for (const path of [
    'scripts/seed/windows/Invoke-M02Dev.ps1',
    'scripts/seed/cli.ts',
    'scripts/package.json',
    'pnpm-lock.yaml',
    ...Object.keys(supplemental),
  ])
    files[path] = hash(readFileSync(join(root, path)));
  writeFileSync(
    join(out, 'runner-seal.json'),
    JSON.stringify({ version: 1, runnerSha256: hash(runner), files }),
  );
  const handoff = join(temp, 'emr-m02-dev-db-password.dpapi');
  const created = ps(
    `ConvertTo-SecureString 'test-only-private-sentinel' -AsPlainText -Force | ConvertFrom-SecureString | Set-Content -LiteralPath ${quote(handoff)} -Encoding ASCII`,
  );
  expect(created.status).toBe(0);
  return { root, out, file, handoff, env: { ...safeEnv(), LOCALAPPDATA: local } };
}
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

describe.runIf(process.platform === 'win32')('bounded Windows M02 credential consumer', () => {
  it('parses both real helpers under Windows PowerShell 5 without execution', () => {
    for (const path of [consumerPath, creatorPath]) {
      const result = ps(
        `$tokens=$null; $errors=$null; $null=[System.Management.Automation.Language.Parser]::ParseFile(${quote(path)},[ref]$tokens,[ref]$errors); if($errors.Count){exit 1}; Write-Output 'PS5 parser OK'`,
      );
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('PS5 parser OK');
    }
  });
  it('launches plain Node, never an install or transformation process, and drains private output without collecting it', () => {
    expect(consumer).toContain('seed/out/runner.mjs');
    expect(consumer).not.toMatch(/--import\s+tsx|(?:pnpm|npx)(?:\.cmd)?\s|ReadToEndAsync/);
    expect(consumer).toContain('CopyToAsync([IO.Stream]::Null)');
    expect(creator).toContain('[IO.FileMode]::CreateNew');
  });
  it('checks the runner and source seal before any handoff decryption', () => {
    expect(consumer.indexOf('runner-seal.json')).toBeLessThan(consumer.indexOf('ConvertTo-SecureString'));
    expect(consumer).toContain('ReparsePoint');
  });
  it('closes a real non-secret child, withholds stdout/stderr, and consumes only fixture credentials', () => {
    const test = fixture(
      consumer,
      "if(process.env.NODE_OPTIONS || process.env.SUPABASE_ACCESS_TOKEN || process.env.VIMEO_TOKEN || process.env.PGPASSWORD !== 'test-only-private-sentinel') process.exit(3); process.stderr.write('test-only-private-sentinel'); process.exit(0);",
    );
    const result = spawnSync(
      powershell,
      ['-NoProfile', '-NonInteractive', '-File', test.file, '-Action', 'seed'],
      {
        env: {
          ...test.env,
          NODE_OPTIONS: '--invalid-inherited-hook',
          SUPABASE_ACCESS_TOKEN: 'unrelated-test-sentinel',
        },
        encoding: 'utf8',
        timeout: 20_000,
        windowsHide: true,
      },
    );
    expect(result.status).toBe(0);
    expect(result.stdout + result.stderr).not.toContain('test-only-private-sentinel');
    expect(result.stdout).toContain('credential child closed');
    expect(existsSync(test.handoff)).toBe(false);
  });
  it('does not read HasExited on a failed Start, and still clears consumed fixture handoffs', () => {
    const test = fixture(
      consumer.replace('$start.FileName = $node', "$start.FileName = 'C:\\emr-test-nonexistent\\node.exe'"),
    );
    const result = spawnSync(
      powershell,
      ['-NoProfile', '-NonInteractive', '-File', test.file, '-Action', 'seed'],
      { env: test.env, encoding: 'utf8', timeout: 20_000, windowsHide: true },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toBe('');
    expect(result.stdout).not.toContain('test-only-private-sentinel');
    expect(existsSync(test.handoff)).toBe(false);
  });
  it('rejects a changed source before consuming or decrypting the fixture handoff', () => {
    const test = fixture();
    writeFileSync(join(test.root, 'scripts/seed/cli.ts'), '// changed after build');
    const result = spawnSync(
      powershell,
      ['-NoProfile', '-NonInteractive', '-File', test.file, '-Action', 'seed'],
      { env: test.env, encoding: 'utf8', timeout: 20_000, windowsHide: true },
    );
    expect(result.status).toBe(1);
    expect(existsSync(test.handoff)).toBe(true);
    expect(result.stdout).toContain('No decryption');
  });
  it('rejects an added source omitted from the seal before consuming the fixture handoff', () => {
    const test = fixture();
    writeFileSync(join(test.root, 'scripts/seed/new-source.ts'), '// unsealed');
    const result = spawnSync(
      powershell,
      ['-NoProfile', '-NonInteractive', '-File', test.file, '-Action', 'seed'],
      { env: test.env, encoding: 'utf8', timeout: 20_000, windowsHide: true },
    );
    expect(result.status).toBe(1);
    expect(existsSync(test.handoff)).toBe(true);
  });
  it('rejects a parent traversal in the seal before reading a file outside the workspace', () => {
    const test = fixture();
    const seal = JSON.parse(readFileSync(join(test.out, 'runner-seal.json'), 'utf8'));
    seal.files['../outside-sensitive.txt'] = 'a'.repeat(64);
    writeFileSync(join(test.out, 'runner-seal.json'), JSON.stringify(seal));
    const result = spawnSync(
      powershell,
      ['-NoProfile', '-NonInteractive', '-File', test.file, '-Action', 'seed'],
      { env: test.env, encoding: 'utf8', timeout: 20_000, windowsHide: true },
    );
    expect(result.status).toBe(1);
    expect(existsSync(test.handoff)).toBe(true);
  });
  it('bounds timeout cleanup and confirms the owned fixture child has exited', () => {
    const test = fixture(
      consumer.replace('[DateTime]::UtcNow.AddMinutes(45)', '[DateTime]::UtcNow.AddSeconds(0)'),
      "import{writeFileSync}from'node:fs';writeFileSync('seed/out/fixture.pid',String(process.pid));setInterval(()=>{},1000);",
    );
    const result = spawnSync(
      powershell,
      ['-NoProfile', '-NonInteractive', '-File', test.file, '-Action', 'seed'],
      { env: test.env, encoding: 'utf8', timeout: 20_000, windowsHide: true },
    );
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('credential child closed');
    expect(existsSync(test.handoff)).toBe(false);
    const pid = Number(readFileSync(join(test.out, 'fixture.pid'), 'utf8'));
    expect(() => process.kill(pid, 0)).toThrow();
  });
  it('blocks an unapproved concrete batch before decrypting any fixture handoff', () => {
    const test = fixture(consumer, 'process.exit(0)', false);
    const result = spawnSync(
      powershell,
      ['-NoProfile', '-NonInteractive', '-File', test.file, '-Action', 'seed'],
      { env: test.env, encoding: 'utf8', timeout: 20_000, windowsHide: true },
    );
    expect(result.status).toBe(3);
    expect(result.stdout).toContain('approval pending');
    expect(result.stdout).toContain('No decryption');
    expect(existsSync(test.handoff)).toBe(true);
  });
  it('permits a presence-only check while explicitly retaining the approval gate', () => {
    const test = fixture(consumer, 'process.exit(0)', false);
    const result = spawnSync(
      powershell,
      ['-NoProfile', '-NonInteractive', '-File', test.file, '-Action', 'seed', '-CheckOnly'],
      { env: test.env, encoding: 'utf8', timeout: 20_000, windowsHide: true },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('approval pending');
    expect(result.stdout).toContain('authentication not tested');
    expect(existsSync(test.handoff)).toBe(true);
  });
  it('allows independent provider probes with only database credentials and reports both missing handoffs', () => {
    const test = fixture();
    const result = spawnSync(
      powershell,
      ['-NoProfile', '-NonInteractive', '-File', test.file, '-Action', 'probe'],
      { env: test.env, encoding: 'utf8', timeout: 20_000, windowsHide: true },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('emr-m02-vimeo-token.dpapi = False');
    expect(result.stdout).toContain('emr-m02-youtube-api-key.dpapi = False');
    expect(existsSync(test.handoff)).toBe(false);
  });
  it('supports separate Vimeo and YouTube hidden-prompt handoff creation', () => {
    expect(creator).toMatch(/ValidateSet\([^\n]*'Vimeo'[^\n]*'YouTube'/);
    expect(creator).toMatch(/\$Kind -in @\('Vimeo','Providers','All'\)/);
    expect(creator).toMatch(/\$Kind -in @\('YouTube','Providers','All'\)/);
  });
  it('allows dev acceptance to finish independent database stages when storage is missing', () => {
    const test = fixture();
    const result = spawnSync(
      powershell,
      ['-NoProfile', '-NonInteractive', '-File', test.file, '-Action', 'accept-dev'],
      { env: test.env, encoding: 'utf8', timeout: 20_000, windowsHide: true },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('emr-m02-dev-storage-key.dpapi = False');
    expect(existsSync(test.handoff)).toBe(false);
  });
});
