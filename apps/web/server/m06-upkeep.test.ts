// @vitest-environment node
import { createHash } from 'node:crypto';
import { describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { createUpkeepHandler, renderUpkeepHealth, upkeepConfig } from './m06-upkeep';
import type { UpkeepDispatch } from './m06-upkeep-contracts';
import { upkeepAccountIds } from '@emr/shared';
const id = '11111111-1111-4111-a111-111111111111',
  competitor = '22222222-2222-4222-a222-222222222222';
const token = 'synthetic-upkeep-local-token-00000000000000';
const origin = 'https://everyone-market-researcher-synthetic.vercel.app';
const now = '2026-10-29T12:00:00Z';
const since = '2026-07-31',
  metricsSince = '2026-09-29';
const env = {
  VERCEL_ENV: 'preview',
  VERCEL_GIT_COMMIT_REF: 'm06-upkeep-local',
  VERCEL_PROJECT_ID: 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
  VERCEL_URL: new URL(origin).host,
  VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40),
  VERCEL_DEPLOYMENT_ID: 'dpl_synthetic',
  EMR_UPKEEP_ENABLED: 'true',
  EMR_UPKEEP_COMMIT_SHA: 'a'.repeat(40),
  EMR_UPKEEP_TOKEN_SHA256: createHash('sha256').update(token).digest('hex'),
  EMR_UPKEEP_WRITER_PASSWORD: 'synthetic-not-network',
  EMR_UPKEEP_ACCOUNT_IDS: JSON.stringify([id]),
};
const target = {
  account_id: id,
  competitor_id: competitor,
  platform: 'vimeo',
  handle: 'fixturefilms',
  url: 'https://vimeo.com/fixturefilms',
  external_id: '42',
  uploads_playlist_id: null,
  since,
  metrics_since: metricsSince,
  observed_before: now,
  known_external_ids: ['101', '102'],
};
const result = {
  account_id: id,
  platform: 'vimeo',
  since,
  metrics_since: metricsSince,
  metrics_updated: 1,
  eligible: true,
  reason: null,
  removal: { removed: 1, restored: 0, skipped: null },
};
const health = {
  failing_accounts: [],
  stale_accounts: [],
  queues: { ai_extract: 0, embed: 0, media: 267 },
  items_new_yesterday: {},
  cost_yesterday: { total: 0, by_provider: {} },
  budget: { daily_budget_usd: 25, over_budget: false },
  month_to_date_usd: 0,
  forecast_month_usd: 0,
  workflow_errors_24h: {},
  zero_item_streaks: [],
  story_capture_gap: null,
  media_missing_24h: 1,
};
const video = {
  uri: '/videos/101',
  link: 'https://vimeo.com/101',
  privacy: { view: 'anybody' },
  release_time: '2026-10-28T00:00:00Z',
  created_time: '2026-10-28T00:00:00Z',
  duration: 30,
  name: 'Controlled official-response fixture',
  user: { uri: '/users/42' },
  stats: { plays: 7 },
};
function setup(overrides: { environment?: typeof env; dispatch?: UpkeepDispatch } = {}) {
  const source = vi.fn(async () => ({
    status: 200,
    body: { data: [video], page: 1, per_page: 100, paging: { next: null } },
  }));
  const dispatch = vi.fn<UpkeepDispatch>(
    overrides.dispatch ??
      (async (operation) =>
        operation === 'targets'
          ? [target]
          : operation === 'status'
            ? { state: 'missing', operation: null, result: null }
            : operation === 'health'
              ? health
              : { replayed: false, result }),
  );
  const handler = createUpkeepHandler({
    environment: () => overrides.environment ?? env,
    database: () => dispatch,
    sources: () => ({ request: source }),
    now: () => now,
  });
  return { source, dispatch, handler };
}
function req(
  operation = 'account.process',
  args: unknown = { account_id: id, platform: 'vimeo', since, metrics_since: metricsSince },
  extra: Record<string, unknown> = {},
) {
  return new Request(origin + '/api/internal/m06/upkeep', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
    body: JSON.stringify({ version: 1, requestId: id, operation, args, ...extra }),
  });
}
describe('M06 concrete upkeep boundary', () => {
  it('qualifies the actual local configuration', () => {
    expect(typeof upkeepAccountIds?.parse).toBe('function');
    expect(upkeepAccountIds.parse(JSON.parse(env.EMR_UPKEEP_ACCOUNT_IDS))).toEqual([id]);
    expect(upkeepConfig(env).audience).toBe(origin);
  });
  it('derives coverage from authenticated source pages and sends only validated values to atomic SQL', async () => {
    const s = setup();
    const r = await s.handler(req());
    expect(r.status).toBe(200);
    expect((await r.json()).result).toEqual(result);
    expect(s.source).toHaveBeenCalledOnce();
    const apply = s.dispatch.mock.calls.find((c) => c[0] === 'apply')![1];
    expect(apply.seen_external_ids).toEqual(['101']);
    expect(apply.observed_before).toBe(now);
    expect(apply.rows).toEqual([
      { external_id: '101', metrics: { plays: 7 }, observed_at: '2026-10-29T12:00:00.000Z' },
    ]);
  });
  it.each(['production', 'development'])(
    'refuses %s and the frozen campaign before source or SQL I/O',
    async (mode) => {
      const s = setup({ environment: { ...env, VERCEL_ENV: mode } });
      expect((await s.handler(req())).status).toBe(503);
      expect(s.dispatch).not.toHaveBeenCalled();
      expect(s.source).not.toHaveBeenCalled();
      expect(() => upkeepConfig({ ...env, VERCEL_GIT_COMMIT_REF: 'm06-stories-campaign' })).toThrow();
    },
  );
  it('does not accept a caller-authored complete receipt or an extra source URL', async () => {
    const s = setup();
    const r = await s.handler(
      req('account.process', {
        account_id: id,
        platform: 'vimeo',
        since,
        metrics_since: metricsSince,
        complete: true,
        receipt: {},
        url: 'https://example.com',
      }),
    );
    expect(r.status).toBe(400);
    expect(s.dispatch).not.toHaveBeenCalled();
    expect(s.source).not.toHaveBeenCalled();
  });
  it('rejects unauthenticated and unselected accounts before any source operation', async () => {
    const s = setup();
    const bad = req();
    bad.headers.set('authorization', 'Bearer invalid');
    expect((await s.handler(bad)).status).toBe(401);
    expect(s.dispatch).not.toHaveBeenCalled();
    expect(
      (
        await s.handler(
          req('account.process', {
            account_id: competitor,
            platform: 'vimeo',
            since,
            metrics_since: metricsSince,
          }),
        )
      ).status,
    ).toBe(403);
    expect(s.source).not.toHaveBeenCalled();
  });
  it('reads durable committed replay without another source fetch or mutation', async () => {
    const s = setup({
      dispatch: async () => ({ state: 'completed', operation: 'apply_observation', result }),
    });
    const r = await s.handler(req());
    expect(r.status).toBe(200);
    expect((await r.json()).replayed).toBe(true);
    expect(s.dispatch).toHaveBeenCalledOnce();
    expect(s.source).not.toHaveBeenCalled();
  });
  it('blocks changed account/window reuse of the same completed request', async () => {
    const s = setup({
      dispatch: async () => ({ state: 'completed', operation: 'apply_observation', result }),
    });
    expect(
      (
        await s.handler(
          req('account.process', {
            account_id: id,
            platform: 'vimeo',
            since: '2026-08-01',
            metrics_since: metricsSince,
          }),
        )
      ).status,
    ).toBe(503);
    expect(s.source).not.toHaveBeenCalled();
  });
  it('requires a current server-selected target window', async () => {
    const s = setup();
    expect(
      (
        await s.handler(
          req('account.process', {
            account_id: id,
            platform: 'vimeo',
            since: '2026-08-01',
            metrics_since: metricsSince,
          }),
        )
      ).status,
    ).toBe(409);
    expect(s.source).not.toHaveBeenCalled();
  });
  it('does not retry or expose a private error after uncertain SQL', async () => {
    const s = setup({
      dispatch: async (op) => {
        if (op === 'targets') return [target];
        if (op === 'status') return { state: 'missing', operation: null, result: null };
        throw Error('synthetic-private-detail');
      },
    });
    const r = await s.handler(req());
    expect(r.status).toBe(503);
    expect(JSON.stringify(await r.json())).not.toContain('synthetic-private');
    expect(s.dispatch.mock.calls.filter((c) => c[0] === 'apply')).toHaveLength(1);
  });
  it('keeps incomplete/empty listings from removal while recording an honest outcome', async () => {
    const s = setup();
    s.source.mockResolvedValue({
      status: 200,
      body: { data: [], page: 1, per_page: 100, paging: { next: null } },
    });
    await s.handler(req());
    const applied = s.dispatch.mock.calls.find((c) => c[0] === 'apply')![1];
    expect(applied.seen_external_ids).toBeNull();
    expect(applied.skip_reason).toBe('empty_listing');
  });
  it('connects maintained health read to local rendering, never email or false queue/gap values', async () => {
    const s = setup();
    const r = await s.handler(req('health.read', {}));
    expect(r.status).toBe(200);
    const b = await r.json();
    expect(b.result.sent).toBe(false);
    expect(b.result.delivery).toBe('local_only');
    expect(b.result.projection.story_capture_gap).toBeNull();
    expect(b.result.rendered.text).toContain('Dedicated story queue depth: Unknown');
    expect(s.source).not.toHaveBeenCalled();
    expect(() => renderUpkeepHealth({ ...health, raw_error: 'private' })).toThrow();
  });
});
