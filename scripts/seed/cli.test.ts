import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

const scripts = join(dirname(fileURLToPath(import.meta.url)), '..');
const safeEnv = Object.fromEntries(
  ['PATH', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'USERPROFILE', 'LOCALAPPDATA', 'APPDATA'].flatMap((name) =>
    process.env[name] ? [[name, process.env[name]!]] : [],
  ),
);
function run(args: string[], env = safeEnv) {
  return spawnSync(process.execPath, args, {
    cwd: scripts,
    env,
    encoding: 'utf8',
    timeout: 30_000,
    windowsHide: true,
  });
}
beforeAll(() => {
  const built = run(['seed/build-runner.mjs']);
  expect(built.status).toBe(0);
}, 35_000);
describe('plain Node M02 entrypoint without credentials', () => {
  it('plans the actual CSVs without a DB, token, loader or compiler child', () => {
    const result = run(['seed/out/runner.mjs', 'plan']);
    expect(result.status).toBe(0);
    const summary = JSON.parse(result.stdout) as {
      mode: string;
      counts: { plannedCompetitors: number; plannedAccounts: number; statuses: Record<string, number> };
      issues: number;
    };
    expect(summary.mode).toBe('local-plan-only');
    expect(summary.counts.plannedCompetitors).toBe(285);
    expect(summary.counts.plannedAccounts).toBe(1754);
    expect(summary.counts.statuses).toEqual({ active: 289, paused: 1458, invalid: 7 });
    expect(summary.issues).toBe(10); // Three original URL findings plus seven explicit owner exclusions.
    const plan = JSON.parse(readFileSync(join(scripts, 'seed/out/plan.json'), 'utf8')) as {
      issues: { code: string; company_code: string; platform: string }[];
    };
    expect(
      plan.issues
        .filter((issue) => issue.code === 'owner_invalid')
        .map((issue) => `${issue.company_code}:${issue.platform}`)
        .sort(),
    ).toEqual([
      'C102:youtube',
      'C142:youtube',
      'C218:youtube',
      'C231:youtube',
      'C233:youtube',
      'C245:youtube',
      'C283:youtube',
    ]);
  });
  it('rejects production at argument parsing without loading a credential', () => {
    const result = run(['seed/out/runner.mjs', 'seed', '--target', 'prod', '--apply']);
    expect(result.status).toBe(1);
    expect(result.stderr.trim()).toBe('M02_PRODUCTION_NOT_APPROVED');
    expect(result.stdout).toBe('');
  });
  it('refuses to launch a build compiler in a credential-bearing environment', () => {
    const result = run(['seed/build-runner.mjs'], {
      ...safeEnv,
      SUPABASE_DB_PASSWORD: 'test-only-private-sentinel',
    });
    expect(result.status).toBe(1);
    expect(result.stderr.trim()).toBe('M02_BUILD_REQUIRES_CREDENTIAL_FREE_PROCESS');
    expect(result.stdout).toBe('');
  });
  it('source-seals the reviewed data, baseline logo and exact dev packet', () => {
    const seal = JSON.parse(readFileSync(join(scripts, 'seed/out/runner-seal.json'), 'utf8')) as {
      files: Record<string, string>;
    };
    for (const path of [
      'data/competitors.csv',
      'data/competitor_accounts.csv',
      'reference/taxonomies.json',
      'scripts/seed/overrides.csv',
      'assets/brand/everyone-logotype.svg',
      'scripts/seed/dev-batch-packet.json',
    ])
      expect(seal.files[path]).toMatch(/^[a-f0-9]{64}$/);
  });
});
