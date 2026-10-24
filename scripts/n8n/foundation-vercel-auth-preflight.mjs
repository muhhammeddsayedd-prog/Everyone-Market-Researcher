import * as fs from 'node:fs';
import { fork as nativeFork } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, isAbsolute, join, resolve, win32 } from 'node:path';
import { fileURLToPath } from 'node:url';
import { foundationSetupVercelPins } from './foundation-live-setup-no-retry.mjs';

// Derived only from pinned public CLI sources: cli-config.js113-127,
// xdg-app-paths/src/lib/index.js116-118 and xdg-portable/src/lib/index.js69-72.
// No resolver, CLI module, keyring, legacy-directory search or refresh is used.
export const foundationVercelAuthMetadataContract = Object.freeze({
  profile: 'C:\\Users\\iway',
  appData: 'C:\\Users\\iway\\AppData\\Roaming',
  cliRoot: 'C:\\Users\\iway\\AppData\\Roaming\\npm\\node_modules\\vercel',
  authPath: 'C:\\Users\\iway\\AppData\\Roaming\\xdg.data\\com.vercel.cli\\auth.json',
  nodePath: 'C:\\Program Files\\nodejs\\node.exe',
  nodeSha256: '9a4eb5f1c29c6a2e93852ead46b999e284a6a5ca8bab4d4e241d587d025a52de',
  maximumBytes: 65536,
  coverageMilliseconds: 4500000,
});
const c = foundationVercelAuthMetadataContract;
const statuses = new Set([
  'metadata_covers_75_minutes',
  'saved_auth_expired',
  'saved_auth_insufficient_coverage',
  'saved_auth_expiry_unavailable',
  'saved_auth_missing',
  'saved_auth_invalid',
  'path_blocked',
  'public_inputs_blocked',
  'child_failed',
]);
const projection = (status, metadataValid = false, unexpired = false, covers75Minutes = false) =>
  Object.freeze({
    kind: 'm03_vercel_saved_auth_metadata',
    status,
    metadataValid,
    unexpired,
    covers75Minutes,
    // A fixed auth.json can be stale or superseded by legacy/keyring selection.
    // Declared expiry also cannot establish remote authentication or permissions.
    effectiveBackendEstablished: false,
    networkRequests: 0,
    authenticationAttempted: false,
    refreshAttempted: false,
    configWritten: false,
  });
export function classifyFoundationVercelAuthMetadata(auth, { now = Date.now } = {}) {
  try {
    const time = now();
    if (!Number.isSafeInteger(time) || time < 0) return projection('saved_auth_invalid');
    if (auth === undefined) return projection('saved_auth_missing');
    if (auth === null || typeof auth !== 'object' || Array.isArray(auth))
      return projection('saved_auth_invalid');
    for (const name of ['token', 'refreshToken', 'userId', '// Note', '// Docs'])
      if (auth[name] !== undefined && typeof auth[name] !== 'string') return projection('saved_auth_invalid');
    if (
      (auth.skipWrite !== undefined && typeof auth.skipWrite !== 'boolean') ||
      (auth.tokenSource !== undefined && !['flag', 'env'].includes(auth.tokenSource)) ||
      (auth.expiresAt !== undefined &&
        (typeof auth.expiresAt !== 'number' || !Number.isFinite(auth.expiresAt)))
    )
      return projection('saved_auth_invalid');
    if (typeof auth.token !== 'string' || !auth.token) return projection('saved_auth_missing');
    if (auth.expiresAt === undefined) return projection('saved_auth_expiry_unavailable', true);
    // The no-retry preload uses strict seconds > Date.now()/1000. No JWT decode,
    // refresh attempts, token fingerprint, token length or token output.
    if (auth.expiresAt <= time / 1000) return projection('saved_auth_expired', true);
    const covers = auth.expiresAt >= (time + c.coverageMilliseconds) / 1000;
    return projection(
      covers ? 'metadata_covers_75_minutes' : 'saved_auth_insufficient_coverage',
      true,
      true,
      covers,
    );
  } catch {
    return projection('saved_auth_invalid');
  }
}
function ordinary(path, io) {
  let leaf;
  for (let cursor = resolve(path); ; cursor = dirname(cursor)) {
    const stat = io.lstatSync(cursor);
    if (stat.isSymbolicLink() || (cursor !== resolve(path) && !stat.isDirectory())) throw Error('blocked');
    if (cursor === resolve(path)) leaf = stat;
    if (dirname(cursor) === cursor) break;
  }
  if (!leaf.isFile() || leaf.nlink !== 1 || !Number.isSafeInteger(leaf.size) || leaf.size < 0)
    throw Error('blocked');
  return leaf;
}
const same = (a, b) =>
  a.isFile() &&
  b.isFile() &&
  a.dev === b.dev &&
  a.ino === b.ino &&
  a.size === b.size &&
  a.mtimeMs === b.mtimeMs &&
  a.nlink === 1 &&
  b.nlink === 1;
