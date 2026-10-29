// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { Client } from 'pg';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
vi.mock('server-only', () => ({}));
import { createEmbeddingHandler } from './m07-embeddings';
import { dispatchEmbeddingDatabase } from './m07-embeddings-database';
import type { M07EmbeddingDispatch } from '@emr/shared';
import type { WorkerClient, WorkerPool } from './n8n-worker/database';
const native = createRequire(import.meta.url)('../../../n8n/ai/build-native-embeddings.mjs');

// Actual local PostgreSQL and generated Code nodes, with only the external
// provider HTTP response controlled. This never authenticates to a provider.
describe.skipIf(process.env.EMR_M07_EMBEDDINGS_LOCAL_SQL_TEST !== 'true')(
  'M07 native embeddings / SQL',
  () => {
    it('maps a batch by index, freezes requests, settles once, skips unchanged and reconciles stale/unknown results', async () => {
      const c = new Client({
        host: '127.0.0.1',
        port: 60322,
        user: 'supabase_admin',
        password: 'postgres',
        database: 'postgres',
        ssl: false,
      });
      await c.connect();
      const baselineSql = `select (select count(*) from app.items) items,(select count(*) from app.embeddings) embeddings,
      (select count(*) from ops.cost_ledger) costs,
      (select md5(coalesce(jsonb_agg(to_jsonb(q) order by msg_id),'[]'::jsonb)::text) from pgmq.q_embed q) embed,
      (select md5(coalesce(jsonb_agg(to_jsonb(q) order by msg_id),'[]'::jsonb)::text) from pgmq.q_media q) media,
      (select md5(coalesce(jsonb_agg(to_jsonb(q) order by msg_id),'[]'::jsonb)::text) from pgmq.q_ai_extract q) ai,
      (select md5(string_agg(version,',' order by version)) from supabase_migrations.schema_migrations) history,
      to_regclass('ops.m07_embed_batches')::text batches`;
      const baseline = (await c.query(baselineSql)).rows[0];
      let lastSqlError: unknown;
      let savepoint: string | undefined,
        sequence = 0;
      try {
        await c.query('begin');
        await c.query(
          "set local statement_timeout='15s';set local lock_timeout='2s';set local role postgres",
        );
        const applied = new Set(
          (await c.query('select version from supabase_migrations.schema_migrations')).rows.map(
            (r) => r.version,
          ),
        );
        const dir = new URL('../../../supabase/migrations/', import.meta.url);
        for (const f of readdirSync(dir)
          .filter((f) => /^\d{14}_.+\.sql$/.test(f))
          .sort())
          if (!applied.has(f.slice(0, 14))) await c.query(readFileSync(new URL(f, dir), 'utf8'));
        await c.query('reset role');
        await c.query("update pgmq.q_embed set vt=clock_timestamp()+interval '1 day'");
        const company = randomUUID(),
          account = randomUUID(),
          org = randomUUID(),
          first = randomUUID(),
          second = randomUUID();
        await c.query(
          "insert into app.competitors(id,company_code,slug,name,priority_tier,status,categories) values($1,'M07EMBEDLOCAL','m07-embed-local','Controlled Embedding Films','pilot','active',array['production'])",
          [company],
        );
        await c.query(
          "insert into app.competitor_accounts(id,competitor_id,platform,handle,url,status) values($1,$2,'vimeo','controlledembed','https://vimeo.com/controlledembed','active')",
          [account, company],
        );
        await c.query(
          "insert into app.organizations(id,kind,name,slug,industry,status) values($1,'brand','Controlled Embedding Brand','controlled-embedding-brand','telecom','confirmed')",
          [org],
        );
        await c.query(
          "insert into app.org_aliases(org_id,alias,alias_normalized,source) values($1,'Controlled Alias','controlledalias','human')",
          [org],
        );
        for (const id of [first, second])
          await c.query(
            "insert into app.items(id,competitor_id,account_id,platform,item_type,external_id,url,status,ai_status,title,summary_en,caption_original,published_at,brand_id) values($1::uuid,$2,$3,'vimeo','video',$1::text,'https://vimeo.com/123','active','published','Controlled title',$4,'Controlled public caption',clock_timestamp(),$5)",
            [id, company, account, 'Controlled summary '.repeat(40), org],
          );
        await c.query(
          "insert into ops.price_book(provider,sku,unit,usd_per_unit) values('openai','controlled-embedding-alternate','1M tokens',0.03)",
        );
        const pool: WorkerPool = {
          connect: async () =>
            ({
              query: async (sql: string, values?: unknown[]) => {
                if (sql === 'begin') {
                  if (savepoint) throw Error('overlapping local embedding RPC');
                  savepoint = 'embed_rpc_' + ++sequence;
                  return c.query('savepoint ' + savepoint);
                }
                if (sql === 'commit') {
                  const s = savepoint;
                  savepoint = undefined;
                  if (!s) throw Error('missing savepoint');
                  return c.query('release savepoint ' + s);
                }
                if (sql === 'rollback') {
                  const s = savepoint;
                  savepoint = undefined;
                  if (!s) throw Error('missing savepoint');
                  await c.query('rollback to savepoint ' + s);
                  return c.query('release savepoint ' + s);
                }
                try {
                  return await c.query(sql, values);
                } catch (error) {
                  const e = error as { code?: string; message?: string };
                  lastSqlError = { code: e.code, message: e.message };
                  throw error;
                }
              },
              release: () => {},
              end: async () => {},
              on: () => {},
              off: () => {},
            }) as WorkerClient,
        };
        const inspect = async (sql: string, values?: unknown[]) => {
          await c.query('reset session authorization');
          try {
            return await c.query(sql, values);
          } finally {
            await c.query('set session authorization n8n_writer');
          }
        };
        let loseSettlement = false;
        const dispatch: M07EmbeddingDispatch = async (op, args, signal) => {
          const value = await dispatchEmbeddingDatabase(pool, op, args, signal);
          if (op === 'settle' && loseSettlement) {
            loseSettlement = false;
            throw Error('controlled lost committed settlement response');
          }
          return value;
        };
        const token = 'controlled-local-embedding-token-00000000',
          origin = 'http://127.0.0.1:3037';
        let configuredModel = 'text-embedding-3-small',
          maxInput = '4096',
          maxTotal = '16384';
        const handler = createEmbeddingHandler({
          environment: () => ({
            NODE_ENV: 'test',
            EMR_M07_LOCAL_ENABLED: 'true',
            EMR_M07_LOCAL_AUDIENCE: origin,
            EMR_M07_LOCAL_TOKEN_SHA256: createHash('sha256').update(token).digest('hex'),
            EMR_M07_LOCAL_DATABASE_URL: 'postgresql://n8n_writer@127.0.0.1:60322/postgres',
            OPENAI_MODEL_EMBED: configuredModel,
            EMR_M07_EMBED_BATCH_SIZE: '8',
            EMR_M07_EMBED_MAX_INPUT_BYTES: maxInput,
            EMR_M07_EMBED_MAX_TOTAL_BYTES: maxTotal,
          }),
          database: () => dispatch,
        });
        const invoke = async (body: unknown) => {
          const r = await handler(
            new Request(origin + '/api/internal/m07/embed', {
              method: 'POST',
              headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
              body: JSON.stringify(body),
            }),
          );
          return { statusCode: r.status, body: await r.json() };
        };
        const bindings = JSON.parse(
          readFileSync(new URL('../../../n8n/foundation/bindings.dev.json', import.meta.url), 'utf8'),
        );
        const graph = native.buildNativeEmbeddings(bindings, {
          audience: origin,
          credential: { id: 'SyntheticLocalOnly', name: 'Controlled local gateway', type: 'httpCustomAuth' },
        });
        let execution = 75000,
          providerCalls = 0;
        const code = (name: string, input: unknown, prepared?: unknown) => {
          const source = graph.workflow.nodes.find((n: { name: string }) => n.name === name)?.parameters
            .jsCode;
          if (!source) throw Error('missing generated WF-33 Code');
          return JSON.parse(
            JSON.stringify(
              runInNewContext(
                '(function(){' + source + '\n})()',
                {
                  $input: { all: () => [{ json: structuredClone(input) }] },
                  $execution: { id: String(execution) },
                  $: () => ({ item: { json: structuredClone(prepared) } }),
                  structuredClone,
                },
                { timeout: 1000 },
              ),
            ),
          )[0].json;
        };
        const enqueue = async (type: string, id: string) =>
          inspect(
            "select pgmq.send('embed',jsonb_build_object('entity_type',$1::text,'entity_id',$2::text))",
            [type, id],
          );
        const request = (s: Record<string, unknown>, operation: string) => ({
          version: 1,
          requestId: randomUUID(),
          operation,
          args: { batch_id: s.batch_id, owner_id: s.owner_id },
        });
        type State = Record<string, unknown> & {
          action: string;
          batch_id: string;
          owner_id: string;
          request_hash: string;
          reconciled: boolean;
          result: { status: string };
          provider_request: { model: string; input: string[]; dimensions: number };
        };
        const vector = (index: number) => Array.from({ length: 1536 }, (_, i) => (i === index ? 1 : 0.01));
        const response = (s: State) => ({
          object: 'list',
          model: s.provider_request.model,
          data: s.provider_request.input
            .map((_: string, index: number) => ({ object: 'embedding', index, embedding: vector(index) }))
            .reverse(),
          usage: { prompt_tokens: 1000, total_tokens: 1000 },
        });
        const advance = async (s: State) => code('Advance embedding receipt', await invoke(s.request), s);
        const admit = async () => {
          execution++;
          let s = code('Initialize embeddings', { env: 'dev' });
          for (let n = 0; n < 10 && s.action === 'gateway'; n++) s = await advance(s);
          return s;
        };
        const complete = async (s: State, body: unknown, drop = false) => {
          if (s.action === 'provider') {
            providerCalls++;
            if (drop) loseSettlement = true;
            s = code(
              'Advance embedding model receipt',
              body === null ? { statusCode: 503, body: {} } : { statusCode: 200, body },
              s,
            );
          }
          for (let n = 0; n < 10 && s.action === 'gateway'; n++) s = await advance(s);
          expect(s.action).toBe('done');
          return s;
        };
        const countCost = async (batch: string) =>
          (
            await inspect(
              "select count(*)::int n,coalesce(sum(cost_usd),0)::float8 usd,coalesce(sum(quantity),0)::float8 tokens from ops.cost_ledger where meta->>'embed_batch_id'=$1",
              [batch],
            )
          ).rows[0];
        await c.query('set session authorization n8n_writer');
        await enqueue('item', first);
        await enqueue('item', second);
        await enqueue('item', first);
        await enqueue('competitor', company);
        await enqueue('organization', org);
        const admitted = await admit();
        expect(admitted.action, JSON.stringify({ admitted, lastSqlError })).toBe('provider');
        expect(admitted.provider_request.input).toHaveLength(4);
        expect(admitted.provider_request.dimensions).toBe(1536);
        const frozenPrepare = await invoke(request(admitted, 'prepare'));
        expect(frozenPrepare.statusCode, JSON.stringify(frozenPrepare.body)).toBe(200);
        expect(frozenPrepare.body.result.request_hash).toBe(admitted.request_hash);
        const frozenRequest = structuredClone(admitted.provider_request);
        configuredModel = 'controlled-embedding-alternate';
        maxInput = '128';
        maxTotal = '1024';
        const driftedPrepare = await invoke(request(admitted, 'prepare'));
        expect(driftedPrepare.statusCode, JSON.stringify(driftedPrepare.body)).toBe(200);
        expect(driftedPrepare.body.result.request_hash).toBe(admitted.request_hash);
        // Dispatched requests are deliberately not returned for a second call;
        // the frozen snapshot itself remains identical and settles by old model.
        const status = await invoke(request(admitted, 'status'));
        expect(status.body.result.snapshot.provider_request).toEqual(frozenRequest);
        const body = response(admitted);
        const completed = await complete(admitted, body, true);
        expect(completed.result.status, JSON.stringify(completed)).toBe('completed');
        expect(completed.reconciled).toBe(true);
        const stored = (
          await inspect(
            'select entity_type,entity_id,model,embedding::text,content_hash,input_contract_version from app.embeddings where entity_id=any($1::uuid[])',
            [[first, second, company, org]],
          )
        ).rows;
        expect(stored).toHaveLength(4);
        expect(stored.every((r) => r.model === 'text-embedding-3-small')).toBe(true);
        const snapshot = status.body.result.snapshot;
        for (const row of stored) {
          const m = snapshot.mapping.find(
            (v: { entity_id: string; index: number }) => v.entity_id === row.entity_id,
          );
          expect(row.content_hash).toBe(
            createHash('sha256').update(frozenRequest.input[m.index]!).digest('hex'),
          );
          expect(JSON.parse(row.embedding)[m.index]).toBe(1);
        }
        const charge = await countCost(admitted.batch_id);
        expect(charge).toEqual({ n: 1, usd: 0.00002, tokens: 1000 });
        const replay = await invoke({
          ...request(admitted, 'settle'),
          args: { batch_id: admitted.batch_id, owner_id: admitted.owner_id, provider_response: body },
        });
        expect(replay.statusCode, JSON.stringify(replay.body)).toBe(200);
        expect(await countCost(admitted.batch_id)).toEqual(charge);
        expect((await invoke(request(admitted, 'dispatch'))).body.result.admitted).toBe(false);
        configuredModel = 'text-embedding-3-small';
        maxInput = '4096';
        maxTotal = '16384';
        const beforeSkip = providerCalls;
        for (const [type, id] of [
          ['item', first],
          ['item', second],
          ['competitor', company],
          ['organization', org],
        ] as const)
          await enqueue(type, id);
        const skipped = await admit();
        expect(skipped.action).toBe('done');
        expect(skipped.result.status).toBe('completed');
        expect(providerCalls).toBe(beforeSkip);
        // Same text with a different model is a new attributable request, not an
        // unchanged skip. Provider usage is still one aggregate row per request.
        configuredModel = 'controlled-embedding-alternate';
        await enqueue('item', first);
        const changedModel = await admit();
        expect(changedModel.action).toBe('provider');
        expect((await complete(changedModel, response(changedModel))).result.status).toBe('completed');
        expect(await countCost(changedModel.batch_id)).toEqual({ n: 1, usd: 0.00003, tokens: 1000 });
        // A delayed result must not overwrite vectors once the current source
        // text has advanced. The known original provider usage is still settled.
        await inspect('update app.items set summary_en=$2 where id=$1', [
          second,
          'A changed current summary',
        ]);
        await enqueue('item', second);
        const stale = await admit();
        expect(stale.action).toBe('provider');
        const oldVector = (
          await inspect('select embedding::text,content_hash from app.embeddings where entity_id=$1', [
            second,
          ])
        ).rows[0];
        await inspect('update app.items set summary_en=$2 where id=$1', [
          second,
          'An even newer current summary',
        ]);
        const staleDone = await complete(stale, response(stale));
        expect(staleDone.result.status).toBe('completed');
        expect(
          (
            await inspect('select embedding::text,content_hash from app.embeddings where entity_id=$1', [
              second,
            ])
          ).rows[0],
        ).toEqual(oldVector);
        expect((await countCost(stale.batch_id)).n).toBe(1);
        // Missing one vector with known usage is not a partial successful batch.
        await inspect('update app.organizations set name=$2 where id=$1', [org, 'Changed controlled brand']);
        await enqueue('organization', org);
        const malformed = await admit();
        expect(malformed.action).toBe('provider');
        const missing = response(malformed);
        missing.data = [];
        const rejected = await complete(malformed, missing);
        expect(rejected.result.status).toBe('failed');
        expect((await countCost(malformed.batch_id)).n).toBe(1);
        await inspect(
          "update pgmq.q_embed set vt=clock_timestamp()+interval '1 day' where message->>'entity_id'=$1",
          [org],
        );
        // An uncertain response keeps the original batch held and unacknowledged;
        // a later original response can reconcile it, without another dispatch.
        await inspect('update app.items set summary_en=$2 where id=$1', [first, 'Unknown fixture update']);
        await enqueue('item', first);
        const uncertain = await admit();
        expect(uncertain.action).toBe('provider');
        expect((await complete(uncertain, null)).result.status).toBe('held');
        expect((await countCost(uncertain.batch_id)).n).toBe(0);
        expect((await invoke(request(uncertain, 'dispatch'))).body.result.admitted).toBe(false);
        const recovered = await invoke({
          ...request(uncertain, 'settle'),
          args: {
            batch_id: uncertain.batch_id,
            owner_id: uncertain.owner_id,
            provider_response: response(uncertain),
          },
        });
        expect(recovered.statusCode, JSON.stringify(recovered.body)).toBe(200);
        expect(recovered.body.result.state).toBe('completed');
        expect((await countCost(uncertain.batch_id)).n).toBe(1);
        expect((await invoke(request(uncertain, 'ack'))).body.result.acked).toBe(true);
        expect(savepoint).toBeUndefined();
        expect(providerCalls).toBe(5);
      } finally {
        await c.query('reset session authorization').catch(() => {});
        await c.query('rollback');
        expect((await c.query(baselineSql)).rows[0]).toEqual(baseline);
        await c.end();
      }
    }, 60000);
  },
);
