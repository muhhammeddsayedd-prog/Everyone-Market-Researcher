import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import http from 'node:http';
import https from 'node:https';
import { syncBuiltinESMExports } from 'node:module';
// Pinned Vercel56.5.0 native Client.fetch defaults to3 retries. This new owned
// child disables retry/429 replay without modifying the installed CLI or auth.
export const foundationSetupVercelPins = Object.freeze({
  'package.json': 'a879c88b917b50a1bf2e46c8b6e0d0fdc12c2454db4764af1e86428280081a18',
  'dist/chunks/chunk-3BHSS5E2.js': '826a86d9e4952d31b4f94dacc12ce9dbe6c2988a17f04b2ba4d1d65a44e5991d',
  'dist/index.js': '59b3fc5480456b92d33bdb463a9c8c847669bb53627364e58f7f82236dbcd804',
});
const pins = foundationSetupVercelPins;
const fail = () => {
  throw Error('FOUNDATION_LIVE_SETUP_NO_RETRY_BLOCKED');
};
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
      fail();
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
      Object.defineProperty(module, name, { value: fail, configurable: false, writable: false });
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
  let consumed = false;
  Object.defineProperty(Client.prototype, 'fetch', {
    value: function fetch(url, opts = {}) {
      if (consumed || !requestMatches(expected, url, opts.method ?? 'GET')) {
        consumed = true;
        fail();
      }
      consumed = true;
      return original.call(this, url, {
        ...opts,
        retry: { retries: 0 },
        bailOn429: true,
        useCurrentTeam: false,
        accountId: undefined,
        redirect: 'manual',
      });
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
      if (
        !auth ||
        typeof auth.token !== 'string' ||
        !auth.token ||
        (auth.expiresAt !== undefined &&
          (typeof auth.expiresAt !== 'number' || auth.expiresAt <= Date.now() / 1000))
      )
        fail();
    },
    writable: false,
    configurable: false,
  });
  Object.defineProperty(Client.prototype, 'reauthenticate', {
    value: async function reauthenticate() {
      fail();
    },
    writable: false,
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
    process.stderr.write('FOUNDATION_LIVE_SETUP_NO_RETRY_BLOCKED\n');
    process.exit(1);
  }
}
