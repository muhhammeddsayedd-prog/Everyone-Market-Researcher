import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { managementTransport, runOwnedStdinChild } from './gw01-delivery-transport.mjs';
import {
  assertCredentialMetadata,
  credentialOwnership,
  readCredentialProvenance,
} from './gw01-credential-ownership.mjs';
import { privacyTarget, readGatewayPrivacy } from './gw01-privacy-read.mjs';

export const gatewayCredentialIds = Object.freeze({ canary: 'EmrGw01Canary18', machine: 'EmrGw01Machine18' });
const credentialNames = { canary: 'M03 GW-01 privacy canary [dev]', machine: 'M03 GW-01 machine [dev]' };
const fail = (code) => {
  throw Error(code);
};
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const exact = (v, keys) =>
  object(v) && Object.keys(v).length === keys.length && Object.keys(v).every((k) => keys.includes(k));
const privateValue = (v) =>
  typeof v === 'string' && v.length >= 1 && v.length <= 4096 && !/[\x00-\x1f\x7f]/.test(v);
const safeCode = (error) =>
  /^(GW01_DELIVERY_(REJECTED|UNKNOWN|SCOPE_DENIED|RESPONSE_REJECTED|SCHEMA_REJECTED|RECONCILE|OWNERSHIP_UNVERIFIED|CLI_REJECTED)|GW01_CHILD_(START_FAILED|TIMEOUT|CLEANUP_UNVERIFIED|NATIVE_FAILURE)|GW01_TRANSPORT_(DNS|TLS|STATUS|BODY|PARSE|CLOSE))$/.test(
    error?.message ?? '',
  )
    ? error.message
    : 'GW01_DELIVERY_UNKNOWN';
export function vercelEnvArguments(name) {
  if (!['EMR_WORKER_DB_PASSWORD', 'EMR_WORKER_GATEWAY_TOKEN_SHA256'].includes(name))
    fail('GW01_DELIVERY_REJECTED');
  return [
    'env',
    'add',
    name,
    'preview',
    'm03-n8n-foundation',
    '--sensitive',
    '--project',
    'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
    '--scope',
    'muhammed-abdelrahman',
    '--yes',
    '--non-interactive',
    '--no-color',
  ];
}
function reflected(value, secrets) {
  if (typeof value === 'string') return secrets.some((s) => s && value.includes(s));
  if (Array.isArray(value)) return value.some((v) => reflected(v, secrets));
  if (object(value))
    return Object.entries(value).some(([k, v]) => reflected(k, secrets) || reflected(v, secrets));
  return false;
}

