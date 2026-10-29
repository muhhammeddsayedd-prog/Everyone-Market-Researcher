// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { createM06StoriesCallback, createM06StoriesAdmission } from './m06-stories-callback';
import { createCollectorHandler } from './collectors';
import type { CollectorConfig, CollectorDispatch } from './collectors';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { WorkerFailure } from './errors';
const account = '62000000-0000-4000-8000-000000000001',
  approval = '62000000-0000-4000-8000-000000000002';
const actor = 'data-slayer/instagram-stories-scraper';
const config = {
  scope: 'm06',
  accountIds: [account],
  apifyReadToken: 'synthetic-read-only',
  policy: {
    approval_id: approval,
    max_actor_starts: 2,
    max_actor_usd: 1.25,
    max_total_usd: 2.5,
    max_results_per_profile: 10,
    actors: {
      [actor]: {
        billingModel: 'PPE',
        owner_id: 'SyntheticOwner',
        actorId: 'SyntheticActor',
        build: '1.0.32',
        buildId: 'SyntheticBuild',
        memoryMbytes: 1024,
        timeoutSecs: 600,
      },
    },
  },
} as CollectorConfig;
const input = {
  version: 1 as const,
  requestId: approval,
  operation: 'callback.process' as const,
  args: { apify_run_id: 'SyntheticRun' },
};
const job = {
  apify_run_id: 'SyntheticRun',
  actor_id: actor,
  account_ids: [account],
  accounts: [
    {
      account_id: account,
      competitor_id: approval,
      platform: 'instagram_stories',
      handle: 'synthetic',
      url: 'https://www.instagram.com/synthetic/',
    },
  ],
  actor_input: { usernames: ['synthetic'] },
  results_limit: 10,
  run_id: approval,
  launch_id: account,
  settled: false,
  processing_result: null,
  build_id: 'SyntheticBuild',
  max_actor_usd: 1.25,
  memory_mbytes: 1024,
  timeout_secs: 600,
  collection_mode: 'ingest',
  approval_id: approval,
  launch_created_at: '2026-10-29T00:00:00Z',
};
const snapshot = {
  data: {
    id: 'SyntheticRun',
    actId: 'SyntheticActor',
    userId: 'SyntheticOwner',
    buildId: 'SyntheticBuild',
    buildNumber: '1.0.32',
    status: 'SUCCEEDED',
    usageTotalUsd: 0.01,
    defaultDatasetId: 'SyntheticDataset',
    defaultKeyValueStoreId: 'SyntheticInput',
    startedAt: '2026-10-29T00:00:01Z',
    finishedAt: '2026-10-29T00:01:00Z',
    options: { memoryMbytes: 1024, timeoutSecs: 600, maxTotalChargeUsd: 1.25, maxItems: 10 },
  },
};
const row = {
  id: '1234567890123456789',
  creator_username: 'synthetic',
  taken_at_date: '2026-10-29T00:00:02Z',
  caption_text: 'Synthetic local story',
  thumbnail_url: 'https://scontent.cdninstagram.com/local.jpg',
};
function fixture(
  options: {
    rows?: unknown[];
    metadata?: unknown;
    input?: unknown;
    settled?: boolean;
    unknown?: boolean;
    unstable?: boolean;
  } = {},
) {
  const calls: { operation: string; args: Record<string, unknown> }[] = [],
    reads: string[] = [];
  let clock = 0,
    runReads = 0;
  const dispatch: CollectorDispatch = async (_id, operation, args) => {
    calls.push({ operation, args });
    if (operation === 'm06.lookup')
      return {
        replayed: false,
        result: options.unknown
          ? null
          : {
              ...job,
              settled: options.settled ?? false,
              processing_result: options.settled ? { updated: true, groups: [] } : null,
            },
      };
    return {
      replayed: false,
      result: {
        updated: true,
        groups: (args.groups as Record<string, unknown>[]).map((g) => ({
          ...g,
          items_new: (g.items as unknown[]).length,
        })),
      },
    };
  };
  const fn = createM06StoriesCallback({
    dispatch,
    get: async (path) => {
      reads.push(path);
      if (path.startsWith('/v2/actor-runs/')) {
        runReads++;
        return (
          options.metadata ??
          (options.unstable && runReads === 2
            ? { data: { ...snapshot.data, usageTotalUsd: 0.02 } }
            : snapshot)
        );
      }
      if (path.includes('/records/INPUT')) return options.input ?? job.actor_input;
      return options.rows ?? [row];
    },
    now: () => clock,
    wait: async (ms) => {
      clock += ms;
    },
  });
  return { fn, calls, reads };
}
describe('M06 source-authoritative story callback', () => {
  it('connects all three retained real source contracts, actor-specific resources and honest missing-account results', async () => {
    const selection = JSON.parse(
      readFileSync(
        new URL(
          '../../../../milestones/M06-collectors-stories-upkeep/evidence/story-account-selection-20261029.json',
          import.meta.url,
        ),
        'utf8',
      ),
    );
    for (const directory of ['data-slayer', 'igview', 'louisdeconinck']) {
      const capture = JSON.parse(
        readFileSync(
          new URL(
            '../../../../n8n/normalizers/fixtures/instagram-stories-' +
              directory +
              '/real-capture-20261029.json',
            import.meta.url,
          ),
          'utf8',
        ),
      );
      const p = capture.provenance;
      expect(p.kind).toBe('sanitized_real_actor_capture');
      const ids = selection.accounts.map((a: { accountId: string }) => a.accountId);
      const accounts = selection.accounts.map(
        (a: { accountId: string; competitorId: string; handle: string }) => ({
          account_id: a.accountId,
          competitor_id: a.competitorId,
          platform: 'instagram_stories',
          handle: a.handle,
          url: 'https://www.instagram.com/' + a.handle + '/',
        }),
      );
      const registered = {
        ...job,
        apify_run_id: p.runId,
        actor_id: p.actor,
        account_ids: ids,
        accounts,
        actor_input: p.input,
        results_limit: 50,
        build_id: p.buildId,
        max_actor_usd: p.options.maxTotalChargeUsd,
        memory_mbytes: p.options.memoryMbytes,
        timeout_secs: p.options.timeoutSecs,
        collection_mode: directory === 'data-slayer' ? 'ingest' : 'bakeoff',
        launch_created_at: p.startedAt,
      };
      const cfg = {
        ...config,
        accountIds: ids,
        policy: {
          ...config.policy!,
          actors: {
            [p.actor]: {
              billingModel: 'PPE',
              actorId: p.actorId,
              owner_id: 'LocalMetadataMockOwner',
              build: p.buildNumber,
              buildId: p.buildId,
              memoryMbytes: p.options.memoryMbytes,
              timeoutSecs: p.options.timeoutSecs,
            },
          },
        },
      } as CollectorConfig;
      let settled: Record<string, unknown> | undefined,
        clock = 0;
      const fn = createM06StoriesCallback({
        dispatch: async (_id, op, args) => {
          if (op === 'm06.lookup') return { replayed: false, result: registered };
          settled = args;
          return {
            replayed: false,
            result: {
              updated: true,
              groups: (args.groups as Record<string, unknown>[]).map((g) => ({
                ...g,
                items_new: (g.items as unknown[]).length,
              })),
            },
          };
        },
        get: async (path) =>
          path.startsWith('/v2/actor-runs/')
            ? {
                data: {
                  id: p.runId,
                  actId: p.actorId,
                  userId: 'LocalMetadataMockOwner',
                  buildId: p.buildId,
                  buildNumber: p.buildNumber,
                  status: 'SUCCEEDED',
                  usageTotalUsd: p.usageTotalUsd,
                  defaultDatasetId: 'LocalRetainedDataset',
                  defaultKeyValueStoreId: 'LocalRetainedInput',
                  startedAt: p.startedAt,
                  finishedAt: p.finishedAt,
                  options: p.options,
                },
              }
            : path.includes('/records/INPUT')
              ? p.input
              : capture.rows,
        now: () => clock,
        wait: async (ms) => {
          clock += ms;
        },
      });
      await fn({ ...input, args: { apify_run_id: p.runId } }, cfg, new AbortController().signal);
      expect(settled!.usage_usd).toBe(p.usageTotalUsd);
      const groups = settled!.groups as { observation: string; items: unknown[]; error: string | null }[];
      expect(groups.filter((g) => g.observation === 'stories')).toHaveLength(1);
      expect(groups.reduce((n, g) => n + g.items.length, 0)).toBe(12);
      expect(groups.filter((g) => g.observation === 'no_stories')).toHaveLength(
        directory === 'louisdeconinck' ? 0 : 2,
      );
      expect(groups.filter((g) => g.error === 'stories_no_account_evidence')).toHaveLength(
        directory === 'louisdeconinck' ? 2 : 0,
      );
    }
  });
  it('normalizes a public story, records measured usage and sends exact source ownership to SQL', async () => {
    const f = fixture();
    const result = await f.fn(input, config, new AbortController().signal);
    expect(result.state).toBe('completed');
    const args = f.calls.at(-1)!.args;
    expect(args.usage_usd).toBe(0.01);
    expect(args.observed_at).toBe('2026-10-29T00:01:00Z');
    expect(result.media_dispatch).toEqual({ queue: 'stories', items_new: 1 });
    expect((args.groups as Record<string, unknown>[])[0]).toMatchObject({
      account_id: account,
      status: 'success',
      observation: 'stories',
      source_evidence: true,
    });
    expect((args.groups as { items: unknown[] }[])[0]!.items).toHaveLength(1);
    expect(f.reads.filter((p) => p.startsWith('/v2/actor-runs/'))).toHaveLength(2);
  });
  it('only an explicit owner-attributed no-stories summary records no_stories', async () => {
    const f = fixture({ rows: [{ creator_username: 'synthetic', status: 'no_stories', stories_count: 0 }] });
    expect((await f.fn(input, config, new AbortController().signal)).media_dispatch).toBeNull();
    expect((f.calls.at(-1)!.args.groups as Record<string, unknown>[])[0]).toMatchObject({
      observation: 'no_stories',
      source_evidence: true,
      status: 'success',
      items: [],
    });
  });
  it('a successful but empty dataset remains missing evidence, not no stories', async () => {
    const f = fixture({ rows: [] });
    expect((await f.fn(input, config, new AbortController().signal)).media_dispatch).toBeNull();
    expect((f.calls.at(-1)!.args.groups as Record<string, unknown>[])[0]).toMatchObject({
      observation: 'error',
      source_evidence: false,
      status: 'failed',
      error: 'stories_no_account_evidence',
    });
  });
  it('login/challenge/private source output is a failure with no ingestion', async () => {
    const f = fixture({
      rows: [{ creator_username: 'synthetic', error: 'Login checkpoint challenge required' }],
    });
    expect((await f.fn(input, config, new AbortController().signal)).media_dispatch).toBeNull();
    expect((f.calls.at(-1)!.args.groups as Record<string, unknown>[])[0]).toMatchObject({
      observation: 'error',
      source_evidence: false,
      status: 'failed',
      items: [],
      error: 'stories_private_or_login',
    });
  });
  it('terminal provider failure records actual cost once without fabricating source output', async () => {
    const f = fixture({ metadata: { data: { ...snapshot.data, status: 'FAILED' } } });
    expect((await f.fn(input, config, new AbortController().signal)).media_dispatch).toBeNull();
    expect(f.reads.some((p) => p.startsWith('/v2/datasets/'))).toBe(false);
    expect(f.calls.at(-1)!.args).toMatchObject({ usage_usd: 0.01, status: 'FAILED' });
    expect((f.calls.at(-1)!.args.groups as Record<string, unknown>[])[0]!.observation).toBe('error');
  });
  it('settled replay returns the durable result without another provider read or settlement', async () => {
    const f = fixture({ settled: true });
    const result = await f.fn(input, config, new AbortController().signal);
    expect(result.updated).toBe(false);
    expect(f.reads).toEqual([]);
    expect(f.calls.map((c) => c.operation)).toEqual(['m06.lookup']);
  });
  it('unknown registration and mismatched builds, owners or INPUT stop before ingestion', async () => {
    for (const options of [
      { unknown: true },
      { metadata: { data: { ...snapshot.data, buildId: 'WrongBuild' } } },
      { metadata: { data: { ...snapshot.data, userId: 'OtherOwner' } } },
      { input: { usernames: ['another'] } },
    ]) {
      const f = fixture(options);
      await expect(f.fn(input, config, new AbortController().signal)).rejects.toThrow();
      expect(f.calls.some((c) => c.operation === 'm06.settle')).toBe(false);
    }
  });
  it('cost must be known, finite and stable before settlement', async () => {
    for (const options of [
      { unstable: true },
      { metadata: { data: { ...snapshot.data, usageTotalUsd: null } } },
      { metadata: { data: { ...snapshot.data, usageTotalUsd: -1 } } },
    ]) {
      const f = fixture(options);
      await expect(f.fn(input, config, new AbortController().signal)).rejects.toThrow();
      expect(f.calls.some((c) => c.operation === 'm06.settle')).toBe(false);
    }
  });
  it('provider option/cap mismatch preserves measured cost and suppresses ingestion', async () => {
    const f = fixture({
      metadata: { data: { ...snapshot.data, options: { ...snapshot.data.options, maxTotalChargeUsd: 99 } } },
    });
    await f.fn(input, config, new AbortController().signal);
    expect(f.calls.at(-1)!.args.usage_usd).toBe(0.01);
    expect((f.calls.at(-1)!.args.groups as Record<string, unknown>[])[0]).toMatchObject({
      status: 'failed',
      items: [],
      error: 'stories_actor_cap_unacknowledged',
    });
  });
  it('more output than the authentic allocation fails all owned groups without partial ingest', async () => {
    const f = fixture({
      rows: Array.from({ length: 11 }, (_, i) => ({ ...row, id: String(1234567800 + i) })),
    });
    await f.fn(input, config, new AbortController().signal);
    expect((f.calls.at(-1)!.args.groups as Record<string, unknown>[])[0]).toMatchObject({
      status: 'failed',
      items: [],
      error: 'stories_dataset_limit_exceeded',
    });
  });
});
describe('M06 existing gateway scope', () => {
  const token = 's'.repeat(43);
  const environment = () => ({
    EMR_COLLECTORS_ENABLED: 'true',
    VERCEL_ENV: 'preview',
    VERCEL_GIT_COMMIT_REF: 'm06-collectors-stories-upkeep',
    VERCEL_PROJECT_ID: 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
    VERCEL_URL: 'everyone-market-researcher-m06-fixture.vercel.app',
    VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40),
    EMR_COLLECTORS_COMMIT_SHA: 'a'.repeat(40),
    VERCEL_DEPLOYMENT_ID: 'dpl_M06Fixture',
    EMR_COLLECTORS_WRITER_PASSWORD: 'synthetic-writer',
    EMR_COLLECTORS_APIFY_READ_TOKEN: 'synthetic-read',
    EMR_COLLECTORS_TOKEN_SHA256: createHash('sha256').update(token).digest('hex'),
    EMR_COLLECTORS_ACCOUNT_IDS: JSON.stringify([account]),
    EMR_COLLECTORS_LIVE_POLICY: JSON.stringify(config.policy),
  });
  const request = (operation: string, args: unknown) =>
    new Request('https://everyone-market-researcher-m06-fixture.vercel.app/api/internal/n8n/collectors', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
      body: JSON.stringify({ version: 1, requestId: approval, operation, args }),
    });
  it('selects the M06 namespace and refuses M04/M05 operations and forged settlement', async () => {
    const dispatch = vi.fn<CollectorDispatch>(async () => ({
      replayed: false,
      result: { run_id: approval },
    }));
    const handler = createCollectorHandler({ environment, dispatch, processCallback: async () => ({}) });
    expect(
      (
        await handler(
          request('m06.start', {
            workflow: 'WF-12',
            platform: 'instagram_stories',
            mode: 'daily',
            env: 'dev',
            execution_id: '123',
            collection_mode: 'ingest',
          }),
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await handler(
          request('m05.start', {
            workflow: 'WF-13',
            platform: 'youtube',
            mode: 'daily',
            env: 'dev',
            execution_id: '123',
          }),
        )
      ).status,
    ).toBe(403);
    expect((await handler(request('m06.settle', {}))).status).toBe(400);
  });
  it('authentic server policy supplies build identity and finite charge allocation, not caller fields', async () => {
    const dispatch = vi.fn<CollectorDispatch>(async () => ({
      replayed: false,
      result: { permit: true, replayed: false, launch_id: account },
    }));
    const handler = createCollectorHandler({ environment, dispatch, processCallback: async () => ({}) });
    const response = await handler(
      request('m06.launch', {
        run_id: approval,
        launch_id: account,
        actor_id: actor,
        pass: 'primary',
        account_ids: [account],
        purpose: 'daily',
        results_limit: 10,
        actor_input: { usernames: ['synthetic'] },
        collection_mode: 'ingest',
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.result.descriptor).toMatchObject({
      actorId: 'SyntheticActor',
      ownerId: 'SyntheticOwner',
      buildId: 'SyntheticBuild',
      maxTotalChargeUsd: 1.25,
      maxOutputItems: 10,
    });
    expect(dispatch.mock.calls[0]![2]).toMatchObject({
      build_id: 'SyntheticBuild',
      max_actor_usd: 1.25,
      max_total_usd: 2.5,
    });
  });
  it('routes authenticated M06 admission through the bounded existing-job helper only', async () => {
    const dispatch = vi.fn<CollectorDispatch>(async () => ({ replayed: false, result: null }));
    const admitCallback = vi.fn(async () => ({
      scope: 'm06',
      accepted: true,
      durable: true,
      apify_run_id: 'SyntheticRun',
      run_id: approval,
      launch_id: account,
      state: 'pending',
      replayed: false,
    }));
    const handler = createCollectorHandler({
      environment,
      dispatch,
      processCallback: async () => ({}),
      admitCallback,
    });
    const response = await handler(request('callback.admit', { apify_run_id: 'SyntheticRun' }));
    expect(response.status).toBe(200);
    expect((await response.json()).result.state).toBe('pending');
    expect(admitCallback).toHaveBeenCalledTimes(1);
    expect(dispatch).not.toHaveBeenCalled();
    const other = createCollectorHandler({
      environment: () => ({
        ...environment(),
        VERCEL_GIT_COMMIT_REF: 'm04-collectors-vimeo-instagram',
        EMR_COLLECTORS_LIVE_POLICY: undefined,
      }),
      dispatch,
      processCallback: async () => ({}),
      admitCallback,
    });
    expect((await other(request('callback.admit', { apify_run_id: 'SyntheticRun' }))).status).toBe(403);
  });
});

describe('M06 fast durable callback admission', () => {
  const input = {
    version: 1 as const,
    requestId: approval,
    operation: 'callback.admit' as const,
    args: { apify_run_id: 'SyntheticRun' },
  };
  it('commits one stable registration receipt per known run while duplicate delivery never creates provider work', async () => {
    const requests = new Set<string>(),
      calls: { id: string; operation: string; args: Record<string, unknown> }[] = [];
    const dispatch: CollectorDispatch = async (id, operation, args) => {
      calls.push({ id, operation, args });
      if (operation === 'm06.lookup') return { replayed: false, result: job };
      expect(operation).toBe('m06.register');
      const replayed = requests.has(id);
      requests.add(id);
      return { replayed, result: { registered: true, run_id: job.run_id, apify_run_id: job.apify_run_id } };
    };
    const admit = createM06StoriesAdmission({ dispatch });
    const first = await admit(input, config, new AbortController().signal),
      second = await admit({ ...input, requestId: account }, config, new AbortController().signal);
    expect(first).toMatchObject({
      scope: 'm06',
      accepted: true,
      durable: true,
      state: 'pending',
      replayed: false,
      run_id: job.run_id,
      launch_id: job.launch_id,
      apify_run_id: job.apify_run_id,
    });
    expect(second.replayed).toBe(true);
    expect(requests.size).toBe(1);
    expect(calls.filter((c) => c.operation === 'm06.register').map((c) => c.args)).toEqual(
      [0, 1].map(() => ({
        run_id: job.run_id,
        launch_id: job.launch_id,
        apify_run_id: job.apify_run_id,
        actor_id: job.actor_id,
        pass: 'primary',
        account_ids: job.account_ids,
        purpose: 'daily',
      })),
    );
    expect(calls.every((c) => ['m06.lookup', 'm06.register'].includes(c.operation))).toBe(true);
  });
  it('completed durable replay acknowledges without another registration, provider read, cost or media dispatch', async () => {
    const dispatch = vi.fn<CollectorDispatch>(async () => ({
      replayed: false,
      result: { ...job, settled: true, processing_result: { updated: true, groups: [] } },
    }));
    const result = await createM06StoriesAdmission({ dispatch })(input, config, new AbortController().signal);
    expect(result).toMatchObject({ state: 'completed', replayed: true, durable: true });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(result).not.toHaveProperty('media_dispatch');
  });
  it('a registration/settlement race is acknowledged only after one durable completed readback', async () => {
    for (const settled of [true, false]) {
      let reads = 0,
        registers = 0;
      const dispatch: CollectorDispatch = async (_id, op) => {
        if (op === 'm06.register') {
          registers++;
          throw new WorkerFailure('reconciliation_required', 503);
        }
        reads++;
        return {
          replayed: false,
          result: {
            ...job,
            settled: reads === 2 && settled,
            processing_result: reads === 2 && settled ? { updated: true, groups: [] } : null,
          },
        };
      };
      const result = createM06StoriesAdmission({ dispatch })(input, config, new AbortController().signal);
      if (settled) expect(await result).toMatchObject({ state: 'completed', replayed: true });
      else await expect(result).rejects.toThrow();
      expect(reads).toBe(2);
      expect(registers).toBe(1);
    }
  });
  it('unknown IDs, changed identity/build/allowlist and malformed immutable settings cannot be admitted', async () => {
    for (const patch of [
      { run_id: 'bad' },
      { launch_id: 'bad' },
      { build_id: 'OtherBuild' },
      { account_ids: [approval] },
      { memory_mbytes: 129 },
      { max_actor_usd: NaN },
      { max_actor_usd: 0 },
    ]) {
      const dispatch = vi.fn<CollectorDispatch>(async () => ({
        replayed: false,
        result: { ...job, ...patch },
      }));
      await expect(
        createM06StoriesAdmission({ dispatch })(input, config, new AbortController().signal),
      ).rejects.toThrow();
      expect(dispatch).toHaveBeenCalledTimes(1);
    }
    const dispatch = vi.fn<CollectorDispatch>(async () => {
      throw new WorkerFailure('forbidden', 403);
    });
    await expect(
      createM06StoriesAdmission({ dispatch })(input, config, new AbortController().signal),
    ).rejects.toMatchObject({ status: 403 });
    expect(dispatch).toHaveBeenCalledTimes(1);
  });
});
