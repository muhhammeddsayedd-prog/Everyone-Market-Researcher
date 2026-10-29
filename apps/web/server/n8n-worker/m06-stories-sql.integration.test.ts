// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { Client } from 'pg';
import { readFileSync, readdirSync } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { createRequire } from 'node:module';
vi.mock('server-only', () => ({}));
import { createCollectorHandler, type CollectorDispatch } from './collectors';
import { dispatchCollectorDatabase } from './collector-database';
import { createM06StoriesCallback, createM06StoriesAdmission } from './m06-stories-callback';
import type { WorkerClient, WorkerPool } from './database';
import type { CollectorRequest } from '@emr/shared';
// Load the actual Node generator without Vite rewriting imported function
// identifiers inside Function#toString before serialized-code verification.
const { m06StoriesCloudSource } = createRequire(import.meta.url)(
  '../../../../n8n/collectors/build-native-m06-stories.mjs',
);
const { buildM06StoryMediaHandoff } = createRequire(import.meta.url)(
  '../../../../n8n/collectors/m06-story-media-handoff.mjs',
);

type Row = Record<string, unknown>;
type State = {
  action: string;
  runId: string;
  startedActorId: string;
  request: CollectorRequest;
  launchDescriptor: Row;
  result: Row;
};
type Runtime = {
  initializeM06Stories: (input: unknown, execution: string, now: string) => State;
  advanceM06StoryGateway: (state: State, response: unknown) => State;
  advanceM06StoryActor: (state: State, response: unknown) => State;
};

