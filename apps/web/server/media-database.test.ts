// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { openMediaDatabaseSession, parseMediaBatchSummary } from './media-database';
import type { WorkerClient } from './n8n-worker/database';
const summary = {
  state: 'completed',
  claimed: 0,
  processed: 0,
  held: 0,
  stored: 0,
  skipped: 0,
  expired: 0,
  retryable: 0,
  reconciliation_required: 0,
  bytes: 0,
  infrastructure_cost_usd: null,
};
function fixture(
  options: {
    principal?: string;
    login?: string;
    lock?: boolean;
    claim?: unknown;
    finish?: unknown;
    failSql?: RegExp;
    code?: string;
    unlock?: boolean | 'hang';
    end?: 'reject' | 'hang';
  } = {},
) {
  const listeners = new Map<string, (e: unknown) => void>();
  const query = vi.fn(async (sql: string) => {
    if (options.failSql?.test(sql))
      throw Object.assign(Error('sensitive backend detail'), { code: options.code });
    if (sql.startsWith('select current_user'))
      return {
        rows: [
          {
            principal: options.principal ?? 'n8n_writer',
            login: options.login ?? 'n8n_writer',
            database: 'postgres',
          },
        ],
      };
    if (sql.includes('pg_try_advisory_lock')) return { rows: [{ locked: options.lock ?? true }] };
    if (sql.includes('pg_advisory_unlock')) {
      if (options.unlock === 'hang') return new Promise<never>(() => {});
      return { rows: [{ unlocked: options.unlock ?? true }] };
    }
    if (/ops\.claim_(story_)?media_batch/.test(sql))
      return {
        rows: [
          { result: options.claim ?? { replayed: false, state: 'running', messages: [], held_count: 0 } },
        ],
      };
    if (/ops\.finish_(story_)?media_batch/.test(sql))
      return { rows: [{ result: options.finish ?? summary }] };
    return { rows: [{ result: null }] };
  });
  const client: WorkerClient = {
    query,
    release: vi.fn(),
    end: vi.fn(async () => {
      if (options.end === 'reject') throw Error('private shutdown detail');
      if (options.end === 'hang') await new Promise<never>(() => {});
    }),
    on: vi.fn((event, listener) => {
      listeners.set(event, listener);
    }),
    off: vi.fn((event) => {
      listeners.delete(event);
    }),
  };
  const pool = { connect: vi.fn(async () => client) };
  return { client, pool, query, listeners };
}
describe('M06 concrete media database session', () => {
  it('selects only the dedicated story RPCs while retaining the same identity and global lock', async () => {
    const t = fixture(),
      c = new AbortController();
    const session = await openMediaDatabaseSession(t.pool, '3100699', c.signal, () => {}, 5, 'stories');
    await session.claim();
    await session.record(
      {
        item_id: '06000000-0000-4000-8000-000000000001',
        msg_ids: ['1'],
        outcome: 'skipped',
        code: 'no_source',
        bytes: 0,
        cost_usd: null,
      },
      c.signal,
    );
    await session.ack(['1'], c.signal);
    await session.finish(c.signal);
    await session.close();
    const sql = t.query.mock.calls.map(([value]) => value).join('\n');
    for (const name of [
      'claim_story_media_batch',
      'record_story_media_outcome',
      'ack_story_media_batch',
      'finish_story_media_batch',
    ])
      expect(sql).toContain(name);
    expect(sql).not.toMatch(
      /ops\.(claim_media_batch|record_media_outcome|ack_media_batch|finish_media_batch)/,
    );
    expect(sql).toContain('pg_try_advisory_lock(73106,31)');
  });
  it('checks both restricted principals and fixed advisory lock before product RPCs', async () => {
    const t = fixture(),
      c = new AbortController();
    const session = await openMediaDatabaseSession(t.pool, '3100601', c.signal);
    expect(await session.claim()).toMatchObject({ replayed: false, state: 'running', messages: [] });
    expect(await session.finish(c.signal)).toEqual(summary);
    await session.close();
    expect(
      t.query.mock.calls.some(([sql]) => sql === 'select pg_try_advisory_lock(73106,31) as locked'),
    ).toBe(true);
    expect(t.query).toHaveBeenCalledWith('select ops.claim_media_batch($1::text,$2::int) as result', [
      '3100601',
      50,
    ]);
    expect(t.query.mock.calls.at(-1)?.[0]).toBe('select pg_advisory_unlock(73106,31) as unlocked');
    expect(t.client.release).toHaveBeenCalledExactlyOnceWith();
  });
  it.each([
    ['postgres', 'n8n_writer'],
    ['n8n_writer', 'postgres'],
  ])('rejects nonrestricted native identity %s/%s', async (principal, login) => {
    const t = fixture({ principal, login });
    await expect(openMediaDatabaseSession(t.pool, '1', new AbortController().signal)).rejects.toThrow(
      'identity_denied',
    );
    expect(t.query.mock.calls.some(([sql]) => sql.includes('ops.'))).toBe(false);
    expect(t.client.release).toHaveBeenCalledExactlyOnceWith(true);
  });
  it.each(['0', '01', '-1', '1;drop', 'x', '1'.repeat(21)])(
    'refuses invalid native execution %s before connection',
    async (id) => {
      const t = fixture();
      await expect(openMediaDatabaseSession(t.pool, id, new AbortController().signal)).rejects.toThrow(
        'outcome_unknown',
      );
      expect(t.pool.connect).not.toHaveBeenCalled();
    },
  );
  it('does not overlap another media session when the advisory lock is busy', async () => {
    const t = fixture({ lock: false });
    await expect(openMediaDatabaseSession(t.pool, '1', new AbortController().signal)).rejects.toThrow(
      'media_busy',
    );
    expect(t.query.mock.calls.some(([sql]) => sql.includes('ops.'))).toBe(false);
  });
  it('returns persisted completed replay without another queue RPC', async () => {
    const t = fixture({
        claim: { replayed: true, state: 'finished', messages: [], held_count: 0, result: summary },
      }),
      c = new AbortController();
    const session = await openMediaDatabaseSession(t.pool, '1', c.signal);
    expect((await session.claim()).result).toEqual(summary);
    await session.close();
    expect(t.query.mock.calls.filter(([sql]) => sql.includes('ops.'))).toHaveLength(1);
  });
  it('retains uncertain prior execution as a reconciliation receipt with no claim messages', async () => {
    const t = fixture({
        claim: {
          replayed: true,
          state: 'reconciliation_required',
          messages: [],
          held_count: 1,
          result: null,
        },
      }),
      c = new AbortController();
    const session = await openMediaDatabaseSession(t.pool, '1', c.signal);
    expect(await session.claim()).toMatchObject({ state: 'reconciliation_required', messages: [] });
    await session.close();
  });
  it('serializes whole transactions for concurrent worker ports', async () => {
    const t = fixture(),
      c = new AbortController(),
      session = await openMediaDatabaseSession(t.pool, '1', c.signal);
    t.query.mockClear();
    await Promise.all([
      session.record(
        {
          item_id: '06000000-0000-4000-8000-000000000001',
          msg_ids: ['1'],
          outcome: 'retryable',
          code: 'media_download_failed',
          bytes: 0,
          cost_usd: null,
        },
        c.signal,
      ),
      session.ack(['1'], c.signal),
    ]);
    expect(
      t.query.mock.calls.map(([sql]) =>
        sql === 'begin' ? 'begin' : sql === 'commit' ? 'commit' : sql.includes('ops.') ? 'rpc' : 'settings',
      ),
    ).toEqual(['begin', 'settings', 'rpc', 'commit', 'begin', 'settings', 'rpc', 'commit']);
    await session.close();
  });
  it('never retries a lost durable write or leaks the backend error', async () => {
    const t = fixture({ failSql: /ops.record_media_outcome/ }),
      c = new AbortController(),
      session = await openMediaDatabaseSession(t.pool, '1', c.signal);
    await expect(
      session.record(
        {
          item_id: '06000000-0000-4000-8000-000000000001',
          msg_ids: ['1'],
          outcome: 'retryable',
          code: 'media_download_failed',
          bytes: 0,
          cost_usd: null,
        },
        c.signal,
      ),
    ).rejects.toThrow('outcome_unknown');
    expect(t.query.mock.calls.filter(([sql]) => sql.includes('record_media_outcome'))).toHaveLength(1);
    await session.close();
  });
  it('maps a stale/foreign SQL claim denial without retry', async () => {
    const t = fixture({ failSql: /ops.ack_media_batch/, code: '42501' }),
      c = new AbortController(),
      session = await openMediaDatabaseSession(t.pool, '1', c.signal);
    await expect(session.ack(['1'], c.signal)).rejects.toThrow('forbidden');
    await session.close();
  });
  it('cancellation destroys the owned client and prevents a later mutation', async () => {
    const t = fixture(),
      c = new AbortController(),
      onLost = vi.fn(),
      session = await openMediaDatabaseSession(t.pool, '1', c.signal, onLost);
    c.abort();
    await expect(session.ack(['1'], c.signal)).rejects.toThrow('outcome_unknown');
    await session.close();
    expect(onLost).toHaveBeenCalled();
    expect(t.client.end).toHaveBeenCalledTimes(1);
    expect(t.client.release).toHaveBeenCalledExactlyOnceWith(true);
    expect(t.query.mock.calls.some(([sql]) => sql.includes('ack_media_batch'))).toBe(false);
  });
  it('database loss aborts the owner and closes the session', async () => {
    const t = fixture(),
      c = new AbortController(),
      onLost = vi.fn(),
      session = await openMediaDatabaseSession(t.pool, '1', c.signal, onLost);
    t.listeners.get('error')?.(Error('private socket error'));
    await session.close();
    expect(onLost).toHaveBeenCalledTimes(1);
    expect(t.client.release).toHaveBeenCalledExactlyOnceWith(true);
  });
  it('binds the server-selected finite batch size before claim', async () => {
    const t = fixture(),
      c = new AbortController(),
      session = await openMediaDatabaseSession(t.pool, '1', c.signal, () => {}, 1);
    await session.claim();
    expect(t.query).toHaveBeenCalledWith('select ops.claim_media_batch($1::text,$2::int) as result', [
      '1',
      1,
    ]);
    await session.close();
  });
  it.each([0, 51, NaN, 1.5])('rejects batch size %s before connection', async (size) => {
    const t = fixture();
    await expect(
      openMediaDatabaseSession(t.pool, '1', new AbortController().signal, () => {}, size),
    ).rejects.toThrow('outcome_unknown');
    expect(t.pool.connect).not.toHaveBeenCalled();
  });
  it('a false unlock result destroys the connection and cannot become confirmed cleanup', async () => {
    const t = fixture({ unlock: false }),
      c = new AbortController(),
      session = await openMediaDatabaseSession(t.pool, '1', c.signal);
    await expect(session.close()).rejects.toThrow('media_cleanup_unconfirmed');
    expect(t.client.end).toHaveBeenCalledTimes(1);
    expect(t.client.release).toHaveBeenCalledExactlyOnceWith(true);
    await expect(session.close()).rejects.toThrow('media_cleanup_unconfirmed');
  });
  it('concurrent close callers share one unlock and one release', async () => {
    const t = fixture(),
      c = new AbortController(),
      session = await openMediaDatabaseSession(t.pool, '1', c.signal);
    const a = session.close(),
      b = session.close();
    expect(a).toBe(b);
    await Promise.all([a, b]);
    expect(t.query.mock.calls.filter(([sql]) => sql.includes('pg_advisory_unlock'))).toHaveLength(1);
    expect(t.client.release).toHaveBeenCalledExactlyOnceWith();
  });
  it('rejects an unconfirmed native end without leaking its error', async () => {
    const t = fixture({ end: 'reject' }),
      c = new AbortController(),
      session = await openMediaDatabaseSession(t.pool, '1', c.signal);
    c.abort();
    await expect(session.close()).rejects.toThrow('media_cleanup_unconfirmed');
    expect(t.client.release).toHaveBeenCalledExactlyOnceWith(true);
  });
  it('bounds a hanging unlock and destroys its owned connection', async () => {
    vi.useFakeTimers();
    try {
      const t = fixture({ unlock: 'hang' }),
        c = new AbortController(),
        session = await openMediaDatabaseSession(t.pool, '1', c.signal);
      const assertion = expect(session.close()).rejects.toThrow('media_cleanup_unconfirmed');
      await vi.advanceTimersByTimeAsync(3100);
      await assertion;
      expect(t.client.end).toHaveBeenCalledTimes(1);
      expect(t.client.release).toHaveBeenCalledExactlyOnceWith(true);
    } finally {
      vi.useRealTimers();
    }
  });
  it('bounds a hanging native end and reports physical cleanup unconfirmed', async () => {
    vi.useFakeTimers();
    try {
      const t = fixture({ end: 'hang' }),
        c = new AbortController(),
        session = await openMediaDatabaseSession(t.pool, '1', c.signal);
      c.abort();
      const assertion = expect(session.close()).rejects.toThrow('media_cleanup_unconfirmed');
      await vi.advanceTimersByTimeAsync(3100);
      await assertion;
      expect(t.client.release).toHaveBeenCalledExactlyOnceWith(true);
    } finally {
      vi.useRealTimers();
    }
  });
  it.each([
    { ...summary, infrastructure_cost_usd: 0 },
    { ...summary, claimed: 51 },
    { ...summary, processed: 1 },
    { ...summary, held: 1 },
    { ...summary, bytes: Infinity },
    { ...summary, unexpected: 'private' },
  ])('rejects malformed or invented accounting summary', (value) => {
    expect(() => parseMediaBatchSummary(value)).toThrow('outcome_unknown');
  });
});
