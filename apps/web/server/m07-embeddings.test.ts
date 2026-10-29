// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { createEmbeddingHandler, embeddingConfig } from './m07-embeddings';
import { createExtractionHandler } from './m07-extraction';
import { m07GatewayConfig, m07DevProject, m07ProjectId } from './m07-gateway';
import { m07PoolConfig } from './m07-extraction-database';
import type { M07EmbeddingDispatch } from '@emr/shared';

const owner = '11111111-1111-4111-a111-111111111111';
const batch = '22222222-2222-4222-a222-222222222222';
const item = '33333333-3333-4333-a333-333333333333';
const token = 'controlled_local_embedding_token_1234567890';
const origin = 'http://127.0.0.1:3037';
const digest = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
const environment = (): Record<string, string | undefined> => ({
  NODE_ENV: 'test',
  EMR_M07_LOCAL_ENABLED: 'true',
  EMR_M07_LOCAL_AUDIENCE: origin,
  EMR_M07_LOCAL_TOKEN_SHA256: digest(token),
  EMR_M07_LOCAL_DATABASE_URL: 'postgresql://n8n_writer@127.0.0.1:60322/postgres',
  OPENAI_MODEL_EXTRACT: 'controlled-model',
  OPENAI_MODEL_EMBED: 'text-embedding-3-small',
});
const snapshot = () => {
  const text = 'Controlled public item summary.';
  return {
    provider_request: {
      model: 'text-embedding-3-small',
      input: [text],
      dimensions: 1536,
      encoding_format: 'float',
    },
    mapping: [
      { index: 0, entity_type: 'item', entity_id: item, content_hash: digest(text), text, msg_ids: [1] },
    ],
    input_contract_version: 'embedding_input.v1',
    dimensions: 1536,
    price: { unit: '1M tokens', usd: 0.02 },
    settings: { max_input_bytes: 4096, max_total_bytes: 16384, accounting_mode: 'simulated' },
    config: { accounting_mode: 'simulated' },
  };
};
function setup(env = environment(), override?: M07EmbeddingDispatch) {
  let frozen: ReturnType<typeof snapshot> | null = null;
  let state = 'claimed';
  const common = () => ({
    batch_id: batch,
    owner_id: owner,
    state,
    messages: [{ entity_type: 'item', entity_id: item, msg_id: 1 }],
    snapshot: frozen,
    request_hash: frozen ? 'b'.repeat(64) : null,
    acked: false,
  });
  const dispatch = vi.fn<M07EmbeddingDispatch>(
    override ??
      (async (op) => {
        if (op === 'status') return common();
        if (op === 'prepare') {
          frozen = snapshot();
          state = 'prepared';
          return common();
        }
        if (op === 'dispatch') {
          state = 'dispatched';
          return { ...common(), admitted: true };
        }
        if (op === 'settle') {
          state = 'completed';
          return { ...common(), result: { saved: 1, cost_usd: 0.000002 } };
        }
        if (op === 'unknown') {
          state = 'unknown';
          return common();
        }
        if (op === 'ack') return { ...common(), acked: true };
        return common();
      }),
  );
  const database = vi.fn(() => dispatch);
  return { dispatch, database, handler: createEmbeddingHandler({ environment: () => env, database }) };
}
const request = (
  operation = 'prepare',
  args: unknown = { batch_id: batch, owner_id: owner },
  base = origin,
  headers: Record<string, string> = {},
) =>
  new Request(base + '/api/internal/m07/embed', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ version: 1, requestId: owner, operation, args }),
  });
const devEnvironment = (): Record<string, string | undefined> => ({
  ...environment(),
  NODE_ENV: 'production',
  VERCEL_ENV: 'preview',
  VERCEL_GIT_COMMIT_REF: 'm07-ai-understanding',
  VERCEL_PROJECT_ID: m07ProjectId,
  VERCEL_URL: 'everyone-market-researcher-controlled.vercel.app',
  VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40),
  VERCEL_DEPLOYMENT_ID: 'dpl_controlled',
  EMR_M07_GATEWAY_ENABLED: 'true',
  EMR_M07_DEV_PROJECT_REF: m07DevProject,
  EMR_M07_GATEWAY_AUDIENCE: 'vercel-deployment',
  EMR_M07_GATEWAY_COMMIT_SHA: 'a'.repeat(40),
  EMR_M07_GATEWAY_TOKEN_SHA256: digest(token),
  EMR_M07_WRITER_PASSWORD: 'controlled_fixture_only',
  EMR_M07_ITEM_IDS: JSON.stringify([item]),
  EMR_M07_EMBED_ENTITIES: JSON.stringify([{ entity_type: 'item', entity_id: item }]),
});

