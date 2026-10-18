import { request } from 'node:https';
import { spawn } from 'node:child_process';
import { resolveInstance } from './inventory.mjs';

const fixedIds = ['EmrGw01Canary18', 'EmrGw01Machine18'];
const fail = (code) => {
  throw Error(code);
};
export function runOwnedStdinChild(spec, dependencies = {}) {
  const start = dependencies.spawn ?? spawn;
  return new Promise((done) => {
    let child,
      closed = false,
      settled = false,
      timedOut = false,
      startFailed = false,
      closeTimer;
    const finish = (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(closeTimer);
      done({
        ok: closed && code === 0 && !timedOut && !startFailed,
        childClosed: closed,
        code: !closed
          ? 'GW01_CHILD_CLEANUP_UNVERIFIED'
          : timedOut
            ? 'GW01_CHILD_TIMEOUT'
            : startFailed
              ? 'GW01_CHILD_START_FAILED'
              : code === 0
                ? 'closed'
                : 'GW01_CHILD_NATIVE_FAILURE',
      });
    };
    const stop = (timeout = true) => {
      timedOut = timeout;
      try {
        child?.kill('SIGKILL');
      } catch {}
      closeTimer = setTimeout(() => finish(null), dependencies.closeTimeoutMs ?? 5000);
    };
    const timer = setTimeout(stop, dependencies.timeoutMs ?? 20000);
    try {
      child = start(spec.executable, spec.args, {
        cwd: spec.cwd,
        env: spec.env,
        stdio: ['pipe', 'ignore', 'ignore'],
        windowsHide: true,
      });
      child.on('error', () => {
        startFailed = true;
      });
      child.on('close', (code) => {
        closed = true;
        finish(code);
      });
      child.stdin.on('error', () => {});
      child.stdin.end(spec.value);
    } catch {
      startFailed = true;
      if (child === undefined) {
        closed = true;
        finish(null);
      } else stop(false);
    }
  });
}

// Fixed endpoint, bounded all-public OS DNS, pinned TLS hostname, no redirects.
// Only finite failure stages escape; body/header/native error text never does.
export function managementTransport(dependencies = {}) {
  const lookup = dependencies.resolveInstance ?? resolveInstance;
  const send = dependencies.request ?? request;
  const owned = dependencies.owned;
  return async (method, path, body, key) => {
    if (
      typeof key !== 'string' ||
      !key ||
      key.length > 4096 ||
      /[\x00-\x1f\x7f]/.test(key) ||
      !['GET', 'POST', 'DELETE'].includes(method) ||
      !(
        (path === '/api/v1/credentials/schema/httpCustomAuth' && method === 'GET') ||
        (path === '/api/v1/credentials' && method === 'POST') ||
        (fixedIds.some((id) => path === '/api/v1/credentials/' + id) && ['GET', 'DELETE'].includes(method)) ||
        (method === 'GET' &&
          owned &&
          [
            '/api/v1/workflows/' + owned.workflowId,
            '/api/v1/executions/' + owned.executionId + '?includeData=true',
          ].includes(path))
      )
    )
      fail('GW01_DELIVERY_REJECTED');
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), dependencies.timeoutMs ?? 12000);
    let addresses;
    try {
      addresses = await lookup(controller.signal);
    } catch {
      clearTimeout(timer);
      fail('GW01_TRANSPORT_DNS');
    }
    if (controller.signal.aborted || !addresses?.length) {
      clearTimeout(timer);
      fail('GW01_TRANSPORT_DNS');
    }
    const address = addresses[0];
    return new Promise((done, reject) => {
      let req,
        response,
        requestClosed = false,
        responseClosed = false,
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
          Error('GW01_TRANSPORT_' + (!requestClosed || (response && !responseClosed) ? 'CLOSE' : stage)),
        );
      };
      const finish = () => {
        if (!requestClosed || (response && !responseClosed)) return;
        if (!ended || !result) return failure();
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        clearTimeout(closeTimer);
        controller.signal.removeEventListener('abort', abort);
        done(result);
      };
      const destroy = () => {
        try {
          response?.destroy();
          req?.destroy();
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
            if (
              length !== undefined &&
              (typeof length !== 'string' || !/^(0|[1-9]\d*)$/.test(length) || Number(length) > 524288)
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
                  body: bytes ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {},
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
