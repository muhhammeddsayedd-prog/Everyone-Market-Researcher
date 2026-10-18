// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { createFoundationHandler, foundationConfig } from './foundation';
import { createHash } from 'node:crypto';
import { foundationWindowId } from '@emr/shared';
const token = 'synthetic_token_only_local_1234567890';
const audience = 'https://everyone-market-researcher-test.vercel.app';
const env = {
  EMR_M03_FOUNDATION_ENABLED: 'true',
  VERCEL_ENV: 'preview',
  VERCEL_GIT_COMMIT_REF: 'm03-n8n-foundation',
  VERCEL_PROJECT_ID: 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
  EMR_M03_FOUNDATION_WINDOW_ID: foundationWindowId,
  EMR_M03_FOUNDATION_WRITER_PASSWORD: 'synthetic-local-only',
  EMR_M03_FOUNDATION_TOKEN_SHA256: createHash('sha256').update(token).digest('hex'),
  EMR_M03_FOUNDATION_AUDIENCE: 'vercel-deployment',
  VERCEL_URL: audience.slice(8),
  VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40),
  EMR_M03_FOUNDATION_COMMIT_SHA: 'a'.repeat(40),
  VERCEL_DEPLOYMENT_ID: 'dpl_synthetic',
  EMR_M03_FOUNDATION_APIFY_READ_TOKEN: 'synthetic-local-reader',
};
const requestId = '0d83a7d6-0cb5-4f5f-a9cd-c604d5b5558a';
const window = {
  id: foundationWindowId,
  startsAt: null,
  expiresAt: null,
  closed: false,
  totalAdmitted: 1,
  boundAudience: audience,
  boundCommitSha: 'a'.repeat(40),
  boundDeploymentId: 'dpl_synthetic',
};
const input = {
  version: 1,
  requestId,
  operation: 'run.start',
  args: { workflow: 'WF-99', platform: 'website_work_page', mode: 'manual', env: 'dev', executionId: '42' },
};
const request = (body: unknown = input, path = '/api/internal/n8n/foundation') =>
  new Request(audience + path, {
    method: 'POST',
    headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
describe('closed foundation deployment admission', () => {
  it('requires separate variables and cannot reuse the closed GW01 window or run in production', () => {
    expect(foundationConfig(env)).toMatchObject({ windowId: foundationWindowId, audience });
    for (const patch of [
      { VERCEL_ENV: 'production' },
      { EMR_M03_FOUNDATION_ENABLED: 'false' },
      { EMR_M03_FOUNDATION_WINDOW_ID: '76c2ad42-c094-4ba4-9a0b-566e19b97780' },
      { EMR_M03_FOUNDATION_COMMIT_SHA: 'b'.repeat(40) },
    ])
      expect(() => foundationConfig({ ...env, ...patch })).toThrow('unavailable');
  });
  it('returns typed fresh and durable receipts without serializing raw failure context', async () => {
    const log = vi.fn(),
      dispatch = vi.fn(async () => ({
        state: 'completed',
        code: null,
        operation: 'run.start',
        replayed: false,
        result: { run_id: requestId },
        window,
      }));
    const handle = createFoundationHandler({ environment: () => env, dispatch, log });
    const r = await handle(request());
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({
      operation: 'run.start',
      replayed: false,
      result: { run_id: requestId },
    });
    const bad = await handle(request({ ...input, args: { ...input.args, sql: 'select 1' } }));
    expect(bad.status).toBe(400);
    expect(dispatch).toHaveBeenCalledTimes(1);
    const wrong = await handle(request(input, '/api/internal/n8n/rpc'));
    expect(wrong.status).toBe(403);
    dispatch.mockRejectedValueOnce(new Error('private-canary'));
    const failed = await handle(request());
    expect(await failed.text()).not.toContain('private-canary');
    expect(JSON.stringify(log.mock.calls)).not.toContain('private-canary');
  });
});