// n8n2.43.5 public controller/spec: create accepts projectId and a caller-chosen
// stableID, returns HTTP200 metadata only; GET metadata never decrypts data.
// No credential test, list, update, transfer or arbitrary endpoint is exposed.
export async function deliverGatewayCredentials(mode, secrets, config, ports) {
  if (
    !['Canary', 'Runtime', 'ReconcileCanary', 'ReconcileRuntime', 'PrivacyRead', 'Cleanup'].includes(mode) ||
    !exact(
      config,
      mode === 'PrivacyRead'
        ? ['audience', 'privacyVerified', 'privacyTarget']
        : ['audience', 'privacyVerified'],
    ) ||
    typeof config.privacyVerified !== 'boolean' ||
    !object(ports) ||
    typeof ports.management !== 'function' ||
    typeof ports.environment !== 'function' ||
    !object(ports.ownership)
  )
    fail('GW01_DELIVERY_REJECTED');
  let u;
  try {
    u = new URL(config.audience);
  } catch {
    fail('GW01_DELIVERY_REJECTED');
  }
  if (
    u.protocol !== 'https:' ||
    u.origin !== config.audience ||
    u.port ||
    u.username ||
    u.password ||
    !u.hostname.startsWith('everyone-market-researcher-') ||
    !u.hostname.endsWith('.vercel.app')
  )
    fail('GW01_DELIVERY_REJECTED');
  const expected = mode === 'Runtime' ? ['management', 'writer', 'machine', 'protection'] : ['management'];
  if (
    !exact(secrets, expected) ||
    !expected.every((k) => privateValue(secrets[k])) ||
    (mode === 'Runtime' && !config.privacyVerified)
  )
    fail('GW01_DELIVERY_REJECTED');
  const values = Object.values(secrets),
    hash = mode === 'Runtime' ? createHash('sha256').update(secrets.machine).digest('hex') : null;
  const guard = (value) => {
    if (reflected(value, [...values, hash])) fail('GW01_DELIVERY_RESPONSE_REJECTED');
    return value;
  };
  let requestCount = 0;
  async function api(method, path, body) {
    if (++requestCount > 5) fail('GW01_DELIVERY_REJECTED');
    let r;
    try {
      r = await ports.management(method, path, body, secrets.management);
    } catch (error) {
      fail(safeCode(error));
    }
    if (!object(r) || !Number.isInteger(r.status)) fail('GW01_DELIVERY_RESPONSE_REJECTED');
    guard(r.body);
    if ([401, 403].includes(r.status)) fail('GW01_DELIVERY_SCOPE_DENIED');
    return r;
  }
  const metadata = assertCredentialMetadata;
  if (mode === 'PrivacyRead') {
    const target = privacyTarget(config.privacyTarget);
    if (target.audience !== config.audience) fail('GW01_DELIVERY_REJECTED');
    const privacy = await readGatewayPrivacy(target, api);
    return { version: 1, status: 'complete', mode, managementRequests: requestCount, privacy };
  }
  if (mode.startsWith('Reconcile')) {
    const key = mode === 'ReconcileCanary' ? 'canary' : 'machine',
      owned = readCredentialProvenance(ports.ownership, key, config.audience);
    const r = await api('GET', '/api/v1/credentials/' + gatewayCredentialIds[key], null);
    if (![200, 404].includes(r.status)) fail('GW01_DELIVERY_UNKNOWN');
    const credential = r.status === 200 ? metadata(r.body, key) : null;
    return {
      version: 1,
      status: 'complete',
      mode,
      managementRequests: requestCount,
      exists: credential !== null,
      ownershipVerified: Boolean(
        credential &&
        owned.created &&
        !owned.deleted &&
        credential.createdAt === owned.created.credential.createdAt,
      ),
      credential,
      projectReadbackVerified: false,
      automaticPostRetry: false,
    };
  }
  if (mode === 'Cleanup') {
    const deleted = [];
    for (const key of ['canary', 'machine']) {
      if (ports.ownership.read(key) === null) continue;
      const owned = readCredentialProvenance(ports.ownership, key, config.audience);
      if (owned.deleted) continue;
      if (!owned.created) fail('GW01_DELIVERY_OWNERSHIP_UNVERIFIED');
      const id = gatewayCredentialIds[key],
        r = await api('GET', '/api/v1/credentials/' + id, null);
      if (r.status === 404) {
        ports.ownership.append(key, { kind: 'deleted' });
        continue;
      }
      if (r.status !== 200 || metadata(r.body, key).createdAt !== owned.created.credential.createdAt)
        fail('GW01_DELIVERY_OWNERSHIP_UNVERIFIED');
      const d = await api('DELETE', '/api/v1/credentials/' + id, null);
      if (d.status !== 200 || metadata(d.body, key).createdAt !== owned.created.credential.createdAt)
        fail('GW01_DELIVERY_UNKNOWN');
      ports.ownership.append(key, { kind: 'deleted' });
      deleted.push(id);
    }
    return {
      version: 1,
      status: 'complete',
      mode,
      managementRequests: requestCount,
      deletedCredentialIds: deleted,
    };
  }
  const key = mode === 'Canary' ? 'canary' : 'machine',
    id = gatewayCredentialIds[key];
  if (ports.ownership.read(key) !== null) fail('GW01_DELIVERY_RECONCILE');
  const schema = await api('GET', '/api/v1/credentials/schema/httpCustomAuth', null);
  if (
    schema.status !== 200 ||
    !object(schema.body?.properties) ||
    !['json', 'allowedHttpRequestDomains', 'allowedDomains'].every((k) =>
      Object.hasOwn(schema.body.properties, k),
    )
  )
    fail('GW01_DELIVERY_SCHEMA_REJECTED');
  const existing = await api('GET', '/api/v1/credentials/' + id, null);
  if (existing.status !== 404) fail('GW01_DELIVERY_RECONCILE');
  ports.ownership.begin(key, {
    version: 1,
    kind: 'intent',
    windowId: '76c2ad42-c094-4ba4-9a0b-566e19b97780',
    projectId: 'pHvQjDmjxVZ3KQLT',
    audience: config.audience,
    id,
    name: credentialNames[key],
    type: 'httpCustomAuth',
    createdAt: new Date().toISOString(),
  });
  if (mode === 'Runtime') {
    // ExistingCLI authentication is used by its supported public executable.
    // Values/verifier exist only in memory and child stdin, never argv/output.
    for (const [name, value] of [
      ['EMR_WORKER_DB_PASSWORD', secrets.writer],
      ['EMR_WORKER_GATEWAY_TOKEN_SHA256', hash],
    ]) {
      let result;
      try {
        result = await ports.environment(name, value);
      } catch (error) {
        fail(safeCode(error));
      }
      if (!exact(result, ['ok', 'childClosed', 'code']) || result.childClosed !== true)
        fail('GW01_CHILD_CLEANUP_UNVERIFIED');
      if (result.ok !== true) fail(safeCode({ message: result.code }));
    }
  }
  const json = JSON.stringify({
    headers: {
      Authorization: 'Bearer ' + (mode === 'Canary' ? 'GW01_SYNTHETIC_AUTH_CANARY_ONLY' : secrets.machine),
      'x-vercel-protection-bypass':
        mode === 'Canary' ? 'GW01_SYNTHETIC_BYPASS_CANARY_ONLY' : secrets.protection,
    },
  });
  const result = await api('POST', '/api/v1/credentials', {
    id,
    name: credentialNames[key],
    type: 'httpCustomAuth',
    projectId: 'pHvQjDmjxVZ3KQLT',
    data: { json, allowedHttpRequestDomains: 'domains', allowedDomains: u.hostname },
  });
  if (result.status !== 200) fail('GW01_DELIVERY_UNKNOWN');
  const credential = metadata(result.body, key);
  ports.ownership.append(key, { kind: 'created', credential });
  return {
    version: 1,
    status: 'complete',
    mode,
    managementRequests: requestCount,
    credential,
    branch: 'm03-n8n-foundation',
    previewOnly: true,
  };
}

