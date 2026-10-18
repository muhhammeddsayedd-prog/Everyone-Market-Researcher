import { request } from 'node:https';
import { isIP } from 'node:net';
import { resolveInstance } from './inventory.mjs';
import { buildShell, shellSpecs, foundationScope } from './foundation-provision.mjs';
import { foundationTagNames } from '../../packages/shared/src/n8n-bindings.ts';
const fail = (code) => {
  throw Error(code);
};
export function validateFoundationAddresses(rows) {
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 100) fail('FOUNDATION_DNS_REJECTED');
  for (const row of rows) {
    if (!row || row.family !== isIP(row.address)) fail('FOUNDATION_DNS_REJECTED');
    const address = row.address;
    if (row.family === 4) {
      const [a, b, c] = address.split('.').map(Number);
      if (
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
      )
        fail('FOUNDATION_DNS_REJECTED');
    } else if (row.family === 6) {
      const [first = '', second = ''] = address.toLowerCase().split(':'),
        a = parseInt(first, 16),
        b = second ? parseInt(second, 16) : 0;
      if (
        address.includes('%') ||
        address.includes('.') ||
        !(a >= 0x2000 && a <= 0x3fff) ||
        a === 0x2002 ||
        (a === 0x2001 && (b <= 0x01ff || b === 0x0db8)) ||
        (a === 0x3fff && b <= 0x0fff)
      )
        fail('FOUNDATION_DNS_REJECTED');
    } else fail('FOUNDATION_DNS_REJECTED');
  }
  return rows;
}
async function safeResolve(signal) {
  return validateFoundationAddresses(await resolveInstance(signal));
}
function bindingRequest(method, path, body, ownsWorkflow, c) {
  if (!c) return false;
  if (method === 'GET' && body === null) {
    if (
      ['/api/v1/credentials/schema/httpCustomAuth', '/api/v1/credentials/EmrFoundationMachine19'].includes(
        path,
      )
    )
      return true;
    const match = /^\/api\/v1\/tags\/([A-Za-z0-9_-]{1,128})$/.exec(path);
    if (match) return c.knownTagIds?.has(match[1]) === true;
    try {
      const url = new URL('https://' + foundationScope.host + path),
        p = url.searchParams;
      return (
        url.hostname === foundationScope.host &&
        url.pathname === '/api/v1/tags' &&
        [...p.keys()].every((k) => ['limit', 'cursor'].includes(k)) &&
        [...p.keys()].length === (p.has('cursor') ? 2 : 1) &&
        p.get('limit') === '100' &&
        (!p.has('cursor') || /^[\x21-\x7e]{1,400}$/.test(p.get('cursor')))
      );
    } catch {
      return false;
    }
  }
  if (method === 'POST' && path === '/api/v1/tags')
    return (
      body !== null &&
      typeof body === 'object' &&
      Object.keys(body).length === 1 &&
      foundationTagNames.includes(body.name)
    );
  if (method === 'POST' && path === '/api/v1/credentials')
    return c.machineBody && JSON.stringify(body) === JSON.stringify(c.machineBody);
  if (method === 'PUT') {
    const match = /^\/api\/v1\/workflows\/([A-Za-z0-9_-]{1,128})(\/tags)?$/.exec(path);
    if (!match || ownsWorkflow(match[1]) !== true) return false;
    const expected = match[2] ? c.workflowTagBodies?.get(match[1]) : c.workflowBodies?.get(match[1]);
    return expected !== undefined && JSON.stringify(body) === JSON.stringify(expected);
  }
  return false;
}
export function foundationAllowedRequest(method, path, body, ownsWorkflow = () => false, binding = null) {
  if (typeof path !== 'string' || path.includes('#')) return false;
  if (bindingRequest(method, path, body, ownsWorkflow, binding)) return true;
  if (method === 'POST')
    return (
      path === '/api/v1/workflows' &&
      shellSpecs.some((s) => JSON.stringify(body) === JSON.stringify(buildShell(s.key)))
    );
  if (method !== 'GET' || body !== null || typeof path !== 'string' || path.includes('#')) return false;
  if (path === '/api/v1/projects?limit=100') return true;
  const exact = /^\/api\/v1\/workflows\/([A-Za-z0-9_-]{1,128})$/.exec(path);
  if (exact) return ownsWorkflow(exact[1]) === true;
  try {
    const url = new URL('https://' + foundationScope.host + path),
      p = url.searchParams;
    return (
      url.hostname === foundationScope.host &&
      url.pathname === '/api/v1/workflows' &&
      [...p.keys()].every((k) => ['projectId', 'excludePinnedData', 'limit', 'cursor'].includes(k)) &&
      [...p.keys()].length === (p.has('cursor') ? 4 : 3) &&
      p.get('projectId') === foundationScope.projectId &&
      p.get('excludePinnedData') === 'true' &&
      p.get('limit') === '100' &&
      (!p.has('cursor') || /^[\x21-\x7e]{1,400}$/.test(p.get('cursor')))
    );
  } catch {
    return false;
  }
}
export function foundationManagementTransport(dependencies = {}) {
  const lookup = dependencies.resolveInstance ?? safeResolve;
  const send = dependencies.request ?? request;
  return async (method, path, body, key) => {
    const remainingMs = dependencies.deadlineMs === undefined ? 12000 : dependencies.deadlineMs - Date.now();
    if (!Number.isFinite(remainingMs) || remainingMs <= 0) fail('FOUNDATION_TRANSPORT_DEADLINE');
    if (
      !foundationAllowedRequest(method, path, body, dependencies.ownsWorkflow, dependencies.binding) ||
      typeof key !== 'string' ||
      !key ||
      key.length > 4096 ||
      /[\x00-\x20\x7f]/.test(key)
    )
      fail('FOUNDATION_REQUEST_REJECTED');
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), Math.min(dependencies.timeoutMs ?? 12000, remainingMs));
    let addresses;
    try {
      addresses = validateFoundationAddresses(await lookup(controller.signal));
    } catch {
      clearTimeout(timer);
      fail('FOUNDATION_TRANSPORT_DNS');
    }
    if (controller.signal.aborted || !addresses?.length) {
      clearTimeout(timer);
      fail('FOUNDATION_TRANSPORT_DNS');
    }
    const address = addresses[0];
    return new Promise((done, reject) => {
      let req,
        response,
        assignedSocket,
        socketClosed = false,
        requestClosed = false,
        responseClosed = false,
        failed = false,
        ended = false,
        result,
        settled = false,
        stage = 'TLS',
        closeTimer;
      const failure = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        clearTimeout(closeTimer);
        controller.signal.removeEventListener('abort', abort);
        reject(
          Error(
            'FOUNDATION_TRANSPORT_' +
              (!requestClosed || (response && !responseClosed) || (assignedSocket && !socketClosed)
                ? 'CLOSE'
                : stage),
          ),
        );
      };
      const finish = () => {
        if (!requestClosed || (response && !responseClosed) || (assignedSocket && !socketClosed)) return;
        if (failed || controller.signal.aborted || !assignedSocket || !ended || !result) return failure();
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        clearTimeout(closeTimer);
        controller.signal.removeEventListener('abort', abort);
        done(result);
      };
      const destroy = () => {
        failed = true;
        try {
          response?.destroy();
          req?.destroy();
          assignedSocket?.destroy();
        } catch {}
        if (!closeTimer) closeTimer = setTimeout(failure, dependencies.closeTimeoutMs ?? 5000);
      };
      const abort = () => {
        destroy();
      };
      controller.signal.addEventListener('abort', abort, { once: true });
      try {
        req = send(
          {
            hostname: 'muhhammedsayed.app.n8n.cloud',
            path,
            method,
            agent: false,
            rejectUnauthorized: true,
            minVersion: 'TLSv1.2',
            servername: 'muhhammedsayed.app.n8n.cloud',
            family: address.family,
            lookup: (_host, _opts, callback) => callback(null, address.address, address.family),
            signal: controller.signal,
            headers: {
              'X-N8N-API-KEY': key,
              accept: 'application/json',
              ...(body === null ? {} : { 'content-type': 'application/json' }),
            },
          },
          (res) => {
            response = res;
            stage = 'STATUS';
            const closed = () => {
              responseClosed = true;
              finish();
            };
            res.on('close', closed);
            res.on('aborted', () => destroy());
            res.on('error', () => destroy());
            if (!Number.isInteger(res.statusCode) || res.statusCode < 100 || res.statusCode > 599) {
              destroy();
              return;
            }
            const length = res.headers?.['content-length'];
            const encoding = res.headers?.['content-encoding'],
              transfer = res.headers?.['transfer-encoding'];
            if (
              (encoding !== undefined && encoding !== 'identity') ||
              (transfer !== undefined && (transfer !== 'chunked' || length !== undefined)) ||
              (length !== undefined &&
                (typeof length !== 'string' || !/^(0|[1-9]\d*)$/.test(length) || Number(length) > 524288))
            ) {
              stage = 'BODY';
              destroy();
              return;
            }
            const chunks = [];
            let bytes = 0;
            stage = 'BODY';
            res.on('data', (chunk) => {
              bytes += chunk.length;
              if (bytes > 524288) {
                destroy();
                return;
              }
              chunks.push(chunk);
            });
            res.on('end', () => {
              if (res.complete !== true || (length !== undefined && bytes !== Number(length))) {
                destroy();
                return;
              }
              stage = 'PARSE';
              try {
                result = {
                  status: res.statusCode,
                  body: bytes
                    ? JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)))
                    : {},
                };
                ended = true;
              } catch {
                destroy();
              }
              finish();
            });
          },
        );
        req.on('socket', (socket) => {
          if (assignedSocket) {
            destroy();
            return;
          }
          assignedSocket = socket;
          socket.on('close', () => {
            socketClosed = true;
            finish();
          });
          socket.on('error', destroy);
          socket.on('secureConnect', () => {
            stage = 'STATUS';
          });
        });
        req.on('error', () => destroy());
        req.on('close', () => {
          requestClosed = true;
          finish();
        });
        if (body !== null) req.write(JSON.stringify(body));
        req.end();
      } catch {
        destroy();
      }
    });
  };
}
