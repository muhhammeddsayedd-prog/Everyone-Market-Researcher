import { Resolver as NativeResolver, lookup as nativeLookup } from 'node:dns/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const host = 'muhhammedsayed.app.n8n.cloud';
const osNames = ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP', 'LOCALAPPDATA', 'APPDATA', 'USERPROFILE'];
const codes = new Set([
  'ENODATA',
  'EFORMERR',
  'ESERVFAIL',
  'ENOTFOUND',
  'ENOTIMP',
  'EREFUSED',
  'EBADQUERY',
  'EBADNAME',
  'EBADFAMILY',
  'EBADRESP',
  'ECONNREFUSED',
  'ETIMEOUT',
  'EOF',
  'EFILE',
  'ENOMEM',
  'EDESTRUCTION',
  'EBADSTR',
  'EBADFLAGS',
  'ENONAME',
  'EBADHINTS',
  'ENOTINITIALIZED',
  'ELOADIPHLPAPI',
  'EADDRGETNETWORKPARAMS',
  'ECANCELLED',
  'EAI_AGAIN',
]);
const resultCodes = new Set([...codes, 'RESOLVED', 'EMPTY', 'INVALID_RESULT', 'UNKNOWN']);

export function diagnosticEnvironment(environment) {
  return Object.fromEntries(
    osNames.flatMap((name) => (typeof environment[name] === 'string' ? [[name, environment[name]]] : [])),
  );
}

// Exactly one query for each family and one OS-resolver comparison. No API,
// socket-to-instance, credential read, resolver mutation or address output.
export async function checkDns({ Resolver = NativeResolver, lookup = nativeLookup } = {}) {
  const resolver = new Resolver({ timeout: 10_000, tries: 1 });
  const outcome = async (operation, os = false) => {
    try {
      const answer = await operation();
      if (
        !Array.isArray(answer) ||
        !answer.every((entry) =>
          os
            ? entry && typeof entry.address === 'string' && [4, 6].includes(entry.family)
            : typeof entry === 'string',
        )
      )
        return { success: false, code: 'INVALID_RESULT' };
      return { success: answer.length > 0, code: answer.length > 0 ? 'RESOLVED' : 'EMPTY' };
    } catch (error) {
      return { success: false, code: codes.has(error?.code) ? error.code : 'UNKNOWN' };
    }
  };
  try {
    const [resolve4, resolve6, osLookup] = await Promise.all([
      outcome(() => resolver.resolve4(host)),
      outcome(() => resolver.resolve6(host)),
      outcome(() => lookup(host, { all: true }), true),
    ]);
    return { resolve4, resolve6, osLookup };
  } finally {
    resolver.cancel();
  }
}

function validResults(value) {
  return (
    value &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join(',') === 'osLookup,resolve4,resolve6' &&
    Object.values(value).every(
      (row) =>
        row &&
        !Array.isArray(row) &&
        Object.keys(row).sort().join(',') === 'code,success' &&
        typeof row.success === 'boolean' &&
        resultCodes.has(row.code),
    )
  );
}

const ownPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === resolve(ownPath)) {
  if (process.argv.length === 3 && process.argv[2] === '--dns-child') {
    const results = await checkDns();
    process.stdout.write(JSON.stringify(results) + '\n');
  } else if (process.argv.length !== 2) {
    process.stdout.write(JSON.stringify({ status: 'DNS_ARGUMENT_REJECTED', success: false }) + '\n');
    process.exitCode = 1;
  } else {
    const child = spawnSync(process.execPath, [ownPath, '--dns-child'], {
      env: diagnosticEnvironment(process.env),
      windowsHide: true,
      timeout: 15_000,
      killSignal: 'SIGKILL',
      maxBuffer: 8192,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    let results = null;
    try {
      results = JSON.parse(child.stdout);
    } catch {
      /* fixed outcome only */
    }
    const success = !child.error && child.status === 0 && validResults(results);
    process.stdout.write(
      JSON.stringify({
        status: success
          ? 'DNS_CHECK_COMPLETE'
          : child.error?.code === 'ETIMEDOUT'
            ? 'DNS_CHILD_TIMEOUT'
            : 'DNS_CHILD_FAILED',
        success,
        results: success ? results : null,
        credentialSupplied: false,
        apiRequests: 0,
      }) + '\n',
    );
    process.exitCode = success ? 0 : 1;
  }
}
