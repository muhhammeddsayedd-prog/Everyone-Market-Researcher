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
  ['supabase-pat', 'sbp_(oauth_|v0_)?[a-f0-9]{40}'],
  ['private-key', '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----'],
];

function indexedMatches(rule, pattern) {
  let output;
  try {
    output = execFileSync('git', ['grep', '--cached', '-I', '-n', '-E', '-e', pattern, '--', '.'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 4 * 1024 * 1024,
    });
  } catch (error) {
    if (error.status === 1) return [];
    throw new Error(`Secret scan could not execute rule ${rule}`);
  }
  return [...output.matchAll(/^([^\n]+?):(\d+):(.*)$/gm)];
}

for (const [rule, pattern] of rules) {
  for (const match of indexedMatches(rule, pattern)) {
    violations.push({ rule, path: match[1], line: Number(match[2]) });
  }
}

function decodePassword(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value; // Malformed encoding must not bypass a finding or echo the candidate.
  }
}

function hasRealPassword(candidate) {
  // Inspect before @ even when malformed userinfo contains an unescaped /, ? or #.
  // Splitting on those URL delimiters first would erase a credential-shaped value.
  const afterScheme = candidate.replace(/^postgres(?:ql)?:\/\//i, '');
  const userinfo = afterScheme.slice(0, Math.max(0, afterScheme.lastIndexOf('@')));
  const separator = userinfo.indexOf(':');
  const passwords = separator >= 0 ? [decodePassword(userinfo.slice(separator + 1))] : [];
  const queryIndex = candidate.indexOf('?');
  if (queryIndex >= 0) {
    for (const [key, value] of new URLSearchParams(candidate.slice(queryIndex + 1).split('#', 1)[0]))
      if (key.toLowerCase() === 'password') passwords.push(value);
  }
  let host = '';
  try {
    host = new URL(candidate).hostname;
  } catch {
    // An invalid host must never grant a synthetic-fixture exemption.
  }
  const reservedHost =
    /^(localhost|127\.0\.0\.1|\[::1\])$/.test(host) ||
    /\.(test|invalid)$/.test(host) ||
    /(^|\.)example\.(com|net|org)$/.test(host);
  return passwords.some((password) => {
    if (!password) return false;
    const placeholder =
      /^<(pw|password|your[-_]password|db[-_]password|urlencoded[-_]password|url[-_]encoded[-_]password|set[-_]by[-_]owner)>$/i.test(
        password,
      ) || /^(\[(?:YOUR[-_ ])?(?:PASSWORD|PW)\]|\$\{[A-Za-z_][A-Za-z0-9_]*\})$/i.test(password);
    const fixturePassword = /^(synthetic|fixture|test)[-_](pass(word)?|credential)([-_][a-z0-9]+)*$/i.test(
      password,
    );
    return !placeholder && !(reservedHost && fixturePassword);
  });
}

const uriPattern = '[Pp][Oo][Ss][Tt][Gg][Rr][Ee][Ss]([Qq][Ll])?://';
for (const match of indexedMatches('postgres-password', uriPattern)) {
  const candidates = match[3].matchAll(/postgres(?:ql)?:\/\/[^\s"'`]+/gi);
  if ([...candidates].some(([candidate]) => hasRealPassword(candidate)))
    violations.push({ rule: 'postgres-password', path: match[1], line: Number(match[2]) });
}

process.stdout.write(`${JSON.stringify({ scannedTrackedFiles: paths.length, violations }, null, 2)}\n`);
if (violations.length) process.exitCode = 1;