// External provider reads retain the captured REAL public source shapes and
// identities. For this SQL composition test ONLY, story publication/expiry
// timestamps are shifted together relative to the local launch clock so database
// freshness guards remain meaningful on future CI dates. The checked-in real
// fixture/provenance is never modified; fixed-time source tests qualify it as
// captured. Run IDs, credentials, envelopes and SQL identities are synthetic.
// Every database/queue effect and definition rolls back.
describe.skipIf(process.env.EMR_M06_STORIES_LOCAL_SQL_TEST !== 'true')(
  'M06 connected story contracts',
  () => {
    it('connects generated WF-12 to restricted SQL, real-source normalization, registration barriers, comparison and replay', async () => {
      const c = new Client({
        host: '127.0.0.1',
        port: 60322,
        user: 'supabase_admin',
        password: 'postgres',
        database: 'postgres',
        ssl: false,
        connectionTimeoutMillis: 3000,
      });
      await c.connect();
      const baselineSql = `select (select count(*) from app.items) items,(select count(*) from ingest.raw_items) raw,
    (select count(*) from app.competitors) companies,(select count(*) from ops.scrape_runs) runs,(select count(*) from ops.cost_ledger) costs,
    (select md5(string_agg(version::text,',' order by version)) from supabase_migrations.schema_migrations) history,
    to_regprocedure('ops.m06_execute(uuid,text,jsonb)')::text m06,
    (select md5(string_agg(msg_id::text||':'||message::text||':'||vt::text,',' order by msg_id)) from pgmq.q_media) media`;
      const before = (await c.query(baselineSql)).rows[0];
      let localSqlError: string | null = null;
      let savepoint: string | undefined,
        sequence = 0,
        releases = 0;
      try {
        await c.query('begin');
        await c.query("set local statement_timeout='15s';set local lock_timeout='3s'");
        const applied = new Set(
          (await c.query('select version from supabase_migrations.schema_migrations')).rows.map(
            (r) => r.version,
          ),
        );
        const directory = new URL('../../../../supabase/migrations/', import.meta.url);
        // Production/dev migrations run as postgres. Preserve that owner for
        // extension-created queue tables and the existing enqueue definer.
        await c.query('set local role postgres');
        for (const file of readdirSync(directory)
          .filter((f) => /^\d{14}_.+\.sql$/.test(f))
          .sort())
          if (!applied.has(file.slice(0, 14))) await c.query(readFileSync(new URL(file, directory), 'utf8'));
        await c.query('reset role');
        const accountIds = [randomUUID(), randomUUID(), randomUUID()],
          handles = ['everyone.film', 'goodpeoplefilms', 'bigfootfilms'];
        for (let i = 0; i < 3; i++) {
          const competitor = randomUUID();
          await c.query(
            "insert into app.competitors(id,company_code,slug,name,priority_tier,status) values($1,$2,$3,'Local M06 story fixture','pilot','active')",
            [competitor, 'M06STORY' + i, 'm06-story-fixture-' + i],
          );
          await c.query(
            "insert into app.competitor_accounts(id,competitor_id,platform,handle,url,status,backfill_status,next_due_at) values($1,$2,'instagram_stories',$3,$4,'active','not_applicable','2000-01-01')",
            [accountIds[i], competitor, handles[i], 'https://www.instagram.com/' + handles[i] + '/'],
          );
        }
        const inspect = async (sql: string, args: unknown[] = []) => {
          await c.query('reset session authorization');
          try {
            return await c.query(sql, args);
          } finally {
            await c.query('set session authorization n8n_writer');
          }
        };
        const mediaBefore = (
          await c.query(
            "select count(*)::int n,md5(coalesce(string_agg(msg_id::text||':'||message::text||':'||vt::text,',' order by msg_id),'')) digest from pgmq.q_media",
          )
        ).rows[0];
        await c.query('set session authorization n8n_writer');
        const pool: WorkerPool = {
          connect: async () =>
            ({
              query: async (sql: string, values?: unknown[]) => {
                if (sql === 'begin') {
                  if (savepoint) throw Error('overlapping local story RPC');
                  savepoint = 'm06_story_rpc_' + ++sequence;
                  return c.query('savepoint ' + savepoint);
                }
                if (sql === 'commit') {
                  if (!savepoint) throw Error('missing local story transaction');
                  const s = savepoint;
                  savepoint = undefined;
                  return c.query('release savepoint ' + s);
                }
                if (sql === 'rollback') {
                  if (!savepoint) throw Error('missing local story rollback');
                  const s = savepoint;
                  savepoint = undefined;
                  await c.query('rollback to savepoint ' + s);
                  return c.query('release savepoint ' + s);
                }
                try {
                  return await c.query(sql, values);
                } catch (error) {
                  const message = (error as Error).message;
                  localSqlError = /^[a-zA-Z0-9 _-]{1,160}$/.test(message)
                    ? message
                    : 'controlled local SQL error';
                  throw error;
                }
              },
              release: () => {
                releases++;
              },
              end: async () => {
                throw Error('unexpected physical end of local story fixture');
              },
              on: (event: 'error', fn: (e: unknown) => void) => c.on(event, fn),
              off: (event: 'error', fn: (e: unknown) => void) => c.off(event, fn),
            }) as WorkerClient,
        };
        const token = 'local-m06-synthetic-machine-token-12345',
          origin = 'https://everyone-market-researcher-m06-local.vercel.app',
          approval = randomUUID();
        const actor = 'data-slayer/instagram-stories-scraper';
        const environment = {
          VERCEL_ENV: 'preview',
          VERCEL_GIT_COMMIT_REF: 'm06-collectors-stories-upkeep',
          VERCEL_PROJECT_ID: 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
          VERCEL_URL: new URL(origin).host,
          VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40),
          EMR_COLLECTORS_COMMIT_SHA: 'a'.repeat(40),
          VERCEL_DEPLOYMENT_ID: 'dpl_LocalM06Story',
          EMR_COLLECTORS_ENABLED: 'true',
          EMR_COLLECTORS_WRITER_PASSWORD: 'synthetic-local',
          EMR_COLLECTORS_APIFY_READ_TOKEN: 'synthetic-local',
          EMR_COLLECTORS_TOKEN_SHA256: createHash('sha256').update(token).digest('hex'),
          EMR_COLLECTORS_ACCOUNT_IDS: JSON.stringify(accountIds),
          EMR_COLLECTORS_LIVE_POLICY: JSON.stringify({
            approval_id: approval,
            max_actor_starts: 4,
            max_actor_usd: 1,
            max_total_usd: 4,
            max_results_per_profile: 50,
            actors: {
              [actor]: {
                billingModel: 'PPE',
                actorId: 'LocalStoryActor',
                owner_id: 'LocalStoryOwner',
                build: '1.0.32',
                buildId: 'LocalStoryBuild',
                memoryMbytes: 1024,
                timeoutSecs: 600,
              },
            },
          }),
        };
        const operations: string[] = [];
        const dispatch: CollectorDispatch = (id, op, args, cfg, signal) => {
          operations.push(op);
          return dispatchCollectorDatabase(pool, id, op, args, cfg, signal);
        };
        const capture = JSON.parse(
          readFileSync(
            new URL(
              '../../../../n8n/normalizers/fixtures/instagram-stories-data-slayer/real-capture-20261029.json',
              import.meta.url,
            ),
            'utf8',
          ),
        );
        expect(capture.provenance.kind).toBe('sanitized_real_actor_capture');
        expect(Array.isArray(capture.rows)).toBe(true);
        const relativeSeconds =
          Math.floor(Date.now() / 1000) - Math.floor(Date.parse(capture.provenance.finishedAt) / 1000);
        const rows = (structuredClone(capture.rows) as Row[]).map((row) => {
          for (const key of ['taken_at_date', 'expires_at_date'])
            if (typeof row[key] === 'string')
              row[key] = new Date(Date.parse(row[key]) + relativeSeconds * 1000).toISOString();
          if (typeof row.taken_at_ts === 'number') row.taken_at_ts += relativeSeconds;
          return row;
        });
        expect(capture.rows[1].taken_at_date).toBe('2026-10-28T09:41:47+00:00');
        let providerReads = 0,
          clock = 0,
          providerId = 'M06LocalStoryRun1',
          launchAt = new Date().toISOString();
        const callback = createM06StoriesCallback({
          dispatch,
          get: async (path) => {
            providerReads++;
            if (path.startsWith('/v2/actor-runs/'))
              return {
                data: {
                  id: providerId,
                  actId: 'LocalStoryActor',
                  userId: 'LocalStoryOwner',
                  buildId: 'LocalStoryBuild',
                  buildNumber: '1.0.32',
                  status: 'SUCCEEDED',
                  usageTotalUsd: 0.03088,
                  defaultDatasetId: 'LocalStoryDataset',
                  defaultKeyValueStoreId: 'LocalStoryInput',
                  startedAt: launchAt,
                  finishedAt: new Date(Date.parse(launchAt) + 1000).toISOString(),
                  options: { memoryMbytes: 1024, timeoutSecs: 600, maxTotalChargeUsd: 1, maxItems: 150 },
                },
              };
            if (path.includes('/records/INPUT')) return { usernames: [...handles].sort() };
            return rows;
          },
          wait: async (ms) => {
            clock += ms;
          },
          now: () => clock,
        });
        const handler = createCollectorHandler({
          environment: () => environment,
          dispatch,
          processCallback: callback,
          admitCallback: createM06StoriesAdmission({ dispatch }),
        });
        const send = async (request: CollectorRequest) => {
          const response = await handler(
            new Request(origin + '/api/internal/n8n/collectors', {
              method: 'POST',
              headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
              body: JSON.stringify(request),
            }),
          );
          const body = await response.json();
          expect(response.status, JSON.stringify({ body, operations, localSqlError })).toBe(200);
          return { statusCode: response.status, body };
        };
        const runtime = runInNewContext(
          m06StoriesCloudSource + '\n({initializeM06Stories,advanceM06StoryGateway,advanceM06StoryActor})',
          {},
          { timeout: 1000 },
        ) as Runtime;
        const selection = (mode: 'ingest' | 'bakeoff') => ({
          env: 'dev',
          mode: 'daily',
          actor_id: actor,
          collection_mode: mode,
          account_ids: accountIds,
          results_limit: 50,
          max_actor_starts: 2,
        });
        async function admitted(mode: 'ingest' | 'bakeoff', execution: string) {
          let state = runtime.initializeM06Stories(selection(mode), execution, new Date().toISOString());
          let loops = 0;
          while (!(state.action === 'gateway' && state.request.operation === 'm06.close_registration')) {
            if (++loops > 20) throw Error('local story transition did not settle');
            if (state.action === 'gateway') {
              if (state.request.operation === 'm06.launch') launchAt = new Date().toISOString();
              state = runtime.advanceM06StoryGateway(state, await send(state.request));
            } else {
              const d = state.launchDescriptor;
              state = runtime.advanceM06StoryActor(state, {
                statusCode: 201,
                body: {
                  data: {
                    id: providerId,
                    actId: d.actorId,
                    userId: d.ownerId,
                    buildId: d.buildId,
                    buildNumber: d.build,
                    options: {
                      maxTotalChargeUsd: d.maxTotalChargeUsd,
                      maxItems: null,
                      memoryMbytes: d.memory,
                      timeoutSecs: d.timeout,
                    },
                  },
                },
              });
            }
          }
          return state;
        }
        let state = await admitted('ingest', '60101');
        const admissionInput = {
          version: 1 as const,
          requestId: randomUUID(),
          operation: 'callback.admit' as const,
          args: { apify_run_id: providerId },
        };
        const beforeAdmissionReads = providerReads;
        const accepted = await send(admissionInput),
          duplicateAdmission = await send({ ...admissionInput, requestId: randomUUID() });
        expect(accepted.body.result).toMatchObject({
          accepted: true,
          durable: true,
          state: 'pending',
          replayed: false,
          run_id: state.runId,
          apify_run_id: providerId,
        });
        expect(duplicateAdmission.body.result).toMatchObject({
          accepted: true,
          durable: true,
          state: 'pending',
          replayed: true,
        });
        expect(providerReads).toBe(beforeAdmissionReads);
        // WF-12's original registration plus one stable callback admission;
        // a duplicate webhook delivery creates no additional register row.
        expect(
          (
            await inspect(
              "select count(*)::int n from ops.collector_requests where operation='m06.register' and result->>'apify_run_id'=$1",
              [providerId],
            )
          ).rows[0].n,
        ).toBe(2);
        const callbackInput = {
          version: 1 as const,
          requestId: randomUUID(),
          operation: 'callback.process' as const,
          args: { apify_run_id: providerId },
        };
        const completed = await send(callbackInput);
        expect(completed.body.result.updated).toBe(true);
        expect(completed.body.result.media_dispatch).toEqual({ queue: 'stories', items_new: 12 });
        // The actual committed SQL receipt now feeds generated native Code and
        // Execute Workflow1.4 contracts. Child HTTP/Storage work is mocked here;
        // the separate media SQL suite composes its real codec/worker with SQL.
        const fragment = buildM06StoryMediaHandoff(
          JSON.parse(
            readFileSync(new URL('../../../../n8n/foundation/bindings.dev.json', import.meta.url), 'utf8'),
          ),
          {
            environment: 'dev',
            queue: 'stories',
            workflowId: 'LocalStoryLane31',
            audience: 'https://everyone-market-researcher-local-stories.vercel.app',
            batchSize: 5,
          },
        );
        const wakeCalls: string[] = [];
        const deliverMedia = (result: Row) => {
          const prepare = fragment.nodes.find((n: Row) => n.name === fragment.entry);
          const advance = fragment.nodes.find((n: Row) => n.name === 'Advance story media delivery');
          const child = fragment.nodes.find((n: Row) => n.name === 'Process new story media');
          let next = runInNewContext('(function(){' + prepare.parameters.jsCode + '})()', {
            $input: { all: () => [{ json: result }] },
          })[0].json;
          const receipts = [5, 5, 2];
          while (next.action === 'execute') {
            const claimed = receipts[wakeCalls.length];
            expect(claimed).toBeDefined();
            expect(child.parameters.options.waitForSubWorkflow).toBe(true);
            expect(child.parameters.workflowInputs).toBeUndefined();
            const empty = fragment.nodes.find((n: Row) => n.name === 'Prepare empty story media input');
            expect(
              runInNewContext('(function(){' + empty.parameters.jsCode + '})()', {
                $input: { all: () => [{ json: next }] },
              })[0].json,
            ).toEqual({});
            wakeCalls.push(child.parameters.workflowId.value);
            const prior = next;
            next = runInNewContext('(function(){' + advance.parameters.jsCode + '})()', {
              $: () => ({ item: { json: prior } }),
              $input: {
                all: () => [
                  {
                    json: {
                      version: 1,
                      execution_id: String(68000 + wakeCalls.length),
                      state: 'completed',
                      claimed,
                      processed: claimed,
                      stored: claimed,
                      skipped: 0,
                      expired: 0,
                      held: 0,
                      retryable: 0,
                      reconciliation_required: 0,
                      infrastructure_cost_usd: null,
                    },
                  },
                ],
              },
            })[0].json;
          }
          expect(next.action).toBe('done');
        };
        deliverMedia(completed.body.result);
        expect(wakeCalls).toEqual(['LocalStoryLane31', 'LocalStoryLane31', 'LocalStoryLane31']);
        expect(
          (await inspect('select status from ops.scrape_runs where id=$1', [state.runId])).rows[0].status,
        ).toBe('running');
        expect(
          (
            await inspect(
              'select count(*)::int n from app.competitor_accounts where id=any($1) and last_run_id=$2 and locked_until>now()',
              [accountIds, state.runId],
            )
          ).rows[0].n,
        ).toBe(3);
        state = runtime.advanceM06StoryGateway(state, await send(state.request));
        expect(state.action).toBe('done');
        expect(state.result.state).toBe('completed');
        expect(state.result.status).toBe('success');
        const countsSql = `select (select count(*)::int from app.items where account_id=any($1)) items,
     (select count(*)::int from ops.bakeoff_results where account_id=any($1)) comparison_rows,
     (select count(*)::int from ops.bakeoff_observations where account_id=any($1)) observations,
     (select count(*)::int from ops.cost_ledger where meta->>'apify_run_id'=$2) costs,
     (select sum(cost_usd)::float8 from ops.cost_ledger where meta->>'apify_run_id'=$2) usd,
     (select count(*)::int from pgmq.q_media_stories q join app.items i on i.id=(q.message->>'item_id')::uuid where i.account_id=any($1)) story_media`;
        const delivered = (await inspect(countsSql, [accountIds, providerId])).rows[0];
        expect(delivered).toEqual({
          items: 12,
          comparison_rows: 12,
          observations: 3,
          costs: 3,
          usd: 0.03088,
          story_media: 12,
        });
        expect(
          (
            await inspect(
              'select status,count(*)::int n from ops.bakeoff_observations where account_id=any($1) group by status order by status',
              [accountIds],
            )
          ).rows,
        ).toEqual([
          { status: 'no_stories', n: 2 },
          { status: 'success', n: 1 },
        ]);
        expect(
          (
            await inspect(
              "select count(*)::int n,md5(coalesce(string_agg(msg_id::text||':'||message::text||':'||vt::text,',' order by msg_id),'')) digest from pgmq.q_media",
            )
          ).rows[0],
        ).toEqual(mediaBefore);
        const readsBeforeReplay = providerReads;
        const replay = await send({ ...callbackInput, requestId: randomUUID() });
        expect(replay.body.result.updated).toBe(false);
        expect(replay.body.result.media_dispatch).toBeNull();
        deliverMedia(replay.body.result);
        expect(wakeCalls).toHaveLength(3);
        expect(providerReads).toBe(readsBeforeReplay);
        const completedAdmission = await send({ ...admissionInput, requestId: randomUUID() });
        expect(completedAdmission.body.result).toMatchObject({
          state: 'completed',
          replayed: true,
          durable: true,
        });
        expect(providerReads).toBe(readsBeforeReplay);
        expect(
          (
            await inspect(
              "select count(*)::int n from ops.collector_requests where operation='m06.register' and result->>'apify_run_id'=$1",
              [providerId],
            )
          ).rows[0].n,
        ).toBe(2);
        expect((await inspect(countsSql, [accountIds, providerId])).rows[0]).toEqual(delivered);
        const healthSql = `select id,last_run_id,last_success_at,last_error_at,next_due_at,consecutive_failures,last_item_published_at,last_external_id,items_count,cadence::text from app.competitor_accounts where id=any($1) order by id`;
        const health = (await inspect(healthSql, [accountIds])).rows;
        providerId = 'M06LocalStoryRun2';
        state = await admitted('bakeoff', '60102');
        state = runtime.advanceM06StoryGateway(state, await send(state.request));
        expect(state.result.state).toBe('awaiting_callbacks');
        const comparison = await send({
          ...callbackInput,
          requestId: randomUUID(),
          args: { apify_run_id: providerId },
        });
        expect(comparison.body.result.media_dispatch).toBeNull();
        deliverMedia(comparison.body.result);
        expect(wakeCalls).toHaveLength(3);
        expect((await inspect(healthSql, [accountIds])).rows).toEqual(health);
        expect(
          (await inspect('select count(*)::int n from app.items where account_id=any($1)', [accountIds]))
            .rows[0].n,
        ).toBe(12);
        expect(
          (
            await inspect('select count(*)::int n from ops.bakeoff_observations where account_id=any($1)', [
              accountIds,
            ])
          ).rows[0].n,
        ).toBe(6);
        expect(
          (
            await inspect(
              'select count(*)::int n from app.competitor_accounts where id=any($1) and locked_until>now()',
              [accountIds],
            )
          ).rows[0].n,
        ).toBe(0);
        expect(releases).toBeGreaterThan(5);
        expect(savepoint).toBeUndefined();
      } finally {
        await c.query('rollback');
        await c.query('reset session authorization');
        expect((await c.query(baselineSql)).rows[0]).toEqual(before);
        await c.end();
      }
    }, 30000);
  },
);
