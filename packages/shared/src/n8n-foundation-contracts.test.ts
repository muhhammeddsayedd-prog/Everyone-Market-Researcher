import { describe, expect, it } from 'vitest';
import { foundationRequest, foundationReceipt, foundationWindowId } from './n8n-foundation-contracts';

const requestId = '0d83a7d6-0cb5-4f5f-a9cd-c604d5b5558a';
const window = {
  id: foundationWindowId,
  startsAt: null,
  expiresAt: null,
  closed: false,
  totalAdmitted: 0,
  boundAudience: 'https://example.vercel.app',
  boundCommitSha: 'a'.repeat(40),
  boundDeploymentId: 'dpl_example',
};
describe('separate bounded M03 foundation protocol', () => {
  it('accepts the reviewed fresh foundation window but rejects unrelated or unknown windows', () => {
    const receipt = {
      state: 'admitted',
      code: null,
      result: null,
      operation: 'identity.read',
      replayed: false,
      window: { ...window, id: '38b3708d-61b0-41d2-8170-5ed91c66b4dc' },
    };
    expect(foundationReceipt(receipt, 'identity.read').window.id).toBe(receipt.window.id);
    for (const id of ['76c2ad42-c094-4ba4-9a0b-566e19b97780', requestId])
      expect(() => foundationReceipt({ ...receipt, window: { ...window, id } }, 'identity.read')).toThrow(
        'invalid_result',
      );
  });
  it('permits only measured keyed Apify cost replay, including nullable optional attribution', () => {
    const e = {
      provider: 'apify',
      category: 'scrape',
      quantity: 1,
      unit: 'result',
      cost_usd: 1.01,
      run_id: requestId,
      competitor_id: requestId,
      platform: 'website_work_page',
      item_id: null,
      day: null,
      meta: {
        actor: 'apify/website-content-crawler',
        apify_run_id: 'originalRun',
        account_id: requestId,
        cost_key: 'apify:originalRun:' + requestId,
      },
    };
    const make = (entry: unknown) =>
      foundationRequest({ version: 1, requestId, operation: 'cost.log', args: { entries: [entry] } });
    expect(make(e).args).toEqual({ entries: [e] });
    expect(() => make({ ...e, meta: { ...e.meta, token: 'private' } })).toThrow('invalid_request');
    expect(() => make({ ...e, provider: 'openai' })).toThrow('invalid_request');
  });
  it('permits fixed operations but rejects arbitrary SQL, hosts, roles and extra arguments', () => {
    const make = (operation: string, args: unknown) =>
      foundationRequest({ version: 1, requestId, operation, args });
    expect(make('apify.dataset.read', { apifyRunId: 'originalRun' }).args).toEqual({
      apifyRunId: 'originalRun',
    });
    for (const args of [
      { apifyRunId: 'originalRun', url: 'https://example.com' },
      { datasetId: 'guessed' },
      { apifyRunId: 'originalRun', role: 'postgres' },
    ])
      expect(() => make('apify.dataset.read', args)).toThrow('invalid_request');
    expect(() => make('sql.execute', { sql: 'select 1' })).toThrow('invalid_request');
    expect(() => make('request.status', { targetRequestId: requestId })).toThrow('invalid_request');
  });
  it('uses typed original operations for status and does not accept a cached grant as fresh', () => {
    const r = {
      state: 'completed',
      code: null,
      result: { run_id: requestId },
      window,
      replayed: true,
      operation: 'run.start',
    };
    expect(foundationReceipt(r, 'request.status')).toEqual(r);
    expect(
      foundationReceipt(
        {
          ...r,
          state: 'closed',
          code: 'window_closed',
          result: null,
          operation: 'request.status',
          replayed: false,
        },
        'request.status',
      ).state,
    ).toBe('closed');
    expect(() => foundationReceipt({ ...r, operation: 'identity.read' }, 'request.status')).toThrow(
      'invalid_result',
    );
    expect(() => foundationReceipt({ ...r, replayed: false }, 'request.status')).toThrow('invalid_result');
    expect(() =>
      foundationReceipt(
        { ...r, window: { ...window, id: '76c2ad42-c094-4ba4-9a0b-566e19b97780' } },
        'request.status',
      ),
    ).toThrow('invalid_result');
  });
  it('rejects non-public callback data, error dumps, real recipient payloads and raw metadata', () => {
    expect(() =>
      foundationRequest({
        version: 1,
        requestId,
        operation: 'error.log',
        args: {
          entry: {
            kind: 'error',
            workflow: 'WF-90',
            execution_id: '42',
            node: 'Classify',
            message: 'raw secret goes here',
          },
        },
      }),
    ).toThrow('invalid_request');
    expect(() =>
      foundationReceipt(
        {
          state: 'completed',
          code: null,
          result: { recorded: true, action: 'workflow_error' },
          window,
          replayed: false,
          operation: 'callback.reject',
        },
        'callback.reject',
      ),
    ).toThrow('invalid_result');
    expect(() =>
      foundationReceipt(
        {
          state: 'completed',
          code: null,
          result: { run_id: requestId, password: 'private' },
          window,
          replayed: false,
          operation: 'run.start',
        },
        'run.start',
      ),
    ).toThrow('invalid_result');
  });
});
