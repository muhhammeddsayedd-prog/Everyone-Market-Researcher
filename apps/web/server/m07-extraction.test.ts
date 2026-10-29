// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { createExtractionHandler, extractionConfig } from './m07-extraction';
import { localExtractionDatabaseUrl, dispatchExtractionDatabase } from './m07-extraction-database';
import type { M07Dispatch } from '@emr/shared';
import type { WorkerPool } from './n8n-worker/database';
import ai from '../../../n8n/normalizers/aiResult.js';

const owner = '11111111-1111-4111-a111-111111111111';
const attempt = '22222222-2222-4222-a222-222222222222';
const item = '33333333-3333-4333-a333-333333333333';
const token = 'controlled_local_token_12345678901234567890';
const origin = 'http://127.0.0.1:3037';
const env: Record<string, string> = {
  NODE_ENV: 'test',
  EMR_M07_LOCAL_ENABLED: 'true',
  EMR_M07_LOCAL_AUDIENCE: origin,
  EMR_M07_LOCAL_TOKEN_SHA256: createHash('sha256').update(token).digest('hex'),
  EMR_M07_LOCAL_DATABASE_URL: 'postgresql://n8n_writer@127.0.0.1:54322/postgres',
  OPENAI_MODEL_EXTRACT: 'controlled-model',
};
const tax = {
  content_format: ['tvc_brand_film', 'other'],
  industry: ['telecom', 'other'],
  occasion: ['ramadan', 'other'],
  credit_role: ['director', 'other'],
};
const prices = {
  'openai/controlled-model:input': { unit: '1M tokens', usd: 2 },
  'openai/controlled-model:cached_input': { unit: '1M tokens', usd: 0.5 },
  'openai/controlled-model:output': { unit: '1M tokens', usd: 8 },
};
const prepared = {
  attempt_id: attempt,
  owner_id: owner,
  item_id: item,
  msg_id: 1,
  state: 'prepared',
  result: null,
  acked: false,
  context: {
    item: {
      id: item,
      item_type: 'video',
      title: 'Controlled fixture',
      caption_original: 'Controlled text',
      credits_text: null,
      published_at: '2026-10-29T00:00:00Z',
      url: 'https://vimeo.com/123',
    },
    competitor: { id: owner, name: 'Controlled Films', markets: ['EG'], categories: ['production'] },
    account: { platform: 'vimeo', handle: 'controlledfilms' },
    alias_hints: [],
  },
  taxonomy: tax,
  prices,
  config: {
    model: 'controlled-model',
    prompt_version: 'extract_item.v1',
    schema_version: 'item_extraction.v1',
  },
};
const extraction = JSON.parse(
  readFileSync(
    new URL('../../../n8n/normalizers/fixtures/ai/controlled-extraction.v1.json', import.meta.url),
    'utf8',
  ),
);
const wire = () => ({
  id: 'resp_controlled_fixture',
  object: 'response',
  model: 'controlled-model',
  status: 'completed',
  output: [
    {
      type: 'message',
      role: 'assistant',
      status: 'completed',
      content: [{ type: 'output_text', text: JSON.stringify(extraction) }],
    },
  ],
  usage: {
    input_tokens: 1000,
    output_tokens: 200,
    total_tokens: 1200,
    input_tokens_details: { cached_tokens: 400 },
  },
});
const req = (
  operation = 'prepare',
  args: unknown = { attempt_id: attempt, owner_id: owner },
  headers: Record<string, string> = {},
) =>
  new Request(origin + '/api/internal/m07/extract', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ version: 1, requestId: owner, operation, args }),
  });
function setup(environment: Record<string, string | undefined> = env, implementation?: M07Dispatch) {
  let frozen: Record<string, unknown> | null = null;
  const dispatch = vi.fn<M07Dispatch>(async (op, args, signal) => {
    if (op === 'frozen')
      return { ...structuredClone(prepared), snapshot: frozen, request_hash: frozen ? 'a'.repeat(64) : null };
    if (op === 'freeze') {
      frozen = structuredClone(args.snapshot) as Record<string, unknown>;
      return { ...structuredClone(prepared), snapshot: frozen, request_hash: 'a'.repeat(64) };
    }
    return implementation
      ? implementation(op, args, signal)
      : op === 'prepare'
        ? structuredClone(prepared)
        : { attempt_id: attempt, state: 'completed', result: { ai_status: 'done' }, replayed: false };
  });
  const database = vi.fn(() => dispatch);
  return {
    dispatch,
    database,
    handler: createExtractionHandler({ environment: () => environment, database }),
  };
}