const osEnvironment = () =>
  Object.fromEntries(
    ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP', 'LOCALAPPDATA', 'APPDATA', 'USERPROFILE'].flatMap((k) =>
      process.env[k] === undefined ? [] : [[k, process.env[k]]],
    ),
  );
export function nativeVercelEnvironment(name, value) {
  const args = vercelEnvArguments(name),
    cli = join(process.env.APPDATA ?? '', 'npm/node_modules/vercel/dist/vc.js');
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(join(cli, '../../package.json'), 'utf8'));
  } catch {
    fail('GW01_DELIVERY_CLI_REJECTED');
  }
  if (pkg.version !== '56.5.0' || !privateValue(value)) fail('GW01_DELIVERY_CLI_REJECTED');
  return runOwnedStdinChild({
    executable: process.execPath,
    args: [cli, ...args],
    cwd: resolve('apps/web'),
    env: osEnvironment(),
    value,
  });
}
export const nativeManagementRequest = managementTransport();

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let exit = 1;
  try {
    if (process.argv.length !== 3 || process.argv[2] !== '--private-delivery') fail('GW01_DELIVERY_REJECTED');
    const chunks = [];
    let size = 0;
    for await (const chunk of process.stdin) {
      size += chunk.length;
      if (size > 32768) fail('GW01_DELIVERY_REJECTED');
      chunks.push(chunk);
    }
    const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!exact(input, ['mode', 'secrets', 'config'])) fail('GW01_DELIVERY_REJECTED');
    const result = await deliverGatewayCredentials(input.mode, input.secrets, input.config, {
      management:
        input.mode === 'PrivacyRead'
          ? managementTransport({ owned: privacyTarget(input.config?.privacyTarget) })
          : nativeManagementRequest,
      environment: nativeVercelEnvironment,
      ownership: credentialOwnership(resolve('.')),
    });
    process.stdout.write(JSON.stringify(result));
    exit = 0;
  } catch (error) {
    process.stdout.write(
      JSON.stringify({
        version: 1,
        status: 'stopped_reconcile',
        privateDetailsWithheld: true,
        code: safeCode(error),
      }),
    );
  }
  process.exitCode = exit;
}
