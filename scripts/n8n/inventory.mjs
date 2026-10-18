import { lookup as osLookup } from 'node:dns';
import { request } from 'node:https';
import { isIP } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const host = 'muhhammedsayed.app.n8n.cloud';
const projectId = 'pHvQjDmjxVZ3KQLT';
const maxBytes = 4 * 1024 * 1024;
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const id = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
// Explicit owner-authorized IDs observed in the intended Personal project.
// Names/types must match readback; native credentials are never relabeled.
export const inventoryCredentialCandidates = Object.freeze(
  [
    {
      key: 'postgres',
      id: '3ZZtc9kMDcminv6w',
      name: 'Supabase Postgres · n8n_writer · dev',
      type: 'postgres',
    },
    { key: 'apify', id: 'EYmaOt0rd45ysq0J', name: 'Apify account', type: 'apifyApi' },
    { key: 'openai', id: 'e04LREfPBELWQQ9D', name: 'OpenAI account', type: 'openAiApi' },
    { key: 'vimeo', id: 'HeZBOZhFMeFYOC0N', name: 'Vimeo Token', type: 'httpHeaderAuth' },
    { key: 'youtube', id: 'ltvBSloVLGVeUjqV', name: 'YouTube Data API key', type: 'httpHeaderAuth' },
  ].map((value) => Object.freeze(value)),
);
const credentialTypes = {
  postgres: 'postgres',
  apify: 'apifyApi',
  openai: 'openAiApi',
  vimeo: 'httpHeaderAuth',
  youtube: 'httpHeaderAuth',
};
export const inventoryWorkflowNames = Object.freeze([
  'SUB · Start run [dev]',
  'SUB · Finish run [dev]',
  'SUB · Ingest items [dev]',
  'SUB · Log cost [dev]',
  'SUB · Notify [dev]',
  'WF-00 · Orchestrator [dev]',
  'WF-19 · Apify run callback [dev]',
  'WF-90 · Error handler [dev]',
  'WF-91 · Health & cost [dev]',
  'WF-99 · Foundation smoke test [dev]',
  'WF-10 · Vimeo collector [dev]',
  'WF-11 · Instagram posts/reels collector [dev]',
  'WF-12 · Instagram stories collector [dev]',
  'WF-13 · YouTube collector [dev]',
  'WF-18 · LinkedIn posts collector [dev]',
  'WF-18b · LinkedIn employees [dev]',
  'WF-21 · Websites collector [dev]',
  'WF-22 · News [dev]',
  'WF-23 · Awards and trade [dev]',
  'WF-30 · AI extractor [dev]',
  'WF-32 · Campaign linker [dev]',
  'WF-40 · Removal check [dev]',
  'WF-50 · Weekly briefs [dev]',
  'WF-70 · Publish / revalidate [dev]',
  'WF-80 · Alerts [dev]',
]);
const workflowNames = new Set(inventoryWorkflowNames);
const routes = {
  workflowList: ['GET', '/api/v1/workflows'],
  workflowRead: ['GET', '/api/v1/workflows/{workflowId}'],
  workflowCreate: ['POST', '/api/v1/workflows'],
  workflowUpdate: ['PUT', '/api/v1/workflows/{workflowId}'],
  workflowPublish: ['POST', '/api/v1/workflows/{workflowId}/publish'],
  workflowUnpublish: ['POST', '/api/v1/workflows/{workflowId}/unpublish'],
  credentialList: ['GET', '/api/v1/credentials'],
  credentialRead: ['GET', '/api/v1/credentials/{credentialId}'],
  credentialTest: ['POST', '/api/v1/credentials/{credentialId}/test'],
  projectList: ['GET', '/api/v1/projects'],
};
class InventoryError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
const reject = (code = 'response_rejected') => {
  throw new InventoryError(code);
};

