// @vitest-environment node
import { EventEmitter } from 'node:events';
import { describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { dispatchFoundationDatabase, type WorkerClient } from './database';
import { foundationWindowId, type FoundationRequest } from '@emr/shared';
const requestId = '0d83a7d6-0cb5-4f5f-a9cd-c604d5b5558a';
const config = {
  audience: 'https://example.vercel.app',
  password: 'synthetic',
  verifier: '',
  windowId: foundationWindowId,
  commitSha: 'a'.repeat(40),
  deploymentId: 'dpl_synthetic',
  apifyReadToken: 'synthetic',
} as const;
const window = {
  id: foundationWindowId,
  boundAudience: config.audience,
  boundCommitSha: config.commitSha,
  boundDeploymentId: config.deploymentId,
};
function fixture(options: { cached?: boolean; foreign?: boolean; owner?: boolean } = {}) {
  const events = new EventEmitter(),
    calls: string[] = [],
    release = vi.fn();
  const read = vi.fn(async () => {
    calls.push('external');
    return { terminal: {}, rows: [] };
  });
  const client: WorkerClient = {
    on: events.on.bind(events),
    off: events.off.bind(events),
    release,
    end: vi.fn(async () => {}),
    query: vi.fn(async (sql: string) => {
      calls.push(sql);
      if (sql.includes('current_user'))
        return {
          rows: [
            {
              currentUser: 'n8n_writer',
              sessionUser: options.owner ? 'postgres' : 'n8n_writer',
              database: 'postgres',
              connectionCount: 1,
            },
          ],
        };
      if (sql.includes('foundation_gateway_admit'))
        return {
          rows: [
            {
              receipt: {
                state: options.cached && !sql.includes('inspect') ? 'completed' : 'admitted',
                window: { ...window, ...(options.foreign ? { boundDeploymentId: 'dpl_foreign' } : {}) },
              },
            },
          ],
        };
      if (sql.includes('read_context')) return { rows: [{ context: { apify_run_id: 'original' } }] };
      if (sql.includes('complete_read'))
        return { rows: [{ receipt: { state: 'completed', result: { terminal: {} } } }] };
      return { rows: [] };
    }),
  };
  return { client, calls, read, release };
}
const input: FoundationRequest = {
  version: 1,
  requestId,
  operation: 'apify.dataset.read',
  args: { apifyRunId: 'original' },
};
describe('fixed foundation database and external read sequence', () => {
  it('persists admission and one-shot read intent before network, then saves result before responding', async () => {
    const s = fixture();
    await dispatchFoundationDatabase(
      { connect: async () => s.client },
      input,
      config,
      new AbortController().signal,
      s.read,
    );
    expect(s.calls.filter((x) => x === 'commit')).toHaveLength(5);
    const context = s.calls.findIndex((x) => x.includes('read_context')),
      external = s.calls.indexOf('external'),
      completed = s.calls.findIndex((x) => x.includes('complete_read'));
    expect(context).toBeLessThan(external);
    expect(s.calls.slice(context + 1, external)).toContain('commit');
    expect(external).toBeLessThan(completed);
    expect(s.calls[completed + 1]).toBe('commit');
    expect(s.calls.some((x) => x.includes('worker_gateway_') || /set role|postgres\./i.test(x))).toBe(false);
    expect(s.release).toHaveBeenCalledExactlyOnceWith();
  });
  it('never repeats provider reads for cached outcomes or an owner/foreign deployment identity', async () => {
    for (const options of [{ cached: true }, { owner: true }, { foreign: true }]) {
      const s = fixture(options),
        work = dispatchFoundationDatabase(
          { connect: async () => s.client },
          input,
          config,
          new AbortController().signal,
          s.read,
        );
      if (options.cached) await work;
      else await expect(work).rejects.toThrow();
      expect(s.read).not.toHaveBeenCalled();
      expect(s.calls.some((x) => x.includes('read_context'))).toBe(false);
    }
  });
  it('does not fabricate a completed result after an interrupted authenticated read', async () => {
    const s = fixture();
    s.read.mockRejectedValueOnce(Error('private-provider-error'));
    await expect(
      dispatchFoundationDatabase(
        { connect: async () => s.client },
        input,
        config,
        new AbortController().signal,
        s.read,
      ),
    ).rejects.toThrow('outcome_unknown');
    expect(s.calls.some((x) => x.includes('complete_read'))).toBe(false);
    expect(s.release).toHaveBeenCalledExactlyOnceWith(true);
  });
});
