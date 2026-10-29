// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { Client } from 'pg';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
vi.mock('server-only', () => ({}));
import { createUpkeepHandler } from './m06-upkeep';
import { dispatchUpkeepDatabase } from './m06-upkeep-database';
import type { WorkerPool, WorkerClient } from './n8n-worker/database';
import type { UpkeepDispatch } from './m06-upkeep-contracts';
import type { UpkeepSourcePorts } from '../../../n8n/collectors/upkeep-sources.mjs';
import { upkeepTargets } from '@emr/shared';
import { gatewayBusinessResult } from '../../../packages/shared/src/n8n-worker-contracts';
const native = createRequire(import.meta.url)('../../../n8n/collectors/build-native-m06-upkeep.mjs');

// Actual local PostgreSQL, full checked-in chain, session-principal simulation,
// actual serialized Code transitions and application route/RPC mappings.
// Only external official responses are controlled examples. No hosted access.
describe.skipIf(process.env.EMR_M06_UPKEEP_LOCAL_SQL_TEST !== 'true')('M06 native/source/SQL upkeep', () => {
  it('connects removal/restoration, metrics/locks/AI safety, replay, uncertain-commit recovery and health', async () => {
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
    const baselineSql =
      "select (select count(*) from app.items) items,(select count(*) from app.competitors) companies,(select count(*) from ingest.raw_items) raw,(select count(*) from ops.audit_log) audit,(select md5(coalesce(jsonb_agg(to_jsonb(a) order by id),'[]'::jsonb)::text) from app.competitor_accounts a) accounts,(select count(*) from pgmq.q_ai_extract) ai,(select md5(coalesce(string_agg(msg_id::text||message::text||vt::text,',' order by msg_id),'')) from pgmq.q_media) media,(select md5(string_agg(version::text,',' order by version)) from supabase_migrations.schema_migrations) history,to_regprocedure('ops.apply_upkeep_observation(uuid,uuid,date,date,jsonb,text[],text,timestamptz)')::text upkeep";
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
      for (const f of readdirSync(dir)
        .filter((f) => /^\d{14}_.+\.sql$/.test(f))
        .sort())
        if (!applied.has(f.slice(0, 14))) await c.query(readFileSync(new URL(f, dir), 'utf8'));
      await c.query('reset role');
      const account = randomUUID(),
        competitor = randomUUID(),
        instagram = randomUUID(),
        youtube = randomUUID(),
        paidParent = randomUUID();
      await c.query(
        "insert into app.competitors(id,company_code,slug,name,priority_tier,status) values($1,'M06UPKEEPLOCAL','m06-upkeep-local','Local controlled upkeep fixture','pilot','active')",
        [competitor],
      );
      await c.query(
        "insert into app.competitor_accounts(id,competitor_id,platform,handle,url,external_id,status,backfill_status) values($1,$2,'vimeo','fixturefilms','https://vimeo.com/fixturefilms','42','active','done')",
        [account, competitor],
      );
      const published = new Date(Date.now() - 2 * 86400000).toISOString();
      const channel = 'UC1234567890123456789012';
      await c.query(
        "insert into app.competitor_accounts(id,competitor_id,platform,handle,url,external_id,uploads_playlist_id,status,backfill_status) values($1,$2,'youtube','@fixture','https://www.youtube.com/@fixture',$3,'UU1234567890123456789012','active','done')",
        [youtube, competitor, channel],
      );
      await c.query(
        "insert into app.items(id,competitor_id,account_id,platform,item_type,external_id,url,published_at,status,ai_status,metrics) values($1,$2,$3,'youtube','video','fixture0001','https://www.youtube.com/watch?v=fixture0001',$4,'active','published','{}')",
        [randomUUID(), competitor, youtube, published],
      );
      for (const [external, status, locks] of [
        ['101', 'removed', []],
        ['102', 'active', []],
        ['103', 'active', ['status', 'metrics']],
      ] as const)
        await c.query(
          "insert into app.items(id,competitor_id,account_id,platform,item_type,external_id,url,published_at,status,ai_status,locked_fields,metrics) values($1,$2,$3,'vimeo','video',$4,$5,$6,$7,'published',$8,$9)",
          [
            randomUUID(),
            competitor,
            account,
            external,
            'https://vimeo.com/' + external,
            published,
            status,
            locks,
            { views: 1 },
          ],
        );
      await c.query(
        "insert into app.competitor_accounts(id,competitor_id,platform,handle,url,status,backfill_status) values($1,$2,'instagram','fixture.films','https://www.instagram.com/fixture.films/','active','done')",
        [instagram, competitor],
      );
      for (const code of ['IGPOST', 'IGREEL', 'IGMISSING'])
        await c.query(
          "insert into app.items(id,competitor_id,account_id,platform,item_type,external_id,url,published_at,status,ai_status,metrics) values($1,$2,$3,'instagram','video',$4,$5,$6,'active','published','{}')",
          [randomUUID(), competitor, instagram, code, 'https://www.instagram.com/p/' + code + '/', published],
        );
      await c.query(
        "insert into ops.scrape_runs(id,workflow,platform,mode,env,status) values($1,'WF-11','instagram','backfill','dev','success')",
        [paidParent],
      );
      await c.query('insert into ops.collector_runs(run_id,registration_closed) values($1,true)', [
        paidParent,
      ]);
      await c.query("insert into ops.collector_accounts(run_id,account_id,context) values($1,$2,'{}')", [
        paidParent,
        instagram,
      ]);
      for (const pass of ['posts', 'reels']) {
        await c.query(
          "insert into ops.apify_runs(apify_run_id,actor_id,run_id,account_ids,purpose,status,dataset_id,finished_at,processed_at) values($1,'apify/instagram-scraper',$2,$3,'backfill','SUCCEEDED',$4,clock_timestamp()-interval '1 minute',clock_timestamp())",
          ['ControlledUpkeep' + pass, paidParent, [instagram], 'ControlledDataset' + pass],
        );
        await c.query(
          "insert into ops.collector_launches(launch_id,run_id,actor_id,pass,account_ids,purpose,results_limit,approval_id,max_actor_starts,max_actor_usd,max_total_usd,apify_run_id,dataset_complete) values($1,$2,'apify/instagram-scraper',$3,$4,'backfill',30,$5,2,1,2,$6,true)",
          [randomUUID(), paidParent, pass, [instagram], randomUUID(), 'ControlledUpkeep' + pass],
        );
      }
      const inspect = async (sql: string, values?: unknown[]) => {
        await c.query('reset session authorization');
        try {
          return await c.query(sql, values);
        } finally {
          await c.query('set session authorization n8n_writer');
        }
      };
      const aiBefore = (await c.query('select count(*)::int n from pgmq.q_ai_extract')).rows[0].n;
      await c.query('set session authorization n8n_writer');
      const pool: WorkerPool = {
        connect: async () =>
          ({
            query: async (sql: string, values?: unknown[]) => {
              if (sql === 'begin') {
                if (savepoint) throw Error('overlapping upkeep transaction');
                savepoint = 'upkeep_rpc_' + ++sequence;
                return c.query('savepoint ' + savepoint);
              }
              if (sql === 'commit') {
                const s = savepoint;
                savepoint = undefined;
                if (!s) throw Error('missing upkeep savepoint');
                return c.query('release savepoint ' + s);
              }
              if (sql === 'rollback') {
                const s = savepoint;
                savepoint = undefined;
                if (!s) throw Error('missing upkeep savepoint');
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
      let loseReceipt = false;
      const dispatch: UpkeepDispatch = async (op, args, signal) => {
        const r = await dispatchUpkeepDatabase(pool, op, args, signal);
        if (op === 'apply' && loseReceipt) {
          loseReceipt = false;
          throw Error('controlled lost committed response');
        }
        return r;
      };
      const token = 'synthetic-local-upkeep-machine-token-0000000';
      const origin = 'https://everyone-market-researcher-synthetic.vercel.app';
      const environment = {
        VERCEL_ENV: 'preview',
        VERCEL_GIT_COMMIT_REF: 'm06-upkeep-local',
        VERCEL_PROJECT_ID: 'prj_O7bYgrXSpOxIysNJTpCunqA7D4Fu',
        VERCEL_URL: new URL(origin).host,
        VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40),
        VERCEL_DEPLOYMENT_ID: 'dpl_synthetic',
        EMR_UPKEEP_ENABLED: 'true',
        EMR_UPKEEP_COMMIT_SHA: 'a'.repeat(40),
        EMR_UPKEEP_TOKEN_SHA256: createHash('sha256').update(token).digest('hex'),
        EMR_UPKEEP_WRITER_PASSWORD: 'synthetic-not-network',
        EMR_UPKEEP_ACCOUNT_IDS: JSON.stringify([account, instagram, youtube]),
      };
      let sourceReads = 0,
        sourceMode: 'present' | 'empty' | 'partial' = 'present';
      const ports: UpkeepSourcePorts = {
        request: async (input) => {
          sourceReads++;
          if (input.source === 'youtube')
            return {
              status: 200,
              body: new URL(input.url).pathname.endsWith('/playlistItems')
                ? {
                    items: [
                      {
                        snippet: { videoOwnerChannelId: channel },
                        contentDetails: { videoId: 'fixture0001' },
                      },
                    ],
                  }
                : {
                    items: [
                      {
                        id: 'fixture0001',
                        snippet: {
                          channelId: channel,
                          publishedAt: published,
                          title: 'Controlled YouTube fixture',
                          description: '',
                        },
                        status: { privacyStatus: 'public' },
                        contentDetails: { duration: 'PT30S' },
                        statistics: { viewCount: '55', likeCount: '3' },
                      },
                    ],
                  },
            };
          return {
            status: 200,
            body: {
              page: 1,
              per_page: 100,
              paging: {
                next:
                  sourceMode === 'partial'
                    ? '/users/42/videos?page=2&per_page=100&sort=date&direction=desc'
                    : null,
              },
              data:
                sourceMode === 'empty'
                  ? []
                  : [
                      {
                        uri: '/videos/101',
                        link: 'https://vimeo.com/101',
                        name: 'Controlled source fixture',
                        release_time: published,
                        created_time: published,
                        duration: 30,
                        privacy: { view: 'anybody' },
                        user: { uri: '/users/42' },
                        stats: { plays: 77 },
                      },
                    ],
            },
          };
        },
      };
      let paidReads = 0;
      ports.actorSnapshot = async (input) => {
        paidReads++;
        return {
          run: {
            id: input.run_id,
            actId: 'ControlledActor',
            buildId: 'ControlledBuild',
            status: 'SUCCEEDED',
            defaultDatasetId: 'ControlledDataset' + input.pass,
            finishedAt: new Date(Date.now() - 60000).toISOString(),
          },
          verified_actor: { actor_id: 'ControlledActor', build_id: 'ControlledBuild' },
          input: {
            directUrls: ['https://www.instagram.com/fixture.films/'],
            resultsType: input.pass,
            resultsLimit: 30,
            onlyPostsNewerThan: input.since,
            addParentData: false,
            ...(input.pass === 'posts' ? { skipPinnedPosts: false } : {}),
          },
          dataset: {
            id: 'ControlledDataset' + input.pass,
            itemCount: 1,
            offset: 0,
            limit: 5000,
            items: [
              {
                type: input.pass === 'posts' ? 'Image' : 'Video',
                shortCode: input.pass === 'posts' ? 'IGPOST' : 'IGREEL',
                ownerUsername: 'fixture.films',
                timestamp: published,
                likesCount: 5,
                commentsCount: 2,
              },
            ],
          },
        };
      };
      const handler = createUpkeepHandler({
        environment: () => environment,
        database: () => dispatch,
        sources: () => ports,
      });
      const rawTargets = await dispatch(
        'targets',
        { platform: 'vimeo', window_days: 90 },
        new AbortController().signal,
      );
      const targetContract = upkeepTargets.safeParse(
        (rawTargets as Array<{ account_id: string }>).filter((t) => t.account_id === account),
      );
      expect(
        targetContract.success,
        targetContract.success
          ? ''
          : JSON.stringify(targetContract.error.issues.map((i) => ({ path: i.path, code: i.code }))),
      ).toBe(true);
      const invoke = async (body: unknown) => {
        const r = await handler(
          new Request(origin + '/api/internal/m06/upkeep', {
            method: 'POST',
            headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
            body: JSON.stringify(body),
          }),
        );
        return { statusCode: r.status, body: await r.json() };
      };
      const runtime = runInNewContext(
        native.m06UpkeepCloudSource +
          '\n;({initializeM06Upkeep,advanceM06Upkeep,initializeM06UpkeepHealth,verifyM06UpkeepHealth})',
      );
      const execute = async (execution: string, platform = 'vimeo') => {
        let state = runtime.initializeM06Upkeep({ env: 'dev', platform }, execution);
        let calls = 0;
        while (['request', 'reconcile'].includes(state.action)) {
          if (++calls > 10) throw Error('native upkeep loop bound');
          const response = await invoke(state.request);
          if (state.request.operation === 'targets')
            expect(response.statusCode, JSON.stringify(response.body)).toBe(200);
          state = runtime.advanceM06Upkeep(state, response);
        }
        expect(state.action).toBe('done');
        return state;
      };
      const first = await execute('64001');
      expect(first.outcomes).toHaveLength(1);
      expect(first.outcomes[0]).toMatchObject({
        eligible: true,
        metrics_updated: 1,
        removal: { removed: 1, restored: 1 },
      });
      const rows = (
        await inspect(
          'select external_id,status,metrics,ai_status from app.items where account_id=$1 order by external_id',
          [account],
        )
      ).rows;
      expect(rows.map((r) => [r.external_id, r.status])).toEqual([
        ['101', 'active'],
        ['102', 'removed'],
        ['103', 'active'],
      ]);
      expect(rows[0].metrics.plays).toBe(77);
      expect(rows.every((r) => r.ai_status === 'published')).toBe(true);
      expect(rows[2].metrics.views).toBe(1);
      const reads = sourceReads,
        audit = (
          await inspect("select count(*)::int n from ops.audit_log where action='m06_apply_observation'")
        ).rows[0].n;
      const replay = await execute('64001');
      expect(replay.outcomes).toHaveLength(1);
      expect(sourceReads).toBe(reads);
      expect(
        (await inspect("select count(*)::int n from ops.audit_log where action='m06_apply_observation'"))
          .rows[0].n,
      ).toBe(audit);
      loseReceipt = true;
      const recovered = await execute('64002');
      expect(recovered.outcomes[0].eligible).toBe(true);
      expect(recovered.outcomes[0].removal).toMatchObject({ removed: 0, restored: 0 });
      sourceMode = 'empty';
      const empty = await execute('64003');
      expect(empty.outcomes[0]).toMatchObject({ eligible: false, reason: 'empty_listing', removal: null });
      sourceMode = 'partial';
      const partial = await execute('64004');
      expect(partial.outcomes[0].eligible).toBe(false);
      expect(partial.outcomes[0].removal).toBeNull();
      const paid = await execute('64005', 'instagram');
      expect(paid.outcomes[0]).toMatchObject({ eligible: false, metrics_updated: 2, removal: null });
      expect(paidReads).toBe(2);
      const paidItems = (
        await inspect(
          'select external_id,status,ai_status,metrics from app.items where account_id=$1 order by external_id',
          [instagram],
        )
      ).rows;
      expect(paidItems.every((r) => r.status === 'active' && r.ai_status === 'published')).toBe(true);
      expect(paidItems.find((r) => r.external_id === 'IGPOST')!.metrics.likes).toBe(5);
      expect(paidItems.find((r) => r.external_id === 'IGREEL')!.metrics.likes).toBe(5);
      await execute('64005', 'instagram');
      expect(paidReads).toBe(2);
      const quotaBefore = Number(
        (await inspect('select coalesce(sum(used_units),0) n from ops.m05_quota')).rows[0].n,
      );
      const youtubeResult = await execute('64006', 'youtube');
      expect(youtubeResult.outcomes[0]).toMatchObject({ eligible: true, metrics_updated: 1 });
      expect(
        Number((await inspect('select coalesce(sum(used_units),0) n from ops.m05_quota')).rows[0].n),
      ).toBe(quotaBefore + 2);
      const youtubeReads = sourceReads;
      await execute('64006', 'youtube');
      expect(sourceReads).toBe(youtubeReads);
      expect(
        Number((await inspect('select coalesce(sum(used_units),0) n from ops.m05_quota')).rows[0].n),
      ).toBe(quotaBefore + 2);
      expect((await inspect('select count(*)::int n from pgmq.q_ai_extract')).rows[0].n).toBe(aiBefore);
      // The old loopback seed uses deliberately non-RFC account UUIDs. Its
      // weeks-old null-success clocks would leak those fixture IDs into the
      // strict health wire contract. Set only fixture clocks in this rollback
      // transaction; do not weaken the shared/native validator or change due
      // state. This is controlled local health evidence, not a hosted reading.
      await inspect(
        'update app.competitor_accounts set last_success_at=clock_timestamp() where competitor_id<>$1',
        [competitor],
      );
      const actualHealth = await dispatch('health', {}, new AbortController().signal);
      expect(
        gatewayBusinessResult(actualHealth, 'health.read'),
        JSON.stringify(actualHealth, (key, value) =>
          ['account_id', 'competitor', 'handle', 'last_error'].includes(key) ? '[local fixture]' : value,
        ),
      ).toBe(true);
      const healthPrior = runtime.initializeM06UpkeepHealth({ env: 'dev' }, '64901');
      const health = await invoke(healthPrior.request);
      expect(health.statusCode, JSON.stringify(health.body)).toBe(200);
      expect(health.body.result.sent).toBe(false);
      expect(health.body.result.projection.story_queue_depth).toBeNull();
      expect(runtime.verifyM06UpkeepHealth(health, healthPrior).sent).toBe(false);
      expect(savepoint).toBeUndefined();
    } finally {
      await c.query('reset session authorization').catch(() => {});
      await c.query('rollback');
      expect((await c.query(baselineSql)).rows[0]).toEqual(baseline);
      await c.end();
    }
  }, 60000);
});
