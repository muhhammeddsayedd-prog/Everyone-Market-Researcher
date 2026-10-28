// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { Client } from 'pg';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
vi.mock('server-only', () => ({}));
import { createCollectorHandler, type CollectorConfig } from './collectors';
import { dispatchCollectorDatabase } from './collector-database';
import { createCollectorCallback } from './collector-callback';
import {
  buildNativeCollector,
  buildNativeCallback,
} from '../../../../n8n/collectors/build-native-collectors.mjs';
import type { NativeCollectorState as CollectorState } from '../../../../n8n/collectors/native-runtime.mjs';

const { prepareInstagramResults } = createRequire(import.meta.url)(
  '../../../../n8n/normalizers/instagramScraper.js',
) as {
  prepareInstagramResults: (
    rows: Record<string, unknown>[],
    context: Record<string, unknown>,
  ) => { groups: { status: string; items: Record<string, unknown>[] }[]; errors: unknown[] };
};

// Existing local PostgreSQL only. Public fixture password, session-authorization
// simulation and savepoints are NOT hosted restricted-login, TLS or Cloud proof.
describe.skipIf(process.env.EMR_M04_LOCAL_SQL_TEST !== 'true')(
  'M04 generated native code → HTTP gateway → actual local SQL',
  () => {
    it('connects Vimeo and both Instagram passes, registration barrier, replay and unknown callback', async () => {
      const c = new Client({
        host: '127.0.0.1',
        port: 60322,
        user: 'supabase_admin',
        password: 'postgres',
        database: 'postgres',
        ssl: false,
        connectionTimeoutMillis: 3000,
        application_name: 'emr-m04-local-contracts',
      });
      c.on('error', () => {});
      await c.connect();
      const localSnapshot = async () =>
        (
          await c.query(`select
            (select array_agg(version order by version) from supabase_migrations.schema_migrations) versions,
            (select count(*)::int from app.competitors) competitors,
            (select count(*)::int from app.competitor_accounts) accounts,
            (select count(*)::int from app.items) items,
            (select count(*)::int from ingest.raw_items) raw_items,
            (select count(*)::int from ops.scrape_runs) runs,
            (select count(*)::int from ops.cost_ledger) costs,
            (select queue_length::text from pgmq.metrics('ai_extract')) ai_queue,
            (select queue_length::text from pgmq.metrics('media')) media_queue,
            case when to_regprocedure('ops.collector_execute(uuid,text,jsonb)') is not null
              then md5(pg_get_functiondef(to_regprocedure('ops.collector_execute(uuid,text,jsonb)')))
              else null end collector_definition`)
        ).rows[0];
      const localBefore = await localSnapshot();
      try {
        await c.query('begin');
        await c.query("set local statement_timeout='10s';set local lock_timeout='3s'");
        if (
          !(await c.query("select to_regprocedure('ops.set_account_external_id(uuid,text,text)') as f"))
            .rows[0].f
        )
          await c.query(
            readFileSync(
              new URL(
                '../../../../supabase/migrations/20261026013910_m04_vimeo_account_resolution.sql',
                import.meta.url,
              ),
              'utf8',
            ),
          );
        if (
          !(await c.query("select to_regprocedure('ops.collector_execute(uuid,text,jsonb)') as f")).rows[0].f
        ) {
          await c.query(
            readFileSync(
              new URL(
                '../../../../supabase/migrations/20261027092832_m04_collector_product_contracts.sql',
                import.meta.url,
              ),
              'utf8',
            ),
          );
        }
        // Install the reviewed function inside this rollback transaction even
        // when a reused local stack has the older M04 product objects.
        await c.query(
          readFileSync(
            new URL(
              '../../../../supabase/migrations/20261027192743_m04_recent_instagram_dev_eligibility.sql',
              import.meta.url,
            ),
            'utf8',
          ),
        );
        const company = '27000000-0000-4000-8000-000000000010',
          vimeo = '27000000-0000-4000-8000-000000000011',
          ig = '27000000-0000-4000-8000-000000000012',
          approval = randomUUID();
        await c.query(
          "insert into app.competitors(id,company_code,slug,name,priority_tier,status)values($1,'TEST17M04','m04-local-connected','M04 local synthetic','pilot','active')",
          [company],
        );
        await c.query(
          "insert into app.competitor_accounts(id,competitor_id,platform,handle,url,external_id,status,backfill_status,next_due_at)values($1,$3,'vimeo','m04synthetic','https://vimeo.com/m04synthetic','123','active','pending','2000-01-01'),($2,$3,'instagram','m04_synthetic','https://www.instagram.com/m04_synthetic/',null,'active','pending','2000-01-01')",
          [vimeo, ig, company],
        );
        const token = 'synthetic-local-collector-machine-token',
          origin = 'https://everyone-market-researcher-synthetic.vercel.app';
        const env = {
          VERCEL_ENV: 'preview',
          VERCEL_GIT_COMMIT_REF: 'm04-collectors-vimeo-instagram',
          VERCEL_PROJECT_ID: 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
          VERCEL_URL: new URL(origin).host,
          VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40),
          VERCEL_DEPLOYMENT_ID: 'dpl_synthetic',
          EMR_COLLECTORS_ENABLED: 'true',
          EMR_COLLECTORS_COMMIT_SHA: 'a'.repeat(40),
          EMR_COLLECTORS_WRITER_PASSWORD: 'unused-local-fixture',
          EMR_COLLECTORS_TOKEN_SHA256: createHash('sha256').update(token).digest('hex'),
          EMR_COLLECTORS_APIFY_READ_TOKEN: 'unused-mock-provider',
          EMR_COLLECTORS_ACCOUNT_IDS: JSON.stringify([vimeo, ig]),
          EMR_COLLECTORS_LIVE_POLICY: JSON.stringify({
            approval_id: approval,
            max_actor_starts: 4,
            max_actor_usd: 1,
            max_total_usd: 4,
            max_results_per_profile: 5,
            actors: {
              'apify/instagram-scraper': {
                owner_id: 'syntheticOwner',
                actorId: 'syntheticActor',
                build: '1.2.3',
                buildId: 'syntheticBuild',
              },
            },
          }),
        };
        const dispatch = async (
          requestId: string,
          operation: string,
          args: Record<string, unknown>,
          config: CollectorConfig,
          signal: AbortSignal,
        ) => {
          await c.query('set local session authorization n8n_writer');
          const client = {
            query: async (sql: string, values?: unknown[]) => {
              if (sql === 'begin') return c.query('savepoint m04_http_request');
              if (sql === 'commit') {
                await c.query('release savepoint m04_http_request');
                return c.query('reset session authorization');
              }
              if (sql === 'rollback') {
                await c.query('rollback to savepoint m04_http_request');
                await c.query('release savepoint m04_http_request');
                return c.query('reset session authorization');
              }
              return c.query(sql, values);
            },
            release: () => {},
            end: async () => {},
            on: () => {},
            off: () => {},
          };
          return dispatchCollectorDatabase(
            { connect: async () => client },
            requestId,
            operation,
            args,
            config,
            signal,
          );
        };
        let clock = 0,
          providerReads = 0;
        const callback = createCollectorCallback({
          dispatch,
          now: () => clock,
          wait: async (ms) => {
            clock += ms;
          },
          get: async (path) => {
            providerReads++;
            const run = path.includes('/actor-runs/')
              ? path.split('/').pop()!
              : path.includes('records/INPUT')
                ? path.includes('reels')
                  ? 'actorreels'
                  : 'actorposts'
                : path.includes('reels')
                  ? 'actorreels'
                  : 'actorposts';
            const saved = (
              await c.query(
                'select l.*,a.context from ops.collector_launches l join ops.collector_accounts a on a.run_id=l.run_id where l.apify_run_id=$1',
                [run],
              )
            ).rows[0];
            if (!saved) throw Error('synthetic_provider_unknown');
            if (path.includes('/actor-runs/'))
              return {
                data: {
                  id: run,
                  actId: 'syntheticActor',
                  userId: 'syntheticOwner',
                  buildId: 'syntheticBuild',
                  buildNumber: '1.2.3',
                  status: 'SUCCEEDED',
                  defaultDatasetId: 'dataset' + saved.pass,
                  defaultKeyValueStoreId: 'input' + saved.pass,
                  usageTotalUsd: 0.0019,
                  startedAt: new Date(new Date(saved.created_at).getTime() + 1000).toISOString(),
                  finishedAt: new Date(new Date(saved.created_at).getTime() + 2000).toISOString(),
                  options: { memoryMbytes: 1024, timeoutSecs: 600, maxTotalChargeUsd: 1, maxItems: 5 },
                },
              };
            if (path.includes('records/INPUT'))
              return {
                directUrls: ['https://www.instagram.com/m04_synthetic/'],
                resultsType: saved.pass,
                resultsLimit: 5,
                onlyPostsNewerThan: '2024-01-01',
                ...(saved.pass === 'posts' ? { skipPinnedPosts: true } : {}),
                addParentData: false,
              };
            return [
              {
                shortCode: 'M04LocalSharedPost',
                type: saved.pass === 'reels' ? 'Video' : 'Image',
                ...(saved.pass === 'reels' ? { productType: 'clips' } : {}),
                ownerUsername: 'm04_synthetic',
                timestamp: '2026-10-25T00:00:00Z',
                caption: 'Synthetic connected local provider response',
              },
            ];
          },
        });
        const handler = createCollectorHandler({
          environment: () => env,
          dispatch,
          processCallback: callback,
        });
        async function http(body: unknown) {
          const response = await handler(
            new Request(origin + '/api/internal/n8n/collectors', {
              method: 'POST',
              headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
              body: JSON.stringify(body),
            }),
          );
          return { statusCode: response.status, body: await response.json() };
        }
        const bindings = JSON.parse(
          readFileSync(new URL('../../../../n8n/foundation/bindings.dev.json', import.meta.url), 'utf8'),
        );
        async function workflow(kind: 'vimeo' | 'instagram', accountId: string, executionId: string) {
          const graph = buildNativeCollector(
            bindings,
            {
              audience: origin,
              credential: {
                id: 'EmrM03Machine19',
                name: 'M03 foundation machine [dev]',
                type: 'httpCustomAuth',
              },
            },
            kind,
          );
          const code = (name: string) =>
            String(graph.workflow.nodes.find((n) => n.name === name)!.parameters.jsCode);
          const vm = (name: string, json: unknown, state?: CollectorState) =>
            runInNewContext('(function(){' + code(name) + '})()', {
              URL: undefined,
              require: undefined,
              $input: { all: () => [{ json }] },
              $execution: { id: executionId },
              $: (selector: string) => {
                if (selector !== 'Prepare collector action') throw Error('selector');
                return { item: { json: state } };
              },
              Date,
              Buffer,
            })[0].json as CollectorState;
          let state = vm('Initialize collector', {
            env: 'dev',
            mode: 'backfill',
            limit: 1,
            account_ids: [accountId],
            max_pages: 1,
            page_size: 5,
            results_limit: 5,
            max_actor_starts: 2,
          });
          for (let steps = 0; state.action !== 'done' && steps < 60; steps++) {
            if (state.action === 'gateway') {
              const response = await http(state.request);
              expect(response.statusCode).toBe(200);
              state = vm('Advance gateway receipt', response, state);
            } else if (state.action === 'vimeo')
              state = vm(
                'Advance provider result',
                {
                  statusCode: 200,
                  headers: {},
                  body: {
                    data: [
                      {
                        uri: '/videos/27001',
                        link: 'https://vimeo.com/27001',
                        privacy: { view: 'anybody' },
                        release_time: '2026-10-25T00:00:00Z',
                        name: 'Synthetic local video',
                      },
                    ],
                    paging: { next: null },
                  },
                },
                state,
              );
            else if (state.action === 'apify') {
              const batch = state.batches?.[state.batchIndex ?? -1];
              if (!batch) throw Error('local_actor_batch_missing');
              state = vm(
                'Advance provider result',
                {
                  statusCode: 201,
                  body: { data: { id: 'actor' + String(batch.result_type) } },
                },
                state,
              );
            } else throw Error('unexpected local workflow action ' + state.action);
          }
          expect(state.action).toBe('done');
          return state;
        }
        const v = await workflow('vimeo', vimeo, '99123');
        expect(
          (await c.query('select status,items_new from ops.scrape_runs where id=$1', [v.runId])).rows[0],
        ).toMatchObject({ status: 'success', items_new: 1 });
        const watermarkBeforeReplay = (
          await c.query(
            'select last_external_id,last_item_published_at from app.competitor_accounts where id=$1',
            [vimeo],
          )
        ).rows[0];
        // Representative replay deliberately rewinds only this terminal,
        // unlocked owned account's operational selection, never its content or
        // watermark. A normal backfill continuation would select the next page.
        expect(
          (
            await c.query(
              "update app.competitor_accounts set backfill_status='pending',backfill_cursor=null,next_due_at='2000-01-01' where id=$1 and last_run_id=$2 and locked_until is null",
              [vimeo, v.runId],
            )
          ).rowCount,
        ).toBe(1);
        const vReplay = await workflow('vimeo', vimeo, '99125');
        expect(
          (await c.query('select status,items_new from ops.scrape_runs where id=$1', [vReplay.runId]))
            .rows[0],
        ).toMatchObject({ status: 'success', items_new: 0 });
        expect(
          (await c.query('select last_external_id from app.competitor_accounts where id=$1', [vimeo])).rows[0]
            .last_external_id,
        ).toBe('27001');
        expect(
          (
            await c.query(
              'select last_external_id,last_item_published_at from app.competitor_accounts where id=$1',
              [vimeo],
            )
          ).rows[0],
        ).toEqual(watermarkBeforeReplay);
        const i = await workflow('instagram', ig, '99124');
        expect(
          (await c.query('select status from ops.scrape_runs where id=$1', [i.runId])).rows[0].status,
        ).toBe('running');
        const errorEvent = {
          version: 1,
          operation: 'execution.error',
          args: {
            workflow_id: 'TsqSMa5MlO3QBLkt',
            execution_id: '99201',
            error_code: 'callback_retryable',
          },
        };
        // The real private RPC under local role simulation. New request IDs
        // cannot duplicate an execution's audit or release its live claim.
        for (let attempt = 0; attempt < 2; attempt++)
          expect((await http({ ...errorEvent, requestId: randomUUID() })).body.result).toEqual({
            logged: true,
            reconciliation_required: true,
          });
        expect(
          (
            await c.query(
              "select count(*)::int n from ops.audit_log where entity_id='WF-19' and action='workflow_error' and after->>'execution_id'='99201'",
            )
          ).rows[0].n,
        ).toBe(1);
        expect(
          (
            await c.query(
              'select r.status,a.locked_until>now() held from ops.scrape_runs r join app.competitor_accounts a on a.last_run_id=r.id where r.id=$1 and a.id=$2',
              [i.runId, ig],
            )
          ).rows[0],
        ).toMatchObject({ status: 'running', held: true });
        const callbackGraph = buildNativeCallback(bindings, {
          audience: origin,
          credential: {
            id: 'EmrM03Machine19',
            name: 'M03 foundation machine [dev]',
            type: 'httpCustomAuth',
          },
        });
        let callbackExecution = 99200;
        const callbackCode = (
          name: string,
          input: unknown,
          selectors: Record<string, unknown>,
          execution: string,
        ) =>
          runInNewContext(
            '(function(){' +
              String(callbackGraph.workflow.nodes.find((n) => n.name === name)!.parameters.jsCode) +
              '})()',
            {
              URL: undefined,
              require: undefined,
              $input: { all: () => [{ json: input }] },
              $execution: { id: execution },
              $: (name: string) => ({ item: { json: selectors[name] } }),
            },
          )[0].json;
        const process = async (run: string) => {
          const execution = String(++callbackExecution);
          const classified = callbackCode(
            'Prepare callback classification',
            { transport: 'webhook', apify_run_id: run },
            {},
            execution,
          );
          const routed = callbackCode(
            'Check callback classification',
            await http(classified.request),
            { 'Prepare callback classification': classified },
            execution,
          );
          expect(routed.scope).toBe('m04');
          for (let pages = 0; pages < 61; pages++) {
            const pending = callbackCode('Prepare M04 callback processing', routed, {}, execution);
            const response = await http(pending.request);
            const verified = callbackCode(
              'Verify M04 callback receipt',
              response,
              { 'Prepare M04 callback processing': pending },
              execution,
            );
            if (!verified.pending) return response;
            Object.assign(routed, verified);
          }
          throw Error('local_callback_page_bound');
        };
        const firstCallback = await process('actorposts');
        expect({ providerReads, ...firstCallback }).toMatchObject({
          providerReads: 4,
          statusCode: 200,
          body: { result: { state: 'completed', finished_now: false, items_new: 1 } },
        });
        expect(
          (await c.query('select locked_until>now() held from app.competitor_accounts where id=$1', [ig]))
            .rows[0].held,
        ).toBe(true);
        const beforeReplay = providerReads;
        expect((await process('actorposts')).body.result).toMatchObject({
          state: 'completed',
          updated: false,
        });
        expect(providerReads).toBe(beforeReplay);
        expect((await process('actorreels')).body.result).toMatchObject({
          state: 'completed',
          finished_now: true,
          items_new: 0,
        });
        expect(
          (await c.query('select status,items_new from ops.scrape_runs where id=$1', [i.runId])).rows[0],
        ).toMatchObject({ status: 'success', items_new: 1 });
        const cost = (
          await c.query(
            'select sum(cost_usd)::text cost,count(*)::int rows from ops.cost_ledger where run_id=$1',
            [i.runId],
          )
        ).rows[0];
        expect(Number(cost.cost)).toBe(0.0038);
        expect(cost.rows).toBe(2);
        const beforeUnknown = providerReads;
        const unknown = {
          version: 1,
          requestId: randomUUID(),
          operation: 'callback.classify',
          args: { apify_run_id: 'unknownActor' },
        };
        expect((await http(unknown)).body.result).toEqual({ scope: 'unknown' });
        expect(
          (await http({ ...unknown, requestId: randomUUID(), operation: 'callback.process' })).statusCode,
        ).toBe(403);
        expect(providerReads).toBe(beforeUnknown);
        expect(
          (await c.query('select count(*)::int n from app.items where competitor_id=$1', [company])).rows[0]
            .n,
        ).toBe(2);

        // Retained public metadata exercises the real normalizer and ingestion
        // RPC. Publication time is a labelled local clock fixture so this test
        // does not expire; the metric delta is synthetic, not provider evidence.
        // now() is transaction-stable: establish a historical snapshot baseline
        // before the repeat, then require the RPC itself to update its timestamp.
        const retained = JSON.parse(
          readFileSync(
            new URL(
              '../../../../n8n/normalizers/fixtures/instagram-scraper/actual-dev-public-projection-20261027.json',
              import.meta.url,
            ),
            'utf8',
          ),
        ) as { provenance: { observed_at: string }; samples: { raw_metadata: Record<string, unknown> }[] };
        const sample = retained.samples[0]?.raw_metadata;
        if (!sample || typeof sample.ownerUsername !== 'string' || typeof sample.likesCount !== 'number')
          throw Error('retained_metrics_sample_missing');
        const metricsAccount = randomUUID();
        const metricsRun = (
          await c.query(
            "select ops.start_run('M04-local-metrics','instagram','daily','dev','metrics-fixture') id",
          )
        ).rows[0].id;
        const fixtureTime = (await c.query("select now() n,now()-interval '1 day' publication")).rows[0];
        const publication = new Date(fixtureTime.publication).toISOString();
        await c.query(
          `insert into app.competitor_accounts
            (id,competitor_id,platform,handle,url,status,backfill_status,last_run_id,locked_until,last_item_published_at,last_external_id)
           values($1,$2,'instagram',$3,$4,'active','pending',$5,now()+interval '1 hour',$6,$7)`,
          [
            metricsAccount,
            company,
            sample.ownerUsername,
            `https://www.instagram.com/${sample.ownerUsername}/`,
            metricsRun,
            publication,
            sample.shortCode,
          ],
        );
        const normalizeMetrics = (likesCount: number) => {
          const result = prepareInstagramResults([{ ...sample, timestamp: publication, likesCount }], {
            accounts: [
              { id: metricsAccount, handle: sample.ownerUsername, last_item_published_at: publication },
            ],
            mode: 'daily',
            result_type: 'reels',
            resultsLimit: 30,
            now: new Date(fixtureTime.n).toISOString(),
          });
          expect(result.errors).toEqual([]);
          expect(result.groups).toHaveLength(1);
          expect(result.groups[0]?.status).toBe('success');
          expect(result.groups[0]?.items).toHaveLength(1);
          return result.groups[0]!.items;
        };
        const ingestMetrics = async (items: Record<string, unknown>[]) => {
          await c.query('set local session authorization n8n_writer');
          try {
            return (
              await c.query('select ingest.upsert_raw_items($1,$2,$3::jsonb) result', [
                metricsRun,
                metricsAccount,
                JSON.stringify(items),
              ])
            ).rows[0].result;
          } finally {
            await c.query('reset session authorization');
          }
        };
        expect(await ingestMetrics(normalizeMetrics(sample.likesCount))).toMatchObject({ inserted: 1 });
        await c.query('update app.items set metrics_updated_at=$1 where account_id=$2', [
          retained.provenance.observed_at,
          metricsAccount,
        ]);
        const metricsSnapshot = async () =>
          (
            await c.query(
              `select
              (select to_jsonb(i)-'metrics'-'metrics_updated_at'-'updated_at' from app.items i where account_id=$1) immutable_item,
              (select metrics from app.items where account_id=$1) metrics,
              (select metrics_updated_at from app.items where account_id=$1) metrics_updated_at,
              (select md5(to_jsonb(r)::text) from ingest.raw_items r where account_id=$1) immutable_raw,
              (select count(*)::int from app.items where account_id=$1) items,
              (select count(*)::int from ingest.raw_items where account_id=$1) raw_items,
              (select queue_length::text from pgmq.metrics('ai_extract')) ai_queue,
              (select queue_length::text from pgmq.metrics('media')) media_queue`,
              [metricsAccount],
            )
          ).rows[0];
        const beforeMetrics = await metricsSnapshot();
        expect(await ingestMetrics(normalizeMetrics(sample.likesCount + 1))).toMatchObject({
          inserted: 0,
          duplicates: 0,
          metrics_updated: 1,
          new_item_ids: [],
        });
        const afterMetrics = await metricsSnapshot();
        expect(new Date(afterMetrics.metrics_updated_at).getTime()).toBeGreaterThan(
          new Date(beforeMetrics.metrics_updated_at).getTime(),
        );
        expect(afterMetrics.metrics.likes).toBe(sample.likesCount + 1);
        expect({ ...afterMetrics, metrics: null, metrics_updated_at: null }).toEqual({
          ...beforeMetrics,
          metrics: null,
          metrics_updated_at: null,
        });
        expect(await ingestMetrics(normalizeMetrics(sample.likesCount + 1))).toMatchObject({
          inserted: 0,
          metrics_updated: 0,
          new_item_ids: [],
        });
        expect(await metricsSnapshot()).toEqual(afterMetrics);
      } finally {
        try {
          await c.query('reset session authorization');
          await c.query('rollback');
          expect(await localSnapshot()).toEqual(localBefore);
        } finally {
          await c.end();
        }
      }
    }, 30000);
  },
);
