import { request as httpsRequest } from 'node:https';
import { resolveInstance } from './inventory.mjs';
import { validateFoundationAddresses } from './foundation-management-transport.mjs';
import { foundationRuntimeRequestAllowed } from './foundation-runtime-control.mjs';
import { randomUUID } from 'node:crypto';

const blocked = () => Error('FOUNDATION_LIVE_MANAGEMENT_BLOCKED');

// A new runtime-only transport. The completed inactive/GW01 consumers and their
// request guards are never changed or repurposed. Returned DTOs stay private.
export function createFoundationLiveManagementTransport(
  { plan, apiKey, sensitiveValues, deadlineAt },
  dependencies = {},
) {
  return privateJsonTransport(
    {
      host: 'muhhammedsayed.app.n8n.cloud',
      apiKey,
      sensitiveValues,
      deadlineAt,
      maxBytes: 524288,
      api: 'n8n',
      allowed: (method, path, body) => foundationRuntimeRequestAllowed(plan, method, path, body),
    },
    dependencies,
  );
}
export function createFoundationLiveProviderReader(
  { token, deadlineAt, admitProviderAttempt },
  dependencies = {},
) {
  if (typeof admitProviderAttempt !== 'function') throw blocked();
  const t = privateJsonTransport(
    {
      host: 'api.apify.com',
      apiKey: token,
      sensitiveValues: [],
      deadlineAt,
      maxBytes: 65536,
      api: 'apify',
      allowed: (method, path, body) =>
        method === 'GET' && body === null && /^\/v2\/actor-runs\/[A-Za-z0-9_-]{1,128}$/.test(path),
    },
    {
      ...dependencies,
      resolveInstance:
        dependencies.resolveInstance ??
        (async () => {
          const { lookup } = await import('node:dns/promises');
          return lookup('api.apify.com', { all: true });
        }),
    },
  );
  return Object.freeze({
    async read({ apifyRunId, signal }) {
      if (typeof apifyRunId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(apifyRunId)) throw blocked();
      const admitted = admitProviderAttempt();
      if (admitted !== undefined) {
        if (admitted?.then) Promise.resolve(admitted).catch(() => {});
        throw blocked();
      }
      const r = await t.send('GET', '/v2/actor-runs/' + apifyRunId, null, signal);
      return {
        body: r.body,
        transport: { requests: 1, retries: 0, socketsClosed: true, runBytesMax: 65536 },
      };
    },
    state: t.state,
    close: t.close,
  });
}
export function createFoundationLiveGatewayProbe(
  { audience, machineToken, protectionBypass, deadlineAt, admitGatewayAttempt },
  dependencies = {},
) {
  if (
    typeof audience !== 'string' ||
    !/^https:\/\/everyone-market-researcher-[a-z0-9-]+\.vercel\.app$/.test(audience) ||
    !/^[A-Za-z0-9_-]{43}$/.test(machineToken) ||
    !/^[A-Za-z0-9]{32}$/.test(protectionBypass) ||
    typeof admitGatewayAttempt !== 'function'
  )
    throw blocked();
  const host = new URL(audience).hostname;
  const dns =
    dependencies.resolveInstance ??
    (async () => {
      const { lookup } = await import('node:dns/promises');
      return lookup(host, { all: true });
    });
  const options = {
    host,
    apiKey: machineToken,
    sensitiveValues: [protectionBypass],
    deadlineAt,
    maxBytes: 524288,
    api: 'gateway',
    extraHeaders: { 'x-vercel-protection-bypass': protectionBypass },
    allowed: (method, path, body) =>
      method === 'POST' &&
      path === '/api/internal/n8n/foundation' &&
      body?.version === 1 &&
      body.operation === 'identity.read' &&
      Object.keys(body).length === 4 &&
      Object.keys(body.args ?? {}).length === 0 &&
      /^[a-f0-9-]{36}$/.test(body.requestId),
  };
  const authorized = privateJsonTransport(options, { ...dependencies, resolveInstance: dns });
  const denied = privateJsonTransport(
    { ...options, api: 'no_machine', statuses: [401, 403] },
    { ...dependencies, resolveInstance: dns },
  );
  return Object.freeze({
    async identity({ unauthorized = false } = {}) {
      const request = { version: 1, requestId: randomUUID(), operation: 'identity.read', args: {} };
      const admitted = admitGatewayAttempt({ requestId: request.requestId, unauthorized });
      if (admitted !== undefined) {
        if (admitted?.then) Promise.resolve(admitted).catch(() => {});
        throw blocked();
      }
      return (unauthorized ? denied : authorized).send('POST', '/api/internal/n8n/foundation', request);
    },
    state() {
      const a = authorized.state(),
        b = denied.state();
      return {
        pendingRequests: a.pendingRequests + b.pendingRequests,
        unclosedResponses: a.unclosedResponses + b.unclosedResponses,
      };
    },
    close() {
      authorized.close();
      denied.close();
    },
  });
}
function privateJsonTransport(
  { host, apiKey, sensitiveValues, deadlineAt, maxBytes, api, allowed, extraHeaders = {}, statuses },
  dependencies,
) {
  if (
    typeof apiKey !== 'string' ||
    !/^[\x21-\x7e]{1,4096}$/.test(apiKey) ||
    !Array.isArray(sensitiveValues) ||
    sensitiveValues.some((v) => typeof v !== 'string' || v.length < 8) ||
    !Number.isFinite(deadlineAt)
  )
    throw blocked();
  const request = dependencies.request ?? httpsRequest;
  const resolve = dependencies.resolveInstance ?? resolveInstance;
  const now = dependencies.now ?? Date.now;
  const timeoutMs = Math.min(dependencies.timeoutMs ?? 15000, 15000);
  const closeTimeoutMs = Math.min(dependencies.closeTimeoutMs ?? 1000, 1000);
  if (
    [request, resolve, now].some((f) => typeof f !== 'function') ||
    timeoutMs <= 0 ||
    closeTimeoutMs <= 0 ||
    deadlineAt <= now()
  )
    throw blocked();
  let key = apiKey;
  const active = new Set(),
    physical = new Set();
  return Object.freeze({
    async send(method, path, body = null, signal) {
      if (
        !key ||
        now() >= deadlineAt ||
        !allowed(method, path, body) ||
        (signal !== undefined && !(signal instanceof AbortSignal)) ||
        signal?.aborted
      )
        throw blocked();
      const controller = new AbortController();
      let req,
        res,
        socket,
        requestClosed = false,
        responseClosed = false,
        socketClosed = false;
      let ended = false,
        result,
        failed = false,
        settled = false,
        closeTimer,
        release,
        rejectResult,
        dnsPending = true;
      const actualClosed = () =>
        !dnsPending && requestClosed && (!res || responseClosed) && (!socket || socketClosed);
      const destroy = () => {
        try {
          res?.destroy();
          req?.destroy();
          socket?.destroy();
        } catch {
          /* fixed failure only */
        }
      };
      const cleanup = () => {
        if (actualClosed()) {
          active.delete(abort);
          physical.delete(abort);
          signal?.removeEventListener('abort', abort);
        }
      };
      const finish = (unknown = false) => {
        if (!unknown && !actualClosed()) return;
        if (unknown) destroy();
        cleanup();
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        clearTimeout(closeTimer);
        if (unknown || failed || !ended || !socket || !result) rejectResult(blocked());
        else release(result);
      };
      const boundClose = () => {
        if (!closeTimer) closeTimer = setTimeout(() => finish(true), closeTimeoutMs);
      };
      const abort = () => {
        failed = true;
        controller.abort();
        destroy();
        if (!req) {
          requestClosed = true;
          finish(true);
        } else boundClose();
      };
      active.add(abort);
      signal?.addEventListener('abort', abort, { once: true });
      const timer = setTimeout(abort, Math.min(timeoutMs, deadlineAt - now()));
      const output = new Promise((done, reject) => {
        release = done;
        rejectResult = reject;
      });
      // Attach a rejection handler before the DNS await so a synchronous abort
      // cannot expose an unhandled error. DNS receives the same abort signal.
      output.catch(() => {});
      let addresses;
      const dns = Promise.resolve().then(() => resolve(controller.signal));
      dns.then(
        () => {
          dnsPending = false;
          cleanup();
        },
        () => {
          dnsPending = false;
          cleanup();
        },
      );
      try {
        addresses = validateFoundationAddresses(await Promise.race([dns, output]));
      } catch {
        failed = true;
        requestClosed = true;
        finish();
        return output;
      }
      if (controller.signal.aborted || !key || now() >= deadlineAt) {
        failed = true;
        requestClosed = true;
        finish();
        return output;
      }
      const selected = addresses[0];
      try {
        req = request(
          {
            hostname: host,
            servername: host,
            port: 443,
            method,
            path,
            rejectUnauthorized: true,
            minVersion: 'TLSv1.2',
            agent: false,
            family: selected.family,
            lookup: (_name, _options, callback) => callback(null, selected.address, selected.family),
            signal: controller.signal,
            headers: {
              ...(api === 'n8n'
                ? { 'X-N8N-API-KEY': key }
                : api === 'no_machine'
                  ? {}
                  : { Authorization: 'Bearer ' + key }),
              ...extraHeaders,
              accept: 'application/json',
              'accept-encoding': 'identity',
              connection: 'close',
              ...(body === null ? {} : { 'content-type': 'application/json' }),
            },
          },
          (response) => {
            res = response;
            physical.add(abort);
            res.on('close', () => {
              responseClosed = true;
              finish();
            });
            res.on('error', abort);
            res.on('aborted', abort);
            const seen = new Set();
            const raw = res.rawHeaders;
            if (!Array.isArray(raw) || raw.length % 2) return abort();
            for (let i = 0; i < raw.length; i += 2) {
              const name = String(raw[i]).toLowerCase();
              if (
                ['content-length', 'transfer-encoding', 'content-encoding', 'content-type'].includes(name)
              ) {
                if (seen.has(name)) return abort();
                seen.add(name);
              }
            }
            const length = res.headers['content-length'],
              transfer = res.headers['transfer-encoding'];
            if (
              !Number.isInteger(res.statusCode) ||
              (statuses
                ? !statuses.includes(res.statusCode)
                : res.statusCode < 200 || res.statusCode >= 300) ||
              (res.headers['content-encoding'] !== undefined &&
                String(res.headers['content-encoding']).toLowerCase() !== 'identity') ||
              (transfer !== undefined &&
                (typeof transfer !== 'string' ||
                  transfer.toLowerCase() !== 'chunked' ||
                  length !== undefined)) ||
              (length !== undefined &&
                (typeof length !== 'string' ||
                  !/^(0|[1-9]\d*)$/.test(length) ||
                  Number(length) > maxBytes)) ||
              typeof res.headers['content-type'] !== 'string' ||
              !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(res.headers['content-type'])
            )
              return abort();
            const chunks = [];
            let bytes = 0;
            res.on('data', (chunk) => {
              if (failed) return;
              const value = Buffer.from(chunk);
              bytes += value.byteLength;
              if (bytes > maxBytes) return abort();
              chunks.push(value);
            });
            res.on('end', () => {
              if (failed) return;
              if (res.complete !== true || (length !== undefined && bytes !== Number(length))) return abort();
              try {
                const text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
                const secrets = [key, ...sensitiveValues];
                if (
                  secrets.some(
                    (v) =>
                      text.includes(v) ||
                      text.includes(Buffer.from(v).toString('base64')) ||
                      text.includes(JSON.stringify(v).slice(1, -1)),
                  )
                )
                  return abort();
                result = { status: res.statusCode, body: JSON.parse(text) };
                ended = true;
                boundClose();
                finish();
              } catch {
                abort();
              }
            });
          },
        );
        req.on('socket', (assigned) => {
          if (socket) return abort();
          socket = assigned;
          physical.add(abort);
          socket.on('error', abort);
          socket.on('close', () => {
            socketClosed = true;
            finish();
          });
          socket.on('secureConnect', () => {
            if (
              socket.authorized !== true ||
              !addresses.some(
                (a) =>
                  a.address === socket.remoteAddress &&
                  a.family === socket.remoteFamily?.replace('IPv', '') * 1,
              )
            )
              abort();
          });
        });
        req.on('error', abort);
        req.on('close', () => {
          requestClosed = true;
          finish();
        });
        if (body !== null) {
          const serialized = JSON.stringify(body);
          if (Buffer.byteLength(serialized) > maxBytes) {
            abort();
            return output;
          }
          req.write(serialized);
        }
        req.end();
      } catch {
        abort();
      }
      return output;
    },
    state: () => Object.freeze({ pendingRequests: active.size, unclosedResponses: physical.size }),
    close() {
      key = null;
      for (const abort of [...active]) abort();
    },
  });
}
