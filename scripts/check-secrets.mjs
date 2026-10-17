import { execFileSync } from 'node:child_process';

// Scan the index, never print matches. This is a targeted check, not a complete credential audit.
const paths = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const examples = new Set(['templates/.env.example', 'apps/web/.env.example']);
const violations = paths
  .filter((path) => /(^|\/)\.env(?:$|\.)/.test(path) && !examples.has(path))
  .map((path) => ({ rule: 'tracked-environment', path }));
const rules = [
  ['github-token', '(gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{70,})'],
  ['openai-key', 'sk-(proj-|svcacct-)?[A-Za-z0-9_-]{40,}'],
  ['supabase-secret', 'sb_secret_[A-Za-z0-9_-]{30,}'],
  ['private-key', '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----'],
];

for (const [rule, pattern] of rules) {
  let output;
  try {
    output = execFileSync('git', ['grep', '--cached', '-I', '-n', '-E', '-e', pattern, '--', '.'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 4 * 1024 * 1024,
    });
  } catch (error) {
    if (error.status === 1) continue;
    throw new Error(`Secret scan could not execute rule ${rule}`);
  }
  for (const match of output.matchAll(/^([^\n]+?):(\d+):/gm)) {
    violations.push({ rule, path: match[1], line: Number(match[2]) });
  }
}

process.stdout.write(`${JSON.stringify({ scannedTrackedFiles: paths.length, violations }, null, 2)}\n`);
if (violations.length) process.exitCode = 1;