describe('M07 local extraction adapter', () => {
  it('refuses hosted/production targets before database I/O', async () => {
    for (const change of [{ NODE_ENV: 'production' }, { VERCEL_ENV: 'preview' }, { VERCEL: '1' }]) {
      const s = setup({ ...env, ...change });
      expect((await s.handler(req())).status).toBe(404);
      expect(s.database).not.toHaveBeenCalled();
    }
    for (const url of [
      'postgresql://postgres@127.0.0.1:54322/postgres',
      'postgresql://n8n_writer@host.supabase.co:5432/postgres',
      'postgresql://n8n_writer@127.0.0.1:54322/postgres?sslmode=disable',
    ])
      expect(() => localExtractionDatabaseUrl(url)).toThrow();
    expect(() => extractionConfig({ ...env, EMR_M07_LOCAL_AUDIENCE: 'http://127.0.0.1:3037/x' })).toThrow();
  });
  it('requires exact authenticated origin/path without browser cookies or caller model settings', async () => {
    const cases: Record<string, string>[] = [
      { authorization: 'Bearer ' + token + 'wrong' },
      { cookie: 'session=unexpected' },
      { origin },
    ];
    for (const headers of cases) {
      const s = setup();
      expect((await s.handler(req('prepare', undefined, headers))).status).not.toBe(200);
      expect(s.dispatch).not.toHaveBeenCalled();
    }
    const s = setup();
    expect(
      (await s.handler(req('prepare', { attempt_id: attempt, owner_id: owner, model: 'caller-selected' })))
        .status,
    ).toBe(400);
    expect(s.dispatch).not.toHaveBeenCalled();
  });
  it('constructs the versioned text request from restricted SQL context with server model', async () => {
    const s = setup();
    const response = await s.handler(req());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.result.provider_request.model).toBe(env.OPENAI_MODEL_EXTRACT);
    expect(body.result.provider_request.store).toBe(false);
    expect(body.result.provider_request.text.format.strict).toBe(true);
    expect(s.dispatch.mock.calls.find((c) => c[0] === 'prepare')?.[1]).toEqual({
      attempt_id: attempt,
      owner_id: owner,
      model: env.OPENAI_MODEL_EXTRACT,
      prompt_version: 'extract_item.v1',
      schema_version: 'item_extraction.v1',
    });
  });
  it('only durable one-shot admission returns a provider request', async () => {
    const s = setup(env, async (op) =>
      op === 'prepare' ? prepared : { attempt_id: attempt, state: 'dispatched', admitted: false },
    );
    const body = await (await s.handler(req('dispatch'))).json();
    expect(body.result.provider_request).toBeNull();
    expect(s.dispatch.mock.calls.map((c) => c[0])).toEqual(['frozen', 'prepare', 'freeze', 'dispatch']);
  });
  it('settles strict output and cached-token partition cost as simulated, not actual provider spend', async () => {
    const s = setup();
    expect(
      (await s.handler(req('settle', { attempt_id: attempt, owner_id: owner, provider_response: wire() })))
        .status,
    ).toBe(200);
    const apply = s.dispatch.mock.calls.find((c) => c[0] === 'apply')![1];
    expect(apply.item_id).toBe(item);
    expect(apply.result).toEqual(extraction);
    expect(apply.meta).toMatchObject({
      attempt_id: attempt,
      owner_id: owner,
      input_tokens: 1000,
      output_tokens: 200,
      cached_tokens: 400,
      used_vision: false,
      usage_known: true,
      accounting_mode: 'simulated',
    });
    expect((apply.meta as Record<string, unknown>).cost_usd).toBeCloseTo(0.003);
  });
  it('records known refused usage but preserves unknown usage/cost as null', async () => {
    const refused = {
      ...wire(),
      output: [
        {
          type: 'message',
          role: 'assistant',
          status: 'completed',
          content: [{ type: 'refusal', refusal: 'controlled refusal' }],
        },
      ],
    };
    const s = setup();
    await s.handler(req('settle', { attempt_id: attempt, owner_id: owner, provider_response: refused }));
    const failure = s.dispatch.mock.calls.find((c) => c[0] === 'fail')![1];
    expect(failure.outcome).toBe('refused');
    expect(failure.meta).toMatchObject({
      usage_known: true,
      provider_response_id: 'resp_controlled_fixture',
    });
    const u = setup();
    await u.handler(
      req('settle', {
        attempt_id: attempt,
        owner_id: owner,
        provider_response: { ...wire(), usage: undefined },
      }),
    );
    const unknown = u.dispatch.mock.calls.find((c) => c[0] === 'fail')![1];
    expect(unknown.outcome).toBe('unknown');
    expect(unknown.meta).toMatchObject({
      usage_known: false,
      input_tokens: null,
      cost_usd: null,
      provider_response_id: null,
    });
    expect(u.dispatch.mock.calls.some((c) => c[0] === 'apply')).toBe(false);
  });
  it('does not price a response from a model other than the admitted configuration', async () => {
    const s = setup();
    await s.handler(
      req('settle', {
        attempt_id: attempt,
        owner_id: owner,
        provider_response: { ...wire(), model: 'different-model' },
      }),
    );
    expect(s.dispatch.mock.calls.find((c) => c[0] === 'fail')![1].outcome).toBe('unknown');
    expect(s.dispatch.mock.calls.some((c) => c[0] === 'apply')).toBe(false);
  });
  it('freezes the exact request/context/schema/prices and ignores changed valid runtime settings', async () => {
    const current = { ...env };
    const s = setup(current);
    const first = await (await s.handler(req())).json();
    const snapshot = s.dispatch.mock.calls.find((c) => c[0] === 'freeze')![1].snapshot as Record<
      string,
      unknown
    >;
    expect(snapshot).toMatchObject({
      version: 1,
      kind: 'extraction',
      context: prepared.context,
      taxonomy: tax,
      prices,
    });
    expect((snapshot.schema as Record<string, unknown>).content).toEqual(ai.extractionSchema.schema);
    expect((snapshot.prompt as Record<string, unknown>).content).toBe(ai.promptTemplate);
    current.OPENAI_MODEL_EXTRACT = 'different-valid-model';
    current.EMR_M07_MAX_OUTPUT_TOKENS = '4000';
    const again = await (await s.handler(req())).json();
    expect(again.result.provider_request).toEqual(first.result.provider_request);
    expect(s.dispatch.mock.calls.filter((c) => c[0] === 'prepare')).toHaveLength(1);
    expect(
      (await s.handler(req('settle', { attempt_id: attempt, owner_id: owner, provider_response: wire() })))
        .status,
    ).toBe(200);
    expect(s.dispatch.mock.calls.find((c) => c[0] === 'apply')![1].meta).toMatchObject({
      model: 'controlled-model',
      cost_usd: 0.003,
    });
  });
  it('returns fixed redacted reconciliation failure without replaying an uncertain write', async () => {
    const s = setup(env, async (op) => {
      if (op === 'prepare') return prepared;
      throw Error('raw sensitive error must never escape');
    });
    const r = await s.handler(
      req('settle', { attempt_id: attempt, owner_id: owner, provider_response: wire() }),
    );
    expect(r.status).toBe(503);
    expect(await r.text()).not.toContain('raw sensitive');
    expect(s.dispatch.mock.calls.filter((c) => c[0] === 'apply')).toHaveLength(1);
  });
});

