// @vitest-environment node
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { createWorkerHandler } from './dispatcher';
import { gatewayConfig } from './auth';
import { gatewayRequest, trialWindowId } from '@emr/shared';

const origin = 'https://everyone-market-researcher-test.vercel.app';
const token = 'synthetic-gw01-token-for-local-canaries-only';
const requestId = 'e62e7289-28ca-4387-a071-6f327837ea01';
const environment = {
  VERCEL_ENV: 'preview',
  VERCEL_GIT_COMMIT_REF: 'm03-n8n-foundation',
  VERCEL_PROJECT_ID: 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
  VERCEL_URL: new URL(origin).host,
  EMR_WORKER_GATEWAY_ENABLED: 'true',
  EMR_WORKER_GATEWAY_AUDIENCE: 'vercel-deployment',
  EMR_WORKER_GATEWAY_COMMIT_SHA: 'a'.repeat(40),
  VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40),
  VERCEL_DEPLOYMENT_ID: 'dpl_synthetic',
  EMR_WORKER_GATEWAY_WINDOW_ID: '76c2ad42-c094-4ba4-9a0b-566e19b97780',
  EMR_WORKER_GATEWAY_TOKEN_SHA256: createHash('sha256').update(token).digest('hex'),
  EMR_WORKER_DB_PASSWORD: 'synthetic-password-never-used-for-network',
};
const window = {
  id: trialWindowId,
  startsAt: '2026-10-18T08:00:00Z',
  expiresAt: '2026-10-18T08:30:00Z',
  closed: false,
  totalAdmitted: 1,
  boundAudience: origin,
  boundCommitSha: 'a'.repeat(40),
  boundDeploymentId: 'dpl_synthetic',
};
const identity = {
  currentUser: 'n8n_writer',
  sessionUser: 'n8n_writer',
  database: 'postgres',
  projectRef: 'zmotjsbzhzjvpelxvxlf',
  connectionCount: 1,
};
const body = () => ({ version: 1, requestId, operation: 'identity.read', args: {} });
function request(value: unknown = body(), headers: Record<string, string> = {}, url = origin) {
  return new Request(url + '/api/internal/n8n/rpc', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...headers },
    body: JSON.stringify(value),
  });
}
function setup(env = environment) {
  const dispatch = vi.fn(async (input: unknown) => {
    void input;
    return {
      state: 'completed',
      code: null,
      result: identity,
      window,
    };
  });
  const log = vi.fn();
  const handler = createWorkerHandler({ environment: () => env, dispatch, log });
  return { handler, dispatch, log };
}
describe('GW-01 fixed trust boundaries', () => {
  it('accepts only strict envelopes and rejects caller-selected routing and arbitrary operations', () => {
    expect(gatewayRequest(body()).operation).toBe('identity.read');
    for (const value of [
      { ...body(), host: 'private' },
      { ...body(), args: { sql: 'select 1' } },
      { ...body(), operation: 'query' },
      { ...body(), env: 'prod' },
    ])
      expect(() => gatewayRequest(value)).toThrow('invalid_request');
  });
  it('rejects status targeting its own UUID regardless of letter case', () => {
    expect(() =>
      gatewayRequest({
        ...body(),
        operation: 'request.status',
        args: { targetRequestId: requestId.toUpperCase() },
      }),
    ).toThrow('invalid_request');
  });
  it('denies disabled, Production, wrong branch/project/window and foreign audience before dispatch', async () => {
    for (const patch of [
      { EMR_WORKER_GATEWAY_ENABLED: 'false' },
      { VERCEL_ENV: 'production' },
      { VERCEL_GIT_COMMIT_REF: 'main' },
      { VERCEL_PROJECT_ID: 'other' },
      { EMR_WORKER_GATEWAY_WINDOW_ID: requestId },
      { VERCEL_GIT_COMMIT_SHA: 'b'.repeat(40) },
      { VERCEL_DEPLOYMENT_ID: 'invalid' },
    ]) {
      const s = setup({ ...environment, ...patch });
      expect((await s.handler(request())).status).toBe(503);
      expect(s.dispatch).not.toHaveBeenCalled();
    }
    expect(gatewayConfig(environment).audience).toBe(origin);
    const s = setup();
    expect((await s.handler(request(body(), {}, 'https://foreign.vercel.app'))).status).toBe(403);
    expect(s.dispatch).not.toHaveBeenCalled();
  });
  it('rejects invalid machine authentication and query strings without emitting canary values', async () => {
    const s = setup();
    const canary = 'private-canary-do-not-echo';
    for (const authorization of ['', `Bearer ${canary}`, `Basic ${canary}`])
      expect((await s.handler(request(body(), { authorization }))).status).toBe(401);
    const q = new Request(origin + '/api/internal/n8n/rpc?bypass=canary', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify(body()),
    });
    expect((await s.handler(q)).status).toBe(403);
    expect(JSON.stringify(s.log.mock.calls)).not.toContain(canary);
    expect(s.dispatch).not.toHaveBeenCalled();
  });
  it('bounds UTF-8 streamed bodies, content length and encoding before SQL', async () => {
    const s = setup();
    expect((await s.handler(request(body(), { 'content-encoding': 'gzip' }))).status).toBe(415);
    expect((await s.handler(request(body(), { 'content-length': '1048577' }))).status).toBe(413);
    expect((await s.handler(request(body(), { 'content-length': '1' }))).status).toBe(400);
    const huge = new Request(origin + '/api/internal/n8n/rpc', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: 'x'.repeat(1048577),
    });
    expect((await s.handler(huge)).status).toBe(413);
    expect(s.dispatch).not.toHaveBeenCalled();
  });
  it('executes a permitted identity read and logs only the closed projection', async () => {
    const s = setup();
    const r = await s.handler(request());
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ version: 1, requestId, outcome: 'completed', result: identity, window });
    expect(r.headers.get('cache-control')).toContain('no-store');
    expect(s.dispatch).toHaveBeenCalledTimes(1);
    const logs = JSON.stringify(s.log.mock.calls);
    expect(logs).not.toContain(token);
    expect(logs).not.toContain('synthetic-password');
    expect(logs).not.toContain('result');
  });
  it('fails closed for future actor/cost operations and unvalidated SQL results', async () => {
    const s = setup();
    expect(
      (await s.handler(request({ ...body(), operation: 'fees.accrue', args: { day: '2026-10-18' } }))).status,
    ).toBe(403);
    expect(s.dispatch).not.toHaveBeenCalled();
    s.dispatch.mockResolvedValueOnce({
      state: 'completed',
      code: null,
      result: { ...identity, password: 'private-canary' },
      window,
    } as never);
    const r = await s.handler(request());
    expect(r.status).toBe(503);
    expect(await r.text()).not.toContain('private-canary');
  });
  it('never exposes raw transport errors or reports a timeout as rollback', async () => {
    const s = setup();
    s.dispatch.mockRejectedValueOnce(new Error('postgres://owner:synthetic-password-canary@db.invalid'));
    const r = await s.handler(request());
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ requestId, error: { code: 'outcome_unknown' } });
    expect(JSON.stringify(s.log.mock.calls)).not.toContain('synthetic-password-canary');
  });
  it('status lookup preserves a separate envelope ID and original target', async () => {
    const s = setup();
    const target = 'e62e7289-28ca-4387-a071-6f327837ea02';
    s.dispatch.mockResolvedValueOnce({ state: 'absent', code: null, result: null, window } as never);
    const r = await s.handler(
      request({ ...body(), operation: 'request.status', args: { targetRequestId: target } }),
    );
    expect(r.status).toBe(200);
    expect(s.dispatch.mock.calls[0]![0]).toMatchObject({
      requestId,
      operation: 'request.status',
      args: { targetRequestId: target },
    });
    expect(
      (
        await s.handler(
          request({ ...body(), operation: 'request.status', args: { targetRequestId: requestId } }),
        )
      ).status,
    ).toBe(400);
  });
  it('never dispatches a Request that was already aborted', async () => {
    const s = setup();
    const controller = new AbortController();
    controller.abort();
    const req = new Request(request(), { signal: controller.signal });
    expect((await s.handler(req)).status).toBe(503);
    expect(s.dispatch).not.toHaveBeenCalled();
  });
});
