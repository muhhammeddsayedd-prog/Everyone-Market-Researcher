import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Vercel 56.5.0 Client.fetch passes opts.retry to retry(), whose default is 3.
// The api command supplies no override. Scope the documented FetchOptions to
// this one owned child; leave installed files, authentication and globals alone.
// https://raw.githubusercontent.com/vercel/vercel/vercel@56.5.0/packages/cli/src/util/client.ts
const pins = {
  'package.json': 'a879c88b917b50a1bf2e46c8b6e0d0fdc12c2454db4764af1e86428280081a18',
  'dist/chunks/chunk-3BHSS5E2.js': '826a86d9e4952d31b4f94dacc12ce9dbe6c2988a17f04b2ba4d1d65a44e5991d',
  'dist/index.js': '59b3fc5480456b92d33bdb463a9c8c847669bb53627364e58f7f82236dbcd804',
};
const fail = () => {
  throw Error('GW01_VERCEL_NO_RETRY_REJECTED');
};

/** Pure installation seam for local synthetic tests; the preload entry below
 * accepts no alternate module, pin, runtime path, credential or policy input. */
export function installNoRetry(Client) {
  const descriptor =
    typeof Client === 'function' && Object.getOwnPropertyDescriptor(Client.prototype, 'fetch');
  if (
    !descriptor ||
    typeof descriptor.value !== 'function' ||
    descriptor.value.name !== 'fetch' ||
    descriptor.value.length !== 1 ||
    descriptor.writable !== true ||
    descriptor.configurable !== true
  )
    fail();
  const original = descriptor.value;
  Object.defineProperty(Client.prototype, 'fetch', {
    value: function fetch(url, opts = {}) {
      return original.call(this, url, { ...opts, retry: { retries: 0 }, bailOn429: true });
    },
    enumerable: descriptor.enumerable,
    configurable: false,
    writable: false,
  });
}
function physical(path) {
  let cursor = resolve(path);
  for (;;) {
    if (lstatSync(cursor).isSymbolicLink()) fail();
    const parent = dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.size > 5242880) fail();
  return readFileSync(path);
}
async function preload() {
  if (typeof process.env.APPDATA !== 'string' || !process.env.APPDATA) fail();
  const runtime = resolve(process.env.APPDATA, 'npm/node_modules/vercel');
  if (!process.argv[1] || resolve(process.argv[1]) !== join(runtime, 'dist/index.js')) fail();
  let pkg;
  for (const [relative, expected] of Object.entries(pins)) {
    const bytes = physical(join(runtime, relative));
    if (createHash('sha256').update(bytes).digest('hex') !== expected) fail();
    if (relative === 'package.json') pkg = JSON.parse(bytes.toString('utf8'));
  }
  if (pkg?.version !== '56.5.0') fail();
  const { Client } = await import(pathToFileURL(join(runtime, 'dist/chunks/chunk-3BHSS5E2.js')).href);
  installNoRetry(Client);
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
    process.stderr.write('GW01_VERCEL_NO_RETRY_REJECTED\n');
    process.exit(1);
  }
}
