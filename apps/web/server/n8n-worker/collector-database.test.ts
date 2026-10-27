// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { dispatchCollectorDatabase } from './collector-database';
import type { CollectorConfig } from './collectors';

const config = {} as CollectorConfig;
function setup(principal = 'n8n_writer', login = 'n8n_writer') {
  const query = vi.fn(async (sql: string) => ({
    rows: sql.startsWith('select current_user')
      ? [{ principal, login, database: 'postgres' }]
      : sql.startsWith('select ops.collector_execute')
        ? [{ receipt: { replayed: false, result: { run_id: 'synthetic' } } }]
        : [],
  }));
  const client = { query, release: vi.fn(), end: vi.fn(async () => {}), on: vi.fn(), off: vi.fn() };
  return { client, pool: { connect: async () => client }, query };
}
describe('M04 concrete restricted database adapter', () => {
  it('uses a fixed parameterized RPC after checking both native principals', async () => {
    const t = setup();
    await dispatchCollectorDatabase(
      t.pool,
      '27000000-0000-4000-8000-000000000001',
      'start',
      { workflow: 'WF-10' },
      config,
      new AbortController().signal,
    );
    expect(t.query.mock.calls.map((c) => c[0])).toEqual([
      'begin',
      expect.stringContaining('statement_timeout'),
      expect.stringContaining('current_user'),
      'select ops.collector_execute($1::uuid,$2::text,$3::jsonb) as receipt',
      'commit',
    ]);
    expect(t.client.release).toHaveBeenCalledExactlyOnceWith();
  });
  it.each([
    ['postgres', 'n8n_writer'],
    ['n8n_writer', 'postgres'],
  ])('rejects principal/login %s/%s before product RPC', async (principal, login) => {
    const t = setup(principal, login);
    await expect(
      dispatchCollectorDatabase(t.pool, 'id', 'start', {}, config, new AbortController().signal),
    ).rejects.toThrow('identity_denied');
    expect(t.query.mock.calls.some((c) => c[0].includes('collector_execute'))).toBe(false);
  });
  it('never dispatches arbitrary SQL or retries a lost receipt', async () => {
    const t = setup();
    await expect(
      dispatchCollectorDatabase(t.pool, 'id', 'select *', {}, config, new AbortController().signal),
    ).rejects.toThrow();
    expect(t.query).not.toHaveBeenCalled();
  });
});