// authPath/io are explicit synthetic-test seams. The production child supplies
// neither: its only readable saved file is the fixed reviewed Windows path.
export function readFoundationVercelAuthMetadata(options = {}, dependencies = {}) {
  const io = {
    lstatSync: fs.lstatSync,
    openSync: fs.openSync,
    fstatSync: fs.fstatSync,
    readSync: fs.readSync,
    closeSync: fs.closeSync,
    ...dependencies.io,
  };
  const path = dependencies.authPath ?? c.authPath;
  let descriptor, bytes;
  try {
    if (typeof path !== 'string' || !isAbsolute(path)) return projection('path_blocked');
    const before = ordinary(path, io);
    if (before.size > c.maximumBytes) return projection('path_blocked');
    descriptor = io.openSync(path, 'r');
    if (!same(before, io.fstatSync(descriptor))) return projection('path_blocked');
    bytes = Buffer.alloc(c.maximumBytes + 1);
    let offset = 0;
    while (offset < bytes.length) {
      const count = io.readSync(descriptor, bytes, offset, bytes.length - offset, null);
      if (!Number.isSafeInteger(count) || count < 0 || count > bytes.length - offset)
        return projection('path_blocked');
      if (!count) break;
      offset += count;
    }
    if (
      offset > c.maximumBytes ||
      offset !== before.size ||
      !same(before, io.fstatSync(descriptor)) ||
      !same(before, ordinary(path, io))
    )
      return projection('path_blocked');
    let auth;
    try {
      auth = JSON.parse(
        new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
          .decode(bytes.subarray(0, offset))
          .replace(/^\uFEFF/, ''),
      );
    } catch {
      return projection('saved_auth_invalid');
    }
    return classifyFoundationVercelAuthMetadata(auth, options);
  } catch (error) {
    return projection(error?.code === 'ENOENT' ? 'saved_auth_missing' : 'path_blocked');
  } finally {
    if (descriptor !== undefined) {
      try {
        io.closeSync(descriptor);
      } catch {}
    }
    bytes?.fill(0);
  }
}
const sourcePins = Object.freeze({
  ...foundationSetupVercelPins,
  'node_modules/@vercel/cli-config/dist/cli-config.js':
    'be77135e372c3820edaf00b4ddaea273b6a5304a563c5642b691662baf078cf6',
  'node_modules/@vercel/cli-config/dist/schema.zod.js':
    'dfa315d3dcc717158b7f006d4d88649e8f61935ae6b4c3ec678d849716832bcc',
  'node_modules/xdg-app-paths/src/lib/index.js':
    '914c0b5866594b1bd5b89da6382d95721a4b14cc4a5325701a8c1222cc34baa7',
  'node_modules/xdg-portable/src/lib/index.js':
    '9a40fa9e6ce53baff8ef2f2560970b5cfc4cbb32f01c3581fa7b31c36accabbe',
});
function publicInputs() {
  const equivalent = (a, b) =>
    typeof a === 'string' && win32.resolve(a).toLowerCase() === win32.resolve(b).toLowerCase();
  if (
    process.platform !== 'win32' ||
    !equivalent(process.env.USERPROFILE, c.profile) ||
    !equivalent(process.env.APPDATA, c.appData) ||
    !equivalent(process.execPath, c.nodePath)
  )
    return false;
  try {
    for (const [path, expected, maximum] of [
      [c.nodePath, c.nodeSha256, 134217728],
      ...Object.entries(sourcePins).map(([relative, hash]) => [join(c.cliRoot, relative), hash, 5242880]),
    ]) {
      const before = ordinary(path, fs);
      if (
        before.size > maximum ||
        createHash('sha256').update(fs.readFileSync(path)).digest('hex') !== expected ||
        !same(before, ordinary(path, fs))
      )
        return false;
    }
    return true;
  } catch {
    return false;
  }
}
const valid = (value) => {
  if (
    !value ||
    Object.keys(value).length !== 10 ||
    value.kind !== 'm03_vercel_saved_auth_metadata' ||
    !statuses.has(value.status) ||
    value.effectiveBackendEstablished !== false ||
    value.networkRequests !== 0 ||
    value.authenticationAttempted !== false ||
    value.refreshAttempted !== false ||
    value.configWritten !== false
  )
    return false;
  const expected =
    value.status === 'metadata_covers_75_minutes'
      ? [true, true, true]
      : value.status === 'saved_auth_insufficient_coverage'
        ? [true, true, false]
        : ['saved_auth_expired', 'saved_auth_expiry_unavailable'].includes(value.status)
          ? [true, false, false]
          : [false, false, false];
  return ['metadataValid', 'unexpired', 'covers75Minutes'].every((k, i) => value[k] === expected[i]);
};
export function runFoundationVercelAuthPreflight({
  fork = nativeFork,
  timeoutMs = 5000,
  verifyPublicInputs = publicInputs,
} = {}) {
  if (
    typeof fork !== 'function' ||
    typeof verifyPublicInputs !== 'function' ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs <= 0 ||
    timeoutMs > 5000
  )
    return Promise.resolve(Object.freeze({ ...projection('child_failed'), childClosed: true }));
  try {
    if (!verifyPublicInputs())
      return Promise.resolve(Object.freeze({ ...projection('public_inputs_blocked'), childClosed: true }));
  } catch {
    return Promise.resolve(Object.freeze({ ...projection('public_inputs_blocked'), childClosed: true }));
  }
  return new Promise((done) => {
    let child,
      timer,
      finalTimer,
      receipt,
      messages = 0,
      failed = false,
      finished = false;
    const finish = (closed) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      clearTimeout(finalTimer);
      done(
        Object.freeze({
          ...(closed && !failed && receipt ? receipt : projection('child_failed')),
          childClosed: closed,
        }),
      );
    };
    const stop = () => {
      failed = true;
      try {
        child.kill();
      } catch {}
      finalTimer ??= setTimeout(() => finish(false), 1000);
    };
    try {
      child = fork(fileURLToPath(import.meta.url), ['--metadata-child'], {
        execPath: c.nodePath,
        execArgv: [],
        windowsHide: true,
        stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
        env: Object.fromEntries(
          ['SystemRoot', 'WINDIR', 'TEMP', 'TMP']
            .flatMap((k) => (process.env[k] === undefined ? [] : [[k, process.env[k]]]))
            .concat([
              ['USERPROFILE', c.profile],
              ['APPDATA', c.appData],
            ]),
        ),
      });
      child.on('message', (value) => {
        if (++messages !== 1 || !valid(value)) stop();
        else receipt = Object.freeze(value);
      });
      child.once('error', stop);
      child.once('close', (code, signal) => {
        if (code !== 0 || signal) failed = true;
        finish(true);
      });
      timer = setTimeout(stop, timeoutMs);
    } catch {
      failed = true;
      finish(true);
    }
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (
    process.argv.length === 3 &&
    process.argv[2] === '--metadata-child' &&
    typeof process.send === 'function' &&
    process.connected
  ) {
    const result = publicInputs() ? readFoundationVercelAuthMetadata() : projection('public_inputs_blocked');
    process.send(result, () => process.disconnect());
  } else if (process.argv.length === 3 && process.argv[2] === 'InspectSavedMetadata') {
    const result = await runFoundationVercelAuthPreflight();
    process.stdout.write(JSON.stringify(result) + '\n');
    process.exitCode = result.childClosed && result.covers75Minutes ? 0 : 2;
  } else {
    process.stdout.write(
      JSON.stringify({ ...projection('public_inputs_blocked'), childClosed: true }) + '\n',
    );
    process.exitCode = 1;
  }
}
