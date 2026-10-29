import { createHash, createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { createCampaignConflictHandler } from './m06-campaign-conflict';
import type { CollectorDispatch } from './n8n-worker/collectors';
const secret = 'synthetic-provider-webhook-secret';
const id = '90000000-0000-4000-8000-000000000001';
const origin = 'https://everyone-market-researcher-synthetic.vercel.app';
const now = Date.parse('2026-10-31T04:00:00Z');
const env = {
  VERCEL_ENV: 'preview',
  VERCEL_GIT_COMMIT_REF: 'm06-stories-campaign',
  VERCEL_PROJECT_ID: 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
  VERCEL_URL: new URL(origin).host,
  VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40),
  EMR_COLLECTORS_COMMIT_SHA: 'a'.repeat(40),
  VERCEL_DEPLOYMENT_ID: 'dpl_synthetic',
  EMR_COLLECTORS_ENABLED: 'true',
  EMR_COLLECTORS_WRITER_PASSWORD: 'synthetic-writer',
  EMR_COLLECTORS_APIFY_READ_TOKEN: 'synthetic-read',
  EMR_COLLECTORS_TOKEN_SHA256: createHash('sha256').update('synthetic').digest('hex'),
  EMR_COLLECTORS_ACCOUNT_IDS: JSON.stringify([id]),
  EMR_COLLECTORS_LIVE_POLICY: JSON.stringify({
    approval_id: id,
    max_actor_starts: 40,
    max_actor_usd: 6,
    max_total_usd: 240,
    max_results_per_profile: 50,
    actors: {},
  }),
  EMR_M06_CONFLICT_SECRET: secret,
};
function request(change: Record<string, unknown> = {}, signed = true) {
  const body = JSON.stringify({
    id: 'event1',
    type: 'deployment.created',
    createdAt: now,
    payload: {
      project: { id: env.VERCEL_PROJECT_ID },
      target: 'production',
      deployment: { id: 'dpl_synthetic' },
    },
    ...change,
  });
  return new Request(origin + '/api/internal/m06/production-conflict', {
    method: 'POST',
    headers: {
      'x-vercel-signature': signed ? createHmac('sha1', secret).update(body).digest('hex') : 'a'.repeat(40),
    },
    body,
  });
}
describe('campaign-specific Production conflict observation', () => {
  const setup = (environment = env) => {
    const dispatch = vi.fn<CollectorDispatch>(async () => ({ replayed: false, result: { paused: true } }));
    return {
      dispatch,
      handler: createCampaignConflictHandler({ environment: () => environment, dispatch, now: () => now }),
    };
  };
  it('pauses only the configured dev campaign after exact signed provider metadata', async () => {
    const t = setup();
    expect((await t.handler(request())).status).toBe(200);
    expect(t.dispatch).toHaveBeenCalledWith(
      'event1',
      'm06.campaign_conflict',
      {
        campaign_id: id,
        event_id: 'event1',
        deployment_id: 'dpl_synthetic',
        observed_at: '2026-10-31T04:00:00.000Z',
      },
      expect.objectContaining({ scope: 'm06' }),
      expect.any(AbortSignal),
    );
  });
  it('acknowledges a signed Preview event without changing the campaign', async () => {
    const t = setup();
    expect(
      (
        await t.handler(
          request({
            payload: {
              project: { id: env.VERCEL_PROJECT_ID },
              target: null,
              deployment: { id: 'dpl_synthetic' },
            },
          }),
        )
      ).status,
    ).toBe(200);
    expect(t.dispatch).not.toHaveBeenCalled();
  });
  it.each([
    {},
    { type: 'project.created' },
    { createdAt: now - 86400001 },
    { createdAt: now + 30001 },
    { payload: { project: { id: 'foreign' }, target: 'production', deployment: { id: 'dpl_synthetic' } } },
  ])('rejects forged, stale or unrelated events before SQL', async (change) => {
    const t = setup();
    const forged = Object.keys(change).length === 0;
    expect((await t.handler(request(change, !forged))).status).toBe(403);
    expect(t.dispatch).not.toHaveBeenCalled();
  });
  it('refuses Production deployment of this monitor', async () => {
    const t = setup({ ...env, VERCEL_ENV: 'production' });
    expect((await t.handler(request())).status).toBe(403);
    expect(t.dispatch).not.toHaveBeenCalled();
  });
  it('does not acknowledge a Production conflict before a verified durable pause receipt', async () => {
    const t = setup();
    t.dispatch.mockResolvedValueOnce({ replayed: false, result: null });
    expect((await t.handler(request())).status).toBe(403);
  });
});