describe('M07 embedding handler and disabled hosted profile', () => {
  it('defaults hosted gateways off and rejects production before database use', async () => {
    for (const change of [
      { NODE_ENV: 'production' },
      { VERCEL_ENV: 'preview' },
      { VERCEL_ENV: 'production', EMR_M07_GATEWAY_ENABLED: 'true' },
    ]) {
      const env = { ...environment(), ...change };
      const s = setup(env);
      expect((await s.handler(request())).status).not.toBe(200);
      expect(s.database).not.toHaveBeenCalled();
      const db = vi.fn();
      const extract = createExtractionHandler({ environment: () => env, database: db });
      expect(
        (await extract(new Request(origin + '/api/internal/m07/extract', { method: 'POST' }))).status,
      ).not.toBe(200);
      expect(db).not.toHaveBeenCalled();
    }
  });
  it('validates exact dev deployment, project, audience, branch, commit and server selectors', () => {
    expect(m07GatewayConfig(devEnvironment())).toMatchObject({
      profile: 'dev',
      accountingMode: 'provider',
      itemIds: [item],
    });
    const changes: Record<string, string | undefined>[] = [
      { VERCEL_ENV: 'production' },
      { VERCEL_GIT_COMMIT_REF: 'main' },
      { VERCEL_PROJECT_ID: 'different' },
      { EMR_M07_DEV_PROJECT_REF: 'hkiafqrcxaafdbcvjlzv' },
      { EMR_M07_GATEWAY_COMMIT_SHA: 'b'.repeat(40) },
      { VERCEL_URL: 'other.example.com' },
      { VERCEL_DEPLOYMENT_ID: 'invalid' },
      { EMR_M07_GATEWAY_AUDIENCE: 'caller' },
      { EMR_M07_ITEM_IDS: '[]' },
      { EMR_M07_EMBED_ENTITIES: '[]' },
      { EMR_M07_ITEM_IDS: JSON.stringify([item, item]) },
      { EMR_M07_EMBED_ENTITIES: JSON.stringify([{ entity_type: 'campaign', entity_id: item }]) },
      { EMR_M07_WRITER_PASSWORD: undefined },
    ];
    for (const change of changes)
      expect(() => m07GatewayConfig({ ...devEnvironment(), ...change })).toThrow();
  });
  it('requires exact machine audience and rejects caller settings, cookies and origins', async () => {
    const headerCases: Record<string, string>[] = [
      { authorization: 'Bearer invalid' },
      { cookie: 'unexpected' },
      { origin },
    ];
    for (const headers of headerCases) {
      const s = setup();
      expect((await s.handler(request('prepare', undefined, origin, headers))).status).not.toBe(200);
      expect(s.dispatch).not.toHaveBeenCalled();
    }
    const s = setup();
    expect(
      (await s.handler(request('prepare', { batch_id: batch, owner_id: owner, model: 'caller-model' })))
        .status,
    ).toBe(400);
    expect(s.dispatch).not.toHaveBeenCalled();
    expect((await s.handler(request('prepare', undefined, 'http://127.0.0.1:3038'))).status).toBe(403);
  });
  it('passes only server batch size and selected entities to the owned claim', async () => {
    const env = devEnvironment();
    env.EMR_M07_EMBED_BATCH_SIZE = '3';
    const s = setup(env);
    expect((await s.handler(request('claim', { owner_id: owner }, 'https://' + env.VERCEL_URL))).status).toBe(
      200,
    );
    expect(s.dispatch.mock.calls[0]?.[1]).toEqual({
      owner_id: owner,
      limit: 3,
      allowed_entities: [{ entity_type: 'item', entity_id: item }],
    });
  });
  it('returns the immutable SQL request and ignores later valid model/settings changes', async () => {
    const env = environment();
    const s = setup(env);
    const first = await (await s.handler(request())).json();
    expect(first.result.provider_request).toMatchObject({
      model: 'text-embedding-3-small',
      dimensions: 1536,
    });
    env.OPENAI_MODEL_EMBED = 'text-embedding-3-large';
    env.EMR_M07_EMBED_MAX_INPUT_BYTES = '1024';
    const replay = await (await s.handler(request())).json();
    expect(replay.result.provider_request).toEqual(first.result.provider_request);
    expect(s.dispatch.mock.calls.filter((c) => c[0] === 'prepare')).toHaveLength(1);
    expect(s.dispatch.mock.calls.find((c) => c[0] === 'prepare')?.[1]).toMatchObject({
      model: 'text-embedding-3-small',
      input_version: 'embedding_input.v1',
    });
  });
  it('all-unchanged completion can ACK without a provider request', async () => {
    const empty = {
      ...snapshot(),
      mapping: [],
      provider_request: { ...snapshot().provider_request, input: [] },
    };
    const s = setup(environment(), async (op) =>
      op === 'ack'
        ? { batch_id: batch, owner_id: owner, state: 'completed', acked: true }
        : {
            batch_id: batch,
            owner_id: owner,
            state: 'completed',
            snapshot: empty,
            request_hash: 'b'.repeat(64),
            result: { skipped: 1 },
            acked: false,
          },
    );
    const prepared = await (await s.handler(request())).json();
    expect(prepared.result.provider_request).toBeNull();
    expect((await s.handler(request('ack'))).status).toBe(200);
    expect(s.dispatch.mock.calls.some((c) => c[0] === 'dispatch' || c[0] === 'settle')).toBe(false);
  });
  it('forwards one raw provider response for one aggregate SQL settlement, including invalid vectors', async () => {
    const s = setup();
    const response = {
      object: 'list',
      model: 'text-embedding-3-small',
      data: [],
      usage: { prompt_tokens: 100, total_tokens: 100 },
    };
    expect(
      (await s.handler(request('settle', { batch_id: batch, owner_id: owner, provider_response: response })))
        .status,
    ).toBe(200);
    const calls = s.dispatch.mock.calls.filter((c) => c[0] === 'settle');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.[1]).toEqual({
      batch_id: batch,
      owner_id: owner,
      provider_response: response,
      request_hash: 'b'.repeat(64),
      accounting_mode: 'simulated',
    });
  });
  it('contains uncertain outcomes and never ACKs or retries the provider', async () => {
    const s = setup();
    const result = await (await s.handler(request('outcome.unknown'))).json();
    expect(result.result.state).toBe('unknown');
    expect(s.dispatch.mock.calls.filter((c) => c[0] === 'unknown')).toHaveLength(1);
    expect(s.dispatch.mock.calls.some((c) => c[0] === 'ack' || c[0] === 'dispatch')).toBe(false);
  });
  it('rejects an admitted batch outside the server entity scope before settlement', async () => {
    const env = devEnvironment();
    env.EMR_M07_EMBED_ENTITIES = JSON.stringify([{ entity_type: 'organization', entity_id: item }]);
    const s = setup(env);
    const r = await s.handler(
      request(
        'settle',
        { batch_id: batch, owner_id: owner, provider_response: {} },
        'https://' + env.VERCEL_URL,
      ),
    );
    expect(r.status).toBe(403);
    expect(s.dispatch.mock.calls.some((c) => c[0] === 'settle' || c[0] === 'prepare')).toBe(false);
  });
  it('uses only pinned dev session-pooler TLS with the restricted writer role', () => {
    const ca = readFileSync(new URL('./n8n-worker/certs/supabase-root-2021.crt', import.meta.url));
    const c = m07PoolConfig('controlled_fixture_only', 'dev', ca);
    expect(c).toMatchObject({
      host: 'aws-1-eu-central-1.pooler.supabase.com',
      port: 5432,
      database: 'postgres',
      user: 'n8n_writer.zmotjsbzhzjvpelxvxlf',
    });
    expect(c.ssl).toMatchObject({
      rejectUnauthorized: true,
      minVersion: 'TLSv1.2',
      servername: 'aws-1-eu-central-1.pooler.supabase.com',
    });
    expect(() => m07PoolConfig('controlled_fixture_only', 'dev', Buffer.from('untrusted'))).toThrow();
    expect(() => m07PoolConfig('postgresql://postgres@127.0.0.1:60322/postgres', 'local')).toThrow();
    expect(() => embeddingConfig({ ...environment(), EMR_M07_EMBED_MAX_INPUT_BYTES: '8193' })).toThrow();
  });
});
