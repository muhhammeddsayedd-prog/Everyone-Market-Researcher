import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { syncBuiltinESMExports } from 'node:module';
// Pinned Vercel56.5.0 native Client.fetch defaults to3 retries. This new owned
// child disables retry/429 replay without modifying the installed CLI or auth.
export const foundationSetupVercelPins = Object.freeze({
  'package.json': 'a879c88b917b50a1bf2e46c8b6e0d0fdc12c2454db4764af1e86428280081a18',
  'dist/chunks/chunk-3BHSS5E2.js': '826a86d9e4952d31b4f94dacc12ce9dbe6c2988a17f04b2ba4d1d65a44e5991d',
  'dist/index.js': '59b3fc5480456b92d33bdb463a9c8c847669bb53627364e58f7f82236dbcd804',
  'node_modules/@vercel/cli-auth/credentials-store.js':
    'd73a973fd94a4abb2b8ffe3b2094349c84f96d15308d8dee1f4c22f26d5c4674',
});
const pins = foundationSetupVercelPins;
const fail = () => {
  throw Error('FOUNDATION_LIVE_SETUP_NO_RETRY_BLOCKED');
};
const classifiedFail = (code) => {
  throw Error('FOUNDATION_LIVE_SETUP_NO_RETRY_BLOCKED:' + code);
};
// CLI telemetry touches session/device state even when collection is disabled.
// This owned child may read existing storage but cannot create/migrate/update
// local config, credentials, telemetry or any other file. mkdir(existingDir)
// is an inert bootstrap check; a missing directory is not created.
export function installFoundationSetupReadOnlyFiles() {
  const deny = () => classifiedFail('local_write_refused');
  const originalStat = fs.lstatSync;
  const existing = (path) => {
    const st = originalStat(path);
    if (!st.isDirectory() || st.isSymbolicLink()) deny();
  };
  const seal = (target, name, value) =>
    Object.defineProperty(target, name, {
      get: () => value,
      set() {},
      configurable: false,
    });
  for (const name of [
    'writeFile',
    'writeFileSync',
    'appendFile',
    'appendFileSync',
    'write',
    'writeSync',
    'writev',
    'writevSync',
    'rename',
    'renameSync',
    'unlink',
    'unlinkSync',
    'rm',
    'rmSync',
    'rmdir',
    'rmdirSync',
    'link',
    'linkSync',
    'symlink',
    'symlinkSync',
    'chmod',
    'chmodSync',
    'fchmod',
    'fchmodSync',
    'chown',
    'chownSync',
    'fchown',
    'fchownSync',
    'utimes',
    'utimesSync',
    'futimes',
    'futimesSync',
    'truncate',
    'truncateSync',
    'ftruncate',
    'ftruncateSync',
    'copyFile',
    'copyFileSync',
    'cp',
    'cpSync',
    'mkdtemp',
    'mkdtempSync',
    'createWriteStream',
  ])
    if (typeof fs[name] === 'function') seal(fs, name, deny);
  seal(fs, 'mkdirSync', (path) => {
    existing(path);
  });
  seal(fs, 'mkdir', (path, ...args) => {
    const callback = args.at(-1);
    if (typeof callback !== 'function') deny();
    try {
      existing(path);
      process.nextTick(callback, null);
    } catch {
      process.nextTick(callback, Error('FOUNDATION_LIVE_SETUP_NO_RETRY_BLOCKED:local_write_refused'));
    }
  });
  const readFlags = (flags) =>
    flags === undefined || flags === 'r' || flags === 'rs' || flags === 'sr' || flags === 0;
  for (const name of ['open', 'openSync']) {
    const original = fs[name];
    seal(fs, name, (path, flags, ...args) => {
      if (!readFlags(flags)) deny();
      return original(path, flags, ...args);
    });
  }
  for (const name of [
    'writeFile',
    'appendFile',
    'rename',
    'unlink',
    'rm',
    'rmdir',
    'link',
    'symlink',
    'chmod',
    'chown',
    'utimes',
    'truncate',
    'copyFile',
    'cp',
    'mkdtemp',
  ])
    if (typeof fs.promises[name] === 'function') seal(fs.promises, name, async () => deny());
  seal(fs.promises, 'mkdir', async (path) => {
    existing(path);
  });
  const open = fs.promises.open.bind(fs.promises);
  seal(fs.promises, 'open', async (path, flags, ...args) => {
    if (!readFlags(flags)) deny();
    return open(path, flags, ...args);
  });
  syncBuiltinESMExports();
}
// The pinned credentials resolver can migrate backends during get(). Its
// child-only loader retains getPassword and refuses set/delete before the
// native keyring implementation receives any mutation. No token is exported.
export function installFoundationSetupReadOnlyKeyring(auth, load) {
  if (typeof auth?.setLoadKeyringModuleForTesting !== 'function' || typeof load !== 'function') fail();
  auth.setLoadKeyringModuleForTesting(() => {
    const module = load();
    if (typeof module?.Entry !== 'function') classifiedFail('credential_storage_unsupported');
    return Object.freeze({
      Entry: class {
        #entry;
        constructor(...args) {
          this.#entry = new module.Entry(...args);
        }
        getPassword() {
          return this.#entry.getPassword();
        }
        setPassword() {
          classifiedFail('credential_storage_write_refused');
        }
        deleteCredential() {
          classifiedFail('credential_storage_write_refused');
        }
      },
    });
  });
}
function requestMatches(expected, url, method) {
  try {
    const resolved = new URL(url, 'https://api.vercel.com');
    return (
      resolved.origin === 'https://api.vercel.com' &&
      !resolved.username &&
      !resolved.password &&
      !resolved.hash &&
      resolved.pathname + resolved.search === expected.path &&
      method === expected.method
    );
  } catch {
    return false;
  }
}
export function createFoundationSetupWireGuard(expected, perform) {
  if (!expected || typeof perform !== 'function') fail();
  let consumed = false;
  return function guardedFetch(url, options = {}) {
    if (
      consumed ||
      !requestMatches(
        expected,
        url instanceof Request ? url.url : url,
        options.method ?? (url instanceof Request ? url.method : 'GET'),
      )
    ) {
      consumed = true;
      classifiedFail('auxiliary_scope_refusal');
    }
    consumed = true;
    return perform(url, { ...options, redirect: 'manual' });
  };
}
export function installFoundationSetupWireFence(expected) {
  Object.defineProperty(globalThis, 'fetch', {
    value: createFoundationSetupWireGuard(expected, globalThis.fetch),
    configurable: false,
    writable: false,
  });
  for (const module of [http, https])
    for (const name of ['request', 'get'])
      Object.defineProperty(module, name, {
        get: () => fail,
        // Pinned Sentry assigns instrumentation wrappers during CLI bootstrap.
        // Accept that assignment without installing or executing its wrapper.
        set() {},
        configurable: false,
      });
  syncBuiltinESMExports();
}
export function installFoundationSetupNoRetry(Client, expected) {
  if (
    !expected ||
    !['GET', 'POST', 'PATCH', 'DELETE'].includes(expected.method) ||
    typeof expected.path !== 'string' ||
    !expected.path.startsWith('/v') ||
    new URL(expected.path, 'https://api.vercel.com').origin !== 'https://api.vercel.com'
  )
    fail();
  const d = typeof Client === 'function' && Object.getOwnPropertyDescriptor(Client.prototype, 'fetch');
  if (
    !d ||
    typeof d.value !== 'function' ||
    d.value.name !== 'fetch' ||
    d.value.length !== 1 ||
    d.writable !== true ||
    d.configurable !== true
  )
    fail();
  const original = d.value;
  const projectHttpFailure = (error) => {
    // Native Client.fetch consumes non-2xx responses and throws before the API
    // command's --include formatting. Preserve only its numeric HTTP status.
    if (Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599)
      classifiedFail('http_status_' + error.status);
    throw error;
  };
  let consumed = false;
  Object.defineProperty(Client.prototype, 'fetch', {
    value: function fetch(url, opts = {}) {
      if (consumed || !requestMatches(expected, url, opts.method ?? 'GET')) {
        consumed = true;
        classifiedFail('auxiliary_scope_refusal');
      }
      consumed = true;
      try {
        const result = original.call(this, url, {
          ...opts,
          retry: { retries: 0 },
          bailOn429: true,
          useCurrentTeam: false,
          accountId: undefined,
          redirect: 'manual',
        });
        return result && typeof result.then === 'function'
          ? Promise.resolve(result).catch(projectHttpFailure)
          : result;
      } catch (error) {
        return projectHttpFailure(error);
      }
    },
    enumerable: d.enumerable,
    writable: false,
    configurable: false,
  });
  // Native ensureAuthorized may refresh OAuth outside Client.fetch. This child
  // uses only an already-valid saved session; it never changes auth state.
  Object.defineProperty(Client.prototype, 'ensureAuthorized', {
    value: async function ensureAuthorized() {
      const auth = this.authConfig;
      if (!auth || typeof auth.token !== 'string' || !auth.token) classifiedFail('saved_auth_missing');
      if (auth.expiresAt !== undefined) {
        if (typeof auth.expiresAt !== 'number' || !Number.isFinite(auth.expiresAt))
          classifiedFail('saved_auth_invalid_expiry');
        if (auth.expiresAt <= Date.now() / 1000) classifiedFail('saved_auth_expired');
      }
    },
    writable: false,
    configurable: false,
  });
  Object.defineProperty(Client.prototype, 'reauthenticate', {
    get: () =>
      async function reauthenticate() {
        classifiedFail('auth_refresh_refused');
      },
    set() {
      // Pinned Client's constructor creates this own field unconditionally.
      // Discard its refresh implementation and seal the instance refusal.
      Object.defineProperty(this, 'reauthenticate', {
        value: async function reauthenticate() {
          classifiedFail('auth_refresh_refused');
        },
        writable: false,
        configurable: false,
      });
    },
    configurable: false,
  });
}
async function preload() {
  if (typeof process.env.APPDATA !== 'string' || !process.env.APPDATA) fail();
  const root = resolve(process.env.APPDATA, 'npm/node_modules/vercel');
  if (!process.argv[1] || resolve(process.argv[1]) !== join(root, 'dist/index.js')) fail();
  for (const [name, hash] of Object.entries(pins)) {
    const path = join(root, name);
    let cursor = path;
    for (;;) {
      if (lstatSync(cursor).isSymbolicLink()) fail();
      const parent = dirname(cursor);
      if (parent === cursor) break;
      cursor = parent;
    }
    const st = lstatSync(path);
    if (
      !st.isFile() ||
      st.size > 5242880 ||
      createHash('sha256').update(readFileSync(path)).digest('hex') !== hash
    )
      fail();
  }
  const expected = {
    method: process.env.EMR_FOUNDATION_SETUP_METHOD,
    path: process.env.EMR_FOUNDATION_SETUP_PATH,
  };
  // CLI util/fetch delegates to globalThis.fetch. This wire fence also blocks
  // auxiliary OAuth/Sentry calls that do not use Client.fetch. Legacy native
  // http(s) requests have no authorized purpose in this child.
  installFoundationSetupWireFence(expected);
  installFoundationSetupReadOnlyFiles();
  const require = createRequire(join(root, 'package.json'));
  const auth = require('@vercel/cli-auth/credentials-store');
  installFoundationSetupReadOnlyKeyring(auth, () => require('@napi-rs/keyring'));
  const { Client } = await import(pathToFileURL(join(root, 'dist/chunks/chunk-3BHSS5E2.js')).href);
  installFoundationSetupNoRetry(Client, expected);
}
const requested = process.execArgv.some((arg, i, args) => {
  const candidate = arg === '--import' ? args[i + 1] : arg.startsWith('--import=') ? arg.slice(9) : null;
  if (typeof candidate !== 'string') return false;
  try {
    return (
      (candidate.startsWith('file:') ? fileURLToPath(candidate) : resolve(candidate)) ===
      fileURLToPath(import.meta.url)
    );
  } catch {
    return false;
  }
});
if (requested) {
  try {
    await preload();
  } catch {
    process.stderr.write('FOUNDATION_LIVE_SETUP_NO_RETRY_BLOCKED:no_retry_bootstrap\n');
    process.exit(1);
  }
}
