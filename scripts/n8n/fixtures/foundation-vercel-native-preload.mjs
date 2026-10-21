// Test-only: actual CLI bootstraps against synthetic auth and a fake fetch.
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import dns from 'node:dns';
import { resolve, sep, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import Module, { syncBuiltinESMExports } from 'node:module';

if (process.env.EMR_SYNTHETIC_VERCEL !== 'isolated-no-network') throw Error('SYNTHETIC_ONLY');
const root = resolve(process.env.EMR_SYNTHETIC_VERCEL_ROOT),
  cliRoot = resolve(process.env.APPDATA, 'npm/node_modules/vercel'),
  repo = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const originalWrite = fs.writeFileSync;
const facts = {
  fetchCalls: 0,
  matchingAuthorization: false,
  blockedNetwork: 0,
  blockedFileAccess: 0,
  blockedFileKind: null,
  blockedKeyringLoads: 0,
};
const fixed = () => {
  throw Error('SYNTHETIC_NETWORK_OR_FILE_DENIED');
};
// The positive native cases use only the owned synthetic auth.json. Make an
// accidental resolver/keyring fallback fail before any native credential read.
const originalLoad = Module._load;
Module._load = function (request, ...args) {
  if (typeof request === 'string' && request.replaceAll('\\', '/').includes('@napi-rs/keyring')) {
    facts.blockedKeyringLoads++;
    throw Error('SYNTHETIC_KEYRING_LOAD_DENIED');
  }
  return originalLoad.call(this, request, ...args);
};
const permitted = (value, write = false) => {
  const path = resolve(value instanceof URL ? fileURLToPath(value) : String(value));
  const roots = write ? [root] : [root, cliRoot, repo];
  if (!roots.some((p) => path === p || path.startsWith(p + sep))) {
    facts.blockedFileAccess++;
    facts.blockedFileKind = ['package.json', 'auth.json', 'config.json'].includes(basename(path))
      ? basename(path)
      : 'other';
    fixed();
  }
};
for (const name of ['readFileSync', 'readFile']) {
  const original = fs[name];
  fs[name] = function (path, ...args) {
    permitted(path);
    return original.call(this, path, ...args);
  };
}
for (const name of ['writeFileSync', 'writeFile', 'appendFileSync', 'appendFile', 'mkdirSync', 'mkdir']) {
  const original = fs[name];
  fs[name] = function (path, ...args) {
    permitted(path, true);
    return original.call(this, path, ...args);
  };
}
for (const name of ['readFile', 'writeFile', 'appendFile', 'mkdir']) {
  const original = fs.promises[name];
  fs.promises[name] = function (path, ...args) {
    permitted(path, name !== 'readFile');
    return original.call(this, path, ...args);
  };
}
const noNetwork = () => {
  facts.blockedNetwork++;
  fixed();
};
for (const module of [http, https]) for (const key of ['request', 'get']) module[key] = noNetwork;
net.connect = net.createConnection = tls.connect = noNetwork;
net.Socket.prototype.connect = noNetwork;
for (const key of ['lookup', 'resolve', 'resolve4', 'resolve6']) dns[key] = noNetwork;
syncBuiltinESMExports();

globalThis.fetch = async (value, options = {}) => {
  const url = new URL(value instanceof Request ? value.url : value),
    headers = new Headers(options.headers);
  if (
    facts.fetchCalls ||
    url.href !==
      'https://api.vercel.com/v9/projects/prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu?teamId=team_gboXPxTevpCOZuaA8eY9PmR1' ||
    (options.method ?? 'GET') !== 'GET'
  )
    noNetwork();
  facts.fetchCalls++;
  facts.matchingAuthorization = headers.get('authorization') === 'Bearer SyntheticVercelReadOnly47';
  const dto = {
    id: 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
    accountId: 'team_gboXPxTevpCOZuaA8eY9PmR1',
    rootDirectory: 'apps/web',
    nodeVersion: '24.x',
    framework: 'nextjs',
    link: { type: 'github', org: 'muhhammeddsayedd-prog', repo: 'Everyone-Market-Researcher' },
    ssoProtection: { deploymentType: 'all_except_custom_domains' },
    protectionBypass: {},
    syntheticNeverProject: 'SYNTHETIC_RAW_DTO_MUST_STAY_PRIVATE',
  };
  return new Response(JSON.stringify(dto), {
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/json' },
  });
};
process.once('exit', () => originalWrite(resolve(root, 'synthetic-wire-facts.json'), JSON.stringify(facts)));
// Node may evaluate independent --import entries concurrently. One outer
// fixture installs guards before loading the unchanged real pinned preload.
const preload = new URL('../foundation-live-setup-no-retry.mjs', import.meta.url).href;
process.execArgv.push('--import', preload);
await import(preload);