describe('M07 restricted SQL transport', () => {
  function pool(failCommit = false, login = 'n8n_writer') {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('current_user'))
        return { rows: [{ principal: 'n8n_writer', login, database: 'postgres' }] };
      if (sql.startsWith('select ops.'))
        return { rows: [{ receipt: { attempt_id: attempt, state: 'completed' } }] };
      if (sql === 'commit' && failCommit) throw Error('sensitive transport failure');
      return { rows: [] };
    });
    const release = vi.fn(),
      end = vi.fn(async () => {});
    const p: WorkerPool = { connect: async () => ({ query, release, end, on: () => {}, off: () => {} }) };
    return { p, query, release, end };
  }
  it('uses actual restricted login identity, fixed RPC SQL and bound values', async () => {
    const s = pool();
    await dispatchExtractionDatabase(
      s.p,
      'ack',
      { attempt_id: attempt, owner_id: owner },
      new AbortController().signal,
    );
    expect(s.query.mock.calls.find((c) => c[0].startsWith('select ops.'))).toEqual([
      'select ops.m07_ack_ai($1::uuid,$2::uuid) as receipt',
      [attempt, owner],
    ]);
    expect(s.query.mock.calls.at(-1)?.[0]).toBe('commit');
    expect(s.release).toHaveBeenCalledOnce();
  });
  it('rejects owner access plus SET ROLE and does not run a mutation', async () => {
    const s = pool(false, 'postgres');
    await expect(
      dispatchExtractionDatabase(
        s.p,
        'ack',
        { attempt_id: attempt, owner_id: owner },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: 'identity_denied' });
    expect(s.query.mock.calls.some((c) => c[0].startsWith('select ops.'))).toBe(false);
    expect(s.query.mock.calls.at(-1)?.[0]).toBe('rollback');
  });
  it('does not retry an ambiguous commit or expose a raw credential-bearing error', async () => {
    const s = pool(true);
    await expect(
      dispatchExtractionDatabase(
        s.p,
        'ack',
        { attempt_id: attempt, owner_id: owner },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: 'reconciliation_required' });
    expect(s.query.mock.calls.filter((c) => c[0].startsWith('select ops.'))).toHaveLength(1);
    expect(s.release).toHaveBeenCalledOnce();
  });
  it('does not acquire a connection after cancellation', async () => {
    const signal = new AbortController();
    signal.abort();
    const connect = vi.fn();
    await expect(
      dispatchExtractionDatabase({ connect }, 'claim', { owner_id: owner, limit: 1 }, signal.signal),
    ).rejects.toMatchObject({ code: 'outcome_unknown' });
    expect(connect).not.toHaveBeenCalled();
  });
});
