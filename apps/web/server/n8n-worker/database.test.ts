// @vitest-environment node
import { readFileSync } from 'node:fs';
import { EventEmitter } from 'node:events';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { databaseConfig, dispatchDatabase, poolerHost, type WorkerClient } from './database';
import { trialWindowId, type GatewayRequest } from '@emr/shared';
const input: GatewayRequest = {
  version: 1,
  requestId: 'e62e7289-28ca-4387-a071-6f327837ea01',
  operation: 'identity.read',
  args: {},
};
const config = {
  audience: 'https://example.vercel.app',
  password: 'synthetic-never-network',
  verifier: '',
  windowId: trialWindowId,
  commitSha: 'a'.repeat(40),
  deploymentId: 'dpl_synthetic',
} as const;
const window = {
  id: trialWindowId,
  startsAt: null,
  expiresAt: null,
  closed: false,
  totalAdmitted: 1,
  boundAudience: 'https://example.vercel.app',
  boundCommitSha: 'a'.repeat(40),
  boundDeploymentId: 'dpl_synthetic',
};
function mockClient(override: Partial<WorkerClient> = {}) {
  const events = new EventEmitter();
  const queries: string[] = [];
  const release = vi.fn();
  const query = vi.fn(async (sql: string) => {
    queries.push(sql);
    if (sql.includes('current_user'))
      return {
        rows: [
          { currentUser: 'n8n_writer', sessionUser: 'n8n_writer', database: 'postgres', connectionCount: 1 },
        ],
      };
    if (sql.includes('worker_gateway_admit'))
      return { rows: [{ receipt: { state: 'admitted', code: null, result: null, window } }] };
    if (sql.includes('worker_gateway_execute'))
      return {
        rows: [
          {
            receipt: {
              state: 'completed',
              code: null,
              result: {
                sessionUser: 'n8n_writer',
                database: 'postgres',
                projectRef: 'zmotjsbzhzjvpelxvxlf',
                connectionCount: 1,
              },
              window,
            },
          },
        ],
      };
    if (sql.includes('worker_gateway_status'))
      return { rows: [{ receipt: { state: 'absent', code: null, result: null, window } }] };
    return { rows: [] };
  });
  return {
    client: {
      query,
      release,
      end: vi.fn(async () => {}),
      on: events.on.bind(events),
      off: events.off.bind(events),
      ...override,
    },
    query,
    release,
    queries,
    events,
  };
}
describe('GW-01 actual-login and transaction transport', () => {
  it('uses only explicit fixed connection fields and the pinned CA with ordinary hostname validation', () => {
    const ca = readFileSync(
      fileURLToPath(new URL('../../../../scripts/seed/certs/supabase-root-2021.crt', import.meta.url)),
    );
    const c = databaseConfig('synthetic-never-network', ca);
    expect(c).toMatchObject({
      host: poolerHost,
      port: 5432,
      user: 'n8n_writer.zmotjsbzhzjvpelxvxlf',
      database: 'postgres',
      max: 1,
      min: 0,
      connectionTimeoutMillis: 3000,
      idleTimeoutMillis: 5000,
    });
    expect(c).not.toHaveProperty('connectionString');
    expect(c.ssl).toMatchObject({ rejectUnauthorized: true, minVersion: 'TLSv1.2', servername: poolerHost });
    expect(() => databaseConfig('synthetic', Buffer.from('wrong CA'))).toThrow('unavailable');
  });
  it('asserts both native identities before wrappers, commits admission separately, and preserves atomic execute', async () => {
    const s = mockClient();
    const out = await dispatchDatabase(
      { connect: async () => s.client },
      input,
      config,
      new AbortController().signal,
    );
    expect(out).toMatchObject({
      state: 'completed',
      result: { currentUser: 'n8n_writer', sessionUser: 'n8n_writer' },
    });
    expect(s.queries.filter((x) => x === 'begin')).toHaveLength(4);
    expect(s.queries.filter((x) => x === 'commit')).toHaveLength(4);
    const admitted = s.queries.findIndex((x) => x.includes('worker_gateway_admit'));
    const execute = s.queries.findIndex((x) => x.includes('worker_gateway_execute'));
    expect(s.queries.slice(admitted + 1, execute)).toContain('commit');
    expect(s.queries.findIndex((x) => x.includes('current_user'))).toBeLessThan(admitted);
    expect(s.queries.some((x) => /set role|finish_run|process_apify_run|password/i.test(x))).toBe(false);
    expect(s.release).toHaveBeenCalledExactlyOnceWith();
  });
  it('rejects postgres/SET ROLE identity and never admits that connection', async () => {
    const s = mockClient();
    s.query.mockImplementationOnce(async () => ({ rows: [] }));
    s.query.mockImplementationOnce(async () => ({ rows: [] }));
    s.query.mockImplementationOnce(async () => ({
      rows: [
        { currentUser: 'n8n_writer', sessionUser: 'postgres', database: 'postgres', connectionCount: 1 },
      ],
    }));
    await expect(
      dispatchDatabase({ connect: async () => s.client }, input, config, new AbortController().signal),
    ).rejects.toThrow('identity_denied');
    expect(s.queries.some((x) => x.includes('worker_gateway_admit'))).toBe(false);
    expect(s.release).toHaveBeenCalledExactlyOnceWith(true);
  });
  it('rejects unbound and foreign deployments before ordinary admission or clock mutation', async () => {
    for (const patch of [
      { boundAudience: null, boundCommitSha: null, boundDeploymentId: null },
      { boundAudience: 'https://foreign.vercel.app' },
      { boundCommitSha: 'b'.repeat(40) },
      { boundDeploymentId: 'dpl_foreign' },
    ]) {
      const s = mockClient();
      const base = s.client.query;
      const wrapperCalls: string[] = [];
      s.client.query = async (sql, values) => {
        if (sql.includes('worker_gateway_admit')) wrapperCalls.push(sql);
        return sql.includes('worker_gateway_admit')
          ? {
              rows: [
                { receipt: { state: 'admitted', code: null, result: null, window: { ...window, ...patch } } },
              ],
            }
          : base(sql, values);
      };
      await expect(
        dispatchDatabase({ connect: async () => s.client }, input, config, new AbortController().signal),
      ).rejects.toThrow('deployment_denied');
      expect(wrapperCalls).toHaveLength(1);
      expect(wrapperCalls[0]).toContain("'inspect'");
      expect(s.queries.some((sql) => sql.includes('worker_gateway_execute'))).toBe(false);
      expect(s.release).toHaveBeenCalledExactlyOnceWith(true);
    }
  });
  it('queries only status using the original target after counting the fresh correlation envelope', async () => {
    const s = mockClient();
    const target = 'e62e7289-28ca-4387-a071-6f327837ea02';
    await dispatchDatabase(
      { connect: async () => s.client },
      { ...input, operation: 'request.status', args: { targetRequestId: target } },
      config,
      new AbortController().signal,
    );
    expect(s.query.mock.calls.some(([sql]) => sql.includes('worker_gateway_execute'))).toBe(false);
    expect(s.query).toHaveBeenCalledWith(expect.stringContaining('worker_gateway_status'), [
      trialWindowId,
      target,
    ]);
  });
  it('does not execute again when durable admission returns a completed receipt', async () => {
    const s = mockClient();
    const base = s.client.query;
    s.client.query = async (sql, values) =>
      sql.includes('worker_gateway_admit')
        ? {
            rows: [
              { receipt: { state: 'completed', code: null, result: { sessionUser: 'n8n_writer' }, window } },
            ],
          }
        : base(sql, values);
    await dispatchDatabase({ connect: async () => s.client }, input, config, new AbortController().signal);
    expect(s.queries.some((x) => x.includes('worker_gateway_execute'))).toBe(false);
  });
  it('destroys the owned connection on abort and treats uncertain commits as unknown', async () => {
    const controller = new AbortController();
    const s = mockClient();
    const base = s.client.query;
    s.client.query = async (sql, values) => {
      if (sql.includes('worker_gateway_execute')) {
        controller.abort();
        throw new Error('private-canary');
      }
      return base(sql, values);
    };
    await expect(
      dispatchDatabase({ connect: async () => s.client }, input, config, controller.signal),
    ).rejects.toThrow('outcome_unknown');
    expect(s.release).toHaveBeenCalledExactlyOnceWith(true);
  });
  it('awaits the native end acknowledgement and releases exactly once after a connection error', async () => {
    let acknowledge!: () => void;
    const end = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          acknowledge = resolve;
        }),
    );
    const s = mockClient({ end });
    const base = s.client.query;
    s.client.query = async (sql, values) => {
      if (sql.includes('worker_gateway_execute')) {
        s.events.emit('error', new Error('private-canary'));
        throw new Error('private-canary');
      }
      return base(sql, values);
    };
    let settled = false;
    const run = dispatchDatabase(
      { connect: async () => s.client },
      input,
      config,
      new AbortController().signal,
    ).catch((e) => {
      settled = true;
      throw e;
    });
    await vi.waitFor(() => expect(end).toHaveBeenCalledTimes(1));
    expect(settled).toBe(false);
    expect(s.release).not.toHaveBeenCalled();
    acknowledge();
    await expect(run).rejects.toThrow('outcome_unknown');
    expect(s.release).toHaveBeenCalledExactlyOnceWith(true);
  });
  it('reports unverified cleanup when a native close never acknowledges', async () => {
    const s = mockClient({ end: () => new Promise(() => {}) });
    const controller = new AbortController();
    const base = s.client.query;
    s.client.query = async (sql, values) => {
      if (sql.includes('worker_gateway_execute')) {
        controller.abort();
        throw new Error('synthetic');
      }
      return base(sql, values);
    };
    await expect(
      dispatchDatabase({ connect: async () => s.client }, input, config, controller.signal),
    ).rejects.toThrow('cleanup_unverified');
    expect(s.release).toHaveBeenCalledExactlyOnceWith(true);
  });
});
