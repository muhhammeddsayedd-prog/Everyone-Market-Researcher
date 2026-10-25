import { describe, expect, it } from 'vitest';
import {
  foundationRequest,
  foundationReceipt,
  foundationWindowId,
  parseFoundationWindowId,
  foundationSmokeInput,
} from './n8n-foundation-contracts';

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
  it('accepts a fresh-window fixed actor request shape without granting registration or actor execution', () => {
    const launch = {
      window_id: '11111111-1111-4111-8111-111111111111',
      launch_id: requestId,
      run_id: requestId,
      account_id: requestId,
      execution_id: '42',
      actor_id: 'aYG0l9s7dbB7j3gbS',
      actor_build: '0.3.99',
      input: foundationSmokeInput,
      memory_mb: 1024,
      timeout_seconds: 300,
      max_total_charge_usd: 1,
    };
    const make = (value: unknown) =>
      foundationRequest({ version: 1, requestId, operation: 'launch.authorize', args: { launch: value } });
    expect(make(launch).args).toEqual({ launch });
    for (const change of [
      { window_id: 'not-a-window' },
      { window_id: '76c2ad42-c094-4ba4-9a0b-566e19b97780' },
      { actor_id: 'foreign-actor' },
      { max_total_charge_usd: 2 },
    ])
      expect(() => make({ ...launch, ...change })).toThrow('invalid_request');
  });
  it.each([
    '38b3708d-61b0-41d2-8170-5ed91c66b4dc',
    'eda4fae1-1e19-47db-81b8-beac1a4ed883',
    '3c46c791-e140-4eb9-890a-eecfa251f65e',
    '4c602549-2c42-4ec3-9328-714d7cb66a77',
    'edbc6d11-7c1f-43a7-b745-1ded06deb29f',
    'e2be1a67-f6db-4c90-bfd2-671c5db9b90a',
    '11111111-1111-4111-8111-111111111111',
  ])(
    'accepts canonical window %s while SQL registration and exact deployment binding remain required',
    (fresh) => {
      const receipt = {
        state: 'admitted',
        code: null,
        result: null,
        operation: 'identity.read',
        replayed: false,
        window: { ...window, id: fresh },
      };
      expect(foundationReceipt(receipt, 'identity.read').window.id).toBe(receipt.window.id);
      expect(parseFoundationWindowId(fresh)).toBe(fresh);
      for (const id of [
        '76c2ad42-c094-4ba4-9a0b-566e19b97780',
        '11111111-1111-4111-7111-111111111111',
        'not-a-window',
      ])
        expect(() => foundationReceipt({ ...receipt, window: { ...window, id } }, 'identity.read')).toThrow(
          'invalid_result',
        );
    },
  );
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
