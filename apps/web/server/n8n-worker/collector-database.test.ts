// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { dispatchCollectorDatabase } from './collector-database';
import type { CollectorConfig } from './collectors';

const config = {} as CollectorConfig;
function setup(principal = 'n8n_writer', login = 'n8n_writer') {
  const query = vi.fn<(sql: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>>(
    async (sql: string) => ({
      rows: sql.startsWith('select current_user')
        ? [{ principal, login, database: 'postgres' }]
        : sql.startsWith('select ops.collector_execute')
          ? [{ receipt: { replayed: false, result: { run_id: 'synthetic' } } }]
          : [],
    }),
  );
  const client = { query, release: vi.fn(), end: vi.fn(async () => {}), on: vi.fn(), off: vi.fn() };
  return { client, pool: { connect: async () => client }, query };
}
describe('M04 concrete restricted database adapter', () => {
  it('binds campaign identity and native execution to the single reviewed tick RPC', async () => {
    const t = setup();
    t.query.mockImplementation(async (sql: string) => ({
      rows: sql.startsWith('select current_user')
        ? [{ principal: 'n8n_writer', login: 'n8n_writer', database: 'postgres' }]
        : sql.startsWith('select ops.m06_campaign_tick')
          ? [{ receipt: { replayed: false, result: { action: 'idle' } } }]
          : [],
    }));
    const result = await dispatchCollectorDatabase(
      t.pool,
      '27000000-0000-4000-8000-000000000001',
      'm06.campaign_tick',
      { campaign_id: '27000000-0000-4000-8000-000000000002', execution_id: '73001' },
      { ...config, scope: 'm06' },
      new AbortController().signal,
    );
    expect(result).toEqual({ replayed: false, result: { action: 'idle' } });
    expect(t.query).toHaveBeenCalledWith(
      'select ops.m06_campaign_tick($1::uuid,$2::uuid,$3::text) as receipt',
      ['27000000-0000-4000-8000-000000000001', '27000000-0000-4000-8000-000000000002', '73001'],
    );
    expect(t.query.mock.calls.some(([sql]) => sql.includes('ops.m06_execute'))).toBe(false);
  });
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

describe('M04 classified global error audit', () => {
  it('uses the existing idempotent error RPC without failing a parent or releasing claims', async () => {
    const t = setup();
    const receipt = await dispatchCollectorDatabase(
      t.pool,
      'unused-audit-id',
      'execution.error',
      {
        workflow_id: 'TsqSMa5MlO3QBLkt',
        execution_id: '314',
        error_code: 'callback_retryable',
      },
      config,
      new AbortController().signal,
    );
    expect(receipt).toEqual({ replayed: false, result: { logged: true, reconciliation_required: true } });
    expect(t.query).toHaveBeenCalledWith('select ops.log_workflow_error($1::jsonb) as logged', [
      JSON.stringify({
        kind: 'error',
        workflow: 'WF-19',
        execution_id: '314',
        node: 'Workflow',
        message: 'callback_retryable',
      }),
    ]);
    expect(
      t.query.mock.calls.some(([sql]) => /collector_execute|finish_run|report_account_result/.test(sql)),
    ).toBe(false);
    expect(t.client.release).toHaveBeenCalledExactlyOnceWith();
  });
  it('marks trigger errors using their real handler execution, never an invented originating run', async () => {
    const t = setup();
    await dispatchCollectorDatabase(
      t.pool,
      'unused-audit-id',
      'execution.error',
      {
        workflow_id: '4JMHLDBSdgGxhPlk',
        execution_id: 'handler-315',
        error_code: 'workflow_failed',
      },
      config,
      new AbortController().signal,
    );
    expect(t.query).toHaveBeenCalledWith('select ops.log_workflow_error($1::jsonb) as logged', [
      JSON.stringify({
        kind: 'error',
        workflow: 'WF-10',
        execution_id: 'handler-315',
        node: 'Trigger activation',
        message: 'workflow_failed',
      }),
    ]);
  });
  it.each([
    { workflow_id: 'unrelated-workflow', execution_id: '314', error_code: 'workflow_failed' },
    { workflow_id: '4JMHLDBSdgGxhPlk', execution_id: '314', error_code: 'callback_retryable' },
    {
      workflow_id: 'TsqSMa5MlO3QBLkt',
      execution_id: '314',
      error_code: 'callback_retryable',
      run_id: 'guessed',
    },
    {
      workflow_id: 'TsqSMa5MlO3QBLkt',
      execution_id: '314',
      error_code: 'callback_retryable',
      message: 'private error text',
    },
  ])('rejects untrusted audit context before opening a connection', async (args) => {
    const t = setup();
    await expect(
      dispatchCollectorDatabase(
        t.pool,
        'unused',
        'execution.error',
        args,
        config,
        new AbortController().signal,
      ),
    ).rejects.toThrow('invalid_request');
    expect(t.query).not.toHaveBeenCalled();
  });
});
