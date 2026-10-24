import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const modulePath = new URL('./gw01-vercel-no-retry.mjs', import.meta.url);
const sha = (value) => createHash('sha256').update(value).digest('hex');
test('pinned preloader module provides a closed no-retry install seam', async () => {
  const { installNoRetry } = await import(modulePath.href);
  const calls = [];
  class Client {
    fetch(url, options = {}) {
      calls.push({ owner: this, url, options });
      return Promise.resolve('fixed');
    }
  }
  installNoRetry(Client);
  const client = new Client();
  assert.equal(
    await client.fetch('/fixed', { retry: { retries: 99 }, bailOn429: false, body: { public: true } }),
    'fixed',
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].owner, client);
  assert.deepEqual(calls[0].options.retry, { retries: 0 });
  assert.equal(calls[0].options.bailOn429, true);
  assert.deepEqual(calls[0].options.body, { public: true });
  const descriptor = Object.getOwnPropertyDescriptor(Client.prototype, 'fetch');
  assert.equal(descriptor.writable, false);
  assert.equal(descriptor.configurable, false);
  assert.throws(() => {
    Client.prototype.fetch = () => {};
  }, TypeError);
});
test('preloader refuses missing or incompatible public Client export', async () => {
  const { installNoRetry } = await import(modulePath.href);
  for (const candidate of [
    null,
    {},
    class Client {},
    class Client {
      fetch() {}
    },
  ])
    assert.throws(() => installNoRetry(candidate), /^Error: GW01_VERCEL_NO_RETRY_REJECTED$/);
});
for (const mode of ['network', '503', '429'])
  test('actual synthetic --import applies no-retry before main CLI for ' + mode, () => {
    const root = mkdtempSync(join(tmpdir(), 'emr-no-retry-'));
    try {
      const appdata = join(root, 'appdata'),
        runtime = join(appdata, 'npm/node_modules/vercel');
      const client = `export class Client {
      async retry(fn,{retries=3}={}) { for(let retry=0;;retry++) { try { return await fn(error=>{error.bail=true;throw error;}); } catch(error) { if(error.bail||retry>=retries)throw error; } } }
      async fetch(url, opts = {}) { return this.retry(async bail=>{
        globalThis.attempts=(globalThis.attempts??0)+1;globalThis.bail=opts.bailOn429;
        if('${mode}'==='network')throw Error('SYNTHETIC_NETWORK');
        const error=Error('SYNTHETIC_STATUS');
        if('${mode}'==='429'&&opts.bailOn429)return bail(error);
        throw error;
      },opts.retry); }
    }`;
      const entry = `import {Client} from './chunks/chunk-3BHSS5E2.js';const c=new Client();try{await c.fetch('/fixed',{retry:{retries:7},bailOn429:false});}catch{}process.stdout.write(JSON.stringify({attempts:globalThis.attempts,bail:globalThis.bail}));`;
      const pkg = JSON.stringify({ version: '56.5.0', type: 'module' });
      const put = (path, text) => {
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, text);
      };
      put(join(runtime, 'package.json'), pkg);
      put(join(runtime, 'dist/index.js'), entry);
      put(join(runtime, 'dist/chunks/chunk-3BHSS5E2.js'), client);
      let source = readFileSync(modulePath, 'utf8');
      const replacements = [
        ['a879c88b917b50a1bf2e46c8b6e0d0fdc12c2454db4764af1e86428280081a18', sha(pkg)],
        ['826a86d9e4952d31b4f94dacc12ce9dbe6c2988a17f04b2ba4d1d65a44e5991d', sha(client)],
        ['59b3fc5480456b92d33bdb463a9c8c847669bb53627364e58f7f82236dbcd804', sha(entry)],
      ];
      for (const [before, after] of replacements) {
        assert.equal(source.split(before).length, 2);
        source = source.replace(before, after);
      }
      const preload = join(root, 'preload.mjs');
      put(preload, source);
      const original = spawnSync(process.execPath, [join(runtime, 'dist/index.js')], {
        env: { APPDATA: appdata },
        encoding: 'utf8',
        timeout: 3000,
      });
      assert.equal(original.status, 0, original.stderr);
      assert.deepEqual(JSON.parse(original.stdout), { attempts: 8, bail: false });
      const r = spawnSync(
        process.execPath,
        ['--import', pathToFileURL(preload).href, join(runtime, 'dist/index.js')],
        { env: { APPDATA: appdata }, encoding: 'utf8', timeout: 3000 },
      );
      assert.equal(r.status, 0, r.stderr);
      assert.deepEqual(JSON.parse(r.stdout), { attempts: 1, bail: true });
      put(join(runtime, 'dist/chunks/chunk-3BHSS5E2.js'), client + '\n// unreviewed');
      const blocked = spawnSync(
        process.execPath,
        ['--import', pathToFileURL(preload).href, join(runtime, 'dist/index.js')],
        { env: { APPDATA: appdata }, encoding: 'utf8', timeout: 3000 },
      );
      assert.equal(blocked.status, 1);
      assert.equal(blocked.stdout, '');
      assert.equal(blocked.stderr.trim(), 'GW01_VERCEL_NO_RETRY_REJECTED');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