// Same conservative public-address rules reviewed for the bounded M02 diagnostic.
function publicAddress(address) {
  const family = isIP(address);
  if (family === 4) {
    const [a, b, c] = address.split('.').map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0 && (c === 0 || c === 2)) ||
      (a === 192 && b === 88 && c === 99) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113)
    );
  }
  if (family !== 6 || address.includes('%') || address.includes('.')) return false;
  const [first = '', second = ''] = address.toLowerCase().split(':');
  const a = Number.parseInt(first, 16);
  const b = second ? Number.parseInt(second, 16) : 0;
  return (
    a >= 0x2000 &&
    a <= 0x3fff &&
    a !== 0x2002 &&
    !(a === 0x2001 && (b <= 0x01ff || b === 0x0db8)) &&
    !(a === 0x3fff && b <= 0x0fff)
  );
}
export function resolveInstance(signal, lookup = osLookup) {
  // The OS operation itself cannot be cancelled. The callback guard and the
  // existing overall deadline prevent late results from starting a request;
  // the bounded Windows consumer also owns the native process lifetime.
  return new Promise((done, fail) => {
    let settled = false;
    const finish = (error, addresses) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', abort);
      if (error) fail(error);
      else done(addresses);
    };
    const abort = () => finish(new InventoryError('timeout'));
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener('abort', abort, { once: true });
    try {
      lookup(host, { all: true }, (error, addresses) => {
        if (error) {
          if (['ENODATA', 'ENOTFOUND'].includes(error.code)) finish(null, []);
          else finish(new InventoryError('network_failed'));
        } else finish(null, addresses);
      });
    } catch {
      finish(new InventoryError('network_failed'));
    }
  });
}
function validatedAddresses(addresses) {
  if (
    !Array.isArray(addresses) ||
    addresses.length === 0 ||
    addresses.length > 100 ||
    addresses.some(
      (entry) => !record(entry) || entry.family !== isIP(entry.address) || !publicAddress(entry.address),
    )
  )
    reject('unsafe_dns');
  return addresses;
}
function nativeRequest(input, requestImpl = request) {
  return new Promise((done, fail) => {
    const req = requestImpl(
      input.url,
      {
        method: 'GET',
        headers: input.headers,
        rejectUnauthorized: true,
        servername: host,
        agent: false,
        family: input.address.family,
        signal: input.signal,
        lookup: (_name, _options, callback) => callback(null, input.address.address, input.address.family),
      },
      (response) => {
        const status = response.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          response.destroy();
          req.destroy();
          done({ status, body: new Uint8Array() });
          return;
        }
        if (Number(response.headers['content-length']) > maxBytes) {
          response.destroy();
          req.destroy();
          fail(new InventoryError('body_too_large'));
          return;
        }
        const chunks = [];
        let size = 0;
        response.on('data', (chunk) => {
          size += chunk.length;
          if (size > maxBytes) {
            response.destroy();
            req.destroy();
            fail(new InventoryError('body_too_large'));
          } else chunks.push(chunk);
        });
        response.once('end', () => done({ status, body: Buffer.concat(chunks) }));
        response.once('error', () => fail(new InventoryError('network_failed')));
        response.once('aborted', () => fail(new InventoryError('network_failed')));
      },
    );
    if (input.onTlsVerified || input.onSocketClosed) {
      req.once('socket', (socket) => {
        socket.once('secureConnect', () =>
          input.onTlsVerified?.(socket.encrypted === true && socket.authorized === true),
        );
        socket.once('close', () => input.onSocketClosed?.());
      });
    }
    req.once('error', () => fail(new InventoryError('network_failed')));
    req.end();
  });
}

