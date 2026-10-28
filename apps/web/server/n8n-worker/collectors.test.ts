// @vitest-environment node
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { createCollectorHandler, collectorConfig, type CollectorDispatch } from './collectors';
import { collectorRequest } from '@emr/shared';

const token = 'synthetic-collector-token-for-local-tests-only';
const id = '27000000-0000-4000-8000-000000000001';
const origin = 'https://everyone-market-researcher-synthetic.vercel.app';
const environment = {
  VERCEL_ENV: 'preview',
  VERCEL_GIT_COMMIT_REF: 'm04-collectors-vimeo-instagram',
  VERCEL_PROJECT_ID: 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
  VERCEL_URL: new URL(origin).host,
  VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40),
  VERCEL_DEPLOYMENT_ID: 'dpl_synthetic',
  EMR_COLLECTORS_ENABLED: 'true',
  EMR_COLLECTORS_COMMIT_SHA: 'a'.repeat(40),
  EMR_COLLECTORS_WRITER_PASSWORD: 'synthetic-not-used-for-network',
  EMR_COLLECTORS_TOKEN_SHA256: createHash('sha256').update(token).digest('hex'),
  EMR_COLLECTORS_APIFY_READ_TOKEN: 'synthetic-read-token',
  EMR_COLLECTORS_ACCOUNT_IDS: JSON.stringify([id]),
};
function req(
  operation = 'start',
  args: unknown = {
    workflow: 'WF-10',
    platform: 'vimeo',
    mode: 'backfill',
    env: 'dev',
    execution_id: 'local-27',
  },
) {
  return new Request(origin + '/api/internal/n8n/collectors', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
    body: JSON.stringify({ version: 1, requestId: id, operation, args }),
  });
}
function setup(env = environment) {
  const dispatch = vi.fn<CollectorDispatch>(async () => ({ replayed: false, result: { run_id: id } }));
  const processCallback = vi.fn(async () => ({ state: 'completed', updated: false }));
  return {
    dispatch,
    processCallback,
    handler: createCollectorHandler({ environment: () => env, dispatch, processCallback }),
  };
}
describe('M04 fixed collector gateway, local HTTP integration', () => {
  it('isolates M05 operations by exact Preview branch and rejects public registry reads', async () => {
    const old = setup();
    expect((await old.handler(req('m05.quota', { quota_day: '2026-10-28', quantity: 0 }))).status).toBe(403);
    const next = setup({ ...environment, VERCEL_GIT_COMMIT_REF: 'm05-collectors-web-youtube-linkedin' });
    expect((await next.handler(req('m05.quota', { quota_day: '2026-10-28', quantity: 0 }))).status).toBe(200);
    expect((await next.handler(req('m05.lookup', { apify_run_id: 'unselectedActor' }))).status).toBe(400);
    expect((await next.handler(req())).status).toBe(403);
    expect(
      (
        await next.handler(
          req('m05.execution.error', {
            workflow_id: 'F7S8Llr0ZSaSuw4T',
            execution_id: '300',
            error_code: 'workflow_failed',
            message: 'private',
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await next.handler(
          req('m05.execution.error', {
            workflow_id: 'F7S8Llr0ZSaSuw4T',
            execution_id: '300',
            error_code: 'workflow_failed',
          }),
        )
      ).status,
    ).toBe(200);
  });
  it('accepts only a fixed classified error envelope for owned workflow identities', async () => {
    const t = setup();
    const args = { workflow_id: 'TsqSMa5MlO3QBLkt', execution_id: '314', error_code: 'callback_retryable' };
    expect((await t.handler(req('execution.error', args))).status).toBe(200);
    expect(t.dispatch).toHaveBeenCalledWith(
      id,
      'execution.error',
      args,
      expect.any(Object),
      expect.any(AbortSignal),
    );
    for (const extra of [{ message: 'private text' }, { stack: 'private stack' }, { run_id: id }]) {
      expect((await t.handler(req('execution.error', { ...args, ...extra }))).status).toBe(400);
    }
    expect((await t.handler(req('execution.error', { ...args, workflow_id: 'unrelated' }))).status).toBe(400);
    expect(t.dispatch).toHaveBeenCalledTimes(1);
  });
  it('connects a validated owned start request to the database adapter', async () => {
    const t = setup();
    const r = await t.handler(req());
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({
      requestId: id,
      operation: 'start',
      replayed: false,
      result: { run_id: id },
    });
    expect(t.dispatch).toHaveBeenCalledTimes(1);
  });
  it.each(['production', 'development'])('denies %s target before dispatch', async (target) => {
    const t = setup({ ...environment, VERCEL_ENV: target });
    expect((await t.handler(req())).status).toBe(503);
    expect(t.dispatch).not.toHaveBeenCalled();
  });
  it('denies another branch or a mismatched source commit', () => {
    expect(() => collectorConfig({ ...environment, VERCEL_GIT_COMMIT_REF: 'main' })).toThrow();
    expect(() => collectorConfig({ ...environment, EMR_COLLECTORS_COMMIT_SHA: 'b'.repeat(40) })).toThrow();
  });
  it.each(['settle', 'stage', 'lookup', 'sql', 'rpc'])(
    'never exposes private %s operation',
    async (operation) => {
      const t = setup();
      expect((await t.handler(req(operation, {}))).status).toBe(400);
      expect(t.dispatch).not.toHaveBeenCalled();
    },
  );
  it('requires an exact account allowlist for claims', async () => {
    const t = setup();
    const r = await t.handler(
      req('claim', {
        run_id: id,
        platform: 'vimeo',
        limit: 1,
        mode: 'backfill',
        account_ids: ['27000000-0000-4000-8000-000000000002'],
      }),
    );
    expect(r.status).toBe(403);
    expect(t.dispatch).not.toHaveBeenCalled();
  });
  it('does not interpret callback-supplied dataset, cost, actor or groups', async () => {
    const t = setup();
    const r = await t.handler(
      req('callback.process', { apify_run_id: 'syntheticRun', usage_usd: 0, groups: [] }),
    );
    expect(r.status).toBe(400);
    expect(t.processCallback).not.toHaveBeenCalled();
  });
  it('keeps actor starts disabled without an approved server policy', async () => {
    const t = setup();
    const r = await t.handler(
      req('launch', {
        run_id: id,
        launch_id: id,
        actor_id: 'apify/instagram-scraper',
        pass: 'posts',
        purpose: 'backfill',
        account_ids: [id],
        results_limit: 5,
      }),
    );
    expect(r.status).toBe(403);
    expect(t.dispatch).not.toHaveBeenCalled();
  });
  it('rejects batches outside the connected native actor/page bounds before a launch intent', () => {
    const launch = {
      run_id: id,
      launch_id: id,
      actor_id: 'apify/instagram-scraper',
      pass: 'posts',
      purpose: 'backfill',
      account_ids: Array.from(
        { length: 11 },
        (_, n) => `27000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
      ),
      results_limit: 3000,
    };
    const input = (args: unknown) => ({ version: 1, requestId: id, operation: 'launch', args });
    expect(() => collectorRequest(input(launch))).toThrow();
    expect(() =>
      collectorRequest(input({ ...launch, account_ids: launch.account_ids.slice(0, 10) })),
    ).not.toThrow();
    expect(() =>
      collectorRequest(input({ ...launch, purpose: 'daily', account_ids: [id], results_limit: 31 })),
    ).toThrow();
    expect(() =>
      collectorRequest(
        input({
          ...launch,
          actor_id: 'goat255/vimeo-scraper',
          pass: 'primary',
          purpose: 'daily',
          results_limit: 60,
        }),
      ),
    ).toThrow();
    expect(() =>
      collectorRequest(
        input({
          ...launch,
          actor_id: 'goat255/vimeo-scraper',
          pass: 'primary',
          purpose: 'backfill',
          account_ids: [id],
          results_limit: 5,
        }),
      ),
    ).toThrow();
  });
  it('redacts database errors and never retries them', async () => {
    const t = setup();
    t.dispatch.mockRejectedValue(Error('synthetic-private-password'));
    const r = await t.handler(req());
    expect(r.status).toBe(503);
    expect(await r.text()).not.toContain('synthetic-private');
    expect(t.dispatch).toHaveBeenCalledTimes(1);
  });
});

describe('M05 server-selected development run policy', () => {
  const actor = 'harvestapi/linkedin-company-posts';
  const launchId = '27000000-0000-4000-8000-000000000002';
  const policy = {
    approval_id: '27000000-0000-4000-8000-000000000003',
    max_actor_starts: 64,
    max_actor_usd: 12.5,
    max_total_usd: 250,
    max_results_per_profile: 30,
    actors: {
      [actor]: {
        billingModel: 'PPE',
        owner_id: 'localOwner',
        actorId: 'localActor',
        build: '1.0.0',
        buildId: 'localBuild',
      },
    },
  };
  const launch = {
    run_id: id,
    launch_id: launchId,
    actor_id: actor,
    pass: 'primary',
    account_ids: [id],
    purpose: 'backfill',
    results_limit: 5,
    actor_input: { companies: ['https://www.linkedin.com/company/local-contract/'] },
  };
  const env = (selected = policy) => ({
    ...environment,
    VERCEL_GIT_COMMIT_REF: 'm05-collectors-web-youtube-linkedin',
    EMR_COLLECTORS_LIVE_POLICY: JSON.stringify(selected),
  });
  it('accepts standing-authorized finite M05 allocations without widening M04 or production', () => {
    expect(collectorConfig(env()).policy).toMatchObject(policy);
    expect(() =>
      collectorConfig({ ...env(), VERCEL_GIT_COMMIT_REF: 'm04-collectors-vimeo-instagram' }),
    ).toThrow();
    expect(() => collectorConfig({ ...env(), VERCEL_ENV: 'production' })).toThrow();
  });
  it('requires positive finite amounts, whole start counts and a consistent per-actor allocation', () => {
    for (const amount of [0, -1, NaN, Infinity, 0.0000001, 1.0000001, 1000000]) {
      expect(() => collectorConfig(env({ ...policy, max_actor_usd: amount }))).toThrow();
      expect(() => collectorConfig(env({ ...policy, max_total_usd: amount }))).toThrow();
    }
    for (const count of [0, -1, 1.5, NaN, Infinity, 2147483648])
      expect(() => collectorConfig(env({ ...policy, max_actor_starts: count }))).toThrow();
    expect(() => collectorConfig(env({ ...policy, max_total_usd: 1 }))).toThrow();
    expect(collectorConfig(env({ ...policy, max_actor_usd: 1.000001 })).policy?.max_actor_usd).toBe(1.000001);
    expect(
      collectorConfig(env({ ...policy, max_actor_usd: 999999.999999, max_total_usd: 999999.999999 })).policy
        ?.max_actor_usd,
    ).toBe(999999.999999);
  });
  it('issues a descriptor matching only the authentic server allocation and fresh admission', async () => {
    const t = setup(env());
    t.dispatch.mockResolvedValue({ replayed: false, result: { permit: true, launch_id: launchId } });
    const response = await t.handler(req('m05.launch', launch));
    expect(response.status).toBe(200);
    const result = (await response.json()).result;
    expect(t.dispatch.mock.calls[0]?.[2]).toMatchObject({
      ...launch,
      approval_id: policy.approval_id,
      max_actor_starts: policy.max_actor_starts,
      max_actor_usd: policy.max_actor_usd,
      max_total_usd: policy.max_total_usd,
    });
    expect(result.descriptor).toEqual({
      billingModel: 'PPE',
      actorPath: 'harvestapi~linkedin-company-posts',
      build: policy.actors[actor].build,
      maxTotalChargeUsd: policy.max_actor_usd,
      maxItems: launch.results_limit,
      timeout: 600,
      memory: 1024,
    });
  });
  it('never relabels an existing launch with a subsequent configuration descriptor', async () => {
    const t = setup(env());
    t.dispatch.mockResolvedValue({
      replayed: true,
      result: { permit: false, launch_id: launchId, apify_run_id: 'alreadyRegisteredActor' },
    });
    const response = await t.handler(req('m05.launch', launch));
    expect(response.status).toBe(200);
    const result = (await response.json()).result;
    expect(result.permit).toBe(false);
    expect(result.apify_run_id).toBe('alreadyRegisteredActor');
    expect(result).not.toHaveProperty('descriptor');
  });
  it('stops mismatched or unknown admissions and rejects client-supplied financial settings', async () => {
    for (const receipt of [
      { replayed: false, result: { permit: true, launch_id: id } },
      { replayed: true, result: { permit: true, launch_id: launchId } },
      { replayed: false, result: { permit: false, launch_id: launchId, apify_run_id: null } },
    ]) {
      const t = setup(env());
      t.dispatch.mockResolvedValue(receipt);
      expect((await t.handler(req('m05.launch', launch))).status).toBe(503);
      expect(t.dispatch).toHaveBeenCalledTimes(1);
    }
    const t = setup(env());
    expect((await t.handler(req('m05.launch', { ...launch, max_actor_usd: 100 }))).status).toBe(400);
    expect(t.dispatch).not.toHaveBeenCalled();
  });
});
