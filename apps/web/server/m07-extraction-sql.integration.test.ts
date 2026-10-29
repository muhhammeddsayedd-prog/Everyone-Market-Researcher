// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { Client } from 'pg';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
vi.mock('server-only', () => ({}));
import { createExtractionHandler } from './m07-extraction';
import { dispatchExtractionDatabase } from './m07-extraction-database';
import type { M07Dispatch } from '@emr/shared';
import type { WorkerClient, WorkerPool } from './n8n-worker/database';
const native = createRequire(import.meta.url)('../../../n8n/ai/build-native-extractor.mjs');

// Only loopback PostgreSQL is used. The real SQL/route and serialized native
// Code run together. Responses are controlled examples, not provider evidence.
describe.skipIf(process.env.EMR_M07_LOCAL_SQL_TEST !== 'true')('M07 generated extraction / SQL path', () => {
  it('settles text, review, skip, locks, replay and uncertain responses without duplicate effects', async () => {
    const c = new Client({
      host: '127.0.0.1',
      port: 60322,
      user: 'supabase_admin',
      password: 'postgres',
      database: 'postgres',
      ssl: false,
    });
    await c.connect();
    const baselineSql = `select (select count(*) from app.items) items,(select count(*) from ops.cost_ledger) costs,
      (select count(*) from ops.ai_extractions) extractions,
      (select md5(coalesce(jsonb_agg(to_jsonb(q) order by msg_id),'[]'::jsonb)::text) from pgmq.q_ai_extract q) ai,
      (select md5(coalesce(jsonb_agg(to_jsonb(q) order by msg_id),'[]'::jsonb)::text) from pgmq.q_media q) media,
      (select md5(string_agg(version,',' order by version)) from supabase_migrations.schema_migrations) history,
      to_regclass('ops.m07_ai_attempts')::text attempts`;
    const baseline = (await c.query(baselineSql)).rows[0];
    let savepoint: string | undefined,
      sequence = 0;
    try {
      await c.query('begin');
      await c.query("set local statement_timeout='15s';set local lock_timeout='2s';set local role postgres");
      const applied = new Set(
        (await c.query('select version from supabase_migrations.schema_migrations')).rows.map(
          (r) => r.version,
        ),
      );
      const dir = new URL('../../../supabase/migrations/', import.meta.url);
      for (const file of readdirSync(dir)
        .filter((f) => /^\d{14}_.+\.sql$/.test(f))
        .sort())
        if (!applied.has(file.slice(0, 14))) await c.query(readFileSync(new URL(file, dir), 'utf8'));
      await c.query('reset role');
      // Hide the pre-existing local synthetic deliveries only in this rollback
      // transaction; the final baseline equality proves their preservation.
      await c.query("update pgmq.q_ai_extract set vt=clock_timestamp()+interval '1 day'");
      const company = randomUUID(),
        account = randomUUID();
      await c.query(
        "insert into app.competitors(id,company_code,slug,name,priority_tier,status) values($1,'M07LOCAL','m07-local','Controlled Films','pilot','active')",
        [company],
      );
      await c.query(
        "insert into app.competitor_accounts(id,competitor_id,platform,handle,url,status) values($1,$2,'vimeo','controlledfilms','https://vimeo.com/controlledfilms','active')",
        [account, company],
      );
      for (const [kind, usd] of [
        ['input', 2],
        ['cached_input', 0.5],
        ['output', 8],
      ] as const)
        await c.query(
          "insert into ops.price_book(provider,sku,unit,usd_per_unit) values('openai',$1,'1M tokens',$2)",
          ['controlled-model:' + kind, usd],
        );
      const pool: WorkerPool = {
        connect: async () =>
          ({
            query: async (sql: string, values?: unknown[]) => {
              if (sql === 'begin') {
                if (savepoint) throw Error('overlapping local RPC');
                savepoint = 'm07_rpc_' + ++sequence;
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
              return c.query(sql, values);
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
      let loseApply = false;
      const dispatch: M07Dispatch = async (op, args, signal) => {
        const receipt = await dispatchExtractionDatabase(pool, op, args, signal);
        if (op === 'apply' && loseApply) {
          loseApply = false;
          throw Error('controlled lost post-commit receipt');
        }
        return receipt;
      };
      const token = 'controlled-local-extraction-token-00000000',
        origin = 'http://127.0.0.1:3037';
      const handler = createExtractionHandler({
        environment: () => ({
          NODE_ENV: 'test',
          EMR_M07_LOCAL_ENABLED: 'true',
          EMR_M07_LOCAL_AUDIENCE: origin,
          EMR_M07_LOCAL_TOKEN_SHA256: createHash('sha256').update(token).digest('hex'),
          EMR_M07_LOCAL_DATABASE_URL: 'postgresql://n8n_writer@127.0.0.1:60322/postgres',
          OPENAI_MODEL_EXTRACT: 'controlled-model',
        }),
        database: () => dispatch,
      });
      const invoke = async (body: unknown) => {
        const response = await handler(
          new Request(origin + '/api/internal/m07/extract', {
            method: 'POST',
            headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
            body: JSON.stringify(body),
          }),
        );
        return { statusCode: response.status, body: await response.json() };
      };
      const bindings = JSON.parse(
        readFileSync(new URL('../../../n8n/foundation/bindings.dev.json', import.meta.url), 'utf8'),
      );
      const graph = native.buildNativeExtractor(bindings, {
        audience: origin,
        credential: { id: 'SyntheticLocalOnly', name: 'Controlled local token', type: 'httpCustomAuth' },
      });
      let execution = 73000;
      const code = (name: string, input: unknown, prepared?: unknown) => {
        const source = graph.workflow.nodes.find((n: { name: string }) => n.name === name)?.parameters.jsCode;
        if (!source) throw Error('missing generated Code node');
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
      const example = () =>
        JSON.parse(
          readFileSync(
            new URL('../../../n8n/normalizers/fixtures/ai/controlled-extraction.v1.json', import.meta.url),
            'utf8',
          ),
        );
      const response = (result: unknown, id = randomUUID()) => ({
        id: 'resp_' + id.replaceAll('-', ''),
        object: 'response',
        model: 'controlled-model',
        status: 'completed',
        output: [
          {
            type: 'message',
            role: 'assistant',
            status: 'completed',
            content: [{ type: 'output_text', text: JSON.stringify(result) }],
          },
        ],
        usage: {
          input_tokens: 1000,
          output_tokens: 200,
          total_tokens: 1200,
          input_tokens_details: { cached_tokens: 400 },
        },
      });
      const enqueue = async (locks: string[] = []) => {
        const id = randomUUID();
        await inspect(
          "insert into app.items(id,competitor_id,account_id,platform,item_type,external_id,url,status,ai_status,locked_fields,campaign_title) values($1,$2,$3,'vimeo','video',$4,'https://vimeo.com/123','active','pending',$5,'Human title')",
          [id, company, account, id, locks],
        );
        await inspect("select pgmq.send('ai_extract',jsonb_build_object('item_id',$1::text))", [id]);
        return id;
      };
      let providerCalls = 0;
      const execute = async (provider: unknown, drop = false) => {
        execution++;
        let s = code('Initialize local extraction', { env: 'dev' });
        let settled: Record<string, unknown> | undefined;
        for (let i = 0; i < 16 && s.action !== 'done'; i++) {
          if (s.action === 'gateway') {
            if (s.request.operation === 'settle') settled = structuredClone(s.request);
            s = code('Advance extraction receipt', await invoke(s.request), s);
          } else {
            providerCalls++;
            expect(s.provider_request.text.format.strict).toBe(true);
            expect(s.provider_request.model).toBe('controlled-model');
            if (drop) loseApply = true;
            s = code(
              'Advance model receipt',
              provider === null ? { statusCode: 503, body: {} } : { statusCode: 200, body: provider },
              s,
            );
          }
        }
        expect(s.action).toBe('done');
        return { state: s, settled };
      };
      const effects = async (item: string) =>
        (
          await inspect(
            `select (select count(*) from ops.ai_extractions where item_id=$1) extractions,
        (select count(*) from ops.cost_ledger where item_id=$1) costs,(select count(*) from app.item_credits where item_id=$1) credits,
        (select count(*) from ops.m07_entity_sightings where item_id=$1) sightings,
        (select count(*) from pgmq.q_embed where message->>'entity_id'=$1::text) embeds,
        (select count(*) from app.review_tasks where entity_id=$1::text) reviews`,
            [item],
          )
        ).rows[0];
      await c.query('set session authorization n8n_writer');
      const item = await enqueue(['campaign_title']);
      const wire = response(example());
      const completed = await execute(wire, true);
      expect(completed.state.result.status, JSON.stringify(completed.state.result)).toBe('completed');
      expect(completed.state.reconciled).toBe(true);
      const row = (await inspect('select * from app.items where id=$1', [item])).rows[0];
      expect(row.ai_status).toBe('published');
      expect(row.campaign_title).toBe('Human title');
      expect(row.summary_en).toBe('A controlled fixture campaign.');
      const before = await effects(item);
      expect(before.extractions).toBe('1');
      expect(before.costs).toBe('1');
      expect(before.embeds).toBe('1');
      expect(
        Number(
          (await inspect('select cost_usd from ops.cost_ledger where item_id=$1', [item])).rows[0].cost_usd,
        ),
      ).toBe(0.003);
      expect((await invoke(completed.settled)).statusCode).toBe(200);
      expect(await effects(item)).toEqual(before);
      const original = completed.state;
      const replay = await invoke({
        version: 1,
        requestId: randomUUID(),
        operation: 'dispatch',
        args: { attempt_id: original.attempt_id, owner_id: original.owner_id },
      });
      expect(replay.body.result.admitted).toBe(false);
      expect(await effects(item)).toEqual(before);
      const wrong = await invoke({
        version: 1,
        requestId: randomUUID(),
        operation: 'status',
        args: { attempt_id: original.attempt_id, owner_id: randomUUID() },
      });
      expect(wrong.statusCode).toBe(403);
      // Explicit new queue delivery/owner means a separately attributable new
      // attempt. It does not inflate the same item's entity sightings/credits.
      await inspect("select pgmq.send('ai_extract',jsonb_build_object('item_id',$1::text))", [item]);
      const callsBeforeDuplicate = providerCalls;
      expect((await execute(wire)).state.result.status).toBe('completed');
      expect(providerCalls).toBe(callsBeforeDuplicate);
      expect(await effects(item)).toEqual(before);
      const nonce = randomUUID();
      await inspect(
        "select pgmq.send('ai_extract',jsonb_build_object('item_id',$1::text,'reextract',true,'reextract_nonce',$2::text))",
        [item, nonce],
      );
      const next = await execute(response(example()));
      expect(next.state.attempt_id).not.toBe(original.attempt_id);
      expect(next.state.result.status).toBe('completed');
      const after = await effects(item);
      expect(after.extractions).toBe('2');
      expect(after.costs).toBe('2');
      expect(after.embeds).toBe('2');
      expect(after.credits).toBe(before.credits);
      expect(after.sightings).toBe(before.sightings);
      await inspect(
        "select pgmq.send('ai_extract',jsonb_build_object('item_id',$1::text,'reextract',true,'reextract_nonce',$2::text))",
        [item, nonce],
      );
      expect((await execute(wire)).state.result.status).toBe('completed');
      expect(await effects(item)).toEqual(after);

      const reviewId = await enqueue();
      const review = example();
      review.confidence.overall = 0.4;
      expect((await execute(response(review))).state.result.status).toBe('completed');
      expect(
        (await inspect('select ai_status from app.items where id=$1', [reviewId])).rows[0].ai_status,
      ).toBe('review');
      const skipId = await enqueue();
      const skip = example();
      skip.is_commercial_work = false;
      expect((await execute(response(skip))).state.result.status).toBe('completed');
      expect((await inspect('select ai_status from app.items where id=$1', [skipId])).rows[0].ai_status).toBe(
        'skipped',
      );
      const badId = await enqueue();
      const malformed = response({ invalid: true });
      expect((await execute(malformed)).state.result.status).toBe('failed');
      expect((await effects(badId)).extractions).toBe('0');
      expect((await effects(badId)).costs).toBe('1');
      const callsBeforeFailedReplay = providerCalls;
      const failedEffects = await effects(badId);
      await inspect("update pgmq.q_ai_extract set vt=clock_timestamp() where message->>'item_id'=$1", [
        badId,
      ]);
      expect((await execute(malformed)).state.result.status).toBe('held');
      expect(providerCalls).toBe(callsBeforeFailedReplay);
      expect(await effects(badId)).toEqual(failedEffects);
      // Failed queue delivery is held for explicit retry policy, so make only
      // its local fixture invisible before testing the next controlled item.
      await inspect(
        "update pgmq.q_ai_extract set vt=clock_timestamp()+interval '1 day' where message->>'item_id'=$1",
        [badId],
      );
      const unknownId = await enqueue();
      const unknown = await execute(null);
      expect(unknown.state.result.status).toBe('held');
      expect((await effects(unknownId)).costs).toBe('0');
      const held = (
        await inspect('select * from ops.m07_ai_attempts where id=$1', [unknown.state.attempt_id])
      ).rows[0];
      expect(held.state).toBe('unknown');
      expect(held.usage_known).toBe(false);
      expect(held.acked_at).toBeNull();
      const recover = response(example());
      const reconciled = await invoke({
        version: 1,
        requestId: randomUUID(),
        operation: 'settle',
        args: {
          attempt_id: unknown.state.attempt_id,
          owner_id: unknown.state.owner_id,
          provider_response: recover,
        },
      });
      expect(reconciled.statusCode, JSON.stringify(reconciled.body)).toBe(200);
      expect(reconciled.body.result.state).toBe('completed');
      expect((await effects(unknownId)).costs).toBe('1');
      expect(providerCalls).toBe(6);
      expect(savepoint).toBeUndefined();
    } finally {
      await c.query('reset session authorization').catch(() => {});
      await c.query('rollback');
      expect((await c.query(baselineSql)).rows[0]).toEqual(baseline);
      await c.end();
    }
  }, 60000);
});