// Credential-free, fixed-route transport proof. This does not call runInventory
// or establish API authentication. Normal keyed-reader routes/counts are intact.
export async function probePublicInventoryTransport(dependencies = {}) {
  const controller = new AbortController();
  const result = { httpStatus: null, tlsVerified: false, socketClosed: false };
  const deadlineMs =
    Number.isInteger(dependencies.timeoutMs) && dependencies.timeoutMs > 0 && dependencies.timeoutMs <= 10_000
      ? dependencies.timeoutMs
      : 10_000;
  const closeMs =
    Number.isInteger(dependencies.closeTimeoutMs) &&
    dependencies.closeTimeoutMs > 0 &&
    dependencies.closeTimeoutMs <= 5000
      ? dependencies.closeTimeoutMs
      : 5000;
  let requestIssued = false;
  let resolveClosed;
  const closed = new Promise((done) => {
    resolveClosed = done;
  });
  const timer = setTimeout(() => controller.abort(), deadlineMs);
  const timeout = new Promise((_, fail) =>
    controller.signal.addEventListener('abort', () => fail(new InventoryError('timeout')), { once: true }),
  );
  const operation = async () => {
    const addresses = validatedAddresses(await (dependencies.lookup ?? resolveInstance)(controller.signal));
    if (controller.signal.aborted) reject('timeout');
    requestIssued = true;
    const response = await nativeRequest(
      {
        url: new URL(`https://${host}/api/v1/discover`),
        headers: {
          accept: 'application/json',
          'user-agent': 'everyone-market-radar-m03-public-transport-check/1',
        },
        address: addresses[0],
        signal: controller.signal,
        onTlsVerified: (verified) => {
          result.tlsVerified = verified;
        },
        onSocketClosed: () => {
          result.socketClosed = true;
          resolveClosed();
        },
      },
      dependencies.request ?? request,
    );
    if (Number.isInteger(response.status) && response.status >= 100 && response.status <= 599)
      result.httpStatus = response.status;
  };
  try {
    await Promise.race([operation(), timeout]);
  } catch {
    /* Fixed booleans/null only; no body, headers or raw errors. */
  } finally {
    clearTimeout(timer);
    controller.abort();
    if (requestIssued && !result.socketClosed) {
      let closeTimer;
      try {
        await Promise.race([
          closed,
          new Promise((done) => {
            closeTimer = setTimeout(done, closeMs);
          }),
        ]);
      } finally {
        clearTimeout(closeTimer);
      }
    }
  }
  return result;
}
function listPage(value) {
  if (
    !record(value) ||
    !Array.isArray(value.data) ||
    value.data.length > 100 ||
    !(
      value.nextCursor === null ||
      (typeof value.nextCursor === 'string' && /^[A-Za-z0-9_+=/-]{1,2048}$/.test(value.nextCursor))
    )
  )
    reject();
  return value;
}
function inspectCapabilities(value, capabilities) {
  if (
    !record(value) ||
    !record(value.data) ||
    !record(value.data.resources) ||
    Object.keys(value.data.resources).length > 200
  )
    reject();
  const found = new Set();
  for (const resource of Object.values(value.data.resources)) {
    if (
      !record(resource) ||
      !Array.isArray(resource.endpoints) ||
      resource.endpoints.length > 1000 ||
      !Array.isArray(resource.operations)
    )
      reject();
    for (const endpoint of resource.endpoints) {
      if (
        !record(endpoint) ||
        !['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(endpoint.method) ||
        typeof endpoint.path !== 'string' ||
        endpoint.path.length > 512 ||
        typeof endpoint.operationId !== 'string'
      )
        reject();
      found.add(`${endpoint.method} ${endpoint.path}`);
    }
  }
  for (const [name, [method, path]] of Object.entries(routes))
    capabilities[name] = found.has(`${method} ${path}`);
}
function projectBound(row, resource) {
  return (
    Array.isArray(row.shared) &&
    row.shared.some(
      (entry) =>
        record(entry) &&
        (resource === 'credentials' ? entry.id === projectId : entry.projectId === projectId),
    )
  );
}
function projectRows(resource, rows, seen, candidates) {
  const known = [];
  let unknownCount = 0;
  for (const row of rows) {
    if (!record(row) || !id(row.id) || typeof row.name !== 'string' || row.name.length > 512) reject();
    if (resource === 'projects') {
      if (!['personal', 'team'].includes(row.type)) reject();
      if (row.id === projectId) {
        if (row.type !== 'personal' || seen.has(row.id)) reject();
        seen.add(row.id);
        known.push({ id: projectId, type: 'personal' });
      } else unknownCount++;
    } else if (resource === 'credentials') {
      if (typeof row.type !== 'string' || row.type.length > 128) reject();
      const candidate = candidates.get(row.id);
      if (!candidate) {
        unknownCount++;
        continue;
      }
      if (
        row.name !== candidate.name ||
        row.type !== candidate.type ||
        !projectBound(row, resource) ||
        seen.has(row.id)
      )
        reject();
      seen.add(row.id);
      known.push({ name: row.name, id: row.id, type: row.type });
    } else {
      if (typeof row.active !== 'boolean' || typeof row.isArchived !== 'boolean') reject();
      if (!workflowNames.has(row.name)) {
        unknownCount++;
        continue;
      }
      if (!projectBound(row, resource) || seen.has(row.name)) reject();
      seen.add(row.name);
      known.push({ name: row.name, id: row.id, active: row.active, archived: row.isArchived });
    }
  }
  return { known, unknownCount };
}

/** Four fixed GET-only endpoint families; dependencies are local, non-network test adapters. */
export async function runInventory(key, dependencies = {}) {
  const result = {
    version: 1,
    environment: 'dev',
    host,
    projectId,
    status: 'complete',
    requestCount: 0,
    authenticationVerified: false,
    projectVerified: false,
    capabilities: Object.fromEntries(Object.keys(routes).map((name) => [name, false])),
    manualExecutionSupportedByReviewedPublicApi: false,
    resources: Object.fromEntries(
      ['projects', 'workflows', 'credentials'].map((name) => [
        name,
        { status: 'not_attempted', httpStatus: null, count: 0, unknownCount: 0, known: [] },
      ]),
    ),
  };
  if (!key) {
    result.status = 'missing_key';
    return result;
  }
  if (typeof key !== 'string' || key.length > 4096 || !/^[\x21-\x7e]+$/.test(key)) {
    result.status = 'invalid_key';
    return result;
  }
  // Tests may supply synthetic candidates alongside synthetic transport. The
  // sealed CLI entry point accepts no arguments and always uses the fixed list.
  const supplied = dependencies.credentialCandidates ?? inventoryCredentialCandidates;
  const candidates = new Map(),
    services = new Set();
  if (!Array.isArray(supplied) || supplied.length > 5) {
    result.status = 'invalid_options';
    return result;
  }
  for (const candidate of supplied) {
    if (
      !record(candidate) ||
      Object.keys(candidate).length !== 4 ||
      !['key', 'id', 'name', 'type'].every((k) => Object.hasOwn(candidate, k)) ||
      !Object.hasOwn(credentialTypes, candidate.key) ||
      candidate.type !== credentialTypes[candidate.key] ||
      !id(candidate.id) ||
      typeof candidate.name !== 'string' ||
      candidate.name.length < 1 ||
      candidate.name.length > 200 ||
      /[\x00-\x1f\x7f]/.test(candidate.name) ||
      candidates.has(candidate.id) ||
      services.has(candidate.key)
    ) {
      result.status = 'invalid_options';
      return result;
    }
    candidates.set(candidate.id, candidate);
    services.add(candidate.key);
  }
  const timeoutMs = dependencies.timeoutMs ?? 60_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) {
    result.status = 'invalid_options';
    return result;
  }
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const timeout = new Promise((_, fail) =>
    controller.signal.addEventListener('abort', () => fail(new InventoryError('timeout')), { once: true }),
  );
  const operation = async () => {
    const addresses = validatedAddresses(await (dependencies.lookup ?? resolveInstance)(controller.signal));
    if (controller.signal.aborted) reject('timeout');
    const get = async (resource, cursor) => {
      const url = new URL(`https://${host}/api/v1/${resource}`);
      if (resource !== 'discover') url.searchParams.set('limit', '100');
      if (resource === 'workflows') {
        url.searchParams.set('projectId', projectId);
        url.searchParams.set('excludePinnedData', 'true');
      }
      if (cursor) url.searchParams.set('cursor', cursor);
      result.requestCount++;
      const response = await (dependencies.transport ?? nativeRequest)({
        url,
        method: 'GET',
        headers: {
          'x-n8n-api-key': key,
          accept: 'application/json',
          'user-agent': 'everyone-market-radar-m03-read-only-inventory/1',
        },
        address: addresses[0],
        signal: controller.signal,
        maxBytes,
        rejectUnauthorized: true,
        servername: host,
      });
      if (controller.signal.aborted) reject('timeout');
      if (
        !record(response) ||
        !Number.isInteger(response.status) ||
        response.status < 100 ||
        response.status > 599
      )
        reject();
      if (response.status >= 300 && response.status < 400) reject('redirect_refused');
      if (response.status === 401) reject('unauthorized');
      if (!(response.body instanceof Uint8Array) || response.body.byteLength > maxBytes)
        reject('body_too_large');
      if (response.status !== 200) return { status: response.status, value: null };
      let value;
      try {
        value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(response.body));
      } catch {
        reject();
      }
      // Fail closed if a response reflects this request's private key into an
      // ID, cursor, name or nested field. Do not redact, hash or report the value.
      const pending = [value];
      let visited = 0;
      while (pending.length) {
        if (++visited > 100_000) reject();
        const item = pending.pop();
        if (typeof item === 'string' && item.includes(key)) reject('confidentiality_rejected');
        if (Array.isArray(item)) pending.push(...item);
        else if (record(item)) pending.push(...Object.values(item));
      }
      result.authenticationVerified = true;
      return { status: response.status, value };
    };
    const discovered = await get('discover');
    if (discovered.status !== 200) reject('http_failed');
    inspectCapabilities(discovered.value, result.capabilities);
    for (const resource of ['projects', 'workflows', 'credentials']) {
      const section = result.resources[resource];
      const seen = new Set();
      const cursors = new Set();
      let cursor;
      try {
        for (let page = 0; page < 2; page++) {
          const response = await get(resource, cursor);
          section.httpStatus = response.status;
          if (response.status !== 200) {
            section.status = response.status === 403 ? 'forbidden' : 'http_failed';
            break;
          }
          const value = listPage(response.value);
          const projected = projectRows(resource, value.data, seen, candidates);
          section.count += value.data.length;
          section.known.push(...projected.known);
          section.unknownCount += projected.unknownCount;
          if (value.nextCursor === null) {
            section.status = 'complete';
            break;
          }
          if (cursors.has(value.nextCursor)) reject();
          cursors.add(value.nextCursor);
          cursor = value.nextCursor;
          section.status = 'page_limit';
        }
      } catch (error) {
        if (
          [
            'redirect_refused',
            'unauthorized',
            'timeout',
            'network_failed',
            'body_too_large',
            'confidentiality_rejected',
          ].includes(error?.code)
        )
          throw error;
        section.status = 'response_rejected';
        section.known = [];
        section.count = 0;
        section.unknownCount = 0;
      }
    }
    result.projectVerified =
      result.resources.projects.status === 'complete' && result.resources.projects.known.length === 1;
    result.status = Object.values(result.resources).every((section) => section.status === 'complete')
      ? 'complete'
      : 'partial';
  };
  try {
    await Promise.race([operation(), timeout]);
  } catch (error) {
    result.status = timedOut
      ? 'timeout'
      : [
            'unsafe_dns',
            'timeout',
            'unauthorized',
            'redirect_refused',
            'response_rejected',
            'network_failed',
            'http_failed',
            'body_too_large',
            'confidentiality_rejected',
          ].includes(error?.code)
        ? error.code
        : 'network_failed';
    if (result.status === 'confidentiality_rejected') {
      result.projectVerified = false;
      for (const section of Object.values(result.resources)) {
        section.known = [];
        section.count = 0;
        section.unknownCount = 0;
        section.status = 'response_rejected';
      }
    }
  } finally {
    clearTimeout(timer);
    controller.abort();
    key = null;
  }
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const key = process.env.M03_N8N_API_KEY;
  delete process.env.M03_N8N_API_KEY;
  if (process.argv.length !== 2) {
    process.stdout.write(JSON.stringify({ version: 1, status: 'argument_rejected' }) + '\n');
    process.exitCode = 1;
  } else {
    const result = await runInventory(key);
    process.stdout.write(JSON.stringify(result) + '\n');
    process.exitCode = ['complete', 'partial'].includes(result.status) ? 0 : 1;
  }
}
